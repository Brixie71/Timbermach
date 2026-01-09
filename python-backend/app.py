from flask import Flask, request, jsonify
from flask_cors import CORS
from flasgger import Swagger

import cv2
import numpy as np
import pytesseract
from PIL import Image
import base64
import json
import requests

# Shape-detect wrapper (loads shape-detect.py via importlib)
from shape_detect_api import run_shape_detect

from auto_detection_utils import WoodAutoDetector, visualize_detection

# Seven-segment OCR
from seven_segment_ocr import SevenSegmentOCR, create_default_segment_boxes


app = Flask(__name__)

# Configure CORS
CORS(app, resources={
    r"/*": {
        "origins": [
            "http://localhost:5173", "http://localhost:3000",
            "http://127.0.0.1:5173", "http://127.0.0.1:3000",
            "http://127.0.0.1:8000"
        ],
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"],
        "expose_headers": ["Content-Type"],
        "supports_credentials": True
    }
})

# Laravel API URL
LARAVEL_API_URL = "http://127.0.0.1:8000"

# Swagger
swagger_config = {
    "headers": [],
    "specs": [
        {
            "endpoint": "apispec_1",
            "route": "/apispec_1.json",
            "rule_filter": lambda rule: True,
            "model_filter": lambda tag: True,
        }
    ],
    "static_url_path": "/flasgger_static",
    "swagger_ui": True,
    "specs_route": "/apidocs/",
}

