import React from 'react';

const Settings = ({ 
  onNavigateToMoistureSettings,
  onNavigateToMoistureTest,
  onNavigateToReferenceValues,
  onNavigateToActuatorControl,
  onNavigateToActuatorCalibration  // Add this new prop
}) => {
  const handleButtonClick = (option) => {
    console.log(`${option} button clicked`);
    
    if (option === 'Moisture Calibration' && onNavigateToMoistureSettings) {
      onNavigateToMoistureSettings();
    } else if (option === 'Moisture Test' && onNavigateToMoistureTest) {
      onNavigateToMoistureTest();
    } else if (option === 'Reference Values' && onNavigateToReferenceValues) {
      onNavigateToReferenceValues();
    } else if (option === 'Actuator Control' && onNavigateToActuatorControl) {
      onNavigateToActuatorControl();
    } else if (option === 'Actuator Calibration' && onNavigateToActuatorCalibration) {
      onNavigateToActuatorCalibration();
    }
  };

  const calibrationOptions = [
    {
      id: 'reference-values',
      label: 'Reference Values',
      description: 'Manage wood species reference data',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      ),
      gradient: 'from-purple-600 to-purple-400',
      action: 'Reference Values'
    },
    {
      id: 'moisture-settings',
      label: 'Moisture Settings',
      description: 'Calibrate 7-segment display',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
      gradient: 'from-blue-600 to-blue-400',
      action: 'Moisture Calibration'
    },
    {
      id: 'moisture-test',
      label: 'Test Recognition',
      description: 'Test moisture meter reading',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      gradient: 'from-green-600 to-green-400',
      action: 'Moisture Test'
    },
    {
      id: 'actuator-calibration',
      label: 'Actuator Calibration',
      description: 'Set midpoint and travel limits',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
        </svg>
      ),
      gradient: 'from-indigo-600 to-indigo-400',
      action: 'Actuator Calibration'
    },
    {
      id: 'actuator-control',
      label: 'Actuator Control',
      description: 'Manual linear actuator control',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
        </svg>
      ),
      gradient: 'from-orange-600 to-orange-400',
      action: 'Actuator Control'
    }
  ];

  const SettingCard = ({ option }) => (
    <button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        handleButtonClick(option.action);
      }}
      className="group relative w-full bg-gray-800 bg-opacity-50 backdrop-blur-sm border border-gray-700 rounded-xl p-6 hover:bg-opacity-70 transition-all duration-300 hover:scale-105 hover:shadow-2xl"
      style={{
        boxShadow: '0 0 20px rgba(0, 0, 0, 0.5)'
      }}
    >
      {/* Gradient glow on hover */}
      <div className={`absolute inset-0 rounded-xl bg-gradient-to-r ${option.gradient} opacity-0 group-hover:opacity-20 blur-xl transition-opacity duration-300`}></div>
      
      {/* Content */}
      <div className="relative z-10 flex items-center gap-4">
        {/* Icon container with gradient */}
        <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${option.gradient} flex items-center justify-center flex-shrink-0 shadow-lg`}>
          <div className="text-white">
            {option.icon}
          </div>
        </div>
        
        {/* Text content */}
        <div className="flex-grow text-left">
          <h3 className="text-lg font-bold text-white mb-1">{option.label}</h3>
          <p className="text-sm text-gray-400">{option.description}</p>
        </div>
        
        {/* Arrow */}
        <div className="text-gray-500 group-hover:text-white transition-colors flex-shrink-0">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>
    </button>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-12 text-center">
          <h1 className="text-5xl font-bold text-white mb-4 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            Settings
          </h1>
          <p className="text-gray-400 text-lg">Configure your TimberMach system</p>
        </div>

        {/* Calibration Section */}
        <div className="mb-12">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {calibrationOptions.map(option => (
              <SettingCard key={option.id} option={option} />
            ))}
          </div>
        </div>

        {/* Info Card */}
        <div className="mt-12 bg-blue-900 bg-opacity-30 backdrop-blur-sm border border-blue-700 rounded-xl p-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-bold text-blue-300 mb-2">Need Help?</h3>
              <p className="text-blue-200 text-sm leading-relaxed">
                For assistance with calibration or connection setup, please refer to the user manual or contact technical support.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;