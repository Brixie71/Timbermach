import React, { useState, useEffect, useRef } from "react";
import { AlertTriangle, Save } from 'lucide-react';

const KiloNewtonGauge = ({ 
  testType,
  subType,
  measurementData,
  onPreviousTest = () => {},
  onMainPageReturn = () => {},
  onTestComplete = () => {} 
}) => {
  // Pressure measurement state
  const [rawPressureBar, setRawPressureBar] = useState(0); // Raw sensor reading in BAR
  const [currentPressure, setCurrentPressure] = useState(0); // Calculated pressure/stress
  const [peakPressure, setPeakPressure] = useState(0); // Highest pressure achieved
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [showSavePrompt, setShowSavePrompt] = useState(false);
  const [testStartTime, setTestStartTime] = useState(null);
  
  // Baseline calibration
  const [baselineBar, setBaselineBar] = useState(0);
  const [isCalibrated, setIsCalibrated] = useState(false);
  const [autoZeroAttempted, setAutoZeroAttempted] = useState(false);
  
  // WebSocket connection state
  const [wsConnected, setWsConnected] = useState(false);
  
  // WebSocket ref
  const pressureWSRef = useRef(null);
  const updateIntervalRef = useRef(null);

  // Constants for conversions
  const CONTACT_AREA_MM2 = 76.2 * 76.2; // Contact area of plate to wood (mm²)
  const BAR_TO_N_FACTOR = 0.1; // Bar to N conversion factor

  // ============================================================================
  // WEBSOCKET CONNECTION
  // ============================================================================

  useEffect(() => {
    connectPressureWebSocket();

    return () => {
      if (pressureWSRef.current) {
        pressureWSRef.current.close();
      }
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
      }
    };
  }, []);

  const connectPressureWebSocket = () => {
    try {
      const ws = new WebSocket('ws://localhost:5001');
      pressureWSRef.current = ws;

      ws.onopen = () => {
        console.log('✓ Pressure sensor WebSocket connected');
        setWsConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.pressure !== undefined) {
            // Sensor sends pressure in MPa, convert to BAR (1 MPa = 10 Bar)
            let rawBar = data.pressure * 10;
            
            setRawPressureBar(rawBar);
            
            // Auto-zero on first connection
            if (!autoZeroAttempted && !isCalibrated) {
              setTimeout(() => {
                if (!isCalibrated && !autoZeroAttempted) {
                  setBaselineBar(rawBar);
                  setIsCalibrated(true);
                  setAutoZeroAttempted(true);
                  console.log('✓ Auto-calibrated baseline at', rawBar.toFixed(2), 'Bar');
                }
              }, 1000);
            }
            
            // Apply baseline calibration
            let calibratedBar = rawBar - baselineBar;
            if (calibratedBar < 0) calibratedBar = 0;
            
            // Calculate pressure/stress based on test type
            const calculated = calculatePressureOrStress(calibratedBar);
            setCurrentPressure(calculated);
          }
        } catch (e) {
          console.error('Error parsing pressure data:', e);
        }
      };

      ws.onerror = (error) => {
        console.error('✗ Pressure WebSocket error:', error);
        setWsConnected(false);
      };

      ws.onclose = () => {
        console.log('✗ Pressure WebSocket closed');
        setWsConnected(false);
        setTimeout(() => {
          console.log('Attempting to reconnect...');
          connectPressureWebSocket();
        }, 3000);
      };
    } catch (error) {
      console.error('Failed to create Pressure WebSocket:', error);
      setWsConnected(false);
    }
  };

  // ============================================================================
  // PEAK TRACKING - SEPARATE EFFECT FOR MONITORING
  // ============================================================================

  useEffect(() => {
    if (isMonitoring) {
      // Update peak pressure when monitoring and current exceeds peak
      if (currentPressure > peakPressure) {
        setPeakPressure(currentPressure);
        console.log('📈 New peak:', currentPressure.toFixed(2), 'N/mm²');
      }
    }
  }, [isMonitoring, currentPressure, peakPressure]);

  // ============================================================================
  // CALCULATE PRESSURE OR STRESS BASED ON TEST TYPE
  // ============================================================================

  const calculatePressureOrStress = (pressureBar) => {
    if (!pressureBar) return 0;

    const baseTestType = (testType || '').toLowerCase().replace(' test', '').trim();

    // Convert Bar to Newton: P (N) = Bar × 0.1 × Contact Area (mm²)
    const forceN = pressureBar * BAR_TO_N_FACTOR * CONTACT_AREA_MM2;

    if (baseTestType === 'flexure') {
      // Flexural Stress: σ = 3PL / (2bh²)
      if (!measurementData?.width || !measurementData?.height || !measurementData?.length) {
        return 0;
      }

      const P = forceN; // Force in N
      const L = measurementData.length; // Length (span) in mm
      const b = measurementData.width; // Base (width) in mm
      const h = measurementData.height; // Height in mm

      const stress = (3 * P * L) / (2 * b * h * h);
      return stress; // Returns N/mm²
    } else {
      // Compressive & Shear: σ = P/A (N/mm²)
      let area = 0;

      if (baseTestType === 'compressive') {
        if (subType === 'parallel') {
          // Parallel to Grain: A = W (base) × H
          area = (measurementData?.width || 0) * (measurementData?.height || 0);
        } else if (subType === 'perpendicular') {
          // Perpendicular to Grain: A = L × W (base)
          area = (measurementData?.length || 0) * (measurementData?.width || 0);
        }
      } else if (baseTestType === 'shear') {
        if (subType === 'single') {
          // Single Shear: A = W (base) × L
          area = (measurementData?.width || 0) * (measurementData?.length || 0);
        } else if (subType === 'double') {
          // Double Shear: A = (W (base) × L) × 2
          area = 2 * (measurementData?.width || 0) * (measurementData?.length || 0);
        }
      }

      if (area === 0) return 0;

      const stress = forceN / area;
      return stress; // Returns N/mm²
    }
  };

  // ============================================================================
  // TEST CONTROL FUNCTIONS
  // ============================================================================

  const handleCalibrate = () => {
    setBaselineBar(rawPressureBar);
    setIsCalibrated(true);
    setAutoZeroAttempted(true);
    console.log('✓ Manual calibration - baseline set at', rawPressureBar.toFixed(2), 'Bar');
  };

  const startMonitoring = () => {
    console.log('🎬 Starting pressure monitoring...');
    setTestStartTime(Date.now());
    setPeakPressure(0); // Reset peak to 0
    setIsMonitoring(true);
    setShowSavePrompt(false);
    console.log('✓ Monitoring started');
  };

  const stopMonitoring = () => {
    setIsMonitoring(false);
    setShowSavePrompt(true);
    console.log('✓ Monitoring stopped. Peak stress:', peakPressure.toFixed(2), 'N/mm²');
  };

  const handleSaveTest = () => {
    if (peakPressure > 0) {
      const strengthData = {
        maxStress: peakPressure, // N/mm²
        maxPressureMPa: peakPressure, // For compatibility
        timestamp: new Date().toISOString(),
        testType: testType,
        subType: subType,
        unit: 'N/mm²'
      };
      
      console.log('💾 Saving test data:', strengthData);
      
      if (typeof onTestComplete === 'function') {
        onTestComplete(strengthData);
      }
      
      setShowSavePrompt(false);
      setPeakPressure(0);
      setTestStartTime(null);
    }
  };

  const handleDiscardTest = () => {
    setShowSavePrompt(false);
    setPeakPressure(0);
    setTestStartTime(null);
    console.log('🗑️ Test data discarded');
  };

  // ============================================================================
  // NAVIGATION HANDLERS
  // ============================================================================

  const handlePreviousTest = () => {
    if (isMonitoring) setIsMonitoring(false);
    if (typeof onPreviousTest === 'function') {
      onPreviousTest();
    }
  };

  const handleMainPageReturn = () => {
    if (isMonitoring) setIsMonitoring(false);
    if (typeof onMainPageReturn === 'function') {
      onMainPageReturn();
    }
  };

  // Get unit label based on test type
  const getUnitLabel = () => {
    return 'N/mm²';
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="fixed inset-0 flex flex-col h-screen w-screen bg-gray-900">
      {/* Header Bar */}
      <div className="flex items-center px-3 py-1.5 bg-gray-800 fixed top-0 left-0 right-0 z-10">
        <button
          type="button"
          onClick={handlePreviousTest}
          className="bg-transparent border-none text-gray-200 text-2xl cursor-pointer p-1.5 hover:text-blue-400 transition-colors duration-300"
        >
          ☰
        </button>
        <span className="ml-4 text-gray-100 text-lg font-semibold">
          TimberMach | {testType || 'Strength'} Test {isMonitoring && '(Recording...)'}
        </span>
        <button
          type="button"
          onClick={handleMainPageReturn}
          className="bg-transparent border-none text-gray-200 text-2xl cursor-pointer p-1.5 ml-auto hover:text-red-500 transition-colors duration-300"
        >
          ⏻
        </button>
      </div>

      {/* Main Content */}
      <div className="mt-12 flex flex-col flex-grow w-full overflow-hidden">
        <div className="flex-1 flex flex-col items-center justify-center p-8">
          
          {/* Connection Status */}
          {!wsConnected && (
            <div className="mb-6 bg-red-900 bg-opacity-30 border-2 border-red-500 rounded-xl p-4 max-w-2xl">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-6 h-6 text-red-400 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="text-xl font-bold text-red-300 mb-2">⚠️ Disconnected</h3>
                  <p className="text-red-200 text-sm">Check Arduino (COM7) and server.js</p>
                </div>
              </div>
            </div>
          )}

          {/* Auto-Calibrating Banner */}
          {!autoZeroAttempted && wsConnected && (
            <div className="mb-6 bg-yellow-900 bg-opacity-30 border-2 border-yellow-500 rounded-xl p-4 max-w-2xl">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-6 h-6 text-yellow-400 animate-pulse" />
                <p className="text-yellow-200">Auto-calibrating... Please wait.</p>
              </div>
            </div>
          )}

          {/* Calibration Button */}
          {isCalibrated && wsConnected && !isMonitoring && (
            <div className="mb-6">
              <button
                onClick={handleCalibrate}
                className="bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-3 px-8 rounded-lg transition-all"
              >
                Re-Calibrate (Zero Now)
              </button>
            </div>
          )}

          {/* Main Pressure Display */}
          <div className="w-full max-w-4xl mb-8">
            {/* Current Pressure */}
            <div className="text-center mb-12">
              <p className="text-gray-400 text-2xl mb-4">Current Stress</p>
              <div className="text-white font-bold mb-4" style={{ fontSize: '12rem', lineHeight: '1' }}>
                {currentPressure.toFixed(2)}
              </div>
              <p className="text-gray-400 text-5xl">{getUnitLabel()}</p>
            </div>

            {/* Peak Pressure */}
            <div className="text-center">
              <p className="text-red-400 text-2xl mb-4">Peak Stress</p>
              <div className="text-red-400 font-bold mb-4" style={{ fontSize: '8rem', lineHeight: '1' }}>
                {peakPressure.toFixed(2)}
              </div>
              <p className="text-red-300 text-4xl">{getUnitLabel()}</p>
            </div>
          </div>

          {/* Control Buttons */}
          <div className="w-full max-w-2xl space-y-4">
            {!isMonitoring && !showSavePrompt && (
              <button
                type="button"
                onClick={startMonitoring}
                disabled={!wsConnected || !isCalibrated}
                className="w-full px-12 py-8 bg-green-600 text-white rounded-xl hover:bg-green-700 text-3xl font-bold
                         transition-all duration-300 hover:scale-105 disabled:bg-gray-600 disabled:opacity-50
                         disabled:cursor-not-allowed shadow-2xl"
              >
                {!wsConnected ? 'Waiting for Connection...' : !isCalibrated ? 'Calibrating...' : 'Start Test'}
              </button>
            )}

            {isMonitoring && (
              <button
                type="button"
                onClick={stopMonitoring}
                className="w-full px-12 py-8 bg-red-600 text-white rounded-xl hover:bg-red-700 text-3xl font-bold
                         transition-all duration-300 hover:scale-105 shadow-2xl"
              >
                Stop Test
              </button>
            )}

            {showSavePrompt && (
              <div className="bg-gray-800 rounded-2xl p-8 border-2 border-gray-700">
                <div className="text-center mb-6">
                  <div className="text-white text-3xl mb-3">✓ Test Complete</div>
                  <div className="text-green-400 text-6xl font-bold mb-2">
                    Peak: {peakPressure.toFixed(2)} {getUnitLabel()}
                  </div>
                  <p className="text-gray-300 text-xl">Save this test result?</p>
                </div>
                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={handleSaveTest}
                    className="flex-1 px-8 py-6 bg-green-600 text-white rounded-xl hover:bg-green-700 text-2xl font-semibold
                             transition-all duration-300 hover:scale-105 flex items-center justify-center gap-2"
                  >
                    <Save className="w-8 h-8" />
                    Save Test
                  </button>
                  <button
                    type="button"
                    onClick={handleDiscardTest}
                    className="flex-1 px-8 py-6 bg-gray-600 text-white rounded-xl hover:bg-gray-700 text-2xl font-semibold
                             transition-all duration-300 hover:scale-105"
                  >
                    Discard
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default KiloNewtonGauge;