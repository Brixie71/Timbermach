import cv2
import numpy as np
from scipy import ndimage

def convert_to_grayscale(image):
    """Convert image to grayscale if it's in color."""
    if len(image.shape) == 3:
        return cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    return image

def enhance_contrast(image, factor=1.5):
    """Enhance image contrast using CLAHE (Contrast Limited Adaptive Histogram Equalization)."""
    gray = convert_to_grayscale(image)
    
    # Apply CLAHE
    clahe = cv2.createCLAHE(clipLimit=factor, tileGridSize=(8, 8))
    enhanced = clahe.apply(gray)
    
    return enhanced

def gaussian_smooth(image, sigma=2.0):
    """Apply Gaussian smoothing to reduce noise."""
    # Calculate kernel size from sigma (should be odd)
    ksize = int(6 * sigma + 1)
    if ksize % 2 == 0:
        ksize += 1
    
    smoothed = cv2.GaussianBlur(image, (ksize, ksize), sigma)
    return smoothed

def adaptive_threshold(image, block_size=21, C=10):
    """Apply adaptive thresholding for better edge detection in varying lighting."""
    thresh = cv2.adaptiveThreshold(
        image,
        255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY_INV,
        block_size,
        C
    )
    return thresh

def process_image_for_edge_detection(image, contrast_factor=1.5, use_adaptive=False):
    """
    Preprocess image for edge detection.
    
    Args:
        image: Input image
        contrast_factor: Contrast enhancement factor
        use_adaptive: Whether to use adaptive thresholding
    
    Returns:
        Processed grayscale image
    """
    # Convert to grayscale
    gray = convert_to_grayscale(image)
    
    # Enhance contrast
    if contrast_factor > 1.0:
        gray = enhance_contrast(gray, factor=contrast_factor)
    
    # Apply adaptive thresholding if requested
    if use_adaptive:
        gray = adaptive_threshold(gray)
    
    return gray

def detect_horizontal_edges(image, scan_line_y, threshold=240, sigma=2.0):
    """
    Detect horizontal edges (left and right) along a scan line.
    
    Args:
        image: Preprocessed grayscale image
        scan_line_y: Y coordinate of the horizontal scan line
        threshold: Intensity threshold for edge detection
        sigma: Smoothing parameter
    
    Returns:
        Dictionary with left_edge, right_edge, and strength
    """
    height, width = image.shape
    
    # Ensure scan line is within bounds
    scan_line_y = max(0, min(scan_line_y, height - 1))
    
    # Extract the scan line
    scan_line = image[scan_line_y, :].astype(np.float32)
    
    # Apply Gaussian smoothing to the scan line
    scan_line_smooth = ndimage.gaussian_filter1d(scan_line, sigma)
    
    # Calculate gradient (derivative)
    gradient = np.gradient(scan_line_smooth)
    
    # Find edges: look for significant transitions
    # Left edge: transition from dark to bright (positive gradient)
    # Right edge: transition from bright to dark (negative gradient)
    
    left_edge = None
    right_edge = None
    max_left_gradient = 0
    max_right_gradient = 0
    
    # Search for left edge (first quarter of image)
    search_start = int(width * 0.1)
    search_end = int(width * 0.4)
    for x in range(search_start, search_end):
        if scan_line_smooth[x] > threshold and gradient[x] > max_left_gradient:
            max_left_gradient = gradient[x]
            left_edge = x
    
    # Search for right edge (last quarter of image)
    search_start = int(width * 0.6)
    search_end = int(width * 0.9)
    for x in range(search_start, search_end):
        if scan_line_smooth[x] > threshold and gradient[x] < max_right_gradient:
            max_right_gradient = gradient[x]
            right_edge = x
    
    # Calculate edge strength
    strength = abs(max_left_gradient) + abs(max_right_gradient)
    
    if left_edge is not None and right_edge is not None and right_edge > left_edge:
        return {
            'left_edge': left_edge,
            'right_edge': right_edge,
            'strength': strength,
            'scan_line': scan_line_y
        }
    
    return None

