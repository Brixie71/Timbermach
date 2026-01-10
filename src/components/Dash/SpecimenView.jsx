import React, { useState, useEffect, useRef, useMemo } from "react";
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

function formatDbDateTime(value) {
  if (!value) return "-";
  const s = String(value).trim();
  const m = s.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})(?::\d{2})?/);
  if (m) return `${m[1]} ${m[2]}`;

  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    const pad = (n) => String(n).padStart(2, "0");
    const yyyy = d.getFullYear();
    const mm = pad(d.getMonth() + 1);
    const dd = pad(d.getDate());
    const hh = pad(d.getHours());
    const mi = pad(d.getMinutes());
    return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
  }
  return s;
}

const SpecimenView = ({ data, dataType, darkMode = false, onClose }) => {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentData?.species_id]);

  const fetchReferenceData = async (speciesId) => {
    setLoading(true);
    try {
      const response = await axios.get(
        `http://127.0.0.1:8000/api/reference-values/${speciesId}`,
      );
      setReferenceData(response.data);
    } catch (error) {
      console.error("Error fetching reference data:", error);
    } finally {
      setLoading(false);
    }
  };

  const refreshSpecimenData = async () => {
    const specimenId =
      currentData?.compressive_id || currentData?.shear_id || currentData?.flexure_id;
    if (!specimenId) return;

    try {
      isRefreshingRef.current = true;
      const response = await axios.get(
        `http://127.0.0.1:8000/api/${dataType}-data/${specimenId}`,
      );
      setCurrentData(response.data);
      await new Promise((resolve) => setTimeout(resolve, 150));
      isRefreshingRef.current = false;
    } catch (error) {
      console.error("Error refreshing specimen data:", error);
      isRefreshingRef.current = false;
    }
  };

  const compute = useMemo(() => {
    const cd = currentData || {};

    const maxForce =
      parseFloat(cd.max_force || cd?.["Maximum Force"] || cd?.maximum_force) || 0;
    const area = parseFloat(cd.area) || 1;
    const base = parseFloat(cd.base) || 0;
    const height = parseFloat(cd.height) || 0;
    const length = parseFloat(cd.length) || 100;

    let experimentalStress = 0;
    switch (dataType) {
      case "compressive":
        experimentalStress = StressCalculator.calculateCompressiveStress(maxForce, area);
        break;
      case "shear": {
        const isDoubleShear = cd?.test_type?.toLowerCase().includes("double");
        experimentalStress = StressCalculator.calculateShearStress(
          maxForce,
          area,
          isDoubleShear,
        );
        break;
      }
      case "flexure":
        experimentalStress = StressCalculator.calculateFlexuralStress(
          maxForce,
          base,
          height,
          length,
        );
        break;
      default:
        experimentalStress = 0;
    }

    let referenceStress = 0;
    if (referenceData) {
      switch (dataType) {
        case "compressive":
          referenceStress = parseFloat(referenceData.compression_parallel) || 0;
          break;
        case "shear":
          referenceStress = parseFloat(referenceData.shear_parallel) || 0;
          break;
        case "flexure":
          referenceStress = parseFloat(referenceData.bending_tension_parallel) || 0;
          break;
        default:
          referenceStress = 0;
      }
    }

    const accuracy =
      referenceStress > 0 ? ((experimentalStress / referenceStress) * 100).toFixed(2) : "0.00";

    return {
      maxForce,
      area,
      base,
      height,
      length,
      experimentalStress,
      referenceStress,
      accuracy,
    };
  }, [currentData, dataType, referenceData]);

  const title = `${dataType?.charAt(0).toUpperCase() + dataType?.slice(1)} • ${
    currentData?.specimen_name || "Specimen"
  }`;

  const shellBg = darkMode ? "bg-gray-900" : "bg-gray-50";
  const headerBg = darkMode ? "bg-gray-950" : "bg-white";
  const border = darkMode ? "border-gray-700" : "border-gray-300";
  const cardBg = darkMode ? "bg-gray-800/70" : "bg-white";
  const textMain = darkMode ? "text-gray-100" : "text-gray-900";
  const textDim = darkMode ? "text-gray-300" : "text-gray-600";

  const labelCls = `text-[12px] font-extrabold tracking-wide ${textDim}`;
  const valueCls = `text-[14px] font-semibold ${textMain}`;
  const valueMono = `text-[14px] font-semibold ${textMain}`;

  if (showComparison) {
    return (
      <SpecimenComparison
        data={currentData}
        dataType={dataType}
        darkMode={darkMode}
        onClose={() => {
          setShowComparison(false);
          refreshSpecimenData();
        }}
      />
    );
  }

  return (
    <div
      className={`w-full h-full flex flex-col ${shellBg}`}
      style={{ fontFamily: "JustSans, system-ui, sans-serif" }}
    >
      {/* Compact Header (60px-ish) */}
      <div className={`flex items-center justify-between px-4 py-3 border-b ${border} ${headerBg}`}>
        <div className="min-w-0">
          <div className={`text-[15px] font-extrabold ${textMain} truncate`}>
            {title}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowComparison(true)}
            className="px-3 py-2 text-[12px] font-extrabold rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
          >
            Compare
          </button>

          <button
            onClick={onClose}
            className={`p-2 rounded-lg transition-colors ${
              darkMode
                ? "text-gray-200 hover:bg-gray-800"
                : "text-gray-900 hover:bg-gray-100"
            }`}
            title="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-3">
        <div className={`rounded-xl border ${border} ${cardBg} overflow-hidden`}>
          {/* KPI strip (big numbers, compact height) */}
          <div className={`grid grid-cols-3 border-b ${border}`}>
            <div className="px-4 py-3">
              <div className={labelCls}>Accuracy</div>
              <div className={`text-[28px] leading-none font-black ${darkMode ? "text-blue-300" : "text-blue-700"}`}>
                {compute.accuracy}%
              </div>
            </div>

            <div className={`px-4 py-3 border-l ${border}`}>
              <div className={labelCls}>Experimental Stress</div>
              <div className={`text-[22px] leading-none font-extrabold ${textMain}`}>
                {compute.experimentalStress.toFixed(2)} <span className="text-[12px] font-bold">MPa</span>
              </div>
              <div className={`text-[11px] mt-1 ${textDim}`}>
                (Calculated)
              </div>
            </div>

            <div className={`px-4 py-3 border-l ${border}`}>
              <div className={labelCls}>Reference Stress</div>
              <div className={`text-[22px] leading-none font-extrabold ${textMain}`}>
                {compute.referenceStress.toFixed(2)} <span className="text-[12px] font-bold">MPa</span>
              </div>
              <div className={`text-[11px] mt-1 ${textDim}`}>
                (Species table)
              </div>
            </div>
          </div>

          {/* Dense info grid */}
          <div className="grid grid-cols-2">
            {/* Left column */}
            <div className={`p-4 border-r ${border}`}>
              <div className="grid gap-3">
                <div>
                  <div className={labelCls}>Specimen Name</div>
                  <div className={valueCls}>{currentData?.specimen_name || "-"}</div>
                </div>
                <div>
                  <div className={labelCls}>Reference Specie</div>
                  <div className={valueCls}>
                    {loading
                      ? "Loading..."
                      : referenceData?.common_name ||
                        referenceData?.species_name ||
                        "No reference selected"}
                  </div>
                </div>


                <div>
                  <div className={labelCls}>Test Type</div>
                  <div className={valueCls}>{currentData?.test_type || "-"}</div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className={labelCls}>Test Date</div>
                    <div className={valueMono}>{formatDbDateTime(currentData?.created_at)}</div>
                  </div>
                  <div>
                    <div className={labelCls}>Modified</div>
                    <div className={valueMono}>{formatDbDateTime(currentData?.updated_at)}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right column */}
            <div className="p-4">
              <div className="grid gap-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className={labelCls}>Base (b)</div>
                    <div className={valueCls}>
                      {Number(compute.base || 0).toFixed(2)} <span className="text-[12px] font-bold">mm</span>
                    </div>
                  </div>
                  <div>
                    <div className={labelCls}>Height (h)</div>
                    <div className={valueCls}>
                      {Number(compute.height || 0).toFixed(2)} <span className="text-[12px] font-bold">mm</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className={labelCls}>Length (L)</div>
                    <div className={valueCls}>
                      {Number(compute.length || 0).toFixed(2)} <span className="text-[12px] font-bold">mm</span>
                    </div>
                  </div>
                  <div>
                    <div className={labelCls}>Area (A)</div>
                    <div className={valueCls}>
                      {Number(compute.area || 0).toFixed(2)} <span className="text-[12px] font-bold">mm²</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className={labelCls}>Max Force (P)</div>
                    <div className={valueCls}>
                      {Number(compute.maxForce || 0).toFixed(2)} <span className="text-[12px] font-bold">N</span>
                    </div>
                  </div>
                  <div>
                    <div className={labelCls}>Moisture</div>
                    <div className={valueCls}>
                      {(currentData?.moisture_content ?? "-")}{" "}
                      <span className="text-[12px] font-bold">%</span>
                    </div>
                  </div>
                </div>

                {/* Small formula hints (compact) */}
                <div className={`mt-1 text-[11px] ${textDim}`}>
                  Formula notes: Compressive/Shear uses <b>σ = P/A</b>. Flexure uses bending equation.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SpecimenView;
