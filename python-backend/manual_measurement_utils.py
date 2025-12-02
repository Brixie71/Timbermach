"""
manual_measurement_utils.py
Manual line-based measurement utilities for TimberMach
Handles user-defined line positions for width/height measurement
"""

import cv2
import numpy as np
from typing import Dict, Tuple


def calculate_calibration_from_distance(
    camera_distance: float,
    sensor_width: float = 4.8,
    focal_length: float = 4.0,
    image_width: int = 1280
) -> float:
    """
    Calculate calibration factor (mm/pixel) based on camera distance
    
    Args:
        camera_distance: Distance from camera to object in mm
        sensor_width: Camera sensor width in mm (default: 4.8mm for typical smartphone)
        focal_length: Camera focal length in mm (default: 4.0mm for typical smartphone)
        image_width: Image width in pixels (default: 1280)
    
    Returns:
        Calibration factor in mm/pixel
    """
    # Using pinhole camera model
    # pixel_size = (sensor_width * distance) / (focal_length * image_width)
    calibration_factor = (sensor_width * camera_distance) / (focal_length * image_width)
    return calibration_factor


def calculate_measurements_from_lines(
    width_line1: int,
    width_line2: int,
    height_line1: int,
    height_line2: int,
    calibration_factor: float
) -> Dict:
    """
    Calculate measurements from user-defined line positions
    
    Args:
        width_line1: X position of first vertical line (left)
        width_line2: X position of second vertical line (right)
        height_line1: Y position of first horizontal line (top)
        height_line2: Y position of second horizontal line (bottom)
        calibration_factor: Calibration factor in mm/pixel
    
    Returns:
        Dictionary containing all measurements
    """
    # Calculate pixel measurements
    width_pixels = abs(width_line2 - width_line1)
    height_pixels = abs(height_line2 - height_line1)
    area_pixels = width_pixels * height_pixels
    
    # Convert to millimeters
    width_mm = width_pixels * calibration_factor
    height_mm = height_pixels * calibration_factor
    area_mm2 = width_mm * height_mm
    
    # Convert to inches
    width_inches = width_mm / 25.4
    height_inches = height_mm / 25.4
    area_in2 = area_mm2 / 645.16
    
    return {
        'widthPixels': width_pixels,
        'heightPixels': height_pixels,
        'areaPixels': area_pixels,
        'widthMM': width_mm,
        'heightMM': height_mm,
        'areaMM2': area_mm2,
        'widthInches': width_inches,
        'heightInches': height_inches,
        'areaIN2': area_in2,
        'calibrationFactor': calibration_factor
    }


