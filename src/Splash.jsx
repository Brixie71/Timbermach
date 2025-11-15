import React from 'react';
import './Splash.css'; // Import the CSS file for styles
import TSULogo from '/Splash/TSULogo.png';

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
        <div className="splash-content text-center">
          <div className="mb-8">
            {/* Logo with custom class instead of animate-pulse */}
            <img 
              src={TSULogo} 
              alt="TimberMach Logo" 
              className="splash-logo" 
            />
          </div>
          <h1 className="splash-title">TimberMach</h1>
          {/* Removed the "Timber Testing Machine" subtitle */}
        </div>
      </div>
    </div>
  );
};

export default Splash;