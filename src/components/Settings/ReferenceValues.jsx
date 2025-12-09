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
  RefreshCw,
  ArrowLeft
} from 'lucide-react';

const ReferenceValues = ({ onBack }) => {
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
      'high': 'bg-red-500 bg-opacity-20 text-red-300 border-red-500',
      'moderately_high': 'bg-yellow-500 bg-opacity-20 text-yellow-300 border-yellow-500',
      'medium': 'bg-green-500 bg-opacity-20 text-green-300 border-green-500'
    };
    return colors[group] || 'bg-gray-500 bg-opacity-20 text-gray-300 border-gray-500';
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
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black">
      {/* Header */}
      <div className="bg-gray-800 bg-opacity-50 backdrop-blur-sm border-b border-gray-700 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              {/* Back Button */}
              {onBack && (
                <button
                  onClick={onBack}
                  className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-4"
                >
                  <ArrowLeft className="w-5 h-5" />
                  Back to Settings
                </button>
              )}
              
              <h1 className="text-4xl font-bold text-white mb-2 bg-gradient-to-r from-purple-400 to-purple-600 bg-clip-text text-transparent">
                Reference Values Database
              </h1>
              <p className="text-gray-400 mt-1">Philippine Wood Species Strength Properties</p>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={loadReferenceValues}
                className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
                title="Refresh"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </button>
              
              <button
                onClick={exportToCSV}
                className="bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-all shadow-lg"
              >
                <Download className="w-4 h-4" />
                Export CSV
              </button>
              
              <button
                onClick={handleAdd}
                className="bg-gradient-to-r from-purple-600 to-purple-400 hover:from-purple-700 hover:to-purple-500 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-all shadow-lg"
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
                className="w-full pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>

            {/* Strength Group Filter */}
            <select
              value={selectedGroup}
              onChange={(e) => setSelectedGroup(e.target.value)}
              className="px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value="all">All Strength Groups</option>
              <option value="high">High Strength</option>
              <option value="moderately_high">Moderately High Strength</option>
              <option value="medium">Medium Strength</option>
            </select>
          </div>

          {/* Results Count */}
          <div className="mt-3 text-sm text-gray-400">
            Showing {filteredData.length} of {referenceValues.length} species
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="bg-red-900 bg-opacity-30 backdrop-blur-sm border border-red-700 text-red-300 px-4 py-3 rounded-lg flex items-center gap-2">
            <X className="w-5 h-5" />
            <span>{error}</span>
            <button onClick={() => setError(null)} className="ml-auto hover:text-white transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        {isLoading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-purple-600 border-t-transparent"></div>
            <p className="mt-4 text-gray-400">Loading reference values...</p>
          </div>
        ) : filteredData.length === 0 ? (
          <div className="bg-gray-800 bg-opacity-50 backdrop-blur-sm border border-gray-700 rounded-lg p-12 text-center">
            <Search className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-300 mb-2">No Results Found</h3>
            <p className="text-gray-500">Try adjusting your search or filter criteria</p>
          </div>
        ) : (
          <div className="bg-gray-800 bg-opacity-50 backdrop-blur-sm border border-gray-700 rounded-lg shadow-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-900 bg-opacity-50 border-b border-gray-700">
                  <tr>
                    <th 
                      onClick={() => handleSort('strength_group')}
                      className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-700 hover:bg-opacity-50 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        Strength Group
                        <SortIcon field="strength_group" />
                      </div>
                    </th>
                    <th 
                      onClick={() => handleSort('common_name')}
                      className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-700 hover:bg-opacity-50 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        Common Name
                        <SortIcon field="common_name" />
                      </div>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Botanical Name
                    </th>
                    <th 
                      onClick={() => handleSort('compression_parallel')}
                      className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-700 hover:bg-opacity-50 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        Fc (MPa)
                        <SortIcon field="compression_parallel" />
                      </div>
                    </th>
                    <th 
                      onClick={() => handleSort('compression_perpendicular')}
                      className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-700 hover:bg-opacity-50 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        Fc⊥ (MPa)
                        <SortIcon field="compression_perpendicular" />
                      </div>
                    </th>
                    <th 
                      onClick={() => handleSort('shear_parallel')}
                      className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-700 hover:bg-opacity-50 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        Fv (MPa)
                        <SortIcon field="shear_parallel" />
                      </div>
                    </th>
                    <th 
                      onClick={() => handleSort('bending_tension_parallel')}
                      className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-700 hover:bg-opacity-50 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        FbFt (MPa)
                        <SortIcon field="bending_tension_parallel" />
                      </div>
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {filteredData.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-700 hover:bg-opacity-30 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-3 py-1 text-xs font-medium rounded-full border ${getGroupColor(item.strength_group)}`}>
                          {getGroupLabel(item.strength_group).replace(' Strength Group', '')}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-white">{item.common_name}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-400 italic">{item.botanical_name || '-'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                        {item.compression_parallel}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                        {item.compression_perpendicular}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                        {item.shear_parallel}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                        {item.bending_tension_parallel}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setShowDetailsModal(item)}
                            className="text-blue-400 hover:text-blue-300 p-2 hover:bg-blue-900 hover:bg-opacity-30 rounded transition-colors"
                            title="View Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleEdit(item)}
                            className="text-green-400 hover:text-green-300 p-2 hover:bg-green-900 hover:bg-opacity-30 rounded transition-colors"
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setShowDeleteConfirm(item.id)}
                            className="text-red-400 hover:text-red-300 p-2 hover:bg-red-900 hover:bg-opacity-30 rounded transition-colors"
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
        <div className="fixed inset-0 bg-black bg-opacity-75 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 border border-gray-700 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="sticky top-0 bg-gray-800 border-b border-gray-700 px-6 py-4 flex items-center justify-between">
              <h3 className="text-2xl font-bold text-white">
                {showAddModal ? 'Add New Species' : 'Edit Species'}
              </h3>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setShowEditModal(false);
                }}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6">
              <div className="space-y-4">
                {/* Strength Group */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Strength Group *
                  </label>
                  <select
                    value={formData.strength_group}
                    onChange={(e) => setFormData({...formData, strength_group: e.target.value})}
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    required
                  >
                    <option value="high">High Strength Group</option>
                    <option value="moderately_high">Moderately High Strength Group</option>
                    <option value="medium">Medium Strength Group</option>
                  </select>
                </div>

                {/* Common Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Common Name *
                  </label>
                  <input
                    type="text"
                    value={formData.common_name}
                    onChange={(e) => setFormData({...formData, common_name: e.target.value})}
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="e.g., Molave"
                    required
                  />
                </div>

                {/* Botanical Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Botanical Name
                  </label>
                  <input
                    type="text"
                    value={formData.botanical_name}
                    onChange={(e) => setFormData({...formData, botanical_name: e.target.value})}
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="e.g., Vitex parviflora Juss."
                  />
                </div>

                {/* Mechanical Properties */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Compression Parallel (Fc) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.compression_parallel}
                      onChange={(e) => setFormData({...formData, compression_parallel: e.target.value})}
                      className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="MPa"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Compression Perpendicular (Fc⊥) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.compression_perpendicular}
                      onChange={(e) => setFormData({...formData, compression_perpendicular: e.target.value})}
                      className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="MPa"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Shear Parallel (Fv) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.shear_parallel}
                      onChange={(e) => setFormData({...formData, shear_parallel: e.target.value})}
                      className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="MPa"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Bending & Tension Parallel (FbFt) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.bending_tension_parallel}
                      onChange={(e) => setFormData({...formData, bending_tension_parallel: e.target.value})}
                      className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="MPa"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Form Actions */}
              <div className="flex gap-3 mt-6 pt-6 border-t border-gray-700">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setShowEditModal(false);
                  }}
                  className="flex-1 px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 bg-gradient-to-r from-purple-600 to-purple-400 hover:from-purple-700 hover:to-purple-500 text-white px-6 py-3 rounded-lg font-medium disabled:opacity-50 flex items-center justify-center gap-2 transition-all shadow-lg"
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
        <div className="fixed inset-0 bg-black bg-opacity-75 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 border border-gray-700 rounded-xl max-w-2xl w-full shadow-2xl">
            <div className="border-b border-gray-700 px-6 py-4 flex items-center justify-between">
              <h3 className="text-2xl font-bold text-white">Species Details</h3>
              <button
                onClick={() => setShowDetailsModal(null)}
                className="text-gray-400 hover:text-white transition-colors"
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
                <h4 className="text-3xl font-bold text-white mb-2">{showDetailsModal.common_name}</h4>
                {showDetailsModal.botanical_name && (
                  <p className="text-gray-400 italic text-lg">{showDetailsModal.botanical_name}</p>
                )}
              </div>

              {/* Mechanical Properties */}
              <div className="bg-gray-900 bg-opacity-50 rounded-lg p-6">
                <h5 className="font-semibold text-gray-300 mb-4 text-lg">Mechanical Properties</h5>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
                    <div className="text-sm text-gray-400 mb-2">Compression Parallel (Fc)</div>
                    <div className="text-2xl font-bold text-purple-400">{showDetailsModal.compression_parallel} <span className="text-sm text-gray-500">MPa</span></div>
                  </div>
                  <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
                    <div className="text-sm text-gray-400 mb-2">Compression Perpendicular (Fc⊥)</div>
                    <div className="text-2xl font-bold text-purple-400">{showDetailsModal.compression_perpendicular} <span className="text-sm text-gray-500">MPa</span></div>
                  </div>
                  <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
                    <div className="text-sm text-gray-400 mb-2">Shear Parallel (Fv)</div>
                    <div className="text-2xl font-bold text-purple-400">{showDetailsModal.shear_parallel} <span className="text-sm text-gray-500">MPa</span></div>
                  </div>
                  <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
                    <div className="text-sm text-gray-400 mb-2">Bending & Tension Parallel (FbFt)</div>
                    <div className="text-2xl font-bold text-purple-400">{showDetailsModal.bending_tension_parallel} <span className="text-sm text-gray-500">MPa</span></div>
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
                  className="flex-1 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white px-6 py-3 rounded-lg flex items-center justify-center gap-2 font-medium transition-all shadow-lg"
                >
                  <Edit2 className="w-4 h-4" />
                  Edit
                </button>
                <button
                  onClick={() => setShowDetailsModal(null)}
                  className="flex-1 bg-gray-700 hover:bg-gray-600 text-white px-6 py-3 rounded-lg font-medium transition-colors"
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
        <div className="fixed inset-0 bg-black bg-opacity-75 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 border border-gray-700 rounded-xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-2xl font-bold text-white mb-4">Confirm Deletion</h3>
            <p className="text-gray-400 mb-6">
              Are you sure you want to delete this reference value? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="flex-1 px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(showDeleteConfirm)}
                className="flex-1 bg-gradient-to-r from-red-600 to-red-500 hover:from-red-700 hover:to-red-600 text-white px-6 py-3 rounded-lg font-medium transition-all shadow-lg"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Info Card */}
      <div className="max-w-7xl mx-auto px-6 pb-8">
        <div className="bg-purple-900 bg-opacity-30 backdrop-blur-sm border border-purple-700 rounded-xl p-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-purple-600 flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-bold text-purple-300 mb-2">About Reference Values</h3>
              <p className="text-purple-200 text-sm leading-relaxed">
                Reference values represent standardized mechanical properties for Philippine wood species. 
                These values are used for comparison with experimental test results to assess wood quality and performance.
                Ensure values are entered in the correct units: MPa for strength values.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReferenceValues;