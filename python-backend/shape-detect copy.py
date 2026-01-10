import cv2
import numpy as np


class ContourDetectionPipeline:
    """Enhanced contour detection pipeline with improved features and organization."""
    
    def __init__(self, camera_index=1, window_name="Contour Detection Pipeline"):
        self.camera_index = camera_index
        self.window_name = window_name
        self.params_window = "Parameters"
        
        # Default parameter values
        self.default_params = {
            "threshold1": 52,
            "threshold2": 104,
            "min_area": 2000,
            "blur_kernel": 21,     # must be odd
            "dilation": 1,
            "erosion": 1,
            "roi_size": 60,        # %
            "brightness": 100,       # -100..100
            "contrast": 45,       # 0..200
            "mm_per_pixel": 0.1,   # calibration
            "edge_thickness": 1,
        }
        
        # ROI will be calculated based on frame dimensions
        self.roi_rect = None
        self.show_crosshair = True  # Toggle for center alignment crosshair
        self.use_bilateral_filter = True  # Toggle for bilateral filter (better noise reduction)
        
        # Snapshot mode - capture and process a single frame
        self.snapshot_mode = False
        self.snapshot_frame = None
        
        # Measurement system
        self.show_measurements = True  # Toggle for displaying measurements
        self.mm_per_pixel = 0.1  # Calibration: millimeters per pixel (will be from trackbar)
        
        # FPS limiting
        self.target_fps = 15  # Target FPS (can be adjusted)
        self.frame_delay = 1.0 / self.target_fps  # Delay between frames
        self.fps_mode = 'manual'  # 'manual' or 'auto'
        self.processing_time_threshold = 50  # ms - if processing exceeds this, reduce FPS
        
        # Statistics
        self.frame_count = 0
        self.fps = 0
        
    def setup_trackbars(self):
        """Initialize the parameter control window with trackbars."""
        cv2.namedWindow(self.params_window)
        cv2.resizeWindow(self.params_window, 640, 580)
        # Edge thickness (controls dilation kernel for edges)
        cv2.createTrackbar(
            "Edge Thickness",
            self.params_window,
            self.default_params['edge_thickness'],
            7,  # max thickness
            self._empty_callback
        )
        
        # Calibration parameter (mm per pixel x 1000 for precision)
        cv2.createTrackbar("Calibration x1000", self.params_window, 
                          100, 1000, self._empty_callback)  # 100 = 0.1 mm/px
        
        # Image adjustment parameters
        cv2.createTrackbar("Brightness", self.params_window, 
                          100, 200, self._empty_callback)  # 0-200, 100=neutral
        cv2.createTrackbar("Contrast", self.params_window, 
                          self.default_params['contrast'], 200, self._empty_callback)
        
        # Edge detection parameters
        cv2.createTrackbar("Threshold1", self.params_window, 
                          self.default_params['threshold1'], 255, self._empty_callback)
        cv2.createTrackbar("Threshold2", self.params_window, 
                          self.default_params['threshold2'], 255, self._empty_callback)
        
        # Filtering parameters
        cv2.createTrackbar("Min Area", self.params_window, 
                          self.default_params['min_area'], 10000, self._empty_callback)
        cv2.createTrackbar("Blur Kernel", self.params_window, 
                          self.default_params['blur_kernel'], 51, self._empty_callback)
        
        # Morphological operations
        cv2.createTrackbar("Dilation", self.params_window, 
                          self.default_params['dilation'], 10, self._empty_callback)
        cv2.createTrackbar("Erosion", self.params_window, 
                          self.default_params['erosion'], 10, self._empty_callback)
        
        # Region of Interest (ROI) size control
        cv2.createTrackbar("ROI Size %", self.params_window, 
                          self.default_params['roi_size'], 100, self._empty_callback)
        
        # FPS limiter (5-60 FPS)
        cv2.createTrackbar("Target FPS", self.params_window, 
                          self.target_fps, 60, self._empty_callback)
        
        # Processing time threshold (10-200 ms)
        cv2.createTrackbar("Proc Time Limit", self.params_window, 
                          self.processing_time_threshold, 200, self._empty_callback)
    
    @staticmethod
    def _empty_callback(a):
        """Empty callback required by OpenCV trackbars."""
        pass
    
    def adjust_brightness_contrast(self, img, brightness=0, contrast=100):
        """
        Adjust brightness and contrast of an image.
        
        Args:
            img: Input image
            brightness: Brightness adjustment (-100 to 100, 0=no change)
            contrast: Contrast adjustment (0 to 200, 100=no change)
            
        Returns:
            Adjusted image
        """
        # Convert contrast from 0-200 scale to multiplier (0.0-2.0)
        contrast_factor = contrast / 100.0
        
        # Apply brightness and contrast
        # Formula: output = contrast * input + brightness
        adjusted = cv2.convertScaleAbs(img, alpha=contrast_factor, beta=brightness)
        
        return adjusted
    
    def calculate_roi(self, frame_shape, roi_size_percent):
        """
        Calculate Region of Interest as a centered square.
        
        Args:
            frame_shape: Tuple of (height, width) from the frame
            roi_size_percent: Percentage of frame height to use (10-100)
            
        Returns:
            Tuple of (x, y, width, height) for the ROI rectangle
        """
        height, width = frame_shape[:2]
        
        # Calculate square size based on frame height and percentage
        square_size = int(height * (roi_size_percent / 100.0))
        
        # Ensure square fits within frame width
        square_size = min(square_size, width)
        
        # Calculate center position
        center_x = width // 2
        center_y = height // 2
        
        # Calculate ROI coordinates (top-left corner)
        x = center_x - (square_size // 2)
        y = center_y - (square_size // 2)
        
        # Ensure ROI stays within frame bounds
        x = max(0, min(x, width - square_size))
        y = max(0, min(y, height - square_size))
        
        return (x, y, square_size, square_size)
    
    def draw_crosshair(self, img, color=(128, 128, 128), thickness=1, alpha=0.45):
        """
        Draw full-screen crosshair alignment lines at the center of the image.
        
        Args:
            img: Image to draw on (will be modified in place)
            color: Color of the crosshair (B, G, R) - default gray
            thickness: Line thickness
            alpha: Transparency (0.0 = fully transparent, 1.0 = fully opaque)
        """
        height, width = img.shape[:2]
        center_x = width // 2
        center_y = height // 2
        
        # Create overlay for transparency
        overlay = img.copy()
        
        # Draw horizontal line (full width)
        cv2.line(overlay, 
                (0, center_y), 
                (width, center_y), 
                color, thickness, cv2.LINE_AA)
        
        # Draw vertical line (full height)
        cv2.line(overlay, 
                (center_x, 0), 
                (center_x, height), 
                color, thickness, cv2.LINE_AA)
        
        # Blend overlay with original image for transparency
        cv2.addWeighted(overlay, alpha, img, 1 - alpha, 0, img)
        
        return img
    
    def adjust_brightness_contrast(self, img, brightness=0, contrast=100):
        """
        Adjust brightness and contrast of an image.
        
        Args:
            img: Input image
            brightness: Brightness adjustment (-100 to 100, 0=no change)
            contrast: Contrast adjustment (0 to 200, 100=no change)
            
        Returns:
            Adjusted image
        """
        # Convert contrast to alpha (multiplier)
        # contrast: 0=no contrast, 100=normal, 200=double contrast
        alpha = contrast / 100.0
        
        # Brightness is additive (beta)
        beta = brightness
        
        # Apply: new_img = alpha * img + beta
        adjusted = cv2.convertScaleAbs(img, alpha=alpha, beta=beta)
        
        return adjusted
    
    def measure_wood_dimensions(self, contour, mm_per_pixel):
        """
        Measure wood dimensions from contour with axis-aligned measurements.
        Returns width, height, and bounding box in both pixels and millimeters.
        
        Args:
            contour: OpenCV contour
            mm_per_pixel: Calibration factor (mm per pixel)
            
        Returns:
            Dictionary with measurements
        """
        # Get axis-aligned bounding rectangle
        x, y, w, h = cv2.boundingRect(contour)
        
        # Get rotated rectangle (minimum area rectangle)
        rect = cv2.minAreaRect(contour)
        box = cv2.boxPoints(rect)
        box = np.int0(box)
        
        # Get width and height of rotated rectangle
        # rect = ((center_x, center_y), (width, height), angle)
        rect_width = rect[1][0]
        rect_height = rect[1][1]
        
        # Ensure width is the longer dimension
        if rect_width < rect_height:
            rect_width, rect_height = rect_height, rect_width
        
        # Use axis-aligned bounding box for width and height (parallel to X/Y)
        width_px = float(w)  # X-axis aligned width
        height_px = float(h)  # Y-axis aligned height
        
        # Calculate corner points for axis-aligned box
        top_left = (x, y)
        top_right = (x + w, y)
        bottom_left = (x, y + h)
        bottom_right = (x + w, y + h)
        
        # Calculate midpoints for measurement lines
        left_mid = (x, y + h // 2)
        right_mid = (x + w, y + h // 2)
        top_mid = (x + w // 2, y)
        bottom_mid = (x + w // 2, y + h)
        
        # Convert to millimeters
        width_mm = width_px * mm_per_pixel
        height_mm = height_px * mm_per_pixel
        rect_width_mm = rect_width * mm_per_pixel
        rect_height_mm = rect_height * mm_per_pixel
        
        return {
            'bbox': (x, y, w, h),
            'rotated_box': box,
            'corners': {
                'top_left': top_left,
                'top_right': top_right,
                'bottom_left': bottom_left,
                'bottom_right': bottom_right
            },
            'midpoints': {
                'left': left_mid,
                'right': right_mid,
                'top': top_mid,
                'bottom': bottom_mid
            },
            'width_px': width_px,
            'height_px': height_px,
            'width_mm': width_mm,
            'height_mm': height_mm,
            'rect_width_px': rect_width,
            'rect_height_px': rect_height,
            'rect_width_mm': rect_width_mm,
            'rect_height_mm': rect_height_mm,
            'angle': rect[2]
        }
    
    def draw_measurements(self, img, measurements, color=(0, 255, 0)):
        """
        Draw measurement annotations on image with axis-aligned lines.
        
        Args:
            img: Image to draw on
            measurements: Dictionary from measure_wood_dimensions
            color: Drawing color
        """
        if not self.show_measurements:
            return img
        
        # Draw rotated bounding box (minimum area rectangle) in orange
        cv2.drawContours(img, [measurements['rotated_box']], 0, (0, 165, 255), 2)
        
        # Draw axis-aligned bounding box in green
        x, y, w, h = measurements['bbox']
        cv2.rectangle(img, (x, y), (x + w, y + h), (0, 255, 0), 2)
        
        # Get midpoints for measurement lines
        mp = measurements['midpoints']
        
        # Draw horizontal measurement line (width) - parallel to X-axis
        cv2.line(img, mp['left'], mp['right'], (255, 255, 255), 2)
        # Draw arrows at ends
        cv2.arrowedLine(img, (mp['left'][0] + 10, mp['left'][1]), mp['left'], (255, 255, 255), 2, tipLength=0.3)
        cv2.arrowedLine(img, (mp['right'][0] - 10, mp['right'][1]), mp['right'], (255, 255, 255), 2, tipLength=0.3)
        
        # Draw vertical measurement line (height) - parallel to Y-axis
        cv2.line(img, mp['top'], mp['bottom'], (255, 255, 255), 2)
        # Draw arrows at ends
        cv2.arrowedLine(img, (mp['top'][0], mp['top'][1] + 10), mp['top'], (255, 255, 255), 2, tipLength=0.3)
        cv2.arrowedLine(img, (mp['bottom'][0], mp['bottom'][1] - 10), mp['bottom'], (255, 255, 255), 2, tipLength=0.3)
        
        # Draw corner markers
        corners = measurements['corners']
        cv2.circle(img, corners['top_left'], 5, (255, 0, 0), -1)      # Blue
        cv2.circle(img, corners['top_right'], 5, (0, 255, 0), -1)     # Green
        cv2.circle(img, corners['bottom_left'], 5, (0, 0, 255), -1)   # Red
        cv2.circle(img, corners['bottom_right'], 5, (255, 255, 0), -1) # Cyan
        
        # Width text (above horizontal line)
        width_text = f"W: {measurements['width_mm']:.1f}mm ({measurements['width_px']:.0f}px)"
        text_x = mp['left'][0] + 10
        text_y = mp['left'][1] - 10
        cv2.putText(img, width_text, (text_x, text_y),
                   cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
        cv2.putText(img, width_text, (text_x, text_y),
                   cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 0), 1)
        
        # Height text (to the right of vertical line)
        height_text = f"H: {measurements['height_mm']:.1f}mm ({measurements['height_px']:.0f}px)"
        text_x = mp['right'][0] + 10
        text_y = mp['top'][1] + 30
        cv2.putText(img, height_text, (text_x, text_y),
                   cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
        cv2.putText(img, height_text, (text_x, text_y),
                   cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 0), 1)
        
        # Rotated rectangle dimensions at top
        rect_text = f"Rect: {measurements['rect_width_mm']:.1f}x{measurements['rect_height_mm']:.1f}mm"
        cv2.putText(img, rect_text, (x, y - 10),
                   cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
        cv2.putText(img, rect_text, (x, y - 10),
                   cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 165, 255), 1)
        
        return img
    
    def get_trackbar_values(self):
        """Retrieve current trackbar values."""
        # Get calibration (convert from x1000 to actual value)
        calibration_x1000 = max(1, cv2.getTrackbarPos("Calibration x1000", self.params_window))
        mm_per_pixel = calibration_x1000 / 1000.0
        
        # Ensure blur kernel is odd
        blur_kernel = cv2.getTrackbarPos("Blur Kernel", self.params_window)
        if blur_kernel % 2 == 0:
            blur_kernel += 1
        blur_kernel = max(1, blur_kernel)  # Ensure at least 1
        
        # Get ROI size (ensure it's not 0)
        roi_size = max(10, cv2.getTrackbarPos("ROI Size %", self.params_window))
        
        # Get target FPS (ensure minimum of 5 FPS)
        target_fps = max(5, cv2.getTrackbarPos("Target FPS", self.params_window))
        
        # Get processing time threshold (ensure minimum of 10 ms)
        proc_time_limit = max(10, cv2.getTrackbarPos("Proc Time Limit", self.params_window))
        
        # Get brightness and contrast (convert brightness from 0-200 to -100 to 100)
        brightness = cv2.getTrackbarPos("Brightness", self.params_window) - 100
        contrast = cv2.getTrackbarPos("Contrast", self.params_window)
        
        return {
            'edge_thickness': max(1, cv2.getTrackbarPos("Edge Thickness", self.params_window)),
            'threshold1': cv2.getTrackbarPos("Threshold1", self.params_window),
            'threshold2': cv2.getTrackbarPos("Threshold2", self.params_window),
            'min_area': cv2.getTrackbarPos("Min Area", self.params_window),
            'blur_kernel': blur_kernel,
            'dilation': cv2.getTrackbarPos("Dilation", self.params_window),
            'erosion': cv2.getTrackbarPos("Erosion", self.params_window),
            'roi_size': roi_size,
            'target_fps': target_fps,
            'proc_time_limit': proc_time_limit,
            'brightness': brightness,
            'contrast': contrast,
            'mm_per_pixel': mm_per_pixel,
        }
    
    def process_frame(self, img, params):
        """
        Process a single frame through the detection pipeline.
        
        Args:
            img: Input BGR image
            params: Dictionary of processing parameters
            
        Returns:
            Dictionary containing all processed images and contour data
        """
        # Calculate ROI
        roi_x, roi_y, roi_w, roi_h = self.calculate_roi(img.shape, params['roi_size'])
        self.roi_rect = (roi_x, roi_y, roi_w, roi_h)
        
        # Apply brightness and contrast adjustment
        img_adjusted = self.adjust_brightness_contrast(img, 
                                                        params['brightness'], 
                                                        params['contrast'])
        
        # Convert to grayscale
        img_gray = cv2.cvtColor(img_adjusted, cv2.COLOR_BGR2GRAY)
        
        # Apply blur (Gaussian or Bilateral)
        if self.use_bilateral_filter:
            # Bilateral filter - better edge preservation with noise reduction
            # d = diameter of pixel neighborhood (larger = more blur)
            # sigmaColor = filter sigma in the color space (larger = colors farther apart will be mixed)
            # sigmaSpace = filter sigma in the coordinate space (larger = farther pixels will influence each other)
            d = min(params['blur_kernel'], 15)  # Cap at 15 for performance
            img_blur = cv2.bilateralFilter(img_gray, d, 
                                           sigmaColor=75, 
                                           sigmaSpace=75)
        else:
            # Gaussian blur - faster but less edge-aware
            img_blur = cv2.GaussianBlur(img_gray, 
                                         (params['blur_kernel'], params['blur_kernel']), 1)
        
        # Edge detection
        img_canny = cv2.Canny(img_blur, params['threshold1'], params['threshold2'])
        
        # ---- EDGE THICKENING (USER CONTROLLED) ----
        edge_thickness = params.get("edge_thickness", 2)
        edge_thickness = max(1, min(edge_thickness, 7))

        kernel = np.ones((edge_thickness, edge_thickness), np.uint8)
        edges_thick = cv2.dilate(img_canny, kernel, iterations=1)

        # ---- FILL ENCLOSED REGION ----
        filled = edges_thick.copy()
        h, w = filled.shape

        mask = np.zeros((h + 2, w + 2), np.uint8)
        cv2.floodFill(filled, mask, (0, 0), 255)

        filled_inv = cv2.bitwise_not(filled)
        solid_mask = cv2.bitwise_or(edges_thick, filled_inv)

        # ---- CLEANUP ----
        kernel = np.ones((5, 5), np.uint8)
        solid_mask = cv2.morphologyEx(
            solid_mask,
            cv2.MORPH_CLOSE,
            kernel,
            iterations=2
        )

        # Create ROI mask - only process within the ROI
        roi_mask = np.zeros_like(img_canny)
        roi_mask[roi_y:roi_y+roi_h, roi_x:roi_x+roi_w] = 255
        
        # Apply ROI mask to canny image
        img_canny_masked = cv2.bitwise_and(img_canny, roi_mask)
        solid_mask_roi = cv2.bitwise_and(solid_mask, roi_mask)
        
        # Apply morphological operations if specified
        kernel = np.ones((5, 5), np.uint8)
        img_processed = img_canny_masked.copy()
        
        if params['dilation'] > 0:
            img_processed = cv2.dilate(img_processed, kernel, 
                                       iterations=params['dilation'])
        
        if params['erosion'] > 0:
            img_processed = cv2.erode(img_processed, kernel, 
                                      iterations=params['erosion'])
        
        # Find contours (only within ROI due to mask)
        contours, _ = cv2.findContours(
            solid_mask_roi,
            cv2.RETR_EXTERNAL,
            cv2.CHAIN_APPROX_SIMPLE
        )

        
        # Create visualization image (use adjusted image)
        img_contour = img_adjusted.copy()
        
        # Draw ROI rectangle on visualization
        cv2.rectangle(img_contour, (roi_x, roi_y), 
                     (roi_x + roi_w, roi_y + roi_h), 
                     (0, 255, 255), 2)  # Yellow ROI box
        
        # Add ROI label
        cv2.putText(img_contour, "ROI", (roi_x + 5, roi_y + 25), 
                   cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 255), 2)
        
        # Draw center crosshair for alignment
        if self.show_crosshair:
            self.draw_crosshair(img_contour, color=(128, 128, 128), thickness=1, alpha=0.45)
        
        # Process and draw contours
        valid_contours = []
        all_measurements = []
        
        for cnt in contours:
            area = cv2.contourArea(cnt)
            
            if area > params['min_area']:
                valid_contours.append(cnt)
                
                # Contours are already in full image coordinates (mask was full-sized)
                # No need to adjust - just use directly
                
                # Calculate measurements
                measurements = self.measure_wood_dimensions(cnt, params['mm_per_pixel'])
                all_measurements.append(measurements)
                
                # Draw contour (already in correct coordinates)
                cv2.drawContours(img_contour, [cnt], -1, (255, 0, 255), 3)
                
                # Draw measurements
                img_contour = self.draw_measurements(img_contour, measurements)
                
                # Get bounding rectangle (for area display)
                x, y, w, h = measurements['bbox']
                
                # Display area in top-left of bounding box
                cv2.putText(img_contour, f"A:{int(area)}px", 
                           (x, y - 30), cv2.FONT_HERSHEY_SIMPLEX, 
                           0.5, (0, 255, 0), 2)
        
        # Create ROI visualization image (with brightness/contrast applied)
        img_roi_view = cv2.cvtColor(img_gray, cv2.COLOR_GRAY2BGR)  # Use adjusted grayscale
        cv2.rectangle(img_roi_view, (roi_x, roi_y), 
                     (roi_x + roi_w, roi_y + roi_h), 
                     (0, 255, 255), 2)
        
        # Add crosshair to ROI view
        if self.show_crosshair:
            self.draw_crosshair(img_roi_view, color=(128, 128, 128), thickness=1, alpha=0.45)
        
        # Create blur visualization (with brightness/contrast applied)
        img_blur_color = cv2.cvtColor(img_blur, cv2.COLOR_GRAY2BGR)
        
        return {
            'original': img_adjusted,  # Show adjusted image instead of raw
            'adjusted': img_adjusted,
            'gray': cv2.cvtColor(img_gray, cv2.COLOR_GRAY2BGR),  # Convert to BGR for display
            'blur': img_blur_color,  # Show adjusted blur
            'canny': img_canny,  # Edge detection - keep as is
            'canny_masked': img_canny_masked,  # Edge detection - keep as is
            'processed': img_processed,  # Edge detection - keep as is
            'contour': img_contour,
            'roi_view': img_roi_view,
            'contours': valid_contours,
            'count': len(valid_contours),
            'roi': self.roi_rect,
            'measurements': all_measurements
        }
    
    def create_info_overlay(self, img, contour_count, fps, params, roi, actual_fps, proc_time_ms, fps_mode):
        """Add information overlay to the image."""
        overlay = img.copy()
        
        # Semi-transparent background for text
        cv2.rectangle(overlay, (5, 5), (350, 270), (0, 0, 0), -1)
        img_with_overlay = cv2.addWeighted(overlay, 0.3, img, 0.7, 0)
        
        # Determine color for processing time based on threshold
        proc_time_color = (0, 255, 0)  # Green
        if proc_time_ms > params['proc_time_limit']:
            proc_time_color = (0, 165, 255)  # Orange warning
        
        # Filter type text
        filter_type = "Bilateral" if self.use_bilateral_filter else "Gaussian"
        
        # Mode indicator (snapshot or live)
        mode_text = "SNAPSHOT MODE" if self.snapshot_mode else "LIVE"
        mode_color = (0, 255, 255) if self.snapshot_mode else (0, 255, 0)  # Cyan for snapshot, green for live
        
        # Add text information
        info_lines = [
            ("Edge Thickness: {}".format(params.get("edge_thickness", 2)), (0, 255, 0)),
            ("Mode: {}".format(mode_text), mode_color),
            ("Contours: {}".format(contour_count), (0, 255, 0)),
            ("FPS: {:.1f} / Target: {} ({})".format(actual_fps, params['target_fps'], fps_mode.upper()), (0, 255, 0)),
            ("Proc Time: {:.1f}ms / Limit: {}ms".format(proc_time_ms, params['proc_time_limit']), proc_time_color),
            ("Bright: {} | Contrast: {}".format(params['brightness'], params['contrast']), (0, 255, 0)),
            ("Blur: {} K={}".format(filter_type, params['blur_kernel']), (0, 255, 0)),
            ("Threshold: {}/{}".format(params['threshold1'], params['threshold2']), (0, 255, 0)),
            ("Min Area: {}".format(params['min_area']), (0, 255, 0)),
            ("ROI: {}x{} ({}%)".format(roi[2], roi[3], params['roi_size']), (0, 255, 0))
        ]
        
        y_offset = 25
        for text, color in info_lines:
            cv2.putText(img_with_overlay, text, (10, y_offset), 
                       cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 1)
            y_offset += 25
        
        # Add prominent snapshot mode banner at top center if in snapshot mode
        if self.snapshot_mode:
            height, width = img_with_overlay.shape[:2]
            banner_text = "SNAPSHOT MODE - Frame Frozen"
            font_scale = 1.0
            thickness = 2
            
            # Get text size
            (text_width, text_height), baseline = cv2.getTextSize(
                banner_text, cv2.FONT_HERSHEY_SIMPLEX, font_scale, thickness
            )
            
            # Calculate position (top center)
            x = (width - text_width) // 2
            y = 40
            
            # Draw semi-transparent background for banner
            banner_overlay = img_with_overlay.copy()
            cv2.rectangle(banner_overlay, 
                         (x - 10, y - text_height - 10),
                         (x + text_width + 10, y + baseline + 10),
                         (0, 0, 0), -1)
            img_with_overlay = cv2.addWeighted(banner_overlay, 0.5, img_with_overlay, 0.5, 0)
            
            # Draw text (cyan color for snapshot)
            cv2.putText(img_with_overlay, banner_text, (x, y),
                       cv2.FONT_HERSHEY_SIMPLEX, font_scale, (0, 255, 255), thickness)
        
        return img_with_overlay
    
    def stack_images(self, scale, img_array):
        """
        Stack multiple images in a grid layout.
        
        Args:
            scale: Scaling factor for images
            img_array: 2D list of images or 1D list for horizontal stacking
        """
        rows = len(img_array)
        cols = len(img_array[0]) if isinstance(img_array[0], list) else len(img_array)
        rows_available = isinstance(img_array[0], list)
        
        if rows_available:
            width = img_array[0][0].shape[1]
            height = img_array[0][0].shape[0]
        else:
            width = img_array[0].shape[1]
            height = img_array[0].shape[0]
        
        if rows_available:
            for x in range(rows):
                for y in range(cols):
                    img = img_array[x][y]
                    
                    # Resize to match first image dimensions
                    if img.shape[:2] != (height, width):
                        img = cv2.resize(img, (width, height))
                    
                    # Convert grayscale to BGR
                    if len(img.shape) == 2:
                        img = cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)
                    
                    img_array[x][y] = cv2.resize(img, (0, 0), None, scale, scale)
            
            # Stack horizontally then vertically
            hor = [np.hstack(img_array[x]) for x in range(rows)]
            ver = np.vstack(hor)
        else:
            for x in range(rows):
                img = img_array[x]
                
                # Resize to match first image dimensions
                if img.shape[:2] != (height, width):
                    img = cv2.resize(img, (width, height))
                
                # Convert grayscale to BGR
                if len(img.shape) == 2:
                    img = cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)
                
                img_array[x] = cv2.resize(img, (0, 0), None, scale, scale)
            
            ver = np.hstack(img_array)
        
        return ver
    
    def run(self):
        """Main execution loop for the contour detection pipeline."""
        # Initialize camera
        cap = cv2.VideoCapture(self.camera_index)
        
        if not cap.isOpened():
            print(f"Error: Cannot open camera {self.camera_index}")
            return
        
        # Setup trackbars
        self.setup_trackbars()
        
        print("Contour Detection Pipeline Started")
        print("Controls:")
        print("  'q' - Quit")
        print("  's' - Save current frame")
        print("  'SPACE' - Take snapshot (freeze frame for adjustment)")
        print("  'ESC' - Exit snapshot mode (return to live feed)")
        print("  'r' - Reset parameters to defaults")
        print("  'c' - Toggle center crosshair on/off")
        print("  'b' - Toggle Bilateral/Gaussian filter")
        print("  'm' - Toggle measurement display on/off")
        print("  'a' - Toggle FPS mode (Manual/Auto)")
        print("  '1' - Show 2x2 grid (Adjusted | ROI View | Masked Edges | Result)")
        print("  '2' - Show 2x3 grid (Adjusted | ROI | Gray | Blur | Masked | Result)")
        print("  '3' - Show main output only")
        print("\nROI (Region of Interest):")
        print("  - Yellow box shows detection zone")
        print("  - Adjust 'ROI Size %' trackbar to change size")
        print("  - ROI is centered square based on frame height")
        print("\nAlignment:")
        print("  - Gray crosshair marks screen center (full-screen)")
        print("  - 45% transparent for non-intrusive alignment")
        print("  - Use for centering objects during testing")
        print("\nPerformance:")
        print("  MANUAL Mode (default):")
        print("    - Use 'Target FPS' trackbar (5-60) to set desired FPS")
        print("    - 'Proc Time Limit' shows if processing exceeds threshold")
        print("  AUTO Mode (press 'a'):")
        print("    - FPS automatically adjusts based on processing load")
        print("    - Set 'Proc Time Limit' (10-200ms) as max processing time")
        print("    - System reduces FPS if processing exceeds limit")
        print("    - Orange text warns when threshold exceeded")
        print("  Recommended: Manual 15-30 FPS or Auto with 50ms limit")
        print("\nNoise Reduction:")
        print("  - Adjust 'Blur Kernel' trackbar (1-51) to reduce noise")
        print("  - Higher values = more blur, less noise, but slower detection")
        print("  - Press 'b' to toggle Bilateral Filter (better edge preservation)")
        print("  - Bilateral is slower but keeps edges sharp while reducing noise")
        print("\nImage Adjustment:")
        print("  - 'Brightness' trackbar: Adjust image brightness (0-200, 100=neutral)")
        print("  - 'Contrast' trackbar: Adjust image contrast (0-200, 100=neutral)")
        print("  - Increase brightness for dark/underexposed images")
        print("  - Increase contrast to make edges more pronounced")
        print("\nSnapshot Mode:")
        print("  - Press SPACE to freeze current frame")
        print("  - Adjust parameters (brightness, contrast, blur, etc.) on frozen frame")
        print("  - See changes instantly without camera feed changing")
        print("  - Press ESC to return to live camera feed")
        print("  - Perfect for fine-tuning detection parameters")
        print("\nDimension Measurement:")
        print("  - Automatic width/height measurement of detected wood")
        print("  - Width: X-axis aligned (horizontal)")
        print("  - Height: Y-axis aligned (vertical)")
        print("  - Rotated Rect: Minimum area bounding box (orange)")
        print("  - Calibration: Adjust 'Calibration x1000' trackbar")
        print("  - Default: 0.100 mm/pixel (100 on trackbar)")
        print("  - Press 'm' to toggle measurement display")
        print("  - Corner colors: Blue(TL), Green(TR), Red(BL), Cyan(BR)")
        
        # FPS calculation
        prev_frame_time = 0
        display_mode = 1  # 1: 2x2, 2: 2x3, 3: main only
        last_frame_start = 0
        
        # Moving average for processing time (for smoother auto-adjustment)
        proc_time_history = []
        proc_time_avg_window = 10  # Average over last 10 frames
        
        while True:
            # Track frame start time for FPS limiting
            frame_start_time = cv2.getTickCount()
            
            # Handle snapshot mode vs live feed
            if self.snapshot_mode and self.snapshot_frame is not None:
                # Use frozen snapshot
                img = self.snapshot_frame.copy()
            else:
                # Capture live frame
                success, img = cap.read()
                
                if not success:
                    print("Error: Failed to capture frame")
                    break
            
            # Calculate actual FPS (only for live feed)
            current_time = cv2.getTickCount()
            time_diff = (current_time - prev_frame_time) / cv2.getTickFrequency()
            actual_fps = 1.0 / time_diff if time_diff > 0 else 0
            prev_frame_time = current_time
            
            # Get current parameters
            params = self.get_trackbar_values()
            
            # Process frame (whether live or snapshot)
            results = self.process_frame(img, params)
            
            # Calculate processing time
            processing_end_time = cv2.getTickCount()
            processing_time = (processing_end_time - frame_start_time) / cv2.getTickFrequency()
            processing_time_ms = processing_time * 1000  # Convert to milliseconds
            
            # Update processing time history for moving average
            proc_time_history.append(processing_time_ms)
            if len(proc_time_history) > proc_time_avg_window:
                proc_time_history.pop(0)
            avg_proc_time = sum(proc_time_history) / len(proc_time_history)
            
            # Auto FPS adjustment based on processing time threshold
            if self.fps_mode == 'auto':
                if avg_proc_time > params['proc_time_limit']:
                    # Processing is too slow, reduce target FPS
                    new_target_fps = max(5, int(1000 / (avg_proc_time * 1.2)))  # 20% buffer
                    if new_target_fps < self.target_fps:
                        self.target_fps = new_target_fps
                        cv2.setTrackbarPos("Target FPS", self.params_window, self.target_fps)
                elif avg_proc_time < params['proc_time_limit'] * 0.7:
                    # Processing has headroom, can increase FPS
                    new_target_fps = min(60, int(1000 / (avg_proc_time * 1.1)))  # 10% buffer
                    if new_target_fps > self.target_fps:
                        self.target_fps = new_target_fps
                        cv2.setTrackbarPos("Target FPS", self.params_window, self.target_fps)
            else:
                # Manual mode - use trackbar value
                if params['target_fps'] != self.target_fps:
                    self.target_fps = params['target_fps']
                    self.frame_delay = 1.0 / self.target_fps
            
            # Add info overlay to contour image
            results['contour'] = self.create_info_overlay(
                results['contour'], results['count'], self.fps, params, 
                results['roi'], actual_fps, processing_time_ms, self.fps_mode
            )
            
            # Create display based on mode
            if display_mode == 1:
                # 2x2 grid: Adjusted | ROI View | Masked Edges | Result
                img_stack = self.stack_images(0.5, [
                    [results['original'], results['roi_view']],
                    [results['canny_masked'], results['contour']]
                ])
            elif display_mode == 2:
                # 2x3 grid: Adjusted | ROI | Gray | Blur | Masked | Result
                img_stack = self.stack_images(0.4, [
                    [results['original'], results['roi_view'], results['gray']],
                    [results['blur'], results['canny_masked'], results['contour']]
                ])
            else:
                # Main output only
                img_stack = results['contour']
            
            cv2.imshow(self.window_name, img_stack)
            
            # Calculate processing time and adjust wait time for target FPS
            frame_end_time = cv2.getTickCount()
            processing_time = (frame_end_time - frame_start_time) / cv2.getTickFrequency()
            
            # Calculate how long to wait to achieve target FPS
            target_frame_time = 1.0 / self.target_fps
            wait_time = max(1, int((target_frame_time - processing_time) * 1000))
            
            # Handle keyboard input with calculated wait time
            key = cv2.waitKey(wait_time) & 0xFF
            
            if key == ord('q'):
                break
            elif key == 32:  # SPACE key
                # Toggle snapshot mode
                if not self.snapshot_mode:
                    # Enter snapshot mode - capture current frame
                    self.snapshot_frame = img.copy()
                    self.snapshot_mode = True
                    print("SNAPSHOT MODE: Frame frozen - adjust parameters")
                    print("  Press ESC to return to live feed")
                else:
                    # Already in snapshot mode, update snapshot
                    # First need to get a fresh frame from camera
                    success, fresh_frame = cap.read()
                    if success:
                        self.snapshot_frame = fresh_frame.copy()
                        print("SNAPSHOT UPDATED: New frame captured")
            elif key == 27:  # ESC key
                # Exit snapshot mode
                if self.snapshot_mode:
                    self.snapshot_mode = False
                    self.snapshot_frame = None
                    print("LIVE MODE: Returned to camera feed")
            elif key == ord('s'):
                filename = f"contour_capture_{self.frame_count}.jpg"
                cv2.imwrite(filename, results['contour'])
                print(f"Saved: {filename}")
                
                # Print measurements if available
                if results['measurements']:
                    print(f"  Detected {len(results['measurements'])} object(s):")
                    for i, meas in enumerate(results['measurements'], 1):
                        print(f"    Object {i}:")
                        print(f"      Width:  {meas['width_mm']:.2f}mm ({meas['width_px']:.1f}px)")
                        print(f"      Height: {meas['height_mm']:.2f}mm ({meas['height_px']:.1f}px)")
                        print(f"      Rect:   {meas['rect_width_mm']:.2f}x{meas['rect_height_mm']:.2f}mm")
                        print(f"      Angle:  {meas['angle']:.1f}°")
            elif key == ord('c'):
                # Toggle crosshair
                self.show_crosshair = not self.show_crosshair
                status = "ON" if self.show_crosshair else "OFF"
                print(f"Center crosshair: {status}")
            elif key == ord('m'):
                # Toggle measurements
                self.show_measurements = not self.show_measurements
                status = "ON" if self.show_measurements else "OFF"
                print(f"Measurements: {status}")
            elif key == ord('b'):
                # Toggle bilateral filter
                self.use_bilateral_filter = not self.use_bilateral_filter
                filter_type = "Bilateral (Edge-Aware)" if self.use_bilateral_filter else "Gaussian (Fast)"
                print(f"Blur Filter: {filter_type}")
            elif key == ord('a'):
                # Toggle FPS mode (auto/manual)
                self.fps_mode = 'auto' if self.fps_mode == 'manual' else 'manual'
                print(f"FPS Mode: {self.fps_mode.upper()}")
                if self.fps_mode == 'manual':
                    print("  - Use 'Target FPS' trackbar to set desired FPS")
                else:
                    print("  - FPS will auto-adjust based on 'Proc Time Limit'")
            elif key == ord('r'):
                # Reset to defaults
                cv2.setTrackbarPos("Calibration x1000", self.params_window, 100)  # 0.1 mm/px
                cv2.setTrackbarPos("Brightness", self.params_window, 100)  # 100 = 0 brightness
                cv2.setTrackbarPos("Contrast", self.params_window, 
                                  self.default_params['contrast'])
                cv2.setTrackbarPos("Threshold1", self.params_window, 
                                  self.default_params['threshold1'])
                cv2.setTrackbarPos("Threshold2", self.params_window, 
                                  self.default_params['threshold2'])
                cv2.setTrackbarPos("Min Area", self.params_window, 
                                  self.default_params['min_area'])
                cv2.setTrackbarPos("Blur Kernel", self.params_window, 
                                  self.default_params['blur_kernel'])
                cv2.setTrackbarPos("Dilation", self.params_window, 
                                  self.default_params['dilation'])
                cv2.setTrackbarPos("Erosion", self.params_window, 
                                  self.default_params['erosion'])
                cv2.setTrackbarPos("ROI Size %", self.params_window, 
                                  self.default_params['roi_size'])
                cv2.setTrackbarPos("Target FPS", self.params_window, 30)
                cv2.setTrackbarPos("Proc Time Limit", self.params_window, 50)
                self.fps_mode = 'manual'
                self.use_bilateral_filter = False
                print("Parameters reset to defaults")
            elif key == ord('1'):
                display_mode = 1
                print("Display mode: 2x2 grid (Original | Adjusted | Masked | Result)")
            elif key == ord('2'):
                display_mode = 2
                print("Display mode: 2x3 grid (Full pipeline with adjustments)")
            elif key == ord('3'):
                display_mode = 3
                print("Display mode: Main output only")
            
            self.frame_count += 1
        
        # Cleanup
        cap.release()
        cv2.destroyAllWindows()
        print(f"\nProcessed {self.frame_count} frames")


def main():
    """Main entry point."""
    pipeline = ContourDetectionPipeline(camera_index=0)
    pipeline.run()


if __name__ == "__main__":
    main()