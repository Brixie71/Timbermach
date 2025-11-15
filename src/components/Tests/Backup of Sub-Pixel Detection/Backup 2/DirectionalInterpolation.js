/**
 * Directional Interpolation Utilities
 * 
 * This module provides functions for gradient-based directional
 * interpolation to enhance edge information for sub-pixel detection.
 */

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
    
    // Improved bilinear interpolation formula with better handling of edge cases
    return (1 - dx) * (1 - dy) * neighborhood[y0][x0] +
           dx * (1 - dy) * neighborhood[y0][x1] +
           (1 - dx) * dy * neighborhood[y1][x0] +
           dx * dy * neighborhood[y1][x1];
  };
  
  /**
   * Interpolate a neighborhood along the gradient direction
   * @param {Array} neighborhood - 7x7 neighborhood of pixel values
   * @param {number} gradX - X component of gradient
   * @param {number} gradY - Y component of gradient
   * @param {number} factor - Interpolation factor
   * @returns {Array} Interpolated neighborhood
   */
  export const interpolateNeighborhoodAlongGradient = (neighborhood, gradX, gradY, factor = 3) => {
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
   * Simple bilinear interpolation for grayscale values (2D image)
   * @param {Array} data - 2D array of grayscale values
   * @param {number} x - X coordinate to sample (can be fractional)
   * @param {number} y - Y coordinate to sample (can be fractional)
   * @returns {number} Interpolated value
   */
  export const bilinearInterpolate = (data, x, y) => {
    // For simplicity, we'll use nearest neighbor if out of bounds
    const ix = Math.round(x);
    const iy = Math.round(y);
    
    if (ix < 0 || ix >= data.length || iy < 0 || iy >= data[0].length) {
      return 0; // Out of bounds
    }
    
    return data[ix][iy];
  };
  
  /**
   * Perform edge gradient directional interpolation to enhance accuracy
   * @param {Array} profileData - Array of grayscale values
   * @param {number} gradX - X component of gradient
   * @param {number} gradY - Y component of gradient
   * @param {number} factor - Interpolation factor
   * @returns {Array} Interpolated profile data
   */
  export const gradientDirectionalInterpolation = (profileData, gradX, gradY, factor = 3) => {
    // Calculate gradient direction (perpendicular to edge)
    const magnitude = Math.sqrt(gradX * gradX + gradY * gradY);
    if (magnitude === 0) return profileData;
    
    // Normalize gradient
    const normalizedGradX = gradX / magnitude;
    const normalizedGradY = gradY / magnitude;
    
    // Create interpolated data by sampling along gradient direction
    const interpolatedData = [...profileData];
    const interpolationStep = 1.0 / factor;
    
    for (let i = 1; i <= factor; i++) {
      const step = i * interpolationStep;
      
      // Sample in positive direction
      interpolatedData.push(bilinearInterpolate(profileData, step * normalizedGradX, step * normalizedGradY));
      
      // Sample in negative direction
      interpolatedData.push(bilinearInterpolate(profileData, -step * normalizedGradX, -step * normalizedGradY));
    }
    
    return interpolatedData;
  };
  
  /**
   * Enhance gradient information through directional sampling
   * @param {Uint8ClampedArray} imageData - Original image data
   * @param {number} width - Image width
   * @param {number} height - Image height
   * @param {Object} edgePoint - Edge point with x, y, and gradient information
   * @param {number} factor - Sampling factor
   * @returns {Object} Enhanced edge point information
   */
  export const enhanceEdgeGradient = (imageData, width, height, edgePoint, factor = 3) => {
    const { x, y, gradX, gradY } = edgePoint;
    
    // Create gradient profile perpendicular to edge
    const profile = [];
    const maxDistance = Math.floor(factor / 2);
    
    // Normalize gradient
    const magnitude = Math.sqrt(gradX * gradX + gradY * gradY);
    if (magnitude < 0.0001) return edgePoint;
    
    const normalizedGradX = gradX / magnitude;
    const normalizedGradY = gradY / magnitude;
    
    // Sample perpendicular to edge
    for (let d = -maxDistance; d <= maxDistance; d++) {
      const sampleX = Math.round(x + d * normalizedGradY);
      const sampleY = Math.round(y - d * normalizedGradX);
      
      if (sampleX >= 0 && sampleX < width && sampleY >= 0 && sampleY < height) {
        const idx = (sampleY * width + sampleX) * 4;
        profile.push(imageData[idx]);
      } else {
        profile.push(0);
      }
    }
    
    // Interpolate profile
    const enhancedProfile = [];
    const step = 1.0 / factor;
    
    for (let i = 0; i < profile.length - 1; i++) {
      enhancedProfile.push(profile[i]);
      
      // Add interpolated points
      for (let j = 1; j < factor; j++) {
        const t = j * step;
        enhancedProfile.push(profile[i] * (1 - t) + profile[i + 1] * t);
      }
    }
    
    // Add last point
    enhancedProfile.push(profile[profile.length - 1]);
    
    return {
      ...edgePoint,
      profile: enhancedProfile,
      enhancedGradX: normalizedGradX * magnitude * 1.5, // Enhance gradient
      enhancedGradY: normalizedGradY * magnitude * 1.5
    };
  };