import React, { useEffect, useState } from 'react';
import axios from 'axios';

// View Modal Component
const ViewModal = ({ isOpen, onClose, data, dataType }) => {
  if (!isOpen || !data) return null;
  
  // Determine ID field name based on data type
  const getIdField = () => {
    switch(dataType) {
      case 'compressive': return 'compressive_id';
      case 'shear': return 'shear_id';
      case 'flexure': return 'flexure_id';
      default: return 'id';
    }
  };
  
  // Filter out fields we don't want to display
  const displayFields = Object.keys(data).filter(key => 
    !['created_at', 'updated_at'].includes(key)
  );
  
  // Format field names for better display
  const formatFieldName = (fieldName) => {
    return fieldName
      .replace(/_/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };
  
  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-75 backdrop-blur-sm flex items-center justify-center z-50 transition-all duration-300">
      <div className="bg-white rounded-xl w-full max-w-2xl p-6 shadow-2xl transform transition-all duration-300">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-gray-800">
            {dataType.charAt(0).toUpperCase() + dataType.slice(1)} Test Details
          </h3>
          <button 
            onClick={onClose} 
            className="text-gray-500 hover:text-gray-700 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {displayFields.map(field => (
            <div key={field} className="border-b border-gray-100 pb-3">
              <div className="text-sm text-gray-500 mb-1">{formatFieldName(field)}</div>
              <div className="font-medium text-gray-800">
                {data[field] !== null && data[field] !== undefined ? data[field] : '-'}
              </div>
            </div>
          ))}
        </div>
        
        <div className="flex justify-end mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2.5 bg-gray-100 text-gray-800 rounded-lg font-medium hover:bg-gray-200 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

