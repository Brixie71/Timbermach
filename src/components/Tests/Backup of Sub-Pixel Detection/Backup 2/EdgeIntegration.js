/**
 * Edge Integration Utilities
 * 
 * This module provides helper functions to integrate the improved
 * edge detection system with the existing codebase.
 */

import { detectSubpixelEdges } from './ImprovedEdgeDetection';

/**
 * Process an image and detect sub-pixel edges using the improved method
 * @param {HTMLCanvasElement} canvas - The canvas element containing the image
 * @param {Object} options - Detection options
 * @param {number} options.lowThreshold - Low threshold for Canny detection (default: 10)
 * @param {number} options.highThreshold - High threshold for Canny detection (default: 30) 
 * @param {number} options.lThreshold - Distance threshold for Zernike refinement (default: 0.4)
 * @param {number} options.kThreshold - Contrast threshold for Zernike refinement (default: 10)
 * @returns {Array} Array of sub-pixel edge points
 */
export const processCanvasForSubpixelEdges = (canvas, options = {}) => {
  const {
    lowThreshold = 10,
    highThreshold = 30,
    lThreshold = 0.4,
    kThreshold = 10
  } = options;
  
  // Get canvas context and image data
  const ctx = canvas.getContext('2d');
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  
  // Detect sub-pixel edges
  const edges = detectSubpixelEdges(
    imageData, lowThreshold, highThreshold, lThreshold, kThreshold
  );
  
  return edges;
};

/**
 * Draw sub-pixel edges on a canvas
 * @param {HTMLCanvasElement} canvas - The canvas element to draw on
 * @param {Array} edges - Array of sub-pixel edge points
 * @param {Object} options - Visualization options
 * @param {boolean} options.showMajorOnly - Only show major edges (default: false)
 * @param {string} options.majorColor - Color for major edges (default: 'rgba(0, 255, 0, 0.8)')
 * @param {string} options.minorColor - Color for minor edges (default: 'rgba(255, 255, 0, 0.6)')
 * @param {number} options.pointSize - Size of edge points (default: 1.5)
 */
export const visualizeSubpixelEdges = (canvas, edges, options = {}) => {
  const {
    showMajorOnly = false,
    majorColor = 'rgba(0, 255, 0, 0.8)',
    minorColor = 'rgba(255, 255, 0, 0.6)',
    pointSize = 1.5
  } = options;
  
  const ctx = canvas.getContext('2d');
  
  // Draw edges
  for (const edge of edges) {
    // Skip minor edges if showMajorOnly is true
    if (showMajorOnly && !edge.isMajor) continue;
    
    // Select color based on edge type
    ctx.fillStyle = edge.isMajor ? majorColor : minorColor;
    
    // Draw the edge point
    ctx.beginPath();
    ctx.arc(edge.subpixelX, edge.subpixelY, pointSize, 0, 2 * Math.PI);
    ctx.fill();
  }
};

/**
 * Integrate the improved edge detection with the existing measurment workflow
 * @param {HTMLCanvasElement} canvas - The canvas element containing the image
 * @param {string} mode - Measurement mode ('width', 'height', or 'length')
 * @param {Object} options - Detection and visualization options
 * @returns {Object} Measurement result
 */
export const performImprovedMeasurement = (canvas, mode = 'width', options = {}) => {
  const {
    lowThreshold = 10,
    highThreshold = 30,
    lThreshold = 0.4,
    kThreshold = 10,
    calibrationFactor = 0.0145503, // Default mm per pixel
    showVisualization = true
  } = options;
  
  // Get canvas dimensions
  const width = canvas.width;
  const height = canvas.height;
  
  // Detect sub-pixel edges
  const edges = processCanvasForSubpixelEdges(canvas, {
    lowThreshold,
    highThreshold,
    lThreshold,
    kThreshold
  });
  
  // If no edges found, return null
  if (!edges || edges.length === 0) {
    return null;
  }
  
  // Find measurement based on mode
  let result = null;
  
  if (mode === 'width') {
    result = measureWidthFromEdges(edges, width, height);
  } else if (mode === 'height') {
    result = measureHeightFromEdges(edges, width, height);
  } else if (mode === 'length') {
    // For length, try both directions and use the larger dimension
    const widthResult = measureWidthFromEdges(edges, width, height);
    const heightResult = measureHeightFromEdges(edges, width, height);
    
    if (widthResult && heightResult) {
      result = widthResult.pixelMeasurement > heightResult.pixelMeasurement ? 
        widthResult : heightResult;
    } else {
      result = widthResult || heightResult;
    }
  }
  
  // If result found, convert to millimeters
  if (result) {
    result.millimeterMeasurement = result.pixelMeasurement * calibrationFactor;
    
    // Draw visualization if requested
    if (showVisualization) {
      visualizeMeasurement(canvas, result, mode);
    }
  }
  
  return result;
};

