import cv2
import numpy as np
from scipy import signal


class CannyZernikeDetector:
    """
    Improved Canny-Zernike Subpixel Edge Detection Algorithm
    Based on: "An Improved Canny-Zernike Subpixel Detection Algorithm" by Wang et al.
    """
    
    def __init__(self, n=7):
        """
        Initialize the Canny-Zernike detector.
        
        Args:
            n: Neighborhood size (default 7x7 as per paper)
        """
        self.n = n
        self.zernike_masks = self._create_zernike_masks()
        
    def _create_zernike_masks(self):
        """Create Zernike moment masks (7x7 templates from the paper)."""
        masks = {}
        
        # Z00 - Zeroth order
        masks['Z00'] = np.array([
            [0, 0.0287, 0.0686, 0.0807, 0.0686, 0.0287, 0],
            [0.0287, 0.0815, 0.0816, 0.0816, 0.0816, 0.0815, 0.0287],
            [0.0686, 0.0816, 0.0816, 0.0816, 0.0816, 0.0816, 0.0686],
            [0.0807, 0.0816, 0.0816, 0.0816, 0.0816, 0.0816, 0.0807],
            [0.0686, 0.0816, 0.0816, 0.0816, 0.0816, 0.0816, 0.0686],
            [0.0287, 0.0815, 0.0816, 0.0816, 0.0816, 0.0815, 0.0287],
            [0, 0.0287, 0.0686, 0.0807, 0.0686, 0.0287, 0]
        ])
        
        # Z11 Real part
        masks['Z11R'] = np.array([
            [0, -0.015, -0.019, 0, 0.019, 0.015, 0],
            [-0.0224, -0.0466, -0.0233, 0, 0.0233, 0.0466, 0.0224],
            [-0.0573, -0.0466, -0.0233, 0, 0.0233, 0.0466, 0.0573],
            [-0.069, -0.0466, -0.0233, 0, 0.0233, 0.0466, 0.069],
            [-0.0573, -0.0466, -0.0233, 0, 0.0233, 0.0466, 0.0573],
            [-0.0224, -0.0466, -0.0233, 0, 0.0233, 0.0466, 0.0224],
            [0, -0.015, -0.019, 0, 0.019, 0.015, 0]
        ])
        
        # Z11 Imaginary part
        masks['Z11I'] = np.array([
            [0, -0.0224, -0.0573, -0.069, -0.0573, -0.0224, 0],
            [-0.015, -0.0466, -0.0466, -0.0466, -0.0466, -0.0466, -0.015],
            [-0.019, -0.0233, -0.0233, -0.0233, -0.0233, -0.0233, -0.019],
            [0, 0, 0, 0, 0, 0, 0],
            [0.019, 0.0233, 0.0233, 0.0233, 0.0233, 0.0233, 0.019],
            [0.015, 0.0466, 0.0466, 0.0466, 0.0466, 0.0466, 0.015],
            [0, 0.0224, 0.0573, 0.069, 0.0573, 0.0224, 0]
        ])
        
        # Z20 - Second order
        masks['Z20'] = np.array([
            [0, 0.0225, 0.0394, 0.0396, 0.0394, 0.0225, 0],
            [0.0225, 0.0271, -0.0128, -0.0261, -0.0128, 0.0271, 0.0225],
            [0.0394, -0.0128, -0.0528, -0.0661, -0.0528, -0.0128, 0.0394],
            [0.0396, -0.0261, -0.0661, -0.0794, -0.0661, -0.0261, 0.0396],
            [0.0394, -0.0128, -0.0528, -0.0661, -0.0528, -0.0128, 0.0394],
            [0.0225, 0.0271, -0.0128, -0.0261, -0.0128, 0.0271, 0.0225],
            [0, 0.0225, 0.0394, 0.0396, 0.0394, 0.0225, 0]
        ])
        
        return masks
    
    def bilateral_filter(self, img, d=9, sigma_color=75, sigma_space=75):
        """
        Apply bilateral filtering for noise reduction while preserving edges.
        
        Args:
            img: Input image
            d: Diameter of pixel neighborhood
            sigma_color: Filter sigma in the color space
            sigma_space: Filter sigma in the coordinate space
        """
        return cv2.bilateralFilter(img, d, sigma_color, sigma_space)
    
    def improved_canny_gradient(self, img):
        """
        Improved Canny gradient calculation with 4 directions (0°, 45°, 90°, 135°).
        
        Args:
            img: Input grayscale image
            
        Returns:
            magnitude, direction: Gradient magnitude and direction
        """
        # Gradient templates from the paper
        Hx = np.array([[-1, 0, 1],
                       [-2, 0, 2],
                       [-1, 0, 1]], dtype=np.float32)
        
        Hy = np.array([[-1, -2, -1],
                       [0, 0, 0],
                       [1, 2, 1]], dtype=np.float32)
        
        H45 = np.array([[0, 1, 2],
                        [-1, 0, 1],
                        [-2, -1, 0]], dtype=np.float32)
        
        H135 = np.array([[-2, -1, 0],
                         [-1, 0, 1],
                         [0, 1, 2]], dtype=np.float32)
        
        # Calculate gradients in 4 directions
        Px = cv2.filter2D(img, cv2.CV_64F, Hx)
        Py = cv2.filter2D(img, cv2.CV_64F, Hy)
        P45 = cv2.filter2D(img, cv2.CV_64F, H45)
        P135 = cv2.filter2D(img, cv2.CV_64F, H135)
        
        # Combine gradients as per paper formula (6)
        fx = Px + (P45 + P135) / 2.0
        fy = Py + (P45 - P135) / 2.0
        
        # Calculate magnitude and direction
        magnitude = np.sqrt(fx**2 + fy**2)
        direction = np.arctan2(fy, fx)
        
        return magnitude, direction
    
    def non_maximum_suppression(self, magnitude, direction):
        """
        Apply non-maximum suppression to thin edges.
        
        Args:
            magnitude: Gradient magnitude
            direction: Gradient direction in radians
            
        Returns:
            Suppressed edge image (uint8)
        """
        rows, cols = magnitude.shape
        suppressed = np.zeros((rows, cols), dtype=np.uint8)
        
        # Convert angle to 0-180 degrees
        angle = direction * 180.0 / np.pi
        angle[angle < 0] += 180
        
        for i in range(1, rows - 1):
            for j in range(1, cols - 1):
                q = 255
                r = 255
                
                # Angle 0
                if (0 <= angle[i, j] < 22.5) or (157.5 <= angle[i, j] <= 180):
                    q = magnitude[i, j + 1]
                    r = magnitude[i, j - 1]
                # Angle 45
                elif 22.5 <= angle[i, j] < 67.5:
                    q = magnitude[i + 1, j - 1]
                    r = magnitude[i - 1, j + 1]
                # Angle 90
                elif 67.5 <= angle[i, j] < 112.5:
                    q = magnitude[i + 1, j]
                    r = magnitude[i - 1, j]
                # Angle 135
                elif 112.5 <= angle[i, j] < 157.5:
                    q = magnitude[i - 1, j - 1]
                    r = magnitude[i + 1, j + 1]
                
                if magnitude[i, j] >= q and magnitude[i, j] >= r:
                    suppressed[i, j] = int(min(magnitude[i, j], 255))
                else:
                    suppressed[i, j] = 0
        
        return suppressed
    
    def double_threshold(self, img, low_ratio=0.05, high_ratio=0.15):
        """
        Apply double thresholding to classify edges.
        
        Args:
            img: Input edge image (uint8)
            low_ratio: Low threshold ratio
            high_ratio: High threshold ratio
            
        Returns:
            strong, weak: Strong and weak edge images (uint8)
        """
        high_threshold = img.max() * high_ratio
        low_threshold = high_threshold * low_ratio
        
        strong = np.zeros_like(img, dtype=np.uint8)
        weak = np.zeros_like(img, dtype=np.uint8)
        
        strong_i, strong_j = np.where(img >= high_threshold)
        weak_i, weak_j = np.where((img <= high_threshold) & (img >= low_threshold))
        
        strong[strong_i, strong_j] = 255
        weak[weak_i, weak_j] = 75
        
        return strong, weak
    
    def hysteresis(self, strong, weak):
        """
        Apply edge tracking by hysteresis.
        
        Args:
            strong: Strong edge image (uint8)
            weak: Weak edge image (uint8)
            
        Returns:
            Final edge image (uint8)
        """
        rows, cols = strong.shape
        edges = strong.copy().astype(np.uint8)
        
        for i in range(1, rows - 1):
            for j in range(1, cols - 1):
                if weak[i, j] == 75:
                    if ((strong[i + 1, j - 1] == 255) or (strong[i + 1, j] == 255) or
                        (strong[i + 1, j + 1] == 255) or (strong[i, j - 1] == 255) or
                        (strong[i, j + 1] == 255) or (strong[i - 1, j - 1] == 255) or
                        (strong[i - 1, j] == 255) or (strong[i - 1, j + 1] == 255)):
                        edges[i, j] = 255
        
        return edges
    
    def calculate_zernike_moments(self, img_patch):
        """
        Calculate Zernike moments for a local image patch.
        
        Args:
            img_patch: Local 7x7 image patch
            
        Returns:
            Dictionary of Zernike moment values
        """
        moments = {}
        
        # Calculate Z00, Z11, Z20 using convolution
        moments['Z00'] = np.sum(img_patch * self.zernike_masks['Z00'])
        
        # Z11 is complex: Z11 = Z11R + i*Z11I
        Z11R = np.sum(img_patch * self.zernike_masks['Z11R'])
        Z11I = np.sum(img_patch * self.zernike_masks['Z11I'])
        moments['Z11'] = complex(Z11R, Z11I)
        
        moments['Z20'] = np.sum(img_patch * self.zernike_masks['Z20'])
        
        return moments
    
    def subpixel_edge_parameters(self, moments):
        """
        Calculate subpixel edge parameters from Zernike moments.
        Based on formula (7) from the paper.
        
        Args:
            moments: Dictionary of Zernike moment values
            
        Returns:
            phi, h, k, l: Edge parameters (angle, background, step, distance)
        """
        Z00 = moments['Z00']
        Z11 = moments['Z11']
        Z20 = moments['Z20']
        
        # Edge angle φ
        phi = np.arctan2(Z11.imag, Z11.real)
        
        # Normalized distance Z11'
        Z11_prime = Z20 / (Z11 * np.exp(-1j * phi))
        l = Z11_prime.real
        
        # Limit l to valid range [-1, 1]
        l = np.clip(l, -0.99, 0.99)
        
        # Step gray level k
        k = (3 * abs(Z11) * np.exp(1j * phi)) / (2 * (1 - l**2)**(3/2))
        k = k.real
        
        # Background gray level h
        term1 = k * np.pi / 2
        term2 = k * np.arctan(l)
        term3 = k * l * np.sqrt(1 - l**2)
        h = Z00 - (term1 + term2 + term3) / np.pi
        
        return phi, h, k, l
    
    def subpixel_refinement(self, pixel_edges, img):
        """
        Refine pixel-level edges to subpixel accuracy using Zernike moments.
        
        Args:
            pixel_edges: Binary edge image from Canny
            img: Original grayscale image
            
        Returns:
            subpixel_edges: List of subpixel edge coordinates [(x, y), ...]
        """
        edge_points = np.argwhere(pixel_edges > 0)
        subpixel_edges = []
        
        half_n = self.n // 2
        rows, cols = img.shape
        
        for point in edge_points:
            y, x = point
            
            # Check if patch is within image bounds
            if (y - half_n < 0 or y + half_n + 1 > rows or
                x - half_n < 0 or x + half_n + 1 > cols):
                subpixel_edges.append((float(x), float(y)))
                continue
            
            # Extract local patch
            patch = img[y - half_n:y + half_n + 1, 
                       x - half_n:x + half_n + 1].astype(np.float64)
            
            if patch.shape != (self.n, self.n):
                subpixel_edges.append((float(x), float(y)))
                continue
            
            # Calculate Zernike moments
            moments = self.calculate_zernike_moments(patch)
            
            # Calculate edge parameters
            try:
                phi, h, k, l = self.subpixel_edge_parameters(moments)
                
                # Calculate subpixel offset (formula 8 from paper)
                # The offset is l/2 scaled by N/2 in the direction of phi
                offset_x = (self.n / 2) * (l / 2) * np.cos(phi)
                offset_y = (self.n / 2) * (l / 2) * np.sin(phi)
                
                # Calculate subpixel coordinates
                xs = x + offset_x
                ys = y + offset_y
                
                subpixel_edges.append((xs, ys))
            except:
                # If calculation fails, use pixel-level coordinates
                subpixel_edges.append((float(x), float(y)))
        
        return subpixel_edges
    
    def detect(self, img, use_bilateral=True, low_threshold=50, high_threshold=150,
               apply_subpixel=True):
        """
        Main detection function combining improved Canny and Zernike subpixel refinement.
        
        Args:
            img: Input image (grayscale or color)
            use_bilateral: Use bilateral filtering instead of Gaussian
            low_threshold: Low threshold for Canny (0-255)
            high_threshold: High threshold for Canny (0-255)
            apply_subpixel: Apply Zernike subpixel refinement
            
        Returns:
            pixel_edges: Pixel-level edge detection result (uint8)
            subpixel_edges: List of subpixel edge coordinates (if apply_subpixel=True)
        """
        # Convert to grayscale if needed
        if len(img.shape) == 3:
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        else:
            gray = img.copy()
        
        # Step 1: Noise reduction
        if use_bilateral:
            filtered = self.bilateral_filter(gray)
        else:
            filtered = cv2.GaussianBlur(gray, (5, 5), 1.4)
        
        # Step 2: Improved gradient calculation
        magnitude, direction = self.improved_canny_gradient(filtered)
        
        # Step 3: Non-maximum suppression (returns uint8)
        suppressed = self.non_maximum_suppression(magnitude, direction)
        
        # Step 4: Double thresholding (convert thresholds to ratios)
        # If thresholds are > 1, assume they're in 0-255 range
        if high_threshold > 1:
            high_ratio = high_threshold / 255.0
            low_ratio = low_threshold / 255.0
        else:
            high_ratio = high_threshold
            low_ratio = low_threshold
        
        strong, weak = self.double_threshold(suppressed, low_ratio, high_ratio)
        
        # Step 5: Edge tracking by hysteresis (returns uint8)
        pixel_edges = self.hysteresis(strong, weak)
        
        # Ensure output is uint8
        pixel_edges = pixel_edges.astype(np.uint8)
        
        # Step 6: Subpixel refinement (optional)
        subpixel_edges = None
        if apply_subpixel:
            subpixel_edges = self.subpixel_refinement(pixel_edges, gray)
        
        return pixel_edges, subpixel_edges


