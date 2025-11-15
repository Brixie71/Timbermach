from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import cv2
import numpy as np
import pytesseract
from PIL import Image
from flasgger import Swagger, swag_from
import io
import base64
import json

# Import our edge detection utilities
from edge_detection_utils import (
    detect_wood_dimensions,
    process_image_for_edge_detection,
    detect_horizontal_edges,
    detect_vertical_edges,
    enhance_contrast,
    gaussian_smooth,
    adaptive_threshold,
    convert_to_grayscale
)

app = Flask(__name__)
CORS(app)  # Enable CORS for frontend communication

# Initialize Swagger with proper configuration
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

# --- TESSERACT CONFIGURATION ---
TESSERACT_PATH = "C:/Program Files/Tesseract-OCR/tesseract.exe"

try:
    pytesseract.pytesseract.tesseract_cmd = TESSERACT_PATH
    print(f"INFO: Successfully set Tesseract path to: {TESSERACT_PATH}")
except Exception as e:
    print(f"ERROR: Failed to set Tesseract command path. Error: {e}")


def draw_edge_visualization(image, measurement_result, mode):
    """
    Draw edge detection visualization with scan lines and detected edges.
    
    Args:
        image: Original image
        measurement_result: Dictionary with edge detection results
        mode: Measurement mode
    
    Returns:
        Image with visualization drawn
    """
    vis_image = image.copy()
    if len(vis_image.shape) == 2:
        vis_image = cv2.cvtColor(vis_image, cv2.COLOR_GRAY2BGR)
    
    height, width = vis_image.shape[:2]
    
    if mode in ['width', 'length'] and 'scanLine' in measurement_result:
        # Draw horizontal scan line (red)
        scan_y = measurement_result['scanLine']
        cv2.line(vis_image, (0, scan_y), (width, scan_y), (0, 0, 255), 2)
        
        # Draw detected edges (green)
        if 'leftEdge' in measurement_result:
            left_x = int(measurement_result['leftEdge'])
            cv2.line(vis_image, (left_x, 0), (left_x, height), (0, 255, 0), 3)
        
        if 'rightEdge' in measurement_result:
            right_x = int(measurement_result['rightEdge'])
            cv2.line(vis_image, (right_x, 0), (right_x, height), (0, 255, 0), 3)
        
        # Add text
        if 'widthPixels' in measurement_result:
            text = f"Width: {measurement_result['widthPixels']:.1f}px"
            cv2.rectangle(vis_image, (width - 200, 10), (width - 10, 50), (0, 0, 0), -1)
            cv2.putText(vis_image, text, (width - 190, 35), 
                       cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
    
    if mode in ['height', 'length'] and 'scanLine' in measurement_result:
        # Draw vertical scan line (red)
        scan_x = measurement_result['scanLine']
        cv2.line(vis_image, (scan_x, 0), (scan_x, height), (0, 0, 255), 2)
        
        # Draw detected edges (green)
        if 'topEdge' in measurement_result:
            top_y = int(measurement_result['topEdge'])
            cv2.line(vis_image, (0, top_y), (width, top_y), (0, 255, 0), 3)
        
        if 'bottomEdge' in measurement_result:
            bottom_y = int(measurement_result['bottomEdge'])
            cv2.line(vis_image, (0, bottom_y), (width, bottom_y), (0, 255, 0), 3)
        
        # Add text
        if 'heightPixels' in measurement_result:
            text = f"Height: {measurement_result['heightPixels']:.1f}px"
            cv2.rectangle(vis_image, (width - 200, 10), (width - 10, 50), (0, 0, 0), -1)
            cv2.putText(vis_image, text, (width - 190, 35), 
                       cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
    
    if mode == 'area':
        # Draw both scan lines
        if 'scanLineH' in measurement_result:
            scan_y = measurement_result['scanLineH']
            cv2.line(vis_image, (0, scan_y), (width, scan_y), (0, 0, 255), 2)
        
        if 'scanLineV' in measurement_result:
            scan_x = measurement_result['scanLineV']
            cv2.line(vis_image, (scan_x, 0), (scan_x, height), (0, 0, 255), 2)
        
        # Draw all edges
        if 'leftEdge' in measurement_result:
            left_x = int(measurement_result['leftEdge'])
            cv2.line(vis_image, (left_x, 0), (left_x, height), (0, 255, 0), 3)
        
        if 'rightEdge' in measurement_result:
            right_x = int(measurement_result['rightEdge'])
            cv2.line(vis_image, (right_x, 0), (right_x, height), (0, 255, 0), 3)
        
        if 'topEdge' in measurement_result:
            top_y = int(measurement_result['topEdge'])
            cv2.line(vis_image, (0, top_y), (width, top_y), (0, 255, 0), 3)
        
        if 'bottomEdge' in measurement_result:
            bottom_y = int(measurement_result['bottomEdge'])
            cv2.line(vis_image, (0, bottom_y), (width, bottom_y), (0, 255, 0), 3)
    
    # Add quality score
    if 'strength' in measurement_result:
        quality = int(measurement_result['strength'] / 50)
        text = f"Quality: {quality}/10"
        cv2.putText(vis_image, text, (width - 190, 60), 
                   cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
    
    return vis_image


# --- MEASUREMENT ENDPOINT (Computer Vision) ---
@app.route('/measure', methods=['POST'])
def measure_wood():
    """
    Measure wood dimensions from an image using computer vision
    ---
    tags:
      - Measurement
    consumes:
      - multipart/form-data
      - application/json
    parameters:
      - name: image
        in: formData
        type: file
        required: false
        description: Image file (for multipart/form-data)
      - name: mode
        in: formData
        type: string
        required: false
        default: width
        enum: [width, height, length, area]
        description: Measurement mode
      - name: calibrationFactor
        in: formData
        type: number
        required: false
        default: 0.0145503
        description: Pixels to millimeters conversion factor
      - name: threshold
        in: formData
        type: integer
        required: false
        default: 240
        description: Edge detection threshold
      - name: sigma
        in: formData
        type: number
        required: false
        default: 2.0
        description: Gaussian smoothing sigma
      - name: contrastFactor
        in: formData
        type: number
        required: false
        default: 1.5
        description: Contrast enhancement factor
      - name: useAdaptiveThreshold
        in: formData
        type: boolean
        required: false
        default: false
        description: Use adaptive thresholding
      - name: returnProcessedImages
        in: formData
        type: boolean
        required: false
        default: false
        description: Return processed and visualization images
    responses:
      200:
        description: Measurement successful
        schema:
          type: object
          properties:
            mode:
              type: string
            pixelMeasurement:
              type: number
            millimeterMeasurement:
              type: number
            displayUnit:
              type: string
            edgeQuality:
              type: integer
            success:
              type: boolean
      400:
        description: Bad request or no edges detected
      500:
        description: Internal server error
    """
    try:
        # Check if request contains file or JSON
        if 'image' in request.files:
            # Handle file upload
            image_file = request.files['image']
            image_bytes = image_file.read()
            nparr = np.frombuffer(image_bytes, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            
            # Get parameters from form data
            mode = request.form.get('mode', 'width')
            calibration_factor = float(request.form.get('calibrationFactor', 0.0145503))
            threshold = int(request.form.get('threshold', 240))
            sigma = float(request.form.get('sigma', 2.0))
            contrast_factor = float(request.form.get('contrastFactor', 1.5))
            use_adaptive_threshold = request.form.get('useAdaptiveThreshold', 'false').lower() == 'true'
            return_processed_images = request.form.get('returnProcessedImages', 'false').lower() == 'true'
            
        elif request.is_json:
            # Handle JSON with base64 image
            data = request.get_json()
            
            if 'image' not in data:
                return jsonify({"error": "No image data provided"}), 400
            
            # Decode base64 image
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
            return_processed_images = data.get('returnProcessedImages', False)
        else:
            return jsonify({"error": "No image provided in request"}), 400

        if img is None:
            return jsonify({"error": "Failed to decode image"}), 400

        # Log processing parameters
        print(f"Processing with parameters: mode={mode}, threshold={threshold}, sigma={sigma}, contrast={contrast_factor}, adaptive={use_adaptive_threshold}")

        # Store processed image if requested
        processed_img_base64 = None
        edge_vis_base64 = None
        
        if return_processed_images:
            # Get grayscale processed image
            processed_img = process_image_for_edge_detection(
                img,
                contrast_factor=contrast_factor,
                use_adaptive=use_adaptive_threshold
            )
            
            # Encode to base64
            _, buffer = cv2.imencode('.png', processed_img)
            processed_img_base64 = base64.b64encode(buffer).decode('utf-8')

        # Perform measurement using Python edge detection with custom parameters
        measurement_result = detect_wood_dimensions(
            img, 
            mode=mode,
            threshold=threshold,
            sigma=sigma,
            contrast_factor=contrast_factor,
            use_adaptive_threshold=use_adaptive_threshold
        )
        
        if measurement_result is None:
            return jsonify({
                "error": "No clear edges detected",
                "suggestion": "Try adjusting the threshold, smoothing, or contrast parameters. Ensure clear contrast between wood and background.",
                "success": False
            }), 400
        
        # Create edge visualization if requested
        if return_processed_images:
            # Process image for edge detection
            processed_for_vis = process_image_for_edge_detection(
                img,
                contrast_factor=contrast_factor,
                use_adaptive=use_adaptive_threshold
            )
            
            # Draw edge visualization
            edge_vis = draw_edge_visualization(processed_for_vis, measurement_result, mode)
            
            # Encode to base64
            _, buffer = cv2.imencode('.png', edge_vis)
            edge_vis_base64 = base64.b64encode(buffer).decode('utf-8')
        
        # Calculate measurements in millimeters
        if mode == 'area':
            pixel_measurement = measurement_result['areaPixels']
            mm_measurement = pixel_measurement * (calibration_factor ** 2)
            display_unit = 'mm²'
            
            result = {
                "mode": mode,
                "pixelMeasurement": round(pixel_measurement, 2),
                "millimeterMeasurement": round(mm_measurement, 2),
                "displayUnit": display_unit,
                "edgeQuality": round(measurement_result['strength'] / 50),
                "details": {
                    "widthPixels": round(measurement_result['widthPixels'], 2),
                    "heightPixels": round(measurement_result['heightPixels'], 2),
                    "widthMM": round(measurement_result['widthPixels'] * calibration_factor, 2),
                    "heightMM": round(measurement_result['heightPixels'] * calibration_factor, 2),
                    "scanLineH": measurement_result['scanLineH'],
                    "scanLineV": measurement_result['scanLineV']
                },
                "processingParams": {
                    "threshold": threshold,
                    "sigma": sigma,
                    "contrastFactor": contrast_factor,
                    "useAdaptiveThreshold": use_adaptive_threshold
                },
                "success": True
            }
        else:
            # Linear measurement
            if 'widthPixels' in measurement_result:
                pixel_measurement = measurement_result['widthPixels']
            elif 'heightPixels' in measurement_result:
                pixel_measurement = measurement_result['heightPixels']
            else:
                pixel_measurement = 0
            
            mm_measurement = pixel_measurement * calibration_factor
            display_unit = 'mm'
            
            result = {
                "mode": mode,
                "pixelMeasurement": round(pixel_measurement, 2),
                "millimeterMeasurement": round(mm_measurement, 2),
                "displayUnit": display_unit,
                "edgeQuality": round(measurement_result['strength'] / 50),
                "details": measurement_result,
                "processingParams": {
                    "threshold": threshold,
                    "sigma": sigma,
                    "contrastFactor": contrast_factor,
                    "useAdaptiveThreshold": use_adaptive_threshold
                },
                "success": True
            }
        
        # Add processed images if requested
        if return_processed_images:
            result["processedImageBase64"] = processed_img_base64
            result["edgeVisualizationBase64"] = edge_vis_base64
        
        return jsonify(result)
        
    except Exception as e:
        print(f"ERROR in measure_wood: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            "error": f"Internal processing error: {str(e)}",
            "success": False
        }), 500


# --- OCR ENDPOINT (Number Scanning) ---
@app.route('/scan-number', methods=['POST'])
def scan_number():
    """
    Scan and recognize a number from an image using OCR
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
        description: Image file containing a number
    responses:
      200:
        description: OCR successful
        schema:
          type: object
          properties:
            recognized_number:
              type: string
            success:
              type: boolean
      400:
        description: Bad request or no text recognized
      500:
        description: Internal server error
    """
    if 'image' not in request.files:
        return jsonify({"error": "No image file provided"}), 400

    image_file = request.files['image']

    try:
        image = Image.open(image_file.stream)
    except Exception as e:
        return jsonify({"error": f"Failed to open image with PIL: {e}"}), 400

    try:
        config = r'--psm 8 -c tessedit_char_whitelist=0123456789'
        text = pytesseract.image_to_string(image, config=config).strip()
        
    except pytesseract.TesseractNotFoundError:
        return jsonify({"error": "tesseract not found. Check installation and path."}), 500
    except Exception as e:
        return jsonify({"error": f"OCR processing failed: {e}"}), 500

    if not text:
        return jsonify({"error": "No text/number recognized."}), 400
         
    return jsonify({
        "recognized_number": text,
        "success": True
    })


# --- CALIBRATION HELPER ENDPOINT ---
@app.route('/calculate-calibration', methods=['POST'])
def calculate_calibration():
    """
    Calculate calibration factor for pixel-to-millimeter conversion
    ---
    tags:
      - Calibration
    consumes:
      - application/json
    parameters:
      - name: body
        in: body
        required: true
        schema:
          type: object
          properties:
            method:
              type: string
              enum: [manual, camera]
              default: manual
              description: Calibration method
            referencePixels:
              type: number
              description: Reference measurement in pixels (for manual method)
            referenceMillimeters:
              type: number
              description: Reference measurement in millimeters (for manual method)
            cameraDistance:
              type: number
              description: Distance from camera to object in mm (for camera method)
            focalLength:
              type: number
              description: Camera focal length in mm (for camera method)
            sensorWidth:
              type: number
              description: Camera sensor width in mm (for camera method)
            imageWidth:
              type: integer
              description: Image width in pixels (for camera method)
    responses:
      200:
        description: Calibration calculated successfully
        schema:
          type: object
          properties:
            calibrationFactor:
              type: number
            method:
              type: string
            success:
              type: boolean
      400:
        description: Bad request
      500:
        description: Internal server error
    """
    try:
        data = request.get_json()
        method = data.get('method', 'manual')
        
        if method == 'camera':
            # Camera-based calibration
            distance = float(data.get('cameraDistance', 300))
            focal_length = float(data.get('focalLength', 50))
            sensor_width = float(data.get('sensorWidth', 4.8))
            image_width = int(data.get('imageWidth', 1920))
            
            pixel_size = sensor_width / image_width
            calibration_factor = (pixel_size * distance) / focal_length
            
        else:
            # Manual reference calibration
            reference_pixels = float(data.get('referencePixels', 100))
            reference_mm = float(data.get('referenceMillimeters', 10))
            
            if reference_pixels <= 0:
                return jsonify({"error": "Reference pixels must be greater than 0"}), 400
            
            calibration_factor = reference_mm / reference_pixels
        
        return jsonify({
            "calibrationFactor": calibration_factor,
            "method": method,
            "success": True
        })
        
    except Exception as e:
        return jsonify({
            "error": f"Calibration calculation failed: {str(e)}",
            "success": False
        }), 500


# --- HEALTH CHECK ENDPOINT ---
@app.route('/health', methods=['GET'])
def health_check():
    """
    Check server health and dependency availability
    ---
    tags:
      - Health
    responses:
      200:
        description: Server is healthy
        schema:
          type: object
          properties:
            status:
              type: string
            opencv_version:
              type: string
            tesseract_available:
              type: boolean
    """
    return jsonify({
        "status": "healthy",
        "opencv_version": cv2.__version__,
        "tesseract_available": pytesseract.pytesseract.tesseract_cmd is not None
    })


# --- RUN THE APP ---
if __name__ == '__main__':
    print("=" * 60)
    print("TimberMach Measurement Server")
    print("=" * 60)
    print(f"OpenCV Version: {cv2.__version__}")
    print(f"Tesseract Path: {TESSERACT_PATH}")
    print("Server starting on http://localhost:5000")
    print("API Documentation: http://localhost:5000/apidocs")
    print("=" * 60)
    app.run(debug=True, host='0.0.0.0', port=5000)