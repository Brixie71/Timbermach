import React from "react";

const badgeColor = (group) => {
  switch (group) {
    case "high":
      return "bg-purple-600 text-white";
    case "moderately_high":
      return "bg-blue-600 text-white";
    case "medium":
      return "bg-green-600 text-white";
    default:
      return "bg-gray-600 text-white";
  }
};

const badgeLabel = (group) => {
  switch (group) {
    case "high":
      return "High";
    case "moderately_high":
      return "Moderately High";
    case "medium":
      return "Medium";
    default:
      return group || "Unknown";
  }
};

const RVView = ({ data, darkMode = true, onClose }) => {
  const shell = darkMode ? "bg-gray-900 text-gray-100" : "bg-white text-gray-900";
  const bar = darkMode ? "border-gray-800 bg-gray-900/80" : "border-gray-200 bg-white/80";
  const card = darkMode ? "border-gray-800 bg-gray-900/60" : "border-gray-200 bg-white";

  return (
    <div className={`h-full flex flex-col ${shell}`}>
      <div className={`border-b ${bar} sticky top-0 z-10 backdrop-blur`}>
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="min-w-0">
            <div className="text-base font-extrabold tracking-tight">Reference Value</div>
            <div className="text-sm mt-0.5 truncate">
              {data?.common_name || "Unknown"}{" "}
              {data?.botanical_name ? <span className="text-gray-400 italic">({data.botanical_name})</span> : null}
            </div>
          </div>
          <button
            onClick={onClose}
            className={`px-3 py-2 text-sm rounded-xl border ${darkMode ? "border-gray-700 bg-gray-800" : "border-gray-300 bg-white"}`}
          >
            Close
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto w-full flex-1 px-4 py-4 space-y-4">
        <div className={`rounded-2xl border ${card} p-4 flex items-center gap-3`}>
          <span className={`px-3 py-1 rounded-full text-xs font-bold ${badgeColor(data?.strength_group)}`}>
            {badgeLabel(data?.strength_group)}
          </span>
          <div className="text-sm text-gray-300">ID: {data?.id ?? "-"}</div>
        </div>

        <div className={`rounded-2xl border ${card} p-4`}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
            {[
              ["Compression Parallel (Fc)", data?.compression_parallel],
              ["Compression ⟂ (Fc⊥)", data?.compression_perpendicular],
              ["Shear Parallel (Fv)", data?.shear_parallel],
              ["Bending & Tension (FbFt)", data?.bending_tension_parallel],
            ].map(([label, val]) => (
              <div key={label} className="space-y-1">
                <div className="text-xs text-gray-400">{label}</div>
                <div className="text-xl font-bold">
                  {val ?? "-"} <span className="text-sm font-semibold text-gray-400">MPa</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className={`rounded-2xl border ${card} p-4 text-xs text-gray-300`}>
          These standardized mechanical properties are used to compare against measured specimens.
        </div>
      </div>
    </div>
  );
};

export default RVView;
