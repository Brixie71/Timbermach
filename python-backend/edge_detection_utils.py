"""
Enhanced Edge Detection Utilities for Sub-pixel Wood Measurement in Python
Uses OpenCV, NumPy, and SciPy for high-performance image processing
"""

import cv2
import numpy as np
from scipy import ndimage, signal
from typing import Tuple, Optional, Dict, List


def convert_to_grayscale(image: np.ndarray) -> np.ndarray:
    """
    Convert an image to grayscale using standard luminance conversion.
    
    Args:
        image: Input image (BGR or RGB format)
    
    Returns:
        Grayscale image
    """
    if len(image.shape) == 3:
        return cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    return image


def enhance_contrast(image: np.ndarray, factor: float = 1.5) -> np.ndarray:
    """
    Apply contrast enhancement to improve edge visibility.
    
    Args:
        image: Input grayscale image
        factor: Contrast enhancement factor
    
    Returns:
        Contrast-enhanced image
    """
    avg = np.mean(image)
    enhanced = avg + (image - avg) * factor
    return np.clip(enhanced, 0, 255).astype(np.uint8)


def gaussian_smooth(image: np.ndarray, sigma: float = 2.0) -> np.ndarray:
    """
    Apply Gaussian smoothing to reduce noise.
    
    Args:
        image: Input grayscale image
        sigma: Standard deviation for Gaussian kernel
    
    Returns:
        Smoothed image
    """
    return cv2.GaussianBlur(image, (0, 0), sigma)


def adaptive_threshold(image: np.ndarray, window_size: int = 15, C: int = 5) -> np.ndarray:
    """
    Apply adaptive thresholding for better edge detection.
    
    Args:
        image: Input grayscale image
        window_size: Size of the neighborhood for threshold calculation
        C: Constant subtracted from the mean
    
    Returns:
        Binary thresholded image
    """
    return cv2.adaptiveThreshold(
        image,
        255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY,
        window_size,
        C
    )


def devernay_subpixel(a: float, b: float, c: float) -> float:
    """
    Apply Devernay's quadratic interpolation for sub-pixel accuracy.
    
    Args:
        a: Gradient value at first point
        b: Gradient value at middle point (local maximum)
        c: Gradient value at third point
    
    Returns:
        Sub-pixel offset relative to the middle point
    """
    if b <= a or b <= c:
        return 0.0
    
    denominator = a + c - 2 * b
    if abs(denominator) < 1e-6:
        return 0.0
    
    return 0.5 * (a - c) / denominator


def apply_sobel_operator(image: np.ndarray) -> Tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    """
    Apply Sobel operator to find gradients.
    
    Args:
        image: Input grayscale image
    
    Returns:
        Tuple of (gradient_x, gradient_y, magnitude, direction)
    """
    # Compute gradients using Sobel
    gradient_x = cv2.Sobel(image, cv2.CV_64F, 1, 0, ksize=3)
    gradient_y = cv2.Sobel(image, cv2.CV_64F, 0, 1, ksize=3)
    
    # Compute magnitude and direction
    magnitude = np.sqrt(gradient_x**2 + gradient_y**2)
    direction = np.arctan2(gradient_y, gradient_x)
    
    return gradient_x, gradient_y, magnitude, direction


def non_maximum_suppression(magnitude: np.ndarray, direction: np.ndarray) -> np.ndarray:
    """
    Apply non-maximum suppression to thin edges.
    
    Args:
        magnitude: Gradient magnitude array
        direction: Gradient direction array
    
    Returns:
        Suppressed magnitude array
    """
    height, width = magnitude.shape
    suppressed = np.zeros_like(magnitude)
    
    # Quantize directions to 0, 45, 90, 135 degrees
    angle = direction * 180.0 / np.pi
    angle[angle < 0] += 180
    
    for y in range(1, height - 1):
        for x in range(1, width - 1):
            q = 255
            r = 255
            
            # Horizontal edge (0 degrees)
            if (0 <= angle[y, x] < 22.5) or (157.5 <= angle[y, x] <= 180):
                q = magnitude[y, x + 1]
                r = magnitude[y, x - 1]
            # Diagonal edge (45 degrees)
            elif 22.5 <= angle[y, x] < 67.5:
                q = magnitude[y + 1, x - 1]
                r = magnitude[y - 1, x + 1]
            # Vertical edge (90 degrees)
            elif 67.5 <= angle[y, x] < 112.5:
                q = magnitude[y + 1, x]
                r = magnitude[y - 1, x]
            # Diagonal edge (135 degrees)
            elif 112.5 <= angle[y, x] < 157.5:
                q = magnitude[y - 1, x - 1]
                r = magnitude[y + 1, x + 1]
            
            if magnitude[y, x] >= q and magnitude[y, x] >= r:
                suppressed[y, x] = magnitude[y, x]
    
    return suppressed


