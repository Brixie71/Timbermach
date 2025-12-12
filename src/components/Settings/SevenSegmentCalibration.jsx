import React, { useState, useRef, useEffect } from "react";
import {
  Upload,
  Square,
  Check,
  AlertCircle,
  Trash2,
  ArrowRight,
  Eye,
  ArrowLeft,
  RotateCcw,
  Move,
  Maximize2,
  X,
} from "lucide-react";
import BackendStatusIndicator from "./BackendStatusIndicator";

const SevenSegmentCalibration = ({ onComplete, onCancel }) => {
  // Flask backend for image processing/OCR - always use port 5000
  const API_URL = "http://127.0.0.1:5000";

  // Helper function to format number with decimal point
  // Always returns 2 decimal places (e.g., 319 -> 31.90, not 31.9)
  const formatNumberWithDecimal = (rawNumber, hasDecimal, decimalPos) => {
    if (!hasDecimal || !rawNumber || rawNumber.includes("?")) {
      return rawNumber;
    }

    // Remove any existing decimal or non-numeric chars except ?
    const cleanNumber = rawNumber.replace(/[^0-9?]/g, "");

    if (cleanNumber.length < decimalPos) {
      return rawNumber;
    }

    // Insert decimal from right
    const insertPos = cleanNumber.length - decimalPos;
    const formattedNumber =
      cleanNumber.slice(0, insertPos) + "." + cleanNumber.slice(insertPos);

    // Ensure 2 decimal places (add trailing 0 if needed)
    // e.g., 31.9 -> 31.90
    const parts = formattedNumber.split(".");
    if (parts.length === 2) {
      const decimalPart = parts[1].padEnd(2, "0");
      return parts[0] + "." + decimalPart;
    }

    return formattedNumber;
  };

  // States
  const [step, setStep] = useState(1);
  const [capturedImage, setCapturedImage] = useState(null);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [displayBox, setDisplayBox] = useState(null);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [segmentBoxes, setSegmentBoxes] = useState([[], [], []]);
  const [currentDigit, setCurrentDigit] = useState(0);
  const [currentSegment, setCurrentSegment] = useState(0);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState(null);
  const [tempBox, setTempBox] = useState(null);
  const [recognitionResult, setRecognitionResult] = useState(null);
  const [debugInfo, setDebugInfo] = useState(null);
  const [visualizationImage, setVisualizationImage] = useState(null);
  const [error, setError] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const testRecognition = async () => {
    setIsProcessing(true);
    setError(null);

    try {
      // First, send the current calibration to Flask before recognizing
      // This ensures Flask uses the segment boxes drawn in Step 2
      console.log("Sending calibration to Flask before recognition...");
      const calibrationResponse = await fetch(
        `${API_URL}/seven-segment/calibrate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            displayBox,
            segmentBoxes,
            hasDecimalPoint,
            decimalPosition,
            calibrationImageSize: imageSize,
          }),
        },
      );

      if (!calibrationResponse.ok) {
        console.warn(
          "Failed to send calibration to Flask, continuing anyway...",
        );
      } else {
        const calibrationData = await calibrationResponse.json();
        console.log("Calibration sent to Flask:", calibrationData);
      }

      // Now perform recognition with the calibration loaded
      const formData = new FormData();
      formData.append("image", uploadedFile);
      formData.append("method", "simple_threshold");

      const response = await fetch(`${API_URL}/seven-segment/recognize`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(
          `Backend error: ${response.status} ${response.statusText}. Make sure Python Flask backend is running on ${API_URL}`,
        );
      }

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error(
          `Backend returned HTML instead of JSON. Make sure Python Flask backend is running on ${API_URL}`,
        );
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Recognition failed");
      }

      setRecognitionResult(data);
      setDebugInfo(data.debug_info);

      // Also get visualization
      if (data.visualization) {
        setVisualizationImage(`data:image/png;base64,${data.visualization}`);
      }
    } catch (err) {
      setError(err.message || "Failed to connect to backend");
      console.error("Recognition error:", err);
    } finally {
      setIsProcessing(false);
    }
  };

  const [hasDecimalPoint, setHasDecimalPoint] = useState(false);
  const [decimalPosition, setDecimalPosition] = useState(1);

  // New states for editing modes
  const [editMode, setEditMode] = useState("draw"); // 'draw', 'reposition', 'resize'
  const [selectedBox, setSelectedBox] = useState(null); // { digitIdx, segmentIdx }
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState(null);
  const [resizeHandle, setResizeHandle] = useState(null); // 'nw', 'ne', 'sw', 'se', 'n', 's', 'e', 'w'

  const fileInputRef = useRef(null);
  const canvasRef = useRef(null);
  const overlayCanvasRef = useRef(null);
  const imageRef = useRef(null);

  const SEGMENT_LABELS = [
    "A (Top)",
    "B (Top-Right)",
    "C (Bottom-Right)",
    "D (Bottom)",
    "E (Bottom-Left)",
    "F (Top-Left)",
    "G (Middle)",
  ];
  const DIGIT_COLORS = ["#3b82f6", "#ef4444", "#10b981"];

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please upload an image file");
      return;
    }

    setUploadedFile(file);

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = async () => {
        const autoDisplayBox = {
          x: 0,
          y: 0,
          width: img.width,
          height: img.height,
        };

        setDisplayBox(autoDisplayBox);
        setImageSize({ width: img.width, height: img.height });
        setCapturedImage(event.target.result);
        setError(null);

        // Don't call create-defaults API - just initialize empty boxes
        // User will draw them manually
        setSegmentBoxes([[], [], []]);
        setIsProcessing(false);

        // Stay on Step 1 so user can configure decimal settings
        // User will click "Next" button to go to Step 2
        setCurrentDigit(0);
        setCurrentSegment(0);
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const retakePhoto = () => {
    setCapturedImage(null);
    setUploadedFile(null);
    setDisplayBox(null);
    setImageSize({ width: 0, height: 0 });
    setSegmentBoxes([[], [], []]);
    setCurrentDigit(0);
    setCurrentSegment(0);
    setStep(1);
    setEditMode("draw");
    setSelectedBox(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const getCanvasCoordinates = (e) => {
    const canvas = overlayCanvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const isPointInBox = (point, box) => {
    return (
      point.x >= box.x &&
      point.x <= box.x + box.width &&
      point.y >= box.y &&
      point.y <= box.y + box.height
    );
  };

  const getResizeHandle = (point, box) => {
    const threshold = 10;
    const { x, y, width, height } = box;

    // Check corners first
    if (Math.abs(point.x - x) < threshold && Math.abs(point.y - y) < threshold)
      return "nw";
    if (
      Math.abs(point.x - (x + width)) < threshold &&
      Math.abs(point.y - y) < threshold
    )
      return "ne";
    if (
      Math.abs(point.x - x) < threshold &&
      Math.abs(point.y - (y + height)) < threshold
    )
      return "sw";
    if (
      Math.abs(point.x - (x + width)) < threshold &&
      Math.abs(point.y - (y + height)) < threshold
    )
      return "se";

    // Check edges
    if (
      Math.abs(point.y - y) < threshold &&
      point.x >= x &&
      point.x <= x + width
    )
      return "n";
    if (
      Math.abs(point.y - (y + height)) < threshold &&
      point.x >= x &&
      point.x <= x + width
    )
      return "s";
    if (
      Math.abs(point.x - x) < threshold &&
      point.y >= y &&
      point.y <= y + height
    )
      return "w";
    if (
      Math.abs(point.x - (x + width)) < threshold &&
      point.y >= y &&
      point.y <= y + height
    )
      return "e";

    return null;
  };

  const handleMouseDown = (e) => {
    if (step !== 2) return;

    const coords = getCanvasCoordinates(e);

    if (editMode === "reposition" && selectedBox) {
      const box = segmentBoxes[selectedBox.digitIdx]?.[selectedBox.segmentIdx];
      if (box && isPointInBox(coords, box)) {
        setIsDragging(true);
        setDragStart({ x: coords.x - box.x, y: coords.y - box.y });
        return;
      }
    }

    if (editMode === "resize" && selectedBox) {
      const box = segmentBoxes[selectedBox.digitIdx]?.[selectedBox.segmentIdx];
      if (box) {
        const handle = getResizeHandle(coords, box);
        if (handle) {
          setResizeHandle(handle);
          setDragStart(coords);
          return;
        }
      }
    }

    if (editMode === "draw") {
      setStartPoint(coords);
      setIsDrawing(true);
      setTempBox(null);
    }
  };

  const handleMouseMove = (e) => {
    const coords = getCanvasCoordinates(e);

    // Handle repositioning
    if (editMode === "reposition" && isDragging && selectedBox && dragStart) {
      const newSegmentBoxes = [...segmentBoxes];
      const box = newSegmentBoxes[selectedBox.digitIdx][selectedBox.segmentIdx];

      newSegmentBoxes[selectedBox.digitIdx][selectedBox.segmentIdx] = {
        ...box,
        x: coords.x - dragStart.x,
        y: coords.y - dragStart.y,
      };

      setSegmentBoxes(newSegmentBoxes);
      return;
    }

    // Handle resizing
    if (editMode === "resize" && resizeHandle && selectedBox && dragStart) {
      const newSegmentBoxes = [...segmentBoxes];
      const box = {
        ...newSegmentBoxes[selectedBox.digitIdx][selectedBox.segmentIdx],
      };

      const dx = coords.x - dragStart.x;
      const dy = coords.y - dragStart.y;

      switch (resizeHandle) {
        case "nw":
          box.x += dx;
          box.y += dy;
          box.width -= dx;
          box.height -= dy;
          break;
        case "ne":
          box.y += dy;
          box.width += dx;
          box.height -= dy;
          break;
        case "sw":
          box.x += dx;
          box.width -= dx;
          box.height += dy;
          break;
        case "se":
          box.width += dx;
          box.height += dy;
          break;
        case "n":
          box.y += dy;
          box.height -= dy;
          break;
        case "s":
          box.height += dy;
          break;
        case "w":
          box.x += dx;
          box.width -= dx;
          break;
        case "e":
          box.width += dx;
          break;
      }

      // Prevent negative dimensions
      if (box.width > 10 && box.height > 10) {
        newSegmentBoxes[selectedBox.digitIdx][selectedBox.segmentIdx] = box;
        setSegmentBoxes(newSegmentBoxes);
        setDragStart(coords);
      }
      return;
    }

    // Handle drawing
    if (editMode === "draw" && isDrawing && startPoint) {
      setTempBox({
        x: Math.min(startPoint.x, coords.x),
        y: Math.min(startPoint.y, coords.y),
        width: Math.abs(coords.x - startPoint.x),
        height: Math.abs(coords.y - startPoint.y),
      });
    }
  };

  const handleMouseUp = () => {
    if (editMode === "reposition" && isDragging) {
      setIsDragging(false);
      setDragStart(null);
      return;
    }

    if (editMode === "resize" && resizeHandle) {
      setResizeHandle(null);
      setDragStart(null);
      return;
    }

    if (editMode === "draw") {
      if (!isDrawing || !tempBox) {
        setIsDrawing(false);
        setStartPoint(null);
        return;
      }

      setIsDrawing(false);
      setStartPoint(null);

      if (tempBox.width < 10 || tempBox.height < 10) {
        setTempBox(null);
        return;
      }

      const newSegmentBoxes = [...segmentBoxes];
      if (!newSegmentBoxes[currentDigit]) {
        newSegmentBoxes[currentDigit] = [];
      }
      newSegmentBoxes[currentDigit][currentSegment] = tempBox;
      setSegmentBoxes(newSegmentBoxes);
      setTempBox(null);

      if (currentSegment < 6) {
        setCurrentSegment(currentSegment + 1);
      } else if (currentDigit < 2) {
        setCurrentDigit(currentDigit + 1);
        setCurrentSegment(0);
      }
    }
  };

  const removeCurrentSegment = () => {
    if (editMode === "draw") {
      const newSegmentBoxes = [...segmentBoxes];
      if (
        newSegmentBoxes[currentDigit] &&
        newSegmentBoxes[currentDigit][currentSegment]
      ) {
        newSegmentBoxes[currentDigit][currentSegment] = null;
        setSegmentBoxes(newSegmentBoxes);
      }
    } else if (selectedBox) {
      const newSegmentBoxes = [...segmentBoxes];
      if (
        newSegmentBoxes[selectedBox.digitIdx] &&
        newSegmentBoxes[selectedBox.digitIdx][selectedBox.segmentIdx]
      ) {
        newSegmentBoxes[selectedBox.digitIdx][selectedBox.segmentIdx] = null;
        setSegmentBoxes(newSegmentBoxes);
        setSelectedBox(null);
      }
    }
  };

  const clearAllSegments = () => {
    setSegmentBoxes([[], [], []]);
    setCurrentDigit(0);
    setCurrentSegment(0);
    setEditMode("draw");
    setSelectedBox(null);
  };

  const skipCurrent = () => {
    if (currentSegment < 6) {
      setCurrentSegment(currentSegment + 1);
    } else if (currentDigit < 2) {
      setCurrentDigit(currentDigit + 1);
      setCurrentSegment(0);
    }
  };

  const goBackStep = () => {
    if (step === 2) {
      retakePhoto();
    } else if (step === 3) {
      setStep(2);
      setRecognitionResult(null);
      setDebugInfo(null);
    }
  };

  const handleSegmentSelection = (digitIdx, segmentIdx) => {
    console.log("Segment selected:", { digitIdx, segmentIdx });
    setSelectedBox({ digitIdx, segmentIdx });
    setCurrentDigit(digitIdx);
    setCurrentSegment(segmentIdx);
    // If not in draw mode, stay in current edit mode, otherwise switch to reposition
    if (editMode === "draw") {
      console.log("Switching to reposition mode");
    }
  };

  const completeCalibration = async () => {
    setIsProcessing(true);
    setError(null);

    try {
      // Laravel backend for database operations - always use port 8000
      const LARAVEL_API_URL = "http://127.0.0.1:8000";

      console.log("Saving calibration to Laravel:", {
        device_name: "Moisture Meter",
        num_digits: 3,
        segment_boxes: segmentBoxes,
      });

      const response = await fetch(`${LARAVEL_API_URL}/api/calibration`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          device_name: "Moisture Meter",
          setting_type: "seven_segment",
          num_digits: 3,
          display_box: displayBox,
          segment_boxes: segmentBoxes,
          has_decimal_point: hasDecimalPoint,
          decimal_position: decimalPosition,
          calibration_image_size: imageSize,
          notes: "Created from calibration wizard",
        }),
      });

      console.log("Laravel response status:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Laravel error response:", errorText);
        throw new Error(
          `Failed to save calibration (${response.status}): ${errorText.substring(0, 200)}`,
        );
      }

      const data = await response.json();
      console.log("Laravel response data:", data);

      if (!data.success) {
        throw new Error(data.message || "Calibration failed");
      }

      // Try to save to Python backend (non-critical)
      try {
        console.log("Saving calibration to Python backend...");
        const pythonResponse = await fetch(
          `${API_URL}/seven-segment/calibrate`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              displayBox,
              segmentBoxes,
              hasDecimalPoint,
              decimalPosition,
              calibrationImageSize: imageSize,
            }),
          },
        );

        if (pythonResponse.ok) {
          console.log("Python backend calibration saved successfully");
        } else {
          console.warn("Python backend returned error:", pythonResponse.status);
        }
      } catch (pythonErr) {
        console.warn(
          "Python backend calibration failed (non-critical):",
          pythonErr.message,
        );
      }

      setStep(3);
    } catch (err) {
      console.error("Calibration error:", err);
      setError(
        err.message ||
          "Failed to save calibration. Please check the console for details.",
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const reset = () => {
    setStep(1);
    setCapturedImage(null);
    setUploadedFile(null);
    setDisplayBox(null);
    setImageSize({ width: 0, height: 0 });
    setSegmentBoxes([[], [], []]);
    setCurrentDigit(0);
    setCurrentSegment(0);
    setRecognitionResult(null);
    setDebugInfo(null);
    setError(null);
    setEditMode("draw");
    setSelectedBox(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const useThisCalibration = () => {
    if (onComplete) {
      onComplete();
    }
  };

  // Draw canvas with segment boxes
  useEffect(() => {
    if (!capturedImage || !overlayCanvasRef.current) return;

    const canvas = overlayCanvasRef.current;
    const ctx = canvas.getContext("2d");
    const img = new Image();

    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw display box
      if (displayBox && step >= 2) {
        ctx.strokeStyle = "#00ffff";
        ctx.lineWidth = 3;
        ctx.strokeRect(
          displayBox.x,
          displayBox.y,
          displayBox.width,
          displayBox.height,
        );
      }

      // Draw all segment boxes
      if (step >= 2) {
        segmentBoxes.forEach((digit, digitIdx) => {
          if (digit) {
            digit.forEach((seg, segIdx) => {
              if (seg) {
                const isSelected =
                  selectedBox &&
                  selectedBox.digitIdx === digitIdx &&
                  selectedBox.segmentIdx === segIdx;
                const isActive =
                  digitIdx === currentDigit &&
                  segIdx === currentSegment &&
                  step === 2 &&
                  editMode === "draw";

                let strokeColor = DIGIT_COLORS[digitIdx];
                let lineWidth = 2;
                let fillAlpha = 0;

                if (isSelected) {
                  strokeColor = "#fbbf24";
                  lineWidth = 3;
                  fillAlpha = 0.3;
                } else if (isActive) {
                  strokeColor = "#fbbf24";
                  lineWidth = 3;
                }

                ctx.strokeStyle = strokeColor;
                ctx.lineWidth = lineWidth;
                ctx.strokeRect(seg.x, seg.y, seg.width, seg.height);

                if (fillAlpha > 0) {
                  ctx.fillStyle = strokeColor
                    .replace(")", `, ${fillAlpha})`)
                    .replace("rgb", "rgba");
                  ctx.fillRect(seg.x, seg.y, seg.width, seg.height);
                }

                // Draw label
                ctx.fillStyle = strokeColor;
                ctx.font = "bold 14px Arial";
                ctx.fillText(
                  `D${digitIdx + 1}${["A", "B", "C", "D", "E", "F", "G"][segIdx]}`,
                  seg.x + 5,
                  seg.y + 20,
                );

                // Draw resize handles if selected and in resize mode
                if (isSelected && editMode === "resize") {
                  const handleSize = 8;
                  ctx.fillStyle = "#fbbf24";

                  // Corners
                  ctx.fillRect(
                    seg.x - handleSize / 2,
                    seg.y - handleSize / 2,
                    handleSize,
                    handleSize,
                  );
                  ctx.fillRect(
                    seg.x + seg.width - handleSize / 2,
                    seg.y - handleSize / 2,
                    handleSize,
                    handleSize,
                  );
                  ctx.fillRect(
                    seg.x - handleSize / 2,
                    seg.y + seg.height - handleSize / 2,
                    handleSize,
                    handleSize,
                  );
                  ctx.fillRect(
                    seg.x + seg.width - handleSize / 2,
                    seg.y + seg.height - handleSize / 2,
                    handleSize,
                    handleSize,
                  );

                  // Edges
                  ctx.fillRect(
                    seg.x + seg.width / 2 - handleSize / 2,
                    seg.y - handleSize / 2,
                    handleSize,
                    handleSize,
                  );
                  ctx.fillRect(
                    seg.x + seg.width / 2 - handleSize / 2,
                    seg.y + seg.height - handleSize / 2,
                    handleSize,
                    handleSize,
                  );
                  ctx.fillRect(
                    seg.x - handleSize / 2,
                    seg.y + seg.height / 2 - handleSize / 2,
                    handleSize,
                    handleSize,
                  );
                  ctx.fillRect(
                    seg.x + seg.width - handleSize / 2,
                    seg.y + seg.height / 2 - handleSize / 2,
                    handleSize,
                    handleSize,
                  );
                }
              }
            });
          }
        });
      }

      // Draw temp box
      if (tempBox) {
        ctx.strokeStyle = "#fbbf24";
        ctx.lineWidth = 3;
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(tempBox.x, tempBox.y, tempBox.width, tempBox.height);
        ctx.setLineDash([]);
      }
    };

    img.src = capturedImage;
  }, [
    capturedImage,
    displayBox,
    segmentBoxes,
    tempBox,
    step,
    currentDigit,
    currentSegment,
    isDrawing,
    editMode,
    selectedBox,
  ]);

  return (
    <div className="min-h-screen bg-gray-900 p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Square className="w-7 h-7 text-blue-400" />
            7-Segment Calibration
          </h1>

          {onCancel && (
            <button
              onClick={onCancel}
              className="px-5 py-2.5 bg-gray-700 text-white rounded-xl hover:bg-gray-600 transition-colors font-medium"
            >
              Cancel
            </button>
          )}
        </div>

        {/* Backend Status Indicator */}
        <div className="mb-6">
          <BackendStatusIndicator />
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-900 border border-red-700 rounded-xl flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div className="text-red-200 text-sm">{error}</div>
          </div>
        )}

        {/* Progress Stepper */}
        <div className="mb-8 flex items-center justify-center gap-4">
          <div
            className={`flex items-center gap-3 ${step >= 1 ? "opacity-100" : "opacity-50"}`}
          >
            <div
              className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg ${
                step > 1
                  ? "bg-green-600 text-white"
                  : step === 1
                    ? "bg-blue-600 text-white"
                    : "bg-gray-700 text-gray-400"
              }`}
            >
              {step > 1 ? "✓" : "1"}
            </div>
            <span className="text-white font-medium">Upload</span>
          </div>

          <div className="w-16 h-0.5 bg-gray-700"></div>

          <div
            className={`flex items-center gap-3 ${step >= 2 ? "opacity-100" : "opacity-50"}`}
          >
            <div
              className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg ${
                step > 2
                  ? "bg-green-600 text-white"
                  : step === 2
                    ? "bg-blue-600 text-white"
                    : "bg-gray-700 text-gray-400"
              }`}
            >
              {step > 2 ? "✓" : "2"}
            </div>
            <span className="text-white font-medium">Segments</span>
          </div>

          <div className="w-16 h-0.5 bg-gray-700"></div>

          <div
            className={`flex items-center gap-3 ${step >= 3 ? "opacity-100" : "opacity-50"}`}
          >
            <div
              className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg ${
                step === 3
                  ? "bg-blue-600 text-white"
                  : "bg-gray-700 text-gray-400"
              }`}
            >
              3
            </div>
            <span className="text-white font-medium">Test</span>
          </div>
        </div>

        {/* Step 1: Upload Image */}
        {step === 1 && (
          <div className="space-y-6">
            {/* Upload Section - Show upload area or preview */}
            {!capturedImage ? (
              <div className="bg-gray-800 rounded-xl p-8 border-2 border-dashed border-gray-600 hover:border-blue-500 transition-colors">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="image-upload"
                />
                <label
                  htmlFor="image-upload"
                  className="cursor-pointer flex flex-col items-center gap-4"
                >
                  <Upload className="w-16 h-16 text-gray-400" />
                  <div className="text-center">
                    <div className="text-white font-semibold text-lg mb-2">
                      Upload Moisture Meter Image
                    </div>
                    <div className="text-gray-400 text-sm">
                      Click to select an image of the 7-segment display
                    </div>
                  </div>
                </label>
              </div>
            ) : (
              /* Image Preview after upload */
              <div className="bg-gray-800 rounded-xl p-6">
                <h3 className="text-lg font-bold text-white mb-4">
                  Uploaded Image Preview
                </h3>
                <div className="relative">
                  <img
                    src={capturedImage}
                    alt="Uploaded preview"
                    className="w-full max-h-64 object-contain rounded-lg border border-gray-700"
                  />
                </div>
                <button
                  onClick={retakePhoto}
                  className="mt-4 w-full py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg flex items-center justify-center gap-2 transition-colors"
                >
                  <X className="w-4 h-4" />
                  Clear & Upload Different Image
                </button>
              </div>
            )}

            {/* Decimal Point Configuration */}
            <div className="bg-gray-800 rounded-xl p-6">
              <h3 className="text-lg font-bold text-white mb-4">
                Decimal Point Configuration
              </h3>
              <p className="text-gray-400 text-sm mb-4">
                Configure how the reading should be formatted (e.g., 319 →
                31.9%)
              </p>

              {/* Has Decimal Point Toggle */}
              <div className="flex items-center justify-between p-4 bg-gray-700 rounded-lg mb-4">
                <div>
                  <div className="text-white font-medium">
                    Has Decimal Point
                  </div>
                  <div className="text-gray-400 text-sm">
                    Enable if the display shows decimal values
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setHasDecimalPoint(!hasDecimalPoint)}
                  className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
                    hasDecimalPoint ? "bg-blue-600" : "bg-gray-600"
                  }`}
                >
                  <span
                    className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                      hasDecimalPoint ? "translate-x-7" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>

              {/* Decimal Position Selector */}
              {hasDecimalPoint && (
                <div className="p-4 bg-gray-700 rounded-lg">
                  <div className="text-white font-medium mb-3">
                    Decimal Position (from right)
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex gap-2">
                      {[1, 2].map((pos) => (
                        <button
                          key={pos}
                          type="button"
                          onClick={() => setDecimalPosition(pos)}
                          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                            decimalPosition === pos
                              ? "bg-blue-600 text-white"
                              : "bg-gray-600 text-gray-300 hover:bg-gray-500"
                          }`}
                        >
                          {pos}
                        </button>
                      ))}
                    </div>
                    <div className="text-gray-400 text-sm">
                      Preview:{" "}
                      <span className="text-white font-mono">
                        {decimalPosition === 1 ? "31.90" : "3.19"}
                      </span>{" "}
                      (from 319)
                    </div>
                  </div>
                </div>
              )}

              {/* Preview */}
              <div className="mt-4 p-4 bg-gray-900 rounded-lg text-center">
                <div className="text-gray-400 text-sm mb-2">Format Preview</div>
                <div className="text-3xl font-bold text-green-400 font-mono">
                  {hasDecimalPoint
                    ? decimalPosition === 1
                      ? "31.90 %"
                      : "3.19 %"
                    : "319 %"}
                </div>
                <div className="text-gray-500 text-xs mt-2">
                  (Always 2 decimal places for database storage)
                </div>
              </div>
            </div>

            {/* Next Button - Only show when image is uploaded */}
            {capturedImage && (
              <div className="flex justify-end">
                <button
                  onClick={() => {
                    setStep(2);
                    setCurrentDigit(0);
                    setCurrentSegment(0);
                  }}
                  className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold flex items-center gap-2 transition-colors"
                >
                  Next: Draw Segments
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Draw Segment Boxes */}
        {step === 2 && (
          <div className="space-y-6">
            <div className="bg-gray-800 rounded-xl p-6">
              <h2 className="text-xl font-bold text-white mb-4">
                Draw Segment Boxes
              </h2>

              {/* Digit Progress */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                {[0, 1, 2].map((digitIdx) => (
                  <div
                    key={digitIdx}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      digitIdx === currentDigit && editMode === "draw"
                        ? "border-blue-500 bg-blue-900/20"
                        : "border-gray-700 bg-gray-750"
                    }`}
                  >
                    <div
                      className={`text-center font-bold mb-2 ${
                        digitIdx === 0
                          ? "text-blue-400"
                          : digitIdx === 1
                            ? "text-red-400"
                            : "text-green-400"
                      }`}
                    >
                      Digit {digitIdx + 1}
                    </div>
                    <div className="text-sm text-gray-400 text-center mb-3">
                      {segmentBoxes[digitIdx]
                        ? segmentBoxes[digitIdx].filter((s) => s).length
                        : 0}{" "}
                      / 7 segments
                    </div>
                    <div className="flex flex-wrap gap-1.5 justify-center">
                      {["A", "B", "C", "D", "E", "F", "G"].map(
                        (seg, segIdx) => {
                          const hasBox = segmentBoxes[digitIdx]?.[segIdx];
                          const isSelected =
                            selectedBox?.digitIdx === digitIdx &&
                            selectedBox?.segmentIdx === segIdx;

                          return (
                            <button
                              key={segIdx}
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                console.log(
                                  `Clicked ${seg} on Digit ${digitIdx + 1}`,
                                );
                                handleSegmentSelection(digitIdx, segIdx);
                              }}
                              disabled={!hasBox}
                              className={`text-xs px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                                hasBox
                                  ? isSelected
                                    ? "bg-yellow-500 text-white ring-2 ring-yellow-400 shadow-lg scale-110"
                                    : "bg-green-600 text-white hover:bg-green-700 hover:scale-105 active:scale-95"
                                  : "bg-gray-700 text-gray-500 cursor-not-allowed opacity-50"
                              }`}
                              title={
                                hasBox
                                  ? `Select ${seg} segment`
                                  : `${seg} segment not drawn yet`
                              }
                            >
                              {seg}
                            </button>
                          );
                        },
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Edit Mode Buttons */}
              <div className="mb-6">
                <div className="text-sm text-gray-400 mb-3">
                  Edit Mode:{" "}
                  {!selectedBox ? (
                    <span className="text-yellow-400 ml-2 font-semibold">
                      ← Click a GREEN segment badge above to enable
                      Reposition/Resize
                    </span>
                  ) : (
                    <span className="text-green-400 ml-2 font-semibold">
                      Selected: Digit {selectedBox.digitIdx + 1} - Segment{" "}
                      {
                        ["A", "B", "C", "D", "E", "F", "G"][
                          selectedBox.segmentIdx
                        ]
                      }
                    </span>
                  )}
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setEditMode("draw");
                      setSelectedBox(null);
                    }}
                    className={`flex-1 py-3 px-4 rounded-xl font-medium transition-all ${
                      editMode === "draw"
                        ? "bg-blue-600 text-white shadow-lg"
                        : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                    }`}
                  >
                    Draw New
                  </button>
                  <button
                    onClick={() => setEditMode("reposition")}
                    disabled={!selectedBox}
                    title={
                      !selectedBox
                        ? "Select a segment first"
                        : "Move selected segment box"
                    }
                    className={`flex-1 py-3 px-4 rounded-xl font-medium transition-all flex items-center justify-center gap-2 ${
                      editMode === "reposition"
                        ? "bg-purple-600 text-white shadow-lg"
                        : selectedBox
                          ? "bg-gray-700 text-gray-300 hover:bg-gray-600"
                          : "bg-gray-800 text-gray-500 cursor-not-allowed"
                    }`}
                  >
                    <Move className="w-4 h-4" />
                    Reposition
                  </button>
                  <button
                    onClick={() => setEditMode("resize")}
                    disabled={!selectedBox}
                    title={
                      !selectedBox
                        ? "Select a segment first"
                        : "Resize selected segment box"
                    }
                    className={`flex-1 py-3 px-4 rounded-xl font-medium transition-all flex items-center justify-center gap-2 ${
                      editMode === "resize"
                        ? "bg-orange-600 text-white shadow-lg"
                        : selectedBox
                          ? "bg-gray-700 text-gray-300 hover:bg-gray-600"
                          : "bg-gray-800 text-gray-500 cursor-not-allowed"
                    }`}
                  >
                    <Maximize2 className="w-4 h-4" />
                    Resize
                  </button>
                </div>
              </div>

              {/* Current Instruction */}
              {editMode === "draw" && (
                <div className="bg-blue-900/30 border border-blue-700 rounded-xl p-4 mb-6">
                  <div className="text-center">
                    <div className="font-semibold text-blue-300 mb-1">
                      Current: Digit {currentDigit + 1} - Segment{" "}
                      {SEGMENT_LABELS[currentSegment]}
                    </div>
                    <div className="text-sm text-blue-200">
                      Draw a box around the {SEGMENT_LABELS[currentSegment]}{" "}
                      segment
                    </div>
                  </div>
                </div>
              )}

              {editMode === "reposition" && selectedBox && (
                <div className="bg-purple-900/30 border border-purple-700 rounded-xl p-4 mb-6">
                  <div className="text-center">
                    <div className="font-semibold text-purple-300 mb-1">
                      Repositioning: Digit {selectedBox.digitIdx + 1} - Segment{" "}
                      {
                        ["A", "B", "C", "D", "E", "F", "G"][
                          selectedBox.segmentIdx
                        ]
                      }
                    </div>
                    <div className="text-sm text-purple-200">
                      Click and drag the box to move it
                    </div>
                  </div>
                </div>
              )}

              {editMode === "resize" && selectedBox && (
                <div className="bg-orange-900/30 border border-orange-700 rounded-xl p-4 mb-6">
                  <div className="text-center">
                    <div className="font-semibold text-orange-300 mb-1">
                      Resizing: Digit {selectedBox.digitIdx + 1} - Segment{" "}
                      {
                        ["A", "B", "C", "D", "E", "F", "G"][
                          selectedBox.segmentIdx
                        ]
                      }
                    </div>
                    <div className="text-sm text-orange-200">
                      Drag the handles to resize the box
                    </div>
                  </div>
                </div>
              )}

              {/* Canvas Area */}
              <div className="relative bg-black rounded-xl overflow-hidden mb-6">
                <img
                  src={capturedImage}
                  alt="Display"
                  className="w-full h-auto"
                  style={{ maxHeight: "600px", objectFit: "contain" }}
                />
                <canvas
                  ref={overlayCanvasRef}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  className="absolute top-0 left-0 w-full h-full cursor-crosshair"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 justify-center mb-4">
                <button
                  onClick={goBackStep}
                  className="px-5 py-2.5 bg-gray-700 text-white rounded-xl hover:bg-gray-600 flex items-center gap-2 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </button>

                <button
                  onClick={removeCurrentSegment}
                  disabled={
                    editMode === "draw"
                      ? !segmentBoxes[currentDigit]?.[currentSegment]
                      : !selectedBox
                  }
                  className="px-5 py-2.5 bg-orange-600 text-white rounded-xl hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Remove
                </button>

                <button
                  onClick={clearAllSegments}
                  className="px-5 py-2.5 bg-red-600 text-white rounded-xl hover:bg-red-700 flex items-center gap-2 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Clear All
                </button>

                <button
                  onClick={skipCurrent}
                  disabled={
                    editMode !== "draw" ||
                    (currentDigit === 2 && currentSegment === 6)
                  }
                  className="px-5 py-2.5 bg-yellow-600 text-white rounded-xl hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
                >
                  Skip
                </button>
              </div>

              {/* Complete Calibration Button */}
              <div className="flex justify-center">
                <button
                  onClick={completeCalibration}
                  disabled={
                    isProcessing ||
                    segmentBoxes.flat().filter((s) => s).length < 21
                  }
                  className="px-8 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors shadow-lg"
                >
                  {isProcessing ? "Saving..." : "Complete Calibration"}
                  <Check className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Test Recognition */}
        {step === 3 && (
          <div className="space-y-6">
            {/* Main Test Container */}
            <div className="grid grid-cols-2 gap-6">
              {/* Left Column - Uploaded Image */}
              <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                <h3 className="text-lg font-bold text-white mb-4">
                  1. Uploaded Image
                </h3>
                <div className="bg-black rounded-xl overflow-hidden mb-4">
                  {capturedImage ? (
                    <img
                      src={capturedImage}
                      alt="Uploaded display"
                      className="w-full h-auto"
                      style={{ maxHeight: "400px", objectFit: "contain" }}
                    />
                  ) : (
                    <div className="h-64 flex items-center justify-center text-gray-500">
                      No image available
                    </div>
                  )}
                </div>
                <button
                  onClick={() => {
                    setRecognitionResult(null);
                    setVisualizationImage(null);
                  }}
                  className="w-full bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-xl flex items-center justify-center gap-2 transition-colors"
                >
                  <X className="w-4 h-4" />
                  Clear
                </button>
              </div>

              {/* Right Column - Visualization */}
              <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                <h3 className="text-lg font-bold text-white mb-4">
                  Visualization
                </h3>
                <div className="bg-black rounded-xl overflow-hidden border-2 border-cyan-500">
                  {visualizationImage ? (
                    <img
                      src={visualizationImage}
                      alt="Segment visualization"
                      className="w-full h-auto"
                      style={{ maxHeight: "400px", objectFit: "contain" }}
                    />
                  ) : (
                    <div className="h-64 flex items-center justify-center text-gray-500">
                      Click "Visualize" to see segment detection
                    </div>
                  )}
                </div>
                <div className="mt-4 text-center text-sm text-gray-400">
                  Green boxes (1) = Segment ON | Red boxes (0) = Segment OFF
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4 justify-center">
              <button
                onClick={async () => {
                  setIsProcessing(true);
                  setError(null);
                  try {
                    // First, send the current calibration to Flask before visualizing
                    // This ensures Flask uses the segment boxes drawn in Step 2
                    console.log(
                      "Sending calibration to Flask before visualization...",
                    );
                    const calibrationResponse = await fetch(
                      `${API_URL}/seven-segment/calibrate`,
                      {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          displayBox,
                          segmentBoxes,
                          hasDecimalPoint,
                          decimalPosition,
                          calibrationImageSize: imageSize,
                        }),
                      },
                    );

                    if (!calibrationResponse.ok) {
                      console.warn(
                        "Failed to send calibration to Flask, continuing anyway...",
                      );
                    } else {
                      const calibrationData = await calibrationResponse.json();
                      console.log(
                        "Calibration sent to Flask:",
                        calibrationData,
                      );
                    }

                    // Now perform visualization with the calibration loaded
                    const formData = new FormData();
                    formData.append("image", uploadedFile);
                    formData.append("method", "simple_threshold");

                    const response = await fetch(
                      `${API_URL}/seven-segment/visualize`,
                      {
                        method: "POST",
                        body: formData,
                      },
                    );

                    if (!response.ok) {
                      throw new Error(
                        `Backend error: ${response.status} ${response.statusText}. Make sure Python Flask backend is running on ${API_URL}`,
                      );
                    }

                    const contentType = response.headers.get("content-type");
                    if (
                      !contentType ||
                      !contentType.includes("application/json")
                    ) {
                      throw new Error(
                        `Backend returned HTML instead of JSON. Make sure Python Flask backend is running on ${API_URL}`,
                      );
                    }

                    const data = await response.json();

                    if (!data.success) {
                      throw new Error(data.error || "Visualization failed");
                    }

                    setVisualizationImage(
                      `data:image/png;base64,${data.visualization}`,
                    );
                  } catch (err) {
                    setError(err.message || "Failed to visualize segments");
                    console.error("Visualization error:", err);
                  } finally {
                    setIsProcessing(false);
                  }
                }}
                disabled={isProcessing || !uploadedFile}
                className="flex-1 bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
              >
                <Eye className="w-5 h-5" />
                {isProcessing ? "Processing..." : "Visualize"}
              </button>

              <button
                onClick={testRecognition}
                disabled={isProcessing || !uploadedFile}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
              >
                <Check className="w-5 h-5" />
                {isProcessing ? "Recognizing..." : "Recognize"}
              </button>
            </div>

            {/* Legend */}
            <div className="bg-gray-800 rounded-xl p-6">
              <h3 className="text-lg font-bold text-white mb-4">Legend</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-green-600 rounded-lg flex items-center justify-center text-white font-bold text-xl">
                    1
                  </div>
                  <div>
                    <div className="text-green-400 font-semibold">
                      Segment ON
                    </div>
                    <div className="text-gray-400 text-sm">
                      Green box with "1"
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-red-900 rounded-lg flex items-center justify-center text-red-300 font-bold text-xl">
                    0
                  </div>
                  <div>
                    <div className="text-red-400 font-semibold">
                      Segment OFF
                    </div>
                    <div className="text-gray-400 text-sm">
                      Red box with "0"
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Recognition Result */}
            {recognitionResult && (
              <div className="space-y-6">
                {/* Detected Reading */}
                <div
                  className={`rounded-xl p-8 text-center ${
                    recognitionResult.is_valid
                      ? "bg-green-900/30 border border-green-700"
                      : "bg-yellow-900/30 border border-yellow-700"
                  }`}
                >
                  <div className="text-gray-300 text-sm mb-3">
                    Detected Reading
                  </div>
                  <div
                    className={`text-7xl font-bold mb-3 ${
                      recognitionResult.is_valid
                        ? "text-green-400"
                        : "text-yellow-400"
                    }`}
                  >
                    {formatNumberWithDecimal(
                      recognitionResult.full_number,
                      hasDecimalPoint,
                      decimalPosition,
                    )}
                    {hasDecimalPoint && " %"}
                  </div>
                  <div className="text-sm text-gray-400">
                    {hasDecimalPoint && (
                      <span>
                        Decimal position: {decimalPosition} from right
                      </span>
                    )}
                  </div>
                  <div className="mt-2 text-sm">
                    {recognitionResult.is_valid ? (
                      <span className="text-green-400">✓ Valid</span>
                    ) : (
                      <span className="text-yellow-400">
                        ⚠ Contains unknown segments
                      </span>
                    )}
                  </div>
                </div>

                {/* Per-Digit Breakdown */}
                <div className="bg-gray-800 rounded-xl p-6">
                  <h3 className="text-lg font-bold text-white mb-4">
                    Per-Digit Breakdown
                  </h3>
                  <div className="grid grid-cols-3 gap-4">
                    {recognitionResult.digits.map((digit, idx) => (
                      <div key={idx} className="bg-gray-700 rounded-xl p-5">
                        <div className="text-center mb-3">
                          <div className="text-gray-400 text-xs mb-2">
                            Digit {idx + 1}
                          </div>
                          <div
                            className="text-5xl font-bold"
                            style={{ color: DIGIT_COLORS[idx] }}
                          >
                            {digit.recognized_digit}
                          </div>
                        </div>
                        <div className="text-xs text-center mb-3">
                          <div className="text-gray-400 mb-1">Binary</div>
                          <span className="font-mono text-white">
                            {digit.binary_code}
                          </span>
                        </div>
                        <div className="grid grid-cols-7 gap-1">
                          {["A", "B", "C", "D", "E", "F", "G"].map((seg, i) => (
                            <div
                              key={seg}
                              className={`text-center p-1.5 rounded-lg text-xs font-bold ${
                                digit.segment_states[i]
                                  ? "bg-green-600 text-white"
                                  : "bg-red-900 text-red-300"
                              }`}
                            >
                              {seg}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Method Info */}
                <div className="bg-gray-800 rounded-xl p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm text-gray-400">Method</div>
                      <div className="text-white font-semibold">
                        Simple Threshold
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-400">Valid</div>
                      <div className="text-white font-semibold">
                        {recognitionResult.is_valid ? "Yes ✓" : "No ✗"}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex gap-3 justify-center pt-6 border-t border-gray-700">
              <button
                onClick={goBackStep}
                className="px-5 py-2.5 bg-gray-700 text-white rounded-xl hover:bg-gray-600 flex items-center gap-2 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>

              <button
                onClick={reset}
                className="px-5 py-2.5 bg-gray-700 text-white rounded-xl hover:bg-gray-600 flex items-center gap-2 transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                Start Over
              </button>

              <button
                onClick={useThisCalibration}
                disabled={!recognitionResult}
                className="px-8 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Use This Calibration
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SevenSegmentCalibration;
