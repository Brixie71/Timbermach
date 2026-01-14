import React, { useEffect, useState } from "react";
import {
  IoIosArrowForward,
  IoMdMenu,
  IoMdCog,
  IoMdPower,
  IoMdRefresh,
} from "react-icons/io";
import GlobalKeyboardProvider from "./components/GlobalKeyboardProvider";
import WoodTests from "./components/Tests/WoodTests";
import MoistureSettings from "./components/Settings/MoistureSettings";
import MoistureDebug from "./components/Settings/MoistureDebug";
import SevenSegmentCalibration from "./components/Settings/SevenSegmentCalibration";
import ReferenceValues from "./components/Settings/ReferenceValues/ReferenceValues";
import ActuatorControl from "./components/Settings/ActuatorControl";
import ActuatorCalibration from "./components/Settings/ActuatorCalibration";
import Dash from "./components/Dash/Dash";
import Settings from "./components/Settings/Settings";
import "./App.css";

function App() {
  const THEME_KEY = "timbermach:darkMode";
  const getInitialDarkMode = () => {
    try {
      const stored = localStorage.getItem(THEME_KEY);
      if (stored === "1" || stored === "true") return true;
      if (stored === "0" || stored === "false") return false;
    } catch {}

    return window.matchMedia?.("(prefers-color-scheme: dark)").matches || false;
  };

  const [isNavOpen, setIsNavOpen] = useState(false);
  const [activeItem, setActiveItem] = useState("dashboard");
  const [showPowerModal, setShowPowerModal] = useState(false);
  const [darkMode, setDarkMode] = useState(getInitialDarkMode);

  useEffect(() => {
    try {
      localStorage.setItem(THEME_KEY, darkMode ? "1" : "0");
    } catch {}
  }, [darkMode]);

  const toggleNav = () => {
    setIsNavOpen(!isNavOpen);
  };

  const closeNav = () => {
    setIsNavOpen(false);
  };

  // Explicitly define navigation handlers
  const handleNavigateToMoistureSettings = () => {
    console.log("App: Navigating to moisture-settings");
    setActiveItem("moisture-settings");
  };

  const handleNavigateToMoistureTest = () => {
    console.log("App: Navigating to moisture-debug");
    setActiveItem("moisture-debug");
  };

  const handleNavigateToReferenceValues = () => {
    console.log("App: Navigating to reference-values");
    setActiveItem("reference-values");
  };

  const handleNavigateToActuatorControl = () => {
    console.log("App: Navigating to actuator-control");
    setActiveItem("actuator-control");
  };

  const handleNavigateToActuatorCalibration = () => {
    console.log("App: Navigating to actuator-calibration");
    setActiveItem("actuator-calibration");
  };

  const renderContent = () => {
    console.log("App: Rendering content for activeItem:", activeItem);

    switch (activeItem) {
      case "strength-test":
        return <WoodTests darkMode={darkMode} />;

      case "settings":
        return (
          <Settings
            darkMode={darkMode} // ← Add if missing!
            onNavigateToMoistureSettings={handleNavigateToMoistureSettings}
            onNavigateToMoistureTest={handleNavigateToMoistureTest}
            onNavigateToReferenceValues={handleNavigateToReferenceValues}
            onNavigateToActuatorControl={handleNavigateToActuatorControl}
            onNavigateToActuatorCalibration={
              handleNavigateToActuatorCalibration
            }
          />
        );

      case "moisture-settings":
        return (
          <MoistureSettings
            onBack={() => setActiveItem("settings")}
            onEditCalibration={() => setActiveItem("calibration")}
          />
        );

      case "moisture-debug":
        return (
          <div>
            <button
              onClick={() => setActiveItem("settings")}
              className={`mb-4 px-4 py-2 rounded-lg flex items-center gap-2 ${
                darkMode
                  ? "bg-gray-600 text-white hover:bg-gray-500"
                  : "bg-gray-700 text-white hover:bg-gray-600"
              }`}
            >
              ← Back to Settings
            </button>
            <MoistureDebug />
          </div>
        );

      case "calibration":
        return (
          <SevenSegmentCalibration
            onComplete={() => setActiveItem("moisture-settings")}
            onCancel={() => setActiveItem("moisture-settings")}
          />
        );

      case "reference-values":
        return <ReferenceValues darkMode={darkMode} />;

      case "actuator-control":
        console.log("App: Rendering ActuatorControl");
        return (
          <div>
            <button
              onClick={() => setActiveItem("settings")}
              className={`mb-4 px-4 py-2 rounded-lg flex items-center gap-2 ${
                darkMode
                  ? "bg-gray-600 text-white hover:bg-gray-500"
                  : "bg-gray-700 text-white hover:bg-gray-600"
              }`}
            >
              ← Back to Settings
            </button>
            <ActuatorControl />
          </div>
        );

      case "actuator-calibration":
        console.log("App: Rendering ActuatorCalibration");
        return <ActuatorCalibration onBack={() => setActiveItem("settings")} />;

      default:
        return <Dash darkMode={darkMode} />;
    }
  };

  const getPageTitle = () => {
    switch (activeItem) {
      case "strength-test":
        return "Strength Test";
      case "settings":
        return "Settings";
      case "moisture-settings":
        return "Moisture Settings";
      case "moisture-debug":
        return "Moisture Debug Tool";
      case "calibration":
        return "Calibration";
      case "reference-values":
        return "Reference Values";
      case "actuator-control":
        return "Actuator Control";
      case "actuator-calibration":
        return "Actuator Calibration";
      default:
        return "Dashboard";
    }
  };

  return (
    <GlobalKeyboardProvider darkMode={darkMode}>
      <div
        className={` relative ${darkMode ? "bg-gray-900" : "bg-gray-50"}`}
        style={{ width: "100vw", height: "100vh" }}
      >
        {/* Sidebar Overlay */}
        {isNavOpen && (
          <div
            className="fixed inset-0 z-40 bg-black bg-opacity-50"
            onClick={closeNav}
          />
        )}

        {/* Top Bar - Clean White/Dark Header */}
        <div
          className={`flex items-center px-4 py-3 border-b-2 fixed top-0 left-0 right-0 z-50 ${
            darkMode
              ? "bg-gray-800 border-gray-700"
              : "bg-gray-50 border-gray-300"
          }`}
          style={{ height: "60px" }}
        >
          <button
            className={`bg-transparent border-none text-2xl cursor-pointer p-1 transition-colors duration-300 ${
              darkMode
                ? "text-gray-200 hover:text-blue-400"
                : "text-gray-800 hover:text-blue-600"
            }`}
            onClick={toggleNav}
          >
            <IoMdMenu />
          </button>
          <h1
            className={`ml-3 text-base font-semibold m-0 ${
              darkMode ? "text-gray-100" : "text-gray-800"
            }`}
          >
            Timber Test Management System
          </h1>
          <div className="ml-auto flex items-center gap-2">
            <button
              className={`bg-transparent border-none text-2xl cursor-pointer p-1 transition-colors duration-300 ${
                darkMode
                  ? "text-gray-200 hover:text-yellow-400"
                  : "text-gray-800 hover:text-yellow-600"
              }`}
              onClick={() => setDarkMode(!darkMode)}
              title={darkMode ? "Light Mode" : "Dark Mode"}
            >
              {darkMode ? (
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
                  />
                </svg>
              ) : (
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
                  />
                </svg>
              )}
            </button>
            <button
              className={`bg-transparent border-none text-2xl cursor-pointer p-1 transition-colors duration-300 ${
                darkMode
                  ? "text-gray-200 hover:text-red-500"
                  : "text-gray-800 hover:text-red-600"
              }`}
              onClick={() => setShowPowerModal(true)}
            >
              <IoMdPower />
            </button>
          </div>
        </div>

        {/* Sidebar */}
        <div
          className={`fixed top-0 h-full w-64 shadow-2xl
            transform transition-transform duration-300 z-50 border-r-2 ${
              darkMode
                ? "bg-gray-800 text-gray-100 border-gray-700"
                : "bg-gray-50 text-gray-800 border-gray-300"
            } ${isNavOpen ? "translate-x-0" : "-translate-x-64"}`}
        >
          <div
            className={`flex items-center justify-between p-4 border-b-2 ${
              darkMode
                ? "bg-gray-900 border-gray-700"
                : "bg-gray-100 border-gray-300"
            }`}
          >
            <span
              className={`text-xl font-bold ${darkMode ? "text-gray-100" : "text-gray-800"}`}
            >
              Menu
            </span>
            <button
              className={`text-2xl p-2 rounded-full transform transition-transform duration-300 ${
                darkMode
                  ? "text-gray-100 hover:text-blue-400"
                  : "text-gray-800 hover:text-blue-600"
              }`}
              aria-label="Toggle Navigation"
              onClick={toggleNav}
            >
              <IoIosArrowForward
                className={`${isNavOpen ? "rotate-180" : ""}`}
              />
            </button>
          </div>
          <nav>
            <ul className="list-none p-0 m-0">
              <li>
                <a
                  href="#dashboard"
                  className={`flex items-center px-6 py-4 transition-all duration-300 border-b ${
                    darkMode ? "border-gray-700" : "border-gray-200"
                  } ${
                    activeItem === "dashboard"
                      ? darkMode
                        ? "text-blue-400 bg-gray-700 font-semibold"
                        : "text-blue-600 bg-blue-50 font-semibold"
                      : darkMode
                        ? "text-gray-100 hover:bg-gray-700"
                        : "text-gray-800 hover:bg-gray-100"
                  }`}
                  onClick={() => {
                    setActiveItem("dashboard");
                    closeNav();
                  }}
                >
                  <span className="mr-3 text-xl">📊</span>
                  Dashboard
                </a>
              </li>
              <li>
                <a
                  href="#strength-test"
                  className={`flex items-center px-6 py-4 transition-all duration-300 border-b ${
                    darkMode ? "border-gray-700" : "border-gray-200"
                  } ${
                    activeItem === "strength-test"
                      ? darkMode
                        ? "text-blue-400 bg-gray-700 font-semibold"
                        : "text-blue-600 bg-blue-50 font-semibold"
                      : darkMode
                        ? "text-gray-100 hover:bg-gray-700"
                        : "text-gray-800 hover:bg-gray-100"
                  }`}
                  onClick={() => {
                    setActiveItem("strength-test");
                    closeNav();
                  }}
                >
                  <span className="mr-3 text-xl">🔬</span>
                  Strength Test
                </a>
              </li>
              <li>
                <a
                  href="#settings"
                  className={`flex items-center px-6 py-4 transition-all duration-300 border-b ${
                    darkMode ? "border-gray-700" : "border-gray-200"
                  } ${
                    activeItem === "settings"
                      ? darkMode
                        ? "text-blue-400 bg-gray-700 font-semibold"
                        : "text-blue-600 bg-blue-50 font-semibold"
                      : darkMode
                        ? "text-gray-100 hover:bg-gray-700"
                        : "text-gray-800 hover:bg-gray-100"
                  }`}
                  onClick={() => {
                    setActiveItem("settings");
                    closeNav();
                  }}
                >
                  <IoMdCog className="mr-3 text-xl" />
                  Settings
                </a>
              </li>
            </ul>
          </nav>
        </div>

        {/* Main Content - No Padding */}
        <div className="absolute top-[60px] left-0 right-0 bottom-0 overflow-auto">
          {renderContent()}
        </div>

        {/* Power Off Modal */}
        {showPowerModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100]">
            <div className="bg-gray-50 rounded-lg p-6 shadow-xl max-w-sm w-full mx-4">
              <h3 className="text-xl font-semibold text-gray-900 mb-4">
                Power Off
              </h3>
              <p className="text-gray-600 mb-6">
                Are you sure you want to close the app?
              </p>
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
    </GlobalKeyboardProvider>
  );
}

export default App;
