import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';

const ActuatorCalibration = ({ onBack }) => {
  // State management
  const [calibrationStep, setCalibrationStep] = useState(1);
  const [calibrationData, setCalibrationData] = useState({
    midpoint: 0,
    max_distance_left: 0,
    max_distance_right: 0,
    is_calibrated: false
  });
  
  // WebSocket for actuator control
  const [wsConnected, setWsConnected] = useState(false);
  const [currentPosition, setCurrentPosition] = useState(500); // ✅ FIXED: Start with non-zero default
  const [activeButton, setActiveButton] = useState(null);
  const wsRef = useRef(null);
  const holdIntervalRef = useRef(null);
  
  // Position simulation (since Arduino doesn't send position feedback)
  const positionRef = useRef(500); // ✅ FIXED: Start with non-zero default
  const positionIntervalRef = useRef(null);
  
  // UI State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Flask API base URL
  const FLASK_API = 'http://localhost:5000';

  // Helper function to safely format numbers
  const safeToFixed = (value, decimals = 2) => {
    const num = Number(value);
    return isNaN(num) ? '0.00' : num.toFixed(decimals);
  };

  useEffect(() => {
    connectWebSocket();
    loadCalibration();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (holdIntervalRef.current) {
        clearInterval(holdIntervalRef.current);
      }
      if (positionIntervalRef.current) {
        clearInterval(positionIntervalRef.current);
      }
    };
  }, []);

  // WebSocket connection
  const connectWebSocket = () => {
    try {
      const ws = new WebSocket('ws://localhost:8080');
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('WebSocket connected for calibration');
        setWsConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.position !== undefined) {
            positionRef.current = data.position;
            setCurrentPosition(data.position);
          }
        } catch (e) {
          console.log('Non-JSON message:', event.data);
        }
      };

      ws.onclose = () => {
        console.log('WebSocket disconnected');
        setWsConnected(false);
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setWsConnected(false);
      };
    } catch (error) {
      console.error('Failed to create WebSocket:', error);
      setWsConnected(false);
    }
  };

  // Load existing calibration
  const loadCalibration = async () => {
    try {
      const response = await axios.get(`${FLASK_API}/actuator-calibration`);
      if (response.data.success) {
        setCalibrationData(response.data.calibration);
        if (response.data.calibration.is_calibrated) {
          setCalibrationStep(4);
        }
      }
    } catch (error) {
      console.error('Error loading calibration:', error);
    }
  };

  // Send command to actuator
  const sendCommand = (command) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(command);
    }
  };

  // Handle manual position changes
  const handleManualPositionChange = (value) => {
    const newPosition = parseFloat(value) || 0;
    setCurrentPosition(newPosition);
    positionRef.current = newPosition;
  };

  // Position simulation for button holds
  const startPositionSimulation = (direction) => {
    if (positionIntervalRef.current) {
      clearInterval(positionIntervalRef.current);
    }

    positionIntervalRef.current = setInterval(() => {
      if (direction === 'left') {
        positionRef.current -= 5;
      } else if (direction === 'right') {
        positionRef.current += 5;
      }
      setCurrentPosition(positionRef.current);
    }, 100);
  };

  const stopPositionSimulation = () => {
    if (positionIntervalRef.current) {
      clearInterval(positionIntervalRef.current);
      positionIntervalRef.current = null;
    }
  };

  // Control button handlers
  const handleMouseDown = (command, direction) => {
    setActiveButton(direction);
    sendCommand(command);
    
    holdIntervalRef.current = setInterval(() => {
      sendCommand(command);
    }, 100);

    startPositionSimulation(direction);
  };

  const handleMouseUp = () => {
    if (holdIntervalRef.current) {
      clearInterval(holdIntervalRef.current);
      holdIntervalRef.current = null;
    }
    
    if (activeButton) {
      sendCommand('S');
      setActiveButton(null);
    }

    stopPositionSimulation();
  };

  const handleStop = () => {
    sendCommand('S');
    if (holdIntervalRef.current) {
      clearInterval(holdIntervalRef.current);
      holdIntervalRef.current = null;
    }
    setActiveButton(null);
    stopPositionSimulation();
  };

  // ✅ FIXED: Validate midpoint before sending
  const setMidpoint = async () => {
    // Validate that position is not zero
    if (currentPosition === 0) {
      setError('Please enter a midpoint position (cannot be 0). Enter a value like 500.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      console.log('Sending midpoint:', currentPosition); // Debug log
      
      const response = await axios.post(`${FLASK_API}/actuator-calibration/set-midpoint`, {
        midpoint: currentPosition
      });

      if (response.data.success) {
        setCalibrationData(response.data.calibration);
        setSuccess(`Midpoint set to position: ${currentPosition}`);
        setTimeout(() => {
          setCalibrationStep(2);
          setSuccess('');
        }, 1500);
      } else {
        setError(response.data.error || 'Failed to set midpoint');
      }
    } catch (error) {
      console.error('Set midpoint error:', error);
      setError('Error setting midpoint: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  // ✅ FIXED: Validate position before setting limits
  const setLeftLimit = async () => {
    if (currentPosition === 0) {
      setError('Please enter a left limit position (cannot be 0). Use buttons or type a value like 300.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      console.log('Sending left limit:', currentPosition); // Debug log
      
      const response = await axios.post(`${FLASK_API}/actuator-calibration/set-limits`, {
        current_position: currentPosition,
        direction: 'left'
      });

      if (response.data.success) {
        setCalibrationData(response.data.calibration);
        const leftDistance = Number(response.data.calibration.max_distance_left) || 0;
        setSuccess(`Left limit set: ${leftDistance.toFixed(2)} units from midpoint`);
        setTimeout(() => {
          setCalibrationStep(3);
          setSuccess('');
        }, 1500);
      } else {
        setError(response.data.error || 'Failed to set left limit');
      }
    } catch (error) {
      console.error('Set left limit error:', error);
      setError('Error setting left limit: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  // ✅ FIXED: Validate position before setting limits
  const setRightLimit = async () => {
    if (currentPosition === 0) {
      setError('Please enter a right limit position (cannot be 0). Use buttons or type a value like 800.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      console.log('Sending right limit:', currentPosition); // Debug log
      
      const response = await axios.post(`${FLASK_API}/actuator-calibration/set-limits`, {
        current_position: currentPosition,
        direction: 'right'
      });

      if (response.data.success) {
        setCalibrationData(response.data.calibration);
        const rightDistance = Number(response.data.calibration.max_distance_right) || 0;
        setSuccess(`Right limit set: ${rightDistance.toFixed(2)} units from midpoint`);
        setTimeout(() => {
          setCalibrationStep(4);
          setSuccess('');
        }, 1500);
      } else {
        setError(response.data.error || 'Failed to set right limit');
      }
    } catch (error) {
      console.error('Set right limit error:', error);
      setError('Error setting right limit: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  const resetCalibration = async () => {
    if (!window.confirm('Are you sure you want to reset the calibration?')) {
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await axios.post(`${FLASK_API}/actuator-calibration/reset`);
      if (response.data.success) {
        setCalibrationData({
          midpoint: 0,
          max_distance_left: 0,
          max_distance_right: 0,
          is_calibrated: false
        });
        setCalibrationStep(1);
        setCurrentPosition(500); // Reset to default
        positionRef.current = 500;
        setSuccess('Calibration reset successfully');
      }
    } catch (error) {
      setError('Error resetting calibration: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Render calibration step content
  const renderStepContent = () => {
    switch (calibrationStep) {
      case 1:
        return (
          <div className="space-y-4">
            <h3 className="text-2xl font-bold text-white text-center">Step 1: Set Midpoint (N)</h3>
            <p className="text-gray-300 text-center">
              Move the actuator to the desired midpoint position, then click "Set Midpoint"
            </p>
            
            {/* Manual Position Input */}
            <div className="bg-gray-900 bg-opacity-50 border border-gray-700 rounded-lg p-4">
              <label className="block text-white text-sm font-semibold mb-2">Manual Position Entry:</label>
              <input
                type="number"
                value={currentPosition}
                onChange={(e) => handleManualPositionChange(e.target.value)}
                className="w-full bg-gray-800 border border-gray-600 rounded-lg px-4 py-2 text-white text-center text-2xl font-bold"
                placeholder="Enter position (e.g., 500)"
              />
              <p className="text-gray-400 text-xs mt-2 text-center">
                Type a position value or use the buttons below to adjust
              </p>
            </div>

            {/* Current Position Display */}
            <div className="bg-purple-900 bg-opacity-30 border border-purple-700 rounded-lg p-4 text-center">
              <p className="text-purple-200 text-sm mb-2">Current Position</p>
              <p className="text-4xl font-bold text-purple-300">{currentPosition}</p>
            </div>

            {/* Control Buttons */}
            <div className="grid grid-cols-3 gap-2">
              <button
                onMouseDown={() => handleMouseDown('L255', 'left')}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                disabled={!wsConnected}
                className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white font-bold py-3 px-4 rounded-lg transition-all"
              >
                ← Left
              </button>
              <button
                onClick={handleStop}
                disabled={!wsConnected}
                className="bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white font-bold py-3 px-4 rounded-lg transition-all"
              >
                STOP
              </button>
              <button
                onMouseDown={() => handleMouseDown('R255', 'right')}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                disabled={!wsConnected}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white font-bold py-3 px-4 rounded-lg transition-all"
              >
                Right →
              </button>
            </div>

            <button
              onClick={setMidpoint}
              disabled={loading || !wsConnected}
              className="w-full bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 disabled:from-gray-600 disabled:to-gray-500 text-white font-bold py-4 px-8 rounded-xl transition-all duration-300 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Setting...' : 'Set Midpoint'}
            </button>
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <h3 className="text-2xl font-bold text-white text-center">Step 2: Set Left Limit (DL)</h3>
            <p className="text-gray-300 text-center">
              Move the actuator to the maximum LEFT position, then click "Set Left Limit"
            </p>
            
            {/* Manual Position Input */}
            <div className="bg-gray-900 bg-opacity-50 border border-gray-700 rounded-lg p-4">
              <label className="block text-white text-sm font-semibold mb-2">Manual Position Entry:</label>
              <input
                type="number"
                value={currentPosition}
                onChange={(e) => handleManualPositionChange(e.target.value)}
                className="w-full bg-gray-800 border border-gray-600 rounded-lg px-4 py-2 text-white text-center text-2xl font-bold"
                placeholder="Enter position (e.g., 300)"
              />
            </div>

            {/* Midpoint Reference */}
            <div className="bg-purple-900 bg-opacity-30 border border-purple-700 rounded-lg p-3 text-center">
              <p className="text-purple-200 text-sm">Midpoint (N): <span className="font-bold">{calibrationData.midpoint}</span></p>
            </div>

            {/* Current Position & Distance */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-green-900 bg-opacity-30 border border-green-700 rounded-lg p-3 text-center">
                <p className="text-green-200 text-sm mb-1">Current Position</p>
                <p className="text-2xl font-bold text-green-300">{currentPosition}</p>
              </div>
              <div className="bg-blue-900 bg-opacity-30 border border-blue-700 rounded-lg p-3 text-center">
                <p className="text-blue-200 text-sm mb-1">Distance from Midpoint</p>
                <p className="text-2xl font-bold text-blue-300">
                  {safeToFixed(Math.abs(currentPosition - calibrationData.midpoint), 1)}
                </p>
              </div>
            </div>

            {/* Control Buttons */}
            <div className="grid grid-cols-3 gap-2">
              <button
                onMouseDown={() => handleMouseDown('L255', 'left')}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                disabled={!wsConnected}
                className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white font-bold py-3 px-4 rounded-lg"
              >
                ← Left
              </button>
              <button
                onClick={handleStop}
                disabled={!wsConnected}
                className="bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white font-bold py-3 px-4 rounded-lg"
              >
                STOP
              </button>
              <button
                onMouseDown={() => handleMouseDown('R255', 'right')}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                disabled={!wsConnected}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white font-bold py-3 px-4 rounded-lg"
              >
                Right →
              </button>
            </div>

            <button
              onClick={setLeftLimit}
              disabled={loading || !wsConnected}
              className="w-full bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 disabled:from-gray-600 disabled:to-gray-500 text-white font-bold py-4 px-8 rounded-xl transition-all duration-300 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Setting...' : 'Set Left Limit'}
            </button>
          </div>
        );

      case 3:
        return (
          <div className="space-y-4">
            <h3 className="text-2xl font-bold text-white text-center">Step 3: Set Right Limit (DR)</h3>
            <p className="text-gray-300 text-center">
              Move the actuator to the maximum RIGHT position, then click "Set Right Limit"
            </p>
            
            {/* Manual Position Input */}
            <div className="bg-gray-900 bg-opacity-50 border border-gray-700 rounded-lg p-4">
              <label className="block text-white text-sm font-semibold mb-2">Manual Position Entry:</label>
              <input
                type="number"
                value={currentPosition}
                onChange={(e) => handleManualPositionChange(e.target.value)}
                className="w-full bg-gray-800 border border-gray-600 rounded-lg px-4 py-2 text-white text-center text-2xl font-bold"
                placeholder="Enter position (e.g., 800)"
              />
            </div>

            {/* Midpoint Reference */}
            <div className="bg-purple-900 bg-opacity-30 border border-purple-700 rounded-lg p-3 text-center">
              <p className="text-purple-200 text-sm">Midpoint (N): <span className="font-bold">{calibrationData.midpoint}</span></p>
            </div>

            {/* Current Position & Distance */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-blue-900 bg-opacity-30 border border-blue-700 rounded-lg p-3 text-center">
                <p className="text-blue-200 text-sm mb-1">Current Position</p>
                <p className="text-2xl font-bold text-blue-300">{currentPosition}</p>
              </div>
              <div className="bg-orange-900 bg-opacity-30 border border-orange-700 rounded-lg p-3 text-center">
                <p className="text-orange-200 text-sm mb-1">Distance from Midpoint</p>
                <p className="text-2xl font-bold text-orange-300">
                  {safeToFixed(Math.abs(currentPosition - calibrationData.midpoint), 1)}
                </p>
              </div>
            </div>

            {/* Control Buttons */}
            <div className="grid grid-cols-3 gap-2">
              <button
                onMouseDown={() => handleMouseDown('L255', 'left')}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                disabled={!wsConnected}
                className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white font-bold py-3 px-4 rounded-lg"
              >
                ← Left
              </button>
              <button
                onClick={handleStop}
                disabled={!wsConnected}
                className="bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white font-bold py-3 px-4 rounded-lg"
              >
                STOP
              </button>
              <button
                onMouseDown={() => handleMouseDown('R255', 'right')}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                disabled={!wsConnected}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white font-bold py-3 px-4 rounded-lg"
              >
                Right →
              </button>
            </div>

            <button
              onClick={setRightLimit}
              disabled={loading || !wsConnected}
              className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 disabled:from-gray-600 disabled:to-gray-500 text-white font-bold py-4 px-8 rounded-xl transition-all duration-300 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Setting...' : 'Set Right Limit'}
            </button>
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <div className="inline-block bg-green-900 bg-opacity-30 border-2 border-green-500 rounded-full p-4 mb-4">
                <svg className="w-16 h-16 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-3xl font-bold text-white mb-2">Calibration Complete!</h3>
              <p className="text-gray-300">Your actuator has been successfully calibrated</p>
            </div>

            {/* Calibration Summary */}
            <div className="bg-gray-900 bg-opacity-50 border border-gray-700 rounded-xl p-6 space-y-4">
              <h4 className="text-xl font-bold text-white text-center mb-4">Calibration Summary</h4>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-purple-900 bg-opacity-30 border border-purple-700 rounded-lg p-4 text-center">
                  <p className="text-purple-200 text-sm mb-2">Midpoint (N)</p>
                  <p className="text-3xl font-bold text-purple-300">{calibrationData.midpoint}</p>
                </div>
                <div className="bg-green-900 bg-opacity-30 border border-green-700 rounded-lg p-4 text-center">
                  <p className="text-green-200 text-sm mb-2">Left Distance (DL)</p>
                  <p className="text-3xl font-bold text-green-300">{safeToFixed(calibrationData.max_distance_left, 1)}</p>
                </div>
                <div className="bg-blue-900 bg-opacity-30 border border-blue-700 rounded-lg p-4 text-center">
                  <p className="text-blue-200 text-sm mb-2">Right Distance (DR)</p>
                  <p className="text-3xl font-bold text-blue-300">{safeToFixed(calibrationData.max_distance_right, 1)}</p>
                </div>
              </div>

              <div className="bg-gray-800 bg-opacity-50 rounded-lg p-4 text-center">
                <p className="text-gray-300 text-sm mb-2">Total Travel Range</p>
                <p className="text-2xl font-bold text-white">
                  {safeToFixed(Number(calibrationData.max_distance_left) + Number(calibrationData.max_distance_right), 1)} units
                </p>
              </div>
            </div>

            <button
              onClick={resetCalibration}
              disabled={loading}
              className="w-full bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 disabled:from-gray-600 disabled:to-gray-500 text-white font-bold py-4 px-8 rounded-xl transition-all duration-300 hover:scale-105 disabled:opacity-50"
            >
              {loading ? 'Resetting...' : 'Reset Calibration'}
            </button>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={onBack}
            className="mb-4 flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Settings
          </button>
          
          <h1 className="text-5xl font-bold text-white mb-4 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            Actuator Calibration
          </h1>
          <p className="text-gray-400 text-lg">Configure midpoint and travel limits</p>
        </div>

        {/* WebSocket Status */}
        <div className="mb-6 bg-gray-800 bg-opacity-50 backdrop-blur-sm border border-gray-700 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${wsConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
              <span className="text-white text-sm">WebSocket: </span>
              <span className={wsConnected ? 'text-green-400 text-sm' : 'text-red-400 text-sm'}>
                {wsConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
            <p className="text-gray-400 text-xs">Make sure server.js is running</p>
          </div>
        </div>

        {/* Progress Indicator */}
        <div className="mb-8 bg-gray-800 bg-opacity-50 backdrop-blur-sm border border-gray-700 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            {[1, 2, 3, 4].map((step) => (
              <div key={step} className="flex items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all ${
                  calibrationStep >= step
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-700 text-gray-400'
                }`}>
                  {step}
                </div>
                {step < 4 && (
                  <div className={`w-12 md:w-24 h-1 mx-2 transition-all ${
                    calibrationStep > step ? 'bg-purple-600' : 'bg-gray-700'
                  }`}></div>
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-between text-xs text-gray-400">
            <span>Midpoint</span>
            <span>Left Limit</span>
            <span>Right Limit</span>
            <span>Complete</span>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6 bg-red-900 bg-opacity-30 border border-red-700 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-red-200 text-sm">{error}</p>
            </div>
          </div>
        )}

        {/* Success Display */}
        {success && (
          <div className="mb-6 bg-green-900 bg-opacity-30 border border-green-700 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <p className="text-green-200 text-sm">{success}</p>
            </div>
          </div>
        )}

        {/* Step Content */}
        <div className="bg-gray-800 bg-opacity-50 backdrop-blur-sm border border-gray-700 rounded-xl p-8">
          {renderStepContent()}
        </div>
      </div>
    </div>
  );
};

export default ActuatorCalibration;