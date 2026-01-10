import React, { useEffect, useMemo, useRef, useState } from "react";
import { Upload, Check, X, RotateCcw, Eye, Info } from "lucide-react";

/**
 * MoistureDebug.jsx
 *
 * What this page does:
 * 1) Upload an image
 * 2) Uses your SQL/Laravel calibration (via Flask proxy) to run 7-segment OCR
 * 3) Shows the 7-segment DISPLAY bounding box (cyan) on the uploaded image
 * 4) Shows the recognized number
 */

const MoistureDebug = () => {
  const FLASK_API = "http://localhost:5000";
  const LARAVEL_API =
    import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

  const [uploadedImage, setUploadedImage] = useState(null); // {file, preview}
  const [recognitionResult, setRecognitionResult] = useState(null);
  const [visualizationImage, setVisualizationImage] = useState(null); // base64 png
  const [error, setError] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Decimal formatting from active calibration
  const [calibrationInfo, setCalibrationInfo] = useState(null); // {hasDecimalPoint, decimalPosition}

  // Boxes from calibration (display box only is required)
  const [calibrationBoxes, setCalibrationBoxes] = useState(null); // {display_box, calibration_image_size}

  // For accurate overlay on responsive image
  const imgRef = useRef(null);
  const containerRef = useRef(null);
  const fileInputRef = useRef(null);
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 });
  const [renderSize, setRenderSize] = useState({ width: 0, height: 0 });

  // Load calibration settings + boxes on mount
  useEffect(() => {
    loadActiveCalibrationFromLaravel();
    loadCalibrationBoxesFromFlask();
  }, []);

  // Update render size when image / window changes
  useEffect(() => {
    const onResize = () => {
      if (!imgRef.current) return;
      setRenderSize({
        width: imgRef.current.clientWidth || 0,
        height: imgRef.current.clientHeight || 0,
      });
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const loadActiveCalibrationFromLaravel = async () => {
    // This is only to get decimal settings fast.
    // Flask also returns these, but this helps even if Flask is down.
    try {
      const response = await fetch(`${LARAVEL_API}/api/calibration`);
      if (!response.ok) return;
      const calibrations = await response.json();
      const active = calibrations.find((cal) => cal.is_active);
      if (!active) return;

      setCalibrationInfo({
        hasDecimalPoint: Boolean(active.has_decimal_point),
        decimalPosition: Number(active.decimal_position || 1),
      });
    } catch (e) {
      console.warn("Failed to load calibration from Laravel:", e);
    }
  };

  const loadCalibrationBoxesFromFlask = async () => {
    // Preferred: Flask will load the active calibration from Laravel if needed.
    // Endpoint exists in your app.py.
    try {
      const res = await fetch(`${FLASK_API}/seven-segment/calibration`);
      if (!res.ok) return;
      const data = await res.json();
      if (!data?.success || !data?.calibration?.display_box) return;

      const cal = data.calibration;
      setCalibrationBoxes({
        display_box: cal.display_box,
        calibration_image_size: cal.calibration_image_size || null,
      });

      // Keep decimal config in sync (Flask is the single source of truth for OCR)
      setCalibrationInfo((prev) => ({
        ...(prev || {}),
        hasDecimalPoint: Boolean(cal.has_decimal_point),
        decimalPosition: Number(cal.decimal_position || 1),
      }));
    } catch (e) {
      console.warn("Failed to load calibration boxes from Flask:", e);
    }
  };

  const resetAll = () => {
    setUploadedImage(null);
    setRecognitionResult(null);
    setVisualizationImage(null);
    setError(null);
    setIsProcessing(false);
    setNaturalSize({ width: 0, height: 0 });
    setRenderSize({ width: 0, height: 0 });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please upload an image file");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setUploadedImage({ file, preview: event.target.result });
      setRecognitionResult(null);
      setVisualizationImage(null);
      setError(null);
    };
    reader.readAsDataURL(file);
  };

  const formatNumberWithDecimal = (rawNumber, hasDecimal, decimalPos) => {
    if (!hasDecimal || !rawNumber || rawNumber.includes("?")) return rawNumber;
    const clean = String(rawNumber).replace(/[^0-9?]/g, "");
    if (clean.length < decimalPos) return rawNumber;

    const insertPos = clean.length - decimalPos;
    const formatted = `${clean.slice(0, insertPos)}.${clean.slice(insertPos)}`;
    const parts = formatted.split(".");
    if (parts.length === 2) return `${parts[0]}.${parts[1].padEnd(2, "0")}`;
    return formatted;
  };

  const lowReadingAsZero = () => {
    // Choose display format based on your decimal settings:
    // If you use 1 decimal place, show "00.0"
    // If you use 2 decimal places, show "00.00" (optional)
    const dp = calibrationInfo?.decimalPosition ?? 1;
  
    // Your project usually uses 1 decimal place => dp=1 => "00.0"
    if (dp === 1) return "00.0";
    if (dp === 2) return "00.00";
    return "0";
  };
  

  const displayReading = useMemo(() => {
    if (!recognitionResult) return null;
  
    const raw = (recognitionResult.raw_number || recognitionResult.full_number || "").trim();

    // ✅ treat ANY "L..." as LOW, even if it's "L?", "L0", "Lo", etc.
    const isLow =
      recognitionResult.mode === "LOW" ||
      /^l/i.test(raw);   // starts with L

    if (isLow) {
      return lowReadingAsZero(); // "00.0"
    }

  
    if (isLow) {
      return lowReadingAsZero();
    }
  
    // If backend already includes decimal, use it (only for numeric readings)
    if (recognitionResult.full_number && recognitionResult.full_number.includes(".")) {
      return recognitionResult.full_number;
    }
  
    if (!raw) return null;
  
    // Only apply decimal formatting to pure digits
    if (calibrationInfo?.hasDecimalPoint && /^\d+$/.test(raw)) {
      return formatNumberWithDecimal(
        raw,
        calibrationInfo.hasDecimalPoint,
        calibrationInfo.decimalPosition
      );
    }
  
    return raw;
  }, [recognitionResult, calibrationInfo]);
  

  // Compute display bounding box in the uploaded image coordinate space
  const displayBoxInImage = useMemo(() => {
    if (!calibrationBoxes?.display_box) return null;
    if (!naturalSize.width || !naturalSize.height) return null;

    const db = calibrationBoxes.display_box;
    const calibSize = calibrationBoxes.calibration_image_size;
    if (!calibSize?.width || !calibSize?.height) {
      // Assume already in correct image coordinates
      return {
        x: Number(db.x),
        y: Number(db.y),
        width: Number(db.width),
        height: Number(db.height),
      };
    }

    const scaleX = naturalSize.width / calibSize.width;
    const scaleY = naturalSize.height / calibSize.height;

    return {
      x: Number(db.x) * scaleX,
      y: Number(db.y) * scaleY,
      width: Number(db.width) * scaleX,
      height: Number(db.height) * scaleY,
    };
  }, [calibrationBoxes, naturalSize]);

  // Convert image-space box to screen-space (rendered) for overlay
  const displayBoxOnScreen = useMemo(() => {
    if (!displayBoxInImage) return null;
    if (!naturalSize.width || !naturalSize.height) return null;
    if (!renderSize.width || !renderSize.height) return null;

    const rx = renderSize.width / naturalSize.width;
    const ry = renderSize.height / naturalSize.height;

    return {
      left: displayBoxInImage.x * rx,
      top: displayBoxInImage.y * ry,
      width: displayBoxInImage.width * rx,
      height: displayBoxInImage.height * ry,
    };
  }, [displayBoxInImage, naturalSize, renderSize]);

  const recognizeDisplay = async () => {
    if (!uploadedImage?.file) return;
    setIsProcessing(true);
    setError(null);

    try {
      // Ensure we have calibration boxes (so we can show bbox)
      if (!calibrationBoxes) {
        await loadCalibrationBoxesFromFlask();
      }

      const formData = new FormData();
      formData.append("image", uploadedImage.file);
      formData.append("method", "simple_threshold");
      formData.append("debug", "false");

      const res = await fetch(`${FLASK_API}/seven-segment/recognize`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!data?.success) throw new Error(data?.error || "Recognition failed");

      setRecognitionResult(data);

      // Optional: get a visualization with segment boxes and 0/1 states
      try {
        const visForm = new FormData();
        visForm.append("image", uploadedImage.file);
        const visRes = await fetch(`${FLASK_API}/seven-segment/visualize`, {
          method: "POST",
          body: visForm,
        });
        const visData = await visRes.json();
        if (visData?.success && visData?.visualization) {
          setVisualizationImage(
            `data:image/png;base64,${visData.visualization}`
          );
        }
      } catch {
        // non-blocking
      }
    } catch (err) {
      setError(err?.message || "Failed to recognize display");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="text-2xl font-bold">Moisture Debug</div>
            <div className="text-sm text-slate-400">
              Upload → OCR (from DB calibration) → show display bbox + reading
            </div>
          </div>

          <button
            type="button"
            onClick={resetAll}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 flex items-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            Reset
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-500/10 border border-red-500 rounded-xl p-4 text-red-300 flex gap-2 items-start">
            <X className="w-5 h-5 mt-0.5" />
            <div>{error}</div>
          </div>
        )}

        {/* Upload + Preview */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div className="font-semibold">1) Upload Image</div>

            <div className="text-xs text-slate-400 flex items-center gap-2">
              <Info className="w-4 h-4" />
              {calibrationInfo?.hasDecimalPoint
                ? `Decimal: position ${calibrationInfo.decimalPosition} from right`
                : "Decimal: off"}
            </div>
          </div>

          {!uploadedImage ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-600 rounded-xl p-10 text-center cursor-pointer hover:border-blue-500 transition-all"
            >
              <Upload className="w-12 h-12 mx-auto mb-3 text-slate-400" />
              <div className="font-medium">Click to upload image</div>
              <div className="text-sm text-slate-400">
                Moisture meter display photo
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Image + bbox overlay */}
              <div className="space-y-3">
                <div className="text-sm text-slate-300 font-medium">
                  Uploaded Image (cyan = display bbox)
                </div>

                <div
                  ref={containerRef}
                  className="relative rounded-xl overflow-hidden bg-black border border-slate-700"
                >
                  <img
                    ref={imgRef}
                    src={uploadedImage.preview}
                    alt="Uploaded moisture meter"
                    className="w-full h-auto object-contain"
                    onLoad={(e) => {
                      const img = e.currentTarget;
                      setNaturalSize({
                        width: img.naturalWidth || 0,
                        height: img.naturalHeight || 0,
                      });
                      setRenderSize({
                        width: img.clientWidth || 0,
                        height: img.clientHeight || 0,
                      });
                    }}
                  />

                  {/* Display bbox overlay */}
                  {displayBoxOnScreen && (
                    <div
                      className="absolute border-2 border-cyan-400"
                      style={{
                        left: `${displayBoxOnScreen.left}px`,
                        top: `${displayBoxOnScreen.top}px`,
                        width: `${displayBoxOnScreen.width}px`,
                        height: `${displayBoxOnScreen.height}px`,
                        boxShadow: "0 0 0 9999px rgba(0,0,0,0.10)",
                      }}
                    />
                  )}

                  {displayBoxOnScreen && (
                    <div
                      className="absolute bg-cyan-500 text-black text-xs font-bold px-2 py-1 rounded"
                      style={{
                        left: `${Math.max(0, displayBoxOnScreen.left)}px`,
                        top: `${Math.max(0, displayBoxOnScreen.top - 26)}px`,
                      }}
                    >
                      DISPLAY ROI
                    </div>
                  )}
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1 py-3 rounded-xl bg-slate-900 hover:bg-slate-950 border border-slate-700"
                  >
                    Upload Different Image
                  </button>

                  <button
                    type="button"
                    onClick={recognizeDisplay}
                    disabled={isProcessing}
                    className="flex-1 py-3 rounded-xl bg-green-600 hover:bg-green-700 disabled:bg-slate-700 flex items-center justify-center gap-2 font-medium"
                  >
                    {isProcessing ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                        Processing…
                      </>
                    ) : (
                      <>
                        <Check className="w-5 h-5" />
                        Recognize
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Right side: Results */}
              <div className="space-y-4">
                <div className="text-sm text-slate-300 font-medium">2) Output</div>

                {/* bbox numbers */}
                <div className="bg-slate-900 rounded-xl border border-slate-700 p-4">
                  <div className="text-xs text-slate-400 mb-2">
                    7-segment display bounding box (image coordinates)
                  </div>
                  {displayBoxInImage ? (
                    <div className="font-mono text-sm">
                      x: {Math.round(displayBoxInImage.x)} | y:{" "}
                      {Math.round(displayBoxInImage.y)}
                      <br />
                      w: {Math.round(displayBoxInImage.width)} | h:{" "}
                      {Math.round(displayBoxInImage.height)}
                    </div>
                  ) : (
                    <div className="text-sm text-slate-400">
                      No display box loaded. Make sure an active calibration exists.
                    </div>
                  )}
                </div>

                {/* reading */}
                <div className="bg-slate-900 rounded-xl border border-slate-700 p-6 text-center">
                  <div className="text-xs text-slate-400 mb-2">Recognized number</div>
                  <div className="text-6xl font-bold text-green-400">
                    {displayReading ?? "—"}
                  </div>
                  {recognitionResult && (
                    <div className="mt-3 text-sm text-slate-400">
                      Raw:{" "}
                      <span className="font-mono text-slate-200">
                        {recognitionResult.raw_number}
                      </span>
                      {" · "}
                      Valid: {recognitionResult.is_valid ? "Yes" : "No"}
                    </div>
                  )}
                </div>

                {/* visualization */}
                {visualizationImage && (
                  <div className="bg-slate-900 rounded-xl border border-slate-700 p-4">
                    <div className="text-xs text-slate-400 mb-2 flex items-center gap-2">
                      <Eye className="w-4 h-4" />
                      Segment visualization (green=1, red=0)
                    </div>
                    <img
                      src={visualizationImage}
                      alt="Seven segment visualization"
                      className="w-full h-auto rounded-lg bg-black"
                    />
                  </div>
                )}

                {/* proceed button placeholder */}
                {recognitionResult && (
                  <button
                    className="w-full py-4 bg-blue-600 hover:bg-blue-700 rounded-xl font-medium disabled:opacity-60"
                    disabled
                  >
                    Proceed to Measurement Test
                  </button>
                )}
              </div>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            className="hidden"
          />
        </div>
      </div>
    </div>
  );
};

export default MoistureDebug;
