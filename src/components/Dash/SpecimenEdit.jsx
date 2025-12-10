import React, { useState, useEffect } from 'react';
import axios from 'axios';

// Save Confirmation Modal Component
const SaveConfirmationModal = ({ isOpen, onClose, onConfirm, darkMode = false }) => {
  if (!isOpen) return null;

  return (
    <div 
      className="absolute inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div 
        className={`shadow-2xl overflow-hidden max-w-md w-full mx-4 ${
          darkMode ? 'bg-gray-800' : 'bg-white'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`px-6 py-4 border-b-2 ${
          darkMode ? 'bg-gray-900 border-gray-700' : 'bg-gray-100 border-gray-300'
        }`}>
          <h3 className={`text-xl font-bold ${
            darkMode ? 'text-gray-100' : 'text-gray-900'
          }`}>
            Confirm Save Changes
          </h3>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className={`text-lg mb-6 ${
            darkMode ? 'text-gray-300' : 'text-gray-700'
          }`}>
            Are you sure you want to save these changes? This will update the specimen data in the database.
          </p>

          {/* Buttons */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className={`flex-1 py-3 font-semibold transition-all ${
                darkMode
                  ? 'bg-gray-700 text-gray-200 hover:bg-gray-600'
                  : 'bg-gray-300 text-gray-900 hover:bg-gray-400'
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
          darkMode ? 'bg-gray-800' : 'bg-white'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Success Icon */}
        <div className="flex justify-center pt-8">
          <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 text-center">
          <h3 className={`text-2xl font-bold mb-2 ${
            darkMode ? 'text-gray-100' : 'text-gray-900'
          }`}>
            Success!
          </h3>
          <p className={`text-lg mb-6 ${
            darkMode ? 'text-gray-300' : 'text-gray-700'
          }`}>
            Data updated successfully
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

const SpecimenEdit = ({ data, dataType, darkMode = false, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    specimen_name: '',
    test_type: '',
    base: '',
    height: '',
    length: '',
    area: '',
    max_force: '',
    stress: '',
    moisture_content: '',
    species_id: null
  });

  const [species, setSpecies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  useEffect(() => {
    // Initialize form data
    if (data) {
      setFormData({
        specimen_name: data.specimen_name || data['Specimen Name'] || '',
        test_type: data.test_type || data['Test Type'] || '',
        base: data.base || data['Base'] || '',
        height: data.height || data['Height'] || '',
        length: data.length || data['Length'] || '',
        area: data.area || data['Area'] || '',
        max_force: data.max_force || data['Maximum Force'] || '',
        stress: data.stress || data['Stress'] || '',
        moisture_content: data.moisture_content || data['Moisture Content'] || '',
        species_id: data.species_id || null
      });
    }
    fetchSpecies();
  }, [data]);

  const fetchSpecies = async () => {
    setLoading(true);
    try {
      const response = await axios.get('http://127.0.0.1:8000/api/species-reference');
      setSpecies(response.data);
    } catch (error) {
      console.error('Error fetching species:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));

    // Clear error for this field
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }

    // Auto-calculate area when base or height changes
    if (field === 'base' || field === 'height') {
      const base = field === 'base' ? parseFloat(value) : parseFloat(formData.base);
      const height = field === 'height' ? parseFloat(value) : parseFloat(formData.height);
      
      if (!isNaN(base) && !isNaN(height) && base > 0 && height > 0) {
        setFormData(prev => ({
          ...prev,
          [field]: value,
          area: (base * height).toFixed(2)
        }));
      }
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.specimen_name.trim()) {
      newErrors.specimen_name = 'Specimen name is required';
    }

    if (!formData.test_type.trim()) {
      newErrors.test_type = 'Test type is required';
    }

    const numericFields = ['base', 'height', 'length', 'area', 'max_force', 'stress'];
    numericFields.forEach(field => {
      const value = parseFloat(formData[field]);
      if (isNaN(value) || value <= 0) {
        newErrors[field] = `${field.replace('_', ' ')} must be a positive number`;
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
      const specimenId = data.compressive_id || data.shear_id || data.flexure_id;
      
      const updatePayload = {
        specimen_name: formData.specimen_name,
        test_type: formData.test_type,
        base: parseFloat(formData.base),
        height: parseFloat(formData.height),
        length: parseFloat(formData.length),
        area: parseFloat(formData.area),
        max_force: parseFloat(formData.max_force),
        stress: parseFloat(formData.stress),
        moisture_content: formData.moisture_content || null,
        species_id: formData.species_id
      };

      await axios.put(
        `http://127.0.0.1:8000/api/${dataType}-data/${specimenId}`,
        updatePayload
      );

      // Show success modal
      setShowSuccessModal(true);
      
    } catch (error) {
      console.error('Error updating data:', error);
      alert(`Failed to update: ${error.response?.data?.detail || error.message}`);
      setSaving(false);
    }
  };

  const handleSuccessClose = () => {
    setShowSuccessModal(false);
    setSaving(false);
    onSave();
    onClose();
  };

  const getTestTypeLabel = () => {
    switch(dataType) {
      case 'compressive':
        return 'Compressive Test';
      case 'shear':
        return 'Shear Test';
      case 'flexure':
        return 'Flexure Test';
      default:
        return 'Test';
    }
  };

  return (
    <div className={`relative w-full h-full ${darkMode ? 'bg-gray-900' : 'bg-white'}`}>
        {/* Header */}
        <div className={`flex items-center justify-between px-6 py-4 border-b-2 ${
          darkMode ? 'border-gray-700 bg-gray-800' : 'border-black bg-gray-100'
        }`}>
        <h2 className={`text-xl font-bold ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>
          Edit | {getTestTypeLabel()} | {formData.specimen_name || 'Unknown'}
        </h2>
        <button 
          onClick={onClose}
          className={`text-2xl ${darkMode ? 'text-gray-200 hover:text-gray-400' : 'text-gray-900 hover:text-gray-600'}`}
        >
          ✕
        </button>
      </div>

      {/* Form Content */}
      <div className="h-[calc(100%-60px)] overflow-y-auto">
        <div className="p-6 space-y-6">
          {/* Specimen Name */}
          <div>
            <label className={`block text-sm font-semibold mb-2 ${
              darkMode ? 'text-gray-300' : 'text-gray-900'
            }`}>
              Specimen Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.specimen_name}
              onChange={(e) => handleChange('specimen_name', e.target.value)}
              className={`w-full px-4 py-3 border-2 focus:outline-none ${
                errors.specimen_name
                  ? 'border-red-500'
                  : darkMode
                    ? 'bg-gray-800 border-gray-600 text-gray-100 focus:border-blue-400'
                    : 'bg-white border-gray-300 text-gray-900 focus:border-blue-500'
              }`}
            />
            {errors.specimen_name && (
              <p className="text-red-500 text-sm mt-1">{errors.specimen_name}</p>
            )}
          </div>

          {/* Test Type */}
          <div>
            <label className={`block text-sm font-semibold mb-2 ${
              darkMode ? 'text-gray-300' : 'text-gray-900'
            }`}>
              Test Type <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.test_type}
              onChange={(e) => handleChange('test_type', e.target.value)}
              className={`w-full px-4 py-3 border-2 focus:outline-none ${
                errors.test_type
                  ? 'border-red-500'
                  : darkMode
                    ? 'bg-gray-800 border-gray-600 text-gray-100 focus:border-blue-400'
                    : 'bg-white border-gray-300 text-gray-900 focus:border-blue-500'
              }`}
            >
              <option value="">Select Test Type</option>
              {dataType === 'compressive' && (
                <>
                  <option value="Parallel">Parallel to Grain</option>
                  <option value="Perpendicular">Perpendicular to Grain</option>
                </>
              )}
              {dataType === 'shear' && (
                <>
                  <option value="Single">Single Shear</option>
                  <option value="Double">Double Shear</option>
                </>
              )}
              {dataType === 'flexure' && (
                <option value="Flexure">Flexure Test</option>
              )}
            </select>
            {errors.test_type && (
              <p className="text-red-500 text-sm mt-1">{errors.test_type}</p>
            )}
          </div>

          {/* Reference Species */}
          <div>
            <label className={`block text-sm font-semibold mb-2 ${
              darkMode ? 'text-gray-300' : 'text-gray-900'
            }`}>
              Reference Species
            </label>
            <select
              value={formData.species_id || ''}
              onChange={(e) => handleChange('species_id', e.target.value ? parseInt(e.target.value) : null)}
              className={`w-full px-4 py-3 border-2 focus:outline-none ${
                darkMode
                  ? 'bg-gray-800 border-gray-600 text-gray-100 focus:border-blue-400'
                  : 'bg-white border-gray-300 text-gray-900 focus:border-blue-500'
              }`}
            >
              <option value="">No Reference Selected</option>
              {species.map(s => (
                <option key={s.species_id} value={s.species_id}>
                  {s.common_name || s.species_name || s.botanical_name}
                </option>
              ))}
            </select>
          </div>

          {/* Dimensions Grid */}
          <div className="grid grid-cols-2 gap-4">
            {/* Base */}
            <div>
              <label className={`block text-sm font-semibold mb-2 ${
                darkMode ? 'text-gray-300' : 'text-gray-900'
              }`}>
                Base (mm) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.base}
                onChange={(e) => handleChange('base', e.target.value)}
                className={`w-full px-4 py-3 border-2 focus:outline-none ${
                  errors.base
                    ? 'border-red-500'
                    : darkMode
                      ? 'bg-gray-800 border-gray-600 text-gray-100 focus:border-blue-400'
                      : 'bg-white border-gray-300 text-gray-900 focus:border-blue-500'
                }`}
              />
              {errors.base && (
                <p className="text-red-500 text-sm mt-1">{errors.base}</p>
              )}
            </div>

            {/* Height */}
            <div>
              <label className={`block text-sm font-semibold mb-2 ${
                darkMode ? 'text-gray-300' : 'text-gray-900'
              }`}>
                Height (mm) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.height}
                onChange={(e) => handleChange('height', e.target.value)}
                className={`w-full px-4 py-3 border-2 focus:outline-none ${
                  errors.height
                    ? 'border-red-500'
                    : darkMode
                      ? 'bg-gray-800 border-gray-600 text-gray-100 focus:border-blue-400'
                      : 'bg-white border-gray-300 text-gray-900 focus:border-blue-500'
                }`}
              />
              {errors.height && (
                <p className="text-red-500 text-sm mt-1">{errors.height}</p>
              )}
            </div>

            {/* Length */}
            <div>
              <label className={`block text-sm font-semibold mb-2 ${
                darkMode ? 'text-gray-300' : 'text-gray-900'
              }`}>
                Length (mm) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.length}
                onChange={(e) => handleChange('length', e.target.value)}
                className={`w-full px-4 py-3 border-2 focus:outline-none ${
                  errors.length
                    ? 'border-red-500'
                    : darkMode
                      ? 'bg-gray-800 border-gray-600 text-gray-100 focus:border-blue-400'
                      : 'bg-white border-gray-300 text-gray-900 focus:border-blue-500'
                }`}
              />
              {errors.length && (
                <p className="text-red-500 text-sm mt-1">{errors.length}</p>
              )}
            </div>

            {/* Area */}
            <div>
              <label className={`block text-sm font-semibold mb-2 ${
                darkMode ? 'text-gray-300' : 'text-gray-900'
              }`}>
                Area (mm²) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.area}
                onChange={(e) => handleChange('area', e.target.value)}
                className={`w-full px-4 py-3 border-2 focus:outline-none ${
                  errors.area
                    ? 'border-red-500'
                    : darkMode
                      ? 'bg-gray-800 border-gray-600 text-gray-100 focus:border-blue-400'
                      : 'bg-white border-gray-300 text-gray-900 focus:border-blue-500'
                }`}
              />
              {errors.area && (
                <p className="text-red-500 text-sm mt-1">{errors.area}</p>
              )}
            </div>
          </div>

          {/* Force and Stress Grid */}
          <div className="grid grid-cols-2 gap-4">
            {/* Maximum Force */}
            <div>
              <label className={`block text-sm font-semibold mb-2 ${
                darkMode ? 'text-gray-300' : 'text-gray-900'
              }`}>
                Maximum Force (N) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.max_force}
                onChange={(e) => handleChange('max_force', e.target.value)}
                className={`w-full px-4 py-3 border-2 focus:outline-none ${
                  errors.max_force
                    ? 'border-red-500'
                    : darkMode
                      ? 'bg-gray-800 border-gray-600 text-gray-100 focus:border-blue-400'
                      : 'bg-white border-gray-300 text-gray-900 focus:border-blue-500'
                }`}
              />
              {errors.max_force && (
                <p className="text-red-500 text-sm mt-1">{errors.max_force}</p>
              )}
            </div>

            {/* Stress */}
            <div>
              <label className={`block text-sm font-semibold mb-2 ${
                darkMode ? 'text-gray-300' : 'text-gray-900'
              }`}>
                Stress (MPa) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.stress}
                onChange={(e) => handleChange('stress', e.target.value)}
                className={`w-full px-4 py-3 border-2 focus:outline-none ${
                  errors.stress
                    ? 'border-red-500'
                    : darkMode
                      ? 'bg-gray-800 border-gray-600 text-gray-100 focus:border-blue-400'
                      : 'bg-white border-gray-300 text-gray-900 focus:border-blue-500'
                }`}
              />
              {errors.stress && (
                <p className="text-red-500 text-sm mt-1">{errors.stress}</p>
              )}
            </div>
          </div>

          {/* Moisture Content */}
          <div>
            <label className={`block text-sm font-semibold mb-2 ${
              darkMode ? 'text-gray-300' : 'text-gray-900'
            }`}>
              Moisture Content (%)
            </label>
            <input
              type="number"
              step="0.01"
              value={formData.moisture_content}
              onChange={(e) => handleChange('moisture_content', e.target.value)}
              placeholder="Optional"
              className={`w-full px-4 py-3 border-2 focus:outline-none ${
                darkMode
                  ? 'bg-gray-800 border-gray-600 text-gray-100 placeholder-gray-500 focus:border-blue-400'
                  : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-blue-500'
              }`}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4 pt-4">
            <button
              onClick={onClose}
              className={`flex-1 py-3 font-bold text-lg transition-all ${
                darkMode
                  ? 'bg-gray-700 text-gray-200 hover:bg-gray-600'
                  : 'bg-gray-300 text-gray-900 hover:bg-gray-400'
              }`}
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving}
              className={`flex-1 py-3 font-bold text-lg transition-all ${
                saving
                  ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
                  : 'bg-blue-500 text-white hover:bg-blue-600 active:scale-[0.99]'
              }`}
            >
              {saving ? 'Saving...' : 'Save Changes'}
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

export default SpecimenEdit;