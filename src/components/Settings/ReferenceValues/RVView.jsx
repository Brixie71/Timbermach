import React from "react";

const RVView = ({ data, darkMode = true, onClose }) => {
  const getGroupLabel = (group) => {
    const labels = {
      high: "High Strength Group",
      moderately_high: "Moderately High Strength Group",
      medium: "Medium Strength Group",
    };
    return labels[group] || group;
  };

  const getGroupColor = (group) => {
    const colors = {
      high: "bg-purple-600 text-white",
      moderately_high: "bg-blue-600 text-white",
      medium: "bg-green-600 text-white",
    };
    return colors[group] || "bg-gray-600 text-white";
  };

  return (
    <div className={`w-full h-full ${darkMode ? "bg-gray-900" : "bg-gray-50"}`}>
      {/* Header */}
      <div
        className={`flex items-center justify-between px-6 py-3 border-b-2 ${
          darkMode ? "border-gray-700 bg-gray-800" : "border-black bg-gray-100"
        }`}
      >
        <div className="flex items-center gap-4">
          <h2
            className={`text-2xl font-bold ${darkMode ? "text-gray-100" : "text-gray-900"}`}
          >
            View Reference Value | {data?.common_name || "Unknown Species"}
          </h2>
          {/* Group Badge */}
          <span
            className={`px-3 py-1 text-xs font-bold ${getGroupColor(data?.strength_group)}`}
          >
            {getGroupLabel(data?.strength_group)}
          </span>
          {/* Botanical Name */}
          {data?.botanical_name && (
            <span
              className={`text-sm italic ${darkMode ? "text-gray-400" : "text-gray-600"}`}
            >
              ({data?.botanical_name})
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          className={`text-3xl font-bold ${darkMode ? "text-gray-200 hover:text-gray-400" : "text-gray-900 hover:text-gray-600"}`}
        >
          ✕
        </button>
      </div>

      {/* Main content - Full width */}
      <div className="h-[calc(100%-60px)] overflow-y-auto">
        {/* Properties Grid */}
        <div className="p-6">
          <h4
            className={`text-xl font-bold mb-4 ${darkMode ? "text-purple-400" : "text-purple-600"}`}
          >
            Mechanical Properties
          </h4>

          {/* 2x2 Grid */}
          <div className="grid grid-cols-2 gap-4">
            {/* Compression Parallel */}
            <div
              className={`p-4 border-2 ${
                darkMode
                  ? "border-gray-700 bg-gray-800"
                  : "border-gray-300 bg-white"
              }`}
            >
              <div
                className={`text-xs font-bold mb-2 ${darkMode ? "text-gray-400" : "text-gray-600"}`}
              >
                Compression Parallel to Grain (Fc):
              </div>
              <div
                className={`text-3xl font-bold ${darkMode ? "text-purple-400" : "text-purple-600"}`}
              >
                {data?.compression_parallel}{" "}
                <span className="text-lg">MPa</span>
              </div>
              <div
                className={`text-xs mt-2 ${darkMode ? "text-gray-500" : "text-gray-500"}`}
              >
                Maximum compressive stress parallel to wood grain
              </div>
            </div>

            {/* Compression Perpendicular */}
            <div
              className={`p-4 border-2 ${
                darkMode
                  ? "border-gray-700 bg-gray-800"
                  : "border-gray-300 bg-white"
              }`}
            >
              <div
                className={`text-xs font-bold mb-2 ${darkMode ? "text-gray-400" : "text-gray-600"}`}
              >
                Compression Perpendicular to Grain (Fc⊥):
              </div>
              <div
                className={`text-3xl font-bold ${darkMode ? "text-purple-400" : "text-purple-600"}`}
              >
                {data?.compression_perpendicular}{" "}
                <span className="text-lg">MPa</span>
              </div>
              <div
                className={`text-xs mt-2 ${darkMode ? "text-gray-500" : "text-gray-500"}`}
              >
                Maximum compressive stress perpendicular to wood grain
              </div>
            </div>

            {/* Shear Parallel */}
            <div
              className={`p-4 border-2 ${
                darkMode
                  ? "border-gray-700 bg-gray-800"
                  : "border-gray-300 bg-white"
              }`}
            >
              <div
                className={`text-xs font-bold mb-2 ${darkMode ? "text-gray-400" : "text-gray-600"}`}
              >
                Shear Parallel to Grain (Fv):
              </div>
              <div
                className={`text-3xl font-bold ${darkMode ? "text-purple-400" : "text-purple-600"}`}
              >
                {data?.shear_parallel} <span className="text-lg">MPa</span>
              </div>
              <div
                className={`text-xs mt-2 ${darkMode ? "text-gray-500" : "text-gray-500"}`}
              >
                Maximum shear stress parallel to wood grain
              </div>
            </div>

            {/* Bending & Tension */}
            <div
              className={`p-4 border-2 ${
                darkMode
                  ? "border-gray-700 bg-gray-800"
                  : "border-gray-300 bg-white"
              }`}
            >
              <div
                className={`text-xs font-bold mb-2 ${darkMode ? "text-gray-400" : "text-gray-600"}`}
              >
                Bending & Tension Parallel to Grain (FbFt):
              </div>
              <div
                className={`text-3xl font-bold ${darkMode ? "text-purple-400" : "text-purple-600"}`}
              >
                {data?.bending_tension_parallel}{" "}
                <span className="text-lg">MPa</span>
              </div>
              <div
                className={`text-xs mt-2 ${darkMode ? "text-gray-500" : "text-gray-500"}`}
              >
                Maximum bending and tension stress parallel to wood grain
              </div>
            </div>
          </div>

          {/* Info Note */}
          <div
            className={`mt-6 p-4 border-2 ${
              darkMode
                ? "bg-blue-900 bg-opacity-20 border-blue-800"
                : "bg-blue-50 border-blue-300"
            }`}
          >
            <div className="flex items-start gap-3">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  darkMode ? "bg-blue-600" : "bg-blue-500"
                }`}
              >
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
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <div>
                <h5
                  className={`text-sm font-bold mb-1 ${darkMode ? "text-blue-300" : "text-blue-700"}`}
                >
                  Reference Values
                </h5>
                <p
                  className={`text-xs ${darkMode ? "text-blue-200" : "text-blue-600"}`}
                >
                  These values represent standardized mechanical properties for
                  Philippine wood species. They are used for comparison with
                  experimental test results to assess wood quality and
                  performance.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RVView;
