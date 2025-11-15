/**
 * Edge Model Utilities
 * 
 * This module provides utilities for edge modeling and parameter extraction
 * based on the Zernike moment method for sub-pixel edge detection.
 */

import { 
    ZERPOLY00, ZERPOLY11R, ZERPOLY11I, ZERPOLY20, ZERPOLY40,
    DEFAULT_THRESHOLDS
  } from './ZernikeConstants';
  
  /**
   * Extract a 7x7 neighborhood around a pixel from image data
   * @param {Uint8ClampedArray} imageData - Raw image data
   * @param {number} width - Image width
   * @param {number} x - Center pixel x coordinate
   * @param {number} y - Center pixel y coordinate
   * @returns {Array} 7x7 array of pixel values
   */
  export const extract7x7Neighborhood = (imageData, width, x, y) => {
    const neighborhood = Array(7).fill().map(() => Array(7).fill(0));
    
    for (let dy = -3; dy <= 3; dy++) {
      for (let dx = -3; dx <= 3; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        
        if (nx >= 0 && nx < width && ny >= 0 && ny < imageData.height) {
          const idx = (ny * width + nx) * 4;
          neighborhood[dy + 3][dx + 3] = imageData[idx]; // Use red channel for grayscale
        }
      }
    }
    
    return neighborhood;
  };
  
  /**
   * Apply a Zernike mask to a neighborhood of pixels
   * @param {Array} neighborhood - 7x7 neighborhood of pixel values
   * @param {Array} mask - 7x7 Zernike polynomial mask
   * @returns {number} Result of applying the mask
   */
  export const applyMask = (neighborhood, mask) => {
    let sum = 0;
    
    for (let y = 0; y < 7; y++) {
      for (let x = 0; x < 7; x++) {
        sum += neighborhood[y][x] * mask[y][x];
      }
    }
    
    return sum;
  };
  
  /**
   * Calculate Zernike moments for a neighborhood of pixels
   * @param {Array} neighborhood - 7x7 neighborhood of pixel values
   * @returns {Object} Object containing the Zernike moments
   */
  export const calculateZernikeMoments = (neighborhood) => {
    const Z00 = applyMask(neighborhood, ZERPOLY00);
    const Z11R = applyMask(neighborhood, ZERPOLY11R);
    const Z11I = applyMask(neighborhood, ZERPOLY11I);
    const Z20 = applyMask(neighborhood, ZERPOLY20);
    const Z40 = applyMask(neighborhood, ZERPOLY40);
    
    return { Z00, Z11R, Z11I, Z20, Z40 };
  };
  
  /**
   * Calculate sub-pixel edge parameters using Zernike moments
   * @param {Array} neighborhood - 7x7 neighborhood of pixel values
   * @returns {Object} Edge parameters: phi (orientation), l (distance), k (contrast), h (background)
   */
  export const calculateEdgeParameters = (neighborhood) => {
    // Calculate Zernike moments
    const { Z00, Z11R, Z11I, Z20, Z40 } = calculateZernikeMoments(neighborhood);
    
    // Calculate edge orientation
    const phi = Math.atan2(Z11I, Z11R);
    
    // Calculate edge distance from center using improved method
    // This formula combines both estimators for better accuracy
    const l1 = Math.sqrt((5 * Z40 + 3 * Z20) / (8 * Z20));
    const l2 = Math.sqrt((5 * Z11R * Z11R + Z11I * Z11I) / (6 * Z11I));
    const l = (l1 + l2) / 2;
    
    // Calculate edge contrast
    const k = (3 * Z11I) / (2 * Math.pow(1 - l * l, 1.5));
    
    // Calculate background level
    const h = (1/Math.PI) * (Z00 - (k * Math.PI / 2) + k * Math.asin(l) + k * l * Math.sqrt(1 - l * l));
    
    return { phi, l, k, h };
  };
  
  /**
   * Validate edge parameters against thresholds
   * @param {Object} params - Edge parameters
   * @param {Object} thresholds - Threshold values for validation
   * @returns {boolean} True if edge parameters are valid
   */
  export const validateEdgeParameters = (params, thresholds = DEFAULT_THRESHOLDS) => {
    const { l, k } = params;
    
    // Distance should be less than threshold
    // Contrast should be greater than threshold
    return l <= thresholds.DISTANCE && k >= thresholds.CONTRAST;
  };
  
  /**
   * Calculate sub-pixel coordinates from edge parameters
   * @param {number} x - Original x coordinate
   * @param {number} y - Original y coordinate
   * @param {number} l - Distance from center
   * @param {number} phi - Edge orientation
   * @returns {Object} Sub-pixel coordinates
   */
  export const calculateSubPixelCoordinates = (x, y, l, phi) => {
    // Scale l by 3.5 (7/2) to convert from unit circle to pixel coordinates
    const scaledL = l * 3.5;
    
    // Calculate sub-pixel offsets
    const xOffset = scaledL * Math.cos(phi);
    const yOffset = scaledL * Math.sin(phi);
    
    // Calculate sub-pixel coordinates
    return {
      subpixelX: x + xOffset,
      subpixelY: y + yOffset
    };
  };