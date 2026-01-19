import React, { useState, useEffect } from "react";
import RVView from "./RVView";
import RVEdit from "./RVEdit";

// ============================================================================
// ACTION MODAL COMPONENT (Same as Dash.jsx)
// ============================================================================

const ActionModal = ({
  isOpen,
  onClose,
  onView,
  onEdit,
  onDelete,
  darkMode = true,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed bg-black bg-opacity-60 backdrop-blur-md flex items-center justify-center z-40"
      style={{ top: "60px", left: 0, right: 0, bottom: 0 }}
      onClick={onClose}
    >
      <div
        className={`shadow-2xl overflow-hidden ${darkMode ? "bg-gray-800" : "bg-white"}`}
        style={{ width: "min(500px, 90vw)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={`px-6 py-4 flex justify-between items-center border-b-2 ${
            darkMode
              ? "bg-gray-900 border-gray-700"
              : "bg-gray-100 border-gray-300"
          }`}
        >
          <h3
            className={`text-2xl font-bold ${darkMode ? "text-gray-100" : "text-gray-800"}`}
          >
            Options
          </h3>
          <button
            onClick={onClose}
            className={`transition-colors ${
              darkMode
                ? "text-gray-300 hover:text-gray-100"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            <svg
              className="w-7 h-7"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <button
          onClick={() => {
            onView();
            onClose();
          }}
          className={`w-full px-8 py-6 text-left transition-colors flex items-center gap-4 border-b-2 ${
            darkMode
              ? "hover:bg-gray-700 border-gray-700"
              : "hover:bg-gray-100 border-gray-200"
          }`}
        >
          <svg
            className={`w-10 h-10 ${darkMode ? "text-gray-200" : "text-gray-900"}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
            />
          </svg>
          <span
            className={`text-2xl font-medium ${darkMode ? "text-gray-100" : "text-gray-900"}`}
          >
            VIEW
          </span>
        </button>

        <button
          onClick={() => {
            onEdit();
            onClose();
          }}
          className={`w-full px-8 py-6 text-left transition-colors flex items-center gap-4 border-b-2 ${
            darkMode
              ? "hover:bg-gray-700 border-gray-700"
              : "hover:bg-gray-100 border-gray-200"
          }`}
        >
          <svg
            className={`w-10 h-10 ${darkMode ? "text-gray-200" : "text-gray-900"}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
            />
          </svg>
          <span
            className={`text-2xl font-medium ${darkMode ? "text-gray-100" : "text-gray-900"}`}
          >
            EDIT
          </span>
        </button>

        <button
          onClick={() => {
            onDelete();
            onClose();
          }}
          className={`w-full px-8 py-6 text-left text-red-600 transition-colors flex items-center gap-4 ${
            darkMode ? "hover:bg-gray-700" : "hover:bg-red-50"
          }`}
        >
          <svg
            className="w-10 h-10"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
            />
          </svg>
          <span className="text-2xl font-medium">DELETE</span>
        </button>
      </div>
    </div>
  );
};

// ============================================================================
// DELETE CONFIRMATION MODAL
// ============================================================================

const DeleteConfirmationModal = ({
  isOpen,
  onClose,
  onConfirm,
  itemName,
  darkMode = true,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed bg-black bg-opacity-60 backdrop-blur-md flex items-center justify-center z-40 p-4"
      style={{ top: "60px", left: 0, right: 0, bottom: 0 }}
    >
      <div
        className={`shadow-2xl ${darkMode ? "bg-gray-800" : "bg-white"}`}
        style={{ width: "min(600px, 90vw)" }}
      >
        <div className="bg-gradient-to-r from-red-600 to-red-500 text-white px-8 py-6">
          <h2 className="text-3xl font-bold">🗑️ Confirm Deletion</h2>
        </div>

        <div className="p-8">
          <div
            className={`p-6 rounded-lg mb-6 ${darkMode ? "bg-red-900 bg-opacity-20" : "bg-red-50"}`}
          >
            <p
              className={`text-lg ${darkMode ? "text-gray-200" : "text-gray-800"}`}
            >
              Are you sure you want to delete <strong>"{itemName}"</strong>?
            </p>
            <p
              className={`text-base mt-2 ${darkMode ? "text-gray-400" : "text-gray-600"}`}
            >
              This action cannot be undone.
            </p>
          </div>

          <div className="flex justify-end gap-4">
            <button
              onClick={onClose}
              className={`px-6 py-3 text-lg rounded-lg transition-colors ${
                darkMode
                  ? "bg-gray-600 text-gray-100 hover:bg-gray-500"
                  : "bg-gray-300 text-gray-700 hover:bg-gray-400"
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
// DATA TABLE COMPONENT (Matching Dash.jsx)
// ============================================================================

const DataTable = ({
  data,
  onView,
  onEdit,
  onDelete,
  sortConfig,
  onSort,
  darkMode = true,
}) => {
  const [actionModalOpen, setActionModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);

  const handleOpenActionModal = (item) => {
    setSelectedItem(item);
    setActionModalOpen(true);
  };

  const handleCloseActionModal = () => {
    setActionModalOpen(false);
    setSelectedItem(null);
  };

  const getGroupLabel = (group) => {
    const labels = {
      high: "High",
      moderately_high: "Moderately High",
      medium: "Medium",
    };
    return labels[group] || group;
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse">
          <thead
            className={`sticky top-0 z-10 ${darkMode ? "bg-gray-800" : "bg-white"}`}
          >
            <tr>
              <th
                className={`border px-2 py-2 text-sm font-medium text-center ${
                  darkMode
                    ? "border-gray-600 bg-gray-800 text-gray-200"
                    : "border-black bg-white text-gray-900"
                }`}
                style={{ minWidth: "100px" }}
              >
                Group
              </th>
              <th
                className={`border px-2 py-2 text-sm font-medium text-center cursor-pointer hover:bg-gray-700 ${
                  darkMode
                    ? "border-gray-600 bg-gray-800 text-gray-200"
                    : "border-black bg-white text-gray-900"
                }`}
                style={{ minWidth: "150px" }}
                onClick={() => onSort("common_name")}
              >
                Common Name{" "}
                {sortConfig.field === "common_name" &&
                  (sortConfig.order === "asc" ? "↑" : "↓")}
              </th>
              <th
                className={`border px-2 py-2 text-sm font-medium text-center ${
                  darkMode
                    ? "border-gray-600 bg-gray-800 text-gray-200"
                    : "border-black bg-white text-gray-900"
                }`}
                style={{ minWidth: "150px" }}
              >
                Botanical Name
              </th>
              <th
                className={`border px-2 py-2 text-sm font-medium text-center ${
                  darkMode
                    ? "border-gray-600 bg-gray-800 text-gray-200"
                    : "border-black bg-white text-gray-900"
                }`}
                style={{ minWidth: "100px" }}
              >
                Fc (MPa)
              </th>
              <th
                className={`border px-2 py-2 text-sm font-medium text-center ${
                  darkMode
                    ? "border-gray-600 bg-gray-800 text-gray-200"
                    : "border-black bg-white text-gray-900"
                }`}
                style={{ minWidth: "100px" }}
              >
                Fc⊥ (MPa)
              </th>
              <th
                className={`border px-2 py-2 text-sm font-medium text-center ${
                  darkMode
                    ? "border-gray-600 bg-gray-800 text-gray-200"
                    : "border-black bg-white text-gray-900"
                }`}
                style={{ minWidth: "100px" }}
              >
                Fv (MPa)
              </th>
              <th
                className={`border px-2 py-2 text-sm font-medium text-center ${
                  darkMode
                    ? "border-gray-600 bg-gray-800 text-gray-200"
                    : "border-black bg-white text-gray-900"
                }`}
                style={{ minWidth: "100px" }}
              >
                FbFt (MPa)
              </th>
              <th
                className={`border px-2 py-2 text-sm font-medium text-center sticky right-0 ${
                  darkMode
                    ? "border-gray-600 bg-gray-800 text-gray-200"
                    : "border-black bg-white text-gray-900"
                }`}
                style={{ width: "60px" }}
              >
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {data && data.length > 0 ? (
              data.map((item) => (
                <tr
                  key={item.id}
                  className={`transition-colors ${darkMode ? "hover:bg-gray-700 bg-gray-900" : "hover:bg-gray-100 bg-white"}`}
                >
                  <td
                    className={`border px-2 py-2 text-sm text-center ${
                      darkMode
                        ? "border-gray-600 text-gray-300"
                        : "border-black text-gray-700"
                    }`}
                  >
                    <span
                      className={`px-2 py-1 text-xs font-bold ${
                        item.strength_group === "high"
                          ? "bg-purple-600 text-white"
                          : item.strength_group === "moderately_high"
                            ? "bg-blue-600 text-white"
                            : "bg-green-600 text-white"
                      }`}
                    >
                      {getGroupLabel(item.strength_group)}
                    </span>
                  </td>
                  <td
                    className={`border px-2 py-2 text-sm text-center font-bold ${
                      darkMode
                        ? "border-gray-600 text-gray-100"
                        : "border-black text-gray-900"
                    }`}
                  >
                    {item.common_name}
                  </td>
                  <td
                    className={`border px-2 py-2 text-sm text-center italic ${
                      darkMode
                        ? "border-gray-600 text-gray-400"
                        : "border-black text-gray-600"
                    }`}
                  >
                    {item.botanical_name || "-"}
                  </td>
                  <td
                    className={`border px-2 py-2 text-sm text-center ${
                      darkMode
                        ? "border-gray-600 text-gray-200"
                        : "border-black text-gray-900"
                    }`}
                  >
                    {item.compression_parallel}
                  </td>
                  <td
                    className={`border px-2 py-2 text-sm text-center ${
                      darkMode
                        ? "border-gray-600 text-gray-200"
                        : "border-black text-gray-900"
                    }`}
                  >
                    {item.compression_perpendicular}
                  </td>
                  <td
                    className={`border px-2 py-2 text-sm text-center ${
                      darkMode
                        ? "border-gray-600 text-gray-200"
                        : "border-black text-gray-900"
                    }`}
                  >
                    {item.shear_parallel}
                  </td>
                  <td
                    className={`border px-2 py-2 text-sm text-center ${
                      darkMode
                        ? "border-gray-600 text-gray-200"
                        : "border-black text-gray-900"
                    }`}
                  >
                    {item.bending_tension_parallel}
                  </td>
                  <td
                    className={`border px-1 py-1 text-center sticky right-0 ${
                      darkMode
                        ? "border-gray-600 bg-gray-800"
                        : "border-black bg-white"
                    }`}
                  >
                    <button
                      onClick={() => handleOpenActionModal(item)}
                      className={`w-full h-full px-2 py-2 transition-colors rounded ${
                        darkMode ? "hover:bg-gray-700" : "hover:bg-gray-200"
                      }`}
                    >
                      <svg
                        className={`w-5 h-5 mx-auto ${darkMode ? "text-gray-200" : "text-gray-900"}`}
                        fill="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path d="M3 6h18v2H3V6zm0 5h18v2H3v-2zm0 5h18v2H3v-2z" />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={8}
                  className={`border px-4 py-8 text-center ${
                    darkMode
                      ? "border-gray-600 text-gray-400"
                      : "border-black text-gray-500"
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
        onDelete={() => onDelete(selectedItem)}
        darkMode={darkMode}
      />
    </div>
  );
};

// ============================================================================
// MAIN REFERENCE VALUES COMPONENT (Matching Dash.jsx)
// ============================================================================

const ReferenceValues = ({ darkMode = true }) => {
  const API_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

  // State
  const [referenceValues, setReferenceValues] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedGroup, setSelectedGroup] = useState("all");
  const [sortConfig, setSortConfig] = useState({
    field: "common_name",
    order: "asc",
  });

  // View state
  const [showView, setShowView] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);

  // Modal states
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteItem, setDeleteItem] = useState(null);

  // Load data on mount
  useEffect(() => {
    fetchAllData();
  }, []);

  const extractRows = (payload) => {
    if (Array.isArray(payload)) return payload;
    if (payload && Array.isArray(payload.data)) return payload.data;
    return [];
  };

  // Filter and search
  useEffect(() => {
    let filtered = [...referenceValues];

    if (selectedGroup !== "all") {
      filtered = filtered.filter(
        (item) => item.strength_group === selectedGroup,
      );
    }

    if (searchTerm) {
      filtered = filtered.filter(
        (item) =>
          item.common_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (item.botanical_name &&
            item.botanical_name
              .toLowerCase()
              .includes(searchTerm.toLowerCase())),
      );
    }

    filtered.sort((a, b) => {
      const aVal = a[sortConfig.field];
      const bVal = b[sortConfig.field];

      if (typeof aVal === "number") {
        return sortConfig.order === "asc" ? aVal - bVal : bVal - aVal;
      }

      return sortConfig.order === "asc"
        ? String(aVal).localeCompare(String(bVal))
        : String(bVal).localeCompare(String(aVal));
    });

    setFilteredData(filtered);
  }, [referenceValues, searchTerm, selectedGroup, sortConfig]);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/reference-values`);
      if (!response.ok)
        throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      setReferenceValues(extractRows(data));
    } catch (err) {
      console.error("Failed to load reference values:", err);
      setError(
        "Failed to load reference values. Please check your connection.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (field) => {
    setSortConfig((prev) => ({
      field,
      order: prev.field === field && prev.order === "asc" ? "desc" : "asc",
    }));
  };

  const handleView = (item) => {
    setSelectedItem(item);
    setShowView(true);
  };

  const handleEdit = (item) => {
    setSelectedItem(item);
    setShowEdit(true);
  };

  const handleDelete = (item) => {
    setDeleteItem(item);
    setDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    try {
      const response = await fetch(
        `${API_URL}/api/reference-values/${deleteItem.id}`,
        { method: "DELETE" },
      );
      if (!response.ok) throw new Error("Failed to delete reference value");
      fetchAllData();
      setDeleteModalOpen(false);
      setDeleteItem(null);
    } catch (error) {
      console.error("Error deleting data:", error);
    }
  };

  if (loading) {
    return (
      <div
        className={`flex items-center justify-center h-full ${darkMode ? "bg-gray-900 text-gray-100" : "bg-gray-50 text-gray-900"}`}
      >
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={`flex items-center justify-center h-full ${darkMode ? "bg-gray-900 text-red-400" : "bg-gray-50 text-red-600"}`}
      >
        <div className="text-xl">{error}</div>
      </div>
    );
  }

  // Show RVView if selected
  if (showView) {
    return (
      <RVView
        data={selectedItem}
        darkMode={darkMode}
        onClose={() => {
          setShowView(false);
          setSelectedItem(null);
        }}
      />
    );
  }

  // Show RVEdit if selected
  if (showEdit) {
    return (
      <RVEdit
        data={selectedItem}
        darkMode={darkMode}
        onClose={() => {
          setShowEdit(false);
          setSelectedItem(null);
        }}
        onSave={() => {
          fetchAllData();
          setShowEdit(false);
          setSelectedItem(null);
        }}
      />
    );
  }

  // Show Dashboard (Matching Dash.jsx structure exactly)
  return (
    <>
      <div
        className={`overflow-hidden flex flex-col ${darkMode ? "bg-gray-900" : "bg-gray-50"}`}
        style={{ height: "calc(100vh - 60px)" }}
      >
        {/* Toolbar Bar - Matching Dash.jsx tab style */}
        <div
          className={`border-b ${darkMode ? "border-gray-700" : "border-gray-300"}`}
        >
          <div className="flex items-center justify-between px-6 py-3">
            <div className="flex items-center gap-3">
              {/* Search */}
              <input
                type="text"
                placeholder="Search species..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`px-3 py-2 text-sm border ${
                  darkMode
                    ? "bg-gray-800 border-gray-600 text-gray-100 placeholder-gray-500"
                    : "bg-white border-gray-300 text-gray-900 placeholder-gray-400"
                }`}
                style={{ width: "300px" }}
              />

              {/* Group Filter */}
              <select
                value={selectedGroup}
                onChange={(e) => setSelectedGroup(e.target.value)}
                className={`px-3 py-2 text-sm border ${
                  darkMode
                    ? "bg-gray-800 border-gray-600 text-gray-100"
                    : "bg-white border-gray-300 text-gray-900"
                }`}
              >
                <option value="all">All Groups</option>
                <option value="high">High</option>
                <option value="moderately_high">Moderately High</option>
                <option value="medium">Medium</option>
              </select>

              {/* Refresh Button */}
              <button
                onClick={fetchAllData}
                className={`px-3 py-2 text-sm border transition-colors ${
                  darkMode
                    ? "bg-gray-800 border-gray-600 text-gray-100 hover:bg-gray-700"
                    : "bg-white border-gray-300 text-gray-900 hover:bg-gray-50"
                }`}
              >
                ↻
              </button>
            </div>

            {/* Add Button */}
            <button
              onClick={() => handleEdit(null)}
              className="px-4 py-2 text-sm font-bold bg-green-600 text-white hover:bg-green-700 transition-colors"
            >
              + Add New Comparison
            </button>
          </div>
        </div>

        {/* Table Content - Matching Dash.jsx structure */}
        <div className="flex-1 overflow-hidden">
          <DataTable
            data={filteredData}
            onView={handleView}
            onEdit={handleEdit}
            onDelete={handleDelete}
            sortConfig={sortConfig}
            onSort={handleSort}
            darkMode={darkMode}
          />
        </div>
      </div>

      {/* Modals */}
      <DeleteConfirmationModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={confirmDelete}
        itemName={deleteItem?.common_name || "this item"}
        darkMode={darkMode}
      />
    </>
  );
};

export default ReferenceValues;
