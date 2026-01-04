"""
auto_detection_utils.py - ENHANCED VERSION
Automated wood detection with advanced angle detection
Hybrid pipeline: GrabCut + Color Segmentation + Hough Line Transform + Contour Detection
Optimized for TimberMach wood specimen measurement with rotation handling
"""

import cv2
import numpy as np
from typing import Dict, Tuple, Optional, List
from dataclasses import dataclass


@dataclass
class DetectionConfig:
    """Configuration parameters for wood detection"""
    # GrabCut parameters
    grabcut_iterations: int = 7
    auto_margin: float = 0.15  # 15% margin for auto-init
    
    # Color segmentation ranges (HSV)
    wood_ranges: List[Tuple[np.ndarray, np.ndarray]] = None
    
    # Edge detection (Canny)
    canny_low: int = 50
    canny_high: int = 150
    canny_aperture: int = 3
    
    # Hough Line Transform
    hough_threshold: int = 80
    hough_min_line_length: int = 50
    hough_max_line_gap: int = 10
    
    # Morphological operations
    morph_kernel_size: int = 9
    morph_close_iterations: int = 2
    morph_open_iterations: int = 1
    
    # Contour validation
    min_contour_area: int = 2500
    max_aspect_ratio_deviation: float = 0.6
    
    # Line angle clustering
    angle_tolerance: float = 5.0  # degrees
    min_cluster_size: int = 2
    
    def __post_init__(self):
        if self.wood_ranges is None:
            # Default wood color ranges in HSV
            self.wood_ranges = [
                # Range 1: Light tan/beige wood
                (np.array([15, 10, 40]), np.array([30, 60, 95])),
                # Range 2: Yellow-brown wood
                (np.array([8, 20, 50]), np.array([25, 70, 90])),
                # Range 3: Dark brown wood
                (np.array([5, 15, 30]), np.array([20, 80, 70])),
                # Range 4: Very light wood (whitish)
                (np.array([20, 5, 70]), np.array([35, 40, 100])),
            ]