def detect_vertical_edges(image, scan_line_x, threshold=240, sigma=2.0):
    """
    Detect vertical edges (top and bottom) along a scan line.
    
    Args:
        image: Preprocessed grayscale image
        scan_line_x: X coordinate of the vertical scan line
        threshold: Intensity threshold for edge detection
        sigma: Smoothing parameter
    
    Returns:
        Dictionary with top_edge, bottom_edge, and strength
    """
    height, width = image.shape
    
    # Ensure scan line is within bounds
    scan_line_x = max(0, min(scan_line_x, width - 1))
    
    # Extract the scan line
    scan_line = image[:, scan_line_x].astype(np.float32)
    
    # Apply Gaussian smoothing to the scan line
    scan_line_smooth = ndimage.gaussian_filter1d(scan_line, sigma)
    
    # Calculate gradient (derivative)
    gradient = np.gradient(scan_line_smooth)
    
    # Find edges: look for significant transitions
    top_edge = None
    bottom_edge = None
    max_top_gradient = 0
    max_bottom_gradient = 0
    
    # Search for top edge (first quarter of image)
    search_start = int(height * 0.1)
    search_end = int(height * 0.4)
    for y in range(search_start, search_end):
        if scan_line_smooth[y] > threshold and gradient[y] > max_top_gradient:
            max_top_gradient = gradient[y]
            top_edge = y
    
    # Search for bottom edge (last quarter of image)
    search_start = int(height * 0.6)
    search_end = int(height * 0.9)
    for y in range(search_start, search_end):
        if scan_line_smooth[y] > threshold and gradient[y] < max_bottom_gradient:
            max_bottom_gradient = gradient[y]
            bottom_edge = y
    
    # Calculate edge strength
    strength = abs(max_top_gradient) + abs(max_bottom_gradient)
    
    if top_edge is not None and bottom_edge is not None and bottom_edge > top_edge:
        return {
            'top_edge': top_edge,
            'bottom_edge': bottom_edge,
            'strength': strength,
            'scan_line': scan_line_x
        }
    
    return None

def detect_wood_dimensions(image, mode='width', threshold=240, sigma=2.0, 
                          contrast_factor=1.5, use_adaptive_threshold=False):
    """
    Detect wood dimensions from an image using edge detection.
    
    Args:
        image: Input image (BGR or grayscale)
        mode: Measurement mode ('width', 'height', 'length', or 'area')
        threshold: Edge detection threshold
        sigma: Gaussian smoothing sigma
        contrast_factor: Contrast enhancement factor
        use_adaptive_threshold: Whether to use adaptive thresholding
    
    Returns:
        Dictionary with measurement results or None if detection fails
    """
    # Preprocess the image
    processed = process_image_for_edge_detection(
        image, 
        contrast_factor=contrast_factor,
        use_adaptive=use_adaptive_threshold
    )
    
    # Apply additional smoothing
    processed = gaussian_smooth(processed, sigma=sigma)
    
    height, width = processed.shape
    
    if mode == 'width':
        # Measure width using horizontal scan line at image center
        scan_line_y = height // 2
        result = detect_horizontal_edges(processed, scan_line_y, threshold, sigma)
        
        if result:
            result['widthPixels'] = result['right_edge'] - result['left_edge']
            result['scanLine'] = scan_line_y
            return result
    
    elif mode == 'height':
        # Measure height using vertical scan line at image center
        scan_line_x = width // 2
        result = detect_vertical_edges(processed, scan_line_x, threshold, sigma)
        
        if result:
            result['heightPixels'] = result['bottom_edge'] - result['top_edge']
            result['scanLine'] = scan_line_x
            return result
    
    elif mode == 'length':
        # Length is typically the longer dimension
        # Try both width and height, return the larger
        scan_line_y = height // 2
        h_result = detect_horizontal_edges(processed, scan_line_y, threshold, sigma)
        
        scan_line_x = width // 2
        v_result = detect_vertical_edges(processed, scan_line_x, threshold, sigma)
        
        if h_result and v_result:
            h_pixels = h_result['right_edge'] - h_result['left_edge']
            v_pixels = v_result['bottom_edge'] - v_result['top_edge']
            
            if h_pixels >= v_pixels:
                h_result['widthPixels'] = h_pixels
                h_result['scanLine'] = scan_line_y
                return h_result
            else:
                v_result['heightPixels'] = v_pixels
                v_result['scanLine'] = scan_line_x
                return v_result
        elif h_result:
            h_result['widthPixels'] = h_result['right_edge'] - h_result['left_edge']
            h_result['scanLine'] = scan_line_y
            return h_result
        elif v_result:
            v_result['heightPixels'] = v_result['bottom_edge'] - v_result['top_edge']
            v_result['scanLine'] = scan_line_x
            return v_result
    
    elif mode == 'area':
        # Measure both dimensions
        scan_line_y = height // 2
        h_result = detect_horizontal_edges(processed, scan_line_y, threshold, sigma)
        
        scan_line_x = width // 2
        v_result = detect_vertical_edges(processed, scan_line_x, threshold, sigma)
        
        if h_result and v_result:
            width_pixels = h_result['right_edge'] - h_result['left_edge']
            height_pixels = v_result['bottom_edge'] - v_result['top_edge']
            area_pixels = width_pixels * height_pixels
            
            # Combine results
            return {
                'widthPixels': width_pixels,
                'heightPixels': height_pixels,
                'areaPixels': area_pixels,
                'leftEdge': h_result['left_edge'],
                'rightEdge': h_result['right_edge'],
                'topEdge': v_result['top_edge'],
                'bottomEdge': v_result['bottom_edge'],
                'scanLineH': scan_line_y,
                'scanLineV': scan_line_x,
                'strength': (h_result['strength'] + v_result['strength']) / 2
            }
    
    return None


