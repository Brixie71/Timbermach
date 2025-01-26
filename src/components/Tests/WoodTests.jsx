import React from 'react';
import './WoodTests.css'; // Import custom CSS for scrollbar styling

const WoodTests = () => {
  const tests = [
    { title: 'Compressive Test', image: 'resources/Cards/Strength Test/Card_Default.png' },
    { title: 'Shear Test', image: 'resources/Cards/Strength Test/Card_Default.png' },
    { title: 'Flexure Test', image: 'resources/Cards/Strength Test/Card_Default.png' },
    { title: 'Moisture Test', image: 'resources/Cards/Strength Test/Card_Default.png' },
    { title: 'Measure Dimension', image: 'resources/Cards/Strength Test/Card_Default.png' }
  ];

  return (
    <div>
      <div className="flex gap-3 overflow-x-auto no-scrollbar m-1 p-1">
        {tests.map(({ title, image }) => (
          <button
            key={title}
            className="bg-white rounded-lg shadow-md hover:shadow-lg 
                     transition-all duration-300 ease-in-out
                     transform hover:-translate-y-1
                     border border-gray-400 flex-shrink-0 w-60 overflow-hidden"
          >
            <div>
              <img 
                src={image} 
                alt={title}
                className="w-full h-full object-cover border-b border-gray-400 rounded-lg"
              />
              <div className="p-6">
                <h3 className="text-xl font-semibold text-black ">{title}</h3>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default WoodTests;