def draw_measurement_lines(
    image: np.ndarray,
    width_line1: int,
    width_line2: int,
    height_line1: int,
    height_line2: int,
    width_mm: float,
    height_mm: float
) -> np.ndarray:
    """
    Draw measurement lines and labels on image
    
    Args:
        image: Input image (BGR)
        width_line1: X position of first vertical line
        width_line2: X position of second vertical line
        height_line1: Y position of first horizontal line
        height_line2: Y position of second horizontal line
        width_mm: Width measurement in mm
        height_mm: Height measurement in mm
    
    Returns:
        Image with drawn lines and labels
    """
    vis_image = image.copy()
    height, width = vis_image.shape[:2]
    
    # Draw vertical lines (RED for width)
    cv2.line(vis_image, (width_line1, 0), (width_line1, height), (0, 0, 255), 3)
    cv2.line(vis_image, (width_line2, 0), (width_line2, height), (0, 0, 255), 3)
    
    # Draw horizontal lines (GREEN for height)
    cv2.line(vis_image, (0, height_line1), (width, height_line1), (0, 255, 0), 3)
    cv2.line(vis_image, (0, height_line2), (width, height_line2), (0, 255, 0), 3)
    
    # Draw width measurement line and label
    width_mid_x = (width_line1 + width_line2) // 2
    width_label_y = 35
    
    # Background for width label
    label_text = f"Width: {width_mm:.2f} mm"
    (text_width, text_height), _ = cv2.getTextSize(label_text, cv2.FONT_HERSHEY_SIMPLEX, 0.7, 2)
    cv2.rectangle(
        vis_image,
        (width_mid_x - text_width // 2 - 10, width_label_y - text_height - 10),
        (width_mid_x + text_width // 2 + 10, width_label_y + 10),
        (0, 0, 0),
        -1
    )
    # Width label text
    cv2.putText(
        vis_image,
        label_text,
        (width_mid_x - text_width // 2, width_label_y),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.7,
        (0, 0, 255),
        2
    )
    
    # Draw horizontal measurement line
    cv2.line(
        vis_image,
        (width_line1, width_label_y + 20),
        (width_line2, width_label_y + 20),
        (0, 0, 255),
        2
    )
    
    # Draw height measurement line and label
    height_mid_y = (height_line1 + height_line2) // 2
    height_label_x = width - 160
    
    # Background for height label
    label_text = f"Height: {height_mm:.2f} mm"
    (text_width, text_height), _ = cv2.getTextSize(label_text, cv2.FONT_HERSHEY_SIMPLEX, 0.7, 2)
    cv2.rectangle(
        vis_image,
        (height_label_x - 10, height_mid_y - text_height // 2 - 10),
        (height_label_x + text_width + 10, height_mid_y + text_height // 2 + 10),
        (0, 0, 0),
        -1
    )
    # Height label text
    cv2.putText(
        vis_image,
        label_text,
        (height_label_x, height_mid_y + text_height // 4),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.7,
        (0, 255, 0),
        2
    )
    
    # Draw vertical measurement line
    cv2.line(
        vis_image,
        (height_label_x - 30, height_line1),
        (height_label_x - 30, height_line2),
        (0, 255, 0),
        2
    )
    
    # Draw handle indicators (circles at line centers)
    cv2.circle(vis_image, (width_line1, height // 2), 10, (0, 0, 255), -1)
    cv2.circle(vis_image, (width_line2, height // 2), 10, (0, 0, 255), -1)
    cv2.circle(vis_image, (width // 2, height_line1), 10, (0, 255, 0), -1)
    cv2.circle(vis_image, (width // 2, height_line2), 10, (0, 255, 0), -1)
    
    return vis_image


def validate_line_positions(
    width_line1: int,
    width_line2: int,
    height_line1: int,
    height_line2: int,
    image_width: int,
    image_height: int,
    calibration_factor: float = None
) -> Tuple[bool, str]:
    """
    Validate that line positions are within image bounds and dimension limits
    
    Args:
        width_line1: X position of first vertical line
        width_line2: X position of second vertical line
        height_line1: Y position of first horizontal line
        height_line2: Y position of second horizontal line
        image_width: Actual image width in pixels
        image_height: Actual image height in pixels
        calibration_factor: Optional calibration factor to check dimension limits (4-inch limit)
    
    Returns:
        Tuple of (is_valid, error_message)
    """
    # Check horizontal lines are within bounds
    if width_line1 < 0 or width_line1 > image_width:
        return False, f"Width line 1 ({width_line1}) out of bounds (0-{image_width})"
    if width_line2 < 0 or width_line2 > image_width:
        return False, f"Width line 2 ({width_line2}) out of bounds (0-{image_width})"
    
    # Check vertical lines are within bounds
    if height_line1 < 0 or height_line1 > image_height:
        return False, f"Height line 1 ({height_line1}) out of bounds (0-{image_height})"
    if height_line2 < 0 or height_line2 > image_height:
        return False, f"Height line 2 ({height_line2}) out of bounds (0-{image_height})"
    
    # Check lines are not at same position
    if width_line1 == width_line2:
        return False, "Width lines cannot be at the same position"
    if height_line1 == height_line2:
        return False, "Height lines cannot be at the same position"
    
    # Check minimum distance between lines (at least 10 pixels)
    if abs(width_line2 - width_line1) < 10:
        return False, "Width lines must be at least 10 pixels apart"
    if abs(height_line2 - height_line1) < 10:
        return False, "Height lines must be at least 10 pixels apart"
    
    # Check 4-inch (101.6mm) limit if calibration factor provided
    if calibration_factor is not None:
        MAX_DIMENSION_MM = 101.6  # 4 inches in millimeters
        
        width_pixels = abs(width_line2 - width_line1)
        height_pixels = abs(height_line2 - height_line1)
        
        width_mm = width_pixels * calibration_factor
        height_mm = height_pixels * calibration_factor
        
        if width_mm > MAX_DIMENSION_MM:
            width_inches = width_mm / 25.4
            return False, f"Width ({width_mm:.2f}mm / {width_inches:.2f}\") exceeds 4-inch limit"
        
        if height_mm > MAX_DIMENSION_MM:
            height_inches = height_mm / 25.4
            return False, f"Height ({height_mm:.2f}mm / {height_inches:.2f}\") exceeds 4-inch limit"
    
    return True, ""