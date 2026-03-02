import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import SpecimenComparison from "./SpecimenComparison";
import { laravelUrl } from "../../config/servers";
import * as d3 from "d3";

// Palette (navy theme)
const PALETTE = {
  primary: "#0f2f5f",
  primaryBright: "#2563eb",
  lightBorder: "border-blue-100",
  darkBorder: "border-[#1f3252]",
  lightCard: "bg-white",
  darkCard: "bg-[#0d1c33]",
};

// Map percentage to color ramps
function colorForPercent(value, mode) {
  const v = Math.max(0, Math.min(100, Number(value) || 0));

  // Ordered stops: gray (0), green, yellow-green, yellow, orange, red-orange, red.
  const stops = [
    { pct: 0, color: "#9ca3af" }, // gray for 0%
    { pct: 1, color: "#16a34a" }, // green
    { pct: 30, color: "#4ade80" }, // yellow-green
    { pct: 50, color: "#eab308" }, // yellow
    { pct: 70, color: "#f97316" }, // orange
    { pct: 85, color: "#fb923c" }, // red-orange
    { pct: 100, color: "#dc2626" }, // red top
  ];

  // For accuracy we want 0 = red, 100 = green (reverse)
  if (mode === "accuracy") {
    const reversed = [
      { pct: 0, color: "#dc2626" },
      { pct: 30, color: "#fb923c" },
      { pct: 50, color: "#f97316" },
      { pct: 70, color: "#eab308" },
      { pct: 85, color: "#4ade80" },
      { pct: 100, color: "#16a34a" },
    ];
    return interpolateColor(v, reversed);
  }

  return interpolateColor(v, stops);
}

function interpolateColor(v, stops) {
  if (v <= stops[0].pct) return stops[0].color;
  for (let i = 1; i < stops.length; i++) {
    const a = stops[i - 1];
    const b = stops[i];
    if (v <= b.pct) {
      const t = (v - a.pct) / (b.pct - a.pct || 1);
      return d3.interpolateRgb(a.color, b.color)(t);
    }
  }
  return stops[stops.length - 1].color;
}

const adjustForTheme = (color, darkMode) =>
  d3
    .interpolateRgb(color, darkMode ? "#0b1527" : "#ffffff")(darkMode ? 0.1 : 0.15);

// Simple chart component (pie or doughnut) using D3
function GaugeChart({ value = 0, label, color = "#0f2f5f", darkMode, donut = false }) {
  const ref = useRef(null);
  useEffect(() => {
    const v = Math.max(0, Math.min(100, Number(value) || 0));
    const remainder = 100 - v;
    const size = 160;
    const radius = size / 2;
    const thickness = donut ? 28 : radius;

    const data = [
      { label: "value", val: v, color: adjustForTheme(color, darkMode) },
      { label: "rest", val: remainder, color: darkMode ? "#1f2937" : "#dbe5f5" },
    ];

    const arc = d3
      .arc()
      .innerRadius(donut ? radius - thickness : 0)
      .outerRadius(radius - 4);

    const pie = d3.pie().value((d) => d.val);

    const svg = d3.select(ref.current);
    svg.selectAll("*").remove();
    const g = svg
      .attr("viewBox", `0 0 ${size} ${size}`)
      .attr("role", "img")
      .append("g")
      .attr("transform", `translate(${radius},${radius})`);

    g.selectAll("path")
      .data(pie(data))
      .enter()
      .append("path")
      .attr("d", arc)
      .attr("fill", (d) => d.data.color);

    g.append("text")
      .attr("text-anchor", "middle")
      .attr("dy", "0.3em")
      .attr("fill", darkMode ? "#f9fafb" : "#0f172a")
      .style("font-size", "22px")
      .style("font-weight", "800")
      .text(`${v.toFixed(1)}%`);

    g.append("text")
      .attr("text-anchor", "middle")
      .attr("dy", "2.1em")
      .attr("fill", darkMode ? "#cbd5e1" : "#475569")
      .style("font-size", "12px")
      .style("font-weight", "700")
      .text(label || "");
  }, [value, label, color, darkMode, donut]);

  return <svg ref={ref} className="w-full h-full" />;
}

