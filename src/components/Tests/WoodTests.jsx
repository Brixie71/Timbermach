import React, { useState } from 'react';
import './WoodTests.css';
import { useTouchControls } from '../../Utils/TouchControls';
import KiloNewtonGauge from './KiloNewtonGuage';
import MoistureTestPage from './MoistureTest';
import DimensionMeasurementPage from './Measurement';
import TestSummary from './TestSummary';

const WoodTests = ({ darkMode = false }) => {
  // State management
  const [selectedTest, setSelectedTest] = useState(null);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [subType, setSubType] = useState('');
  const [specimenName, setSpecimenName] = useState('');
  const [includeMeasurement, setIncludeMeasurement] = useState(false);
  const [includeMoisture, setIncludeMoisture] = useState(false);
  const [audio] = useState(new Audio('Sounds/UI/button_press_Beep.mp3'));
  const [testStarted, setTestStarted] = useState(false);
  const [currentTestStage, setCurrentTestStage] = useState('selection');
  
  // Test data storage
  const [testData, setTestData] = useState({
    testType: '',
    subType: '',
    specimenName: '',
    moistureData: null,
    measurementData: null,
    strengthData: null
  });

  // Updated with correct image paths from your code
  const tests = [
    { title: 'COMPRESSIVE TEST', image: 'Cards/Strength Test/Compressive_Card.png' },
    { title: 'SHEAR TEST', image: 'Cards/Strength Test/Shear_Card.png' },
    { title: 'FLEXURE TEST', image: 'Cards/Strength Test/Flexure_Card.png' }
  ];

  // Add touch controls for swiping
  useTouchControls({
    onSwipeLeft: () => {
      if (!selectedTest) {
        goToNextCard();
      }
    },
    onSwipeRight: () => {
      if (!selectedTest) {
        goToPreviousCard();
      }
    },
    swipeThreshold: 50,
  });

  // Navigation functions - NO LOOPS
  const goToPreviousCard = () => {
    if (currentCardIndex > 0) {
      audio.play();
      setCurrentCardIndex(prev => prev - 1);
    }
  };

  const goToNextCard = () => {
    if (currentCardIndex < tests.length - 1) {
      audio.play();
      setCurrentCardIndex(prev => prev + 1);
    }
  };

  const handleTestClick = (title) => {
    audio.play();
    setSelectedTest(title);
    resetSelections();
  };

  const resetSelections = () => {
    setSubType('');
    setSpecimenName('');
    setIncludeMeasurement(false);
    setIncludeMoisture(false);
    setCurrentTestStage('selection');
    setTestData({
      testType: '',
      subType: '',
      specimenName: '',
      moistureData: null,
      measurementData: null,
      strengthData: null
    });
  };

  const isFormValid = () => {
    if (!specimenName || specimenName.trim() === '') {
      return false;
    }
    
    if (selectedTest === 'COMPRESSIVE TEST' || selectedTest === 'SHEAR TEST') {
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
    sequence.push('mainTest');
    sequence.push('summary');
    return sequence;
  };

  const handleBeginTest = () => {
    audio.play();
    
    if (!isFormValid()) {
      alert('Please fill in all required fields before starting the test.');
      return;
    }
    
    setTestData(prev => ({
      ...prev,
      testType: selectedTest,
      subType: subType,
      specimenName: specimenName
    }));
    
    setTestStarted(true);
    
    const sequence = determineTestSequence();
    if (sequence.length > 0) {
      setCurrentTestStage(sequence[0]);
    }
  };

  const handleMoistureComplete = (data) => {
    setTestData(prev => ({
      ...prev,
      moistureData: data
    }));
    
    const sequence = determineTestSequence();
    const currentIndex = sequence.indexOf('moistureTest');
    if (currentIndex !== -1 && currentIndex + 1 < sequence.length) {
      setCurrentTestStage(sequence[currentIndex + 1]);
    }
  };

  const handleMeasurementComplete = (data) => {
    setTestData(prev => ({
      ...prev,
      measurementData: data
    }));
    
    const sequence = determineTestSequence();
    const currentIndex = sequence.indexOf('dimensionTest');
    if (currentIndex !== -1 && currentIndex + 1 < sequence.length) {
      setCurrentTestStage(sequence[currentIndex + 1]);
    }
  };

  const handleTestComplete = (data) => {
    setTestData(prev => ({
      ...prev,
      strengthData: data
    }));
    
    setCurrentTestStage('summary');
  };

  const handleSummaryComplete = () => {
    setTestStarted(false);
    setSelectedTest(null);
    resetSelections();
  };

  // Render test stages
  if (testStarted) {
    if (currentTestStage === 'moistureTest') {
      return (
        <MoistureTestPage
          onComplete={handleMoistureComplete}
          specimenName={specimenName}
        />
      );
    }
    
    if (currentTestStage === 'dimensionTest') {
      return (
        <DimensionMeasurementPage
          onComplete={handleMeasurementComplete}
          specimenName={specimenName}
          testType={selectedTest}
        />
      );
    }
    
    if (currentTestStage === 'mainTest') {
      return (
        <KiloNewtonGauge
          testType={selectedTest}
          subType={subType}
          specimenName={specimenName}
          moistureData={testData.moistureData}
          measurementData={testData.measurementData}
          onTestComplete={handleTestComplete}
        />
      );
    }
    
    if (currentTestStage === 'summary') {
      return (
        <TestSummary
          testData={testData}
          onComplete={handleSummaryComplete}
        />
      );
    }
  }

  // Main selection UI
  if (!selectedTest) {
    return (
      <div className={`flex flex-col h-full ${darkMode ? 'bg-gray-900' : 'bg-white'}`}>
        {/* Card Container - Centered, Full Width */}
        <div className="flex-1 flex items-center justify-center px-12">
          <div 
            onClick={() => handleTestClick(tests[currentCardIndex].title)}
            className={`w-full max-w-4xl border-2 cursor-pointer hover:shadow-xl transition-shadow flex flex-col ${
              darkMode 
                ? 'border-gray-600 bg-gray-800 hover:shadow-gray-700' 
                : 'border-black bg-gray-200'
            }`}
            style={{ height: '420px' }}
          >
            {/* Image Area - Top Part */}
            <div className={`flex-1 flex items-center justify-center overflow-hidden ${
              darkMode ? 'bg-gray-800' : 'bg-gray-200'
            }`}>
              <img 
                src={tests[currentCardIndex].image} 
                alt={tests[currentCardIndex].title}
                className="w-full h-full object-cover"
                onError={(e) => {
                  console.error('Image failed to load:', tests[currentCardIndex].image);
                  // Keep the gray background as fallback
                }}
              />
            </div>
            
            {/* Label - Bottom Part */}
            <div className={`h-[80px] border-t-2 flex items-center justify-center ${
              darkMode 
                ? 'bg-gray-700 border-gray-600 text-gray-100' 
                : 'bg-gray-300 border-black text-gray-900'
            }`}>
              <h2 className="text-3xl font-bold tracking-wide">
                {tests[currentCardIndex].title}
              </h2>
            </div>
          </div>
        </div>

        {/* Navigation Dots - Below Card */}
        <div className="flex items-center justify-center gap-3 pb-8">
          {tests.map((_, index) => (
            <button
              key={index}
              onClick={() => {
                if (index !== currentCardIndex) {
                  audio.play();
                  setCurrentCardIndex(index);
                }
              }}
              className={`w-4 h-4 rounded-full transition-all border-2 ${
                darkMode
                  ? index === currentCardIndex
                    ? 'bg-blue-400 border-blue-400'
                    : 'bg-gray-700 border-gray-600 hover:bg-gray-600'
                  : index === currentCardIndex
                    ? 'bg-gray-400 border-gray-400'
                    : 'bg-white border-gray-400 hover:bg-gray-200'
              }`}
              aria-label={`Go to ${tests[index].title}`}
            />
          ))}
        </div>
      </div>
    );
  }

  // Test configuration screen
  return (
    <div className={`flex flex-col h-full ${darkMode ? 'bg-gray-900' : 'bg-white'}`}>
      {/* Header */}
      <div className={`flex items-center justify-between px-6 py-4 border-b-2 ${
        darkMode 
          ? 'border-gray-700 bg-gray-800 text-gray-100' 
          : 'border-black bg-gray-100 text-gray-900'
      }`}>
        <h2 className="text-xl font-bold">{selectedTest}</h2>
        <button
          onClick={handleClose}
          className={`text-3xl font-bold transition-colors ${
            darkMode 
              ? 'text-gray-200 hover:text-red-400' 
              : 'text-gray-900 hover:text-red-600'
          }`}
        >
          ×
        </button>
      </div>

      {/* Configuration Form */}
      <div className="flex-1 overflow-y-auto">
        <div className="h-full space-y-0">
          {/* Specimen Name Input */}
          <div className="border-b-2 border-gray-300 p-6">
            <label className={`block text-sm font-semibold mb-2 ${
              darkMode ? 'text-gray-300' : 'text-gray-900'
            }`}>
              Specimen Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={specimenName}
              onChange={(e) => setSpecimenName(e.target.value)}
              placeholder="Enter specimen name"
              className={`w-full px-4 py-3 border-2 focus:outline-none ${
                darkMode
                  ? 'bg-gray-800 border-gray-600 text-gray-100 placeholder-gray-500 focus:border-blue-400'
                  : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-blue-500'
              }`}
            />
          </div>

          {/* Sub-type Selection */}
          {(selectedTest === 'COMPRESSIVE TEST' || selectedTest === 'SHEAR TEST') && (
            <div className="border-b-2 border-gray-300">
              <label className={`block text-sm font-semibold px-6 pt-6 pb-4 ${
                darkMode ? 'text-gray-300' : 'text-gray-900'
              }`}>
                Test Sub-type <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2">
                {selectedTest === 'COMPRESSIVE TEST' ? (
                  <>
                    <button
                      onClick={() => { audio.play(); setSubType('Parallel'); }}
                      className={`py-8 px-6 text-xl font-semibold transition-all border-r-2 ${
                        subType === 'Parallel'
                          ? darkMode
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-blue-500 text-white border-blue-500'
                          : darkMode
                            ? 'bg-gray-800 border-gray-600 text-gray-200 hover:bg-gray-700'
                            : 'bg-white border-gray-300 text-gray-900 hover:bg-gray-100'
                      }`}
                    >
                      Parallel to Grain
                    </button>
                    <button
                      onClick={() => { audio.play(); setSubType('Perpendicular'); }}
                      className={`py-8 px-6 text-xl font-semibold transition-all ${
                        subType === 'Perpendicular'
                          ? darkMode
                            ? 'bg-blue-600 text-white'
                            : 'bg-blue-500 text-white'
                          : darkMode
                            ? 'bg-gray-800 text-gray-200 hover:bg-gray-700'
                            : 'bg-white text-gray-900 hover:bg-gray-100'
                      }`}
                    >
                      Perpendicular to Grain
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => { audio.play(); setSubType('Single'); }}
                      className={`py-8 px-6 text-xl font-semibold transition-all border-r-2 ${
                        subType === 'Single'
                          ? darkMode
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-blue-500 text-white border-blue-500'
                          : darkMode
                            ? 'bg-gray-800 border-gray-600 text-gray-200 hover:bg-gray-700'
                            : 'bg-white border-gray-300 text-gray-900 hover:bg-gray-100'
                      }`}
                    >
                      Single Shear
                    </button>
                    <button
                      onClick={() => { audio.play(); setSubType('Double'); }}
                      className={`py-8 px-6 text-xl font-semibold transition-all ${
                        subType === 'Double'
                          ? darkMode
                            ? 'bg-blue-600 text-white'
                            : 'bg-blue-500 text-white'
                          : darkMode
                            ? 'bg-gray-800 text-gray-200 hover:bg-gray-700'
                            : 'bg-white text-gray-900 hover:bg-gray-100'
                      }`}
                    >
                      Double Shear
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Optional Tests */}
          <div className="flex-1 border-b-2 border-gray-300">
            <label className={`block text-sm font-semibold px-6 pt-6 pb-4 ${
              darkMode ? 'text-gray-300' : 'text-gray-900'
            }`}>
              Test Procedure
            </label>
            <div className="flex flex-col">
              <label className={`flex items-center gap-4 px-6 py-6 border-b-2 cursor-pointer transition-colors ${
                darkMode
                  ? 'border-gray-600 bg-gray-800 hover:bg-gray-700'
                  : 'border-gray-300 bg-white hover:bg-gray-50'
              } ${includeMoisture ? (darkMode ? 'bg-blue-900' : 'bg-blue-100') : ''}`}>
                <input
                  type="checkbox"
                  checked={includeMoisture}
                  onChange={(e) => { audio.play(); setIncludeMoisture(e.target.checked); }}
                  className="w-6 h-6"
                />
                <span className={`font-medium text-lg ${
                  darkMode ? 'text-gray-200' : 'text-gray-900'
                }`}>
                  Moisture Test
                </span>
              </label>
              <label className={`flex items-center gap-4 px-6 py-6 border-b-2 cursor-pointer transition-colors ${
                darkMode
                  ? 'border-gray-600 bg-gray-800 hover:bg-gray-700'
                  : 'border-gray-300 bg-white hover:bg-gray-50'
              } ${includeMeasurement ? (darkMode ? 'bg-blue-900' : 'bg-blue-100') : ''}`}>
                <input
                  type="checkbox"
                  checked={includeMeasurement}
                  onChange={(e) => { audio.play(); setIncludeMeasurement(e.target.checked); }}
                  className="w-6 h-6"
                />
                <span className={`font-medium text-lg ${
                  darkMode ? 'text-gray-200' : 'text-gray-900'
                }`}>
                  Measurement Test
                </span>
              </label>
              <div className={`flex items-center gap-4 px-6 py-6 ${
                darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-700'
              }`}>
                <span className="font-medium text-lg">
                  Strength Test
                </span>
              </div>
            </div>
          </div>

          {/* Begin Test Button - Fixed at bottom */}
          <button
            onClick={handleBeginTest}
            disabled={!isFormValid()}
            className={`w-full py-8 text-2xl font-bold transition-all ${
              isFormValid()
                ? 'bg-green-500 text-white hover:bg-green-600 active:scale-[0.99]'
                : darkMode
                  ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            START
          </button>
        </div>
      </div>
    </div>
  );
};

export default WoodTests;