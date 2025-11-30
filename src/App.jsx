import React, { useState } from 'react';
import { IoIosArrowForward, IoMdMenu, IoMdCog, IoMdPower } from "react-icons/io";
import Header from './components/Header/Header';
import WoodTests from './components/Tests/WoodTests';
import MoistureSettings from './components/Settings/MoistureSettings';
import MoistureDebug from './components/Settings/MoistureDebug';
import SevenSegmentCalibration from './components/Settings/SevenSegmentCalibration';
import Dash from './components/Dash/Dash';
import Settings from './components/Settings/Settings';
import './App.css';

function App() {
  const [isNavOpen, setIsNavOpen] = useState(false);
  const [activeItem, setActiveItem] = useState('dashboard');
  const [showPowerModal, setShowPowerModal] = useState(false);

  const toggleNav = () => {
    setIsNavOpen(!isNavOpen);
  };

  const closeNav = () => {
    setIsNavOpen(false);
  };

  const renderContent = () => {
    switch (activeItem) {
      case 'strength-test':
        return <WoodTests />;
      case 'settings':
        return (
          <Settings 
            onNavigateToMoistureSettings={() => setActiveItem('moisture-settings')}
            onNavigateToMoistureTest={() => setActiveItem('moisture-debug')}
          />
        );
      case 'moisture-settings':
        return (
          <MoistureSettings
            onBack={() => setActiveItem('settings')}
            onEditCalibration={() => setActiveItem('calibration')}
          />
        );
      case 'moisture-debug':
        return (
          <div>
            <button 
              onClick={() => setActiveItem('settings')}
              className="mb-4 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 flex items-center gap-2"
            >
              ← Back to Settings
            </button>
            <MoistureDebug />
          </div>
        );
      case 'calibration':
        return (
          <SevenSegmentCalibration
            onComplete={() => setActiveItem('moisture-settings')}
            onCancel={() => setActiveItem('moisture-settings')}
          />
        );
      default:
        return <Dash />;
    }
  };

  const getPageTitle = () => {
    switch (activeItem) {
      case 'strength-test':
        return 'Strength Test';
      case 'settings':
        return 'Settings';
      case 'moisture-settings':
        return 'Moisture Settings';
      case 'moisture-debug':
        return 'Moisture Debug Tool';
      case 'calibration':
        return 'Calibration';
      default:
        return 'Dashboard';
    }
  };

  return (
    <div className="font-sans relative overflow-hidden">
      {/* Sidebar Overlay */}
      {isNavOpen && (
        <div
          className="fixed inset-0 z-40 bg-transparent"
          onClick={closeNav}
          style={{ cursor: 'default' }}
        />
      )}

      {/* Top Bar */}
      <div className="flex items-center px-3 sm:px-5 py-1.5 bg-gray-800 fixed top-0 left-0 right-0 z-50">
        <button
          className="bg-transparent border-none text-gray-200 text-2xl cursor-pointer p-1.5 
                     hover:text-blue-400 transition-colors duration-300"
          onClick={toggleNav}
        >
          <IoMdMenu />
        </button>
        <Header />
        <span className="ml-4 text-gray-100 text-lg font-semibold">
          | {getPageTitle()}
        </span>
        <button
          className="bg-transparent border-none text-gray-200 text-2xl cursor-pointer p-1.5 ml-auto
                     hover:text-red-500 transition-colors duration-300"
          onClick={() => setShowPowerModal(true)}
        >
          <IoMdPower />
        </button>
      </div>

      {/* Sidebar */}
      <div
            className={`fixed top-0 h-full w-64 bg-gray-800/70 backdrop-blur-sm text-gray-200 shadow-lg 
              transform transition-transform duration-300 z-50 
              ${isNavOpen ? 'translate-x-0' : '-translate-x-64'}`}
          >
            <div className="flex items-center justify-between p-4 bg-gray-900/80 border-b border-gray-600">
              <span className="text-gray-200 text-xl font-bold">Options</span>
              <button
                className="text-white text-2xl p-2 rounded-full hover:text-blue-400 transform transition-transform duration-300"
                aria-label="Toggle Navigation"
                onClick={toggleNav}
              >
                <IoIosArrowForward className={`${isNavOpen ? 'rotate-180' : ''}`} />
              </button>
            </div>
            <nav>
              <ul className="list-none p-5 m-0 space-y-4">
                <li>
                  <a
                    href="#dashboard"
                    className={`flex items-center p-2 rounded-lg transition-all duration-300 
                      hover:bg-gray-700/50 hover:text-blue-400 
                      ${activeItem === 'dashboard' ? 'text-blue-400 bg-gray-700/30' : 'text-gray-200'}`}
                    onClick={() => setActiveItem('dashboard')}
                  >
                    <span className="mr-3 text-xl">📊</span>
                    Dashboard
                  </a>
                </li>
                <li>
                  <a
                    href="#strength-test"
                    className={`flex items-center p-2 rounded-lg transition-all duration-300 
                      hover:bg-gray-700/50 hover:text-blue-400 
                      ${activeItem === 'strength-test' ? 'text-blue-400 bg-gray-700/30' : 'text-gray-200'}`}
                    onClick={() => setActiveItem('strength-test')}
                  >
                    <span className="mr-3 text-xl">🔬</span>
                    Strength Test
                  </a>
                </li>
                <li>
                  <a
                    href="#settings"
                    className={`flex items-center p-2 rounded-lg transition-all duration-300 
                      hover:bg-gray-700/50 hover:text-blue-400 
                      ${activeItem === 'settings' ? 'text-blue-400 bg-gray-700/30' : 'text-gray-200'}`}
                    onClick={() => setActiveItem('settings')}
                  >
                    <IoMdCog className="mr-3 text-xl" />
                    Settings
                  </a>
                </li>
              </ul>
            </nav>
          </div>

      {/* Main Content */}
      <div className={`mt-[60px] p-3 sm:p-5 max-w-7xl mx-auto`}>
        {renderContent()}
      </div>

      {/* Power Off Modal */}
      {showPowerModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100]">
          <div className="bg-white rounded-lg p-6 shadow-xl max-w-sm w-full mx-4">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">Power Off</h3>
            <p className="text-gray-600 mb-6">Are you sure you want to close the app?</p>
            <div className="flex justify-end space-x-3">
              <button
                className="px-4 py-2 text-gray-500 hover:text-gray-700 font-medium rounded-md"
                onClick={() => setShowPowerModal(false)}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 bg-red-500 text-white font-medium rounded-md hover:bg-red-600 transition-colors duration-300"
                onClick={() => window.close()}
              >
                Power Off
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;