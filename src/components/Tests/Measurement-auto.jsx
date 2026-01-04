import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, CameraOff, Zap, ZapOff, Lock, Unlock } from 'lucide-react';

export default function ManualMeasurement() {
  const canvasRef = useRef(null);
  const videoRef = useRef(null);
  const hiddenCanvasRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragTarget, setDragTarget] = useState(null);
  const [autoDetect, setAutoDetect] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [detectionStatus, setDetectionStatus] = useState('idle');
  const [gridLines, setGridLines] = useState({
    horizontal: [0.33, 0.67],
    vertical: [0.33, 0.67],
    corners: null
  });
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [woodSize, setWoodSize] = useState('2x2');
  const animationFrameRef = useRef(null);
  
  // Wood specifications
  const WOOD_SIZES = {
    '2x2': { 
      cameraDistance: 152.4,
      cross: 50.8
    },
    '3x3': { 
      cameraDistance: 228.6,
      cross: 76.2
    }
  };

  useEffect(() => {
    const updateDimensions = () => {
      const canvas = canvasRef.current;
      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        setDimensions({ width: rect.width, height: rect.height });
      }
    };
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  useEffect(() => {
    if (!cameraActive) {
      drawGrid();
    }
  }, [gridLines, dimensions, cameraActive]);

  // Start camera
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'environment' 
        } 
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setCameraActive(true);
        setDetectionStatus('camera_active');
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
      setDetectionStatus('error');
      alert('Could not access camera. Please check permissions.');
    }
  };

  // Stop camera
  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = videoRef.current.srcObject.getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
      setCameraActive(false);
      setAutoDetect(false);
      setDetectionStatus('idle');
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      drawGrid();
    }
  };

  // Toggle camera
  const toggleCamera = () => {
    if (cameraActive) {
      stopCamera();
    } else {
      startCamera();
    }
  };

  // Toggle auto-detection
  const toggleAutoDetect = () => {
    if (!cameraActive) {
      alert('Please turn on the camera first!');
      return;
    }
    setAutoDetect(!autoDetect);
    if (!autoDetect) {
      setDetectionStatus('searching');
    } else {
      setDetectionStatus('camera_active');
    }
  };

  // Toggle lock mode
  const toggleLock = () => {
    setIsLocked(!isLocked);
  };

  // Render video frame with or without detection
  const renderFrame = () => {
    const video = videoRef.current;
    const displayCanvas = canvasRef.current;
    
    if (!video || !displayCanvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
      if (cameraActive) {
        animationFrameRef.current = requestAnimationFrame(renderFrame);
      }
      return;
    }

    const displayCtx = displayCanvas.getContext('2d');
    displayCanvas.width = dimensions.width;
    displayCanvas.height = dimensions.height;
    
    // Draw video feed
    displayCtx.drawImage(video, 0, 0, dimensions.width, dimensions.height);
    
    // If auto-detect is on, perform detection
    if (autoDetect) {
      performDetection(video, displayCtx);
    }
    
    // Always draw grid overlay on top of video
    drawGridOverlay(displayCtx);
    
    if (cameraActive) {
      animationFrameRef.current = requestAnimationFrame(renderFrame);
    }
  };

  // Process video frame for corner detection
  const performDetection = (video, displayCtx) => {
    const hiddenCanvas = hiddenCanvasRef.current;
    if (!hiddenCanvas) return;

    const ctx = hiddenCanvas.getContext('2d');
    
    // Set canvas sizes to match video
    hiddenCanvas.width = video.videoWidth;
    hiddenCanvas.height = video.videoHeight;
    
    // Draw video frame to hidden canvas
    ctx.drawImage(video, 0, 0);
    
    // Get image data for processing
    const imageData = ctx.getImageData(0, 0, hiddenCanvas.width, hiddenCanvas.height);
    
    try {
      // Convert to grayscale
      const grayData = convertToGrayscale(imageData);
      
      // Apply Gaussian blur
      const blurredData = applyGaussianBlur(grayData, hiddenCanvas.width, hiddenCanvas.height);
      
      // Detect edges using Canny-like algorithm
      const edges = detectEdges(blurredData, hiddenCanvas.width, hiddenCanvas.height);
      
      // Find contours
      const corners = findSquareCorners(edges, hiddenCanvas.width, hiddenCanvas.height);
      
      if (corners && corners.length === 4) {
        // Update grid lines based on detected corners only if not locked
        if (!isLocked) {
          updateGridFromCorners(corners, hiddenCanvas.width, hiddenCanvas.height);
        }
        setDetectionStatus('detected');
      } else {
        setDetectionStatus('searching');
      }
    } catch (err) {
      console.error("Detection error:", err);
      setDetectionStatus('error');
    }
  };

  // Start rendering loop when camera is active
  useEffect(() => {
    if (cameraActive) {
      renderFrame();
    } else if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [cameraActive, autoDetect, gridLines, dimensions, isLocked, woodSize]);

  // Image processing functions
  const convertToGrayscale = (imageData) => {
    const gray = new Uint8ClampedArray(imageData.width * imageData.height);
    const data = imageData.data;
    
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      gray[i / 4] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
    }
    
    return gray;
  };

  const applyGaussianBlur = (grayData, width, height, kernelSize = 5) => {
    const output = new Uint8ClampedArray(grayData.length);
    const kernel = generateGaussianKernel(kernelSize);
    const half = Math.floor(kernelSize / 2);
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let sum = 0;
        let weightSum = 0;
        
        for (let ky = -half; ky <= half; ky++) {
          for (let kx = -half; kx <= half; kx++) {
            const px = Math.min(Math.max(x + kx, 0), width - 1);
            const py = Math.min(Math.max(y + ky, 0), height - 1);
            const weight = kernel[ky + half][kx + half];
            
            sum += grayData[py * width + px] * weight;
            weightSum += weight;
          }
        }
        
        output[y * width + x] = Math.round(sum / weightSum);
      }
    }
    
    return output;
  };

  const generateGaussianKernel = (size) => {
    const sigma = size / 6;
    const kernel = [];
    const half = Math.floor(size / 2);
    
    for (let y = -half; y <= half; y++) {
      const row = [];
      for (let x = -half; x <= half; x++) {
        const value = Math.exp(-(x * x + y * y) / (2 * sigma * sigma));
        row.push(value);
      }
      kernel.push(row);
    }
    
    return kernel;
  };

  const detectEdges = (grayData, width, height, lowThreshold = 50, highThreshold = 150) => {
    const edges = new Uint8ClampedArray(grayData.length);
    
    // Sobel operators
    const sobelX = [[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]];
    const sobelY = [[-1, -2, -1], [0, 0, 0], [1, 2, 1]];
    
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        let gx = 0;
        let gy = 0;
        
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const pixel = grayData[(y + ky) * width + (x + kx)];
            gx += pixel * sobelX[ky + 1][kx + 1];
            gy += pixel * sobelY[ky + 1][kx + 1];
          }
        }
        
        const magnitude = Math.sqrt(gx * gx + gy * gy);
        
        if (magnitude > highThreshold) {
          edges[y * width + x] = 255;
        } else if (magnitude > lowThreshold) {
          edges[y * width + x] = 128;
        }
      }
    }
    
    return edges;
  };

  const findSquareCorners = (edges, width, height) => {
    // Simple contour detection - find connected edge pixels
    const visited = new Set();
    
    // Find largest contour
    let largestContour = [];
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        if (edges[idx] > 0 && !visited.has(idx)) {
          const contour = traceContour(edges, width, height, x, y, visited);
          if (contour.length > largestContour.length) {
            largestContour = contour;
          }
        }
      }
    }
    
    if (largestContour.length < 100) {
      return null;
    }
    
    // Approximate polygon
    const approx = approximatePolygon(largestContour, 0.02);
    
    if (approx.length === 4) {
      // Sort corners: top-left, top-right, bottom-right, bottom-left
      return sortCorners(approx);
    } else if (approx.length > 4) {
      // Use minimum bounding rectangle
      return getMinBoundingRect(largestContour);
    }
    
    return null;
  };

  const traceContour = (edges, width, height, startX, startY, visited) => {
    const contour = [];
    const stack = [{ x: startX, y: startY }];
    
    while (stack.length > 0 && contour.length < 10000) {
      const { x, y } = stack.pop();
      const idx = y * width + x;
      
      if (visited.has(idx) || x < 0 || x >= width || y < 0 || y >= height || edges[idx] === 0) {
        continue;
      }
      
      visited.add(idx);
      contour.push({ x, y });
      
      // Check 8-connected neighbors
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx !== 0 || dy !== 0) {
            stack.push({ x: x + dx, y: y + dy });
          }
        }
      }
    }
    
    return contour;
  };

  const approximatePolygon = (contour, epsilon) => {
    if (contour.length < 3) return contour;
    
    // Douglas-Peucker algorithm
    const perimeter = calculatePerimeter(contour);
    const tolerance = epsilon * perimeter;
    
    return douglasPeucker(contour, tolerance);
  };

  const calculatePerimeter = (contour) => {
    let perimeter = 0;
    for (let i = 0; i < contour.length; i++) {
      const p1 = contour[i];
      const p2 = contour[(i + 1) % contour.length];
      perimeter += Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
    }
    return perimeter;
  };

  const douglasPeucker = (points, tolerance) => {
    if (points.length < 3) return points;
    
    // Find point with maximum distance from line between first and last
    let maxDistance = 0;
    let maxIndex = 0;
    const first = points[0];
    const last = points[points.length - 1];
    
    for (let i = 1; i < points.length - 1; i++) {
      const distance = perpendicularDistance(points[i], first, last);
      if (distance > maxDistance) {
        maxDistance = distance;
        maxIndex = i;
      }
    }
    
    // If max distance is greater than tolerance, recursively simplify
    if (maxDistance > tolerance) {
      const left = douglasPeucker(points.slice(0, maxIndex + 1), tolerance);
      const right = douglasPeucker(points.slice(maxIndex), tolerance);
      return left.slice(0, -1).concat(right);
    } else {
      return [first, last];
    }
  };

  const perpendicularDistance = (point, lineStart, lineEnd) => {
    const dx = lineEnd.x - lineStart.x;
    const dy = lineEnd.y - lineStart.y;
    
    if (dx === 0 && dy === 0) {
      return Math.sqrt((point.x - lineStart.x) ** 2 + (point.y - lineStart.y) ** 2);
    }
    
    const t = ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / (dx * dx + dy * dy);
    
    if (t < 0) {
      return Math.sqrt((point.x - lineStart.x) ** 2 + (point.y - lineStart.y) ** 2);
    } else if (t > 1) {
      return Math.sqrt((point.x - lineEnd.x) ** 2 + (point.y - lineEnd.y) ** 2);
    }
    
    const projX = lineStart.x + t * dx;
    const projY = lineStart.y + t * dy;
    
    return Math.sqrt((point.x - projX) ** 2 + (point.y - projY) ** 2);
  };

  const getMinBoundingRect = (contour) => {
    if (contour.length === 0) return null;
    
    // Find bounding box
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    
    contour.forEach(point => {
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    });
    
    return [
      { x: minX, y: minY },
      { x: maxX, y: minY },
      { x: maxX, y: maxY },
      { x: minX, y: maxY }
    ];
  };

  const sortCorners = (corners) => {
    // Sort by y-coordinate first
    corners.sort((a, b) => a.y - b.y);
    
    // Top two points
    const top = corners.slice(0, 2).sort((a, b) => a.x - b.x);
    // Bottom two points
    const bottom = corners.slice(2, 4).sort((a, b) => a.x - b.x);
    
    return [
      top[0],    // top-left
      top[1],    // top-right
      bottom[1], // bottom-right
      bottom[0]  // bottom-left
    ];
  };