# --- SEVEN-SEGMENT DISPLAY RECOGNITION (Optional Feature) ---
# This section is for recognizing numbers from seven-segment displays
# It's separate from the wood measurement functionality

SEGMENT_MAP = {
    "11111100": '0',
    "01100000": '1',
    "11011010": '2',
    "11110010": '3',
    "01100110": '4',
    "10110110": '5',
    "10111110": '6',
    "11100000": '7',
    "11111110": '8',
    "11110110": '9',
}

NORMALIZED_SEGMENT_BOXES = {
    'A': (0.1, 0.0, 0.8, 0.1),
    'B': (0.9, 0.1, 0.1, 0.4),
    'C': (0.9, 0.5, 0.1, 0.4),
    'D': (0.1, 0.9, 0.8, 0.1),
    'E': (0.0, 0.5, 0.1, 0.4),
    'F': (0.0, 0.1, 0.1, 0.4),
    'G': (0.1, 0.45, 0.8, 0.1),
    'DP': (1.0, 0.8, 0.1, 0.1)
}

def preprocess_and_recognize_ssd(image_np):
    """
    Performs the full classical CV pipeline for seven-segment display recognition.
    """
    display_roi_img, roi_coords = localize_display_region(image_np)

    if display_roi_img is None:
        return "ERROR: Could not localize display region."

    processed_binary_img = apply_adaptive_preprocessing(display_roi_img)
    digit_images = segment_individual_digits(processed_binary_img)
    
    final_reading = []
    
    for digit_img in digit_images:
        binary_code = map_segments_to_binary(digit_img)
        recognized_digit = SEGMENT_MAP.get(binary_code, '?')
        final_reading.append(recognized_digit)

    final_text = "".join(final_reading)
    return final_text

def localize_display_region(image_np):
    """Placeholder for finding the rectangular meter display using OpenCV contours."""
    image = convert_to_grayscale(image_np)
    return image, None

def apply_adaptive_preprocessing(gray_image):
    """Applies Adaptive Binarization and Morphological Closing."""
    binary = cv2.adaptiveThreshold(
        gray_image,
        255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY_INV,
        21,
        10
    )
    
    kernel = np.ones((3, 3), np.uint8)
    processed_img = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, kernel)
    
    return processed_img

def segment_individual_digits(processed_binary_img):
    """Placeholder for detecting and cropping individual digits."""
    return [processed_binary_img]

def map_segments_to_binary(digit_img):
    """Calculates the 8-bit binary code (7 segments + DP)."""
    H, W = digit_img.shape[:2]
    segment_states = []
    
    for key, (nx, ny, nw, nh) in NORMALIZED_SEGMENT_BOXES.items():
        x = int(nx * W)
        y = int(ny * H)
        w = int(nw * W)
        h = int(nh * H)
        
        segment_roi = digit_img[y:y+h, x:x+w]
        
        if segment_roi.size > 0:
            mean_intensity = np.mean(segment_roi)
            is_on = 1 if mean_intensity > 100 else 0
            segment_states.append(str(is_on))
        else:
            segment_states.append('0')

    return "".join(segment_states)