def detect_horizontal_edges(image: np.ndarray, threshold: int = 240, sigma: float = 2.0) -> Optional[Dict]:
    """
    Detect horizontal edges (for width measurement) with sub-pixel accuracy.
    
    Args:
        image: Input grayscale image
        threshold: Gradient threshold for edge detection
        sigma: Gaussian smoothing sigma
    
    Returns:
        Dictionary containing edge detection results or None
    """
    height, width = image.shape
    
    # Try multiple scan lines
    scan_lines = [
        int(height * 0.3),
        int(height * 0.4),
        int(height * 0.5),
        int(height * 0.6),
        int(height * 0.7)
    ]
    
    best_result = None
    max_strength = 0
    
    for scan_y in scan_lines:
        # Extract row profile
        profile = image[scan_y, :].astype(float)
        
        # Apply Gaussian smoothing
        smoothed = ndimage.gaussian_filter1d(profile, sigma=sigma)
        
        # Calculate gradient (first derivative)
        gradient = np.gradient(smoothed)
        
        # Calculate dynamic threshold
        avg_gradient = np.mean(np.abs(gradient))
        grad_threshold = max(5, avg_gradient * 2)
        
        # Find edge transitions
        edges = []
        for i in range(1, len(gradient) - 1):
            if (gradient[i] > grad_threshold and gradient[i+1] < -grad_threshold) or \
               (gradient[i] < -grad_threshold and gradient[i+1] > grad_threshold):
                
                # Calculate sub-pixel position using Devernay's method
                if gradient[i] > 0:  # Rising edge
                    a = abs(gradient[i-1])
                    b = abs(gradient[i])
                    c = abs(gradient[i+1])
                else:  # Falling edge
                    a = abs(gradient[i+1])
                    b = abs(gradient[i])
                    c = abs(gradient[i-1])
                
                offset = devernay_subpixel(a, b, c)
                x_pos = i + 1 + offset
                strength = abs(gradient[i])
                
                edges.append({'position': x_pos, 'strength': strength})
        
        if len(edges) >= 2:
            edges.sort(key=lambda e: e['position'])
            
            # Find best pair by analyzing darkness between edges
            best_left = None
            best_right = None
            max_darkness = -np.inf
            
            for i in range(len(edges) - 1):
                left_pos = edges[i]['position']
                right_pos = edges[i+1]['position']
                distance = right_pos - left_pos
                
                # Skip edges that are too close or too far
                if distance < width * 0.05 or distance > width * 0.9:
                    continue
                
                # Calculate average darkness between edges
                left_idx = int(left_pos)
                right_idx = int(right_pos)
                darkness = np.mean(255 - image[scan_y, left_idx:right_idx])
                
                # Combined score
                width_score = min(1, distance / (width * 0.2))
                combined = darkness * width_score * (edges[i]['strength'] + edges[i+1]['strength']) / 2
                
                if combined > max_darkness:
                    max_darkness = combined
                    best_left = left_pos
                    best_right = right_pos
            
            if best_left is not None and best_right is not None:
                edge_strength = max_darkness
                
                if edge_strength > max_strength:
                    max_strength = edge_strength
                    best_result = {
                        'leftEdge': float(best_left),
                        'rightEdge': float(best_right),
                        'widthPixels': float(best_right - best_left),
                        'scanLine': int(scan_y),
                        'strength': float(edge_strength)
                    }
    
    return best_result