swagger_template = {
    "swagger": "2.0",
    "info": {
        "title": "TimberMach Measurement API",
        "description": "API for wood measurement using computer vision and OCR",
        "version": "1.0.0",
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

# Seven-segment OCR instance
seven_segment_ocr = SevenSegmentOCR()


def load_calibration_from_laravel():
    """Load active seven-segment calibration from Laravel database"""
    try:
        print("📄 Loading calibration from Laravel...")
        response = requests.get(f"{LARAVEL_API_URL}/api/calibration", timeout=5)

        if not response.ok:
            print(f"❌ Failed to fetch from Laravel: {response.status_code}")
            return False

        calibrations = response.json()
        active_calibration = None

        for cal in calibrations:
            if cal.get("is_active"):
                active_calibration = cal
                break

        if not active_calibration:
            print("❌ No active calibration found")
            return False

        seven_segment_ocr.set_calibration(
            display_box=active_calibration["display_box"],
            segment_boxes=active_calibration["segment_boxes"],
            has_decimal_point=active_calibration.get("has_decimal_point", False),
            decimal_position=active_calibration.get("decimal_position", 1),
        )

        print(f"✅ Loaded calibration (ID: {active_calibration['id']})")
        return True

    except Exception as e:
        print(f"❌ Error loading calibration: {e}")
        return False


def _read_image_from_request():
    """
    Reads image either from multipart 'image' file
    or JSON { image: 'data:image/...base64' }.
    Returns: (img_bgr, err_string_or_None)
    """
    if "image" in request.files:
        image_bytes = request.files["image"].read()
        nparr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            return None, "Failed to decode image"
        return img, None

    if request.is_json:
        data = request.get_json(silent=True) or {}
        if "image" not in data:
            return None, "No image data"

        image_data = data["image"]
        if "," in image_data:
            image_data = image_data.split(",")[1]

        try:
            image_bytes = base64.b64decode(image_data)
        except Exception:
            return None, "Invalid base64 image"

        nparr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            return None, "Failed to decode image"
        return img, None

    return None, "No image provided"


def _calc_mm_from_lines(width_line1, width_line2, height_line1, height_line2, calibration_factor):
    """
    Simple mm computation without manual_measurement_utils:
    width_px = abs(x2 - x1)
    height_px = abs(y2 - y1)
    mm = px * calibration_factor
    """
    w_px = float(abs(int(width_line2) - int(width_line1)))
    h_px = float(abs(int(height_line2) - int(height_line1)))
    return {
        "widthPixels": w_px,
        "heightPixels": h_px,
        "widthMillimeters": round(w_px * float(calibration_factor), 2),
        "heightMillimeters": round(h_px * float(calibration_factor), 2),
    }


# ============================================================================
# SHAPE-DETECT MEASUREMENT (NEW)
# ============================================================================
@app.route("/shape-detect/measure", methods=["POST"])
def shape_detect_measure():
    """
    Run shape-detect contour pipeline on a single snapshot
    ---
    tags:
      - Shape Detect
    consumes:
      - multipart/form-data
    parameters:
      - name: image
        in: formData
        type: file
        required: true
      - name: params
        in: formData
        type: string
        required: false
        description: JSON string for parameters (thresholds, blur, etc.)
    responses:
      200:
        description: Shape-detect measurement result
      400:
        description: Bad request
    """
    try:
        if "image" not in request.files:
            return jsonify({"success": False, "error": "No image file"}), 400

        image_bytes = request.files["image"].read()
        nparr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            return jsonify({"success": False, "error": "Failed to decode image"}), 400

        params_raw = request.form.get("params", "")
        params = {}
        if params_raw:
            try:
                params = json.loads(params_raw)
            except Exception:
                return jsonify({"success": False, "error": "Invalid params JSON"}), 400

        result = run_shape_detect(img, params)
        return jsonify(result)

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500


# ============================================================================
# OCR ENDPOINT
# ============================================================================
@app.route("/scan-number", methods=["POST"])
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
    if "image" not in request.files:
        return jsonify({"error": "No image file", "success": False}), 400

    try:
        image = Image.open(request.files["image"].stream)
        config = r"--psm 8 -c tessedit_char_whitelist=0123456789"
        text = pytesseract.image_to_string(image, config=config).strip()

        if not text:
            return jsonify({"error": "No text recognized", "success": False}), 400

        return jsonify({"recognized_number": text, "success": True})

    except Exception as e:
        return jsonify({"error": str(e), "success": False}), 500


# ============================================================================
# CALIBRATION HELPER
# ============================================================================
@app.route("/calculate-calibration", methods=["POST"])
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
    responses:
      200:
        description: Calibration calculated
    """
    try:
        data = request.get_json() or {}
        method = data.get("method", "manual")

        if method == "camera":
            distance = float(data.get("cameraDistance", 300))
            focal_length = float(data.get("focalLength", 50))
            sensor_width = float(data.get("sensorWidth", 4.8))
            image_width = int(data.get("imageWidth", 1920))

            pixel_size = sensor_width / image_width
            calibration_factor = (pixel_size * distance) / focal_length
        else:
            reference_pixels = float(data.get("referencePixels", 100))
            reference_mm = float(data.get("referenceMillimeters", 10))

            if reference_pixels <= 0:
                return jsonify({"error": "Reference pixels must be > 0", "success": False}), 400

            calibration_factor = reference_mm / reference_pixels

        return jsonify({"calibrationFactor": calibration_factor, "method": method, "success": True})
    except Exception as e:
        return jsonify({"error": str(e), "success": False}), 500


# ============================================================================
# SEVEN-SEGMENT CALIBRATION
# ============================================================================
@app.route("/seven-segment/calibrate", methods=["POST"])
def calibrate_seven_segment():
    """Save seven-segment calibration with decimal support"""
    try:
        data = request.get_json() or {}

        if "displayBox" not in data:
            return jsonify({"error": "displayBox required", "success": False}), 400

        display_box = data["displayBox"]

        if "segmentBoxes" not in data or not data["segmentBoxes"]:
            num_digits = data.get("numDigits", 3)
            segment_boxes = create_default_segment_boxes(display_box, num_digits)
        else:
            segment_boxes = data["segmentBoxes"]

        if len(segment_boxes) != 3:
            return jsonify({"error": "Expected 3 digits", "success": False}), 400

        has_decimal_point = data.get("hasDecimalPoint", False)
        decimal_position = data.get("decimalPosition", 1)

        calibration_image_size = data.get("calibrationImageSize", {
            "width": int(display_box["x"] + display_box["width"]),
            "height": int(display_box["y"] + display_box["height"])
        })

        calibration_data = {
            "display_box": display_box,
            "segment_boxes": segment_boxes,
            "num_digits": len(segment_boxes),
            "has_decimal_point": has_decimal_point,
            "decimal_position": decimal_position,
            "calibration_image_size": calibration_image_size
        }

        seven_segment_ocr.set_calibration(
            display_box,
            segment_boxes,
            has_decimal_point=has_decimal_point,
            decimal_position=decimal_position,
        )
        seven_segment_ocr.calibration["calibration_image_size"] = calibration_image_size

        return jsonify({"success": True, "message": "Calibration saved", "calibration": calibration_data})

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e), "success": False}), 500


# ============================================================================
# SEVEN-SEGMENT RECOGNIZE
# ============================================================================
@app.route("/seven-segment/recognize", methods=["POST"])
def recognize_seven_segment():
    """
    Recognize seven-segment display with smart adaptive detection
    ---
    tags:
      - Seven-Segment OCR
    consumes:
      - multipart/form-data
    """
    try:
        if seven_segment_ocr.calibration is None:
            print("⚠️ Loading calibration from Laravel...")
            if not load_calibration_from_laravel():
                return jsonify({"error": "No calibration found. Please calibrate first.", "success": False}), 400

        debug_mode = False
        detection_method = "smart_adaptive"

        img, err = _read_image_from_request()
        if err:
            return jsonify({"error": err, "success": False}), 400

        if "debug" in request.form:
            debug_mode = request.form.get("debug", "false").lower() == "true"
        if "method" in request.form:
            detection_method = request.form.get("method", "smart_adaptive")

        if request.is_json:
            data = request.get_json(silent=True) or {}
            debug_mode = bool(data.get("debug", False))
            detection_method = data.get("method", "smart_adaptive")

        seven_segment_ocr.detection_method = detection_method
        result = seven_segment_ocr.recognize_display(img, debug=debug_mode)

        def convert_to_native(obj):
            if isinstance(obj, dict):
                return {key: convert_to_native(value) for key, value in obj.items()}
            if isinstance(obj, list):
                return [convert_to_native(item) for item in obj]
            if isinstance(obj, np.bool_):
                return bool(obj)
            if isinstance(obj, np.integer):
                return int(obj)
            if isinstance(obj, np.floating):
                return float(obj)
            if isinstance(obj, np.ndarray):
                return obj.tolist()
            return obj

        return jsonify(convert_to_native(result))

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e), "success": False}), 500


# ============================================================================
# SEVEN-SEGMENT DIAGNOSE
# ============================================================================
@app.route("/seven-segment/diagnose", methods=["POST"])
def diagnose_seven_segment():
    """Diagnose segment brightness values to debug detection issues"""
    try:
        if seven_segment_ocr.calibration is None:
            if not load_calibration_from_laravel():
                return jsonify({"error": "No calibration found", "success": False}), 400

        img, err = _read_image_from_request()
        if err:
            return jsonify({"error": err, "success": False}), 400

        display_region = seven_segment_ocr.extract_display_region(img, seven_segment_ocr.calibration["display_box"])
        gray_image = seven_segment_ocr.preprocess_image(display_region)
        is_inverted = seven_segment_ocr.detect_display_inversion(gray_image)

        diagnostics = {
            "display_inverted": is_inverted,
            "display_mean_brightness": float(np.mean(gray_image)),
            "display_min": float(np.min(gray_image)),
            "display_max": float(np.max(gray_image)),
            "total_digits": len(seven_segment_ocr.calibration["segment_boxes"]),
            "digits": [],
        }

        segment_labels = ["A", "B", "C", "D", "E", "F", "G"]

        for digit_idx, segment_boxes in enumerate(seven_segment_ocr.calibration["segment_boxes"]):
            digit_info = {"digit_index": digit_idx, "segments": []}

            for seg_idx, box in enumerate(segment_boxes):
                x = int(box["x"] - seven_segment_ocr.calibration["display_box"]["x"])
                y = int(box["y"] - seven_segment_ocr.calibration["display_box"]["y"])
                w = int(box["width"])
                h = int(box["height"])

                x = max(0, min(x, gray_image.shape[1] - 1))
                y = max(0, min(y, gray_image.shape[0] - 1))
                w = max(1, min(w, gray_image.shape[1] - x))
                h = max(1, min(h, gray_image.shape[0] - y))

                segment_roi = gray_image[y:y + h, x:x + w]
                mean_val = float(np.mean(segment_roi))
                state = 1 if mean_val > 128 else 0

                digit_info["segments"].append({
                    "name": segment_labels[seg_idx],
                    "mean": mean_val,
                    "state": state,
                    "min": float(np.min(segment_roi)),
                    "max": float(np.max(segment_roi)),
                    "median": float(np.median(segment_roi)),
                    "std": float(np.std(segment_roi)),
                })

            diagnostics["digits"].append(digit_info)

        vis_image = seven_segment_ocr.visualize_segments_with_binary(img)
        _, buffer = cv2.imencode(".png", vis_image)
        vis_base64 = base64.b64encode(buffer).decode("utf-8")

        return jsonify({"success": True, "diagnostics": diagnostics, "visualization": vis_base64})

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e), "success": False}), 500


# ============================================================================
# VISUALIZE SEGMENTS WITH BINARY STATES
# ============================================================================
@app.route("/seven-segment/visualize", methods=["POST"])
def visualize_seven_segment():
    """
    Visualize segment boxes with binary states (0/1)
    GREEN box + "1" = Segment ON
    RED box + "0" = Segment OFF
    """
    try:
        if seven_segment_ocr.calibration is None:
            if not load_calibration_from_laravel():
                return jsonify({"error": "No calibration found", "success": False}), 400

        img, err = _read_image_from_request()
        if err:
            return jsonify({"error": err, "success": False}), 400

        vis_image = seven_segment_ocr.visualize_segments_with_binary(img)
        _, buffer = cv2.imencode(".png", vis_image)
        vis_base64 = base64.b64encode(buffer).decode("utf-8")

        return jsonify({"success": True, "visualization": vis_base64, "method": "simple_threshold"})

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e), "success": False}), 500


# ============================================================================
# AUTO-DETECTION ENDPOINT (still kept, but no manual utils needed)
# ============================================================================
@app.route("/auto-measure/detect-and-align", methods=["POST"])
def auto_detect_wood():
    """
    Automatically detect wood specimen and return aligned measurement lines
    Uses GrabCut → Color Segmentation → Contour Detection pipeline
    ---
    tags:
      - Auto Detection
    consumes:
      - multipart/form-data
    """
    try:
        if "image" not in request.files:
            return jsonify({"error": "No image file", "success": False}), 400

        image_bytes = request.files["image"].read()
        nparr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if img is None:
            return jsonify({"error": "Failed to decode image", "success": False}), 400

        calibration_factor = float(request.form.get("calibrationFactor", 0.1432))
        camera_distance = float(request.form.get("cameraDistance", 210))
        auto_init = request.form.get("autoInit", "true").lower() == "true"
        grabcut_iterations = int(request.form.get("grabcutIterations", 5))
        return_debug = request.form.get("returnDebugImages", "false").lower() == "true"

        detector = WoodAutoDetector()
        detection_result = detector.detect(img, auto_init=auto_init, grabcut_iterations=grabcut_iterations)

        if not detection_result.get("success"):
            return jsonify(detection_result), 400

        # Compute mm without manual utils
        mm = _calc_mm_from_lines(
            detection_result["widthLine1"],
            detection_result["widthLine2"],
            detection_result["heightLine1"],
            detection_result["heightLine2"],
            calibration_factor,
        )

        response = {
            "success": True,
            "autoAligned": detection_result.get("autoAligned"),
            "confidence": detection_result.get("confidence"),
            "widthLine1": detection_result["widthLine1"],
            "widthLine2": detection_result["widthLine2"],
            "heightLine1": detection_result["heightLine1"],
            "heightLine2": detection_result["heightLine2"],
            "centerX": detection_result.get("centerX"),
            "centerY": detection_result.get("centerY"),
            "angle": detection_result.get("angle"),
            "aspectRatio": detection_result.get("aspectRatio"),
            "isSquare": detection_result.get("isSquare"),
            "cameraDistance": camera_distance,
            "imageWidth": img.shape[1],
            "imageHeight": img.shape[0],
            "measurements": mm,
        }

        if return_debug and "detectionData" in detection_result:
            response["debugImages"] = visualize_detection(img, detection_result["detectionData"])

        return jsonify(response)

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e), "success": False}), 500


# ============================================================================
# GET CALIBRATION
# ============================================================================
@app.route("/seven-segment/calibration", methods=["GET"])
def get_seven_segment_calibration():
    """
    Get current calibration
    ---
    tags:
      - Seven-Segment OCR
    """
    try:
        if seven_segment_ocr.calibration is not None:
            return jsonify({"success": True, "calibration": seven_segment_ocr.calibration, "source": "flask_memory"})

        print("📄 Trying Laravel...")
        if load_calibration_from_laravel():
            return jsonify({"success": True, "calibration": seven_segment_ocr.calibration, "source": "laravel_database"})

        return jsonify({"success": False, "message": "No calibration found", "source": "none"}), 404

    except Exception as e:
        return jsonify({"error": str(e), "success": False}), 500


# ============================================================================
# HEALTH CHECK
# ============================================================================
@app.route("/health", methods=["GET"])
def health_check():
    """
    Server health check
    ---
    tags:
      - Health
    """
    return jsonify({
        "status": "healthy",
        "opencv_version": cv2.__version__,
        "tesseract_available": pytesseract.pytesseract.tesseract_cmd is not None,
        "seven_segment_calibrated": seven_segment_ocr.calibration is not None,
        "laravel_url": LARAVEL_API_URL,
    })


# ============================================================================
# ACTUATOR CALIBRATION ENDPOINTS (Laravel Proxy)
# ============================================================================
@app.route("/actuator-calibration", methods=["GET"])
def get_actuator_calibration():
    """Get active actuator calibration from Laravel"""
    try:
        response = requests.get(f"{LARAVEL_API_URL}/api/actuator-calibration/active", timeout=5)

        if response.status_code == 404:
            return jsonify({"success": False, "message": "No active calibration found"}), 404

        response.raise_for_status()
        return jsonify(response.json())

    except requests.exceptions.RequestException as e:
        return jsonify({
            "success": False,
            "error": "Failed to connect to Laravel API",
            "details": str(e),
        }), 500


@app.route("/actuator-calibration/set-midpoint", methods=["POST"])
def set_actuator_midpoint():
    """Set midpoint for actuator calibration"""
    try:
        data = request.get_json() or {}
        if "midpoint" not in data:
            return jsonify({"success": False, "error": "Missing midpoint parameter"}), 400

        midpoint = data["midpoint"]
        if midpoint == 0:
            return jsonify({"success": False, "error": "Midpoint cannot be 0"}), 400

        response = requests.post(
            f"{LARAVEL_API_URL}/api/actuator-calibration/set-midpoint",
            json={"midpoint": midpoint},
            timeout=5
        )
        response.raise_for_status()
        return jsonify(response.json())

    except requests.exceptions.RequestException as e:
        return jsonify({"success": False, "error": "Failed to connect to Laravel API", "details": str(e)}), 500
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/actuator-calibration/set-limits", methods=["POST"])
def set_actuator_limits():
    """Set travel limits (left or right) for actuator calibration"""
    try:
        data = request.get_json() or {}
        if "current_position" not in data or "direction" not in data:
            return jsonify({"success": False, "error": "Missing required parameters (current_position, direction)"}), 400

        direction = data["direction"]
        if direction not in ["left", "right"]:
            return jsonify({"success": False, "error": 'Direction must be "left" or "right"'}), 400

        current_position = data["current_position"]
        if current_position == 0:
            return jsonify({"success": False, "error": f"{direction.capitalize()} limit position cannot be 0"}), 400

        response = requests.post(
            f"{LARAVEL_API_URL}/api/actuator-calibration/set-limits",
            json={"current_position": current_position, "direction": direction},
            timeout=5
        )
        response.raise_for_status()
        return jsonify(response.json())

    except requests.exceptions.RequestException as e:
        return jsonify({"success": False, "error": "Failed to connect to Laravel API", "details": str(e)}), 500
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/actuator-calibration/validate-position", methods=["POST"])
def validate_actuator_position():
    """Validate if a position is within calibrated limits"""
    try:
        data = request.get_json() or {}
        if "position" not in data:
            return jsonify({"success": False, "error": "Missing position parameter"}), 400

        response = requests.post(
            f"{LARAVEL_API_URL}/api/actuator-calibration/validate-position",
            json={"position": data["position"]},
            timeout=5
        )
        response.raise_for_status()
        return jsonify(response.json())

    except requests.exceptions.RequestException as e:
        return jsonify({"success": False, "error": "Failed to connect to Laravel API", "details": str(e)}), 500
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/actuator-calibration/reset", methods=["POST"])
def reset_actuator_calibration():
    """Reset actuator calibration"""
    try:
        response = requests.post(f"{LARAVEL_API_URL}/api/actuator-calibration/reset", timeout=5)
        response.raise_for_status()
        return jsonify(response.json())

    except requests.exceptions.RequestException as e:
        return jsonify({"success": False, "error": "Failed to connect to Laravel API", "details": str(e)}), 500
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


# ============================================================================
# RUN
# ============================================================================
if __name__ == "__main__":
    print("=" * 60)
    print("TimberMach Measurement Server")
    print("=" * 60)
    print(f"OpenCV: {cv2.__version__}")
    print(f"Tesseract: {TESSERACT_PATH}")
    print(f"Laravel: {LARAVEL_API_URL}")
    print("Server: http://localhost:5000")
    print("Swagger: http://localhost:5000/apidocs")
    print("=" * 60)
    print("\n📋 Endpoints:")
    print("  POST /shape-detect/measure")
    print("  POST /auto-measure/detect-and-align")
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

    app.run(debug=True, host="0.0.0.0", port=5000)
