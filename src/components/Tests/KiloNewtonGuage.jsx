import React, { useState, useEffect, useRef } from "react";
import { AlertTriangle, Save, TrendingUp, Clock, Activity } from 'lucide-react';

// Define the configuration for different test types
const gaugeConfigs = {
  compressive: {
    max: 100,
    warning: 110,
  },
  shear: {
    max: 100,
    warning: 110,
  },
  flexure: {
    max: 100,
    warning: 110,
  },
};

const defaultConfig = gaugeConfigs.compressive;

const KiloNewtonGauge = ({ 
  testType,
  onPreviousTest = () => {},
  onMainPageReturn = () => {},
  onTestComplete = () => {} 
}) => {
  // Pressure measurement state
  const [rawPressureValue, setRawPressureValue] = useState(0); // Raw sensor reading
  const [pressureValue, setPressureValue] = useState(0); // Calibrated pressure
  const [displayPressure, setDisplayPressure] = useState(0); // Throttled display value
  const [pressureHistory, setPressureHistory] = useState([]);
  const [allTimeMaxPressure, setAllTimeMaxPressure] = useState({ value: 0, time: 0 });
  const [sessionMaxPressure, setSessionMaxPressure] = useState(0); // NEW: Current session max
  const [testStartTime, setTestStartTime] = useState(null);
  const [testDuration, setTestDuration] = useState(0);
  const [showWarning, setShowWarning] = useState(false);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [showSavePrompt, setShowSavePrompt] = useState(false);
  
  // Baseline calibration
  const [baselinePressure, setBaselinePressure] = useState(0);
  const [isCalibrated, setIsCalibrated] = useState(false);
  const [autoZeroAttempted, setAutoZeroAttempted] = useState(false);
  
  // WebSocket connection state
  const [wsConnected, setWsConnected] = useState(false);
  
  // WebSocket and timer refs
  const pressureWSRef = useRef(null);
  const updateIntervalRef = useRef(null);
  const durationIntervalRef = useRef(null);
  
  const config = gaugeConfigs[testType?.toLowerCase()] || defaultConfig;

  // ============================================================================
  // WEBSOCKET CONNECTION - PRESSURE SENSOR
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
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
    };
  }, []);

  /**
   * Connect to Pressure Sensor WebSocket
   */
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
            let rawPressure = data.pressure;
            
            // Store raw pressure value
            setRawPressureValue(rawPressure);
            
            // Auto-zero on first connection after 1 second (let sensor stabilize)
            if (!autoZeroAttempted && !isCalibrated) {
              setTimeout(() => {
                if (!isCalibrated && !autoZeroAttempted) {
                  setBaselinePressure(rawPressure);
                  setIsCalibrated(true);
                  setAutoZeroAttempted(true);
                  console.log('✓ Auto-calibrated baseline at', rawPressure.toFixed(3), 'MPa');
                }
              }, 1000);
            }
            
            // Apply baseline calibration
            let calibratedPressure = rawPressure - baselinePressure;
            
            // Ensure non-negative
            if (calibratedPressure < 0) calibratedPressure = 0;
            
            // Store calibrated pressure value
            setPressureValue(calibratedPressure);
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
        
        // Attempt reconnect after 3 seconds
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
  // STABLE UPDATE RATE - 800ms INTERVAL
  // ============================================================================

  useEffect(() => {
    if (isMonitoring) {
      // Update display and record data every 800ms
      updateIntervalRef.current = setInterval(() => {
        const currentTime = (Date.now() - testStartTime) / 1000;
        
        // Update display value
        setDisplayPressure(pressureValue);
        
        // Update session max if current value is higher
        if (pressureValue > sessionMaxPressure) {
          setSessionMaxPressure(pressureValue);
        }
        
        // Record to history
        setPressureHistory(prev => [...prev, {
          time: currentTime,
          pressure: pressureValue
        }]);
        
        // Track all-time maximum (doesn't reset on drop)
        if (pressureValue > allTimeMaxPressure.value) {
          setAllTimeMaxPressure({ value: pressureValue, time: currentTime });
        }
        
        // Warning if exceeding threshold
        setShowWarning(pressureValue > config.warning);
        
      }, 800); // 800ms update rate
      
      // Update duration display every 100ms for smooth timer
      durationIntervalRef.current = setInterval(() => {
        const duration = (Date.now() - testStartTime) / 1000;
        setTestDuration(duration);
      }, 100);
      
    } else {
      // Clear intervals when not monitoring
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
        updateIntervalRef.current = null;
      }
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }
    }
    
    return () => {
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
      }
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
    };
  }, [isMonitoring, testStartTime, pressureValue, allTimeMaxPressure.value, sessionMaxPressure, config.warning]);

  // ============================================================================
  // CALIBRATION & TEST CONTROL FUNCTIONS
  // ============================================================================

  /**
   * Manual calibrate baseline (zero out current reading)
   */
  const handleCalibrate = () => {
    setBaselinePressure(rawPressureValue); // Use RAW value!
    setIsCalibrated(true);
    setAutoZeroAttempted(true);
    console.log('✓ Manual calibration - baseline set at', rawPressureValue.toFixed(3), 'MPa');
  };

  /**
   * Start monitoring
   */
  const startMonitoring = () => {
    console.log('🎬 Starting pressure monitoring...');
    
    setTestStartTime(Date.now());
    setTestDuration(0);
    setPressureHistory([]);
    setAllTimeMaxPressure({ value: 0, time: 0 });
    setSessionMaxPressure(0); // Reset session max
    setDisplayPressure(0);
    setIsMonitoring(true);
    setShowSavePrompt(false);
    
    console.log('✓ Monitoring started at', new Date().toISOString());
  };

  /**
   * Stop monitoring and show save prompt
   */
  const stopMonitoring = () => {
    setIsMonitoring(false);
    setShowSavePrompt(true);
    
    console.log('✓ Monitoring stopped. Peak pressure:', allTimeMaxPressure.value.toFixed(2), 'MPa');
    console.log('Total data points collected:', pressureHistory.length);
    console.log('Test duration:', testDuration.toFixed(1), 'seconds');
  };

  /**
   * Save the test data
   */
  const handleSaveTest = () => {
    if (allTimeMaxPressure.value > 0) {
      const strengthData = {
        maxForce: allTimeMaxPressure.value,  // This is in MPa, not kN!
        maxPressureMPa: allTimeMaxPressure.value,  // Add explicit MPa field
        timestamp: new Date(testStartTime + (allTimeMaxPressure.time * 1000)).toISOString(),
        duration: testDuration,
        pressureHistory: pressureHistory,
        dataPoints: pressureHistory.length,
        testType: testType,
        unit: 'MPa'
      };
      
      console.log('💾 Saving test data:', strengthData);
      
      if (typeof onTestComplete === 'function') {
        onTestComplete(strengthData);
      }
      
      setShowSavePrompt(false);
      
      // Reset for next test
      setPressureHistory([]);
      setAllTimeMaxPressure({ value: 0, time: 0 });
      setSessionMaxPressure(0);
      setTestStartTime(null);
      setTestDuration(0);
      setDisplayPressure(0);
    }
  };

  /**
   * Discard test and start new
   */
  const handleDiscardTest = () => {
    setShowSavePrompt(false);
    setPressureHistory([]);
    setAllTimeMaxPressure({ value: 0, time: 0 });
    setSessionMaxPressure(0);
    setTestStartTime(null);
    setTestDuration(0);
    setDisplayPressure(0);
    
    console.log('🗑️ Test data discarded');
  };

  // ============================================================================
  // NAVIGATION HANDLERS
  // ============================================================================

  const handlePreviousTest = () => {
    console.log("Previous Test button clicked");
    
    if (isMonitoring) {
      setIsMonitoring(false);
    }
    
    if (typeof onPreviousTest === 'function') {
      onPreviousTest();
    }
  };

  const handleMainPageReturn = () => {
    console.log("Main Page Return button clicked");
    
    if (isMonitoring) {
      setIsMonitoring(false);
    }
    
    if (typeof onMainPageReturn === 'function') {
      onMainPageReturn();
    }
  };

  /**
   * Format time as MM:SS
   */
  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
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
          className="bg-transparent border-none text-gray-200 text-2xl cursor-pointer p-1.5 
                   hover:text-blue-400 transition-colors duration-300"
        >
          ☰
        </button>
        <span className="ml-4 text-gray-100 text-lg font-semibold">
          TimberMach | {testType || 'Strength'} Test {isMonitoring && '(Recording...)'}
        </span>
        <button
          type="button"
          onClick={handleMainPageReturn}
          className="bg-transparent border-none text-gray-200 text-2xl cursor-pointer p-1.5 ml-auto
                   hover:text-red-500 transition-colors duration-300"
        >
          ⚊
        </button>
      </div>

      {/* Main Content */}
      <div className="mt-12 flex flex-col flex-grow w-full overflow-auto p-4">
        <div className="max-w-6xl mx-auto w-full space-y-6">
          
          {/* Connection Status Banner */}
          {!wsConnected && (
            <div className="bg-red-900 bg-opacity-30 border-2 border-red-500 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-6 h-6 text-red-400 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="text-xl font-bold text-red-300 mb-2">⚠️ WebSocket Disconnected</h3>
                  <p className="text-red-200 mb-2">
                    Cannot connect to pressure sensor. Please check:
                  </p>
                  <ul className="text-red-200 text-sm list-disc ml-5">
                    <li>Arduino is connected to COM7</li>
                    <li>server.js is running (node server.js)</li>
                    <li>Arduino code is uploaded</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Auto-Calibrating Banner */}
          {!autoZeroAttempted && wsConnected && (
            <div className="bg-yellow-900 bg-opacity-30 border-2 border-yellow-500 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-6 h-6 text-yellow-400 flex-shrink-0 mt-1 animate-pulse" />
                <div className="flex-grow">
                  <h3 className="text-xl font-bold text-yellow-300 mb-2">⚙️ Auto-Calibrating...</h3>
                  <p className="text-yellow-200">
                    Please wait while the sensor stabilizes and auto-calibrates to zero baseline.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Calibration Info - Show raw values and recalibrate button */}
          {isCalibrated && wsConnected && (
            <div className="bg-gray-800 rounded-xl p-4 flex justify-between items-center">
              <div>
                <p className="text-gray-400 text-sm">Raw Sensor: <span className="font-mono text-white">{rawPressureValue.toFixed(3)} MPa</span></p>
                <p className="text-gray-400 text-sm">Baseline: <span className="font-mono text-white">{baselinePressure.toFixed(3)} MPa</span></p>
                <p className="text-gray-400 text-sm">Calibrated: <span className="font-mono text-green-400">{pressureValue.toFixed(3)} MPa</span></p>
              </div>
              <button
                onClick={handleCalibrate}
                className="bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-3 px-6 rounded-lg transition-all"
              >
                Re-Calibrate (Zero Now)
              </button>
            </div>
          )}

          {/* NEW: Three-Column Display - Current | Highest | Result */}
          <div className="bg-gray-800 rounded-2xl p-8 shadow-2xl">
            <h2 className="text-3xl font-bold text-white mb-6 text-center">Live Pressure Readings</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              {/* Column 1: Current Sensor Value */}
              <div className="bg-gradient-to-br from-blue-900 to-blue-800 border-2 border-blue-600 rounded-xl p-6">
                <div className="flex items-center justify-center gap-2 mb-4">
                  <Activity className="w-6 h-6 text-blue-300" />
                  <h3 className="text-blue-200 font-bold text-lg text-center">Current Value</h3>
                </div>
                <div className="text-center">
                  <div className="text-blue-100 text-6xl font-bold mb-2">
                    {isMonitoring ? displayPressure.toFixed(2) : pressureValue.toFixed(2)}
                  </div>
                  <div className="text-blue-300 text-2xl">MPa</div>
                  <div className="text-blue-400 text-sm mt-2">
                    {isMonitoring ? '🔴 Live Reading' : '⚪ Standby'}
                  </div>
                </div>
              </div>

              {/* Column 2: Highest Value (Session Peak) */}
              <div className="bg-gradient-to-br from-orange-900 to-orange-800 border-2 border-orange-600 rounded-xl p-6">
                <div className="flex items-center justify-center gap-2 mb-4">
                  <TrendingUp className="w-6 h-6 text-orange-300" />
                  <h3 className="text-orange-200 font-bold text-lg text-center">Highest Value</h3>
                </div>
                <div className="text-center">
                  <div className={`text-orange-100 text-6xl font-bold mb-2 transition-all duration-300 ${
                    sessionMaxPressure > (allTimeMaxPressure.value || 0) - 0.01 ? 'scale-110' : ''
                  }`}>
                    {sessionMaxPressure.toFixed(2)}
                  </div>
                  <div className="text-orange-300 text-2xl">MPa</div>
                  <div className="text-orange-400 text-sm mt-2">
                    {isMonitoring ? '📈 Tracking Peak' : '✓ Session High'}
                  </div>
                </div>
              </div>

              {/* Column 3: Result (All-Time Peak) */}
              <div className="bg-gradient-to-br from-green-900 to-green-800 border-2 border-green-600 rounded-xl p-6">
                <div className="flex items-center justify-center gap-2 mb-4">
                  <Save className="w-6 h-6 text-green-300" />
                  <h3 className="text-green-200 font-bold text-lg text-center">Result</h3>
                </div>
                <div className="text-center">
                  <div className="text-green-100 text-6xl font-bold mb-2">
                    {allTimeMaxPressure.value.toFixed(2)}
                  </div>
                  <div className="text-green-300 text-2xl">MPa</div>
                  <div className="text-green-400 text-sm mt-2">
                    {allTimeMaxPressure.value > 0 ? `at ${allTimeMaxPressure.time.toFixed(1)}s` : 'No data yet'}
                  </div>
                </div>
              </div>
            </div>

            {/* Status Bar */}
            <div className="bg-gray-900 rounded-xl p-4 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className={`w-4 h-4 rounded-full ${wsConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
                <span className={`text-sm font-semibold ${wsConnected ? 'text-green-400' : 'text-red-400'}`}>
                  {wsConnected ? 'Sensor Connected' : 'Disconnected'}
                </span>
              </div>
              <div className="text-gray-400 text-sm">
                Update Rate: 800ms | Data Points: {pressureHistory.length}
              </div>
              <div className="text-gray-300 font-mono text-lg">
                <Clock className="w-5 h-5 inline mr-2" />
                {isMonitoring ? formatDuration(testDuration) : '00:00'}
              </div>
            </div>
          </div>

          {/* Main Pressure Display - Keep original as backup/detailed view */}
          <div className="bg-gray-800 rounded-2xl p-8 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-3xl font-bold text-white">Detailed Monitoring</h2>
              <div className="flex items-center gap-3">
                <div className={`w-4 h-4 rounded-full ${wsConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
                <span className={`text-sm font-semibold ${wsConnected ? 'text-green-400' : 'text-red-400'}`}>
                  {wsConnected ? 'Connected' : 'Disconnected'}
                </span>
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              {/* Peak Pressure */}
              <div className="bg-gradient-to-br from-red-900 to-red-800 bg-opacity-30 border-2 border-red-700 rounded-xl p-6">
                <div className="flex items-center gap-3 mb-3">
                  <TrendingUp className="w-8 h-8 text-red-400" />
                  <h3 className="text-red-200 font-bold text-lg">Peak Pressure</h3>
                </div>
                <p className="text-red-100 text-4xl font-bold">
                  {allTimeMaxPressure.value.toFixed(2)}
                  <span className="text-2xl ml-2">MPa</span>
                </p>
                {allTimeMaxPressure.value > 0 && (
                  <p className="text-red-300 text-sm mt-2">
                    at {allTimeMaxPressure.time.toFixed(1)}s
                  </p>
                )}
              </div>

              {/* Test Duration */}
              <div className="bg-gradient-to-br from-blue-900 to-blue-800 bg-opacity-30 border-2 border-blue-700 rounded-xl p-6">
                <div className="flex items-center gap-3 mb-3">
                  <Clock className="w-8 h-8 text-blue-400" />
                  <h3 className="text-blue-200 font-bold text-lg">Duration</h3>
                </div>
                <p className="text-blue-100 text-4xl font-bold">
                  {isMonitoring ? formatDuration(testDuration) : '00:00'}
                </p>
                <p className="text-blue-300 text-sm mt-2">
                  {isMonitoring ? 'Recording...' : 'Stopped'}
                </p>
              </div>

              {/* Data Points */}
              <div className="bg-gradient-to-br from-green-900 to-green-800 bg-opacity-30 border-2 border-green-700 rounded-xl p-6">
                <div className="flex items-center gap-3 mb-3">
                  <Save className="w-8 h-8 text-green-400" />
                  <h3 className="text-green-200 font-bold text-lg">Data Points</h3>
                </div>
                <p className="text-green-100 text-4xl font-bold">
                  {pressureHistory.length}
                </p>
                <p className="text-green-300 text-sm mt-2">
                  {pressureHistory.length > 0 ? `~${(pressureHistory.length * 0.8).toFixed(1)}s recorded` : 'No data'}
                </p>
              </div>
            </div>

            {/* Control Buttons */}
            <div className="space-y-4">
              {!isMonitoring && !showSavePrompt && (
                <button
                  type="button"
                  onClick={startMonitoring}
                  disabled={!wsConnected || !isCalibrated}
                  className="w-full px-12 py-6 bg-green-600 text-white rounded-xl hover:bg-green-700 text-2xl font-bold
                           transition-all duration-300 hover:scale-105 disabled:bg-gray-600 disabled:opacity-50
                           disabled:cursor-not-allowed shadow-2xl"
                >
                  {!wsConnected ? 'Waiting for Connection...' : !isCalibrated ? 'Calibrating...' : 'Start Monitoring'}
                </button>
              )}

              {isMonitoring && (
                <button
                  type="button"
                  onClick={stopMonitoring}
                  className="w-full px-8 py-6 bg-red-600 text-white rounded-xl hover:bg-red-700 text-2xl font-bold
                           transition-all duration-300 hover:scale-105 shadow-2xl"
                >
                  Stop Monitoring
                </button>
              )}

              {showSavePrompt && (
                <div className="bg-gray-900 rounded-2xl p-8 border-2 border-gray-700">
                  <div className="text-center mb-6">
                    <div className="text-white text-2xl mb-3">✓ Monitoring Stopped</div>
                    <div className="text-green-400 text-5xl font-bold mb-2">
                      Peak: {allTimeMaxPressure.value.toFixed(2)} MPa
                    </div>
                    <p className="text-gray-300 text-lg">Would you like to save this test result?</p>
                  </div>
                  <div className="flex gap-4">
                    <button
                      type="button"
                      onClick={handleSaveTest}
                      className="flex-1 px-6 py-4 bg-green-600 text-white rounded-xl hover:bg-green-700 text-xl font-semibold
                               transition-all duration-300 hover:scale-105 flex items-center justify-center gap-2"
                    >
                      <Save className="w-6 h-6" />
                      Save Test
                    </button>
                    <button
                      type="button"
                      onClick={handleDiscardTest}
                      className="flex-1 px-6 py-4 bg-gray-600 text-white rounded-xl hover:bg-gray-700 text-xl font-semibold
                               transition-all duration-300 hover:scale-105"
                    >
                      Discard
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Instructions */}
            <div className="mt-8 bg-blue-900 bg-opacity-30 border border-blue-700 rounded-xl p-6">
              <h3 className="text-blue-300 font-bold text-lg mb-3">📋 Testing Instructions:</h3>
              <ol className="text-blue-200 space-y-2 ml-5 list-decimal">
                <li>Wait for auto-calibration (sensor zeros automatically on startup)</li>
                <li>Verify calibrated pressure shows 0.00 MPa (or close to it)</li>
                <li>Click "Re-Calibrate" if you need to zero the sensor again</li>
                <li>Click "Start Monitoring" to begin recording (800ms update rate)</li>
                <li>Watch the three main displays: Current (live reading) → Highest (session peak) → Result (final peak)</li>
                <li>Manually press and release the lever</li>
                <li>The "Highest Value" will hold the peak and only increase if a new high is reached</li>
                <li>Click "Stop Monitoring" when satisfied with peak reading</li>
                <li>Choose to save or discard the test result</li>
              </ol>
            </div>
          </div>

        </div>
      </div>

      {/* Warning Popup */}
      {showWarning && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-70 z-50">
          <div className="bg-white rounded-2xl p-8 shadow-2xl max-w-md">
            <div className="flex items-start gap-4 mb-6">
              <AlertTriangle className="w-10 h-10 text-red-600 flex-shrink-0" />
              <div>
                <h2 className="text-2xl font-bold text-red-600 mb-3">Warning!</h2>
                <p className="text-gray-700 text-lg">
                  The sensor has exceeded the safe limit of {config.warning} MPa!
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowWarning(false)}
              className="w-full bg-blue-500 text-white px-6 py-3 rounded-xl hover:bg-blue-600 
                       transition-all duration-300 font-semibold text-lg"
            >
              Acknowledge
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default KiloNewtonGauge;