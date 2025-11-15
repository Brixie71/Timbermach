import React, { useState, useRef, useEffect } from 'react';
import { 
  Camera, 
  Upload, 
  Maximize2,
  ZoomIn,
  Layers,
  FileImage,
  Ruler,
  Settings,
  RefreshCw
} from 'lucide-react';

// Import utility functions
import { 
  convertToGrayscale,
  enhanceContrast,
  gaussianSmooth,
  adaptiveThreshold,
  detectHorizontalEdges,
  detectVerticalEdges,
  processImageForEdgeDetection,
  visualizeEdges,
  detectWoodDimensions
} from './EdgeDetectionUtils';

const Measurement = () => {
  // States for image processing
  const [originalImage, setOriginalImage] = useState(null);
  const [grayScaleImage, setGrayScaleImage] = useState(null);
  const [edgeImage, setEdgeImage] = useState(null);
  const [threshold, setThreshold] = useState(240); // Default threshold for binary image
  const [sigma, setSigma] = useState(1.5); // Slightly more smoothing to reduce noise
  const [showMinorEdges, setShowMinorEdges] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [edgePoints, setEdgePoints] = useState([]);
  const [calibrationFactor, setCalibrationFactor] = useState(0.0145503); // Default mm per pixel
  const [showCalibration, setShowCalibration] = useState(false);
  const [referencePixels, setReferencePixels] = useState(100);
  const [referenceMillimeters, setReferenceMillimeters] = useState(10);
  const [measurementResult, setMeasurementResult] = useState(null);
  const [measurementMode, setMeasurementMode] = useState('width'); // 'width', 'height', or 'length'

  // Refs for the canvas elements
  const originalCanvasRef = useRef(null);
  const grayScaleCanvasRef = useRef(null);
  const edgeCanvasRef = useRef(null);

  // Handle image upload
  const handleImageUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        setOriginalImage(img);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  };

  // Calculate calibration factor
  const calculateCalibrationFactor = () => {
    if (referencePixels <= 0) return;
    const newFactor = referenceMillimeters / referencePixels;
    setCalibrationFactor(newFactor);
    setShowCalibration(false);
  };

  // Process image to grayscale and apply binary thresholding when original image changes
  useEffect(() => {
    if (!originalImage || !grayScaleCanvasRef.current) return;
    
    const canvas = grayScaleCanvasRef.current;
    const ctx = canvas.getContext('2d');
    
    // Set canvas dimensions to match image
    canvas.width = originalImage.width;
    canvas.height = originalImage.height;
    
    // Draw original image
    ctx.drawImage(originalImage, 0, 0);
    
    // Get image data for processing
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    
    // Convert to grayscale
    const grayscaleImageData = convertToGrayscale(imageData);
    
    // Apply binary thresholding with optional blur
    const binaryImageData = applyBinaryThresholding(
      grayscaleImageData.data, 
      grayscaleImageData.width, 
      grayscaleImageData.height, 
      threshold, 
      sigma
    );
    
    // Put binary image back to canvas
    ctx.putImageData(binaryImageData, 0, 0);
    
    // Store binary image for edge detection
    setGrayScaleImage(binaryImageData);
    
    // Also draw original image on its canvas
    if (originalCanvasRef.current) {
      const origCanvas = originalCanvasRef.current;
      const origCtx = origCanvas.getContext('2d');
      origCanvas.width = originalImage.width;
      origCanvas.height = originalImage.height;
      origCtx.drawImage(originalImage, 0, 0);
    }
    
  }, [originalImage, threshold, sigma]);

  // Perform edge detection when grayscale image changes or parameters update
  useEffect(() => {
    if (!grayScaleImage || !edgeCanvasRef.current) return;
    
    setIsProcessing(true);
    
    // Use setTimeout to avoid blocking the UI
    setTimeout(() => {
      const canvas = edgeCanvasRef.current;
      const ctx = canvas.getContext('2d');
      
      // Set canvas dimensions
      canvas.width = grayScaleImage.width;
      canvas.height = grayScaleImage.height;
      
      // Perform edge detection
      const edgeDetectionResult = detectEdges(grayScaleImage, ctx, threshold, sigma, showMinorEdges);
      setEdgePoints(edgeDetectionResult.edgePoints);
      
      setIsProcessing(false);
    }, 10);
  }, [grayScaleImage, threshold, sigma, showMinorEdges]);

  // Apply binary thresholding with Gaussian blur for noise reduction
  const applyBinaryThresholding = (data, width, height, threshold, sigma) => {
    // Create a temporary canvas for processing
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = width;
    tempCanvas.height = height;
    const tempCtx = tempCanvas.getContext('2d');
    
    // Create ImageData
    const imageData = tempCtx.createImageData(width, height);
    
    // Copy data to imageData
    for (let i = 0; i < data.length; i++) {
      imageData.data[i] = data[i];
    }
    
    // Put image data to canvas
    tempCtx.putImageData(imageData, 0, 0);
    
    // Apply Gaussian blur if sigma > 0
    if (sigma > 0) {
      const blurRadius = Math.ceil(sigma * 2); // Adjust blur based on sigma
      tempCtx.filter = `blur(${blurRadius}px)`;
      tempCtx.drawImage(tempCanvas, 0, 0);
    }
    
    // Get blurred image data
    const processedData = tempCtx.getImageData(0, 0, width, height);
    
    // Apply binary threshold
    const binaryData = new Uint8ClampedArray(processedData.data.length);
    
    for (let i = 0; i < processedData.data.length; i += 4) {
      const r = processedData.data[i];
      const g = processedData.data[i + 1];
      const b = processedData.data[i + 2];
      
      // Calculate luminance (brightness)
      const brightness = 0.21 * r + 0.72 * g + 0.07 * b;
      
      // Apply thresholding
      const value = brightness >= threshold ? 255 : 0;
      
      binaryData[i] = value;     // R
      binaryData[i + 1] = value; // G
      binaryData[i + 2] = value; // B
      binaryData[i + 3] = 255;   // Alpha
    }
    
    // Create result ImageData
    const result = new ImageData(binaryData, width, height);
    return result;
  };

  // Custom edge detection function with sub-pixel accuracy
  const detectEdges = (imageData, ctx, threshold, sigma, showMinorEdges) => {
    // Create a copy of the grayscale image data
    const width = imageData.width;
    const height = imageData.height;
    
    // Apply Gaussian blur to reduce noise if sigma > 0
    let processedData;
    if (sigma > 0) {
      // Create a temporary canvas for blurring
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = width;
      tempCanvas.height = height;
      const tempCtx = tempCanvas.getContext('2d');
      
      // Draw original grayscale image
      tempCtx.putImageData(imageData, 0, 0);
      
      // Apply Gaussian blur
      const blurRadius = Math.ceil(sigma * 3); // 3 sigma rule
      tempCtx.filter = `blur(${blurRadius}px)`;
      tempCtx.drawImage(tempCanvas, 0, 0);
      
      // Get blurred image data
      processedData = tempCtx.getImageData(0, 0, width, height);
    } else {
      // No blur, use original data
      processedData = imageData;
    }
    
    // Create output image for edge detection
    const outputData = ctx.createImageData(width, height);
    const output = outputData.data;
    
    // First pass: calculate gradient using Sobel operator
    const sobelData = applySobelOperator(processedData.data, width, height);
    
    // Second pass: non-maximum suppression (Canny-like)
    const suppressedData = nonMaximumSuppression(sobelData, width, height);
    
    // Apply thresholding to find edge points
    const edges = [];
    const edgePoints = [];
    const meanshiftThreshold = threshold * 2.5; // Higher threshold for major edges
    
    // First pass: find the strongest edges using meanshift-like approach
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x);
        const gradientMagnitude = suppressedData.magnitudes[idx];
        
        // Apply higher threshold for main structural edges
        if (gradientMagnitude > meanshiftThreshold) {
          // This is a major edge point
          edges.push({ 
            x, y, 
            magnitude: gradientMagnitude,
            direction: suppressedData.directions[idx],
            gradX: sobelData.gradientX[idx],
            gradY: sobelData.gradientY[idx],
            isMajor: true
          });
          
          // Set pixel in output (white)
          const outIdx = (y * width + x) * 4;
          output[outIdx] = 255;     // R
          output[outIdx + 1] = 255; // G
          output[outIdx + 2] = 255; // B
          output[outIdx + 3] = 255; // A
        } else if (gradientMagnitude > threshold && showMinorEdges) {
          // This is a minor edge point - only show if minor edges are enabled
          edges.push({ 
            x, y, 
            magnitude: gradientMagnitude,
            direction: suppressedData.directions[idx],
            gradX: sobelData.gradientX[idx],
            gradY: sobelData.gradientY[idx],
            isMajor: false
          });
          
          // Set pixel in output (light gray) - display minor edges with less emphasis
          const outIdx = (y * width + x) * 4;
          output[outIdx] = 180;     // R
          output[outIdx + 1] = 180; // G
          output[outIdx + 2] = 180; // B
          output[outIdx + 3] = 255; // A
        } else if (gradientMagnitude > threshold && !showMinorEdges) {
          // This is a minor edge point but we're not showing them
          edges.push({ 
            x, y, 
            magnitude: gradientMagnitude,
            direction: suppressedData.directions[idx],
            gradX: sobelData.gradientX[idx],
            gradY: sobelData.gradientY[idx],
            isMajor: false
          });
          
          // Set pixel in output (black) - don't display minor edges
          const outIdx = (y * width + x) * 4;
          output[outIdx] = 0;       // R
          output[outIdx + 1] = 0;   // G
          output[outIdx + 2] = 0;   // B
          output[outIdx + 3] = 255; // A
        } else {
          // Not an edge at all
          const outIdx = (y * width + x) * 4;
          output[outIdx] = 0;       // R
          output[outIdx + 1] = 0;   // G
          output[outIdx + 2] = 0;   // B
          output[outIdx + 3] = 255; // A
        }
      }
    }
    
    // Render edge image
    ctx.putImageData(outputData, 0, 0);
    
    // Apply sub-pixel refinement using Devernay's method
    if (edges.length > 0) {
      const refinedEdges = refineEdgesWithDevernay(edges, processedData.data, width, height);
      
      // Draw refined edges for visualization
      ctx.strokeStyle = 'rgba(255, 0, 0, 0.7)';
      ctx.lineWidth = 0.5;
      
      for (const edge of refinedEdges) {
        if (edge.quality > 10) { // Only draw higher quality edges
          ctx.beginPath();
          ctx.arc(edge.subpixelX, edge.subpixelY, 0.5, 0, 2 * Math.PI);
          ctx.fillStyle = edge.isMajor ? 'rgba(0, 255, 0, 0.7)' : 'rgba(255, 255, 0, 0.7)';
          ctx.fill();
          
          edgePoints.push({
            x: edge.subpixelX,
            y: edge.subpixelY,
            magnitude: edge.magnitude,
            isMajor: edge.isMajor
          });
        }
      }
    }
    
    return { edgePoints };
  };

  // Apply Sobel operator to find gradients
  const applySobelOperator = (data, width, height) => {
    // Sobel kernels
    const sobelX = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
    const sobelY = [-1, -2, -1, 0, 0, 0, 1, 2, 1];
    
    // Result arrays
    const magnitudes = new Array(width * height);
    const directions = new Array(width * height);
    const gradientX = new Array(width * height);
    const gradientY = new Array(width * height);
    
    // Apply Sobel operator
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        let gx = 0;
        let gy = 0;
        
        // Apply kernels
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const idx = ((y + ky) * width + (x + kx)) * 4;
            const kernelIdx = (ky + 1) * 3 + (kx + 1);
            
            gx += data[idx] * sobelX[kernelIdx];
            gy += data[idx] * sobelY[kernelIdx];
          }
        }
        
        // Calculate magnitude and direction
        const idx = y * width + x;
        gradientX[idx] = gx;
        gradientY[idx] = gy;
        magnitudes[idx] = Math.sqrt(gx * gx + gy * gy);
        directions[idx] = Math.atan2(gy, gx);
      }
    }
    
    return { magnitudes, directions, gradientX, gradientY };
  };

  // Non-maximum suppression with edge consistency verification
  const nonMaximumSuppression = (gradientData, width, height) => {
    const { magnitudes, directions, gradientX, gradientY } = gradientData;
    const result = {
      magnitudes: new Array(width * height).fill(0),
      directions: [...directions]
    };
    
    // First pass: standard non-maximum suppression
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;
        const direction = directions[idx];
        const magnitude = magnitudes[idx];
        
        // Skip very weak gradients immediately
        if (magnitude < 5) continue;
        
        // Find neighboring pixels in gradient direction
        let neighbor1Idx, neighbor2Idx;
        
        // Horizontalish edge (vertical gradient)
        if ((direction >= -Math.PI/8 && direction < Math.PI/8) || 
            (direction >= 7*Math.PI/8 || direction < -7*Math.PI/8)) {
          neighbor1Idx = y * width + (x + 1);
          neighbor2Idx = y * width + (x - 1);
        }
        // Diagonalish edge (45 degrees)
        else if ((direction >= Math.PI/8 && direction < 3*Math.PI/8) || 
                (direction >= -7*Math.PI/8 && direction < -5*Math.PI/8)) {
          neighbor1Idx = (y - 1) * width + (x + 1);
          neighbor2Idx = (y + 1) * width + (x - 1);
        }
        // Verticalish edge (horizontal gradient)
        else if ((direction >= 3*Math.PI/8 && direction < 5*Math.PI/8) || 
                (direction >= -5*Math.PI/8 && direction < -3*Math.PI/8)) {
          neighbor1Idx = (y - 1) * width + x;
          neighbor2Idx = (y + 1) * width + x;
        }
        // Diagonalish edge (135 degrees)
        else {
          neighbor1Idx = (y - 1) * width + (x - 1);
          neighbor2Idx = (y + 1) * width + (x + 1);
        }
        
        // Compare with neighbors
        if (magnitude >= magnitudes[neighbor1Idx] && magnitude >= magnitudes[neighbor2Idx]) {
          result.magnitudes[idx] = magnitude;
        }
      }
    }
    
    // Second pass: edge consistency improvement
    const improvedMagnitudes = new Array(width * height).fill(0);
    
    for (let y = 2; y < height - 2; y++) {
      for (let x = 2; x < width - 2; x++) {
        const idx = y * width + x;
        
        // Skip if not an edge point from first pass
        if (result.magnitudes[idx] === 0) continue;
        
        // Look for consistent edge direction in neighborhood
        const direction = directions[idx];
        let consistentNeighbors = 0;
        
        // Check 5x5 neighborhood for consistent edge directions
        for (let ny = y - 2; ny <= y + 2; ny++) {
          for (let nx = x - 2; nx <= x + 2; nx++) {
            const nIdx = ny * width + nx;
            
            // Skip non-edge points
            if (result.magnitudes[nIdx] === 0) continue;
            
            // Check if direction is consistent
            const neighborDir = directions[nIdx];
            const angleDiff = Math.abs(direction - neighborDir);
            
            // Consider angles within PI/6 (30°) to be consistent
            if (angleDiff < Math.PI/6 || angleDiff > Math.PI - Math.PI/6) {
              consistentNeighbors++;
            }
          }
        }
        
        // If we have several neighbors with consistent direction, this is likely
        // part of a major edge rather than texture
        if (consistentNeighbors >= 3) {
          // Boost the magnitude to help it pass the threshold later
          improvedMagnitudes[idx] = result.magnitudes[idx] * 1.5;
        } else {
          // Keep original magnitude
          improvedMagnitudes[idx] = result.magnitudes[idx];
        }
      }
    }
    
    return {
      magnitudes: improvedMagnitudes,
      directions: result.directions
    };
  };

  // Calculate sub-pixel offset using Devernay's method
  const calculateSubPixelOffset = (a, b, c) => {
    // Devernay's formula - η = 0.5 * (a-c)/(a+c-2b)
    if (b <= a || b <= c) return 0; // Ensure b is a maximum
    
    // Avoid division by zero
    const denominator = a + c - 2 * b;
    if (Math.abs(denominator) < 0.0001) return 0;
    
    return 0.5 * (a - c) / denominator;
  };

  // Refine edges with Devernay's quadratic interpolation
  const refineEdgesWithDevernay = (edges, imageData, width, height) => {
    const refinedEdges = [];
    
    for (const edge of edges) {
      const { x, y, gradX, gradY, magnitude, isMajor } = edge;
      
      // Skip edge points too close to the image boundaries
      if (x < 1 || y < 1 || x >= width - 1 || y >= height - 1) continue;
      
      // Calculate gradient direction (normalized)
      const gradMagnitude = Math.sqrt(gradX * gradX + gradY * gradY);
      if (gradMagnitude < 0.0001) continue;
      
      const normalizedGradX = gradX / gradMagnitude;
      const normalizedGradY = gradY / gradMagnitude;
      
      // Get gradient magnitude values in the gradient direction
      const xStep = Math.abs(normalizedGradX) >= Math.abs(normalizedGradY) ? Math.sign(normalizedGradX) : 0;
      const yStep = Math.abs(normalizedGradY) > Math.abs(normalizedGradX) ? Math.sign(normalizedGradY) : 0;
      
      // Values for quadratic interpolation (pixel positions)
      const x1 = x - xStep;
      const y1 = y - yStep;
      const x3 = x + xStep;
      const y3 = y + yStep;
      
      // Get gradient magnitude at these positions
      const idx1 = ((y1 * width) + x1) * 4;
      const idx2 = ((y * width) + x) * 4;
      const idx3 = ((y3 * width) + x3) * 4;
      
      const a = imageData[idx1]; // Using red channel (already grayscale)
      const b = imageData[idx2];
      const c = imageData[idx3];
      
      // Calculate sub-pixel offset using Devernay's formula
      const offset = calculateSubPixelOffset(a, b, c);
      
      // Calculate sub-pixel position
      const subpixelX = x + offset * normalizedGradX;
      const subpixelY = y + offset * normalizedGradY;
      
      // Store refined edge point
      refinedEdges.push({
        originalX: x,
        originalY: y,
        subpixelX,
        subpixelY,
        magnitude,
        quality: magnitude * (1 - Math.abs(offset)), // Quality metric
        isMajor
      });
    }
    
    return refinedEdges;
  };

  // Perform measurement
  const performMeasurement = () => {
    if (!originalImage || !edgeCanvasRef.current) return;
    
    const canvas = edgeCanvasRef.current;
    const ctx = canvas.getContext('2d');
    
    // Get current canvas image data for processing
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    
    // Use appropriate detection method based on measurement mode
    let edgeResults = null;
    if (measurementMode === 'width') {
      edgeResults = detectHorizontalEdgesWithSubPixel(imageData, canvas);
    } else if (measurementMode === 'height') {
      edgeResults = detectVerticalEdgesWithSubPixel(imageData, canvas);
    }
    
    if (edgeResults) {
      // Calculate measurement in millimeters
      let pixelMeasurement = 0;
      if (measurementMode === 'width') {
        pixelMeasurement = edgeResults.widthPixels;
      } else if (measurementMode === 'height') {
        pixelMeasurement = edgeResults.heightPixels;
      }
      
      const millimeterMeasurement = pixelMeasurement * calibrationFactor;
      
      // Update measurement result
      setMeasurementResult({
        pixelMeasurement: pixelMeasurement.toFixed(2),
        millimeterMeasurement: millimeterMeasurement.toFixed(2),
        edgeQuality: Math.round(edgeResults.strength / 50),
        mode: measurementMode
      });
      
      // Visualize the measurement on canvas
      visualizeMeasurement(canvas, edgeResults, measurementMode);
    }
  };

  // Detect horizontal edges with sub-pixel accuracy
  const detectHorizontalEdgesWithSubPixel = (imageData, canvas) => {
    const width = canvas.width;
    const height = canvas.height;
    const data = imageData.data;
    
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
      const profileData = [];
      
      // Extract profile data (grayscale values) across the row
      for (let x = 0; x < width; x++) {
        const pixelIndex = (rowY * width + x) * 4;
        profileData.push(data[pixelIndex]); // Grayscale value
      }
      
      // Apply Gaussian smoothing to reduce noise
      const smoothedProfile = gaussianSmooth(profileData, 2);
      
      // Calculate gradient (first derivative)
      const gradient = [];
      for (let i = 1; i < smoothedProfile.length - 1; i++) {
        gradient.push((smoothedProfile[i+1] - smoothedProfile[i-1]) / 2);
      }
      
      // Calculate average gradient magnitude
      let totalGradientMagnitude = 0;
      for (let i = 0; i < gradient.length; i++) {
        totalGradientMagnitude += Math.abs(gradient[i]);
      }
      const avgGradientMagnitude = totalGradientMagnitude / gradient.length;
      const gradientThreshold = Math.max(5, avgGradientMagnitude * 2);
      
      // Find all edges (transitions between light and dark)
      const rowEdges = [];
      for (let i = 1; i < gradient.length - 1; i++) {
        if ((gradient[i] > gradientThreshold && gradient[i+1] < -gradientThreshold) || 
            (gradient[i] < -gradientThreshold && gradient[i+1] > gradientThreshold)) {
          
          // Calculate sub-pixel position using Devernay's method
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
          
          const subpixelOffset = calculateSubPixelOffset(a, b, c);
          const x = i + 1 + subpixelOffset;
          const strength = Math.abs(gradient[i]);
          rowEdges.push({ position: x, strength });
        }
      }
      
      // If we found edges, analyze them
      if (rowEdges.length >= 2) {
        rowEdges.sort((a, b) => a.position - b.position);
        
        // Find the best pair of edges (based on darkness between them)
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
              const pixelIndex = (rowY * width + x) * 4;
              totalDarkness += (255 - data[pixelIndex]); // Invert so darker is higher value
              pixelCount++;
            }
          }
          
          const avgDarkness = totalDarkness / pixelCount;
          const combinedScore = avgDarkness * (rowEdges[i].strength + rowEdges[i+1].strength) / 2;
          
          if (combinedScore > maxDarkness) {
            maxDarkness = combinedScore;
            bestLeftEdge = leftEdge;
            bestRightEdge = rightEdge;
          }
        }
        
        // If we found a good pair of edges
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
    
    return bestEdgeResult;
  };

  // Detect vertical edges with sub-pixel accuracy
  const detectVerticalEdgesWithSubPixel = (imageData, canvas) => {
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
      const profileData = [];
      
      // Extract profile data (grayscale values) down the column
      for (let y = 0; y < height; y++) {
        const pixelIndex = (y * width + colX) * 4;
        profileData.push(data[pixelIndex]); // Grayscale value
      }
      
      // Apply Gaussian smoothing to reduce noise
      const smoothedProfile = gaussianSmooth(profileData, 2);
      
      // Calculate gradient (first derivative)
      const gradient = [];
      for (let i = 1; i < smoothedProfile.length - 1; i++) {
        gradient.push((smoothedProfile[i+1] - smoothedProfile[i-1]) / 2);
      }
      
      // Calculate average gradient magnitude
      let totalGradientMagnitude = 0;
      for (let i = 0; i < gradient.length; i++) {
        totalGradientMagnitude += Math.abs(gradient[i]);
      }
      const avgGradientMagnitude = totalGradientMagnitude / gradient.length;
      const gradientThreshold = Math.max(5, avgGradientMagnitude * 2);
      
      // Find all edges (transitions between light and dark)
      const colEdges = [];
      for (let i = 1; i < gradient.length - 1; i++) {
        if ((gradient[i] > gradientThreshold && gradient[i+1] < -gradientThreshold) || 
            (gradient[i] < -gradientThreshold && gradient[i+1] > gradientThreshold)) {
          
          // Calculate sub-pixel position using Devernay's method
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
          
          const subpixelOffset = calculateSubPixelOffset(a, b, c);
          const y = i + 1 + subpixelOffset;
          const strength = Math.abs(gradient[i]);
          colEdges.push({ position: y, strength });
        }
      }
      
      // If we found edges, analyze them
      if (colEdges.length >= 2) {
        colEdges.sort((a, b) => a.position - b.position);
        
        // Find the best pair of edges (based on darkness between them)
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
          const combinedScore = avgDarkness * (colEdges[i].strength + colEdges[i+1].strength) / 2;
          
          if (combinedScore > maxDarkness) {
            maxDarkness = combinedScore;
            bestTopEdge = topEdge;
            bestBottomEdge = bottomEdge;
          }
        }
        
        // If we found a good pair of edges
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
    
    return bestEdgeResult;
  };

  // Gaussian smoothing function
  const gaussianSmooth = (data, sigma) => {
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

  // Visualize measurement on canvas
  const visualizeMeasurement = (canvas, edgeResults, mode) => {
    if (!canvas || !edgeResults) return;
    
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    
    // Draw scan line used
    ctx.strokeStyle = 'rgba(255, 0, 0, 0.7)';
    ctx.lineWidth = 1;
    
    if (mode === 'width') {
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
      
      // Draw measurement text
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(width - 150, 10, 140, 60);
      
      ctx.font = '14px Arial';
      ctx.fillStyle = 'rgba(255, 255, 255, 1)';
      const pixelText = `Width: ${edgeResults.widthPixels.toFixed(2)} px`;
      const mmText = `Width: ${(edgeResults.widthPixels * calibrationFactor).toFixed(2)} mm`;
      ctx.fillText(pixelText, width - 140, 30);
      ctx.fillText(mmText, width - 140, 50);
    } else if (mode === 'height') {
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
      
      // Draw measurement text
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(width - 150, 10, 140, 60);
      
      ctx.font = '14px Arial';
      ctx.fillStyle = 'rgba(255, 255, 255, 1)';
      const pixelText = `Height: ${edgeResults.heightPixels.toFixed(2)} px`;
      const mmText = `Height: ${(edgeResults.heightPixels * calibrationFactor).toFixed(2)} mm`;
      ctx.fillText(pixelText, width - 140, 30);
      ctx.fillText(mmText, width - 140, 50);
    }
  };

  // Render the component
  return (
    <div className="container mx-auto p-4 bg-white shadow-lg rounded-lg">
      <div className="flex items-center mb-6">
        <Ruler className="w-8 h-8 mr-3 text-blue-600" />
        <h1 className="text-2xl font-bold text-gray-800">SubPixel Edge Measurement</h1>
      </div>
      
      {/* Controls Section */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Upload Image</label>
            <input 
              type="file" 
              accept="image/*" 
              onChange={handleImageUpload}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Brightness Threshold</label>
            <input 
              type="range" 
              min="180" 
              max="250" 
              value={threshold} 
              onChange={(e) => setThreshold(parseInt(e.target.value))}
              className="w-40 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
            <span className="ml-2 text-sm text-gray-600">{threshold}</span>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Smoothing (Sigma)</label>
            <input 
              type="range" 
              min="0.0" 
              max="2.0" 
              step="0.1" 
              value={sigma} 
              onChange={(e) => setSigma(parseFloat(e.target.value))}
              className="w-40 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
            <span className="ml-2 text-sm text-gray-600">{sigma.toFixed(1)}</span>
          </div>
          
          <div className="flex items-center">
            <label className="text-sm font-medium text-gray-700 mr-3">Show Minor Edges</label>
            <div className="relative inline-block w-10 mr-2 align-middle select-none">
              <input 
                type="checkbox" 
                checked={showMinorEdges} 
                onChange={() => setShowMinorEdges(!showMinorEdges)} 
                className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer"
                style={{
                  right: !showMinorEdges ? '0' : '4px',
                  transition: 'right 0.3s',
                  backgroundColor: !showMinorEdges ? 'white' : '#4299e1'
                }}
              />
              <div 
                className="toggle-label block overflow-hidden h-6 rounded-full cursor-pointer"
                style={{
                  backgroundColor: !showMinorEdges ? '#cbd5e0' : '#3182ce'
                }}
              ></div>
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Measurement Mode</label>
            <select
              value={measurementMode}
              onChange={(e) => setMeasurementMode(e.target.value)}
              className="block w-full px-3 py-2.5 text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="width">Width</option>
              <option value="height">Height</option>
            </select>
          </div>
          
          <div>
            <button 
              onClick={performMeasurement}
              className="px-4 py-2.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Perform Measurement
            </button>
          </div>
        </div>
        
        {/* Calibration controls */}
        {showCalibration ? (
          <div className="mt-4 p-4 border border-gray-200 rounded-lg bg-gray-50">
            <h3 className="text-lg font-medium text-gray-900 mb-2">Calibration</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reference Width (pixels)</label>
                <input 
                  type="number" 
                  value={referencePixels} 
                  onChange={(e) => setReferencePixels(Math.max(1, parseFloat(e.target.value)))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reference Width (mm)</label>
                <input 
                  type="number" 
                  value={referenceMillimeters} 
                  onChange={(e) => setReferenceMillimeters(Math.max(0.1, parseFloat(e.target.value)))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <div className="flex items-end">
                <button 
                  onClick={calculateCalibrationFactor}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 mr-2"
                >
                  Apply
                </button>
                <button 
                  onClick={() => setShowCalibration(false)}
                  className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-4 flex items-center">
            <div className="mr-4">
              <span className="text-sm font-medium text-gray-700">Current Calibration: </span>
              <span className="text-sm text-gray-600">{calibrationFactor.toFixed(6)} mm/pixel</span>
            </div>
            <button 
              onClick={() => setShowCalibration(true)}
              className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 flex items-center"
            >
              <Settings className="w-4 h-4 mr-1" />
              Calibrate
            </button>
          </div>
        )}
      </div>
      
      {/* Results Display */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="border rounded-lg overflow-hidden">
          <div className="bg-gray-100 px-4 py-2 font-medium flex items-center">
            <FileImage className="w-4 h-4 mr-2" />
            Original Image
          </div>
          <div className="p-2">
            <canvas 
              ref={originalCanvasRef} 
              className="mx-auto"
              style={{ display: originalImage ? 'block' : 'none' }}
            />
            {!originalImage && (
              <div className="h-48 flex items-center justify-center text-gray-400">
                No image uploaded
              </div>
            )}
          </div>
        </div>
        
        <div className="border rounded-lg overflow-hidden">
          <div className="bg-gray-100 px-4 py-2 font-medium flex items-center">
            <Layers className="w-4 h-4 mr-2" />
            Binary Threshold
          </div>
          <div className="p-2">
            <canvas 
              ref={grayScaleCanvasRef}
              className="mx-auto"
              style={{ display: grayScaleImage ? 'block' : 'none' }}
            />
            {!grayScaleImage && (
              <div className="h-48 flex items-center justify-center text-gray-400">
                No grayscale processed
              </div>
            )}
          </div>
        </div>
        
        <div className="border rounded-lg overflow-hidden">
          <div className="bg-gray-100 px-4 py-2 font-medium flex items-center">
            <ZoomIn className="w-4 h-4 mr-2" />
            Edge Detection
          </div>
          <div className="p-2 relative">
            <canvas 
              ref={edgeCanvasRef}
              className="mx-auto"
            />
            {isProcessing && (
              <div className="absolute inset-0 bg-white bg-opacity-70 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
              </div>
            )}
            {!grayScaleImage && !isProcessing && (
              <div className="h-48 flex items-center justify-center text-gray-400">
                No edges detected
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Measurement Results */}
      {measurementResult && (
        <div className="mt-6 p-4 bg-blue-50 rounded-lg">
          <h2 className="text-lg font-semibold text-blue-800 mb-2">Measurement Results</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-blue-700">
                <span className="font-medium">
                  {measurementResult.mode === 'width' ? 'Width' : 'Height'}:
                </span> {measurementResult.pixelMeasurement} pixels
              </p>
            </div>
            <div>
              <p className="text-blue-700">
                <span className="font-medium">
                  {measurementResult.mode === 'width' ? 'Width' : 'Height'}:
                </span> {measurementResult.millimeterMeasurement} mm
              </p>
            </div>
            <div>
              <p className="text-blue-700">
                <span className="font-medium">Quality Score:</span> {measurementResult.edgeQuality}
              </p>
            </div>
          </div>
        </div>
      )}
      
      {/* Information Section */}
      <div className="mt-6 text-sm text-gray-500">
        <p>This implementation applies binary thresholding with sub-pixel edge detection to accurately measure object dimensions.</p>
        <p>The threshold slider controls the cutoff between white and black areas. Higher values make the filter more strict.</p>
        <p>Measurements are performed with sub-pixel accuracy using Canny/Devernay algorithm for enhanced precision.</p>
        <p>For the most accurate millimeter measurements, calibrate the system using an object of known dimensions.</p>
      </div>
    </div>
  );
};

export default Measurement;