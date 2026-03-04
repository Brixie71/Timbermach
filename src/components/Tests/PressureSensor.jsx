import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * Strength test simulator (pressure-focused).
 * Produces a peak pressure in MPa and the derived force in kN so it can be saved
 * with the same payload shape TestSummary expects.
 */

const randIn = (min, max) => min + Math.random() * (max - min);

const deriveGeometry = (testType, subType, m = {}) => {
  const base = Number(m.width || m.base || 0);
  const height = Number(m.height || 0);
  const length = Number(m.length || 0);
  const areaMM2 = Number(m.areaMM2 || m.area || (base && height ? base * height : 0));
  const type = String(testType || "").toLowerCase().replace(" test", "").trim();
  const sub = String(subType || "").toLowerCase();

  let contactArea = areaMM2;
  if (type === "compressive") {
    contactArea = sub === "perpendicular" ? base * length : base * height;
  } else if (type === "shear") {
    contactArea = base * length;
    if (sub === "double") contactArea *= 2;
  }

  return { base, height, length, contactArea, type, sub };
};

const computeForceFromStress = ({ type, base, height, length, contactArea }, stressMPa) => {
  // stressMPa == N/mm²
  if (type === "flexure") {
    // Ïƒ = 3 P L / (2 b h²)  =>  P = Ïƒ * 2 b h² / (3 L)
    if (!base || !height || !length) return 0;
    return (stressMPa * 2 * base * height * height) / (3 * length); // N
  }
  const area = contactArea || 0;
  return area > 0 ? stressMPa * area : 0; // N
};

const pickStressRange = (type, sub) => {
  if (type === "flexure") return [20, 65];
  if (type === "shear") return sub === "double" ? [8, 28] : [6, 24];
  if (type === "compressive") return sub === "perpendicular" ? [4, 18] : [10, 38];
  return [8, 30];
};

