/**
 * Enhanced Edge Detection Utilities for Sub-pixel Wood Measurement
 * 
 * This module provides more robust algorithms for detecting edges in
 * variable lighting conditions when measuring wood specimens.
 * Enhanced with Canny/Devernay approach and gradient directional interpolation.
 */

// Convert an image to grayscale
export const convertToGrayscale = (imageData) => {
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      const grayscale = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      data[i] = grayscale;     // r
      data[i + 1] = grayscale; // g
      data[i + 2] = grayscale; // b
      // Keep alpha unchanged
    }
    return imageData;
  };
  
  // Apply contrast enhancement to improve edge visibility
  export const enhanceContrast = (imageData, factor = 1.5) => {
    const data = imageData.data;
    const avg = getAverageIntensity(imageData);
    
    for (let i = 0; i < data.length; i += 4) {
      // Only enhance R channel (since we're using grayscale)
      data[i] = constrain(avg + (data[i] - avg) * factor, 0, 255);
      data[i + 1] = data[i];
      data[i + 2] = data[i];
    }
    
    return imageData;
  };
  
  // Calculate average intensity of an image
  export const getAverageIntensity = (imageData) => {
    const data = imageData.data;
    let sum = 0;
    let count = 0;
    
    for (let i = 0; i < data.length; i += 4) {
      sum += data[i]; // Using R channel
      count++;
    }
    
    return sum / count;
  };
  
  // Apply a constrain function to ensure values stay within range
  export const constrain = (value, min, max) => {
    return Math.min(Math.max(value, min), max);
  };
  
  // Apply adaptive thresholding to better separate wood from background
  export const adaptiveThreshold = (imageData, canvas, windowSize = 15, C = 5) => {
    const width = canvas.width;
    const height = canvas.height;
    const data = imageData.data;
    
    // Create a copy of the image data to store thresholded values
    const thresholdedData = new Uint8ClampedArray(data.length);
    
    // Initialize with zeros
    for (let i = 0; i < thresholdedData.length; i++) {
      thresholdedData[i] = 0;
    }
    
    const radius = Math.floor(windowSize / 2);
    
    // Apply adaptive thresholding
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        // Calculate local average around this pixel
        let sum = 0;
        let count = 0;
        
        for (let wy = -radius; wy <= radius; wy++) {
          for (let wx = -radius; wx <= radius; wx++) {
            const nx = x + wx;
            const ny = y + wy;
            
            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
              sum += data[(ny * width + nx) * 4]; // R channel
              count++;
            }
          }
        }
        
        const threshold = sum / count - C;
        const pixelIndex = (y * width + x) * 4;
        
        // Apply threshold
        const value = data[pixelIndex] < threshold ? 0 : 255;
        
        // Store in the output array
        thresholdedData[pixelIndex] = value;
        thresholdedData[pixelIndex + 1] = value;
        thresholdedData[pixelIndex + 2] = value;
        thresholdedData[pixelIndex + 3] = 255; // Alpha
      }
    }
    
    // Copy thresholded data back to the original imageData
    for (let i = 0; i < data.length; i++) {
      data[i] = thresholdedData[i];
    }
    
    return imageData;
  };
  
  // Apply Gaussian smoothing to reduce noise
  export const gaussianSmooth = (data, sigma) => {
    const size = Math.ceil(sigma * 3) * 2 + 1;
    const kernel = [];
    
    // Generate Gaussian kernel
    let sum = 0;
    const offset = Math.floor(size / 2);
    
    for (let i = 0; i < size; i++) {
      const x = i - offset;
      const g = Math.exp(-(x * x) / (2 * sigma * sigma));
      kernel.push(g);
      sum += g;
    }
    
    // Normalize kernel
    for (let i = 0; i < kernel.length; i++) {
      kernel[i] /= sum;
    }
    
    // Apply convolution
    const result = [];
    for (let i = 0; i < data.length; i++) {
      let value = 0;
      for (let j = 0; j < kernel.length; j++) {
        const idx = i + j - offset;
        if (idx >= 0 && idx < data.length) {
          value += data[idx] * kernel[j];
        }
      }
      result.push(value);
    }
    
    return result;
  };
  
  /**
   * Apply Devernay's quadratic interpolation for sub-pixel accuracy
   * This replaces the original linear interpolation method with a more accurate approach
   * @param {number} a - Gradient value at first point
   * @param {number} b - Gradient value at middle point (local maximum)
   * @param {number} c - Gradient value at third point
   * @returns {number} Sub-pixel offset relative to the middle point
   */
  export const devernaySubpixel = (a, b, c) => {
    // Check if middle point is a maximum
    if (b <= a || b <= c) return 0;
    
    // Compute the sub-pixel offset using quadratic interpolation formula
    // This is Devernay's formula: η = 0.5 * (a-c)/(a+c-2b)
    return 0.5 * (a - c) / (a + c - 2 * b);
  };
  
  /**
   * Perform edge gradient directional interpolation to enhance accuracy
   * Implementation based on the paper "Subpixel Edge Detection Based on Edge Gradient 
   * Directional Interpolation and Zernike moment"
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
   * Simple bilinear interpolation for grayscale values
   * @param {Array} data - 2D array of grayscale values
   * @param {number} x - X coordinate to sample (can be fractional)
   * @param {number} y - Y coordinate to sample (can be fractional)
   * @returns {number} Interpolated value
   */
  export const bilinearInterpolate = (data, x, y) => {
    // For simplicity, we'll just return the nearest value 
    // In a full implementation, this would do proper bilinear interpolation
    const ix = Math.round(x);
    const iy = Math.round(y);
    
    if (ix < 0 || ix >= data.length || iy < 0 || iy >= data[0].length) {
      return 0; // Out of bounds
    }
    
    return data[ix][iy];
  };
  
  // More robust horizontal edge detection with dynamic thresholding and sub-pixel accuracy
  export const detectHorizontalEdges = (imageData, canvas) => {
    const width = canvas.width;
    const height = canvas.height;
    const data = imageData.data;
    const edges = [];
    
    // Try multiple scan lines to increase chances of finding edges
    const scanLines = [
      Math.floor(height * 0.3),
      Math.floor(height * 0.4),
      Math.floor(height * 0.5), // Middle
      Math.floor(height * 0.6),
      Math.floor(height * 0.7)
    ];
    
    let bestEdgeResult = null;
    let maxEdgeStrength = 0;
    
    // Process each scan line
    for (const rowY of scanLines) {
      const rowOffset = rowY * width * 4;
      
      // Array to store grayscale values across the row
      const profileData = [];
      
      // Extract profile data (grayscale values) across the row
      for (let x = 0; x < width; x++) {
        const pixelIndex = rowOffset + x * 4;
        profileData.push(data[pixelIndex]); // Grayscale value (R channel)
      }
      
      // Apply Gaussian smoothing to reduce noise
      const smoothedProfile = gaussianSmooth(profileData, 2);
      
      // Calculate gradient (first derivative)
      const gradient = [];
      for (let i = 1; i < smoothedProfile.length - 1; i++) {
        gradient.push((smoothedProfile[i+1] - smoothedProfile[i-1]) / 2);
      }
      
      // Calculate the average gradient magnitude
      let totalGradientMagnitude = 0;
      for (let i = 0; i < gradient.length; i++) {
        totalGradientMagnitude += Math.abs(gradient[i]);
      }
      const avgGradientMagnitude = totalGradientMagnitude / gradient.length;
      
      // Dynamic threshold based on the average gradient magnitude
      const gradientThreshold = Math.max(5, avgGradientMagnitude * 2);
      
      // Find all edges
      const rowEdges = [];
      for (let i = 1; i < gradient.length - 1; i++) {
        if (
          (gradient[i] > gradientThreshold && gradient[i+1] < -gradientThreshold) || 
          (gradient[i] < -gradientThreshold && gradient[i+1] > gradientThreshold)
        ) {
          // Calculate sub-pixel position using Devernay's quadratic interpolation 
          // instead of the original linear interpolation
          let a, b, c;
          if (gradient[i] > 0) {
            // Rising edge
            a = Math.abs(gradient[i-1]);
            b = Math.abs(gradient[i]);
            c = Math.abs(gradient[i+1]);
          } else {
            // Falling edge
            a = Math.abs(gradient[i+1]);
            b = Math.abs(gradient[i]);
            c = Math.abs(gradient[i-1]);
          }
          
          const subpixelOffset = devernaySubpixel(a, b, c);
          const x = i + 1 + subpixelOffset;
          const strength = Math.abs(gradient[i]);
          rowEdges.push({ position: x, strength: strength });
        }
      }
      
      // If we found edges, analyze them
      if (rowEdges.length >= 2) {
        rowEdges.sort((a, b) => a.position - b.position);
        
        // Find the best pair of edges by looking at darkness between them
        let bestLeftEdge = null;
        let bestRightEdge = null;
        let maxDarkness = -Infinity;
        
        for (let i = 0; i < rowEdges.length - 1; i++) {
          const leftEdge = rowEdges[i].position;
          const rightEdge = rowEdges[i+1].position;
          const edgeDistance = rightEdge - leftEdge;
          
          // Skip edges that are too close or too far apart
          if (edgeDistance < width * 0.05 || edgeDistance > width * 0.9) continue;
          
          // Calculate average darkness between these edges
          let totalDarkness = 0;
          let pixelCount = 0;
          
          for (let x = Math.floor(leftEdge); x <= Math.ceil(rightEdge); x++) {
            if (x >= 0 && x < width) {
              const pixelIndex = rowOffset + x * 4;
              totalDarkness += (255 - data[pixelIndex]); // Invert so darker is higher value
              pixelCount++;
            }
          }
          
          const avgDarkness = totalDarkness / pixelCount;
          
          // We also want significant width, but not too wide
          const widthScore = Math.min(1, edgeDistance / (width * 0.2));
          const combinedScore = avgDarkness * widthScore * 
                               (rowEdges[i].strength + rowEdges[i+1].strength) / 2;
          
          if (combinedScore > maxDarkness) {
            maxDarkness = combinedScore;
            bestLeftEdge = leftEdge;
            bestRightEdge = rightEdge;
          }
        }
        
        // If we found a good pair of edges on this row
        if (bestLeftEdge !== null && bestRightEdge !== null) {
          const edgeStrength = maxDarkness;
          
          // Keep track of the best scan line
          if (edgeStrength > maxEdgeStrength) {
            maxEdgeStrength = edgeStrength;
            bestEdgeResult = {
              leftEdge: bestLeftEdge,
              rightEdge: bestRightEdge,
              widthPixels: bestRightEdge - bestLeftEdge,
              scanLine: rowY,
              strength: edgeStrength
            };
          }
        }
      }
    }
    
    // If we found edges on any scan line, return the best one
    return bestEdgeResult;
  };
  
  // More robust vertical edge detection with dynamic thresholding and sub-pixel accuracy
  export const detectVerticalEdges = (imageData, canvas) => {
    const width = canvas.width;
    const height = canvas.height;
    const data = imageData.data;
    
    // Try multiple scan lines to increase chances of finding edges
    const scanLines = [
      Math.floor(width * 0.3),
      Math.floor(width * 0.4),
      Math.floor(width * 0.5), // Middle
      Math.floor(width * 0.6),
      Math.floor(width * 0.7)
    ];
    
    let bestEdgeResult = null;
    let maxEdgeStrength = 0;
    
    // Process each scan line
    for (const colX of scanLines) {
      // Array to store grayscale values down the column
      const profileData = [];
      
      // Extract profile data (grayscale values) down the column
      for (let y = 0; y < height; y++) {
        const pixelIndex = (y * width + colX) * 4;
        profileData.push(data[pixelIndex]); // Grayscale value (R channel)
      }
      
      // Apply Gaussian smoothing to reduce noise
      const smoothedProfile = gaussianSmooth(profileData, 2);
      
      // Calculate gradient (first derivative)
      const gradient = [];
      for (let i = 1; i < smoothedProfile.length - 1; i++) {
        gradient.push((smoothedProfile[i+1] - smoothedProfile[i-1]) / 2);
      }
      
      // Calculate the average gradient magnitude
      let totalGradientMagnitude = 0;
      for (let i = 0; i < gradient.length; i++) {
        totalGradientMagnitude += Math.abs(gradient[i]);
      }
      const avgGradientMagnitude = totalGradientMagnitude / gradient.length;
      
      // Dynamic threshold based on the average gradient magnitude
      const gradientThreshold = Math.max(5, avgGradientMagnitude * 2);
      
      // Find all edges
      const colEdges = [];
      for (let i = 1; i < gradient.length - 1; i++) {
        if (
          (gradient[i] > gradientThreshold && gradient[i+1] < -gradientThreshold) || 
          (gradient[i] < -gradientThreshold && gradient[i+1] > gradientThreshold)
        ) {
          // Calculate sub-pixel position using Devernay's quadratic interpolation instead of linear
          let a, b, c;
          if (gradient[i] > 0) {
            // Rising edge
            a = Math.abs(gradient[i-1]);
            b = Math.abs(gradient[i]);
            c = Math.abs(gradient[i+1]);
          } else {
            // Falling edge
            a = Math.abs(gradient[i+1]);
            b = Math.abs(gradient[i]);
            c = Math.abs(gradient[i-1]);
          }
          
          const subpixelOffset = devernaySubpixel(a, b, c);
          const y = i + 1 + subpixelOffset;
          const strength = Math.abs(gradient[i]);
          colEdges.push({ position: y, strength: strength });
        }
      }
      
      // If we found edges, analyze them
      if (colEdges.length >= 2) {
        colEdges.sort((a, b) => a.position - b.position);
        
        // Find the best pair of edges by looking at darkness between them
        let bestTopEdge = null;
        let bestBottomEdge = null;
        let maxDarkness = -Infinity;
        
        for (let i = 0; i < colEdges.length - 1; i++) {
          const topEdge = colEdges[i].position;
          const bottomEdge = colEdges[i+1].position;
          const edgeDistance = bottomEdge - topEdge;
          
          // Skip edges that are too close or too far apart
          if (edgeDistance < height * 0.05 || edgeDistance > height * 0.9) continue;
          
          // Calculate average darkness between these edges
          let totalDarkness = 0;
          let pixelCount = 0;
          
          for (let y = Math.floor(topEdge); y <= Math.ceil(bottomEdge); y++) {
            if (y >= 0 && y < height) {
              const pixelIndex = (y * width + colX) * 4;
              totalDarkness += (255 - data[pixelIndex]); // Invert so darker is higher value
              pixelCount++;
            }
          }
          
          const avgDarkness = totalDarkness / pixelCount;
          
          // We also want significant height, but not too tall
          const heightScore = Math.min(1, edgeDistance / (height * 0.2));
          const combinedScore = avgDarkness * heightScore * 
                               (colEdges[i].strength + colEdges[i+1].strength) / 2;
          
          if (combinedScore > maxDarkness) {
            maxDarkness = combinedScore;
            bestTopEdge = topEdge;
            bestBottomEdge = bottomEdge;
          }
        }
        
        // If we found a good pair of edges on this column
        if (bestTopEdge !== null && bestBottomEdge !== null) {
          const edgeStrength = maxDarkness;
          
          // Keep track of the best scan line
          if (edgeStrength > maxEdgeStrength) {
            maxEdgeStrength = edgeStrength;
            bestEdgeResult = {
              topEdge: bestTopEdge,
              bottomEdge: bestBottomEdge,
              heightPixels: bestBottomEdge - bestTopEdge,
              scanLine: colX,
              strength: edgeStrength
            };
          }
        }
      }
    }
    
    // If we found edges on any scan line, return the best one
    return bestEdgeResult;
  };
  
  // Modified processImageForEdgeDetection function with safety checks
