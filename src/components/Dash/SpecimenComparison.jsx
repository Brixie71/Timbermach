import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FaArrowLeft, FaSearch } from "react-icons/fa";

const SpecimenComparison = ({ data, dataType, darkMode = false, onClose, onSave }) => {
  const [referenceData, setReferenceData] = useState(null);
  const [allReferenceData, setAllReferenceData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedSpecies, setSelectedSpecies] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredData, setFilteredData] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    fetchAllReferenceData();
    if (data && data.species_id) {
      fetchReferenceData(data.species_id);
    }
  }, [data]);

  useEffect(() => {
    // Filter reference data based on search query
    // Only show dropdown if there's text in search
    if (searchQuery.trim()) {
      const filtered = allReferenceData.filter(item => 
        item.species_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.common_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.botanical_name?.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredData(filtered);
      setShowDropdown(true);
    } else {
      setFilteredData(allReferenceData);
      setShowDropdown(false); // Hide dropdown when empty
    }
  }, [searchQuery, allReferenceData]);

  const fetchAllReferenceData = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`http://127.0.0.1:8000/api/reference-values`);
      setAllReferenceData(response.data);
      setFilteredData(response.data);
    } catch (error) {
      console.error('Error fetching all reference data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchReferenceData = async (speciesId) => {
    try {
      const response = await axios.get(`http://127.0.0.1:8000/api/reference-values/${speciesId}`);
      setReferenceData(response.data);
      setSelectedSpecies(response.data);
    } catch (error) {
      console.error('Error fetching reference data:', error);
    }
  };

  const handleSpeciesSelect = (species) => {
    setSelectedSpecies(species);
    setSearchQuery(species.common_name || species.species_name || species.botanical_name);
    setShowDropdown(false);
  };

  const calculateExperimentalStress = () => {
    if (!data) return 0;
    const maxForce = parseFloat(data.max_force) || parseFloat(data?.['Maximum Force']) || 0;
    const area = parseFloat(data.area) || 1;
    const base = parseFloat(data.base) || 0;
    const height = parseFloat(data.height) || 0;
    const length = parseFloat(data.length) || 100;
    
    switch(dataType) {
      case 'compressive':
        return maxForce / area;
      case 'shear':
        const isDoubleShear = data?.test_type?.toLowerCase().includes('double');
        return isDoubleShear ? maxForce / (2 * area) : maxForce / area;
      case 'flexure':
        const M = (maxForce * length) / 4;
        const c = height / 2;
        const I = (base * Math.pow(height, 3)) / 12;
        return (M * c) / I;
      default:
        return 0;
    }
  };

  const getReferenceValue = (species = selectedSpecies) => {
    if (!species) return 0;
    switch(dataType) {
      case 'compressive':
        return parseFloat(species.compression_parallel) || 0;
      case 'shear':
        return parseFloat(species.shear_parallel) || 0;
      case 'flexure':
        return parseFloat(species.bending_tension_parallel) || 0;
      default:
        return 0;
    }
  };

  const handleSaveComparison = async () => {
    if (!selectedSpecies) {
      alert('Please select a species to compare with');
      return;
    }

    setSaving(true);
    setSaveSuccess(false);

    try {
      const specimenId = data.compressive_id || data.shear_id || data.flexure_id;
      
      if (!specimenId) {
        throw new Error('No specimen ID found');
      }

      const speciesIdToSave = selectedSpecies.id || selectedSpecies.species_id;
      
      const updatePayload = {
        specimen_name: data.specimen_name || data['Specimen Name'],
        test_type: data.test_type || data['Test Type'],
        base: parseFloat(data.base || data['Base']) || 0,
        height: parseFloat(data.height || data['Height']) || 0,
        length: parseFloat(data.length || data['Length']) || 0,
        area: parseFloat(data.area || data['Area']) || 0,
        max_force: parseFloat(data.max_force || data['Maximum Force']) || 0,
        stress: parseFloat(data.stress || data['Stress']) || 0,
        pressure: data.pressure || null,
        moisture_content: data.moisture_content || data['Moisture Content'] || null,
        species_id: speciesIdToSave
      };

      await axios.put(
        `http://127.0.0.1:8000/api/${dataType}-data/${specimenId}`,
        updatePayload
      );

      setSaveSuccess(true);
      
      // Show success message
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Close and refresh
      onClose();

    } catch (error) {
      console.error('Error saving comparison:', error);
      alert(`Failed to save: ${error.response?.data?.detail || error.message}`);
      setSaving(false);
    }
  };

  const experimentalStress = calculateExperimentalStress();
  const referenceStress = getReferenceValue();
  const accuracy = referenceStress > 0 
    ? ((experimentalStress / referenceStress) * 100).toFixed(2) 
    : 0;
  
  // Comparison Metrics
  const difference = (experimentalStress - referenceStress).toFixed(2);
  const percentageDifference = referenceStress > 0 
    ? (((experimentalStress - referenceStress) / referenceStress) * 100).toFixed(2)
    : 0;
  const comparisonRatio = referenceStress > 0 
    ? (experimentalStress / referenceStress).toFixed(3)
    : 0;

  return (
    <div className={`w-full h-full flex flex-col ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
      {/* Fixed Header */}
      <div className={`flex items-center justify-between px-4 py-2 border-b ${
        darkMode ? 'border-gray-700 bg-gray-900' : 'border-black bg-gray-50'
      }`}>
        <h2 className={`text-lg font-semibold ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>
          Comparison | {data?.specimen_name || data?.['Specimen Name'] || 'Unknown'}
        </h2>
        <button
          onClick={onClose}
          className={`text-2xl ${darkMode ? 'text-gray-200 hover:text-gray-400' : 'text-gray-900 hover:text-gray-600'}`}
        >
          <FaArrowLeft />
        </button>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        <div>
          {/* Dropdown Search */}
          <div className="relative border-b ${darkMode ? 'border-gray-700' : 'border-black'}">
            <div className={`flex items-center gap-2 px-4 py-2 border ${
              darkMode 
                ? 'bg-gray-700 border-gray-600 text-gray-100' 
                : 'bg-white border-gray-300 text-gray-900'
            }`}>
              <FaSearch className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`} />
              <input
                type="text"
                placeholder="Select Wood Species for Comparison"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => {
                  if (searchQuery.trim()) {
                    setShowDropdown(true);
                  }
                }}
                className={`flex-1 text-sm bg-transparent outline-none ${
                  darkMode ? 'placeholder-gray-400' : 'placeholder-gray-500'
                }`}
              />
            </div>

            {/* Dropdown List - Only shows when there's text */}
            {showDropdown && searchQuery.trim() && (
              <div className={`absolute top-full left-0 right-0 max-h-60 overflow-y-auto border shadow-lg z-10 ${
                darkMode 
                  ? 'bg-gray-700 border-gray-600' 
                  : 'bg-white border-gray-300'
              }`}>
                {filteredData.length > 0 ? (
                  filteredData.map((species, index) => {
                    const refValue = getReferenceValue(species);
                    const speciesAccuracy = refValue > 0 
                      ? ((experimentalStress / refValue) * 100).toFixed(2)
                      : '0.00';
                    
                    return (
                      <div
                        key={species.id || species.species_id || index}
                        onClick={() => handleSpeciesSelect(species)}
                        className={`px-4 py-3 cursor-pointer transition-colors border-b last:border-b-0 ${
                          darkMode 
                            ? 'border-gray-600 hover:bg-gray-600' 
                            : 'border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex justify-between items-center">
                          <div className={`text-sm font-medium ${darkMode ? 'text-gray-200' : 'text-gray-900'}`}>
                            {species.common_name || species.species_name || species.botanical_name || 'Unknown'}
                          </div>
                          <div className={`text-xs font-semibold ${darkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                            {speciesAccuracy}%
                          </div>
                        </div>
                        {species.botanical_name && species.botanical_name !== species.common_name && (
                          <div className={`text-xs mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                            {species.botanical_name}
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className={`px-4 py-8 text-center text-sm ${
                    darkMode ? 'text-gray-400' : 'text-gray-500'
                  }`}>
                    No species found matching "{searchQuery}"
                  </div>
                )}
              </div>
            )}
          </div>

          {selectedSpecies ? (
            <>
              {/* 1. Accuracy Percentage */}
              <div className={`px-4 py-3 text-center border-b ${
                darkMode ? 'bg-gray-900 border-gray-700' : 'bg-blue-50 border-black'
              }`}>
                <div className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  Accuracy Percentage
                </div>
                <div className={`text-4xl font-bold mt-2 ${
                  darkMode ? 'text-blue-400' : 'text-blue-600'
                }`}>
                  {accuracy}%
                </div>
                <div className={`text-xs mt-1 ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                  (Computed / Reference) × 100
                </div>
              </div>

              {/* 2. Comparison Metrics */}
              <div className={`px-4 py-3 border-b ${darkMode ? 'bg-gray-900 border-gray-700' : 'bg-gray-50 border-black'}`}>
                <div className={`flex items-center gap-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  <span className="text-lg">📊</span>
                  <span className="font-semibold text-sm">Comparison Metrics</span>
                </div>
                
                <div className="space-y-3 text-sm mt-3">
                  {/* Accuracy Percentage */}
                  <div className="flex justify-between items-center">
                    <span className={darkMode ? 'text-gray-400' : 'text-gray-600'}>
                      Accuracy Percentage:
                    </span>
                    <span className={`font-bold text-base ${darkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                      {accuracy}%
                    </span>
                  </div>

                  {/* Difference */}
                  <div className="flex justify-between items-center">
                    <span className={darkMode ? 'text-gray-400' : 'text-gray-600'}>
                      Difference:
                    </span>
                    <span className={`font-bold text-base ${
                      parseFloat(difference) >= 0 
                        ? 'text-green-500' 
                        : 'text-red-500'
                    }`}>
                      {parseFloat(difference) >= 0 ? '+' : ''}{difference} MPa
                    </span>
                  </div>

                  {/* Percentage Difference */}
                  <div className="flex justify-between items-center">
                    <span className={darkMode ? 'text-gray-400' : 'text-gray-600'}>
                      Percentage Difference:
                    </span>
                    <span className={`font-bold text-base ${
                      parseFloat(percentageDifference) >= 0 
                        ? 'text-green-500' 
                        : 'text-red-500'
                    }`}>
                      {parseFloat(percentageDifference) >= 0 ? '+' : ''}{percentageDifference}%
                    </span>
                  </div>

                  {/* Comparison Ratio */}
                  <div className="flex justify-between items-center">
                    <span className={darkMode ? 'text-gray-400' : 'text-gray-600'}>
                      Comparison Ratio:
                    </span>
                    <span className={`font-bold text-base ${darkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                      {comparisonRatio}
                    </span>
                  </div>
                </div>
              </div>

              {/* Save Button */}
              <div className="px-4 py-3">
                <button
                  onClick={handleSaveComparison}
                  disabled={saving || saveSuccess}
                  className={`w-full py-3 px-4 font-semibold text-sm transition-colors ${
                    saveSuccess
                      ? darkMode
                        ? 'bg-green-700 text-white cursor-default'
                        : 'bg-green-500 text-white cursor-default'
                      : saving
                      ? darkMode
                        ? 'bg-gray-700 text-gray-400 cursor-wait'
                        : 'bg-gray-300 text-gray-500 cursor-wait'
                      : darkMode
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'bg-blue-500 text-white hover:bg-blue-600'
                  }`}
                >
                  {saveSuccess ? '✓ Saved Successfully!' : saving ? 'Saving...' : 'Save Comparison'}
                </button>
              </div>
            </>
          ) : (
            <div className={`text-center py-12 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              <FaSearch className="text-4xl mx-auto mb-3 opacity-50" />
              <p className="text-sm">Search and select a wood species to compare</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SpecimenComparison;