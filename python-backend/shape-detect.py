import cv2
import numpy as np
import time


class ContourDetectionPipeline:
    """
    Contour Detection Pipeline for measuring a wood-like object inside a center ROI.

    NOTE (important design choice):
    - Measurement is driven by a SOLID MASK inside the ROI (stable),
      not by raw Canny edges (noisy on wood grain).
    """

    def __init__(self, camera_index=0):
        # Default parameters (used for trackbar initialization)
        self.default_params = {
            "threshold1": 50,
            "threshold2": 150,
            "mask_thresh": 0,        # 0 = Otsu (auto). >0 = manual threshold
            "min_area": 2000,
            "blur_kernel": 5,
            "dilation": 0,
            "erosion": 0,
            "open_k": 3,
            "close_k": 5,
            "roi_size": 60,
            "roi_shape": 0,          # 0=rectangle, 1=square (from trackbar mapping)
            "brightness": 100,        # trackbar 0..200 mapped to -100..+100
            "contrast": 100,          # trackbar 0..200 mapped to 0..200 (%)
            "mm_per_pixel_x1000": 100,  # 0.100 mm/px default
            "edge_thickness": 2,
            "target_fps": 30,
        }

        # Camera + state
        self.camera_index = camera_index
        self.roi_rect = None

        # Toggles
        self.show_crosshair = False
        self.use_bilateral_filter = False
        self.use_clahe = True

        # Snapshot control
        self.snapshot_mode = False
        self.snapshot_frame = None

        # FPS / performance
        self.prev_time = time.time()
        self.fps = 0.0
        self.processing_ms = 0.0

    # ----------------------------
    # UI: Trackbars
    # ----------------------------
    def _empty_callback(self, _):
        pass

    def setup_trackbars(self):
        cv2.namedWindow("Parameters", cv2.WINDOW_NORMAL)

        cv2.createTrackbar("Edge Thickness", "Parameters", self.default_params["edge_thickness"], 10, self._empty_callback)

        cv2.createTrackbar("Calib(mm/px)*1000", "Parameters", self.default_params["mm_per_pixel_x1000"], 1000, self._empty_callback)

        cv2.createTrackbar("Brightness", "Parameters", self.default_params["brightness"], 200, self._empty_callback)
        cv2.createTrackbar("Contrast", "Parameters", self.default_params["contrast"], 200, self._empty_callback)

        cv2.createTrackbar("Thresh1", "Parameters", self.default_params["threshold1"], 255, self._empty_callback)
        cv2.createTrackbar("Thresh2", "Parameters", self.default_params["threshold2"], 255, self._empty_callback)

        # 0 means Otsu; 1..255 manual threshold
        cv2.createTrackbar("Mask Thresh(0=Otsu)", "Parameters", self.default_params["mask_thresh"], 255, self._empty_callback)

        cv2.createTrackbar("Open K", "Parameters", self.default_params["open_k"], 31, self._empty_callback)
        cv2.createTrackbar("Close K", "Parameters", self.default_params["close_k"], 31, self._empty_callback)

        cv2.createTrackbar("Dilation", "Parameters", self.default_params["dilation"], 10, self._empty_callback)
        cv2.createTrackbar("Erosion", "Parameters", self.default_params["erosion"], 10, self._empty_callback)

        cv2.createTrackbar("Min Area", "Parameters", self.default_params["min_area"], 50000, self._empty_callback)

        cv2.createTrackbar("Blur K", "Parameters", self.default_params["blur_kernel"], 31, self._empty_callback)

        cv2.createTrackbar("ROI Size(%)", "Parameters", self.default_params["roi_size"], 100, self._empty_callback)

        # 0 rectangle, 1 square
        cv2.createTrackbar("ROI Shape(0=Rect,1=Sq)", "Parameters", self.default_params["roi_shape"], 1, self._empty_callback)

        cv2.createTrackbar("Target FPS", "Parameters", self.default_params["target_fps"], 120, self._empty_callback)

    def get_trackbar_values(self):
        params = {}

        params["edge_thickness"] = max(1, cv2.getTrackbarPos("Edge Thickness", "Parameters"))

        mm_x1000 = max(1, cv2.getTrackbarPos("Calib(mm/px)*1000", "Parameters"))
        params["mm_per_pixel"] = mm_x1000 / 1000.0

        # Brightness trackbar: 0..200 mapped to -100..+100
        b = cv2.getTrackbarPos("Brightness", "Parameters") - 100
        params["brightness"] = int(b)

        # Contrast: 0..200, treat 100 as neutral
        params["contrast"] = int(cv2.getTrackbarPos("Contrast", "Parameters"))

        params["threshold1"] = cv2.getTrackbarPos("Thresh1", "Parameters")
        params["threshold2"] = cv2.getTrackbarPos("Thresh2", "Parameters")

        params["mask_thresh"] = cv2.getTrackbarPos("Mask Thresh(0=Otsu)", "Parameters")

        # Ensure odd kernels >=1
        open_k = max(1, cv2.getTrackbarPos("Open K", "Parameters"))
        if open_k % 2 == 0:
            open_k += 1
        params["open_k"] = open_k

        close_k = max(1, cv2.getTrackbarPos("Close K", "Parameters"))
        if close_k % 2 == 0:
            close_k += 1
        params["close_k"] = close_k

        params["dilation"] = max(0, cv2.getTrackbarPos("Dilation", "Parameters"))
        params["erosion"] = max(0, cv2.getTrackbarPos("Erosion", "Parameters"))

        params["min_area"] = max(0, cv2.getTrackbarPos("Min Area", "Parameters"))

        blur_k = max(1, cv2.getTrackbarPos("Blur K", "Parameters"))
        if blur_k % 2 == 0:
            blur_k += 1
        params["blur_kernel"] = blur_k

        params["roi_size"] = max(5, cv2.getTrackbarPos("ROI Size(%)", "Parameters"))
        params["roi_shape"] = cv2.getTrackbarPos("ROI Shape(0=Rect,1=Sq)", "Parameters")

        params["target_fps"] = max(1, cv2.getTrackbarPos("Target FPS", "Parameters"))

        return params

    # ----------------------------
    # Helpers
    # ----------------------------
    def calculate_roi(self, frame_shape, roi_size_percent, roi_shape):
        h, w = frame_shape[:2]
        size = roi_size_percent / 100.0

        if roi_shape == 1:  # square
            side = int(h * size)
            side = min(side, w)
            roi_w = side
            roi_h = side
        else:  # rectangle
            roi_w = int(w * size)
            roi_h = int(h * size)

        roi_x = (w - roi_w) // 2
        roi_y = (h - roi_h) // 2
        roi_x = max(0, roi_x)
        roi_y = max(0, roi_y)

        roi_w = min(roi_w, w - roi_x)
        roi_h = min(roi_h, h - roi_y)

        return roi_x, roi_y, roi_w, roi_h

    def draw_crosshair(self, img, color=(0, 255, 255), thickness=1, alpha=0.5):
        h, w = img.shape[:2]
        cx, cy = w // 2, h // 2
        overlay = img.copy()
        cv2.line(overlay, (0, cy), (w, cy), color, thickness)
        cv2.line(overlay, (cx, 0), (cx, h), color, thickness)
        cv2.addWeighted(overlay, alpha, img, 1 - alpha, 0, img)

    def adjust_brightness_contrast(self, img, brightness, contrast):
        # convertScaleAbs: dst = saturate(|alpha*src + beta|)
        # Here: alpha from contrast (%), beta from brightness
        alpha = max(0.0, contrast / 100.0)
        beta = float(brightness)
        return cv2.convertScaleAbs(img, alpha=alpha, beta=beta)

    def _largest_component(self, bin_img):
        """
        Keep only the largest connected component in a binary image.
        """
        num_labels, labels, stats, _ = cv2.connectedComponentsWithStats(bin_img, connectivity=8)
        if num_labels <= 1:
            return bin_img

        # Skip label 0 (background)
        largest_label = 1
        largest_area = stats[1, cv2.CC_STAT_AREA]
        for i in range(2, num_labels):
            area = stats[i, cv2.CC_STAT_AREA]
            if area > largest_area:
                largest_area = area
                largest_label = i

        out = np.zeros_like(bin_img)
        out[labels == largest_label] = 255
        return out

    # ----------------------------
    # Measurement
    # ----------------------------
    def measure_wood_dimensions(self, contour, mm_per_pixel):
        x, y, w, h = cv2.boundingRect(contour)
        rect = cv2.minAreaRect(contour)
        box = cv2.boxPoints(rect)
        box = box.astype(int)

        width_mm = w * mm_per_pixel
        height_mm = h * mm_per_pixel

        (rcx, rcy), (rw, rh), angle = rect
        rot_w_mm = rw * mm_per_pixel
        rot_h_mm = rh * mm_per_pixel

        cx = x + w // 2
        cy = y + h // 2

        return {
            "bbox": (x, y, w, h),
            "bbox_center": (cx, cy),
            "width_px": w,
            "height_px": h,
            "width_mm": width_mm,
            "height_mm": height_mm,
            "rot_box": box,
            "rot_size_px": (rw, rh),
            "rot_size_mm": (rot_w_mm, rot_h_mm),
            "rot_angle": angle,
        }

    def draw_measurements(self, img, m):
        box = m["rot_box"]

        # Draw a single rotated bounding box (preferred for rotated specimens)
        cv2.drawContours(img, [box], 0, (255, 255, 0), 2)

        # Place labels near the top-left of the rotated box
        text_x = max(int(box[:, 0].min()), 10)
        text_y = int(box[:, 1].min()) - 10
        text_y = max(text_y, 20)  # keep labels inside frame

        cv2.putText(
            img,
            f"Rot: {m['rot_size_mm'][0]:.2f} x {m['rot_size_mm'][1]:.2f} mm",
            (text_x, text_y),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.6,
            (255, 255, 0),
            2,
        )
        cv2.putText(
            img,
            f"Angle: {m['rot_angle']:.1f} deg",
            (text_x, text_y + 20),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.6,
            (255, 255, 0),
            2,
        )

    # ----------------------------
    # Frame processing
    # ----------------------------
    def process_frame(self, frame, params):
        h, w = frame.shape[:2]
        roi_x, roi_y, roi_w, roi_h = self.calculate_roi(
            frame.shape, params["roi_size"], params["roi_shape"]
        )
        self.roi_rect = (roi_x, roi_y, roi_w, roi_h)

        # Brightness/contrast
        img_adj = self.adjust_brightness_contrast(frame, params["brightness"], params["contrast"])

        # Grayscale + ROI
        gray = cv2.cvtColor(img_adj, cv2.COLOR_BGR2GRAY)
        roi_gray = gray[roi_y:roi_y + roi_h, roi_x:roi_x + roi_w]

        # Denoise
        if self.use_bilateral_filter:
            roi_dn = cv2.bilateralFilter(roi_gray, 9, 75, 75)
        else:
            roi_dn = cv2.GaussianBlur(roi_gray, (params["blur_kernel"], params["blur_kernel"]), 0)

        # Optional CLAHE (lighting normalization)
        if self.use_clahe:
            clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
            roi_dn = clahe.apply(roi_dn)

        # Smooth before threshold
        roi_sm = cv2.GaussianBlur(roi_dn, (5, 5), 0)

        # Threshold: Otsu if mask_thresh==0, else manual
        if params["mask_thresh"] == 0:
            _, roi_bin = cv2.threshold(roi_sm, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        else:
            _, roi_bin = cv2.threshold(roi_sm, params["mask_thresh"], 255, cv2.THRESH_BINARY)

        # Auto polarity fix: if too much of ROI is white, invert
        white_ratio = float(np.count_nonzero(roi_bin)) / float(roi_bin.size)
        if white_ratio > 0.65:
            roi_bin = cv2.bitwise_not(roi_bin)

        # --- Morph cleanup using sliders ---
        # Trackbar-controlled kernels:
        open_k = max(1, int(params.get("open_k", 3)))
        close_k = max(1, int(params.get("close_k", 5)))
        k_open = np.ones((open_k, open_k), np.uint8)
        k_close = np.ones((close_k, close_k), np.uint8)

        # Trackbar-controlled extra erosion/dilation passes.
        # These are optional "extra seasoning" on top of open/close.
        k3 = np.ones((3, 3), np.uint8)
        er_it = max(0, int(params.get("erosion", 0)))
        di_it = max(0, int(params.get("dilation", 0)))

        if er_it:
            roi_bin = cv2.erode(roi_bin, k3, iterations=er_it)
        if di_it:
            roi_bin = cv2.dilate(roi_bin, k3, iterations=di_it)

        # Open removes specks; Close fills holes.
        roi_bin = cv2.morphologyEx(roi_bin, cv2.MORPH_OPEN, k_open, iterations=1)
        roi_bin = cv2.morphologyEx(roi_bin, cv2.MORPH_CLOSE, k_close, iterations=2)

        # Keep only the dominant region (THIS is the big noise killer)
        roi_obj = self._largest_component(roi_bin)

        # Optional extra smoothing on the mask boundary (use close kernel, not undefined k5)
        roi_obj = cv2.morphologyEx(roi_obj, cv2.MORPH_CLOSE, k_close, iterations=1)

        # Build full-frame solid mask (for display/debug)
        solid_mask_full = np.zeros_like(gray)
        solid_mask_full[roi_y:roi_y + roi_h, roi_x:roi_x + roi_w] = roi_obj

        # --- Build edge/outline view from the SOLID mask (not from texture) ---
        # Edge thickness slider affects the outline kernel.
        et = max(1, int(params.get("edge_thickness", 2)))
        k_edge = np.ones((2 * et + 1, 2 * et + 1), np.uint8)
        roi_outline = cv2.morphologyEx(roi_obj, cv2.MORPH_GRADIENT, k_edge)
        roi_outline = cv2.dilate(roi_outline, np.ones((et, et), np.uint8), iterations=1)

        outline_full = np.zeros_like(gray)
        outline_full[roi_y:roi_y + roi_h, roi_x:roi_x + roi_w] = roi_outline

        # --- Find contours from ROI solid mask ---
        contours, _ = cv2.findContours(roi_obj, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        # Filter contours by area and offset to full frame coords
        valid_contours = []
        for c in contours:
            area = cv2.contourArea(c)
            if area >= params["min_area"]:
                c_full = c + np.array([[roi_x, roi_y]])
                valid_contours.append(c_full)

        # Keep largest valid contour for stability
        largest_contour = None
        if valid_contours:
            largest_contour = max(valid_contours, key=cv2.contourArea)

        # --- Visuals ---
        output = img_adj.copy()

        # ROI box
        cv2.rectangle(output, (roi_x, roi_y), (roi_x + roi_w, roi_y + roi_h), (255, 255, 255), 2)
        cv2.putText(
            output,
            f"ROI: {params['roi_size']}% {'SQUARE' if params['roi_shape'] else 'RECT'}",
            (roi_x, roi_y - 10),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.6,
            (255, 255, 255),
            2,
        )

        if self.show_crosshair:
            self.draw_crosshair(output)

        measurements = None
        contour_count = 0

        if largest_contour is not None:
            contour_count = 1
            cv2.drawContours(output, [largest_contour], -1, (255, 0, 255), 2)

            measurements = self.measure_wood_dimensions(largest_contour, params["mm_per_pixel"])
            self.draw_measurements(output, measurements)

            area = cv2.contourArea(largest_contour)
            cv2.putText(
                output,
                f"Area: {area:.0f} px",
                (roi_x, roi_y + roi_h + 50),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.6,
                (255, 0, 255),
                2,
            )

        # ROI view for debug
        roi_view = cv2.cvtColor(roi_dn, cv2.COLOR_GRAY2BGR)
        edges_view = cv2.cvtColor(outline_full, cv2.COLOR_GRAY2BGR)
        mask_view = cv2.cvtColor(solid_mask_full, cv2.COLOR_GRAY2BGR)

        return {
            "output": output,
            "roi_view": roi_view,
            "edges_view": edges_view,
            "mask_view": mask_view,
            "contour_count": contour_count,
            "measurements": measurements,
        }

    # ----------------------------
    # Overlay / stacking
    # ----------------------------
    def create_info_overlay(self, img, params, contour_count, mode_text):
        overlay = img.copy()

        # Panel
        cv2.rectangle(overlay, (10, 10), (430, 210), (0, 0, 0), -1)
        cv2.addWeighted(overlay, 0.55, img, 0.45, 0, img)

        y = 35
        dy = 22

        def line(text):
            nonlocal y
            cv2.putText(img, text, (20, y), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (255, 255, 255), 2)
            y += dy

        line(f"MODE: {mode_text}")
        line(f"Contours: {contour_count}")
        line(f"FPS: {self.fps:.1f}  Target: {params['target_fps']}")
        line(f"Proc: {self.processing_ms:.1f} ms")

        line(f"Brightness: {params['brightness']}  Contrast: {params['contrast']}")
        line(f"Filter: {'BILATERAL' if self.use_bilateral_filter else 'GAUSSIAN'}  CLAHE: {self.use_clahe}")
        line(f"Min Area: {params['min_area']}  ROI: {params['roi_size']}%")
        line(f"Edge Thk: {params['edge_thickness']}")

        # Show the newly-wired tuning knobs (the ones you asked for)
        line(f"MaskTh: {params['mask_thresh']}  OpenK: {params['open_k']}  CloseK: {params['close_k']}")
        line(f"Ero: {params['erosion']}  Dil: {params['dilation']}")

        if self.snapshot_mode:
            cv2.putText(img, "SNAPSHOT", (20, 245), cv2.FONT_HERSHEY_SIMPLEX, 1.0, (0, 255, 255), 3)

    def stack_images(self, scale, img_array):
        # img_array: list of lists [[a,b],[c,d]] etc
        rows = len(img_array)
        cols = len(img_array[0])
        h = img_array[0][0].shape[0]
        w = img_array[0][0].shape[1]

        def to_bgr(im):
            if len(im.shape) == 2:
                return cv2.cvtColor(im, cv2.COLOR_GRAY2BGR)
            return im

        for r in range(rows):
            for c in range(cols):
                img_array[r][c] = to_bgr(img_array[r][c])
                img_array[r][c] = cv2.resize(img_array[r][c], (w, h), interpolation=cv2.INTER_AREA)

        hor = [np.hstack(row) for row in img_array]
        ver = np.vstack(hor)
        if scale != 1.0:
            ver = cv2.resize(ver, (0, 0), fx=scale, fy=scale)
        return ver

    # ----------------------------
    # Main loop
    # ----------------------------
    def run(self):
        cap = cv2.VideoCapture(self.camera_index)
        if not cap.isOpened():
            raise RuntimeError("Could not open camera.")

        self.setup_trackbars()

        display_mode = 1

        print("Contour Detection Pipeline Started")
        print("SPACE = snapshot | ESC = live | q = quit")
        print("c = crosshair | b = bilateral/gaussian | h = CLAHE on/off")
        print("1 = 2x2 view | 2 = 2x3 view | 3 = main only")
        print("NOTE: Measurement now uses SOLID MASK in ROI (stable).")

        while True:
            loop_start = time.time()

            if self.snapshot_mode and self.snapshot_frame is not None:
                frame = self.snapshot_frame.copy()
            else:
                ret, frame = cap.read()
                if not ret:
                    break

            # FPS calc
            now = time.time()
            dt = now - self.prev_time
            self.prev_time = now
            if dt > 0:
                self.fps = 1.0 / dt

            # Params
            params = self.get_trackbar_values()

            # Process
            t0 = time.time()
            results = self.process_frame(frame, params)
            t1 = time.time()
            self.processing_ms = (t1 - t0) * 1000.0

            # Overlay
            mode_text = "LIVE" if not self.snapshot_mode else "SNAPSHOT"
            self.create_info_overlay(results["output"], params, results["contour_count"], mode_text)

            # Display layouts
            if display_mode == 1:
                grid = [
                    [results["output"], results["roi_view"]],
                    [results["edges_view"], results["mask_view"]],
                ]
                stacked = self.stack_images(0.8, grid)
                cv2.imshow("Contour Detection", stacked)
            elif display_mode == 2:
                grid = [
                    [results["output"], results["roi_view"], results["edges_view"]],
                    [results["mask_view"], results["mask_view"], results["mask_view"]],
                ]
                stacked = self.stack_images(0.7, grid)
                cv2.imshow("Contour Detection", stacked)
            else:
                cv2.imshow("Contour Detection", results["output"])

            # Key controls
            key = cv2.waitKey(1) & 0xFF
            if key == ord("q"):
                break
            elif key == 32:  # SPACE
                self.snapshot_mode = not self.snapshot_mode
                if self.snapshot_mode:
                    self.snapshot_frame = frame.copy()
                else:
                    self.snapshot_frame = None
            elif key == 27:  # ESC
                self.snapshot_mode = False
                self.snapshot_frame = None
            elif key == ord("c"):
                self.show_crosshair = not self.show_crosshair
            elif key == ord("b"):
                self.use_bilateral_filter = not self.use_bilateral_filter
            elif key == ord("h"):
                self.use_clahe = not self.use_clahe
            elif key == ord("1"):
                display_mode = 1
            elif key == ord("2"):
                display_mode = 2
            elif key == ord("3"):
                display_mode = 3

            # FPS pacing
            target_fps = params["target_fps"]
            target_dt = 1.0 / float(target_fps)
            elapsed = time.time() - loop_start
            sleep_time = target_dt - elapsed
            if sleep_time > 0:
                time.sleep(sleep_time)

        cap.release()
        cv2.destroyAllWindows()


def main():
    pipeline = ContourDetectionPipeline(camera_index=0)
    pipeline.run()


if __name__ == "__main__":
    main()