const PressureSensor = ({
  testType,
  subType,
  measurementData,
  onPreviousTest = () => {},
  onMainPageReturn = () => {},
  onTestComplete = () => {},
}) => {
  const [pressureMPa, setPressureMPa] = useState(0);
  const [peak, setPeak] = useState(null); // { stressMPa, forceKN, durationMs }
  const [isRunning, setIsRunning] = useState(false);
  const animRef = useRef(null);

  const geom = useMemo(() => deriveGeometry(testType, subType, measurementData), [testType, subType, measurementData]);

  useEffect(() => () => animRef.current && cancelAnimationFrame(animRef.current), []);

  const simulateRun = () => {
    const [lo, hi] = pickStressRange(geom.type, geom.sub);
    const targetStress = Math.min(randIn(lo, hi), 100); // cap at 100 MPa (1000 bar)
    const forceN = computeForceFromStress(geom, targetStress);
    const targetKN = forceN / 1000;

    const durationMs = 1500 + Math.random() * 800;
    const start = performance.now();
    setIsRunning(true);
    setPeak(null);

    const tick = (now) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out
      setPressureMPa(targetStress * eased);
      if (t < 1) {
        animRef.current = requestAnimationFrame(tick);
      } else {
        setIsRunning(false);
        setPeak({
          stressMPa: targetStress,
          forceKN: targetKN,
          durationMs: durationMs,
          timestamp: new Date().toISOString(),
        });
      }
    };
    animRef.current = requestAnimationFrame(tick);
  };

  const handleSave = () => {
    if (!peak) return;
    const pressureBar = peak.stressMPa * 10; // 1 MPa = 10 bar
    const forceN = peak.forceKN * 1000;
    const payload = {
      maxPressureMPa: peak.stressMPa,
      pressureMPa: peak.stressMPa,
      pressure_bar: pressureBar,
      maxForce: forceN,
      forceKN: peak.forceKN,
      duration: peak.durationMs / 1000,
      timestamp: peak.timestamp,
      testType,
      subType,
      simulated: true,
      note: "Simulated strength run (pressure focus)",
    };
    onTestComplete?.(payload);
  };

  const cappedMPa = Math.min(pressureMPa, 100); // 0–100 MPa (1000 bar)
  const gaugePercent = cappedMPa; // percent of 100 MPa span
  const redArcLength = 440 * 0.1; // last 10% (90–100 MPa) shown in red
  const redArcOffset = 464 - 440 * 0.9; // position the red band at the top end

  return (
    <div className="w-full h-full flex flex-col bg-gray-900 text-gray-50">
      <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-gray-400">Pressure Sensor (simulated)</div>
          <div className="text-2xl font-bold">
            {testType || "Test"} {subType ? `· ${subType}` : ""}
          </div>
          <div className="text-sm text-gray-400">Generates a peak pressure (0–100 MPa / 0–1000 bar) and derived kN for saving.</div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onPreviousTest}
            className="px-3 py-2 rounded-lg border border-gray-700 hover:border-gray-500 text-sm font-semibold"
          >
            Back
          </button>
          <button
            onClick={onMainPageReturn}
            className="px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm font-semibold border border-gray-700"
          >
            Home
          </button>
        </div>
      </div>

      <div className="flex-1 p-5 flex flex-col gap-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 bg-gray-800 border border-gray-700 rounded-2xl p-4 flex flex-col items-center justify-center">
            <div className="relative w-full max-w-md aspect-[2/1]">
              <svg viewBox="0 -9 200 200" className="absolute inset-0">
                <path d="M 40,170 A 90,90 0 1,1 160,170" fill="none" stroke="#4B5563" strokeWidth="20" strokeLinecap="round" />
                <path
                  d="M 40,170 A 90,90 0 1,1 160,170"
                  fill="none"
                  stroke="#ef4444"
                  strokeWidth="20"
                  strokeDasharray={`${redArcLength} 440`}
                  strokeDashoffset={redArcOffset}
                  strokeLinecap="round"
                  opacity="0.65"
                />
                <path
                  d="M 40,170 A 90,90 0 1,1 160,170"
                  fill="none"
                  stroke="#3b82f6"
                  strokeWidth="20"
                  strokeDasharray="460"
                  strokeDashoffset={464 - (gaugePercent / 100) * 440}
                  className="transition-all duration-200 ease-out"
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className="text-4xl font-black tabular-nums">{pressureMPa.toFixed(2)}</div>
                <div className="text-sm text-gray-400">MPa</div>
                <div className="text-xs text-gray-500 mt-1">0–100 MPa (1000 bar) scale</div>
              </div>
            </div>
            <div className="mt-3 text-xs text-gray-400 text-center">
              Simulated pressure ramp over ~2s to a random peak based on geometry and test type.
            </div>
          </div>

          <div className="w-full md:w-[320px] bg-gray-800 border border-gray-700 rounded-2xl p-4 flex flex-col gap-3">
            <div>
              <div className="text-sm font-semibold text-gray-200">Specimen geometry</div>
              <div className="text-xs text-gray-400 mt-1">
                b = {geom.base || "—"} mm · h = {geom.height || "—"} mm · L = {geom.length || "—"} mm
              </div>
              <div className="text-xs text-gray-400">
                Contact area (mode-aware): {geom.contactArea ? `${geom.contactArea.toFixed(1)} mm²` : "—"}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={simulateRun}
                disabled={isRunning}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-semibold ${
                  isRunning ? "bg-gray-700 text-gray-400" : "bg-blue-600 hover:bg-blue-700 text-white"
                }`}
              >
                {isRunning ? "Simulating..." : "Simulate run"}
              </button>
              <button
                onClick={handleSave}
                disabled={!peak}
                className={`px-3 py-2 rounded-lg text-sm font-semibold ${
                  peak ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "bg-gray-700 text-gray-400"
                }`}
              >
                Save result
              </button>
            </div>

            <div className="text-xs text-gray-400">
              {peak ? (
                <>
                  Peak: <span className="text-gray-100 font-semibold">{peak.stressMPa.toFixed(2)} MPa</span> ·{" "}
                  <span className="text-gray-100 font-semibold">{peak.forceKN.toFixed(2)} kN</span> ·{" "}
                  {(peak.durationMs / 1000).toFixed(2)} s
                  <div className="text-[11px] text-gray-500 mt-1">Timestamp: {new Date(peak.timestamp).toLocaleString()}</div>
                </>
              ) : (
                "Run a simulation to generate a result."
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PressureSensor;
