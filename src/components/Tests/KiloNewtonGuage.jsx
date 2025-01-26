import React, { useState } from 'react';

const KiloNewtonGauge = ({ testType }) => {
  const [kNValue, setKNValue] = useState(1600);

  const gaugeConfigs = {
    compressive: {
      max: 2000,
      warning: 1600,
      defaultValue: 500
    },
    shear: {
      max: 2000,
      warning: 1600,
      defaultValue: 300
    },
    flexure: {
      max: 2000,
      warning: 1600,
      defaultValue: 500
    }
  };

  const config = gaugeConfigs[testType?.toLowerCase()] || gaugeConfigs.compressive;
  const gaugeValue = Math.min(kNValue, config.max);

  return (
    <div className="flex justify-center items-center min-h-[300px] sm:min-h-[400px] md:min-h-[500px] bg-gray-900">
      <div className="text-center p-3 sm:p-4 md:p-5 bg-gray-800 rounded-[30px] sm:rounded-[40px] md:rounded-[50px] shadow-lg">
        <div className="relative w-[200px] sm:w-[250px] md:w-[300px] h-[100px] sm:h-[125px] md:h-[150px] 
                      overflow-hidden bg-gray-800 rounded-t-[200px] sm:rounded-t-[250px] md:rounded-t-[300px] 
                      shadow-lg mx-auto">
          <svg viewBox="0 0 200 100" className="relative w-full h-full">
            <path
              d="M10,100 A90,90 0 0,1 190,100"
              fill="none"
              stroke="#4A5568"
              strokeWidth="20"  
            />
            <path
              d="M10,100 A90,90 0 0,1 190,100"
              fill="none"
              stroke={`url(#gauge-gradient)`}
              strokeWidth="20"
              strokeDasharray="565"
              strokeDashoffset={565 - (gaugeValue / (config.max * 2)) * 565}
            />
            <defs>
              <linearGradient id="gauge-gradient" gradientTransform="rotate(0)">
                <stop offset="0%" stopColor="green" />
                <stop offset="66.67%" stopColor="yellow" />
                <stop offset="100%" stopColor="red" />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute top-[70%] left-1/2 -translate-x-1/2 -translate-y-1/2 
                        text-gray-200 text-xl sm:text-2xl md:text-3xl font-sans">
            {kNValue} kN
          </div>
        </div>
        <div className="mt-2 sm:mt-3 md:mt-4 text-gray-400 text-sm sm:text-base md:text-lg">
          <p>Min: 0 KN | Max: {config.max} kN</p>
          <p className="text-red-500">
            Damage Pressure: {config.warning} kN - {config.max} kN
          </p>
        </div>
      </div>
    </div>
  );
};

export default KiloNewtonGauge;