def detect_vertical_edges(image: np.ndarray, threshold: int = 240, sigma: float = 2.0) -> Optional[Dict]:
    """
    Detect vertical edges (for height measurement) with sub-pixel accuracy.
    
    Args:
        image: Input grayscale image
        threshold: Gradient threshold for edge detection
        sigma: Gaussian smoothing sigma
    
    Returns:
        Dictionary containing edge detection results or None
    """
    height, width = image.shape
    
    # Try multiple scan lines
    scan_lines = [
        int(width * 0.3),
        int(width * 0.4),
        int(width * 0.5),
        int(width * 0.6),
        int(width * 0.7)
    ]
    
    best_result = None
    max_strength = 0
    
    for scan_x in scan_lines:
        # Extract column profile
        profile = image[:, scan_x].astype(float)
        
        # Apply Gaussian smoothing
        smoothed = ndimage.gaussian_filter1d(profile, sigma=sigma)
        
        # Calculate gradient
        gradient = np.gradient(smoothed)
        
        # Calculate dynamic threshold
        avg_gradient = np.mean(np.abs(gradient))
        grad_threshold = max(5, avg_gradient * 2)
        
        # Find edge transitions
        edges = []
        for i in range(1, len(gradient) - 1):
            if (gradient[i] > grad_threshold and gradient[i+1] < -grad_threshold) or \
               (gradient[i] < -grad_threshold and gradient[i+1] > grad_threshold):
                
                # Calculate sub-pixel position
                if gradient[i] > 0:
                    a = abs(gradient[i-1])
                    b = abs(gradient[i])
                    c = abs(gradient[i+1])
                else:
                    a = abs(gradient[i+1])
                    b = abs(gradient[i])
                    c = abs(gradient[i-1])
                
                offset = devernay_subpixel(a, b, c)
                y_pos = i + 1 + offset
                strength = abs(gradient[i])
                
                edges.append({'position': y_pos, 'strength': strength})
        
        if len(edges) >= 2:
            edges.sort(key=lambda e: e['position'])
            
            # Find best pair
            best_top = None
            best_bottom = None
            max_darkness = -np.inf
            
            for i in range(len(edges) - 1):
                top_pos = edges[i]['position']
                bottom_pos = edges[i+1]['position']
                distance = bottom_pos - top_pos
                
                if distance < height * 0.05 or distance > height * 0.9:
                    continue
                
                # Calculate average darkness
                top_idx = int(top_pos)
                bottom_idx = int(bottom_pos)
                darkness = np.mean(255 - image[top_idx:bottom_idx, scan_x])
                
                # Combined score
                height_score = min(1, distance / (height * 0.2))
                combined = darkness * height_score * (edges[i]['strength'] + edges[i+1]['strength']) / 2
                
                if combined > max_darkness:
                    max_darkness = combined
                    best_top = top_pos
                    best_bottom = bottom_pos
            
            if best_top is not None and best_bottom is not None:
                edge_strength = max_darkness
                
                if edge_strength > max_strength:
                    max_strength = edge_strength
                    best_result = {
                        'topEdge': float(best_top),
                        'bottomEdge': float(best_bottom),
                        'heightPixels': float(best_bottom - best_top),
                        'scanLine': int(scan_x),
                        'strength': float(edge_strength)
                    }
    
    return best_result


def process_image_for_edge_detection(image: np.ndarray, contrast_factor: float = 1.5, 
                                     use_adaptive: bool = False) -> np.ndarray:
    """
    Process image through the complete pipeline for edge detection.
    
    Args:
        image: Input image (can be color or grayscale)
        contrast_factor: Contrast enhancement factor
        use_adaptive: Use adaptive thresholding
    
    Returns:
        Processed grayscale image ready for edge detection
    """
    # Convert to grayscale if needed
    if len(image.shape) == 3:
        gray = convert_to_grayscale(image)
    else:
        gray = image.copy()
    
    # Enhance contrast
    enhanced = enhance_contrast(gray, factor=contrast_factor)
    
    # Apply adaptive thresholding if requested
    if use_adaptive:
        enhanced = adaptive_threshold(enhanced, window_size=25, C=10)
    
    return enhanced


def detect_wood_dimensions(image: np.ndarray, mode: str = 'width', 
                          threshold: int = 240, sigma: float = 2.0,
                          contrast_factor: float = 1.5, 
                          use_adaptive_threshold: bool = False) -> Optional[Dict]:
    """
    Main function to detect wood dimensions from an image.
    
    Args:
        image: Input image
        mode: Measurement mode ('width', 'height', 'length', or 'area')
        threshold: Brightness threshold for edge detection
        sigma: Gaussian smoothing sigma
        contrast_factor: Contrast enhancement factor
        use_adaptive_threshold: Use adaptive thresholding
    
    Returns:
        Dictionary containing measurement results or None
    """
    # Process image
    processed = process_image_for_edge_detection(
        image, 
        contrast_factor=contrast_factor,
        use_adaptive=use_adaptive_threshold
    )
    
    if mode == 'width':
        return detect_horizontal_edges(processed, threshold=threshold, sigma=sigma)
    
    elif mode == 'height':
        return detect_vertical_edges(processed, threshold=threshold, sigma=sigma)
    
    elif mode == 'length':
        # Try both directions and use the larger
        horizontal = detect_horizontal_edges(processed, threshold=threshold, sigma=sigma)
        vertical = detect_vertical_edges(processed, threshold=threshold, sigma=sigma)
        
        if horizontal and vertical:
            h_score = horizontal['widthPixels'] * horizontal['strength']
            v_score = vertical['heightPixels'] * vertical['strength']
            return horizontal if h_score > v_score else vertical
        return horizontal or vertical
    
    elif mode == 'area':
        # Need both width and height
        horizontal = detect_horizontal_edges(processed, threshold=threshold, sigma=sigma)
        vertical = detect_vertical_edges(processed, threshold=threshold, sigma=sigma)
        
        if horizontal and vertical:
            return {
                'widthPixels': horizontal['widthPixels'],
                'heightPixels': vertical['heightPixels'],
                'areaPixels': horizontal['widthPixels'] * vertical['heightPixels'],
                'strength': (horizontal['strength'] + vertical['strength']) / 2,
                'scanLineH': horizontal['scanLine'],
                'scanLineV': vertical['scanLine'],
                'leftEdge': horizontal['leftEdge'],
                'rightEdge': horizontal['rightEdge'],
                'topEdge': vertical['topEdge'],
                'bottomEdge': vertical['bottomEdge']
            }
    
    return None