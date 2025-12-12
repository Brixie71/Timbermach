import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import SpecimenComparison from "./SpecimenComparison";

// Import StressCalculator utilities
const StressCalculator = {
  calculateCompressiveStress: (maxForce, area) => {
    return maxForce / area;
  },

  calculateShearStress: (maxForce, area, isDoubleShear = false) => {
    return isDoubleShear ? maxForce / (2 * area) : maxForce / area;
  },

  calculateFlexuralStress: (maxForce, base, height, length) => {
    const P = maxForce;
    const c = height / 2;
    const I = (base * Math.pow(height, 3)) / 12;
    return (P * c) / I;
  },
};

const SpecimenView = ({
  data,
  dataType,
  darkMode = false,
  onClose,
  onSave,
}) => {
  const [referenceData, setReferenceData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  const [currentData, setCurrentData] = useState(data);
  const isRefreshingRef = useRef(false);

  // Only update from prop if NOT currently refreshing
  useEffect(() => {
    if (!isRefreshingRef.current) {
      setCurrentData(data);
    }
  }, [data]);

  // Fetch reference data when species_id changes
  useEffect(() => {
    if (currentData && currentData.species_id) {
      fetchReferenceData(currentData.species_id);
    }
  }, [currentData?.species_id]);

  const fetchReferenceData = async (speciesId) => {
    setLoading(true);
    try {
      console.log("Fetching reference for species_id:", speciesId);
      const response = await axios.get(
        `http://127.0.0.1:8000/api/reference-values/${speciesId}`,
      );
      setReferenceData(response.data);
      console.log(
        "Reference loaded:",
        response.data.common_name || response.data.species_name,
      );
    } catch (error) {
      console.error("Error fetching reference data:", error);
    } finally {
      setLoading(false);
    }
  };

  const refreshSpecimenData = async () => {
    const specimenId =
      currentData.compressive_id ||
      currentData.shear_id ||
      currentData.flexure_id;

    if (specimenId) {
      try {
        // Set flag to prevent prop updates during refresh
        isRefreshingRef.current = true;

        console.log("SpecimenView: Refreshing specimen data...");
        const response = await axios.get(
          `http://127.0.0.1:8000/api/${dataType}-data/${specimenId}`,
        );

        console.log(
          "SpecimenView: Fresh data received, species_id:",
          response.data.species_id,
        );

        // Update local state
        setCurrentData(response.data);

        // Wait for state to settle
        await new Promise((resolve) => setTimeout(resolve, 200));

        // Clear flag FIRST before calling parent
        isRefreshingRef.current = false;

        console.log("SpecimenView: Refresh complete, flag cleared");

        // DO NOT call parent onSave - it causes the flicker!
        // Parent can refresh table independently if needed
      } catch (error) {
        console.error("Error refreshing specimen data:", error);
        isRefreshingRef.current = false;
      }
    }
  };

  const calculateExperimentalStress = () => {
    if (!currentData) return 0;
    const maxForce =
      parseFloat(currentData.max_force) ||
      parseFloat(currentData?.["Maximum Force"]) ||
      0;
    const area = parseFloat(currentData.area) || 1;
    const base = parseFloat(currentData.base) || 0;
    const height = parseFloat(currentData.height) || 0;
    const length = parseFloat(currentData.length) || 100;

    switch (dataType) {
      case "compressive":
        return StressCalculator.calculateCompressiveStress(maxForce, area);
      case "shear":
        const isDoubleShear = currentData?.test_type
          ?.toLowerCase()
          .includes("double");
        return StressCalculator.calculateShearStress(
          maxForce,
          area,
          isDoubleShear,
        );
      case "flexure":
        return StressCalculator.calculateFlexuralStress(
          maxForce,
          base,
          height,
          length,
        );
      default:
        return 0;
    }
  };

  const handleComparisonClosed = async () => {
    console.log("Comparison closed, refreshing...");

    // Close comparison view
    setShowComparison(false);

    // Small delay to let modal fully close
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Self-refresh (doesn't call parent)
    await refreshSpecimenData();
  };

  const getReferenceValue = () => {
    if (!referenceData) return 0;
    switch (dataType) {
      case "compressive":
        return parseFloat(referenceData.compression_parallel) || 0;
      case "shear":
        return parseFloat(referenceData.shear_parallel) || 0;
      case "flexure":
        return parseFloat(referenceData.bending_tension_parallel) || 0;
      default:
        return 0;
    }
  };

  const experimentalStress = calculateExperimentalStress();
  const referenceStress = getReferenceValue();
  const accuracy =
    referenceStress > 0
      ? ((experimentalStress / referenceStress) * 100).toFixed(2)
      : 0;

  const getTestTypeLabel = () => {
    switch (dataType) {
      case "compressive":
        return "Compressive Test";
      case "shear":
        return "Shear Test";
      case "flexure":
        return "Flexure Test";
      default:
        return "Test";
    }
  };

  // If showing comparison page, render it instead
  if (showComparison) {
    return (
      <SpecimenComparison
        data={currentData}
        dataType={dataType}
        darkMode={darkMode}
        onClose={handleComparisonClosed}
      />
    );
  }

  return (
    <div className={`w-full h-full ${darkMode ? "bg-gray-800" : "bg-gray-50"}`}>
      {/* Header */}
      <div
        className={`flex items-center justify-between px-4 py-2 border-b ${
          darkMode ? "border-gray-700 bg-gray-900" : "border-black bg-gray-50"
        }`}
      >
        <h2
          className={`text-lg font-semibold ${darkMode ? "text-gray-100" : "text-gray-900"}`}
        >
          View | {getTestTypeLabel()} |{" "}
          {currentData?.specimen_name ||
            currentData?.["Specimen Name"] ||
            "Unknown"}
        </h2>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowComparison(true)}
            className={`px-4 py-1.5 text-sm font-semibold rounded-lg transition-colors ${
              darkMode
                ? "bg-blue-600 text-white hover:bg-blue-700"
                : "bg-blue-500 text-white hover:bg-blue-600"
            }`}
          >
            Compare Specimen
          </button>
          <button
            onClick={onClose}
            className={`text-2xl ${darkMode ? "text-gray-200 hover:text-gray-400" : "text-gray-900 hover:text-gray-600"}`}
          >
            ✕
          </button>
        </div>
      </div>

      {/* Main content - Two columns */}
      <div className="grid grid-cols-2 h-[calc(100%-48px)]">
        {/* LEFT COLUMN - Photo */}
        <div
          className={`flex flex-col items-center justify-center border-r ${
            darkMode ? "border-gray-700" : "border-black"
          }`}
        >
          <div
            className={`text-7xl mb-4 ${darkMode ? "text-gray-600" : "text-gray-300"}`}
          >
            📷
          </div>
          <div
            className={`mt-4 text-2xl ${darkMode ? "text-gray-500" : "text-gray-400"}`}
          >
            ⌜ ⌟
          </div>
        </div>

        {/* RIGHT COLUMN - Information (scrollable) */}
        <div className="overflow-y-auto">
          {/* 1. Accuracy Percentage - FIRST */}
          <div
            className={`px-4 py-3 border-b ${darkMode ? "border-gray-700" : "border-black"}`}
          >
            <div
              className={`text-xs mb-2 ${darkMode ? "text-gray-400" : "text-gray-600"}`}
            >
              Accuracy Percentage :
            </div>
            <div
              className={`text-4xl font-bold ${darkMode ? "text-blue-400" : "text-blue-600"}`}
            >
              {accuracy} %
            </div>
          </div>

          {/* 2. Specimen Name and Reference Species */}
          <div
            className={`grid grid-cols-2 border-b ${darkMode ? "border-gray-700" : "border-black"}`}
          >
            <div
              className={`px-4 py-3 border-r ${darkMode ? "border-gray-700" : "border-black"}`}
            >
              <div
                className={`text-xs ${darkMode ? "text-gray-400" : "text-gray-600"}`}
              >
                Specimen Name :
              </div>
              <div
                className={`mt-1 text-base font-medium ${darkMode ? "text-gray-100" : "text-gray-900"}`}
              >
                {currentData?.specimen_name ||
                  currentData?.["Specimen Name"] ||
                  "Unknown"}
              </div>
            </div>
            <div className="px-4 py-3">
              <div
                className={`text-xs ${darkMode ? "text-gray-400" : "text-gray-600"}`}
              >
                Reference Species :
              </div>
              <div
                className={`mt-1 text-base font-medium ${darkMode ? "text-gray-100" : "text-gray-900"}`}
              >
                {loading
                  ? "Loading..."
                  : referenceData?.common_name ||
                    referenceData?.species_name ||
                    referenceData?.botanical_name ||
                    "No reference selected"}
              </div>
            </div>
          </div>

          {/* 3. Calculated Stress and Reference Stress */}
          <div
            className={`grid grid-cols-2 border-b ${darkMode ? "border-gray-700" : "border-black"}`}
          >
            <div
              className={`px-4 py-3 border-r ${darkMode ? "border-gray-700" : "border-black"}`}
            >
              <div
                className={`text-xs ${darkMode ? "text-gray-400" : "text-gray-600"}`}
              >
                Calculated Stress (σ = P/A) :
              </div>
              <div
                className={`mt-1 text-base font-medium ${darkMode ? "text-blue-400" : "text-blue-600"}`}
              >
                {experimentalStress.toFixed(2)} MPa
              </div>
            </div>
            <div className="px-4 py-3">
              <div
                className={`text-xs ${darkMode ? "text-gray-400" : "text-gray-600"}`}
              >
                Reference Stress :
              </div>
              <div
                className={`mt-1 text-base font-medium ${darkMode ? "text-gray-100" : "text-gray-900"}`}
              >
                {referenceStress.toFixed(2)} MPa
              </div>
            </div>
          </div>

          {/* 4. Maximum Force and Moisture Content */}
          <div
            className={`grid grid-cols-2 border-b ${darkMode ? "border-gray-700" : "border-black"}`}
          >
            <div
              className={`px-4 py-3 border-r ${darkMode ? "border-gray-700" : "border-black"}`}
            >
              <div
                className={`text-xs ${darkMode ? "text-gray-400" : "text-gray-600"}`}
              >
                Maximum Force (P) :
              </div>
              <div
                className={`mt-1 text-base font-medium ${darkMode ? "text-gray-100" : "text-gray-900"}`}
              >
                {currentData?.max_force || currentData?.["Maximum Force"] || ""}{" "}
                N
              </div>
            </div>
            <div className="px-4 py-3">
              <div
                className={`text-xs ${darkMode ? "text-gray-400" : "text-gray-600"}`}
              >
                Moisture Content (%) :
              </div>
              <div
                className={`mt-1 text-base font-medium ${darkMode ? "text-gray-100" : "text-gray-900"}`}
              >
                {currentData?.moisture_content ||
                  currentData?.["Moisture Content"] ||
                  "-"}{" "}
                %
              </div>
            </div>
          </div>

          {/* 5. Base and Height */}
          <div
            className={`grid grid-cols-2 border-b ${darkMode ? "border-gray-700" : "border-black"}`}
          >
            <div
              className={`px-4 py-3 border-r ${darkMode ? "border-gray-700" : "border-black"}`}
            >
              <div
                className={`text-xs ${darkMode ? "text-gray-400" : "text-gray-600"}`}
              >
                Base (b) :
              </div>
              <div
                className={`mt-1 text-base font-medium ${darkMode ? "text-gray-100" : "text-gray-900"}`}
              >
                {currentData?.base || ""} mm
              </div>
            </div>
            <div className="px-4 py-3">
              <div
                className={`text-xs ${darkMode ? "text-gray-400" : "text-gray-600"}`}
              >
                Height (h) :
              </div>
              <div
                className={`mt-1 text-base font-medium ${darkMode ? "text-gray-100" : "text-gray-900"}`}
              >
                {currentData?.height || ""} mm
              </div>
            </div>
          </div>

          {/* 6. Length and Area */}
          <div
            className={`grid grid-cols-2 border-b ${darkMode ? "border-gray-700" : "border-black"}`}
          >
            <div
              className={`px-4 py-3 border-r ${darkMode ? "border-gray-700" : "border-black"}`}
            >
              <div
                className={`text-xs ${darkMode ? "text-gray-400" : "text-gray-600"}`}
              >
                Length (L) :
              </div>
              <div
                className={`mt-1 text-base font-medium ${darkMode ? "text-gray-100" : "text-gray-900"}`}
              >
                {currentData?.length || ""} mm
              </div>
            </div>
            <div className="px-4 py-3">
              <div
                className={`text-xs ${darkMode ? "text-gray-400" : "text-gray-600"}`}
              >
                Area (A = b × h) :
              </div>
              <div
                className={`mt-1 text-base font-medium ${darkMode ? "text-gray-100" : "text-gray-900"}`}
              >
                {currentData?.area || ""} mm²
              </div>
            </div>
          </div>

          {/* Button removed - now in header */}
        </div>
      </div>
    </div>
  );
};

export default SpecimenView;