class WoodAutoDetector:
    """
    Enhanced wood specimen detection with angle detection:
    1. GrabCut for foreground/background separation
    2. Enhanced edge detection (bilateral filter + Canny)
    3. Hough Line Transform for angle detection
    4. Color segmentation for wood material isolation
    5. Contour detection + minAreaRect for precise measurement
    6. Dominant angle calculation from line clusters
    """
    
    def __init__(self, config: Optional[DetectionConfig] = None):
        self.config = config or DetectionConfig()
        
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
            margin_x = int(width * self.config.auto_margin)
            margin_y = int(height * self.config.auto_margin)
            
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
    
    def apply_grabcut(self, image: np.ndarray, rect: Tuple[int, int, int, int]) -> np.ndarray:
        """
        Apply GrabCut algorithm for foreground/background separation.
        
        Args:
            image: Input BGR image
            rect: Initial rectangle (x, y, width, height)
            
        Returns:
            Binary mask (255 = foreground/wood, 0 = background)
        """
        mask = np.zeros(image.shape[:2], np.uint8)
        bgd_model = np.zeros((1, 65), np.float64)
        fgd_model = np.zeros((1, 65), np.float64)
        
        cv2.grabCut(
            image,
            mask,
            rect,
            bgd_model,
            fgd_model,
            self.config.grabcut_iterations,
            cv2.GC_INIT_WITH_RECT
        )
        
        binary_mask = np.where((mask == 2) | (mask == 0), 0, 255).astype('uint8')
        return binary_mask
    
    def enhance_edges(self, image: np.ndarray) -> np.ndarray:
        """
        Enhanced edge detection pipeline:
        1. Convert to grayscale
        2. Apply bilateral filter (preserves edges, removes noise)
        3. Apply Canny edge detection
        
        Args:
            image: Input BGR image
            
        Returns:
            Edge map (binary image)
        """
        # Convert to grayscale
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        
        # Apply bilateral filter - preserves edges while reducing noise
        # Parameters: diameter=9, sigmaColor=75, sigmaSpace=75
        filtered = cv2.bilateralFilter(gray, 9, 75, 75)
        
        # Apply Canny edge detection
        edges = cv2.Canny(
            filtered,
            self.config.canny_low,
            self.config.canny_high,
            apertureSize=self.config.canny_aperture
        )
        
        return edges
    
    def detect_lines_hough(self, edges: np.ndarray) -> List[Tuple[float, float]]:
        """
        Detect lines using Probabilistic Hough Line Transform.
        
        Args:
            edges: Binary edge map
            
        Returns:
            List of (rho, theta) tuples representing detected lines
        """
        # Probabilistic Hough Line Transform
        lines = cv2.HoughLinesP(
            edges,
            rho=1,
            theta=np.pi/180,
            threshold=self.config.hough_threshold,
            minLineLength=self.config.hough_min_line_length,
            maxLineGap=self.config.hough_max_line_gap
        )
        
        if lines is None:
            return []
        
        # Convert line segments to (rho, theta) format
        line_params = []
        for line in lines:
            x1, y1, x2, y2 = line[0]
            
            # Calculate angle in degrees
            angle = np.degrees(np.arctan2(y2 - y1, x2 - x1))
            
            # Calculate length for weighting
            length = np.sqrt((x2 - x1)**2 + (y2 - y1)**2)
            
            # Normalize angle to [0, 180)
            angle = angle % 180
            
            line_params.append((angle, length, (x1, y1, x2, y2)))
        
        return line_params
    
    def cluster_angles(self, line_params: List[Tuple[float, float, tuple]]) -> Dict[str, float]:
        """
        Cluster detected lines by angle to find dominant horizontal and vertical directions.
        
        Args:
            line_params: List of (angle, length, (x1, y1, x2, y2)) tuples
            
        Returns:
            Dictionary with dominant angles: {'horizontal': angle, 'vertical': angle}
        """
        if not line_params:
            return {'horizontal': 0.0, 'vertical': 90.0, 'rotation': 0.0}
        
        angles = np.array([angle for angle, _, _ in line_params])
        lengths = np.array([length for _, length, _ in line_params])
        
        # Separate into horizontal (near 0° or 180°) and vertical (near 90°) clusters
        horizontal_mask = (angles < 45) | (angles > 135)
        vertical_mask = (angles >= 45) & (angles <= 135)
        
        horizontal_angles = angles[horizontal_mask]
        horizontal_lengths = lengths[horizontal_mask]
        
        vertical_angles = angles[vertical_mask]
        vertical_lengths = lengths[vertical_mask]
        
        # Calculate weighted average (longer lines have more weight)
        if len(horizontal_angles) > 0:
            # Normalize angles near 180° to 0°
            h_normalized = horizontal_angles.copy()
            h_normalized[h_normalized > 90] -= 180
            dominant_horizontal = np.average(h_normalized, weights=horizontal_lengths)
        else:
            dominant_horizontal = 0.0
        
        if len(vertical_angles) > 0:
            # Normalize to be relative to horizontal
            v_normalized = vertical_angles - 90
            dominant_vertical = 90 + np.average(v_normalized, weights=vertical_lengths)
        else:
            dominant_vertical = 90.0
        
        # Calculate overall rotation (deviation from perfect horizontal/vertical)
        rotation_angle = dominant_horizontal
        
        print(f"Angle clustering: H={dominant_horizontal:.2f}°, V={dominant_vertical:.2f}°, Rotation={rotation_angle:.2f}°")
        
        return {
            'horizontal': dominant_horizontal,
            'vertical': dominant_vertical,
            'rotation': rotation_angle,
            'num_horizontal_lines': len(horizontal_angles),
            'num_vertical_lines': len(vertical_angles)
        }
    
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
        hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
        
        # Create combined wood mask from all color ranges
        wood_mask = np.zeros(image.shape[:2], dtype=np.uint8)
        for lower, upper in self.config.wood_ranges:
            range_mask = cv2.inRange(hsv, lower, upper)
            wood_mask = cv2.bitwise_or(wood_mask, range_mask)
        
        # Combine with GrabCut mask
        combined_mask = cv2.bitwise_and(wood_mask, grabcut_mask)
        
        # Calculate overlap ratio
        color_area = np.sum(combined_mask > 0)
        grabcut_area = np.sum(grabcut_mask > 0)
        
        if grabcut_area > 0:
            overlap_ratio = color_area / grabcut_area
            print(f"Color segmentation: {color_area}/{grabcut_area} pixels = {overlap_ratio*100:.1f}% overlap")
            
            # If color segmentation is too restrictive, use GrabCut only
            if overlap_ratio < 0.2:
                print("Color filter too strict, using GrabCut mask only")
                combined_mask = grabcut_mask
        
        # Morphological operations to clean up
        kernel = cv2.getStructuringElement(
            cv2.MORPH_ELLIPSE, 
            (self.config.morph_kernel_size, self.config.morph_kernel_size)
        )
        combined_mask = cv2.morphologyEx(
            combined_mask, 
            cv2.MORPH_CLOSE, 
            kernel, 
            iterations=self.config.morph_close_iterations
        )
        combined_mask = cv2.morphologyEx(
            combined_mask, 
            cv2.MORPH_OPEN, 
            kernel,
            iterations=self.config.morph_open_iterations
        )
        
        return combined_mask
    
    def detect_wood_contour(self, mask: np.ndarray, image_shape: Tuple[int, int], 
                           angle_info: Optional[Dict] = None) -> Optional[Dict]:
        """
        Detect wood specimen contour and compute oriented bounding box.
        
        Args:
            mask: Binary mask (255 = wood)
            image_shape: (height, width) of original image
            angle_info: Optional angle information from Hough lines
            
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
        
        print(f"Largest contour area: {area} pixels (threshold: {self.config.min_contour_area})")
        
        if area < self.config.min_contour_area:
            print(f"Contour too small: {area} < {self.config.min_contour_area}")
            return None
        
        # Get minimum area rectangle (handles rotation automatically)
        rect = cv2.minAreaRect(largest_contour)
        box = cv2.boxPoints(rect)
        box = np.int0(box)
        
        # Extract rectangle parameters
        center, (width, height), angle = rect
        
        # Ensure width > height (swap if needed)
        if height > width:
            width, height = height, width
            angle = angle + 90
        
        # Normalize angle to [-45, 45] range
        if angle < -45:
            angle += 90
        elif angle > 45:
            angle -= 90
        
        # If we have Hough line angle information, use it for refinement
        if angle_info and 'rotation' in angle_info:
            hough_angle = angle_info['rotation']
            
            # Average between contour angle and Hough angle (weighted)
            # Give more weight to contour if we have a strong detection
            if angle_info['num_horizontal_lines'] >= 3:
                angle = 0.3 * angle + 0.7 * hough_angle
                print(f"Refined angle: {angle:.2f}° (contour + Hough)")
            else:
                print(f"Using contour angle: {angle:.2f}°")
        
        # Calculate aspect ratio
        aspect_ratio = width / height if height > 0 else 0
        
        print(f"Detected dimensions: {width:.1f}x{height:.1f}px, angle: {angle:.2f}°, aspect ratio: {aspect_ratio:.2f}")
        
        # Validate aspect ratio for square specimens
        is_square = abs(aspect_ratio - 1.0) <= self.config.max_aspect_ratio_deviation
        
        # Calculate corner points considering rotation
        corners = self._calculate_rotated_corners(center, width, height, angle)
        
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
            'perimeter': cv2.arcLength(largest_contour, True),
            'corners': corners,
            'hull': cv2.convexHull(largest_contour)
        }
    
    def _calculate_rotated_corners(self, center: Tuple[float, float], 
                                   width: float, height: float, 
                                   angle: float) -> np.ndarray:
        """
        Calculate corner points of rotated rectangle.
        
        Args:
            center: (cx, cy) center point
            width: Rectangle width
            height: Rectangle height
            angle: Rotation angle in degrees
            
        Returns:
            Array of 4 corner points: [[x1,y1], [x2,y2], [x3,y3], [x4,y4]]
        """
        cx, cy = center
        angle_rad = np.radians(angle)
        cos_a = np.cos(angle_rad)
        sin_a = np.sin(angle_rad)
        
        # Half dimensions
        hw = width / 2
        hh = height / 2
        
        # Corner offsets (before rotation)
        corner_offsets = np.array([
            [-hw, -hh],  # Top-left
            [hw, -hh],   # Top-right
            [hw, hh],    # Bottom-right
            [-hw, hh]    # Bottom-left
        ])
        
        # Rotation matrix
        rotation_matrix = np.array([
            [cos_a, -sin_a],
            [sin_a, cos_a]
        ])
        
        # Rotate and translate
        rotated_corners = corner_offsets @ rotation_matrix.T
        corners = rotated_corners + np.array([cx, cy])
        
        return corners
    
    def calculate_line_positions(self, detection_result: Dict, image_shape: Tuple[int, int]) -> Dict:
        """
        Calculate measurement line positions from detection result.
        For rotated specimens, lines follow the detected edges.
        
        Args:
            detection_result: Result from detect_wood_contour
            image_shape: (height, width) of original image
            
        Returns:
            Dictionary with line positions (for rotated rectangles, returns corner points)
        """
        angle = detection_result['angle']
        
        # If nearly horizontal (< 5 degrees rotation)
        if abs(angle) < 5:
            # Use simple horizontal/vertical lines
            center_x, center_y = detection_result['center']
            width = detection_result['width']
            height = detection_result['height']
            
            width_line1 = int(center_x - width / 2)
            width_line2 = int(center_x + width / 2)
            height_line1 = int(center_y - height / 2)
            height_line2 = int(center_y + height / 2)
            
            img_height, img_width = image_shape
            width_line1 = max(0, min(width_line1, img_width))
            width_line2 = max(0, min(width_line2, img_width))
            height_line1 = max(0, min(height_line1, img_height))
            height_line2 = max(0, min(height_line2, img_height))
            
            return {
                'widthLine1': width_line1,
                'widthLine2': width_line2,
                'heightLine1': height_line1,
                'heightLine2': height_line2,
                'rotated': False
            }
        else:
            # Use corner-based lines for rotated rectangles
            corners = detection_result['corners']
            
            return {
                'corners': corners.tolist(),
                'rotated': True,
                'angle': angle
            }
    
    def calculate_confidence_score(self, detection_result: Dict, 
                                   grabcut_mask: np.ndarray, 
                                   color_mask: np.ndarray,
                                   angle_info: Optional[Dict] = None) -> float:
        """
        Calculate detection confidence score (0.0 to 1.0).
        Enhanced with angle consistency scoring.
        
        Args:
            detection_result: Result from detect_wood_contour
            grabcut_mask: GrabCut binary mask
            color_mask: Color segmentation mask
            angle_info: Optional angle information from Hough lines
            
        Returns:
            Confidence score
        """
        scores = []
        
        # 1. Aspect ratio score (20% weight)
        aspect_ratio = detection_result['aspect_ratio']
        deviation = abs(aspect_ratio - 1.0)
        if deviation <= 0.2:
            aspect_score = 1.0
        elif deviation <= 0.4:
            aspect_score = 0.8
        else:
            aspect_score = max(0.5, 1.0 - (deviation / self.config.max_aspect_ratio_deviation))
        scores.append(aspect_score * 0.20)
        
        # 2. Area consistency score (15% weight)
        grabcut_area = np.sum(grabcut_mask > 0)
        color_area = np.sum(color_mask > 0)
        if grabcut_area > 0:
            area_ratio = color_area / grabcut_area
            area_score = min(max(area_ratio / 0.3, 0), 1.0) if area_ratio < 0.3 else min(area_ratio, 1.0)
            scores.append(area_score * 0.15)
        else:
            scores.append(0.0)
        
        # 3. Contour solidity score (30% weight)
        hull_area = cv2.contourArea(detection_result['hull'])
        if hull_area > 0:
            solidity = detection_result['area'] / hull_area
            solidity_score = min(solidity * 1.2, 1.0)
            scores.append(solidity_score * 0.30)
        else:
            scores.append(0.0)
        
        # 4. Size appropriateness score (20% weight)
        image_area = grabcut_mask.shape[0] * grabcut_mask.shape[1]
        detected_area = detection_result['area']
        size_ratio = detected_area / image_area
        
        if 0.05 <= size_ratio <= 0.7:
            size_score = 1.0
        elif size_ratio < 0.05:
            size_score = size_ratio / 0.05
        else:
            size_score = max(0.3, 1.0 - (size_ratio - 0.7))
        scores.append(size_score * 0.20)
        
        # 5. Angle consistency score (15% weight) - NEW
        if angle_info and 'num_horizontal_lines' in angle_info:
            # More detected lines = higher confidence
            num_lines = angle_info['num_horizontal_lines'] + angle_info['num_vertical_lines']
            if num_lines >= 10:
                angle_score = 1.0
            elif num_lines >= 5:
                angle_score = 0.8
            elif num_lines >= 2:
                angle_score = 0.6
            else:
                angle_score = 0.4
            scores.append(angle_score * 0.15)
        else:
            scores.append(0.10)  # Base score if no angle info
        
        total_score = sum(scores)
        
        breakdown = {
            'aspect': aspect_score,
            'area': area_score if grabcut_area > 0 else 0,
            'solidity': solidity if hull_area > 0 else 0,
            'size': size_score,
            'angle': angle_score if angle_info else 0.67
        }
        
        print(f"Confidence breakdown: {' '.join(f'{k}={v:.2f}' for k, v in breakdown.items())} → {total_score:.3f}")
        
        return total_score
    
    def detect(self, image: np.ndarray, auto_init: bool = True, 
              manual_rect: Optional[Tuple[int, int, int, int]] = None) -> Dict:
        """
        Full enhanced detection pipeline:
        1. GrabCut → foreground separation
        2. Enhanced edge detection → Canny edges
        3. Hough Line Transform → angle detection
        4. Color Segmentation → wood isolation
        5. Contour Detection → precise measurement
        
        Args:
            image: Input BGR image
            auto_init: Auto-detect initial rectangle for GrabCut
            manual_rect: Manual rectangle if auto_init=False
            
        Returns:
            Dictionary with detection results and confidence score
        """
        try:
            print(f"\n{'='*60}")
            print(f"Starting ENHANCED detection on {image.shape[1]}x{image.shape[0]} image")
            print(f"{'='*60}")
            
            # Step 1: Initialize GrabCut rectangle
            rect = self.initialize_grabcut_rect(image, auto=auto_init, manual_rect=manual_rect)
            print(f"✓ GrabCut rect: {rect}")
            
            # Step 2: Apply GrabCut
            grabcut_mask = self.apply_grabcut(image, rect)
            grabcut_area = np.sum(grabcut_mask > 0)
            print(f"✓ GrabCut foreground: {grabcut_area} pixels")
            
            # Step 3: Enhanced edge detection
            edges = self.enhance_edges(image)
            edge_pixels = np.sum(edges > 0)
            print(f"✓ Edge detection: {edge_pixels} edge pixels")
            
            # Step 4: Hough Line Transform for angle detection
            line_params = self.detect_lines_hough(edges)
            print(f"✓ Hough lines: {len(line_params)} lines detected")
            
            angle_info = self.cluster_angles(line_params)
            
            # Step 5: Color segmentation
            color_mask = self.apply_color_segmentation(image, grabcut_mask)
            color_area = np.sum(color_mask > 0)
            print(f"✓ Color segmentation: {color_area} pixels")
            
            # Step 6: Detect contour with angle information
            detection_result = self.detect_wood_contour(color_mask, image.shape[:2], angle_info)
            
            if detection_result is None:
                return {
                    'success': False,
                    'error': 'No valid wood specimen detected. Ensure wood is centered and well-lit.',
                    'confidence': 0.0
                }
            
            # Step 7: Calculate line positions
            line_positions = self.calculate_line_positions(detection_result, image.shape[:2])
            
            # Step 8: Calculate confidence score
            confidence = self.calculate_confidence_score(
                detection_result, 
                grabcut_mask, 
                color_mask,
                angle_info
            )
            
            print(f"✓ Detection successful! Confidence: {confidence:.3f}")
            print(f"{'='*60}\n")
            
            # Store intermediate results for visualization
            detection_result['grabcut_mask'] = grabcut_mask
            detection_result['color_mask'] = color_mask
            detection_result['edges'] = edges
            detection_result['hough_lines'] = line_params
            detection_result['angle_info'] = angle_info
            
            # Build response
            response = {
                'success': True,
                'autoAligned': True,
                'confidence': round(confidence, 3),
                'centerX': round(detection_result['center'][0], 2),
                'centerY': round(detection_result['center'][1], 2),
                'widthPixels': round(detection_result['width'], 2),
                'heightPixels': round(detection_result['height'], 2),
                'angle': round(detection_result['angle'], 2),
                'aspectRatio': round(detection_result['aspect_ratio'], 3),
                'isSquare': detection_result['is_square'],
                'detectionData': detection_result
            }
            
            # Add line positions
            response.update(line_positions)
            
            return response
            
        except Exception as e:
            print(f"❌ Detection error: {e}")
            import traceback
            traceback.print_exc()
            return {
                'success': False,
                'error': f'Detection error: {str(e)}',
                'confidence': 0.0
            }


def visualize_detection(image: np.ndarray, detection_data: Dict) -> Dict[str, np.ndarray]:
    """
    Generate comprehensive visualization images for debugging.
    
    Args:
        image: Original BGR image
        detection_data: Detection result dictionary with masks
        
    Returns:
        Dictionary with visualization images (as base64 strings)
    """
    import base64
    
    visualizations = {}
    
    # 1. GrabCut mask visualization
    if 'grabcut_mask' in detection_data:
        grabcut_vis = cv2.cvtColor(detection_data['grabcut_mask'], cv2.COLOR_GRAY2BGR)
        grabcut_vis = cv2.addWeighted(image, 0.7, grabcut_vis, 0.3, 0)
        _, buffer = cv2.imencode('.png', grabcut_vis)
        visualizations['grabcut'] = base64.b64encode(buffer).decode('utf-8')
    
    # 2. Edge detection visualization
    if 'edges' in detection_data:
        edges_vis = cv2.cvtColor(detection_data['edges'], cv2.COLOR_GRAY2BGR)
        _, buffer = cv2.imencode('.png', edges_vis)
        visualizations['edges'] = base64.b64encode(buffer).decode('utf-8')
    
    # 3. Hough lines visualization
    if 'hough_lines' in detection_data:
        hough_vis = image.copy()
        for angle, length, (x1, y1, x2, y2) in detection_data['hough_lines']:
            # Color code by angle: red for horizontal, green for vertical
            if angle < 45 or angle > 135:
                color = (0, 0, 255)  # Red for horizontal
            else:
                color = (0, 255, 0)  # Green for vertical
            cv2.line(hough_vis, (x1, y1), (x2, y2), color, 2)
        _, buffer = cv2.imencode('.png', hough_vis)
        visualizations['houghLines'] = base64.b64encode(buffer).decode('utf-8')
    
    # 4. Color segmentation visualization
    if 'color_mask' in detection_data:
        color_vis = cv2.cvtColor(detection_data['color_mask'], cv2.COLOR_GRAY2BGR)
        color_vis = cv2.addWeighted(image, 0.7, color_vis, 0.3, 0)
        _, buffer = cv2.imencode('.png', color_vis)
        visualizations['colorSegmentation'] = base64.b64encode(buffer).decode('utf-8')
    
    # 5. Final contour with measurements
    if 'contour' in detection_data:
        contour_vis = image.copy()
        
        # Draw contour
        cv2.drawContours(contour_vis, [detection_data['contour']], -1, (0, 255, 0), 3)
        
        # Draw oriented bounding box
        cv2.drawContours(contour_vis, [detection_data['box']], -1, (255, 0, 0), 2)
        
        # Draw center point
        center = tuple(map(int, detection_data['center']))
        cv2.circle(contour_vis, center, 5, (0, 0, 255), -1)
        
        # Draw corner points
        if 'corners' in detection_data:
            corners = detection_data['corners'].astype(int)
            for i, corner in enumerate(corners):
                cv2.circle(contour_vis, tuple(corner), 8, (255, 255, 0), -1)
                cv2.putText(contour_vis, f'P{i+1}', tuple(corner + 10), 
                           cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 0), 2)
            
            # Draw edge lines
            for i in range(4):
                p1 = tuple(corners[i])
                p2 = tuple(corners[(i + 1) % 4])
                color = (0, 0, 255) if i % 2 == 0 else (0, 255, 0)  # Red/Green alternating
                cv2.line(contour_vis, p1, p2, color, 2)
        
        # Add angle annotation
        angle = detection_data.get('angle', 0)
        cv2.putText(contour_vis, f'Angle: {angle:.2f}deg', (10, 30),
                   cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 255), 2)
        
        _, buffer = cv2.imencode('.png', contour_vis)
        visualizations['finalContour'] = base64.b64encode(buffer).decode('utf-8')
    
    return visualizations


def test_detection(image_path: str, output_dir: str = './debug_output'):
    """
    Test detection on a single image and save debug visualizations.
    
    Args:
        image_path: Path to input image
        output_dir: Directory to save debug images
    """
    import os
    
    # Create output directory
    os.makedirs(output_dir, exist_ok=True)
    
    # Load image
    image = cv2.imread(image_path)
    if image is None:
        print(f"Error: Could not load image from {image_path}")
        return
    
    print(f"Testing detection on: {image_path}")
    print(f"Image size: {image.shape[1]}x{image.shape[0]}")
    
    # Run detection
    detector = WoodAutoDetector()
    result = detector.detect(image)
    
    # Print results
    print(f"\nDetection Result:")
    print(f"  Success: {result['success']}")
    if result['success']:
        print(f"  Confidence: {result['confidence']:.3f}")
        print(f"  Angle: {result['angle']:.2f}°")
        print(f"  Dimensions: {result['widthPixels']:.1f}x{result['heightPixels']:.1f} pixels")
        print(f"  Aspect Ratio: {result['aspectRatio']:.3f}")
        print(f"  Is Square: {result['isSquare']}")
        
        # Generate visualizations
        vis_images = visualize_detection(image, result['detectionData'])
        
        # Save visualizations
        for name, base64_str in vis_images.items():
            img_data = base64.b64decode(base64_str)
            output_path = os.path.join(output_dir, f'{name}.png')
            with open(output_path, 'wb') as f:
                f.write(img_data)
            print(f"  Saved: {output_path}")
    else:
        print(f"  Error: {result.get('error', 'Unknown error')}")


if __name__ == '__main__':
    # Example usage
    import sys
    
    if len(sys.argv) > 1:
        test_detection(sys.argv[1])
    else:
        print("Usage: python auto_detection_utils_enhanced.py <image_path>")
        print("Example: python auto_detection_utils_enhanced.py test1.jpeg")