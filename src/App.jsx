import React, { Suspense, useEffect, useRef, useState } from "react";
import { ChevronLeft, Power, Settings as SettingsIcon } from "lucide-react";
import GlobalKeyboardProvider from "./components/GlobalKeyboardProvider";
import Header from "./components/Header/Header";
const WoodTests = React.lazy(() => import("./components/Tests/WoodTests"));
const MoistureSettings = React.lazy(() => import("./components/Settings/MoistureSettings"));
const MoistureDebug = React.lazy(() => import("./components/Settings/MoistureDebug"));
const SevenSegmentCalibration = React.lazy(() => import("./components/Settings/SevenSegmentCalibration"));
const ReferenceValues = React.lazy(() => import("./components/Settings/ReferenceValues/ReferenceValues"));
const ActuatorControl = React.lazy(() => import("./components/Settings/ActuatorControl"));
const ActuatorCalibration = React.lazy(() => import("./components/Settings/ActuatorCalibration"));
const MeasurementSettings = React.lazy(() => import("./components/Settings/MeasurementSettings"));
const Dash = React.lazy(() => import("./components/Dash/Dash"));
const Settings = React.lazy(() => import("./components/Settings/Settings"));
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
  // Give enough time for background services to wind down before closing the window.
  const SHUTDOWN_DELAY_MS = 6000;
  const SHUTDOWN_LOG_STEP_MS = 700;

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
  const [isShuttingDown, setIsShuttingDown] = useState(false);
  const [shutdownStatus, setShutdownStatus] = useState("Preparing shutdown...");
  const [shutdownLogs, setShutdownLogs] = useState([]);
  const [darkMode, setDarkMode] = useState(getInitialDarkMode);
  const shutdownTimerRef = useRef(null);
  const shutdownLogTimersRef = useRef([]);

  useEffect(() => {
    try {
      localStorage.setItem(THEME_KEY, darkMode ? "1" : "0");
    } catch {}
  }, [darkMode]);

  useEffect(() => {
    return () => {
      if (shutdownTimerRef.current) {
        clearTimeout(shutdownTimerRef.current);
      }
      shutdownLogTimersRef.current.forEach(clearTimeout);
      shutdownLogTimersRef.current = [];
    };
  }, []);

  useEffect(() => {
    if (!isShuttingDown) return undefined;

    let rafId = null;
    rafId = window.requestAnimationFrame(() => {
      shutdownTimerRef.current = setTimeout(() => {
        window.close();
      }, SHUTDOWN_DELAY_MS);

      const steps = [
        "Initiating shutdown...",
        "Stopping Laravel API...",
        "Stopping Python API...",
        "Stopping Hardware Bridge...",
        "Finalizing cleanup...",
        "Closing window...",
      ];

      steps.forEach((msg, index) => {
        const timer = setTimeout(() => {
          setShutdownStatus(msg);
          setShutdownLogs((logs) => [...logs, `${new Date().toLocaleTimeString()}  ${msg}`]);
        }, SHUTDOWN_LOG_STEP_MS * index);
        shutdownLogTimersRef.current.push(timer);
      });
    });

    return () => {
      if (rafId) {
        window.cancelAnimationFrame(rafId);
      }
      if (shutdownTimerRef.current) {
        clearTimeout(shutdownTimerRef.current);
      }
      shutdownLogTimersRef.current.forEach(clearTimeout);
      shutdownLogTimersRef.current = [];
    };
  }, [isShuttingDown]);

  const toggleNav = () => {
    setIsNavOpen(!isNavOpen);
  };

  const closeNav = () => {
    setIsNavOpen(false);
  };

  const openPowerModal = () => {
    setIsNavOpen(false);
    setShowPowerModal(true);
  };

  const handlePowerOff = () => {
    setShowPowerModal(false);
    setShutdownStatus("Preparing shutdown...");
    setShutdownLogs([]);
    setIsShuttingDown(true);
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

  const handleNavigateToMeasurementSettings = () => {
    console.log("App: Navigating to measurement-settings");
    setActiveItem("measurement-settings");
  };

  const renderContent = () => {
    console.log("App: Rendering content for activeItem:", activeItem);

    const ContentFallback = ({ label = "view" }) => (
      <div className="flex h-full items-center justify-center text-sm text-gray-500">
        Loading {label}...
      </div>
    );

    switch (activeItem) {
      case "strength-test":
        return (
          <Suspense fallback={<ContentFallback label="Strength Tests" />}>
            <WoodTests darkMode={darkMode} />
          </Suspense>
        );

      case "settings":
        return (
          <Suspense fallback={<ContentFallback label="Settings" />}>
            <Settings
              darkMode={darkMode}
              onNavigateToMoistureSettings={handleNavigateToMoistureSettings}
              onNavigateToMoistureTest={handleNavigateToMoistureTest}
              onNavigateToReferenceValues={handleNavigateToReferenceValues}
              onNavigateToMeasurementSettings={handleNavigateToMeasurementSettings}
              onNavigateToActuatorControl={handleNavigateToActuatorControl}
              onNavigateToActuatorCalibration={handleNavigateToActuatorCalibration}
            />
          </Suspense>
        );

      case "moisture-settings":
        return (
          <Suspense fallback={<ContentFallback label="Moisture Settings" />}>
            <MoistureSettings
              onBack={() => setActiveItem("settings")}
              onEditCalibration={() => setActiveItem("calibration")}
            />
          </Suspense>
        );

      case "moisture-debug":
        return (
          <Suspense fallback={<ContentFallback label="Moisture Debug" />}>
            <div>
              <button
                onClick={() => setActiveItem("settings")}
              className={`mb-4 px-4 py-2 rounded-lg flex items-center gap-2 ${
                  darkMode
                    ? "bg-gray-600 text-white hover:bg-gray-500"
                    : "bg-gray-700 text-white hover:bg-gray-600"
                }`}
              >
                Back to Settings
              </button>
              <MoistureDebug />
            </div>
          </Suspense>
        );

      case "calibration":
        return (
          <Suspense fallback={<ContentFallback label="Calibration" />}>
            <SevenSegmentCalibration
              onComplete={() => setActiveItem("moisture-settings")}
              onCancel={() => setActiveItem("moisture-settings")}
            />
          </Suspense>
        );

      case "reference-values":
        return (
          <Suspense fallback={<ContentFallback label="Reference Values" />}>
            <ReferenceValues darkMode={darkMode} />
          </Suspense>
        );

      case "actuator-control":
        console.log("App: Rendering ActuatorControl");
        return (
          <Suspense fallback={<ContentFallback label="Actuator Control" />}>
            <div>
              <button
                onClick={() => setActiveItem("settings")}
              className={`mb-4 px-4 py-2 rounded-lg flex items-center gap-2 ${
                  darkMode
                    ? "bg-gray-600 text-white hover:bg-gray-500"
                    : "bg-gray-700 text-white hover:bg-gray-600"
                }`}
              >
                Back to Settings
              </button>
              <ActuatorControl />
            </div>
          </Suspense>
        );

      case "actuator-calibration":
        console.log("App: Rendering ActuatorCalibration");
        return (
          <Suspense fallback={<ContentFallback label="Actuator Calibration" />}>
            <ActuatorCalibration onBack={() => setActiveItem("settings")} />
          </Suspense>
        );

      case "measurement-settings":
        return (
          <Suspense fallback={<ContentFallback label="Measurement Settings" />}>
            <MeasurementSettings onBack={() => setActiveItem("settings")} />
          </Suspense>
        );

      default:
        return (
          <Suspense fallback={<ContentFallback label="Dashboard" />}>
            <Dash darkMode={darkMode} />
          </Suspense>
        );
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
      case "measurement-settings":
        return "Measurement Settings";
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
          onPower={openPowerModal}
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
              <ChevronLeft className="text-xl" strokeWidth={2.2} />
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
              icon={<SettingsIcon className="text-xl" size={20} strokeWidth={2.2} />}
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
              onClick={openPowerModal}
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
              <Power className="text-xl" size={20} strokeWidth={2.2} />
              Power Off
            </button>
          </div>
        </aside>


        {/* Main Content - sits just below the 64px header */}
        <div className="absolute top-[64px] left-0 right-0 bottom-0 overflow-auto">
          <Suspense
            fallback={
              <div className="flex h-full items-center justify-center text-sm text-gray-500">
                Loading view...
              </div>
            }
          >
            {renderContent()}
          </Suspense>
        </div>

        {/* Power Off Modal */}
        {showPowerModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
            <div
              className={`w-full max-w-sm rounded-2xl border shadow-2xl ${
                darkMode
                  ? "border-slate-700 bg-slate-900 text-slate-100"
                  : "border-zinc-200 bg-white text-zinc-900"
              }`}
            >
              <div className="p-5 space-y-3">
                <h3 className="text-lg font-bold tracking-tight">Power Off</h3>
                <p className={`${darkMode ? "text-slate-200" : "text-zinc-700"} text-sm`}>
                  Are you sure you want to close the app?
                </p>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                      darkMode
                        ? "border border-slate-600 bg-slate-800 hover:bg-slate-700 text-slate-100"
                        : "border border-zinc-300 bg-white hover:bg-zinc-100 text-zinc-800"
                    }`}
                    onClick={() => setShowPowerModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    className="rounded-xl px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 transition"
                    onClick={handlePowerOff}
                  >
                    Power Off
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {isShuttingDown && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm">
            <div
              className={[
                "rounded-xl p-6 shadow-2xl w-[360px] max-w-[92vw] border",
                darkMode
                  ? "bg-gray-900 border-gray-700 text-white"
                  : "bg-gray-50 border-gray-200 text-gray-900",
              ].join(" ")}
            >
              <div className="flex items-center gap-3">
                <div
                  className={[
                    "h-7 w-7 animate-spin rounded-full border-2",
                    darkMode
                      ? "border-white/25 border-t-white"
                      : "border-gray-400/50 border-t-gray-700",
                  ].join(" ")}
                />
                <h3 className="text-lg font-semibold">Closing services…</h3>
              </div>

              <p
                className={[
                  "mt-3 text-sm",
                  darkMode ? "text-gray-300" : "text-gray-600",
                ].join(" ")}
              >
                {shutdownStatus}
              </p>

              <div
                className={[
                  "mt-3 max-h-36 overflow-y-auto rounded-md px-3 py-2 text-xs",
                  darkMode ? "bg-gray-800 text-gray-200" : "bg-gray-100 text-gray-700",
                ].join(" ")}
              >
                {(shutdownLogs.length ? shutdownLogs : ["Preparing shutdown..."]).map((log, idx) => (
                  <div key={`${log}-${idx}`} className="py-0.5">
                    {log}
                  </div>
                ))}
              </div>

              <p className={["mt-2 text-xs", darkMode ? "text-gray-400" : "text-gray-500"].join(" ")}>
                Window will close automatically.
              </p>

            </div>
          </div>
        )}
      </div>
    </GlobalKeyboardProvider>
  );
}

export default App;
