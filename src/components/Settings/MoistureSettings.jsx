import React, { useState, useEffect } from 'react';
import { Settings, Trash2, Check, X, Eye, Plus, Calendar, ChevronRight } from 'lucide-react';

const MoistureSettings = ({ onBack, onEditCalibration }) => {
  const LARAVEL_API_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';
  
  const [calibrations, setCalibrations] = useState([]);
  const [activeCalibration, setActiveCalibration] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const [selectedCalibration, setSelectedCalibration] = useState(null);

  // Load all calibrations on mount
  useEffect(() => {
    loadCalibrations();
  }, []);

  const loadCalibrations = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${LARAVEL_API_URL}/api/calibration`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      setCalibrations(data);
      
      // Find active calibration
      const active = data.find(cal => cal.is_active);
      setActiveCalibration(active);
      
    } catch (err) {
      console.error('Failed to load calibrations:', err);
      setError('Failed to load calibration settings. Please check your connection.');
    } finally {
      setIsLoading(false);
    }
  };

  const setAsActive = async (id) => {
    try {
      const response = await fetch(`${LARAVEL_API_URL}/api/calibration/${id}/activate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.success) {
        // Reload calibrations
        await loadCalibrations();
        
        // Show success message
        alert('Calibration activated successfully!');
      } else {
        throw new Error(data.message || 'Failed to activate calibration');
      }
    } catch (err) {
      console.error('Failed to activate calibration:', err);
      alert('Failed to activate calibration: ' + err.message);
    }
  };

  const deleteCalibration = async (id) => {
    try {
      const response = await fetch(`${LARAVEL_API_URL}/api/calibration/${id}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.success) {
        // Reload calibrations
        await loadCalibrations();
        setShowDeleteConfirm(null);
        alert('Calibration deleted successfully!');
      } else {
        throw new Error(data.message || 'Failed to delete calibration');
      }
    } catch (err) {
      console.error('Failed to delete calibration:', err);
      alert('Failed to delete calibration: ' + err.message);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const viewCalibrationDetails = (calibration) => {
    setSelectedCalibration(calibration);
  };

  const closeDetailsModal = () => {
    setSelectedCalibration(null);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="text-2xl hover:text-blue-400 transition-colors"
            >
              ←
            </button>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-3">
                <Settings className="w-7 h-7 text-blue-400" />
                Moisture Settings
              </h1>
              <p className="text-sm text-gray-400 mt-1">
                Manage your seven-segment display calibrations
              </p>
            </div>
          </div>
          
          {onEditCalibration && (
            <button
              onClick={onEditCalibration}
              className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg font-semibold flex items-center gap-2 transition-colors"
            >
              <Plus className="w-5 h-5" />
              New Calibration
            </button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        
        {/* Error Message */}
        {error && (
          <div className="bg-red-900 border border-red-700 text-red-200 px-4 py-3 rounded-lg mb-6 flex items-center gap-3">
            <X className="w-5 h-5" />
            <span>{error}</span>
          </div>
        )}

        {/* Loading State */}
        {isLoading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400"></div>
            <p className="mt-4 text-gray-400">Loading calibrations...</p>
          </div>
        ) : calibrations.length === 0 ? (
          // Empty State
          <div className="bg-gray-800 rounded-lg p-12 text-center">
            <Settings className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-300 mb-2">
              No Calibrations Found
            </h3>
            <p className="text-gray-400 mb-6">
              You haven't created any calibration settings yet.
            </p>
            {onEditCalibration && (
              <button
                onClick={onEditCalibration}
                className="bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg font-semibold inline-flex items-center gap-2 transition-colors"
              >
                <Plus className="w-5 h-5" />
                Create First Calibration
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Active Calibration Card */}
            {activeCalibration && (
              <div className="bg-gradient-to-r from-green-900 to-green-800 rounded-lg p-6 mb-6 border-2 border-green-600">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Check className="w-5 h-5 text-green-400" />
                      <span className="text-green-300 font-semibold text-sm">ACTIVE CALIBRATION</span>
                    </div>
                    <h3 className="text-2xl font-bold mb-2">
                      {activeCalibration.device_name || 'Default Moisture Meter'}
                    </h3>
                    <div className="flex items-center gap-4 text-sm text-gray-300">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {formatDate(activeCalibration.created_at)}
                      </span>
                      <span className="bg-green-700 px-2 py-1 rounded">
                        {activeCalibration.num_digits} Digits
                      </span>
                    </div>
                    {activeCalibration.notes && (
                      <p className="text-gray-300 mt-3 text-sm">
                        {activeCalibration.notes}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => viewCalibrationDetails(activeCalibration)}
                    className="bg-green-700 hover:bg-green-600 px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
                  >
                    <Eye className="w-4 h-4" />
                    View Details
                  </button>
                </div>
              </div>
            )}

            {/* All Calibrations List */}
            <div className="bg-gray-800 rounded-lg overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-700">
                <h2 className="text-xl font-semibold">All Calibrations</h2>
                <p className="text-sm text-gray-400 mt-1">
                  {calibrations.length} calibration{calibrations.length !== 1 ? 's' : ''} saved
                </p>
              </div>

              <div className="divide-y divide-gray-700">
                {calibrations.map((calibration) => (
                  <div
                    key={calibration.id}
                    className={`px-6 py-4 hover:bg-gray-750 transition-colors ${
                      calibration.is_active ? 'bg-gray-750' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold">
                            {calibration.device_name || 'Unnamed Device'}
                          </h3>
                          {calibration.is_active && (
                            <span className="bg-green-600 text-white text-xs px-2 py-1 rounded font-semibold flex items-center gap-1">
                              <Check className="w-3 h-3" />
                              Active
                            </span>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-4 text-sm text-gray-400">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            {formatDate(calibration.created_at)}
                          </span>
                          <span>
                            {calibration.num_digits} Digits
                          </span>
                          <span className="text-gray-500">
                            ID: {calibration.id}
                          </span>
                        </div>

                        {calibration.notes && (
                          <p className="text-gray-400 text-sm mt-2">
                            {calibration.notes}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => viewCalibrationDetails(calibration)}
                          className="bg-gray-700 hover:bg-gray-600 px-3 py-2 rounded-lg flex items-center gap-2 transition-colors"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                          <span className="text-sm">Details</span>
                        </button>

                        {!calibration.is_active && (
                          <button
                            onClick={() => setAsActive(calibration.id)}
                            className="bg-blue-600 hover:bg-blue-700 px-3 py-2 rounded-lg flex items-center gap-2 transition-colors"
                            title="Set as Active"
                          >
                            <Check className="w-4 h-4" />
                            <span className="text-sm">Activate</span>
                          </button>
                        )}

                        <button
                          onClick={() => setShowDeleteConfirm(calibration.id)}
                          className="bg-red-900 hover:bg-red-800 px-3 py-2 rounded-lg flex items-center gap-2 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg max-w-md w-full p-6">
            <h3 className="text-xl font-bold mb-4">Confirm Deletion</h3>
            <p className="text-gray-300 mb-6">
              Are you sure you want to delete this calibration? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="flex-1 bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteCalibration(showDeleteConfirm)}
                className="flex-1 bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg font-semibold transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Details Modal */}
      {selectedCalibration && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gray-800 border-b border-gray-700 px-6 py-4 flex items-center justify-between">
              <h3 className="text-xl font-bold">Calibration Details</h3>
              <button
                onClick={closeDetailsModal}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6">
              {/* Basic Info */}
              <div className="bg-gray-750 rounded-lg p-4 mb-6">
                <h4 className="font-semibold mb-3 text-lg">Basic Information</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-400">Device Name:</span>
                    <p className="font-semibold mt-1">
                      {selectedCalibration.device_name || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-400">Number of Digits:</span>
                    <p className="font-semibold mt-1">{selectedCalibration.num_digits}</p>
                  </div>
                  <div>
                    <span className="text-gray-400">Decimal Point:</span>
                    <p className="font-semibold mt-1">
                      {selectedCalibration.has_decimal_point ? (
                        <span className="text-green-400">
                          Yes ({selectedCalibration.decimal_position === 1 ? 'XX.X' : 'X.XX'})
                        </span>
                      ) : (
                        <span className="text-gray-400">No</span>
                      )}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-400">Created:</span>
                    <p className="font-semibold mt-1">
                      {formatDate(selectedCalibration.created_at)}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-400">Status:</span>
                    <p className="font-semibold mt-1">
                      {selectedCalibration.is_active ? (
                        <span className="text-green-400">Active</span>
                      ) : (
                        <span className="text-gray-400">Inactive</span>
                      )}
                    </p>
                  </div>
                </div>
                {selectedCalibration.notes && (
                  <div className="mt-4">
                    <span className="text-gray-400 text-sm">Notes:</span>
                    <p className="mt-1">{selectedCalibration.notes}</p>
                  </div>
                )}
              </div>

              {/* Display Box */}
              <div className="bg-gray-750 rounded-lg p-4 mb-6">
                <h4 className="font-semibold mb-3 text-lg">Display Bounding Box</h4>
                <div className="grid grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-gray-400">X:</span>
                    <p className="font-mono mt-1">
                      {selectedCalibration.display_box.x.toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-400">Y:</span>
                    <p className="font-mono mt-1">
                      {selectedCalibration.display_box.y.toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-400">Width:</span>
                    <p className="font-mono mt-1">
                      {selectedCalibration.display_box.width.toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-400">Height:</span>
                    <p className="font-mono mt-1">
                      {selectedCalibration.display_box.height.toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Segment Boxes */}
              <div className="bg-gray-750 rounded-lg p-4">
                <h4 className="font-semibold mb-3 text-lg">Segment Boxes</h4>
                <div className="space-y-4">
                  {selectedCalibration.segment_boxes.map((digit, digitIdx) => (
                    <div key={digitIdx} className="border border-gray-600 rounded-lg p-4">
                      <h5 className="font-semibold mb-3 text-blue-400">
                        Digit {digitIdx + 1}
                      </h5>
                      <div className="grid grid-cols-7 gap-2 text-xs">
                        {['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((seg, segIdx) => (
                          <div key={segIdx} className="bg-gray-800 rounded p-2">
                            <div className="font-semibold text-gray-400 mb-1">{seg}</div>
                            {digit[segIdx] && (
                              <div className="space-y-1 text-gray-500 font-mono">
                                <div>x: {digit[segIdx].x.toFixed(0)}</div>
                                <div>y: {digit[segIdx].y.toFixed(0)}</div>
                                <div>w: {digit[segIdx].width.toFixed(0)}</div>
                                <div>h: {digit[segIdx].height.toFixed(0)}</div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="mt-6 flex gap-3">
                {!selectedCalibration.is_active && (
                  <button
                    onClick={() => {
                      setAsActive(selectedCalibration.id);
                      closeDetailsModal();
                    }}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 px-4 py-3 rounded-lg font-semibold flex items-center justify-center gap-2 transition-colors"
                  >
                    <Check className="w-5 h-5" />
                    Set as Active
                  </button>
                )}
                <button
                  onClick={closeDetailsModal}
                  className="flex-1 bg-gray-700 hover:bg-gray-600 px-4 py-3 rounded-lg font-semibold transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MoistureSettings;