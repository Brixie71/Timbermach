import React, { useEffect, useState } from "react";
import axios from "axios";

/* -------------------- Modals (unchanged) -------------------- */
const SaveConfirmationModal = ({ isOpen, onClose, onConfirm, darkMode = false }) => {
  if (!isOpen) return null;
  return (
    <div
      className="absolute inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className={`shadow-2xl overflow-hidden max-w-md w-full mx-4 rounded-xl ${
          darkMode ? "bg-gray-800" : "bg-white"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={`px-5 py-4 border-b ${
            darkMode ? "bg-gray-900 border-gray-700" : "bg-gray-50 border-gray-300"
          }`}
        >
          <h3 className={`${darkMode ? "text-gray-100" : "text-gray-900"} text-[16px] font-extrabold`}>
            Confirm Save
          </h3>
          <p className={`${darkMode ? "text-gray-300" : "text-gray-600"} text-[12px] mt-1`}>
            This will update the specimen data in the database.
          </p>
        </div>

        <div className="p-5">
          <div className={`text-[13px] ${darkMode ? "text-gray-200" : "text-gray-700"} mb-4`}>
            Save changes now?
          </div>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className={`flex-1 py-3 rounded-lg font-extrabold text-[13px] transition-all ${
                darkMode
                  ? "bg-gray-700 text-gray-200 hover:bg-gray-600"
                  : "bg-gray-200 text-gray-900 hover:bg-gray-300"
              }`}
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              className="flex-1 py-3 rounded-lg font-extrabold text-[13px] bg-blue-600 text-white hover:bg-blue-700 transition-all"
            >
              Save
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
        className={`shadow-2xl overflow-hidden max-w-md w-full mx-4 rounded-xl ${
          darkMode ? "bg-gray-800" : "bg-white"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center pt-7">
          <div className="w-14 h-14 bg-green-500 rounded-full flex items-center justify-center">
            <svg className="w-9 h-9 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        </div>

        <div className="p-5 text-center">
          <h3 className={`text-[18px] font-extrabold mb-1 ${darkMode ? "text-gray-100" : "text-gray-900"}`}>
            Saved
          </h3>
          <p className={`text-[13px] mb-4 ${darkMode ? "text-gray-300" : "text-gray-700"}`}>
            Data updated successfully.
          </p>

          <button
            onClick={onClose}
            className="w-full py-3 rounded-lg font-extrabold text-[13px] bg-green-600 text-white hover:bg-green-700 transition-all"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
};
/* ------------------------------------------------------------ */

const SpecimenEdit = ({ data, dataType, darkMode = false, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    specimen_name: "",
    test_type: "",
    base: "",
    height: "",
    length: "",
    area: "",
    max_force: "",
    stress: "",
    moisture_content: "",
    species_id: null,
  });

  const [species, setSpecies] = useState([]);
  const [loadingSpecies, setLoadingSpecies] = useState(false);

  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  useEffect(() => {
    if (data) {
      setFormData({
        specimen_name: data.specimen_name || data["Specimen Name"] || "",
        test_type: data.test_type || data["Test Type"] || "",
        base: data.base ?? data["Base"] ?? "",
        height: data.height ?? data["Height"] ?? "",
        length: data.length ?? data["Length"] ?? "",
        area: data.area ?? data["Area"] ?? "",
        max_force: data.max_force ?? data["Maximum Force"] ?? "",
        stress: data.stress ?? data["Stress"] ?? "",
        moisture_content: data.moisture_content ?? data["Moisture Content"] ?? "",
        species_id: data.species_id ?? null,
      });
    }
    fetchSpecies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const fetchSpecies = async () => {
    setLoadingSpecies(true);
    try {
      // You confirmed this endpoint exists
      const response = await axios.get("http://127.0.0.1:8000/api/reference-values");
      setSpecies(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error("Error fetching species:", error);
      setSpecies([]);
    } finally {
      setLoadingSpecies(false);
    }
  };

  // ✅ CRITICAL FIX:
  // Listen to native "input" events (dispatched by GlobalKeyboardProvider)
  // and update formData based on data-field.
  useEffect(() => {
    const handler = (e) => {
      const t = e.target;
      if (!t || !(t instanceof HTMLInputElement)) return;

      const field = t.getAttribute("data-field");
      if (!field) return;

      // only update if it's one of our fields
      setFormData((prev) => {
        if (!(field in prev)) return prev;
        return { ...prev, [field]: t.value };
      });
    };

    document.addEventListener("input", handler, true);
    return () => document.removeEventListener("input", handler, true);
  }, []);

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));

    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }

    // Auto-calc area when base or height changes
    if (field === "base" || field === "height") {
      const b = parseFloat(field === "base" ? value : formData.base);
      const h = parseFloat(field === "height" ? value : formData.height);
      if (!isNaN(b) && !isNaN(h) && b > 0 && h > 0) {
        setFormData((prev) => ({
          ...prev,
          [field]: value,
          area: (b * h).toFixed(2),
        }));
      }
    }
  };

  const validateForm = () => {
    const newErrors = {};
    if (!String(formData.specimen_name || "").trim()) newErrors.specimen_name = "Required";
    if (!String(formData.test_type || "").trim()) newErrors.test_type = "Required";

    const numericFields = ["base", "height", "length", "area", "max_force", "stress"];
    numericFields.forEach((f) => {
      const n = parseFloat(formData[f]);
      if (isNaN(n) || n <= 0) newErrors[f] = "Must be > 0";
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const specimenId = data?.compressive_id || data?.shear_id || data?.flexure_id;

  const handleSubmit = () => {
    if (!validateForm()) return;
    setShowSaveModal(true);
  };

  const confirmSave = async () => {
    setShowSaveModal(false);
    setSaving(true);

    try {
      if (!specimenId) throw new Error("No specimen ID found.");

      const updatePayload = {
        specimen_name: String(formData.specimen_name || "").trim(),
        test_type: String(formData.test_type || "").trim(),
        base: parseFloat(formData.base),
        height: parseFloat(formData.height),
        length: parseFloat(formData.length),
        area: parseFloat(formData.area),
        max_force: parseFloat(formData.max_force),
        stress: parseFloat(formData.stress),
        moisture_content:
          formData.moisture_content === "" ? null : parseFloat(formData.moisture_content),
        species_id: formData.species_id,
      };

      await axios.put(`http://127.0.0.1:8000/api/${dataType}-data/${specimenId}`, updatePayload);
      setShowSuccessModal(true);
    } catch (error) {
      console.error("Error updating data:", error);
      alert(`Failed to update: ${error.response?.data?.detail || error.message}`);
      setSaving(false);
    }
  };

  const handleSuccessClose = () => {
    setShowSuccessModal(false);
    setSaving(false);
    if (typeof onSave === "function") onSave();
    onClose();
  };

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

  const inputBase =
    `w-full px-3 py-2 rounded-lg border focus:outline-none text-[13px] font-semibold ` +
    (darkMode
      ? "bg-gray-800 border-gray-600 text-gray-100 focus:border-blue-400"
      : "bg-white border-gray-300 text-gray-900 focus:border-blue-600");

  const inputError = (k) => (errors[k] ? "border-red-500" : "");

  return (
    <div
      className={`relative w-full h-full ${darkMode ? "bg-gray-900" : "bg-gray-50"}`}
      style={{ fontFamily: "JustSans, system-ui, sans-serif" }}
    >
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
            {formData.specimen_name || "Unknown"} • {dataType}
          </div>
        </div>

        <button
          onClick={onClose}
          className={`p-2 rounded-lg transition-colors ${
            darkMode ? "text-gray-200 hover:bg-gray-800" : "text-gray-900 hover:bg-gray-100"
          }`}
          title="Close"
          type="button"
        >
          ✕
        </button>
      </div>

      {/* Body */}
      <div className="h-[calc(100%-60px)] overflow-y-auto pb-24">
        <div className="p-3">
          <div className={`rounded-xl border ${darkMode ? "border-gray-700 bg-gray-900" : "border-gray-300 bg-white"}`}>
            <div className="p-3 grid grid-cols-2 gap-3">
              {/* Specimen name */}
              <div className="col-span-2">
                <Field label="Specimen Name" required errorKey="specimen_name">
                  <input
                    type="text"
                    value={formData.specimen_name}
                    onChange={(e) => handleChange("specimen_name", e.target.value)}
                    className={`${inputBase} ${inputError("specimen_name")} keyboard-trigger`}
                    data-keyboard="1"
                    data-field="specimen_name"  // ✅ IMPORTANT
                  />
                </Field>
              </div>

              {/* test type */}
              <div className="col-span-2">
                <Field label="Test Type" required errorKey="test_type">
                  <input
                    type="text"
                    value={formData.test_type}
                    onChange={(e) => handleChange("test_type", e.target.value)}
                    className={`${inputBase} ${inputError("test_type")} keyboard-trigger`}
                    data-keyboard="1"
                    data-field="test_type" // ✅ IMPORTANT
                  />
                </Field>
              </div>

              {/* reference species */}
              <div className="col-span-2">
                <Field label="Reference Species">
                  <select
                    value={formData.species_id || ""}
                    onChange={(e) =>
                      handleChange("species_id", e.target.value ? parseInt(e.target.value, 10) : null)
                    }
                    className={inputBase}
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

              {/* numeric fields */}
              <Field label="Base (mm)" required errorKey="base">
                <input
                  type="text"
                  inputMode="decimal"
                  value={formData.base}
                  onChange={(e) => handleChange("base", e.target.value)}
                  className={`${inputBase} ${inputError("base")} keyboard-trigger`}
                  data-keyboard="1"
                  data-field="base"
                />
              </Field>

              <Field label="Height (mm)" required errorKey="height">
                <input
                  type="text"
                  inputMode="decimal"
                  value={formData.height}
                  onChange={(e) => handleChange("height", e.target.value)}
                  className={`${inputBase} ${inputError("height")} keyboard-trigger`}
                  data-keyboard="1"
                  data-field="height"
                />
              </Field>

              <Field label="Length (mm)" required errorKey="length">
                <input
                  type="text"
                  inputMode="decimal"
                  value={formData.length}
                  onChange={(e) => handleChange("length", e.target.value)}
                  className={`${inputBase} ${inputError("length")} keyboard-trigger`}
                  data-keyboard="1"
                  data-field="length"
                />
              </Field>

              <Field label="Area (mm²)" required errorKey="area">
                <input
                  type="text"
                  inputMode="decimal"
                  value={formData.area}
                  onChange={(e) => handleChange("area", e.target.value)}
                  className={`${inputBase} ${inputError("area")} keyboard-trigger`}
                  data-keyboard="1"
                  data-field="area"
                />
              </Field>

              <Field label="Maximum Force (N)" required errorKey="max_force">
                <input
                  type="text"
                  inputMode="decimal"
                  value={formData.max_force}
                  onChange={(e) => handleChange("max_force", e.target.value)}
                  className={`${inputBase} ${inputError("max_force")} keyboard-trigger`}
                  data-keyboard="1"
                  data-field="max_force"
                />
              </Field>

              <Field label="Stress (MPa)" required errorKey="stress">
                <input
                  type="text"
                  inputMode="decimal"
                  value={formData.stress}
                  onChange={(e) => handleChange("stress", e.target.value)}
                  className={`${inputBase} ${inputError("stress")} keyboard-trigger`}
                  data-keyboard="1"
                  data-field="stress"
                />
              </Field>

              <div className="col-span-2">
                <Field label="Moisture Content (%)">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={formData.moisture_content}
                    onChange={(e) => handleChange("moisture_content", e.target.value)}
                    className={`${inputBase} keyboard-trigger`}
                    data-keyboard="1"
                    data-field="moisture_content"
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
            className={`flex-1 py-3 rounded-lg font-extrabold text-[13px] transition-all ${
              darkMode ? "bg-gray-800 text-gray-100 hover:bg-gray-700" : "bg-gray-200 text-gray-900 hover:bg-gray-300"
            }`}
            type="button"
          >
            Cancel
          </button>

          <button
            onClick={handleSubmit}
            disabled={saving}
            className={`flex-1 py-3 rounded-lg font-extrabold text-[13px] transition-all ${
              saving
                ? darkMode
                  ? "bg-gray-800 text-gray-400 cursor-not-allowed"
                  : "bg-gray-200 text-gray-500 cursor-not-allowed"
                : "bg-blue-600 text-white hover:bg-blue-700"
            }`}
            type="button"
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
