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
  const prevValRef = useRef(0);
  const firstRenderRef = useRef(true);
  const prevDarkRef = useRef(darkMode);
  useEffect(() => {
    const v = Math.max(0, Math.min(100, Number(value) || 0));
    const prev = Math.max(0, Math.min(100, Number(prevValRef.current) || 0));
    prevValRef.current = v;

    const size = 219; // gauge size (~10% smaller)
    const radius = size / 2;
    const thickness = donut ? 45 : radius; // keep ring proportional with smaller size
    const sweep = Math.PI * 2; // full circle
    const startAngle = Math.PI; // start at 180Â° (left in d3's top-origin system, gap at bottom after sweep)
    const endAngle = startAngle + sweep;
    const angleFor = (pct) => startAngle + (sweep * pct) / 100;
    const restColor = darkMode ? "#111827" : "#e5eaf3"; // clearer dark/light backgrounds

    const arc = d3
      .arc()
      .innerRadius(donut ? radius - thickness : 0)
      .outerRadius(radius - 4);

    const svg = d3.select(ref.current).attr("viewBox", `0 0 ${size} ${size}`).attr("role", "img");
    // If theme changed, clear to avoid stale colors
    if (prevDarkRef.current !== darkMode) {
      svg.selectAll("*").remove();
      prevDarkRef.current = darkMode;
      firstRenderRef.current = true;
    }
    let g = svg.select("g.gauge-root");
    if (g.empty()) {
      g = svg.append("g").attr("class", "gauge-root").attr("transform", `translate(${radius},${radius})`);
    }
    const baseTransform = `translate(${radius},${radius})`;

    // Background arc (full 360 sweep)
    const bg = g.selectAll("path.gc-bg").data([null]);
    bg.enter()
      .append("path")
      .attr("class", "gc-bg")
      .attr("fill", restColor)
      .merge(bg)
      .attr("d", arc({ startAngle, endAngle }));

    // Outline stroke around the gauge for contrast
    const outlineColor = darkMode ? "#9ca3af" : "#9ca3af"; // lower contrast gray
    const outline = g.selectAll("circle.gc-outline").data([null]);
    outline
      .enter()
      .append("circle")
      .attr("class", "gc-outline")
      .merge(outline)
      .attr("r", radius - 2)
      .attr("fill", "none")
      .attr("stroke", outlineColor)
      .attr("stroke-width", 2);
    outline.exit().remove();

    // Value arc with tween from previous angle
    const val = g.selectAll("path.gc-val").data([v]);
    const isFirst = firstRenderRef.current;
    const dur = isFirst ? 1100 : 875;
    val
      .enter()
      .append("path")
      .attr("class", "gc-val")
      .attr("fill", adjustForTheme(color, darkMode))
      .each(function () {
        this._current = isFirst ? startAngle : angleFor(prev);
      })
      .merge(val)
      .transition()
      .duration(dur)
      .ease(d3.easeCubicOut)
      .attrTween("d", function (d) {
        const interpolate = d3.interpolateNumber(this._current, angleFor(d));
        this._current = interpolate(1);
        return (t) => arc({ startAngle, endAngle: interpolate(t) });
      })
      .attr("fill", adjustForTheme(color, darkMode));

    val.exit().remove();

    const valueText = g.selectAll("text.gc-value").data([v]);
    const mergedValue = valueText
      .enter()
      .append("text")
      .attr("class", "gc-value")
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "middle")
      .attr("dy", "-0.07em") // raise text ~7% to align center visually
      .style("font-size", "30px") // 20% bigger than previous 29px
      .style("font-weight", "500")
      .text(`${prev.toFixed(1)}%`)
      .merge(valueText)
      .attr("fill", darkMode ? "#f9fafb" : "#0f172a")
      .attr("dy", "-0.07em"); // ensure updates keep offset

    mergedValue
      .transition()
      .duration(dur)
      .ease(d3.easeQuadOut)
      .tween("text", function (d) {
        const that = d3.select(this);
        const i = d3.interpolateNumber(prev, d);
        return (t) => that.text(`${i(t).toFixed(1)}%`);
      });

    g.selectAll("text.gc-label").remove(); // remove label under percentage
    firstRenderRef.current = false;
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
        <div className={["text-[22px] font-bold tabular-nums leading-none", accentCls].join(" ")}>{value}</div>
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
  const resultPanel = darkMode ? "bg-[#10294f] text-[#e5ecff]" : "bg-[#e8f1ff] text-[#0f2f5f]";

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
            <div className="mt-1 text-[15px] font-bold tracking-tight tabular-nums">{equation}</div>
          </div>

          {steps?.length || result ? (
            <div className={["rounded-xl border", border, "grid grid-cols-1 md:grid-cols-2"].join(" ")}>
              <div className="p-4">
                <div className={["text-[12px] font-extrabold tracking-wide", darkMode ? "text-gray-300" : "text-gray-600"].join(" ")}>
                  Substitution
                </div>
                <div className="mt-2 grid gap-2 text-[14px] font-semibold tabular-nums">
                  {steps?.length
                    ? steps.map((s, i) => <div key={i}>{s}</div>)
                    : null}
                </div>
              </div>
              {result ? (
                <div className={["p-4 md:border-l", border, resultPanel, "flex flex-col gap-1 text-center md:text-left"].join(" ")}>
                  <div className="text-[12px] font-extrabold tracking-wide">Result</div>
                  <div className="text-[22px] font-bold tabular-nums">{result}</div>
                  <div className="text-[12px] font-semibold">computed from current specimen</div>
                </div>
              ) : null}
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
  const [showDates, setShowDates] = useState(false);
  const [currentData, setCurrentData] = useState(data);
  const [moistureGaugeValue, setMoistureGaugeValue] = useState(0);

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
  const specimenName = currentData?.specimen_name || "Mango Tremew";
  const testType = currentData?.test_type || "-";
  const createdAt = formatDbDateTime(currentData?.created_at);
  const updatedAt = formatDbDateTime(currentData?.updated_at);

  const speciesLabel = loadingRef
    ? "Loading..."
    : referenceData?.common_name ||
      referenceData?.species_name ||
      (currentData?.species_id ? `Species #${currentData.species_id}` : "No reference");
  const accuracyTitle = referenceData
    ? `Accuracy vs Reference | ${speciesLabel}`
    : "Accuracy vs Reference | Nothing to Compare";

  const shell = darkMode ? "bg-[#0b1527] text-gray-100" : "bg-[#edf1f7] text-gray-900";
  const border = darkMode ? "border-2 border-[#1f3252]" : "border-2 border-[#c9d4e8]";
  const headerSurface = darkMode ? "bg-[#0e1c33] border-[#1f3252]" : "bg-white border-[#c9d4e8]";
  // higher-contrast divider between charts
  const divider = darkMode ? "border-[#3b5b9a]" : "border-[#6b7280]";
  const headerLine = `${prettyMode(computed.mode) || "Test Type"} | ${specimenName || "Specimen"}`;
  const modalPanel = darkMode ? "bg-[#0f192d] border-[#1f3252] text-gray-100" : "bg-white border-gray-200 text-gray-900";
  const modalButton = darkMode
    ? "bg-gray-800 text-gray-100 hover:bg-gray-700"
    : "bg-gray-200 text-gray-900 hover:bg-gray-300";

  const acc = n2(computed.accuracy);
  const accuracyAccent = acc >= 90 ? "green" : acc >= 60 ? "blue" : "red";

  const moistureNum =
    currentData?.moisture_content !== undefined && currentData?.moisture_content !== null
      ? n2(currentData.moisture_content)
      : NaN;
  const moistureTxt = Number.isFinite(moistureNum) ? moistureNum.toFixed(2) : "-";

  // Animate moisture gauge from 0 to the current value on first load and on updates.
  useEffect(() => {
    const target = Number.isFinite(moistureNum) ? moistureNum : 0;
    setMoistureGaugeValue(0);
    const timer = setTimeout(() => setMoistureGaugeValue(target), 80);
    return () => clearTimeout(timer);
  }, [moistureNum]);

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

    if (which === "accuracy") {
      payload.title = accuracyTitle;
      payload.equation = "Accuracy (%) = (Experimental Stress / Reference Stress) x 100";
      payload.steps = [
        `= (${f2(exp)} / ${f2(ref)}) x 100`,
      ];
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

    if (!payload.title) return;
    setEqPayload(payload);
    setEqOpen(true);
  }

  return (
    <div className={`w-full h-full flex flex-col ${shell}`} style={{ fontFamily: "Segoe UI, system-ui, sans-serif" }}>
      <div className={["sticky top-0 z-20 border-b", border, headerSurface].join(" ")}>
        <div className="flex items-center justify-between px-4 py-3">
          <div className="min-w-0">
            <div
              className="text-lg font-bold truncate"
              style={{ color: darkMode ? "#e5ecff" : PALETTE.primary }}
            >
              {headerLine}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowDates(true)}
              className={[
                "h-8 w-8 rounded-full inline-flex items-center justify-center border text-sm font-bold select-none",
                darkMode ? "border-blue-400 text-blue-100" : "border-blue-700 text-blue-800",
              ].join(" ")}
              aria-label={`Test ${createdAt}, Modified ${updatedAt}`}
            >
              i
            </button>
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
        <div
          className={`rounded-2xl border ${border} ${darkMode ? PALETTE.darkCard : PALETTE.lightCard} px-3 md:px-4 pb-3 md:pb-4`}
          style={{ paddingBottom: "0", paddingTop: "11px" }}
        >
          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-0 md:gap-4 items-stretch">
            <div className="rounded-xl p-2 md:p-3 h-full flex flex-col">
              <div
                className="text-sm font-bold text-blue-900 dark:text-blue-200 mb-2"
                style={{ color: darkMode ? undefined : PALETTE.primary }}
              >
                {accuracyTitle}
              </div>
              <div className="flex items-center justify-center py-2.5">
                <div className="w-full h-full max-w-[195px] mx-auto">
                  <GaugeChart
                    value={n2(computed.accuracy)}
                    label="Accuracy"
                    color={colorForPercent(n2(computed.accuracy), "accuracy")}
                    darkMode={darkMode}
                    donut
                  />
                </div>
              </div>
              <div className="mt-2 flex justify-start">
                <button
                  type="button"
                  onClick={() => openEquation("accuracy")}
                  className="h-[31px] px-2.5 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700"
                >
                  View details
                </button>
              </div>
            </div>

            <div className="hidden md:flex items-center justify-center">
              <div className={`${divider} border-l-2 h-[92%]`}></div>
            </div>

            <div className="rounded-none p-2 md:p-3">
              <div
                className="text-sm font-bold text-blue-900 dark:text-blue-200 mb-2"
                style={{ color: darkMode ? undefined : PALETTE.primary }}
              >
                Moisture Content
              </div>
              <div className="flex items-center justify-center py-2.5">
                <div className="w-full h-full max-w-[195px] mx-auto">
                  <GaugeChart
                    value={moistureGaugeValue}
                    label="Moisture"
                    color={colorForPercent(Number.isFinite(moistureNum) ? moistureNum : 0, "moisture")}
                    darkMode={darkMode}
                    donut
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Number cards in one container with divider */}
        <div className={`rounded-2xl border ${border} ${darkMode ? PALETTE.darkCard : PALETTE.lightCard} p-3 md:p-4`}>
          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-4 md:gap-6 items-stretch">
            {/* Experimental */}
            <div className="relative flex flex-col h-full pr-16">
              <button
                type="button"
                onClick={() => openEquation("expStress")}
                className="absolute top-0 right-0 h-9 px-3 rounded-lg text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700"
              >
                View equation
              </button>
              <div className={darkMode ? "text-gray-300 text-[11px] font-extrabold tracking-wide" : "text-gray-600 text-[11px] font-extrabold tracking-wide"}>
                Experimental Stress
              </div>
              <div className={["mt-1 flex items-baseline gap-2", darkMode ? "text-blue-300" : "text-blue-700"].join(" ")}>
                <div className="text-[30px] font-bold tabular-nums">{n2(computed.exp).toFixed(2)}</div>
                <div className={darkMode ? "text-gray-300 text-[12px] font-bold" : "text-gray-600 text-[12px] font-bold"}>MPa</div>
              </div>
              <div className={darkMode ? "text-[11px] text-gray-400 mt-2" : "text-[11px] text-gray-500 mt-2"}>Computed from P & geometry</div>
            </div>

            {/* Divider */}
            <div className="flex items-center justify-center">
              <div className={`border-l-2 ${divider} h-[92%]`}></div>
            </div>

            {/* Reference */}
            <div className="relative flex flex-col h-full pr-16 md:pl-2">
              <button
                onClick={() => setShowComparison(true)}
                className="absolute top-0 right-0 h-9 px-3 rounded-lg text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700"
                title="Compare reference"
              >
                Compare
              </button>
              <div className={darkMode ? "text-gray-300 text-[11px] font-extrabold tracking-wide" : "text-gray-600 text-[11px] font-extrabold tracking-wide"}>
                Reference Stress
              </div>
              <div className={["mt-1 flex items-baseline gap-2", darkMode ? "text-blue-300" : "text-blue-700"].join(" ")}>
                <div className="text-[30px] font-bold tabular-nums">{n2(computed.ref).toFixed(2)}</div>
                <div className={darkMode ? "text-gray-300 text-[12px] font-bold" : "text-gray-600 text-[12px] font-bold"}>MPa</div>
              </div>
              <div className={darkMode ? "text-[11px] text-gray-400 mt-2" : "text-[11px] text-gray-500 mt-2"}>Species table value</div>
            </div>
          </div>
        </div>

        {/* Specimen metrics */}
        <div className={`rounded-2xl border ${border} ${darkMode ? PALETTE.darkCard : PALETTE.lightCard} p-3 md:p-4`}>
          <div
            className="text-sm font-bold text-blue-900 dark:text-blue-200 mb-3"
            style={{ color: darkMode ? undefined : PALETTE.primary }}
          >
            Specimen Metrics
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              { label: "Width", value: `${n2(computed.base).toFixed(2)} mm` },
              { label: "Height", value: `${n2(computed.height).toFixed(2)} mm` },
              { label: "Length", value: `${n2(computed.length).toFixed(2)} mm` },
              { label: "Area", value: `${n2(computed.area).toFixed(2)} mmÂ²` },
              { label: "Pressure", value: `${n2(computed.bar).toFixed(2)} bar` },
              { label: "Derived Point Load", value: `${n2(computed.P).toFixed(2)} N` },
              {
                label: "Max Force",
                value: Number.isFinite(n2(currentData?.max_force, NaN))
                  ? `${n2(currentData?.max_force).toFixed(2)} N`
                  : "â€”",
              },
              { label: "Stress", value: `${n2(computed.exp).toFixed(2)} MPa` },
            ].map((m, i) => (
              <div
                key={i}
                className={[
                  "rounded-xl p-3 border",
                  darkMode ? "border-[#1f3252] bg-white/5" : "border-[#c9d4e8] bg-black/5",
                ].join(" ")}
              >
                <div className={darkMode ? "text-[11px] font-extrabold text-gray-300 tracking-wide" : "text-[11px] font-extrabold text-gray-600 tracking-wide"}>
                  {m.label}
                </div>
                <div className={darkMode ? "text-[18px] font-bold text-gray-100 mt-1" : "text-[18px] font-bold text-gray-900 mt-1"}>
                  {m.value}
                </div>
              </div>
            ))}
          </div>
        </div>

        {showComparison ? (
          <div className="fixed inset-0 z-[120] bg-black/70 flex items-center justify-center p-4" onClick={() => setShowComparison(false)}>
            <div
              className="w-full max-w-5xl max-h-[90vh] bg-white dark:bg-[#0f192d] rounded-2xl shadow-2xl overflow-hidden border border-gray-200 dark:border-[#1f3252]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-[#1f3252]">
                <div className="font-bold text-sm">Comparison</div>
                <button
                  onClick={() => {
                    setShowComparison(false);
                    refreshSpecimenData();
                  }}
                  className="h-9 px-3 rounded-lg text-sm font-semibold bg-gray-200 dark:bg-gray-800 text-gray-900 dark:text-gray-100 hover:bg-gray-300 dark:hover:bg-gray-700"
                >
                  Close
                </button>
              </div>
              <div className="max-h-[80vh] overflow-y-auto">
                <SpecimenComparison
                  data={currentData}
                  dataType={dataType}
                  darkMode={darkMode}
                  onClose={() => {
                    setShowComparison(false);
                    refreshSpecimenData();
                  }}
                />
              </div>
            </div>
          </div>
        ) : null}

        {showDates ? (
          <div className="fixed inset-0 z-[130] bg-black/60 flex items-center justify-center p-4" onClick={() => setShowDates(false)}>
            <div
              className={["w-full max-w-sm rounded-2xl border shadow-2xl overflow-hidden", modalPanel].join(" ")}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: darkMode ? "#1f3252" : "#e5e7eb" }}>
                <div className="text-sm font-bold">Test Info</div>
                <button
                  onClick={() => setShowDates(false)}
                  className={["h-8 w-8 rounded-lg flex items-center justify-center", modalButton].join(" ")}
                  aria-label="Close test info"
                >
                  ×
                </button>
              </div>
              <div className="px-4 py-3 text-sm font-semibold space-y-2">
                <div>Test: {createdAt}</div>
                <div>Modified: {updatedAt}</div>
              </div>
            </div>
          </div>
        ) : null}
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
