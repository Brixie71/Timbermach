import React, { useState, useRef, useEffect } from "react";
import { Upload, RotateCcw, X, ArrowLeft, Home } from "lucide-react";

const MoistureTest = ({
  onTestComplete = () => {},
  onPreviousTest = () => {},
  onMainPageReturn = () => {},
}) => {
  const FLASK_API = "http://localhost:5000";
  const LARAVEL_API =
    import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

  const [uploadedImage, setUploadedImage] = useState(null);
  const [recognitionResult, setRecognitionResult] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [calibrationInfo, setCalibrationInfo] = useState(null);
  const [testCompleted, setTestCompleted] = useState(false);

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

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please upload an image file");
      return;
    }

    // Store file for display
    const reader = new FileReader();
    reader.onload = (event) => {
      setUploadedImage({
        file: file,
        preview: event.target.result,
      });
    };
    reader.readAsDataURL(file);

    // Automatically recognize
    await recognizeDisplay(file);
  };

  const recognizeDisplay = async (file) => {
    const imageFile = file || uploadedImage?.file;
    if (!imageFile) return;

    setIsProcessing(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("image", imageFile);
      formData.append("debug", "false");
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

      // Mark test as completed and pass data to parent
      if (data.is_valid) {
        const displayNumber = getDisplayNumberFromData(data);
        const moistureData = {
          value: displayNumber,
          timestamp: new Date().toISOString(),
          digits: data.digits,
          rawNumber: data.raw_number,
          fullNumber: data.full_number,
          isValid: data.is_valid,
        };

        setTestCompleted(true);

        // Call parent callback with moisture data
        if (typeof onTestComplete === "function") {
          onTestComplete(moistureData);
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const resetAll = () => {
    setUploadedImage(null);
    setRecognitionResult(null);
    setError(null);
    setTestCompleted(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Get the display number (with decimal if configured)
  const getDisplayNumber = () => {
    if (!recognitionResult) return null;
    return getDisplayNumberFromData(recognitionResult);
  };

  const getDisplayNumberFromData = (data) => {
    if (!data) return null;

    // If the API already formatted it with decimal, use that
    if (data.full_number && data.full_number.includes(".")) {
      return data.full_number;
    }

    // Otherwise, format it using our calibration info
    if (calibrationInfo && data.raw_number) {
      return formatNumberWithDecimal(
        data.raw_number,
        calibrationInfo.hasDecimalPoint,
        calibrationInfo.decimalPosition,
      );
    }

    return data.full_number || data.raw_number;
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
          TimberMach | Moisture Test
        </span>

        {/* Test Completion Indicator */}
        {testCompleted && (
          <div className="ml-4 flex items-center gap-2 bg-green-900 bg-opacity-30 border border-green-700 rounded-lg px-3 py-1">
            <span className="w-2 h-2 bg-green-400 rounded-full"></span>
            <span className="text-green-400 text-sm font-semibold">
              Test Complete
            </span>
          </div>
        )}

        {calibrationInfo && calibrationInfo.hasDecimalPoint && (
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
        <div className="max-w-4xl mx-auto">
          {/* Error Message */}
          {error && (
            <div className="bg-red-900 border border-red-700 text-red-200 px-4 py-3 rounded-lg mb-6 flex items-center gap-2">
              <X className="w-5 h-5" />
              <span>{error}</span>
            </div>
          )}

          {/* Upload Section - Only show if no result */}
          {!recognitionResult && !isProcessing && (
            <div className="bg-gray-800 rounded-lg p-6 mb-6">
              <h2 className="text-xl font-bold mb-4 text-white">
                Upload Moisture Meter Image
              </h2>
              <div className="border-2 border-dashed border-gray-600 rounded-lg p-12 text-center hover:border-blue-500 transition-colors cursor-pointer">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                  id="imageUpload"
                />
                <label htmlFor="imageUpload" className="cursor-pointer block">
                  <Upload className="w-16 h-16 text-gray-500 mx-auto mb-4" />
                  <p className="text-white font-semibold mb-2">
                    Click to upload image
                  </p>
                  <p className="text-gray-400 text-sm">
                    Upload moisture meter display image for instant recognition
                  </p>
                  <p className="text-blue-400 text-xs mt-2">
                    Supported formats: JPG, PNG, HEIC
                  </p>
                </label>
              </div>
            </div>
          )}

          {/* Processing Indicator */}
          {isProcessing && (
            <div className="bg-blue-900 border border-blue-700 rounded-lg p-12 text-center">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400 mb-4"></div>
              <p className="text-blue-200 font-semibold">
                Recognizing display...
              </p>
              <p className="text-gray-400 text-sm mt-2">
                This may take a few seconds
              </p>
            </div>
          )}

          {/* Recognition Result - Only the reading */}
          {recognitionResult && !isProcessing && (
            <div className="bg-gray-800 rounded-lg p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-white">
                  Recognition Result
                </h2>
                <button
                  onClick={resetAll}
                  className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg flex items-center gap-2 transition-colors text-white"
                >
                  <RotateCcw className="w-4 h-4" />
                  New Reading
                </button>
              </div>

              {/* Display the uploaded image */}
              {uploadedImage && (
                <div className="mb-6 rounded-lg overflow-hidden">
                  <img
                    src={uploadedImage.preview}
                    alt="Uploaded moisture meter"
                    className="w-full h-auto max-h-96 object-contain bg-gray-900 rounded-lg"
                  />
                </div>
              )}

              <div
                className={`${
                  recognitionResult.is_valid
                    ? "bg-green-900 border-green-700"
                    : "bg-yellow-900 border-yellow-700"
                } bg-opacity-30 border rounded-lg p-12 text-center`}
              >
                <div className="text-gray-300 text-base mb-4">
                  Moisture Reading
                </div>
                <div
                  className={`text-8xl font-bold mb-4 ${
                    recognitionResult.is_valid
                      ? "text-green-400"
                      : "text-yellow-400"
                  }`}
                >
                  {getDisplayNumber()}
                  <span className="text-4xl ml-2">%</span>
                </div>
                <div className="text-base text-gray-400 mb-2">
                  {recognitionResult.is_valid
                    ? "✓ Valid Reading"
                    : "⚠ Check Reading"}
                </div>
                {calibrationInfo && calibrationInfo.hasDecimalPoint && (
                  <div className="text-sm text-blue-300 mt-2">
                    Format:{" "}
                    {calibrationInfo.decimalPosition === 1 ? "XX.X" : "X.XX"}
                  </div>
                )}

                {/* Recognition Details */}
                <div className="mt-6 pt-6 border-t border-gray-600">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="text-left">
                      <div className="text-gray-400">Raw Number:</div>
                      <div className="text-white font-mono">
                        {recognitionResult.raw_number}
                      </div>
                    </div>
                    <div className="text-left">
                      <div className="text-gray-400">Formatted:</div>
                      <div className="text-white font-mono">
                        {recognitionResult.full_number}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Test Complete Message */}
              {testCompleted && (
                <div className="mt-6 bg-green-900 bg-opacity-30 border border-green-700 rounded-lg p-4 text-center">
                  <p className="text-green-400 font-semibold">
                    ✓ Moisture test data saved successfully
                  </p>
                  <p className="text-gray-400 text-sm mt-1">
                    You can proceed to the next test or retake this measurement
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Instructions */}
          {!recognitionResult && !isProcessing && (
            <div className="bg-blue-900 bg-opacity-20 border border-blue-700 rounded-lg p-6 mt-6">
              <h3 className="text-blue-400 font-semibold mb-3 flex items-center gap-2">
                <span className="text-xl">ℹ️</span>
                How to Use
              </h3>
              <ul className="text-gray-300 text-sm space-y-2">
                <li>
                  • Take a clear photo of your moisture meter's digital display
                </li>
                <li>• Ensure good lighting and the display is in focus</li>
                <li>• The system will automatically recognize the reading</li>
                <li>
                  • Calibration must be set up in advance (check settings)
                </li>
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Navigation - Only show when test is complete */}
      {testCompleted && (
        <div className="bg-gray-800 border-t border-gray-700 p-4">
          <div className="max-w-4xl mx-auto flex justify-between items-center">
            <button
              onClick={onPreviousTest}
              className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-3 rounded-lg font-semibold flex items-center gap-2 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              Previous Test
            </button>

            <div className="text-center">
              <div className="text-gray-400 text-sm">
                Moisture Reading Recorded
              </div>
              <div className="text-green-400 text-xl font-bold">
                {getDisplayNumber()}%
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
