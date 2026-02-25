import React, { useEffect, useMemo, useState } from "react";
import { Save, SlidersHorizontal, Sparkles } from "lucide-react";
import {
  MEASUREMENT_DEFAULT_PARAMS,
  MEASUREMENT_PRESETS_DEFAULT,
  loadMeasurementSettings,
  loadMeasurementSettingsPreferApi,
  sanitizeMeasurementParams,
  saveMeasurementSettingsToApi,
  updateMeasurementSettingsToApi,
} from "../../config/measurementSettings";
import { LARAVEL_BASE_URL } from "../../config/servers";

const PARAM_FIELDS = [
  { key: "threshold1", label: "Canny Threshold 1", min: 0, max: 255, step: 1 },
  { key: "threshold2", label: "Canny Threshold 2", min: 0, max: 255, step: 1 },
  { key: "mask_thresh", label: "Mask Threshold (0=Otsu)", min: 0, max: 255, step: 1 },
  { key: "open_k", label: "Open Kernel (odd)", min: 1, max: 31, step: 2 },
  { key: "close_k", label: "Close Kernel (odd)", min: 1, max: 31, step: 2 },
  { key: "min_area", label: "Min Area (px^2)", min: 0, max: 50000, step: 50 },
  { key: "blur_kernel", label: "Blur Kernel (odd)", min: 1, max: 51, step: 2 },
  { key: "dilation", label: "Extra Dilation", min: 0, max: 10, step: 1 },
  { key: "erosion", label: "Extra Erosion", min: 0, max: 10, step: 1 },
  { key: "roi_size", label: "ROI Size (%)", min: 5, max: 100, step: 1 },
  { key: "brightness", label: "Brightness", min: -100, max: 100, step: 1 },
  { key: "contrast", label: "Contrast", min: 0, max: 200, step: 1 },
  { key: "edge_thickness", label: "Edge Thickness", min: 1, max: 10, step: 1 },
  { key: "mm_per_pixel", label: "mm per pixel", min: 0.01, max: 1.0, step: 0.001 },
];

const TEST_LABEL = {
  flexure: "Flexure",
  compressive: "Compressive",
  shear: "Shear",
};

const NumericControl = ({ field, value, onChange }) => {
  const { key, label, min, max, step } = field;
  const safeValue = Number.isFinite(Number(value)) ? Number(value) : "";
  return (
    <label className="flex flex-col gap-2">
      <div className="flex items-center justify-between text-xs text-gray-400">
        <span className="font-semibold">{label}</span>
        <span className="text-[11px] text-gray-500">
          {min} - {max}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={safeValue}
        onChange={(e) => onChange(key, e.target.value)}
        className="w-full accent-blue-400"
      />
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={safeValue}
        onChange={(e) => onChange(key, e.target.value)}
        className="w-full rounded-lg border border-gray-800 bg-gray-950 px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
      />
    </label>
  );
};

