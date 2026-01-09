import React, { useState, useRef, useEffect } from "react";
import { Upload, Check, X } from "lucide-react";

const MoistureDebug = () => {
  const FLASK_API = "http://localhost:5000";
  const LARAVEL_API =
    import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

  const [uploadedImage, setUploadedImage] = useState(null);
  const [recognitionResult, setRecognitionResult] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [calibrationInfo, setCalibrationInfo] = useState(null);

  const fileInputRef = useRef(null);

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
          hasDecimalPoint: active.has_decimal_point,
          decimalPosition: active.decimal_position,
        });
      }
    } catch (err) {
      console.error("Failed to load calibration:", err);
    }
  };

  const formatNumberWithDecimal = (rawNumber, hasDecimal, decimalPos) => {
    if (!hasDecimal || !rawNumber || rawNumber.includes("?")) {
      return rawNumber;
    }

    if (rawNumber.length < decimalPos) {
      return rawNumber;
    }

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

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please upload an image file");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setUploadedImage({
        file: file,
        preview: event.target.result,
      });
      setError(null);
      setRecognitionResult(null);
    };

    reader.readAsDataURL(file);
  };

  const recognizeDisplay = async () => {
    if (!uploadedImage) return;

    setIsProcessing(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("image", uploadedImage.file);
      formData.append("method", "simple_threshold");

      const response = await fetch(`${FLASK_API}/seven-segment/recognize`, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!data.success) throw new Error(data.error || "Recognition failed");

      setRecognitionResult(data);
    } catch (err) {
      setError(err.message || "Failed to recognize display");
      console.error("Recognition error:", err);
    } finally {
      setIsProcessing(false);
    }
  };

  const getFormattedReading = () => {
    if (!recognitionResult?.full_number) return null;

    if (recognitionResult.full_number.includes(".")) {
      return recognitionResult.full_number;
    }

    const rawReading = recognitionResult.full_number.replace(/\?/g, "");

    if (calibrationInfo?.hasDecimalPoint && rawReading) {
      return formatNumberWithDecimal(
        rawReading,
        calibrationInfo.hasDecimalPoint,
        calibrationInfo.decimalPosition
      );
    }

    return recognitionResult.full_number;
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white p-6">
      <div className="max-w-3xl mx-auto space-y-6">

        {/* Upload + Recognize (hidden once result appears) */}
        {!recognitionResult && (
          <>
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-600 rounded-lg p-10 text-center cursor-pointer hover:border-blue-500 transition-all"
            >
              <Upload className="w-10 h-10 mx-auto mb-3 text-slate-400" />
              <p className="font-medium">Click to upload image</p>
              <p className="text-sm text-slate-400">
                Moisture meter display image
              </p>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
            />

            {uploadedImage && (
              <button
                onClick={recognizeDisplay}
                disabled={isProcessing}
                className="w-full py-4 bg-green-600 hover:bg-green-700 disabled:bg-slate-700 rounded-xl font-medium flex items-center justify-center gap-2"
              >
                {isProcessing ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    Processing…
                  </>
                ) : (
                  <>
                    <Check className="w-5 h-5" />
                    Recognize
                  </>
                )}
              </button>
            )}
          </>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-500/10 border border-red-500 rounded-xl p-4 text-red-400 flex gap-2">
            <X className="w-5 h-5" />
            {error}
          </div>
        )}

        {/* RESULT + Proceed Button */}
        {recognitionResult && (
          <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
            <h3 className="text-xl font-semibold mb-4">Result</h3>

            <div className="bg-slate-900 rounded-lg p-6 text-center border border-green-700 mb-6">
              <div className="text-sm text-slate-400 mb-1">
                Detected Reading
              </div>
              <div className="text-5xl font-bold text-green-400">
                {getFormattedReading()}
              </div>
            </div>

            {/* Button — no function yet */}
            <button
              className="w-full py-4 bg-blue-600 hover:bg-blue-700 rounded-xl font-medium"
              disabled
            >
              Proceed to Measurement Test
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default MoistureDebug;
