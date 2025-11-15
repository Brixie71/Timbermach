import React, { useState } from 'react';
import './WoodTests.css';
import KiloNewtonGauge from './KiloNewtonGuage';
import MoistureTestPage from './MoistureTest';
import DimensionMeasurementPage from './Measurement';

const WoodTests = () => {
  // Use State
  const [selectedTest, setSelectedTest] = useState(null);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [subType, setSubType] = useState('');
  const [includeMeasurement, setIncludeMeasurement] = useState(false);
  const [includeMoisture, setIncludeMoisture] = useState(false);
  const [audio] = useState(new Audio('Sounds/UI/button_press_Beep.mp3')); // UI Sound Cue
  const [testStarted, setTestStarted] = useState(false);
  const [currentTestStage, setCurrentTestStage] = useState('selection');

  // Card Paths 
  const tests = [
    { title: 'Compressive Test', image: "Cards/Strength Test/Card_Default.png" },
    { title: 'Shear Test', image: 'Cards/Strength Test/Card_Default.png' },
    { title: 'Flexure Test', image: 'Cards/Strength Test/Card_Default.png' }
  ];

  // Navigation functions
  const goToPreviousCard = () => {
    audio.play();
    setCurrentCardIndex((prev) => (prev === 0 ? tests.length - 1 : prev - 1));
  };

  const goToNextCard = () => {
    audio.play();
    setCurrentCardIndex((prev) => (prev === tests.length - 1 ? 0 : prev + 1));
  };

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
    setCurrentTestStage('selection');
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

  // Determine test sequence based on selected options
  const determineTestSequence = () => {
    const sequence = [];
    
    // Always add optional tests first, in order
    if (includeMoisture) sequence.push('moistureTest');
    if (includeMeasurement) sequence.push('dimensionTest');
    
    // Strength test (KiloNewtonGauge) is ALWAYS last
    sequence.push('mainTest');
    
    return sequence;
  };

  const handleBeginTest = () => {
    audio.play();
    
    // Log test parameters
    console.log('Beginning test:', {
      test: selectedTest,
      subType,
      includeMeasurement,
      includeMoisture
    });
    
    // Immediately set test stages and start
    const testSequence = determineTestSequence();
    setCurrentTestStage(testSequence[0]);
    setTestStarted(true);
    
    // Close the modal immediately
    setSelectedTest(null);
  };

  // Render tests in sequence
  const renderTestStages = () => {
    const testSequence = determineTestSequence();
    const currentIndex = testSequence.indexOf(currentTestStage);

    const moveToNextTest = () => {
      // Move to next test in sequence or reset
      if (currentIndex < testSequence.length - 1) {
        setCurrentTestStage(testSequence[currentIndex + 1]);
      } else {
        // All tests complete
        setTestStarted(false);
        setSelectedTest(null);
      }
    };

    const moveToPreviousTest = () => {
      // Move to the previous test in sequence or reset
      if (currentIndex > 0) {
        setCurrentTestStage(testSequence[currentIndex - 1]);
      } else {
        // If at first test, go back to test selection
        setTestStarted(false);
        setSelectedTest(null);
      }
    };

    const returnToMainPage = () => {
      // Reset everything and go back to test selection
      setTestStarted(false);
      setSelectedTest(null);
      resetSelections();
    };

    switch(currentTestStage) {
      case 'moistureTest':
        return (
          <MoistureTestPage
            onTestComplete={moveToNextTest}
            onPreviousTest={moveToPreviousTest}
            onMainPageReturn={returnToMainPage}
          />
        );
      
      case 'dimensionTest':
        return (
          <DimensionMeasurementPage
            onTestComplete={moveToNextTest}
            onPreviousTest={moveToPreviousTest}
            onMainPageReturn={returnToMainPage}
          />
        );
      
      case 'mainTest':
        return (
          <KiloNewtonGauge
            testType={selectedTest?.split(' ')[0]?.toLowerCase()}
            onTestComplete={moveToNextTest}
            onPreviousTest={moveToPreviousTest}
            onMainPageReturn={returnToMainPage}
          />
        );
      
      default:
        return null;
    }
  };

  const currentTest = tests[currentCardIndex];

  return (
    <>
      {testStarted ? renderTestStages() : (
        <div className="relative min-h-screen flex items-center justify-center p-4">
          {/* Navigation Container */}
          <div className="flex items-stretch justify-center w-full max-w-4xl gap-4 h-96">
            {/* Left Arrow */}
            <button
              onClick={goToPreviousCard}
              className="flex-shrink-0 w-20 h-full bg-blue-500 hover:bg-blue-600 
                         text-white rounded-lg shadow-lg transition-all duration-300 
                         flex items-center justify-center text-4xl font-bold
                         active:scale-95"
              aria-label="Previous card"
            >
              ←
            </button>

            {/* Card Display */}
            <div className="flex-grow flex justify-center">
              <button
                onClick={() => handleTestClick(currentTest.title)}
                className={`bg-white rounded-lg shadow-xl 
                            transition-all duration-300 ease-in-out
                            transform hover:scale-105
                            border-4 w-full max-w-md h-96
                            ${selectedTest === currentTest.title ? 'border-blue-500' : 'border-gray-300'}`}
              >
                <div className="h-full flex flex-col">
                  <img
                    src={currentTest.image}
                    alt={currentTest.title}
                    className="w-full h-64 object-cover rounded-t-lg"
                  />
                  <div className="p-6 flex-grow flex items-center justify-center bg-white rounded-b-lg">
                    <h3 className="text-2xl font-bold text-black text-center">
                      {currentTest.title}
                    </h3>
                  </div>
                </div>
              </button>
            </div>

            {/* Right Arrow */}
            <button
              onClick={goToNextCard}
              className="flex-shrink-0 w-20 h-full bg-blue-500 hover:bg-blue-600 
                        text-white rounded-lg shadow-lg transition-all duration-300 
                        flex items-center justify-center text-4xl font-bold
                        active:scale-95"
              aria-label="Next card"
            >
              →
            </button>
          </div>

          {/* Card Indicator */}
          <div className="absolute bottom-8 left-0 right-0 flex justify-center gap-2">
            {tests.map((_, index) => (
              <div
                key={index}
                className={`w-3 h-3 rounded-full transition-all duration-300 ${
                  index === currentCardIndex 
                    ? 'bg-blue-500 w-8' 
                    : 'bg-gray-400'
                }`}
              />
            ))}
          </div>
        </div>
      )}

      {/* Modal for test parameters */}
      {selectedTest && (['Compressive Test', 'Shear Test', 'Flexure Test'].includes(selectedTest)) && (
        <>
          <div className="fixed inset-0 bg-black bg-opacity-50 z-40" />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl">
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
                    <h3 className="text-lg font-semibold mb-2">Additional Tests</h3>
                    <div className="grid grid-cols-1 gap-4">
                      <CheckboxOption 
                        label="Measure Dimensions" 
                        checked={includeMeasurement} 
                        setChecked={setIncludeMeasurement} 
                      />
                      <CheckboxOption 
                        label="Moisture Test" 
                        checked={includeMoisture} 
                        setChecked={setIncludeMoisture} 
                      />
                      <CheckboxOption 
                        label={selectedTest} 
                        checked={true} 
                        disabled 
                      />
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