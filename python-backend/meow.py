import cv2
import numpy as np

class TemporalFilter:
    def __init__(self, alpha=0.3, min_confidence_frames=5):
        """
        Temporal filter for smoothing corner detections
        
        Args:
            alpha: Smoothing factor (0-1). Lower = smoother but slower response
            min_confidence_frames: Frames needed before displaying filtered result
        """
        self.alpha = alpha
        self.filtered_corners = None
        self.frame_count = 0
        self.min_confidence_frames = min_confidence_frames
    
    def update(self, new_corners):
        """
        Update filter with new corner detections
        
        Args:
            new_corners: numpy array of shape (4, 2) with corner coordinates
        
        Returns:
            Smoothed corners or None if not enough frames yet
        """
        if new_corners is None:
            return self.filtered_corners
        
        new_corners = np.array(new_corners, dtype=np.float32)
        
        if self.filtered_corners is None:
            # Initialize with first detection
            self.filtered_corners = new_corners.copy()
            self.frame_count = 1
        else:
            # Exponential moving average: filtered = alpha * new + (1-alpha) * filtered
            self.filtered_corners = (self.alpha * new_corners + 
                                    (1 - self.alpha) * self.filtered_corners)
            self.frame_count += 1
        
        # Only return result after minimum confidence frames
        if self.frame_count >= self.min_confidence_frames:
            return self.filtered_corners
        else:
            return None
    
    def reset(self):
        """Reset the filter"""
        self.filtered_corners = None
        self.frame_count = 0


# Main detection code with temporal filtering
video_source = 0
cap = cv2.VideoCapture(video_source)

if not cap.isOpened():
    raise ValueError(f"Cannot open video source: {video_source}")

# Initialize temporal filter
# alpha=0.3 means 30% new data, 70% previous (adjust for smoothness)
temporal_filter = TemporalFilter(alpha=0.3, min_confidence_frames=5)

# Statistics for monitoring
total_frames = 0
detection_failures = 0

while True:
    ret, frame = cap.read()
    if not ret:
        print("End of video or cannot read frame.")
        break

    orig = frame.copy()
    total_frames += 1
    detected_corners = None

    try:
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        blur = cv2.GaussianBlur(gray, (5, 5), 0)

        edges = cv2.Canny(blur, 50, 150)

        contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        if len(contours) == 0:
            raise ValueError("No contours detected.")

        largest_contour = max(contours, key=cv2.contourArea)

        if cv2.contourArea(largest_contour) < 100:
            raise ValueError("Largest contour too small to be a square.")

        hull = cv2.convexHull(largest_contour)

        peri = cv2.arcLength(hull, True)
        approx = cv2.approxPolyDP(hull, 0.02 * peri, True)

        if len(approx) != 4:
            rect = cv2.minAreaRect(hull)
            box = cv2.boxPoints(rect)
            detected_corners = np.intp(box)
        else:
            detected_corners = approx.reshape(4, 2)
        
        # Draw raw detection (faint)
        if detected_corners is not None:
            for i, (x, y) in enumerate(detected_corners):
                cv2.circle(orig, (int(x), int(y)), 4, (128, 128, 128), 1)

    except Exception as e:
        detection_failures += 1
        cv2.putText(orig, f"Detection Error: {str(e)}", (10, 60), 
                   cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 255), 1)
    
    # Update temporal filter
    filtered_corners = temporal_filter.update(detected_corners)
    
    # Draw filtered results
    if filtered_corners is not None and len(filtered_corners) == 4:
        # Convert to integer coordinates
        filtered_int = filtered_corners.astype(np.int32)
        
        for i, (x, y) in enumerate(filtered_int):
            cv2.circle(orig, (int(x), int(y)), 8, (0, 255, 0), -1)
            cv2.putText(orig, f"P{i+1}", (int(x) + 5, int(y) - 5), 
                       cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 0), 2)
        
        # Draw contour - use polylines instead of drawContours for simplicity
        cv2.polylines(orig, [filtered_int], isClosed=True, color=(0, 255, 0), thickness=2)
        
        # Status indicator
        cv2.putText(orig, "FILTERED", (10, 30), 
                   cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
    else:
        cv2.putText(orig, "INITIALIZING...", (10, 30), 
                   cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 165, 255), 2)
    
    # Display statistics
    success_rate = ((total_frames - detection_failures) / total_frames) * 100 if total_frames > 0 else 0
    cv2.putText(orig, f"Detection Rate: {success_rate:.1f}%", (10, orig.shape[0] - 10), 
               cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)

    cv2.imshow("Square Corner Detection (Temporal Filtering)", orig)

    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

cap.release()
cv2.destroyAllWindows()