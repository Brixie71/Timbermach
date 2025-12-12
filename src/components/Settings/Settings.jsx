import React from "react";

const Settings = ({
  onNavigateToMoistureSettings,
  onNavigateToMoistureTest,
  onNavigateToReferenceValues,
  onNavigateToActuatorControl,
  onNavigateToActuatorCalibration,
  darkMode = true,
}) => {
  const handleButtonClick = (option) => {
    console.log(`${option} button clicked`);

    if (option === "Moisture Calibration" && onNavigateToMoistureSettings) {
      onNavigateToMoistureSettings();
    } else if (option === "Moisture Test" && onNavigateToMoistureTest) {
      onNavigateToMoistureTest();
    } else if (option === "Reference Values" && onNavigateToReferenceValues) {
      onNavigateToReferenceValues();
    } else if (option === "Actuator Control" && onNavigateToActuatorControl) {
      onNavigateToActuatorControl();
    } else if (
      option === "Actuator Calibration" &&
      onNavigateToActuatorCalibration
    ) {
      onNavigateToActuatorCalibration();
    }
  };

  return (
    <div
      className={`h-full flex flex-col ${darkMode ? "bg-gray-900" : "bg-gray-50"}`}
    >
      {/* Header */}
      <div
        className={`px-3 py-2 border-b-2 ${
          darkMode ? "border-gray-700 bg-gray-800" : "border-black bg-gray-100"
        }`}
      >
        <div className="flex items-baseline gap-2">
          <h1
            className={`text-lg font-bold ${darkMode ? "text-gray-100" : "text-gray-900"}`}
          >
            Settings
          </h1>
          <p
            className={`text-xs ${darkMode ? "text-gray-400" : "text-gray-600"}`}
          >
            Configure your TimberMach system
          </p>
        </div>
      </div>

      {/* Main Content - Grid layout */}
      <div className="flex-1 overflow-y-auto p-0">
        <div className="grid grid-cols-1">
          {/* Reference Values Card */}
          <button
            onClick={() => handleButtonClick("Reference Values")}
            className={`w-full border-2 p-3 ${
              darkMode
                ? "bg-gray-800 border-gray-700 hover:bg-gray-750 hover:border-gray-600"
                : "bg-white border-gray-300 hover:bg-gray-50 hover:border-gray-400"
            }`}
          >
            <div className="flex items-center gap-3">
              {/* Icon container */}
              <div className="w-10 h-10 rounded flex items-center justify-center flex-shrink-0 bg-purple-600">
                <svg
                  className="w-5 h-5 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                  />
                </svg>
              </div>

              {/* Text content */}
              <div className="flex-grow text-left flex items-baseline gap-2">
                <h3
                  className={`text-xl  font-bold ${darkMode ? "text-gray-100" : "text-gray-900"}`}
                >
                  Reference Values
                </h3>
                <span
                  className={`text-xs ${darkMode ? "text-gray-400" : "text-gray-600"}`}
                >
                  Manage wood species reference data
                </span>
              </div>

              {/* Arrow */}
              <div
                className={`flex-shrink-0 ${darkMode ? "text-gray-500" : "text-gray-400"}`}
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </div>
            </div>
          </button>

          {/* Moisture Settings Card */}
          <button
            onClick={() => handleButtonClick("Moisture Calibration")}
            className={`w-full border-2 p-3 ${
              darkMode
                ? "bg-gray-800 border-gray-700 hover:bg-gray-750 hover:border-gray-600"
                : "bg-white border-gray-300 hover:bg-gray-50 hover:border-gray-400"
            }`}
          >
            <div className="flex items-center gap-3">
              {/* Icon container */}
              <div className="w-10 h-10 rounded flex items-center justify-center flex-shrink-0 bg-blue-600">
                <svg
                  className="w-5 h-5 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                  />
                </svg>
              </div>

              {/* Text content */}
              <div className="flex-grow text-left flex items-baseline gap-2">
                <h3
                  className={`text-xl font-bold ${darkMode ? "text-gray-100" : "text-gray-900"}`}
                >
                  Moisture Settings
                </h3>
                <span
                  className={`text-xs ${darkMode ? "text-gray-400" : "text-gray-600"}`}
                >
                  Calibrate 7-segment display
                </span>
              </div>

              {/* Arrow */}
              <div
                className={`flex-shrink-0 ${darkMode ? "text-gray-500" : "text-gray-400"}`}
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </div>
            </div>
          </button>

          {/* Test Recognition Card */}
          <button
            onClick={() => handleButtonClick("Moisture Test")}
            className={`w-full border-2 p-3 ${
              darkMode
                ? "bg-gray-800 border-gray-700 hover:bg-gray-750 hover:border-gray-600"
                : "bg-white border-gray-300 hover:bg-gray-50 hover:border-gray-400"
            }`}
          >
            <div className="flex items-center gap-3">
              {/* Icon container */}
              <div className="w-10 h-10 rounded flex items-center justify-center flex-shrink-0 bg-green-600">
                <svg
                  className="w-5 h-5 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>

              {/* Text content */}
              <div className="flex-grow text-left flex items-baseline gap-2">
                <h3
                  className={`text-xl font-bold ${darkMode ? "text-gray-100" : "text-gray-900"}`}
                >
                  Test Recognition
                </h3>
                <span
                  className={`text-xs ${darkMode ? "text-gray-400" : "text-gray-600"}`}
                >
                  Test moisture meter reading
                </span>
              </div>

              {/* Arrow */}
              <div
                className={`flex-shrink-0 ${darkMode ? "text-gray-500" : "text-gray-400"}`}
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </div>
            </div>
          </button>

          {/* Actuator Calibration Card */}
          <button
            onClick={() => handleButtonClick("Actuator Calibration")}
            className={`w-full border-2 p-3 ${
              darkMode
                ? "bg-gray-800 border-gray-700 hover:bg-gray-750 hover:border-gray-600"
                : "bg-white border-gray-300 hover:bg-gray-50 hover:border-gray-400"
            }`}
          >
            <div className="flex items-center gap-3">
              {/* Icon container */}
              <div className="w-10 h-10 rounded flex items-center justify-center flex-shrink-0 bg-indigo-600">
                <svg
                  className="w-5 h-5 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
                  />
                </svg>
              </div>

              {/* Text content */}
              <div className="flex-grow text-left flex items-baseline gap-2">
                <h3
                  className={`text-xl font-bold ${darkMode ? "text-gray-100" : "text-gray-900"}`}
                >
                  Actuator Calibration
                </h3>
                <span
                  className={`text-xs ${darkMode ? "text-gray-400" : "text-gray-600"}`}
                >
                  Set midpoint and travel limits
                </span>
              </div>

              {/* Arrow */}
              <div
                className={`flex-shrink-0 ${darkMode ? "text-gray-500" : "text-gray-400"}`}
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </div>
            </div>
          </button>

          {/* Actuator Control Card */}
          <button
            onClick={() => handleButtonClick("Actuator Control")}
            className={`w-full border-2 p-3 ${
              darkMode
                ? "bg-gray-800 border-gray-700 hover:bg-gray-750 hover:border-gray-600"
                : "bg-white border-gray-300 hover:bg-gray-50 hover:border-gray-400"
            }`}
          >
            <div className="flex items-center gap-3">
              {/* Icon container */}
              <div className="w-10 h-10 rounded flex items-center justify-center flex-shrink-0 bg-orange-600">
                <svg
                  className="w-5 h-5 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                  />
                </svg>
              </div>

              {/* Text content */}
              <div className="flex-grow text-left flex items-baseline gap-2">
                <h3
                  className={`text-xl font-bold ${darkMode ? "text-gray-100" : "text-gray-900"}`}
                >
                  Actuator Control
                </h3>
                <span
                  className={`text-xs ${darkMode ? "text-gray-400" : "text-gray-600"}`}
                >
                  Manual linear actuator control
                </span>
              </div>

              {/* Arrow */}
              <div
                className={`flex-shrink-0 ${darkMode ? "text-gray-500" : "text-gray-400"}`}
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </div>
            </div>
          </button>
        </div>
      </div>

      {/* Info Footer */}
      <div
        className={`border-t-2 p-3 ${
          darkMode
            ? "bg-blue-900 bg-opacity-30 border-blue-800"
            : "bg-blue-100 border-blue-300"
        }`}
      >
        <div className="flex items-start gap-3">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
              darkMode ? "bg-blue-600" : "bg-blue-500"
            }`}
          >
            <svg
              className="w-4 h-4 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <div className="flex-1">
            <div className="flex items-baseline gap-2">
              <h3
                className={`text-sm font-bold ${darkMode ? "text-blue-300" : "text-blue-700"}`}
              >
                Need Help?
              </h3>
              <p
                className={`text-xs ${darkMode ? "text-blue-200" : "text-blue-600"}`}
              >
                For assistance with calibration or setup, refer to the user
                manual or contact technical support.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
