import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";

const CONTACT_W_MM = 76.2;
const CONTACT_H_MM = 76.2;
const CONTACT_AREA_MM2 = CONTACT_W_MM * CONTACT_H_MM;

const baseShell = "h-full flex flex-col transition-colors";
const lightShell = "bg-zinc-50 text-zinc-900";
const darkShell = "bg-zinc-950 text-zinc-100";

const topBar = "sticky top-0 z-10 border-b backdrop-blur supports-[backdrop-filter]:bg-opacity-70";
const topBarLight = "border-zinc-200 bg-zinc-50/80";
const topBarDark = "border-zinc-800 bg-zinc-950/70";

const card = "rounded-2xl border shadow-sm";
const cardLight = "border-zinc-200 bg-white";
const cardDark = "border-zinc-800 bg-zinc-900/40";

const labelCls = "text-xs font-semibold text-zinc-700";
const labelClsDark = "text-zinc-200";

const inputBase = "w-full rounded-xl border px-3 py-2 text-sm outline-none transition focus:ring-2";
const inputLight =
  "border-zinc-300 bg-white text-zinc-900 placeholder:text-zinc-400 focus:border-transparent focus:ring-blue-500";
const inputDark =
  "border-zinc-700 bg-zinc-900 text-zinc-100 placeholder:text-zinc-500 focus:border-transparent focus:ring-blue-400";

const errorText = "text-[11px] text-red-600";

const btn =
  "inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold transition disabled:opacity-60 disabled:cursor-not-allowed";
const btnGhostLight = "border border-zinc-300 bg-white hover:bg-zinc-50";
const btnGhostDark = "border border-zinc-700 bg-zinc-900 hover:bg-zinc-800";
const btnPrimary = "bg-blue-600 text-white hover:bg-blue-700";

function safeNum(v, fallback = NaN) {
  const n = Number.parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : fallback;
}

