import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import SpecimenComparison from "./SpecimenComparison";

// Import Stress Calculator utilities
const StressCalculator = {
  calculateCompressiveStress: (maxForce, area) => maxForce / area,
  calculateShearStress: (maxForce, area, isDoubleShear = false) => 
    isDoubleShear ? maxForce / (2 * area) : maxForce / area,
  calculateFlexuralStress: (maxForce, base, height, length) => {
    const P = maxForce;
    const c = height / 2;
    const I = (base * Math.pow(height, 3)) / 12;
    return (P * c) / I;
  },
};

const SpecimenView = ({ data, dataType, darkMode = false, onClose, onSave }) => {
  const [referenceData, setReferenceData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  const [currentData, setCurrentData] = useState(data);
  const isRefreshingRef = useRef(false);

  useEffect(() => {
    if (!isRefreshingRef.current) setCurrentData(data);
  }, [data]);

  useEffect(() => {
    if (currentData?.species_id) fetchReferenceData(currentData.species_id);
  }, [currentData?.species_id]);

  const fetchReferenceData = async (speciesId) => {
    setLoading(true);
    try {
      const response = await axios.get(`http://127.0.0.1:8000/api/reference-values/${speciesId}`);
      setReferenceData(response.data);
    } catch (error) {
      console.error("Error fetching reference data:", error);
    } finally {
      setLoading(false);
    }
  };

  const refreshSpecimenData = async () => {
    const specimenId = currentData.compressive_id || currentData.shear_id || currentData.flexure_id;
    if (specimenId) {
      try {
        isRefreshingRef.current = true;
        const response = await axios.get(`http://127.0.0.1:8000/api/${dataType}-data/${specimenId}`);
        setCurrentData(response.data);
        await new Promise((resolve) => setTimeout(resolve, 200));
        isRefreshingRef.current = false;
      } catch (error) {
        console.error("Error refreshing specimen data:", error);
        isRefreshingRef.current = false;
      }
    }
  };

  const calculateExperimentalStress = () => {
    if (!currentData) return 0;
    const maxForce = parseFloat(currentData.max_force || currentData?.["Maximum Force"]) || 0;
    const area = parseFloat(currentData.area) || 1;
    const base = parseFloat(currentData.base) || 0;
    const height = parseFloat(currentData.height) || 0;
    const length = parseFloat(currentData.length) || 100;

    switch (dataType) {
      case "compressive": return StressCalculator.calculateCompressiveStress(maxForce, area);
      case "shear":
        const isDoubleShear = currentData?.test_type?.toLowerCase().includes("double");
        return StressCalculator.calculateShearStress(maxForce, area, isDoubleShear);
      case "flexure": return StressCalculator.calculateFlexuralStress(maxForce, base, height, length);
      default: return 0;
    }
  };

  const getReferenceValue = () => {
    if (!referenceData) return 0;
    switch (dataType) {
      case "compressive": return parseFloat(referenceData.compression_parallel) || 0;
      case "shear": return parseFloat(referenceData.shear_parallel) || 0;
      case "flexure": return parseFloat(referenceData.bending_tension_parallel) || 0;
      default: return 0;
    }
  };

  const experimentalStress = calculateExperimentalStress();
  const referenceStress = getReferenceValue();
  const accuracy = referenceStress > 0 ? ((experimentalStress / referenceStress) * 100).toFixed(2) : 0;

  const labelStyle = `text-sm font-bold mb-1 ${darkMode ? "text-gray-300" : "text-gray-800"}`;
  const valueStyle = `text-base font-medium ${darkMode ? "text-gray-100" : "text-gray-900"}`;
  const accentValueStyle = `text-base font-bold ${darkMode ? "text-blue-400" : "text-blue-600"}`;

  if (showComparison) {
    return <SpecimenComparison data={currentData} dataType={dataType} darkMode={darkMode} onClose={() => { setShowComparison(false); refreshSpecimenData(); }} />;
  }

  return (
    <div className={`w-full h-full flex flex-col ${darkMode ? "bg-gray-800" : "bg-gray-50"}`}>
      {/* Header */}
      <div className={`flex items-center justify-between px-6 py-4 border-b ${darkMode ? "border-gray-700 bg-gray-900" : "border-black bg-gray-50"}`}>
        <h2 className={`text-xl font-bold ${darkMode ? "text-gray-100" : "text-gray-900"}`}>
          View | {dataType.charAt(0).toUpperCase() + dataType.slice(1)} Test | {currentData?.specimen_name || "Unknown"}
        </h2>
        <div className="flex items-center gap-3">
          <button onClick={() => setShowComparison(true)} className="px-4 py-2 text-sm font-bold rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors">
            Compare Specimen
          </button>
          <button onClick={onClose} className={`text-2xl font-bold ${darkMode ? "text-gray-200 hover:text-gray-400" : "text-gray-900 hover:text-gray-600"}`}>✕</button>
        </div>
      </div>

      {/* Main content - Full Width Information */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className={`rounded-xl border ${darkMode ? "border-gray-700 bg-gray-800/50" : "border-black bg-white"} overflow-hidden shadow-sm`}>
          
          {/* Accuracy Highlight */}
          <div className={`px-6 py-5 border-b ${darkMode ? "border-gray-700" : "border-black"}`}>
            <div className={labelStyle}>Accuracy Percentage :</div>
            <div className={`text-5xl font-black ${darkMode ? "text-blue-400" : "text-blue-600"}`}>
              {accuracy} %
            </div>
          </div>

          {/* Row 1: Specimen & Species */}
          <div className={`grid grid-cols-2 border-b ${darkMode ? "border-gray-700" : "border-black"}`}>
            <div className={`px-6 py-4 border-r ${darkMode ? "border-gray-700" : "border-black"}`}>
              <div className={labelStyle}>Specimen Name :</div>
              <div className={valueStyle}>{currentData?.specimen_name || "Unknown"}</div>
            </div>
            <div className="px-6 py-4">
              <div className={labelStyle}>Reference Species :</div>
              <div className={valueStyle}>
                {loading ? "Loading..." : referenceData?.common_name || referenceData?.species_name || "No reference selected"}
              </div>
            </div>
          </div>

          {/* Row 2: Stresses */}
          <div className={`grid grid-cols-2 border-b ${darkMode ? "border-gray-700" : "border-black"}`}>
            <div className={`px-6 py-4 border-r ${darkMode ? "border-gray-700" : "border-black"}`}>
              <div className={labelStyle}>Calculated Stress (σ = P/A) :</div>
              <div className={accentValueStyle}>{experimentalStress.toFixed(2)} MPa</div>
            </div>
            <div className="px-6 py-4">
              <div className={labelStyle}>Reference Stress :</div>
              <div className={valueStyle}>{referenceStress.toFixed(2)} MPa</div>
            </div>
          </div>

          {/* Row 3: Force & Moisture */}
          <div className={`grid grid-cols-2 border-b ${darkMode ? "border-gray-700" : "border-black"}`}>
            <div className={`px-6 py-4 border-r ${darkMode ? "border-gray-700" : "border-black"}`}>
              <div className={labelStyle}>Maximum Force (P) :</div>
              <div className={valueStyle}>{currentData?.max_force || currentData?.["Maximum Force"] || "0"} N</div>
            </div>
            <div className="px-6 py-4">
              <div className={labelStyle}>Moisture Content (%) :</div>
              <div className={valueStyle}>{currentData?.moisture_content || "-"} %</div>
            </div>
          </div>

          {/* Row 4: Dimensions */}
          <div className={`grid grid-cols-2 border-b ${darkMode ? "border-gray-700" : "border-black"}`}>
            <div className={`px-6 py-4 border-r ${darkMode ? "border-gray-700" : "border-black"}`}>
              <div className={labelStyle}>Base (b) :</div>
              <div className={valueStyle}>{currentData?.base || "0"} mm</div>
            </div>
            <div className="px-6 py-4">
              <div className={labelStyle}>Height (h) :</div>
              <div className={valueStyle}>{currentData?.height || "0"} mm</div>
            </div>
          </div>

          {/* Row 5: Length & Area */}
          <div className="grid grid-cols-2">
            <div className={`px-6 py-4 border-r ${darkMode ? "border-gray-700" : "border-black"}`}>
              <div className={labelStyle}>Length (L) :</div>
              <div className={valueStyle}>{currentData?.length || "0"} mm</div>
            </div>
            <div className="px-6 py-4">
              <div className={labelStyle}>Area (A = b × h) :</div>
              <div className={valueStyle}>{currentData?.area || "0"} mm²</div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default SpecimenView;