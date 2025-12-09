import React, { useState } from 'react';
import './WoodTests.css';
import KiloNewtonGauge from './KiloNewtonGuage';
import MoistureTestPage from './MoistureTest';
import DimensionMeasurementPage from './Measurement';
import TestSummary from './TestSummary';

const WoodTests = () => {
  // State management
  const [selectedTest, setSelectedTest] = useState(null);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [subType, setSubType] = useState('');
  const [specimenName, setSpecimenName] = useState(''); // ✅ ADDED: Specimen Name
  const [includeMeasurement, setIncludeMeasurement] = useState(false);
  const [includeMoisture, setIncludeMoisture] = useState(false);
  const [audio] = useState(new Audio('Sounds/UI/button_press_Beep.mp3'));
  const [testStarted, setTestStarted] = useState(false);
  const [currentTestStage, setCurrentTestStage] = useState('selection');
  
  // Test data storage
  const [testData, setTestData] = useState({
    testType: '',
    subType: '',
    specimenName: '', // ✅ ADDED
    moistureData: null,
    measurementData: null,
    strengthData: null
  });

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

  const handleTestClick = (title) => {
    audio.play();
    setSelectedTest(title);
    resetSelections();
  };

  const resetSelections = () => {
    setSubType('');
    setSpecimenName(''); // ✅ ADDED
    setIncludeMeasurement(false);
    setIncludeMoisture(false);
    setCurrentTestStage('selection');
    setTestData({
      testType: '',
      subType: '',
      specimenName: '', // ✅ ADDED
      moistureData: null,
      measurementData: null,
      strengthData: null
    });
  };

  // ✅ UPDATED: Validation requires specimen name
  const isFormValid = () => {
    // Specimen name is ALWAYS required
    if (!specimenName || specimenName.trim() === '') {
      return false;
    }
    
    // For Compressive and Shear, subType is also required
    if (selectedTest === 'Compressive Test' || selectedTest === 'Shear Test') {
      return subType !== '';
    }
    
    return true;
  };

  const handleClose = () => {
    audio.play();
    setSelectedTest(null);
  };

  const determineTestSequence = () => {
    const sequence = [];
    if (includeMoisture) sequence.push('moistureTest');
    if (includeMeasurement) sequence.push('dimensionTest');
    sequence.push('mainTest'); // Strength test always last
    sequence.push('summary'); // Summary always at the end
    return sequence;
  };

  const handleBeginTest = () => {
    audio.play();
    
    console.log('Beginning test with:', {
      testType: selectedTest,
      subType,
      specimenName, // ✅ ADDED
      includeMeasurement,
      includeMoisture
    });
    
    // ✅ UPDATED: Initialize test data with specimen name
    setTestData({
      testType: selectedTest,
      subType: subType,
      specimenName: specimenName, // ✅ ADDED
      moistureData: null,
      measurementData: null,
      strengthData: null
    });
    
    const testSequence = determineTestSequence();
    setCurrentTestStage(testSequence[0]);
    setTestStarted(true);
    setSelectedTest(null);
  };

  // Move to next test
  const moveToNextTest = () => {
    const sequence = determineTestSequence();
    const currentIndex = sequence.indexOf(currentTestStage);
    
    if (currentIndex < sequence.length - 1) {
      setCurrentTestStage(sequence[currentIndex + 1]);
    }
  };

  // Move to previous test
  const moveToPreviousTest = () => {
    const sequence = determineTestSequence();
    const currentIndex = sequence.indexOf(currentTestStage);
    
    if (currentIndex > 0) {
      setCurrentTestStage(sequence[currentIndex - 1]);
    } else {
      // Return to test selection menu
      returnToMainPage();
    }
  };

  // Return to main selection screen
  const returnToMainPage = () => {
    setTestStarted(false);
    setSelectedTest(null);
    resetSelections();
  };

  // Handle test completion with data
  const handleMoistureComplete = (moistureReading) => {
    console.log('Moisture test completed:', moistureReading);
    setTestData(prev => ({
      ...prev,
      moistureData: moistureReading
    }));
    // Auto-advance to next test after short delay
    setTimeout(() => {
      moveToNextTest();
    }, 500);
  };

  const handleMeasurementComplete = (measurementResult) => {
    console.log('Measurement test completed:', measurementResult);
    setTestData(prev => ({
      ...prev,
      measurementData: measurementResult
    }));
    // Auto-advance to next test after short delay
    setTimeout(() => {
      moveToNextTest();
    }, 500);
  };

  const handleStrengthComplete = (strengthResult) => {
    console.log('Strength test completed:', strengthResult);
    setTestData(prev => ({
      ...prev,
      strengthData: strengthResult
    }));
    // Auto-advance to summary after short delay
    setTimeout(() => {
      moveToNextTest();
    }, 500);
  };

  // Retake handlers
  const handleRetakeMoisture = () => {
    setCurrentTestStage('moistureTest');
    setTestData(prev => ({ ...prev, moistureData: null }));
  };

  const handleRetakeMeasurement = () => {
    setCurrentTestStage('dimensionTest');
    setTestData(prev => ({ ...prev, measurementData: null }));
  };

  const handleRetakeStrength = () => {
    setCurrentTestStage('mainTest');
    setTestData(prev => ({ ...prev, strengthData: null }));
  };

  // Render appropriate test stage
  const renderTestStages = () => {
    switch(currentTestStage) {
      case 'moistureTest':
        return (
          <MoistureTestPage
            onTestComplete={handleMoistureComplete}
            onPreviousTest={moveToPreviousTest}
            onMainPageReturn={returnToMainPage}
          />
        );
      
      case 'dimensionTest':
        return (
          <DimensionMeasurementPage
            testType={testData.testType.split(' ')[0].toLowerCase()}
            onTestComplete={handleMeasurementComplete}
            onPreviousTest={moveToPreviousTest}
            onMainPageReturn={returnToMainPage}
          />
        );
      
      case 'mainTest':
        return (
          <KiloNewtonGauge
            testType={testData.testType.split(' ')[0].toLowerCase()}
            onTestComplete={handleStrengthComplete}
            onPreviousTest={moveToPreviousTest}
            onMainPageReturn={returnToMainPage}
          />
        );
      
      case 'summary':
        return (
          <TestSummary
            testData={testData}
            onRetakeMoisture={handleRetakeMoisture}
            onRetakeMeasurement={handleRetakeMeasurement}
            onRetakeStrength={handleRetakeStrength}
            onSaveAndFinish={returnToMainPage}
            onBackToMenu={returnToMainPage}
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
          <div className="flex items-stretch justify-center w-full max-w-4xl gap-4 h-96">
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

      {/* ✅ UPDATED MODAL: Now includes Specimen Name input */}
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

              <div className="p-6">
                {/* ✅ NEW: Specimen Name Input - ALWAYS FIRST */}
                <div className="mb-6 bg-blue-50 p-4 rounded-lg border-2 border-blue-300">
                  <label className="block text-lg font-semibold mb-2 text-blue-900">
                    Specimen Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={specimenName}
                    onChange={(e) => setSpecimenName(e.target.value)}
                    placeholder="e.g., Molave Sample 1, Narra A-1, etc."
                    className="w-full px-4 py-3 border-2 border-blue-300 rounded-lg focus:outline-none focus:border-blue-500 text-lg"
                    autoFocus
                  />
                  <p className="text-sm text-gray-600 mt-2">
                    Enter a unique name for this wood specimen (required for database)
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Test Type Selection */}
                  {['Compressive Test', 'Shear Test'].includes(selectedTest) && (
                    <div className="mb-6">
                      <h3 className="text-lg font-semibold mb-2">
                        Test Type <span className="text-red-500">*</span>
                      </h3>
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

                {/* ✅ NEW: Validation message */}
                {!isFormValid() && (
                  <div className="mt-4 bg-yellow-50 border border-yellow-300 rounded-lg p-3">
                    <p className="text-sm text-yellow-800">
                      {!specimenName.trim() && "⚠️ Specimen name is required"}
                      {specimenName.trim() && !subType && selectedTest !== 'Flexure Test' && "⚠️ Please select a test type"}
                    </p>
                  </div>
                )}
              </div>

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

// Radio option component
const RadioOption = ({ value, label, selectedValue, setValue }) => (
  <label className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-2 rounded">
    <input
      type="radio"
      name="subType"
      value={value}
      checked={selectedValue === value}
      onChange={() => setValue(value)}
      className="form-radio h-5 w-5"
    />
    <span className="text-base">{label}</span>
  </label>
);

// Checkbox option component
const CheckboxOption = ({ label, checked, setChecked, disabled = false }) => (
  <label className={`flex items-center space-x-2 ${disabled ? 'opacity-60' : 'cursor-pointer hover:bg-gray-50'} p-2 rounded`}>
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => setChecked && setChecked(e.target.checked)}
      className="form-checkbox h-5 w-5"
      disabled={disabled}
    />
    <span className="text-base">{label}</span>
  </label>
);

export default WoodTests;