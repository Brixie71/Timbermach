import React from 'react';

// Settings component
const Settings = () => {
  // Function to handle button clicks
  const handleButtonClick = (option) => {
    console.log(`${option} button clicked`);
    // Add your logic for handling the button click here
  };

  return (
    <div className="p-2 bg-white-980 rounded-lg shadow-lg max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-4">Settings</h1>
      <div className="flex flex-col space-y-2">
        {/* Theme Button */}
        <button 
          className="flex items-center justify-center px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition duration-300"
          onClick={() => handleButtonClick('Theme')}
        >
          Theme
        </button>
        
        {/* Calibration Button */}
        <button 
          className="flex items-center justify-center px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition duration-300"
          onClick={() => handleButtonClick('Calibration')}
        >
          Calibration
        </button>
      </div>
    </div>
  );
};

export default Settings;