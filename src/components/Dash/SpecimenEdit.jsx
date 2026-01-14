import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import "./SpecimenEdit.css";

const SaveConfirmationModal = ({ isOpen, onClose, onConfirm }) => {
  if (!isOpen) return null;
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Confirm Save</h3>
        <p>Save changes to this specimen?</p>
        <div className="modal-actions">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button type="button" onClick={onConfirm}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

const SuccessModal = ({ isOpen, onClose }) => {
  if (!isOpen) return null;
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Saved</h3>
        <p>Specimen updated successfully.</p>
        <button type="button" onClick={onClose}>
          OK
        </button>
      </div>
    </div>
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
    const b = parseFloat(String(baseValue ?? ""));
    const h = parseFloat(String(heightValue ?? ""));
    if (!Number.isFinite(b) || b <= 0 || !Number.isFinite(h) || h <= 0) {
      return null;
    }
    return (b * h).toString();
  };

  const readText = (value) => String(value ?? "");
  const readNum = (value) => {
    const n = parseFloat(readText(value));
    return Number.isFinite(n) ? n : NaN;
  };

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
      ["max_force", form.max_force],
      ["stress", form.stress],
    ];

    for (const [key, value] of numericFields) {
      const n = readNum(value);
      if (!Number.isFinite(n) || n <= 0) nextErrors[key] = "Must be a positive number";
    }

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
        max_force: readNum(form.max_force),
        stress: readNum(form.stress),
        moisture_content:
          readText(form.moisture_content).trim() === ""
            ? null
            : readNum(form.moisture_content),
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

  const fieldClass = `field ${darkMode ? "field-dark" : ""}`;
  const inputClass = `input ${darkMode ? "input-dark" : ""}`;

  return (
    <div className={`specimen-edit ${darkMode ? "theme-dark" : "theme-light"}`}>
      <div className="header">
        <div>
          <div className="title">Edit Specimen</div>
          <div className="subtitle">{initial.specimen_name || "Unknown"} - {dataType}</div>
        </div>
        <button type="button" onClick={onClose}>Close</button>
      </div>

      <div className="content">
        <div className={fieldClass}>
          <label>Specimen Name *</label>
          <input
            type="text"
            value={form.specimen_name}
            onInput={(e) => updateForm({ specimen_name: e.currentTarget.value })}
            className={inputClass}
            data-keyboard="1"
          />
          {errors.specimen_name ? <div className="error">{errors.specimen_name}</div> : null}
        </div>

        <div className={fieldClass}>
          <label>Test Type *</label>
          <input
            type="text"
            value={form.test_type}
            onInput={(e) => updateForm({ test_type: e.currentTarget.value })}
            className={inputClass}
            data-keyboard="1"
          />
          {errors.test_type ? <div className="error">{errors.test_type}</div> : null}
        </div>

        <div className={fieldClass}>
          <label>Reference Species</label>
          <select
            value={form.species_id}
            onChange={(e) => updateForm({ species_id: e.target.value })}
            className={inputClass}
          >
            <option value="">{loadingSpecies ? "Loading..." : "No Reference Selected"}</option>
            {species.map((s) => (
              <option key={s.id || s.species_id} value={s.id || s.species_id}>
                {s.common_name || s.species_name || s.botanical_name}
              </option>
            ))}
          </select>
        </div>

        <div className={fieldClass}>
          <label>Base (mm) *</label>
          <input
            type="text"
            inputMode="decimal"
            value={form.base}
            onInput={(e) => {
              const nextBase = e.currentTarget.value;
              const nextArea = computeArea(nextBase, form.height);
              updateForm({ base: nextBase, ...(nextArea ? { area: nextArea } : {}) });
            }}
            className={inputClass}
            data-keyboard="1"
            data-keyboard-mode="numeric"
          />
          {errors.base ? <div className="error">{errors.base}</div> : null}
        </div>

        <div className={fieldClass}>
          <label>Height (mm) *</label>
          <input
            type="text"
            inputMode="decimal"
            value={form.height}
            onInput={(e) => {
              const nextHeight = e.currentTarget.value;
              const nextArea = computeArea(form.base, nextHeight);
              updateForm({ height: nextHeight, ...(nextArea ? { area: nextArea } : {}) });
            }}
            className={inputClass}
            data-keyboard="1"
            data-keyboard-mode="numeric"
          />
          {errors.height ? <div className="error">{errors.height}</div> : null}
        </div>

        <div className={fieldClass}>
          <label>Length (mm) *</label>
          <input
            type="text"
            inputMode="decimal"
            value={form.length}
            onInput={(e) => updateForm({ length: e.currentTarget.value })}
            className={inputClass}
            data-keyboard="1"
            data-keyboard-mode="numeric"
          />
          {errors.length ? <div className="error">{errors.length}</div> : null}
        </div>

        <div className={fieldClass}>
          <label>Area (mm^2) *</label>
          <input
            type="text"
            inputMode="decimal"
            value={form.area}
            onInput={(e) => updateForm({ area: e.currentTarget.value })}
            className={inputClass}
            data-keyboard="1"
            data-keyboard-mode="numeric"
          />
          {errors.area ? <div className="error">{errors.area}</div> : null}
        </div>

        <div className={fieldClass}>
          <label>Maximum Force (N) *</label>
          <input
            type="text"
            inputMode="decimal"
            value={form.max_force}
            onInput={(e) => updateForm({ max_force: e.currentTarget.value })}
            className={inputClass}
            data-keyboard="1"
            data-keyboard-mode="numeric"
          />
          {errors.max_force ? <div className="error">{errors.max_force}</div> : null}
        </div>

        <div className={fieldClass}>
          <label>Stress (MPa) *</label>
          <input
            type="text"
            inputMode="decimal"
            value={form.stress}
            onInput={(e) => updateForm({ stress: e.currentTarget.value })}
            className={inputClass}
            data-keyboard="1"
            data-keyboard-mode="numeric"
          />
          {errors.stress ? <div className="error">{errors.stress}</div> : null}
        </div>

        <div className={fieldClass}>
          <label>Moisture Content (%)</label>
          <input
            type="text"
            inputMode="decimal"
            value={form.moisture_content}
            onInput={(e) => updateForm({ moisture_content: e.currentTarget.value })}
            className={inputClass}
            data-keyboard="1"
            data-keyboard-mode="numeric"
          />
        </div>
      </div>

      <div className="actions">
        <button type="button" onClick={onClose}>
          Cancel
        </button>
        <button type="button" onClick={handleSubmit} disabled={saving}>
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </div>

      <SaveConfirmationModal
        isOpen={showSaveModal}
        onClose={() => setShowSaveModal(false)}
        onConfirm={confirmSave}
      />

      <SuccessModal isOpen={showSuccessModal} onClose={handleSuccessClose} />
    </div>
  );
};

export default SpecimenEdit;
