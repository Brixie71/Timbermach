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
};import React, { useState, useRef, useEffect } from 'react';
import { 
Camera, 
Upload, 
Maximize2,
ZoomIn,
Layers,
FileImage
} from 'lucide-react';

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
  
  // Apply binary thresholding with optional blur
  const binaryImageData = applyBinaryThresholding(
    imageData.data, 
    imageData.width, 
    imageData.height, 
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
    
    // Perform edge detection with Zernike-inspired approach
    detectEdges(grayScaleImage, ctx, threshold, sigma);
    
    setIsProcessing(false);
  }, 10);
}, [grayScaleImage, threshold, sigma, showMinorEdges]);

// Custom edge detection function inspired by Zernike moments approach
const detectEdges = (imageData, ctx, threshold, sigma) => {
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
  
  // Apply thresholding to find edge points - with meanshift-like approach to isolate major edges
  const edges = [];
  const meanshiftThreshold = threshold * 2.5; // Higher threshold for major edges
  
  // First pass: find the strongest edges using meanshift-like approach
  // This helps isolate main object boundaries (like wood edges) from texture/noise
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
  
  // Store edge points for potential further processing
  setEdgePoints(edges);
  
  // Render edge image
  ctx.putImageData(outputData, 0, 0);
  
  // Apply Zernike moment-based subpixel refinement
  if (edges.length > 0) {
    refineEdgesWithZernike(ctx, edges, imageData.data, width, height);
  }
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

// Non-maximum suppression with edge consistency verification (improved Canny)
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
  // Looking for strong, consistent edges (like wood boundaries)
  // rather than texture or noise
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
      // part of a major edge (like wood boundary) rather than texture
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

// Implement Zernike moment-based subpixel refinement as described in the paper
const refineEdgesWithZernike = (ctx, edges, imageData, width, height) => {
  // Draw refined edges
  ctx.strokeStyle = 'rgba(255, 0, 0, 0.7)';
  ctx.lineWidth = 0.5;
  
  // Define Zernike mask constant values (from the paper)
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
  
  const N = 7; // Neighborhood size for Zernike mask (7x7)
  const refinedEdges = [];
  
  // Process edge points with Zernike moment method
  for (let i = 0; i < edges.length; i++) {
    const { x, y, gradX, gradY } = edges[i];
    
    // Skip edge points too close to the image boundaries
    if (x < 3 || y < 3 || x >= width - 3 || y >= height - 3) continue;
    
    // Extract 7x7 neighborhood around the edge point
    const neighborhood = extract7x7Neighborhood(imageData, width, x, y);
    
    // Calculate Zernike moments using the masks
    const Z00 = applyMask(neighborhood, ZERPOLY00);
    const Z11R = applyMask(neighborhood, ZERPOLY11R);
    const Z11I = applyMask(neighborhood, ZERPOLY11I);
    const Z20 = applyMask(neighborhood, ZERPOLY20);
    const Z40 = applyMask(neighborhood, ZERPOLY40);
    
    // Calculate edge orientation
    const phi = Math.atan2(Z11I, Z11R);
    
    // Calculate edge parameters as per Zernike paper formulas
    // Calculate l parameter - the distance from center of window to edge
    const l1 = Math.sqrt((5 * Z40 + 3 * Z20) / (8 * Z20));
    const l2 = Math.sqrt((5 * Z11R + Z11I) / (6 * Z11I)); 
    const l = (l1 + l2) / 2;
    
    // Calculate edge strength (contrast parameter)
    const k = (3 * Z11I) / (2 * Math.pow(1 - l * l, 1.5));
    
    // Calculate background level
    const h = (1/Math.PI) * (Z00 - (k * Math.PI / 2) + k * Math.asin(l) + k * l * Math.sqrt(1 - l * l));
    
    // Calculate subpixel edge position
    const xOffset = l * Math.cos(phi);
    const yOffset = l * Math.sin(phi);
    
    // Store refined edge point
    refinedEdges.push({
      originalX: x,
      originalY: y,
      subpixelX: x + xOffset,
      subpixelY: y + yOffset,
      strength: k,
      orientation: phi
    });
    
    // Visualize high-quality edge points (with sufficient contrast/strength)
    if (k > 10) { // Arbitrary threshold for visualization
      // Draw point
      ctx.beginPath();
      ctx.arc(x + xOffset, y + yOffset, 0.5, 0, 2 * Math.PI);
      ctx.fillStyle = 'rgba(0, 255, 0, 0.7)';
      ctx.fill();
    }
  }
  
  return refinedEdges;
};

// Helper function to extract 7x7 neighborhood around point (x,y)
const extract7x7Neighborhood = (imageData, width, x, y) => {
  const neighborhood = new Array(7).fill(0).map(() => new Array(7).fill(0));
  
  for (let dy = -3; dy <= 3; dy++) {
    for (let dx = -3; dx <= 3; dx++) {
      const pixelX = x + dx;
      const pixelY = y + dy;
      
      // Bounds check
      if (pixelX >= 0 && pixelX < width && pixelY >= 0 && pixelY < imageData.height) {
        const idx = (pixelY * width + pixelX) * 4;
        neighborhood[dy + 3][dx + 3] = imageData.data[idx]; // Use red channel for grayscale
      }
    }
  }
  
  return neighborhood;
};

// Apply Zernike mask to a neighborhood
const applyMask = (neighborhood, mask) => {
  let sum = 0;
  
  for (let y = 0; y < 7; y++) {
    for (let x = 0; x < 7; x++) {
      sum += neighborhood[y][x] * mask[y][x];
    }
  }
  
  return sum;
};

return (
  <div className="container mx-auto p-4 bg-white shadow-lg rounded-lg">
    <div className="flex items-center mb-6">
      <Camera className="w-8 h-8 mr-3 text-blue-600" />
      <h1 className="text-2xl font-bold text-gray-800">Zernike-Based Edge Detection Measurement</h1>
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
          <label className="text-sm font-medium text-gray-700 mr-3">Show Edges Only</label>
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
      </div>
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
          {showMinorEdges ? "Edge Detection" : "Binary Result"}w-4 h-4 mr-2" /
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
    
    {/* Results Statistics */}
    <div className="mt-6 p-4 bg-blue-50 rounded-lg">
        <h2 className="text-lg font-semibold text-blue-800 mb-2">Image Processing Results</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p className="text-blue-700">
              <span className="font-medium">Brightness Threshold:</span> {threshold}
            </p>
            <p className="text-sm text-blue-600">
              Pixels with brightness values ≥ {threshold} are white
            </p>
          </div>
          <div>
            <p className="text-blue-700">
              <span className="font-medium">Smoothing Level:</span> {sigma.toFixed(1)}
            </p>
            <p className="text-sm text-blue-600">
              Higher values reduce noise but might blur boundaries
            </p>
          </div>
          <div>
            <p className="text-blue-700">
              <span className="font-medium">Edge Detection:</span> {showMinorEdges ? "Enabled" : "Disabled"}
            </p>
            <p className="text-sm text-blue-600">
              {showMinorEdges ? "Showing edge boundaries" : "Showing only binary areas"}
            </p>
          </div>
        </div>
      </div>
    
    <div className="mt-6 text-sm text-gray-500">
      <p>This implementation applies binary thresholding to identify bright areas (255 or near 255) in the image.</p>
      <p>The threshold slider controls the cutoff between white and black areas. Higher values make the filter more strict.</p>
      <p>White areas represent pixels with brightness values above the threshold, while black areas represent darker pixels.</p>
      <p>Edge detection is performed on binary image boundaries for precise measurement using Zernike moment-based refinement.</p>
    </div>
  </div>
);
};

export default Measurement;