/**
 * Measure width from sub-pixel edge points
 * @param {Array} edges - Array of sub-pixel edge points
 * @param {number} width - Canvas width
 * @param {number} height - Canvas height
 * @returns {Object} Measurement result
 */
const measureWidthFromEdges = (edges, width, height) => {
  // Filter major edges
  const majorEdges = edges.filter(edge => edge.isMajor);
  
  // If not enough major edges, use all edges
  const edgesToUse = majorEdges.length >= 2 ? majorEdges : edges;
  
  // Try multiple scan lines to find the best pair of edges
  const scanLines = [
    Math.floor(height * 0.3),
    Math.floor(height * 0.4),
    Math.floor(height * 0.5), // Middle
    Math.floor(height * 0.6),
    Math.floor(height * 0.7)
  ];
  
  let bestResult = null;
  let maxScore = 0;
  
  // Process each scan line
  for (const scanLine of scanLines) {
    // Find edges near this scan line
    const nearbyEdges = edgesToUse.filter(
      edge => Math.abs(edge.subpixelY - scanLine) < 5
    );
    
    // Sort by X position
    nearbyEdges.sort((a, b) => a.subpixelX - b.subpixelX);
    
    // Find pairs of edges
    for (let i = 0; i < nearbyEdges.length - 1; i++) {
      const leftEdge = nearbyEdges[i];
      
      // Look for edges on the right side
      for (let j = i + 1; j < nearbyEdges.length; j++) {
        const rightEdge = nearbyEdges[j];
        
        // Calculate width
        const edgeDistance = rightEdge.subpixelX - leftEdge.subpixelX;
        
        // Skip pairs that are too close or too far apart
        if (edgeDistance < width * 0.05 || edgeDistance > width * 0.9) continue;
        
        // Calculate score (based on contrast and distance)
        const score = (leftEdge.contrast + rightEdge.contrast) * 
                    Math.min(1, edgeDistance / (width * 0.2));
        
        // Keep the best result
        if (score > maxScore) {
          maxScore = score;
          bestResult = {
            leftEdge: leftEdge.subpixelX,
            rightEdge: rightEdge.subpixelX,
            pixelMeasurement: edgeDistance,
            scanLine: (leftEdge.subpixelY + rightEdge.subpixelY) / 2,
            strength: score
          };
        }
      }
    }
  }
  
  return bestResult;
};

/**
 * Measure height from sub-pixel edge points
 * @param {Array} edges - Array of sub-pixel edge points
 * @param {number} width - Canvas width
 * @param {number} height - Canvas height
 * @returns {Object} Measurement result
 */
