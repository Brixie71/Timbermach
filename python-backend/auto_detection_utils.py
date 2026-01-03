"""
auto_detection_utils.py
Automated wood detection using GrabCut, Color Segmentation, and Contour Detection
Hybrid pipeline for TimberMach wood specimen measurement
"""

import cv2
import numpy as np
from typing import Dict, Tuple, Optional, List


class WoodAutoDetector:
    """
    Automated wood specimen detection pipeline:
    1. GrabCut for foreground/background separation
    2. Color segmentation for wood material isolation
    3. Contour detection + minAreaRect for precise measurement
    """
    
    def __init__(self):
        # Wood color ranges in HSV - MULTIPLE RANGES for different wood types
        # Range 1: Light tan/beige wood (like in your image)
        self.wood_hsv_range1 = {
            'lower': np.array([15, 10, 40]),    # Light tan
            'upper': np.array([30, 60, 95])
        }
        # Range 2: Yellow-brown wood
        self.wood_hsv_range2 = {
            'lower': np.array([8, 20, 50]),     # Yellow-brown
            'upper': np.array([25, 70, 90])
        }
        # Range 3: Dark brown wood
        self.wood_hsv_range3 = {
            'lower': np.array([5, 15, 30]),     # Dark brown
            'upper': np.array([20, 80, 70])
        }
        
        # Detection confidence thresholds
        self.min_contour_area = 2500  # Further reduced
        self.max_aspect_ratio_deviation = 0.6  # Even more tolerant
        
    def initialize_grabcut_rect(self, image: np.ndarray, auto: bool = True, 
                                manual_rect: Optional[Tuple[int, int, int, int]] = None) -> Tuple[int, int, int, int]:
        """
        Initialize rectangle for GrabCut algorithm.
        
        Args:
            image: Input image
            auto: If True, auto-detect platform area. If False, use manual_rect
            manual_rect: Manual rectangle (x, y, w, h) if auto=False
            
        Returns:
            Rectangle tuple (x, y, width, height)
        """
        height, width = image.shape[:2]
        
        if auto:
            # Auto-detect: Use center 70% of image (more aggressive)
            margin_x = int(width * 0.15)
            margin_y = int(height * 0.15)
            
            rect = (
                margin_x,
                margin_y,
                width - 2 * margin_x,
                height - 2 * margin_y
            )
        else:
            if manual_rect is None:
                raise ValueError("manual_rect must be provided when auto=False")
            rect = manual_rect
            
        return rect
    
    def apply_grabcut(self, image: np.ndarray, rect: Tuple[int, int, int, int], 
                     iterations: int = 5) -> np.ndarray:
        """
        Apply GrabCut algorithm for foreground/background separation.
        
        Args:
            image: Input BGR image
            rect: Initial rectangle (x, y, width, height)
            iterations: Number of GrabCut iterations (default: 5)
            
        Returns:
            Binary mask (255 = foreground/wood, 0 = background)
        """
        # Initialize mask
        mask = np.zeros(image.shape[:2], np.uint8)
        
        # Background and foreground models (required by GrabCut)
        bgd_model = np.zeros((1, 65), np.float64)
        fgd_model = np.zeros((1, 65), np.float64)
        
        # Apply GrabCut
        cv2.grabCut(
            image,
            mask,
            rect,
            bgd_model,
            fgd_model,
            iterations,
            cv2.GC_INIT_WITH_RECT
        )
        
        # Create binary mask: 0 and 2 are background, 1 and 3 are foreground
        # We treat "probably foreground" (3) as foreground
        binary_mask = np.where((mask == 2) | (mask == 0), 0, 255).astype('uint8')
        
        return binary_mask
    
    def apply_color_segmentation(self, image: np.ndarray, grabcut_mask: np.ndarray) -> np.ndarray:
        """
        Apply color segmentation to isolate wood within the GrabCut foreground.
        Uses multiple HSV ranges to detect different wood colors.
        
        Args:
            image: Input BGR image
            grabcut_mask: Binary mask from GrabCut (255 = foreground)
            
        Returns:
            Refined binary mask (255 = wood, 0 = non-wood)
        """
        # Convert to HSV color space
        hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
        
        # Create multiple wood color masks
        wood_mask1 = cv2.inRange(hsv, self.wood_hsv_range1['lower'], self.wood_hsv_range1['upper'])
        wood_mask2 = cv2.inRange(hsv, self.wood_hsv_range2['lower'], self.wood_hsv_range2['upper'])
        wood_mask3 = cv2.inRange(hsv, self.wood_hsv_range3['lower'], self.wood_hsv_range3['upper'])
        
        # Combine all wood masks (OR operation)
        wood_mask = cv2.bitwise_or(wood_mask1, wood_mask2)
        wood_mask = cv2.bitwise_or(wood_mask, wood_mask3)
        
        # Combine with GrabCut mask (logical AND)
        combined_mask = cv2.bitwise_and(wood_mask, grabcut_mask)
        
        # Calculate overlap ratios
        color_area = np.sum(combined_mask > 0)
        grabcut_area = np.sum(grabcut_mask > 0)
        
        print(f"Color segmentation: {color_area}/{grabcut_area} pixels = {(color_area/grabcut_area*100):.1f}% overlap")
        
        # If color segmentation removes too much, fall back to GrabCut only
        if grabcut_area > 0 and (color_area / grabcut_area) < 0.2:
            # Color filter removed >80% of foreground, likely too strict
            print(f"Color filter too strict, using GrabCut mask only")
            combined_mask = grabcut_mask
        
        # Morphological operations to clean up
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9))  # Even larger kernel
        combined_mask = cv2.morphologyEx(combined_mask, cv2.MORPH_CLOSE, kernel, iterations=2)
        combined_mask = cv2.morphologyEx(combined_mask, cv2.MORPH_OPEN, kernel)
        
        return combined_mask
    
    def detect_wood_contour(self, mask: np.ndarray, image_shape: Tuple[int, int]) -> Optional[Dict]:
        """
        Detect wood specimen contour and compute bounding box.
        
        Args:
            mask: Binary mask (255 = wood)
            image_shape: (height, width) of original image
            
        Returns:
            Dictionary with detection results or None if detection fails
        """
        # Find contours
        contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        if not contours:
            print("No contours found in mask")
            return None
        
        # Find largest contour
        largest_contour = max(contours, key=cv2.contourArea)
        area = cv2.contourArea(largest_contour)
        
        print(f"Largest contour area: {area} pixels (threshold: {self.min_contour_area})")
        
        # Validate minimum area
        if area < self.min_contour_area:
            print(f"Contour too small: {area} < {self.min_contour_area}")
            return None
        
        # Get minimum area rectangle (handles rotation)
        rect = cv2.minAreaRect(largest_contour)
        box = cv2.boxPoints(rect)
        box = np.int0(box)
        
        # Extract rectangle parameters
        center, (width, height), angle = rect
        
        # Ensure width > height (swap if needed)
        if height > width:
            width, height = height, width
            angle = angle + 90
        
        # Calculate aspect ratio
        aspect_ratio = width / height if height > 0 else 0
        
        print(f"Detected dimensions: {width:.1f}x{height:.1f}px, aspect ratio: {aspect_ratio:.2f}")
        
        # Validate aspect ratio for square specimens (more lenient)
        is_square = abs(aspect_ratio - 1.0) <= self.max_aspect_ratio_deviation
        
        return {
            'contour': largest_contour,
            'box': box,
            'center': center,
            'width': width,
            'height': height,
            'angle': angle,
            'area': area,
            'aspect_ratio': aspect_ratio,
            'is_square': is_square,
            'perimeter': cv2.arcLength(largest_contour, True)
        }
    
    def calculate_line_positions(self, detection_result: Dict, image_shape: Tuple[int, int]) -> Dict:
        """
        Calculate red/green line positions from detection result.
        
        Args:
            detection_result: Result from detect_wood_contour
            image_shape: (height, width) of original image
            
        Returns:
            Dictionary with line positions
        """
        center_x, center_y = detection_result['center']
        width = detection_result['width']
        height = detection_result['height']
        
        # Calculate line positions (center ± half dimension)
        width_line1 = int(center_x - width / 2)
        width_line2 = int(center_x + width / 2)
        height_line1 = int(center_y - height / 2)
        height_line2 = int(center_y + height / 2)
        
        # Clamp to image boundaries
        img_height, img_width = image_shape
        width_line1 = max(0, min(width_line1, img_width))
        width_line2 = max(0, min(width_line2, img_width))
        height_line1 = max(0, min(height_line1, img_height))
        height_line2 = max(0, min(height_line2, img_height))
        
        return {
            'widthLine1': width_line1,
            'widthLine2': width_line2,
            'heightLine1': height_line1,
            'heightLine2': height_line2
        }
    
    def calculate_confidence_score(self, detection_result: Dict, 
                                   grabcut_mask: np.ndarray, 
                                   color_mask: np.ndarray) -> float:
        """
        Calculate detection confidence score (0.0 to 1.0).
        More lenient scoring for real-world scenarios.
        
        Args:
            detection_result: Result from detect_wood_contour
            grabcut_mask: GrabCut binary mask
            color_mask: Color segmentation mask
            
        Returns:
            Confidence score
        """
        scores = []
        
        # 1. Aspect ratio score - MORE LENIENT
        aspect_ratio = detection_result['aspect_ratio']
        # Perfect square = 1.0, tolerance up to 0.6 deviation
        deviation = abs(aspect_ratio - 1.0)
        if deviation <= 0.2:
            aspect_score = 1.0  # Near perfect square
        elif deviation <= 0.4:
            aspect_score = 0.8  # Good square
        else:
            aspect_score = max(0.5, 1.0 - (deviation / self.max_aspect_ratio_deviation))
        scores.append(aspect_score * 0.25)  # 25% weight (reduced)
        
        # 2. Area consistency score
        grabcut_area = np.sum(grabcut_mask > 0)
        color_area = np.sum(color_mask > 0)
        if grabcut_area > 0:
            area_ratio = color_area / grabcut_area
            # More lenient - accept 30-100% overlap
            if area_ratio >= 0.3:
                area_score = min(area_ratio, 1.0)
            else:
                area_score = area_ratio / 0.3  # Scale from 0-30% to 0-1
            scores.append(area_score * 0.15)  # 15% weight (reduced)
        else:
            scores.append(0.0)
        
        # 3. Contour solidity - BOOSTED
        hull = cv2.convexHull(detection_result['contour'])
        hull_area = cv2.contourArea(hull)
        if hull_area > 0:
            solidity = detection_result['area'] / hull_area
            # Boost score - rectangular objects should have high solidity
            solidity_score = min(solidity * 1.2, 1.0)  # Boost by 20%
            scores.append(solidity_score * 0.35)  # 35% weight (increased)
        else:
            scores.append(0.0)
        
        # 4. Size appropriateness - NEW
        # Check if detected area is reasonable (not too small, not too large)
        image_area = grabcut_mask.shape[0] * grabcut_mask.shape[1]
        detected_area = detection_result['area']
        size_ratio = detected_area / image_area
        
        if 0.05 <= size_ratio <= 0.7:  # Between 5-70% of image
            size_score = 1.0
        elif size_ratio < 0.05:
            size_score = size_ratio / 0.05  # Too small
        else:
            size_score = max(0.3, 1.0 - (size_ratio - 0.7))  # Too large
        scores.append(size_score * 0.25)  # 25% weight
        
        total_score = sum(scores)
        print(f"Confidence breakdown: aspect={aspect_score:.2f}, area={area_score if grabcut_area > 0 else 0:.2f}, solidity={solidity if hull_area > 0 else 0:.2f}, size={size_score:.2f} → {total_score:.3f}")
        
        return total_score
    
    def detect(self, image: np.ndarray, auto_init: bool = True, 
              manual_rect: Optional[Tuple[int, int, int, int]] = None,
              grabcut_iterations: int = 7) -> Dict:  # Increased default iterations
        """
        Full detection pipeline: GrabCut → Color Segmentation → Contour Detection.
        
        Args:
            image: Input BGR image
            auto_init: Auto-detect initial rectangle for GrabCut
            manual_rect: Manual rectangle if auto_init=False
            grabcut_iterations: Number of GrabCut iterations
            
        Returns:
            Dictionary with detection results and confidence score
        """
        try:
            print(f"Starting detection on {image.shape[1]}x{image.shape[0]} image")
            
            # Step 1: Initialize GrabCut rectangle
            rect = self.initialize_grabcut_rect(image, auto=auto_init, manual_rect=manual_rect)
            print(f"GrabCut rect: {rect}")
            
            # Step 2: Apply GrabCut
            grabcut_mask = self.apply_grabcut(image, rect, iterations=grabcut_iterations)
            grabcut_area = np.sum(grabcut_mask > 0)
            print(f"GrabCut foreground area: {grabcut_area} pixels")
            
            # Step 3: Apply color segmentation
            color_mask = self.apply_color_segmentation(image, grabcut_mask)
            color_area = np.sum(color_mask > 0)
            print(f"Color segmentation area: {color_area} pixels")
            
            # Step 4: Detect contour and bounding box
            detection_result = self.detect_wood_contour(color_mask, image.shape[:2])
            
            if detection_result is None:
                return {
                    'success': False,
                    'error': 'No valid wood specimen detected. Ensure wood is centered and well-lit.',
                    'confidence': 0.0
                }
            
            # Step 5: Calculate line positions
            line_positions = self.calculate_line_positions(detection_result, image.shape[:2])
            
            # Step 6: Calculate confidence score
            confidence = self.calculate_confidence_score(detection_result, grabcut_mask, color_mask)
            
            print(f"Detection successful! Confidence: {confidence:.3f}")
            
            # Store masks for visualization
            detection_result['grabcut_mask'] = grabcut_mask
            detection_result['color_mask'] = color_mask
            
            return {
                'success': True,
                'autoAligned': True,
                'confidence': round(confidence, 3),
                'widthLine1': line_positions['widthLine1'],
                'widthLine2': line_positions['widthLine2'],
                'heightLine1': line_positions['heightLine1'],
                'heightLine2': line_positions['heightLine2'],
                'centerX': round(detection_result['center'][0], 2),
                'centerY': round(detection_result['center'][1], 2),
                'widthPixels': round(detection_result['width'], 2),
                'heightPixels': round(detection_result['height'], 2),
                'angle': round(detection_result['angle'], 2),
                'aspectRatio': round(detection_result['aspect_ratio'], 3),
                'isSquare': detection_result['is_square'],
                'detectionData': detection_result  # Store for visualization
            }
            
        except Exception as e:
            print(f"Detection error: {e}")
            import traceback
            traceback.print_exc()
            return {
                'success': False,
                'error': f'Detection error: {str(e)}',
                'confidence': 0.0
            }


