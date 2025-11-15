/**
 * Zernike Moment-based Sub-pixel Edge Detection
 * 
 * This module implements the Zernike moment method for sub-pixel edge detection
 * based on the paper "Subpixel Edge Detection Based on Edge Gradient 
 * Directional Interpolation and Zernike moment"
 */

// Define Zernike polynomials constants
const ZERPOLY00 = [
    [0, 0.0287, 0.0686, 0.0807, 0.0686, 0.0287, 0],
    [0.0287, 0.0815, 0.0816, 0.0816, 0.0816, 0.0815, 0.0287],
    [0.0686, 0.0816, 0.0816, 0.0816, 0.0816, 0.0816, 0.0686],
    [0.0807, 0.0816, 0.0816, 0.0816, 0.0816, 0.0816, 0.0807],
    [0.0686, 0.0816, 0.0816, 0.0816, 0.0816, 0.0816, 0.0686],
    [0.0287, 0.0815, 0.0816, 0.0816, 0.0816, 0.0815, 0.0287],
    [0, 0.0287, 0.0686, 0.0807, 0.0686, 0.0287, 0]
  ];
  
  const ZERPOLY11R = [
    [0, -0.015, -0.019, 0, 0.019, 0.015, 0],
    [-0.0224, -0.0466, -0.0233, 0, 0.0233, 0.0466, 0.0224],
    [-0.0573, -0.0466, -0.0233, 0, 0.0233, 0.0466, 0.0573],
    [-0.069, -0.0466, -0.0233, 0, 0.0233, 0.0466, 0.069],
    [-0.0573, -0.0466, -0.0233, 0, 0.0233, 0.0466, 0.0573],
    [-0.0224, -0.0466, -0.0233, 0, 0.0233, 0.0466, 0.0224],
    [0, -0.015, -0.019, 0, 0.019, 0.015, 0]
  ];
  
  const ZERPOLY11I = [
    [0, -0.0224, -0.0573, -0.069, -0.0573, -0.0224, 0],
    [-0.015, -0.0466, -0.0466, -0.0466, -0.0466, -0.0466, -0.015],
    [-0.019, -0.0233, -0.0233, -0.0233, -0.0233, -0.0233, -0.019],
    [0, 0, 0, 0, 0, 0, 0],
    [0.019, 0.0233, 0.0233, 0.0233, 0.0233, 0.0233, 0.019],
    [0.015, 0.0466, 0.0466, 0.0466, 0.0466, 0.0466, 0.015],
    [0, 0.0224, 0.0573, 0.069, 0.0573, 0.0224, 0]
  ];
  
  const ZERPOLY20 = [
    [0, 0.0225, 0.0394, 0.0396, 0.0394, 0.0225, 0],
    [0.0225, 0.0271, -0.0128, -0.0261, -0.0128, 0.0271, 0.0225],
    [0.0394, -0.0128, -0.0528, -0.0661, -0.0528, -0.0128, 0.0394],
    [0.0396, -0.0261, -0.0661, -0.0794, -0.0661, -0.0261, 0.0396],
    [0.0394, -0.0128, -0.0528, -0.0661, -0.0528, -0.0128, 0.0394],
    [0.0225, 0.0271, -0.0128, -0.0261, -0.0128, 0.0271, 0.0225],
    [0, 0.0225, 0.0394, 0.0396, 0.0394, 0.0225, 0]
  ];
  
  const ZERPOLY40 = [
    [0, 0.013, 0.0056, -0.0018, 0.0056, 0.013, 0],
    [0.0130, -0.0186, -0.0323, -0.0239, -0.0323, -0.0186, 0.0130],
    [0.0056, -0.0323, 0.0125, 0.0406, 0.0125, -0.0323, 0.0056],
    [-0.0018, -0.0239, 0.0406, 0.0751, 0.0406, -0.0239, -0.0018],
    [0.0056, -0.0323, 0.0125, 0.0406, 0.0125, -0.0323, 0.0056],
    [0.0130, -0.0186, -0.0323, -0.0239, -0.0323, -0.0186, 0.0130],
    [0, 0.013, 0.0056, -0.0018, 0.0056, 0.013, 0]
  ];
  
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
   * Extract a 7x7 neighborhood around a pixel from image data
   * @param {Uint8ClampedArray} imageData - Image data
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
   * Calculate sub-pixel edge parameters using Zernike moments
   * @param {Array} neighborhood - 7x7 neighborhood of pixel values
   * @returns {Object} Edge parameters: phi (orientation), l (distance), k (contrast), h (background)
   */
  export const calculateEdgeParameters = (neighborhood) => {
    // Calculate Zernike moments
    const { Z00, Z11R, Z11I, Z20, Z40 } = calculateZernikeMoments(neighborhood);
    
    // Calculate edge orientation
    const phi = Math.atan2(Z11I, Z11R);
    
    // Calculate edge distance from center
    const l1 = Math.sqrt((5 * Z40 + 3 * Z20) / (8 * Z20));
    const l2 = Math.sqrt((5 * Z11R + Z11I) / (6 * Z11I));
    const l = (l1 + l2) / 2;
    
    // Calculate edge contrast
    const k = (3 * Z11I) / (2 * Math.pow(1 - l * l, 1.5));
    
    // Calculate background level
    const h = (1/Math.PI) * (Z00 - (k * Math.PI / 2) + k * Math.asin(l) + k * l * Math.sqrt(1 - l * l));
    
    return { phi, l, k, h };
  };
  
  /**
   * Refine edge positions to sub-pixel accuracy using Zernike moments
   * @param {Array} edges - Array of edge points with pixel coordinates
   * @param {Uint8ClampedArray} imageData - Image data
   * @param {number} width - Image width
   * @param {number} height - Image height
   * @param {number} lThreshold - Distance threshold (0-0.5)
   * @param {number} kThreshold - Contrast threshold
   * @returns {Array} Refined edge points with sub-pixel coordinates
   */
  export const refineEdgesWithZernike = (edges, imageData, width, height, lThreshold = 0.4, kThreshold = 10) => {
    const refinedEdges = [];
    
    for (const edge of edges) {
      const { x, y } = edge;
      
      // Skip edge points too close to the image boundaries
      if (x < 3 || y < 3 || x >= width - 3 || y >= height - 3) continue;
      
      // Extract 7x7 neighborhood around the edge point
      const neighborhood = extract7x7Neighborhood(imageData, width, x, y);
      
      // Calculate edge parameters
    const { phi, l, k, h } = calculateEdgeParameters(neighborhood);
    
    // Filter edges based on parameters
    if (l <= lThreshold && k >= kThreshold) {
      // Calculate sub-pixel position
      const xOffset = l * Math.cos(phi);
      const yOffset = l * Math.sin(phi);
      
      // Store refined edge point with additional parameters
      refinedEdges.push({
        originalX: x,
        originalY: y,
        subpixelX: x + xOffset,
        subpixelY: y + yOffset,
        orientation: phi,
        distance: l,
        contrast: k,
        background: h
      });
    }
  }
  
  return refinedEdges;
};

