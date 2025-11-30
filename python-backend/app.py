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

# Import seven-segment OCR utilities (NEW FIXED VERSION)
from seven_segment_ocr import SevenSegmentOCR, create_default_segment_boxes

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
    print(f"✓ Tesseract path set: {TESSERACT_PATH}")
except Exception as e:
    print(f"✗ Tesseract error: {e}")

# Seven-segment OCR instance (with NEW SMART ADAPTIVE detection)
seven_segment_ocr = SevenSegmentOCR()


def load_calibration_from_laravel():
    """Load active calibration from Laravel database"""
    try:
        print("📄 Loading calibration from Laravel...")
        response = requests.get(f'{LARAVEL_API_URL}/api/calibration', timeout=5)
        
        if not response.ok:
            print(f"❌ Failed to fetch from Laravel: {response.status_code}")
            return False
        
        calibrations = response.json()
        active_calibration = None
        
        for cal in calibrations:
            if cal.get('is_active'):
                active_calibration = cal
                break
        
        if not active_calibration:
            print("❌ No active calibration found")
            return False
        
        seven_segment_ocr.set_calibration(
            display_box=active_calibration['display_box'],
            segment_boxes=active_calibration['segment_boxes'],
            has_decimal_point=active_calibration.get('has_decimal_point', False),
            decimal_position=active_calibration.get('decimal_position', 1)
        )
        
        print(f"✅ Loaded calibration (ID: {active_calibration['id']})")
        return True
        
    except Exception as e:
        print(f"❌ Error loading calibration: {e}")
        return False


def draw_edge_visualization(image, measurement_result, mode):
    """Draw edge detection visualization"""
    vis_image = image.copy()
    if len(vis_image.shape) == 2:
        vis_image = cv2.cvtColor(vis_image, cv2.COLOR_GRAY2BGR)
    
    height, width = vis_image.shape[:2]
    
    if mode in ['width', 'length'] and 'scanLine' in measurement_result:
        scan_y = measurement_result['scanLine']
        cv2.line(vis_image, (0, scan_y), (width, scan_y), (0, 0, 255), 2)
        
        if 'leftEdge' in measurement_result:
            left_x = int(measurement_result['leftEdge'])
            cv2.line(vis_image, (left_x, 0), (left_x, height), (0, 255, 0), 3)
        
        if 'rightEdge' in measurement_result:
            right_x = int(measurement_result['rightEdge'])
            cv2.line(vis_image, (right_x, 0), (right_x, height), (0, 255, 0), 3)
    
    if mode in ['height', 'length'] and 'scanLine' in measurement_result:
        scan_x = measurement_result['scanLine']
        cv2.line(vis_image, (scan_x, 0), (scan_x, height), (0, 0, 255), 2)
        
        if 'topEdge' in measurement_result:
            top_y = int(measurement_result['topEdge'])
            cv2.line(vis_image, (0, top_y), (width, top_y), (0, 255, 0), 3)
        
        if 'bottomEdge' in measurement_result:
            bottom_y = int(measurement_result['bottomEdge'])
            cv2.line(vis_image, (0, bottom_y), (width, bottom_y), (0, 255, 0), 3)
    
    return vis_image