export const processImageForEdgeDetection = (ctx, canvas) => {
    // Add safety check to prevent error when dimensions are invalid
    if (!canvas || !ctx || canvas.width <= 0 || canvas.height <= 0) {
      console.warn("Cannot process image: Invalid canvas dimensions", 
        canvas ? `${canvas.width}x${canvas.height}` : "canvas not available");
      return null;
    }
  
    try {
      // Get original image data
      let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      
      // Convert to grayscale
      imageData = convertToGrayscale(imageData);
      
      // Enhance contrast to make edges more visible
      imageData = enhanceContrast(imageData, 1.5);
      
      // For very difficult cases, adaptive thresholding can help
      // but it's computationally intensive, so we use it as a last resort
      const useAdaptiveThreshold = false;
      if (useAdaptiveThreshold) {
        imageData = adaptiveThreshold(imageData, canvas, 25, 10);
      }
      
      return imageData;
    } catch (error) {
      console.error("Error processing image for edge detection:", error);
      return null;
    }
  };
  
  // Draw visualization of edges on a canvas
  export const visualizeEdges = (canvas, edgeResults, isHorizontal = true) => {
    if (!canvas || !edgeResults) return;
    
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    
    // Draw scan line used
    ctx.strokeStyle = 'rgba(255, 0, 0, 0.7)';
    ctx.lineWidth = 1;
    
    if (isHorizontal) {
      // Draw horizontal scan line
      ctx.beginPath();
      ctx.moveTo(0, edgeResults.scanLine);
      ctx.lineTo(width, edgeResults.scanLine);
      ctx.stroke();
      
      // Draw detected edges
      ctx.strokeStyle = 'rgba(0, 255, 0, 1)';
      ctx.lineWidth = 2;
      
      // Left edge
      ctx.beginPath();
      ctx.moveTo(edgeResults.leftEdge, 0);
      ctx.lineTo(edgeResults.leftEdge, height);
      ctx.stroke();
      
      // Right edge
      ctx.beginPath();
      ctx.moveTo(edgeResults.rightEdge, 0);
      ctx.lineTo(edgeResults.rightEdge, height);
      ctx.stroke();
    } else {
      // Draw vertical scan line
      ctx.beginPath();
      ctx.moveTo(edgeResults.scanLine, 0);
      ctx.lineTo(edgeResults.scanLine, height);
      ctx.stroke();
      
      // Draw detected edges
      ctx.strokeStyle = 'rgba(0, 255, 0, 1)';
      ctx.lineWidth = 2;
      
      // Top edge
      ctx.beginPath();
      ctx.moveTo(0, edgeResults.topEdge);
      ctx.lineTo(width, edgeResults.topEdge);
      ctx.stroke();
      
      // Bottom edge
      ctx.beginPath();
      ctx.moveTo(0, edgeResults.bottomEdge);
      ctx.lineTo(width, edgeResults.bottomEdge);
      ctx.stroke();
    }
    
    // Add measurement text
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(width - 150, 10, 140, 30);
    
    ctx.font = '14px Arial';
    ctx.fillStyle = 'rgba(255, 255, 255, 1)';
    const dimensionText = isHorizontal ? 
      `Width: ${edgeResults.widthPixels.toFixed(1)}px` : 
      `Height: ${edgeResults.heightPixels.toFixed(1)}px`;
    ctx.fillText(dimensionText, width - 140, 30);
    
    // Add strength indication
    ctx.fillText(`Quality: ${Math.round(edgeResults.strength / 50)}`, width - 140, 50);
  };
  
  // Modified detectWoodDimensions function with better error handling
    export const detectWoodDimensions = (videoElement, canvasElement, mode = 'width') => {
        if (!videoElement || !canvasElement) {
        console.warn("Cannot detect dimensions: Video or canvas element is missing");
        return null;
        }
        
        const canvas = canvasElement;
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
        console.warn("Cannot detect dimensions: Failed to get canvas context");
        return null;
        }
        
        // Ensure video has valid dimensions
        if (!videoElement.videoWidth || !videoElement.videoHeight || 
            videoElement.videoWidth <= 0 || videoElement.videoHeight <= 0) {
        console.warn("Cannot detect dimensions: Video dimensions are invalid", 
            `${videoElement.videoWidth}x${videoElement.videoHeight}`);
        return null;
        }
        
        // Set canvas dimensions to match video
        canvas.width = videoElement.videoWidth;
        canvas.height = videoElement.videoHeight;
        
        try {
        // Draw current video frame to canvas
        ctx.drawImage(videoElement, 0, 0, videoElement.videoWidth, videoElement.videoHeight);
        
        // Process the image for edge detection
        const processedImageData = processImageForEdgeDetection(ctx, canvas);
        if (!processedImageData) {
            return null;
        }
        
        // Put processed image back on canvas (useful for debugging)
        ctx.putImageData(processedImageData, 0, 0);
        
        // Detect edges based on measurement mode
        let edgeResults = null;
        
        if (mode === 'width') {
            edgeResults = detectHorizontalEdges(processedImageData, canvas);
        } else if (mode === 'height') {
            edgeResults = detectVerticalEdges(processedImageData, canvas);
        } else if (mode === 'length') {
            // For length, try both directions and use the larger dimension
            const horizontalResults = detectHorizontalEdges(processedImageData, canvas);
            const verticalResults = detectVerticalEdges(processedImageData, canvas);
            
            // Choose based on strength and size
            if (horizontalResults && verticalResults) {
            const horizontalScore = horizontalResults.widthPixels * horizontalResults.strength;
            const verticalScore = verticalResults.heightPixels * verticalResults.strength;
            
            edgeResults = horizontalScore > verticalScore ? horizontalResults : verticalResults;
            } else {
            edgeResults = horizontalResults || verticalResults;
            }
        }
        
        // Visualize edges if found
        if (edgeResults) {
            const isHorizontal = edgeResults.hasOwnProperty('widthPixels');
            visualizeEdges(canvas, edgeResults, isHorizontal);
        }
        
        return edgeResults;
        } catch (error) {
        console.error("Error detecting wood dimensions:", error);
        return null;
        }
    };