import React, { useEffect, useState } from "react";
import {
  IoIosArrowForward,
  IoMdMenu,
  IoMdCog,
  IoMdPower,
  IoMdRefresh,
} from "react-icons/io";
import GlobalKeyboardProvider from "./components/GlobalKeyboardProvider";
import Header from "./components/Header/Header";
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

function SidebarItem({ darkMode, active, icon, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "w-full",
        "flex items-center gap-5",
        "px-2 py-4 rounded-xl",
        "text-left",
        "transition",
        "active:scale-[0.99]",
        active
          ? darkMode
            ? "bg-white/10 text-white"
            : "bg-black/5 text-gray-900"
          : darkMode
            ? "text-gray-200 hover:bg-white/10"
            : "text-gray-800 hover:bg-black/5",
      ].join(" ")}
    >
      <span className="w-7 flex items-center justify-center opacity-90">{icon}</span>
      <span className="text-sm font-bold">{label}</span>

      {/* active indicator */}
      <span
        className={[
          "ml-auto",
          "h-7 w-2 rounded-full",
          active ? (darkMode ? "bg-blue-400" : "bg-blue-600") : "opacity-0",
        ].join(" ")}
      />
    </button>
  );
}


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
            className="fixed inset-0 z-40 bg-black/50"
            onClick={closeNav}
          />
        )}

        {/* Top Bar - Clean White/Dark Header */}
        <Header
          darkMode={darkMode}
          title="Timber Test Management System"
          subtitle={getPageTitle()}
          onToggleNav={toggleNav}
          onToggleTheme={() => setDarkMode(!darkMode)}
          onPower={() => setShowPowerModal(true)}
        />

        {/* Sidebar */}
        <aside
          className={[
            "fixed z-50",
            "top-[78px] left-0 bottom-3",         // sits below header; small outer margin
            "w-[280px]",
            "rounded-tr-2xl rounded-br-2xl",
            "border",
            "transform transition-transform duration-300",
            isNavOpen ? "translate-x-0" : "-translate-x-[320px]",
            darkMode
              ? "bg-gray-900/75 border-gray-800 text-gray-100"
              : "bg-white/75 border-gray-200 text-gray-900",
            "backdrop-blur supports-[backdrop-filter]:backdrop-blur",
          ].join(" ")}
          aria-label="Sidebar navigation"
        >
          {/* Sidebar Header */}
          <div
            className={[
              "flex items-center justify-between",
              "px-4 py-3",
              "border-b",
              darkMode ? "border-gray-800" : "border-gray-200",
            ].join(" ")}
          >
            <div className="min-w-0">
              <div className="text-sm font-semibold tracking-wide">Menu</div>
              <div className={["text-xs truncate", darkMode ? "text-gray-300" : "text-gray-500"].join(" ")}>
                {getPageTitle()}
              </div>
            </div>

            <button
              type="button"
              onClick={toggleNav}
              aria-label="Close menu"
              className={[
                "h-9 w-9 rounded-xl",
                "inline-flex items-center justify-center",
                "transition active:scale-[0.98]",
                darkMode ? "hover:bg-white/10" : "hover:bg-black/5",
              ].join(" ")}
            >
              <IoIosArrowForward className="text-xl rotate-180" />
            </button>
          </div>

          {/* Nav Items */}
          <nav className="p-2">
            <SidebarItem
              darkMode={darkMode}
              active={activeItem === "dashboard"}
              icon={<span className="text-lg">📊</span>}
              label="Dashboard"
              onClick={() => {
                setActiveItem("dashboard");
                closeNav();
              }}
            />

            <SidebarItem
              darkMode={darkMode}
              active={activeItem === "strength-test"}
              icon={<span className="text-lg">🔬</span>}
              label="Strength Test"
              onClick={() => {
                setActiveItem("strength-test");
                closeNav();
              }}
            />

            <div
              className={[
                "my-2 mx-2",
                "h-px",
                darkMode ? "bg-gray-800" : "bg-gray-200",
              ].join(" ")}
            />

            <SidebarItem
              darkMode={darkMode}
              active={activeItem === "settings"}
              icon={<IoMdCog className="text-xl" />}
              label="Settings"
              onClick={() => {
                setActiveItem("settings");
                closeNav();
              }}
            />
          </nav>

          {/* Footer */}
          <div
            className={[
              "mt-auto",
              "p-3",
              "border-t",
              darkMode ? "border-gray-800" : "border-gray-200",
            ].join(" ")}
          >
            <button
              type="button"
              onClick={() => setShowPowerModal(true)}
              className={[
                "w-full",
                "flex items-center justify-center gap-2",
                "h-11 rounded-xl",
                "font-semibold text-sm",
                "transition active:scale-[0.98]",
                darkMode
                  ? "bg-red-500/15 text-red-200 hover:bg-red-500/25"
                  : "bg-red-500/10 text-red-600 hover:bg-red-500/15",
              ].join(" ")}
            >
              <IoMdPower className="text-xl" />
              Power Off
            </button>
          </div>
        </aside>


        {/* Main Content - No Padding */}
        <div className="absolute top-[60px] left-0 right-0 bottom-0 overflow-auto">
          {renderContent()}
        </div>

        {/* Power Off Modal */}
        {showPowerModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]">
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
