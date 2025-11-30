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
    RECOGNIZE_SSD: '/recognize-ssd',
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
 * Recognize numbers from seven-segment display using computer vision
 * @param {File|string} image - Image file or base64 encoded image
 * @param {boolean} useTesseract - Whether to use Tesseract as fallback
 * @returns {Promise<Object>} Recognition results
 */
export const recognizeSevenSegmentDisplay = async (image, useTesseract = true) => {
  try {
    let isBase64 = typeof image === 'string';

    if (isBase64) {
      // Send as JSON with base64
      const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.RECOGNIZE_SSD}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image: image,
          useTesseract: useTesseract
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `HTTP error! status: ${response.status}`);
      }

      if (!data.success) {
        throw new Error(data.error || 'Recognition failed');
      }

      return data;
    } else {
      // Send as FormData with file
      const formData = new FormData();
      formData.append('image', image);
      formData.append('useTesseract', useTesseract.toString());

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.TIMEOUT);

      const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.RECOGNIZE_SSD}`, {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `HTTP error! status: ${response.status}`);
      }

      if (!data.success) {
        throw new Error(data.error || 'Recognition failed');
      }

      return data;
    }
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('Recognition request timed out. The image may be too large or the server is overloaded.');
    }
    
    console.error('SSD Recognition error:', error);
    throw error;
  }
};

/**
 * Capture frame from video element as base64
 * @param {HTMLVideoElement} videoElement - Video element to capture from
 * @returns {string|null} Base64 encoded image
 */
export const captureVideoFrame = (videoElement) => {
  if (!videoElement) return null;
  
  const canvas = document.createElement('canvas');
  canvas.width = videoElement.videoWidth;
  canvas.height = videoElement.videoHeight;
  
  const ctx = canvas.getContext('2d');
  ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
  
  return canvas.toDataURL('image/png');
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

// Export all utilities
export default {
  checkBackendHealth,
  recognizeSevenSegmentDisplay,
  captureVideoFrame,
  fileToBase64,
  API_CONFIG
};