// ==============================
// Units & Conversions
// ==============================
const CONTACT_MM = 76.2;
const CONTACT_AREA_MM2 = CONTACT_MM * CONTACT_MM; // 5806.44 mm^2
const BAR_TO_MPA = 0.1; // 1 bar = 0.1 MPa; and MPa == N/mm^2
const FLEXURE_SPAN_MM = 584.2; // Fixed span (23 inches)

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

// Prefer max_force if present (already N). Otherwise compute from pressure_bar.
const calcPointLoadN = (row) => {
  const maxForce = n2(row?.max_force ?? row?.maximum_force, NaN);
  if (Number.isFinite(maxForce) && maxForce > 0) return maxForce;

  const bar = n2(row?.pressure_bar, 0);
  if (bar <= 0) return 0;

  const mpa = barToMpa(bar); // MPa == N/mm^2
  return mpa * CONTACT_AREA_MM2; // N
};

// ==============================
// Test Mode + Area Rules (from your notes)
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

const prettyMode = (mode) => {
  switch (mode) {
    case "compressive_parallel":
      return "Compressive - Parallel to Grain";
    case "compressive_perpendicular":
      return "Compressive - Perpendicular to Grain";
    case "shear_single":
      return "Shear - Single";
    case "shear_double":
      return "Shear - Double";
    case "flexure":
      return "Flexure - 3-Point (Fixed Span)";
    default:
      return "Unknown";
  }
};

const getAreaIndicatorText = (mode) => {
  switch (mode) {
    case "compressive_parallel":
      return "Area = W(base) x H";
    case "compressive_perpendicular":
      return "Area = L x W(base)";
    case "shear_single":
      return "Area = W(base) x L";
    case "shear_double":
      return "Area = (W(base) x L) x 2";
    case "flexure":
      return "Area = W(base) x L (display)";
    default:
      return "Area formula: unknown";
  }
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

// Stress outputs in MPa (== N/mm^2)
const calcExperimentalStressMPa = (dataType, row) => {
  const dt = String(dataType || "").toLowerCase();
  const mode = getTestMode(dt, row);

  const P = calcPointLoadN(row); // N
  const A = calcAreaByMode(mode, row); // mm^2

  const b = n2(row?.base, 0);
  const h = n2(row?.height, 0);

  if (dt === "compressive" || dt === "shear") {
    if (A <= 0) return 0;
    return P / A; // N/mm == MPa
  }

  if (dt === "flexure") {
    if (b <= 0 || h <= 0) return 0;
    return (3 * P * FLEXURE_SPAN_MM) / (2 * b * h * h); // MPa
  }

  return 0;
};

// ==============================
// UI Components
// ==============================
function StatTile({ label, value, unit, hint, accent = "blue", darkMode, selectable, onSelect }) {
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

  const selectableCls = selectable
    ? darkMode
      ? "cursor-pointer hover:bg-white/5 active:bg-white/10"
      : "cursor-pointer hover:bg-black/5 active:bg-black/10"
    : "";

  return (
    <div
      role={selectable ? "button" : undefined}
      tabIndex={selectable ? 0 : undefined}
      onClick={selectable ? onSelect : undefined}
      onKeyDown={
        selectable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") onSelect?.();
            }
          : undefined
      }
      className={["rounded-xl border p-3 transition-colors select-none", border, selectableCls].join(" ")}
      title={selectable ? "Click to view equation" : undefined}
    >
      <div className={["text-[11px] font-extrabold tracking-wide", labelCls].join(" ")}>{label}</div>
      <div className="mt-1 flex items-baseline gap-2">
        <div className={["text-[22px] font-black tabular-nums leading-none", accentCls].join(" ")}>{value}</div>
        {unit ? <div className={["text-[12px] font-bold", labelCls].join(" ")}>{unit}</div> : null}
      </div>
      {hint ? <div className={["text-[11px] mt-1", hintCls].join(" ")}>{hint}</div> : null}
      {selectable ? (
        <div className={["mt-2 text-[11px] font-semibold", darkMode ? "text-gray-300" : "text-gray-600"].join(" ")}>
          View equation 
        </div>
      ) : null}
    </div>
  );
}

