import React from 'react';

const Settings = ({ 
  onNavigateToMoistureSettings,
  onNavigateToMoistureTest,
  onNavigateToReferenceValues 
}) => {
  const handleButtonClick = (option) => {
    console.log(`${option} button clicked`);
    
    if (option === 'Moisture Calibration' && onNavigateToMoistureSettings) {
      onNavigateToMoistureSettings();
    } else if (option === 'Moisture Test' && onNavigateToMoistureTest) {
      onNavigateToMoistureTest();
    } else if (option === 'Reference Values' && onNavigateToReferenceValues) {
      onNavigateToReferenceValues();
    }
  };

  return (
    <div className="p-6 bg-white rounded-xl shadow-lg max-w-md mx-auto font-segoe-ui">
      <h1 className="text-2xl font-semibold mb-6 text-gray-800">Settings</h1>
      
      {/* Calibration Section */}
      <div className="mb-8">
        <h2 className="text-sm font-semibold text-gray-500 mb-2">Calibration</h2>
        
        {/* Reference Values */}
        <button 
          onClick={() => handleButtonClick('Reference Values')}
          className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 active:bg-gray-100 transition-colors mb-2"
        >
          <div className="flex items-center space-x-3">
            <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            <span className="text-gray-700 font-medium">Reference Values</span>
          </div>
          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>

        {/* Moisture Settings Button */}
        <button 
          onClick={() => handleButtonClick('Moisture Calibration')}
          className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 active:bg-gray-100 transition-colors mb-2"
        >
          <div className="flex items-center space-x-3">
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <span className="text-gray-700 font-medium">Moisture Settings</span>
          </div>
          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>

        {/* Moisture Test Button */}
        <button 
          onClick={() => handleButtonClick('Moisture Test')}
          className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 active:bg-gray-100 transition-colors mb-2"
        >
          <div className="flex items-center space-x-3">
            <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-gray-700 font-medium">Test Recognition</span>
          </div>
          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>

        <button 
          onClick={() => handleButtonClick('General Calibration')}
          className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 active:bg-gray-100 transition-colors"
        >
          <div className="flex items-center space-x-3">
            <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span className="text-gray-700">General Calibration</span>
          </div>
          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Connections Section */}
      <div className="mb-8">
        <h2 className="text-sm font-semibold text-gray-500 mb-2">Connections</h2>
        <div className="space-y-1">
          <button 
            onClick={() => handleButtonClick('Database Connection')}
            className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 active:bg-gray-100 transition-colors"
          >
            <div className="flex items-center space-x-3 ml-2">
              <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
              </svg>
              <span className="text-gray-700">Database Connection</span>
            </div>
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>

          <button 
            onClick={() => handleButtonClick('COM Port Connection')}
            className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 active:bg-gray-100 transition-colors"
          >
            <div className="flex items-center space-x-3 ml-2">
              <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <span className="text-gray-700">COM Port Connection</span>
            </div>
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Themes Section */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 mb-2">Personalization</h2>
        <button 
          onClick={() => handleButtonClick('Theme')}
          className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 active:bg-gray-100 transition-colors"
        >
          <div className="flex items-center space-x-3">
            <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <span className="text-gray-700">Themes</span>
          </div>
          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default Settings;