import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';

const ActuatorControl = () => {
  const [connectionStatus, setConnectionStatus] = useState('Connecting...');
  const [isConnected, setIsConnected] = useState(false);
  const [lastCommand, setLastCommand] = useState('');
  const [connectionError, setConnectionError] = useState('');
  const [activeButton, setActiveButton] = useState(null);
  
  // Position tracking
  const [currentPosition, setCurrentPosition] = useState(500);
  const [midpoint, setMidpoint] = useState(500);
  const [maxDistanceLeft, setMaxDistanceLeft] = useState(200);
  const [maxDistanceRight, setMaxDistanceRight] = useState(200);
  const [isCalibrated, setIsCalibrated] = useState(false);
  
  // Test sequence
  const [isRunningTest, setIsRunningTest] = useState(false);
  const [testProgress, setTestProgress] = useState('');
  const [testType, setTestType] = useState('');
  
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const holdIntervalRef = useRef(null);

  // Flask API
  const FLASK_API = 'http://localhost:5000';

  useEffect(() => {
    connectWebSocket();
    loadCalibration();

    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (holdIntervalRef.current) clearInterval(holdIntervalRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  const loadCalibration = async () => {
    try {
      const response = await axios.get(`${FLASK_API}/actuator-calibration`);
      if (response.data.success && response.data.calibration) {
        const cal = response.data.calibration;
        setMidpoint(parseFloat(cal.midpoint) || 500);
        setMaxDistanceLeft(parseFloat(cal.max_distance_left) || 200);
        setMaxDistanceRight(parseFloat(cal.max_distance_right) || 200);
        setIsCalibrated(cal.is_calibrated || false);
        
        // Send calibration to Arduino
        if (cal.is_calibrated) {
          const calCmd = `CAL:${cal.midpoint},${cal.max_distance_left},${cal.max_distance_right}`;
          sendCommand(calCmd);
        }
      }
    } catch (error) {
      console.error('Error loading calibration:', error);
    }
  };

  const connectWebSocket = () => {
    try {
      const ws = new WebSocket('ws://localhost:8080');
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('WebSocket connected');
        setConnectionStatus('Connected');
        setIsConnected(true);
        setConnectionError('');
      };

      ws.onmessage = (event) => {
        const message = event.data.trim();
        console.log('Arduino:', message);
        
        // Parse position updates: POS:500.00,MID:500.00,DL:200.00,DR:200.00,CAL:1
        if (message.startsWith('POS:')) {
          parsePositionUpdate(message);
        }
        
        // Handle limit warnings
        if (message.includes('LIMIT:')) {
          setTestProgress(prev => prev + '\n⚠️ ' + message);
        }
      };

      ws.onclose = () => {
        console.log('WebSocket disconnected');
        setConnectionStatus('Disconnected');
        setIsConnected(false);
        
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log('Attempting to reconnect...');
          setConnectionStatus('Reconnecting...');
          connectWebSocket();
        }, 5000);
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setConnectionStatus('Connection Error');
        setIsConnected(false);
        setConnectionError('Unable to connect to WebSocket server on port 8080.');
      };
    } catch (error) {
      console.error('Failed to create WebSocket:', error);
      setConnectionStatus('Connection Failed');
      setIsConnected(false);
      setConnectionError('Failed to create WebSocket connection.');
    }
  };

  const parsePositionUpdate = (message) => {
    // Parse: POS:500.00,MID:500.00,DL:200.00,DR:200.00,CAL:1
    const parts = message.split(',');
    parts.forEach(part => {
      if (part.startsWith('POS:')) {
        setCurrentPosition(parseFloat(part.substring(4)));
      } else if (part.startsWith('MID:')) {
        setMidpoint(parseFloat(part.substring(4)));
      } else if (part.startsWith('DL:')) {
        setMaxDistanceLeft(parseFloat(part.substring(3)));
      } else if (part.startsWith('DR:')) {
        setMaxDistanceRight(parseFloat(part.substring(3)));
      } else if (part.startsWith('CAL:')) {
        setIsCalibrated(part.substring(4) === '1');
      }
    });
  };

  const sendCommand = (command) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(command);
      setLastCommand(command);
      console.log(`Sent: ${command}`);
    } else {
      console.error('WebSocket is not connected');
      setConnectionError('Not connected to server.');
    }
  };

  const handleMouseDown = (command, buttonName) => {
    if (!isConnected || isRunningTest) return;
    
    setActiveButton(buttonName);
    sendCommand(command);
    
    holdIntervalRef.current = setInterval(() => {
      sendCommand(command);
    }, 100);
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
  };

  const handleStop = () => {
    sendCommand('S');
    if (holdIntervalRef.current) {
      clearInterval(holdIntervalRef.current);
      holdIntervalRef.current = null;
    }
    setActiveButton(null);
    setIsRunningTest(false);
    setTestProgress('');
  };

  // Automated Test Sequences
  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  const runTest1_MidpointToLeftAndBack = async () => {
    setIsRunningTest(true);
    setTestType('Test 1: Midpoint → Left → Midpoint');
    setTestProgress('Starting Test 1...\n');
    
    try {
      // Move to midpoint first
      setTestProgress(prev => prev + '📍 Moving to midpoint...\n');
      sendCommand('RESET');
      await sleep(1000);
      
      // Move to left limit
      setTestProgress(prev => prev + '← Moving to LEFT limit...\n');
      sendCommand('L100');
      await sleep(5000); // Adjust based on your actuator speed
      sendCommand('S');
      await sleep(500);
      
      // Move back to midpoint
      setTestProgress(prev => prev + '→ Returning to midpoint...\n');
      sendCommand('R100');
      await sleep(2500);
      sendCommand('S');
      
      setTestProgress(prev => prev + '✅ Test 1 Complete!\n');
    } catch (error) {
      setTestProgress(prev => prev + `❌ Error: ${error.message}\n`);
    } finally {
      setIsRunningTest(false);
    }
  };

  const runTest2_MidpointToRightAndBack = async () => {
    setIsRunningTest(true);
    setTestType('Test 2: Midpoint → Right → Midpoint');
    setTestProgress('Starting Test 2...\n');
    
    try {
      // Move to midpoint first
      setTestProgress(prev => prev + '📍 Moving to midpoint...\n');
      sendCommand('RESET');
      await sleep(1000);
      
      // Move to right limit
      setTestProgress(prev => prev + '→ Moving to RIGHT limit...\n');
      sendCommand('R100');
      await sleep(5000);
      sendCommand('S');
      await sleep(500);
      
      // Move back to midpoint
      setTestProgress(prev => prev + '← Returning to midpoint...\n');
      sendCommand('L100');
      await sleep(2500);
      sendCommand('S');
      
      setTestProgress(prev => prev + '✅ Test 2 Complete!\n');
    } catch (error) {
      setTestProgress(prev => prev + `❌ Error: ${error.message}\n`);
    } finally {
      setIsRunningTest(false);
    }
  };

  const runTest3_EndToEnd = async () => {
    setIsRunningTest(true);
    setTestType('Test 3: Full Range Test');
    setTestProgress('Starting Test 3 (End-to-End)...\n');
    
    try {
      // Start from midpoint
      setTestProgress(prev => prev + '📍 Starting from midpoint...\n');
      sendCommand('RESET');
      await sleep(1000);
      
      // Midpoint → Left
      setTestProgress(prev => prev + '← Step 1: Midpoint to LEFT...\n');
      sendCommand('L100');
      await sleep(5000);
      sendCommand('S');
      await sleep(500);
      
      // Left → Right
      setTestProgress(prev => prev + '→ Step 2: LEFT to RIGHT...\n');
      sendCommand('R100');
      await sleep(10000);
      sendCommand('S');
      await sleep(500);
      
      // Right → Left
      setTestProgress(prev => prev + '← Step 3: RIGHT to LEFT...\n');
      sendCommand('L100');
      await sleep(10000);
      sendCommand('S');
      await sleep(500);
      
      // Left → Midpoint
      setTestProgress(prev => prev + '→ Step 4: LEFT to Midpoint...\n');
      sendCommand('R100');
      await sleep(5000);
      sendCommand('S');
      
      setTestProgress(prev => prev + '✅ Test 3 Complete!\n');
    } catch (error) {
      setTestProgress(prev => prev + `❌ Error: ${error.message}\n`);
    } finally {
      setIsRunningTest(false);
    }
  };

  // Calculate position metrics
  const distanceFromMidpoint = currentPosition - midpoint;
  const minPosition = midpoint - maxDistanceLeft;
  const maxPosition = midpoint + maxDistanceRight;
  const totalRange = maxDistanceLeft + maxDistanceRight;
  const positionPercentage = totalRange > 0 
    ? ((currentPosition - minPosition) / (maxPosition - minPosition) * 100)
    : 50;

  // Position indicator color
  const getPositionColor = () => {
    if (!isCalibrated) return 'text-gray-400';
    if (currentPosition <= minPosition || currentPosition >= maxPosition) return 'text-red-400';
    if (Math.abs(distanceFromMidpoint) < 10) return 'text-green-400';
    return 'text-blue-400';
  };

  useEffect(() => {
    const handleGlobalMouseUp = () => handleMouseUp();
    window.addEventListener('mouseup', handleGlobalMouseUp);
    window.addEventListener('mouseleave', handleGlobalMouseUp);
    return () => {
      window.removeEventListener('mouseup', handleGlobalMouseUp);
      window.removeEventListener('mouseleave', handleGlobalMouseUp);
    };
  }, [activeButton]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black py-4 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-4 text-center">
          <h1 className="text-3xl font-bold text-white mb-2 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            Actuator Control & Testing
          </h1>
          <p className="text-gray-400 text-sm">Real-time Position Tracking</p>
        </div>

        {/* Connection & Position Status */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          {/* Connection Status */}
          <div className="bg-gray-800 bg-opacity-50 backdrop-blur-sm border border-gray-700 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
                <span className="text-white text-sm font-semibold">{connectionStatus}</span>
              </div>
              {!isConnected && (
                <button onClick={() => connectWebSocket()} className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded">
                  Reconnect
                </button>
              )}
            </div>
          </div>

          {/* Calibration Status */}
          <div className="bg-gray-800 bg-opacity-50 backdrop-blur-sm border border-gray-700 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${isCalibrated ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
                <span className="text-white text-sm font-semibold">
                  {isCalibrated ? 'Calibrated' : 'Not Calibrated'}
                </span>
              </div>
              <button onClick={loadCalibration} className="px-3 py-1 text-xs bg-purple-600 hover:bg-purple-700 text-white rounded">
                Reload Cal
              </button>
            </div>
          </div>
        </div>

        {/* Position Display */}
        <div className="bg-gradient-to-br from-blue-900 to-indigo-900 bg-opacity-30 border border-blue-500 border-opacity-30 rounded-lg p-4 mb-4">
          <h3 className="text-lg font-bold text-white mb-3">📍 Position Tracking</h3>
          
          {/* Current Position - Large Display */}
          <div className="text-center mb-4">
            <div className="text-sm text-gray-400 mb-1">Current Position</div>
            <div className={`text-5xl font-bold ${getPositionColor()}`}>
              {currentPosition.toFixed(1)}
            </div>
            <div className="text-sm text-gray-400 mt-1">
              {distanceFromMidpoint >= 0 ? '+' : ''}{distanceFromMidpoint.toFixed(1)} from midpoint
            </div>
          </div>

          {/* Position Bar */}
          <div className="relative h-8 bg-gray-700 rounded-full overflow-hidden mb-4">
            {/* Left limit marker */}
            <div className="absolute left-0 top-0 h-full w-1 bg-red-500"></div>
            {/* Midpoint marker */}
            <div className="absolute left-1/2 top-0 h-full w-1 bg-green-500 transform -translate-x-1/2"></div>
            {/* Right limit marker */}
            <div className="absolute right-0 top-0 h-full w-1 bg-red-500"></div>
            {/* Position indicator */}
            <div 
              className="absolute top-0 h-full w-3 bg-blue-400 rounded-full transform -translate-x-1/2 transition-all duration-200"
              style={{ left: `${positionPercentage}%` }}
            ></div>
          </div>

          {/* Position Details */}
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="bg-gray-800 bg-opacity-50 rounded p-2 text-center">
              <div className="text-gray-400">Left Limit</div>
              <div className="text-red-400 font-bold">{minPosition.toFixed(1)}</div>
            </div>
            <div className="bg-gray-800 bg-opacity-50 rounded p-2 text-center">
              <div className="text-gray-400">Midpoint</div>
              <div className="text-green-400 font-bold">{midpoint.toFixed(1)}</div>
            </div>
            <div className="bg-gray-800 bg-opacity-50 rounded p-2 text-center">
              <div className="text-gray-400">Right Limit</div>
              <div className="text-blue-400 font-bold">{maxPosition.toFixed(1)}</div>
            </div>
          </div>
        </div>

        {/* Manual Controls */}
        <div className="bg-gray-800 bg-opacity-50 backdrop-blur-sm border border-gray-700 rounded-lg p-4 mb-4">
          <h2 className="text-xl font-bold text-white mb-4 text-center">Manual Controls</h2>
          
          <div className="grid grid-cols-3 gap-3">
            {/* Retract Button */}
            <button
              onMouseDown={() => handleMouseDown('L100', 'retract')}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              disabled={!isConnected || isRunningTest}
              className={`bg-gradient-to-br from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 disabled:from-gray-600 disabled:to-gray-500 text-white font-bold py-4 rounded-lg transition-all disabled:opacity-50 ${
                activeButton === 'retract' ? 'scale-95 shadow-inner' : ''
              }`}
            >
              <div className="flex flex-col items-center gap-1">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                <span className="text-sm">Retract</span>
              </div>
            </button>

            {/* Stop Button */}
            <button
              onClick={handleStop}
              disabled={!isConnected}
              className="bg-gradient-to-br from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 disabled:from-gray-600 disabled:to-gray-500 text-white font-bold py-4 rounded-lg transition-all disabled:opacity-50"
            >
              <div className="flex flex-col items-center gap-1">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                <span className="text-sm">STOP</span>
              </div>
            </button>

            {/* Extend Button */}
            <button
              onMouseDown={() => handleMouseDown('R100', 'extend')}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              disabled={!isConnected || isRunningTest}
              className={`bg-gradient-to-br from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 disabled:from-gray-600 disabled:to-gray-500 text-white font-bold py-4 rounded-lg transition-all disabled:opacity-50 ${
                activeButton === 'extend' ? 'scale-95 shadow-inner' : ''
              }`}
            >
              <div className="flex flex-col items-center gap-1">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                <span className="text-sm">Extend</span>
              </div>
            </button>
          </div>
        </div>

        {/* Automated Test Sequences */}
        <div className="bg-gray-800 bg-opacity-50 backdrop-blur-sm border border-gray-700 rounded-lg p-4">
          <h2 className="text-xl font-bold text-white mb-4">🧪 Automated Tests</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
            <button
              onClick={runTest1_MidpointToLeftAndBack}
              disabled={!isConnected || !isCalibrated || isRunningTest}
              className="bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 disabled:from-gray-600 disabled:to-gray-500 text-white font-semibold py-3 px-4 rounded-lg transition-all disabled:opacity-50 text-sm"
            >
              Test 1<br/>Mid → Left → Mid
            </button>

            <button
              onClick={runTest2_MidpointToRightAndBack}
              disabled={!isConnected || !isCalibrated || isRunningTest}
              className="bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 disabled:from-gray-600 disabled:to-gray-500 text-white font-semibold py-3 px-4 rounded-lg transition-all disabled:opacity-50 text-sm"
            >
              Test 2<br/>Mid → Right → Mid
            </button>

            <button
              onClick={runTest3_EndToEnd}
              disabled={!isConnected || !isCalibrated || isRunningTest}
              className="bg-gradient-to-r from-pink-600 to-pink-500 hover:from-pink-500 hover:to-pink-400 disabled:from-gray-600 disabled:to-gray-500 text-white font-semibold py-3 px-4 rounded-lg transition-all disabled:opacity-50 text-sm"
            >
              Test 3<br/>Full Range
            </button>
          </div>

          {/* Test Progress Display */}
          {(isRunningTest || testProgress) && (
            <div className="bg-black bg-opacity-50 rounded-lg p-4 border border-gray-700">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-bold text-white">{testType}</h3>
                {isRunningTest && (
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="text-xs text-gray-400">Running...</span>
                  </div>
                )}
              </div>
              <pre className="text-xs text-green-400 whitespace-pre-wrap font-mono max-h-40 overflow-y-auto">
                {testProgress}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ActuatorControl;