def visualize_detection(image: np.ndarray, detection_data: Dict) -> Dict[str, np.ndarray]:
    """
    Generate visualization images for debugging.
    
    Args:
        image: Original BGR image
        detection_data: Detection result dictionary with masks
        
    Returns:
        Dictionary with visualization images (as base64 strings)
    """
    import base64
    
    visualizations = {}
    
    grabcut_mask = detection_data.get('grabcut_mask')
    color_mask = detection_data.get('color_mask')
    
    if grabcut_mask is not None:
        # 1. GrabCut mask visualization
        grabcut_vis = cv2.cvtColor(grabcut_mask, cv2.COLOR_GRAY2BGR)
        grabcut_vis = cv2.addWeighted(image, 0.7, grabcut_vis, 0.3, 0)
        _, buffer = cv2.imencode('.png', grabcut_vis)
        visualizations['grabcut'] = base64.b64encode(buffer).decode('utf-8')
    
    if color_mask is not None:
        # 2. Color segmentation visualization
        color_vis = cv2.cvtColor(color_mask, cv2.COLOR_GRAY2BGR)
        color_vis = cv2.addWeighted(image, 0.7, color_vis, 0.3, 0)
        _, buffer = cv2.imencode('.png', color_vis)
        visualizations['colorSegmentation'] = base64.b64encode(buffer).decode('utf-8')
    
    # 3. Final contour visualization
    contour_vis = image.copy()
    
    if 'contour' in detection_data:
        # Draw contour
        cv2.drawContours(contour_vis, [detection_data['contour']], -1, (0, 255, 0), 3)
        
        # Draw bounding box
        cv2.drawContours(contour_vis, [detection_data['box']], -1, (255, 0, 0), 2)
        
        # Draw center point
        center = tuple(map(int, detection_data['center']))
        cv2.circle(contour_vis, center, 5, (0, 0, 255), -1)
        
        # Draw measurement lines
        height, width = image.shape[:2]
        cx, cy = center
        
        # Red lines (width)
        w = detection_data['width']
        x1 = int(cx - w/2)
        x2 = int(cx + w/2)
        cv2.line(contour_vis, (x1, 0), (x1, height), (0, 0, 255), 2)
        cv2.line(contour_vis, (x2, 0), (x2, height), (0, 0, 255), 2)
        
        # Green lines (height)
        h = detection_data['height']
        y1 = int(cy - h/2)
        y2 = int(cy + h/2)
        cv2.line(contour_vis, (0, y1), (width, y1), (0, 255, 0), 2)
        cv2.line(contour_vis, (0, y2), (width, y2), (0, 255, 0), 2)
    
    _, buffer = cv2.imencode('.png', contour_vis)
    visualizations['finalContour'] = base64.b64encode(buffer).decode('utf-8')
    
    return visualizations