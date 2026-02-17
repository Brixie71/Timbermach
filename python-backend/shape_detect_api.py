# python-backend/shape_detect_api.py
import os
import base64
import importlib.util
from typing import Dict, Any, Optional, Tuple

import cv2
import numpy as np


def _load_shape_detect_module():
    """Load shape-detect.py (hyphenated filename) as a Python module."""
    here = os.path.dirname(os.path.abspath(__file__))
    path = os.path.join(here, "shape-detect.py")

    spec = importlib.util.spec_from_file_location("shape_detect_module", path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Failed to load spec for {path}")

    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


_SHAPE_MOD = _load_shape_detect_module()
ContourDetectionPipeline = _SHAPE_MOD.ContourDetectionPipeline


DEFAULT_PARAMS = {
    "threshold1": 52,
    "threshold2": 104,
    "mask_thresh": 0,      # 0=Otsu, >0 manual threshold
    "open_k": 3,           # must be odd
    "close_k": 5,          # must be odd
    "min_area": 1000,
    "blur_kernel": 21,     # must be odd
    "dilation": 1,
    "erosion": 1,
    "roi_size": 60,        # %
    "roi_shape": 1,        # 0=rectangle, 1=square
    "brightness": 0,       # -100..100
    "contrast": 101,       # 0..200 (100 = neutral)
    "mm_per_pixel": 0.1288,   # default calibration (overridden per test)
    "edge_thickness": 2,
}

TEST_TYPE_DEFAULTS = {
    "flexure": {"mm_per_pixel": 0.1568, "roi_size": 70},
    "compressive": {"mm_per_pixel": 0.1288, "roi_size": 65},
    "shear": {"mm_per_pixel": 0.1288, "roi_size": 65},
}


def _ensure_odd(k: int) -> int:
    k = max(1, int(k))
    return k if (k % 2 == 1) else k + 1


def _roi_shape_flag(raw_value, test_type: Optional[str] = None, sub_type: Optional[str] = None) -> int:
    """
    Convert ROI shape to the numeric flag expected by shape-detect.py.
    0 = rectangle, 1 = square.
    """
    if isinstance(raw_value, bool):
        return 1 if raw_value else 0
    if isinstance(raw_value, (int, float)):
        return 1 if int(raw_value) == 1 else 0

    text = str(raw_value or "").strip().lower()
    if text in ("square", "sq", "1", "true"):
        return 1
    if text in ("rectangle", "rect", "0", "false"):
        return 0

    t = str(test_type or "").lower()
    s = str(sub_type or "").lower()
    if t == "compressive" and s == "perpendicular":
        return 0
    return 1


def _roi_shape_label(flag: int) -> str:
    return "square" if int(flag) == 1 else "rectangle"


def run_shape_detect(
    bgr_image: np.ndarray,
    params: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Run contour pipeline once and return measurement + overlay image.
    Compatible with python-backend/shape-detect.py outputs.
    """
    if bgr_image is None or bgr_image.size == 0:
        return {"success": False, "error": "Empty image"}

    p = dict(DEFAULT_PARAMS)
    incoming = {k: v for k, v in (params or {}).items() if v is not None}

    test_type = incoming.get("testType") or incoming.get("test_type")
    sub_type = incoming.get("subType") or incoming.get("sub_type")
    if isinstance(test_type, str):
        preset = TEST_TYPE_DEFAULTS.get(test_type.lower())
        if preset:
            p.update(preset)

    p.update(incoming)

    # Ensure ROI shape matches shape-detect.py (0=rectangle, 1=square)
    roi_shape_raw = incoming.get("roi_shape") or incoming.get("roiShape") or p.get("roi_shape")
    roi_flag = _roi_shape_flag(roi_shape_raw, test_type, sub_type)
    p["roi_shape"] = roi_flag

    # sanitize + clamp
    p["threshold1"] = int(p.get("threshold1", 50))
    p["threshold2"] = int(p.get("threshold2", 150))
    p["mask_thresh"] = int(p.get("mask_thresh", 0))
    p["open_k"] = _ensure_odd(int(p.get("open_k", 3)))
    p["close_k"] = _ensure_odd(int(p.get("close_k", 5)))
    p["min_area"] = int(p.get("min_area", 2000))
    p["blur_kernel"] = _ensure_odd(int(p.get("blur_kernel", 5)))
    p["dilation"] = int(p.get("dilation", 0))
    p["erosion"] = int(p.get("erosion", 0))
    p["roi_size"] = int(p.get("roi_size", 60))
    if p["roi_size"] < 5:
        p["roi_size"] = 5
    p["brightness"] = int(p.get("brightness", 0))
    p["contrast"] = int(p.get("contrast", 100))

    mm_per_pixel = p.get("mm_per_pixel", None)
    if mm_per_pixel is None and p.get("mm_per_pixel_x1000") is not None:
        mm_per_pixel = float(p.get("mm_per_pixel_x1000")) / 1000.0
    if mm_per_pixel is None:
        mm_per_pixel = DEFAULT_PARAMS["mm_per_pixel"]
    p["mm_per_pixel"] = float(mm_per_pixel)
    if p["mm_per_pixel"] <= 0:
        p["mm_per_pixel"] = DEFAULT_PARAMS["mm_per_pixel"]

    p["edge_thickness"] = int(p.get("edge_thickness", 2))

    pipe = ContourDetectionPipeline()
    results = pipe.process_frame(bgr_image, p)

    measurement = results.get("measurements")
    overlay = results.get("output", bgr_image)
    ok, buf = cv2.imencode(".png", overlay)
    overlay_b64 = base64.b64encode(buf).decode("utf-8") if ok else None

    if not measurement:
        return {
            "success": False,
            "error": "No valid contour found",
            "overlayBase64": overlay_b64,
            "paramsUsed": {
                **p,
                "roi_shape_label": _roi_shape_label(p["roi_shape"]),
            },
        }

    bbox = measurement.get("bbox") or (0, 0, 0, 0)
    rot_size_mm = measurement.get("rot_size_mm") or (0.0, 0.0)

    return {
        "success": True,
        "paramsUsed": {
            **p,
            "roi_shape_label": _roi_shape_label(p["roi_shape"]),
        },
        "best": {
            "bbox": [int(v) for v in bbox],
            "width_px": float(measurement.get("width_px", 0)),
            "height_px": float(measurement.get("height_px", 0)),
            "width_mm": float(measurement.get("width_mm", 0)),
            "height_mm": float(measurement.get("height_mm", 0)),
            "rect_width_mm": float(rot_size_mm[0]),
            "rect_height_mm": float(rot_size_mm[1]),
            "angle": float(measurement.get("rot_angle", 0)),
        },
        "overlayBase64": overlay_b64,
    }