# --- MEASUREMENT ENDPOINT ---
@app.route('/measure', methods=['POST'])
def measure_wood():
    """
    Measure wood dimensions from an image
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
                "displayUnit": 'mm²',
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
        
        # Get decimal configuration
        has_decimal_point = data.get('hasDecimalPoint', False)
        decimal_position = data.get('decimalPosition', 1)
        
        seven_segment_ocr.set_calibration(
            display_box, 
            segment_boxes,
            has_decimal_point=has_decimal_point,
            decimal_position=decimal_position
        )
        
        return jsonify({
            "success": True,
            "message": "Calibration saved",
            "calibration": {
                "displayBox": display_box,
                "segmentBoxes": segment_boxes,
                "numDigits": len(segment_boxes),
                "hasDecimalPoint": has_decimal_point,
                "decimalPosition": decimal_position
            }
        })
    except Exception as e:
        print(f"ERROR: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e), "success": False}), 500


# --- SEVEN-SEGMENT RECOGNIZE (WITH NEW SMART ADAPTIVE DETECTION) ---
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
        # Load calibration if not in memory
        if seven_segment_ocr.calibration is None:
            print("⚠️ Loading calibration from Laravel...")
            if not load_calibration_from_laravel():
                return jsonify({
                    "error": "No calibration found. Please calibrate first.",
                    "success": False
                }), 400
        
        debug_mode = False
        detection_method = 'smart_adaptive'  # NEW DEFAULT
        
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

        # Set detection method
        seven_segment_ocr.detection_method = detection_method
        
        # Perform recognition with NEW SMART ADAPTIVE algorithm
        result = seven_segment_ocr.recognize_display(img, debug=debug_mode)
        
        # Convert NumPy types to Python native
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
        
        print("📄 Trying Laravel...")
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


# --- CREATE DEFAULT BOXES ---
@app.route('/seven-segment/create-defaults', methods=['POST'])
def create_default_segments():
    """
    Create default segment boxes
    ---
    tags:
      - Seven-Segment OCR
    consumes:
      - application/json
    parameters:
      - name: body
        in: body
        schema:
          type: object
          properties:
            displayBox:
              type: object
            numDigits:
              type: integer
              default: 3
    responses:
      200:
        description: Default boxes created
    """
    try:
        data = request.get_json()
        
        if 'displayBox' not in data:
            return jsonify({"error": "displayBox required", "success": False}), 400
        
        display_box = data['displayBox']
        num_digits = data.get('numDigits', 3)
        
        segment_boxes = create_default_segment_boxes(display_box, num_digits)
        
        return jsonify({"success": True, "segmentBoxes": segment_boxes})
    except Exception as e:
        return jsonify({"error": str(e), "success": False}), 500


# --- DIAGNOSE SEGMENT BRIGHTNESS ---
@app.route('/seven-segment/diagnose', methods=['POST'])
def diagnose_seven_segment():
    """
    Diagnose segment brightness values to debug detection issues
    Returns detailed brightness info for each segment
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
    responses:
      200:
        description: Diagnostic information
    """
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
            "digits": []
        }
        
        segment_labels = ['A', 'B', 'C', 'D', 'E', 'F', 'G']
        
        for digit_idx, segment_boxes in enumerate(seven_segment_ocr.calibration['segment_boxes']):
            digit_info = {
                "digit_index": digit_idx,
                "segments": []
            }
            
            for seg_idx, box in enumerate(segment_boxes):
                # Extract segment ROI
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
                
                seg_info = {
                    "label": f"D{digit_idx+1}{segment_labels[seg_idx]}",
                    "mean": mean_val,
                    "min": float(np.min(segment_roi)),
                    "max": float(np.max(segment_roi)),
                    "median": float(np.median(segment_roi)),
                    "std": float(np.std(segment_roi)),
                    "size_pixels": int(segment_roi.size),
                    "should_be_on_simple": bool(mean_val > 128),  # White segments are ON regardless of inversion
                    "threshold_used": 128
                }
                
                digit_info["segments"].append(seg_info)
            
            diagnostics["digits"].append(digit_info)
        
        return jsonify({
            "success": True,
            "diagnostics": diagnostics
        })
        
    except Exception as e:
        print(f"ERROR: {e}")
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
      - name: method
        in: formData
        type: string
        default: simple_threshold
        enum: [simple_threshold, smart_adaptive]
    responses:
      200:
        description: Visualization image with binary states
    """
    try:
        # Load calibration if needed
        if seven_segment_ocr.calibration is None:
            if not load_calibration_from_laravel():
                return jsonify({
                    "error": "No calibration found",
                    "success": False
                }), 400
        
        detection_method = 'simple_threshold'
        
        if 'image' in request.files:
            image_file = request.files['image']
            image_bytes = image_file.read()
            nparr = np.frombuffer(image_bytes, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            
            detection_method = request.form.get('method', 'simple_threshold')
            
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
            
            detection_method = data.get('method', 'simple_threshold')
        else:
            return jsonify({"error": "No image provided", "success": False}), 400

        if img is None:
            return jsonify({"error": "Failed to decode image", "success": False}), 400

        # Set detection method
        seven_segment_ocr.detection_method = detection_method
        
        # Generate visualization with binary states
        vis_image = seven_segment_ocr.visualize_segments_with_binary(img)
        
        # Encode to base64
        _, buffer = cv2.imencode('.png', vis_image)
        vis_base64 = base64.b64encode(buffer).decode('utf-8')
        
        return jsonify({
            "success": True,
            "visualization": vis_base64,
            "method": detection_method
        })
        
    except Exception as e:
        print(f"ERROR: {e}")
        import traceback
        traceback.print_exc()
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
    print("\n📋 Endpoints:")
    print("  POST /measure")
    print("  POST /scan-number")
    print("  POST /calculate-calibration")
    print("  POST /seven-segment/calibrate")
    print("  POST /seven-segment/recognize")
    print("  POST /seven-segment/visualize  [NEW: Shows 0/1 states]")
    print("  GET  /seven-segment/calibration")
    print("  POST /seven-segment/create-defaults")
    print("  GET  /health")
    print("=" * 60)
    print("\n🎯 Detection Methods:")
    print("  - simple_threshold: 0x00-0x33=Dark, 0x33-0xFF=Light")
    print("  - smart_adaptive: Percentile-based (more robust)")
    print("=" * 60)
    
    app.run(debug=True, host='0.0.0.0', port=5000)