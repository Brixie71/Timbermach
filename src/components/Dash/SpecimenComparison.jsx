import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { FaArrowLeft, FaSearch } from "react-icons/fa";

// ==============================
// Units & Conversions
// ==============================
const CONTACT_MM = 76.2;
const CONTACT_AREA_MM2 = CONTACT_MM * CONTACT_MM; // 5806.44 mm²
const BAR_TO_MPA = 0.1; // bar -> MPa (N/mm²)
const FLEXURE_SPAN_MM = 584.2;

// ==============================
// Helpers
// ==============================
const n2 = (v, fallback = 0) => {
  const x = Number(v);
  return Number.isFinite(x) ? x : fallback;
};

const cap = (s) => {
  if (!s) return "";
  return String(s).charAt(0).toUpperCase() + String(s).slice(1);
};

const formatDbDateTime = (value) => {
  if (!value) return "-";
  const s = String(value).trim();
  const m = s.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})(?::\d{2})?/);
  if (m) return `${m[1]} ${m[2]}`;
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
      d.getHours()
    )}:${pad(d.getMinutes())}`;
  }
  return s;
};

const barToMpa = (bar) => n2(bar) * BAR_TO_MPA;

// Prefer max_force if present (N). Else compute from pressure_bar (BAR->MPa->N)
const calcPointLoadN = (row) => {
  const maxForce = n2(row?.max_force ?? row?.maximum_force, NaN);
  if (Number.isFinite(maxForce) && maxForce > 0) return maxForce;

  const bar = n2(row?.pressure_bar, 0);
  if (bar <= 0) return 0;

  const mpa = barToMpa(bar); // MPa == N/mm²
  return mpa * CONTACT_AREA_MM2; // N
};

// ==============================
// Test Mode + Area Rules
// ==============================
const getTestMode = (dataType, row) => {
  const tt = String(row?.test_type || "").toLowerCase();
  const dt = String(dataType || "").toLowerCase();

  if (dt === "compressive") {
    if (tt.includes("perpendicular") || tt.includes("perp")) return "compressive_perpendicular";
    return "compressive_parallel";
  }
  if (dt === "shear") {
    if (tt.includes("double")) return "shear_double";
    return "shear_single";
  }
  if (dt === "flexure") return "flexure";
  return "unknown";
};

const calcAreaByMode = (mode, row) => {
  const W = n2(row?.base, 0);
  const H = n2(row?.height, 0);
  const L = n2(row?.length, 0);

  switch (mode) {
    case "compressive_parallel":
      return W > 0 && H > 0 ? W * H : 0;
    case "compressive_perpendicular":
      return W > 0 && L > 0 ? W * L : 0;
    case "shear_single":
      return W > 0 && L > 0 ? W * L : 0;
    case "shear_double":
      return W > 0 && L > 0 ? (W * L) * 2 : 0;
    case "flexure":
      return W > 0 && L > 0 ? W * L : 0;
    default:
      return 0;
  }
};

// Stress in MPa (N/mm²)
const calcExperimentalStressMPa = (dataType, row) => {
  const dt = String(dataType || "").toLowerCase();
  const mode = getTestMode(dt, row);

  const P = calcPointLoadN(row); // N
  const A = calcAreaByMode(mode, row); // mm²

  const b = n2(row?.base, 0);
  const h = n2(row?.height, 0);

  if (dt === "compressive" || dt === "shear") {
    if (A <= 0) return 0;
    return P / A;
  }

  if (dt === "flexure") {
    if (b <= 0 || h <= 0) return 0;
    return (3 * P * FLEXURE_SPAN_MM) / (2 * b * h * h);
  }

  return 0;
};

// ==============================
// UI Bits
// ==============================
function StatTile({ label, value, hint, accent = "blue", darkMode }) {
  const border = darkMode ? "border-gray-800" : "border-gray-200";
  const labelCls = darkMode ? "text-gray-300" : "text-gray-600";
  const hintCls = darkMode ? "text-gray-400" : "text-gray-500";
  const accentCls =
    accent === "green"
      ? darkMode
        ? "text-emerald-300"
        : "text-emerald-700"
      : accent === "red"
        ? darkMode
          ? "text-red-300"
          : "text-red-700"
        : darkMode
          ? "text-blue-300"
          : "text-blue-700";

  return (
    <div className={["rounded-xl border p-3", border].join(" ")}>
      <div className={["text-[11px] font-extrabold tracking-wide", labelCls].join(" ")}>{label}</div>
      <div className={["mt-1 text-[22px] font-black tabular-nums leading-none", accentCls].join(" ")}>{value}</div>
      {hint ? <div className={["mt-1 text-[11px]", hintCls].join(" ")}>{hint}</div> : null}
    </div>
  );
}

const SpecimenComparison = ({ data, dataType, darkMode = false, onClose, onSave }) => {
  const [allReferenceData, setAllReferenceData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [loading, setLoading] = useState(false);

  const [selectedSpecies, setSelectedSpecies] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);

  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const dropdownWrapRef = useRef(null);

  useEffect(() => {
    fetchAllReferenceData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  async function fetchAllReferenceData() {
    setLoading(true);
    try {
      const res = await axios.get("http://127.0.0.1:8000/api/reference-values");
      const rows = Array.isArray(res.data) ? res.data : [];
      setAllReferenceData(rows);
      setFilteredData(rows);

      if (data?.species_id) {
        const match = rows.find((r) => String(r.id || r.species_id) === String(data.species_id));
        if (match) {
          setSelectedSpecies(match);
          setSearchQuery(match.common_name || match.species_name || match.botanical_name || "");
        }
      }
    } catch (e) {
      console.error("Error fetching reference values:", e);
      setAllReferenceData([]);
      setFilteredData([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return setFilteredData(allReferenceData);

    setFilteredData(
      allReferenceData.filter((item) => {
        const a = (item.species_name || "").toLowerCase();
        const b = (item.common_name || "").toLowerCase();
        const c = (item.botanical_name || "").toLowerCase();
        return a.includes(q) || b.includes(q) || c.includes(q);
      })
    );
  }, [searchQuery, allReferenceData]);

  useEffect(() => {
    const handler = (e) => {
      if (!dropdownWrapRef.current) return;
      if (!dropdownWrapRef.current.contains(e.target)) setShowDropdown(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function handleSpeciesSelect(species) {
    setSelectedSpecies(species);
    setSearchQuery(species.common_name || species.species_name || species.botanical_name || "");
    setShowDropdown(false);
    setSaveSuccess(false);
  }

  // ✅ Experimental stress uses pressure_bar -> MPa -> N
  const experimentalStress = useMemo(() => calcExperimentalStressMPa(dataType, data || {}), [dataType, data]);

  const referenceStress = useMemo(() => {
    if (!selectedSpecies) return 0;
    const dt = String(dataType || "").toLowerCase();
    if (dt === "compressive") return n2(selectedSpecies.compression_parallel, 0);
    if (dt === "shear") return n2(selectedSpecies.shear_parallel, 0);
    if (dt === "flexure") return n2(selectedSpecies.bending_tension_parallel, 0);
    return 0;
  }, [selectedSpecies, dataType]);

  const accuracy = useMemo(
    () => (referenceStress > 0 ? (experimentalStress / referenceStress) * 100 : 0),
    [experimentalStress, referenceStress]
  );

  const difference = useMemo(() => experimentalStress - referenceStress, [experimentalStress, referenceStress]);
  const percentDiff = useMemo(
    () => (referenceStress > 0 ? ((experimentalStress - referenceStress) / referenceStress) * 100 : 0),
    [experimentalStress, referenceStress]
  );

  const ratio = useMemo(() => (referenceStress > 0 ? experimentalStress / referenceStress : 0), [experimentalStress, referenceStress]);

  async function handleSaveComparison() {
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

      const url = `http://127.0.0.1:8000/api/${dataType}-data/${specimenId}`;
      const payload = { species_id: speciesIdToSave };

      // PATCH -> PUT fallback (fixes 405)
      try {
        await axios.patch(url, payload);
      } catch (err) {
        if (err?.response?.status === 405) {
          await axios.put(url, payload);
        } else {
          throw err;
        }
      }

      setSaveSuccess(true);
      setSaving(false);

      onSave?.({ ...data, species_id: speciesIdToSave });

      await new Promise((r) => setTimeout(r, 350));
      onClose();
    } catch (error) {
      console.error("Error saving comparison:", error);
      alert(`Failed to save: ${error.response?.data?.detail || error.message}`);
      setSaving(false);
      setSaveSuccess(false);
    }
  }

  const shell = darkMode ? "bg-gray-900 text-gray-100" : "bg-gray-50 text-gray-900";
  const border = darkMode ? "border-gray-800" : "border-gray-200";
  const glassHeader = darkMode ? "bg-gray-900/70" : "bg-white/70";
  const glassPanel = darkMode ? "bg-gray-900/60" : "bg-white/80";
  const textDim = darkMode ? "text-gray-300" : "text-gray-600";

  const specimenName = data?.specimen_name || data?.["Specimen Name"] || "Unknown";
  const accAccent = accuracy >= 90 ? "green" : accuracy >= 60 ? "blue" : "red";
  const diffAccent = difference >= 0 ? "green" : "red";

  return (
    <div className={`w-full h-full flex flex-col ${shell}`} style={{ fontFamily: "JustSans, system-ui, sans-serif" }}>
      <div className={["sticky top-0 z-20 border-b", border, glassHeader, "backdrop-blur supports-[backdrop-filter]:backdrop-blur"].join(" ")}>
        <div className="h-[56px] px-4 flex items-center justify-between">
          <div className="min-w-0">
            <div className="text-[14px] font-extrabold tracking-wide truncate">Compare • {specimenName}</div>
            <div className={["text-[12px] truncate", textDim].join(" ")}>{cap(dataType)} • pick a reference species</div>
          </div>

          <button
            onClick={onClose}
            className={["h-10 w-10 rounded-xl inline-flex items-center justify-center transition active:scale-[0.98]", darkMode ? "hover:bg-white/10" : "hover:bg-black/5"].join(" ")}
            title="Back"
          >
            <FaArrowLeft />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        <div ref={dropdownWrapRef} className="relative">
          <div className={["rounded-2xl border overflow-hidden", border, glassPanel, "backdrop-blur supports-[backdrop-filter]:backdrop-blur"].join(" ")}>
            <div className={["flex items-center gap-2 px-4 h-[52px] border-b", border].join(" ")}>
              <FaSearch className={darkMode ? "text-gray-400" : "text-gray-500"} />
              <input
                type="text"
                placeholder={loading ? "Loading species..." : "Search species"}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setShowDropdown(true)}
                className={["flex-1 text-[13px] bg-transparent outline-none", darkMode ? "placeholder-gray-400 text-gray-100" : "placeholder-gray-500 text-gray-900"].join(" ")}
              />
              <button
                onClick={() => setShowDropdown((v) => !v)}
                className={["text-[12px] font-extrabold px-3 py-2 rounded-xl transition active:scale-[0.98]", darkMode ? "bg-white/10 hover:bg-white/15" : "bg-black/5 hover:bg-black/10"].join(" ")}
                type="button"
              >
                {showDropdown ? "Hide" : "List"}
              </button>
            </div>

            {showDropdown ? (
              <div className="max-h-72 overflow-y-auto">
                {filteredData.length ? (
                  filteredData.map((species, idx) => {
                    const id = species.id || species.species_id || idx;
                    const label = species.common_name || species.species_name || species.botanical_name || "Unknown";
                    const active =
                      String(species.id || species.species_id) ===
                      String(selectedSpecies?.id || selectedSpecies?.species_id);

                    return (
                      <button
                        key={id}
                        onClick={() => handleSpeciesSelect(species)}
                        className={["w-full text-left px-4 py-3 border-b last:border-b-0 transition", border, darkMode ? (active ? "bg-white/10" : "hover:bg-white/5") : active ? "bg-black/5" : "hover:bg-black/5"].join(" ")}
                        type="button"
                      >
                        <div className="text-[13px] font-extrabold truncate">{label}</div>
                        {species.botanical_name ? <div className={["text-[11px] truncate", textDim].join(" ")}>{species.botanical_name}</div> : null}
                      </button>
                    );
                  })
                ) : (
                  <div className={["px-4 py-10 text-center text-[13px]", textDim].join(" ")}>No species found</div>
                )}
              </div>
            ) : null}
          </div>
        </div>

        {selectedSpecies ? (
          <>
            <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
              <StatTile label="Accuracy" value={`${n2(accuracy).toFixed(2)}%`} hint="Experimental / Reference × 100" accent={accAccent} darkMode={darkMode} />
              <StatTile label="Experimental" value={`${n2(experimentalStress).toFixed(2)} MPa`} hint="Uses pressure_bar→MPa→N" darkMode={darkMode} />
              <StatTile label="Reference" value={`${n2(referenceStress).toFixed(2)} MPa`} hint="From selected species" darkMode={darkMode} />
            </div>

            <div className="mt-3 grid grid-cols-1 lg:grid-cols-2 gap-3">
              <div className={["rounded-2xl border p-4", border, glassPanel, "backdrop-blur supports-[backdrop-filter]:backdrop-blur"].join(" ")}>
                <div className="text-[12px] font-extrabold tracking-widest uppercase opacity-90">Selected Species</div>
                <div className="mt-1 text-[15px] font-extrabold">{selectedSpecies.common_name || selectedSpecies.species_name || selectedSpecies.botanical_name || "Unknown"}</div>
              </div>

              <div className={["rounded-2xl border p-4", border, glassPanel, "backdrop-blur supports-[backdrop-filter]:backdrop-blur"].join(" ")}>
                <div className="grid grid-cols-2 gap-3">
                  <StatTile label="Difference" value={`${difference >= 0 ? "+" : ""}${n2(difference).toFixed(2)} MPa`} hint="Experimental − Reference" accent={diffAccent} darkMode={darkMode} />
                  <StatTile label="% Diff" value={`${percentDiff >= 0 ? "+" : ""}${n2(percentDiff).toFixed(2)}%`} hint="(Diff/Ref)×100" accent={diffAccent} darkMode={darkMode} />
                  <StatTile label="Ratio" value={`${n2(ratio).toFixed(3)}`} hint="Experimental / Reference" darkMode={darkMode} />
                  <div className="rounded-xl border p-3" style={{ borderColor: darkMode ? "#1f2937" : "#e5e7eb" }}>
                    <div className={["text-[11px] font-extrabold tracking-wide", textDim].join(" ")}>Dates</div>
                    <div className={["mt-1 text-[12px] font-semibold", darkMode ? "text-gray-100" : "text-gray-900"].join(" ")}>
                      T: {formatDbDateTime(data?.created_at)} <br />
                      U: {formatDbDateTime(data?.updated_at)}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ height: 86 }} />
          </>
        ) : (
          <div className={["text-center py-12", darkMode ? "text-gray-400" : "text-gray-500"].join(" ")}>
            <FaSearch className="text-4xl mx-auto mb-3 opacity-50" />
            <p className="text-sm">Search and select a wood species to compare.</p>
          </div>
        )}
      </div>

      <div className={["sticky bottom-0 z-20 border-t px-4 py-3", border, glassHeader, "backdrop-blur supports-[backdrop-filter]:backdrop-blur"].join(" ")}>
        <button
          onClick={handleSaveComparison}
          disabled={!selectedSpecies || saving || saveSuccess}
          className={[
            "w-full py-3 px-4 rounded-xl font-extrabold text-[13px] transition active:scale-[0.99]",
            !selectedSpecies
              ? darkMode
                ? "bg-white/5 text-gray-500 cursor-not-allowed"
                : "bg-black/5 text-gray-400 cursor-not-allowed"
              : saveSuccess
                ? "bg-emerald-600 text-white cursor-default"
                : saving
                  ? darkMode
                    ? "bg-white/5 text-gray-400 cursor-wait"
                    : "bg-black/5 text-gray-500 cursor-wait"
                  : "bg-blue-600 text-white hover:bg-blue-700",
          ].join(" ")}
        >
          {saveSuccess ? "✓ Saved" : saving ? "Saving..." : "Save Reference"}
        </button>
      </div>
    </div>
  );
};

export default SpecimenComparison;
