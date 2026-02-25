import React, { useState, useEffect } from 'react';
import { Settings, Trash2, Check, X, Eye, Plus, Calendar, Edit } from 'lucide-react';
import { LARAVEL_BASE_URL } from "../../config/servers";

const MoistureSettings = ({ onBack, onEditCalibration }) => {
  const LARAVEL_API_URL = LARAVEL_BASE_URL;
  
  const [calibrations, setCalibrations] = useState([]);
  const [activeCalibration, setActiveCalibration] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const [selectedCalibration, setSelectedCalibration] = useState(null);

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
        await loadCalibrations();
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

  const handleEditCalibration = (calibration) => {
    // Pass calibration data to edit function if provided
    if (onEditCalibration) {
      onEditCalibration(calibration);
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
      <div className="bg-gray-800 border-b border-gray-700 px-6 py-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="text-2xl hover:text-blue-400 transition-colors">
            ←
          </button>
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-blue-300 font-semibold">Moisture</div>
            <div className="text-xl font-bold flex items-center gap-2">
              <Settings className="w-5 h-5 text-blue-400" />
              Seven-Segment Calibrations
            </div>
          </div>
        </div>
        {onEditCalibration && (
          <button
            onClick={() => onEditCalibration()}
            className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-xl font-semibold flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            New Calibration
          </button>
        )}
      </div>

      <div className="max-w-6xl mx-auto px-6 py-6 space-y-4">
        {error && (
          <div className="rounded-xl border border-red-700 bg-red-900/30 px-4 py-3 text-sm text-red-100">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-gray-300 text-sm">Loading…</div>
        ) : (
          <div className="rounded-2xl border border-gray-800 bg-gray-900/70 overflow-hidden">
            <div className="px-4 py-3 flex items-center justify-between border-b border-gray-800">
              <div className="text-sm text-gray-300">
                Total: {calibrations.length} | Active: {activeCalibration ? activeCalibration.id : "None"}
              </div>
              <div className="text-xs text-gray-500">Tap a row for actions</div>
            </div>

            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-900/80">
                  <tr className="text-gray-300">
                    <th className="text-left px-4 py-3 font-semibold">Name</th>
                    <th className="text-left px-4 py-3 font-semibold">Digits</th>
                    <th className="text-left px-4 py-3 font-semibold">Decimal</th>
                    <th className="text-left px-4 py-3 font-semibold">Created</th>
                    <th className="text-left px-4 py-3 font-semibold">Status</th>
                    <th className="text-right px-4 py-3 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {calibrations.map((cal) => {
                    const isActive = cal.is_active;
                    return (
                      <tr
                        key={cal.id}
                        className={`border-t border-gray-800 ${
                          isActive ? "bg-green-900/10" : "bg-gray-900/30"
                        }`}
                      >
                        <td className="px-4 py-3 font-semibold text-gray-100">
                          {cal.device_name || "Unnamed"}
                        </td>
                        <td className="px-4 py-3 text-gray-200">{cal.num_digits}</td>
                        <td className="px-4 py-3 text-gray-200">
                          {cal.has_decimal_point ? (cal.decimal_position === 1 ? "XX.X" : "X.XX") : "None"}
                        </td>
                        <td className="px-4 py-3 text-gray-400">{formatDate(cal.created_at)}</td>
                        <td className="px-4 py-3 text-gray-200">
                          {isActive ? (
                            <span className="rounded-full bg-green-700 px-2 py-1 text-xs font-bold text-white">
                              Active
                            </span>
                          ) : (
                            <span className="text-gray-400 text-xs">Inactive</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex items-center gap-2">
                            <button
                              onClick={() => viewCalibrationDetails(cal)}
                              className="px-2 py-1 rounded-lg bg-gray-800 hover:bg-gray-700 text-xs"
                            >
                              View
                            </button>
                            <button
                              onClick={() => handleEditCalibration(cal)}
                              className="px-2 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-xs"
                            >
                              Edit
                            </button>
                            {!isActive && (
                              <button
                                onClick={() => setAsActive(cal.id)}
                                className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-xs"
                              >
                                Activate
                              </button>
                            )}
                            <button
                              onClick={() => setShowDeleteConfirm(cal.id)}
                              className="px-2 py-1 rounded-lg bg-red-700 hover:bg-red-800 text-xs"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {calibrations.length === 0 && (
                    <tr>
                      <td className="px-4 py-6 text-center text-gray-500" colSpan={6}>
                        No calibrations yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-5 w-full max-w-md">
            <h3 className="text-lg font-bold text-white mb-2">Delete calibration?</h3>
            <p className="text-sm text-gray-300 mb-4">
              This action cannot be undone.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteCalibration(showDeleteConfirm)}
                className="px-4 py-2 rounded-lg bg-red-700 hover:bg-red-800 text-sm font-semibold"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedCalibration && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-700">
              <div className="text-lg font-semibold">Calibration Details</div>
              <button onClick={closeDetailsModal} className="text-gray-300 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-5 space-y-4 text-sm text-gray-200">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-gray-400 text-xs">Device Name</div>
                  <div className="font-semibold">{selectedCalibration.device_name || "N/A"}</div>
                </div>
                <div>
                  <div className="text-gray-400 text-xs">Digits</div>
                  <div className="font-semibold">{selectedCalibration.num_digits}</div>
                </div>
                <div>
                  <div className="text-gray-400 text-xs">Decimal</div>
                  <div className="font-semibold">
                    {selectedCalibration.has_decimal_point
                      ? selectedCalibration.decimal_position === 1
                        ? "XX.X"
                        : "X.XX"
                      : "None"}
                  </div>
                </div>
                <div>
                  <div className="text-gray-400 text-xs">Created</div>
                  <div className="font-semibold">{formatDate(selectedCalibration.created_at)}</div>
                </div>
                <div>
                  <div className="text-gray-400 text-xs">Status</div>
                  <div className="font-semibold">
                    {selectedCalibration.is_active ? "Active" : "Inactive"}
                  </div>
                </div>
              </div>

              {selectedCalibration.notes && (
                <div>
                  <div className="text-gray-400 text-xs">Notes</div>
                  <div>{selectedCalibration.notes}</div>
                </div>
              )}

              <div>
                <div className="text-gray-400 text-xs mb-2">Display Box</div>
                <div className="grid grid-cols-4 gap-3 font-mono text-xs bg-gray-900/60 p-3 rounded-lg border border-gray-800">
                  <div>X: {selectedCalibration.display_box.x.toFixed(2)}</div>
                  <div>Y: {selectedCalibration.display_box.y.toFixed(2)}</div>
                  <div>W: {selectedCalibration.display_box.width.toFixed(2)}</div>
                  <div>H: {selectedCalibration.display_box.height.toFixed(2)}</div>
                </div>
              </div>

              <div>
                <div className="text-gray-400 text-xs mb-2">Segment Boxes</div>
                <div className="space-y-3">
                  {selectedCalibration.segment_boxes.map((digit, idx) => (
                    <div key={idx} className="border border-gray-800 rounded-lg p-3">
                      <div className="text-xs font-semibold text-blue-300 mb-2">Digit {idx + 1}</div>
                      <div className="grid grid-cols-7 gap-2 text-[11px] font-mono text-gray-300">
                        {digit.map((seg, segIdx) => (
                          <div key={segIdx} className="bg-gray-900/60 border border-gray-800 rounded p-2">
                            <div className="text-gray-500 mb-1">{"ABCDEFG"[segIdx]}</div>
                            <div>x: {seg.x.toFixed(0)}</div>
                            <div>y: {seg.y.toFixed(0)}</div>
                            <div>w: {seg.width.toFixed(0)}</div>
                            <div>h: {seg.height.toFixed(0)}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => handleEditCalibration(selectedCalibration)}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-sm font-semibold"
                >
                  Edit
                </button>
                {!selectedCalibration.is_active && (
                  <button
                    onClick={() => {
                      setAsActive(selectedCalibration.id);
                      closeDetailsModal();
                    }}
                    className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-sm font-semibold"
                  >
                    Activate
                  </button>
                )}
                <button
                  onClick={closeDetailsModal}
                  className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-sm font-semibold"
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
