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
    "min_area": 1000,
    "blur_kernel": 21,     # must be odd
    "dilation": 1,
    "erosion": 1,
    "roi_size": 60,        # %
    "roi_shape": "square", # square | rectangle
    "brightness": 0,       # -100..100
    "contrast": 101,       # 0..200
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


def run_shape_detect(
    bgr_image: np.ndarray,
    params: Dict[str, Any]
) -> Dict[str, Any]:
    
    denoise_enabled = bool(params.get("denoise_enabled", True))
    h = int(params.get("denoise_h", 6))
    template = int(params.get("denoise_template", 7))
    search = int(params.get("denoise_search", 21))

    # Ensure odd sizes
    if template % 2 == 0:
        template += 1
    if search % 2 == 0:
        search += 1

    if denoise_enabled:
        gray = cv2.cvtColor(bgr_image, cv2.COLOR_BGR2GRAY)
        gray = cv2.fastNlMeansDenoising(
            gray,
            None,
            h,
            template,
            search
        )
    else:
        gray = cv2.cvtColor(bgr_image, cv2.COLOR_BGR2GRAY)

    """
    Run contour pipeline once and return best contour measurement + overlay image.
    """
    if bgr_image is None or bgr_image.size == 0:
        return {"success": False, "error": "Empty image"}

    p = dict(DEFAULT_PARAMS)
    incoming = {k: v for k, v in (params or {}).items() if v is not None}

    test_type = incoming.get("testType") or incoming.get("test_type")
    if isinstance(test_type, str):
        preset = TEST_TYPE_DEFAULTS.get(test_type.lower())
        if preset:
            p.update(preset)

    p.update(incoming)

    # Default ROI shape by subtype if not provided
    roi_shape = incoming.get("roi_shape") or incoming.get("roiShape")
    if not roi_shape:
        sub_type = incoming.get("subType") or incoming.get("sub_type")
        if isinstance(sub_type, str) and sub_type.lower() == "perpendicular":
            roi_shape = "rectangle"
        else:
            roi_shape = "square"
    p["roi_shape"] = roi_shape

    # sanitize types
    p["threshold1"] = int(p["threshold1"])
    p["threshold2"] = int(p["threshold2"])
    p["min_area"] = int(p["min_area"])
    p["blur_kernel"] = _ensure_odd(int(p["blur_kernel"]))
    p["dilation"] = int(p["dilation"])
    p["erosion"] = int(p["erosion"])
    p["roi_size"] = int(p["roi_size"])
    p["brightness"] = int(p["brightness"])
    p["contrast"] = int(p["contrast"])
    p["mm_per_pixel"] = float(p["mm_per_pixel"])
    p["edge_thickness"] = int(p.get("edge_thickness", 2))
    p["roi_shape"] = str(p.get("roi_shape", "square")).lower()
    if p["roi_shape"] not in ("square", "rectangle"):
        p["roi_shape"] = "square"

    pipe = ContourDetectionPipeline()
    results = pipe.process_frame(bgr_image, p)

    contours = results.get("contours", [])
    measurements = results.get("measurements", [])
    if not contours or not measurements:
        # still return overlay so you can see why it failed
        overlay = results.get("contour", bgr_image)
        _, buf = cv2.imencode(".png", overlay)
        return {
            "success": False,
            "error": "No valid contour found",
            "overlayBase64": base64.b64encode(buf).decode("utf-8"),
            "paramsUsed": p,
        }

    # Choose largest contour by area
    areas = [cv2.contourArea(c) for c in contours]
    best_i = int(np.argmax(areas))
    best_m = measurements[best_i]

    overlay = results.get("contour", bgr_image)
    ok, buf = cv2.imencode(".png", overlay)
    overlay_b64 = base64.b64encode(buf).decode("utf-8") if ok else None

    return {
        "success": True,
        "paramsUsed": p,
        "best": {
            "area_px": float(areas[best_i]),
            "bbox": best_m["bbox"],  # (x,y,w,h)
            "width_px": float(best_m["width_px"]),
            "height_px": float(best_m["height_px"]),
            "width_mm": float(best_m["width_mm"]),
            "height_mm": float(best_m["height_mm"]),
            "rect_width_mm": float(best_m["rect_width_mm"]),
            "rect_height_mm": float(best_m["rect_height_mm"]),
            "angle": float(best_m["angle"]),
        },
        "overlayBase64": overlay_b64,
    }