def visualize_results(img, pixel_edges, subpixel_edges=None):
    """
    Visualize detection results.
    
    Args:
        img: Original image
        pixel_edges: Pixel-level edges
        subpixel_edges: Subpixel edge coordinates (optional)
    """
    # Create visualization image
    if len(img.shape) == 3:
        vis = img.copy()
    else:
        vis = cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)
    
    # Draw pixel-level edges in red
    vis[pixel_edges > 0] = [0, 0, 255]
    
    # Draw subpixel edges in green
    if subpixel_edges is not None:
        for (x, y) in subpixel_edges:
            # Draw small circle at subpixel location
            cv2.circle(vis, (int(round(x)), int(round(y))), 1, (0, 255, 0), -1)
    
    return vis


def main():
    """Example usage of the Canny-Zernike detector."""
    # Initialize detector
    detector = CannyZernikeDetector(n=7)
    
    # Open camera
    cap = cv2.VideoCapture(0)
    
    if not cap.isOpened():
        print("Error: Cannot open camera")
        return
    
    print("Canny-Zernike Subpixel Edge Detection")
    print("Controls:")
    print("  'q' - Quit")
    print("  's' - Save current frame")
    print("  'p' - Toggle subpixel refinement")
    print("  'b' - Toggle bilateral filtering")
    
    apply_subpixel = True
    use_bilateral = True
    frame_count = 0
    
    while True:
        ret, frame = cap.read()
        
        if not ret:
            print("Error: Failed to capture frame")
            break
        
        # Detect edges
        pixel_edges, subpixel_edges = detector.detect(
            frame, 
            use_bilateral=use_bilateral,
            low_threshold=50,
            high_threshold=150,
            apply_subpixel=apply_subpixel
        )
        
        # Visualize
        vis = visualize_results(frame, pixel_edges, subpixel_edges)
        
        # Add info text
        mode_text = f"Subpixel: {'ON' if apply_subpixel else 'OFF'} | Bilateral: {'ON' if use_bilateral else 'OFF'}"
        cv2.putText(vis, mode_text, (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 
                   0.7, (0, 255, 0), 2)
        
        if subpixel_edges:
            cv2.putText(vis, f"Edges: {len(subpixel_edges)}", (10, 60), 
                       cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
        
        # Show results
        cv2.imshow("Original", frame)
        cv2.imshow("Pixel Edges", pixel_edges)
        cv2.imshow("Subpixel Visualization", vis)
        
        # Handle keyboard input
        key = cv2.waitKey(1) & 0xFF
        
        if key == ord('q'):
            break
        elif key == ord('s'):
            filename = f"canny_zernike_{frame_count}.jpg"
            cv2.imwrite(filename, vis)
            print(f"Saved: {filename}")
        elif key == ord('p'):
            apply_subpixel = not apply_subpixel
            print(f"Subpixel refinement: {'ON' if apply_subpixel else 'OFF'}")
        elif key == ord('b'):
            use_bilateral = not use_bilateral
            print(f"Bilateral filtering: {'ON' if use_bilateral else 'OFF'}")
        
        frame_count += 1
    
    cap.release()
    cv2.destroyAllWindows()


if __name__ == "__main__":
    main()