function ModalShell({ isOpen, onClose, children }) {
  if (!isOpen) return null;
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

const SaveConfirmationModal = ({ isOpen, onClose, onConfirm, darkMode }) => {
  return (
    <ModalShell isOpen={isOpen} onClose={onClose}>
      <div
        className={`${
          darkMode ? "border border-zinc-800 bg-zinc-950 text-zinc-100" : "border border-zinc-200 bg-white text-zinc-900"
        } rounded-2xl`}
      >
        <div className="p-2">
          <h3 className="text-base font-bold">Confirm Save</h3>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">Save changes to this specimen?</p>

          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={onClose} className={`${btn} ${darkMode ? btnGhostDark : btnGhostLight}`}>
              Cancel
            </button>
            <button type="button" onClick={onConfirm} className={`${btn} ${btnPrimary}`}>
              Save
            </button>
          </div>
        </div>
      </div>
    </ModalShell>
  );
};

const SuccessModal = ({ isOpen, onClose, darkMode }) => {
  return (
    <ModalShell isOpen={isOpen} onClose={onClose}>
      <div
        className={`${
          darkMode ? "border border-zinc-800 bg-zinc-950 text-zinc-100" : "border border-zinc-200 bg-white text-zinc-900"
        } rounded-2xl`}
      >
        <div className="p-2">
          <h3 className="text-base font-bold">Saved</h3>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">Specimen updated successfully.</p>

          <div className="mt-4 flex justify-end">
            <button type="button" onClick={onClose} className={`${btn} ${btnPrimary}`}>
              OK
            </button>
          </div>
        </div>
      </div>
    </ModalShell>
  );
};

const SpecimenEdit = ({ data, dataType, darkMode = false, onClose, onSave }) => {
  const [species, setSpecies] = useState([]);
  const [loadingSpecies, setLoadingSpecies] = useState(false);

  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const specimenId = useMemo(() => {
    return data?.compressive_id || data?.shear_id || data?.flexure_id;
  }, [data]);

  const draftKey = useMemo(() => {
    const id = data?.compressive_id || data?.shear_id || data?.flexure_id;
    return id ? `specimenEditDraft:${dataType}:${id}` : null;
  }, [data, dataType]);

  const loadDraft = () => {
    if (!draftKey) return null;
    try {
      const raw = sessionStorage.getItem(draftKey);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  };

  const saveDraft = (patch) => {
    if (!draftKey) return;
    try {
      const cur = loadDraft() || {};
      sessionStorage.setItem(draftKey, JSON.stringify({ ...cur, ...patch }));
    } catch {}
  };

  const clearDraft = () => {
    if (!draftKey) return;
    try {
      sessionStorage.removeItem(draftKey);
    } catch {}
  };

  const initial = useMemo(() => {
    const v = (key, fallbackKey) => data?.[key] ?? data?.[fallbackKey] ?? "";
    return {
      specimen_name: v("specimen_name", "Specimen Name"),
      test_type: v("test_type", "Test Type"),
      base: v("base", "Base"),
      height: v("height", "Height"),
      length: v("length", "Length"),
      area: v("area", "Area"),

      // NEW: pressure_bar is primary source now
      pressure_bar: v("pressure_bar", "pressure"),

      // keep for backwards compat (fallback)
      max_force: v("max_force", "Maximum Force"),

      stress: v("stress", "Stress"),
      moisture_content: v("moisture_content", "Moisture Content"),
      species_id: data?.species_id ?? "",
    };
  }, [data]);

  const draft = useMemo(() => loadDraft(), [draftKey]);

  const start = useMemo(() => {
    return {
      specimen_name: draft?.specimen_name ?? initial.specimen_name,
      test_type: draft?.test_type ?? initial.test_type,
      base: draft?.base ?? initial.base,
      height: draft?.height ?? initial.height,
      length: draft?.length ?? initial.length,
      area: draft?.area ?? initial.area,

      pressure_bar: draft?.pressure_bar ?? initial.pressure_bar,
      max_force: draft?.max_force ?? initial.max_force,

      stress: draft?.stress ?? initial.stress,
      moisture_content: draft?.moisture_content ?? initial.moisture_content,
      species_id: draft?.species_id ?? initial.species_id,
    };
  }, [draft, initial]);

  const [form, setForm] = useState(start);

  useEffect(() => {
    setForm(start);
  }, [start]);

  const updateForm = (patch) => {
    setForm((prev) => ({ ...prev, ...patch }));
    saveDraft(patch);
  };

  useEffect(() => {
    const fetchSpecies = async () => {
      setLoadingSpecies(true);
      try {
        const res = await axios.get("http://127.0.0.1:8000/api/reference-values");
        setSpecies(Array.isArray(res.data) ? res.data : []);
      } catch (e) {
        console.error("Error fetching species:", e);
        setSpecies([]);
      } finally {
        setLoadingSpecies(false);
      }
    };
    fetchSpecies();
  }, []);

  const computeArea = (baseValue, heightValue) => {
    const b = safeNum(baseValue, NaN);
    const h = safeNum(heightValue, NaN);
    if (!Number.isFinite(b) || b <= 0 || !Number.isFinite(h) || h <= 0) return null;
    return String(b * h);
  };

  const readText = (value) => String(value ?? "");
  const readNum = (value) => {
    const n = safeNum(value, NaN);
    return Number.isFinite(n) ? n : NaN;
  };

  const derived = useMemo(() => {
    const bar = safeNum(form.pressure_bar, NaN);
    if (Number.isFinite(bar) && bar > 0) {
      const mpa = bar * 0.1;
      const pN = mpa * CONTACT_AREA_MM2;
      return { bar, mpa, pN, used: "pressure_bar" };
    }
    const fallbackN = safeNum(form.max_force, 0);
    return { bar: 0, mpa: 0, pN: fallbackN, used: "max_force" };
  }, [form.pressure_bar, form.max_force]);

  const validate = () => {
    const nextErrors = {};

    const specimen_name = readText(form.specimen_name).trim();
    const test_type = readText(form.test_type).trim();

    if (!specimen_name) nextErrors.specimen_name = "Specimen name is required";
    if (!test_type) nextErrors.test_type = "Test type is required";

    const numericFields = [
      ["base", form.base],
      ["height", form.height],
      ["length", form.length],
      ["area", form.area],
      ["pressure_bar", form.pressure_bar], // NEW required now
    ];

    for (const [key, value] of numericFields) {
      const n = readNum(value);
      if (!Number.isFinite(n) || n <= 0) nextErrors[key] = "Must be a positive number";
    }

    // stress/max_force are no longer mandatory (we compute from pressure_bar)
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;
    setShowSaveModal(true);
  };

  const confirmSave = async () => {
    setShowSaveModal(false);
    setSaving(true);

    try {
      if (!specimenId) throw new Error("No specimen ID found.");

      const payload = {
        specimen_name: readText(form.specimen_name).trim(),
        test_type: readText(form.test_type).trim(),
        base: readNum(form.base),
        height: readNum(form.height),
        length: readNum(form.length),
        area: readNum(form.area),

        // ✅ store bar in DB
        pressure_bar: readNum(form.pressure_bar),

        // keep max_force for compatibility (optional)
        max_force: Number.isFinite(readNum(form.max_force)) ? readNum(form.max_force) : null,

        // stress is optional (your UI computes it anyway)
        stress: Number.isFinite(readNum(form.stress)) ? readNum(form.stress) : null,

        moisture_content: readText(form.moisture_content).trim() === "" ? null : readNum(form.moisture_content),
        species_id: form.species_id ? parseInt(form.species_id, 10) : null,
      };

      await axios.put(`http://127.0.0.1:8000/api/${dataType}-data/${specimenId}`, payload);

      clearDraft();
      setShowSuccessModal(true);
    } catch (err) {
      console.error("Error updating data:", err);
      alert(`Failed to update: ${err.response?.data?.detail || err.message}`);
      setSaving(false);
    }
  };

  const handleSuccessClose = () => {
    setShowSuccessModal(false);
    setSaving(false);
    onSave?.();
    onClose?.();
  };

  const shellCls = `${baseShell} ${darkMode ? darkShell : lightShell}`;
  const barCls = `${topBar} ${darkMode ? topBarDark : topBarLight}`;

  const cardCls = `${card} ${darkMode ? cardDark : cardLight}`;
  const inputCls = `${inputBase} ${darkMode ? inputDark : inputLight}`;
  const labelFinal = `${labelCls} ${darkMode ? labelClsDark : ""}`;

  return (
    <div className={shellCls}>
      {/* Header */}
      <div className={barCls}>
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <div className="min-w-0">
            <div className="text-base font-extrabold tracking-tight">Edit Specimen</div>
            <div className={`mt-0.5 truncate text-xs ${darkMode ? "text-zinc-300" : "text-zinc-600"}`}>
              {initial.specimen_name || "Unknown"} — {dataType}
            </div>
          </div>

          <button type="button" onClick={onClose} className={`${btn} ${darkMode ? btnGhostDark : btnGhostLight}`}>
            Close
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-4">
        <div className={`${cardCls} p-4`}>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {/* Specimen Name */}
            <div className="space-y-1.5">
              <label className={labelFinal}>Specimen Name *</label>
              <input
                type="text"
                value={form.specimen_name}
                onInput={(e) => updateForm({ specimen_name: e.currentTarget.value })}
                className={inputCls}
                data-keyboard="1"
              />
              {errors.specimen_name ? <div className={errorText}>{errors.specimen_name}</div> : null}
            </div>

            {/* Test Type */}
            <div className="space-y-1.5">
              <label className={labelFinal}>Test Type *</label>
              <input
                type="text"
                value={form.test_type}
                onInput={(e) => updateForm({ test_type: e.currentTarget.value })}
                className={inputCls}
                data-keyboard="1"
              />
              {errors.test_type ? <div className={errorText}>{errors.test_type}</div> : null}
            </div>

            {/* Reference Species */}
            <div className="space-y-1.5">
              <label className={labelFinal}>Reference Species</label>
              <select
                value={form.species_id}
                onChange={(e) => updateForm({ species_id: e.target.value })}
                className={`${inputCls} pr-8`}
              >
                <option value="">{loadingSpecies ? "Loading..." : "No Reference Selected"}</option>
                {species.map((s) => (
                  <option key={s.id || s.species_id} value={s.id || s.species_id}>
                    {s.common_name || s.species_name || s.botanical_name}
                  </option>
                ))}
              </select>
            </div>

            {/* Base */}
            <div className="space-y-1.5">
              <label className={labelFinal}>Base (mm) *</label>
              <input
                type="text"
                inputMode="decimal"
                value={form.base}
                onInput={(e) => {
                  const nextBase = e.currentTarget.value;
                  const nextArea = computeArea(nextBase, form.height);
                  updateForm({ base: nextBase, ...(nextArea ? { area: nextArea } : {}) });
                }}
                className={inputCls}
                data-keyboard="1"
                data-keyboard-mode="numeric"
              />
              {errors.base ? <div className={errorText}>{errors.base}</div> : null}
            </div>

            {/* Height */}
            <div className="space-y-1.5">
              <label className={labelFinal}>Height (mm) *</label>
              <input
                type="text"
                inputMode="decimal"
                value={form.height}
                onInput={(e) => {
                  const nextHeight = e.currentTarget.value;
                  const nextArea = computeArea(form.base, nextHeight);
                  updateForm({ height: nextHeight, ...(nextArea ? { area: nextArea } : {}) });
                }}
                className={inputCls}
                data-keyboard="1"
                data-keyboard-mode="numeric"
              />
              {errors.height ? <div className={errorText}>{errors.height}</div> : null}
            </div>

            {/* Length */}
            <div className="space-y-1.5">
              <label className={labelFinal}>Length (mm) *</label>
              <input
                type="text"
                inputMode="decimal"
                value={form.length}
                onInput={(e) => updateForm({ length: e.currentTarget.value })}
                className={inputCls}
                data-keyboard="1"
                data-keyboard-mode="numeric"
              />
              {errors.length ? <div className={errorText}>{errors.length}</div> : null}
            </div>

            {/* Area */}
            <div className="space-y-1.5">
              <label className={labelFinal}>Area (mm²) *</label>
              <input
                type="text"
                inputMode="decimal"
                value={form.area}
                onInput={(e) => updateForm({ area: e.currentTarget.value })}
                className={inputCls}
                data-keyboard="1"
                data-keyboard-mode="numeric"
              />
              {errors.area ? <div className={errorText}>{errors.area}</div> : null}
            </div>

            {/* ✅ Pressure Bar */}
            <div className="space-y-1.5">
              <label className={labelFinal}>Pressure (bar) *</label>
              <input
                type="text"
                inputMode="decimal"
                value={form.pressure_bar}
                onInput={(e) => updateForm({ pressure_bar: e.currentTarget.value })}
                className={inputCls}
                data-keyboard="1"
                data-keyboard-mode="numeric"
              />
              {errors.pressure_bar ? <div className={errorText}>{errors.pressure_bar}</div> : null}

              <div className={`text-[11px] mt-1 ${darkMode ? "text-zinc-300" : "text-zinc-600"}`}>
                Derived: MPa = bar × 0.1 → <b>{derived.mpa.toFixed(2)} MPa</b>
              </div>
            </div>

            {/* ✅ Derived point load */}
            <div className="space-y-1.5">
              <label className={labelFinal}>Derived Point Load (P) (N)</label>
              <input type="text" value={derived.pN.toFixed(2)} className={inputCls} disabled />
              <div className={`text-[11px] ${darkMode ? "text-zinc-300" : "text-zinc-600"}`}>
                P = MPa × A_contact ({CONTACT_W_MM}×{CONTACT_H_MM}={CONTACT_AREA_MM2.toFixed(2)} mm²)
              </div>
            </div>

            {/* Legacy Max Force (optional fallback) */}
            <div className="space-y-1.5">
              <label className={labelFinal}>Max Force (legacy fallback) (N)</label>
              <input
                type="text"
                inputMode="decimal"
                value={form.max_force}
                onInput={(e) => updateForm({ max_force: e.currentTarget.value })}
                className={inputCls}
                data-keyboard="1"
                data-keyboard-mode="numeric"
              />
              <div className={`text-[11px] ${darkMode ? "text-zinc-300" : "text-zinc-600"}`}>
                Used only if pressure_bar is missing.
              </div>
            </div>

            {/* Stress (optional) */}
            <div className="space-y-1.5">
              <label className={labelFinal}>Stress (MPa) (optional)</label>
              <input
                type="text"
                inputMode="decimal"
                value={form.stress}
                onInput={(e) => updateForm({ stress: e.currentTarget.value })}
                className={inputCls}
                data-keyboard="1"
                data-keyboard-mode="numeric"
              />
            </div>

            {/* Moisture */}
            <div className="space-y-1.5">
              <label className={labelFinal}>Moisture Content (%)</label>
              <input
                type="text"
                inputMode="decimal"
                value={form.moisture_content}
                onInput={(e) => updateForm({ moisture_content: e.currentTarget.value })}
                className={inputCls}
                data-keyboard="1"
                data-keyboard-mode="numeric"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={onClose} className={`${btn} ${darkMode ? btnGhostDark : btnGhostLight}`}>
              Cancel
            </button>

            <button type="button" onClick={handleSubmit} disabled={saving} className={`${btn} ${btnPrimary}`}>
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      </div>

      <SaveConfirmationModal
        isOpen={showSaveModal}
        onClose={() => setShowSaveModal(false)}
        onConfirm={confirmSave}
        darkMode={darkMode}
      />

      <SuccessModal isOpen={showSuccessModal} onClose={handleSuccessClose} darkMode={darkMode} />
    </div>
  );
};

export default SpecimenEdit;
