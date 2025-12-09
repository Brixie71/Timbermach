import React, { useState, useEffect, useRef } from "react";
import * as d3 from "d3";

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

const KiloNewtonGauge = ({ 
  testType,
  onPreviousTest = () => {},
  onMainPageReturn = () => {},
  onTestComplete = () => {} 
}) => {
  const [kNValue, setKNValue] = useState(0); // Current kN value
  const [pressureData, setPressureData] = useState([]); // Store pressure data points over time
  const [maxPressure, setMaxPressure] = useState({ value: 0, time: 0 }); // Track maximum pressure
  const [testStartTime, setTestStartTime] = useState(null); // When the test started
  const [showWarning, setShowWarning] = useState(false); // State to manage warning popup visibility
  const [isTestRunning, setIsTestRunning] = useState(false); // Track if test is running
  const [testCompleted, setTestCompleted] = useState(false); // Track if test completed
  const [svgCreated, setSvgCreated] = useState(false); // Track if SVG has been created

  const config = gaugeConfigs[testType?.toLowerCase()] || defaultConfig;
  const graphRef = useRef(null);
  const containerRef = useRef(null);
  const svgRef = useRef(null);
  const resizeObserverRef = useRef(null);
  const simulationIntervalRef = useRef(null);
  const currentPhaseRef = useRef('loading'); // loading, increasing, peaking, dropping
  const targetPeakRef = useRef(0);
  const peakReachedTimeRef = useRef(0);

  // Log props for debugging
  useEffect(() => {
    console.log("KiloNewtonGauge props:", { 
      testType, 
      onPreviousTest: !!onPreviousTest, 
      onMainPageReturn: !!onMainPageReturn,
      onTestComplete: !!onTestComplete 
    });
  }, [testType, onPreviousTest, onMainPageReturn, onTestComplete]);

  // Start the test and simulation
  const startTest = () => {
    setTestStartTime(Date.now());
    setPressureData([]);
    setMaxPressure({ value: 0, time: 0 });
    setTestCompleted(false);
    setIsTestRunning(true);
    setKNValue(0);
    
    // Reset simulation state
    currentPhaseRef.current = 'loading';
    
    // Generate random peak value between 800-1400 kN (realistic wood failure range)
    targetPeakRef.current = Math.random() * (1400 - 800) + 800;
    console.log('Target peak force:', targetPeakRef.current.toFixed(2), 'kN');
  };

  // Realistic pressure simulation
  useEffect(() => {
    if (!isTestRunning || testCompleted) {
      if (simulationIntervalRef.current) {
        clearInterval(simulationIntervalRef.current);
        simulationIntervalRef.current = null;
      }
      return;
    }

    // Simulation runs at 50ms intervals (20 updates per second)
    simulationIntervalRef.current = setInterval(() => {
      const now = Date.now();
      const elapsedSeconds = (now - testStartTime) / 1000;
      
      let newValue = kNValue;
      const phase = currentPhaseRef.current;

      switch (phase) {
        case 'loading':
          // Initial loading phase: rapid increase (first 1 second)
          if (elapsedSeconds < 1.0) {
            // Exponential increase for first second
            const progress = elapsedSeconds;
            newValue = targetPeakRef.current * 0.15 * progress;
          } else {
            currentPhaseRef.current = 'increasing';
            console.log('Phase: Loading → Increasing');
          }
          break;

        case 'increasing':
          // Main increase phase: gradual increase with some noise
          const progressToTarget = kNValue / targetPeakRef.current;
          
          if (progressToTarget < 0.95) {
            // Increase rate slows as we approach peak (realistic material behavior)
            const baseIncrease = (targetPeakRef.current * 0.02) * (1 - progressToTarget);
            const noise = (Math.random() - 0.5) * 2; // ±1 kN noise
            newValue = kNValue + baseIncrease + noise;
            
            // Clamp to not exceed target yet
            if (newValue > targetPeakRef.current * 0.95) {
              newValue = targetPeakRef.current * 0.95;
            }
          } else {
            // Reached near-peak, enter peaking phase
            currentPhaseRef.current = 'peaking';
            peakReachedTimeRef.current = now;
            console.log('Phase: Increasing → Peaking at', kNValue.toFixed(2), 'kN');
          }
          break;

        case 'peaking':
          // Peak phase: fluctuate around peak for 1-2 seconds (material at limit)
          const timeSincePeak = (now - peakReachedTimeRef.current) / 1000;
          
          if (timeSincePeak < 1.5) {
            // Small fluctuations around peak ±5 kN
            const fluctuation = (Math.random() - 0.5) * 10;
            newValue = targetPeakRef.current + fluctuation;
            
            // Stay within reasonable bounds
            newValue = Math.max(
              targetPeakRef.current * 0.95, 
              Math.min(targetPeakRef.current * 1.05, newValue)
            );
          } else {
            // Start failure/drop
            currentPhaseRef.current = 'dropping';
            console.log('Phase: Peaking → Dropping (material failure)');
          }
          break;

        case 'dropping':
          // Failure phase: rapid exponential drop (material breaking)
          const dropProgress = (now - peakReachedTimeRef.current - 1500) / 1000;
          
          // Exponential decay with some noise
          const dropRate = Math.exp(-dropProgress * 2); // Exponential decay
          newValue = targetPeakRef.current * dropRate * 0.3;
          
          // Add some noise to simulate crack propagation
          const dropNoise = (Math.random() - 0.5) * 5;
          newValue += dropNoise;
          
          // Once dropped below 20% of peak, test is complete
          if (newValue < targetPeakRef.current * 0.2) {
            newValue = 0;
            currentPhaseRef.current = 'complete';
            setIsTestRunning(false);
            setTestCompleted(true);
            
            clearInterval(simulationIntervalRef.current);
            simulationIntervalRef.current = null;
            
            console.log('Test complete! Max pressure:', maxPressure.value.toFixed(2), 'kN');
          }
          break;
      }

      // Ensure non-negative
      newValue = Math.max(0, newValue);

      // Update current value
      setKNValue(newValue);

      // Add to pressure data
      const currentTime = elapsedSeconds;
      setPressureData(prevData => {
        const newData = [...prevData, { time: currentTime, pressure: newValue }];
        return newData;
      });

      // Track maximum pressure
      if (newValue > maxPressure.value) {
        setMaxPressure({ value: newValue, time: currentTime });
      }

      // Warning if exceeding warning threshold
      setShowWarning(newValue > config.warning);

    }, 50); // 20 updates per second

    return () => {
      if (simulationIntervalRef.current) {
        clearInterval(simulationIntervalRef.current);
      }
    };
  }, [isTestRunning, testCompleted, kNValue, testStartTime, config.warning, maxPressure.value]);

  // Call onTestComplete when test finishes
  useEffect(() => {
    if (testCompleted && maxPressure.value > 0) {
      // Prepare strength test data
      const strengthData = {
        maxForce: maxPressure.value,
        timestamp: new Date(testStartTime + (maxPressure.time * 1000)).toISOString(),
        duration: maxPressure.time,
        pressureHistory: pressureData,
        testType: testType
      };
      
      console.log('Sending test data to parent:', strengthData);
      
      // Call onTestComplete with data
      if (typeof onTestComplete === 'function') {
        onTestComplete(strengthData);
      }
    }
  }, [testCompleted, maxPressure, testStartTime, pressureData, testType, onTestComplete]);

  // Handle navigation with proper cleanup
  const handlePreviousTest = () => {
    console.log("Previous Test button clicked");
    
    // Stop simulation
    if (simulationIntervalRef.current) {
      clearInterval(simulationIntervalRef.current);
      simulationIntervalRef.current = null;
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
      console.log("Calling onPreviousTest function");
      onPreviousTest();
    } else {
      console.error("onPreviousTest is not a function", onPreviousTest);
    }
  };

  const handleMainPageReturn = () => {
    console.log("Main Page Return button clicked");
    
    // Stop simulation
    if (simulationIntervalRef.current) {
      clearInterval(simulationIntervalRef.current);
      simulationIntervalRef.current = null;
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
      console.log("Calling onMainPageReturn function");
      onMainPageReturn();
    } else {
      console.error("onMainPageReturn is not a function", onMainPageReturn);
    }
  };

  // Initialize the D3 graph
  useEffect(() => {
    if (!graphRef.current) return;

    try {
      // Clear any previous SVG
      d3.select(graphRef.current).selectAll("svg").remove();

      // Create SVG element
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

  // Update the D3 graph when pressure data changes or container resizes
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
        
        // Clear previous elements
        svg.selectAll("g").remove();
        
        // Create main group element
        const g = svg.append("g")
          .attr("transform", `translate(${margin.left},${margin.top})`);
        
        // Set up scales
        const xScale = d3.scaleLinear()
          .domain([0, 30]) // Fixed at 30 seconds
          .range([0, innerWidth]);
        
        const yScale = d3.scaleLinear()
          .domain([0, 1600]) // Fixed range 0-1600 kN
          .range([innerHeight, 0]);
        
        // Create axes
        const xAxis = d3.axisBottom(xScale)
          .ticks(15)
          .tickFormat(d => d);
        
        const yAxis = d3.axisLeft(yScale)
          .ticks(8)
          .tickFormat(d => d);
        
        // Add X axis
        g.append("g")
          .attr("class", "x-axis")
          .attr("transform", `translate(0,${innerHeight})`)
          .style("color", "white")
          .call(xAxis);
        
        // Add Y axis
        g.append("g")
          .attr("class", "y-axis")
          .style("color", "white")
          .call(yAxis);
        
        // Add axis labels
        g.append("text")
          .attr("class", "x-label")
          .attr("text-anchor", "middle")
          .attr("x", innerWidth / 2)
          .attr("y", innerHeight + margin.bottom - 5)
          .style("fill", "white")
          .style("font-size", "12px")
          .text("Time (seconds)");
        
        g.append("text")
          .attr("class", "y-label")
          .attr("text-anchor", "middle")
          .attr("transform", "rotate(-90)")
          .attr("x", -innerHeight / 2)
          .attr("y", -margin.left + 15)
          .style("fill", "white")
          .style("font-size", "12px")
          .text("Pressure (kN)");
        
        // Add horizontal grid lines
        g.selectAll("line.horizontalGrid")
          .data(yScale.ticks(8))
          .enter()
          .append("line")
          .attr("class", "horizontalGrid")
          .attr("x1", 0)
          .attr("x2", innerWidth)
          .attr("y1", d => yScale(d))
          .attr("y2", d => yScale(d))
          .style("stroke", "rgba(255, 255, 255, 0.1)")
          .style("stroke-width", 0.5);
        
        // Add vertical grid lines
        g.selectAll("line.verticalGrid")
          .data(xScale.ticks(15))
          .enter()
          .append("line")
          .attr("class", "verticalGrid")
          .attr("x1", d => xScale(d))
          .attr("x2", d => xScale(d))
          .attr("y1", 0)
          .attr("y2", innerHeight)
          .style("stroke", "rgba(255, 255, 255, 0.1)")
          .style("stroke-width", 0.5);
        
        // Only add data line if we have points
        if (pressureData.length > 0) {
          // Create line generator
          const line = d3.line()
            .x(d => xScale(Math.min(30, d.time)))
            .y(d => yScale(d.pressure))
            .curve(d3.curveLinear);
          
          // Add the line path
          g.append("path")
            .datum(pressureData)
            .attr("class", "line")
            .attr("fill", "none")
            .attr("stroke", "white")
            .attr("stroke-width", 1.5)
            .attr("d", line);
          
          // Add max point if available
          if (maxPressure.value > 0) {
            g.append("circle")
              .attr("class", "max-point")
              .attr("cx", xScale(Math.min(30, maxPressure.time)))
              .attr("cy", yScale(maxPressure.value))
              .attr("r", 4)
              .attr("fill", "red");
            
            // Add label for max point
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
    
    // Initial render
    updateGraph();
    
    // Add resize listener
    try {
      resizeObserverRef.current = new ResizeObserver(() => {
        updateGraph();
      });
      
      if (graphRef.current) {
        resizeObserverRef.current.observe(graphRef.current);
      }
    } catch (err) {
      console.error("Error setting up resize observer:", err);
    }
    
    // Cleanup
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

  // Handle warning popup close
  const handleCloseWarning = () => {
    setShowWarning(false);
  };

  return (
    <div className="fixed inset-0 flex flex-col h-screen w-screen bg-gray-900" ref={containerRef}>
      {/* Header Bar */}
      <div className="flex items-center px-3 py-1.5 bg-gray-800 fixed top-0 left-0 right-0 z-10">
        <button
          type="button"
          onClick={() => handlePreviousTest()}
          className="bg-transparent border-none text-gray-200 text-2xl cursor-pointer p-1.5 
                   hover:text-blue-400 transition-colors duration-300"
        >
          <span className="sr-only">Menu</span>
          ☰
        </button>
        <span className="ml-4 text-gray-100 text-lg font-semibold">
          TimberMach | {testType || 'Strength'} Test {isTestRunning && '(Running...)'}
        </span>
        <button
          type="button"
          onClick={() => handleMainPageReturn()}
          className="bg-transparent border-none text-gray-200 text-2xl cursor-pointer p-1.5 ml-auto
                   hover:text-red-500 transition-colors duration-300"
        >
          <span className="sr-only">Power</span>
          ⏻
        </button>
      </div>

      {/* Main Content - Full Page */}
      <div className="mt-12 flex flex-col flex-grow w-full h-full overflow-hidden flex justify-center items-center">
        <div className="flex-grow flex flex-col mx-auto w-full max-w-5xl px-4 py-4 sm:px-6 sm:py-6 flex justify-center items-center">
          {/* Curved Container */}
          <div className="flex flex-col rounded-[30px] bg-gray-800 w-full flex-grow overflow-hidden p-4 mx-auto my-2 sm:my-4">
            {/* Navigation Buttons */}
            <div className="flex justify-between mb-4">
              <button
                type="button"
                onClick={handlePreviousTest}
                className="px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
              >
                ← Previous Test
              </button>
              <button
                type="button"
                onClick={handleMainPageReturn}
                className="px-3 py-1 bg-gray-600 text-white rounded-lg hover:bg-gray-700 text-sm"
              >
                Home
              </button>
            </div>
            
            {/* kN Value Display */}
            <div className="text-center mb-2">
              <div className="text-gray-200 text-4xl sm:text-5xl md:text-6xl font-sans">
                {kNValue.toFixed(2)}
                <span className="ml-2 text-xl sm:text-2xl md:text-3xl">kN</span>
              </div>
              {maxPressure.value > 0 && (
                <div className="text-gray-400 text-sm mt-2">
                  Peak: {maxPressure.value.toFixed(2)} kN at {maxPressure.time.toFixed(1)}s
                </div>
              )}
            </div>
            
            {/* Graph Container - Fill Available Space */}
            <div className="relative bg-gray-900 rounded-lg overflow-hidden flex-grow w-full mt-2 mb-2">
              <div 
                ref={graphRef} 
                className="w-full h-full"
              ></div>
              
              {/* Overlay for when test is not running */}
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
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                      >
                        Start New Test
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={startTest}
                      className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 text-lg font-semibold"
                    >
                      Start Test
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Warning Popup */}
      {showWarning && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="bg-white rounded-lg p-5 shadow-lg">
            <h2 className="text-lg font-bold text-red-600">Warning!</h2>
            <p className="mt-2">The sensor has exceeded the safe limit of {config.warning} kN!</p>
            <button
              type="button"
              onClick={handleCloseWarning}
              className="mt-4 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default KiloNewtonGauge;