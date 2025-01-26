import React, { useState } from 'react';

const KiloNewtonGauge = ({ testType }) => {
  const [kNValue, setKNValue] = useState(1600);

  const gaugeConfigs = {
    compressive: {
      max: 2000,
      warning: 1600,
      defaultValue: 0
    },
    shear: {
      max: 2000,
      warning: 1600,
      defaultValue: 0
    },
    flexure: {
      max: 2000,
      warning: 1600,
      defaultValue: 0
    }
  };

  const config = gaugeConfigs[testType?.toLowerCase()] || gaugeConfigs.compressive;
  const gaugeValue = Math.min(kNValue, config.max);
  
  // Calculate the percentage filled (0-100)
  const percentage = (gaugeValue / config.max) * 100;

  return (
    <div className="flex justify-center items-center">
      <div className="text-center p-3 sm:p-4 md:p-5 bg-gray-800 rounded-[30px] sm:rounded-[40px] md:rounded-[50px] shadow-lg">
        <div className="relative justify-center items-center w-[300px] sm:w-[400px] md:w-[500px] h-[150px] sm:h-[200px] md:h-[250px] 
                    overflow-hidden bg-gray-800 rounded-t-[300px] sm:rounded-t-[400px] md:rounded-t-[500px] mx-auto">
          <svg viewBox="0  -9 200 200" className="relative w-full h-full">
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
            
            {/* Blue progress arc */}
            <path
              d="M 40,170 A 90,90 0 1,1 160,170"
              fill="none"
              stroke="#3b82f6"
              strokeWidth="20"
              strokeDasharray="565"
              strokeDashoffset={565 - (percentage / 130) * 565}
              className="transition-all duration-300"
              strokeLinecap="round"
              strokeLinejoin="round"
              
            />

            {/* Gradient definition for zones */}
            <defs>
              <radialGradient id="zone-gradient" gradientUnits="userSpaceOnUse" cx="100" cy="100" r="100">
                <stop offset="60%" stopColor="#a4031f" />
                <stop offset="50%" stopColor="#a4031f" />
                <stop offset="100%" stopColor="#a4031f" />
              </radialGradient>
            </defs>
          </svg>
          <div className="absolute h-7 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 
                      text-gray-200 text-3xl sm:text-4xl md:text-2 font-sans">
            {kNValue} kN
          </div>
        </div>
        <div className="mt-3 sm:mt-4 md:mt-5 text-gray-400 text-base sm:text-lg md:text-xl">
          <p>Max: {config.max} kN</p>
          <p className="text-red-500">
            Damage Pressure: {config.warning} kN - {config.max} kN
          </p>
        </div>
      </div>
    </div>
  );
};

export default KiloNewtonGauge;