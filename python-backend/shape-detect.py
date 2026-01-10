import cv2
import numpy as np


class ContourDetectionPipeline:
    """
    Stable contour pipeline:
      1) ROI crop
      2) Denoise + optional contrast normalization
      3) Binarize -> Morph cleanup
      4) Keep largest connected component (dominant object)
      5) Contour from solid mask (NOT from noisy edges)
      6) Edge thickness slider controls outline visualization thickness
    """

    def __init__(self, camera_index=0, window_name="Contour Detection Pipeline"):
        self.camera_index = camera_index
        self.window_name = window_name
        self.params_window = "Parameters"

        self.default_params = {
            "threshold1": 52,   # kept (if you later want canny debug)
            "threshold2": 104,
            "min_area": 2000,
            "blur_kernel": 21,  # must be odd
            "dilation": 1,
            "erosion": 1,
            "roi_size": 60,     # %
            "brightness": 100,  # trackbar 0..200, 100=neutral -> converted to -100..+100
            "contrast": 100,    # trackbar 0..200, 100=neutral
            "mm_per_pixel": 0.1,
            "edge_thickness": 2,  # visualization thickness (outline view)
        }

        self.roi_rect = None
        self.show_crosshair = True
        self.use_bilateral_filter = True  # edge-aware denoise
        self.use_clahe = True             # helps stabilize lighting / texture

        self.snapshot_mode = False
        self.snapshot_frame = None

        self.show_measurements = True

        self.target_fps = 15
        self.frame_delay = 1.0 / self.target_fps
        self.fps_mode = "manual"
        self.processing_time_threshold = 50

        self.frame_count = 0
        self.fps = 0

    # ---------- UI / Trackbars ----------

    def setup_trackbars(self):
        cv2.namedWindow(self.params_window)
        cv2.resizeWindow(self.params_window, 640, 580)

        cv2.createTrackbar("Edge Thickness", self.params_window, self.default_params["edge_thickness"], 12, self._empty_callback)

        cv2.createTrackbar("Calibration x1000", self.params_window, 100, 2000, self._empty_callback)  # 0.100 -> 100
        cv2.createTrackbar("Brightness", self.params_window, 100, 200, self._empty_callback)         # 100 neutral
        cv2.createTrackbar("Contrast", self.params_window, 100, 200, self._empty_callback)           # 100 neutral

        cv2.createTrackbar("Threshold1", self.params_window, self.default_params["threshold1"], 255, self._empty_callback)
        cv2.createTrackbar("Threshold2", self.params_window, self.default_params["threshold2"], 255, self._empty_callback)

        # Solid-mask thresholding (0 = OTSU auto)
        cv2.createTrackbar("Mask Thresh (0=OTSU)", self.params_window, 0, 255, self._empty_callback)

        # Morph cleanup kernels (odd sizes recommended)
        cv2.createTrackbar("Open K", self.params_window, 3, 21, self._empty_callback)
        cv2.createTrackbar("Close K", self.params_window, 5, 31, self._empty_callback)


        cv2.createTrackbar("Min Area", self.params_window, self.default_params["min_area"], 20000, self._empty_callback)
        cv2.createTrackbar("Blur Kernel", self.params_window, self.default_params["blur_kernel"], 51, self._empty_callback)

        cv2.createTrackbar("Dilation", self.params_window, self.default_params["dilation"], 10, self._empty_callback)
        cv2.createTrackbar("Erosion", self.params_window, self.default_params["erosion"], 10, self._empty_callback)

        cv2.createTrackbar("ROI Size %", self.params_window, self.default_params["roi_size"], 100, self._empty_callback)

        cv2.createTrackbar("Target FPS", self.params_window, self.target_fps, 60, self._empty_callback)
        cv2.createTrackbar("Proc Time Limit", self.params_window, self.processing_time_threshold, 200, self._empty_callback)

    @staticmethod
    def _empty_callback(_a):
        pass

    def get_trackbar_values(self):

        mask_thresh = cv2.getTrackbarPos("Mask Thresh (0=OTSU)", self.params_window)

        open_k = cv2.getTrackbarPos("Open K", self.params_window)
        if open_k % 2 == 0:
            open_k += 1
        open_k = max(1, open_k)

        close_k = cv2.getTrackbarPos("Close K", self.params_window)
        if close_k % 2 == 0:
            close_k += 1
        close_k = max(1, close_k)

        # Calibration
        calibration_x1000 = max(1, cv2.getTrackbarPos("Calibration x1000", self.params_window))
        mm_per_pixel = calibration_x1000 / 1000.0

        # Blur kernel must be odd and >= 1
        blur_kernel = cv2.getTrackbarPos("Blur Kernel", self.params_window)
        blur_kernel = max(1, blur_kernel)
        if blur_kernel % 2 == 0:
            blur_kernel += 1

        roi_size = max(10, cv2.getTrackbarPos("ROI Size %", self.params_window))
        target_fps = max(5, cv2.getTrackbarPos("Target FPS", self.params_window))
        proc_time_limit = max(10, cv2.getTrackbarPos("Proc Time Limit", self.params_window))

        # Brightness trackbar 0..200 -> -100..+100
        brightness = cv2.getTrackbarPos("Brightness", self.params_window) - 100
        contrast = cv2.getTrackbarPos("Contrast", self.params_window)  # 0..200 (100 neutral)

        return {
            "edge_thickness": max(1, cv2.getTrackbarPos("Edge Thickness", self.params_window)),
            "threshold1": cv2.getTrackbarPos("Threshold1", self.params_window),
            "threshold2": cv2.getTrackbarPos("Threshold2", self.params_window),
            "min_area": cv2.getTrackbarPos("Min Area", self.params_window),
            "blur_kernel": blur_kernel,
            "dilation": cv2.getTrackbarPos("Dilation", self.params_window),
            "erosion": cv2.getTrackbarPos("Erosion", self.params_window),
            "roi_size": roi_size,
            "target_fps": target_fps,
            "proc_time_limit": proc_time_limit,
            "brightness": brightness,
            "contrast": contrast,
            "mm_per_pixel": mm_per_pixel,
            'mask_thresh': mask_thresh,
            'open_k': open_k,
            'close_k': close_k,
        }

    # ---------- Geometry / Drawing ----------

    def calculate_roi(self, frame_shape, roi_size_percent):
        h, w = frame_shape[:2]
        square = int(h * (roi_size_percent / 100.0))
        square = min(square, w)

        cx, cy = w // 2, h // 2
        x = cx - square // 2
        y = cy - square // 2

        x = max(0, min(x, w - square))
        y = max(0, min(y, h - square))
        return (x, y, square, square)

    def draw_crosshair(self, img, color=(128, 128, 128), thickness=1, alpha=0.45):
        h, w = img.shape[:2]
        cx, cy = w // 2, h // 2
        overlay = img.copy()
        cv2.line(overlay, (0, cy), (w, cy), color, thickness, cv2.LINE_AA)
        cv2.line(overlay, (cx, 0), (cx, h), color, thickness, cv2.LINE_AA)
        cv2.addWeighted(overlay, alpha, img, 1 - alpha, 0, img)
        return img

    def adjust_brightness_contrast(self, img, brightness=0, contrast=100):
        # contrast 100 => alpha 1.0
        alpha = contrast / 100.0
        beta = brightness
        return cv2.convertScaleAbs(img, alpha=alpha, beta=beta)

    # ---------- Measurement ----------

    def measure_wood_dimensions(self, contour, mm_per_pixel):
        x, y, w, h = cv2.boundingRect(contour)

        rect = cv2.minAreaRect(contour)
        box = cv2.boxPoints(rect)
        box = np.int0(box)

        rw, rh = rect[1][0], rect[1][1]
        if rw < rh:
            rw, rh = rh, rw

        width_px = float(w)
        height_px = float(h)

        width_mm = width_px * mm_per_pixel
        height_mm = height_px * mm_per_pixel
        rect_width_mm = rw * mm_per_pixel
        rect_height_mm = rh * mm_per_pixel

        mid = {
            "left": (x, y + h // 2),
            "right": (x + w, y + h // 2),
            "top": (x + w // 2, y),
            "bottom": (x + w // 2, y + h),
        }

        corners = {
            "top_left": (x, y),
            "top_right": (x + w, y),
            "bottom_left": (x, y + h),
            "bottom_right": (x + w, y + h),
        }

        return {
            "bbox": (x, y, w, h),
            "rotated_box": box,
            "width_px": width_px,
            "height_px": height_px,
            "width_mm": width_mm,
            "height_mm": height_mm,
            "rect_width_mm": rect_width_mm,
            "rect_height_mm": rect_height_mm,
            "angle": rect[2],
            "midpoints": mid,
            "corners": corners,
        }

    def draw_measurements(self, img, measurements):
        if not self.show_measurements:
            return img

        x, y, w, h = measurements["bbox"]
        cv2.rectangle(img, (x, y), (x + w, y + h), (0, 255, 0), 2)

        mp = measurements["midpoints"]
        cv2.line(img, mp["left"], mp["right"], (255, 255, 255), 2)
        cv2.line(img, mp["top"], mp["bottom"], (255, 255, 255), 2)

        corners = measurements["corners"]
        cv2.circle(img, corners["top_left"], 5, (255, 0, 0), -1)
        cv2.circle(img, corners["top_right"], 5, (0, 255, 0), -1)
        cv2.circle(img, corners["bottom_left"], 5, (0, 0, 255), -1)
        cv2.circle(img, corners["bottom_right"], 5, (255, 255, 0), -1)

        wtxt = f"W: {measurements['width_mm']:.1f}mm ({measurements['width_px']:.0f}px)"
        htxt = f"H: {measurements['height_mm']:.1f}mm ({measurements['height_px']:.0f}px)"
        rtxt = f"Rect: {measurements['rect_width_mm']:.1f}x{measurements['rect_height_mm']:.1f}mm"

        cv2.putText(img, wtxt, (x + 10, y - 30), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
        cv2.putText(img, htxt, (x + w + 10, y + 30), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
        cv2.putText(img, rtxt, (x, y - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)

        return img

    # ---------- Core: Stable Pipeline ----------

    def _largest_component(self, bin_img):
        """
        Keep only the largest connected component in a binary image.
        bin_img: 0/255
        """
        num_labels, labels, stats, _centroids = cv2.connectedComponentsWithStats(bin_img, connectivity=8)
        if num_labels <= 1:
            return bin_img

        # label 0 is background
        areas = stats[1:, cv2.CC_STAT_AREA]
        best = 1 + int(np.argmax(areas))
        out = np.zeros_like(bin_img)
        out[labels == best] = 255
        return out
    
    def _largest_component(self, bin_img):
        """
        Keep only the largest connected component in a binary image.
        bin_img must be 0/255.
        """
        num_labels, labels, stats, _ = cv2.connectedComponentsWithStats(bin_img, connectivity=8)
        if num_labels <= 1:
            return bin_img

        # stats[0] = background, so start from 1
        areas = stats[1:, cv2.CC_STAT_AREA]
        best = 1 + int(np.argmax(areas))

        out = np.zeros_like(bin_img)
        out[labels == best] = 255
        return out


    def process_frame(self, img_bgr, params):
        # ROI in full frame
        roi_x, roi_y, roi_w, roi_h = self.calculate_roi(img_bgr.shape, params["roi_size"])
        self.roi_rect = (roi_x, roi_y, roi_w, roi_h)

        # global brightness/contrast (for display + consistent grayscale)
        img_adj = self.adjust_brightness_contrast(img_bgr, params["brightness"], params["contrast"])
        gray = cv2.cvtColor(img_adj, cv2.COLOR_BGR2GRAY)

        # work ONLY on ROI for stability + speed
        roi_gray = gray[roi_y:roi_y + roi_h, roi_x:roi_x + roi_w]

        # denoise (edge-aware)
        if self.use_bilateral_filter:
            # bilateral: good at suppressing texture while keeping edges
            d = min(params["blur_kernel"], 15)
            roi_dn = cv2.bilateralFilter(roi_gray, d, 50, 50)
        else:
            roi_dn = cv2.GaussianBlur(roi_gray, (params["blur_kernel"], params["blur_kernel"]), 0)

        # optional contrast normalization (helps when wood grain / lighting varies)
        if self.use_clahe:
            clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
            roi_dn = clahe.apply(roi_dn)

        # --- Binarize to solid object ---
        # Try Otsu first (less “salt and pepper” than adaptive in many scenes)
        roi_blur2 = cv2.GaussianBlur(roi_dn, (7, 7), 0)
        _t, roi_bin = cv2.threshold(roi_blur2, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

        # Auto polarity fix: object should be white
        # If mostly white -> invert (means background got selected)
        if (roi_bin > 0).mean() > 0.65:
            roi_bin = cv2.bitwise_not(roi_bin)

        # Morph cleanup to remove grain specks and close holes
        k3 = np.ones((3, 3), np.uint8)
        k5 = np.ones((5, 5), np.uint8)
        roi_bin = cv2.morphologyEx(roi_bin, cv2.MORPH_OPEN, k3, iterations=1)
        roi_bin = cv2.morphologyEx(roi_bin, cv2.MORPH_CLOSE, k5, iterations=2)

        # Keep only the dominant region (THIS is the big noise killer)
        roi_obj = self._largest_component(roi_bin)

        # Optional extra smoothing on the mask boundary
        roi_obj = cv2.morphologyEx(roi_obj, cv2.MORPH_CLOSE, k5, iterations=1)

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

        # Find contours from the SOLID mask (ROI coords), then offset to full image coords
        contours_roi, _ = cv2.findContours(roi_obj, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        contours_full = []
        for c in contours_roi:
            area = cv2.contourArea(c)
            if area < params["min_area"]:
                continue
            c2 = c.copy()
            c2[:, 0, 0] += roi_x
            c2[:, 0, 1] += roi_y
            contours_full.append(c2)

        # If multiple remain, keep largest for stability (dominant contour)
        contours_full.sort(key=cv2.contourArea, reverse=True)
        if len(contours_full) > 1:
            contours_full = contours_full[:1]

        # Visualization image
        img_vis = img_adj.copy()

        # ROI box
        cv2.rectangle(img_vis, (roi_x, roi_y), (roi_x + roi_w, roi_y + roi_h), (0, 255, 255), 2)
        cv2.putText(img_vis, "ROI", (roi_x + 5, roi_y + 25), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 255), 2)

        if self.show_crosshair:
            self.draw_crosshair(img_vis)

        measurements_list = []
        # Draw contour + measurement
        if contours_full:
            cnt = contours_full[0]
            cv2.drawContours(img_vis, [cnt], -1, (255, 0, 255), 3)

            area = int(cv2.contourArea(cnt))
            meas = self.measure_wood_dimensions(cnt, params["mm_per_pixel"])
            measurements_list.append(meas)

            img_vis = self.draw_measurements(img_vis, meas)

            x, y, w, h = meas["bbox"]
            cv2.putText(img_vis, f"A:{area}px", (x, y - 55), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)

        # ROI grayscale view (debug)
        roi_view = cv2.cvtColor(gray, cv2.COLOR_GRAY2BGR)
        cv2.rectangle(roi_view, (roi_x, roi_y), (roi_x + roi_w, roi_y + roi_h), (0, 255, 255), 2)
        if self.show_crosshair:
            self.draw_crosshair(roi_view)

        # Return images for grid display
        return {
            "original": img_adj,
            "roi_view": roi_view,
            "edges": outline_full,              # outline from solid mask
            "mask": solid_mask_full,            # solid region mask
            "contour": img_vis,                 # final visualization
            "count": len(contours_full),
            "roi": self.roi_rect,
            "measurements": measurements_list,
        }

    # ---------- Overlay / Stacking ----------

    def create_info_overlay(self, img, contour_count, params, roi, actual_fps, proc_ms, fps_mode):
        overlay = img.copy()
        cv2.rectangle(overlay, (5, 5), (360, 260), (0, 0, 0), -1)
        img2 = cv2.addWeighted(overlay, 0.3, img, 0.7, 0)

        proc_color = (0, 255, 0) if proc_ms <= params["proc_time_limit"] else (0, 165, 255)

        mode_text = "SNAPSHOT" if self.snapshot_mode else "LIVE"
        filter_text = "Bilateral" if self.use_bilateral_filter else "Gaussian"
        clahe_text = "CLAHE:ON" if self.use_clahe else "CLAHE:OFF"

        lines = [
            (f"Mode: {mode_text}", (0, 255, 255) if self.snapshot_mode else (0, 255, 0)),
            (f"Contours: {contour_count}", (0, 255, 0)),
            (f"FPS: {actual_fps:.1f} / Target: {params['target_fps']} ({fps_mode.upper()})", (0, 255, 0)),
            (f"Proc: {proc_ms:.1f}ms / Limit: {params['proc_time_limit']}ms", proc_color),
            (f"Bright: {params['brightness']}  Contrast: {params['contrast']}", (0, 255, 0)),
            (f"Filter: {filter_text}  {clahe_text}", (0, 255, 0)),
            (f"Min Area: {params['min_area']}", (0, 255, 0)),
            (f"ROI: {roi[2]}x{roi[3]} ({params['roi_size']}%)", (0, 255, 0)),
            (f"Edge Thickness: {params['edge_thickness']}", (0, 255, 0)),
        ]

        y = 25
        for t, c in lines:
            cv2.putText(img2, t, (10, y), cv2.FONT_HERSHEY_SIMPLEX, 0.5, c, 1)
            y += 25

        if self.snapshot_mode:
            h, w = img2.shape[:2]
            banner = "SNAPSHOT MODE - Frame Frozen"
            (tw, th), bl = cv2.getTextSize(banner, cv2.FONT_HERSHEY_SIMPLEX, 1.0, 2)
            x = (w - tw) // 2
            yb = 40
            ov = img2.copy()
            cv2.rectangle(ov, (x - 10, yb - th - 10), (x + tw + 10, yb + bl + 10), (0, 0, 0), -1)
            img2 = cv2.addWeighted(ov, 0.5, img2, 0.5, 0)
            cv2.putText(img2, banner, (x, yb), cv2.FONT_HERSHEY_SIMPLEX, 1.0, (0, 255, 255), 2)

        return img2

    def stack_images(self, scale, grid):
        rows = len(grid)
        cols = len(grid[0])
        base_h, base_w = grid[0][0].shape[:2]

        out_rows = []
        for r in range(rows):
            row_imgs = []
            for c in range(cols):
                im = grid[r][c]
                if len(im.shape) == 2:
                    im = cv2.cvtColor(im, cv2.COLOR_GRAY2BGR)
                if im.shape[:2] != (base_h, base_w):
                    im = cv2.resize(im, (base_w, base_h))
                im = cv2.resize(im, (0, 0), fx=scale, fy=scale)
                row_imgs.append(im)
            out_rows.append(np.hstack(row_imgs))
        return np.vstack(out_rows)

    # ---------- Main Loop ----------

    def run(self):
        cap = cv2.VideoCapture(self.camera_index)
        if not cap.isOpened():
            print(f"Error: Cannot open camera {self.camera_index}")
            return

        self.setup_trackbars()

        print("Contour Detection Pipeline Started")
        print("SPACE = snapshot | ESC = live | q = quit")
        print("c = crosshair | b = bilateral/gaussian | h = CLAHE on/off")
        print("1 = 2x2 view | 2 = 2x3 view | 3 = main only")
        print("NOTE: Measurement now uses SOLID MASK in ROI (stable).")

        display_mode = 1
        prev_tick = cv2.getTickCount()

        while True:
            start = cv2.getTickCount()

            if self.snapshot_mode and self.snapshot_frame is not None:
                frame = self.snapshot_frame.copy()
            else:
                ok, frame = cap.read()
                if not ok:
                    print("Error: Failed to read frame")
                    break

            now = cv2.getTickCount()
            dt = (now - prev_tick) / cv2.getTickFrequency()
            actual_fps = (1.0 / dt) if dt > 0 else 0
            prev_tick = now

            params = self.get_trackbar_values()

            # manual fps update
            if params["target_fps"] != self.target_fps:
                self.target_fps = params["target_fps"]

            results = self.process_frame(frame, params)

            end = cv2.getTickCount()
            proc_ms = (end - start) / cv2.getTickFrequency() * 1000.0

            results["contour"] = self.create_info_overlay(
                results["contour"],
                results["count"],
                params,
                results["roi"],
                actual_fps,
                proc_ms,
                self.fps_mode
            )

            if display_mode == 1:
                # 2x2: Original | ROI view | Edges(Outline) | Result
                img_stack = self.stack_images(0.5, [
                    [results["original"], results["roi_view"]],
                    [results["edges"], results["contour"]],
                ])
            elif display_mode == 2:
                # 2x3: Original | ROI | Mask | Edges | (blank) | Result
                blank = np.zeros_like(cv2.cvtColor(results["edges"], cv2.COLOR_GRAY2BGR))
                img_stack = self.stack_images(0.4, [
                    [results["original"], results["roi_view"], results["mask"]],
                    [results["edges"], blank, results["contour"]],
                ])
            else:
                img_stack = results["contour"]

            cv2.imshow(self.window_name, img_stack)

            # fps pacing
            target_frame_time = 1.0 / max(5, self.target_fps)
            proc_time = (cv2.getTickCount() - start) / cv2.getTickFrequency()
            wait_ms = max(1, int((target_frame_time - proc_time) * 1000))

            key = cv2.waitKey(wait_ms) & 0xFF
            if key == ord("q"):
                break
            elif key == 32:  # SPACE
                if not self.snapshot_mode:
                    self.snapshot_frame = frame.copy()
                    self.snapshot_mode = True
                    print("SNAPSHOT MODE ON")
                else:
                    ok2, fresh = cap.read()
                    if ok2:
                        self.snapshot_frame = fresh.copy()
                        print("SNAPSHOT UPDATED")
            elif key == 27:  # ESC
                self.snapshot_mode = False
                self.snapshot_frame = None
                print("LIVE MODE ON")
            elif key == ord("c"):
                self.show_crosshair = not self.show_crosshair
                print(f"Crosshair: {'ON' if self.show_crosshair else 'OFF'}")
            elif key == ord("b"):
                self.use_bilateral_filter = not self.use_bilateral_filter
                print(f"Filter: {'Bilateral' if self.use_bilateral_filter else 'Gaussian'}")
            elif key == ord("h"):
                self.use_clahe = not self.use_clahe
                print(f"CLAHE: {'ON' if self.use_clahe else 'OFF'}")
            elif key == ord("1"):
                display_mode = 1
                print("Display: 2x2")
            elif key == ord("2"):
                display_mode = 2
                print("Display: 2x3")
            elif key == ord("3"):
                display_mode = 3
                print("Display: main only")

            self.frame_count += 1

        cap.release()
        cv2.destroyAllWindows()
        print(f"Processed {self.frame_count} frames")


def main():
    pipeline = ContourDetectionPipeline(camera_index=0)
    pipeline.run()


if __name__ == "__main__":
    main()
