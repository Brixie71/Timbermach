import React, { useState, useEffect } from "react";

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

const KiloNewtonGauge = ({ testType }) => {
  const [kNValue, setKNValue] = useState(0); // Current kN value from WebSocket
  const [showWarning, setShowWarning] = useState(false); // State to manage warning popup visibility
  const config = gaugeConfigs[testType?.toLowerCase()] || defaultConfig; // Get the configuration based on testType

  // Ensure the gauge value does not exceed the max
  const gaugeValue = Math.min(kNValue, config.max); 
  // Calculate the percentage filled (corrected to fill only until max value)
  const percentage = (gaugeValue / config.max) * 100; 

  useEffect(() => {
    const socket = new WebSocket("ws://localhost:8080");

    // Handle incoming messages from the WebSocket
    socket.onmessage = (event) => {
      const newValue = parseFloat(event.data);
      if (!isNaN(newValue)) {
        setKNValue(newValue); // Update the gauge value
        // Show warning if the new value exceeds the warning threshold
        setShowWarning(newValue > config.warning);
      }
    };

    // Clean up the WebSocket connection on component unmount
    return () => {
      socket.close();
    };
  }, [config.warning]);

  // Function to handle warning popup close
  const handleCloseWarning = () => {
    setShowWarning(false);
  };

  return (
    <div className="flex justify-center items-center">
      <div className="text-center p-3 sm:p-4 md:p-5 bg-gray-800 rounded-[30px] sm:rounded-[40px] md:rounded-[50px] shadow-lg">
        <div className="relative justify-center items-center w-[300px] sm:w-[400px] md:w-[500px] h-[150px] sm:h-[200px] md:h-[250px] overflow-hidden bg-gray-800 rounded-t-[300px] sm:rounded-t-[400px] md:rounded-t-[500px] mx-auto">
          <svg viewBox="0 -9 200 200" className="relative w-full h-full">
            {/* Background Track - 270 degree arc */}
            <path
              d="M 40,170 A 90,90 0 1,1 160,170"
              fill="none"
              stroke="#4A5568"
              strokeWidth="20"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="565"
            />
            
            {/* Blue progress arc with animation */}
            <path
              d="M 40,170 A 90,90 0 1,1 160,170"
              fill="none"
              stroke="#3b82f6"
              strokeWidth="20"
              strokeDasharray="460"
              strokeDashoffset={464 - (percentage / 100) * 440}
              className="transition-all duration-700 ease-in-out"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <div className="absolute h-7 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-gray-200 text-3xl sm:text-4xl md:text-5xl font-sans">
            {kNValue.toFixed(2)} {/* Display the kN value with two decimal places */}
            <p className="mt-3 sm:mt-4 md:mt-5 text-base sm:text-lg md:text-xl">Kilonewtons</p>
            <p className="mt-3 sm:mt-2 md:mt-5 text-base sm:text-lg md:text-l">(kN)</p>
          </div>
        </div>
        {/*<div className="mt-3 sm:mt-4 md:mt-5 text-gray-400 text-base sm:text-lg md:text-xl">
          <p>Max: {config.max} kN</p>
          <p className="text-red-500">
            Damage Pressure: {config.warning} kN - {config.max} kN
          </p>
        </div>*/}
      </div>

      {/* Warning Popup */}
      {showWarning && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="bg-white rounded-lg p-5 shadow-lg">
            <h2 className="text-lg font-bold text-red-600">Warning!</h2>
            <p className="mt-2">The sensor has exceeded the safe limit of 1600 kN!</p>
            <button
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