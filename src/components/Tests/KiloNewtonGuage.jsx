import React, { useState, useEffect, useRef } from "react";
import * as d3 from "d3";
import { ArrowLeft, ArrowRight, Navigation, Square, AlertTriangle, Activity } from 'lucide-react';
// ✅ Added Activity to the imports ^

// Define the configuration for different test types
const gaugeConfigs = {
  compressive: {
    max: 1600,
    warning: 1620,
  },
  shear: {
    max: 1600,
    warning: 1620,
  },
  flexure: {
    max: 1600,
    warning: 1620,
  },
};

// Default configuration for the gauge
const defaultConfig = gaugeConfigs.compressive;

// Actuator positions
const ACTUATOR_POSITIONS = {
  LEFT: 'LEFT',
  MID: 'MID',
  RIGHT: 'RIGHT'
};

const KiloNewtonGauge = ({ 
  testType,
  onPreviousTest = () => {},
  onMainPageReturn = () => {},
  onTestComplete = () => {} 
}) => {
  // Pressure measurement state
  const [kNValue, setKNValue] = useState(0);
  const [pressureData, setPressureData] = useState([]);
  const [maxPressure, setMaxPressure] = useState({ value: 0, time: 0 });
  const [testStartTime, setTestStartTime] = useState(null);
  const [showWarning, setShowWarning] = useState(false);
  const [isTestRunning, setIsTestRunning] = useState(false);
  const [testCompleted, setTestCompleted] = useState(false);
  const [svgCreated, setSvgCreated] = useState(false);
  const [manualDirection, setManualDirection] = useState(null);
  const holdIntervalRef = useRef(null);

  // Actuator control state
  const [wsConnected, setWsConnected] = useState(false);
  const [currentPosition, setCurrentPosition] = useState(ACTUATOR_POSITIONS.MID);
  const [isMoving, setIsMoving] = useState(false);
  const [isCalibrated, setIsCalibrated] = useState(false);
  const [showCalibrationPrompt, setShowCalibrationPrompt] = useState(true);
  const [targetPosition, setTargetPosition] = useState(null);

  // WebSocket refs
  const wsRef = useRef(null);
  const pressureWSRef = useRef(null);
  
  // Graph and simulation refs
  const config = gaugeConfigs[testType?.toLowerCase()] || defaultConfig;
  const graphRef = useRef(null);
  const containerRef = useRef(null);
  const svgRef = useRef(null);
  const resizeObserverRef = useRef(null);
  const pressureIntervalRef = useRef(null);

  // ============================================================================
  // WEBSOCKET CONNECTIONS
  // ============================================================================

  useEffect(() => {
    connectActuatorWebSocket();
    connectPressureWebSocket();
  
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (pressureWSRef.current) {
        pressureWSRef.current.close();
      }
      if (pressureIntervalRef.current) {
        clearInterval(pressureIntervalRef.current);
      }
      // ✅ Add this cleanup
      if (holdIntervalRef.current) {
        clearInterval(holdIntervalRef.current);
      }
    };
  }, []);

  /**
   * Connect to Actuator Control WebSocket
   */
  const connectActuatorWebSocket = () => {
    try {
      const ws = new WebSocket('ws://localhost:8080');
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('Actuator WebSocket connected');
        setWsConnected(true);
        
        // Request calibration status
        setTimeout(() => ws.send('POS'), 500);
      };

      ws.onmessage = (event) => {
        const data = event.data;
        console.log('Actuator:', data);

        // Parse position updates
        if (data.includes('POS:')) {
          const posMatch = data.match(/POS:([-\d.]+)mm/);
          if (posMatch) {
            const positionMM = parseFloat(posMatch[1]);
            updateCurrentPositionFromMM(positionMM);
          }
        }

        // Check calibration status
        if (data.includes('CAL:YES')) {
          setIsCalibrated(true);
          setShowCalibrationPrompt(false);
        } else if (data.includes('CAL:NO')) {
          setIsCalibrated(false);
        }

        // Detect calibration completion
        if (data.includes('>>> CALIBRATION <<<') || data.includes('Current position set to 0mm')) {
          setIsCalibrated(true);
          setShowCalibrationPrompt(false);
        }

        // Detect movement status
        if (data.includes('MOVING') || data.includes('Direction:')) {
          setIsMoving(true);
        } else if (data.includes('STOP') || data.includes('TARGET REACHED')) {
          setIsMoving(false);
          setTargetPosition(null);
        }

        // Detect position reached
        if (data.includes('>>> TARGET REACHED <<<')) {
          setIsMoving(false);
          setTargetPosition(null);
        }
      };

      ws.onerror = (error) => {
        console.error('Actuator WebSocket error:', error);
        setWsConnected(false);
      };

      ws.onclose = () => {
        console.log('Actuator WebSocket closed');
        setWsConnected(false);
      };
    } catch (error) {
      console.error('Failed to create Actuator WebSocket:', error);
      setWsConnected(false);
    }
  };

  /**
   * Connect to Pressure Sensor WebSocket
   */
  const connectPressureWebSocket = () => {
    try {
      // Changed from ws://localhost:5000 to ws://localhost:5001
      const ws = new WebSocket('ws://localhost:5001');
      pressureWSRef.current = ws;

      ws.onopen = () => {
        console.log('Pressure sensor WebSocket connected');
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.pressure !== undefined) {
            const pressureKN = data.pressure;
            setKNValue(pressureKN);

            if (isTestRunning && testStartTime) {
              const currentTime = (Date.now() - testStartTime) / 1000;
              
              setPressureData(prevData => {
                const newData = [...prevData, { time: currentTime, pressure: pressureKN }];
                return newData;
              });

              if (pressureKN > maxPressure.value) {
                setMaxPressure({ value: pressureKN, time: currentTime });
              }

              setShowWarning(pressureKN > config.warning);
            }
          }
        } catch (e) {
          console.error('Error parsing pressure data:', e);
        }
      };

      ws.onerror = (error) => {
        console.error('Pressure WebSocket error:', error);
      };

      ws.onclose = () => {
        console.log('Pressure WebSocket closed');
      };
    } catch (error) {
      console.error('Failed to create Pressure WebSocket:', error);
    }
  };

  /**
   * Update current position based on mm value from Arduino
   */
  const updateCurrentPositionFromMM = (positionMM) => {
    // Tolerance for position detection
    const tolerance = 2.0;

    if (Math.abs(positionMM - 0) <= tolerance) {
      setCurrentPosition(ACTUATOR_POSITIONS.MID);
    } else if (Math.abs(positionMM - (-27)) <= tolerance) {
      setCurrentPosition(ACTUATOR_POSITIONS.LEFT);
    } else if (Math.abs(positionMM - 27) <= tolerance) {
      setCurrentPosition(ACTUATOR_POSITIONS.RIGHT);
    }
  };

  // ============================================================================
  // ACTUATOR CONTROL FUNCTIONS
  // ============================================================================

  /**
   * Send command to Arduino
   */
  const sendCommand = (cmd) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      console.log('Sending command:', cmd);
      wsRef.current.send(cmd);
    } else {
      console.error('WebSocket not connected');
    }
  };

  /**
   * Handle calibration
   */
  const handleCalibrate = () => {
    if (!wsConnected) {
      alert('WebSocket not connected to Arduino');
      return;
    }

    sendCommand('CAL');
    setShowCalibrationPrompt(false);
  };

  /**
   * Move to specific position with safety checks
   */
  const moveToPosition = (position) => {
    if (!wsConnected) {
      alert('WebSocket not connected to Arduino');
      return;
    }

    if (!isCalibrated) {
      alert('Please calibrate the actuator first!');
      setShowCalibrationPrompt(true);
      return;
    }

    // Safety check: Prevent direct LEFT <-> RIGHT movement
    if (currentPosition === ACTUATOR_POSITIONS.LEFT && position === ACTUATOR_POSITIONS.RIGHT) {
      alert('⚠️ SAFETY: Cannot move directly from LEFT to RIGHT. Move to MID first!');
      return;
    }

    if (currentPosition === ACTUATOR_POSITIONS.RIGHT && position === ACTUATOR_POSITIONS.LEFT) {
      alert('⚠️ SAFETY: Cannot move directly from RIGHT to LEFT. Move to MID first!');
      return;
    }

    // ✅ REMOVED: Check if already at target position
    // Allow MID to be pressed even if already at MID (for confirmation/recalibration)
    // if (currentPosition === position) {
    //   console.log('Already at', position);
    //   return;
    // }

    // Send position command
    setTargetPosition(position);
    setIsMoving(true);
    sendCommand(position);
    
    console.log(`Moving to ${position} (from ${currentPosition})`);
  };

  /**
   * Emergency stop
   */
  const handleEmergencyStop = () => {
    sendCommand('S');
    setIsMoving(false);
    setTargetPosition(null);
  };

  /**
   * Manual hold control - press and hold to move
   */
  const handleManualMouseDown = (direction) => {
    if (!wsConnected) {
      alert('WebSocket not connected to Arduino');
      return;
    }

    if (!isCalibrated) {
      alert('Please calibrate the actuator first!');
      setShowCalibrationPrompt(true);
      return;
    }

    setManualDirection(direction);
    
    // Send speed command (e.g., L80 or R80 for 80% speed)
    const speed = 80;
    const command = direction === 'LEFT' ? `L${speed}` : `R${speed}`;
    sendCommand(command);
    
    console.log(`Manual hold started: ${direction} at ${speed}% speed`);

    // Keep sending command while holding (every 200ms)
    holdIntervalRef.current = setInterval(() => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(command);
      }
    }, 200);
  };

  /**
   * Stop manual hold movement
   */
  const handleManualMouseUp = () => {
    if (holdIntervalRef.current) {
      clearInterval(holdIntervalRef.current);
      holdIntervalRef.current = null;
    }

    if (manualDirection) {
      sendCommand('S'); // Stop command
      console.log('Manual hold stopped');
      setManualDirection(null);
    }
  };

  /**
   * Handle recenter command (go to MID)
   */
  const handleRecenter = () => {
    if (!wsConnected) {
      alert('WebSocket not connected to Arduino');
      return;
    }

    if (!isCalibrated) {
      alert('Please calibrate the actuator first!');
      setShowCalibrationPrompt(true);
      return;
    }

    sendCommand('MID');
    console.log('Recentering to MID position');
  };


  // ============================================================================
  // TEST CONTROL FUNCTIONS
  // ============================================================================

  /**
   * Start the test
   */
  const startTest = () => {
    setTestStartTime(Date.now());
    setPressureData([]);
    setMaxPressure({ value: 0, time: 0 });
    setTestCompleted(false);
    setIsTestRunning(true);
    setKNValue(0);
    
    console.log('Test started at', new Date().toISOString());
  };

  /**
   * Stop the test
   */
  const stopTest = () => {
    setIsTestRunning(false);
    setTestCompleted(true);
    
    console.log('Test stopped. Max pressure:', maxPressure.value.toFixed(2), 'kN');
  };

  /**
   * Call onTestComplete when test finishes
   */
  useEffect(() => {
    if (testCompleted && maxPressure.value > 0) {
      const strengthData = {
        maxForce: maxPressure.value,
        timestamp: new Date(testStartTime + (maxPressure.time * 1000)).toISOString(),
        duration: maxPressure.time,
        pressureHistory: pressureData,
        testType: testType
      };
      
      console.log('Sending test data to parent:', strengthData);
      
      if (typeof onTestComplete === 'function') {
        onTestComplete(strengthData);
      }
    }
  }, [testCompleted, maxPressure, testStartTime, pressureData, testType, onTestComplete]);

  // ============================================================================
  // NAVIGATION HANDLERS
  // ============================================================================

  const handlePreviousTest = () => {
    console.log("Previous Test button clicked");
    
    // Stop test if running
    if (isTestRunning) {
      setIsTestRunning(false);
    }
    
    // Disconnect resize observer
    if (resizeObserverRef.current && graphRef.current) {
      try {
        resizeObserverRef.current.unobserve(graphRef.current);
        resizeObserverRef.current = null;
      } catch (err) {
        console.error("Error cleaning up resize observer:", err);
      }
    }
    
    if (typeof onPreviousTest === 'function') {
      onPreviousTest();
    }
  };

  const handleMainPageReturn = () => {
    console.log("Main Page Return button clicked");
    
    // Stop test if running
    if (isTestRunning) {
      setIsTestRunning(false);
    }
    
    // Disconnect resize observer
    if (resizeObserverRef.current && graphRef.current) {
      try {
        resizeObserverRef.current.unobserve(graphRef.current);
        resizeObserverRef.current = null;
      } catch (err) {
        console.error("Error cleaning up resize observer:", err);
      }
    }
    
    if (typeof onMainPageReturn === 'function') {
      onMainPageReturn();
    }
  };

  // ============================================================================
  // D3 GRAPH INITIALIZATION AND UPDATES
  // ============================================================================

  useEffect(() => {
    if (!graphRef.current) return;

    try {
      d3.select(graphRef.current).selectAll("svg").remove();

      const svg = d3.select(graphRef.current)
        .append("svg")
        .attr("width", "100%")
        .attr("height", "100%")
        .style("background-color", "#1a202c");

      svgRef.current = svg;
      setSvgCreated(true);
    } catch (err) {
      console.error("Error initializing D3 graph:", err);
    }
  }, []);

  useEffect(() => {
    if (!svgCreated || !svgRef.current || !graphRef.current) return;
    
    const updateGraph = () => {
      try {
        const svg = svgRef.current;
        const svgNode = svg.node();
        if (!svgNode) return;
        
        const width = graphRef.current.clientWidth;
        const height = graphRef.current.clientHeight;
        const margin = { top: 20, right: 30, bottom: 40, left: 50 };
        
        const innerWidth = width - margin.left - margin.right;
        const innerHeight = height - margin.top - margin.bottom;
        
        svg.selectAll("g").remove();
        
        const g = svg.append("g")
          .attr("transform", `translate(${margin.left},${margin.top})`);
        
        const xScale = d3.scaleLinear()
          .domain([0, 30])
          .range([0, innerWidth]);
        
        const yScale = d3.scaleLinear()
          .domain([0, 1600])
          .range([innerHeight, 0]);
        
        const xAxis = d3.axisBottom(xScale).ticks(15);
        const yAxis = d3.axisLeft(yScale).ticks(8);
        
        g.append("g")
          .attr("class", "x-axis")
          .attr("transform", `translate(0,${innerHeight})`)
          .style("color", "white")
          .call(xAxis);
        
        g.append("g")
          .attr("class", "y-axis")
          .style("color", "white")
          .call(yAxis);
        
        g.append("text")
          .attr("text-anchor", "middle")
          .attr("x", innerWidth / 2)
          .attr("y", innerHeight + margin.bottom - 5)
          .style("fill", "white")
          .style("font-size", "12px")
          .text("Time (seconds)");
        
        g.append("text")
          .attr("text-anchor", "middle")
          .attr("transform", "rotate(-90)")
          .attr("x", -innerHeight / 2)
          .attr("y", -margin.left + 15)
          .style("fill", "white")
          .style("font-size", "12px")
          .text("Pressure (kN)");
        
        // Grid lines
        g.selectAll("line.horizontalGrid")
          .data(yScale.ticks(8))
          .enter()
          .append("line")
          .attr("x1", 0)
          .attr("x2", innerWidth)
          .attr("y1", d => yScale(d))
          .attr("y2", d => yScale(d))
          .style("stroke", "rgba(255, 255, 255, 0.1)")
          .style("stroke-width", 0.5);
        
        g.selectAll("line.verticalGrid")
          .data(xScale.ticks(15))
          .enter()
          .append("line")
          .attr("x1", d => xScale(d))
          .attr("x2", d => xScale(d))
          .attr("y1", 0)
          .attr("y2", innerHeight)
          .style("stroke", "rgba(255, 255, 255, 0.1)")
          .style("stroke-width", 0.5);
        
        if (pressureData.length > 0) {
          const line = d3.line()
            .x(d => xScale(Math.min(30, d.time)))
            .y(d => yScale(d.pressure))
            .curve(d3.curveLinear);
          
          g.append("path")
            .datum(pressureData)
            .attr("fill", "none")
            .attr("stroke", "white")
            .attr("stroke-width", 1.5)
            .attr("d", line);
          
          if (maxPressure.value > 0) {
            g.append("circle")
              .attr("cx", xScale(Math.min(30, maxPressure.time)))
              .attr("cy", yScale(maxPressure.value))
              .attr("r", 4)
              .attr("fill", "red");
            
            g.append("text")
              .attr("x", xScale(Math.min(30, maxPressure.time)))
              .attr("y", yScale(maxPressure.value) - 10)
              .attr("text-anchor", "middle")
              .style("fill", "red")
              .style("font-size", "12px")
              .style("font-weight", "bold")
              .text(`Max: ${maxPressure.value.toFixed(2)} kN`);
          }
        }
      } catch (err) {
        console.error("Error updating graph:", err);
      }
    };
    
    updateGraph();
    
    try {
      resizeObserverRef.current = new ResizeObserver(updateGraph);
      
      if (graphRef.current) {
        resizeObserverRef.current.observe(graphRef.current);
      }
    } catch (err) {
      console.error("Error setting up resize observer:", err);
    }
    
    return () => {
      try {
        if (graphRef.current && resizeObserverRef.current) {
          resizeObserverRef.current.unobserve(graphRef.current);
        }
      } catch (err) {
        console.error("Error cleaning up resize observer:", err);
      }
    };
  }, [pressureData, svgCreated, maxPressure]);

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="fixed inset-0 flex flex-col h-screen w-screen bg-gray-900" ref={containerRef}>
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
          TimberMach | {testType || 'Strength'} Test {isTestRunning && '(Running...)'}
        </span>
        <button
          type="button"
          onClick={handleMainPageReturn}
          className="bg-transparent border-none text-gray-200 text-2xl cursor-pointer p-1.5 ml-auto
                   hover:text-red-500 transition-colors duration-300"
        >
          ⏻
        </button>
      </div>

      {/* Main Content */}
      <div className="mt-12 flex flex-col flex-grow w-full overflow-auto p-4">
        <div className="max-w-6xl mx-auto w-full space-y-4">
          
          {/* Calibration Warning */}
          {showCalibrationPrompt && !isCalibrated && (
            <div className="bg-yellow-900 bg-opacity-30 border-2 border-yellow-500 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-6 h-6 text-yellow-400 flex-shrink-0 mt-1" />
                <div className="flex-grow">
                  <h3 className="text-xl font-bold text-yellow-300 mb-2">⚠️ Calibration Required</h3>
                  <p className="text-yellow-200 mb-3">
                    Position the actuator at the CENTER (0mm) reference point, then click Calibrate.
                  </p>
                  <button
                    onClick={handleCalibrate}
                    disabled={!wsConnected}
                    className="bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-600 text-white font-bold py-2 px-6 rounded-lg transition-all disabled:opacity-50"
                  >
                    {wsConnected ? 'Calibrate Now' : 'WebSocket Disconnected'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Pressure Graph Section */}
          <div className="bg-gray-800 rounded-2xl p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-white">Pressure Monitoring</h2>
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${wsConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
                <span className="text-gray-300 text-sm">{wsConnected ? 'Connected' : 'Disconnected'}</span>
              </div>
            </div>
            
            {/* Current Pressure Display */}
            <div className="text-center mb-4">
              <div className="text-white text-5xl md:text-6xl font-bold">
                {kNValue.toFixed(2)}
                <span className="ml-2 text-3xl">kN</span>
              </div>
              {maxPressure.value > 0 && (
                <div className="text-gray-400 text-sm mt-2">
                  Peak: {maxPressure.value.toFixed(2)} kN at {maxPressure.time.toFixed(1)}s
                </div>
              )}
            </div>
            
            {/* Graph Container */}
            <div className="relative bg-gray-900 rounded-lg overflow-hidden" style={{ height: '400px' }}>
              <div ref={graphRef} className="w-full h-full"></div>
              
              {/* Test Controls Overlay */}
              {!isTestRunning && (
                <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
                  {testCompleted ? (
                    <div className="text-center">
                      <div className="text-white text-xl mb-2">Test Completed</div>
                      <div className="text-green-400 text-2xl font-bold mb-4">
                        Max: {maxPressure.value.toFixed(2)} kN
                      </div>
                      <button
                        type="button"
                        onClick={startTest}
                        className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-lg font-semibold"
                      >
                        Start New Test
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={startTest}
                      className="px-8 py-4 bg-green-600 text-white rounded-lg hover:bg-green-700 text-xl font-semibold"
                    >
                      Start Test
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Stop Test Button */}
            {isTestRunning && (
              <div className="mt-4 text-center">
                <button
                  type="button"
                  onClick={stopTest}
                  className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 text-lg font-semibold"
                >
                  Stop Test
                </button>
              </div>
            )}
          </div>

          {/* Actuator Manual Control Section */}
          <div className="bg-gray-800 rounded-2xl p-6">
            <h2 className="text-2xl font-bold text-white mb-4">Actuator Position Control</h2>
            
            {/* Current Position Display */}
            <div className="bg-gray-900 rounded-lg p-4 mb-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-300">Current Position:</span>
                <span className={`text-2xl font-bold ${
                  currentPosition === ACTUATOR_POSITIONS.MID ? 'text-purple-400' :
                  currentPosition === ACTUATOR_POSITIONS.LEFT ? 'text-green-400' :
                  'text-blue-400'
                }`}>
                  {currentPosition}
                </span>
              </div>
              {isMoving && targetPosition && (
                <div className="mt-2 text-yellow-400 text-sm flex items-center gap-2">
                  <Activity className="w-4 h-4 animate-pulse" />
                  Moving to {targetPosition}...
                </div>
              )}
              {manualDirection && (
                <div className="mt-2 text-orange-400 text-sm flex items-center gap-2">
                  <Activity className="w-4 h-4 animate-pulse" />
                  Manual control: Moving {manualDirection}
                </div>
              )}
            </div>

            {/* Calibration Button */}
            <div className="mb-4">
              <button
                onClick={handleCalibrate}
                disabled={!wsConnected}
                className="w-full py-3 bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 
                          disabled:from-gray-600 disabled:to-gray-500 text-white font-bold rounded-lg transition-all 
                          disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                        d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                </svg>
                {isCalibrated ? 'Recalibrate (Set 0mm Reference)' : 'Calibrate (Set 0mm Reference)'}
              </button>
            </div>

            {/* Position Control Buttons */}
            <div className="mb-4">
              <p className="text-gray-400 text-sm mb-2 font-semibold">Quick Position Commands:</p>
              <div className="grid grid-cols-3 gap-4">
                <button
                  onClick={() => moveToPosition(ACTUATOR_POSITIONS.LEFT)}
                  disabled={!wsConnected || !isCalibrated || isMoving}
                  className={`py-4 px-6 rounded-xl font-bold text-white transition-all duration-300 flex flex-col items-center gap-2
                    ${currentPosition === ACTUATOR_POSITIONS.LEFT 
                      ? 'bg-green-700 border-2 border-green-400' 
                      : 'bg-green-600 hover:bg-green-700'
                    }
                    disabled:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <ArrowLeft className="w-6 h-6" />
                  <span>LEFT</span>
                  {currentPosition === ACTUATOR_POSITIONS.LEFT && (
                    <span className="text-xs">(Current)</span>
                  )}
                </button>

                <button
                  onClick={() => moveToPosition(ACTUATOR_POSITIONS.MID)}
                  disabled={!wsConnected || !isCalibrated || isMoving}
                  className={`py-4 px-6 rounded-xl font-bold text-white transition-all duration-300 flex flex-col items-center gap-2
                    ${currentPosition === ACTUATOR_POSITIONS.MID 
                      ? 'bg-purple-700 border-2 border-purple-400' 
                      : 'bg-purple-600 hover:bg-purple-700'
                    }
                    disabled:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <Navigation className="w-6 h-6" />
                  <span>MID</span>
                  {currentPosition === ACTUATOR_POSITIONS.MID && (
                    <span className="text-xs">(Current)</span>
                  )}
                </button>

                <button
                  onClick={() => moveToPosition(ACTUATOR_POSITIONS.RIGHT)}
                  disabled={!wsConnected || !isCalibrated || isMoving}
                  className={`py-4 px-6 rounded-xl font-bold text-white transition-all duration-300 flex flex-col items-center gap-2
                    ${currentPosition === ACTUATOR_POSITIONS.RIGHT 
                      ? 'bg-blue-700 border-2 border-blue-400' 
                      : 'bg-blue-600 hover:bg-blue-700'
                    }
                    disabled:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <ArrowRight className="w-6 h-6" />
                  <span>RIGHT</span>
                  {currentPosition === ACTUATOR_POSITIONS.RIGHT && (
                    <span className="text-xs">(Current)</span>
                  )}
                </button>
              </div>
            </div>

            {/* Manual Hold Controls */}
            <div className="mb-4">
              <p className="text-gray-400 text-sm mb-2 font-semibold">Manual Control (Press & Hold):</p>
              <div className="grid grid-cols-3 gap-4">
                {/* Hold Left */}
                <button
                  onMouseDown={() => handleManualMouseDown('LEFT')}
                  onMouseUp={handleManualMouseUp}
                  onMouseLeave={handleManualMouseUp}
                  onTouchStart={() => handleManualMouseDown('LEFT')}
                  onTouchEnd={handleManualMouseUp}
                  disabled={!wsConnected || !isCalibrated}
                  className={`py-4 px-6 rounded-xl font-bold text-white transition-all duration-300 flex flex-col items-center gap-2
                    ${manualDirection === 'LEFT' ? 'bg-green-800 scale-95' : 'bg-green-600 hover:bg-green-700'}
                    disabled:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95`}
                >
                  <ArrowLeft className="w-6 h-6" />
                  <span className="text-sm">Hold LEFT</span>
                </button>

                {/* Recenter */}
                <button
                  onClick={handleRecenter}
                  disabled={!wsConnected || !isCalibrated || isMoving}
                  className="py-4 px-6 rounded-xl font-bold text-white transition-all duration-300 flex flex-col items-center gap-2
                            bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Navigation className="w-6 h-6" />
                  <span className="text-sm">Recenter</span>
                </button>

                {/* Hold Right */}
                <button
                  onMouseDown={() => handleManualMouseDown('RIGHT')}
                  onMouseUp={handleManualMouseUp}
                  onMouseLeave={handleManualMouseUp}
                  onTouchStart={() => handleManualMouseDown('RIGHT')}
                  onTouchEnd={handleManualMouseUp}
                  disabled={!wsConnected || !isCalibrated}
                  className={`py-4 px-6 rounded-xl font-bold text-white transition-all duration-300 flex flex-col items-center gap-2
                    ${manualDirection === 'RIGHT' ? 'bg-blue-800 scale-95' : 'bg-blue-600 hover:bg-blue-700'}
                    disabled:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95`}
                >
                  <ArrowRight className="w-6 h-6" />
                  <span className="text-sm">Hold RIGHT</span>
                </button>
              </div>
              <p className="text-gray-500 text-xs mt-2 text-center">
                💡 Press and hold Left/Right buttons to manually move the actuator
              </p>
            </div>

            {/* Emergency Stop Button */}
            <button
              onClick={handleEmergencyStop}
              disabled={!wsConnected || (!isMoving && !manualDirection)}
              className="w-full py-3 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white font-bold rounded-lg 
                        transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Square className="w-5 h-5" />
              EMERGENCY STOP
            </button>

            {/* Safety Warning */}
            <div className="mt-4 bg-orange-900 bg-opacity-30 border border-orange-700 rounded-lg p-3">
              <p className="text-orange-200 text-sm">
                ⚠️ <strong>Safety Feature:</strong> Direct movement between LEFT and RIGHT positions is prevented. 
                You must pass through MID position first.
              </p>
            </div>
          </div>

        </div>
      </div>

      {/* Warning Popup */}
      {showWarning && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="bg-white rounded-lg p-6 shadow-lg max-w-md">
            <div className="flex items-start gap-3 mb-4">
              <AlertTriangle className="w-8 h-8 text-red-600 flex-shrink-0" />
              <div>
                <h2 className="text-xl font-bold text-red-600 mb-2">Warning!</h2>
                <p className="text-gray-700">
                  The sensor has exceeded the safe limit of {config.warning} kN!
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowWarning(false)}
              className="w-full bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition"
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