// Responsive Edit Modal Component
const EditModal = ({ isOpen, onClose, data, onSave, dataType }) => {
  const [formData, setFormData] = useState(data || {});
  
  useEffect(() => {
    setFormData(data || {});
  }, [data]);
  
  // Handle body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }
    
    // Cleanup function to restore scroll when component unmounts
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [isOpen]);
  
  if (!isOpen) return null;
  
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };
  
  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };
  
  // Determine ID field name based on data type
  const getIdField = () => {
    switch(dataType) {
      case 'compressive': return 'compressive_id';
      case 'shear': return 'shear_id';
      case 'flexure': return 'flexure_id';
      default: return 'id';
    }
  };
  
  // Group fields for better organization
  const groupFields = () => {
    const fields = Object.keys(formData).filter(key => 
      !['created_at', 'updated_at', getIdField()].includes(key)
    );
    
    // Get numeric fields and text fields
    const numericFields = fields.filter(key => 
      ['width', 'height', 'length', 'area', 'moisture_content', 'max_force_load'].includes(key)
    );
    
    const textFields = fields.filter(key => 
      !numericFields.includes(key)
    );
    
    return { numericFields, textFields };
  };
  
  const { numericFields, textFields } = groupFields();
  
  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-75 backdrop-blur-sm flex items-center justify-center z-50 transition-all duration-300 p-4">
      <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl transform transition-all duration-300">
        {/* Modal Header */}
        <div className="flex justify-between items-center p-4 sm:p-6 border-b border-gray-200">
          <h3 className="text-lg sm:text-xl font-bold text-gray-800 truncate">
            Edit {dataType.charAt(0).toUpperCase() + dataType.slice(1)} Data
          </h3>
          <button 
            onClick={onClose} 
            className="text-gray-500 hover:text-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 rounded-full p-1"
            aria-label="Close"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        {/* Modal Body with Scrollable Content */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-grow">
          <form id="edit-form" onSubmit={handleSubmit} className="space-y-6">
            {/* Text Fields Section */}
            {textFields.length > 0 && (
              <div className="space-y-4">
                <h4 className="text-sm font-medium text-gray-500 uppercase tracking-wider">Basic Information</h4>
                <div className="grid grid-cols-1 gap-4">
                  {textFields.map(key => (
                    <div key={key} className="space-y-1">
                      <label htmlFor={key} className="block text-sm font-medium text-gray-700 capitalize">
                        {key.replace(/_/g, ' ')}
                      </label>
                      <input
                        id={key}
                        type="text"
                        name={key}
                        value={formData[key] || ''}
                        onChange={handleChange}
                        className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Numeric Fields Section */}
            {numericFields.length > 0 && (
              <div className="space-y-4">
                <h4 className="text-sm font-medium text-gray-500 uppercase tracking-wider">Measurements & Data</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {numericFields.map(key => (
                    <div key={key} className="space-y-1">
                      <label htmlFor={key} className="block text-sm font-medium text-gray-700 capitalize">
                        {key.replace(/_/g, ' ')}
                      </label>
                      <div className="relative">
                        <input
                          id={key}
                          type="number"
                          name={key}
                          value={formData[key] || ''}
                          onChange={handleChange}
                          step="0.01"
                          className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                        />
                        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                          <span className="text-gray-500 sm:text-sm">
                            {key.includes('area') ? 'mm²' : 
                             key.includes('moisture') ? '%' : 
                             key.includes('force') ? 'N' : 'mm'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </form>
        </div>
        
        {/* Modal Footer */}
        <div className="flex justify-end gap-3 p-4 sm:p-6 border-t border-gray-200 bg-gray-50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="edit-form"
            className="px-4 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};

// Modern Delete Confirmation Modal
const DeleteConfirmationModal = ({ isOpen, onClose, onConfirm, itemName }) => {
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-75 backdrop-blur-sm flex items-center justify-center z-50 transition-all duration-300">
      <div className="bg-white rounded-xl w-full max-w-md p-6 shadow-2xl transform transition-all duration-300">
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-gray-800 mb-2">Confirm Delete</h3>
          <p className="text-gray-600">Are you sure you want to delete {itemName}? This action cannot be undone.</p>
        </div>
        
        <div className="flex justify-center gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors shadow-sm"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
};

// Modern DataTable Component
const DataTable = ({ title, headers, data, onEdit, onDelete, onView }) => {
  // Function to find the ID field in the row data
  const getIdField = (row) => {
    if (row.compressive_id !== undefined) return 'compressive_id';
    if (row.shear_id !== undefined) return 'shear_id';
    if (row.flexure_id !== undefined) return 'flexure_id';
    return 'id';
  };

  // Function to get the ID value from a row
  const getIdValue = (row) => {
    const idField = getIdField(row);
    return row[idField];
  };

  return (
    <div className="bg-white rounded-xl shadow-md overflow-hidden mb-8 transition-all duration-300 hover:shadow-lg">
      <div className="bg-gradient-to-r from-blue-500 to-indigo-600 p-4">
        <h3 className="text-lg font-semibold text-white">{title}</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {headers.map((header, index) => (
                <th 
                  key={index} 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  {header}
                </th>
              ))}
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {data.length > 0 ? (
              data.map((row, rowIndex) => (
                <tr key={rowIndex} className="hover:bg-gray-50 transition-colors">
                  {headers.map((header, cellIndex) => (
                    <td key={cellIndex} className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {row[header.toLowerCase().replace(/ /g, '_')] ?? '-'}
                    </td>
                  ))}
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <div className="flex gap-3">
                      <button
                        onClick={() => onView(row)}
                        className="text-gray-600 hover:text-gray-800 transition-colors"
                        title="View details"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                          <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                        </svg>
                      </button>
                      <button
                        onClick={() => onEdit(row)}
                        className="text-blue-600 hover:text-blue-800 transition-colors"
                        title="Edit"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => onDelete(row, getIdValue(row))}
                        className="text-red-600 hover:text-red-800 transition-colors"
                        title="Delete"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={headers.length + 1} className="px-6 py-10 text-center text-gray-500">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 mx-auto text-gray-400 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                  </svg>
                  <p className="text-base">No data available</p>
                  <p className="text-sm mt-1">Data will appear here once added</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// Modern Dashboard Component
const Dash = () => {
  const [compressiveData, setCompressiveData] = useState([]);
  const [shearData, setShearData] = useState([]);
  const [flexureData, setFlexureData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // State for modals
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedDataType, setSelectedDataType] = useState('');
  const [selectedItemId, setSelectedItemId] = useState(null);
  const [activeTab, setActiveTab] = useState('compressive');

  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';

  // Create a configured axios instance for our API calls
  const apiClient = axios.create({
    baseURL: apiBaseUrl,
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
  });

  // Function to fetch all data types
  const fetchData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Fetch all data in parallel with Promise.all
      const [compressiveResponse, shearResponse, flexureResponse] = await Promise.all([
        apiClient.get('api/compressive-data'),
        apiClient.get('api/shear-data'),
        apiClient.get('api/flexure-data')
      ]);
      
      // Update state with response data
      setCompressiveData(compressiveResponse.data);
      setShearData(shearResponse.data);
      setFlexureData(flexureResponse.data);
      
      console.log('All data fetched successfully');
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Failed to load data. Please refresh and try again.');
    } finally {
      setLoading(false);
    }
  };

  // Call fetchData when component mounts
  useEffect(() => {
    fetchData();
  }, []);

  // Function to handle view action
  const handleView = (item, dataType) => {
    setSelectedItem(item);
    setSelectedDataType(dataType || activeTab);
    setViewModalOpen(true);
  };

  // Function to handle edit action
  const handleEdit = (item, dataType) => {
    console.log('Edit item:', item); // Debug log
    
    // Store reference to original item
    let originalItem = null;
    
    // Get original item based on data type and ID
    if (dataType === 'compressive') {
      const id = item.compressive_id || item.id;
      originalItem = compressiveData.find(i => i.compressive_id === id);
    } else if (dataType === 'shear') {
      const id = item.shear_id || item.id;
      originalItem = shearData.find(i => i.shear_id === id);
    } else if (dataType === 'flexure') {
      const id = item.flexure_id || item.id;
      originalItem = flexureData.find(i => i.flexure_id === id);
    }
    
    // Use original item if found, otherwise use the passed item
    setSelectedItem(originalItem || item);
    setSelectedDataType(dataType || activeTab);
    setEditModalOpen(true);
  };

  // Function to handle delete action
  const handleDelete = (item, id, dataType) => {
    setSelectedItem(item);
    setSelectedItemId(id);
    setSelectedDataType(dataType || activeTab);
    setDeleteModalOpen(true);
  };

  // Function to update data
  const handleUpdate = async (updatedData) => {
    try {
      // Determine the API endpoint based on data type
      const endpoint = `api/${selectedDataType}-data`;
      
      // Determine the ID field name based on data type
      const idField = selectedDataType === 'compressive' 
        ? 'compressive_id' 
        : selectedDataType === 'shear' 
          ? 'shear_id' 
          : 'flexure_id';
      
      // Get the ID from the updatedData or from the selectedItem as a fallback
      const id = updatedData[idField] || (selectedItem && selectedItem[idField]);
      
      // Log the information for debugging
      console.log('Updating with data:', {
        dataType: selectedDataType,
        idField,
        id: id,
        endpoint: `${endpoint}/${id}`
      });
      
      // Check if ID is valid before making the request
      if (!id) {
        throw new Error(`Cannot update: Missing ID (${idField}) for ${selectedDataType} data`);
      }
      
      // Ensure the ID field is in the data we're sending
      const dataToSend = {
        ...updatedData,
        [idField]: id
      };
      
      // Send update request
      const response = await apiClient.put(`${endpoint}/${id}`, dataToSend);
      
      // Update local state to reflect changes
      if (selectedDataType === 'compressive') {
        setCompressiveData(prev => 
          prev.map(item => item[idField] === id ? response.data : item)
        );
      } else if (selectedDataType === 'shear') {
        setShearData(prev => 
          prev.map(item => item[idField] === id ? response.data : item)
        );
      } else if (selectedDataType === 'flexure') {
        setFlexureData(prev => 
          prev.map(item => item[idField] === id ? response.data : item)
        );
      }
      
      // Close the modal and clear selected item
      setEditModalOpen(false);
      setSelectedItem(null);
      
      console.log(`Successfully updated ${selectedDataType} data with id ${id}`);
    } catch (err) {
      console.error('Error updating data:', err);
      
      // More user-friendly error message
      const errorMessage = err.response?.data?.message || err.message || 'Unknown error occurred';
      alert(`Failed to update: ${errorMessage}`);
    }
  };

  // Function to perform delete
  const handleConfirmDelete = async () => {
    try {
      // Determine the API endpoint based on data type
      const endpoint = `api/${selectedDataType}-data`;
      
      // Send delete request
      await apiClient.delete(`${endpoint}/${selectedItemId}`);
      
      // Update local state to remove deleted item
      if (selectedDataType === 'compressive') {
        setCompressiveData(prev => 
          prev.filter(item => item.compressive_id !== selectedItemId)
        );
      } else if (selectedDataType === 'shear') {
        setShearData(prev => 
          prev.filter(item => item.shear_id !== selectedItemId)
        );
      } else if (selectedDataType === 'flexure') {
        setFlexureData(prev => 
          prev.filter(item => item.flexure_id !== selectedItemId)
        );
      }
      
      // Close the modal and clear selected item
      setDeleteModalOpen(false);
      setSelectedItem(null);
      setSelectedItemId(null);
      
      console.log(`Successfully deleted ${selectedDataType} data with id ${selectedItemId}`);
    } catch (err) {
      console.error('Error deleting data:', err);
      alert(`Failed to delete: ${err.response?.data?.message || err.message}`);
    }
  };

  // (Previous components remain the same)
  
  // Modify the mapDataToHeaders function to use actual test_type from the database
  const mapDataToHeaders = (data, headers) => {
    if (!data || data.length === 0) return [];
    
    return data.map(item => {
      const mappedItem = {};
      
      // For each header, map to the corresponding field in our data
      headers.forEach(header => {
        const key = header.toLowerCase().replace(/ /g, '_');
        
        // Special handling for ID field to map to the correct primary key
        if (key === 'id') {
          if (item.compressive_id !== undefined) mappedItem[key] = item.compressive_id;
          else if (item.shear_id !== undefined) mappedItem[key] = item.shear_id;
          else if (item.flexure_id !== undefined) mappedItem[key] = item.flexure_id;
          else mappedItem[key] = '-';
        } 
        // Use the actual test_type from the database
        else if (key === 'test_type') {
          mappedItem[key] = item.test_type || '-';
        }
        else {
          mappedItem[key] = item[key] !== undefined ? item[key] : '-';
        }
      });
      
      // Important: Preserve original ID fields for editing
      if (item.compressive_id !== undefined) mappedItem.compressive_id = item.compressive_id;
      if (item.shear_id !== undefined) mappedItem.shear_id = item.shear_id;
      if (item.flexure_id !== undefined) mappedItem.flexure_id = item.flexure_id;
      
      return mappedItem;
    });
  };

  // Get a formatted specimen name for the delete confirmation
  const getItemName = () => {
    if (!selectedItem) return "this item";
    
    const specimenName = selectedItem.specimen_name || "";
    const dataType = selectedDataType.charAt(0).toUpperCase() + selectedDataType.slice(1);
    
    return `${dataType} data for "${specimenName}" (ID: ${selectedItemId})`;
  };

  // Tab configuration
  const tabs = [
    { id: 'compressive', label: 'Compressive', icon: '🔨' },
    { id: 'shear', label: 'Shear', icon: '✂️' },
    { id: 'flexure', label: 'Flexure', icon: '📏' }
  ];

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="text-center p-8">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4"></div>
          <p className="text-xl font-semibold text-gray-700">Loading data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-gray-800 mb-2">Connection Error</h3>
          <p className="text-gray-600 mb-6">{error}</p>
          <button 
            className="w-full px-4 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors shadow-sm"
            onClick={fetchData}
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  // Map our data to match the headers expected by DataTable component
  const mappedCompressiveData = mapDataToHeaders(compressiveData, [
    'ID', 'Test Type', 'Specimen Name', 'Width', 'Height', 'Length', 'Area', 'Moisture Content', 'Max Force Load'
  ]);

  const mappedShearData = mapDataToHeaders(shearData, [
    'ID', 'Test Type', 'Specimen Name', 'Width', 'Height', 'Area', 'Moisture Content', 'Max Force Load'
  ]);

  const mappedFlexureData = mapDataToHeaders(flexureData, [
    'ID', 'Test Type', 'Specimen Name', 'Width', 'Height', 'Area', 'Moisture Content', 'Max Force Load'
  ]);

  return (
    <>
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* Action Bar */}
        <div className="flex justify-between items-center mb-6">
          <button 
            onClick={fetchData} 
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors shadow-sm"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
            </svg>
            Refresh Database
          </button>
        </div>
        
       {/* Tab Navigation */}
      <div className="max-w-full overflow-x-auto">
        <div className="border-b border-gray-200 mb-6">
          <ul className="flex w-full text-sm font-medium text-center text-gray-500">
            {tabs.map(tab => (
              <li key={tab.id} className="flex-1">
                <button
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full inline-flex justify-center items-center py-4 px-4 border-b-2 ${
                    activeTab === tab.id
                      ? 'text-blue-600 border-blue-600 active'
                      : 'border-transparent hover:text-gray-600 hover:border-gray-300'
                  }`}
                >
                  <span className="mr-2">{tab.icon}</span>
                  {tab.label} Tests
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
        
        {/* Tab Content */}
        <div className="bg-white rounded-xl shadow-md overflow-hidden mb-8">
            {activeTab === 'compressive' && (
              <DataTable
                title="Compressive Test Results"
                headers={['ID', 'Test Type', 'Specimen Name', 'Width', 'Height', 'Length', 'Area', 'Moisture Content', 'Max Force Load']}
                data={mappedCompressiveData}
                onView={(item) => handleView(item, 'compressive')}
                onEdit={(item) => handleEdit(item, 'compressive')}
                onDelete={(item, id) => handleDelete(item, id, 'compressive')}
              />
            )}
            
            {activeTab === 'shear' && (
              <DataTable
                title="Shear Test Results"
                headers={['ID', 'Test Type', 'Specimen Name', 'Width', 'Height', 'Area', 'Moisture Content', 'Max Force Load']}
                data={mappedShearData}
                onView={(item) => handleView(item, 'shear')}
                onEdit={(item) => handleEdit(item, 'shear')}
                onDelete={(item, id) => handleDelete(item, id, 'shear')}
              />
            )}
            
            {activeTab === 'flexure' && (
              <DataTable
                title="Flexure Test Results"
                headers={['ID', 'Test Type', 'Specimen Name', 'Width', 'Height', 'Area', 'Moisture Content', 'Max Force Load']}
                data={mappedFlexureData}
                onView={(item) => handleView(item, 'flexure')}
                onEdit={(item) => handleEdit(item, 'flexure')}
                onDelete={(item, id) => handleDelete(item, id, 'flexure')}
              />
            )}
        </div>
      </div>

      {/* View Modal */}
      <ViewModal
        isOpen={viewModalOpen}
        onClose={() => setViewModalOpen(false)}
        data={selectedItem}
        dataType={selectedDataType}
      />

      {/* Edit Modal */}
      <EditModal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        data={selectedItem}
        onSave={handleUpdate}
        dataType={selectedDataType}
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleConfirmDelete}
        itemName={getItemName()}
      />
    </>
  );
};

export default Dash;