/**
 * Apply gradient direction interpolation to improve edge detection
 * @param {Array} edges - Array of edge points with pixel coordinates
 * @param {Uint8ClampedArray} imageData - Image data
 * @param {number} width - Image width
 * @param {number} height - Image height
 * @param {number} interpolationFactor - Interpolation factor (default: 3)
 * @returns {Array} Enhanced edge points
 */
export const enhanceEdgesWithGradientInterpolation = (edges, imageData, width, height, interpolationFactor = 3) => {
  const enhancedEdges = [];
  
  for (const edge of edges) {
    const { x, y, gradX, gradY } = edge;
    
    // Skip edge points too close to the image boundaries
    if (x < 3 || y < 3 || x >= width - 3 || y >= height - 3) continue;
    
    // Extract 7x7 neighborhood around the edge point
    const neighborhood = extract7x7Neighborhood(imageData, width, x, y);
    
    // Interpolate along gradient direction
    const interpolatedNeighborhood = interpolateNeighborhoodAlongGradient(
      neighborhood, gradX, gradY, interpolationFactor
    );
    
    // Calculate edge parameters using Zernike moments on the interpolated neighborhood
    const { phi, l, k, h } = calculateEdgeParameters(interpolatedNeighborhood);
    
    // Calculate sub-pixel position
    const xOffset = l * Math.cos(phi);
    const yOffset = l * Math.sin(phi);
    
    // Store enhanced edge point
    enhancedEdges.push({
      originalX: x,
      originalY: y,
      subpixelX: x + xOffset,
      subpixelY: y + yOffset,
      orientation: phi,
      distance: l,
      contrast: k,
      background: h
    });
  }
  
  return enhancedEdges;
};

/**
 * Interpolate a neighborhood along the gradient direction
 * @param {Array} neighborhood - 7x7 neighborhood of pixel values
 * @param {number} gradX - X component of gradient
 * @param {number} gradY - Y component of gradient
 * @param {number} factor - Interpolation factor
 * @returns {Array} Interpolated neighborhood
 */
export const interpolateNeighborhoodAlongGradient = (neighborhood, gradX, gradY, factor) => {
  // Calculate gradient magnitude
  const magnitude = Math.sqrt(gradX * gradX + gradY * gradY);
  if (magnitude < 0.0001) return neighborhood;
  
  // Normalize gradient
  const normalizedGradX = gradX / magnitude;
  const normalizedGradY = gradY / magnitude;
  
  // Create interpolated neighborhood
  const interpolated = Array(7).fill().map(() => Array(7).fill(0));
  
  // Central position
  const centerX = 3;
  const centerY = 3;
  
  // Interpolate each position
  for (let y = 0; y < 7; y++) {
    for (let x = 0; x < 7; x++) {
      // Calculate interpolation position
      const offsetX = (x - centerX) / factor;
      const offsetY = (y - centerY) / factor;
      
      // Get position along gradient direction
      const sampleX = centerX + offsetX * normalizedGradX - offsetY * normalizedGradY;
      const sampleY = centerY + offsetX * normalizedGradY + offsetY * normalizedGradX;
      
      // Bilinear interpolation
      interpolated[y][x] = bilinearInterpolateNeighborhood(neighborhood, sampleX, sampleY);
    }
  }
  
  return interpolated;
};

/**
 * Bilinear interpolation for a point within a neighborhood
 * @param {Array} neighborhood - 7x7 neighborhood of pixel values
 * @param {number} x - X coordinate to sample (0-6)
 * @param {number} y - Y coordinate to sample (0-6)
 * @returns {number} Interpolated value
 */
export const bilinearInterpolateNeighborhood = (neighborhood, x, y) => {
  // Clamp coordinates to valid range
  const clampedX = Math.max(0, Math.min(6, x));
  const clampedY = Math.max(0, Math.min(6, y));
  
  // Get integer and fractional parts
  const x0 = Math.floor(clampedX);
  const y0 = Math.floor(clampedY);
  const x1 = Math.min(6, x0 + 1);
  const y1 = Math.min(6, y0 + 1);
  
  const dx = clampedX - x0;
  const dy = clampedY - y0;
  
  // Bilinear interpolation formula
  return (1 - dx) * (1 - dy) * neighborhood[y0][x0] +
         dx * (1 - dy) * neighborhood[y0][x1] +
         (1 - dx) * dy * neighborhood[y1][x0] +
         dx * dy * neighborhood[y1][x1];
};