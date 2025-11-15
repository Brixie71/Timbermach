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
  const [kNValue, setKNValue] = useState(0); // Current kN value from WebSocket
  const [pressureData, setPressureData] = useState([]); // Store pressure data points over time
  const [maxPressure, setMaxPressure] = useState({ value: 0, time: 0 }); // Track maximum pressure
  const [testStartTime, setTestStartTime] = useState(null); // When the test started
  const [showWarning, setShowWarning] = useState(false); // State to manage warning popup visibility
  const [isTestRunning, setIsTestRunning] = useState(false); // Track if test is running
  const [testCompleted, setTestCompleted] = useState(false); // Track if test completed
  const [svgCreated, setSvgCreated] = useState(false); // Track if SVG has been created

  const config = gaugeConfigs[testType?.toLowerCase()] || defaultConfig; // Get the configuration based on testType
  const graphRef = useRef(null);
  const containerRef = useRef(null);
  const socketRef = useRef(null);
  const svgRef = useRef(null);
  const resizeObserverRef = useRef(null);

  // Log props for debugging
  useEffect(() => {
    console.log("KiloNewtonGauge props:", { testType, onPreviousTest: !!onPreviousTest, onMainPageReturn: !!onMainPageReturn });
  }, [testType, onPreviousTest, onMainPageReturn]);

  // Start the test and timer
  const startTest = () => {
    setTestStartTime(Date.now());
    setPressureData([]); // Reset previous data
    setMaxPressure({ value: 0, time: 0 });
    setTestCompleted(false);
    setIsTestRunning(true);
  };

  // Handle navigation with proper cleanup
  const handlePreviousTest = () => {
    console.log("Previous Test button clicked");
    
    // Close WebSocket connection
    if (socketRef.current) {
      try {
        socketRef.current.close();
        socketRef.current = null;
      } catch (err) {
        console.error("Error closing WebSocket:", err);
      }
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
    
    // Navigate to previous test - ensure this is a function
    if (typeof onPreviousTest === 'function') {
      console.log("Calling onPreviousTest function");
      onPreviousTest();
    } else {
      console.error("onPreviousTest is not a function", onPreviousTest);
    }
  };

  const handleMainPageReturn = () => {
    console.log("Main Page Return button clicked");
    
    // Close WebSocket connection
    if (socketRef.current) {
      try {
        socketRef.current.close();
        socketRef.current = null;
      } catch (err) {
        console.error("Error closing WebSocket:", err);
      }
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
    
    // Navigate to main page - ensure this is a function
    if (typeof onMainPageReturn === 'function') {
      console.log("Calling onMainPageReturn function");
      onMainPageReturn();
    } else {
      console.error("onMainPageReturn is not a function", onMainPageReturn);
    }
  };

  // Set up WebSocket connection
  useEffect(() => {
    // Set up the WebSocket connection
    try {
      socketRef.current = new WebSocket("ws://localhost:8080");

      // Handle incoming messages from the WebSocket
      socketRef.current.onmessage = (event) => {
        const newValue = parseFloat(event.data);
        if (!isNaN(newValue)) {
          setKNValue(newValue); // Update the current value

          if (isTestRunning) {
            const currentTime = (Date.now() - testStartTime) / 1000; // Time in seconds
            
            // Add the new data point
            setPressureData(prevData => {
              const newData = [...prevData, { time: currentTime, pressure: newValue }];
              return newData;
            });

            // Update max pressure if the new value is higher
            if (newValue > maxPressure.value) {
              setMaxPressure({ value: newValue, time: currentTime });
            }

            // Detect pressure drop (test completion)
            // Check for significant pressure drop (e.g., 20% drop from max)
            const dropThreshold = 0.20; // 20% drop
            if (maxPressure.value > 10 && newValue < maxPressure.value * (1 - dropThreshold)) {
              setIsTestRunning(false);
              setTestCompleted(true);
            }

            // Show warning if the new value exceeds the warning threshold
            setShowWarning(newValue > config.warning);
          }
        }
      };

      // Handle WebSocket errors
      socketRef.current.onerror = (error) => {
        console.error("WebSocket error:", error);
      };

      // Handle WebSocket close
      socketRef.current.onclose = () => {
        console.log("WebSocket connection closed");
      };

    } catch (err) {
      console.error("Error creating WebSocket:", err);
    }

    // Clean up the WebSocket connection on component unmount
    return () => {
      if (socketRef.current) {
        try {
          socketRef.current.close();
        } catch (err) {
          console.error("Error closing WebSocket:", err);
        }
      }
    };
  }, [config.warning, isTestRunning, maxPressure.value, testStartTime]);

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
          .domain([0, 30]) // Fixed at 30 seconds like in screenshot
          .range([0, innerWidth]);
        
        const yScale = d3.scaleLinear()
          .domain([0, 1600]) // Fixed range 0-1600 kN
          .range([innerHeight, 0]);
        
        // Create axes
        const xAxis = d3.axisBottom(xScale)
          .ticks(15) // More ticks for seconds
          .tickFormat(d => d);
        
        const yAxis = d3.axisLeft(yScale)
          .ticks(8) // For values like 0, 200, 400, etc.
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
            .x(d => xScale(Math.min(30, d.time))) // Cap at 30 seconds
            .y(d => yScale(d.pressure))
            .curve(d3.curveLinear); // Use linear interpolation like in screenshot
          
          // Add the line path
          g.append("path")
            .datum(pressureData)
            .attr("class", "line")
            .attr("fill", "none")
            .attr("stroke", "white") // White line like in screenshot
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
  }, [pressureData, svgCreated]);

  // Handle warning popup close
  const handleCloseWarning = () => {
    setShowWarning(false);
  };

  return (
    <div className="fixed inset-0 flex flex-col h-screen w-screen bg-gray-900" ref={containerRef}>
      {/* Header Bar - Similar to screenshot */}
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
          TimberMach | {testType || 'Strength'} Test
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
          {/* Curved Container - Like in Screenshot */}
          <div className="flex flex-col rounded-[30px] bg-gray-800 w-full flex-grow overflow-hidden p-4 mx-auto my-2 sm:my-4">
            {/* Navigation Buttons - FIXED */}
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