import React, { useEffect, useMemo, useRef, useState } from "react";
import { Settings2, Save, RefreshCcw } from "lucide-react";
import { FLASK_BASE_URL, LARAVEL_BASE_URL } from "../../config/servers";

const PY_API = FLASK_BASE_URL;
const LARAVEL_API = LARAVEL_BASE_URL;

const DEFAULT_PARAMS = {
  threshold1: 52,
  threshold2: 104,
  min_area: 1000,
  blur_kernel: 21,
  dilation: 1,
  erosion: 1,
  roi_size: 60,
  roi_shape: "square", // square (parallel) | rectangle (perpendicular)
  brightness: 0,
  contrast: 101,
  mm_per_pixel: 0.1288,
  edge_thickness: 2,
  denoise_enabled: true,
  denoise_h: 6, // 3-10 good range
  denoise_template: 7, // odd
  denoise_search: 21, // odd
};

const CAMERA_LABELS = {
  flexure: "UVC Camera (12d1:4321)", // front camera
  compressive: "A4ech FHD 1080P PC Camera (09da:2704)", // back camera
  shear: "A4ech FHD 1080P PC Camera (09da:2704)", // back camera
};

const PARAM_PRESETS = {
  flexure: { mm_per_pixel: 0.1568, roi_size: 70 },
  compressive: { mm_per_pixel: 0.1288, roi_size: 65 },
  shear: { mm_per_pixel: 0.1288, roi_size: 65 },
};

const FLEXURE_LENGTH_MM = 584.2; // 23 inches fixed span

// UI length choices requested
const LENGTH_CHOICES_IN = [4, 9];
const inchToMm = (inch) => inch * 25.4;
const HEIGHT_CHOICES_IN = [1, 2, 3];


function prettyTestTitle(testType, subType) {
  const t = String(testType || "").toLowerCase();
  const s = String(subType || "").toLowerCase();

  if (t === "compressive") {
    if (s === "perpendicular") return "Compressive - Perpendicular to Grain";
    return "Compressive - Parallel to Grain";
  }
  if (t === "shear") {
    if (s === "double") return "Shear - Double";
    return "Shear - Single";
  }
  if (t === "flexure") return "Flexure - Fixed Span";
  return "Measurement";
}

function areaRuleText(testType, subType) {
  const t = String(testType || "").toLowerCase();
  const s = String(subType || "").toLowerCase();

  if (t === "compressive") {
    if (s === "perpendicular") return "Area = L x W(base)";
    return "Area = W(base) x H";
  }
  if (t === "shear") {
    if (s === "double") return "Area = (W(base) x L) x 2";
    return "Area = W(base) x L";
  }
  if (t === "flexure") return "Area display = W(base) x L (span)";
  return "Area = W x H";
}

