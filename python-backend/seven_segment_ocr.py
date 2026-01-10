"""
seven_segment_ocr.py
Seven-Segment Display Recognition Module with Visual Binary Feedback
Handles both light-on-dark and dark-on-light displays
"""

import json
from typing import Dict, List, Optional, Tuple

import cv2
import numpy as np

# Seven-segment binary mapping (A-B-C-D-E-F-G order)
# Seven-segment binary mapping (A-B-C-D-E-F-G order)
SEGMENT_MAP = {
    "0000000": "",      # blank / off (important for unused digits)
    "1111110": "0",
    "0110000": "1",
    "1101101": "2",
    "1111001": "3",
    "0110011": "4",
    "1011011": "5",
    "1011111": "6",
    "1110000": "7",
    "1111111": "8",
    "1111011": "9",

    # Letters (common 7-seg approximations)
    "0001110": "L",     # D+E+F on  -> "L"
}



class SevenSegmentOCR:
    """Handler for seven-segment display recognition with improved detection"""

    def __init__(self):
        self.calibration = None
        self.detection_method = "smart_adaptive"
        self.has_decimal_point = True
        self.decimal_position = 1

    def set_calibration(
        self,
        display_box: Dict,
        segment_boxes: List[List[Dict]],
        has_decimal_point: bool = True,
        decimal_position: int = 1,
    ):
        """Store calibration data for the display"""
        # Validate segment boxes structure
        for digit_idx, digit_boxes in enumerate(segment_boxes):
            if len(digit_boxes) != 7:
                raise ValueError(
                    f"Digit {digit_idx} has {len(digit_boxes)} segment boxes, expected 7. "
                    f"Each digit must have exactly 7 segments (A, B, C, D, E, F, G)."
                )

        self.has_decimal_point = has_decimal_point
        self.decimal_position = decimal_position
        self.calibration = {
            "display_box": display_box,
            "segment_boxes": segment_boxes,
            "num_digits": len(segment_boxes),
            "has_decimal_point": has_decimal_point,
            "decimal_position": decimal_position,
        }
        self.has_decimal_point = has_decimal_point
        self.decimal_position = decimal_position

    def format_number_with_decimal(self, full_number: str) -> str:
        """Insert decimal point at the specified position"""
        if not self.has_decimal_point:
            return full_number
        if not full_number or "?" in full_number:
            return full_number

        # NEW: don't insert decimal for alphanumeric strings like "L0" / "Lo"
        if not full_number.isdigit():
            return full_number

        if len(full_number) < self.decimal_position:
            return full_number

        insert_pos = len(full_number) - self.decimal_position
        formatted = full_number[:insert_pos] + "." + full_number[insert_pos:]
        return formatted


    def load_calibration(self, calibration_json: str) -> bool:
        """Load calibration from JSON string"""
        try:
            self.calibration = json.loads(calibration_json)
            return True
        except Exception as e:
            print(f"Error loading calibration: {e}")
            return False

    def save_calibration(self) -> str:
        """Save calibration to JSON string"""
        if self.calibration is None:
            return None
        return json.dumps(self.calibration)

    def scale_boxes_to_image(self, image: np.ndarray, calibration: Dict) -> Dict:
        """
        Scale calibration boxes to match current image dimensions.
        Converts from calibration image size to current image size.
        """
        if "calibration_image_size" not in calibration:
            # If no original size stored, assume boxes are already correct
            return calibration

        calib_width = calibration["calibration_image_size"]["width"]
        calib_height = calibration["calibration_image_size"]["height"]

        current_height, current_width = image.shape[:2]

        scale_x = current_width / calib_width
        scale_y = current_height / calib_height

        # Scale display box
        scaled_display_box = {
            "x": calibration["display_box"]["x"] * scale_x,
            "y": calibration["display_box"]["y"] * scale_y,
            "width": calibration["display_box"]["width"] * scale_x,
            "height": calibration["display_box"]["height"] * scale_y,
        }

        # Scale segment boxes
        scaled_segment_boxes = []
        for digit_boxes in calibration["segment_boxes"]:
            scaled_digit = []
            for box in digit_boxes:
                scaled_digit.append(
                    {
                        "x": box["x"] * scale_x,
                        "y": box["y"] * scale_y,
                        "width": box["width"] * scale_x,
                        "height": box["height"] * scale_y,
                    }
                )
            scaled_segment_boxes.append(scaled_digit)

        # Return scaled calibration
        scaled_calibration = calibration.copy()
        scaled_calibration["display_box"] = scaled_display_box
        scaled_calibration["segment_boxes"] = scaled_segment_boxes

        return scaled_calibration

    def extract_display_region(
        self, image: np.ndarray, display_box: Dict
    ) -> np.ndarray:
        """Extract the display region from the image"""
        x = int(display_box["x"])
        y = int(display_box["y"])
        w = int(display_box["width"])
        h = int(display_box["height"])

        return image[y : y + h, x : x + w]

    def preprocess_image(self, image: np.ndarray) -> np.ndarray:
        """Preprocess image for segment detection"""
        if len(image.shape) == 3:
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        else:
            gray = image.copy()

        # Apply CLAHE for better contrast
        clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
        enhanced = clahe.apply(gray)

        # Apply bilateral filter
        denoised = cv2.bilateralFilter(enhanced, 9, 75, 75)

        # Increase contrast
        denoised = cv2.convertScaleAbs(denoised, alpha=1.5, beta=0)

        return denoised

    def detect_display_inversion(self, gray_image: np.ndarray) -> bool:
        """
        Detect if display is light-on-dark or dark-on-light
        Returns True if display is inverted (dark digits on light background)
        """
        mean_brightness = np.mean(gray_image)
        return mean_brightness > 127

    def detect_segment_simple_threshold(
        self, gray_roi: np.ndarray, is_inverted: bool = False
    ) -> Tuple[bool, Dict]:
        """
        SIMPLE THRESHOLD method: Uses mean brightness with thresholds

        For inverted (dark on light): WHITE segments on display
          - Mean > 128 = ON (segment is WHITE/bright)
          - Mean < 128 = OFF (segment is BLACK/dark or background)

        For normal (light on dark): Not typically used
          - Mean > 128 = ON (segment is bright)
          - Mean < 128 = OFF (segment is dark)

        Args:
            gray_roi: Grayscale segment region
            is_inverted: True if display is dark-on-light

        Returns:
            Tuple of (is_on, debug_info)
        """
        if gray_roi.size == 0:
            return False, {"error": "Empty ROI"}

        # Calculate statistics
        mean_brightness = float(np.mean(gray_roi))
        median_brightness = float(np.median(gray_roi))
        min_val = float(np.min(gray_roi))
        max_val = float(np.max(gray_roi))

        # FIXED THRESHOLD LOGIC
        # For your display: WHITE segments = ON, BLACK background = OFF
        BRIGHTNESS_THRESHOLD = 128

        if is_inverted:
            # Your case: Dark digits on light background
            # BUT the segments themselves are WHITE (lit up)
            # So we want: HIGH brightness = segment is ON (white)
            is_on = mean_brightness > BRIGHTNESS_THRESHOLD
        else:
            # Normal LED: Light digits on dark background
            is_on = mean_brightness > BRIGHTNESS_THRESHOLD

        debug_info = {
            "method": "simple_threshold",
            "is_inverted": is_inverted,
            "mean_brightness": mean_brightness,
            "median_brightness": median_brightness,
            "min_brightness": min_val,
            "max_brightness": max_val,
            "threshold": BRIGHTNESS_THRESHOLD,
            "is_on": is_on,
        }

        return is_on, debug_info

    def detect_segment_state_smart_adaptive(
        self, gray_roi: np.ndarray, is_inverted: bool = False
    ) -> Tuple[bool, Dict]:
        """
        SMART ADAPTIVE method: Uses percentile-based analysis
        More robust than simple threshold
        """
        if gray_roi.size == 0:
            return False, {"error": "Empty ROI"}

        # Calculate statistics
        mean_brightness = float(np.mean(gray_roi))
        median_brightness = float(np.median(gray_roi))
        min_val = float(np.min(gray_roi))
        max_val = float(np.max(gray_roi))

        # Calculate percentiles
        p10 = float(np.percentile(gray_roi, 10))
        p25 = float(np.percentile(gray_roi, 25))
        p75 = float(np.percentile(gray_roi, 75))
        p90 = float(np.percentile(gray_roi, 90))

        # Calculate contrast
        contrast = p90 - p10

        if is_inverted:
            # Dark digits on light background
            dark_pixels = gray_roi[gray_roi < p25]
            mean_dark = float(np.mean(dark_pixels)) if len(dark_pixels) > 0 else min_val

            is_on = (
                contrast > 30
                and mean_dark < median_brightness - 15
                and mean_brightness < 150
            )
        else:
            # Light digits on dark background
            bright_pixels = gray_roi[gray_roi > p75]
            mean_bright = (
                float(np.mean(bright_pixels)) if len(bright_pixels) > 0 else max_val
            )

            is_on = (
                contrast > 30
                and mean_bright > median_brightness + 15
                and mean_brightness > 80
            )

        debug_info = {
            "method": "smart_adaptive",
            "is_inverted": is_inverted,
            "mean_brightness": mean_brightness,
            "median_brightness": median_brightness,
            "min_brightness": min_val,
            "max_brightness": max_val,
            "p10": p10,
            "p25": p25,
            "p75": p75,
            "p90": p90,
            "contrast": contrast,
            "is_on": is_on,
        }

        return is_on, debug_info

    def check_segment_active(
        self,
        image: np.ndarray,
        segment_box: Dict,
        display_box: Dict,
        is_inverted: bool = False,
        method: str = None,
    ) -> Tuple[bool, Dict]:
        """Check if a segment is active"""
        if method is None:
            method = self.detection_method

        # Adjust coordinates relative to display ROI
        x = int(segment_box["x"] - display_box["x"])
        y = int(segment_box["y"] - display_box["y"])
        w = int(segment_box["width"])
        h = int(segment_box["height"])

        # Ensure coordinates are within bounds
        x = max(0, min(x, image.shape[1] - 1))
        y = max(0, min(y, image.shape[0] - 1))
        w = max(1, min(w, image.shape[1] - x))
        h = max(1, min(h, image.shape[0] - y))

        # Extract segment region
        segment_roi = image[y : y + h, x : x + w]

        # Choose detection method
        if method == "simple_threshold":
            return self.detect_segment_simple_threshold(segment_roi, is_inverted)
        elif method == "smart_adaptive":
            return self.detect_segment_state_smart_adaptive(segment_roi, is_inverted)
        else:
            # Default to simple threshold
            return self.detect_segment_simple_threshold(segment_roi, is_inverted)

    def recognize_digit(
        self,
        image: np.ndarray,
        segment_boxes: List[Dict],
        display_box: Dict,
        is_inverted: bool = False,
        method: str = None,
    ) -> Tuple[str, str, List[bool], List[Dict]]:
        """Recognize a single digit from segment boxes"""
        if len(segment_boxes) != 7:
            raise ValueError(
                f"Expected 7 segment boxes (A, B, C, D, E, F, G), but got {len(segment_boxes)} boxes. "
                f"Please recalibrate the seven-segment display to include all 7 segments per digit."
            )

        # Check each segment
        segment_states = []
        debug_info_list = []

        for box in segment_boxes:
            is_on, debug_info = self.check_segment_active(
                image, box, display_box, is_inverted, method
            )
            segment_states.append(is_on)
            debug_info_list.append(debug_info)

        # Convert to binary string
        binary_string = "".join(["1" if state else "0" for state in segment_states])

        # Lookup digit
        digit = SEGMENT_MAP.get(binary_string, "?")

        return digit, binary_string, segment_states, debug_info_list

    def recognize_display(self, image: np.ndarray, debug: bool = False) -> Dict:
        """Recognize full display using calibration"""
        if self.calibration is None:
            raise ValueError("No calibration data loaded. Please calibrate first.")

        # Validate calibration has correct structure
        if "segment_boxes" not in self.calibration:
            raise ValueError("Invalid calibration: missing segment_boxes")

        # Validate each digit has exactly 7 segments
        for digit_idx, digit_boxes in enumerate(self.calibration["segment_boxes"]):
            if len(digit_boxes) != 7:
                raise ValueError(
                    f"Digit {digit_idx} has {len(digit_boxes)} segment boxes, expected 7. "
                    f"Please recalibrate in Settings > Moisture Settings."
                )

        # Scale calibration to match current image size
        scaled_calibration = self.scale_boxes_to_image(image, self.calibration)

        # Extract display region
        display_region = self.extract_display_region(
            image, scaled_calibration["display_box"]
        )

        # Preprocess (returns grayscale)
        gray_image = self.preprocess_image(display_region)

        # Detect if display is inverted
        is_inverted = self.detect_display_inversion(gray_image)

        # Recognize each digit
        results = []
        all_debug_info = []

        for digit_idx, segment_boxes in enumerate(scaled_calibration["segment_boxes"]):
            digit, binary, states, segment_debug = self.recognize_digit(
                gray_image,
                segment_boxes,
                scaled_calibration["display_box"],
                is_inverted=is_inverted,
                method=self.detection_method,
            )

            digit_result = {
                "digit_index": digit_idx,
                "recognized_digit": digit,
                "binary_code": binary,
                "segment_states": states,
                "segments": {
                    "A": states[0],
                    "B": states[1],
                    "C": states[2],
                    "D": states[3],
                    "E": states[4],
                    "F": states[5],
                    "G": states[6],
                },
            }

            results.append(digit_result)

            if debug:
                all_debug_info.append(
                    {"digit_index": digit_idx, "segments": segment_debug}
                )

        # Combine digits into full number (keep blanks as "")
        chars = [r["recognized_digit"] for r in results]

        # NEW: strip leading/trailing blanks (so unused digits don't become "??" or weird)
        while chars and chars[0] == "":
            chars.pop(0)
        while chars and chars[-1] == "":
            chars.pop()

        raw_number = "".join(chars)

        # ✅ NEW: if it starts with L, treat it as "Lo" even if other char is unknown
        # examples: "L?", "L0", "Lo", "L" -> "Lo"
        if raw_number and raw_number[0] == "L":
            display_text = "Lo"
        else:
            display_text = raw_number

        # NEW: special case for moisture meter "Lo"
        # Many meters show "Lo" but the second character looks like "0"
        # So OCR likely sees "L0"
        display_text = raw_number
        if raw_number in ("L0", "L00", "L000", "L"):
            display_text = "Lo"

        # Format decimals ONLY if numeric
        formatted_number = self.format_number_with_decimal(display_text)


        response = {
            "success": True,
            "full_number": formatted_number,
            "raw_number": raw_number,
            "mode": "LOW" if display_text == "Lo" else "NUMERIC",
            "is_valid": "?" not in raw_number,  # keep this for debugging
            "digits": results,
        }


        if debug:
            response["debug_info"] = {
                "detection_method": self.detection_method,
                "display_is_inverted": is_inverted,
                "display_mean_brightness": float(np.mean(gray_image)),
                "display_std_dev": float(np.std(gray_image)),
                "digits_debug": all_debug_info,
            }

        return response

    def visualize_segments_with_binary(self, image: np.ndarray) -> np.ndarray:
        """
        Draw segment boxes with binary state (0/1) visualization
        GREEN box + "1" = Segment ON
        RED box + "0" = Segment OFF
        """
        if self.calibration is None:
            return image

        vis_image = image.copy()

        # Scale calibration to match current image size
        scaled_calibration = self.scale_boxes_to_image(image, self.calibration)

        # Extract and preprocess display region
        display_region = self.extract_display_region(
            image, scaled_calibration["display_box"]
        )
        gray_image = self.preprocess_image(display_region)
        is_inverted = self.detect_display_inversion(gray_image)

        # Draw display box (cyan)
        db = scaled_calibration["display_box"]
        cv2.rectangle(
            vis_image,
            (int(db["x"]), int(db["y"])),
            (int(db["x"] + db["width"]), int(db["y"] + db["height"])),
            (255, 255, 0),  # Cyan
            2,
        )

        # Add display info
        cv2.putText(
            vis_image,
            f"Display: {'INVERTED (dark on light)' if is_inverted else 'NORMAL (light on dark)'}",
            (int(db["x"]), int(db["y"]) - 10),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.5,
            (255, 255, 0),
            2,
        )

        segment_labels = ["A", "B", "C", "D", "E", "F", "G"]

        for digit_idx, segment_boxes in enumerate(scaled_calibration["segment_boxes"]):
            # Recognize this digit to get segment states
            _, binary, states, debug_info = self.recognize_digit(
                gray_image,
                segment_boxes,
                scaled_calibration["display_box"],
                is_inverted=is_inverted,
                method=self.detection_method,
            )

            for seg_idx, box in enumerate(segment_boxes):
                x, y, w, h = (
                    int(box["x"]),
                    int(box["y"]),
                    int(box["width"]),
                    int(box["height"]),
                )

                is_on = states[seg_idx]
                mean_brightness = debug_info[seg_idx].get("mean_brightness", 0)

                # Color: GREEN if ON (1), RED if OFF (0)
                color = (0, 255, 0) if is_on else (0, 0, 255)

                # Draw rectangle
                cv2.rectangle(vis_image, (x, y), (x + w, y + h), color, 2)

                # Draw binary state (0 or 1)
                binary_text = "1" if is_on else "0"
                cv2.putText(
                    vis_image,
                    binary_text,
                    (x + w // 2 - 8, y + h // 2 + 8),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.7,
                    (255, 255, 255),  # White text
                    2,
                )

                # Draw segment label and brightness
                label = f"D{digit_idx + 1}{segment_labels[seg_idx]}"
                cv2.putText(
                    vis_image,
                    label,
                    (x + 2, y - 2),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.35,
                    color,
                    1,
                )

                # Draw mean brightness value
                brightness_text = f"{int(mean_brightness)}"
                cv2.putText(
                    vis_image,
                    brightness_text,
                    (x + 2, y + h - 2),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.35,
                    (255, 255, 255),
                    1,
                )

        return vis_image

    def visualize_segments(
        self, image: np.ndarray, save_path: str = None
    ) -> np.ndarray:
        """Draw segment boxes on the image for visualization"""
        return self.visualize_segments_with_binary(image)


def create_default_segment_boxes(
    display_box: Dict, num_digits: int = 3
) -> List[List[Dict]]:
    """Create default segment boxes based on display box"""
    digit_boxes = []

    display_width = display_box["width"]
    display_height = display_box["height"]
    digit_width = display_width / num_digits

    for digit_idx in range(num_digits):
        digit_x = display_box["x"] + (digit_idx * digit_width)
        digit_y = display_box["y"]

        # Smaller boxes to avoid overlap
        segment_templates = [
            (0.25, 0.05, 0.5, 0.08),  # A - Top
            (0.72, 0.12, 0.15, 0.32),  # B - Top-right
            (0.72, 0.56, 0.15, 0.32),  # C - Bottom-right
            (0.25, 0.87, 0.5, 0.08),  # D - Bottom
            (0.13, 0.56, 0.15, 0.32),  # E - Bottom-left
            (0.13, 0.12, 0.15, 0.32),  # F - Top-left
            (0.25, 0.46, 0.5, 0.08),  # G - Middle
        ]

        segments = []
        for x_ratio, y_ratio, w_ratio, h_ratio in segment_templates:
            segments.append(
                {
                    "x": digit_x + (x_ratio * digit_width),
                    "y": digit_y + (y_ratio * display_height),
                    "width": w_ratio * digit_width,
                    "height": h_ratio * display_height,
                }
            )

        digit_boxes.append(segments)

    return digit_boxes
