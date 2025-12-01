import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Plus, 
  Edit2, 
  Trash2, 
  X, 
  Save,
  Filter,
  Download,
  Upload,
  Eye,
  ChevronDown,
  ChevronUp,
  RefreshCw
} from 'lucide-react';

const ReferenceValues = () => {
  const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';
  
  // State
  const [referenceValues, setReferenceValues] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('all');
  const [sortConfig, setSortConfig] = useState({ field: 'common_name', order: 'asc' });
  
  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(null);
  
  // Form state
  const [formData, setFormData] = useState({
    strength_group: 'high',
    common_name: '',
    botanical_name: '',
    compression_parallel: '',
    compression_perpendicular: '',
    shear_parallel: '',
    bending_tension_parallel: ''
  });

  // Load data on mount
  useEffect(() => {
    loadReferenceValues();
  }, []);

  // Filter and search
  useEffect(() => {
    let filtered = [...referenceValues];

    // Apply strength group filter
    if (selectedGroup !== 'all') {
      filtered = filtered.filter(item => item.strength_group === selectedGroup);
    }

    // Apply search
    if (searchTerm) {
      filtered = filtered.filter(item =>
        item.common_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.botanical_name && item.botanical_name.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      const aVal = a[sortConfig.field];
      const bVal = b[sortConfig.field];
      
      if (typeof aVal === 'number') {
        return sortConfig.order === 'asc' ? aVal - bVal : bVal - aVal;
      }
      
      return sortConfig.order === 'asc' 
        ? String(aVal).localeCompare(String(bVal))
        : String(bVal).localeCompare(String(aVal));
    });

    setFilteredData(filtered);
  }, [referenceValues, searchTerm, selectedGroup, sortConfig]);

  const loadReferenceValues = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${API_URL}/api/reference-values`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      setReferenceValues(data);
      
    } catch (err) {
      console.error('Failed to load reference values:', err);
      setError('Failed to load reference values. Please check your connection.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSort = (field) => {
    setSortConfig(prev => ({
      field,
      order: prev.field === field && prev.order === 'asc' ? 'desc' : 'asc'
    }));
  };

  const handleAdd = () => {
    setFormData({
      strength_group: 'high',
      common_name: '',
      botanical_name: '',
      compression_parallel: '',
      compression_perpendicular: '',
      shear_parallel: '',
      bending_tension_parallel: ''
    });
    setShowAddModal(true);
  };

  const handleEdit = (item) => {
    setFormData({
      id: item.id,
      strength_group: item.strength_group,
      common_name: item.common_name,
      botanical_name: item.botanical_name || '',
      compression_parallel: item.compression_parallel,
      compression_perpendicular: item.compression_perpendicular,
      shear_parallel: item.shear_parallel,
      bending_tension_parallel: item.bending_tension_parallel
    });
    setShowEditModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      const url = formData.id 
        ? `${API_URL}/api/reference-values/${formData.id}`
        : `${API_URL}/api/reference-values`;
      
      const method = formData.id ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      
      if (!response.ok) {
        throw new Error('Failed to save reference value');
      }
      
      await loadReferenceValues();
      setShowAddModal(false);
      setShowEditModal(false);
      
    } catch (err) {
      console.error('Error saving:', err);
      setError('Failed to save reference value');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id) => {
    setIsLoading(true);
    
    try {
      const response = await fetch(`${API_URL}/api/reference-values/${id}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete reference value');
      }
      
      await loadReferenceValues();
      setShowDeleteConfirm(null);
      
    } catch (err) {
      console.error('Error deleting:', err);
      setError('Failed to delete reference value');
    } finally {
      setIsLoading(false);
    }
  };

  const getGroupLabel = (group) => {
    const labels = {
      'high': 'High Strength Group',
      'moderately_high': 'Moderately High Strength Group',
      'medium': 'Medium Strength Group'
    };
    return labels[group] || group;
  };

  const getGroupColor = (group) => {
    const colors = {
      'high': 'bg-red-100 text-red-800 border-red-300',
      'moderately_high': 'bg-yellow-100 text-yellow-800 border-yellow-300',
      'medium': 'bg-green-100 text-green-800 border-green-300'
    };
    return colors[group] || 'bg-gray-100 text-gray-800 border-gray-300';
  };

  const exportToCSV = () => {
    const headers = [
      'Strength Group',
      'Common Name',
      'Botanical Name',
      'Fc (Mpa)',
      'Fc⊥ (Mpa)',
      'Fv (Mpa)',
      'FbFt (Mpa)'
    ];
    
    const rows = filteredData.map(item => [
      getGroupLabel(item.strength_group),
      item.common_name,
      item.botanical_name || '',
      item.compression_parallel,
      item.compression_perpendicular,
      item.shear_parallel,
      item.bending_tension_parallel
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reference-values-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const SortIcon = ({ field }) => {
    if (sortConfig.field !== field) return null;
    return sortConfig.order === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Reference Values Database</h1>
              <p className="text-gray-600 mt-1">Philippine Wood Species Strength Properties</p>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={loadReferenceValues}
                className="bg-gray-100 hover:bg-gray-200 px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
                title="Refresh"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </button>
              
              <button
                onClick={exportToCSV}
                className="bg-blue-100 hover:bg-blue-200 text-blue-700 px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
              >
                <Download className="w-4 h-4" />
                Export CSV
              </button>
              
              <button
                onClick={handleAdd}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add New Species
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="flex gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search by common name or botanical name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Strength Group Filter */}
            <select
              value={selectedGroup}
              onChange={(e) => setSelectedGroup(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Strength Groups</option>
              <option value="high">High Strength</option>
              <option value="moderately_high">Moderately High Strength</option>
              <option value="medium">Medium Strength</option>
            </select>
          </div>

          {/* Results Count */}
          <div className="mt-3 text-sm text-gray-600">
            Showing {filteredData.length} of {referenceValues.length} species
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
            <X className="w-5 h-5" />
            <span>{error}</span>
            <button onClick={() => setError(null)} className="ml-auto">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        {isLoading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-600">Loading reference values...</p>
          </div>
        ) : filteredData.length === 0 ? (
          <div className="bg-white rounded-lg p-12 text-center">
            <Search className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-700 mb-2">No Results Found</h3>
            <p className="text-gray-500">Try adjusting your search or filter criteria</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th 
                      onClick={() => handleSort('strength_group')}
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    >
                      <div className="flex items-center gap-2">
                        Strength Group
                        <SortIcon field="strength_group" />
                      </div>
                    </th>
                    <th 
                      onClick={() => handleSort('common_name')}
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    >
                      <div className="flex items-center gap-2">
                        Common Name
                        <SortIcon field="common_name" />
                      </div>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Botanical Name
                    </th>
                    <th 
                      onClick={() => handleSort('compression_parallel')}
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    >
                      <div className="flex items-center gap-2">
                        Fc (Mpa)
                        <SortIcon field="compression_parallel" />
                      </div>
                    </th>
                    <th 
                      onClick={() => handleSort('compression_perpendicular')}
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    >
                      <div className="flex items-center gap-2">
                        Fc⊥ (Mpa)
                        <SortIcon field="compression_perpendicular" />
                      </div>
                    </th>
                    <th 
                      onClick={() => handleSort('shear_parallel')}
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    >
                      <div className="flex items-center gap-2">
                        Fv (Mpa)
                        <SortIcon field="shear_parallel" />
                      </div>
                    </th>
                    <th 
                      onClick={() => handleSort('bending_tension_parallel')}
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    >
                      <div className="flex items-center gap-2">
                        FbFt (Mpa)
                        <SortIcon field="bending_tension_parallel" />
                      </div>
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredData.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getGroupColor(item.strength_group)}`}>
                          {getGroupLabel(item.strength_group).replace(' Strength Group', '')}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{item.common_name}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-600 italic">{item.botanical_name || '-'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {item.compression_parallel}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {item.compression_perpendicular}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {item.shear_parallel}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {item.bending_tension_parallel}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setShowDetailsModal(item)}
                            className="text-blue-600 hover:text-blue-900 p-1 hover:bg-blue-50 rounded transition-colors"
                            title="View Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleEdit(item)}
                            className="text-green-600 hover:text-green-900 p-1 hover:bg-green-50 rounded transition-colors"
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setShowDeleteConfirm(item.id)}
                            className="text-red-600 hover:text-red-900 p-1 hover:bg-red-50 rounded transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {(showAddModal || showEditModal) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h3 className="text-xl font-bold">
                {showAddModal ? 'Add New Species' : 'Edit Species'}
              </h3>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setShowEditModal(false);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6">
              <div className="space-y-4">
                {/* Strength Group */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Strength Group *
                  </label>
                  <select
                    value={formData.strength_group}
                    onChange={(e) => setFormData({...formData, strength_group: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  >
                    <option value="high">High Strength Group</option>
                    <option value="moderately_high">Moderately High Strength Group</option>
                    <option value="medium">Medium Strength Group</option>
                  </select>
                </div>

                {/* Common Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Common Name *
                  </label>
                  <input
                    type="text"
                    value={formData.common_name}
                    onChange={(e) => setFormData({...formData, common_name: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g., Molave"
                    required
                  />
                </div>

                {/* Botanical Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Botanical Name
                  </label>
                  <input
                    type="text"
                    value={formData.botanical_name}
                    onChange={(e) => setFormData({...formData, botanical_name: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g., Vitex parviflora Juss."
                  />
                </div>

                {/* Mechanical Properties */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Compression Parallel (Fc) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.compression_parallel}
                      onChange={(e) => setFormData({...formData, compression_parallel: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="MPa"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Compression Perpendicular (Fc⊥) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.compression_perpendicular}
                      onChange={(e) => setFormData({...formData, compression_perpendicular: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="MPa"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Shear Parallel (Fv) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.shear_parallel}
                      onChange={(e) => setFormData({...formData, shear_parallel: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="MPa"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Bending & Tension Parallel (FbFt) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.bending_tension_parallel}
                      onChange={(e) => setFormData({...formData, bending_tension_parallel: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="MPa"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Form Actions */}
              <div className="flex gap-3 mt-6 pt-6 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setShowEditModal(false);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
                >
                  <Save className="w-4 h-4" />
                  {isLoading ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Details Modal */}
      {showDetailsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full">
            <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h3 className="text-xl font-bold">Species Details</h3>
              <button
                onClick={() => setShowDetailsModal(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6">
              {/* Basic Info */}
              <div className="mb-6">
                <div className={`inline-block px-3 py-1 text-sm font-medium rounded-full border mb-3 ${getGroupColor(showDetailsModal.strength_group)}`}>
                  {getGroupLabel(showDetailsModal.strength_group)}
                </div>
                <h4 className="text-2xl font-bold text-gray-900 mb-2">{showDetailsModal.common_name}</h4>
                {showDetailsModal.botanical_name && (
                  <p className="text-gray-600 italic">{showDetailsModal.botanical_name}</p>
                )}
              </div>

              {/* Mechanical Properties */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h5 className="font-semibold text-gray-700 mb-4">Mechanical Properties</h5>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white p-3 rounded-lg">
                    <div className="text-sm text-gray-600 mb-1">Compression Parallel (Fc)</div>
                    <div className="text-2xl font-bold text-blue-600">{showDetailsModal.compression_parallel} <span className="text-sm text-gray-500">MPa</span></div>
                  </div>
                  <div className="bg-white p-3 rounded-lg">
                    <div className="text-sm text-gray-600 mb-1">Compression Perpendicular (Fc⊥)</div>
                    <div className="text-2xl font-bold text-blue-600">{showDetailsModal.compression_perpendicular} <span className="text-sm text-gray-500">MPa</span></div>
                  </div>
                  <div className="bg-white p-3 rounded-lg">
                    <div className="text-sm text-gray-600 mb-1">Shear Parallel (Fv)</div>
                    <div className="text-2xl font-bold text-blue-600">{showDetailsModal.shear_parallel} <span className="text-sm text-gray-500">MPa</span></div>
                  </div>
                  <div className="bg-white p-3 rounded-lg">
                    <div className="text-sm text-gray-600 mb-1">Bending & Tension Parallel (FbFt)</div>
                    <div className="text-2xl font-bold text-blue-600">{showDetailsModal.bending_tension_parallel} <span className="text-sm text-gray-500">MPa</span></div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowDetailsModal(null);
                    handleEdit(showDetailsModal);
                  }}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2 transition-colors"
                >
                  <Edit2 className="w-4 h-4" />
                  Edit
                </button>
                <button
                  onClick={() => setShowDetailsModal(null)}
                  className="flex-1 border border-gray-300 hover:bg-gray-50 px-4 py-2 rounded-lg transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-xl font-bold mb-4">Confirm Deletion</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete this reference value? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(showDeleteConfirm)}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReferenceValues;
