import React, { useEffect, useState } from 'react';
import axios from 'axios';
import SpecimenView from './SpecimenView';

// ============================================================================
// STRESS CALCULATION UTILITIES
// ============================================================================

const StressCalculator = {
  calculateCompressiveStress(maxForceN, areaMM2) {
    return maxForceN / areaMM2;
  },

  calculateShearStress(maxForceN, areaMM2, isDoubleShear = false) {
    const shearForce = isDoubleShear ? maxForceN / 2 : maxForceN;
    return shearForce / areaMM2;
  },

  calculateFlexuralStress(maxForceN, baseMM, heightMM, lengthMM) {
    const M = (maxForceN * lengthMM) / 4;
    const c = heightMM / 2;
    const I = (baseMM * Math.pow(heightMM, 3)) / 12;
    return (M * c) / I;
  }
};

// ============================================================================
// ACTION MODAL COMPONENT
// ============================================================================

const ActionModal = ({ isOpen, onClose, onView, onEdit, onDelete, darkMode = false }) => {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed bg-black bg-opacity-60 backdrop-blur-md flex items-center justify-center z-40"
      style={{ top: '60px', left: 0, right: 0, bottom: 0 }}
      onClick={onClose}
    >
      <div 
        className={`shadow-2xl overflow-hidden ${darkMode ? 'bg-gray-800' : 'bg-white'}`}
        style={{ width: 'min(500px, 90vw)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`px-6 py-4 flex justify-between items-center border-b-2 ${
          darkMode ? 'bg-gray-900 border-gray-700' : 'bg-gray-100 border-gray-300'
        }`}>
          <h3 className={`text-2xl font-bold ${darkMode ? 'text-gray-100' : 'text-gray-800'}`}>Options</h3>
          <button onClick={onClose} className={`transition-colors ${
            darkMode ? 'text-gray-300 hover:text-gray-100' : 'text-gray-600 hover:text-gray-900'
          }`}>
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <button
          onClick={() => { onView(); onClose(); }}
          className={`w-full px-8 py-6 text-left transition-colors flex items-center gap-4 border-b-2 ${
            darkMode ? 'hover:bg-gray-700 border-gray-700' : 'hover:bg-gray-100 border-gray-200'
          }`}
        >
          <svg className={`w-10 h-10 ${darkMode ? 'text-gray-200' : 'text-gray-900'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
          <span className={`text-2xl font-medium ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>VIEW</span>
        </button>
        
        <button
          onClick={() => { onEdit(); onClose(); }}
          className={`w-full px-8 py-6 text-left transition-colors flex items-center gap-4 border-b-2 ${
            darkMode ? 'hover:bg-gray-700 border-gray-700' : 'hover:bg-gray-100 border-gray-200'
          }`}
        >
          <svg className={`w-10 h-10 ${darkMode ? 'text-gray-200' : 'text-gray-900'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          <span className={`text-2xl font-medium ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>EDIT</span>
        </button>
        
        <button
          onClick={() => { onDelete(); onClose(); }}
          className={`w-full px-8 py-6 text-left text-red-600 transition-colors flex items-center gap-4 ${
            darkMode ? 'hover:bg-gray-700' : 'hover:bg-red-50'
          }`}
        >
          <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          <span className="text-2xl font-medium">DELETE</span>
        </button>
      </div>
    </div>
  );
};

// ============================================================================
// DATA TABLE COMPONENT
// ============================================================================

const DataTable = ({ title, headers, data, onView, onEdit, onDelete, darkMode = false }) => {
  const [actionModalOpen, setActionModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedItemId, setSelectedItemId] = useState(null);

  const handleOpenActionModal = (item, itemId) => {
    setSelectedItem(item);
    setSelectedItemId(itemId);
    setActionModalOpen(true);
  };

  const handleCloseActionModal = () => {
    setActionModalOpen(false);
    setSelectedItem(null);
    setSelectedItemId(null);
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse">
          <thead className={`sticky top-0 z-10 ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
            <tr>
              {headers.map((header, index) => (
                <th 
                  key={index} 
                  className={`border px-2 py-2 text-sm font-medium text-center ${
                    darkMode ? 'border-gray-600 bg-gray-800 text-gray-200' : 'border-black bg-white text-gray-900'
                  }`}
                  style={{ minWidth: '80px' }}
                >
                  {header}
                </th>
              ))}
              <th 
                className={`border px-2 py-2 text-sm font-medium text-center sticky right-0 ${
                  darkMode ? 'border-gray-600 bg-gray-800 text-gray-200' : 'border-black bg-white text-gray-900'
                }`}
                style={{ width: '60px' }}
              >
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {data && data.length > 0 ? (
              data.map((item, rowIndex) => {
                const itemId = item.compressive_id || item.shear_id || item.flexure_id || item.ID;
                
                return (
                  <tr 
                    key={rowIndex}
                    className={`transition-colors ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
                  >
                    {headers.map((header, colIndex) => (
                      <td 
                        key={colIndex} 
                        className={`border px-2 py-2 text-sm text-center ${
                          darkMode ? 'border-gray-600 text-gray-200' : 'border-black text-gray-900'
                        }`}
                      >
                        {item[header] !== undefined && item[header] !== null ? item[header] : '-'}
                      </td>
                    ))}
                    <td className={`border px-1 py-1 text-center sticky right-0 ${
                      darkMode ? 'border-gray-600 bg-gray-800' : 'border-black bg-white'
                    }`}>
                      <button
                        onClick={() => handleOpenActionModal(item, itemId)}
                        className={`w-full h-full px-2 py-2 transition-colors rounded ${
                          darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-200'
                        }`}
                      >
                        <svg className={`w-5 h-5 mx-auto ${darkMode ? 'text-gray-200' : 'text-gray-900'}`} fill="currentColor" viewBox="0 0 24 24">
                          <path d="M3 6h18v2H3V6zm0 5h18v2H3v-2zm0 5h18v2H3v-2z" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td 
                  colSpan={headers.length + 1} 
                  className={`border px-4 py-8 text-center ${
                    darkMode ? 'border-gray-600 text-gray-400' : 'border-black text-gray-500'
                  }`}
                >
                  No data available
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <ActionModal
        isOpen={actionModalOpen}
        onClose={handleCloseActionModal}
        onView={() => onView(selectedItem)}
        onEdit={() => onEdit(selectedItem)}
        onDelete={() => onDelete(selectedItem, selectedItemId)}
        darkMode={darkMode}
      />
    </div>
  );
};

// ============================================================================
// EDIT MODAL COMPONENT
// ============================================================================

const EditModal = ({ isOpen, onClose, data, onSave, dataType, darkMode = false }) => {
  const [formData, setFormData] = useState({});

  useEffect(() => {
    if (data) {
      setFormData(data);
    }
  }, [data]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData, dataType);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed bg-black bg-opacity-60 backdrop-blur-md flex items-center justify-center z-40 p-4"
      style={{ top: '60px', left: 0, right: 0, bottom: 0 }}
    >
      <div className={`shadow-2xl overflow-y-auto ${darkMode ? 'bg-gray-800' : 'bg-white'}`} style={{ width: 'min(95vw, 1200px)', maxHeight: 'calc(100vh - 80px)' }}>
        <div className={`sticky top-0 bg-gradient-to-r from-green-600 to-green-500 text-white px-8 py-6 flex justify-between items-center z-10`}>
          <h2 className="text-3xl font-bold">✏️ Edit Test Data</h2>
          <button onClick={onClose} className="text-white hover:text-gray-200 transition-colors p-2 hover:bg-white hover:bg-opacity-20 rounded-full">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8">
          <div className="grid grid-cols-2 gap-6 mb-6">
            <div>
              <label className={`block text-lg font-medium mb-2 ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>Specimen Name</label>
              <input
                type="text"
                name="specimen_name"
                value={formData.specimen_name || ''}
                onChange={handleChange}
                className={`w-full px-4 py-3 text-lg border rounded-lg ${
                  darkMode ? 'bg-gray-700 border-gray-600 text-gray-100' : 'bg-white border-gray-300 text-gray-900'
                }`}
              />
            </div>
            <div>
              <label className={`block text-lg font-medium mb-2 ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>Base (mm)</label>
              <input
                type="number"
                step="0.01"
                name="base"
                value={formData.base || ''}
                onChange={handleChange}
                className={`w-full px-4 py-3 text-lg border rounded-lg ${
                  darkMode ? 'bg-gray-700 border-gray-600 text-gray-100' : 'bg-white border-gray-300 text-gray-900'
                }`}
              />
            </div>
            <div>
              <label className={`block text-lg font-medium mb-2 ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>Height (mm)</label>
              <input
                type="number"
                step="0.01"
                name="height"
                value={formData.height || ''}
                onChange={handleChange}
                className={`w-full px-4 py-3 text-lg border rounded-lg ${
                  darkMode ? 'bg-gray-700 border-gray-600 text-gray-100' : 'bg-white border-gray-300 text-gray-900'
                }`}
              />
            </div>
            <div>
              <label className={`block text-lg font-medium mb-2 ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>Length (mm)</label>
              <input
                type="number"
                step="0.01"
                name="length"
                value={formData.length || ''}
                onChange={handleChange}
                className={`w-full px-4 py-3 text-lg border rounded-lg ${
                  darkMode ? 'bg-gray-700 border-gray-600 text-gray-100' : 'bg-white border-gray-300 text-gray-900'
                }`}
              />
            </div>
          </div>

          <div className="flex justify-end gap-4">
            <button
              type="button"
              onClick={onClose}
              className={`px-6 py-3 text-lg rounded-lg transition-colors ${
                darkMode ? 'bg-gray-600 text-gray-100 hover:bg-gray-500' : 'bg-gray-300 text-gray-700 hover:bg-gray-400'
              }`}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-3 text-lg bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ============================================================================
// DELETE CONFIRMATION MODAL
// ============================================================================

const DeleteConfirmationModal = ({ isOpen, onClose, onConfirm, itemName, darkMode = false }) => {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed bg-black bg-opacity-60 backdrop-blur-md flex items-center justify-center z-40 p-4"
      style={{ top: '60px', left: 0, right: 0, bottom: 0 }}
    >
      <div className={`shadow-2xl ${darkMode ? 'bg-gray-800' : 'bg-white'}`} style={{ width: 'min(600px, 90vw)' }}>
        <div className="bg-gradient-to-r from-red-600 to-red-500 text-white px-8 py-6">
          <h2 className="text-3xl font-bold">🗑️ Confirm Deletion</h2>
        </div>
        
        <div className="p-8">
          <div className={`p-6 rounded-lg mb-6 ${darkMode ? 'bg-red-900 bg-opacity-20' : 'bg-red-50'}`}>
            <p className={`text-lg ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>
              Are you sure you want to delete <strong>"{itemName}"</strong>?
            </p>
            <p className={`text-base mt-2 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              This action cannot be undone.
            </p>
          </div>

          <div className="flex justify-end gap-4">
            <button
              onClick={onClose}
              className={`px-6 py-3 text-lg rounded-lg transition-colors ${
                darkMode ? 'bg-gray-600 text-gray-100 hover:bg-gray-500' : 'bg-gray-300 text-gray-700 hover:bg-gray-400'
              }`}
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              className="px-6 py-3 text-lg bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-semibold"
            >
              Delete Permanently
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// MAIN DASH COMPONENT
// ============================================================================

const Dash = ({ darkMode = false }) => {
  const [compressiveData, setCompressiveData] = useState([]);
  const [shearData, setShearData] = useState([]);
  const [flexureData, setFlexureData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('compressive');
  
  // View state
  const [showSpecimenView, setShowSpecimenView] = useState(false);
  const [selectedSpecimen, setSelectedSpecimen] = useState(null);
  const [selectedDataType, setSelectedDataType] = useState(null);
  
  // Modal states
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editData, setEditData] = useState(null);
  const [editDataType, setEditDataType] = useState(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteItem, setDeleteItem] = useState(null);
  const [deleteItemId, setDeleteItemId] = useState(null);
  const [deleteDataType, setDeleteDataType] = useState(null);

  const tabs = [
    { id: 'compressive', label: 'Compressive' },
    { id: 'shear', label: 'Shear' },
    { id: 'flexure', label: 'Flexure' }
  ];

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [compRes, shearRes, flexRes] = await Promise.all([
        axios.get('http://127.0.0.1:8000/api/compressive-data'),
        axios.get('http://127.0.0.1:8000/api/shear-data'),
        axios.get('http://127.0.0.1:8000/api/flexure-data')
      ]);
      
      setCompressiveData(compRes.data);
      setShearData(shearRes.data);
      setFlexureData(flexRes.data);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const mapDataToHeaders = (data, headers) => {
    return data.map(item => {
      const mappedItem = {};
      headers.forEach(header => {
        const key = header.toLowerCase().replace(/ /g, '_');
        if (key === 'stress') {
          mappedItem[header] = item.stress || item.pressure || '-';
        } else if (key === 'maximum_force') {
          // Database column is max_force, not maximum_force
          mappedItem[header] = item.max_force !== undefined ? item.max_force : '-';
        } else {
          mappedItem[header] = item[key] !== undefined ? item[key] : '-';
        }
      });
      mappedItem.compressive_id = item.compressive_id;
      mappedItem.shear_id = item.shear_id;
      mappedItem.flexure_id = item.flexure_id;
      mappedItem.species_id = item.species_id;
      mappedItem.max_force = item.max_force;
      mappedItem.test_type = item.test_type;
      mappedItem.base = item.base;
      mappedItem.height = item.height;
      mappedItem.length = item.length;
      mappedItem.area = item.area;
      return mappedItem;
    });
  };

  const mappedCompressiveData = mapDataToHeaders(compressiveData, [
    'Specimen Name', 'Test Type', 'Moisture Content', 'Base', 'Height', 'Length', 'Area', 'Stress', 'Maximum Force'
  ]);

  const mappedShearData = mapDataToHeaders(shearData, [
    'Specimen Name', 'Test Type', 'Moisture Content', 'Base', 'Height', 'Length', 'Area', 'Stress', 'Maximum Force'
  ]);

  const mappedFlexureData = mapDataToHeaders(flexureData, [
    'Specimen Name', 'Test Type', 'Moisture Content', 'Base', 'Height', 'Length', 'Area', 'Stress', 'Maximum Force'
  ]);

  const handleView = (item, type) => {
    setSelectedSpecimen(item);
    setSelectedDataType(type);
    setShowSpecimenView(true);
  };

  const handleEdit = (item, type) => {
    setEditData(item);
    setEditDataType(type);
    setEditModalOpen(true);
  };

  const handleDelete = (item, itemId, type) => {
    setDeleteItem(item);
    setDeleteItemId(itemId);
    setDeleteDataType(type);
    setDeleteModalOpen(true);
  };

  const handleSave = async (updatedData, dataType) => {
    try {
      const id = updatedData.compressive_id || updatedData.shear_id || updatedData.flexure_id;
      await axios.put(`http://127.0.0.1:8000/api/${dataType}-data/${id}`, updatedData);
      fetchAllData();
    } catch (error) {
      console.error('Error saving data:', error);
    }
  };

  const confirmDelete = async () => {
    try {
      await axios.delete(`http://127.0.0.1:8000/api/${deleteDataType}-data/${deleteItemId}`);
      setDeleteModalOpen(false);
      fetchAllData();
    } catch (error) {
      console.error('Error deleting data:', error);
    }
  };

  if (loading) {
    return (
      <div className={`flex items-center justify-center h-full ${darkMode ? 'bg-gray-900 text-gray-100' : 'bg-white text-gray-900'}`}>
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`flex items-center justify-center h-full ${darkMode ? 'bg-gray-900 text-red-400' : 'bg-white text-red-600'}`}>
        <div className="text-xl">{error}</div>
      </div>
    );
  }

  // Show SpecimenView if selected
  if (showSpecimenView) {
    return (
      <SpecimenView 
        data={selectedSpecimen}
        dataType={selectedDataType}
        darkMode={darkMode}
        onClose={() => setShowSpecimenView(false)}
      />
    );
  }

  // Show Dashboard
  return (
    <>
      <div className={`overflow-hidden flex flex-col ${darkMode ? 'bg-gray-900' : 'bg-white'}`} style={{ height: 'calc(100vh - 60px)' }}>
        {/* Tab Navigation */}
        <div className={`border-b ${darkMode ? 'border-gray-700' : 'border-gray-300'}`}>
          <div className="flex w-full">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 py-3 text-center font-medium transition-colors border-b-2 ${
                  activeTab === tab.id
                    ? darkMode
                      ? 'text-blue-400 border-blue-400 bg-gray-800'
                      : 'text-black border-black bg-gray-100'
                    : darkMode
                      ? 'text-gray-300 border-transparent hover:bg-gray-800'
                      : 'text-gray-600 border-transparent hover:bg-gray-50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Table Content */}
        <div className="flex-1 overflow-hidden">
          {activeTab === 'compressive' && (
            <DataTable
              title="Compressive Test Results"
              headers={['Specimen Name', 'Test Type', 'Moisture Content', 'Base', 'Height', 'Length', 'Area', 'Stress', 'Maximum Force']}
              data={mappedCompressiveData}
              onView={(item) => handleView(item, 'compressive')}
              onEdit={(item) => handleEdit(item, 'compressive')}
              onDelete={(item, id) => handleDelete(item, id, 'compressive')}
              darkMode={darkMode}
            />
          )}
          
          {activeTab === 'shear' && (
            <DataTable
              title="Shear Test Results"
              headers={['Specimen Name', 'Test Type', 'Moisture Content', 'Base', 'Height', 'Length', 'Area', 'Stress', 'Maximum Force']}
              data={mappedShearData}
              onView={(item) => handleView(item, 'shear')}
              onEdit={(item) => handleEdit(item, 'shear')}
              onDelete={(item, id) => handleDelete(item, id, 'shear')}
              darkMode={darkMode}
            />
          )}
          
          {activeTab === 'flexure' && (
            <DataTable
              title="Flexure Test Results"
              headers={['Specimen Name', 'Test Type', 'Moisture Content', 'Base', 'Height', 'Length', 'Area', 'Stress', 'Maximum Force']}
              data={mappedFlexureData}
              onView={(item) => handleView(item, 'flexure')}
              onEdit={(item) => handleEdit(item, 'flexure')}
              onDelete={(item, id) => handleDelete(item, id, 'flexure')}
              darkMode={darkMode}
            />
          )}
        </div>
      </div>

      {/* Modals */}
      <EditModal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        data={editData}
        onSave={handleSave}
        dataType={editDataType}
        darkMode={darkMode}
      />

      <DeleteConfirmationModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={confirmDelete}
        itemName={deleteItem?.specimen_name || 'this item'}
        darkMode={darkMode}
      />
    </>
  );
};

export default Dash;