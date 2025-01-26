import React, { useState, useEffect } from 'react';
import './WoodTests.css'; // Import custom CSS for scrollbar styling
import KiloNewtonGauge from './KiloNewtonGuage';

const WoodTests = () => {
  const [selectedTest, setSelectedTest] = useState(null);
  const [subType, setSubType] = useState('');
  const [includeMeasurement, setIncludeMeasurement] = useState(false);
  const [includeMoisture, setIncludeMoisture] = useState(false);
  const [audio] = useState(new Audio('/resources/Sounds/UI/button_press_Beep.mp3')); // Add sound file path here
  const [testStarted, setTestStarted] = useState(false); // New state for tracking test status

  const tests = [
    { title: 'Compressive Test', image: 'resources/Cards/Strength Test/Card_Default.png' },
    { title: 'Shear Test', image: 'resources/Cards/Strength Test/Card_Default.png' },
    { title: 'Flexure Test', image: 'resources/Cards/Strength Test/Card_Default.png' },
    { title: 'Moisture Test', image: 'resources/Cards/Strength Test/Card_Default.png' },
    { title: 'Measure Dimension', image: 'resources/Cards/Strength Test/Card_Default.png' }
  ];

  const handleTestClick = (title) => {
    audio.play(); // Play sound on click
    setSelectedTest(title);
    setSubType('');
    setIncludeMeasurement(false);
    setIncludeMoisture(false);
  };

  // Add function to check if form is valid
  const isFormValid = () => {
    // For Compressive and Shear tests, require subType selection
    if (selectedTest === 'Compressive Test' || selectedTest === 'Shear Test') {
      return subType !== '';
    }
    // For Flexure test, no subType needed
    return true;
  };

  const handleClose = () => {
    audio.play(); // Play sound on close
    setSelectedTest(null);
  };

  const handleBeginTest = () => {
    audio.play();
    setTestStarted(true);
    console.log('Beginning test:', {
      test: selectedTest,
      subType,
      includeMeasurement,
      includeMoisture
    });
  };

  // If test is started, show the KiloNewtonGauge
  if (testStarted) {
    return (
      <KiloNewtonGauge 
        testType={selectedTest?.split(' ')[0]?.toLowerCase()} // Extract first word (compressive/shear/flexure)
      />
    );
  }

  return (
    <>
      <div className="relative min-h-screen">
        <div className="flex overflow-x-auto no-scrollbar gap-5 max-w-7xl mx-auto">
          {tests.map(({ title, image }) => (
            <button
              key={title}
              onClick={() => handleTestClick(title)}
              className={`bg-white rounded-lg shadow-md hover:shadow-lg 
                       transition-all duration-300 ease-in-out
                       transform hover:-translate-y-1
                       border border-gray-400 w-60 h-80 overflow-hidden flex-shrink-0  
                       ${selectedTest === title ? 'ring-2 ring-blue-500' : ''}`}
            >
              <div className="h-full flex flex-col">
                <img 
                  src={image} 
                  alt={title}
                  className="w-full h-60 object-cover border-b border-gray-400"  
                />
                <div className="p-6 flex-grow flex items-center justify-center">
                  <h3 className="text-xl font-semibold text-black">{title}</h3>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Modal - Now separated from main content */}
      {selectedTest && (selectedTest === 'Compressive Test' || selectedTest === 'Shear Test' || selectedTest === 'Flexure Test') && (
        <>
          <div className="fixed inset-0 bg-black bg-opacity-50 z-40" />
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4">
              <div className="flex justify-between items-center border-b p-4">
                <h2 className="text-2xl font-bold">{selectedTest} Parameters</h2>
                <button 
                  onClick={handleClose}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Modal Content */}
              <div className="p-6">
                {/* Sub-type selection and Additional Tests in a row */}
                <div className="grid grid-cols-2 gap-4">
                  {/* Test Type Section */}
                  {(selectedTest === 'Compressive Test' || selectedTest === 'Shear Test') && (
                    <div className="mb-6">
                      <h3 className="text-lg font-semibold mb-2">Test Type</h3>
                      <div className="grid grid-cols-1 gap-4">
                        {selectedTest === 'Compressive Test' && (
                          <>
                            <label className="flex items-center space-x-2">
                              <input
                                type="radio"
                                name="subType"
                                value="parallel"
                                checked={subType === 'parallel'}
                                onChange={(e) => setSubType(e.target.value)}
                                className="form-radio"
                              />
                              <span>Parallel to Grain</span>
                            </label>
                            <label className="flex items-center space-x-2">
                              <input
                                type="radio"
                                name="subType"
                                value="perpendicular"
                                checked={subType === 'perpendicular'}
                                onChange={(e) => setSubType(e.target.value)}
                                className="form-radio"
                              />
                              <span>Perpendicular to Grain</span>
                            </label>
                          </>
                        )}
                        
                        {selectedTest === 'Shear Test' && (
                          <>
                            <label className="flex items-center space-x-2">
                              <input
                                type="radio"
                                name="subType"
                                value="single"
                                checked={subType === 'single'}
                                onChange={(e) => setSubType(e.target.value)}
                                className="form-radio"
                              />
                              <span>Single Shear</span>
                            </label>
                            <label className="flex items-center space-x-2">
                              <input
                                type="radio"
                                name="subType"
                                value="double"
                                checked={subType === 'double'}
                                onChange={(e) => setSubType(e.target.value)}
                                className="form-radio"
                              />
                              <span>Double Shear</span>
                            </label>
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Additional Tests Selection */}
                  <div className="space-y-2">
                    <h3 className="text-lg font-semibold mb-2">Tests Included</h3>
                    <div className="grid grid-cols-1 gap-4">
                      <label className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={includeMeasurement}
                          onChange={(e) => setIncludeMeasurement(e.target.checked)}
                          className="form-checkbox"
                        />
                        <span>Measure Dimensions</span>
                      </label>
                      <label className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={includeMoisture}
                          onChange={(e) => setIncludeMoisture(e.target.checked)}
                          className="form-checkbox"
                        />
                        <span>Moisture Test</span>
                      </label>
                      <label className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={true}
                          disabled
                          className="form-checkbox"
                        />
                        <span>{selectedTest}</span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="border-t">
                <button
                  onClick={handleBeginTest}
                  disabled={!isFormValid()}
                  className={`w-full py-4 font-medium transition-colors text-lg rounded-b-lg
                    ${isFormValid() 
                      ? 'bg-blue-600 text-white hover:bg-blue-700' 
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'}`}
                >
                  Begin Test
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
};

export default WoodTests;
