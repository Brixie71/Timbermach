import React, { useState, useRef, useEffect } from 'react';
import { Upload, Square, Check, AlertCircle, Trash2, ArrowRight, Eye, ArrowLeft, RotateCcw } from 'lucide-react';

const SevenSegmentCalibration = ({ onComplete, onCancel }) => {
  const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';
  
  // States
  const [step, setStep] = useState(1); // 1: Upload, 2: Segment Boxes, 3: Verify
  const [capturedImage, setCapturedImage] = useState(null);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [displayBox, setDisplayBox] = useState(null);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [segmentBoxes, setSegmentBoxes] = useState([[], [], []]); // 3 digits, 7 segments each
  const [currentDigit, setCurrentDigit] = useState(0);
  const [currentSegment, setCurrentSegment] = useState(0);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState(null);
  const [tempBox, setTempBox] = useState(null);
  const [recognitionResult, setRecognitionResult] = useState(null);
  const [debugInfo, setDebugInfo] = useState(null);
  const [error, setError] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasDecimalPoint, setHasDecimalPoint] = useState(false);
  const [decimalPosition, setDecimalPosition] = useState(1); // 1 = XX.X, 2 = X.XX
  
  const fileInputRef = useRef(null);
  const canvasRef = useRef(null);
  const overlayCanvasRef = useRef(null);
  const imageRef = useRef(null);
  
  const SEGMENT_LABELS = ['A (Top)', 'B (Top-Right)', 'C (Bottom-Right)', 'D (Bottom)', 'E (Bottom-Left)', 'F (Top-Left)', 'G (Middle)'];
  const DIGIT_COLORS = ['#3b82f6', '#ef4444', '#10b981']; // Blue, Red, Green

  // Handle file upload
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file');
      return;
    }

    setUploadedFile(file);
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = async () => {
        // Automatically set display box to full image size
        const autoDisplayBox = {
          x: 0,
          y: 0,
          width: img.width,
          height: img.height
        };
        
        setDisplayBox(autoDisplayBox);
        setImageSize({ width: img.width, height: img.height });
        setCapturedImage(event.target.result);
        setError(null);
        
        // Automatically generate default segment boxes
        setIsProcessing(true);
        try {
          const response = await fetch(`${API_URL}/seven-segment/create-defaults`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              displayBox: autoDisplayBox,
              numDigits: 3
            })
          });
          
          const data = await response.json();
          
          if (data.success) {
            setSegmentBoxes(data.segmentBoxes);
          }
        } catch (err) {
          console.error("Error creating defaults:", err);
        } finally {
          setIsProcessing(false);
        }
        
        setStep(2);
        setCurrentDigit(0);
        setCurrentSegment(0);
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  // Retake/reupload photo
  const retakePhoto = () => {
    setCapturedImage(null);
    setUploadedFile(null);
    setDisplayBox(null);
    setImageSize({ width: 0, height: 0 });
    setSegmentBoxes([[], [], []]);
    setCurrentDigit(0);
    setCurrentSegment(0);
    setStep(1);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Get canvas coordinates from mouse event
  const getCanvasCoordinates = (e) => {
    const canvas = overlayCanvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  };

  // Mouse handlers for drawing boxes
  const handleMouseDown = (e) => {
    if (step !== 2) return;
    
    const coords = getCanvasCoordinates(e);
    setStartPoint(coords);
    setIsDrawing(true);
    setTempBox(null);
  };

  const handleMouseMove = (e) => {
    if (!isDrawing || !startPoint) return;
    
    const coords = getCanvasCoordinates(e);
    
    setTempBox({
      x: Math.min(startPoint.x, coords.x),
      y: Math.min(startPoint.y, coords.y),
      width: Math.abs(coords.x - startPoint.x),
      height: Math.abs(coords.y - startPoint.y)
    });
  };

  const handleMouseUp = () => {
    if (!isDrawing || !tempBox) {
      setIsDrawing(false);
      setStartPoint(null);
      return;
    }
    
    setIsDrawing(false);
    setStartPoint(null);
    
    if (tempBox.width < 10 || tempBox.height < 10) {
      setTempBox(null);
      return;
    }
    
    // Save segment box
    const newSegmentBoxes = [...segmentBoxes];
    if (!newSegmentBoxes[currentDigit]) {
      newSegmentBoxes[currentDigit] = [];
    }
    newSegmentBoxes[currentDigit][currentSegment] = tempBox;
    setSegmentBoxes(newSegmentBoxes);
    setTempBox(null);
    
    // Move to next segment
    if (currentSegment < 6) {
      setCurrentSegment(currentSegment + 1);
    } else if (currentDigit < 2) {
      setCurrentDigit(currentDigit + 1);
      setCurrentSegment(0);
    }
  };

  // Clear current segment box
  const clearCurrentSegment = () => {
    const newSegmentBoxes = [...segmentBoxes];
    if (newSegmentBoxes[currentDigit] && newSegmentBoxes[currentDigit][currentSegment]) {
      newSegmentBoxes[currentDigit][currentSegment] = null;
      setSegmentBoxes(newSegmentBoxes);
    }
  };

  // Clear all segment boxes
  const clearAllSegments = () => {
    setSegmentBoxes([[], [], []]);
    setCurrentDigit(0);
    setCurrentSegment(0);
  };

  // Skip to next segment/digit
  const skipCurrent = () => {
    if (currentSegment < 6) {
      setCurrentSegment(currentSegment + 1);
    } else if (currentDigit < 2) {
      setCurrentDigit(currentDigit + 1);
      setCurrentSegment(0);
    }
  };

  // Go back to previous segment/digit
  const goBackSegment = () => {
    if (currentSegment > 0) {
      setCurrentSegment(currentSegment - 1);
    } else if (currentDigit > 0) {
      setCurrentDigit(currentDigit - 1);
      setCurrentSegment(6);
    }
  };

  // Go back to previous step
  const goBackStep = () => {
    if (step === 2) {
      retakePhoto();
    } else if (step === 3) {
      setStep(2);
      setRecognitionResult(null);
      setDebugInfo(null);
    }
  };

  // Complete calibration
  const completeCalibration = async () => {
    setIsProcessing(true);
    setError(null);
    
    try {
      // Save calibration to Laravel backend
      const LARAVEL_API_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';
      
      const response = await fetch(`${LARAVEL_API_URL}/api/calibration`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          device_name: 'Moisture Meter',
          setting_type: 'seven_segment',
          num_digits: 3,
          display_box: displayBox,
          segment_boxes: segmentBoxes,
          has_decimal_point: hasDecimalPoint,
          decimal_position: decimalPosition,
          notes: 'Created from calibration wizard'
        })
      });
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.message || 'Calibration failed');
      }
      
      // Also send to Python backend
      try {
        await fetch(`${API_URL}/seven-segment/calibrate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            displayBox,
            segmentBoxes,
            hasDecimalPoint,
            decimalPosition
          })
        });
      } catch (pythonErr) {
        console.warn('Python backend calibration failed:', pythonErr);
      }
      
      setStep(3);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // Test recognition with debug info
  const testRecognition = async () => {
    setIsProcessing(true);
    setError(null);
    
    try {
      const formData = new FormData();
      
      if (uploadedFile) {
        formData.append('image', uploadedFile);
      } else {
        const response = await fetch(capturedImage);
        const blob = await response.blob();
        formData.append('image', blob, 'test.png');
      }
      
      formData.append('debug', 'true');
      
      const apiResponse = await fetch(`${API_URL}/seven-segment/recognize`, {
        method: 'POST',
        body: formData
      });
      
      const data = await apiResponse.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Recognition failed');
      }
      
      setRecognitionResult(data);
      
      if (data.debug_info) {
        setDebugInfo(data.debug_info);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // Reset
  const reset = () => {
    setStep(1);
    setCapturedImage(null);
    setUploadedFile(null);
    setDisplayBox(null);
    setImageSize({ width: 0, height: 0 });
    setSegmentBoxes([[], [], []]);
    setCurrentDigit(0);
    setCurrentSegment(0);
    setRecognitionResult(null);
    setDebugInfo(null);
    setError(null);
    setTempBox(null);
    setIsDrawing(false);
    setStartPoint(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Draw overlay canvas
  useEffect(() => {
    if (!capturedImage || !overlayCanvasRef.current) return;
    
    const canvas = overlayCanvasRef.current;
    const ctx = canvas.getContext('2d');
    
    const img = new Image();
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Draw display box (full image outline) - subtle
      if (displayBox && step >= 2) {
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 2;
        ctx.strokeRect(displayBox.x + 1, displayBox.y + 1, displayBox.width - 2, displayBox.height - 2);
      }
      
      // Draw segment boxes
      if (step >= 2) {
        segmentBoxes.forEach((digit, digitIdx) => {
          if (digit) {
            digit.forEach((seg, segIdx) => {
              if (seg) {
                const isActive = digitIdx === currentDigit && segIdx === currentSegment && step === 2;
                ctx.strokeStyle = isActive ? '#fbbf24' : DIGIT_COLORS[digitIdx];
                ctx.lineWidth = isActive ? 3 : 2;
                ctx.strokeRect(seg.x, seg.y, seg.width, seg.height);
                
                ctx.fillStyle = isActive ? '#fbbf24' : DIGIT_COLORS[digitIdx];
                ctx.font = 'bold 12px Arial';
                ctx.fillText(
                  `D${digitIdx + 1}-${['A','B','C','D','E','F','G'][segIdx]}`,
                  seg.x + 2,
                  seg.y + 12
                );
              }
            });
          }
        });
      }
      
      // Draw temp box
      if (tempBox && isDrawing) {
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(tempBox.x, tempBox.y, tempBox.width, tempBox.height);
        ctx.setLineDash([]);
      }
    };
    
    img.src = capturedImage;
  }, [capturedImage, displayBox, segmentBoxes, tempBox, step, currentDigit, currentSegment, isDrawing]);

  return (
    <div className="min-h-screen bg-gray-900 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Square className="w-8 h-8 text-blue-400" />
            7-Segment Display Calibration
          </h1>
          
          {onCancel && (
            <button
              onClick={onCancel}
              className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600"
            >
              Cancel
            </button>
          )}
        </div>

        {/* Progress Steps */}
        <div className="bg-gray-800 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between">
            {[
              { num: 1, label: 'Upload' },
              { num: 2, label: 'Segments' },
              { num: 3, label: 'Test' }
            ].map((s, idx) => (
              <React.Fragment key={s.num}>
                <div className="flex items-center gap-2">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                    step > s.num ? 'bg-green-600 text-white' :
                    step === s.num ? 'bg-blue-600 text-white' :
                    'bg-gray-700 text-gray-400'
                  }`}>
                    {step > s.num ? <Check className="w-5 h-5" /> : s.num}
                  </div>
                  <span className={`font-semibold ${step >= s.num ? 'text-white' : 'text-gray-500'}`}>
                    {s.label}
                  </span>
                </div>
                {idx < 2 && <ArrowRight className="text-gray-600" />}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-900 border border-red-700 text-red-200 px-4 py-3 rounded-lg mb-4 flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            <span>{error}</span>
          </div>
        )}

        {/* Step 1: Upload Image */}
        {step === 1 && (
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-bold text-white mb-4">Step 1: Upload Display Image</h2>

            {/* Decimal Configuration */}
            <div className="bg-gray-750 rounded-lg p-4 mb-4 border border-gray-600">
              <h3 className="text-lg font-semibold text-white mb-3">Display Configuration</h3>
              
              <div className="flex items-center gap-4 mb-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hasDecimalPoint}
                    onChange={(e) => setHasDecimalPoint(e.target.checked)}
                    className="w-5 h-5 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                  />
                  <span className="text-white font-medium">Has Decimal Point?</span>
                </label>
              </div>

              {hasDecimalPoint && (
                <div className="ml-7 space-y-2">
                  <p className="text-sm text-gray-400 mb-2">Decimal position from right:</p>
                  <div className="flex gap-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="decimalPosition"
                        value="1"
                        checked={decimalPosition === 1}
                        onChange={() => setDecimalPosition(1)}
                        className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600"
                      />
                      <span className="text-white">XX.X (31.9)</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="decimalPosition"
                        value="2"
                        checked={decimalPosition === 2}
                        onChange={() => setDecimalPosition(2)}
                        className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600"
                      />
                      <span className="text-white">X.XX (3.19)</span>
                    </label>
                  </div>
                </div>
              )}
            </div>

            <p className="text-gray-300 mb-4">
              Upload a clear, <strong>cropped</strong> image showing ONLY the 3-digit seven-segment display. The entire image will be used as the display area.
            </p>
            
            <div className="border-2 border-dashed border-gray-600 rounded-lg p-12 text-center hover:border-blue-500 transition-colors">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
                id="imageUpload"
              />
              <label htmlFor="imageUpload" className="cursor-pointer">
                <Upload className="w-16 h-16 text-gray-500 mx-auto mb-4" />
                <p className="text-white font-semibold mb-2">Click to upload cropped display image</p>
                <p className="text-gray-400 text-sm">Image should contain ONLY the 7-segment display</p>
              </label>
            </div>
          </div>
        )}

        {/* Step 2: Draw Segment Boxes */}
        {step === 2 && capturedImage && (
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-bold text-white mb-4">Step 2: Draw Segment Boxes</h2>
            <p className="text-gray-300 mb-2">
              Draw boxes around each segment. Be precise - each box should tightly fit around just ONE segment.
            </p>
            <p className="text-sm text-blue-300 mb-4">
              ℹ️ Display size: {imageSize.width} × {imageSize.height}px (automatic - using full image)
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              {[0, 1, 2].map(digitIdx => (
                <div key={digitIdx} className={`p-3 rounded-lg ${currentDigit === digitIdx ? 'bg-gray-700 ring-2 ring-blue-500' : 'bg-gray-750'}`}>
                  <div className="font-semibold mb-2" style={{ color: DIGIT_COLORS[digitIdx] }}>
                    Digit {digitIdx + 1}
                  </div>
                  <div className="text-sm text-gray-400">
                    {segmentBoxes[digitIdx] ? segmentBoxes[digitIdx].filter(s => s).length : 0} / 7 segments
                  </div>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {['A','B','C','D','E','F','G'].map((seg, idx) => (
                      <span 
                        key={seg}
                        className={`text-xs px-2 py-1 rounded ${
                          segmentBoxes[digitIdx]?.[idx] 
                            ? 'bg-green-600 text-white' 
                            : 'bg-gray-600 text-gray-400'
                        }`}
                      >
                        {seg}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-blue-900 bg-opacity-30 border border-blue-700 rounded-lg p-4 mb-4">
              <div className="font-semibold text-blue-300 mb-2">
                Current: Digit {currentDigit + 1} - Segment {SEGMENT_LABELS[currentSegment]}
              </div>
              <div className="text-sm text-blue-200">
                Draw a tight box around ONLY the {SEGMENT_LABELS[currentSegment]} segment
              </div>
              <div className="mt-2 text-xs text-blue-300">
                💡 Tip: Make boxes as small as possible - they should only cover the lit segment area
              </div>
            </div>
            
            <div className="mb-4 relative bg-black rounded-lg overflow-hidden">
              <div className="relative inline-block w-full">
                <img 
                  src={capturedImage} 
                  alt="Captured" 
                  className="max-w-full h-auto mx-auto"
                  style={{ maxHeight: '600px' }}
                />
                <canvas
                  ref={overlayCanvasRef}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  className="absolute top-0 left-0 w-full h-full cursor-crosshair"
                  style={{ pointerEvents: 'auto' }}
                />
              </div>
            </div>

            <div className="flex gap-3 mb-3">
              <button
                onClick={goBackStep}
                className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
              
              <button
                onClick={goBackSegment}
                disabled={currentDigit === 0 && currentSegment === 0}
                className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 disabled:opacity-50 flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Previous
              </button>
              
              <button
                onClick={clearCurrentSegment}
                disabled={!segmentBoxes[currentDigit]?.[currentSegment]}
                className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 flex items-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                Clear
              </button>
              
              <button
                onClick={clearAllSegments}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Clear All
              </button>
            </div>

            <div className="flex gap-3">
              <button
                onClick={skipCurrent}
                disabled={currentDigit === 2 && currentSegment === 6}
                className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50"
              >
                Skip
              </button>
              
              <button
                onClick={completeCalibration}
                disabled={isProcessing}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isProcessing ? 'Saving...' : 'Complete Calibration'}
                <Check className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Test Recognition */}
        {step === 3 && (
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-bold text-white mb-4">Step 3: Test Recognition</h2>
            <p className="text-gray-300 mb-4">
              Calibration complete! Test the recognition on your uploaded image to verify accuracy.
            </p>

            {recognitionResult ? (
              <div>
                <div className={`${
                  recognitionResult.is_valid 
                    ? 'bg-green-900 border-green-700' 
                    : 'bg-yellow-900 border-yellow-700'
                } bg-opacity-30 border rounded-lg p-6 mb-4`}>
                  <div className="text-center">
                    <div className="text-gray-300 text-sm mb-2">Recognized Number</div>
                    <div className={`text-6xl font-bold mb-2 ${
                      recognitionResult.is_valid ? 'text-green-400' : 'text-yellow-400'
                    }`}>
                      {recognitionResult.full_number}
                    </div>
                    <div className="text-sm text-gray-400">
                      {recognitionResult.is_valid ? '✓ Valid' : '⚠ Contains unknown segments'}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 mb-4">
                  {recognitionResult.digits.map((digit, idx) => (
                    <div key={idx} className="bg-gray-700 rounded-lg p-4">
                      <div className="text-center mb-3">
                        <div className="text-gray-400 text-xs mb-1">Digit {idx + 1}</div>
                        <div className="text-4xl font-bold" style={{ color: DIGIT_COLORS[idx] }}>
                          {digit.recognized_digit}
                        </div>
                      </div>
                      <div className="text-xs space-y-2">
                        <div className="text-gray-400">Binary: <span className="font-mono text-white">{digit.binary_code}</span></div>
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

                {debugInfo && (
                  <details className="bg-gray-750 rounded-lg p-4 mb-4">
                    <summary className="cursor-pointer text-blue-400 font-semibold mb-2">
                      Debug Information
                    </summary>
                    <pre className="text-xs text-gray-300 overflow-auto max-h-96 bg-gray-900 p-3 rounded">
                      {JSON.stringify(debugInfo, null, 2)}
                    </pre>
                  </details>
                )}

                {recognitionResult.full_number === '888' && (
                  <div className="bg-yellow-900 border border-yellow-700 rounded-lg p-4 mb-4">
                    <div className="flex gap-3">
                      <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <div className="font-semibold text-yellow-300 mb-2">
                          Calibration Issue Detected
                        </div>
                        <div className="text-yellow-200 text-sm space-y-1">
                          <p>All segments detected as ON. Segment boxes may be too large or overlap.</p>
                          <p className="mt-3 font-semibold">💡 Go back and draw smaller, more precise boxes</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8">
                <button
                  onClick={testRecognition}
                  disabled={isProcessing}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-lg font-semibold text-lg disabled:opacity-50 flex items-center justify-center gap-2 mx-auto"
                >
                  {isProcessing ? 'Testing...' : 'Test Recognition'}
                  <Eye className="w-5 h-5" />
                </button>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={goBackStep}
                className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
              
              <button
                onClick={reset}
                className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Start Over
              </button>
              
              {onComplete && (
                <button
                  onClick={() => onComplete(recognitionResult)}
                  disabled={!recognitionResult || recognitionResult.full_number === '888'}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-semibold disabled:opacity-50"
                >
                  Use This Calibration
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  );
};

export default SevenSegmentCalibration;