import React, { useState, useRef, useEffect } from "react";
import { Upload, Eye, Check, X } from "lucide-react";

const MoistureDebug = () => {
  const FLASK_API = "http://localhost:5000";
  const LARAVEL_API =
    import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

  const [uploadedImage, setUploadedImage] = useState(null);
  const [visualizationImage, setVisualizationImage] = useState(null);
  const [recognitionResult, setRecognitionResult] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [calibrationInfo, setCalibrationInfo] = useState(null);

  const fileInputRef = useRef(null);

  // Load active calibration on mount
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

  // Helper function to format number with decimal point
  // Always returns 2 decimal places (e.g., 319 -> 31.90, not 31.9)
  const formatNumberWithDecimal = (rawNumber, hasDecimal, decimalPos) => {
    if (!hasDecimal || !rawNumber || rawNumber.includes("?")) {
      return rawNumber;
    }

    if (rawNumber.length < decimalPos) {
      return rawNumber;
    }

    // Insert decimal from right
    const insertPos = rawNumber.length - decimalPos;
    const formattedNumber =
      rawNumber.slice(0, insertPos) + "." + rawNumber.slice(insertPos);

    // Ensure 2 decimal places (add trailing 0 if needed)
    // e.g., 31.9 -> 31.90
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
      setVisualizationImage(null);
      setRecognitionResult(null);
    };
    reader.readAsDataURL(file);
  };

  const visualizeSegments = async () => {
    if (!uploadedImage) return;

    setIsProcessing(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("image", uploadedImage.file);
      formData.append("method", "simple_threshold");

      const response = await fetch(`${FLASK_API}/seven-segment/visualize`, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Visualization failed");
      }

      setVisualizationImage(`data:image/png;base64,${data.visualization}`);
    } catch (err) {
      setError(err.message || "Failed to visualize segments");
      console.error("Visualization error:", err);
    } finally {
      setIsProcessing(false);
    }
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

      if (!data.success) {
        throw new Error(data.error || "Recognition failed");
      }

      setRecognitionResult(data);

      // Also show visualization if available
      if (data.visualization) {
        setVisualizationImage(`data:image/png;base64,${data.visualization}`);
      }
    } catch (err) {
      setError(err.message || "Failed to recognize display");
      console.error("Recognition error:", err);
    } finally {
      setIsProcessing(false);
    }
  };

  const resetAll = () => {
    setUploadedImage(null);
    setVisualizationImage(null);
    setRecognitionResult(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const getFormattedReading = () => {
    if (!recognitionResult?.full_number) return null;

    // If the number already has a decimal point, return it as-is
    // (backend already formatted it)
    if (recognitionResult.full_number.includes(".")) {
      return recognitionResult.full_number;
    }

    // Otherwise, apply frontend formatting if needed
    const rawReading = recognitionResult.full_number.replace(/\?/g, "");

    if (calibrationInfo?.hasDecimalPoint && rawReading) {
      return formatNumberWithDecimal(
        rawReading,
        calibrationInfo.hasDecimalPoint,
        calibrationInfo.decimalPosition,
      );
    }

    return recognitionResult.full_number;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Eye className="w-8 h-8 text-blue-400" />
            <h1 className="text-3xl font-bold">
              Seven-Segment Display Detector
            </h1>
          </div>
          <p className="text-slate-400">
            Test and visualize segment detection with binary states (0/1)
          </p>
          {calibrationInfo?.hasDecimalPoint && (
            <div className="mt-2 inline-block px-3 py-1 bg-blue-600 rounded-full text-sm">
              ■ Decimal format: X.XX
            </div>
          )}
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column - Upload & Controls */}
          <div className="space-y-6">
            {/* Upload Section */}
            <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
              <h2 className="text-xl font-semibold mb-4">1. Uploaded Image</h2>

              {!uploadedImage ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-600 rounded-lg p-12 text-center cursor-pointer hover:border-blue-500 transition-all"
                >
                  <Upload className="w-12 h-12 mx-auto mb-4 text-slate-500" />
                  <p className="text-lg font-medium mb-1">
                    Click to upload image
                  </p>
                  <p className="text-sm text-slate-400">
                    Upload moisture meter display image
                  </p>
                </div>
              ) : (
                <div>
                  <img
                    src={uploadedImage.preview}
                    alt="Uploaded"
                    className="w-full rounded-lg border border-slate-700 mb-3"
                  />
                  <button
                    onClick={resetAll}
                    className="w-full py-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors text-sm flex items-center justify-center gap-2"
                  >
                    <X className="w-4 h-4" />
                    Clear
                  </button>
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

            {/* Action Buttons */}
            {uploadedImage && (
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={visualizeSegments}
                  disabled={isProcessing}
                  className="py-4 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-700 disabled:cursor-not-allowed rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
                >
                  {isProcessing ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      Processing...
                    </>
                  ) : (
                    <>
                      <Eye className="w-5 h-5" />
                      Visualize
                    </>
                  )}
                </button>

                <button
                  onClick={recognizeDisplay}
                  disabled={isProcessing}
                  className="py-4 bg-green-600 hover:bg-green-700 disabled:bg-slate-700 disabled:cursor-not-allowed rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
                >
                  {isProcessing ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      Processing...
                    </>
                  ) : (
                    <>
                      <Check className="w-5 h-5" />
                      Recognize
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Legend */}
            <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
              <h3 className="text-lg font-semibold mb-4">Legend</h3>

              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-green-500/20 border-2 border-green-500 rounded flex items-center justify-center font-bold text-green-400">
                    1
                  </div>
                  <div>
                    <div className="font-medium text-green-400">Segment ON</div>
                    <div className="text-sm text-slate-400">
                      Green box with "1"
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-red-500/20 border-2 border-red-500 rounded flex items-center justify-center font-bold text-red-400">
                    0
                  </div>
                  <div>
                    <div className="font-medium text-red-400">Segment OFF</div>
                    <div className="text-sm text-slate-400">
                      Red box with "0"
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Results */}
          <div className="space-y-6">
            {/* Error Display */}
            {error && (
              <div className="bg-red-500/10 border border-red-500 rounded-xl p-4">
                <div className="flex items-center gap-2 text-red-400">
                  <X className="w-5 h-5" />
                  <span className="font-medium">{error}</span>
                </div>
              </div>
            )}

            {/* Visualization */}
            {visualizationImage && (
              <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
                <h3 className="text-xl font-semibold mb-4">Visualization</h3>
                <img
                  src={visualizationImage}
                  alt="Segment Detection"
                  className="w-full rounded-lg border border-slate-700"
                />
                <p className="text-xs text-slate-400 mt-3 text-center">
                  Green boxes (1) = Segment ON | Red boxes (0) = Segment OFF
                </p>
              </div>
            )}

            {/* Recognition Result */}
            {recognitionResult && (
              <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
                <h3 className="text-xl font-semibold mb-4">
                  Recognition Result
                </h3>

                <div className="space-y-4">
                  {/* Main Reading */}
                  <div className="bg-gradient-to-br from-green-900/40 to-emerald-900/40 rounded-lg p-6 text-center border border-green-700">
                    <div className="text-sm text-slate-400 mb-2">
                      Detected Reading
                    </div>
                    <div className="text-6xl font-bold text-green-400">
                      {getFormattedReading()}
                    </div>
                    {calibrationInfo?.hasDecimalPoint && (
                      <div className="text-xs text-slate-500 mt-2">
                        Decimal position: {calibrationInfo.decimalPosition}
                      </div>
                    )}
                  </div>

                  {/* Per-Digit Analysis */}
                  {recognitionResult.digits &&
                    recognitionResult.digits.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-slate-400 mb-3">
                          Per-Digit Breakdown
                        </h4>
                        <div className="grid grid-cols-3 gap-3">
                          {recognitionResult.digits.map((digit, idx) => (
                            <div
                              key={idx}
                              className="bg-slate-900 rounded-lg p-4 text-center border border-slate-700"
                            >
                              <div className="text-xs text-slate-400 mb-2">
                                Digit {idx + 1}
                              </div>
                              <div
                                className={`text-4xl font-bold mb-2 ${
                                  digit.recognized_digit === "?"
                                    ? "text-red-400"
                                    : "text-green-400"
                                }`}
                              >
                                {digit.recognized_digit}
                              </div>
                              <div className="text-xs text-slate-500">
                                Binary: {digit.binary_code}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                  {/* Detection Stats */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-900 rounded-lg p-3 border border-slate-700">
                      <div className="text-xs text-slate-400 mb-1">Method</div>
                      <div className="text-sm font-medium">
                        Simple Threshold
                      </div>
                    </div>
                    <div className="bg-slate-900 rounded-lg p-3 border border-slate-700">
                      <div className="text-xs text-slate-400 mb-1">Valid</div>
                      <div
                        className={`text-sm font-medium ${
                          recognitionResult.is_valid
                            ? "text-green-400"
                            : "text-red-400"
                        }`}
                      >
                        {recognitionResult.is_valid ? "Yes ✓" : "No ✗"}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Help Text */}
            {!visualizationImage && !recognitionResult && !error && (
              <div className="bg-slate-800 rounded-xl p-8 border border-slate-700 text-center">
                <div className="text-slate-500 mb-2">
                  <Eye className="w-12 h-12 mx-auto mb-3 opacity-50" />
                </div>
                <p className="text-slate-400">
                  Upload an image and click <strong>Visualize</strong> to see
                  segment detection, or <strong>Recognize</strong> to read the
                  number.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MoistureDebug;
