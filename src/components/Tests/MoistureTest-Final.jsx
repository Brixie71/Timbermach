import React, { useEffect, useMemo, useRef, useState } from "react";
import { RotateCcw, X, ArrowLeft, Home, Video, VideoOff } from "lucide-react";

/**
 * MoistureTest.jsx (LIVE CAMERA VERSION)
 *
 * - Auto-select camera by name (VITE_MOISTURE_CAMERA_NAME or fallback)
 * - Live preview
 * - Periodic OCR (throttled) -> updates reading like the moisture meter screen
 * - Maps "Lo / L? / L0..." -> "00.0"
 */

const MoistureTest = ({
  onTestComplete = () => {},
  onPreviousTest = () => {},
  onMainPageReturn = () => {},
}) => {
  const FLASK_API = "http://localhost:5000";
  const LARAVEL_API =
    import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

  // Camera name to auto-pick (set this in .env: VITE_MOISTURE_CAMERA_NAME="Your Camera Label")
  const TARGET_CAMERA_NAME =
    import.meta.env.VITE_MOISTURE_CAMERA_NAME || "USB2.0 PC CAMERA";

  // OCR interval (ms) - tune as needed
  const OCR_INTERVAL_MS = Number(import.meta.env.VITE_OCR_INTERVAL_MS || 600);

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const canvasRef = useRef(null);
  const timerRef = useRef(null);
  const inFlightRef = useRef(false);

  const [devices, setDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState("");
  const [cameraReady, setCameraReady] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(false);

  const [recognitionResult, setRecognitionResult] = useState(null);
  const [lastGoodReading, setLastGoodReading] = useState(null);

  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);

  const [calibrationInfo, setCalibrationInfo] = useState(null);
  const [testCompleted, setTestCompleted] = useState(false);

  // ---- Load active calibration (decimal config) ----
  useEffect(() => {
    loadActiveCalibration();
  }, []);

  const loadActiveCalibration = async () => {
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
    } catch (err) {
      console.error("Failed to load calibration:", err);
    }
  };

  // ---- Camera setup: request permission once, then enumerate ----
  useEffect(() => {
    initCameraDevices();
    return () => stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const initCameraDevices = async () => {
    setError(null);
    try {
      // Request permission so device labels are available
      const tmpStream = await navigator.mediaDevices.getUserMedia({ video: true });
      tmpStream.getTracks().forEach((t) => t.stop());

      const all = await navigator.mediaDevices.enumerateDevices();
      const vids = all.filter((d) => d.kind === "videoinput");
      setDevices(vids);

      // Auto-pick by name (label)
      const target = vids.find((d) =>
        (d.label || "").toLowerCase().includes(String(TARGET_CAMERA_NAME).toLowerCase())
      );

      if (target) {
        setSelectedDeviceId(target.deviceId);
      } else if (vids[0]) {
        setSelectedDeviceId(vids[0].deviceId);
      }
    } catch (e) {
      setError(
        "Camera permission denied or no camera available. Please allow camera access and refresh."
      );
      console.error(e);
    }
  };

  // If selected device changes while camera is ON, restart the stream
  useEffect(() => {
    if (!selectedDeviceId || !isCameraOn) return;
    startCamera(selectedDeviceId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDeviceId]);

  const startCamera = async (deviceId) => {
    setError(null);
    setCameraReady(false);

    try {
      // Stop old stream first
      stopCamera();

      const constraints = {
        video: {
          deviceId: deviceId ? { exact: deviceId } : undefined,
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

      // Wait for the video to have dimensions
      await new Promise((resolve) => {
        const onReady = () => {
          // readyState >= 2 means current data available
          if (videoEl.videoWidth > 0 && videoEl.videoHeight > 0) {
            videoEl.removeEventListener("loadeddata", onReady);
            resolve();
          }
        };
        videoEl.addEventListener("loadeddata", onReady);
      });

      await videoEl.play();

      setIsCameraOn(true);
      setCameraReady(true);

      // ✅ Run one OCR immediately (so you don't wait for the first interval tick)
      captureAndRecognize();


      // Start OCR loop
      startOcrLoop();
    } catch (e) {
      console.error(e);
      setError(
        "Failed to start selected camera. Try another camera from the dropdown."
      );
      setIsCameraOn(false);
      setCameraReady(false);
      stopOcrLoop();
    }
  };

  const stopCamera = () => {
    stopOcrLoop();

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setIsCameraOn(false);
    setCameraReady(false);
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

  // ---- Decimal formatting helpers ----
  const formatNumberWithDecimal = (rawNumber, hasDecimal, decimalPos) => {
    if (!hasDecimal || !rawNumber || rawNumber.includes("?")) {
      return rawNumber;
    }

    // don't decimal-format non-digits
    if (!/^\d+$/.test(rawNumber)) return rawNumber;

    if (rawNumber.length < decimalPos) return rawNumber;

    const insertPos = rawNumber.length - decimalPos;
    const formattedNumber =
      rawNumber.slice(0, insertPos) + "." + rawNumber.slice(insertPos);

    const parts = formattedNumber.split(".");
    if (parts.length === 2) {
      const decimalPart = parts[1].padEnd(2, "0");
      return parts[0] + "." + decimalPart;
    }
    return formattedNumber;
  };

  const lowReadingAsZero = () => {
    const dp = calibrationInfo?.decimalPosition ?? 1;
    if (dp === 1) return "00.0";
    if (dp === 2) return "00.00";
    return "0";
  };

  // Build the main number shown on screen
  const displayReading = useMemo(() => {
    if (!recognitionResult) return "—";

    const raw = String(recognitionResult.raw_number || recognitionResult.full_number || "").trim();

    // ✅ treat ANY "L..." as LOW, even "L?", "L0", "Lo"
    const isLow =
      recognitionResult.mode === "LOW" ||
      /^l/i.test(raw);

    if (isLow) return lowReadingAsZero();

    // If API already gives decimal, prefer it
    if (recognitionResult.full_number && recognitionResult.full_number.includes(".")) {
      return recognitionResult.full_number;
    }

    // Otherwise format from raw using calibration
    if (calibrationInfo && raw) {
      return formatNumberWithDecimal(
        raw,
        calibrationInfo.hasDecimalPoint,
        calibrationInfo.decimalPosition
      );
    }

    return raw || "—";
  }, [recognitionResult, calibrationInfo]);

  // ---- Real-time OCR: capture frame and send to Flask ----
  const captureAndRecognize = async () => {
    const video = videoRef.current;
    if (!video) return;

    // readyState < 2 means no frame data yet
    if (video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) {
      return;
    }

    if (inFlightRef.current) return; // throttle
    if (!streamRef.current) return;

    try {
      inFlightRef.current = true;
      setIsProcessing(true);
      setError(null);

      const video = videoRef.current;
      const canvas = canvasRef.current;

      // Draw current frame to canvas
      const vw = video.videoWidth || 1280;
      const vh = video.videoHeight || 720;

      // Light downscale helps speed and reduces noise
      const targetW = 960;
      const scale = targetW / vw;
      const targetH = Math.round(vh * scale);

      canvas.width = vw;
      canvas.height = vh;

      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(video, 0, 0, vw, vh);

      // Convert canvas to JPEG blob
      const blob = await new Promise((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", 0.85)
      );
      if (!blob) throw new Error("Failed to capture frame");

      const formData = new FormData();
      formData.append("image", blob, "frame.jpg");
      formData.append("debug", "false");
      formData.append("method", "simple_threshold");

      const response = await fetch(`${FLASK_API}/seven-segment/recognize`, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();
      if (!data.success) throw new Error(data.error || "Recognition failed");

      setRecognitionResult(data);

      // Mark as complete once we have a valid numeric reading (or LOW)
      const raw = String(data.raw_number || "").trim();
      const isLow = data.mode === "LOW" || /^l/i.test(raw);

      if (isLow) {
        const lowVal = lowReadingAsZero();
        setLastGoodReading(lowVal);
        setTestCompleted(true);

// ❌ DO NOT call onTestComplete here

      } else if (data.is_valid) {
        const formatted = (() => {
          if (data.full_number && data.full_number.includes(".")) return data.full_number;
          if (calibrationInfo?.hasDecimalPoint && /^\d+$/.test(data.raw_number || "")) {
            return formatNumberWithDecimal(
              data.raw_number,
              calibrationInfo.hasDecimalPoint,
              calibrationInfo.decimalPosition
            );
          }
          return data.full_number || data.raw_number;
        })();

        setLastGoodReading(formatted);
        setTestCompleted(true);


      }
    } catch (err) {
      setError(err?.message || "Live OCR failed");
    } finally {
      setIsProcessing(false);
      inFlightRef.current = false;
    }
  };

  const resetAll = () => {
    setRecognitionResult(null);
    setLastGoodReading(null);
    setError(null);
    setTestCompleted(false);
  };

  return (
    <div className="fixed inset-0 flex flex-col h-screen w-screen bg-gray-900">
      {/* Header Bar */}
      <div className="flex items-center px-3 py-1.5 bg-gray-800 fixed top-0 left-0 right-0 z-10">
        <button
          type="button"
          onClick={onPreviousTest}
          className="bg-transparent border-none text-gray-200 text-2xl cursor-pointer p-1.5 hover:text-blue-400 transition-colors duration-300"
          title="Previous Test"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>

        <span className="ml-4 text-gray-100 text-lg font-semibold">
          TimberMach | Moisture Test (Live)
        </span>

        {testCompleted && (
          <div className="ml-4 flex items-center gap-2 bg-green-900 bg-opacity-30 border border-green-700 rounded-lg px-3 py-1">
            <span className="w-2 h-2 bg-green-400 rounded-full"></span>
            <span className="text-green-400 text-sm font-semibold">
              Reading Captured
            </span>
          </div>
        )}

        {calibrationInfo?.hasDecimalPoint && (
          <div className="ml-4 text-blue-400 text-xs">
            Format: {calibrationInfo.decimalPosition === 1 ? "XX.X" : "X.XX"}
          </div>
        )}

        <button
          type="button"
          onClick={onMainPageReturn}
          className="bg-transparent border-none text-gray-200 text-2xl cursor-pointer p-1.5 ml-auto hover:text-red-500 transition-colors duration-300"
          title="Return to Main Menu"
        >
          <Home className="w-6 h-6" />
        </button>
      </div>

      {/* Main Content */}
      <div className="mt-12 flex-grow overflow-auto p-6">
        <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Live camera */}
          <div className="bg-gray-800 rounded-lg p-6">
            <div className="flex items-center justify-between gap-4 mb-4">
              <h2 className="text-xl font-bold text-white">Live Camera</h2>

              <div className="flex items-center gap-2">
                {!isCameraOn ? (
                  <button
                    className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg flex items-center gap-2 transition-colors text-white"
                    onClick={() => startCamera(selectedDeviceId)}
                  >
                    <Video className="w-4 h-4" />
                    Start
                  </button>
                ) : (
                  <button
                    className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg flex items-center gap-2 transition-colors text-white"
                    onClick={stopCamera}
                  >
                    <VideoOff className="w-4 h-4" />
                    Stop
                  </button>
                )}
              </div>
            </div>

            {/* Camera selector */}
            <div className="mb-4">
              <div className="text-xs text-gray-400 mb-1">
                Camera (auto-picks: <span className="text-blue-300">{TARGET_CAMERA_NAME}</span>)
              </div>
              <select
                value={selectedDeviceId}
                onChange={(e) => setSelectedDeviceId(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white"
              >
                {devices.map((d) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label || `Camera ${d.deviceId.slice(0, 6)}...`}
                  </option>
                ))}
              </select>
            </div>

            {/* Preview */}
            <div className="rounded-lg overflow-hidden bg-black border border-gray-700">
              <video
                ref={videoRef}
                className="w-full h-auto"
                playsInline
                muted
              />
            </div>

            <div className="mt-4 text-sm text-gray-400">
              Live OCR every <span className="text-white">{OCR_INTERVAL_MS}ms</span>
              {isProcessing ? (
                <span className="ml-2 text-blue-300">• scanning…</span>
              ) : (
                <span className="ml-2 text-green-300">• idle</span>
              )}
            </div>

            {/* hidden canvas for frame capture */}
            <canvas ref={canvasRef} className="hidden" />
          </div>

          {/* Right: Mimic moisture meter screen */}
          <div className="bg-gray-800 rounded-lg p-6">
            {error && (
              <div className="bg-red-900 border border-red-700 text-red-200 px-4 py-3 rounded-lg mb-4 flex items-center gap-2">
                <X className="w-5 h-5" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-white">Meter Screen</h2>
              <button
                onClick={resetAll}
                className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg flex items-center gap-2 transition-colors text-white"
              >
                <RotateCcw className="w-4 h-4" />
                Reset
              </button>
            </div>

            <div
              className={`${
                testCompleted ? "bg-green-900 border-green-700" : "bg-gray-900 border-gray-700"
              } bg-opacity-30 border rounded-lg p-10 text-center`}
            >
              <div className="text-gray-300 text-base mb-3">Moisture Reading</div>

              <div className="text-8xl font-bold mb-2 text-green-400">
                {displayReading}
                <span className="text-4xl ml-2">%</span>
              </div>

              <div className="text-sm text-gray-400">
                Raw:{" "}
                <span className="text-white font-mono">
                  {recognitionResult?.raw_number ?? "—"}
                </span>
                {"  "} • {"  "}
                Valid:{" "}
                <span className="text-white">
                  {recognitionResult
                    ? (recognitionResult.mode === "LOW" || /^l/i.test(String(recognitionResult.raw_number || ""))
                      ? "Yes (LOW)"
                      : recognitionResult.is_valid
                        ? "Yes"
                        : "No")
                    : "—"}
                </span>
              </div>

              {lastGoodReading && (
                <div className="mt-4 text-blue-300 text-sm">
                  Last captured: <span className="text-white font-semibold">{lastGoodReading}%</span>
                </div>
              )}
            </div>

            <div className="mt-6 bg-blue-900 bg-opacity-20 border border-blue-700 rounded-lg p-5">
              <div className="text-blue-300 font-semibold mb-2">Tips</div>
              <ul className="text-gray-300 text-sm space-y-1">
                <li>• Point the camera at the moisture meter display</li>
                <li>• Keep the display inside the ROI calibration area</li>
                <li>• If you see Lo, it will display as 00.0</li>
                <li>• If flickering, increase OCR interval (e.g., 800–1200ms)</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Navigation - show when captured */}
      {testCompleted && (
        <div className="bg-gray-800 border-t border-gray-700 p-4">
          <div className="max-w-5xl mx-auto flex justify-between items-center">
            <button
              onClick={onPreviousTest}
              className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-3 rounded-lg font-semibold flex items-center gap-2 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              Previous Test
            </button>

            <div className="text-center">
              <div className="text-gray-400 text-sm">Moisture Reading Recorded</div>
              <div className="text-green-400 text-xl font-bold">
                {lastGoodReading ?? displayReading}%
              </div>
            </div>

            <button
              onClick={resetAll}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold flex items-center gap-2 transition-colors"
            >
              <RotateCcw className="w-5 h-5" />
              Retake Measurement
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MoistureTest;
