import React, { useState, useEffect, useRef } from 'react';
import { Settings, Camera, Upload, X } from 'lucide-react';

const MoistureTest = ({
  onTestComplete = () => {},
  onPreviousTest = () => {},
  onMainPageReturn = () => {}
}) => {
  // Use Python Flask backend for seven-segment OCR
  const VITE_PYTHON_API_URL = 'http://localhost:5000';
  
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const recognitionIntervalRef = useRef(null);
  const fileInputRef = useRef(null);

  const [cameraError, setCameraError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [permissionRequested, setPermissionRequested] = useState(false);
  const [showInitialScreen, setShowInitialScreen] = useState(true);
  const [availableCameras, setAvailableCameras] = useState([]);
  const [selectedCameraId, setSelectedCameraId] = useState(null);
  const [showCameraSelector, setShowCameraSelector] = useState(false);
  
  // Seven-segment calibration states
  const [showCalibration, setShowCalibration] = useState(false);
  const [isCalibrated, setIsCalibrated] = useState(false);
  const [moistureReading, setMoistureReading] = useState(null);
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [readingHistory, setReadingHistory] = useState([]);
  const [autoRecognize, setAutoRecognize] = useState(false);
  
  // Image upload mode
  const [uploadedImage, setUploadedImage] = useState(null);
  const [useImageMode, setUseImageMode] = useState(false);
  
  // Visualization
  const [showSegmentOverlay, setShowSegmentOverlay] = useState(true);
  const [calibrationData, setCalibrationData] = useState(null);
  const overlayCanvasRef = useRef(null);

  // Check if calibration exists on mount
  useEffect(() => {
    checkCalibration();
  }, []);

  const checkCalibration = async () => {
    try {
      console.log('Checking Flask calibration at:', `${VITE_PYTHON_API_URL}/seven-segment/calibration`);
      const flaskResponse = await fetch(`${VITE_PYTHON_API_URL}/seven-segment/calibration`);
      
      if (flaskResponse.ok) {
        const flaskData = await flaskResponse.json();
        if (flaskData.success && flaskData.calibration !== null) {
          setIsCalibrated(true);
          setCalibrationData(flaskData.calibration);
          console.log('Flask already has calibration');
          return;
        }
      }
      
      console.log('Loading calibration from Laravel...');
      const LARAVEL_API_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';
      const laravelResponse = await fetch(`${LARAVEL_API_URL}/api/calibration`);
      
      if (!laravelResponse.ok) {
        console.log('No Laravel calibration found');
        setIsCalibrated(false);
        setCalibrationData(null);
        return;
      }
      
      const calibrations = await laravelResponse.json();
      const activeCalibration = calibrations.find(cal => cal.is_active);
      
      if (activeCalibration) {
        console.log('Found active calibration in Laravel, syncing to Flask...');
        
        const syncResponse = await fetch(`${VITE_PYTHON_API_URL}/seven-segment/calibrate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            displayBox: activeCalibration.display_box,
            segmentBoxes: activeCalibration.segment_boxes
          })
        });
        
        if (syncResponse.ok) {
          console.log('Calibration synced to Flask successfully');
          setIsCalibrated(true);
          setCalibrationData({
            display_box: activeCalibration.display_box,
            segment_boxes: activeCalibration.segment_boxes,
            num_digits: activeCalibration.num_digits
          });
        } else {
          console.error('Failed to sync calibration to Flask');
          setIsCalibrated(false);
          setCalibrationData(null);
        }
      } else {
        console.log('No active calibration found in Laravel');
        setIsCalibrated(false);
        setCalibrationData(null);
      }
      
    } catch (err) {
      console.error('Failed to check calibration:', err);
      setIsCalibrated(false);
      setCalibrationData(null);
    }
  };

  // Handle image upload
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setUploadedImage({
        file: file,
        preview: event.target.result
      });
      setUseImageMode(true);
      setShowInitialScreen(false);
    };
    reader.readAsDataURL(file);
  };

  // Recognize from uploaded image
  const recognizeUploadedImage = async () => {
    if (!uploadedImage || !isCalibrated) {
      alert("Please calibrate the display first");
      return;
    }

    try {
      setIsRecognizing(true);

      const formData = new FormData();
      formData.append('image', uploadedImage.file);
      
      console.log('Sending recognition request to:', `${VITE_PYTHON_API_URL}/seven-segment/recognize`);
      const response = await fetch(`${VITE_PYTHON_API_URL}/seven-segment/recognize`, {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        throw new Error(`Recognition request failed with status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.success && data.is_valid) {
        const reading = {
          value: data.full_number,
          timestamp: new Date(),
          digits: data.digits
        };
        
        setMoistureReading(reading);
        setReadingHistory(prev => [reading, ...prev.slice(0, 9)]);
      } else {
        console.warn("Recognition failed or invalid:", data);
        alert("Could not read display. Error: " + (data.error || "Invalid reading"));
      }
      
    } catch (err) {
      console.error("Recognition error:", err);
      alert("Recognition failed: " + err.message);
    } finally {
      setIsRecognizing(false);
    }
  };

  // Clear uploaded image and return to initial screen
  const clearUploadedImage = () => {
    setUploadedImage(null);
    setUseImageMode(false);
    setShowInitialScreen(true);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const getCameraDevices = async () => {
    try {
      try {
        const tempStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        tempStream.getTracks().forEach(track => track.stop());
      } catch (permErr) {
        console.log("Permission not granted yet, device labels may be empty");
      }
      
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      console.log("Available cameras:", videoDevices);
      
      const camerasWithLabels = videoDevices.map((device, index) => ({
        deviceId: device.deviceId,
        label: device.label || `Camera ${index + 1}`,
        groupId: device.groupId
      }));
      
      setAvailableCameras(camerasWithLabels);
      return camerasWithLabels;
    } catch (err) {
      console.error("Error getting camera devices:", err);
      setAvailableCameras([]);
      return [];
    }
  };

  const requestCameraPermission = async (deviceId = null) => {
    try {
      setIsLoading(true);
      setCameraError(null);
      setPermissionRequested(true);
      setShowInitialScreen(false);
      setUseImageMode(false);
      
      console.log("Requesting camera permission...");

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Camera access not supported. Please use HTTPS or localhost.");
      }

      const cameras = await getCameraDevices();
      
      if (cameras.length === 0) {
        throw new Error("No camera devices found on this system.");
      }
      
      if (!deviceId && cameras.length > 1) {
        console.log("Multiple cameras found, showing selector");
        setShowCameraSelector(true);
        setIsLoading(false);
        return;
      }

      const selectedDevice = deviceId || (cameras.length === 1 ? cameras[0].deviceId : null);
      
      if (!selectedDevice) {
        setShowCameraSelector(true);
        setIsLoading(false);
        return;
      }

      console.log("Using camera device:", selectedDevice);

      const constraints = {
        video: {
          deviceId: { exact: selectedDevice },
          width: { min: 640, ideal: 1280, max: 1920 },
          height: { min: 480, ideal: 720, max: 1080 },
          facingMode: 'environment'
        },
        audio: false
      };

      console.log("Requesting media with constraints:", constraints);
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log("Camera stream obtained!", stream.getVideoTracks()[0].getSettings());
      
      streamRef.current = stream;
      setSelectedCameraId(selectedDevice);

      if (videoRef.current) {
        videoRef.current.srcObject = null;
        
        videoRef.current.onloadedmetadata = () => {
          console.log("Video metadata loaded");
          videoRef.current.play()
            .then(() => {
              console.log("Video playing");
              setIsLoading(false);
            })
            .catch(playError => {
              console.error("Video play error:", playError);
              setCameraError("Failed to start video playback: " + playError.message);
              setIsLoading(false);
            });
        };

        videoRef.current.srcObject = stream;
        videoRef.current.load();
      }

    } catch (err) {
      console.error("Camera request failed:", err);
      let userFriendlyMessage = err.message;
      
      switch (err.name) {
        case 'NotAllowedError':
          userFriendlyMessage = "Camera access denied. Please allow camera access in your browser settings and try again.";
          break;
        case 'NotFoundError':
          userFriendlyMessage = "No camera found on this device. Please connect a camera and try again.";
          break;
        case 'NotReadableError':
          userFriendlyMessage = "Camera is being used by another application. Please close other apps using the camera.";
          break;
        case 'OverconstrainedError':
          userFriendlyMessage = "Camera doesn't meet requirements. Trying with default settings...";
          setTimeout(() => {
            setIsLoading(false);
            setCameraError(null);
            requestFallbackCamera();
          }, 1000);
          return;
        case 'SecurityError':
          userFriendlyMessage = "Camera access blocked for security reasons. Please use HTTPS or localhost.";
          break;
        default:
          break;
      }
      
      setCameraError(userFriendlyMessage);
      setIsLoading(false);
    }
  };

  const requestFallbackCamera = async () => {
    try {
      setIsLoading(true);
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: true, 
        audio: false 
      });
      
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setIsLoading(false);
      }
    } catch (err) {
      console.error("Fallback camera failed:", err);
      setCameraError("Could not access camera with any settings: " + err.message);
      setIsLoading(false);
    }
  };

  const selectCamera = async (cameraId) => {
    console.log("Selected camera:", cameraId);
    setSelectedCameraId(cameraId);
    setShowCameraSelector(false);
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    await requestCameraPermission(cameraId);
  };

  const retryCamera = () => {
    setCameraError(null);
    requestCameraPermission(selectedCameraId);
  };

  const captureAndRecognize = async () => {
    if (!videoRef.current || !canvasRef.current) {
      console.log("Cannot recognize: missing video or canvas");
      return;
    }

    if (!isCalibrated) {
      alert("Please calibrate the display first by clicking 'Calibrate Display' button above.");
      return;
    }

    try {
      setIsRecognizing(true);

      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      
      const formData = new FormData();
      formData.append('image', blob, 'moisture-reading.png');
      
      console.log('Sending recognition request to:', `${VITE_PYTHON_API_URL}/seven-segment/recognize`);
      const response = await fetch(`${VITE_PYTHON_API_URL}/seven-segment/recognize`, {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        throw new Error(`Recognition request failed with status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.success && data.is_valid) {
        const reading = {
          value: data.full_number,
          timestamp: new Date(),
          digits: data.digits
        };
        
        setMoistureReading(reading);
        setReadingHistory(prev => [reading, ...prev.slice(0, 9)]);
      } else {
        console.warn("Recognition failed or invalid:", data);
        alert("Could not read display. Error: " + (data.error || "Invalid reading"));
      }
      
    } catch (err) {
      console.error("Recognition error:", err);
      alert("Recognition failed: " + err.message);
    } finally {
      setIsRecognizing(false);
    }
  };

  useEffect(() => {
    if (autoRecognize && isCalibrated && videoRef.current && !showInitialScreen && !useImageMode) {
      recognitionIntervalRef.current = setInterval(() => {
        captureAndRecognize();
      }, 2000);
      
      return () => {
        if (recognitionIntervalRef.current) {
          clearInterval(recognitionIntervalRef.current);
        }
      };
    } else {
      if (recognitionIntervalRef.current) {
        clearInterval(recognitionIntervalRef.current);
      }
    }
  }, [autoRecognize, isCalibrated, showInitialScreen, useImageMode]);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (recognitionIntervalRef.current) {
        clearInterval(recognitionIntervalRef.current);
      }
    };
  }, []);
  
  // Draw calibration overlay
  useEffect(() => {
    if (!calibrationData || !showSegmentOverlay) return;
    
    const drawOverlay = () => {
      const canvas = overlayCanvasRef.current;
      if (!canvas) return;
      
      const ctx = canvas.getContext('2d');
      
      // Set canvas size to match image/video
      let width, height;
      if (useImageMode && uploadedImage) {
        const img = new Image();
        img.onload = () => {
          canvas.width = img.width;
          canvas.height = img.height;
          drawBoxes(ctx, canvas.width, canvas.height);
        };
        img.src = uploadedImage.preview;
      } else if (videoRef.current && videoRef.current.videoWidth > 0) {
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        drawBoxes(ctx, canvas.width, canvas.height);
      }
    };
    
    const drawBoxes = (ctx, width, height) => {
      ctx.clearRect(0, 0, width, height);
      
      const DIGIT_COLORS = ['#3b82f6', '#ef4444', '#10b981']; // Blue, Red, Green
      const SEGMENT_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
      
      // Draw display box
      if (calibrationData.display_box) {
        const db = calibrationData.display_box;
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 3;
        ctx.strokeRect(db.x, db.y, db.width, db.height);
        
        ctx.fillStyle = '#10b981';
        ctx.font = 'bold 16px Arial';
        ctx.fillText('Display Region', db.x + 5, db.y - 5);
      }
      
      // Draw segment boxes
      if (calibrationData.segment_boxes) {
        calibrationData.segment_boxes.forEach((digit, digitIdx) => {
          if (digit) {
            digit.forEach((seg, segIdx) => {
              if (seg) {
                ctx.strokeStyle = DIGIT_COLORS[digitIdx];
                ctx.lineWidth = 2;
                ctx.strokeRect(seg.x, seg.y, seg.width, seg.height);
                
                // Draw label
                ctx.fillStyle = DIGIT_COLORS[digitIdx];
                ctx.font = 'bold 12px Arial';
                ctx.fillText(
                  `D${digitIdx + 1}-${SEGMENT_LABELS[segIdx]}`,
                  seg.x + 2,
                  seg.y + 12
                );
              }
            });
          }
        });
      }
    };
    
    drawOverlay();
    
    // Redraw on video frame updates
    if (!useImageMode && videoRef.current) {
      const interval = setInterval(drawOverlay, 100);
      return () => clearInterval(interval);
    }
  }, [calibrationData, showSegmentOverlay, useImageMode, uploadedImage]);

  return (
    <div className="fixed inset-0 flex flex-col h-screen w-screen bg-gray-900">
      {/* Header Bar */}
      <div className="flex items-center px-3 py-1.5 bg-gray-800 fixed top-0 left-0 right-0 z-10">
        <button
          type="button"
          onClick={onPreviousTest}
          className="bg-transparent border-none text-gray-200 text-2xl cursor-pointer p-1.5 hover:text-blue-400 transition-colors duration-300"
        >
          ←
        </button>
        <span className="ml-4 text-gray-100 text-lg font-semibold">
          TimberMach | Moisture Test
        </span>
        
        <div className="ml-4 text-xs text-gray-500">
          Python API: {VITE_PYTHON_API_URL}
        </div>
        
        <div className="ml-4 flex items-center gap-2">
          {isCalibrated ? (
            <span className="text-green-400 text-sm flex items-center gap-1">
              <span className="w-2 h-2 bg-green-400 rounded-full"></span>
              Calibrated
            </span>
          ) : (
            <span className="text-yellow-400 text-sm flex items-center gap-1">
              <span className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></span>
              Not Calibrated
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={() => setShowCalibration(true)}
          className="ml-4 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg transition-colors flex items-center gap-2 shadow-lg"
          title="Click here to calibrate 7-segment display"
        >
          <Settings className="w-4 h-4" />
          <span className="text-sm font-semibold">Calibrate Display</span>
        </button>
        
        {/* Toggle Segment Overlay */}
        {isCalibrated && !showInitialScreen && (
          <button
            type="button"
            onClick={() => setShowSegmentOverlay(!showSegmentOverlay)}
            className={`ml-2 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-2 ${
              showSegmentOverlay 
                ? 'bg-purple-600 hover:bg-purple-700 text-white' 
                : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
            }`}
            title="Toggle segment visualization"
          >
            👁️
            <span className="text-sm">{showSegmentOverlay ? 'Hide' : 'Show'} Segments</span>
          </button>
        )}

        <button
          type="button"
          onClick={onMainPageReturn}
          className="bg-transparent border-none text-gray-200 text-2xl cursor-pointer p-1.5 ml-auto hover:text-red-500 transition-colors duration-300"
        >
          ✕
        </button>
      </div>

      {/* Main Content */}
      <div className="mt-12 flex-grow flex flex-col justify-center items-center p-4">
        
        {/* Moisture Reading Display */}
        {moistureReading && !showInitialScreen && (
          <div className="w-full max-w-2xl mb-4">
            <div className="bg-gradient-to-r from-blue-900 to-green-900 rounded-lg p-6 text-center shadow-xl">
              <div className="text-gray-300 text-sm mb-2">Current Moisture Reading</div>
              <div className="text-6xl font-bold text-white mb-2">
                {moistureReading.value}%
              </div>
              <div className="text-gray-400 text-xs">
                {moistureReading.timestamp.toLocaleTimeString()}
              </div>
            </div>
          </div>
        )}

        {/* Initial Screen - Choose Mode */}
        {showInitialScreen && !permissionRequested && !showCameraSelector && (
          <div className="bg-gray-800 rounded-lg p-8 max-w-2xl w-full">
            <div className="text-6xl mb-6 text-center">🎥</div>
            <h3 className="text-white text-2xl mb-4 text-center font-bold">Choose Input Method</h3>
            <p className="text-gray-300 text-center mb-8">
              Select how you want to provide the moisture meter display image
            </p>
            
            {!isCalibrated && (
              <div className="bg-yellow-900 bg-opacity-30 border border-yellow-700 rounded-lg p-4 mb-6">
                <p className="text-yellow-300 text-sm text-center font-semibold mb-2">
                  ⚠️ Calibration Required
                </p>
                <p className="text-yellow-200 text-xs text-center">
                  Click the blue "Calibrate Display" button in the header above to set up your moisture meter's 7-segment display.
                </p>
              </div>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <button
                onClick={requestCameraPermission}
                className="bg-green-600 hover:bg-green-700 text-white px-6 py-8 rounded-lg font-semibold transition-colors flex flex-col items-center justify-center gap-3"
              >
                <Camera className="w-12 h-12" />
                <span className="text-lg">Use Live Camera</span>
                <span className="text-sm text-green-200">Real-time recognition</span>
              </button>
              
              <label className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-8 rounded-lg font-semibold transition-colors flex flex-col items-center justify-center gap-3 cursor-pointer">
                <Upload className="w-12 h-12" />
                <span className="text-lg">Upload Image</span>
                <span className="text-sm text-blue-200">Test with existing photo</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </label>
            </div>

            {!isCalibrated && (
              <button
                onClick={() => setShowCalibration(true)}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
              >
                <Settings className="w-5 h-5" />
                Calibrate Display First
              </button>
            )}
            
            <div className="text-gray-400 text-sm mt-6 text-center space-y-1">
              <p>🔒 Camera permission required for live mode</p>
              <p>📷 Upload mode works with any moisture meter photo</p>
              <p>🌐 Works on HTTPS and localhost only</p>
            </div>
          </div>
        )}

        {/* Uploaded Image Mode */}
        {useImageMode && uploadedImage && (
          <div className="w-full max-w-2xl space-y-4">
            <div className="bg-gray-800 rounded-lg p-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-white font-semibold">Uploaded Image</h3>
                <button
                  onClick={clearUploadedImage}
                  className="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-lg flex items-center gap-2"
                >
                  <X className="w-4 h-4" />
                  Clear
                </button>
              </div>
              <div className="relative">
                <img 
                  src={uploadedImage.preview} 
                  alt="Uploaded moisture meter" 
                  className="w-full h-auto rounded-lg"
                />
                {showSegmentOverlay && calibrationData && (
                  <canvas
                    ref={overlayCanvasRef}
                    className="absolute top-0 left-0 w-full h-full pointer-events-none"
                    style={{ mixBlendMode: 'normal' }}
                  />
                )}
              </div>
            </div>

            <button
              onClick={recognizeUploadedImage}
              disabled={!isCalibrated || isRecognizing}
              className="w-full bg-green-600 hover:bg-green-700 text-white px-6 py-4 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-lg"
            >
              {isRecognizing ? 'Reading...' : isCalibrated ? 'Read Display Now' : 'Calibrate First'}
            </button>

            {/* Reading History */}
            {readingHistory.length > 0 && (
              <div className="bg-gray-800 rounded-lg p-4">
                <h4 className="text-white font-semibold mb-3">Recent Readings</h4>
                <div className="grid grid-cols-5 gap-2">
                  {readingHistory.map((reading, idx) => (
                    <div key={idx} className="bg-gray-700 rounded p-2 text-center">
                      <div className="text-2xl font-bold text-blue-400">{reading.value}%</div>
                      <div className="text-xs text-gray-400">{reading.timestamp.toLocaleTimeString()}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Camera Mode */}
        {!showInitialScreen && !useImageMode && (
          <div className="bg-black overflow-hidden shadow-lg w-full max-w-2xl relative mb-4 rounded-lg">
            <div className="relative">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                controls={false}
                className="w-full h-auto object-cover min-h-[300px] bg-black"
                style={{ 
                  display: (isLoading || cameraError || showCameraSelector) ? 'none' : 'block',
                  minHeight: '300px',
                  backgroundColor: 'black'
                }}
              />
              
              {showSegmentOverlay && calibrationData && !isLoading && !cameraError && !showCameraSelector && (
                <canvas
                  ref={overlayCanvasRef}
                  className="absolute top-0 left-0 w-full h-full pointer-events-none"
                  style={{ mixBlendMode: 'normal' }}
                />
              )}
            </div>

            {!isLoading && !cameraError && !showCameraSelector && (
              <>
                <div className="absolute bottom-4 left-4 right-4">
                  <div className="bg-black bg-opacity-70 p-4 text-white rounded-lg">
                    {isRecognizing ? (
                      <p className="text-sm text-yellow-300">🔍 Reading display...</p>
                    ) : autoRecognize ? (
                      <p className="text-sm text-green-300">✓ Auto-reading enabled</p>
                    ) : isCalibrated ? (
                      <p className="text-sm">Position moisture meter display in view</p>
                    ) : (
                      <p className="text-sm text-yellow-300">⚠️ Calibrate display to read values</p>
                    )}
                  </div>
                </div>

                <div className="p-4 space-y-3">
                  <div className="flex gap-3">
                    <button
                      onClick={captureAndRecognize}
                      disabled={!isCalibrated || isRecognizing}
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isRecognizing ? 'Reading...' : isCalibrated ? 'Read Display Now' : 'Calibrate First'}
                    </button>
                    
                    <button
                      onClick={() => setAutoRecognize(!autoRecognize)}
                      disabled={!isCalibrated}
                      className={`flex-1 ${autoRecognize ? 'bg-yellow-600 hover:bg-yellow-700' : 'bg-blue-600 hover:bg-blue-700'} text-white px-6 py-3 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      {autoRecognize ? 'Stop Auto-Read' : 'Start Auto-Read'}
                    </button>
                  </div>

                  {readingHistory.length > 0 && (
                    <div className="bg-gray-800 rounded-lg p-4">
                      <h4 className="text-white font-semibold mb-3">Recent Readings</h4>
                      <div className="grid grid-cols-5 gap-2">
                        {readingHistory.map((reading, idx) => (
                          <div key={idx} className="bg-gray-700 rounded p-2 text-center">
                            <div className="text-2xl font-bold text-blue-400">{reading.value}%</div>
                            <div className="text-xs text-gray-400">{reading.timestamp.toLocaleTimeString()}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  );
};

export default MoistureTest;