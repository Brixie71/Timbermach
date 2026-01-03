from flask import Flask, request, jsonify
from flask_cors import CORS
import cv2
import numpy as np
import pytesseract
from PIL import Image
from flasgger import Swagger
import base64
import json
import requests

# Import our edge detection utilities
from edge_detection_utils import (
    detect_wood_dimensions,
    process_image_for_edge_detection,
    enhance_contrast,
    gaussian_smooth,
    adaptive_threshold,
    convert_to_grayscale
)

from auto_detection_utils import WoodAutoDetector, visualize_detection

# Import seven-segment OCR utilities
from seven_segment_ocr import SevenSegmentOCR, create_default_segment_boxes

# Import manual measurement utilities
from manual_measurement_utils import (
    calculate_calibration_from_distance,
    calculate_measurements_from_lines,
    draw_measurement_lines,
    validate_line_positions
)

app = Flask(__name__)

# Configure CORS properly
CORS(app, resources={
    r"/*": {
        "origins": ["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173", "http://127.0.0.1:3000", "http://127.0.0.1:8000"],
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"],
        "expose_headers": ["Content-Type"],
        "supports_credentials": True
    }
})

# Laravel API URL
LARAVEL_API_URL = 'http://127.0.0.1:8000'

# Initialize Swagger
swagger_config = {
    "headers": [],
    "specs": [
        {
            "endpoint": 'apispec_1',
            "route": '/apispec_1.json',
            "rule_filter": lambda rule: True,
            "model_filter": lambda tag: True,
        }
    ],
    "static_url_path": "/flasgger_static",
    "swagger_ui": True,
    "specs_route": "/apidocs/"
}

swagger_template = {
    "swagger": "2.0",
    "info": {
        "title": "TimberMach Measurement API",
        "description": "API for wood measurement using computer vision and OCR",
        "version": "1.0.0"
    },
    "host": "localhost:5000",
    "basePath": "/",
    "schemes": ["http"],
}

swagger = Swagger(app, config=swagger_config, template=swagger_template)

# Tesseract configuration
TESSERACT_PATH = "C:/Program Files/Tesseract-OCR/tesseract.exe"

try:
    pytesseract.pytesseract.tesseract_cmd = TESSERACT_PATH
    print(f"âœ“ Tesseract path set: {TESSERACT_PATH}")
except Exception as e:
    print(f"âœ— Tesseract error: {e}")

# Seven-segment OCR instance
seven_segment_ocr = SevenSegmentOCR()


def load_calibration_from_laravel():
    """Load active calibration from Laravel database"""
    try:
        print("ðŸ“„ Loading calibration from Laravel...")
        response = requests.get(f'{LARAVEL_API_URL}/api/calibration', timeout=5)
        
        if not response.ok:
            print(f"âŒ Failed to fetch from Laravel: {response.status_code}")
            return False
        
        calibrations = response.json()
        active_calibration = None
        
        for cal in calibrations:
            if cal.get('is_active'):
                active_calibration = cal
                break
        
        if not active_calibration:
            print("âŒ No active calibration found")
            return False
        
        seven_segment_ocr.set_calibration(
            display_box=active_calibration['display_box'],
            segment_boxes=active_calibration['segment_boxes'],
            has_decimal_point=active_calibration.get('has_decimal_point', False),
            decimal_position=active_calibration.get('decimal_position', 1)
        )
        
        print(f"âœ… Loaded calibration (ID: {active_calibration['id']})")
        return True
        
    except Exception as e:
        print(f"âŒ Error loading calibration: {e}")
        return False


