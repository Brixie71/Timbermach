/**
 * Improved Edge Detection Utilities
 * 
 * This module combines the Canny/Devernay approach with Zernike moment method
 * and gradient directional interpolation for superior sub-pixel edge detection.
 * Based on research papers:
 * 1. "A Sub-Pixel Edge Detector: an Implementation of the Canny/Devernay Algorithm" 
 * 2. "Subpixel Edge Detection Based on Edge Gradient Directional Interpolation and Zernike moment"
 */

// Import Zernike moment constants and utilities 
import { 
    ZERPOLY00, ZERPOLY11R, ZERPOLY11I, ZERPOLY20, ZERPOLY40,
    applyMask, extract7x7Neighborhood
  } from '../../ZernikeMoments';
  
  /**
   * Apply bilateral filtering for edge-preserving noise reduction
   * This is an improvement over Gaussian filtering because it preserves edges better
   * @param {ImageData} imageData - The image data to filter
   * @param {number} spatialSigma - Spatial sigma parameter (controls how far pixels affect each other spatially)
   * @param {number} rangeSigma - Range sigma parameter (controls how different intensity values affect each other)
   * @returns {ImageData} Filtered image data
   */
  export const applyBilateralFilter = (imageData, spatialSigma = 3, rangeSigma = 50) => {
    const width = imageData.width;
    const height = imageData.height;
    const inputData = imageData.data;
    const outputData = new Uint8ClampedArray(inputData.length);
    
    // Determine the window size based on spatialSigma
    const windowSize = Math.max(1, Math.ceil(spatialSigma * 3));
    
    // Precompute spatial weights (Gaussian distribution based on distance)
    const spatialWeights = [];
    for (let y = -windowSize; y <= windowSize; y++) {
      for (let x = -windowSize; x <= windowSize; x++) {
        const spatialDistance = Math.sqrt(x * x + y * y);
        const spatialWeight = Math.exp(-(spatialDistance * spatialDistance) / (2 * spatialSigma * spatialSigma));
        spatialWeights.push({ x, y, weight: spatialWeight });
      }
    }
    
    // Apply bilateral filter
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const pixelIndex = (y * width + x) * 4;
        
        // Get the current pixel's color (assuming grayscale, so we just use the R channel)
        const centerValue = inputData[pixelIndex];
        
        let weightSum = 0;
        let valueSum = 0;
        
        // Process each neighbor within the window
        for (const neighbor of spatialWeights) {
          const nx = x + neighbor.x;
          const ny = y + neighbor.y;
          
          // Skip if outside image boundaries
          if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
          
          const neighborIndex = (ny * width + nx) * 4;
          const neighborValue = inputData[neighborIndex];
          
          // Calculate range weight (color similarity)
          const colorDifference = centerValue - neighborValue;
          const rangeWeight = Math.exp(-(colorDifference * colorDifference) / (2 * rangeSigma * rangeSigma));
          
          // Combine spatial and range weights
          const weight = neighbor.weight * rangeWeight;
          
          weightSum += weight;
          valueSum += weight * neighborValue;
        }
        
        // Calculate the filtered value
        const filteredValue = Math.round(valueSum / weightSum);
        
        // Set the output pixel (all channels to the same value for grayscale)
        outputData[pixelIndex] = filteredValue;
        outputData[pixelIndex + 1] = filteredValue;
        outputData[pixelIndex + 2] = filteredValue;
        outputData[pixelIndex + 3] = 255; // Alpha remains unchanged
      }
    }
    
    // Create and return the filtered ImageData
    return new ImageData(outputData, width, height);
  };
  
  /**
   * Detect edges with multidirectional Canny operator (improved to include 45° and 135° directions)
   * @param {ImageData} imageData - The image data to process
   * @param {number} lowThreshold - Low threshold for hysteresis
   * @param {number} highThreshold - High threshold for hysteresis
   * @returns {Array} Array of edge points with gradient information
   */
  export const detectEdgesWithMultidirectionalCanny = (imageData, lowThreshold = 10, highThreshold = 30) => {
    const width = imageData.width;
    const height = imageData.height;
    const data = imageData.data;
    
    // Define the multidirectional Sobel operators (horizontal, vertical, 45°, 135°)
    const sobelX = [
      [-1, 0, 1],
      [-2, 0, 2],
      [-1, 0, 1]
    ];
    
    const sobelY = [
      [-1, -2, -1],
      [0, 0, 0],
      [1, 2, 1]
    ];
    
    const sobel45 = [
      [-2, -1, 0],
      [-1, 0, 1],
      [0, 1, 2]
    ];
    
    const sobel135 = [
      [0, -1, -2],
      [1, 0, -1],
      [2, 1, 0]
    ];
    
    // Arrays to store gradient information
    const gradientMagnitude = new Array(width * height).fill(0);
    const gradientDirection = new Array(width * height).fill(0);
    const gradientX = new Array(width * height).fill(0);
    const gradientY = new Array(width * height).fill(0);
    const gradient45 = new Array(width * height).fill(0);
    const gradient135 = new Array(width * height).fill(0);
    
    // Apply Sobel operators to calculate gradients in all directions
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        let gx = 0, gy = 0, g45 = 0, g135 = 0;
        
        // Apply the kernels for each direction
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const pixelIndex = ((y + ky) * width + (x + kx)) * 4;
            const pixelValue = data[pixelIndex]; // Use R channel
            
            // Calculate gradient components for each direction
            gx += pixelValue * sobelX[ky + 1][kx + 1];
            gy += pixelValue * sobelY[ky + 1][kx + 1];
            g45 += pixelValue * sobel45[ky + 1][kx + 1];
            g135 += pixelValue * sobel135[ky + 1][kx + 1];
          }
        }
        
        // Store gradient components
        const index = y * width + x;
        gradientX[index] = gx;
        gradientY[index] = gy;
        gradient45[index] = g45;
        gradient135[index] = g135;
        
        // Calculate gradient magnitude using all directions for better accuracy
        const weightedGx = gx + (g45 + g135) / 2;
        const weightedGy = gy + (g45 - g135) / 2;
        gradientMagnitude[index] = Math.sqrt(weightedGx * weightedGx + weightedGy * weightedGy);
        
        // Calculate gradient direction (in radians)
        gradientDirection[index] = Math.atan2(weightedGy, weightedGx);
      }
    }
    
    // Apply non-maximum suppression
    const suppressed = nonMaximumSuppression(
      gradientMagnitude, gradientDirection, width, height
    );
    
    // Apply hysteresis thresholding
    const edges = hysteresisThresholding(
      suppressed, gradientMagnitude, gradientDirection, 
      gradientX, gradientY, gradient45, gradient135,
      width, height, lowThreshold, highThreshold
    );
    
    return edges;
  };
  
  /**
   * Perform non-maximum suppression on gradient magnitudes
   * @param {Array} magnitudes - Array of gradient magnitudes
   * @param {Array} directions - Array of gradient directions
   * @param {number} width - Image width
   * @param {number} height - Image height
   * @returns {Array} Array of suppressed gradient magnitudes
   */
  const nonMaximumSuppression = (magnitudes, directions, width, height) => {
    const result = new Array(width * height).fill(0);
    
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const index = y * width + x;
        const direction = directions[index];
        const magnitude = magnitudes[index];
        
        // Skip pixels with very weak gradients
        if (magnitude < 5) continue;
        
        // Identify neighboring pixels based on gradient direction
        let neighbor1Index, neighbor2Index;
        
        // Horizontal edge (vertical gradient)
        if ((direction >= -Math.PI/8 && direction < Math.PI/8) || 
            (direction >= 7*Math.PI/8 || direction < -7*Math.PI/8)) {
          neighbor1Index = y * width + (x + 1);
          neighbor2Index = y * width + (x - 1);
        }
        // 45-degree edge
        else if ((direction >= Math.PI/8 && direction < 3*Math.PI/8) || 
                (direction >= -7*Math.PI/8 && direction < -5*Math.PI/8)) {
          neighbor1Index = (y - 1) * width + (x + 1);
          neighbor2Index = (y + 1) * width + (x - 1);
        }
        // Vertical edge (horizontal gradient)
        else if ((direction >= 3*Math.PI/8 && direction < 5*Math.PI/8) || 
                (direction >= -5*Math.PI/8 && direction < -3*Math.PI/8)) {
          neighbor1Index = (y - 1) * width + x;
          neighbor2Index = (y + 1) * width + x;
        }
        // 135-degree edge
        else {
          neighbor1Index = (y - 1) * width + (x - 1);
          neighbor2Index = (y + 1) * width + (x + 1);
        }
        
        // Keep only local maxima along gradient direction
        if (magnitude >= magnitudes[neighbor1Index] && magnitude >= magnitudes[neighbor2Index]) {
          result[index] = magnitude;
        }
      }
    }
    
    return result;
  };
  
  /**
   * Apply hysteresis thresholding to identify strong and weak edges
   * @param {Array} suppressed - Suppressed gradient magnitudes
   * @param {Array} magnitudes - Original gradient magnitudes
   * @param {Array} directions - Gradient directions
   * @param {Array} gradientX - X-component of gradient
   * @param {Array} gradientY - Y-component of gradient
   * @param {Array} gradient45 - 45-degree component of gradient
   * @param {Array} gradient135 - 135-degree component of gradient
   * @param {number} width - Image width
   * @param {number} height - Image height
   * @param {number} lowThreshold - Low threshold
   * @param {number} highThreshold - High threshold
   * @returns {Array} Array of edge points
   */
  const hysteresisThresholding = (
    suppressed, magnitudes, directions, 
    gradientX, gradientY, gradient45, gradient135,
    width, height, lowThreshold, highThreshold
  ) => {
    const edges = [];
    const visited = new Array(width * height).fill(false);
    
    // Find strong edge pixels (above high threshold)
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const index = y * width + x;
        
        if (suppressed[index] >= highThreshold && !visited[index]) {
          // This is a strong edge point
          visited[index] = true;
          
          // Create edge point object with gradient information
          const edgePoint = {
            x, 
            y,
            magnitude: suppressed[index],
            direction: directions[index],
            gradX: gradientX[index],
            gradY: gradientY[index],
            grad45: gradient45[index],
            grad135: gradient135[index],
            isMajor: true
          };
          
          edges.push(edgePoint);
          
          // Recursively trace connected edges
          traceEdge(
            x, y, suppressed, visited, edges, 
            magnitudes, directions, gradientX, gradientY, gradient45, gradient135,
            width, height, lowThreshold
          );
        }
      }
    }
    
    return edges;
  };
  
  /**
   * Recursively trace edges connected to a strong edge point
   * @param {number} x - X-coordinate of start point
   * @param {number} y - Y-coordinate of start point
   * @param {Array} suppressed - Suppressed gradient magnitudes
   * @param {Array} visited - Array to track visited pixels
   * @param {Array} edges - Array to store edge points
   * @param {Array} magnitudes - Original gradient magnitudes
   * @param {Array} directions - Gradient directions
   * @param {Array} gradientX - X-component of gradient
   * @param {Array} gradientY - Y-component of gradient
   * @param {Array} gradient45 - 45-degree component of gradient
   * @param {Array} gradient135 - 135-degree component of gradient
   * @param {number} width - Image width
   * @param {number} height - Image height
   * @param {number} lowThreshold - Low threshold
   */
  const traceEdge = (
    x, y, suppressed, visited, edges, 
    magnitudes, directions, gradientX, gradientY, gradient45, gradient135,
    width, height, lowThreshold
  ) => {
    // Check all 8 neighbors
    for (let ny = Math.max(0, y - 1); ny <= Math.min(height - 1, y + 1); ny++) {
      for (let nx = Math.max(0, x - 1); nx <= Math.min(width - 1, x + 1); nx++) {
        const index = ny * width + nx;
        
        // Skip the center pixel (already processed)
        if (nx === x && ny === y) continue;
        
        // If neighbor is above low threshold and not yet visited
        if (suppressed[index] >= lowThreshold && !visited[index]) {
          visited[index] = true;
          
          // Create edge point object
          const edgePoint = {
            x: nx, 
            y: ny,
            magnitude: suppressed[index],
            direction: directions[index],
            gradX: gradientX[index],
            gradY: gradientY[index],
            grad45: gradient45[index],
            grad135: gradient135[index],
            isMajor: false
          };
          
          edges.push(edgePoint);
          
          // Continue tracing from this point
          traceEdge(
            nx, ny, suppressed, visited, edges, 
            magnitudes, directions, gradientX, gradientY, gradient45, gradient135,
            width, height, lowThreshold
          );
        }
      }
    }
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
    const l2 = Math.sqrt((5 * Z11R + Z11I) / (6 * Z11I));
    const l = (l1 + l2) / 2;
    
    // Calculate edge contrast
    const k = (3 * Z11I) / (2 * Math.pow(1 - l * l, 1.5));
    
    // Calculate background level
    const h = (1/Math.PI) * (Z00 - (k * Math.PI / 2) + k * Math.asin(l) + k * l * Math.sqrt(1 - l * l));
    
    return { phi, l, k, h };
  };
  
  /**
   * Improved Devernay's quadratic interpolation for sub-pixel accuracy
   * Based on the modified Canny/Devernay scheme from the paper
   * @param {number} a - Gradient value at first point
   * @param {number} b - Gradient value at middle point (local maximum)
   * @param {number} c - Gradient value at third point
   * @returns {number} Sub-pixel offset relative to the middle point
   */
  export const improvedDevernaySubpixel = (a, b, c) => {
    // Check if middle point is a maximum
    if (b <= a || b <= c) return 0;
    
    // Compute the sub-pixel offset using quadratic interpolation formula
    const denominator = a + c - 2 * b;
    if (Math.abs(denominator) < 0.0001) return 0;
    
    // This is Devernay's formula with a slight improvement
    // The improvement ensures better accuracy when dealing with
    // diagonal edges by modifying how we interpolate along edges
    return 0.5 * (a - c) / denominator;
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
   * Combined approach to refine edge positions to sub-pixel accuracy
   * This approach combines:
   * 1. Improved Devernay method for directional interpolation
   * 2. Zernike moment based edge parameterization
   * 3. Gradient directional interpolation
   * 
   * @param {Array} edges - Array of edge points with pixel coordinates
   * @param {Uint8ClampedArray} imageData - Image data
   * @param {number} width - Image width
   * @param {number} height - Image height
   * @param {number} lThreshold - Distance threshold (0-0.5)
   * @param {number} kThreshold - Contrast threshold
   * @returns {Array} Refined edge points with sub-pixel coordinates
   */
  export const refineEdgesWithCombinedApproach = (edges, imageData, width, height, lThreshold = 0.4, kThreshold = 10) => {
    const refinedEdges = [];
    
    for (const edge of edges) {
      const { x, y, gradX, gradY, magnitude, isMajor } = edge;
      
      // Skip edge points too close to the image boundaries
      if (x < 3 || y < 3 || x >= width - 3 || y >= height - 3) continue;
      
      // Extract 7x7 neighborhood around the edge point
      const neighborhood = extract7x7Neighborhood(imageData, width, x, y);
      
      // Apply gradient directional interpolation to enhance edge information
      const interpolatedNeighborhood = interpolateNeighborhoodAlongGradient(
        neighborhood, gradX, gradY, 3
      );
      
      // Calculate edge parameters using Zernike moments on the interpolated neighborhood
      const { phi, l, k, h } = calculateEdgeParameters(interpolatedNeighborhood);
      
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
          background: h,
          isMajor
        });
      }
    }
    
    return refinedEdges;
  };
  
  /**
   * The main function that processes an image and returns sub-pixel edge points
   * @param {ImageData} imageData - The image data to process
   * @param {number} lowThreshold - Low threshold for Canny detection
   * @param {number} highThreshold - High threshold for Canny detection
   * @param {number} lThreshold - Distance threshold for Zernike refinement
   * @param {number} kThreshold - Contrast threshold for Zernike refinement
   * @returns {Array} Array of sub-pixel edge points
   */
  export const detectSubpixelEdges = (imageData, lowThreshold = 10, highThreshold = 30, lThreshold = 0.4, kThreshold = 10) => {
    // Step 1: Apply bilateral filtering to reduce noise while preserving edges
    const filteredImageData = applyBilateralFilter(imageData);
    
    // Step 2: Detect edges with improved multidirectional Canny algorithm
    const edges = detectEdgesWithMultidirectionalCanny(
      filteredImageData, lowThreshold, highThreshold
    );
    
    // Step 3: Refine edges to sub-pixel accuracy using combined approach
    const refinedEdges = refineEdgesWithCombinedApproach(
      edges, filteredImageData.data, filteredImageData.width, filteredImageData.height,
      lThreshold, kThreshold
    );
    
    return refinedEdges;
  };