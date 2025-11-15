/**
 * MeasurementUtils.js
 * API connection utilities for Python backend measurement system
 * This file handles all communication with the Flask backend
 */

// API Configuration
const API_CONFIG = {
  BASE_URL: 'http://localhost:5000',
  ENDPOINTS: {
    MEASURE: '/measure',
    CALIBRATE: '/calculate-calibration',
    SCAN_NUMBER: '/scan-number',
    HEALTH: '/health'
  },
  TIMEOUT: 30000 // 30 seconds
};

/**
 * Check if the backend server is healthy
 * @returns {Promise<Object>} Health status
 */
export const checkBackendHealth = async () => {
  try {
    const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.HEALTH}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Backend server is not responding');
    }

    return await response.json();
  } catch (error) {
    console.error('Backend health check failed:', error);
    throw new Error('Cannot connect to measurement server. Please ensure the Python backend is running on port 5000.');
  }
};

/**
 * Measure wood dimensions using Python backend
 * @param {File} imageFile - The image file to measure
 * @param {string} mode - Measurement mode ('width', 'height', 'length', 'area')
 * @param {number} calibrationFactor - Calibration factor in mm/pixel
 * @returns {Promise<Object>} Measurement results
 */
export const measureWoodDimensions = async (imageFile, mode = 'width', calibrationFactor = 0.0145503) => {
  try {
    // Validate inputs
    if (!imageFile) {
      throw new Error('No image file provided');
    }

    if (!['width', 'height', 'length', 'area'].includes(mode)) {
      throw new Error('Invalid measurement mode');
    }

    if (calibrationFactor <= 0) {
      throw new Error('Calibration factor must be positive');
    }

    // Prepare form data
    const formData = new FormData();
    formData.append('image', imageFile);
    formData.append('mode', mode);
    formData.append('calibrationFactor', calibrationFactor.toString());

    // Send request with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.TIMEOUT);

    const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.MEASURE}`, {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // Parse response
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || `HTTP error! status: ${response.status}`);
    }

    if (!data.success) {
      throw new Error(data.error || 'Measurement failed');
    }

    return data;

  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('Measurement request timed out. The image may be too large or the server is overloaded.');
    }
    
    console.error('Measurement error:', error);
    throw error;
  }
};

/**
 * Measure wood dimensions using base64 encoded image (alternative method)
 * @param {string} base64Image - Base64 encoded image data
 * @param {string} mode - Measurement mode
 * @param {number} calibrationFactor - Calibration factor in mm/pixel
 * @returns {Promise<Object>} Measurement results
 */
export const measureWoodDimensionsBase64 = async (base64Image, mode = 'width', calibrationFactor = 0.0145503) => {
  try {
    const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.MEASURE}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        image: base64Image,
        mode,
        calibrationFactor
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || `HTTP error! status: ${response.status}`);
    }

    if (!data.success) {
      throw new Error(data.error || 'Measurement failed');
    }

    return data;

  } catch (error) {
    console.error('Measurement error:', error);
    throw error;
  }
};

/**
 * Calculate calibration factor based on camera parameters
 * @param {Object} params - Calibration parameters
 * @param {number} params.cameraDistance - Distance from camera to object (mm)
 * @param {number} params.focalLength - Camera focal length (mm)
 * @param {number} params.sensorWidth - Camera sensor width (mm)
 * @param {number} params.imageWidth - Image width in pixels
 * @returns {Promise<Object>} Calibration result with factor
 */
export const calculateCameraCalibration = async ({ cameraDistance, focalLength, sensorWidth, imageWidth }) => {
  try {
    const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.CALIBRATE}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        method: 'camera',
        cameraDistance,
        focalLength,
        sensorWidth,
        imageWidth
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Calibration calculation failed');
    }

    if (!data.success) {
      throw new Error(data.error || 'Calibration failed');
    }

    return data;

  } catch (error) {
    console.error('Calibration error:', error);
    throw error;
  }
};

/**
 * Calculate calibration factor based on manual reference measurement
 * @param {Object} params - Calibration parameters
 * @param {number} params.referencePixels - Known reference width in pixels
 * @param {number} params.referenceMillimeters - Known reference width in mm
 * @returns {Promise<Object>} Calibration result with factor
 */
export const calculateManualCalibration = async ({ referencePixels, referenceMillimeters }) => {
  try {
    if (referencePixels <= 0) {
      throw new Error('Reference pixels must be positive');
    }

    if (referenceMillimeters <= 0) {
      throw new Error('Reference millimeters must be positive');
    }

    const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.CALIBRATE}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        method: 'manual',
        referencePixels,
        referenceMillimeters
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Calibration calculation failed');
    }

    if (!data.success) {
      throw new Error(data.error || 'Calibration failed');
    }

    return data;

  } catch (error) {
    console.error('Calibration error:', error);
    throw error;
  }
};

/**
 * Scan a number from an image using OCR
 * @param {File} imageFile - The image file containing the number
 * @returns {Promise<Object>} OCR result with recognized number
 */
export const scanNumberFromImage = async (imageFile) => {
  try {
    if (!imageFile) {
      throw new Error('No image file provided');
    }

    const formData = new FormData();
    formData.append('image', imageFile);

    const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.SCAN_NUMBER}`, {
      method: 'POST',
      body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'OCR failed');
    }

    if (!data.success) {
      throw new Error(data.error || 'No number recognized');
    }

    return data;

  } catch (error) {
    console.error('OCR error:', error);
    throw error;
  }
};

/**
 * Convert a File object to base64 string
 * @param {File} file - File to convert
 * @returns {Promise<string>} Base64 encoded string
 */
export const fileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
};