const updateGridFromCorners = (corners, videoWidth, videoHeight) => {
    // Map detected corners directly to grid lines
    // corners array: [top-left, top-right, bottom-right, bottom-left]
    const P1 = corners[0];  // top-left
    const P2 = corners[1];  // top-right
    const P3 = corners[2];  // bottom-right
    const P4 = corners[3];  // bottom-left
    
    // HORIZONTAL LINES (2 lines for height):
    // Height Line 1 (top edge): P1 to P2
    const heightLine1Y = (P1.y + P2.y) / 2;
    // Height Line 2 (bottom edge): P3 to P4
    const heightLine2Y = (P3.y + P4.y) / 2;
    
    // VERTICAL LINES (2 lines for width):
    // Width Line 1 (left edge): P1 to P4
    const widthLine1X = (P1.x + P4.x) / 2;
    // Width Line 2 (right edge): P2 to P3
    const widthLine2X = (P2.x + P3.x) / 2;
    
    // Convert to ratios for the full video frame
    const horizontalRatios = [
      heightLine1Y / videoHeight,
      heightLine2Y / videoHeight
    ].sort((a, b) => a - b);
    
    const verticalRatios = [
      widthLine1X / videoWidth,
      widthLine2X / videoWidth
    ].sort((a, b) => a - b);
    
    setGridLines({
      horizontal: horizontalRatios,
      vertical: verticalRatios
    });
  };




  
  const drawGrid = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const { width, height } = dimensions;
    
    canvas.width = width;
    canvas.height = height;
    
    // Clear canvas
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, width, height);
    
    drawGridOverlay(ctx);
  };

  const drawGridOverlay = (ctx) => {
    const { width, height } = dimensions;
    
    // If we have detected corners, draw lines following the edges
    if (gridLines.corners && gridLines.corners.length === 4) {
      const corners = gridLines.corners.map(c => ({
        x: c.x * width,
        y: c.y * height
      }));
      
      const [P1, P2, P3, P4] = corners;
      
      // Draw horizontal lines (blue - height)
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 3;
      
      // Top edge: P1 to P2
      ctx.beginPath();
      ctx.moveTo(P1.x, P1.y);
      ctx.lineTo(P2.x, P2.y);
      ctx.stroke();
      
      // Bottom edge: P4 to P3
      ctx.beginPath();
      ctx.moveTo(P4.x, P4.y);
      ctx.lineTo(P3.x, P3.y);
      ctx.stroke();
      
      // Draw vertical lines (red - width)
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 3;
      
      // Left edge: P1 to P4
      ctx.beginPath();
      ctx.moveTo(P1.x, P1.y);
      ctx.lineTo(P4.x, P4.y);
      ctx.stroke();
      
      // Right edge: P2 to P3
      ctx.beginPath();
      ctx.moveTo(P2.x, P2.y);
      ctx.lineTo(P3.x, P3.y);
      ctx.stroke();
      
      // Draw corner indicators
      ctx.fillStyle = '#00ff00';
      corners.forEach((corner, i) => {
        ctx.fillRect(corner.x - 6, corner.y - 6, 12, 12);
        
        // Label corners
        ctx.fillStyle = '#ffff00';
        ctx.font = 'bold 14px sans-serif';
        ctx.fillText(`P${i + 1}`, corner.x + 10, corner.y - 10);
        ctx.fillStyle = '#00ff00';
      });
      
    } else {
      // Default grid mode - draw straight lines
      // Draw horizontal lines (blue - height)
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 2;
      
      gridLines.horizontal.forEach(ratio => {
        const y = height * ratio;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
        
        // Draw handle
        ctx.fillStyle = '#3b82f6';
        ctx.fillRect(width - 30, y - 4, 20, 8);
      });
      
      // Draw vertical lines (red - width)
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2;
      
      gridLines.vertical.forEach(ratio => {
        const x = width * ratio;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
        
        // Draw handle
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(x - 4, height - 30, 8, 20);
      });
    }
    
    // Draw center reference lines (dashed - gray)
    ctx.strokeStyle = '#9ca3af';
    ctx.lineWidth = 1;
    ctx.setLineDash([10, 10]);
    
    // Center horizontal
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();
    
    // Center vertical
    ctx.beginPath();
    ctx.moveTo(width / 2, 0);
    ctx.lineTo(width / 2, height);
    ctx.stroke();
    
    ctx.setLineDash([]);
    
    // Draw labels
    ctx.fillStyle = '#ffffff';
    ctx.font = '14px sans-serif';
    ctx.fillText('Width', width / 2 - 20, height - 10);
    ctx.fillText('Height', 10, height / 2 - 10);
  };

  const getCanvasCoordinates = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    return { x, y };
  };

  const findNearestLine = (x, y) => {
    const { width, height } = dimensions;
    const threshold = 15;
    
    for (let i = 0; i < gridLines.horizontal.length; i++) {
      const lineY = height * gridLines.horizontal[i];
      if (Math.abs(y - lineY) < threshold) {
        return { type: 'horizontal', index: i };
      }
    }
    
    for (let i = 0; i < gridLines.vertical.length; i++) {
      const lineX = width * gridLines.vertical[i];
      if (Math.abs(x - lineX) < threshold) {
        return { type: 'vertical', index: i };
      }
    }
    
    return null;
  };

  const handleMouseDown = (e) => {
    // Cannot drag if auto-detect is on OR if locked
    if (autoDetect || isLocked) return;
    
    const { x, y } = getCanvasCoordinates(e);
    const target = findNearestLine(x, y);
    
    if (target) {
      setIsDragging(true);
      setDragTarget(target);
    }
  };

  const handleMouseMove = (e) => {
    if (!isDragging || !dragTarget || autoDetect || isLocked) return;
    
    const { x, y } = getCanvasCoordinates(e);
    const { width, height } = dimensions;
    
    setGridLines(prev => {
      const newLines = { ...prev };
      
      if (dragTarget.type === 'horizontal') {
        let ratio = y / height;
        const index = dragTarget.index;
        
        const minBound = index === 0 ? 0.1 : newLines.horizontal[index - 1] + 0.05;
        const maxBound = index === newLines.horizontal.length - 1 ? 0.9 : newLines.horizontal[index + 1] - 0.05;
        
        ratio = Math.max(minBound, Math.min(maxBound, ratio));
        newLines.horizontal[index] = ratio;
      } else {
        let ratio = x / width;
        const index = dragTarget.index;
        
        const minBound = index === 0 ? 0.1 : newLines.vertical[index - 1] + 0.05;
        const maxBound = index === newLines.vertical.length - 1 ? 0.9 : newLines.vertical[index + 1] - 0.05;
        
        ratio = Math.max(minBound, Math.min(maxBound, ratio));
        newLines.vertical[index] = ratio;
      }
      
      return newLines;
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setDragTarget(null);
  };

  const resetGrid = () => {
    setGridLines({
      horizontal: [0.33, 0.67],
      vertical: [0.33, 0.67],
      corners: null
    });
  };

  const calculateMeasurements = () => {
    const { width, height } = dimensions;
    const currentWood = WOOD_SIZES[woodSize];
    const baseSize = currentWood.cross;
    
    if (gridLines.corners && gridLines.corners.length === 4) {
      // Use actual detected corners for accurate measurements
      const corners = gridLines.corners.map(c => ({
        x: c.x * width,
        y: c.y * height
      }));
      
      const [P1, P2, P3, P4] = corners;
      
      // Calculate edge lengths in pixels
      const topEdge = Math.sqrt(Math.pow(P2.x - P1.x, 2) + Math.pow(P2.y - P1.y, 2));
      const bottomEdge = Math.sqrt(Math.pow(P3.x - P4.x, 2) + Math.pow(P3.y - P4.y, 2));
      const leftEdge = Math.sqrt(Math.pow(P4.x - P1.x, 2) + Math.pow(P4.y - P1.y, 2));
      const rightEdge = Math.sqrt(Math.pow(P3.x - P2.x, 2) + Math.pow(P3.y - P2.y, 2));
      
      // Average the parallel edges
      const avgWidthPixels = (topEdge + bottomEdge) / 2;
      const avgHeightPixels = (leftEdge + rightEdge) / 2;
      
      // Convert using calibration
      const pixelToMm = baseSize / Math.max(avgWidthPixels, avgHeightPixels);
      
      const widthMm = avgWidthPixels * pixelToMm;
      const heightMm = avgHeightPixels * pixelToMm;
      const distanceMm = currentWood.cameraDistance;
      const areaMm2 = widthMm * heightMm;
      
      return {
        height: heightMm.toFixed(1),
        width: widthMm.toFixed(1),
        distance: distanceMm.toFixed(1),
        area: areaMm2.toFixed(1)
      };
    } else {
      // Fallback to simple grid-based calculation
      const pixelToMmWidth = baseSize / width;
      const pixelToMmHeight = baseSize / height;
      
      const detectedHeightPixels = (gridLines.horizontal[1] - gridLines.horizontal[0]) * height;
      const detectedWidthPixels = (gridLines.vertical[1] - gridLines.vertical[0]) * width;
      
      const heightMm = detectedHeightPixels * pixelToMmHeight;
      const widthMm = detectedWidthPixels * pixelToMmWidth;
      const distanceMm = currentWood.cameraDistance;
      const areaMm2 = widthMm * heightMm;
      
      return {
        height: heightMm.toFixed(1),
        width: widthMm.toFixed(1),
        distance: distanceMm.toFixed(1),
        area: areaMm2.toFixed(1)
      };
    }
  };
  
  const measurements = calculateMeasurements();

  const getStatusColor = () => {
    switch(detectionStatus) {
      case 'detected': return 'text-green-400';
      case 'searching': return 'text-yellow-400';
      case 'error': return 'text-red-400';
      case 'camera_active': return 'text-blue-400';
      default: return 'text-gray-400';
    }
  };

  const getStatusText = () => {
    switch(detectionStatus) {
      case 'detected': return '✓ Square Detected';
      case 'searching': return '⌛ Searching for square...';
      case 'error': return '✗ Detection Error';
      case 'camera_active': return '📷 Camera Active';
      default: return 'Idle';
    }
  };

  const getCursorStyle = () => {
    if (autoDetect || isLocked) return 'cursor-not-allowed';
    return 'cursor-move';
  };

  return (
    <div className="min-h-screen bg-gray-900 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6 bg-gray-800 rounded-lg p-6">
          <h2 className="text-white text-2xl font-bold mb-4 flex items-center gap-2">
            <Camera className="w-6 h-6" />
            Camera POV - Advanced Controls
          </h2>
          
          <div className="bg-gray-700 rounded-lg p-4 mb-4">
            <h3 className="text-white font-semibold mb-3">Camera Setup & Accuracy</h3>
            <div className="text-gray-300 space-y-2">
              <p>• Camera to Wood Distance: <span className="text-green-400 font-bold">{measurements.distance} mm ({woodSize === '2x2' ? '6' : '9'} inches)</span></p>
              <p>• Wood Cross-Section: <span className="text-blue-400 font-bold">{WOOD_SIZES[woodSize].cross} mm × {WOOD_SIZES[woodSize].cross} mm ({woodSize === '2x2' ? '2×2' : '3×3'} inches)</span></p>
              <p className="text-yellow-400 text-sm italic">• Optimized distance for accurate {woodSize === '2x2' ? '2×2' : '3×3'} inch wood measurement</p>
            </div>
          </div>

          <div className="bg-gray-700 rounded-lg p-4 mb-4">
            <h3 className="text-white font-semibold mb-3">Control Panel</h3>
            <div className="flex gap-4 items-center flex-wrap">
              {/* Camera Toggle */}
              <button
                onClick={toggleCamera}
                className={`px-6 py-3 rounded-lg transition font-semibold flex items-center gap-2 ${
                  cameraActive
                    ? 'bg-red-500 hover:bg-red-600 text-white'
                    : 'bg-green-500 hover:bg-green-600 text-white'
                }`}
              >
                {cameraActive ? <CameraOff className="w-5 h-5" /> : <Camera className="w-5 h-5" />}
                {cameraActive ? 'Turn Off Camera' : 'Turn On Camera'}
              </button>
              
              {/* Auto-Detect Toggle */}
              <button
                onClick={toggleAutoDetect}
                disabled={!cameraActive}
                className={`px-6 py-3 rounded-lg transition font-semibold flex items-center gap-2 ${
                  !cameraActive
                    ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                    : autoDetect
                    ? 'bg-green-500 hover:bg-green-600 text-white'
                    : 'bg-blue-500 hover:bg-blue-600 text-white'
                }`}
              >
                {autoDetect ? <Zap className="w-5 h-5" /> : <ZapOff className="w-5 h-5" />}
                {autoDetect ? 'Auto-Detect ON' : 'Auto-Detect OFF'}
              </button>
              
              {/* Lock Toggle */}
              <button
                onClick={toggleLock}
                className={`px-6 py-3 rounded-lg transition font-semibold flex items-center gap-2 ${
                  isLocked
                    ? 'bg-orange-500 hover:bg-orange-600 text-white'
                    : 'bg-purple-500 hover:bg-purple-600 text-white'
                }`}
              >
                {isLocked ? <Lock className="w-5 h-5" /> : <Unlock className="w-5 h-5" />}
                {isLocked ? 'Locked' : 'Unlocked'}
              </button>
              
              {/* Status Indicator */}
              <div className={`px-4 py-2 rounded-lg ${getStatusColor()} font-semibold border-2 ${
                detectionStatus === 'detected' ? (isLocked ? 'border-orange-400' : 'border-green-400') :
                detectionStatus === 'searching' ? 'border-yellow-400' :
                detectionStatus === 'error' ? 'border-red-400' :
                detectionStatus === 'camera_active' ? 'border-blue-400' :
                'border-gray-400'
              }`}>
                Status: {getStatusText()} {detectionStatus === 'detected' && isLocked && '🔒'}
              </div>
            </div>
            
            <div className="mt-3 text-gray-300 text-sm space-y-1">
              <p>• <span className="font-semibold">Camera:</span> {cameraActive ? 'On - Video feed active' : 'Off - Grid only'}</p>
              <p>• <span className="font-semibold">Auto-Detect:</span> {autoDetect ? (isLocked ? 'On - Detection active but edge lines are locked' : 'On - Edge lines follow detected square (even at angles)') : cameraActive ? 'Off - Manual control available' : 'Requires camera'}</p>
              <p>• <span className="font-semibold">Lock Mode:</span> {isLocked ? (autoDetect ? 'Locked - Edge lines frozen at detected position' : 'Locked - Lines cannot be dragged') : (autoDetect ? 'Unlocked - Edge lines track square in real-time' : 'Unlocked - Drag to adjust')}</p>
            </div>
          </div>
          
          <div className="flex gap-4 items-center">
            <label className="text-white font-semibold">Wood Size:</label>
            <button
              onClick={() => setWoodSize('2x2')}
              className={`px-6 py-2 rounded-lg transition font-semibold ${
                woodSize === '2x2' 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              2×2 inches (6" distance)
            </button>
            <button
              onClick={() => setWoodSize('3x3')}
              className={`px-6 py-2 rounded-lg transition font-semibold ${
                woodSize === '3x3' 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              3×3 inches (9" distance)
            </button>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-4">
          {/* Hidden video element */}
          <video
            ref={videoRef}
            style={{ display: 'none' }}
            playsInline
            autoPlay
            muted
          />
          
          {/* Hidden processing canvas */}
          <canvas
            ref={hiddenCanvasRef}
            style={{ display: 'none' }}
          />
          
          {/* Display canvas */}
          <canvas
            ref={canvasRef}
            className={`w-full h-[600px] border-2 border-gray-700 rounded ${getCursorStyle()}`}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={(e) => {
              if (!autoDetect && !isLocked) {
                const touch = e.touches[0];
                handleMouseDown({ clientX: touch.clientX, clientY: touch.clientY });
              }
            }}
            onTouchMove={(e) => {
              if (!autoDetect && !isLocked) {
                const touch = e.touches[0];
                handleMouseMove({ clientX: touch.clientX, clientY: touch.clientY });
              }
            }}
            onTouchEnd={handleMouseUp}
          />
          
          <div className="mt-4 flex items-center justify-center gap-4">
            <button
              onClick={resetGrid}
              className="px-6 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition font-semibold"
            >
              Reset Grid
            </button>
            
            <p className="text-gray-400 text-sm">
              {autoDetect && isLocked ? '🔒 Detection active but edge lines are locked' :
               autoDetect ? '🤖 Edge lines following detected square...' : 
               isLocked ? '🔒 Lines locked - unlock to adjust' :
               cameraActive ? '👆 Drag lines to adjust' : 
               '📏 Manual grid mode'}
            </p>
          </div>
          
          <div className="mt-6 bg-gray-700 rounded-lg p-4">
            <h3 className="text-white font-semibold mb-3">Real-World Measurements (Between Grid Lines)</h3>
            <div className="grid grid-cols-4 gap-4">
              <div className="bg-gray-800 p-3 rounded text-center">
                <div className="text-gray-400 text-sm mb-1">Height</div>
                <div className="text-2xl font-bold text-blue-400">{measurements.height}</div>
                <div className="text-gray-500 text-xs mt-1">mm</div>
              </div>
              <div className="bg-gray-800 p-3 rounded text-center">
                <div className="text-gray-400 text-sm mb-1">Width</div>
                <div className="text-2xl font-bold text-red-400">{measurements.width}</div>
                <div className="text-gray-500 text-xs mt-1">mm</div>
              </div>
              <div className="bg-gray-800 p-3 rounded text-center">
                <div className="text-gray-400 text-sm mb-1">Camera Distance</div>
                <div className="text-2xl font-bold text-green-400">{measurements.distance}</div>
                <div className="text-gray-500 text-xs mt-1">mm</div>
              </div>
              <div className="bg-gray-800 p-3 rounded text-center">
                <div className="text-gray-400 text-sm mb-1">Area</div>
                <div className="text-2xl font-bold text-purple-400">{measurements.area}</div>
                <div className="text-gray-500 text-xs mt-1">mm²</div>
              </div>
            </div>
            <div className="mt-3 text-gray-300 text-xs italic text-center">
              {gridLines.corners ? 
                '📐 Measurements calculated from detected square edges (P1→P2→P3→P4→P1)' : 
                '📐 Measurements show area between the grid lines'}
            </div>
          </div>

          <div className="mt-4 bg-gray-700 rounded-lg p-4">
            <h3 className="text-white font-semibold mb-2">Corner Detection Mapping:</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-800 p-3 rounded">
                <div className="text-gray-300 text-sm space-y-2">
                  <p className="font-semibold text-yellow-400">Detected Corners:</p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>P1: Top-Left</div>
                    <div>P2: Top-Right</div>
                    <div>P3: Bottom-Right</div>
                    <div>P4: Bottom-Left</div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-800 p-3 rounded">
                <div className="text-gray-300 text-sm space-y-2">
                  <p className="font-semibold text-blue-400">Edge Lines (Following Square):</p>
                  <div className="text-xs space-y-1">
                    <p className="text-blue-400">Height Lines:</p>
                    <p className="ml-3">• Top: P1→P2</p>
                    <p className="ml-3">• Bottom: P4→P3</p>
                    <p className="text-red-400 mt-1">Width Lines:</p>
                    <p className="ml-3">• Left: P1→P4</p>
                    <p className="ml-3">• Right: P2→P3</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 bg-gray-700 rounded-lg p-4">
            <h3 className="text-white font-semibold mb-2">Control Flow:</h3>
            <ul className="text-gray-300 text-sm space-y-1">
              <li>1. <span className="text-green-400 font-semibold">Turn On Camera</span> - Starts video feed</li>
              <li>2. <span className="text-blue-400 font-semibold">Enable Auto-Detect</span> - Lines follow the exact edges of detected wood square:</li>
              <li className="ml-6 text-blue-400">• Top Edge (Blue): P1→P2</li>
              <li className="ml-6 text-blue-400">• Bottom Edge (Blue): P4→P3</li>
              <li className="ml-6 text-red-400">• Left Edge (Red): P1→P4</li>
              <li className="ml-6 text-red-400">• Right Edge (Red): P2→P3</li>
              <li className="ml-6 text-gray-400 italic">Lines will follow angled/tilted edges in real-time</li>
              <li>3. <span className="text-purple-400 font-semibold">Lock/Unlock</span> - Works anytime:</li>
              <li className="ml-6">• During Auto-Detect: Lock to freeze lines at current detected position</li>
              <li className="ml-6">• Manual Mode: Lock to prevent accidental dragging</li>
              <li>4. <span className="text-red-400 font-semibold">Reset Grid</span> - Returns lines to default straight grid</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}