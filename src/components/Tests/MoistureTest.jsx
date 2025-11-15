import React, { useState, useEffect, useRef } from 'react';

const MoistureTest = ({
  onTestComplete = () => {},
  onPreviousTest = () => {},
  onMainPageReturn = () => {}
}) => {
  const videoRef = useRef(null);
  const [cameraError, setCameraError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [permissionRequested, setPermissionRequested] = useState(false);
  const [showInitialScreen, setShowInitialScreen] = useState(true);
  const [availableCameras, setAvailableCameras] = useState([]);
  const [selectedCameraId, setSelectedCameraId] = useState(null);
  const [showCameraSelector, setShowCameraSelector] = useState(false);
  const [isOcrActive, setIsOcrActive] = useState(false);
  const [detectedNumbers, setDetectedNumbers] = useState([]);
  const [lastDetectedValue, setLastDetectedValue] = useState(null);
  const [ocrError, setOcrError] = useState(null);
  const streamRef = useRef(null);
  const canvasRef = useRef(null);
  const ocrIntervalRef = useRef(null);

  // OCR Functions
  const initializeOCR = async () => {
    try {
      // Load Tesseract.js from CDN
      if (!window.Tesseract) {
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://cdnjs.cloudflare.com/ajax/libs/tesseract.js/4.1.1/tesseract.min.js';
          script.onload = resolve;
          script.onerror = reject;
          document.head.appendChild(script);
        });
      }
      return window.Tesseract;
    } catch (err) {
      console.error('Failed to load Tesseract.js:', err);
      throw new Error('OCR library failed to load');
    }
  };

  const captureVideoFrame = () => {
    if (!videoRef.current || !canvasRef.current) return null;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    // Set canvas size to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    // Draw current video frame to canvas
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    return canvas.toDataURL('image/png');
  };

  const extractNumbers = (text) => {
    // Look for moisture percentage patterns
    const patterns = [
      /(\d+\.?\d*)\s*%/g,           // "12.5%" or "12%"
      /(\d+\.\d+)/g,                // "12.5" decimal numbers
      /(\d{1,2}\.?\d{0,2})(?=\s|$)/g // 1-2 digits with optional decimal
    ];
    
    const numbers = [];
    patterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) {
        matches.forEach(match => {
          const num = parseFloat(match.replace('%', ''));
          if (!isNaN(num) && num >= 0 && num <= 100) {
            numbers.push({
              value: num,
              text: match,
              confidence: 0.8
            });
          }
        });
      }
    });
    
    return numbers;
  };

  const performOCR = async () => {
    try {
      const imageData = captureVideoFrame();
      if (!imageData) return;

      const tesseract = await initializeOCR();
      
      const { data: { text, confidence } } = await tesseract.recognize(imageData, 'eng', {
        logger: m => console.log(m),
        tessedit_char_whitelist: '0123456789.%'
      });

      console.log('OCR Text:', text);
      console.log('OCR Confidence:', confidence);

      if (confidence > 60) {
        const numbers = extractNumbers(text);
        if (numbers.length > 0) {
          setDetectedNumbers(prev => [...prev.slice(-9), ...numbers]); // Keep last 10 readings
          setLastDetectedValue(numbers[0]);
          setOcrError(null);
        }
      }
    } catch (err) {
      console.error('OCR Error:', err);
      setOcrError(err.message);
    }
  };

  const startOCR = () => {
    if (isOcrActive) return;
    
    setIsOcrActive(true);
    setOcrError(null);
    
    // Perform OCR every 2 seconds
    ocrIntervalRef.current = setInterval(performOCR, 2000);
  };

  const stopOCR = () => {
    setIsOcrActive(false);
    if (ocrIntervalRef.current) {
      clearInterval(ocrIntervalRef.current);
      ocrIntervalRef.current = null;
    }
  };

  const getCameraDevices = async () => {
    try {
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
      console.log("Current URL:", window.location.href);
      console.log("Is HTTPS:", window.location.protocol === 'https:');
      
      // Check if we're on localhost (which also allows camera access)
      const isLocalhost = window.location.hostname === 'localhost' || 
                          window.location.hostname === '127.0.0.1' ||
                          window.location.hostname === '::1';
      
      console.log("Is localhost:", isLocalhost);

      // Check browser support
      if (!navigator.mediaDevices) {
        throw new Error("MediaDevices not supported. This browser doesn't support camera access or you need HTTPS.");
      }

      if (!navigator.mediaDevices.getUserMedia) {
        throw new Error("getUserMedia not supported. Please use a modern browser with HTTPS.");
      }

      // Check permission status first if available
      if (navigator.permissions) {
        try {
          const permissionStatus = await navigator.permissions.query({ name: 'camera' });
          console.log("Camera permission status:", permissionStatus.state);
          
          if (permissionStatus.state === 'denied') {
            throw new Error("Camera permission was previously denied. Please reset permissions in browser settings.");
          }
        } catch (permError) {
          console.log("Permission query not supported or failed:", permError);
        }
      }

      // List available devices and get cameras with permissions
      const cameras = await getCameraDevices();
      
      if (cameras.length === 0) {
        throw new Error("No camera devices found on this system.");
      }
      
      // If no specific camera selected and we have multiple cameras, show selector
      if (!deviceId && cameras.length > 1) {
        setShowCameraSelector(true);
        setIsLoading(false);
        return;
      }

      // Request camera with device constraint if specified
      console.log("Requesting camera stream...", deviceId ? `with device: ${deviceId}` : "with default device");
      const constraints = {
        video: deviceId ? 
          { 
            deviceId: { ideal: deviceId },  // Use 'ideal' instead of 'exact'
            width: { min: 320, ideal: 640, max: 1920 },
            height: { min: 240, ideal: 480, max: 1080 }
          } :
          {
            width: { min: 320, ideal: 640, max: 1920 },
            height: { min: 240, ideal: 480, max: 1080 }
          },
        audio: false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log("Camera stream obtained!", stream);
      console.log("Video tracks:", stream.getVideoTracks());
      
      streamRef.current = stream;

      if (videoRef.current) {
        console.log("Setting up video element...");
        
        // Clear any existing source first
        videoRef.current.srcObject = null;
        
        // Set up event handlers BEFORE setting srcObject
        videoRef.current.onloadedmetadata = () => {
          console.log("Video metadata loaded");
          console.log("Video dimensions:", videoRef.current.videoWidth, "x", videoRef.current.videoHeight);
          
          // Ensure video is ready to play
          if (videoRef.current.readyState >= 2) {
            videoRef.current.play()
              .then(() => {
                console.log("Video is playing successfully");
                setIsLoading(false);
              })
              .catch(playError => {
                console.error("Video play error:", playError);
                setCameraError("Failed to start video playback: " + playError.message);
                setIsLoading(false);
              });
          }
        };

        videoRef.current.oncanplay = () => {
          console.log("Video can play");
          if (!videoRef.current.played.length) {
            videoRef.current.play()
              .then(() => {
                console.log("Video started playing from canplay event");
                setIsLoading(false);
              })
              .catch(playError => {
                console.error("Play error from canplay:", playError);
                setCameraError("Failed to start video: " + playError.message);
                setIsLoading(false);
              });
          }
        };

        videoRef.current.onerror = (event) => {
          console.error("Video element error:", event);
          console.error("Video error code:", videoRef.current?.error?.code);
          console.error("Video error message:", videoRef.current?.error?.message);
          setCameraError("Video element error occurred");
          setIsLoading(false);
        };

        videoRef.current.onabort = () => {
          console.log("Video loading aborted");
        };

        videoRef.current.onstalled = () => {
          console.log("Video loading stalled");
        };

        videoRef.current.onwaiting = () => {
          console.log("Video waiting for data");
        };

        videoRef.current.onplaying = () => {
          console.log("Video playing event fired");
          setIsLoading(false);
        };

        // Now set the source
        console.log("Setting video srcObject to stream");
        videoRef.current.srcObject = stream;
        
        // Force load
        videoRef.current.load();
        
        // Try to play immediately as a fallback
        setTimeout(() => {
          if (videoRef.current && videoRef.current.srcObject && isLoading) {
            console.log("Attempting forced play after timeout");
            videoRef.current.play()
              .then(() => {
                console.log("Forced play successful");
                setIsLoading(false);
              })
              .catch(err => {
                console.error("Forced play failed:", err);
                // Don't set error here as other handlers might succeed
              });
          }
        }, 1000);
      }

    } catch (err) {
      console.error("Camera request failed:", err);
      console.error("Error name:", err.name);
      console.error("Error message:", err.message);
      
      let userFriendlyMessage = err.message;
      
      switch (err.name) {
        case 'NotAllowedError':
          userFriendlyMessage = "Camera access was denied. Please click the camera icon in your browser's address bar and allow access, then try again.";
          break;
        case 'NotFoundError':
          userFriendlyMessage = "No camera found on this device. Please check that your camera is connected and working.";
          break;
        case 'NotReadableError':
          userFriendlyMessage = "Camera is being used by another application. Please close other camera apps and try again.";
          break;
        case 'OverconstrainedError':
          console.log("Overconstrained error, trying with basic constraints for selected device");
          // Try again with just deviceId and no other constraints
          if (deviceId) {
            setTimeout(() => retryWithDeviceOnly(deviceId), 1000);
            return;
          } else {
            userFriendlyMessage = "Camera doesn't support the requested settings. Trying with basic settings...";
            setTimeout(() => retryWithBasicConstraints(), 1000);
            return;
          }
        case 'NotSupportedError':
          userFriendlyMessage = "Camera not supported on this browser or device.";
          break;
        case 'AbortError':
          userFriendlyMessage = "Camera request was interrupted. Please try again.";
          break;
        case 'TypeError':
          userFriendlyMessage = "Browser configuration error. Make sure you're using HTTPS or localhost.";
          break;
        default:
          if (err.message.includes('https')) {
            userFriendlyMessage = "Camera requires HTTPS. Please access this page via https:// or localhost.";
          }
      }
      
      setCameraError(userFriendlyMessage);
      setIsLoading(false);
    }
  };

  const retryWithBasicConstraints = async () => {
    try {
      console.log("Retrying with basic constraints...");
      const basicConstraints = { video: true, audio: false };
      const stream = await navigator.mediaDevices.getUserMedia(basicConstraints);
      
      streamRef.current = stream;
      if (videoRef.current) {
        console.log("Setting up video with basic constraints retry...");
        videoRef.current.srcObject = stream;
        
        videoRef.current.onloadedmetadata = () => {
          console.log("Basic retry - metadata loaded");
          videoRef.current.play()
            .then(() => {
              console.log("Basic retry - video playing");
              setIsLoading(false);
              setCameraError(null);
            })
            .catch(playError => {
              console.error("Basic retry - play error:", playError);
              setCameraError("Video playback failed: " + playError.message);
              setIsLoading(false);
            });
        };

        videoRef.current.oncanplay = () => {
          console.log("Basic retry - can play");
          videoRef.current.play()
            .then(() => {
              setIsLoading(false);
              setCameraError(null);
            })
            .catch(err => console.error("Basic retry canplay error:", err));
        };
        
        // Force load and try to play
        videoRef.current.load();
        setTimeout(() => {
          if (videoRef.current && isLoading) {
            videoRef.current.play()
              .then(() => {
                setIsLoading(false);
                setCameraError(null);
              })
              .catch(err => console.error("Basic retry timeout play error:", err));
          }
        }, 500);
      }
    } catch (basicErr) {
      console.error("Basic constraints also failed:", basicErr);
      setCameraError("Camera access failed even with basic settings: " + basicErr.message);
      setIsLoading(false);
    }
  };

  const retryWithDeviceOnly = async (deviceId) => {
    try {
      console.log("Retrying with device-only constraints for:", deviceId);
      const deviceOnlyConstraints = { 
        video: { deviceId: { ideal: deviceId } }, 
        audio: false 
      };
      const stream = await navigator.mediaDevices.getUserMedia(deviceOnlyConstraints);
      
      streamRef.current = stream;
      if (videoRef.current) {
        console.log("Setting up video with device-only retry...");
        videoRef.current.srcObject = stream;
        
        videoRef.current.onloadedmetadata = () => {
          console.log("Device-only retry - metadata loaded");
          videoRef.current.play()
            .then(() => {
              console.log("Device-only retry - video playing");
              setIsLoading(false);
              setCameraError(null);
            })
            .catch(playError => {
              console.error("Device-only retry - play error:", playError);
              setCameraError("Video playback failed: " + playError.message);
              setIsLoading(false);
            });
        };

        videoRef.current.oncanplay = () => {
          console.log("Device-only retry - can play");
          videoRef.current.play()
            .then(() => {
              setIsLoading(false);
              setCameraError(null);
            })
            .catch(err => console.error("Device-only retry canplay error:", err));
        };
        
        videoRef.current.load();
        setTimeout(() => {
          if (videoRef.current && isLoading) {
            videoRef.current.play()
              .then(() => {
                setIsLoading(false);
                setCameraError(null);
              })
              .catch(err => console.error("Device-only retry timeout play error:", err));
          }
        }, 500);
      }
    } catch (deviceErr) {
      console.error("Device-only constraints failed:", deviceErr);
      // Fall back to basic constraints
      retryWithBasicConstraints();
    }
  };

  useEffect(() => {
    // Cleanup function only
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => {
          track.stop();
        });
        streamRef.current = null;
      }
    };
  }, []);

  const selectCamera = (cameraId) => {
    console.log("Selected camera:", cameraId);
    setSelectedCameraId(cameraId);
    setShowCameraSelector(false);
    requestCameraPermission(cameraId);
  };

  const retryCamera = () => {
    setCameraError(null);
    requestCameraPermission(selectedCameraId);
  };

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
        <button
          type="button"
          onClick={onMainPageReturn}
          className="bg-transparent border-none text-gray-200 text-2xl cursor-pointer p-1.5 ml-auto hover:text-red-500 transition-colors duration-300"
        >
          ✕
        </button>
      </div>

      {/* Camera Feed Display */}
      <div className="mt-12 flex-grow flex flex-col justify-center items-center p-4">
        {/* Video Container */}
        <div className="bg-black overflow-hidden shadow-lg w-full max-w-2xl relative mb-4">
          
          {/* Camera Selection Screen */}
          {showCameraSelector && (
            <div className="flex flex-col items-center justify-center bg-gray-800 p-8 min-h-[400px]">
              <div className="text-6xl mb-6">📷</div>
              <h3 className="text-white text-xl mb-4 text-center">Select Your Camera</h3>
              <p className="text-gray-300 text-center mb-6 max-w-md">
                Multiple cameras detected. Choose the one you want to use for the moisture test.
              </p>
              
              <div className="space-y-3 w-full max-w-md">
                {availableCameras.map((camera, index) => (
                  <button
                    key={camera.deviceId}
                    onClick={() => selectCamera(camera.deviceId)}
                    className="w-full bg-gray-700 hover:bg-blue-600 text-white py-3 px-4 rounded-lg transition-colors text-left"
                  >
                    <div className="font-semibold">{camera.label}</div>
                    <div className="text-sm text-gray-300">Device {index + 1}</div>
                  </button>
                ))}
              </div>

              <button
                onClick={() => {
                  setShowCameraSelector(false);
                  setShowInitialScreen(true);
                  setPermissionRequested(false);
                }}
                className="mt-4 bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors"
              >
                Back
              </button>
            </div>
          )}

          {/* Initial Screen - Ask for Camera Permission */}
          {showInitialScreen && !permissionRequested && !showCameraSelector && (
            <div className="flex flex-col items-center justify-center bg-gray-800 p-8 min-h-[400px]">
              <div className="text-6xl mb-6">📹</div>
              <h3 className="text-white text-xl mb-4 text-center">Camera Access Required</h3>
              <p className="text-gray-300 text-center mb-6 max-w-md">
                This moisture test requires camera access to guide you through the process. 
                Click below to enable your camera.
              </p>
              <button
                onClick={requestCameraPermission}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
              >
                Enable Camera
              </button>
              <div className="text-gray-400 text-sm mt-4 text-center">
                <p>🔒 Make sure you're using HTTPS or localhost</p>
                <p>📱 Allow camera permissions when prompted</p>
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
              <div className="text-gray-300 text-xs text-center mt-4 max-w-md">
                <p className="mb-2"><strong>Common solutions:</strong></p>
                <ul className="text-left space-y-1">
                  <li>• Check browser address bar for camera permission prompt</li>
                  <li>• Make sure you're using https:// or localhost</li>
                  <li>• Close other apps that might be using your camera</li>
                  <li>• Try refreshing the page</li>
                  <li>• Check browser settings for camera permissions</li>
                </ul>
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
              display: (isLoading || cameraError || showInitialScreen) ? 'none' : 'block',
              minHeight: '300px',
              backgroundColor: 'black'
            }}
            onLoadStart={() => console.log("Video load started")}
            onLoadedData={() => console.log("Video data loaded")}
            onCanPlay={() => console.log("Video can play event")}
            onPlay={() => console.log("Video play event")}
            onPlaying={() => {
              console.log("Video playing event from element");
              setIsLoading(false);
            }}
          />

          {/* Moisture Test Overlay */}
          {!isLoading && !cameraError && !showInitialScreen && !showCameraSelector && (
            <div className="absolute bottom-4 left-4 right-4">
              <div className="bg-black bg-opacity-50 p-4 text-white">
                <p className="text-sm mb-2">Position the moisture sensor on the timber surface</p>
              </div>
            </div>
          )}
        </div>

        {/* Control Button - Separate from video */}
        {!isLoading && !cameraError && !showInitialScreen && !showCameraSelector && (
          <button
            onClick={onTestComplete}
            className="bg-green-600 hover:bg-green-700 text-white px-8 py-4 font-semibold transition-colors"
          >
            Start Moisture Test
          </button>
        )}
      </div>
    </div>
  );
};

export default MoistureTest;