const measureHeightFromEdges = (edges, width, height) => {
  // Filter major edges
  const majorEdges = edges.filter(edge => edge.isMajor);
  
  // If not enough major edges, use all edges
  const edgesToUse = majorEdges.length >= 2 ? majorEdges : edges;
  
  // Try multiple scan lines to find the best pair of edges
  const scanLines = [
    Math.floor(width * 0.3),
    Math.floor(width * 0.4),
    Math.floor(width * 0.5), // Middle
    Math.floor(width * 0.6),
    Math.floor(width * 0.7)
  ];
  
  let bestResult = null;
  let maxScore = 0;
  
  // Process each scan line
  for (const scanLine of scanLines) {
    // Find edges near this scan line
    const nearbyEdges = edgesToUse.filter(
      edge => Math.abs(edge.subpixelX - scanLine) < 5
    );
    
    // Sort by Y position
    nearbyEdges.sort((a, b) => a.subpixelY - b.subpixelY);
    
    // Find pairs of edges
    for (let i = 0; i < nearbyEdges.length - 1; i++) {
      const topEdge = nearbyEdges[i];
      
      // Look for edges on the bottom side
      for (let j = i + 1; j < nearbyEdges.length; j++) {
        const bottomEdge = nearbyEdges[j];
        
        // Calculate height
        const edgeDistance = bottomEdge.subpixelY - topEdge.subpixelY;
        
        // Skip pairs that are too close or too far apart
        if (edgeDistance < height * 0.05 || edgeDistance > height * 0.9) continue;
        
        // Calculate score (based on contrast and distance)
        const score = (topEdge.contrast + bottomEdge.contrast) * 
                    Math.min(1, edgeDistance / (height * 0.2));
        
        // Keep the best result
        if (score > maxScore) {
          maxScore = score;
          bestResult = {
            topEdge: topEdge.subpixelY,
            bottomEdge: bottomEdge.subpixelY,
            pixelMeasurement: edgeDistance,
            scanLine: (topEdge.subpixelX + bottomEdge.subpixelX) / 2,
            strength: score
          };
        }
      }
    }
  }
  
  return bestResult;
};

/**
 * Visualize measurement on canvas
 * @param {HTMLCanvasElement} canvas - The canvas element to draw on
 * @param {Object} result - Measurement result
 * @param {string} mode - Measurement mode ('width', 'height', or 'length')
 */
const visualizeMeasurement = (canvas, result, mode) => {
  if (!canvas || !result) return;
  
  const ctx = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;
  
  // Draw scan line used
  ctx.strokeStyle = 'rgba(255, 0, 0, 0.7)';
  ctx.lineWidth = 1;
  
  if (mode === 'width') {
    // Draw horizontal scan line
    ctx.beginPath();
    ctx.moveTo(0, result.scanLine);
    ctx.lineTo(width, result.scanLine);
    ctx.stroke();
    
    // Draw detected edges
    ctx.strokeStyle = 'rgba(0, 255, 0, 1)';
    ctx.lineWidth = 2;
    
    // Left edge
    ctx.beginPath();
    ctx.moveTo(result.leftEdge, 0);
    ctx.lineTo(result.leftEdge, height);
    ctx.stroke();
    
    // Right edge
    ctx.beginPath();
    ctx.moveTo(result.rightEdge, 0);
    ctx.lineTo(result.rightEdge, height);
    ctx.stroke();
    
    // Draw measurement text
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(width - 150, 10, 140, 60);
    
    ctx.font = '14px Arial';
    ctx.fillStyle = 'rgba(255, 255, 255, 1)';
    const pixelText = `Width: ${result.pixelMeasurement.toFixed(2)} px`;
    const mmText = `Width: ${result.millimeterMeasurement.toFixed(2)} mm`;
    ctx.fillText(pixelText, width - 140, 30);
    ctx.fillText(mmText, width - 140, 50);
  } else if (mode === 'height') {
    // Draw vertical scan line
    ctx.beginPath();
    ctx.moveTo(result.scanLine, 0);
    ctx.lineTo(result.scanLine, height);
    ctx.stroke();
    
    // Draw detected edges
    ctx.strokeStyle = 'rgba(0, 255, 0, 1)';
    ctx.lineWidth = 2;
    
    // Top edge
    ctx.beginPath();
    ctx.moveTo(0, result.topEdge);
    ctx.lineTo(width, result.topEdge);
    ctx.stroke();
    
    // Bottom edge
    ctx.beginPath();
    ctx.moveTo(0, result.bottomEdge);
    ctx.lineTo(width, result.bottomEdge);
    ctx.stroke();
    
    // Draw measurement text
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(width - 150, 10, 140, 60);
    
    ctx.font = '14px Arial';
    ctx.fillStyle = 'rgba(255, 255, 255, 1)';
    const pixelText = `Height: ${result.pixelMeasurement.toFixed(2)} px`;
    const mmText = `Height: ${result.millimeterMeasurement.toFixed(2)} mm`;
    ctx.fillText(pixelText, width - 140, 30);
    ctx.fillText(mmText, width - 140, 50);
  }
}