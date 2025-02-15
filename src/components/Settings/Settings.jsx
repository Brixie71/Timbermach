import React from 'react';

const Settings = () => {
  const handleButtonClick = (option) => {
    console.log(`${option} button clicked`);
    // Add your logic here
  };

  return (
    <div className="p-6 bg-white rounded-xl shadow-lg max-w-md mx-auto font-segoe-ui">
      <h1 className="text-2xl font-semibold mb-6 text-gray-800">Settings</h1>
      
      {/* Calibration Section */}
      <div className="mb-8">
        <h2 className="text-sm font-semibold text-gray-500 mb-2">Calibration</h2>
        <button 
          onClick={() => handleButtonClick('Calibration')}
          className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 active:bg-gray-100 transition-colors"
        >
          <div className="flex items-center space-x-3">
            <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span className="text-gray-700">Calibration Settings</span>
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