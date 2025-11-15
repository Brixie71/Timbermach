import React, { useState, useRef, useEffect } from 'react';
import { Camera, Upload, Ruler, Settings, Focus, RefreshCw, Download, Trash2, Sliders, Eye, Check, ArrowRight, Info, Maximize2 } from 'lucide-react';

const Measurement = ({ onTestComplete, onPreviousTest, onMainPageReturn, testType = 'flexure' }) => {
  const requiresLength = testType === 'compressive' || testType === 'shear';
  
  const [topCameraImage, setTopCameraImage] = useState(null);
  const [sideCameraImage, setSideCameraImage] = useState(null);
  const [topImageFile, setTopImageFile] = useState(null);
  const [sideImageFile, setSideImageFile] = useState(null);
  const [topProcessedImage, setTopProcessedImage] = useState(null);
  const [sideProcessedImage, setSideProcessedImage] = useState(null);
  const [topEdgeVisualization, setTopEdgeVisualization] = useState(null);
  const [sideEdgeVisualization, setSideEdgeVisualization] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [widthResult, setWidthResult] = useState(null);
  const [heightResult, setHeightResult] = useState(null);
  const [lengthInput, setLengthInput] = useState('');
  const [finalMeasurement, setFinalMeasurement] = useState(null);
  const [error, setError] = useState(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [topPreviewMode, setTopPreviewMode] = useState('original');
  const [sidePreviewMode, setSidePreviewMode] = useState('original');
  const [threshold, setThreshold] = useState(240);
  const [sigma, setSigma] = useState(2.0);
  const [contrastFactor, setContrastFactor] = useState(1.5);
  const [useAdaptiveThreshold, setUseAdaptiveThreshold] = useState(false);
  const [calibrationFactor, setCalibrationFactor] = useState(0.0145503);
  const [showCalibration, setShowCalibration] = useState(false);
  const [useCameraCalibration, setUseCameraCalibration] = useState(false);
  const [cameraDistance, setCameraDistance] = useState(300);
  const [focalLength, setFocalLength] = useState(50);
  const [sensorWidth, setSensorWidth] = useState(4.8);
  const [imageWidth, setImageWidth] = useState(1920);
  const [referencePixels, setReferencePixels] = useState(100);
  const [referenceMillimeters, setReferenceMillimeters] = useState(10);
  const [measurementHistory, setMeasurementHistory] = useState([]);
  const [measurementCounter, setMeasurementCounter] = useState(0);
  const [showHistory, setShowHistory] = useState(false);
  const [showAdjustments, setShowAdjustments] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [configName, setConfigName] = useState('');
  const [savedConfigs, setSavedConfigs] = useState([]);
  
  const topFileInputRef = useRef(null);
  const sideFileInputRef = useRef(null);
  const configFileInputRef = useRef(null);
  const API_URL = 'http://localhost:5000';
  const MAX_WIDTH_MM = 101.6;
  const MAX_HEIGHT_MM = 101.6;
  const MAX_LENGTH_MM = 304.8;

  // Load saved configs from localStorage on mount
  useEffect(() => {
    const configs = localStorage.getItem('timberMachConfigs');
    if (configs) {
      try {
        setSavedConfigs(JSON.parse(configs));
      } catch (err) {
        console.error('Failed to load configs:', err);
      }
    }
  }, []);

  const handleTopCameraUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    setTopImageFile(file);
    setError(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        setTopCameraImage(e.target.result);
        setImageWidth(img.width);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  };

  const handleSideCameraUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    setSideImageFile(file);
    setError(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => setSideCameraImage(e.target.result);
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  };

  const calculateCalibrationFactor = async () => {
    try {
      const response = await fetch(`${API_URL}/calculate-calibration`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method: useCameraCalibration ? 'camera' : 'manual',
          cameraDistance: useCameraCalibration ? cameraDistance : undefined,
          focalLength: useCameraCalibration ? focalLength : undefined,
          sensorWidth: useCameraCalibration ? sensorWidth : undefined,
          imageWidth: useCameraCalibration ? imageWidth : undefined,
          referencePixels: !useCameraCalibration ? referencePixels : undefined,
          referenceMillimeters: !useCameraCalibration ? referenceMillimeters : undefined,
        }),
      });
      const data = await response.json();
      if (data.success) {
        setCalibrationFactor(data.calibrationFactor);
        setShowCalibration(false);
      } else {
        setError(data.error || 'Calibration failed');
      }
    } catch (err) {
      setError('Failed to calculate calibration: ' + err.message);
    }
  };

  const previewEdgeDetection = async (imageFile, mode, setProcessedImg, setEdgeVis) => {
    if (!imageFile) return;
    try {
      const formData = new FormData();
      formData.append('image', imageFile);
      formData.append('mode', mode);
      formData.append('calibrationFactor', calibrationFactor);
      formData.append('threshold', threshold);
      formData.append('sigma', sigma);
      formData.append('contrastFactor', contrastFactor);
      formData.append('useAdaptiveThreshold', useAdaptiveThreshold);
      formData.append('returnProcessedImages', 'true');
      const response = await fetch(`${API_URL}/measure`, { method: 'POST', body: formData });
      const data = await response.json();
      if (data.success) {
        if (data.processedImageBase64) setProcessedImg('data:image/png;base64,' + data.processedImageBase64);
        if (data.edgeVisualizationBase64) setEdgeVis('data:image/png;base64,' + data.edgeVisualizationBase64);
      }
    } catch (err) {
      console.error('Preview error:', err);
    }
  };

  useEffect(() => {
    if (!topImageFile) return;
    const timeoutId = setTimeout(() => previewEdgeDetection(topImageFile, 'width', setTopProcessedImage, setTopEdgeVisualization), 500);
    return () => clearTimeout(timeoutId);
  }, [threshold, sigma, contrastFactor, useAdaptiveThreshold, topImageFile]);

  useEffect(() => {
    if (!sideImageFile) return;
    const timeoutId = setTimeout(() => previewEdgeDetection(sideImageFile, 'height', setSideProcessedImage, setSideEdgeVisualization), 500);
    return () => clearTimeout(timeoutId);
  }, [threshold, sigma, contrastFactor, useAdaptiveThreshold, sideImageFile]);

  const performMeasurement = async () => {
    if (!topImageFile || !sideImageFile) {
      setError('Please upload both top and side camera images');
      return;
    }
    if (requiresLength && (!lengthInput || parseFloat(lengthInput) <= 0)) {
      setError('Please enter valid length (required for Compressive/Shear)');
      return;
    }
    if (requiresLength && parseFloat(lengthInput) * 25.4 > MAX_LENGTH_MM) {
      setError('Length exceeds 12 inches limit');
      return;
    }
    setIsProcessing(true);
    setError(null);
    try {
      const topFormData = new FormData();
      topFormData.append('image', topImageFile);
      topFormData.append('mode', 'width');
      topFormData.append('calibrationFactor', calibrationFactor);
      topFormData.append('threshold', threshold);
      topFormData.append('sigma', sigma);
      topFormData.append('contrastFactor', contrastFactor);
      topFormData.append('useAdaptiveThreshold', useAdaptiveThreshold);
      topFormData.append('returnProcessedImages', 'true');
      const topResponse = await fetch(`${API_URL}/measure`, { method: 'POST', body: topFormData });
      const topData = await topResponse.json();
      if (!topData.success) {
        setError('Width measurement failed: ' + (topData.error || 'Unknown'));
        setIsProcessing(false);
        return;
      }
      if (topData.millimeterMeasurement > MAX_WIDTH_MM) {
        setError('Width exceeds 4 inches');
        setIsProcessing(false);
        return;
      }
      const sideFormData = new FormData();
      sideFormData.append('image', sideImageFile);
      sideFormData.append('mode', 'height');
      sideFormData.append('calibrationFactor', calibrationFactor);
      sideFormData.append('threshold', threshold);
      sideFormData.append('sigma', sigma);
      sideFormData.append('contrastFactor', contrastFactor);
      sideFormData.append('useAdaptiveThreshold', useAdaptiveThreshold);
      sideFormData.append('returnProcessedImages', 'true');
      const sideResponse = await fetch(`${API_URL}/measure`, { method: 'POST', body: sideFormData });
      const sideData = await sideResponse.json();
      if (!sideData.success) {
        setError('Height measurement failed: ' + (sideData.error || 'Unknown'));
        setIsProcessing(false);
        return;
      }
      if (sideData.millimeterMeasurement > MAX_HEIGHT_MM) {
        setError('Height exceeds 4 inches');
        setIsProcessing(false);
        return;
      }

      // Calculate Area from Width × Height
      const widthMM = topData.millimeterMeasurement;
      const heightMM = sideData.millimeterMeasurement;
      const widthPixels = topData.pixelMeasurement;
      const heightPixels = sideData.pixelMeasurement;
      
      const areaPixels = widthPixels * heightPixels;
      const areaMM2 = widthMM * heightMM;
      const areaIN2 = areaMM2 / 645.16; // Convert mm² to in²

      const newMeasurement = {
        id: measurementCounter + 1,
        timestamp: new Date(),
        testType: testType,
        widthPixels: widthPixels,
        heightPixels: heightPixels,
        width: widthMM,
        height: heightMM,
        areaPixels: areaPixels,
        areaMM2: areaMM2,
        areaIN2: areaIN2,
        widthInches: (widthMM / 25.4).toFixed(3),
        heightInches: (heightMM / 25.4).toFixed(3),
        widthQuality: topData.edgeQuality,
        heightQuality: sideData.edgeQuality,
        calibrationFactor,
      };
      
      if (requiresLength) {
        const lengthMM = parseFloat(lengthInput) * 25.4;
        newMeasurement.length = lengthMM;
        newMeasurement.lengthInches = parseFloat(lengthInput).toFixed(3);
        newMeasurement.volume = widthMM * heightMM * lengthMM;
        newMeasurement.volumeInches = newMeasurement.volume / 16387.064;
      }
      
      setFinalMeasurement(newMeasurement);
      setMeasurementHistory(prev => [...prev, newMeasurement]);
      setMeasurementCounter(prev => prev + 1);
      setCurrentStep(2);
      
      if (topData.processedImageBase64) setTopProcessedImage('data:image/png;base64,' + topData.processedImageBase64);
      if (topData.edgeVisualizationBase64) setTopEdgeVisualization('data:image/png;base64,' + topData.edgeVisualizationBase64);
      if (sideData.processedImageBase64) setSideProcessedImage('data:image/png;base64,' + sideData.processedImageBase64);
      if (sideData.edgeVisualizationBase64) setSideEdgeVisualization('data:image/png;base64,' + sideData.edgeVisualizationBase64);
    } catch (err) {
      setError('Failed: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const exportMeasurements = () => {
    if (measurementHistory.length === 0) return;
    const headers = requiresLength 
      ? ['ID','Time','Type','W(mm)','H(mm)','Area(mm²)','Area(in²)','L(mm)','Vol(mm³)','Vol(in³)','W_Quality','H_Quality']
      : ['ID','Time','Type','W(mm)','H(mm)','Area(mm²)','Area(in²)','W_Quality','H_Quality'];
    const rows = measurementHistory.map(m => {
      const base = [m.id, m.timestamp.toISOString(), m.testType, m.width.toFixed(2), m.height.toFixed(2), m.areaMM2.toFixed(2), m.areaIN2.toFixed(3)];
      if (requiresLength && m.length) {
        return [...base, m.length.toFixed(2), m.volume.toFixed(2), m.volumeInches.toFixed(3), m.widthQuality, m.heightQuality];
      }
      return [...base, m.widthQuality, m.heightQuality];
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

  const getCurrentPreviewImage = (mode, original, processed, edges) => {
    if (mode === 'grayscale') return processed || original;
    if (mode === 'edges') return edges || original;
    return original;
  };

  const startNewMeasurement = () => {
    setCurrentStep(1);
    setTopCameraImage(null);
    setSideCameraImage(null);
    setTopImageFile(null);
    setSideImageFile(null);
    setLengthInput('');
    setFinalMeasurement(null);
    setError(null);
  };

  return (
    <div className="fixed inset-0 flex flex-col h-screen w-screen bg-gray-900">
      <div className="flex items-center px-3 py-1.5 bg-gray-800 fixed top-0 left-0 right-0 z-10">
        <button type="button" onClick={onPreviousTest} className="bg-transparent border-none text-gray-200 text-2xl cursor-pointer p-1.5 hover:text-blue-400 transition-colors">←</button>
        <span className="ml-4 text-gray-100 text-lg font-semibold">TimberMach | Dual-Camera ({testType.charAt(0).toUpperCase() + testType.slice(1)})</span>
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
                  <div><label className="block text-sm font-medium text-gray-300 mb-2"><Focus className="w-4 h-4 inline mr-2" />Calibration</label><div className="text-white text-sm bg-gray-700 px-3 py-2 rounded-lg">{calibrationFactor.toFixed(6)} mm/px</div></div>
                  {requiresLength && (<div><label className="block text-sm font-medium text-gray-300 mb-2"><Ruler className="w-4 h-4 inline mr-2" />Length (in, max 12")</label><input type="number" step="0.001" max="12" value={lengthInput} onChange={(e) => setLengthInput(e.target.value)} placeholder="Enter length" className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500" /></div>)}
                  <div className="flex items-end gap-2"><button type="button" onClick={() => setShowCalibration(true)} className="flex-1 px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors flex items-center justify-center"><Settings className="w-4 h-4 mr-1" />Calibrate</button><button type="button" onClick={() => setShowAdjustments(!showAdjustments)} className={`flex-1 px-3 py-2 text-white rounded-lg transition-colors flex items-center justify-center ${showAdjustments ? 'bg-purple-600 hover:bg-purple-700' : 'bg-gray-600 hover:bg-gray-700'}`}><Sliders className="w-4 h-4 mr-1" />Adjust</button></div>
                </div>
                {showAdjustments && (<div className="bg-gray-700 rounded-lg p-4 mb-4"><h4 className="text-white font-semibold mb-3 flex items-center"><Sliders className="w-4 h-4 mr-2" />Image Processing<span className="ml-3 text-xs text-green-400 font-normal">⚡ Live Preview</span></h4><div className="grid grid-cols-1 md:grid-cols-3 gap-4"><div><label className="block text-sm font-medium text-gray-300 mb-2">Threshold: {threshold}</label><input type="range" min="180" max="250" value={threshold} onChange={(e) => setThreshold(parseInt(e.target.value))} disabled={!topImageFile && !sideImageFile} className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer slider-thumb disabled:opacity-50" /></div><div><label className="block text-sm font-medium text-gray-300 mb-2">Smoothing: {sigma.toFixed(1)}</label><input type="range" min="0.5" max="3.0" step="0.1" value={sigma} onChange={(e) => setSigma(parseFloat(e.target.value))} disabled={!topImageFile && !sideImageFile} className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer slider-thumb disabled:opacity-50" /></div><div><label className="block text-sm font-medium text-gray-300 mb-2">Contrast: {contrastFactor.toFixed(1)}</label><input type="range" min="1.0" max="2.5" step="0.1" value={contrastFactor} onChange={(e) => setContrastFactor(parseFloat(e.target.value))} disabled={!topImageFile && !sideImageFile} className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer slider-thumb disabled:opacity-50" /></div></div><div className="mt-4"><label className="flex items-center text-white"><input type="checkbox" checked={useAdaptiveThreshold} onChange={(e) => setUseAdaptiveThreshold(e.target.checked)} disabled={!topImageFile && !sideImageFile} className="mr-2 w-4 h-4 disabled:opacity-50" /><span className="text-sm">Adaptive Thresholding</span></label></div><div className="mt-3 flex justify-end"><button type="button" onClick={() => { setThreshold(240); setSigma(2.0); setContrastFactor(1.5); setUseAdaptiveThreshold(false); }} className="px-3 py-1 bg-gray-600 text-white text-sm rounded hover:bg-gray-500">Reset</button></div></div>)}
                <div className="bg-blue-900 bg-opacity-30 border border-blue-700 rounded-lg p-3 mb-4">
                  <div className="text-sm text-blue-200">
                    <strong className="flex items-center"><Info className="w-4 h-4 mr-2" />{testType.charAt(0).toUpperCase() + testType.slice(1)} Test</strong>
                    <div className="mt-2 grid grid-cols-3 gap-4">
                      <div><div className="font-semibold text-blue-300">Top Camera → Width</div><div className="text-xs">Max 4" (101.6mm)</div></div>
                      <div><div className="font-semibold text-blue-300">Side Camera → Height</div><div className="text-xs">Max 4" (101.6mm)</div></div>
                      <div><div className="font-semibold text-green-300 flex items-center"><Maximize2 className="w-3 h-3 mr-1" />Auto Area = W × H</div><div className="text-xs">Calculated automatically</div></div>
                    </div>
                    {requiresLength ? (<div className="mt-2 text-xs text-yellow-300">⚠️ Length required (max 12") → Volume = W × H × L</div>) : (<div className="mt-2 text-xs text-green-300">✓ Length not required for {testType}</div>)}
                  </div>
                </div>
                <button type="button" onClick={performMeasurement} disabled={!topImageFile || !sideImageFile || (requiresLength && !lengthInput) || isProcessing} className={`w-full px-6 py-3 rounded-lg font-semibold transition-colors ${!topImageFile || !sideImageFile || (requiresLength && !lengthInput) || isProcessing ? 'bg-gray-600 text-gray-400 cursor-not-allowed' : 'bg-green-600 text-white hover:bg-green-700'}`}>{isProcessing ? (<span className="flex items-center justify-center"><RefreshCw className="w-5 h-5 mr-2 animate-spin" />Processing...</span>) : ('Perform Measurement')}</button>
              </div>
              {error && (<div className="bg-red-900 border border-red-700 text-red-200 px-4 py-3 rounded-lg mb-4"><strong>Error:</strong> {error}</div>)}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="bg-gray-800 rounded-lg p-4">
                  <div className="flex justify-between items-center mb-2"><h3 className="text-white font-semibold flex items-center"><Camera className="w-4 h-4 mr-2" />Top Camera - WIDTH</h3><div className="flex gap-2"><input ref={topFileInputRef} type="file" accept="image/*" onChange={handleTopCameraUpload} className="hidden" /><button type="button" onClick={() => topFileInputRef.current?.click()} className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 flex items-center"><Upload className="w-3 h-3 mr-1" />Upload</button></div></div>
                  {topCameraImage ? (<><div className="flex gap-1 mb-2"><button type="button" onClick={() => setTopPreviewMode('original')} className={`px-2 py-1 text-xs rounded ${topPreviewMode === 'original' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>Original</button><button type="button" onClick={() => setTopPreviewMode('grayscale')} disabled={!topProcessedImage} className={`px-2 py-1 text-xs rounded ${topPreviewMode === 'grayscale' ? 'bg-blue-600 text-white' : topProcessedImage ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-700 text-gray-500 cursor-not-allowed'}`}>Grayscale</button><button type="button" onClick={() => setTopPreviewMode('edges')} disabled={!topEdgeVisualization} className={`px-2 py-1 text-xs rounded ${topPreviewMode === 'edges' ? 'bg-blue-600 text-white' : topEdgeVisualization ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-700 text-gray-500 cursor-not-allowed'}`}>Edges</button></div><img src={getCurrentPreviewImage(topPreviewMode, topCameraImage, topProcessedImage, topEdgeVisualization)} alt="Top" className="w-full h-auto rounded-lg" /><div className="text-xs text-gray-400 mt-2 text-center">🟢 Green = Detected edges | 🔴 Red = Scan line</div></>) : (<div className="bg-gray-700 rounded-lg p-8 text-center"><Camera className="w-12 h-12 text-gray-500 mx-auto mb-2" /><p className="text-gray-400">Upload top camera image</p></div>)}
                </div>
                <div className="bg-gray-800 rounded-lg p-4">
                  <div className="flex justify-between items-center mb-2"><h3 className="text-white font-semibold flex items-center"><Camera className="w-4 h-4 mr-2" />Side Camera - HEIGHT</h3><div className="flex gap-2"><input ref={sideFileInputRef} type="file" accept="image/*" onChange={handleSideCameraUpload} className="hidden" /><button type="button" onClick={() => sideFileInputRef.current?.click()} className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 flex items-center"><Upload className="w-3 h-3 mr-1" />Upload</button></div></div>
                  {sideCameraImage ? (<><div className="flex gap-1 mb-2"><button type="button" onClick={() => setSidePreviewMode('original')} className={`px-2 py-1 text-xs rounded ${sidePreviewMode === 'original' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>Original</button><button type="button" onClick={() => setSidePreviewMode('grayscale')} disabled={!sideProcessedImage} className={`px-2 py-1 text-xs rounded ${sidePreviewMode === 'grayscale' ? 'bg-blue-600 text-white' : sideProcessedImage ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-700 text-gray-500 cursor-not-allowed'}`}>Grayscale</button><button type="button" onClick={() => setSidePreviewMode('edges')} disabled={!sideEdgeVisualization} className={`px-2 py-1 text-xs rounded ${sidePreviewMode === 'edges' ? 'bg-blue-600 text-white' : sideEdgeVisualization ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-700 text-gray-500 cursor-not-allowed'}`}>Edges</button></div><img src={getCurrentPreviewImage(sidePreviewMode, sideCameraImage, sideProcessedImage, sideEdgeVisualization)} alt="Side" className="w-full h-auto rounded-lg" /><div className="text-xs text-gray-400 mt-2 text-center">🟢 Green = Detected edges | 🔴 Red = Scan line</div></>) : (<div className="bg-gray-700 rounded-lg p-8 text-center"><Camera className="w-12 h-12 text-gray-500 mx-auto mb-2" /><p className="text-gray-400">Upload side camera image</p></div>)}
                </div>
              </div>
            </>
          )}
          {currentStep === 2 && finalMeasurement && (
            <>
              <div className="bg-gray-800 rounded-lg p-6 mb-4">
                <div className="flex justify-between items-center mb-6"><h3 className="text-white text-2xl font-bold flex items-center"><Check className="w-6 h-6 mr-2 text-green-400" />Measurement Complete<span className="ml-3 px-3 py-1 bg-blue-600 text-white text-sm rounded-full">#{finalMeasurement.id}</span></h3><button type="button" onClick={startNewMeasurement} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">New Measurement</button></div>
                <div className={`grid grid-cols-1 md:grid-cols-2 ${requiresLength ? 'lg:grid-cols-4' : 'lg:grid-cols-3'} gap-4`}>
                  <div className="bg-gray-700 rounded-lg p-4"><div className="text-gray-400 text-sm mb-1">Width (Top)</div><div className="text-green-400 text-2xl font-bold">{finalMeasurement.width.toFixed(2)} mm</div><div className="text-gray-300 text-base mt-1">{finalMeasurement.widthInches}"</div><div className="text-xs text-gray-400 mt-1">{finalMeasurement.widthPixels.toFixed(0)} px | Q: {finalMeasurement.widthQuality}/10</div></div>
                  <div className="bg-gray-700 rounded-lg p-4"><div className="text-gray-400 text-sm mb-1">Height (Side)</div><div className="text-green-400 text-2xl font-bold">{finalMeasurement.height.toFixed(2)} mm</div><div className="text-gray-300 text-base mt-1">{finalMeasurement.heightInches}"</div><div className="text-xs text-gray-400 mt-1">{finalMeasurement.heightPixels.toFixed(0)} px | Q: {finalMeasurement.heightQuality}/10</div></div>
                  <div className="bg-purple-900 bg-opacity-50 rounded-lg p-4"><div className="text-gray-400 text-sm mb-1 flex items-center"><Maximize2 className="w-3 h-3 mr-1" />Area (W × H)</div><div className="text-purple-400 text-2xl font-bold">{finalMeasurement.areaMM2.toFixed(2)} mm²</div><div className="text-gray-300 text-base mt-1">{finalMeasurement.areaIN2.toFixed(3)} in²</div><div className="text-xs text-gray-400 mt-1">{finalMeasurement.areaPixels.toFixed(0)} px²</div></div>
                  {requiresLength && (<div className="bg-gray-700 rounded-lg p-4"><div className="text-gray-400 text-sm mb-1">Length (Manual)</div><div className="text-green-400 text-2xl font-bold">{finalMeasurement.length.toFixed(2)} mm</div><div className="text-gray-300 text-base mt-1">{finalMeasurement.lengthInches}"</div><div className="text-xs text-gray-400 mt-1">Manual input</div></div>)}
                  {requiresLength && (<div className="bg-blue-900 bg-opacity-50 rounded-lg p-4 md:col-span-2 lg:col-span-4"><div className="text-gray-400 text-sm mb-1">Volume (W × H × L)</div><div className="text-blue-400 text-3xl font-bold">{finalMeasurement.volume.toFixed(2)} mm³</div><div className="text-gray-300 text-xl mt-1">{finalMeasurement.volumeInches.toFixed(3)} in³</div></div>)}
                </div>
                <div className="mt-6 bg-gray-700 rounded-lg p-4"><div className="text-sm text-gray-300"><div className="grid grid-cols-2 gap-4"><div><span className="text-gray-400">Test Type:</span><span className="text-white ml-2 capitalize">{finalMeasurement.testType}</span></div><div><span className="text-gray-400">Calibration:</span><span className="text-white ml-2">{finalMeasurement.calibrationFactor.toFixed(6)} mm/px</span></div><div><span className="text-gray-400">Timestamp:</span><span className="text-white ml-2">{finalMeasurement.timestamp.toLocaleString()}</span></div><div><span className="text-gray-400">Cross-Section:</span><span className="text-white ml-2">{finalMeasurement.areaMM2.toFixed(2)} mm²</span></div></div></div></div>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4"><div className="bg-gray-800 rounded-lg p-4"><h4 className="text-white font-semibold mb-2">Width Measurement</h4><img src={topEdgeVisualization || topCameraImage} alt="W" className="w-full h-auto rounded-lg" /></div><div className="bg-gray-800 rounded-lg p-4"><h4 className="text-white font-semibold mb-2">Height Measurement</h4><img src={sideEdgeVisualization || sideCameraImage} alt="H" className="w-full h-auto rounded-lg" /></div></div>
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
      {showCalibration && (<div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"><div className="bg-gray-800 rounded-lg max-w-2xl w-full p-6"><h3 className="text-white text-xl font-semibold mb-4">Calibration Settings</h3><div className="mb-4"><label className="flex items-center text-white mb-2"><input type="checkbox" checked={useCameraCalibration} onChange={(e) => setUseCameraCalibration(e.target.checked)} className="mr-2" />Use Camera Parameters</label></div>{useCameraCalibration ? (<div className="grid grid-cols-2 gap-4 mb-4"><div><label className="block text-gray-300 text-sm mb-1">Distance (mm)</label><input type="number" value={cameraDistance} onChange={(e) => setCameraDistance(parseFloat(e.target.value))} className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600" /></div><div><label className="block text-gray-300 text-sm mb-1">Focal (mm)</label><input type="number" step="0.1" value={focalLength} onChange={(e) => setFocalLength(parseFloat(e.target.value))} className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600" /></div><div><label className="block text-gray-300 text-sm mb-1">Sensor (mm)</label><input type="number" step="0.1" value={sensorWidth} onChange={(e) => setSensorWidth(parseFloat(e.target.value))} className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600" /></div><div><label className="block text-gray-300 text-sm mb-1">Image (px)</label><input type="number" value={imageWidth} onChange={(e) => setImageWidth(parseInt(e.target.value))} className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600" /></div></div>) : (<div className="grid grid-cols-2 gap-4 mb-4"><div><label className="block text-gray-300 text-sm mb-1">Ref Width (px)</label><input type="number" value={referencePixels} onChange={(e) => setReferencePixels(parseFloat(e.target.value))} className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600" /></div><div><label className="block text-gray-300 text-sm mb-1">Ref Width (mm)</label><input type="number" step="0.1" value={referenceMillimeters} onChange={(e) => setReferenceMillimeters(parseFloat(e.target.value))} className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600" /></div></div>)}<div className="flex justify-end gap-2"><button type="button" onClick={() => setShowCalibration(false)} className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700">Cancel</button><button type="button" onClick={calculateCalibrationFactor} className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">Apply</button></div></div></div>)}
      <style jsx>{`.slider-thumb::-webkit-slider-thumb{appearance:none;width:16px;height:16px;border-radius:50%;background:#3b82f6;cursor:pointer}.slider-thumb::-moz-range-thumb{width:16px;height:16px;border-radius:50%;background:#3b82f6;cursor:pointer;border:none}`}</style>
    </div>
  );
};

export default Measurement;