# --- MANUAL MEASUREMENT ENDPOINTS ---
@app.route('/manual-measure/calculate', methods=['POST'])
def manual_measure_calculate():
    """
    Calculate measurements from user-defined line positions
    ---
    tags:
      - Manual Measurement
    consumes:
      - multipart/form-data
    parameters:
      - name: image
        in: formData
        type: file
        required: true
      - name: widthLine1
        in: formData
        type: integer
        required: true
      - name: widthLine2
        in: formData
        type: integer
        required: true
      - name: heightLine1
        in: formData
        type: integer
        required: true
      - name: heightLine2
        in: formData
        type: integer
        required: true
      - name: cameraDistance
        in: formData
        type: number
        required: true
      - name: calibrationFactor
        in: formData
        type: number
        required: false
    responses:
      200:
        description: Measurement calculation successful
      400:
        description: Bad request
    """
    try:
        if 'image' not in request.files:
            return jsonify({"error": "No image file", "success": False}), 400
        
        # READ IMAGE FIRST to get dimensions
        image_file = request.files['image']
        image_bytes = image_file.read()
        nparr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if img is None:
            return jsonify({"error": "Failed to decode image", "success": False}), 400
        
        # Get actual image dimensions
        img_height, img_width = img.shape[:2]
        
        # Get line positions
        width_line1 = int(request.form.get('widthLine1', 0))
        width_line2 = int(request.form.get('widthLine2', 0))
        height_line1 = int(request.form.get('heightLine1', 0))
        height_line2 = int(request.form.get('heightLine2', 0))
        camera_distance = float(request.form.get('cameraDistance', 300))

        # Calculate calibration factor FIRST (needed for 4-inch limit validation)
        calibration_factor = calculate_calibration_from_distance(
            camera_distance, 
            image_width=img_width
        )
        
        # Validate line positions WITH calibration factor for 4-inch limit check
        is_valid, error_msg = validate_line_positions(
            width_line1, width_line2, height_line1, height_line2,
            img_width, img_height,
            calibration_factor  # â† ADD THIS 7th PARAMETER
        )
        
        if not is_valid:
            return jsonify({"error": error_msg, "success": False}), 400
        
        # Calculate calibration factor WITH image width
        calibration_factor = calculate_calibration_from_distance(
            camera_distance, 
            image_width=img_width  # <-- ADD THIS PARAMETER
        )
        
        # Calculate measurements
        measurements = calculate_measurements_from_lines(
            width_line1, width_line2,
            height_line1, height_line2,
            calibration_factor
        )
        
        # Add camera distance and dimensions to result
        measurements['cameraDistance'] = camera_distance
        measurements['imageWidth'] = img_width
        measurements['imageHeight'] = img_height
        measurements['success'] = True
        
        return jsonify(measurements)
        
    except Exception as e:
        print(f"ERROR: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e), "success": False}), 500


@app.route('/manual-measure/visualize', methods=['POST'])
def manual_measure_visualize():
    """
    Generate visualization of measurement lines on image
    ---
    tags:
      - Manual Measurement
    consumes:
      - multipart/form-data
    parameters:
      - name: image
        in: formData
        type: file
        required: true
      - name: widthLine1
        in: formData
        type: integer
        required: true
      - name: widthLine2
        in: formData
        type: integer
        required: true
      - name: heightLine1
        in: formData
        type: integer
        required: true
      - name: heightLine2
        in: formData
        type: integer
        required: true
      - name: widthMM
        in: formData
        type: number
        required: true
      - name: heightMM
        in: formData
        type: number
        required: true
    responses:
      200:
        description: Visualization successful
      400:
        description: Bad request
    """
    try:
        if 'image' not in request.files:
            return jsonify({"error": "No image file", "success": False}), 400
        
        # Read image
        image_file = request.files['image']
        image_bytes = image_file.read()
        nparr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if img is None:
            return jsonify({"error": "Failed to decode image", "success": False}), 400
        
        # Get line positions and measurements
        width_line1 = int(request.form.get('widthLine1', 0))
        width_line2 = int(request.form.get('widthLine2', 0))
        height_line1 = int(request.form.get('heightLine1', 0))
        height_line2 = int(request.form.get('heightLine2', 0))
        width_mm = float(request.form.get('widthMM', 0))
        height_mm = float(request.form.get('heightMM', 0))
        
        # Draw measurement lines
        vis_image = draw_measurement_lines(
            img,
            width_line1, width_line2,
            height_line1, height_line2,
            width_mm, height_mm
        )
        
        # Encode to base64
        _, buffer = cv2.imencode('.png', vis_image)
        vis_base64 = base64.b64encode(buffer).decode('utf-8')
        
        return jsonify({
            "success": True,
            "visualizedImage": vis_base64
        })
        
    except Exception as e:
        print(f"ERROR: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e), "success": False}), 500


# --- ORIGINAL MEASUREMENT ENDPOINT (EDGE DETECTION) ---
@app.route('/measure', methods=['POST'])
def measure_wood():
    """
    Measure wood dimensions from an image using edge detection
    ---
    tags:
      - Measurement
    consumes:
      - multipart/form-data
    parameters:
      - name: image
        in: formData
        type: file
        required: true
      - name: mode
        in: formData
        type: string
        default: width
        enum: [width, height, length, area]
      - name: calibrationFactor
        in: formData
        type: number
        default: 0.0145503
      - name: threshold
        in: formData
        type: integer
        default: 240
    responses:
      200:
        description: Measurement successful
      400:
        description: Bad request
    """
    try:
        if 'image' in request.files:
            image_file = request.files['image']
            image_bytes = image_file.read()
            nparr = np.frombuffer(image_bytes, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            
            mode = request.form.get('mode', 'width')
            calibration_factor = float(request.form.get('calibrationFactor', 0.0145503))
            threshold = int(request.form.get('threshold', 240))
            sigma = float(request.form.get('sigma', 2.0))
            contrast_factor = float(request.form.get('contrastFactor', 1.5))
            use_adaptive_threshold = request.form.get('useAdaptiveThreshold', 'false').lower() == 'true'
            
        elif request.is_json:
            data = request.get_json()
            if 'image' not in data:
                return jsonify({"error": "No image data"}), 400
            
            image_data = data['image']
            if ',' in image_data:
                image_data = image_data.split(',')[1]
            
            image_bytes = base64.b64decode(image_data)
            nparr = np.frombuffer(image_bytes, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            
            mode = data.get('mode', 'width')
            calibration_factor = float(data.get('calibrationFactor', 0.0145503))
            threshold = int(data.get('threshold', 240))
            sigma = float(data.get('sigma', 2.0))
            contrast_factor = float(data.get('contrastFactor', 1.5))
            use_adaptive_threshold = data.get('useAdaptiveThreshold', False)
        else:
            return jsonify({"error": "No image provided"}), 400

        if img is None:
            return jsonify({"error": "Failed to decode image"}), 400

        measurement_result = detect_wood_dimensions(
            img, mode=mode, threshold=threshold, sigma=sigma,
            contrast_factor=contrast_factor, use_adaptive_threshold=use_adaptive_threshold
        )
        
        if measurement_result is None:
            return jsonify({"error": "No edges detected", "success": False}), 400
        
        if mode == 'area':
            pixel_measurement = measurement_result['areaPixels']
            mm_measurement = pixel_measurement * (calibration_factor ** 2)
            result = {
                "mode": mode,
                "pixelMeasurement": round(pixel_measurement, 2),
                "millimeterMeasurement": round(mm_measurement, 2),
                "displayUnit": 'mmÂ²',
                "success": True
            }
        else:
            pixel_measurement = measurement_result.get('widthPixels') or measurement_result.get('heightPixels', 0)
            mm_measurement = pixel_measurement * calibration_factor
            result = {
                "mode": mode,
                "pixelMeasurement": round(pixel_measurement, 2),
                "millimeterMeasurement": round(mm_measurement, 2),
                "displayUnit": 'mm',
                "success": True
            }
        
        return jsonify(result)
        
    except Exception as e:
        print(f"ERROR: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e), "success": False}), 500


# --- OCR ENDPOINT ---
@app.route('/scan-number', methods=['POST'])
def scan_number():
    """
    Scan and recognize a number using OCR
    ---
    tags:
      - OCR
    consumes:
      - multipart/form-data
    parameters:
      - name: image
        in: formData
        type: file
        required: true
    responses:
      200:
        description: OCR successful
    """
    if 'image' not in request.files:
        return jsonify({"error": "No image file"}), 400

    try:
        image = Image.open(request.files['image'].stream)
        config = r'--psm 8 -c tessedit_char_whitelist=0123456789'
        text = pytesseract.image_to_string(image, config=config).strip()
        
        if not text:
            return jsonify({"error": "No text recognized"}), 400
         
        return jsonify({"recognized_number": text, "success": True})
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# --- CALIBRATION HELPER ---
@app.route('/calculate-calibration', methods=['POST'])
def calculate_calibration():
    """
    Calculate calibration factor
    ---
    tags:
      - Calibration
    consumes:
      - application/json
    parameters:
      - name: body
        in: body
        schema:
          type: object
          properties:
            method:
              type: string
              enum: [manual, camera]
            referencePixels:
              type: number
            referenceMillimeters:
              type: number
    responses:
      200:
        description: Calibration calculated
    """
    try:
        data = request.get_json()
        method = data.get('method', 'manual')
        
        if method == 'camera':
            distance = float(data.get('cameraDistance', 300))
            focal_length = float(data.get('focalLength', 50))
            sensor_width = float(data.get('sensorWidth', 4.8))
            image_width = int(data.get('imageWidth', 1920))
            
            pixel_size = sensor_width / image_width
            calibration_factor = (pixel_size * distance) / focal_length
        else:
            reference_pixels = float(data.get('referencePixels', 100))
            reference_mm = float(data.get('referenceMillimeters', 10))
            
            if reference_pixels <= 0:
                return jsonify({"error": "Reference pixels must be > 0"}), 400
            
            calibration_factor = reference_mm / reference_pixels
        
        return jsonify({
            "calibrationFactor": calibration_factor,
            "method": method,
            "success": True
        })
    except Exception as e:
        return jsonify({"error": str(e), "success": False}), 500


# --- SEVEN-SEGMENT CALIBRATION ---
@app.route('/seven-segment/calibrate', methods=['POST'])
def calibrate_seven_segment():
    """Save seven-segment calibration with decimal support"""
    try:
        data = request.get_json()
        
        if 'displayBox' not in data:
            return jsonify({"error": "displayBox required", "success": False}), 400
        
        display_box = data['displayBox']
        
        if 'segmentBoxes' not in data or not data['segmentBoxes']:
            num_digits = data.get('numDigits', 3)
            segment_boxes = create_default_segment_boxes(display_box, num_digits)
        else:
            segment_boxes = data['segmentBoxes']
        
        if len(segment_boxes) != 3:
            return jsonify({"error": "Expected 3 digits", "success": False}), 400
        
        has_decimal_point = data.get('hasDecimalPoint', False)
        decimal_position = data.get('decimalPosition', 1)
        
        # Get calibration image size
        calibration_image_size = data.get('calibrationImageSize', {
            'width': int(display_box['x'] + display_box['width']),
            'height': int(display_box['y'] + display_box['height'])
        })
        
        # Store calibration with image size
        calibration_data = {
            'display_box': display_box,
            'segment_boxes': segment_boxes,
            'num_digits': len(segment_boxes),
            'has_decimal_point': has_decimal_point,
            'decimal_position': decimal_position,
            'calibration_image_size': calibration_image_size
        }
        
        seven_segment_ocr.set_calibration(
            display_box, 
            segment_boxes,
            has_decimal_point=has_decimal_point,
            decimal_position=decimal_position
        )
        seven_segment_ocr.calibration['calibration_image_size'] = calibration_image_size
        
        return jsonify({
            "success": True,
            "message": "Calibration saved",
            "calibration": calibration_data
        })
    except Exception as e:
        print(f"ERROR: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e), "success": False}), 500


# --- SEVEN-SEGMENT RECOGNIZE ---
@app.route('/seven-segment/recognize', methods=['POST'])
def recognize_seven_segment():
    """
    Recognize seven-segment display with smart adaptive detection
    ---
    tags:
      - Seven-Segment OCR
    consumes:
      - multipart/form-data
    parameters:
      - name: image
        in: formData
        type: file
        required: true
      - name: debug
        in: formData
        type: boolean
        default: false
      - name: method
        in: formData
        type: string
        default: smart_adaptive
        enum: [smart_adaptive, contrast_based]
    responses:
      200:
        description: Recognition successful
    """
    try:
        if seven_segment_ocr.calibration is None:
            print("âš ï¸ Loading calibration from Laravel...")
            if not load_calibration_from_laravel():
                return jsonify({
                    "error": "No calibration found. Please calibrate first.",
                    "success": False
                }), 400
        
        debug_mode = False
        detection_method = 'smart_adaptive'
        
        if 'image' in request.files:
            image_file = request.files['image']
            image_bytes = image_file.read()
            nparr = np.frombuffer(image_bytes, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            
            debug_mode = request.form.get('debug', 'false').lower() == 'true'
            detection_method = request.form.get('method', 'smart_adaptive')
            
        elif request.is_json:
            data = request.get_json()
            
            if 'image' not in data:
                return jsonify({"error": "No image data", "success": False}), 400
            
            image_data = data['image']
            if ',' in image_data:
                image_data = image_data.split(',')[1]
            
            image_bytes = base64.b64decode(image_data)
            nparr = np.frombuffer(image_bytes, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            
            debug_mode = data.get('debug', False)
            detection_method = data.get('method', 'smart_adaptive')
        else:
            return jsonify({"error": "No image provided", "success": False}), 400

        if img is None:
            return jsonify({"error": "Failed to decode image", "success": False}), 400

        seven_segment_ocr.detection_method = detection_method
        result = seven_segment_ocr.recognize_display(img, debug=debug_mode)
        
        def convert_to_native(obj):
            if isinstance(obj, dict):
                return {key: convert_to_native(value) for key, value in obj.items()}
            elif isinstance(obj, list):
                return [convert_to_native(item) for item in obj]
            elif isinstance(obj, np.bool_):
                return bool(obj)
            elif isinstance(obj, np.integer):
                return int(obj)
            elif isinstance(obj, np.floating):
                return float(obj)
            elif isinstance(obj, np.ndarray):
                return obj.tolist()
            else:
                return obj
        
        result = convert_to_native(result)
        return jsonify(result)
        
    except Exception as e:
        print(f"ERROR: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e), "success": False}), 500




# --- DIAGNOSE SEGMENT BRIGHTNESS ---
@app.route('/seven-segment/diagnose', methods=['POST'])
def diagnose_seven_segment():
    """Diagnose segment brightness values to debug detection issues"""
    try:
        if seven_segment_ocr.calibration is None:
            if not load_calibration_from_laravel():
                return jsonify({"error": "No calibration found", "success": False}), 400
        
        if 'image' in request.files:
            image_file = request.files['image']
            image_bytes = image_file.read()
            nparr = np.frombuffer(image_bytes, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        elif request.is_json:
            data = request.get_json()
            if 'image' not in data:
                return jsonify({"error": "No image data", "success": False}), 400
            image_data = data['image']
            if ',' in image_data:
                image_data = image_data.split(',')[1]
            image_bytes = base64.b64decode(image_data)
            nparr = np.frombuffer(image_bytes, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        else:
            return jsonify({"error": "No image provided", "success": False}), 400

        if img is None:
            return jsonify({"error": "Failed to decode image", "success": False}), 400

        # Extract and preprocess display
        display_region = seven_segment_ocr.extract_display_region(img, seven_segment_ocr.calibration['display_box'])
        gray_image = seven_segment_ocr.preprocess_image(display_region)
        is_inverted = seven_segment_ocr.detect_display_inversion(gray_image)
        
        diagnostics = {
            "display_inverted": is_inverted,
            "display_mean_brightness": float(np.mean(gray_image)),
            "display_min": float(np.min(gray_image)),
            "display_max": float(np.max(gray_image)),
            "total_digits": len(seven_segment_ocr.calibration['segment_boxes']),
            "digits": []
        }
        
        segment_labels = ['A', 'B', 'C', 'D', 'E', 'F', 'G']
        
        for digit_idx, segment_boxes in enumerate(seven_segment_ocr.calibration['segment_boxes']):
            digit_info = {
                "digit_index": digit_idx,
                "segments": []
            }
            
            for seg_idx, box in enumerate(segment_boxes):
                x = int(box['x'] - seven_segment_ocr.calibration['display_box']['x'])
                y = int(box['y'] - seven_segment_ocr.calibration['display_box']['y'])
                w = int(box['width'])
                h = int(box['height'])
                
                x = max(0, min(x, gray_image.shape[1] - 1))
                y = max(0, min(y, gray_image.shape[0] - 1))
                w = max(1, min(w, gray_image.shape[1] - x))
                h = max(1, min(h, gray_image.shape[0] - y))
                
                segment_roi = gray_image[y:y+h, x:x+w]
                mean_val = float(np.mean(segment_roi))
                state = 1 if mean_val > 128 else 0
                
                seg_info = {
                    "name": segment_labels[seg_idx],
                    "mean": mean_val,
                    "state": state,
                    "min": float(np.min(segment_roi)),
                    "max": float(np.max(segment_roi)),
                    "median": float(np.median(segment_roi)),
                    "std": float(np.std(segment_roi))
                }
                
                digit_info["segments"].append(seg_info)
            
            diagnostics["digits"].append(digit_info)
        
        # Generate visualization
        vis_image = seven_segment_ocr.visualize_segments_with_binary(img)
        _, buffer = cv2.imencode('.png', vis_image)
        vis_base64 = base64.b64encode(buffer).decode('utf-8')
        
        return jsonify({
            "success": True,
            "diagnostics": diagnostics,
            "visualization": vis_base64
        })
        
    except Exception as e:
        print(f"ERROR in diagnose: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e), "success": False}), 500



# --- VISUALIZE SEGMENTS WITH BINARY STATES ---
@app.route('/seven-segment/visualize', methods=['POST'])
def visualize_seven_segment():
    """
    Visualize segment boxes with binary states (0/1)
    GREEN box + "1" = Segment ON
    RED box + "0" = Segment OFF
    """
    try:
        # Load calibration if needed
        if seven_segment_ocr.calibration is None:
            if not load_calibration_from_laravel():
                return jsonify({
                    "error": "No calibration found",
                    "success": False
                }), 400
        
        if 'image' in request.files:
            image_file = request.files['image']
            image_bytes = image_file.read()
            nparr = np.frombuffer(image_bytes, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            
        elif request.is_json:
            data = request.get_json()
            
            if 'image' not in data:
                return jsonify({"error": "No image data", "success": False}), 400
            
            image_data = data['image']
            if ',' in image_data:
                image_data = image_data.split(',')[1]
            
            image_bytes = base64.b64decode(image_data)
            nparr = np.frombuffer(image_bytes, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        else:
            return jsonify({"error": "No image provided", "success": False}), 400

        if img is None:
            return jsonify({"error": "Failed to decode image", "success": False}), 400

        # Generate visualization with binary states
        vis_image = seven_segment_ocr.visualize_segments_with_binary(img)
        
        # Encode to base64
        _, buffer = cv2.imencode('.png', vis_image)
        vis_base64 = base64.b64encode(buffer).decode('utf-8')
        
        return jsonify({
            "success": True,
            "visualization": vis_base64,
            "method": "simple_threshold"
        })
        
    except Exception as e:
        print(f"ERROR in visualize: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e), "success": False}), 500
    
# ============================================================================
# AUTO-DETECTION ENDPOINT (GrabCut + Color Segmentation + Contour Detection)
# ============================================================================

@app.route('/auto-measure/detect-and-align', methods=['POST'])
def auto_detect_wood():
    """
    Automatically detect wood specimen and align measurement lines
    Uses GrabCut → Color Segmentation → Contour Detection pipeline
    ---
    tags:
      - Auto Detection
    consumes:
      - multipart/form-data
    parameters:
      - name: image
        in: formData
        type: file
        required: true
      - name: calibrationFactor
        in: formData
        type: number
        required: true
        description: Calibration factor in mm/pixel
      - name: cameraDistance
        in: formData
        type: number
        required: true
        description: Camera distance in mm
      - name: autoInit
        in: formData
        type: boolean
        default: true
        description: Auto-initialize GrabCut rectangle
      - name: grabcutIterations
        in: formData
        type: integer
        default: 5
        description: Number of GrabCut iterations
      - name: returnDebugImages
        in: formData
        type: boolean
        default: false
        description: Return visualization images for debugging
    responses:
      200:
        description: Detection successful with auto-aligned measurement lines
      400:
        description: Bad request or detection failed
    """
    try:
        if 'image' not in request.files:
            return jsonify({"error": "No image file", "success": False}), 400
        
        # Read image
        image_file = request.files['image']
        image_bytes = image_file.read()
        nparr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if img is None:
            return jsonify({"error": "Failed to decode image", "success": False}), 400
        
        # Get parameters
        calibration_factor = float(request.form.get('calibrationFactor', 0.1432))
        camera_distance = float(request.form.get('cameraDistance', 210))
        auto_init = request.form.get('autoInit', 'true').lower() == 'true'
        grabcut_iterations = int(request.form.get('grabcutIterations', 5))
        return_debug = request.form.get('returnDebugImages', 'false').lower() == 'true'
        
        # Initialize detector
        detector = WoodAutoDetector()
        
        # Run detection
        detection_result = detector.detect(
            img,
            auto_init=auto_init,
            grabcut_iterations=grabcut_iterations
        )
        
        if not detection_result['success']:
            return jsonify(detection_result), 400
        
        # Calculate measurements using the detected line positions
        measurements = calculate_measurements_from_lines(
            detection_result['widthLine1'],
            detection_result['widthLine2'],
            detection_result['heightLine1'],
            detection_result['heightLine2'],
            calibration_factor
        )
        
        # Combine detection result with measurements
        response = {
            'success': detection_result['success'],
            'autoAligned': detection_result['autoAligned'],
            'confidence': detection_result['confidence'],
            'widthLine1': detection_result['widthLine1'],
            'widthLine2': detection_result['widthLine2'],
            'heightLine1': detection_result['heightLine1'],
            'heightLine2': detection_result['heightLine2'],
            'centerX': detection_result['centerX'],
            'centerY': detection_result['centerY'],
            'widthPixels': detection_result['widthPixels'],
            'heightPixels': detection_result['heightPixels'],
            'angle': detection_result['angle'],
            'aspectRatio': detection_result['aspectRatio'],
            'isSquare': detection_result['isSquare'],
            'measurements': measurements,
            'cameraDistance': camera_distance,
            'imageWidth': img.shape[1],
            'imageHeight': img.shape[0]
        }
        
        # Add debug visualizations if requested
        if return_debug and 'detectionData' in detection_result:
            viz = visualize_detection(img, detection_result['detectionData'])
            response['debugImages'] = viz
        
        return jsonify(response)
        
    except Exception as e:
        print(f"ERROR in auto-detect: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e), "success": False}), 500

# --- GET CALIBRATION ---
@app.route('/seven-segment/calibration', methods=['GET'])
def get_seven_segment_calibration():
    """
    Get current calibration
    ---
    tags:
      - Seven-Segment OCR
    responses:
      200:
        description: Calibration data
    """
    try:
        if seven_segment_ocr.calibration is not None:
            return jsonify({
                "success": True,
                "calibration": seven_segment_ocr.calibration,
                "source": "flask_memory"
            })
        
        print("ðŸ“„ Trying Laravel...")
        if load_calibration_from_laravel():
            return jsonify({
                "success": True,
                "calibration": seven_segment_ocr.calibration,
                "source": "laravel_database"
            })
        
        return jsonify({
            "success": False,
            "message": "No calibration found",
            "source": "none"
        }), 404
        
    except Exception as e:
        return jsonify({"error": str(e), "success": False}), 500


# --- HEALTH CHECK ---
@app.route('/health', methods=['GET'])
def health_check():
    """
    Server health check
    ---
    tags:
      - Health
    responses:
      200:
        description: Server status
    """
    return jsonify({
        "status": "healthy",
        "opencv_version": cv2.__version__,
        "tesseract_available": pytesseract.pytesseract.tesseract_cmd is not None,
        "seven_segment_calibrated": seven_segment_ocr.calibration is not None,
        "laravel_url": LARAVEL_API_URL
    })



# ============================================================================
# ACTUATOR CALIBRATION ENDPOINTS (Laravel Proxy)
# ============================================================================

@app.route('/actuator-calibration', methods=['GET'])
def get_actuator_calibration():
    """
    Get active actuator calibration from Laravel
    ---
    tags:
      - Actuator Calibration
    responses:
      200:
        description: Active calibration data
      404:
        description: No active calibration found
    """
    try:
        response = requests.get(f'{LARAVEL_API_URL}/api/actuator-calibration/active', timeout=5)
        
        if response.status_code == 404:
            return jsonify({
                'success': False,
                'message': 'No active calibration found'
            }), 404
        
        response.raise_for_status()
        return jsonify(response.json())
        
    except requests.exceptions.RequestException as e:
        print(f"Error fetching calibration from Laravel: {e}")
        return jsonify({
            'success': False,
            'error': 'Failed to connect to Laravel API',
            'details': str(e)
        }), 500


@app.route('/actuator-calibration/set-midpoint', methods=['POST'])
def set_actuator_midpoint():
    """
    Set midpoint for actuator calibration
    ---
    tags:
      - Actuator Calibration
    consumes:
      - application/json
    parameters:
      - name: body
        in: body
        required: true
        schema:
          type: object
          properties:
            midpoint:
              type: number
              description: Midpoint position value
    responses:
      200:
        description: Midpoint set successfully
      400:
        description: Invalid input
    """
    try:
        data = request.get_json()
        
        if not data or 'midpoint' not in data:
            return jsonify({
                'success': False,
                'error': 'Missing midpoint parameter'
            }), 400
        
        midpoint = data['midpoint']
        
        # Validate midpoint is not zero
        if midpoint == 0:
            return jsonify({
                'success': False,
                'error': 'Midpoint cannot be 0'
            }), 400
        
        # Forward to Laravel
        response = requests.post(
            f'{LARAVEL_API_URL}/api/actuator-calibration/set-midpoint',
            json={'midpoint': midpoint},
            timeout=5
        )
        
        response.raise_for_status()
        return jsonify(response.json())
        
    except requests.exceptions.RequestException as e:
        print(f"Error setting midpoint in Laravel: {e}")
        return jsonify({
            'success': False,
            'error': 'Failed to connect to Laravel API',
            'details': str(e)
        }), 500
    except Exception as e:
        print(f"Error in set_actuator_midpoint: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/actuator-calibration/set-limits', methods=['POST'])
def set_actuator_limits():
    """
    Set travel limits (left or right) for actuator calibration
    ---
    tags:
      - Actuator Calibration
    consumes:
      - application/json
    parameters:
      - name: body
        in: body
        required: true
        schema:
          type: object
          properties:
            current_position:
              type: number
              description: Current actuator position
            direction:
              type: string
              enum: [left, right]
              description: Direction of the limit
    responses:
      200:
        description: Limit set successfully
      400:
        description: Invalid input
    """
    try:
        data = request.get_json()
        
        if not data or 'current_position' not in data or 'direction' not in data:
            return jsonify({
                'success': False,
                'error': 'Missing required parameters (current_position, direction)'
            }), 400
        
        current_position = data['current_position']
        direction = data['direction']
        
        # Validate direction
        if direction not in ['left', 'right']:
            return jsonify({
                'success': False,
                'error': 'Direction must be "left" or "right"'
            }), 400
        
        # Validate position is not zero
        if current_position == 0:
            return jsonify({
                'success': False,
                'error': f'{direction.capitalize()} limit position cannot be 0'
            }), 400
        
        # Forward to Laravel
        response = requests.post(
            f'{LARAVEL_API_URL}/api/actuator-calibration/set-limits',
            json={
                'current_position': current_position,
                'direction': direction
            },
            timeout=5
        )
        
        response.raise_for_status()
        return jsonify(response.json())
        
    except requests.exceptions.RequestException as e:
        print(f"Error setting limits in Laravel: {e}")
        return jsonify({
            'success': False,
            'error': 'Failed to connect to Laravel API',
            'details': str(e)
        }), 500
    except Exception as e:
        print(f"Error in set_actuator_limits: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/actuator-calibration/validate-position', methods=['POST'])
def validate_actuator_position():
    """
    Validate if a position is within calibrated limits
    ---
    tags:
      - Actuator Calibration
    consumes:
      - application/json
    parameters:
      - name: body
        in: body
        required: true
        schema:
          type: object
          properties:
            position:
              type: number
              description: Position to validate
    responses:
      200:
        description: Position validation result
      400:
        description: Invalid input
    """
    try:
        data = request.get_json()
        
        if not data or 'position' not in data:
            return jsonify({
                'success': False,
                'error': 'Missing position parameter'
            }), 400
        
        position = data['position']
        
        # Forward to Laravel
        response = requests.post(
            f'{LARAVEL_API_URL}/api/actuator-calibration/validate-position',
            json={'position': position},
            timeout=5
        )
        
        response.raise_for_status()
        return jsonify(response.json())
        
    except requests.exceptions.RequestException as e:
        print(f"Error validating position in Laravel: {e}")
        return jsonify({
            'success': False,
            'error': 'Failed to connect to Laravel API',
            'details': str(e)
        }), 500
    except Exception as e:
        print(f"Error in validate_actuator_position: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/actuator-calibration/reset', methods=['POST'])
def reset_actuator_calibration():
    """
    Reset actuator calibration
    ---
    tags:
      - Actuator Calibration
    responses:
      200:
        description: Calibration reset successfully
    """
    try:
        # Forward to Laravel
        response = requests.post(
            f'{LARAVEL_API_URL}/api/actuator-calibration/reset',
            timeout=5
        )
        
        response.raise_for_status()
        return jsonify(response.json())
        
    except requests.exceptions.RequestException as e:
        print(f"Error resetting calibration in Laravel: {e}")
        return jsonify({
            'success': False,
            'error': 'Failed to connect to Laravel API',
            'details': str(e)
        }), 500
    except Exception as e:
        print(f"Error in reset_actuator_calibration: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500



# --- RUN THE APP ---
if __name__ == '__main__':
    print("=" * 60)
    print("TimberMach Measurement Server")
    print("=" * 60)
    print(f"OpenCV: {cv2.__version__}")
    print(f"Tesseract: {TESSERACT_PATH}")
    print(f"Laravel: {LARAVEL_API_URL}")
    print(f"Server: http://localhost:5000")
    print(f"Swagger: http://localhost:5000/apidocs")
    print("=" * 60)
    print("\nðŸ“‹ Endpoints:")
    print("  POST /auto-measure/detect-and-align (Auto Detection)")
    print("  POST /measure (Edge Detection)")
    print("  POST /manual-measure/calculate (Manual Lines)")
    print("  POST /manual-measure/visualize (Manual Visualization)")
    print("  POST /scan-number")
    print("  POST /calculate-calibration")
    print("  POST /seven-segment/calibrate")
    print("  POST /seven-segment/diagnose")
    print("  POST /seven-segment/visualize")
    print("  POST /seven-segment/recognize")
    print("  GET  /seven-segment/calibration")
    print("  GET  /actuator-calibration")
    print("  POST /actuator-calibration/set-midpoint")
    print("  POST /actuator-calibration/set-limits")
    print("  POST /actuator-calibration/validate-position")
    print("  POST /actuator-calibration/reset")
    print("  GET  /health")
    print("=" * 60)
    
    app.run(debug=True, host='0.0.0.0', port=5000)