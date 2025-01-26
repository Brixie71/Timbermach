import React from 'react';

const Splash = ({ onComplete }) => {
  React.useEffect(() => {
    const timer = setTimeout(() => {
      onComplete();
    }, 4000);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-gray-900">
      <div className="text-center">
        <div className="animate-bounce mb-8">
          <span className="text-6xl">🔬</span>
        </div>
        <h1 className="text-4xl font-bold text-white mb-4">TimberMach</h1>
        <div className="animate-pulse">
          <p className="text-blue-400">Timber Testing Maching.</p>
        </div>
      </div>
    </div>
  );
};

export default Splash;