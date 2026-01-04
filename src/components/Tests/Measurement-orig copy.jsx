import React, { useState, useRef, useEffect } from 'react';
import { Camera, Ruler, Download, Trash2, Info, Maximize2, Move, Check, ArrowRight, RotateCcw } from 'lucide-react';

const ManualMeasurement = ({ onTestComplete, onPreviousTest, onMainPageReturn, testType = 'flexure', subType = '' }) => {
  // Debug: Log props on mount and when they change
  useEffect(() => {
    console.log('ManualMeasurement props:', { testType, subType });
  }, [testType, subType]);
  
  const requiresLength = testType === 'compressive' || testType === 'shear';
  
  // HARDCODED CAMERA SELECTION & CALIBRATION
  // For Compressive & Shear: Use "USB2.0 PC CAMERA" (back camera)
  // For Flexure: Use "Integrated Webcam" (front camera)
  const CAMERA_DEVICE_ID = testType === 'flexure' ? 
    'UVC Camera (12d1:4321)' :  // Change this to your front camera name
    'A4ech FHD 1080P PC Camera (09da:2704)';     // Change this to your back camera name

    // Development camera 'USB2.0 HD UVC WebCam (322e:202c)';     // Change this to your back camera name
  
  // HARDCODED CALIBRATION VALUES FOR EACH TEST TYPE
  const CALIBRATION_PRESETS = {
    flexure: {
      manualFactor: 0.1568,      // Updated calibration
      targetDistance: 210.30,
      cameraDistance: 210.30,
      fixedLength: 533.4  // 21 inches in mm (FIXED for flexure)
    },
    compressive: {
      manualFactor: 0.1288,      // TODO: Calibrate this value for compressive
      targetDistance: 196.85,        // Adjust based on your setup
      cameraDistance: 196.85
    },
    shear: {
      manualFactor: 0.1288,      // TODO: Calibrate this value for shear
      targetDistance: 196.85,        // Adjust based on your setup
      cameraDistance: 196.85
    }
  };
  
  const [stream, setStream] = useState(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [capturedImage, setCapturedImage] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [imageDimensions, setImageDimensions] = useState({ width: 1920, height: 1080 });
  const [widthLine1, setWidthLine1] = useState(200);
  const [widthLine2, setWidthLine2] = useState(1080);
  const [heightLine1, setHeightLine1] = useState(100);
  const [heightLine2, setHeightLine2] = useState(620);
  const [draggingLine, setDraggingLine] = useState(null);
  const [cameraDistance, setCameraDistance] = useState(CALIBRATION_PRESETS[testType].cameraDistance);
  const [calibrationFactor, setCalibrationFactor] = useState(null);
  const [useManualCalibration, setUseManualCalibration] = useState(true); // Start with manual
  const [manualCalibrationFactor, setManualCalibrationFactor] = useState(CALIBRATION_PRESETS[testType].manualFactor);
  const [targetDistance, setTargetDistance] = useState(CALIBRATION_PRESETS[testType].targetDistance);
  const [lengthInput, setLengthInput] = useState('');
  const [finalMeasurement, setFinalMeasurement] = useState(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [measurementHistory, setMeasurementHistory] = useState([]);
  const [measurementCounter, setMeasurementCounter] = useState(0);
  const [showHistory, setShowHistory] = useState(false);
  const [error, setError] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Virtual keyboard states
  const [showKeyboard, setShowKeyboard] = useState(false);
  const [keyboardInput, setKeyboardInput] = useState('');
  const [activeInputField, setActiveInputField] = useState(null);
  
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const captureCanvasRef = useRef(null);
  const API_URL = 'http://localhost:5000';
  
  const [videoResolution, setVideoResolution] = useState({ width: 1920, height: 1080 });
  
  const SENSOR_WIDTH = 4.8;
  const FOCAL_LENGTH = 4.0;
  
  // Start camera on mount and update calibration when test type changes
  useEffect(() => {
    // Update calibration values when test type changes
    const preset = CALIBRATION_PRESETS[testType];
    setCameraDistance(preset.cameraDistance);
    setManualCalibrationFactor(preset.manualFactor);
    setTargetDistance(preset.targetDistance);
    
    startCamera();
    return () => {
      stopCamera();
    };
  }, [testType]);
  
  useEffect(() => {
    if (useManualCalibration) {
      setCalibrationFactor(manualCalibrationFactor);
    } else {
      const pixelSizeMM = (SENSOR_WIDTH * cameraDistance) / (FOCAL_LENGTH * videoResolution.width);
      setCalibrationFactor(pixelSizeMM);
    }
  }, [cameraDistance, videoResolution.width, useManualCalibration, manualCalibrationFactor]);
  
  const startCamera = async () => {
    try {
      setError(null);
      
      // Get list of all video devices
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      
      console.log('Available cameras:', videoDevices.map(d => ({ label: d.label, id: d.deviceId })));
      
      // Find camera by label (contains the name)
      const targetCamera = videoDevices.find(device => 
        device.label.includes(CAMERA_DEVICE_ID)
      );
      
      let constraints;
      if (targetCamera) {
        console.log(`Using camera: ${targetCamera.label}`);
        constraints = {
          video: {
            deviceId: { exact: targetCamera.deviceId },
            width: { ideal: 1920 },
            height: { ideal: 1080 }
          }
        };
      } else {
        console.warn(`Camera "${CAMERA_DEVICE_ID}" not found, using default`);
        // Fallback to facingMode
        constraints = {
          video: {
            facingMode: testType === 'flexure' ? 'user' : 'environment',
            width: { ideal: 1920 },
            height: { ideal: 1080 }
          }
        };
      }

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      
      // Set stream first
      setStream(mediaStream);
      setIsCameraActive(true);

      // Then attach to video element
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        
        // Wait for metadata to load and get actual resolution
        videoRef.current.onloadedmetadata = () => {
          const actualWidth = videoRef.current.videoWidth;
          const actualHeight = videoRef.current.videoHeight;
          
          console.log(`Camera resolution: ${actualWidth}x${actualHeight}`);
          setVideoResolution({ width: actualWidth, height: actualHeight });
          
          // Set initial line positions based on actual resolution
          setWidthLine1(Math.floor(actualWidth * 0.15));
          setWidthLine2(Math.floor(actualWidth * 0.85));
          setHeightLine1(Math.floor(actualHeight * 0.15));
          setHeightLine2(Math.floor(actualHeight * 0.85));
          
          videoRef.current.play().catch(err => {
            console.error('Error playing video:', err);
            setError(`Failed to play video: ${err.message}`);
          });
        };
      }

    } catch (err) {
      console.error('Error accessing camera:', err);
      setError(`Failed to access camera: ${err.message}`);
      setIsCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    setIsCameraActive(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current || !captureCanvasRef.current) return;

    const video = videoRef.current;
    const canvas = captureCanvasRef.current;
    const context = canvas.getContext('2d');

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    const imageData = canvas.toDataURL('image/jpeg', 0.95);
    
    canvas.toBlob((blob) => {
      setImageFile(new File([blob], 'capture.jpg', { type: 'image/jpeg' }));
    }, 'image/jpeg', 0.95);

    setImageDimensions({ width: canvas.width, height: canvas.height });
    setWidthLine1(Math.floor(canvas.width * 0.15));
    setWidthLine2(Math.floor(canvas.width * 0.85));
    setHeightLine1(Math.floor(canvas.height * 0.15));
    setHeightLine2(Math.floor(canvas.height * 0.85));
    
    setCapturedImage(imageData);
    stopCamera();
  };

  const retakePhoto = async () => {
    setCapturedImage(null);
    setImageFile(null);
    setError(null);
    setFinalMeasurement(null);
    setCurrentStep(1);
    await startCamera();
  };
  
  const widthPixels = Math.abs(widthLine2 - widthLine1);
  const heightPixels = Math.abs(heightLine2 - heightLine1);
  const widthMM = widthPixels * (calibrationFactor || 0);
  const heightMM = heightPixels * (calibrationFactor || 0);
  
  // Calculate area based on test type and subtype
  const calculateArea = () => {
    // Debug logging
    console.log('calculateArea called:', { testType, subType, lengthInput });
    
    // For compressive and shear tests that need length
    if (testType === 'compressive' && subType === 'Perpendicular') {
      // Perpendicular: L × W
      const lengthMM = parseFloat(lengthInput) * 25.4;
      if (!lengthInput || isNaN(lengthMM) || lengthMM <= 0) {
        return 0; // Return 0 if no valid length yet
      }
      console.log('Using Perpendicular formula: L × W =', lengthMM, '×', widthMM);
      return lengthMM * widthMM;
    } else if (testType === 'shear') {
      // Shear: W × L (single or double)
      const lengthMM = parseFloat(lengthInput) * 25.4;
      if (!lengthInput || isNaN(lengthMM) || lengthMM <= 0) {
        return 0; // Return 0 if no valid length yet
      }
      const baseArea = widthMM * lengthMM;
      if (subType === 'Double') {
        console.log('Using Double Shear formula: (W × L) × 2 =', baseArea, '× 2');
        return baseArea * 2;
      } else {
        console.log('Using Single Shear formula: W × L =', baseArea);
        return baseArea;
      }
    } else if (testType === 'flexure') {
      // Flexure: W × H (L is fixed)
      console.log('Using Flexure formula: W × H =', widthMM, '×', heightMM);
      return widthMM * heightMM;
    } else if (testType === 'compressive' && subType === 'Parallel') {
      // Parallel: W × H
      console.log('Using Parallel formula: W × H =', widthMM, '×', heightMM);
      return widthMM * heightMM;
    }
    
    // Default fallback: W × H
    console.log('Using default formula: W × H =', widthMM, '×', heightMM);
    return widthMM * heightMM;
  };
  
  const areaMM2 = calculateArea();
  const areaIN2 = areaMM2 / 645.16;
  
  // Safe display values (avoid NaN)
  const displayAreaMM2 = isNaN(areaMM2) || !isFinite(areaMM2) ? 0 : areaMM2;
  const displayAreaIN2 = isNaN(areaIN2) || !isFinite(areaIN2) ? 0 : areaIN2;
  
  // Virtual Keyboard Handlers
  const handleInputFocus = (fieldName) => {
    setActiveInputField(fieldName);
    
    if (fieldName === 'lengthInput') {
      setKeyboardInput(lengthInput);
    } else if (fieldName === 'cameraDistance') {
      setKeyboardInput(cameraDistance.toString());
    } else if (fieldName === 'targetDistance') {
      setKeyboardInput(targetDistance.toString());
    } else if (fieldName === 'manualCalibrationFactor') {
      setKeyboardInput(manualCalibrationFactor.toString());
    }
    
    setShowKeyboard(true);
  };
  
  const handleKeyboardInput = (value) => {
    setKeyboardInput(value);
  };
  
  const handleKeyboardClose = () => {
    // Apply the input to the appropriate field
    if (activeInputField === 'lengthInput') {
      setLengthInput(keyboardInput);
    } else if (activeInputField === 'cameraDistance') {
      const val = parseFloat(keyboardInput);
      setCameraDistance(isNaN(val) ? CALIBRATION_PRESETS[testType].cameraDistance : val);
    } else if (activeInputField === 'targetDistance') {
      const val = parseFloat(keyboardInput);
      setTargetDistance(isNaN(val) ? CALIBRATION_PRESETS[testType].targetDistance : val);
    } else if (activeInputField === 'manualCalibrationFactor') {
      const val = parseFloat(keyboardInput);
      setManualCalibrationFactor(isNaN(val) ? CALIBRATION_PRESETS[testType].manualFactor : val);
    }
    
    setShowKeyboard(false);
    setActiveInputField(null);
    setKeyboardInput('');
  };
  
  const drawLines = () => {
    const canvas = canvasRef.current;
    if (!canvas || !capturedImage) return;
    
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    img.onload = () => {
      canvas.width = imageDimensions.width;
      canvas.height = imageDimensions.height;
      
      ctx.drawImage(img, 0, 0, imageDimensions.width, imageDimensions.height);
      
      // Draw red lines (width)
      ctx.strokeStyle = 'rgba(255, 0, 0, 0.8)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(widthLine1, 0);
      ctx.lineTo(widthLine1, imageDimensions.height);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(widthLine2, 0);
      ctx.lineTo(widthLine2, imageDimensions.height);
      ctx.stroke();
      
      ctx.fillStyle = 'rgba(255, 0, 0, 1)';
      ctx.beginPath();
      ctx.arc(widthLine1, imageDimensions.height / 2, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(widthLine2, imageDimensions.height / 2, 10, 0, Math.PI * 2);
      ctx.fill();
      
      // Draw green lines (height)
      ctx.strokeStyle = 'rgba(0, 255, 0, 0.8)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, heightLine1);
      ctx.lineTo(imageDimensions.width, heightLine1);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, heightLine2);
      ctx.lineTo(imageDimensions.width, heightLine2);
      ctx.stroke();
      
      ctx.fillStyle = 'rgba(0, 255, 0, 1)';
      ctx.beginPath();
      ctx.arc(imageDimensions.width / 2, heightLine1, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(imageDimensions.width / 2, heightLine2, 10, 0, Math.PI * 2);
      ctx.fill();
      
      // Labels
      const widthLabelY = 30;
      const widthLabelX = (widthLine1 + widthLine2) / 2;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(widthLabelX - 80, widthLabelY - 20, 160, 30);
      ctx.fillStyle = 'rgba(255, 0, 0, 1)';
      ctx.font = 'bold 16px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(`Width: ${widthMM.toFixed(2)} mm`, widthLabelX, widthLabelY);
      
      const heightLabelX = imageDimensions.width - 100;
      const heightLabelY = (heightLine1 + heightLine2) / 2;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(heightLabelX - 80, heightLabelY - 15, 160, 30);
      ctx.fillStyle = 'rgba(0, 255, 0, 1)';
      ctx.font = 'bold 16px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(`Height: ${heightMM.toFixed(2)} mm`, heightLabelX, heightLabelY);
    };
    
    img.src = capturedImage;
  };
  
  useEffect(() => {
    drawLines();
  }, [capturedImage, widthLine1, widthLine2, heightLine1, heightLine2, widthMM, heightMM]);
  
  const handleMouseDownOnVideo = (e) => {
    if (!videoRef.current) return;
    
    const video = videoRef.current;
    const rect = video.getBoundingClientRect();
    const scaleX = videoResolution.width / rect.width;
    const scaleY = videoResolution.height / rect.height;
    const x = Math.round((e.clientX - rect.left) * scaleX);
    const y = Math.round((e.clientY - rect.top) * scaleY);
    
    const threshold = 40; // Larger threshold for easier dragging
    
    if (Math.abs(x - widthLine1) < threshold) setDraggingLine('widthLine1');
    else if (Math.abs(x - widthLine2) < threshold) setDraggingLine('widthLine2');
    else if (Math.abs(y - heightLine1) < threshold) setDraggingLine('heightLine1');
    else if (Math.abs(y - heightLine2) < threshold) setDraggingLine('heightLine2');
  };
  
  const handleMouseMoveOnVideo = (e) => {
    if (!draggingLine || !videoRef.current) return;
    
    const video = videoRef.current;
    const rect = video.getBoundingClientRect();
    const scaleX = videoResolution.width / rect.width;
    const scaleY = videoResolution.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    
    if (draggingLine === 'widthLine1') {
      setWidthLine1(Math.max(0, Math.min(x, videoResolution.width)));
    } else if (draggingLine === 'widthLine2') {
      setWidthLine2(Math.max(0, Math.min(x, videoResolution.width)));
    } else if (draggingLine === 'heightLine1') {
      setHeightLine1(Math.max(0, Math.min(y, videoResolution.height)));
    } else if (draggingLine === 'heightLine2') {
      setHeightLine2(Math.max(0, Math.min(y, videoResolution.height)));
    }
  };
  
  const handleMouseDown = (e) => {
    if (!canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = imageDimensions.width / rect.width;
    const scaleY = imageDimensions.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    
    const threshold = 40;
    
    if (Math.abs(x - widthLine1) < threshold) setDraggingLine('widthLine1');
    else if (Math.abs(x - widthLine2) < threshold) setDraggingLine('widthLine2');
    else if (Math.abs(y - heightLine1) < threshold) setDraggingLine('heightLine1');
    else if (Math.abs(y - heightLine2) < threshold) setDraggingLine('heightLine2');
  };
  
  const handleMouseMove = (e) => {
    if (!draggingLine || !canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = imageDimensions.width / rect.width;
    const scaleY = imageDimensions.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    
    if (draggingLine === 'widthLine1') {
      setWidthLine1(Math.max(0, Math.min(x, imageDimensions.width)));
    } else if (draggingLine === 'widthLine2') {
      setWidthLine2(Math.max(0, Math.min(x, imageDimensions.width)));
    } else if (draggingLine === 'heightLine1') {
      setHeightLine1(Math.max(0, Math.min(y, imageDimensions.height)));
    } else if (draggingLine === 'heightLine2') {
      setHeightLine2(Math.max(0, Math.min(y, imageDimensions.height)));
    }
  };
  
  const handleMouseUp = () => {
    setDraggingLine(null);
  };
  
  const performMeasurement = async () => {
    if (!videoRef.current || !captureCanvasRef.current) {
      setError('Camera not ready');
      return;
    }
    
    // Capture current frame from video
    const video = videoRef.current;
    const canvas = captureCanvasRef.current;
    const context = canvas.getContext('2d');

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Convert to blob for API
    const blob = await new Promise((resolve) => {
      canvas.toBlob(resolve, 'image/jpeg', 0.95);
    });
    
    const imageFile = new File([blob], 'measurement.jpg', { type: 'image/jpeg' });
    
    // For flexure, use fixed length
    let lengthMM;
    if (testType === 'flexure') {
      lengthMM = CALIBRATION_PRESETS.flexure.fixedLength; // 533.4mm (21 inches)
    } else if (requiresLength) {
      if (!lengthInput || parseFloat(lengthInput) <= 0) {
        setError('Please enter valid length');
        return;
      }
      lengthMM = parseFloat(lengthInput) * 25.4;
    }
    
    // All size limit checks removed - record any measurement
    
    setIsProcessing(true);
    setError(null);
    
    try {
      const formData = new FormData();
      formData.append('image', imageFile);
      formData.append('widthLine1', Math.round(widthLine1));
      formData.append('widthLine2', Math.round(widthLine2));
      formData.append('heightLine1', Math.round(heightLine1));
      formData.append('heightLine2', Math.round(heightLine2));
      formData.append('cameraDistance', cameraDistance);
      
      const response = await fetch(`${API_URL}/manual-measure/calculate`, {
        method: 'POST',
        body: formData,
      });
      
      const data = await response.json();
      
      if (!data.success) {
        setError(data.error || 'Measurement failed');
        setIsProcessing(false);
        return;
      }
      
      const newMeasurement = {
        id: measurementCounter + 1,
        timestamp: new Date(),
        testType: testType,
        cameraUsed: CAMERA_DEVICE_ID,
        widthPixels: data.widthPixels,
        heightPixels: data.heightPixels,
        width: data.widthMM,
        height: data.heightMM,
        areaMM2: areaMM2, // Use calculated area
        areaIN2: areaIN2, // Use calculated area in inches
        widthInches: data.widthInches,
        heightInches: data.heightInches,
        calibrationFactor: data.calibrationFactor,
        cameraDistance: cameraDistance,
      };
      
      if (testType === 'flexure' || requiresLength) {
        newMeasurement.length = lengthMM;
        newMeasurement.lengthInches = (lengthMM / 25.4).toFixed(3);
        newMeasurement.volume = data.widthMM * data.heightMM * lengthMM;
        newMeasurement.volumeInches = newMeasurement.volume / 16387.064;
      }
      
      setFinalMeasurement(newMeasurement);
      setMeasurementHistory(prev => [...prev, newMeasurement]);
      setMeasurementCounter(prev => prev + 1);
      setCurrentStep(2);
      setIsProcessing(false);
      
      // Stop camera after successful measurement
      stopCamera();
      
      if (typeof onTestComplete === 'function') {
        onTestComplete(newMeasurement);
      }
      
    } catch (err) {
      setError('Failed: ' + err.message);
      setIsProcessing(false);
    }
  };
  
  const exportMeasurements = () => {
    if (measurementHistory.length === 0) return;
    const headers = requiresLength 
      ? ['ID','Time','Type','Camera','W(mm)','H(mm)','Area(mm²)','Area(in²)','L(mm)','Vol(mm³)','Vol(in³)']
      : ['ID','Time','Type','Camera','W(mm)','H(mm)','Area(mm²)','Area(in²)'];
    const rows = measurementHistory.map(m => {
      const base = [m.id, m.timestamp.toISOString(), m.testType, m.cameraUsed, m.width.toFixed(2), m.height.toFixed(2), m.areaMM2.toFixed(2), m.areaIN2.toFixed(3)];
      if ((testType === 'flexure' || requiresLength) && m.length) {
        return [...base, m.length.toFixed(2), m.volume.toFixed(2), m.volumeInches.toFixed(3)];
      }
      return base;
    });
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `measurements_${testType}_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  
  const startNewMeasurement = () => {
    setCurrentStep(1);
    setCapturedImage(null);
    setImageFile(null);
    setLengthInput('');
    setFinalMeasurement(null);
    setError(null);
    startCamera();
  };
  
  // Get area calculation description
  const getAreaDescription = () => {
    if (testType === 'flexure') {
      return 'Area = W × H (L fixed at 21")';
    } else if (testType === 'compressive') {
      if (subType === 'Perpendicular') {
        return 'Area = L × W (Perpendicular to Grain)';
      }
      return 'Area = W × H (Parallel to Grain)';
    } else if (testType === 'shear') {
      if (subType === 'Double') {
        return 'Area = (W × L) × 2 (Double Shear)';
      }
      return 'Area = W × L (Single Shear)';
    }
    return 'Area = W × H';
  };
  
  return (
    <div className="fixed inset-0 flex flex-col h-screen w-screen bg-gray-900">
      <div className="flex items-center px-3 py-1.5 bg-gray-800 fixed top-0 left-0 right-0 z-10">
        <button type="button" onClick={onPreviousTest} className="bg-transparent border-none text-gray-200 text-2xl cursor-pointer p-1.5 hover:text-blue-400 transition-colors">←</button>
        <span className="ml-4 text-gray-100 text-lg font-semibold">TimberMach | Manual Lines ({testType.charAt(0).toUpperCase() + testType.slice(1)})</span>
        
        {/* Camera Indicator with Calibration Status */}
        <div className="ml-4 flex items-center gap-2 bg-blue-900 bg-opacity-30 border border-blue-700 rounded-lg px-3 py-1">
          <Camera className="w-4 h-4 text-blue-400" />
          <span className="text-blue-400 text-sm font-semibold">{CAMERA_DEVICE_ID}</span>
          <span className="text-xs text-green-400 ml-2">
            {testType === 'flexure' ? '✓ Calibrated' : '⚠ Needs Calibration'}
          </span>
        </div>
        
        <button type="button" onClick={onMainPageReturn} className="bg-transparent border-none text-gray-200 text-2xl cursor-pointer p-1.5 ml-auto hover:text-red-500 transition-colors">✕</button>
      </div>
      
      <div className="mt-12 flex-grow overflow-auto p-4">
        <div className="max-w-7xl mx-auto">
          <div className="bg-gray-800 rounded-lg p-4 mb-4">
            <div className="flex items-center justify-center gap-4">
              <div className={`flex items-center gap-2 ${currentStep === 1 ? 'text-blue-400' : 'text-green-400'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${currentStep === 1 ? 'bg-blue-600' : 'bg-green-600'}`}>{currentStep > 1 ? <Check className="w-5 h-5" /> : '1'}</div>
                <span className="font-semibold">Capture & Measure</span>
              </div>
              <ArrowRight className="text-gray-500" />
              <div className={`flex items-center gap-2 ${currentStep === 2 ? 'text-blue-400' : 'text-gray-500'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${currentStep === 2 ? 'bg-blue-600' : 'bg-gray-700'}`}>2</div>
                <span className="font-semibold">Results</span>
              </div>
            </div>
          </div>
          
          {currentStep === 1 && (
            <>
              <div className="bg-gray-800 rounded-lg p-4 mb-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      <Ruler className="w-4 h-4 inline mr-2" />
                      Calibration Mode
                    </label>
                    <select
                      value={useManualCalibration ? 'manual' : 'auto'}
                      onChange={(e) => setUseManualCalibration(e.target.value === 'manual')}
                      className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500"
                    >
                      <option value="manual">Manual (Direct Factor)</option>
                      <option value="auto">Auto (Camera Distance)</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      <Ruler className="w-4 h-4 inline mr-2" />
                      Current Distance (mm)
                    </label>
                    <input 
                      type="text" 
                      value={cameraDistance || ''} 
                      onFocus={() => handleInputFocus('cameraDistance')}
                      readOnly
                      className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500 cursor-pointer"
                    />
                    <div className="text-xs text-gray-400 mt-1">
                      Actual camera position
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Target Distance (mm)
                    </label>
                    <input 
                      type="text" 
                      value={targetDistance || ''} 
                      onFocus={() => handleInputFocus('targetDistance')}
                      readOnly
                      className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500 cursor-pointer"
                    />
                    <div className={`text-xs mt-1 ${testType === 'flexure' ? 'text-green-400' : 'text-yellow-400'}`}>
                      {testType === 'flexure' ? '✓ Calibrated: 210mm' : `Required: ${CALIBRATION_PRESETS[testType].targetDistance}mm`}
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Calibration Factor
                    </label>
                    {useManualCalibration ? (
                      <input 
                        type="text" 
                        value={manualCalibrationFactor || ''} 
                        onFocus={() => handleInputFocus('manualCalibrationFactor')}
                        readOnly
                        className={`w-full px-3 py-2 text-white rounded-lg border focus:outline-none focus:border-blue-500 cursor-pointer ${
                          testType === 'flexure' ? 'bg-green-900 border-green-700' : 'bg-yellow-900 border-yellow-700'
                        }`}
                      />
                    ) : (
                      <div className="text-white text-sm bg-gray-700 px-3 py-2 rounded-lg">
                        {calibrationFactor ? calibrationFactor.toFixed(6) : '0.000000'}
                      </div>
                    )}
                    <div className={`text-xs mt-1 ${testType === 'flexure' ? 'text-green-400' : 'text-yellow-400'}`}>
                      {useManualCalibration ? (testType === 'flexure' ? '✓ Calibrated' : '⚠ Update value') : 'mm/pixel (auto)'}
                    </div>
                  </div>
                  
                  {requiresLength && testType !== 'flexure' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        <Ruler className="w-4 h-4 inline mr-2" />
                        Length (in, max 12")
                      </label>
                      <input 
                        type="text" 
                        value={lengthInput} 
                        onFocus={() => handleInputFocus('lengthInput')}
                        readOnly
                        placeholder="Enter length" 
                        className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500 cursor-pointer" 
                      />
                    </div>
                  )}
                  
                  {testType === 'flexure' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        <Ruler className="w-4 h-4 inline mr-2" />
                        Length (FIXED)
                      </label>
                      <div className="w-full px-3 py-2 bg-green-900 text-green-200 rounded-lg border border-green-700">
                        21.00" (533.4mm)
                      </div>
                      <div className="text-xs text-green-400 mt-1">
                        ✓ Standard flexure length
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Area Calculation Info */}
                <div className={`mb-4 p-3 rounded-lg border ${
                  (testType === 'compressive' && subType === 'Perpendicular') || testType === 'shear'
                    ? (!lengthInput || parseFloat(lengthInput) <= 0)
                      ? 'bg-yellow-900 bg-opacity-30 border-yellow-700'
                      : 'bg-purple-900 bg-opacity-30 border-purple-700'
                    : 'bg-purple-900 bg-opacity-30 border-purple-700'
                }`}>
                  <div className={`text-sm font-semibold flex items-center gap-2 ${
                    (testType === 'compressive' && subType === 'Perpendicular') || testType === 'shear'
                      ? (!lengthInput || parseFloat(lengthInput) <= 0)
                        ? 'text-yellow-400'
                        : 'text-purple-400'
                      : 'text-purple-400'
                  }`}>
                    <Info className="w-4 h-4" />
                    {getAreaDescription()}
                  </div>
                  {((testType === 'compressive' && subType === 'Perpendicular') || testType === 'shear') && 
                   (!lengthInput || parseFloat(lengthInput) <= 0) && (
                    <div className="text-yellow-300 text-xs mt-2">
                      ⚠ Length required for area calculation
                    </div>
                  )}
                </div>
                
                <button type="button" onClick={performMeasurement} disabled={!isCameraActive || isProcessing} className={`w-full px-6 py-3 rounded-lg font-semibold transition-colors ${!isCameraActive || isProcessing ? 'bg-gray-600 text-gray-400 cursor-not-allowed' : 'bg-green-600 text-white hover:bg-green-700'}`}>
                  {isProcessing ? 'Processing...' : 'Perform Measurement'}
                </button>
              </div>
              
              {error && (
                <div className="bg-red-900 border border-red-700 text-red-200 px-4 py-3 rounded-lg mb-4">
                  <strong>Error:</strong> {error}
                </div>
              )}
              
              <div className="bg-gray-800 rounded-lg p-4">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-white font-semibold flex items-center">
                    <Camera className="w-4 h-4 mr-2" />
                    {capturedImage ? 'Captured Image' : 'Camera View'}
                  </h3>
                  {capturedImage && (
                    <button 
                      type="button" 
                      onClick={retakePhoto} 
                      className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 flex items-center"
                    >
                      <RotateCcw className="w-3 h-3 mr-1" />Retake
                    </button>
                  )}
                </div>
                
                {/* Camera View with Live Measurement Lines */}
                {isCameraActive && (
                  <div 
                    className="relative bg-black rounded-lg overflow-hidden flex items-center justify-center"
                    style={{
                      aspectRatio: `${videoResolution.width} / ${videoResolution.height}`,
                      maxHeight: '600px',
                      width: '100%'
                    }}
                    onMouseDown={handleMouseDownOnVideo}
                    onMouseMove={handleMouseMoveOnVideo}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                  >
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="rounded-lg"
                      style={{ 
                        maxHeight: '600px',
                        width: 'auto',
                        maxWidth: '100%',
                        objectFit: 'contain',
                        aspectRatio: `${videoResolution.width} / ${videoResolution.height}`,
                        margin: '0 auto',
                        display: 'block'
                      }}
                    />
                    
                    {/* SVG Overlay for measurement lines */}
                    <svg 
                      className="absolute inset-0 pointer-events-none"
                      style={{ 
                        width: '100%', 
                        height: '100%',
                        objectFit: 'contain'
                      }}
                      viewBox={`0 0 ${videoResolution.width} ${videoResolution.height}`}
                      preserveAspectRatio="xMidYMid meet"
                    >
                      {/* Red vertical lines (width) */}
                      <line 
                        x1={`${(widthLine1 / videoResolution.width) * 100}%`}
                        y1="0" 
                        x2={`${(widthLine1 / videoResolution.width) * 100}%`}
                        y2="100%" 
                        stroke="rgba(255, 0, 0, 0.8)" 
                        strokeWidth="3"
                      />
                      <line 
                        x1={`${(widthLine2 / videoResolution.width) * 100}%`}
                        y1="0" 
                        x2={`${(widthLine2 / videoResolution.width) * 100}%`}
                        y2="100%" 
                        stroke="rgba(255, 0, 0, 0.8)" 
                        strokeWidth="3"
                      />
                      
                      {/* Red circles (width handles) */}
                      <circle 
                        cx={`${(widthLine1 / videoResolution.width) * 100}%`}
                        cy="50%" 
                        r="10" 
                        fill="rgba(255, 0, 0, 1)"
                      />
                      <circle 
                        cx={`${(widthLine2 / videoResolution.width) * 100}%`}
                        cy="50%" 
                        r="10" 
                        fill="rgba(255, 0, 0, 1)"
                      />
                      
                      {/* Green horizontal lines (height) */}
                      <line 
                        x1="0" 
                        y1={`${(heightLine1 / videoResolution.height) * 100}%`}
                        x2="100%" 
                        y2={`${(heightLine1 / videoResolution.height) * 100}%`}
                        stroke="rgba(0, 255, 0, 0.8)" 
                        strokeWidth="3"
                      />
                      <line 
                        x1="0" 
                        y1={`${(heightLine2 / videoResolution.height) * 100}%`}
                        x2="100%" 
                        y2={`${(heightLine2 / videoResolution.height) * 100}%`}
                        stroke="rgba(0, 255, 0, 0.8)" 
                        strokeWidth="3"
                      />
                      
                      {/* Green circles (height handles) */}
                      <circle 
                        cx="50%" 
                        cy={`${(heightLine1 / videoResolution.height) * 100}%`}
                        r="10" 
                        fill="rgba(0, 255, 0, 1)"
                      />
                      <circle 
                        cx="50%" 
                        cy={`${(heightLine2 / videoResolution.height) * 100}%`}
                        r="10" 
                        fill="rgba(0, 255, 0, 1)"
                      />
                    </svg>
                    
                    {/* Measurement indicators with distance warning */}
                    <div className="absolute bottom-2 left-2 right-2 space-y-1 pointer-events-none">
                      {/* Distance Warning */}
                      <div className={`text-center py-2 rounded-lg font-bold text-sm ${
                        Math.abs(cameraDistance - targetDistance) > 10 
                          ? 'bg-red-900 bg-opacity-90 text-red-200 border border-red-500' 
                          : 'bg-green-900 bg-opacity-90 text-green-200 border border-green-500'
                      }`}>
                        {Math.abs(cameraDistance - targetDistance) > 10 ? (
                          <>⚠️ Camera Distance: {cameraDistance}mm (Target: {targetDistance}mm) - Adjust Position!</>
                        ) : (
                          <>✓ Camera Distance: {cameraDistance}mm - Perfect!</>
                        )}
                      </div>
                      
                      {/* Measurements */}
                      <div className="bg-black bg-opacity-80 rounded-lg p-2">
                        <div className="grid grid-cols-4 gap-2 text-xs">
                          <div className="text-center">
                            <div className="text-red-400 font-semibold">Width</div>
                            <div className="text-white">{widthMM.toFixed(1)} mm</div>
                            <div className="text-gray-400">{(widthMM / 25.4).toFixed(2)}"</div>
                          </div>
                          <div className="text-center">
                            <div className="text-green-400 font-semibold">Height</div>
                            <div className="text-white">{heightMM.toFixed(1)} mm</div>
                            <div className="text-gray-400">{(heightMM / 25.4).toFixed(2)}"</div>
                          </div>
                          {(requiresLength || testType === 'flexure') && (
                            <div className="text-center">
                              <div className="text-blue-400 font-semibold">Length</div>
                              <div className="text-white">
                                {testType === 'flexure' ? '21.00"' : (lengthInput || '—')+"\""}
                              </div>
                              <div className="text-gray-400">
                                {testType === 'flexure' ? 'FIXED' : 'Required'}
                              </div>
                            </div>
                          )}
                          <div className="text-center">
                            <div className="text-purple-400 font-semibold">{getAreaDescription()}</div>
                            <div className="text-white">{displayAreaMM2.toFixed(0)} mm²</div>
                            <div className="text-gray-400">{displayAreaIN2.toFixed(2)} in²</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Captured Image with Lines */}
                {capturedImage && (
                  <>
                    <canvas
                      ref={canvasRef}
                      onMouseDown={handleMouseDown}
                      onMouseMove={handleMouseMove}
                      onMouseUp={handleMouseUp}
                      onMouseLeave={handleMouseUp}
                      className="w-full h-auto rounded-lg cursor-crosshair border-2 border-gray-600"
                      style={{ maxHeight: '600px' }}
                    />
                    
                    <div className="grid grid-cols-2 gap-4 mt-4">
                      <div className="bg-red-900 bg-opacity-30 border border-red-700 rounded-lg p-3">
                        <div className="text-red-400 text-sm font-semibold mb-1 flex items-center">
                          <Move className="w-4 h-4 mr-2" />Red Lines — Width
                        </div>
                        <div className="text-white text-xl font-bold">
                          {widthMM.toFixed(2)} mm
                        </div>
                        <div className="text-gray-300 text-sm">{(widthMM / 25.4).toFixed(3)}"</div>
                        <div className="text-xs text-gray-400 mt-1">{widthPixels.toFixed(0)} pixels</div>
                      </div>
                      
                      <div className="bg-green-900 bg-opacity-30 border border-green-700 rounded-lg p-3">
                        <div className="text-green-400 text-sm font-semibold mb-1 flex items-center">
                          <Move className="w-4 h-4 mr-2" />Green Lines — Height
                        </div>
                        <div className="text-white text-xl font-bold">
                          {heightMM.toFixed(2)} mm
                        </div>
                        <div className="text-gray-300 text-sm">{(heightMM / 25.4).toFixed(3)}"</div>
                        <div className="text-xs text-gray-400 mt-1">{heightPixels.toFixed(0)} pixels</div>
                      </div>
                      
                      <div className="bg-purple-900 bg-opacity-30 border border-purple-700 rounded-lg p-3 col-span-2">
                        <div className="text-purple-400 text-sm font-semibold mb-1 flex items-center">
                          <Maximize2 className="w-4 h-4 mr-2" />
                          {getAreaDescription()}
                        </div>
                        <div className="text-white text-2xl font-bold">{displayAreaMM2.toFixed(2)} mm²</div>
                        <div className="text-gray-300 text-lg">{displayAreaIN2.toFixed(3)} in²</div>
                      </div>
                    </div>
                  </>
                )}
                
                <canvas ref={captureCanvasRef} className="hidden" />
              </div>
            </>
          )}
          
          {currentStep === 2 && finalMeasurement && (
            <>
              <div className="bg-gray-800 rounded-lg p-6 mb-4">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-white text-2xl font-bold flex items-center">
                    <Check className="w-6 h-6 mr-2 text-green-400" />
                    Measurement Complete
                    <span className="ml-3 px-3 py-1 bg-blue-600 text-white text-sm rounded-full">#{finalMeasurement.id}</span>
                  </h3>
                  <button type="button" onClick={startNewMeasurement} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">New Measurement</button>
                </div>
                
                <div className="bg-blue-900 bg-opacity-20 border border-blue-700 rounded-lg p-3 mb-4">
                  <div className="text-blue-400 text-sm">
                    <Camera className="w-4 h-4 inline mr-2" />
                    Captured with: <strong>{finalMeasurement.cameraUsed}</strong>
                  </div>
                </div>
                
                <div className={`grid grid-cols-1 md:grid-cols-2 ${(requiresLength || testType === 'flexure') ? 'lg:grid-cols-4' : 'lg:grid-cols-3'} gap-4`}>
                  <div className="bg-gray-700 rounded-lg p-4"><div className="text-gray-400 text-sm mb-1">Width</div><div className="text-green-400 text-2xl font-bold">{finalMeasurement.width.toFixed(2)} mm</div><div className="text-gray-300 text-base mt-1">{finalMeasurement.widthInches}"</div></div>
                  <div className="bg-gray-700 rounded-lg p-4"><div className="text-gray-400 text-sm mb-1">Height</div><div className="text-green-400 text-2xl font-bold">{finalMeasurement.height.toFixed(2)} mm</div><div className="text-gray-300 text-base mt-1">{finalMeasurement.heightInches}"</div></div>
                  <div className="bg-purple-900 bg-opacity-50 rounded-lg p-4"><div className="text-gray-400 text-sm mb-1 flex items-center"><Maximize2 className="w-3 h-3 mr-1" />Area</div><div className="text-purple-400 text-2xl font-bold">{finalMeasurement.areaMM2.toFixed(2)} mm²</div><div className="text-gray-300 text-base mt-1">{finalMeasurement.areaIN2.toFixed(3)} in²</div></div>
                  {(requiresLength || testType === 'flexure') && finalMeasurement.length && (
                    <>
                      <div className="bg-gray-700 rounded-lg p-4"><div className="text-gray-400 text-sm mb-1">Length</div><div className="text-green-400 text-2xl font-bold">{finalMeasurement.length.toFixed(2)} mm</div><div className="text-gray-300 text-base mt-1">{finalMeasurement.lengthInches}"</div></div>
                      <div className="bg-blue-900 bg-opacity-50 rounded-lg p-4 md:col-span-2 lg:col-span-4"><div className="text-gray-400 text-sm mb-1">Volume</div><div className="text-blue-400 text-3xl font-bold">{finalMeasurement.volume.toFixed(2)} mm³</div><div className="text-gray-300 text-xl mt-1">{finalMeasurement.volumeInches.toFixed(3)} in³</div></div>
                    </>
                  )}
                </div>
              </div>
            </>
          )}
          
          {measurementHistory.length > 0 && (
            <div className="bg-gray-800 rounded-lg p-4 mt-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-white font-semibold">Measurement History ({measurementCounter})</h3>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setShowHistory(!showHistory)} className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700">{showHistory ? 'Hide' : 'Show'}</button>
                  <button type="button" onClick={exportMeasurements} className="px-3 py-1 bg-purple-600 text-white text-sm rounded hover:bg-purple-700 flex items-center"><Download className="w-4 h-4 mr-1" />CSV</button>
                  <button type="button" onClick={() => {setMeasurementHistory([]); setMeasurementCounter(0);}} className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 flex items-center"><Trash2 className="w-4 h-4 mr-1" />Clear</button>
                </div>
              </div>
              {showHistory && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-700">
                      <tr>
                        <th className="px-3 py-2 text-left text-gray-300">#</th>
                        <th className="px-3 py-2 text-left text-gray-300">Time</th>
                        <th className="px-3 py-2 text-left text-gray-300">Camera</th>
                        <th className="px-3 py-2 text-left text-gray-300">W×H (mm)</th>
                        <th className="px-3 py-2 text-left text-gray-300">Area (mm²)</th>
                        {(requiresLength || testType === 'flexure') && <th className="px-3 py-2 text-left text-gray-300">Vol (in³)</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700">
                      {measurementHistory.slice().reverse().map(m => (
                        <tr key={m.id} className="hover:bg-gray-700">
                          <td className="px-3 py-2 text-white">{m.id}</td>
                          <td className="px-3 py-2 text-gray-400">{m.timestamp.toLocaleTimeString()}</td>
                          <td className="px-3 py-2 text-blue-400 text-xs">{m.cameraUsed}</td>
                          <td className="px-3 py-2 text-green-400 font-semibold">{m.width.toFixed(1)}×{m.height.toFixed(1)}</td>
                          <td className="px-3 py-2 text-purple-400 font-semibold">{m.areaMM2.toFixed(2)}</td>
                          {m.volumeInches !== undefined && <td className="px-3 py-2 text-blue-400 font-semibold">{m.volumeInches.toFixed(3)}</td>}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      
      {/* Virtual Keyboard */}
      {showKeyboard && (
        <VirtualKeyboard
          initialValue={keyboardInput}
          onKeyPress={handleKeyboardInput}
          onClose={handleKeyboardClose}
          darkMode={true}
        />
      )}
    </div>
  );
};

// Simple Virtual Keyboard Component
const VirtualKeyboard = ({ initialValue = '', onKeyPress, onClose, darkMode = false }) => {
  const [input, setInput] = useState(initialValue);

  const keys = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['.', '0', '⌫']
  ];

  const handleKeyPress = (key) => {
    let newInput = input;
    
    if (key === '⌫') {
      newInput = input.slice(0, -1);
    } else if (key === '.') {
      if (!input.includes('.')) {
        newInput = input + key;
      }
    } else {
      newInput = input + key;
    }
    
    setInput(newInput);
    if (onKeyPress) {
      onKeyPress(newInput);
    }
  };

  const handleClear = () => {
    setInput('');
    if (onKeyPress) {
      onKeyPress('');
    }
  };

  const handleDone = () => {
    if (onClose) {
      onClose(input);
    }
  };

  return (
    <div className={`fixed bottom-0 left-0 right-0 z-50 ${
      darkMode ? 'bg-gray-800 border-t-2 border-gray-700' : 'bg-gray-100 border-t-2 border-gray-300'
    }`}>
      {/* Input Display */}
      <div className={`px-4 py-3 border-b ${darkMode ? 'border-gray-700' : 'border-gray-300'}`}>
        <div className={`text-2xl font-mono text-center ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>
          {input || <span className={darkMode ? 'text-gray-500' : 'text-gray-400'}>0</span>}
        </div>
      </div>

      {/* Keyboard Keys */}
      <div className="p-4">
        {keys.map((row, rowIdx) => (
          <div key={rowIdx} className="flex gap-2 mb-2">
            {row.map((key) => (
              <button
                key={key}
                onClick={() => handleKeyPress(key)}
                className={`flex-1 py-4 text-xl font-semibold rounded-lg transition-colors ${
                  darkMode
                    ? 'bg-gray-700 text-gray-100 hover:bg-gray-600 active:bg-gray-500'
                    : 'bg-white text-gray-900 hover:bg-gray-200 active:bg-gray-300 border border-gray-300'
                }`}
              >
                {key}
              </button>
            ))}
          </div>
        ))}

        {/* Bottom Row - Special buttons */}
        <div className="flex gap-2 mt-4">
          <button
            onClick={handleClear}
            className={`flex-1 py-4 text-lg font-semibold rounded-lg transition-colors ${
              darkMode
                ? 'bg-red-700 text-white hover:bg-red-600 active:bg-red-500'
                : 'bg-red-500 text-white hover:bg-red-600 active:bg-red-700 border border-red-600'
            }`}
          >
            Clear
          </button>
          <button
            onClick={handleDone}
            className={`flex-1 py-4 text-lg font-semibold rounded-lg transition-colors ${
              darkMode
                ? 'bg-green-700 text-white hover:bg-green-600 active:bg-green-500'
                : 'bg-green-500 text-white hover:bg-green-600 active:bg-green-700 border border-green-600'
            }`}
          >
            ✓ Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default ManualMeasurement;