/**
 * Calculate measurement statistics from an array of measurements
 * @param {Array<number>} values - Array of measurement values
 * @returns {Object} Statistics (mean, stdDev, min, max, etc.)
 */
export const calculateMeasurementStatistics = (values) => {
  if (!values || values.length === 0) {
    return null;
  }

  const n = values.length;
  const mean = values.reduce((sum, val) => sum + val, 0) / n;
  
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / n;
  const stdDev = Math.sqrt(variance);
  
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;
  
  const coefficientOfVariation = (stdDev / mean) * 100;

  return {
    count: n,
    mean,
    stdDev,
    variance,
    min,
    max,
    range,
    coefficientOfVariation
  };
};

/**
 * Export measurements to CSV format
 * @param {Array<Object>} measurements - Array of measurement objects
 * @param {string} filename - Filename for the CSV
 * @returns {string} CSV content
 */
export const exportMeasurementsAsCSV = (measurements, filename = 'measurements') => {
  if (!measurements || measurements.length === 0) {
    throw new Error('No measurements to export');
  }

  // Define CSV headers
  const headers = [
    'ID',
    'Timestamp',
    'Mode',
    'Pixel Measurement',
    'Millimeter Measurement',
    'Unit',
    'Quality Score',
    'Calibration Method',
    'Calibration Factor',
    'Camera Distance (mm)'
  ];

  // Convert measurements to CSV rows
  const rows = measurements.map(m => [
    m.id,
    m.timestamp.toISOString(),
    m.mode,
    m.pixelMeasurement,
    m.millimeterMeasurement,
    m.displayUnit || 'mm',
    m.edgeQuality,
    m.calibrationMethod || 'Unknown',
    m.calibrationFactor,
    m.cameraDistance || 'N/A'
  ]);

  // Combine headers and rows
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => {
      // Escape cells that contain commas or quotes
      if (typeof cell === 'string' && (cell.includes(',') || cell.includes('"'))) {
        return `"${cell.replace(/"/g, '""')}"`;
      }
      return cell;
    }).join(','))
  ].join('\n');

  return csvContent;
};

/**
 * Download CSV file
 * @param {string} csvContent - CSV content
 * @param {string} filename - Filename without extension
 */
export const downloadCSV = (csvContent, filename = 'measurements') => {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * Visualize measurement on canvas (for debugging)
 * @param {HTMLCanvasElement} canvas - Canvas element
 * @param {Object} edgeResults - Edge detection results
 * @param {string} mode - Measurement mode
 */
export const visualizeMeasurement = (canvas, edgeResults, mode) => {
  if (!canvas || !edgeResults) return;

  const ctx = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;

  // Draw scan lines
  ctx.strokeStyle = 'rgba(255, 0, 0, 0.7)';
  ctx.lineWidth = 2;

  if (mode === 'width' || mode === 'length') {
    // Draw horizontal scan line
    if (edgeResults.scanLine !== undefined) {
      ctx.beginPath();
      ctx.moveTo(0, edgeResults.scanLine);
      ctx.lineTo(width, edgeResults.scanLine);
      ctx.stroke();
    }

    // Draw detected edges
    ctx.strokeStyle = 'rgba(0, 255, 0, 1)';
    ctx.lineWidth = 3;

    if (edgeResults.leftEdge !== undefined) {
      ctx.beginPath();
      ctx.moveTo(edgeResults.leftEdge, 0);
      ctx.lineTo(edgeResults.leftEdge, height);
      ctx.stroke();
    }

    if (edgeResults.rightEdge !== undefined) {
      ctx.beginPath();
      ctx.moveTo(edgeResults.rightEdge, 0);
      ctx.lineTo(edgeResults.rightEdge, height);
      ctx.stroke();
    }
  }

  if (mode === 'height' || mode === 'length') {
    // Draw vertical scan line
    if (edgeResults.scanLine !== undefined) {
      ctx.beginPath();
      ctx.moveTo(edgeResults.scanLine, 0);
      ctx.lineTo(edgeResults.scanLine, height);
      ctx.stroke();
    }

    // Draw detected edges
    ctx.strokeStyle = 'rgba(0, 255, 0, 1)';
    ctx.lineWidth = 3;

    if (edgeResults.topEdge !== undefined) {
      ctx.beginPath();
      ctx.moveTo(0, edgeResults.topEdge);
      ctx.lineTo(width, edgeResults.topEdge);
      ctx.stroke();
    }

    if (edgeResults.bottomEdge !== undefined) {
      ctx.beginPath();
      ctx.moveTo(0, edgeResults.bottomEdge);
      ctx.lineTo(width, edgeResults.bottomEdge);
      ctx.stroke();
    }
  }

  // Add measurement text
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.fillRect(width - 200, 10, 190, 60);

  ctx.font = '14px Arial';
  ctx.fillStyle = 'rgba(255, 255, 255, 1)';

  if (edgeResults.widthPixels !== undefined) {
    ctx.fillText(`Width: ${edgeResults.widthPixels.toFixed(1)}px`, width - 190, 30);
  }
  if (edgeResults.heightPixels !== undefined) {
    ctx.fillText(`Height: ${edgeResults.heightPixels.toFixed(1)}px`, width - 190, 50);
  }
  ctx.fillText(`Quality: ${Math.round(edgeResults.strength / 50)}/10`, width - 190, 70);
};

// Default export object with all utilities
export default {
  checkBackendHealth,
  measureWoodDimensions,
  measureWoodDimensionsBase64,
  calculateCameraCalibration,
  calculateManualCalibration,
  scanNumberFromImage,
  fileToBase64,
  calculateMeasurementStatistics,
  exportMeasurementsAsCSV,
  downloadCSV,
  visualizeMeasurement,
  API_CONFIG
};