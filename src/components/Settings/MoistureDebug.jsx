import React, { useState, useRef, useEffect } from 'react';
import { Upload, Eye, Settings, Check, X } from 'lucide-react';

const MoistureDebug = () => {
  const FLASK_API = 'http://localhost:5000';
  const LARAVEL_API = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';
  
  const [uploadedImage, setUploadedImage] = useState(null);
  const [visualizationImage, setVisualizationImage] = useState(null);
  const [recognitionResult, setRecognitionResult] = useState(null);
  const [diagnostics, setDiagnostics] = useState(null);
  const [detectionMethod, setDetectionMethod] = useState('simple_threshold');
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

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setUploadedImage({
        file: file,
        preview: event.target.result
      });
      setError(null);
      setVisualizationImage(null);
      setRecognitionResult(null);
    };
    reader.readAsDataURL(file);
  };

  const diagnoseSegments = async () => {
    if (!uploadedImage) return;

    setIsProcessing(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('image', uploadedImage.file);

      const response = await fetch(`${FLASK_API}/seven-segment/diagnose`, {
        method: 'POST',
        body: formData
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Diagnosis failed');
      }

      setDiagnostics(data.diagnostics);
      console.log('Diagnostics:', data.diagnostics);

    } catch (err) {
      setError(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const visualizeSegments = async () => {
    if (!uploadedImage) return;

    setIsProcessing(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('image', uploadedImage.file);
      formData.append('method', detectionMethod);

      const response = await fetch(`${FLASK_API}/seven-segment/visualize`, {
        method: 'POST',
        body: formData
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Visualization failed');
      }

      setVisualizationImage(`data:image/png;base64,${data.visualization}`);

    } catch (err) {
      setError(err.message);
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
      formData.append('image', uploadedImage.file);
      formData.append('debug', 'true');
      formData.append('method', detectionMethod);

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

  const clearAll = () => {
    setUploadedImage(null);
    setVisualizationImage(null);
    setRecognitionResult(null);
    setDiagnostics(null);
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
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold flex items-center gap-3 mb-2">
            <Settings className="w-8 h-8 text-blue-400" />
            Seven-Segment Binary Detector
          </h1>
          <p className="text-gray-400">
            Test and visualize segment detection with binary states (0/1)
          </p>
          {calibrationInfo && calibrationInfo.hasDecimalPoint && (
            <p className="text-blue-400 text-sm mt-2">
              ℹ️ Decimal format: {calibrationInfo.decimalPosition === 1 ? 'XX.X' : 'X.XX'}
            </p>
          )}
        </div>

        {/* Detection Method Selector */}
        <div className="bg-gray-800 rounded-lg p-4 mb-6">
          <label className="block text-sm font-semibold mb-2">Detection Method:</label>
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => setDetectionMethod('simple_threshold')}
              className={`p-4 rounded-lg border-2 transition-all ${
                detectionMethod === 'simple_threshold'
                  ? 'border-blue-500 bg-blue-900 bg-opacity-30'
                  : 'border-gray-600 bg-gray-700 hover:border-gray-500'
              }`}
            >
              <div className="font-semibold mb-1">Simple Threshold</div>
              <div className="text-xs text-gray-400">
                0x00-0x33 (0-51) = Dark<br />
                0x33-0xFF (51-255) = Light
              </div>
            </button>

            <button
              onClick={() => setDetectionMethod('smart_adaptive')}
              className={`p-4 rounded-lg border-2 transition-all ${
                detectionMethod === 'smart_adaptive'
                  ? 'border-blue-500 bg-blue-900 bg-opacity-30'
                  : 'border-gray-600 bg-gray-700 hover:border-gray-500'
              }`}
            >
              <div className="font-semibold mb-1">Smart Adaptive</div>
              <div className="text-xs text-gray-400">
                Percentile-based analysis<br />
                More robust detection
              </div>
            </button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-900 border border-red-700 text-red-200 px-4 py-3 rounded-lg mb-6 flex items-center gap-2">
            <X className="w-5 h-5" />
            <span>{error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column - Upload */}
          <div className="space-y-6">
            {/* Upload Section */}
            {!uploadedImage ? (
              <div className="bg-gray-800 rounded-lg p-6">
                <h2 className="text-xl font-bold mb-4">1. Upload Image</h2>
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
                    <p className="text-gray-400 text-sm">Upload moisture meter display image</p>
                  </label>
                </div>
              </div>
            ) : (
              <div className="bg-gray-800 rounded-lg p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-bold">1. Uploaded Image</h2>
                  <button
                    onClick={clearAll}
                    className="bg-red-600 hover:bg-red-700 px-3 py-2 rounded-lg flex items-center gap-2"
                  >
                    <X className="w-4 h-4" />
                    Clear
                  </button>
                </div>
                <img
                  src={uploadedImage.preview}
                  alt="Uploaded"
                  className="w-full rounded-lg mb-4"
                />

                <div className="grid grid-cols-3 gap-3">
                  <button
                    onClick={diagnoseSegments}
                    disabled={isProcessing}
                    className="bg-yellow-600 hover:bg-yellow-700 px-4 py-3 rounded-lg font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <Settings className="w-5 h-5" />
                    {isProcessing ? 'Checking...' : 'Diagnose'}
                  </button>

                  <button
                    onClick={visualizeSegments}
                    disabled={isProcessing}
                    className="bg-purple-600 hover:bg-purple-700 px-4 py-3 rounded-lg font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <Eye className="w-5 h-5" />
                    {isProcessing ? 'Processing...' : 'Visualize'}
                  </button>

                  <button
                    onClick={recognizeDisplay}
                    disabled={isProcessing}
                    className="bg-green-600 hover:bg-green-700 px-4 py-3 rounded-lg font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <Check className="w-5 h-5" />
                    {isProcessing ? 'Reading...' : 'Recognize'}
                  </button>
                </div>
              </div>
            )}

            {/* Legend */}
            <div className="bg-gray-800 rounded-lg p-6">
              <h3 className="text-lg font-bold mb-3">Legend</h3>
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 border-4 border-green-500 rounded flex items-center justify-center text-white font-bold text-xl">
                    1
                  </div>
                  <div>
                    <div className="font-semibold text-green-400">Segment ON</div>
                    <div className="text-xs text-gray-400">Green box with "1"</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 border-4 border-red-500 rounded flex items-center justify-center text-white font-bold text-xl">
                    0
                  </div>
                  <div>
                    <div className="font-semibold text-red-400">Segment OFF</div>
                    <div className="text-xs text-gray-400">Red box with "0"</div>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-gray-700">
                <div className="text-xs text-gray-400">
                  <div className="mb-1">Each box shows:</div>
                  <ul className="list-disc ml-5 space-y-1">
                    <li>Top-left: Segment label (e.g., D1A)</li>
                    <li>Center: Binary state (0 or 1)</li>
                    <li>Bottom-left: Mean brightness value</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Results */}
          <div className="space-y-6">
            {/* Diagnostics */}
            {diagnostics && (
              <div className="bg-gray-800 rounded-lg p-6">
                <h2 className="text-xl font-bold mb-4">🔍 Brightness Diagnostics</h2>
                
                <div className="bg-gray-750 rounded-lg p-4 mb-4">
                  <h3 className="font-semibold mb-2">Display Info</h3>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-gray-400">Type:</span>{' '}
                      <span className="font-mono">{diagnostics.display_inverted ? 'INVERTED (dark on light)' : 'NORMAL (light on dark)'}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">Mean:</span>{' '}
                      <span className="font-mono">{diagnostics.display_mean_brightness.toFixed(1)}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">Min:</span>{' '}
                      <span className="font-mono">{diagnostics.display_min.toFixed(1)}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">Max:</span>{' '}
                      <span className="font-mono">{diagnostics.display_max.toFixed(1)}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {diagnostics.digits.map((digit, digitIdx) => (
                    <div key={digitIdx} className="bg-gray-750 rounded-lg p-3">
                      <h4 className="font-semibold mb-2 text-blue-400">Digit {digitIdx + 1}</h4>
                      <div className="grid grid-cols-1 gap-2 text-xs">
                        {digit.segments.map((seg, segIdx) => (
                          <div 
                            key={segIdx}
                            className={`p-2 rounded flex justify-between items-center ${
                              seg.should_be_on_simple ? 'bg-green-900 bg-opacity-30' : 'bg-red-900 bg-opacity-30'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span className="font-bold">{seg.label}</span>
                              <span className={seg.should_be_on_simple ? 'text-green-400' : 'text-red-400'}>
                                {seg.should_be_on_simple ? '✓ ON' : '✗ OFF'}
                              </span>
                            </div>
                            <div className="font-mono text-gray-300">
                              Mean: {seg.mean.toFixed(1)} | 
                              Min: {seg.min.toFixed(1)} | 
                              Max: {seg.max.toFixed(1)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 p-3 bg-blue-900 bg-opacity-30 rounded-lg text-sm">
                  <p className="text-blue-300">
                    💡 <strong>Threshold:</strong> Values &gt; 51 = Light/White, Values &lt; 51 = Dark/Black
                  </p>
                  <p className="text-blue-300 mt-1">
                    {diagnostics.display_inverted ? 
                      '🔌 Inverted display: Dark segments (&lt;51) should be ON' :
                      '🔌 Normal display: Light segments (&gt;51) should be ON'
                    }
                  </p>
                </div>
              </div>
            )}

            {/* Visualization */}
            {visualizationImage && (
              <div className="bg-gray-800 rounded-lg p-6">
                <h2 className="text-xl font-bold mb-4">2. Binary State Visualization</h2>
                <img
                  src={visualizationImage}
                  alt="Visualization"
                  className="w-full rounded-lg"
                />
                <div className="mt-4 text-sm text-gray-400">
                  <p>✓ Green boxes (1) = Segment is ON</p>
                  <p>✗ Red boxes (0) = Segment is OFF</p>
                  <p>Method: {detectionMethod === 'simple_threshold' ? 'Simple Threshold' : 'Smart Adaptive'}</p>
                </div>
              </div>
            )}

            {/* Recognition Result */}
            {recognitionResult && (
              <div className="bg-gray-800 rounded-lg p-6">
                <h2 className="text-xl font-bold mb-4">3. Recognition Result</h2>
                
                <div className={`${
                  recognitionResult.is_valid 
                    ? 'bg-green-900 border-green-700' 
                    : 'bg-yellow-900 border-yellow-700'
                } bg-opacity-30 border rounded-lg p-6 mb-4 text-center`}>
                  <div className="text-gray-300 text-sm mb-2">Recognized Number</div>
                  <div className={`text-6xl font-bold mb-2 ${
                    recognitionResult.is_valid ? 'text-green-400' : 'text-yellow-400'
                  }`}>
                    {getDisplayNumber()}
                  </div>
                  <div className="text-sm text-gray-400">
                    {recognitionResult.is_valid ? '✓ Valid' : '⚠ Contains unknown segments'}
                  </div>
                  {calibrationInfo && calibrationInfo.hasDecimalPoint && (
                    <div className="text-xs text-blue-300 mt-2">
                      Decimal format: {calibrationInfo.decimalPosition === 1 ? 'XX.X' : 'X.XX'}
                    </div>
                  )}
                </div>

                {/* Digit Details */}
                <div className="grid grid-cols-3 gap-4">
                  {recognitionResult.digits.map((digit, idx) => (
                    <div key={idx} className="bg-gray-700 rounded-lg p-4">
                      <div className="text-center mb-3">
                        <div className="text-gray-400 text-xs mb-1">Digit {idx + 1}</div>
                        <div className="text-4xl font-bold text-blue-400">
                          {digit.recognized_digit}
                        </div>
                      </div>
                      <div className="text-xs space-y-2">
                        <div className="text-gray-400">
                          Binary: <span className="font-mono text-white">{digit.binary_code}</span>
                        </div>
                        <div className="grid grid-cols-7 gap-1">
                          {['A','B','C','D','E','F','G'].map((seg, i) => (
                            <div 
                              key={seg}
                              className={`text-center p-1 rounded text-xs font-bold ${
                                digit.segment_states[i] 
                                  ? 'bg-green-600 text-white' 
                                  : 'bg-red-900 text-red-300'
                              }`}
                            >
                              {seg}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Debug Info */}
                {recognitionResult.debug_info && (
                  <details className="mt-4 bg-gray-750 rounded-lg p-4">
                    <summary className="cursor-pointer text-blue-400 font-semibold mb-2">
                      Debug Information
                    </summary>
                    <pre className="text-xs text-gray-300 overflow-auto max-h-96 bg-gray-900 p-3 rounded">
                      {JSON.stringify(recognitionResult.debug_info, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MoistureDebug;