function SectionCard({ title, subtitle, children, darkMode }) {
  const border = darkMode ? "border-gray-800" : "border-gray-200";
  const bg = darkMode ? "bg-gray-900" : "bg-white";
  return (
    <section
      className={[
        "rounded-2xl border overflow-hidden",
        border,
        bg,
      ].join(" ")}
    >
      <div className={["px-4 py-3 border-b", border].join(" ")}>
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="text-[12px] font-extrabold tracking-widest uppercase opacity-90">{title}</h3>
          {subtitle ? (
            <div className={["text-[11px] font-semibold truncate", darkMode ? "text-gray-300" : "text-gray-600"].join(" ")}>
              {subtitle}
            </div>
          ) : null}
        </div>
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function KVRow({ label, value, unit, darkMode }) {
  const labelCls = darkMode ? "text-gray-300" : "text-gray-600";
  const valueCls = darkMode ? "text-gray-100" : "text-gray-900";
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <div className={["text-[12px] font-semibold", labelCls].join(" ")}>{label}</div>
      <div className="flex items-baseline gap-2">
        <div className={["text-[14px] font-bold tabular-nums", valueCls].join(" ")}>{value ?? "-"}</div>
        {unit ? <div className={["text-[12px] font-semibold", labelCls].join(" ")}>{unit}</div> : null}
      </div>
    </div>
  );
}

function EquationModal({ open, onClose, darkMode, title, equation, steps, result }) {
  if (!open) return null;

  const border = darkMode ? "border-gray-800" : "border-gray-200";
  const panel = darkMode
    ? "bg-gray-900/85 border-gray-800 text-gray-100"
    : "bg-white/85 border-gray-200 text-gray-900";

  return (
    <div className="fixed inset-0 z-[100] bg-black/70 flex items-center justify-center p-3" onClick={onClose}>
      <div
        className={[
          "w-full max-w-2xl rounded-2xl border shadow-2xl overflow-hidden",
          panel,
        ].join(" ")}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={["px-5 py-4 border-b flex items-center justify-between", border].join(" ")}>
          <div className="min-w-0">
            <div className="text-[12px] font-extrabold tracking-widest uppercase opacity-90">Equation</div>
            <div className="text-[16px] font-extrabold truncate">{title}</div>
          </div>

          <button
            className={[
              "h-10 w-10 rounded-xl inline-flex items-center justify-center transition active:scale-[0.98]",
              darkMode ? "hover:bg-white/10" : "hover:bg-black/5",
            ].join(" ")}
            onClick={onClose}
            title="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5 grid gap-4">
          <div className={["rounded-xl border px-4 py-4", border, darkMode ? "bg-white/5" : "bg-black/5"].join(" ")}>
            <div className={["text-[12px] font-extrabold tracking-wide", darkMode ? "text-gray-300" : "text-gray-600"].join(" ")}>
              Formula
            </div>
            <div className="mt-1 text-[22px] font-black tracking-tight tabular-nums">{equation}</div>
          </div>

          {steps?.length ? (
            <div className={["rounded-xl border p-4", border].join(" ")}>
              <div className={["text-[12px] font-extrabold tracking-wide", darkMode ? "text-gray-300" : "text-gray-600"].join(" ")}>
                Substitution
              </div>
              <div className="mt-2 grid gap-2 text-[14px] font-semibold tabular-nums">
                {steps.map((s, i) => (
                  <div key={i}>{s}</div>
                ))}
              </div>
            </div>
          ) : null}

          {result ? (
            <div className={["rounded-xl border px-4 py-4 flex items-baseline justify-between gap-3", border, "bg-blue-500/10"].join(" ")}>
              <div>
                <div className={["text-[12px] font-extrabold tracking-wide", darkMode ? "text-gray-300" : "text-gray-600"].join(" ")}>
                  Result
                </div>
                <div className="text-[22px] font-black tabular-nums">{result}</div>
              </div>
              <div className={["text-[12px] font-semibold", darkMode ? "text-gray-300" : "text-gray-600"].join(" ")}>
                computed from current specimen
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ==============================
// Main Component
// ==============================
const SpecimenView = ({ data, dataType, darkMode = false, onClose }) => {
  const [referenceData, setReferenceData] = useState(null);
  const [loadingRef, setLoadingRef] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  const [currentData, setCurrentData] = useState(data);

  const [eqOpen, setEqOpen] = useState(false);
  const [eqPayload, setEqPayload] = useState({ title: "", equation: "", steps: [], result: "" });

  const isRefreshingRef = useRef(false);

  useEffect(() => {
    if (!isRefreshingRef.current) setCurrentData(data);
  }, [data]);

  useEffect(() => {
    if (currentData?.species_id) fetchReferenceData(currentData.species_id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentData?.species_id]);

  async function fetchReferenceData(speciesId) {
    setLoadingRef(true);
    try {
      const res = await axios.get(laravelUrl(`/api/reference-values/${speciesId}`));
      setReferenceData(res.data);
    } catch (e) {
      console.error("Reference fetch error:", e);
      setReferenceData(null);
    } finally {
      setLoadingRef(false);
    }
  }

  async function refreshSpecimenData() {
    const specimenId = currentData?.compressive_id || currentData?.shear_id || currentData?.flexure_id;
    if (!specimenId) return;
    try {
      isRefreshingRef.current = true;
      const res = await axios.get(laravelUrl(`/api/${dataType}-data/${specimenId}`));
      setCurrentData(res.data);
      await new Promise((r) => setTimeout(r, 150));
    } catch (e) {
      console.error("Specimen refresh error:", e);
    } finally {
      isRefreshingRef.current = false;
    }
  }

  const computed = useMemo(() => {
    const row = currentData || {};
    const mode = getTestMode(dataType, row);

    //  Use pressure_bar (BAR)
    const bar = n2(row?.pressure_bar, 0);
    const mpa = bar > 0 ? barToMpa(bar) : 0;

    //  P(N) computed from BAR->MPa->N (or max_force if present)
    const P = calcPointLoadN(row);

    //  Area based on test_type rules
    const area = calcAreaByMode(mode, row);

    //  Stress in MPa (N/mm^2)
    const exp = calcExperimentalStressMPa(dataType, row);

    // Reference depends on dataType
    let ref = 0;
    if (referenceData) {
      const dt = String(dataType || "").toLowerCase();
      if (dt === "compressive") ref = n2(referenceData.compression_parallel, 0);
      if (dt === "shear") ref = n2(referenceData.shear_parallel, 0);
      if (dt === "flexure") ref = n2(referenceData.bending_tension_parallel, 0);
    }

    const accuracy = ref > 0 ? (exp / ref) * 100 : 0;

    return {
      mode,
      bar,
      mpa,
      P,
      area,
      exp,
      ref,
      accuracy,
      base: n2(row.base, 0),
      height: n2(row.height, 0),
      length: n2(row.length, 0),
      moisture: row?.moisture_content,
      areaFormula: getAreaIndicatorText(mode),
    };
  }, [currentData, dataType, referenceData]);

  const specimenId = currentData?.compressive_id || currentData?.shear_id || currentData?.flexure_id || "-";
  const specimenName = currentData?.specimen_name || "Specimen";
  const testType = currentData?.test_type || "-";
  const createdAt = formatDbDateTime(currentData?.created_at);
  const updatedAt = formatDbDateTime(currentData?.updated_at);

  const speciesLabel = loadingRef
    ? "Loading..."
    : referenceData?.common_name ||
      referenceData?.species_name ||
      (currentData?.species_id ? `Species #${currentData.species_id}` : "No reference");

  const shell = darkMode ? "bg-[#0b1527] text-gray-100" : "bg-[#f4f7fc] text-gray-900";
  const border = darkMode ? "border-[#1f3252]" : "border-[#d6e3f7]";
  const headerSurface = darkMode ? "bg-[#0e1c33] border-[#1f3252]" : "bg-white border-[#d6e3f7]";

  const acc = n2(computed.accuracy);
  const accuracyAccent = acc >= 90 ? "green" : acc >= 60 ? "blue" : "red";

  const moistureNum =
    currentData?.moisture_content !== undefined && currentData?.moisture_content !== null
      ? n2(currentData.moisture_content)
      : NaN;
  const moistureTxt = Number.isFinite(moistureNum) ? moistureNum.toFixed(2) : "-";

  function openEquation(which) {
    const f2 = (x) => n2(x).toFixed(2);

    const mode = computed.mode;
    const P = computed.P;
    const A = computed.area;
    const b = computed.base;
    const h = computed.height;

    const bar = computed.bar;
    const mpa = computed.mpa;

    const exp = computed.exp;
    const ref = computed.ref;
    const accPct = computed.accuracy;

    const usedMaxForce = Number.isFinite(n2(currentData?.max_force, NaN)) && n2(currentData?.max_force, 0) > 0;

    let payload = { title: "", equation: "", steps: [], result: "" };

    if (which === "mode") {
      payload.title = "Test Mode (from test_type)";
      payload.equation = "Mode = derived from database test_type";
      payload.steps = [`test_type = "${String(testType)}"`, `mode = "${prettyMode(mode)}"`];
      payload.result = prettyMode(mode);
    }

    if (which === "accuracy") {
      payload.title = "Accuracy vs Reference";
      payload.equation = "Accuracy (%) = (Experimental / Reference) x 100";
      payload.steps = [`= (${f2(exp)} / ${f2(ref)}) x 100`, `= ${f2(accPct)} %`];
      payload.result = `${f2(accPct)} %`;
    }

    //  Pressure conversion: BAR -> MPa
    if (which === "pressure") {
      payload.title = "Pressure Conversion";
      payload.equation = "MPa (N/mm^2) = pressure_bar x 0.1";
      payload.steps = [
        `pressure_bar = ${f2(bar)} bar`,
        `pressure_mpa = ${f2(bar)} x 0.1 = ${f2(mpa)} MPa`,
        `Note: 1 MPa = 1 N/mm^2`,
      ];
      payload.result = `${f2(mpa)} MPa`;
    }

    //  Point load: BAR -> MPa -> N (or max_force)
    if (which === "force") {
      payload.title = "Point Load (P) in Newton";
      payload.equation = "P(N) = (pressure_bar x 0.1) x ContactArea(mm^2)";
      payload.steps = [
        `pressure_bar = ${f2(bar)} bar`,
        `pressure_mpa = ${f2(bar)} x 0.1 = ${f2(mpa)} MPa (N/mm^2)`,
        `ContactArea = ${CONTACT_MM} x ${CONTACT_MM} = ${CONTACT_AREA_MM2.toFixed(2)} mm^2`,
        `P = ${f2(mpa)} x ${CONTACT_AREA_MM2.toFixed(2)} = ${f2(mpa * CONTACT_AREA_MM2)} N`,
        usedMaxForce
          ? `Used P = max_force = ${f2(currentData?.max_force)} N (overrides pressure-derived)`
          : `Used P = ${f2(P)} N (from pressure_bar)`,
      ];
      payload.result = `${f2(P)} N`;
    }

    if (which === "area") {
      payload.title = "Area (A) by Test Mode";
      payload.equation = computed.areaFormula;
      payload.steps = [`A = ${f2(A)} mm^2`];
      payload.result = `${f2(A)} mm^2`;
    }

    if (which === "expStress") {
      const dt = String(dataType || "").toLowerCase();
      if (dt === "compressive" || dt === "shear") {
        payload.title = `Experimental ${cap(dt)} Stress`;
        payload.equation = dt === "compressive" ? "sigma = P / A" : "tau = P / A";
        payload.steps = [
          `P = ${f2(P)} N`,
          `A = ${f2(A)} mm^2 (${computed.areaFormula})`,
          `Stress = ${f2(P)} / ${f2(A)} = ${f2(exp)} MPa (N/mm^2)`,
        ];
        payload.result = `${f2(exp)} MPa`;
      }
      if (dt === "flexure") {
        payload.title = "Experimental Flexural Stress";
        payload.equation = "sigma = (3 P L) / (2 b h^2)";
        payload.steps = [
          `P = ${f2(P)} N`,
          `L = ${FLEXURE_SPAN_MM} mm (fixed span)`,
          `b = ${f2(b)} mm`,
          `h = ${f2(h)} mm`,
          ` = (3 x ${f2(P)} x ${FLEXURE_SPAN_MM}) / (2 x ${f2(b)} x ${f2(h)}^2)`,
          `= ${f2(exp)} MPa (N/mm^2)`,
        ];
        payload.result = `${f2(exp)} MPa`;
      }
    }

    if (which === "refStress") {
      payload.title = "Reference Stress (Species Table)";
      payload.equation = "Reference = value from selected species";
      payload.steps = [`Species: ${speciesLabel}`, `Reference Stress = ${f2(ref)} MPa`];
      payload.result = `${f2(ref)} MPa`;
    }

    if (which === "moisture") {
      payload.title = "Moisture Content";
      payload.equation = "Moisture (%) = stored reading";
      payload.steps = [`Moisture = ${Number.isFinite(moistureNum) ? f2(moistureNum) : "-"} %`];
      payload.result = `${Number.isFinite(moistureNum) ? f2(moistureNum) : "-"} %`;
    }

    if (!payload.title) return;
    setEqPayload(payload);
    setEqOpen(true);
  }

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
    <div className={`w-full h-full flex flex-col ${shell}`} style={{ fontFamily: "Segoe UI, system-ui, sans-serif" }}>
      <div className={["sticky top-0 z-20 border-b", border, headerSurface].join(" ")}>
        <div className="flex items-center justify-between px-4 py-3">
          <div className="min-w-0">
            <div
              className="text-lg font-black truncate"
              style={{ color: darkMode ? "#e5ecff" : PALETTE.primary }}
            >
              {specimenName || "Specimen"}
            </div>
            <div
              className={["text-sm truncate", darkMode ? "text-gray-300" : "text-gray-600"].join(" ")}
              style={{ color: darkMode ? "#c7d4f5" : undefined }}
            >
              {speciesLabel || "No reference species selected"}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className={[
                "h-10 px-4 rounded-lg text-sm font-semibold",
                darkMode ? "bg-gray-800 text-gray-100 hover:bg-gray-700" : "bg-gray-200 text-gray-900 hover:bg-gray-300",
              ].join(" ")}
              title="Close"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Charts */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className={`rounded-2xl border ${border} ${darkMode ? PALETTE.darkCard : PALETTE.lightCard} p-2 md:p-2.5`}>
            <div className="flex items-center justify-between mb-3">
              <div
                className="text-sm font-bold text-blue-900 dark:text-blue-200"
                style={{ color: darkMode ? undefined : PALETTE.primary }}
              >
                Accuracy vs Reference
              </div>
              <div className="text-xs font-semibold text-gray-500">{n2(computed.accuracy).toFixed(1)}%</div>
            </div>
            <div className="grid grid-cols-[130px,1fr] gap-3 items-center">
              <div className="w-full h-full max-w-[130px] mx-auto flex items-center justify-center">
                <GaugeChart
                  value={n2(computed.accuracy)}
                  label="Accuracy"
                  color={colorForPercent(n2(computed.accuracy), "accuracy")}
                  darkMode={darkMode}
                />
              </div>
              <div className={`text-sm ${darkMode ? "text-gray-300" : "text-gray-700"} space-y-1`}>
                <div>Experimental: {n2(computed.exp).toFixed(2)} MPa</div>
                <div>Reference: {n2(computed.ref).toFixed(2)} MPa</div>
                <button
                  onClick={() => openEquation("accuracy")}
                  className="mt-2 inline-flex items-center px-3 py-2 rounded-lg text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700"
                >
                  View formula
                </button>
              </div>
            </div>
          </div>

          <div className={`rounded-2xl border ${border} ${darkMode ? PALETTE.darkCard : PALETTE.lightCard} p-2 md:p-2.5`}>
            <div className="flex items-center justify-between mb-3">
              <div
                className="text-sm font-bold text-blue-900 dark:text-blue-200"
                style={{ color: darkMode ? undefined : PALETTE.primary }}
              >
                Moisture Content
              </div>
              <div className="text-xs font-semibold text-gray-500">{moistureTxt}%</div>
            </div>
            <div className="grid grid-cols-[130px,1fr] gap-3 items-center">
              <div className="w-full h-full max-w-[130px] mx-auto flex items-center justify-center">
                <GaugeChart
                  value={Number.isFinite(moistureNum) ? moistureNum : 0}
                  label="Moisture"
                  color={colorForPercent(Number.isFinite(moistureNum) ? moistureNum : 0, "moisture")}
                  darkMode={darkMode}
                  donut
                />
              </div>
              <div className={`text-sm ${darkMode ? "text-gray-300" : "text-gray-700"} space-y-1`}>
                <div>Stored reading: {moistureTxt}%</div>
                <button
                  onClick={() => openEquation("moisture")}
                  className="mt-2 inline-flex items-center px-3 py-2 rounded-lg text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700"
                >
                  View details
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Number cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatTile
            label="Test Mode"
            value={prettyMode(computed.mode)}
            hint="From test type"
            accent="blue"
            darkMode={darkMode}
            selectable
            onSelect={() => openEquation("mode")}
          />
          <StatTile
            label="Experimental Stress"
            value={n2(computed.exp).toFixed(2)}
            unit="MPa"
            hint="Computed from P & geometry"
            accent="blue"
            darkMode={darkMode}
            selectable
            onSelect={() => openEquation("expStress")}
          />
          <StatTile
            label="Reference Stress"
            value={n2(computed.ref).toFixed(2)}
            unit="MPa"
            hint="Species table value"
            accent="blue"
            darkMode={darkMode}
            selectable
            onSelect={() => openEquation("refStress")}
          />
        </div>

        {/* Reference card with compare control */}
        <div className={`rounded-2xl border ${border} ${darkMode ? PALETTE.darkCard : PALETTE.lightCard} p-4`}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <div
                className="text-sm font-bold text-blue-900 dark:text-blue-200"
                style={{ color: darkMode ? undefined : PALETTE.primary }}
              >
                Reference Species
              </div>
              <div className={`text-base font-semibold ${darkMode ? "text-gray-100" : "text-gray-800"}`}>
                {referenceData ? speciesLabel : "No reference selected"}
              </div>
            </div>
            <button
              onClick={() => setShowComparison(true)}
              className="px-4 py-2 rounded-lg text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700"
            >
              Compare
            </button>
          </div>
        </div>

        {/* Table */}
        <div className={`rounded-2xl border ${border} ${darkMode ? PALETTE.darkCard : PALETTE.lightCard} p-4`}>
          <div
            className="text-sm font-bold text-blue-900 dark:text-blue-200 mb-3"
            style={{ color: darkMode ? undefined : PALETTE.primary }}
          >
            Specimen Details
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
            <KVRow label="Specimen Name" value={specimenName} darkMode={darkMode} />
            <KVRow label="Reference Species" value={speciesLabel} darkMode={darkMode} />
            <KVRow label="Test Type" value={testType} darkMode={darkMode} />
            <KVRow label="Test Date" value={createdAt} darkMode={darkMode} />
            <KVRow label="Last Modified" value={updatedAt} darkMode={darkMode} />
          </div>
        </div>
      </div>

      <EquationModal
        open={eqOpen}
        onClose={() => setEqOpen(false)}
        darkMode={darkMode}
        title={eqPayload.title}
        equation={eqPayload.equation}
        steps={eqPayload.steps}
        result={eqPayload.result}
      />
    </div>
  );
};

export default SpecimenView;
