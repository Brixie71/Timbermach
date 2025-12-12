import React, { useState, useEffect } from "react";

// Save Confirmation Modal Component
const SaveConfirmationModal = ({
  isOpen,
  onClose,
  onConfirm,
  darkMode = false,
}) => {
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
        {/* Header */}
        <div
          className={`px-6 py-4 border-b-2 ${
            darkMode
              ? "bg-gray-900 border-gray-700"
              : "bg-gray-100 border-gray-300"
          }`}
        >
          <h3
            className={`text-xl font-bold ${
              darkMode ? "text-gray-100" : "text-gray-900"
            }`}
          >
            Confirm Save Changes
          </h3>
        </div>

        {/* Content */}
        <div className="p-6">
          <p
            className={`text-lg mb-6 ${
              darkMode ? "text-gray-300" : "text-gray-700"
            }`}
          >
            Are you sure you want to save these changes? This will update the
            reference value in the database.
          </p>

          {/* Buttons */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className={`flex-1 py-3 font-semibold transition-all ${
                darkMode
                  ? "bg-gray-700 text-gray-200 hover:bg-gray-600"
                  : "bg-gray-300 text-gray-900 hover:bg-gray-400"
              }`}
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
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

// Success Modal Component
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
        {/* Success Icon */}
        <div className="flex justify-center pt-8">
          <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center">
            <svg
              className="w-10 h-10 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={3}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 text-center">
          <h3
            className={`text-2xl font-bold mb-2 ${
              darkMode ? "text-gray-100" : "text-gray-900"
            }`}
          >
            Success!
          </h3>
          <p
            className={`text-lg mb-6 ${
              darkMode ? "text-gray-300" : "text-gray-700"
            }`}
          >
            Reference value updated successfully
          </p>

          <button
            onClick={onClose}
            className="w-full py-3 font-semibold bg-green-500 text-white hover:bg-green-600 transition-all"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
};

const RVEdit = ({ data, darkMode = true, onClose, onSave }) => {
  const API_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

  const [formData, setFormData] = useState({
    strength_group: "high",
    common_name: "",
    botanical_name: "",
    compression_parallel: "",
    compression_perpendicular: "",
    shear_parallel: "",
    bending_tension_parallel: "",
  });

  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  useEffect(() => {
    // Initialize form data
    if (data) {
      setFormData({
        id: data.id,
        strength_group: data.strength_group || "high",
        common_name: data.common_name || "",
        botanical_name: data.botanical_name || "",
        compression_parallel: data.compression_parallel || "",
        compression_perpendicular: data.compression_perpendicular || "",
        shear_parallel: data.shear_parallel || "",
        bending_tension_parallel: data.bending_tension_parallel || "",
      });
    }
  }, [data]);

  const handleChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));

    // Clear error for this field
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.common_name.trim()) {
      newErrors.common_name = "Common name is required";
    }

    const numericFields = [
      "compression_parallel",
      "compression_perpendicular",
      "shear_parallel",
      "bending_tension_parallel",
    ];
    numericFields.forEach((field) => {
      const value = parseFloat(formData[field]);
      if (isNaN(value) || value <= 0) {
        newErrors[field] =
          `${field.replace("_", " ")} must be a positive number`;
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    // Show confirmation modal instead of saving immediately
    setShowSaveModal(true);
  };

  const confirmSave = async () => {
    setShowSaveModal(false);
    setSaving(true);

    try {
      const url = formData.id
        ? `${API_URL}/api/reference-values/${formData.id}`
        : `${API_URL}/api/reference-values`;

      const method = formData.id ? "PUT" : "POST";

      const updatePayload = {
        strength_group: formData.strength_group,
        common_name: formData.common_name,
        botanical_name: formData.botanical_name || null,
        compression_parallel: parseFloat(formData.compression_parallel),
        compression_perpendicular: parseFloat(
          formData.compression_perpendicular,
        ),
        shear_parallel: parseFloat(formData.shear_parallel),
        bending_tension_parallel: parseFloat(formData.bending_tension_parallel),
      };

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatePayload),
      });

      if (!response.ok) {
        throw new Error("Failed to save reference value");
      }

      // Show success modal
      setShowSuccessModal(true);
    } catch (error) {
      console.error("Error saving data:", error);
      alert(`Failed to save: ${error.message}`);
      setSaving(false);
    }
  };

  const handleSuccessClose = () => {
    setShowSuccessModal(false);
    setSaving(false);
    onSave();
    onClose();
  };

  const getTitle = () => {
    if (data?.id) {
      return `Edit Reference Value | ${formData.common_name || "Unknown"}`;
    }
    return "Add New Reference Value";
  };

  return (
    <div
      className={`relative w-full h-full ${darkMode ? "bg-gray-900" : "bg-white"}`}
    >
      {/* Header */}
      <div
        className={`flex items-center justify-between px-6 py-3 border-b-2 ${
          darkMode ? "border-gray-700 bg-gray-800" : "border-black bg-gray-100"
        }`}
      >
        <h2
          className={`text-2xl font-bold ${darkMode ? "text-gray-100" : "text-gray-900"}`}
        >
          {getTitle()}
        </h2>
        <button
          onClick={onClose}
          className={`text-3xl ${darkMode ? "text-gray-200 hover:text-gray-400" : "text-gray-900 hover:text-gray-600"}`}
        >
          ✕
        </button>
      </div>

      {/* Form Content */}
      <div className="h-[calc(100%-60px)] overflow-y-auto">
        <div className="p-6 space-y-6">
          {/* Strength Group */}
          <div>
            <label
              className={`block text-sm font-semibold mb-2 ${
                darkMode ? "text-gray-300" : "text-gray-900"
              }`}
            >
              Strength Group <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.strength_group}
              onChange={(e) => handleChange("strength_group", e.target.value)}
              className={`w-full px-4 py-3 border-2 focus:outline-none ${
                errors.strength_group
                  ? "border-red-500"
                  : darkMode
                    ? "bg-gray-800 border-gray-600 text-gray-100 focus:border-blue-400"
                    : "bg-white border-gray-300 text-gray-900 focus:border-blue-500"
              }`}
            >
              <option value="high">High Strength Group</option>
              <option value="moderately_high">
                Moderately High Strength Group
              </option>
              <option value="medium">Medium Strength Group</option>
            </select>
            {errors.strength_group && (
              <p className="text-red-500 text-sm mt-1">
                {errors.strength_group}
              </p>
            )}
          </div>

          {/* Common Name */}
          <div>
            <label
              className={`block text-sm font-semibold mb-2 ${
                darkMode ? "text-gray-300" : "text-gray-900"
              }`}
            >
              Common Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.common_name}
              onChange={(e) => handleChange("common_name", e.target.value)}
              placeholder="e.g., Narra"
              className={`w-full px-4 py-3 border-2 focus:outline-none ${
                errors.common_name
                  ? "border-red-500"
                  : darkMode
                    ? "bg-gray-800 border-gray-600 text-gray-100 focus:border-blue-400 placeholder-gray-500"
                    : "bg-white border-gray-300 text-gray-900 focus:border-blue-500 placeholder-gray-400"
              }`}
            />
            {errors.common_name && (
              <p className="text-red-500 text-sm mt-1">{errors.common_name}</p>
            )}
          </div>

          {/* Botanical Name */}
          <div>
            <label
              className={`block text-sm font-semibold mb-2 ${
                darkMode ? "text-gray-300" : "text-gray-900"
              }`}
            >
              Botanical Name
            </label>
            <input
              type="text"
              value={formData.botanical_name}
              onChange={(e) => handleChange("botanical_name", e.target.value)}
              placeholder="e.g., Pterocarpus indicus"
              className={`w-full px-4 py-3 border-2 focus:outline-none ${
                darkMode
                  ? "bg-gray-800 border-gray-600 text-gray-100 focus:border-blue-400 placeholder-gray-500"
                  : "bg-white border-gray-300 text-gray-900 focus:border-blue-500 placeholder-gray-400"
              }`}
            />
          </div>

          {/* Mechanical Properties Grid */}
          <div className="grid grid-cols-2 gap-4">
            {/* Compression Parallel */}
            <div>
              <label
                className={`block text-sm font-semibold mb-2 ${
                  darkMode ? "text-gray-300" : "text-gray-900"
                }`}
              >
                Compression Parallel (Fc) *{" "}
                <span className="text-xs font-normal">(MPa)</span>
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.compression_parallel}
                onChange={(e) =>
                  handleChange("compression_parallel", e.target.value)
                }
                placeholder="0.00"
                className={`w-full px-4 py-3 border-2 focus:outline-none ${
                  errors.compression_parallel
                    ? "border-red-500"
                    : darkMode
                      ? "bg-gray-800 border-gray-600 text-gray-100 focus:border-blue-400 placeholder-gray-500"
                      : "bg-white border-gray-300 text-gray-900 focus:border-blue-500 placeholder-gray-400"
                }`}
              />
              {errors.compression_parallel && (
                <p className="text-red-500 text-sm mt-1">
                  {errors.compression_parallel}
                </p>
              )}
            </div>

            {/* Compression Perpendicular */}
            <div>
              <label
                className={`block text-sm font-semibold mb-2 ${
                  darkMode ? "text-gray-300" : "text-gray-900"
                }`}
              >
                Compression Perpendicular (Fc⊥) *{" "}
                <span className="text-xs font-normal">(MPa)</span>
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.compression_perpendicular}
                onChange={(e) =>
                  handleChange("compression_perpendicular", e.target.value)
                }
                placeholder="0.00"
                className={`w-full px-4 py-3 border-2 focus:outline-none ${
                  errors.compression_perpendicular
                    ? "border-red-500"
                    : darkMode
                      ? "bg-gray-800 border-gray-600 text-gray-100 focus:border-blue-400 placeholder-gray-500"
                      : "bg-white border-gray-300 text-gray-900 focus:border-blue-500 placeholder-gray-400"
                }`}
              />
              {errors.compression_perpendicular && (
                <p className="text-red-500 text-sm mt-1">
                  {errors.compression_perpendicular}
                </p>
              )}
            </div>

            {/* Shear Parallel */}
            <div>
              <label
                className={`block text-sm font-semibold mb-2 ${
                  darkMode ? "text-gray-300" : "text-gray-900"
                }`}
              >
                Shear Parallel (Fv) *{" "}
                <span className="text-xs font-normal">(MPa)</span>
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.shear_parallel}
                onChange={(e) => handleChange("shear_parallel", e.target.value)}
                placeholder="0.00"
                className={`w-full px-4 py-3 border-2 focus:outline-none ${
                  errors.shear_parallel
                    ? "border-red-500"
                    : darkMode
                      ? "bg-gray-800 border-gray-600 text-gray-100 focus:border-blue-400 placeholder-gray-500"
                      : "bg-white border-gray-300 text-gray-900 focus:border-blue-500 placeholder-gray-400"
                }`}
              />
              {errors.shear_parallel && (
                <p className="text-red-500 text-sm mt-1">
                  {errors.shear_parallel}
                </p>
              )}
            </div>

            {/* Bending & Tension */}
            <div>
              <label
                className={`block text-sm font-semibold mb-2 ${
                  darkMode ? "text-gray-300" : "text-gray-900"
                }`}
              >
                Bending & Tension (FbFt) *{" "}
                <span className="text-xs font-normal">(MPa)</span>
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.bending_tension_parallel}
                onChange={(e) =>
                  handleChange("bending_tension_parallel", e.target.value)
                }
                placeholder="0.00"
                className={`w-full px-4 py-3 border-2 focus:outline-none ${
                  errors.bending_tension_parallel
                    ? "border-red-500"
                    : darkMode
                      ? "bg-gray-800 border-gray-600 text-gray-100 focus:border-blue-400 placeholder-gray-500"
                      : "bg-white border-gray-300 text-gray-900 focus:border-blue-500 placeholder-gray-400"
                }`}
              />
              {errors.bending_tension_parallel && (
                <p className="text-red-500 text-sm mt-1">
                  {errors.bending_tension_parallel}
                </p>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4 pt-4">
            <button
              onClick={onClose}
              className={`flex-1 py-3 font-bold text-lg transition-all ${
                darkMode
                  ? "bg-gray-700 text-gray-200 hover:bg-gray-600"
                  : "bg-gray-300 text-gray-900 hover:bg-gray-400"
              }`}
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving}
              className={`flex-1 py-3 font-bold text-lg transition-all ${
                saving
                  ? "bg-gray-400 text-gray-600 cursor-not-allowed"
                  : "bg-blue-500 text-white hover:bg-blue-600 active:scale-[0.99]"
              }`}
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      </div>

      {/* Save Confirmation Modal */}
      <SaveConfirmationModal
        isOpen={showSaveModal}
        onClose={() => setShowSaveModal(false)}
        onConfirm={confirmSave}
        darkMode={darkMode}
      />

      {/* Success Modal */}
      <SuccessModal
        isOpen={showSuccessModal}
        onClose={handleSuccessClose}
        darkMode={darkMode}
      />
    </div>
  );
};

export default RVEdit;
