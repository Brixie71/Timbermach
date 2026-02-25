// Central place for measurement (shape-detect) defaults and persistence.
// Shared by Measurement test UI and the Settings screen.

export const MEASUREMENT_DEFAULT_PARAMS = {
  threshold1: 52,
  threshold2: 104,
  mask_thresh: 0, // 0 = Otsu
  open_k: 3, // odd
  close_k: 5, // odd
  min_area: 1000,
  blur_kernel: 21, // odd
  dilation: 1,
  erosion: 1,
  roi_size: 60,
  roi_shape: "square", // "square" | "rectangle"
  brightness: 0, // -100..100
  contrast: 101, // 0..200 (100 neutral)
  mm_per_pixel: 0.1288,
  edge_thickness: 2,
  denoise_enabled: true,
  denoise_h: 6,
  denoise_template: 7, // odd
  denoise_search: 21, // odd
};

export const MEASUREMENT_PRESETS_DEFAULT = {
  flexure: { mm_per_pixel: 0.1568, roi_size: 70 },
  compressive: { mm_per_pixel: 0.1288, roi_size: 65 },
  shear: { mm_per_pixel: 0.1288, roi_size: 65 },
};

const STORAGE_KEY = "timbermach:measurement-settings:v1";

const ensureNumber = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const ensureOdd = (value, min = 1) => {
  let n = Math.max(min, Math.round(ensureNumber(value, min)));
  if (n % 2 === 0) n += 1;
  return n;
};

export const sanitizeMeasurementParams = (params = {}) => {
  const merged = { ...MEASUREMENT_DEFAULT_PARAMS, ...(params || {}) };

  merged.threshold1 = Math.max(0, Math.round(ensureNumber(merged.threshold1, 52)));
  merged.threshold2 = Math.max(0, Math.round(ensureNumber(merged.threshold2, 104)));
  merged.mask_thresh = Math.max(0, Math.round(ensureNumber(merged.mask_thresh, 0)));
  merged.open_k = ensureOdd(merged.open_k, 1);
  merged.close_k = ensureOdd(merged.close_k, 1);
  merged.min_area = Math.max(0, Math.round(ensureNumber(merged.min_area, 1000)));
  merged.blur_kernel = ensureOdd(merged.blur_kernel, 1);
  merged.dilation = Math.max(0, Math.round(ensureNumber(merged.dilation, 0)));
  merged.erosion = Math.max(0, Math.round(ensureNumber(merged.erosion, 0)));
  merged.roi_size = Math.max(5, Math.min(100, Math.round(ensureNumber(merged.roi_size, 60))));

  const roiShapeText = String(merged.roi_shape || "").toLowerCase();
  merged.roi_shape =
    roiShapeText === "rectangle" || roiShapeText === "rect" || roiShapeText === "0"
      ? "rectangle"
      : "square";

  merged.brightness = Math.max(-100, Math.min(100, Math.round(ensureNumber(merged.brightness, 0))));
  merged.contrast = Math.max(0, Math.min(200, Math.round(ensureNumber(merged.contrast, 101))));
  merged.mm_per_pixel = Math.max(0.0001, ensureNumber(merged.mm_per_pixel, MEASUREMENT_DEFAULT_PARAMS.mm_per_pixel));
  merged.edge_thickness = Math.max(1, Math.round(ensureNumber(merged.edge_thickness, 2)));

  merged.denoise_enabled = Boolean(merged.denoise_enabled);
  merged.denoise_h = Math.max(1, Math.round(ensureNumber(merged.denoise_h, MEASUREMENT_DEFAULT_PARAMS.denoise_h)));
  merged.denoise_template = ensureOdd(merged.denoise_template, MEASUREMENT_DEFAULT_PARAMS.denoise_template);
  merged.denoise_search = ensureOdd(merged.denoise_search, MEASUREMENT_DEFAULT_PARAMS.denoise_search);

  return merged;
};

export const loadMeasurementSettings = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {
        params: { ...MEASUREMENT_DEFAULT_PARAMS },
        presets: { ...MEASUREMENT_PRESETS_DEFAULT },
        source: "default",
      };
    }

    const parsed = JSON.parse(raw);
    const paramsSource = parsed.params || parsed; // backward compatibility
    const presetsSource = parsed.presets || {};

    return {
      params: sanitizeMeasurementParams(paramsSource),
      presets: { ...MEASUREMENT_PRESETS_DEFAULT, ...presetsSource },
      source: "local",
    };
  } catch (e) {
    console.warn("Measurement settings load failed, using defaults", e);
    return {
      params: { ...MEASUREMENT_DEFAULT_PARAMS },
      presets: { ...MEASUREMENT_PRESETS_DEFAULT },
      source: "default",
    };
  }
};

