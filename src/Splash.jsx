import React from 'react';
import './Splash.css'; // Import the CSS file for styles

const Splash = ({ onComplete }) => {
  // Effect to trigger onComplete after 4 seconds
  React.useEffect(() => {
    const timer = setTimeout(() => {
      onComplete();
    }, 4000);
    return () => clearTimeout(timer); // Cleanup timer on unmount
  }, [onComplete]);

  return (
    <div className="fixed inset-0 overflow-hidden">
      <div className="splash-background" />
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-bounce mb-8">
            {/* Replace span with img for the logo */}
            <img src={"resources/Splash/TSULogo.png"} alt="TimberMach Logo" className="items-center w-28px h-38px" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-4">TimberMach</h1>
          <div className="animate-pulse">
            <p className="text-blue-400">Timber Testing Machine.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Splash;