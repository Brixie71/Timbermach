import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";

/* -------------------- Modals (kept) -------------------- */
const SaveConfirmationModal = ({ isOpen, onClose, onConfirm, darkMode = false }) => {
  if (!isOpen) return null;
  return (
    <div
      className="absolute inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className={`shadow-2xl overflow-hidden max-w-md w-full mx-4 ${
          darkMode ? "bg-gray-800" : "bg-white"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={`px-6 py-4 border-b-2 ${
            darkMode ? "bg-gray-900 border-gray-700" : "bg-gray-100 border-gray-300"
          }`}
        >
          <h3 className={`text-xl font-bold ${darkMode ? "text-gray-100" : "text-gray-900"}`}>
            Confirm Save Changes
          </h3>
        </div>

        <div className="p-6">
          <p className={`text-lg mb-6 ${darkMode ? "text-gray-300" : "text-gray-700"}`}>
            Are you sure you want to save these changes? This will update the specimen data in the database.
          </p>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              type="button"
              className={`flex-1 py-3 font-semibold transition-all ${
                darkMode ? "bg-gray-700 text-gray-200 hover:bg-gray-600" : "bg-gray-300 text-gray-900 hover:bg-gray-400"
              }`}
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              type="button"
              className="flex-1 py-3 font-semibold bg-blue-500 text-white hover:bg-blue-600 transition-all"
            >
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const SuccessModal = ({ isOpen, onClose, darkMode = false }) => {
  if (!isOpen) return null;
  return (
    <div
      className="absolute inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className={`shadow-2xl overflow-hidden max-w-md w-full mx-4 ${
          darkMode ? "bg-gray-800" : "bg-white"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center pt-8">
          <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        </div>

        <div className="p-6 text-center">
          <h3 className={`text-2xl font-bold mb-2 ${darkMode ? "text-gray-100" : "text-gray-900"}`}>
            Success!
          </h3>
          <p className={`text-lg mb-6 ${darkMode ? "text-gray-300" : "text-gray-700"}`}>
            Data updated successfully
          </p>

          <button
            onClick={onClose}
            type="button"
            className="w-full py-3 font-semibold bg-green-500 text-white hover:bg-green-600 transition-all"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
};
/* ------------------------------------------------------ */

const SpecimenEdit = ({ data, dataType, darkMode = false, onClose, onSave }) => {
  const [species, setSpecies] = useState([]);
  const [loadingSpecies, setLoadingSpecies] = useState(false);

  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  // ✅ UNCONTROLLED refs (virtual keyboard updates DOM directly)
  const specimenNameRef = useRef(null);
  const testTypeRef = useRef(null);
  const baseRef = useRef(null);
  const heightRef = useRef(null);
  const lengthRef = useRef(null);
  const areaRef = useRef(null);
  const maxForceRef = useRef(null);
  const stressRef = useRef(null);
  const moistureRef = useRef(null);
  const speciesRef = useRef(null);

  const specimenId = useMemo(() => {
    return data?.compressive_id || data?.shear_id || data?.flexure_id;
  }, [data]);

  // Initial values (only used as defaultValue)
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
      species_id: data?.species_id ?? null,
    };
  }, [data]);

  useEffect(() => {
    const fetchSpecies = async () => {
      setLoadingSpecies(true);
      try {
        // ✅ Use the endpoint you actually have (you used this elsewhere)
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

  // Auto-calc area when base/height change (works for both physical + VK)
  const recalcArea = () => {
    const b = parseFloat(baseRef.current?.value || "");
    const h = parseFloat(heightRef.current?.value || "");
    if (!isNaN(b) && b > 0 && !isNaN(h) && h > 0 && areaRef.current) {
      areaRef.current.value = (b * h).toFixed(2);
    }
  };

  const read = (ref) => (ref.current ? String(ref.current.value ?? "") : "");
  const readNum = (ref) => {
    const n = parseFloat(read(ref));
    return Number.isFinite(n) ? n : NaN;
  };

  const validate = () => {
    const nextErrors = {};

    const specimen_name = read(specimenNameRef).trim();
    const test_type = read(testTypeRef).trim();

    if (!specimen_name) nextErrors.specimen_name = "Specimen name is required";
    if (!test_type) nextErrors.test_type = "Test type is required";

    const numericFields = [
      ["base", baseRef],
      ["height", heightRef],
      ["length", lengthRef],
      ["area", areaRef],
      ["max_force", maxForceRef],
      ["stress", stressRef],
    ];

    for (const [key, ref] of numericFields) {
      const n = readNum(ref);
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
        specimen_name: read(specimenNameRef).trim(),
        test_type: read(testTypeRef).trim(),
        base: readNum(baseRef),
        height: readNum(heightRef),
        length: readNum(lengthRef),
        area: readNum(areaRef),
        max_force: readNum(maxForceRef),
        stress: readNum(stressRef),
        moisture_content: read(moistureRef).trim() === "" ? null : readNum(moistureRef),
        species_id: speciesRef.current?.value ? parseInt(speciesRef.current.value, 10) : null,
      };

      await axios.put(`http://127.0.0.1:8000/api/${dataType}-data/${specimenId}`, payload);

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

  const inputBaseClass = `w-full px-3 py-2 rounded-lg border focus:outline-none text-[13px] font-semibold ${
    darkMode
      ? "bg-gray-800 border-gray-600 text-gray-100 focus:border-blue-400"
      : "bg-white border-gray-300 text-gray-900 focus:border-blue-600"
  }`;

  const errBorder = (k) => (errors[k] ? "border-red-500" : "");

  const Field = ({ label, required, errorKey, children }) => (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <label className={`text-[12px] font-extrabold ${darkMode ? "text-gray-300" : "text-gray-800"}`}>
          {label} {required ? <span className="text-red-500">*</span> : null}
        </label>
        {errorKey && errors[errorKey] ? (
          <span className="text-[11px] text-red-500 font-bold">{errors[errorKey]}</span>
        ) : null}
      </div>
      {children}
    </div>
  );

  return (
    <div className={`relative w-full h-full ${darkMode ? "bg-gray-900" : "bg-gray-50"}`}>
      {/* Header */}
      <div
        className={`flex items-center justify-between px-4 border-b ${
          darkMode ? "border-gray-700 bg-gray-950" : "border-gray-300 bg-white"
        }`}
        style={{ height: "60px" }}
      >
        <div className="min-w-0">
          <div className={`text-[14px] font-extrabold ${darkMode ? "text-gray-100" : "text-gray-900"} truncate`}>
            Edit Specimen
          </div>
          <div className={`text-[12px] ${darkMode ? "text-gray-300" : "text-gray-600"} truncate`}>
            {initial.specimen_name || "Unknown"} • {dataType}
          </div>
        </div>

        <button
          onClick={onClose}
          type="button"
          className={`p-2 rounded-lg transition-colors ${
            darkMode ? "text-gray-200 hover:bg-gray-800" : "text-gray-900 hover:bg-gray-100"
          }`}
          title="Close"
        >
          ✕
        </button>
      </div>

      {/* Body */}
      <div className="h-[calc(100%-60px)] overflow-y-auto pb-24">
        <div className="p-3">
          <div className={`rounded-xl border ${darkMode ? "border-gray-700 bg-gray-900" : "border-gray-300 bg-white"}`}>
            <div className="p-3 grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Field label="Specimen Name" required errorKey="specimen_name">
                  <input
                    ref={specimenNameRef}
                    type="text"
                    defaultValue={initial.specimen_name}
                    className={`${inputBaseClass} ${errBorder("specimen_name")} keyboard-trigger`}
                    data-keyboard="1"
                  />
                </Field>
              </div>

              <div className="col-span-2">
                <Field label="Test Type" required errorKey="test_type">
                  <input
                    ref={testTypeRef}
                    type="text"
                    defaultValue={initial.test_type}
                    className={`${inputBaseClass} ${errBorder("test_type")} keyboard-trigger`}
                    data-keyboard="1"
                  />
                </Field>
              </div>

              <div className="col-span-2">
                <Field label="Reference Species">
                  <select
                    ref={speciesRef}
                    defaultValue={initial.species_id || ""}
                    className={inputBaseClass}
                  >
                    <option value="">{loadingSpecies ? "Loading..." : "No Reference Selected"}</option>
                    {species.map((s) => (
                      <option key={s.id || s.species_id} value={s.id || s.species_id}>
                        {s.common_name || s.species_name || s.botanical_name}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              <Field label="Base (mm)" required errorKey="base">
                <input
                  ref={baseRef}
                  type="text"
                  inputMode="decimal"
                  defaultValue={initial.base}
                  onInput={recalcArea}
                  className={`${inputBaseClass} ${errBorder("base")} keyboard-trigger`}
                  data-keyboard="1"
                />
              </Field>

              <Field label="Height (mm)" required errorKey="height">
                <input
                  ref={heightRef}
                  type="text"
                  inputMode="decimal"
                  defaultValue={initial.height}
                  onInput={recalcArea}
                  className={`${inputBaseClass} ${errBorder("height")} keyboard-trigger`}
                  data-keyboard="1"
                />
              </Field>

              <Field label="Length (mm)" required errorKey="length">
                <input
                  ref={lengthRef}
                  type="text"
                  inputMode="decimal"
                  defaultValue={initial.length}
                  className={`${inputBaseClass} ${errBorder("length")} keyboard-trigger`}
                  data-keyboard="1"
                />
              </Field>

              <Field label="Area (mm²)" required errorKey="area">
                <input
                  ref={areaRef}
                  type="text"
                  inputMode="decimal"
                  defaultValue={initial.area}
                  className={`${inputBaseClass} ${errBorder("area")} keyboard-trigger`}
                  data-keyboard="1"
                />
              </Field>

              <Field label="Maximum Force (N)" required errorKey="max_force">
                <input
                  ref={maxForceRef}
                  type="text"
                  inputMode="decimal"
                  defaultValue={initial.max_force}
                  className={`${inputBaseClass} ${errBorder("max_force")} keyboard-trigger`}
                  data-keyboard="1"
                />
              </Field>

              <Field label="Stress (MPa)" required errorKey="stress">
                <input
                  ref={stressRef}
                  type="text"
                  inputMode="decimal"
                  defaultValue={initial.stress}
                  className={`${inputBaseClass} ${errBorder("stress")} keyboard-trigger`}
                  data-keyboard="1"
                />
              </Field>

              <div className="col-span-2">
                <Field label="Moisture Content (%)">
                  <input
                    ref={moistureRef}
                    type="text"
                    inputMode="decimal"
                    defaultValue={initial.moisture_content}
                    className={`${inputBaseClass} keyboard-trigger`}
                    data-keyboard="1"
                    placeholder="Optional"
                  />
                </Field>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className={`absolute left-0 right-0 bottom-0 border-t ${darkMode ? "border-gray-700 bg-gray-950" : "border-gray-300 bg-white"}`}>
        <div className="px-3 py-3 flex gap-3">
          <button
            onClick={onClose}
            type="button"
            className={`flex-1 py-3 rounded-lg font-extrabold text-[13px] transition-all ${
              darkMode ? "bg-gray-800 text-gray-100 hover:bg-gray-700" : "bg-gray-200 text-gray-900 hover:bg-gray-300"
            }`}
          >
            Cancel
          </button>

          <button
            onClick={handleSubmit}
            disabled={saving}
            type="button"
            className={`flex-1 py-3 rounded-lg font-extrabold text-[13px] transition-all ${
              saving
                ? darkMode
                  ? "bg-gray-800 text-gray-400 cursor-not-allowed"
                  : "bg-gray-200 text-gray-500 cursor-not-allowed"
                : "bg-blue-600 text-white hover:bg-blue-700"
            }`}
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
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
