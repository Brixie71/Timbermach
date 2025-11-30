import React, { useState, useEffect, useRef } from 'react';
import { Settings, Camera } from 'lucide-react';
import SevenSegmentCalibration from '../Settings/SevenSegmentCalibration';

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

  // Check if calibration exists on mount
  useEffect(() => {
    checkCalibration();
  }, []);

  const checkCalibration = async () => {
    try {
      // First, check if Flask has calibration
      console.log('Checking Flask calibration at:', `${VITE_PYTHON_API_URL}/seven-segment/calibration`);
      const flaskResponse = await fetch(`${VITE_PYTHON_API_URL}/seven-segment/calibration`);
      
      if (flaskResponse.ok) {
        const flaskData = await flaskResponse.json();
        if (flaskData.success && flaskData.calibration !== null) {
          setIsCalibrated(true);
          console.log('Flask already has calibration');
          return;
        }
      }
      
      // If Flask doesn't have calibration, load from Laravel
      console.log('Loading calibration from Laravel...');
      const LARAVEL_API_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';
      const laravelResponse = await fetch(`${LARAVEL_API_URL}/api/calibration`);
      
      if (!laravelResponse.ok) {
        console.log('No Laravel calibration found');
        setIsCalibrated(false);
        return;
      }
      
      const calibrations = await laravelResponse.json();
      const activeCalibration = calibrations.find(cal => cal.is_active);
      
      if (activeCalibration) {
        console.log('Found active calibration in Laravel, syncing to Flask...');
        
        // Send to Flask
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
        } else {
          console.error('Failed to sync calibration to Flask');
          setIsCalibrated(false);
        }
      } else {
        console.log('No active calibration found in Laravel');
        setIsCalibrated(false);
      }
      
    } catch (err) {
      console.error('Failed to check calibration:', err);
      setIsCalibrated(false);
    }
  };

  const getCameraDevices = async () => {
    try {
      // First, request basic permissions to get device labels
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
      
      console.log("Requesting camera permission...");

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Camera access not supported. Please use HTTPS or localhost.");
      }

      // Get available cameras first
      const cameras = await getCameraDevices();
      
      if (cameras.length === 0) {
        throw new Error("No camera devices found on this system.");
      }
      
      // If multiple cameras and no deviceId specified, show selector
      if (!deviceId && cameras.length > 1) {
        console.log("Multiple cameras found, showing selector");
        setShowCameraSelector(true);
        setIsLoading(false);
        return;
      }

      // If only one camera and no deviceId specified, use the first one
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
          facingMode: 'environment' // Prefer back camera on mobile
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
          // Try again with more lenient constraints
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

  // Fallback camera request with minimal constraints
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
    
    // Stop current stream if any
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

  // Capture frame and recognize
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
      
      // Convert canvas to blob
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      
      // Send to Python backend
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
        setReadingHistory(prev => [reading, ...prev.slice(0, 9)]); // Keep last 10
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

  // Auto-recognize loop
  useEffect(() => {
    if (autoRecognize && isCalibrated && videoRef.current && !showInitialScreen) {
      recognitionIntervalRef.current = setInterval(() => {
        captureAndRecognize();
      }, 2000); // Every 2 seconds
      
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
  }, [autoRecognize, isCalibrated, showInitialScreen]);

  // Cleanup
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

  const handleCalibrationComplete = (result) => {
    setIsCalibrated(true);
    setShowCalibration(false);
    
    if (result && result.full_number) {
      setMoistureReading({
        value: result.full_number,
        timestamp: new Date(),
        digits: result.digits
      });
    }
    
    // Re-check calibration from backend
    checkCalibration();
  };

  // If showing calibration, render calibration component
  if (showCalibration) {
    return (
      <SevenSegmentCalibration
        onComplete={handleCalibrationComplete}
        onCancel={() => {
          setShowCalibration(false);
          // Re-check calibration when returning
          checkCalibration();
        }}
      />
    );
  }

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
        
        {/* Backend Status Indicator */}
        <div className="ml-4 text-xs text-gray-500">
          Python API: {VITE_PYTHON_API_URL}
        </div>
        
        {/* Calibration Status */}
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

        {/* Settings Button - ALWAYS VISIBLE AND CLICKABLE */}
        <button
          type="button"
          onClick={() => setShowCalibration(true)}
          className="ml-4 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg transition-colors flex items-center gap-2 shadow-lg"
          title="Click here to calibrate 7-segment display"
        >
          <Settings className="w-4 h-4" />
          <span className="text-sm font-semibold">Calibrate Display</span>
        </button>

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
        {moistureReading && !showInitialScreen && !showCameraSelector && (
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

        {/* Video Container */}
        <div className="bg-black overflow-hidden shadow-lg w-full max-w-2xl relative mb-4 rounded-lg">
          
          {/* Camera Selection Screen */}
          {showCameraSelector && (
            <div className="flex flex-col items-center justify-center bg-gray-800 p-8 min-h-[400px]">
              <div className="text-6xl mb-6">📷</div>
              <h3 className="text-white text-xl mb-4 text-center">Select Your Camera</h3>
              <p className="text-gray-300 text-center mb-6 max-w-md">
                {availableCameras.length > 1 
                  ? "Multiple cameras detected. Choose the one you want to use for the moisture test."
                  : "Select the camera to use for reading the moisture display."}
              </p>
              
              {availableCameras.length === 0 ? (
                <div className="text-center">
                  <p className="text-red-400 mb-4">No cameras found on your device.</p>
                  <button
                    onClick={async () => {
                      setIsLoading(true);
                      await getCameraDevices();
                      setIsLoading(false);
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition-colors"
                  >
                    Refresh Camera List
                  </button>
                </div>
              ) : (
                <div className="space-y-3 w-full max-w-md">
                  {availableCameras.map((camera, index) => (
                    <button
                      key={camera.deviceId}
                      onClick={() => selectCamera(camera.deviceId)}
                      className="w-full bg-gray-700 hover:bg-blue-600 text-white py-4 px-4 rounded-lg transition-colors text-left flex items-center justify-between group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-gray-600 rounded-full flex items-center justify-center text-2xl group-hover:bg-blue-700 transition-colors">
                          📹
                        </div>
                        <div>
                          <div className="font-semibold">{camera.label}</div>
                          <div className="text-sm text-gray-300">
                            {camera.deviceId === selectedCameraId && "Currently selected • "}
                            Device {index + 1}
                          </div>
                        </div>
                      </div>
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  ))}
                </div>
              )}

              <button
                onClick={() => {
                  setShowCameraSelector(false);
                  setShowInitialScreen(true);
                  setPermissionRequested(false);
                }}
                className="mt-6 bg-gray-600 hover:bg-gray-700 text-white px-6 py-2 rounded-lg transition-colors"
              >
                ← Back
              </button>
              
              <div className="mt-4 text-gray-400 text-xs text-center max-w-md">
                <p>💡 Tip: If camera labels aren't showing, grant camera permission first</p>
              </div>
            </div>
          )}

          {/* Initial Screen - Ask for Camera Permission */}
          {showInitialScreen && !permissionRequested && !showCameraSelector && (
            <div className="flex flex-col items-center justify-center bg-gray-800 p-8 min-h-[400px]">
              <div className="text-6xl mb-6">🎥</div>
              <h3 className="text-white text-xl mb-4 text-center">Camera Access Required</h3>
              <p className="text-gray-300 text-center mb-6 max-w-md">
                This moisture test uses camera to read the 7-segment display on your moisture meter.
              </p>
              
              {!isCalibrated && (
                <div className="bg-yellow-900 bg-opacity-30 border border-yellow-700 rounded-lg p-4 mb-6 max-w-md">
                  <p className="text-yellow-300 text-sm text-center font-semibold mb-2">
                    ⚠️ Calibration Required
                  </p>
                  <p className="text-yellow-200 text-xs text-center">
                    Click the blue "Calibrate Display" button in the header above to set up your moisture meter's 7-segment display.
                  </p>
                </div>
              )}
              
              {/* Two buttons: one for camera, one for calibration */}
              <div className="flex flex-col gap-3 w-full max-w-md">
                <button
                  onClick={requestCameraPermission}
                  className="w-full bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
                >
                  <Camera className="w-5 h-5" />
                  Start Camera
                </button>
                
                {!isCalibrated && (
                  <button
                    onClick={() => setShowCalibration(true)}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
                  >
                    <Settings className="w-5 h-5" />
                    Calibrate Display First
                  </button>
                )}
              </div>
              
              <div className="text-gray-400 text-sm mt-4 text-center">
                <p>🔒 Camera permission required for moisture reading</p>
                <p>📱 Click "Allow" when your browser asks for camera access</p>
                <p>🌐 Works on HTTPS and localhost only</p>
              </div>
            </div>
          )}

          {isLoading && !showInitialScreen && !showCameraSelector && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-800">
              <div className="text-6xl mb-4">⏳</div>
              <div className="text-white text-lg">Starting camera...</div>
              <div className="text-gray-300 text-sm mt-2">Please allow camera access if prompted</div>
            </div>
          )}
          
          {cameraError && !showInitialScreen && !showCameraSelector && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-800 p-4">
              <div className="text-6xl mb-4">❌</div>
              <div className="text-red-400 text-lg mb-4 text-center max-w-md">
                {cameraError}
              </div>
              <div className="flex flex-col space-y-3">
                <button
                  onClick={retryCamera}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  Try Again
                </button>
                <button
                  onClick={() => {
                    setShowInitialScreen(true);
                    setShowCameraSelector(false);
                    setCameraError(null);
                    setPermissionRequested(false);
                    setSelectedCameraId(null);
                  }}
                  className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  Back to Start
                </button>
              </div>
            </div>
          )}

          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            controls={false}
            className="w-full h-auto object-cover min-h-[300px] bg-black"
            style={{ 
              display: (isLoading || cameraError || showInitialScreen || showCameraSelector) ? 'none' : 'block',
              minHeight: '300px',
              backgroundColor: 'black'
            }}
          />

          {/* Change Camera Button */}
          {!isLoading && !cameraError && !showInitialScreen && !showCameraSelector && availableCameras.length > 1 && (
            <div className="absolute top-4 right-4">
              <button
                onClick={async () => {
                  if (streamRef.current) {
                    streamRef.current.getTracks().forEach(track => track.stop());
                    streamRef.current = null;
                  }
                  setIsLoading(true);
                  await getCameraDevices();
                  setShowCameraSelector(true);
                  setIsLoading(false);
                }}
                className="bg-gray-700 bg-opacity-75 hover:bg-gray-600 text-white px-3 py-2 rounded-lg transition-colors flex items-center gap-2 shadow-lg"
                title="Change Camera"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span className="text-sm font-semibold">Switch Camera</span>
              </button>
            </div>
          )}

          {/* Recognition Status Overlay */}
          {!isLoading && !cameraError && !showInitialScreen && !showCameraSelector && (
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
          )}
        </div>

        {/* Control Buttons */}
        {!isLoading && !cameraError && !showInitialScreen && !showCameraSelector && (
          <div className="w-full max-w-2xl space-y-3">
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
      </div>

      {/* Hidden canvas for capture */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  );
};

export default MoistureTest;