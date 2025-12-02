import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, Upload, Ruler, Settings, Download, Trash2, Info, Maximize2, Move, Check, ArrowRight } from 'lucide-react';

const ManualMeasurement = ({ onTestComplete, onPreviousTest, onMainPageReturn, testType = 'flexure' }) => {
  const requiresLength = testType === 'compressive' || testType === 'shear';
  
  const [uploadedImage, setUploadedImage] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [widthLine1, setWidthLine1] = useState(200);
  const [widthLine2, setWidthLine2] = useState(1080);
  const [heightLine1, setHeightLine1] = useState(100);
  const [heightLine2, setHeightLine2] = useState(620);
  const [draggingLine, setDraggingLine] = useState(null);
  const [cameraDistance, setCameraDistance] = useState(300);
  const [calibrationFactor, setCalibrationFactor] = useState(null);
  const [lengthInput, setLengthInput] = useState('');
  const [finalMeasurement, setFinalMeasurement] = useState(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [measurementHistory, setMeasurementHistory] = useState([]);
  const [measurementCounter, setMeasurementCounter] = useState(0);
  const [showHistory, setShowHistory] = useState(false);
  const [showCalibration, setShowCalibration] = useState(false);
  const [error, setError] = useState(null);
  const [visualizedImage, setVisualizedImage] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const fileInputRef = useRef(null);
  const canvasRef = useRef(null);
  const API_URL = 'http://localhost:5000';
  const visualizationTimeoutRef = useRef(null);
  
  // Dynamic image dimensions (will be set from uploaded image)
  const [imageDimensions, setImageDimensions] = useState({ width: 1280, height: 720 });
  
  const SENSOR_WIDTH = 4.8;
  const FOCAL_LENGTH = 4.0;
  const MAX_WIDTH_MM = 101.6;
  const MAX_HEIGHT_MM = 101.6;
  const MAX_LENGTH_MM = 304.8;
  
  useEffect(() => {
    const pixelSizeMM = (SENSOR_WIDTH * cameraDistance) / (FOCAL_LENGTH * imageDimensions.width);
    setCalibrationFactor(pixelSizeMM);
  }, [cameraDistance, imageDimensions.width]);
  
  const handleImageUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    setImageFile(file);
    setError(null);
    setVisualizedImage(null);
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const imgWidth = img.width;
        const imgHeight = img.height;
        setImageDimensions({ width: imgWidth, height: imgHeight });
        
        setWidthLine1(Math.floor(imgWidth * 0.15));
        setWidthLine2(Math.floor(imgWidth * 0.85));
        setHeightLine1(Math.floor(imgHeight * 0.15));
        setHeightLine2(Math.floor(imgHeight * 0.85));
        
        setUploadedImage(e.target.result);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  };
  
  const widthPixels = Math.abs(widthLine2 - widthLine1);
  const heightPixels = Math.abs(heightLine2 - heightLine1);
  const widthMM = widthPixels * (calibrationFactor || 0);
  const heightMM = heightPixels * (calibrationFactor || 0);
  const areaMM2 = widthMM * heightMM;
  const areaIN2 = areaMM2 / 645.16;

  // Calculate limit percentages for visual feedback
  const widthLimitPercent = (widthMM / MAX_WIDTH_MM) * 100;
  const heightLimitPercent = (heightMM / MAX_HEIGHT_MM) * 100;
  const widthExceedsLimit = widthMM > MAX_WIDTH_MM;
  const heightExceedsLimit = heightMM > MAX_HEIGHT_MM;
  const widthNearLimit = widthLimitPercent > 90 && !widthExceedsLimit;
  const heightNearLimit = heightLimitPercent > 90 && !heightExceedsLimit;

  
  // DEBOUNCED visualization call - only fires 300ms after user stops dragging
  const sendToBackendForVisualization = useCallback(async () => {
    if (!imageFile) return;
    if (draggingLine) return; // ← ADD THIS LINE
    
    // Clear any pending visualization calls
    if (visualizationTimeoutRef.current) {
      clearTimeout(visualizationTimeoutRef.current);
    }
    
    // Wait 300ms before making the API call
    visualizationTimeoutRef.current = setTimeout(async () => {
      try {
        const formData = new FormData();
        formData.append('image', imageFile);
        formData.append('widthLine1', widthLine1);
        formData.append('widthLine2', widthLine2);
        formData.append('heightLine1', heightLine1);
        formData.append('heightLine2', heightLine2);
        formData.append('widthMM', widthMM.toFixed(2));
        formData.append('heightMM', heightMM.toFixed(2));
        
        const response = await fetch(`${API_URL}/manual-measure/visualize`, {
          method: 'POST',
          body: formData,
        });
        
        const data = await response.json();
        if (data.success && data.visualizedImage) {
          setVisualizedImage('data:image/png;base64,' + data.visualizedImage);
        }
      } catch (err) {
        // Silently ignore errors during visualization (non-critical)
        console.log('Visualization skipped (lines may be in invalid position)');
      }
    }, 300);
  }, [imageFile, widthLine1, widthLine2, heightLine1, heightLine2, widthMM, heightMM]);
  
  // Trigger debounced visualization when lines change
  useEffect(() => {
    if (uploadedImage && !draggingLine) {
      sendToBackendForVisualization();
    }
  }, [widthLine1, widthLine2, heightLine1, heightLine2, uploadedImage, draggingLine]);
  
  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (visualizationTimeoutRef.current) {
        clearTimeout(visualizationTimeoutRef.current);
      }
    };
  }, []);
  
  const drawLines = () => {
    const canvas = canvasRef.current;
    if (!canvas || !uploadedImage) return;
    
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    img.onload = () => {
      canvas.width = imageDimensions.width;
      canvas.height = imageDimensions.height;
      
      ctx.drawImage(img, 0, 0, imageDimensions.width, imageDimensions.height);
      
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
    
    img.src = uploadedImage;
  };
  
  useEffect(() => {
    drawLines();
  }, [uploadedImage, widthLine1, widthLine2, heightLine1, heightLine2, widthMM, heightMM]);
  
  const handleMouseDown = (e) => {
    if (!canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = imageDimensions.width / rect.width;
    const scaleY = imageDimensions.height / rect.height;
    const x = Math.round((e.clientX - rect.left) * scaleX);
    const y = Math.round((e.clientY - rect.top) * scaleY);
    
    const threshold = 20;
    
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
    if (!imageFile) {
      setError('Please upload an image');
      return;
    }
    
    if (requiresLength && (!lengthInput || parseFloat(lengthInput) <= 0)) {
      setError('Please enter valid length');
      return;
    }
    
    if (requiresLength && parseFloat(lengthInput) * 25.4 > MAX_LENGTH_MM) {
      setError('Length exceeds 12 inches');
      return;
    }
    
    if (widthMM > MAX_WIDTH_MM) {
      setError('Width exceeds 4 inches');
      return;
    }
    
    if (heightMM > MAX_HEIGHT_MM) {
      setError('Height exceeds 4 inches');
      return;
    }
    
    setIsProcessing(true);
    setError(null);
    
    try {
      const formData = new FormData();
      formData.append('image', imageFile);
      formData.append('widthLine1', widthLine1);
      formData.append('widthLine2', widthLine2);
      formData.append('heightLine1', heightLine1);
      formData.append('heightLine2', heightLine2);
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
        widthPixels: data.widthPixels,
        heightPixels: data.heightPixels,
        width: data.widthMM,
        height: data.heightMM,
        areaMM2: data.areaMM2,
        areaIN2: data.areaIN2,
        widthInches: data.widthInches,
        heightInches: data.heightInches,
        calibrationFactor: data.calibrationFactor,
        cameraDistance: cameraDistance,
      };
      
      if (requiresLength) {
        const lengthMM = parseFloat(lengthInput) * 25.4;
        newMeasurement.length = lengthMM;
        newMeasurement.lengthInches = parseFloat(lengthInput).toFixed(3);
        newMeasurement.volume = data.widthMM * data.heightMM * lengthMM;
        newMeasurement.volumeInches = newMeasurement.volume / 16387.064;
      }
      
      setFinalMeasurement(newMeasurement);
      setMeasurementHistory(prev => [...prev, newMeasurement]);
      setMeasurementCounter(prev => prev + 1);
      setCurrentStep(2);
      setIsProcessing(false);
      
    } catch (err) {
      setError('Failed: ' + err.message);
      setIsProcessing(false);
    }
  };
  
  const exportMeasurements = () => {
    if (measurementHistory.length === 0) return;
    const headers = requiresLength 
      ? ['ID','Time','Type','W(mm)','H(mm)','Area(mm²)','Area(in²)','L(mm)','Vol(mm³)','Vol(in³)']
      : ['ID','Time','Type','W(mm)','H(mm)','Area(mm²)','Area(in²)'];
    const rows = measurementHistory.map(m => {
      const base = [m.id, m.timestamp.toISOString(), m.testType, m.width.toFixed(2), m.height.toFixed(2), m.areaMM2.toFixed(2), m.areaIN2.toFixed(3)];
      if (requiresLength && m.length) {
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
    setUploadedImage(null);
    setImageFile(null);
    setLengthInput('');
    setFinalMeasurement(null);
    setError(null);
    setVisualizedImage(null);
  };
  
  return (
    <div className="fixed inset-0 flex flex-col h-screen w-screen bg-gray-900">
      <div className="flex items-center px-3 py-1.5 bg-gray-800 fixed top-0 left-0 right-0 z-10">
        <button type="button" onClick={onPreviousTest} className="bg-transparent border-none text-gray-200 text-2xl cursor-pointer p-1.5 hover:text-blue-400 transition-colors">←</button>
        <span className="ml-4 text-gray-100 text-lg font-semibold">TimberMach | Manual Lines ({testType.charAt(0).toUpperCase() + testType.slice(1)})</span>
        <button type="button" onClick={onMainPageReturn} className="bg-transparent border-none text-gray-200 text-2xl cursor-pointer p-1.5 ml-auto hover:text-red-500 transition-colors">✕</button>
      </div>
      
      <div className="mt-12 flex-grow overflow-auto p-4">
        <div className="max-w-7xl mx-auto">
          <div className="bg-gray-800 rounded-lg p-4 mb-4">
            <div className="flex items-center justify-center gap-4">
              <div className={`flex items-center gap-2 ${currentStep === 1 ? 'text-blue-400' : 'text-green-400'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${currentStep === 1 ? 'bg-blue-600' : 'bg-green-600'}`}>{currentStep > 1 ? <Check className="w-5 h-5" /> : '1'}</div>
                <span className="font-semibold">Upload & Measure</span>
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
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2"><Ruler className="w-4 h-4 inline mr-2" />Camera Distance (mm)</label>
                    <input 
                        type="number" 
                        step="10" 
                        value={cameraDistance || ''} 
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          setCameraDistance(isNaN(val) ? 300 : val);
                        }}
                        className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500"
                      />
                    <div className="text-xs text-gray-400 mt-1">Distance from camera to wood surface</div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Calibration Factor</label>
                    <div className="text-white text-sm bg-gray-700 px-3 py-2 rounded-lg">{calibrationFactor ? calibrationFactor.toFixed(6) : '0.000000'} mm/px</div>
                    <div className="text-xs text-gray-400 mt-1">Auto-calculated from distance</div>
                  </div>
                  {requiresLength && (
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2"><Ruler className="w-4 h-4 inline mr-2" />Length (in, max 12")</label>
                      <input type="number" step="0.001" max="12" value={lengthInput} onChange={(e) => setLengthInput(e.target.value)} placeholder="Enter length" className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500" />
                    </div>
                  )}
                </div>
                
                <div className="bg-blue-900 bg-opacity-30 border border-blue-700 rounded-lg p-3 mb-4">
                  <div className="text-sm text-blue-200">
                    <strong className="flex items-center"><Info className="w-4 h-4 mr-2" />Manual Line Measurement</strong>
                    <div className="mt-2 text-xs">
                      1. Upload wood base image (any resolution)<br />
                      2. Set camera distance in mm<br />
                      3. Drag RED lines to match wood width edges<br />
                      4. Drag GREEN lines to match wood height edges<br />
                      5. View real-time measurements
                    </div>
                  </div>
                </div>
                
                <button type="button" onClick={performMeasurement} disabled={!uploadedImage || isProcessing} className={`w-full px-6 py-3 rounded-lg font-semibold transition-colors ${!uploadedImage || isProcessing ? 'bg-gray-600 text-gray-400 cursor-not-allowed' : 'bg-green-600 text-white hover:bg-green-700'}`}>
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
                  <h3 className="text-white font-semibold flex items-center"><Camera className="w-4 h-4 mr-2" />Wood Base Image</h3>
                  <div className="flex gap-2">
                    <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                    <button type="button" onClick={() => fileInputRef.current?.click()} className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 flex items-center"><Upload className="w-3 h-3 mr-1" />Upload</button>
                  </div>
                </div>
                
                {uploadedImage ? (
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
                      <div className={`${
                        widthExceedsLimit ? 'bg-red-900 border-red-500' : 
                        widthNearLimit ? 'bg-yellow-900 border-yellow-500' : 
                        'bg-red-900 border-red-700'
                      } bg-opacity-30 border rounded-lg p-3`}>
                        <div className="text-red-400 text-sm font-semibold mb-1 flex items-center justify-between">
                          <span className="flex items-center"><Move className="w-4 h-4 mr-2" />Red Lines — Width</span>
                          {widthExceedsLimit && <span className="text-xs bg-red-600 px-2 py-1 rounded">EXCEEDS 4"</span>}
                          {widthNearLimit && <span className="text-xs bg-yellow-600 px-2 py-1 rounded">NEAR LIMIT</span>}
                        </div>
                        <div className={`${widthExceedsLimit ? 'text-red-500' : 'text-white'} text-xl font-bold`}>
                          {widthMM.toFixed(2)} mm
                        </div>
                        <div className="text-gray-300 text-sm">{(widthMM / 25.4).toFixed(3)}"</div>
                        <div className="text-xs text-gray-400 mt-1">{widthPixels.toFixed(0)} pixels</div>
                        {/* Progress bar showing limit usage */}
                        <div className="mt-2 bg-gray-700 rounded-full h-2 overflow-hidden">
                          <div 
                            className={`h-full ${
                              widthExceedsLimit ? 'bg-red-500' : 
                              widthNearLimit ? 'bg-yellow-500' : 
                              'bg-green-500'
                            }`}
                            style={{ width: `${Math.min(100, widthLimitPercent)}%` }}
                          />
                        </div>
                        <div className="text-xs text-gray-400 mt-1">
                          {widthLimitPercent.toFixed(0)}% of 4" limit
                        </div>
                      </div>
                      
                      <div className={`${
                        heightExceedsLimit ? 'bg-red-900 border-red-500' : 
                        heightNearLimit ? 'bg-yellow-900 border-yellow-500' : 
                        'bg-green-900 border-green-700'
                      } bg-opacity-30 border rounded-lg p-3`}>
                        <div className="text-green-400 text-sm font-semibold mb-1 flex items-center justify-between">
                          <span className="flex items-center"><Move className="w-4 h-4 mr-2" />Green Lines — Height</span>
                          {heightExceedsLimit && <span className="text-xs bg-red-600 px-2 py-1 rounded">EXCEEDS 4"</span>}
                          {heightNearLimit && <span className="text-xs bg-yellow-600 px-2 py-1 rounded">NEAR LIMIT</span>}
                        </div>
                        <div className={`${heightExceedsLimit ? 'text-red-500' : 'text-white'} text-xl font-bold`}>
                          {heightMM.toFixed(2)} mm
                        </div>
                        <div className="text-gray-300 text-sm">{(heightMM / 25.4).toFixed(3)}"</div>
                        <div className="text-xs text-gray-400 mt-1">{heightPixels.toFixed(0)} pixels</div>
                        {/* Progress bar showing limit usage */}
                        <div className="mt-2 bg-gray-700 rounded-full h-2 overflow-hidden">
                          <div 
                            className={`h-full ${
                              heightExceedsLimit ? 'bg-red-500' : 
                              heightNearLimit ? 'bg-yellow-500' : 
                              'bg-green-500'
                            }`}
                            style={{ width: `${Math.min(100, heightLimitPercent)}%` }}
                          />
                        </div>
                        <div className="text-xs text-gray-400 mt-1">
                          {heightLimitPercent.toFixed(0)}% of 4" limit
                        </div>
                      </div>
                      
                      <div className="bg-purple-900 bg-opacity-30 border border-purple-700 rounded-lg p-3 col-span-2">
                        <div className="text-purple-400 text-sm font-semibold mb-1 flex items-center"><Maximize2 className="w-4 h-4 mr-2" />Area (W × H)</div>
                        <div className="text-white text-2xl font-bold">{areaMM2.toFixed(2)} mm²</div>
                        <div className="text-gray-300 text-lg">{areaIN2.toFixed(3)} in²</div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="bg-gray-700 rounded-lg p-8 text-center">
                    <Camera className="w-12 h-12 text-gray-500 mx-auto mb-2" />
                    <p className="text-gray-400">Upload wood base image</p>
                  </div>
                )}
              </div>
            </>
          )}
          
          {currentStep === 2 && finalMeasurement && (
            <>
              <div className="bg-gray-800 rounded-lg p-6 mb-4">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-white text-2xl font-bold flex items-center"><Check className="w-6 h-6 mr-2 text-green-400" />Measurement Complete<span className="ml-3 px-3 py-1 bg-blue-600 text-white text-sm rounded-full">#{finalMeasurement.id}</span></h3>
                  <button type="button" onClick={startNewMeasurement} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">New Measurement</button>
                </div>
                
                <div className={`grid grid-cols-1 md:grid-cols-2 ${requiresLength ? 'lg:grid-cols-4' : 'lg:grid-cols-3'} gap-4`}>
                  <div className="bg-gray-700 rounded-lg p-4"><div className="text-gray-400 text-sm mb-1">Width</div><div className="text-green-400 text-2xl font-bold">{finalMeasurement.width.toFixed(2)} mm</div><div className="text-gray-300 text-base mt-1">{finalMeasurement.widthInches}"</div></div>
                  <div className="bg-gray-700 rounded-lg p-4"><div className="text-gray-400 text-sm mb-1">Height</div><div className="text-green-400 text-2xl font-bold">{finalMeasurement.height.toFixed(2)} mm</div><div className="text-gray-300 text-base mt-1">{finalMeasurement.heightInches}"</div></div>
                  <div className="bg-purple-900 bg-opacity-50 rounded-lg p-4"><div className="text-gray-400 text-sm mb-1 flex items-center"><Maximize2 className="w-3 h-3 mr-1" />Area</div><div className="text-purple-400 text-2xl font-bold">{finalMeasurement.areaMM2.toFixed(2)} mm²</div><div className="text-gray-300 text-base mt-1">{finalMeasurement.areaIN2.toFixed(3)} in²</div></div>
                  {requiresLength && finalMeasurement.length && (
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
              <div className="flex justify-between items-center mb-4"><h3 className="text-white font-semibold">Measurement History ({measurementCounter})</h3><div className="flex gap-2"><button type="button" onClick={() => setShowHistory(!showHistory)} className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700">{showHistory ? 'Hide' : 'Show'}</button><button type="button" onClick={exportMeasurements} className="px-3 py-1 bg-purple-600 text-white text-sm rounded hover:bg-purple-700 flex items-center"><Download className="w-4 h-4 mr-1" />CSV</button><button type="button" onClick={() => {setMeasurementHistory([]); setMeasurementCounter(0);}} className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 flex items-center"><Trash2 className="w-4 h-4 mr-1" />Clear</button></div></div>
              {showHistory && (<div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-gray-700"><tr><th className="px-3 py-2 text-left text-gray-300">#</th><th className="px-3 py-2 text-left text-gray-300">Time</th><th className="px-3 py-2 text-left text-gray-300">W×H (mm)</th><th className="px-3 py-2 text-left text-gray-300">Area (mm²)</th>{requiresLength && <th className="px-3 py-2 text-left text-gray-300">Vol (in³)</th>}</tr></thead><tbody className="divide-y divide-gray-700">{measurementHistory.slice().reverse().map(m => (<tr key={m.id} className="hover:bg-gray-700"><td className="px-3 py-2 text-white">{m.id}</td><td className="px-3 py-2 text-gray-400">{m.timestamp.toLocaleTimeString()}</td><td className="px-3 py-2 text-green-400 font-semibold">{m.width.toFixed(1)}×{m.height.toFixed(1)}</td><td className="px-3 py-2 text-purple-400 font-semibold">{m.areaMM2.toFixed(2)}</td>{m.volumeInches !== undefined && <td className="px-3 py-2 text-blue-400 font-semibold">{m.volumeInches.toFixed(3)}</td>}</tr>))}</tbody></table></div>)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ManualMeasurement;