export const saveMeasurementSettings = ({ params, presets }) => {
  const sanitized = sanitizeMeasurementParams(params);
  const mergedPresets = { ...MEASUREMENT_PRESETS_DEFAULT, ...(presets || {}) };

  const payload = {
    params: sanitized,
    presets: mergedPresets,
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (e) {
    console.warn("Failed to persist measurement settings", e);
  }

  return payload;
};

export const resetMeasurementSettings = () => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
  return {
    params: { ...MEASUREMENT_DEFAULT_PARAMS },
    presets: { ...MEASUREMENT_PRESETS_DEFAULT },
  };
};

// ---------------------------------------------------------------------------
// Laravel API helpers (optional). Pass baseUrl like "http://127.0.0.1:8000".
// ---------------------------------------------------------------------------

export const fetchMeasurementSettingsFromApi = async (baseUrl) => {
  if (!baseUrl) throw new Error("Missing baseUrl");

  const res = await fetch(`${baseUrl.replace(/\/+$/, "")}/api/measurement-settings/active`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }

  const data = await res.json();
  const params = sanitizeMeasurementParams(data.params || data);
  const presets = { ...MEASUREMENT_PRESETS_DEFAULT, ...(data.presets || {}) };

  // persist locally as cache
  saveMeasurementSettings({ params, presets });

  return { params, presets, source: data.source || "api" };
};

export const saveMeasurementSettingsToApi = async (baseUrl, { params, presets, profile_name, notes, is_active }) => {
  if (!baseUrl) throw new Error("Missing baseUrl");

  const payload = {
    params: sanitizeMeasurementParams(params),
    presets: { ...MEASUREMENT_PRESETS_DEFAULT, ...(presets || {}) },
    profile_name,
    notes,
    is_active,
  };

  const res = await fetch(`${baseUrl.replace(/\/+$/, "")}/api/measurement-settings`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }

  const data = await res.json();
  const saved = {
    params: sanitizeMeasurementParams(data.params || payload.params),
    presets: { ...MEASUREMENT_PRESETS_DEFAULT, ...(data.presets || payload.presets) },
  };

  // cache locally too
  saveMeasurementSettings(saved);

  return { ...saved, source: "api" };
};

export const loadMeasurementSettingsPreferApi = async (baseUrl) => {
  try {
    return await fetchMeasurementSettingsFromApi(baseUrl);
  } catch (e) {
    console.warn("API measurement settings load failed, using local/default", e);
    return loadMeasurementSettings();
  }
};

// CRUD helpers for profile list
export const listMeasurementSettings = async (baseUrl) => {
  if (!baseUrl) throw new Error("Missing baseUrl");
  const res = await fetch(`${baseUrl.replace(/\/+$/, "")}/api/measurement-settings`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json(); // {success, data:[...]}
};

export const deleteMeasurementSetting = async (baseUrl, id) => {
  const res = await fetch(`${baseUrl.replace(/\/+$/, "")}/api/measurement-settings/${id}`, {
    method: "DELETE",
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
};

export const activateMeasurementSetting = async (baseUrl, id) => {
  const res = await fetch(`${baseUrl.replace(/\/+$/, "")}/api/measurement-settings/${id}/activate`, {
    method: "POST",
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
};

export const updateMeasurementSettingsToApi = async (baseUrl, id, { params, presets, profile_name, notes, is_active }) => {
  if (!baseUrl) throw new Error("Missing baseUrl");
  const payload = {
    params: sanitizeMeasurementParams(params),
    presets: { ...MEASUREMENT_PRESETS_DEFAULT, ...(presets || {}) },
    profile_name,
    notes,
    is_active,
  };
  const res = await fetch(`${baseUrl.replace(/\/+$/, "")}/api/measurement-settings/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  const saved = {
    params: sanitizeMeasurementParams(data.params || payload.params),
    presets: { ...MEASUREMENT_PRESETS_DEFAULT, ...(data.presets || payload.presets) },
  };
  saveMeasurementSettings(saved);
  return { ...saved, source: "api" };
};
