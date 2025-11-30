import React, { useState, useRef, useEffect } from 'react';
import { Upload, RotateCcw, X } from 'lucide-react';

const MoistureTest = () => {
  const FLASK_API = 'http://localhost:5000';
  const LARAVEL_API = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';
  
  const [uploadedImage, setUploadedImage] = useState(null);
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
      const active = calibrations.find(cal => cal.is_active);
      
      if (active) {
        setCalibrationInfo({
          hasDecimalPoint: active.has_decimal_point,
          decimalPosition: active.decimal_position
        });
      }
    } catch (err) {
      console.error('Failed to load calibration:', err);
    }
  };

  const formatNumberWithDecimal = (rawNumber, hasDecimal, decimalPos) => {
    if (!hasDecimal || !rawNumber || rawNumber.includes('?')) {
      return rawNumber;
    }

    if (rawNumber.length < decimalPos) {
      return rawNumber;
    }

    // Insert decimal from right
    const insertPos = rawNumber.length - decimalPos;
    return rawNumber.slice(0, insertPos) + '.' + rawNumber.slice(insertPos);
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file');
      return;
    }

    // Store file for display
    const reader = new FileReader();
    reader.onload = (event) => {
      setUploadedImage({
        file: file,
        preview: event.target.result
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
      formData.append('image', imageFile);
      formData.append('debug', 'false');
      formData.append('method', 'simple_threshold');

      const response = await fetch(`${FLASK_API}/seven-segment/recognize`, {
        method: 'POST',
        body: formData
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Recognition failed');
      }

      setRecognitionResult(data);

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
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Get the display number (with decimal if configured)
  const getDisplayNumber = () => {
    if (!recognitionResult) return null;
    
    // If the API already formatted it with decimal, use that
    if (recognitionResult.full_number && recognitionResult.full_number.includes('.')) {
      return recognitionResult.full_number;
    }
    
    // Otherwise, format it using our calibration info
    if (calibrationInfo && recognitionResult.raw_number) {
      return formatNumberWithDecimal(
        recognitionResult.raw_number,
        calibrationInfo.hasDecimalPoint,
        calibrationInfo.decimalPosition
      );
    }
    
    return recognitionResult.full_number || recognitionResult.raw_number;
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold flex items-center gap-3 mb-2">
            Seven-Segment Recognition Test
          </h1>
          <p className="text-gray-400">
            Upload an image to instantly recognize the moisture reading
          </p>
          {calibrationInfo && calibrationInfo.hasDecimalPoint && (
            <p className="text-blue-400 text-sm mt-2">
              ℹ️ Decimal format: {calibrationInfo.decimalPosition === 1 ? 'XX.X' : 'X.XX'}
            </p>
          )}
        </div>

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
            <h2 className="text-xl font-bold mb-4">Upload Image</h2>
            <div className="border-2 border-dashed border-gray-600 rounded-lg p-12 text-center hover:border-blue-500 transition-colors">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
                id="imageUpload"
              />
              <label htmlFor="imageUpload" className="cursor-pointer">
                <Upload className="w-16 h-16 text-gray-500 mx-auto mb-4" />
                <p className="text-white font-semibold mb-2">Click to upload image</p>
                <p className="text-gray-400 text-sm">
                  Upload moisture meter display image for instant recognition
                </p>
              </label>
            </div>
          </div>
        )}

        {/* Processing Indicator */}
        {isProcessing && (
          <div className="bg-blue-900 border border-blue-700 rounded-lg p-12 text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400 mb-4"></div>
            <p className="text-blue-200 font-semibold">Recognizing display...</p>
          </div>
        )}

        {/* Recognition Result - Only the reading */}
        {recognitionResult && !isProcessing && (
          <div className="bg-gray-800 rounded-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">Recognition Result</h2>
              <button
                onClick={resetAll}
                className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                New Reading
              </button>
            </div>
            
            <div className={`${
              recognitionResult.is_valid 
                ? 'bg-green-900 border-green-700' 
                : 'bg-yellow-900 border-yellow-700'
            } bg-opacity-30 border rounded-lg p-12 text-center`}>
              <div className="text-gray-300 text-base mb-4">Moisture Reading</div>
              <div className={`text-8xl font-bold mb-4 ${
                recognitionResult.is_valid ? 'text-green-400' : 'text-yellow-400'
              }`}>
                {getDisplayNumber()}
              </div>
              <div className="text-base text-gray-400 mb-2">
                {recognitionResult.is_valid ? '✓ Valid Reading' : '⚠ Valid Reading'}
              </div>
              {calibrationInfo && calibrationInfo.hasDecimalPoint && (
                <div className="text-sm text-blue-300 mt-2">
                  Format: {calibrationInfo.decimalPosition === 1 ? 'XX.X' : 'X.XX'}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MoistureTest;