const MeasurementSettingsDetail = ({ onBack, initialProfile }) => {
  const [params, setParams] = useState({ ...MEASUREMENT_DEFAULT_PARAMS });
  const [presets, setPresets] = useState({ ...MEASUREMENT_PRESETS_DEFAULT });
  const [profileName, setProfileName] = useState("");
  const [notes, setNotes] = useState("");
  const [setActiveOnSave, setSetActiveOnSave] = useState(true);
  const [status, setStatus] = useState("");
  const [source, setSource] = useState("default");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (initialProfile) {
          setParams(sanitizeMeasurementParams(initialProfile.params || {}));
          setPresets({ ...MEASUREMENT_PRESETS_DEFAULT, ...(initialProfile.presets || {}) });
          setProfileName(initialProfile.profile_name || "");
          setNotes(initialProfile.notes || "");
          setSetActiveOnSave(initialProfile.is_active ?? true);
          setSource("list-load");
          return;
        }
        const loaded = await loadMeasurementSettingsPreferApi(LARAVEL_BASE_URL);
        if (cancelled) return;
        setParams(loaded.params);
        setPresets(loaded.presets);
        setProfileName("");
        setNotes("");
        setSetActiveOnSave(true);
        setSource(loaded.source || "api");
      } catch (e) {
        if (cancelled) return;
        const stored = loadMeasurementSettings();
        setParams(stored.params);
        setPresets(stored.presets);
        setSource(stored.source || "local");
        setError(e?.message || "Failed to load settings");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [initialProfile]);

  const applySanitizedParams = (next) => setParams(sanitizeMeasurementParams(next));

  const handleParamChange = (key, value) => {
    const numericKeys = PARAM_FIELDS.map((f) => f.key);
    const parsed = numericKeys.includes(key) ? Number(value) : value;
    applySanitizedParams({ ...params, [key]: parsed });
  };

  const handlePresetChange = (presetKey, field, value) => {
    setPresets((prev) => ({
      ...prev,
      [presetKey]: {
        ...prev[presetKey],
        [field]: Number(value),
      },
    }));
  };

  const roiShapeOptions = useMemo(
    () => [
      { label: "Square (default)", value: "square" },
      { label: "Rectangle", value: "rectangle" },
    ],
    []
  );

  const summary = useMemo(
    () => ({
      roi: `${params.roi_size}% ${params.roi_shape === "rectangle" ? "RECT" : "SQUARE"}`,
      edge: `${params.edge_thickness}px`,
      mmPerPx: Number(params.mm_per_pixel || 0).toFixed(4),
    }),
    [params]
  );

  const handleSave = async () => {
    setError("");
    const payload = {
      params,
      presets,
      profile_name: profileName || "Untitled",
      notes,
      is_active: setActiveOnSave,
    };
    try {
      if (initialProfile?.id) {
        await updateMeasurementSettingsToApi(LARAVEL_BASE_URL, initialProfile.id, payload);
      } else {
        await saveMeasurementSettingsToApi(LARAVEL_BASE_URL, payload);
      }
      setStatus("Saved");
      setTimeout(() => setStatus(""), 1800);
      onBack(); // go back to list after save
    } catch (e) {
      setError(e?.message || "Save failed");
      setStatus("");
    }
  };

  const handleReset = () => {
    setParams({ ...MEASUREMENT_DEFAULT_PARAMS });
    setPresets({ ...MEASUREMENT_PRESETS_DEFAULT });
    setProfileName("");
    setNotes("");
    setSetActiveOnSave(true);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="bg-gray-800 border-b border-gray-700 px-6 py-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="text-2xl hover:text-blue-400 transition-colors">
            ←
          </button>
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-blue-300 font-semibold">Measurement</div>
            <div className="text-xl font-bold flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-blue-400" />
              {initialProfile ? "Edit Profile" : "New Profile"}
            </div>
            <div className="text-[11px] text-gray-400">
              Source: {source} {status ? `• ${status}` : ""}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleReset}
            className="px-3 py-2 text-xs font-semibold rounded-lg border border-gray-700 bg-gray-900 hover:bg-gray-800"
          >
            Reset
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            Save
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-6 space-y-6">
        {error && (
          <div className="rounded-xl border border-red-700 bg-red-900/30 px-4 py-3 text-sm text-red-100">
            {error}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-3">
            <div className="rounded-2xl border border-gray-800 bg-gray-900/70 p-4">
              <div className="text-sm font-semibold text-gray-200 mb-2">Profile</div>
              <label className="block text-sm font-semibold text-gray-200 mb-2">
                Name
                <input
                  type="text"
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  placeholder="e.g., Flexure camera A"
                  className="mt-1 w-full rounded-lg border border-gray-800 bg-gray-950 px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                />
              </label>
              <label className="block text-sm font-semibold text-gray-200">
                Notes
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="mt-1 w-full rounded-lg border border-gray-800 bg-gray-950 px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                  placeholder="Lighting, camera, etc."
                />
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-200 mt-3">
                <input
                  type="checkbox"
                  checked={setActiveOnSave}
                  onChange={(e) => setSetActiveOnSave(e.target.checked)}
                  className="h-4 w-4 accent-blue-500"
                />
                Set active after save
              </label>
            </div>
          </div>

          <div className="lg:col-span-2 space-y-6">
            <div className="rounded-2xl border border-gray-800 bg-gray-900/70 p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm font-semibold text-gray-200">Detection Parameters</div>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {PARAM_FIELDS.map((field) => (
                  <NumericControl
                    key={field.key}
                    field={field}
                    value={params[field.key]}
                    onChange={handleParamChange}
                  />
                ))}

                <label className="flex flex-col gap-2">
                  <div className="flex items-center justify-between text-xs text-gray-400">
                    <span className="font-semibold">ROI Shape</span>
                    <span className="text-[11px] text-gray-500">square/rectangle</span>
                  </div>
                  <select
                    value={params.roi_shape}
                    onChange={(e) => handleParamChange("roi_shape", e.target.value)}
                    className="w-full rounded-lg border border-gray-800 bg-gray-950 px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  >
                    {roiShapeOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="flex flex-col gap-2">
                  <div className="flex items-center justify-between text-xs text-gray-400">
                    <span className="font-semibold">Denoise</span>
                    <span className="text-[11px] text-gray-500">fast NL means</span>
                  </div>
                  <div className="flex items-center gap-3 rounded-lg border border-gray-800 bg-gray-950 px-3 py-2">
                    <input
                      type="checkbox"
                      checked={params.denoise_enabled}
                      onChange={(e) => handleParamChange("denoise_enabled", e.target.checked)}
                      className="h-4 w-4 accent-blue-500"
                    />
                    <span className="text-sm text-gray-200">Enable denoise</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    {[
                      { key: "denoise_h", label: "h", min: 1, max: 20, step: 1 },
                      { key: "denoise_template", label: "Template (odd)", min: 1, max: 21, step: 2 },
                      { key: "denoise_search", label: "Search (odd)", min: 1, max: 31, step: 2 },
                    ].map((f) => (
                      <input
                        key={f.key}
                        type="number"
                        min={f.min}
                        max={f.max}
                        step={f.step}
                        value={params[f.key]}
                        onChange={(e) => handleParamChange(f.key, e.target.value)}
                        className="w-full rounded-md border border-gray-800 bg-gray-950 px-2 py-1 text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500/40"
                        placeholder={f.label}
                      />
                    ))}
                  </div>
                </label>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-2xl border border-gray-800 bg-gray-900/70 p-4">
                <div className="text-sm font-semibold text-gray-200 mb-2">Current Snapshot</div>
                <div className="rounded-xl border border-gray-800 bg-gray-950/80 p-4 text-sm text-gray-200">
                  <div className="flex items-center justify-between py-2">
                    <span className="text-gray-400">ROI</span>
                    <span className="font-semibold">{summary.roi}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-t border-gray-800">
                    <span className="text-gray-400">Edge Thickness</span>
                    <span className="font-semibold">{summary.edge}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-t border-gray-800">
                    <span className="text-gray-400">Calibration (mm/px)</span>
                    <span className="font-semibold">{summary.mmPerPx}</span>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-gray-800 bg-gray-900/70 p-4">
                <div className="text-sm font-semibold text-gray-200 mb-2">Per-Test Presets</div>
                <div className="space-y-3">
                  {Object.keys(TEST_LABEL).map((key) => (
                    <div
                      key={key}
                      className="rounded-xl border border-gray-800 bg-gray-950/70 p-3"
                    >
                      <div className="mb-2 flex items-center justify-between text-sm font-semibold text-gray-100">
                        <span>{TEST_LABEL[key]}</span>
                        <span className="text-[11px] text-gray-500 uppercase tracking-wide">
                          auto apply
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <label className="flex flex-col gap-1">
                          <span className="text-gray-400">mm per pixel</span>
                          <input
                            type="number"
                            min={0.01}
                            max={1}
                            step={0.001}
                            value={presets[key]?.mm_per_pixel ?? ""}
                            onChange={(e) => handlePresetChange(key, "mm_per_pixel", e.target.value)}
                            className="w-full rounded-lg border border-gray-800 bg-gray-950 px-3 py-2 text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500/40"
                          />
                        </label>
                        <label className="flex flex-col gap-1">
                          <span className="text-gray-400">ROI Size (%)</span>
                          <input
                            type="number"
                            min={5}
                            max={100}
                            step={1}
                            value={presets[key]?.roi_size ?? ""}
                            onChange={(e) => handlePresetChange(key, "roi_size", e.target.value)}
                            className="w-full rounded-lg border border-gray-800 bg-gray-950 px-3 py-2 text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500/40"
                          />
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MeasurementSettingsDetail;