function LengthSetupModal({
  open,
  darkMode,
  testType,
  subType,
  lengthChoiceIn,
  setLengthChoiceIn,
  heightChoiceIn,
  setHeightChoiceIn,
  onConfirm,
}) {
  if (!open) return null;

  const panel = darkMode
    ? "bg-gray-900/90 border-gray-800 text-gray-100"
    : "bg-white/90 border-gray-200 text-gray-900";

  const border = darkMode ? "border-gray-800" : "border-gray-200";
  const subtle = darkMode ? "text-gray-300" : "text-gray-600";

  const t = String(testType || "").toLowerCase();
  const s = String(subType || "").toLowerCase();
  const isPerpendicular = t === "compressive" && s === "perpendicular";

  const isFlexure = t === "flexure";
  const title = prettyTestTitle(testType, subType);

  return (
    <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-3">
      <div
        className={[
          "w-full max-w-2xl rounded-2xl border shadow-2xl overflow-hidden",
          panel,
        ].join(" ")}
      >
        <div className={["px-5 py-4 border-b", border].join(" ")}>
          <div className="text-[12px] font-extrabold tracking-widest uppercase opacity-90">
            Pre-test setup
          </div>
          <div className="text-[18px] font-black mt-1">{title}</div>
          <div className={["text-[12px] mt-1", subtle].join(" ")}>
            Select the specimen size options so the system computes the correct
            contact area for this test.
          </div>
        </div>

        <div className="p-5 space-y-4">
          <div
            className={[
              "rounded-xl border p-4",
              darkMode ? "border-gray-800 bg-white/5" : "border-gray-200 bg-black/2",
            ].join(" ")}
          >
            <div className="text-[12px] font-extrabold tracking-wide opacity-90">
              Area rule
            </div>
            <div className="text-[16px] font-black mt-1">
              {areaRuleText(testType, subType)}
            </div>

            {t === "compressive" && s === "perpendicular" ? (
              <div className={["text-[12px] mt-2 leading-snug", subtle].join(" ")}>
                Perpendicular note: specimen is lying down. The face in contact is
                based on <b>Length x Base</b>, not Base x Height.
              </div>
            ) : null}

            {t === "shear" && s === "double" ? (
              <div className={["text-[12px] mt-2 leading-snug", subtle].join(" ")}>
                Double shear note: contact is like a "C plate" pressing down - the
                model uses <b>2 x (W x L)</b>.
              </div>
            ) : null}
          </div>

          {!isPerpendicular ? (
            <div
              className={[
                "rounded-xl border p-4",
                darkMode ? "border-gray-800 bg-white/5" : "border-gray-200 bg-black/2",
              ].join(" ")}
            >
              <div className="text-[12px] font-extrabold tracking-wide opacity-90">
                Specimen Length (L)
              </div>

              {isFlexure ? (
                <>
                  <div className="text-[18px] font-black mt-1">
                    Fixed: {FLEXURE_LENGTH_MM.toFixed(1)} mm (23 inches)
                  </div>
                  <div className={["text-[12px] mt-1", subtle].join(" ")}>
                    Flexure uses a fixed span. No selection needed.
                  </div>
                </>
              ) : (
                <>
                  <div className={["text-[12px] mt-2", subtle].join(" ")}>
                    Choose the length based on your specimen category:
                    <br />
                    - Parallel to grain (Compressive/Shear): pick 4" or 9"
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-3">
                    {LENGTH_CHOICES_IN.map((opt) => {
                      const active = Number(lengthChoiceIn) === Number(opt);
                      return (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => setLengthChoiceIn(opt)}
                          className={[
                            "rounded-xl border px-4 py-3 text-left transition active:scale-[0.99]",
                            darkMode ? "border-gray-800" : "border-gray-200",
                            active
                              ? darkMode
                                ? "bg-blue-500/20 text-blue-200"
                                : "bg-blue-50 text-blue-700"
                              : darkMode
                                ? "hover:bg-white/5"
                                : "hover:bg-black/5",
                          ].join(" ")}
                        >
                          <div className="text-[12px] font-extrabold uppercase tracking-wide opacity-90">
                            Option
                          </div>
                          <div className="text-[18px] font-black mt-1">
                            {opt} inches
                          </div>
                          <div className={["text-[12px] mt-1", subtle].join(" ")}>
                            = {inchToMm(opt).toFixed(1)} mm
                          </div>
                        </button>
                      );
                    })}
            </div>
                </>
              )}
            </div>
          ) : null}
          {isPerpendicular ? (
            <div
              className={[
                "rounded-xl border p-4",
                darkMode ? "border-gray-800 bg-white/5" : "border-gray-200 bg-black/2",
              ].join(" ")}
            >
              <div className="text-[12px] font-extrabold tracking-wide opacity-90">
                Specimen Height (H)
              </div>
              <div className={["text-[12px] mt-2", subtle].join(" ")}>
                Facing length/base, so choose height: 1", 2", or 3".
              </div>
              <div className="mt-3 grid grid-cols-3 gap-3">
                {HEIGHT_CHOICES_IN.map((opt) => {
                  const active = Number(heightChoiceIn) === Number(opt);
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setHeightChoiceIn(opt)}
                      className={[
                        "rounded-xl border px-3 py-3 text-left transition active:scale-[0.99]",
                        darkMode ? "border-gray-800" : "border-gray-200",
                        active
                          ? darkMode
                            ? "bg-blue-500/20 text-blue-200"
                            : "bg-blue-50 text-blue-700"
                          : darkMode
                            ? "hover:bg-white/5"
                            : "hover:bg-black/5",
                      ].join(" ")}
                    >
                      <div className="text-[12px] font-extrabold uppercase tracking-wide opacity-90">
                        Height
                      </div>
                      <div className="text-[18px] font-black mt-1">{opt} inches</div>
                      <div className={["text-[12px] mt-1", subtle].join(" ")}>
                        = {inchToMm(opt).toFixed(1)} mm
                      </div>
                    </button>
                  );
                })}
            </div>
            </div>
          ) : null}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onConfirm}
              className={[
                "px-5 py-3 rounded-xl font-extrabold text-[13px] transition active:scale-[0.99]",
                darkMode
                  ? "bg-blue-500/30 text-blue-100 hover:bg-blue-500/40"
                  : "bg-blue-600 text-white hover:bg-blue-700",
              ].join(" ")}
            >
              Confirm & Start
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Measurement({
  onPreviousTest,
  onMainPageReturn,
  onTestComplete,
  testType = "flexure",
  subType = "",
}) {
  const videoRef = useRef(null);
  const snapCanvasRef = useRef(null);

  const [stream, setStream] = useState(null);
  const [cameraReady, setCameraReady] = useState(false);

  const [params, setParams] = useState(DEFAULT_PARAMS);
  const [panelOpen, setPanelOpen] = useState(true);

  const [overlayBase64, setOverlayBase64] = useState(null);
  const [result, setResult] = useState(null);
  const [measurement, setMeasurement] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [cameraLabelUsed, setCameraLabelUsed] = useState("");

  // NEW: Length setup state
  const [lengthSetupOpen, setLengthSetupOpen] = useState(true);
  const [lengthChoiceIn, setLengthChoiceIn] = useState(9); // default 9"
  const [lengthLocked, setLengthLocked] = useState(false);
  const [heightChoiceIn, setHeightChoiceIn] = useState(3); // default 3"

  const tLower = String(testType || "").toLowerCase();
  const sLower = String(subType || "").toLowerCase();

  // Request 1920x1080 but scale full-screen using CSS
  const VIDEO_CONSTRAINTS = {
    audio: false,
    video: {
      width: { ideal: 1920 },
      height: { ideal: 1080 },
    },
  };

  // Load parameter preset when testType changes
  useEffect(() => {
    const preset = PARAM_PRESETS[tLower] || {};
    setParams((p) => ({ ...p, ...preset }));

    // open length setup each time test changes (except flexure fixed)
    if (tLower === "flexure") {
      setLengthChoiceIn(9);
      setLengthLocked(true);
      setLengthSetupOpen(false);
      setHeightChoiceIn(3);
    } else {
      setLengthLocked(false);
      setLengthSetupOpen(true);
      setHeightChoiceIn(3);
    }

    // reset measurement UI
    setOverlayBase64(null);
    setResult(null);
    setMeasurement(null);
    setErr(null);

    // Default ROI shape per mode
    setParams((p) => ({
      ...p,
      roi_shape:
        tLower === "compressive" && sLower === "perpendicular"
          ? "rectangle"
          : "square",
    }));
  }, [tLower, sLower]);

  // Selected length in mm (fixed for flexure)
  const selectedLengthMM = useMemo(() => {
    if (tLower === "flexure") return FLEXURE_LENGTH_MM;
    return inchToMm(Number(lengthChoiceIn) || 0);
  }, [tLower, lengthChoiceIn]);

  // UPDATED: use selected length (instead of dominant side squared)
  const computeAutoLengthMM = () => {
    if (tLower === "flexure") return FLEXURE_LENGTH_MM;
    if (tLower === "compressive" && sLower === "perpendicular") return null;
    if (tLower === "compressive" || tLower === "shear") return selectedLengthMM;
    return null;
  };

  const computeAreaMM2 = (widthMM, heightMM, lengthMM) => {
    const t = tLower;
    const s = sLower;

    if (t === "compressive") {
      // Perpendicular: Area = L x W(base)
      if (s === "perpendicular" && lengthMM) return widthMM * lengthMM;
      // Parallel: Area = W x H
      return widthMM * heightMM;
    }

    if (t === "shear") {
      // Single: W x L, Double: (W x L) x 2
      if (lengthMM) {
        const base = widthMM * lengthMM;
        return s === "double" ? base * 2 : base;
      }
      return widthMM * heightMM;
    }

    if (t === "flexure") {
      const span = lengthMM || FLEXURE_LENGTH_MM;
      return widthMM * span;
    }

    return widthMM * heightMM;
  };

  const buildMeasurementPayload = (best, paramsUsed = {}) => {
    if (!best) return null;

    const measuredWidthMM =
      typeof best.rect_width_mm === "number"
        ? best.rect_width_mm
        : best.width_mm || 0;

    const measuredHeightMM =
      typeof best.rect_height_mm === "number"
        ? best.rect_height_mm
        : best.height_mm || 0;

    const isPerpendicular = tLower === "compressive" && sLower === "perpendicular";
    let widthMM = measuredWidthMM;
    let heightMM = measuredHeightMM;
    let lengthMM = computeAutoLengthMM();

    if (isPerpendicular) {
      const baseMM = Math.min(measuredWidthMM, measuredHeightMM);
      const lengthDetectedMM = Math.max(measuredWidthMM, measuredHeightMM);
      widthMM = baseMM;
      lengthMM = lengthDetectedMM;
      heightMM = inchToMm(Number(heightChoiceIn) || 0);
    }

    const areaMM2 = computeAreaMM2(widthMM, heightMM, lengthMM || undefined);
    return {
      width: widthMM,
      height: heightMM,
      base: widthMM,
      length: lengthMM || null,
      areaMM2: areaMM2 || 0,
      area: areaMM2 || 0,
      areaIN2: areaMM2 ? areaMM2 / 645.16 : 0,
      widthInches: widthMM / 25.4,
      heightInches: heightMM / 25.4,
      lengthInches: lengthMM ? lengthMM / 25.4 : null,
      testType,
      subType,
      bbox: best.bbox,
      angle: best.angle,
      rectWidth: best.rect_width_mm,
      rectHeight: best.rect_height_mm,
      mmPerPixel: paramsUsed.mm_per_pixel ?? params.mm_per_pixel,
      timestamp: new Date().toISOString(),
      camera: cameraLabelUsed || "default",
    };
  };

  const areaMM2Display =
    measurement?.areaMM2 ??
    (result?.width_mm && result?.height_mm ? result.width_mm * result.height_mm : 0);
  const areaIN2Display = areaMM2Display ? areaMM2Display / 645.16 : 0;

  const latestMeasurementSnapshot = () => {
    const hasMeasurement = !!measurement || !!result;
    if (!hasMeasurement) return null;

    const baseMM =
      measurement?.width ?? result?.rect_width_mm ?? result?.width_mm ?? null;
    const heightMM =
      measurement?.height ?? result?.rect_height_mm ?? result?.height_mm ?? null;
    const lengthMM = measurement?.length ?? null;

    const areaMM2 =
      measurement?.areaMM2 ??
      (result?.width_mm && result?.height_mm
        ? result.width_mm * result.height_mm
        : null);
    const areaIN2 = areaMM2 ? areaMM2 / 645.16 : null;

    return {
      testType,
      subType,
      base_mm: baseMM,
      height_mm: heightMM,
      length_mm: lengthMM,
      area_mm2: areaMM2,
      area_in2: areaIN2,
    };
  };

  const stopCamera = () => {
    try {
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
    } catch {}
    setStream(null);
    setCameraReady(false);
  };

  const startCamera = async () => {
    setErr(null);
    setCameraReady(false);

    const cameraKey = tLower;
    const desiredLabel =
      CAMERA_LABELS[cameraKey] || CAMERA_LABELS.compressive;

    const buildConstraints = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter((d) => d.kind === "videoinput");
        const match = videoDevices.find(
          (d) => d.label && desiredLabel && d.label.includes(desiredLabel)
        );

        if (match) {
          setCameraLabelUsed(match.label || desiredLabel);
          return {
            audio: false,
            video: {
              ...VIDEO_CONSTRAINTS.video,
              deviceId: { exact: match.deviceId },
            },
          };
        }
      } catch {
        // ignore
      }
      setCameraLabelUsed(desiredLabel || "");
      return VIDEO_CONSTRAINTS;
    };

    try {
      stopCamera();
      const constraints = await buildConstraints();
      const s = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(s);

      const video = videoRef.current;
      if (video) {
        video.srcObject = s;
        await video.play();
        setCameraReady(true);
      }
    } catch (e) {
      setErr(e?.message || "Failed to start camera");
      setCameraReady(false);
    }
  };

  // Start camera only AFTER length setup confirmed (except flexure auto)
  useEffect(() => {
    if (tLower === "flexure") {
      startCamera();
      return () => stopCamera();
    }

    if (lengthLocked) {
      startCamera();
      return () => stopCamera();
    }

    return () => stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tLower, sLower, lengthLocked]);

  const loadSettings = async () => {
    setErr(null);
    try {
      const res = await fetch(`${LARAVEL_API}/api/measurement-settings/active`);
      if (!res.ok) return; // don't hard-fail if endpoint not added yet
      const data = await res.json();
      const shapeForMode = tLower === "compressive" && sLower === "perpendicular" ? "rectangle" : "square";
      const merged = { ...DEFAULT_PARAMS, ...data, roi_shape: shapeForMode };
      if (merged.blur_kernel % 2 === 0) merged.blur_kernel += 1;
      setParams(merged);
    } catch {
      // silently ignore until your Laravel endpoint exists
    }
  };

  const saveSettings = async () => {
    setErr(null);
    const snapshot = latestMeasurementSnapshot();
    const payload = snapshot ? { ...params, last_measurement: snapshot } : params;
    try {
      const res = await fetch(`${LARAVEL_API}/api/measurement-settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || "Failed to save settings");
      }
    } catch (e) {
      setErr(e?.message || "Failed to save settings");
    }
  };

  // Load saved detection params on mount so measurements reuse the latest calibration
  useEffect(() => {
    loadSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const snapAndMeasure = async () => {
    setBusy(true);
    setErr(null);
    setOverlayBase64(null);
    setResult(null);
    setMeasurement(null);

    try {
      const video = videoRef.current;
      const canvas = snapCanvasRef.current;
      if (!video || !canvas || !cameraReady)
        throw new Error("Camera not ready");

      // draw current frame at actual video size
      const w = video.videoWidth || 1280;
      const h = video.videoHeight || 720;
      canvas.width = w;
      canvas.height = h;

      const ctx = canvas.getContext("2d");
      ctx.drawImage(video, 0, 0, w, h);

      const blob = await new Promise((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", 0.92)
      );
      if (!blob) throw new Error("Failed to capture frame");

      const form = new FormData();
      form.append("image", blob, "snap.jpg");
      form.append("params", JSON.stringify({ ...params, testType, subType }));
      form.append("testType", testType);
      form.append("subType", subType);

      const res = await fetch(`${PY_API}/shape-detect/measure`, {
        method: "POST",
        body: form,
      });

      if (!res.ok) {
        const t = await res.text();
        const msg =
          t && t.trim().startsWith("<")
            ? `HTTP ${res.status} ${res.statusText || "Error"}`
            : t;
        throw new Error(msg || "Detect failed");
      }

      const data = await res.json();

      if (!data.success) {
        if (data.overlayBase64) setOverlayBase64(data.overlayBase64);
        throw new Error(data.error || "Detection failed");
      }

      if (data.overlayBase64) setOverlayBase64(data.overlayBase64);

      const best = data.best || data;
      setResult(best);

      const payload = buildMeasurementPayload(best, data.paramsUsed || params);
      setMeasurement(payload);

      // send to parent (so you can store it / proceed)
      onTestComplete?.(payload);
    } catch (e) {
      setErr(e?.message || "Failed to measure");
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setOverlayBase64(null);
    setResult(null);
    setMeasurement(null);
    setErr(null);
  };

  // Basic theme (keep your existing look)
  const darkMode = true; // if you already pass darkMode in props, replace this line

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      {/* PRE-TEST LENGTH MODAL */}
      <LengthSetupModal
        open={lengthSetupOpen}
        darkMode={darkMode}
        testType={testType}
        subType={subType}
        lengthChoiceIn={lengthChoiceIn}
        setLengthChoiceIn={setLengthChoiceIn}
        heightChoiceIn={heightChoiceIn}
        setHeightChoiceIn={setHeightChoiceIn}
        onConfirm={() => {
          setLengthSetupOpen(false);
          setLengthLocked(true);
        }}
      />

      {/* Main container */}
      <div
        style={{
          width: "100%",
          height: "100%",
          background: darkMode ? "#0b1220" : "#f8fafc",
          color: darkMode ? "#e5e7eb" : "#111827",
        }}
      >
        {/* Header strip */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "10px 12px",
            borderBottom: darkMode ? "1px solid rgba(255,255,255,0.08)" : "1px solid #e5e7eb",
            background: darkMode ? "rgba(17,24,39,0.55)" : "rgba(255,255,255,0.8)",
            backdropFilter: "blur(10px)",
          }}
        >
          <div style={{ fontWeight: 900, letterSpacing: 0.2 }}>
            {prettyTestTitle(testType, subType)}
            </div>

          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <button
              onClick={loadSettings}
              title="Reload settings"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 10px",
                borderRadius: 10,
                border: darkMode ? "1px solid rgba(255,255,255,0.10)" : "1px solid #e5e7eb",
                background: darkMode ? "rgba(255,255,255,0.06)" : "#fff",
                color: "inherit",
                cursor: "pointer",
                fontWeight: 800,
                fontSize: 12,
              }}
            >
              <RefreshCcw size={16} /> Refresh
            </button>

            <button
              onClick={saveSettings}
              title="Save settings"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 10px",
                borderRadius: 10,
                border: darkMode ? "1px solid rgba(255,255,255,0.10)" : "1px solid #e5e7eb",
                background: darkMode ? "rgba(59,130,246,0.18)" : "rgba(59,130,246,0.10)",
                color: "inherit",
                cursor: "pointer",
                fontWeight: 900,
                fontSize: 12,
              }}
            >
              <Save size={16} /> Save
            </button>

            <button
              onClick={() => setPanelOpen((v) => !v)}
              title="Toggle settings panel"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 10px",
                borderRadius: 10,
                border: darkMode ? "1px solid rgba(255,255,255,0.10)" : "1px solid #e5e7eb",
                background: darkMode ? "rgba(255,255,255,0.06)" : "#fff",
                color: "inherit",
                cursor: "pointer",
                fontWeight: 800,
                fontSize: 12,
              }}
            >
              <Settings2 size={16} /> Params
            </button>
          </div>
        </div>

        {/* Body */}
        <div style={{ display: "grid", gridTemplateColumns: panelOpen ? "1fr 360px" : "1fr", height: "calc(100% - 52px)" }}>
          {/* Left: camera + overlay */}
          <div style={{ position: "relative", overflow: "hidden" }}>
            <video
              ref={videoRef}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
              muted
              playsInline
            />
            <canvas ref={snapCanvasRef} style={{ display: "none" }} />

            {overlayBase64 ? (
              <img
                alt="overlay"
                src={`data:image/png;base64,${overlayBase64}`}
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  pointerEvents: "none",
                }}
              />
            ) : null}

            {/* bottom controls */}
            <div
              style={{
                position: "absolute",
                left: 12,
                right: 12,
                bottom: 12,
                display: "flex",
                gap: 10,
                alignItems: "center",
              }}
            >
              <button
                onClick={snapAndMeasure}
                disabled={busy || !cameraReady || (tLower !== "flexure" && !lengthLocked)}
                style={{
                  flex: 1,
                  padding: "14px 14px",
                  borderRadius: 14,
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: busy ? "rgba(255,255,255,0.08)" : "rgba(59,130,246,0.35)",
                  color: "#fff",
                  fontWeight: 950,
                  cursor: busy ? "not-allowed" : "pointer",
                  letterSpacing: 0.2,
                }}
              >
                {busy ? "Measuring..." : "Snap & Measure"}
              </button>

              <button
                onClick={reset}
                style={{
                  padding: "14px 14px",
                  borderRadius: 14,
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: "rgba(255,255,255,0.06)",
                  color: "#fff",
                  fontWeight: 900,
                  cursor: "pointer",
                }}
              >
                Reset
              </button>

              <button
                onClick={() => {
                  stopCamera();
                  onMainPageReturn?.();
                }}
                style={{
                  padding: "14px 14px",
                  borderRadius: 14,
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: "rgba(239,68,68,0.28)",
                  color: "#fff",
                  fontWeight: 900,
                  cursor: "pointer",
                }}
              >
                Back
              </button>
            </div>

            {/* top-left badge */}
            <div
              style={{
                position: "absolute",
                top: 12,
                left: 12,
                padding: "8px 10px",
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.10)",
                background: "rgba(0,0,0,0.35)",
                fontSize: 12,
                fontWeight: 900,
              }}
            >
              {tLower === "compressive" && sLower === "perpendicular" ? (
                <>
                  Height (H): {inchToMm(Number(heightChoiceIn) || 0).toFixed(1)} mm ({Number(heightChoiceIn)}")
                </>
              ) : (
                <>
                  Length (L):{" "}
                  {tLower === "flexure"
                    ? `${FLEXURE_LENGTH_MM.toFixed(1)} mm`
                    : `${selectedLengthMM.toFixed(1)} mm (${Number(lengthChoiceIn)}")`}
                </>
              )}
            </div>
          </div>

          {/* Right panel */}
          {panelOpen ? (
            <div
              style={{
                borderLeft: darkMode
                  ? "1px solid rgba(255,255,255,0.08)"
                  : "1px solid #e5e7eb",
                padding: 12,
                overflow: "auto",
              }}
            >
              {/* error */}
              {err ? (
                <div
                  style={{
                    background: "rgba(239,68,68,0.15)",
                    border: "1px solid rgba(239,68,68,0.35)",
                    padding: 10,
                    borderRadius: 12,
                    fontWeight: 800,
                    fontSize: 12,
                    marginBottom: 10,
                  }}
                >
                  {err}
                </div>
              ) : null}

              {/* measurement summary */}
              <div
                style={{
                  border: "1px solid rgba(255,255,255,0.10)",
                  borderRadius: 14,
                  padding: 12,
                  background: "rgba(255,255,255,0.04)",
                }}
              >
                <div style={{ fontSize: 12, color: "#9ca3af", fontWeight: 900 }}>
                  Summary
                </div>

                {!result ? (
                  <div style={{ marginTop: 8, fontSize: 13, color: "#9ca3af" }}>
                    Take a snapshot to compute dimensions.
                  </div>
                ) : (
                  <>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
                      <div>
                        <div style={{ fontSize: 12, color: "#9ca3af" }}>Width</div>
                        <div style={{ fontSize: 20, fontWeight: 900 }}>
                          {(
                            measurement?.width ??
                            result.rect_width_mm ??
                            result.width_mm
                          ).toFixed(1)}{" "}
                          mm
                        </div>
                        <div style={{ fontSize: 11, color: "#9ca3af" }}>
                          {(
                            (measurement?.width ??
                              result.rect_width_mm ??
                              result.width_mm) / 25.4
                          ).toFixed(3)}
                          "
                        </div>
                      </div>

                      <div>
                        <div style={{ fontSize: 12, color: "#9ca3af" }}>Height</div>
                        <div style={{ fontSize: 20, fontWeight: 900 }}>
                          {(
                            measurement?.height ??
                            result.rect_height_mm ??
                            result.height_mm
                          ).toFixed(1)}{" "}
                          mm
                        </div>
                        <div style={{ fontSize: 11, color: "#9ca3af" }}>
                          {(
                            (measurement?.height ??
                              result.rect_height_mm ??
                              result.height_mm) / 25.4
                          ).toFixed(3)}
                          "
                        </div>
                      </div>

                      {measurement?.length ? (
                        <div>
                          <div style={{ fontSize: 12, color: "#9ca3af" }}>
                            Length (auto)
                          </div>
                          <div style={{ fontSize: 20, fontWeight: 900 }}>
                            {measurement.length.toFixed(1)} mm
                          </div>
                          <div style={{ fontSize: 11, color: "#9ca3af" }}>
                            {measurement.lengthInches?.toFixed(3)}"
                          </div>
                        </div>
                      ) : null}

                      <div>
                        <div style={{ fontSize: 12, color: "#9ca3af" }}>Area</div>
                        <div style={{ fontSize: 20, fontWeight: 900 }}>
                          {areaMM2Display.toFixed(1)} mm^2
                        </div>
                        <div style={{ fontSize: 11, color: "#9ca3af" }}>
                          {areaIN2Display.toFixed(3)} in^2
                        </div>
                      </div>
                    </div>

                    <div style={{ marginTop: 10, fontSize: 12, color: "#9ca3af", lineHeight: 1.4 }}>
                      Camera: {cameraLabelUsed || "default"} | mm/px:{" "}
                      {(measurement?.mmPerPixel ?? params.mm_per_pixel).toFixed(4)}
                      <br />
                      Area rule: {areaRuleText(testType, subType)}
                    </div>
                  </>
                )}
              </div>

              {/* settings controls placeholder (keep your existing controls below) */}
              <div style={{ marginTop: 16, fontSize: 12, color: "#9ca3af", fontWeight: 900 }}>
                Parameters
              </div>
              <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
                {[
                  { k: "threshold1", label: "Threshold 1", min: 0, max: 255, step: 1 },
                  { k: "threshold2", label: "Threshold 2", min: 0, max: 255, step: 1 },
                  { k: "min_area", label: "Min Area", min: 0, max: 20000, step: 10 },
                  { k: "blur_kernel", label: "Blur Kernel (odd)", min: 1, max: 51, step: 2 },
                  { k: "dilation", label: "Dilation", min: 0, max: 10, step: 1 },
                  { k: "erosion", label: "Erosion", min: 0, max: 10, step: 1 },
                  { k: "edge_thickness", label: "Edge Thickness", min: 1, max: 7, step: 1 },
                  { k: "brightness", label: "Brightness", min: -100, max: 100, step: 1 },
                  { k: "contrast", label: "Contrast", min: 0, max: 200, step: 1 },
                  { k: "mm_per_pixel", label: "mm per pixel", min: 0.001, max: 1.0, step: 0.001 },
                ].map(({ k, label, min, max, step }) => (
                  <label key={k} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <span style={{ fontSize: 11, color: "#9ca3af", fontWeight: 800 }}>{label}</span>
                    <input
                      type="number"
                      value={params[k]}
                      min={min}
                      max={max}
                      step={step}
                      onChange={(e) => {
                        let v = Number(e.target.value);
                        if (Number.isNaN(v)) v = min;
                        if (k === "blur_kernel") {
                          v = Math.max(min, Math.min(max, v));
                          if (v % 2 === 0) v += 1; // keep odd
                        }
                        setParams((p) => ({ ...p, [k]: v }));
                      }}
                      style={{
                        width: "100%",
                        padding: "8px 10px",
                        borderRadius: 10,
                        border: darkMode ? "1px solid rgba(255,255,255,0.12)" : "1px solid #d1d5db",
                        background: darkMode ? "rgba(255,255,255,0.05)" : "#fff",
                        color: "inherit",
                      }}
                    />
                  </label>
                ))}
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, fontSize: 12, color: "#9ca3af", fontWeight: 800 }}>
                <input
                  type="checkbox"
                  checked={params.denoise_enabled}
                  onChange={(e) => setParams((p) => ({ ...p, denoise_enabled: e.target.checked }))}
                />
                Denoise enabled
              </label>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

