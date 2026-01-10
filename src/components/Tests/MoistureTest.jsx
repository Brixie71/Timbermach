import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * MoistureTest.jsx (FIXED for WoodTests.jsx flow)
 *
 * WoodTests.jsx passes:
 * - onTestComplete(data)
 * - onPreviousTest()
 * - onMainPageReturn()
 * - specimenName
 *
 * This file:
 * - keeps the centered meter UI
 * - adds Back/Home, Retake, Proceed
 * - Proceed now WORKS (calls onTestComplete)
 * - Back/Home cancels test and returns to menu (onMainPageReturn)
 */

const MoistureTest = ({
  onTestComplete = () => {},
  onPreviousTest = () => {},
  onMainPageReturn = () => {},
  specimenName = "",
}) => {
  const FLASK_API = "http://localhost:5000";
  const LARAVEL_API =
    import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

  // ✅ HARD-CODE CAMERA NAME (substring match)
  const TARGET_CAMERA_NAME = "HX-USB Camera (0c45:64ab)";

  // ✅ OCR interval + target samples
  const OCR_INTERVAL_MS = 500;
  const TARGET_SAMPLES = 20;

  // ✅ Stability + jitter tolerance
  const STABLE_WINDOW = 6;
  const STABLE_TOL = 1.0; // stable if range within this
  const COLLECT_TOL = 1.0; // while collecting, allowed deviation from locked center

  // ✅ Layout offset so controls won’t go under Header.jsx
  // If your header is taller, increase this (e.g., 72 or 80).
  const HEADER_OFFSET_PX = 64;

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const timerRef = useRef(null);
  const inFlightRef = useRef(false);

  const [calibrationInfo, setCalibrationInfo] = useState({
    hasDecimalPoint: true,
    decimalPosition: 1,
  });

  const [recognitionResult, setRecognitionResult] = useState(null);
  const [error, setError] = useState(null);

  // phases
  const [phase, setPhase] = useState("LOCKING"); // LOCKING | COLLECTING | DONE
  const phaseRef = useRef("LOCKING");

  // stability window (recent readings)
  const stableWindowRef = useRef([]); // floats

  // collecting
  const samplesRef = useRef([]); // floats
  const [sampleCount, setSampleCount] = useState(0);

  // lock center for collecting tolerance (median of stability window)
  const lockedCenterRef = useRef(null);

  const [finalReading, setFinalReading] = useState(null);
  const doneRef = useRef(false);

  // ---------------- helpers ----------------
  const lowReadingAsZero = () => {
    const dp = calibrationInfo?.decimalPosition ?? 1;
    if (dp === 1) return "00.0";
    if (dp === 2) return "00.00";
    return "0";
  };

  const formatNumberWithDecimal = (rawNumber, hasDecimal, decimalPos) => {
    if (!hasDecimal || !rawNumber) return rawNumber;
    if (!/^\d+$/.test(rawNumber)) return rawNumber;
    if (rawNumber.length < decimalPos) return rawNumber;
    const insertPos = rawNumber.length - decimalPos;
    return rawNumber.slice(0, insertPos) + "." + rawNumber.slice(insertPos);
  };

  const parseReadingToFloat = (s) => {
    if (!s) return null;
    const v = Number(String(s).replace("%", "").trim());
    return Number.isFinite(v) ? v : null;
  };

  const median = (arr) => {
    if (!arr.length) return null;
    const a = [...arr].sort((x, y) => x - y);
    const mid = Math.floor(a.length / 2);
    return a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2;
  };

  const range = (arr) => {
    if (!arr.length) return Infinity;
    let mn = Infinity,
      mx = -Infinity;
    for (const v of arr) {
      if (v < mn) mn = v;
      if (v > mx) mx = v;
    }
    return mx - mn;
  };

  const clampTo1Decimal = (v) => Math.round(v * 10) / 10;

  // ---------------- load calibration ----------------
  useEffect(() => {
    (async () => {
      try {
        const response = await fetch(`${LARAVEL_API}/api/calibration`);
        if (!response.ok) return;

        const calibrations = await response.json();
        const active = calibrations.find((cal) => cal.is_active);
        if (active) {
          setCalibrationInfo({
            hasDecimalPoint: Boolean(active.has_decimal_point),
            decimalPosition: Number(active.decimal_position || 1),
          });
        }
      } catch {
        // ignore
      }
    })();
  }, [LARAVEL_API]);

  // ---------------- camera startup ----------------
  useEffect(() => {
    startHardcodedCamera();
    return () => {
      stopOcrLoop();
      stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startHardcodedCamera = async () => {
    setError(null);
    try {
      // permission so labels exist
      const tmpStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      });
      tmpStream.getTracks().forEach((t) => t.stop());

      const all = await navigator.mediaDevices.enumerateDevices();
      const cams = all.filter((d) => d.kind === "videoinput");

      const target = cams.find((d) =>
        (d.label || "")
          .toLowerCase()
          .includes(TARGET_CAMERA_NAME.toLowerCase()),
      );

      if (!target)
        throw new Error(
          `Camera not found: "${TARGET_CAMERA_NAME}". Update TARGET_CAMERA_NAME.`,
        );

      await startCamera(target.deviceId);
    } catch (e) {
      console.error(e);
      setError(e?.message || "Camera could not start. Please allow camera access.");
    }
  };

  const startCamera = async (deviceId) => {
    stopCamera();

    const constraints = {
      video: {
        deviceId: { exact: deviceId },
        width: { ideal: 1280 },
        height: { ideal: 720 },
        frameRate: { ideal: 30 },
      },
      audio: false,
    };

    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    streamRef.current = stream;

    const videoEl = videoRef.current;
    videoEl.srcObject = stream;

    await new Promise((resolve) => {
      const onReady = () => {
        if (videoEl.videoWidth > 0 && videoEl.videoHeight > 0) {
          videoEl.removeEventListener("loadeddata", onReady);
          resolve();
        }
      };
      videoEl.addEventListener("loadeddata", onReady);
    });

    await videoEl.play();

    startOcrLoop();
    captureAndRecognize();
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const startOcrLoop = () => {
    stopOcrLoop();
    timerRef.current = setInterval(() => {
      captureAndRecognize();
    }, OCR_INTERVAL_MS);
  };

  const stopOcrLoop = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  // ---------------- OCR call ----------------
  const captureAndRecognize = async () => {
    if (doneRef.current) return;

    const video = videoRef.current;
    if (!video) return;
    if (!streamRef.current) return;

    if (video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0)
      return;
    if (inFlightRef.current) return;

    try {
      inFlightRef.current = true;
      setError(null);

      const vw = video.videoWidth;
      const vh = video.videoHeight;

      const canvas = canvasRef.current;
      canvas.width = vw;
      canvas.height = vh;

      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(video, 0, 0, vw, vh);

      const blob = await new Promise((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", 0.9),
      );
      if (!blob) return;

      const formData = new FormData();
      formData.append("image", blob, "frame.jpg");
      formData.append("debug", "false");
      formData.append("method", "simple_threshold");

      const res = await fetch(`${FLASK_API}/seven-segment/recognize`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text}`);
      }

      const data = await res.json();
      if (!data?.success) throw new Error(data?.error || "Recognition failed");

      setRecognitionResult(data);
    } catch (e) {
      setError(e?.message || "Live OCR failed");
    } finally {
      inFlightRef.current = false;
    }
  };

  // ---------------- Convert OCR -> display string ----------------
  const displayReading = useMemo(() => {
    if (!recognitionResult) return "—";

    const raw = String(
      recognitionResult.raw_number || recognitionResult.full_number || "",
    ).trim();

    // LOW / Lo -> 00.0
    if (recognitionResult.mode === "LOW" || /^l/i.test(raw)) {
      return lowReadingAsZero();
    }

    // backend already includes decimal
    if (recognitionResult.full_number && recognitionResult.full_number.includes(".")) {
      return recognitionResult.full_number;
    }

    // format using calibration
    if (calibrationInfo?.hasDecimalPoint && /^\d+$/.test(raw)) {
      return formatNumberWithDecimal(raw, true, calibrationInfo.decimalPosition);
    }

    return raw || "—";
  }, [recognitionResult, calibrationInfo]);

  // ---------------- Stability-triggered collection ----------------
  useEffect(() => {
    if (doneRef.current) return;

    const v0 = parseReadingToFloat(displayReading);
    if (v0 === null) return;

    const v = clampTo1Decimal(v0);

    // LOCKING: build stability window
    if (phaseRef.current === "LOCKING") {
      const win =
        stableWindowRef.current.length >= STABLE_WINDOW
          ? [...stableWindowRef.current.slice(1), v]
          : [...stableWindowRef.current, v];

      stableWindowRef.current = win;

      if (win.length < STABLE_WINDOW) return;

      if (range(win) <= STABLE_TOL) {
        const center = clampTo1Decimal(median(win));
        lockedCenterRef.current = center;

        samplesRef.current = [];
        setSampleCount(0);

        phaseRef.current = "COLLECTING";
        setPhase("COLLECTING");
      }
      return;
    }

    // COLLECTING
    if (phaseRef.current === "COLLECTING") {
      const center = lockedCenterRef.current ?? v;

      if (Math.abs(v - center) > COLLECT_TOL) {
        // reset to locking
        phaseRef.current = "LOCKING";
        setPhase("LOCKING");

        stableWindowRef.current = [];
        lockedCenterRef.current = null;

        samplesRef.current = [];
        setSampleCount(0);
        return;
      }

      if (samplesRef.current.length < TARGET_SAMPLES) {
        samplesRef.current.push(v);
        setSampleCount(samplesRef.current.length);
      }

      if (samplesRef.current.length === TARGET_SAMPLES) {
        const m = clampTo1Decimal(median(samplesRef.current));
        const finalStr = m.toFixed(1);

        setFinalReading(finalStr);

        doneRef.current = true;
        phaseRef.current = "DONE";
        setPhase("DONE");

        // stop camera automatically when done
        stopOcrLoop();
        stopCamera();
      }
    }
  }, [displayReading]);

  const progressPct = useMemo(() => {
    return Math.round((sampleCount / TARGET_SAMPLES) * 100);
  }, [sampleCount]);

  const shownValue = finalReading ? finalReading : displayReading;

  // ---------------- Buttons ----------------
  const handleRetake = async () => {
    setError(null);
    setFinalReading(null);

    doneRef.current = false;

    phaseRef.current = "LOCKING";
    setPhase("LOCKING");

    stableWindowRef.current = [];
    lockedCenterRef.current = null;

    samplesRef.current = [];
    setSampleCount(0);

    await startHardcodedCamera();
  };

  // ✅ Home/back to menu (cancel)
  const handleBackHome = () => {
    stopOcrLoop();
    stopCamera();
    onMainPageReturn?.();
  };

  // ✅ Optional: back to previous stage
  const handleBackPrevious = () => {
    stopOcrLoop();
    stopCamera();
    onPreviousTest?.();
  };

  // ✅ PROCEED FIX: this is what WoodTests.jsx expects
  const handleProceed = () => {
    if (!finalReading) return;

    // send data upward to WoodTests.jsx -> handleMoistureComplete()
    onTestComplete?.({
      value: finalReading,
      numeric: Number(finalReading),
      unit: "%",
      method: "median_20_samples",
      specimenName,
      capturedAt: new Date().toISOString(),
    });
  };

  return (
    <div className="fixed inset-0 bg-gray-900">
      {/* Hidden OCR sources */}
      <video ref={videoRef} className="hidden" playsInline muted />
      <canvas ref={canvasRef} className="hidden" />

      {/* Top bar (below Header.jsx) */}
      <div
        className="fixed left-0 right-0 z-10 px-6 flex items-center justify-between"
        style={{ top: HEADER_OFFSET_PX, paddingTop: 12 }}
      >
        <div className="flex gap-3">
          <button
            onClick={handleBackHome}
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 transition"
          >
            Home
          </button>

          <button
            onClick={handleBackPrevious}
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 transition"
          >
            Back
          </button>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleRetake}
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 transition"
          >
            Retake
          </button>

          <button
            onClick={handleProceed}
            disabled={!finalReading}
            className={`px-4 py-2 rounded-lg font-semibold transition ${
              finalReading
                ? "bg-blue-600 hover:bg-blue-700 text-white"
                : "bg-gray-700 text-gray-400 cursor-not-allowed"
            }`}
          >
            Proceed
          </button>
        </div>
      </div>

      {/* Center content (keeps number perfectly centered) */}
      <div
        className="w-full h-full flex items-center justify-center"
        style={{ paddingTop: HEADER_OFFSET_PX }}
        onDoubleClick={handleRetake}
        title="Double-click to retake"
      >
        <div className="text-center select-none">
          <div className="text-green-400 font-extrabold leading-none text-[140px] md:text-[180px]">
            {shownValue}
            <span className="text-[64px] md:text-[80px] ml-3 align-baseline">
              %
            </span>
          </div>

          {!finalReading && (
            <div className="mt-8 w-[520px] max-w-[85vw] mx-auto">
              <div className="flex justify-between text-xs text-slate-400 mb-2">
                <span>
                  {phase === "LOCKING"
                    ? `Waiting for stability… (±${STABLE_TOL.toFixed(1)})`
                    : `Collecting… (${sampleCount}/${TARGET_SAMPLES})`}
                </span>
                <span>{phase === "COLLECTING" ? `${progressPct}%` : ""}</span>
              </div>

              <div className="h-3 rounded-full bg-slate-700 overflow-hidden">
                <div
                  className="h-full bg-green-500 transition-all duration-150"
                  style={{ width: `${phase === "COLLECTING" ? progressPct : 0}%` }}
                />
              </div>

              <div className="mt-2 text-[11px] text-slate-500">
                Stable window triggers auto-sampling. Jitter of about ±
                {COLLECT_TOL.toFixed(1)} is allowed. Double-click to retake.
              </div>
            </div>
          )}

          {finalReading && (
            <div className="mt-4 text-sm text-slate-300">
              Final reading (median of {TARGET_SAMPLES} samples)
            </div>
          )}

          {error && <div className="mt-4 text-xs text-red-300">{error}</div>}
        </div>
      </div>
    </div>
  );
};

export default MoistureTest;
