import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { FaArrowLeft, FaSearch } from "react-icons/fa";

function formatDbDateTime(value) {
  if (!value) return "-";
  const s = String(value).trim();
  const m = s.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})(?::\d{2})?/);
  if (m) return `${m[1]} ${m[2]}`;
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
      d.getHours(),
    )}:${pad(d.getMinutes())}`;
  }
  return s;
}

const SpecimenComparison = ({
  data,
  dataType,
  darkMode = false,
  onClose,
  onSave,
}) => {
  const [allReferenceData, setAllReferenceData] = useState([]);
  const [loading, setLoading] = useState(false);

  const [selectedSpecies, setSelectedSpecies] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

  const [filteredData, setFilteredData] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);

  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const dropdownWrapRef = useRef(null);

  // --------------------------------------------------------------------------
  // Fetch all reference rows once per open / data change
  // --------------------------------------------------------------------------
  useEffect(() => {
    fetchAllReferenceData();
    // Preselect existing reference on open
    if (data && data.species_id) {
      // We'll select it after list loads if possible
      // (so we can match the row object from allReferenceData)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const fetchAllReferenceData = async () => {
    setLoading(true);
    try {
      const res = await axios.get("http://127.0.0.1:8000/api/reference-values");
      const rows = Array.isArray(res.data) ? res.data : [];
      setAllReferenceData(rows);
      setFilteredData(rows);

      // if specimen already has species_id, auto select it
      if (data?.species_id) {
        const match = rows.find(
          (r) => String(r.id || r.species_id) === String(data.species_id),
        );
        if (match) {
          setSelectedSpecies(match);
          setSearchQuery(
            match.common_name || match.species_name || match.botanical_name || "",
          );
        }
      }
    } catch (e) {
      console.error("Error fetching all reference data:", e);
      setAllReferenceData([]);
      setFilteredData([]);
    } finally {
      setLoading(false);
    }
  };

  // --------------------------------------------------------------------------
  // Filter dropdown list
  // --------------------------------------------------------------------------
  useEffect(() => {
    const q = searchQuery.trim().toLowerCase();

    if (!q) {
      // When empty, show full list (better for touch UI)
      setFilteredData(allReferenceData);
      return;
    }

    const filtered = allReferenceData.filter((item) => {
      const a = (item.species_name || "").toLowerCase();
      const b = (item.common_name || "").toLowerCase();
      const c = (item.botanical_name || "").toLowerCase();
      return a.includes(q) || b.includes(q) || c.includes(q);
    });

    setFilteredData(filtered);
  }, [searchQuery, allReferenceData]);

  // --------------------------------------------------------------------------
  // Close dropdown on outside click
  // --------------------------------------------------------------------------
  useEffect(() => {
    const handler = (e) => {
      if (!dropdownWrapRef.current) return;
      if (!dropdownWrapRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Close on ESC
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") {
        setShowDropdown(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const handleSpeciesSelect = (species) => {
    setSelectedSpecies(species);
    setSearchQuery(
      species.common_name || species.species_name || species.botanical_name || "",
    );
    setShowDropdown(false);
    setSaveSuccess(false);
  };

  // --------------------------------------------------------------------------
  // Stress math
  // --------------------------------------------------------------------------
  const experimentalStress = useMemo(() => {
    if (!data) return 0;

    const maxForce =
      parseFloat(data.max_force) ||
      parseFloat(data?.["Maximum Force"]) ||
      parseFloat(data?.maximum_force) ||
      0;

    const area = parseFloat(data.area) || 1;
    const base = parseFloat(data.base) || 0;
    const height = parseFloat(data.height) || 0;
    const length = parseFloat(data.length) || 100;

    switch (dataType) {
      case "compressive":
        return maxForce / area;

      case "shear": {
        const isDoubleShear = String(data?.test_type || "")
          .toLowerCase()
          .includes("double");
        return isDoubleShear ? maxForce / (2 * area) : maxForce / area;
      }

      case "flexure": {
        const M = (maxForce * length) / 4;
        const c = height / 2;
        const I = (base * Math.pow(height, 3)) / 12;
        return I > 0 ? (M * c) / I : 0;
      }

      default:
        return 0;
    }
  }, [data, dataType]);

  const referenceStress = useMemo(() => {
    if (!selectedSpecies) return 0;
    switch (dataType) {
      case "compressive":
        return parseFloat(selectedSpecies.compression_parallel) || 0;
      case "shear":
        return parseFloat(selectedSpecies.shear_parallel) || 0;
      case "flexure":
        return parseFloat(selectedSpecies.bending_tension_parallel) || 0;
      default:
        return 0;
    }
  }, [selectedSpecies, dataType]);

  const accuracy = useMemo(() => {
    if (referenceStress <= 0) return "0.00";
    return ((experimentalStress / referenceStress) * 100).toFixed(2);
  }, [experimentalStress, referenceStress]);

  const difference = useMemo(() => {
    return (experimentalStress - referenceStress).toFixed(2);
  }, [experimentalStress, referenceStress]);

  const percentageDifference = useMemo(() => {
    if (referenceStress <= 0) return "0.00";
    return (((experimentalStress - referenceStress) / referenceStress) * 100).toFixed(2);
  }, [experimentalStress, referenceStress]);

  const comparisonRatio = useMemo(() => {
    if (referenceStress <= 0) return "0.000";
    return (experimentalStress / referenceStress).toFixed(3);
  }, [experimentalStress, referenceStress]);

  // --------------------------------------------------------------------------
  // Save (fixes: uses species_id only, calls onSave, handles saving state)
  // --------------------------------------------------------------------------
  const handleSaveComparison = async () => {
    if (!selectedSpecies) {
      alert("Please select a species to compare with.");
      return;
    }

    setSaving(true);
    setSaveSuccess(false);

    try {
      const specimenId = data?.compressive_id || data?.shear_id || data?.flexure_id;
      if (!specimenId) throw new Error("No specimen ID found.");

      const speciesIdToSave = selectedSpecies.id ?? selectedSpecies.species_id;
      if (!speciesIdToSave) throw new Error("Selected species has no ID.");

      // IMPORTANT: send only what is needed to persist reference selection.
      // This avoids accidental overwrites when some fields are null/undefined.
      const payload = { species_id: speciesIdToSave };

      await axios.patch(
        `http://127.0.0.1:8000/api/${dataType}-data/${specimenId}`,
        payload,
      );

      setSaveSuccess(true);
      setSaving(false);

      // Let parent refresh if it wants to
      if (typeof onSave === "function") {
        onSave({ ...data, species_id: speciesIdToSave });
      }

      // Small success delay (UX)
      await new Promise((r) => setTimeout(r, 600));

      onClose();
    } catch (error) {
      console.error("Error saving comparison:", error);
      alert(`Failed to save: ${error.response?.data?.detail || error.message}`);
      setSaving(false);
      setSaveSuccess(false);
    }
  };

  // --------------------------------------------------------------------------
  // UI styling tokens (compact 800x480)
  // --------------------------------------------------------------------------
  const shellBg = darkMode ? "bg-gray-900" : "bg-gray-50";
  const headerBg = darkMode ? "bg-gray-950" : "bg-white";
  const border = darkMode ? "border-gray-700" : "border-gray-300";
  const cardBg = darkMode ? "bg-gray-800/70" : "bg-white";
  const textMain = darkMode ? "text-gray-100" : "text-gray-900";
  const textDim = darkMode ? "text-gray-300" : "text-gray-600";

  const specimenName = data?.specimen_name || data?.["Specimen Name"] || "Unknown";

  return (
    <div
      className={`w-full h-full flex flex-col ${shellBg}`}
      style={{ fontFamily: "JustSans, system-ui, sans-serif" }}
    >
      {/* Compact Header */}
      <div className={`flex items-center justify-between px-4 py-3 border-b ${border} ${headerBg}`}>
        <div className="min-w-0">
          <div className={`text-[15px] font-extrabold ${textMain} truncate`}>
            Compare • {specimenName}
          </div>
          <div className={`text-[12px] ${textDim} truncate`}>
            Select a reference species, then Save.
          </div>
        </div>

        <button
          onClick={onClose}
          className={`p-2 rounded-lg transition-colors ${
            darkMode ? "text-gray-200 hover:bg-gray-800" : "text-gray-900 hover:bg-gray-100"
          }`}
          title="Back"
        >
          <FaArrowLeft />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Search + Dropdown */}
        <div ref={dropdownWrapRef} className={`relative border-b ${border}`}>
          <div
            className={`flex items-center gap-2 px-4 py-3 border-b ${border} ${
              darkMode ? "bg-gray-900" : "bg-white"
            }`}
          >
            <FaSearch className={`text-sm ${darkMode ? "text-gray-400" : "text-gray-500"}`} />
            <input
              type="text"
              placeholder={loading ? "Loading species..." : "Search or tap to browse species"}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setShowDropdown(true)}
              className={`flex-1 text-[13px] bg-transparent outline-none ${
                darkMode ? "placeholder-gray-400 text-gray-100" : "placeholder-gray-500 text-gray-900"
              }`}
            />
            <button
              onClick={() => setShowDropdown((v) => !v)}
              className={`text-[12px] font-extrabold px-3 py-1.5 rounded-lg transition-colors ${
                darkMode ? "bg-gray-800 text-gray-100 hover:bg-gray-700" : "bg-gray-100 text-gray-900 hover:bg-gray-200"
              }`}
              type="button"
              title="Toggle list"
            >
              {showDropdown ? "Hide" : "List"}
            </button>
          </div>

          {showDropdown && (
            <div
              className={`absolute top-full left-0 right-0 max-h-64 overflow-y-auto border shadow-lg z-20 ${
                darkMode ? "bg-gray-900 border-gray-700" : "bg-white border-gray-300"
              }`}
            >
              {filteredData.length > 0 ? (
                filteredData.map((species, index) => {
                  const id = species.id || species.species_id || index;
                  const label =
                    species.common_name || species.species_name || species.botanical_name || "Unknown";

                  // quick-preview accuracy for list
                  let refVal = 0;
                  switch (dataType) {
                    case "compressive":
                      refVal = parseFloat(species.compression_parallel) || 0;
                      break;
                    case "shear":
                      refVal = parseFloat(species.shear_parallel) || 0;
                      break;
                    case "flexure":
                      refVal = parseFloat(species.bending_tension_parallel) || 0;
                      break;
                    default:
                      refVal = 0;
                  }
                  const listAcc = refVal > 0 ? ((experimentalStress / refVal) * 100).toFixed(2) : "0.00";

                  const active =
                    String(species.id || species.species_id) === String(selectedSpecies?.id || selectedSpecies?.species_id);

                  return (
                    <button
                      key={id}
                      onClick={() => handleSpeciesSelect(species)}
                      className={`w-full text-left px-4 py-3 border-b last:border-b-0 transition-colors ${
                        darkMode
                          ? `border-gray-800 hover:bg-gray-800 ${active ? "bg-gray-800" : ""}`
                          : `border-gray-200 hover:bg-gray-50 ${active ? "bg-gray-50" : ""}`
                      }`}
                      type="button"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className={`text-[13px] font-extrabold ${textMain} truncate`}>
                            {label}
                          </div>
                          {species.botanical_name && species.botanical_name !== label && (
                            <div className={`text-[11px] ${textDim} truncate`}>
                              {species.botanical_name}
                            </div>
                          )}
                        </div>
                        <div className={`text-[12px] font-extrabold ${darkMode ? "text-blue-300" : "text-blue-700"}`}>
                          {listAcc}%
                        </div>
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className={`px-4 py-8 text-center text-[13px] ${textDim}`}>
                  No species found for “{searchQuery}”
                </div>
              )}
            </div>
          )}
        </div>

        {/* Selected species + metrics */}
        {selectedSpecies ? (
          <div className="p-3">
            <div className={`rounded-xl border ${border} ${cardBg} overflow-hidden`}>
              {/* KPI strip */}
              <div className={`grid grid-cols-3 border-b ${border}`}>
                <div className="px-4 py-3">
                  <div className={`text-[12px] font-extrabold ${textDim}`}>Accuracy</div>
                  <div className={`text-[28px] leading-none font-black ${darkMode ? "text-blue-300" : "text-blue-700"}`}>
                    {accuracy}%
                  </div>
                </div>

                <div className={`px-4 py-3 border-l ${border}`}>
                  <div className={`text-[12px] font-extrabold ${textDim}`}>Experimental</div>
                  <div className={`text-[18px] font-extrabold ${textMain}`}>
                    {experimentalStress.toFixed(2)} <span className="text-[12px] font-bold">MPa</span>
                  </div>
                  <div className={`text-[11px] ${textDim}`}>Calculated</div>
                </div>

                <div className={`px-4 py-3 border-l ${border}`}>
                  <div className={`text-[12px] font-extrabold ${textDim}`}>Reference</div>
                  <div className={`text-[18px] font-extrabold ${textMain}`}>
                    {referenceStress.toFixed(2)} <span className="text-[12px] font-bold">MPa</span>
                  </div>
                  <div className={`text-[11px] ${textDim}`}>Species table</div>
                </div>
              </div>

              {/* Compact details */}
              <div className="p-4 grid grid-cols-2 gap-3">
                <div>
                  <div className={`text-[12px] font-extrabold ${textDim}`}>Selected Species</div>
                  <div className={`text-[14px] font-extrabold ${textMain}`}>
                    {selectedSpecies.common_name ||
                      selectedSpecies.species_name ||
                      selectedSpecies.botanical_name ||
                      "Unknown"}
                  </div>
                  {selectedSpecies.botanical_name && (
                    <div className={`text-[11px] ${textDim}`}>
                      {selectedSpecies.botanical_name}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className={`text-[12px] font-extrabold ${textDim}`}>Difference</div>
                    <div
                      className={`text-[14px] font-extrabold ${
                        parseFloat(difference) >= 0 ? "text-green-500" : "text-red-500"
                      }`}
                    >
                      {parseFloat(difference) >= 0 ? "+" : ""}
                      {difference} MPa
                    </div>
                  </div>

                  <div>
                    <div className={`text-[12px] font-extrabold ${textDim}`}>% Diff</div>
                    <div
                      className={`text-[14px] font-extrabold ${
                        parseFloat(percentageDifference) >= 0 ? "text-green-500" : "text-red-500"
                      }`}
                    >
                      {parseFloat(percentageDifference) >= 0 ? "+" : ""}
                      {percentageDifference}%
                    </div>
                  </div>

                  <div>
                    <div className={`text-[12px] font-extrabold ${textDim}`}>Ratio</div>
                    <div className={`text-[14px] font-extrabold ${darkMode ? "text-blue-300" : "text-blue-700"}`}>
                      {comparisonRatio}
                    </div>
                  </div>

                  <div>
                    <div className={`text-[12px] font-extrabold ${textDim}`}>Dates</div>
                    <div className={`text-[11px] ${textMain}`}>
                      T: {formatDbDateTime(data?.created_at)} <br />
                      U: {formatDbDateTime(data?.updated_at)}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Spacer so sticky footer doesn't cover content */}
            <div style={{ height: 78 }} />
          </div>
        ) : (
          <div className={`text-center py-12 ${darkMode ? "text-gray-400" : "text-gray-500"}`}>
            <FaSearch className="text-4xl mx-auto mb-3 opacity-50" />
            <p className="text-sm">Search and select a wood species to compare.</p>
          </div>
        )}
      </div>

      {/* Sticky bottom save bar (better for 800x480) */}
      <div className={`border-t ${border} ${headerBg} px-4 py-3`}>
        <button
          onClick={handleSaveComparison}
          disabled={!selectedSpecies || saving || saveSuccess}
          className={`w-full py-3 px-4 rounded-lg font-extrabold text-[13px] transition-colors ${
            !selectedSpecies
              ? darkMode
                ? "bg-gray-800 text-gray-500 cursor-not-allowed"
                : "bg-gray-200 text-gray-400 cursor-not-allowed"
              : saveSuccess
                ? "bg-green-600 text-white cursor-default"
                : saving
                  ? darkMode
                    ? "bg-gray-800 text-gray-400 cursor-wait"
                    : "bg-gray-200 text-gray-500 cursor-wait"
                  : darkMode
                    ? "bg-blue-600 text-white hover:bg-blue-700"
                    : "bg-blue-600 text-white hover:bg-blue-700"
          }`}
        >
          {saveSuccess ? "✓ Saved" : saving ? "Saving..." : "Save Reference"}
        </button>
      </div>
    </div>
  );
};

export default SpecimenComparison;
