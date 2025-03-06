import React, { useState } from 'react';
import './WoodTests.css';
import KiloNewtonGauge from './KiloNewtonGuage';

const WoodTests = () => {

  // Use State
  const [selectedTest, setSelectedTest] = useState(null);
  const [subType, setSubType] = useState('');
  const [includeMeasurement, setIncludeMeasurement] = useState(false);
  const [includeMoisture, setIncludeMoisture] = useState(false);
  const [audio] = useState(new Audio('Sounds/UI/button_press_Beep.mp3')); // UI Sound Cue
  const [testStarted, setTestStarted] = useState(false);

  // Card Paths 
  const tests = [
    { title: 'Compressive Test', image: "Cards/Strength Test/Card_Default.png" },
    { title: 'Shear Test', image: 'Cards/Strength Test/Card_Default.png' },
    { title: 'Flexure Test', image: 'Cards/Strength Test/Card_Default.png' },
    { title: 'Moisture Test', image: 'Cards/Strength Test/Card_Default.png' },
    { title: 'Measure Dimension', image: 'Cards/Strength Test/Card_Default.png' }
  ];

  // Handle test selection
  const handleTestClick = (title) => {
    audio.play();
    setSelectedTest(title);
    resetSelections(); // Reset selections when a new test is clicked
  };

  // Reset selections
  const resetSelections = () => {
    setSubType('');
    setIncludeMeasurement(false);
    setIncludeMoisture(false);
  };

  // Validate form inputs based on selected test
  const isFormValid = () => {
    if (selectedTest === 'Compressive Test' || selectedTest === 'Shear Test') {
      return subType !== ''; // Require subType selection
    }
    return true; // No additional validation for other tests
  };

  // Close the modal
  const handleClose = () => {
    audio.play();
    setSelectedTest(null);
  };

  // Begin the test and log parameters
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

  // Render the KiloNewtonGauge if the test has started
  if (testStarted) {
    return (
      <KiloNewtonGauge
        testType={selectedTest?.split(' ')[0]?.toLowerCase()} // Extract first word of the test type
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

      {/* Modal for test parameters */}
      {selectedTest && (['Compressive Test', 'Shear Test', 'Flexure Test'].includes(selectedTest)) && (
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
                <div className="grid grid-cols-2 gap-4">
                  {/* Test Type Selection */}
                  {['Compressive Test', 'Shear Test'].includes(selectedTest) && (
                    <div className="mb-6">
                      <h3 className="text-lg font-semibold mb-2">Test Type</h3>
                      <div className="grid grid-cols-1 gap-4">
                        {selectedTest === 'Compressive Test' && (
                          <>
                            <RadioOption value="parallel" label="Parallel to Grain" selectedValue={subType} setValue={setSubType} />
                            <RadioOption value="perpendicular" label="Perpendicular to Grain" selectedValue={subType} setValue={setSubType} />
                          </>
                        )}
                        {selectedTest === 'Shear Test' && (
                          <>
                            <RadioOption value="single" label="Single Shear" selectedValue={subType} setValue={setSubType} />
                            <RadioOption value="double" label="Double Shear" selectedValue={subType} setValue={setSubType} />
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Additional Tests Selection */}
                  <div className="space-y-2">
                    <h3 className="text-lg font-semibold mb-2">Tests Included</h3>
                    <div className="grid grid-cols-1 gap-4">
                      <CheckboxOption label="Measure Dimensions" checked={includeMeasurement} setChecked={setIncludeMeasurement} />
                      <CheckboxOption label="Moisture Test" checked={includeMoisture} setChecked={setIncludeMoisture} />
                      <CheckboxOption label={selectedTest} checked={true} disabled />
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

// Radio option component for cleaner code
const RadioOption = ({ value, label, selectedValue, setValue }) => (
  <label className="flex items-center space-x-2">
    <input
      type="radio"
      name="subType"
      value={value}
      checked={selectedValue === value}
      onChange={() => setValue(value)}
      className="form-radio"
    />
    <span>{label}</span>
  </label>
);

// Checkbox option component for cleaner code
const CheckboxOption = ({ label, checked, setChecked, disabled = false }) => (
  <label className="flex items-center space-x-2">
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => setChecked(e.target.checked)}
      className="form-checkbox"
      disabled={disabled}
    />
    <span>{label}</span>
  </label>
);

export default WoodTests;