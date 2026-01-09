import cv2
import numpy as np
import sys
sys.path.append('/home/claude')
from canny_zernike_detector import CannyZernikeDetector


class EnhancedContourDetection:
    """
    Enhanced contour detection combining:
    - ROI (Region of Interest)
    - Improved Canny-Zernike subpixel edge detection
    - Center crosshair alignment
    - FPS limiting with processing time threshold
    """
    
    def __init__(self, camera_index=0):
        self.camera_index = camera_index
        self.window_name = "Enhanced Detection"
        self.params_window = "Parameters"
        
        # Initialize Canny-Zernike detector
        self.zernike_detector = CannyZernikeDetector(n=7)
        
        # Default parameters
        self.default_params = {
            'threshold1': 50,
            'threshold2': 150,
            'min_area': 500,
            'roi_size': 100,
            'target_fps': 30,
            'proc_time_limit': 50
        }
        
        # State variables
        self.roi_rect = None
        self.show_crosshair = True
        self.target_fps = 30
        self.frame_delay = 1.0 / self.target_fps
        self.fps_mode = 'manual'
        self.processing_time_threshold = 50
        
        # Detection mode: 'pixel' or 'subpixel'
        self.detection_mode = 'subpixel'
        self.use_bilateral = True
        
        # Statistics
        self.frame_count = 0
        self.fps = 0
        
    def setup_trackbars(self):
        """Initialize parameter control window with trackbars."""
        cv2.namedWindow(self.params_window)
        cv2.resizeWindow(self.params_window, 640, 380)
        
        cv2.createTrackbar("Threshold1", self.params_window, 
                          self.default_params['threshold1'], 255, self._empty_callback)
        cv2.createTrackbar("Threshold2", self.params_window, 
                          self.default_params['threshold2'], 255, self._empty_callback)
        cv2.createTrackbar("Min Area", self.params_window, 
                          self.default_params['min_area'], 10000, self._empty_callback)
        cv2.createTrackbar("ROI Size %", self.params_window, 
                          self.default_params['roi_size'], 100, self._empty_callback)
        cv2.createTrackbar("Target FPS", self.params_window, 
                          self.target_fps, 60, self._empty_callback)
        cv2.createTrackbar("Proc Time Limit", self.params_window, 
                          self.processing_time_threshold, 200, self._empty_callback)
    
    @staticmethod
    def _empty_callback(a):
        """Empty callback required by OpenCV trackbars."""
        pass
    
    def get_trackbar_values(self):
        """Retrieve current trackbar values."""
        roi_size = max(10, cv2.getTrackbarPos("ROI Size %", self.params_window))
        target_fps = max(5, cv2.getTrackbarPos("Target FPS", self.params_window))
        proc_time_limit = max(10, cv2.getTrackbarPos("Proc Time Limit", self.params_window))
        
        return {
            'threshold1': cv2.getTrackbarPos("Threshold1", self.params_window),
            'threshold2': cv2.getTrackbarPos("Threshold2", self.params_window),
            'min_area': cv2.getTrackbarPos("Min Area", self.params_window),
            'roi_size': roi_size,
            'target_fps': target_fps,
            'proc_time_limit': proc_time_limit
        }
    
    def calculate_roi(self, frame_shape, roi_size_percent):
        """Calculate centered square ROI."""
        height, width = frame_shape[:2]
        square_size = int(height * (roi_size_percent / 100.0))
        square_size = min(square_size, width)
        
        center_x = width // 2
        center_y = height // 2
        
        x = center_x - (square_size // 2)
        y = center_y - (square_size // 2)
        
        x = max(0, min(x, width - square_size))
        y = max(0, min(y, height - square_size))
        
        return (x, y, square_size, square_size)
    
    def draw_crosshair(self, img, color=(128, 128, 128), thickness=1, alpha=0.45):
        """Draw full-screen crosshair alignment lines."""
        height, width = img.shape[:2]
        center_x = width // 2
        center_y = height // 2
        
        overlay = img.copy()
        cv2.line(overlay, (0, center_y), (width, center_y), color, thickness, cv2.LINE_AA)
        cv2.line(overlay, (center_x, 0), (center_x, height), color, thickness, cv2.LINE_AA)
        cv2.addWeighted(overlay, alpha, img, 1 - alpha, 0, img)
        
        return img
    
    def process_frame_zernike(self, img, params):
        """
        Process frame using Canny-Zernike subpixel detection.
        
        Args:
            img: Input BGR image
            params: Dictionary of processing parameters
            
        Returns:
            Dictionary containing processed images and detection results
        """
        # Calculate ROI
        roi_x, roi_y, roi_w, roi_h = self.calculate_roi(img.shape, params['roi_size'])
        self.roi_rect = (roi_x, roi_y, roi_w, roi_h)
        
        # Extract ROI
        roi_img = img[roi_y:roi_y+roi_h, roi_x:roi_x+roi_w]
        
        # Apply Canny-Zernike detection on ROI
        pixel_edges, subpixel_edges = self.zernike_detector.detect(
            roi_img,
            use_bilateral=self.use_bilateral,
            low_threshold=params['threshold1'],
            high_threshold=params['threshold2'],
            apply_subpixel=(self.detection_mode == 'subpixel')
        )
        
        # Create full-size edge image
        full_edges = np.zeros((img.shape[0], img.shape[1]), dtype=np.uint8)
        full_edges[roi_y:roi_y+roi_h, roi_x:roi_x+roi_w] = pixel_edges
        
        # Find contours
        contours, _ = cv2.findContours(pixel_edges, cv2.RETR_EXTERNAL, 
                                       cv2.CHAIN_APPROX_SIMPLE)
        
        # Create visualization
        img_contour = img.copy()
        
        # Draw ROI rectangle
        cv2.rectangle(img_contour, (roi_x, roi_y), 
                     (roi_x + roi_w, roi_y + roi_h), 
                     (0, 255, 255), 2)
        cv2.putText(img_contour, "ROI", (roi_x + 5, roi_y + 25), 
                   cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 255), 2)
        
        # Draw crosshair
        if self.show_crosshair:
            self.draw_crosshair(img_contour)
        
        # Process and draw contours
        valid_contours = []
        for cnt in contours:
            area = cv2.contourArea(cnt)
            if area > params['min_area']:
                valid_contours.append(cnt)
                
                # Adjust contour coordinates to full image
                cnt_adjusted = cnt + np.array([roi_x, roi_y])
                
                # Draw contour
                cv2.drawContours(img_contour, [cnt_adjusted], -1, (255, 0, 255), 3)
                
                # Get bounding rectangle
                x, y, w, h = cv2.boundingRect(cnt_adjusted)
                cv2.rectangle(img_contour, (x, y), (x + w, y + h), (0, 255, 0), 2)
                cv2.putText(img_contour, f"A:{int(area)}", 
                           (x, y - 10), cv2.FONT_HERSHEY_SIMPLEX, 
                           0.5, (0, 255, 0), 2)
        
        # Draw subpixel edges if available
        if subpixel_edges and self.detection_mode == 'subpixel':
            for (x, y) in subpixel_edges:
                # Adjust to full image coordinates
                px = int(round(x + roi_x))
                py = int(round(y + roi_y))
                cv2.circle(img_contour, (px, py), 1, (0, 255, 0), -1)
        
        return {
            'original': img,
            'edges': full_edges,
            'contour': img_contour,
            'contours': valid_contours,
            'count': len(valid_contours),
            'roi': self.roi_rect,
            'subpixel_edges': subpixel_edges
        }
    
    def create_info_overlay(self, img, results, actual_fps, proc_time_ms, params):
        """Add information overlay to the image."""
        overlay = img.copy()
        
        cv2.rectangle(overlay, (5, 5), (350, 220), (0, 0, 0), -1)
        img_with_overlay = cv2.addWeighted(overlay, 0.3, img, 0.7, 0)
        
        # Determine color for processing time
        proc_time_color = (0, 255, 0) if proc_time_ms <= params['proc_time_limit'] else (0, 165, 255)
        
        info_lines = [
            ("Contours: {}".format(results['count']), (0, 255, 0)),
            ("FPS: {:.1f} / Target: {} ({})".format(actual_fps, params['target_fps'], 
                                                     self.fps_mode.upper()), (0, 255, 0)),
            ("Proc Time: {:.1f}ms / Limit: {}ms".format(proc_time_ms, params['proc_time_limit']), 
             proc_time_color),
            ("Mode: {} ({})".format(self.detection_mode.upper(), 
                                   'Bilateral' if self.use_bilateral else 'Gaussian'), (0, 255, 0)),
            ("Threshold: {}/{}".format(params['threshold1'], params['threshold2']), (0, 255, 0)),
            ("Min Area: {}".format(params['min_area']), (0, 255, 0)),
            ("ROI: {}x{} ({}%)".format(results['roi'][2], results['roi'][3], 
                                       params['roi_size']), (0, 255, 0))
        ]
        
        y_offset = 25
        for text, color in info_lines:
            cv2.putText(img_with_overlay, text, (10, y_offset), 
                       cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 1)
            y_offset += 25
        
        return img_with_overlay
    
    def run(self):
        """Main execution loop."""
        cap = cv2.VideoCapture(self.camera_index)
        
        if not cap.isOpened():
            print(f"Error: Cannot open camera {self.camera_index}")
            return
        
        self.setup_trackbars()
        
        print("Enhanced Canny-Zernike Detection Pipeline")
        print("Controls:")
        print("  'q' - Quit")
        print("  's' - Save current frame")
        print("  'c' - Toggle center crosshair")
        print("  'd' - Toggle detection mode (Pixel/Subpixel)")
        print("  'b' - Toggle filter (Bilateral/Gaussian)")
        print("  'a' - Toggle FPS mode (Manual/Auto)")
        print("  'r' - Reset parameters")
        
        prev_frame_time = 0
        proc_time_history = []
        proc_time_avg_window = 10
        
        while True:
            frame_start_time = cv2.getTickCount()
            
            success, img = cap.read()
            if not success:
                print("Error: Failed to capture frame")
                break
            
            # Calculate actual FPS
            current_time = cv2.getTickCount()
            time_diff = (current_time - prev_frame_time) / cv2.getTickFrequency()
            actual_fps = 1.0 / time_diff if time_diff > 0 else 0
            prev_frame_time = current_time
            
            # Get parameters
            params = self.get_trackbar_values()
            
            # Process frame
            results = self.process_frame_zernike(img, params)
            
            # Calculate processing time
            processing_end_time = cv2.getTickCount()
            processing_time = (processing_end_time - frame_start_time) / cv2.getTickFrequency()
            processing_time_ms = processing_time * 1000
            
            # Update processing time history
            proc_time_history.append(processing_time_ms)
            if len(proc_time_history) > proc_time_avg_window:
                proc_time_history.pop(0)
            avg_proc_time = sum(proc_time_history) / len(proc_time_history)
            
            # Auto FPS adjustment
            if self.fps_mode == 'auto':
                if avg_proc_time > params['proc_time_limit']:
                    new_target_fps = max(5, int(1000 / (avg_proc_time * 1.2)))
                    if new_target_fps < self.target_fps:
                        self.target_fps = new_target_fps
                        cv2.setTrackbarPos("Target FPS", self.params_window, self.target_fps)
                elif avg_proc_time < params['proc_time_limit'] * 0.7:
                    new_target_fps = min(60, int(1000 / (avg_proc_time * 1.1)))
                    if new_target_fps > self.target_fps:
                        self.target_fps = new_target_fps
                        cv2.setTrackbarPos("Target FPS", self.params_window, self.target_fps)
            else:
                if params['target_fps'] != self.target_fps:
                    self.target_fps = params['target_fps']
            
            # Add info overlay
            results['contour'] = self.create_info_overlay(
                results['contour'], results, actual_fps, processing_time_ms, params
            )
            
            # Display
            cv2.imshow(self.window_name, results['contour'])
            cv2.imshow("Edges", results['edges'])
            
            # Frame delay for FPS limiting
            frame_end_time = cv2.getTickCount()
            total_time = (frame_end_time - frame_start_time) / cv2.getTickFrequency()
            target_frame_time = 1.0 / self.target_fps
            wait_time = max(1, int((target_frame_time - total_time) * 1000))
            
            key = cv2.waitKey(wait_time) & 0xFF
            
            if key == ord('q'):
                break
            elif key == ord('s'):
                filename = f"zernike_detection_{self.frame_count}.jpg"
                cv2.imwrite(filename, results['contour'])
                print(f"Saved: {filename}")
            elif key == ord('c'):
                self.show_crosshair = not self.show_crosshair
                print(f"Crosshair: {'ON' if self.show_crosshair else 'OFF'}")
            elif key == ord('d'):
                self.detection_mode = 'subpixel' if self.detection_mode == 'pixel' else 'pixel'
                print(f"Detection mode: {self.detection_mode.upper()}")
            elif key == ord('b'):
                self.use_bilateral = not self.use_bilateral
                print(f"Filter: {'Bilateral' if self.use_bilateral else 'Gaussian'}")
            elif key == ord('a'):
                self.fps_mode = 'auto' if self.fps_mode == 'manual' else 'manual'
                print(f"FPS Mode: {self.fps_mode.upper()}")
            elif key == ord('r'):
                for param, value in self.default_params.items():
                    trackbar_name = param.replace('_', ' ').title()
                    if trackbar_name in ["Threshold1", "Threshold2", "Min Area", 
                                        "Roi Size %", "Target Fps", "Proc Time Limit"]:
                        cv2.setTrackbarPos(trackbar_name, self.params_window, value)
                self.fps_mode = 'manual'
                print("Parameters reset to defaults")
            
            self.frame_count += 1
        
        cap.release()
        cv2.destroyAllWindows()
        print(f"\nProcessed {self.frame_count} frames")


def main():
    detector = EnhancedContourDetection(camera_index=0)
    detector.run()


if __name__ == "__main__":
    main()