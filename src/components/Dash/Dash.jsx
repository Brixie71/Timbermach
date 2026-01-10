import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import SpecimenView from "./SpecimenView";
import DataEdit from "./SpecimenEdit";

// ============================================================================
// SMALL HELPERS (compact datetime formatting for 800x480)
// ============================================================================

function formatDbDateTime(value) {
  if (!value) return "-";
  // Expected from DB: "2025-12-31 03:56:39" OR ISO string
  const s = String(value).trim();

  // If already looks like "YYYY-MM-DD HH:MM:SS"
  const m = s.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})(?::\d{2})?/);
  if (m) return `${m[1]} ${m[2]}`;

  // Fallback: try Date parsing
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    const pad = (n) => String(n).padStart(2, "0");
    const yyyy = d.getFullYear();
    const mm = pad(d.getMonth() + 1);
    const dd = pad(d.getDate());
    const hh = pad(d.getHours());
    const mi = pad(d.getMinutes());
    return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
  }

  return s;
}

// ============================================================================
// ACTION MODAL
// ============================================================================

const ActionModal = ({
  isOpen,
  onClose,
  onView,
  onEdit,
  onDelete,
  darkMode = false,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed bg-black/60 backdrop-blur-sm flex items-center justify-center z-40"
      style={{ top: "60px", left: 0, right: 0, bottom: 0 }}
      onClick={onClose}
    >
      <div
        className={`shadow-2xl overflow-hidden rounded-lg ${
          darkMode ? "bg-gray-800" : "bg-white"
        }`}
        style={{ width: "min(420px, 92vw)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={`px-4 py-3 flex justify-between items-center border-b ${
            darkMode
              ? "bg-gray-900 border-gray-700"
              : "bg-gray-50 border-gray-300"
          }`}
        >
          <h3
            className={`text-lg font-semibold ${
              darkMode ? "text-gray-100" : "text-gray-800"
            }`}
          >
            Options
          </h3>

          <button
            onClick={onClose}
            className={`transition-colors p-1 rounded ${
              darkMode
                ? "text-gray-300 hover:text-gray-100 hover:bg-gray-800"
                : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
            }`}
            title="Close"
          >
            <svg
              className="w-6 h-6"
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

        {[
          {
            label: "VIEW",
            onClick: () => {
              onView();
              onClose();
            },
            danger: false,
          },
          {
            label: "EDIT",
            onClick: () => {
              onEdit();
              onClose();
            },
            danger: false,
          },
          {
            label: "DELETE",
            onClick: () => {
              onDelete();
              onClose();
            },
            danger: true,
          },
        ].map((item) => (
          <button
            key={item.label}
            onClick={item.onClick}
            className={`w-full px-5 py-4 text-left transition-colors flex items-center justify-between border-b last:border-b-0 ${
              item.danger
                ? darkMode
                  ? "text-red-300 hover:bg-gray-700 border-gray-700"
                  : "text-red-600 hover:bg-red-50 border-gray-200"
                : darkMode
                  ? "text-gray-100 hover:bg-gray-700 border-gray-700"
                  : "text-gray-900 hover:bg-gray-100 border-gray-200"
            }`}
          >
            <span className="text-base font-extrabold tracking-wide">
              {item.label}
            </span>
            <span
              className={`text-sm ${darkMode ? "text-gray-300" : "text-gray-600"}`}
            >
              →
            </span>
          </button>
        ))}
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
  darkMode = false,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed bg-black/60 backdrop-blur-sm flex items-center justify-center z-40 p-3"
      style={{ top: "60px", left: 0, right: 0, bottom: 0 }}
    >
      <div
        className={`shadow-2xl rounded-lg overflow-hidden ${
          darkMode ? "bg-gray-800" : "bg-white"
        }`}
        style={{ width: "min(520px, 92vw)" }}
      >
        <div className="bg-gradient-to-r from-red-600 to-red-500 text-white px-5 py-4">
          <h2 className="text-lg font-bold">Confirm Deletion</h2>
        </div>

        <div className="p-5">
          <div
            className={`p-4 rounded-lg mb-4 ${
              darkMode ? "bg-red-900/20" : "bg-red-50"
            }`}
          >
            <p
              className={`text-sm ${
                darkMode ? "text-gray-200" : "text-gray-800"
              }`}
            >
              Are you sure you want to delete{" "}
              <strong>"{itemName}"</strong>?
            </p>
            <p
              className={`text-xs mt-1 ${
                darkMode ? "text-gray-400" : "text-gray-600"
              }`}
            >
              This action cannot be undone.
            </p>
          </div>

          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              className={`px-4 py-2 text-sm rounded-md transition-colors ${
                darkMode
                  ? "bg-gray-600 text-gray-100 hover:bg-gray-500"
                  : "bg-gray-200 text-gray-800 hover:bg-gray-300"
              }`}
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              className="px-4 py-2 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors font-semibold"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// COMPACT TABLE (Specimen, Test Type, Dates, Actions)
// ============================================================================

const CompactDataTable = ({
  data,
  onView,
  onEdit,
  onDelete,
  darkMode = false,
}) => {
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
          <thead className={`sticky top-0 z-10 ${darkMode ? "bg-gray-800" : "bg-white"}`}>
            <tr>
              {["Specimen", "Test Type", "Test Date", "Modified"].map((h) => (
                <th
                  key={h}
                  className={`border text-[13px] font-extrabold text-center px-2 py-2 leading-tight ${
                    darkMode
                      ? "border-gray-600 bg-gray-800 text-gray-200"
                      : "border-black bg-white text-gray-900"
                  }`}
                >
                  {h}
                </th>
              ))}

              <th
                className={`border text-[13px] font-extrabold text-center px-2 py-2 sticky right-0 ${
                  darkMode
                    ? "border-gray-600 bg-gray-800 text-gray-200"
                    : "border-black bg-white text-gray-900"
                }`}
                style={{ width: "70px" }}
              >
                Actions
              </th>
            </tr>
          </thead>

          <tbody>
            {data && data.length > 0 ? (
              data.map((row, idx) => {
                const itemId =
                  row.compressive_id || row.shear_id || row.flexure_id || row.ID;

                return (
                  <tr
                    key={idx}
                    className={`transition-colors ${
                      darkMode ? "hover:bg-gray-700" : "hover:bg-gray-100"
                    }`}
                  >
                    {/* Specimen */}
                    <td
                      className={`border text-[13px] font-semibold text-center px-2 py-3 leading-tight ${
                        darkMode ? "border-gray-600 text-gray-100" : "border-black text-gray-900"
                      }`}
                      style={{ minWidth: "160px" }}
                    >
                      {row.specimen_name ?? row["Specimen Name"] ?? "-"}
                    </td>

                    {/* Test Type */}
                    <td
                      className={`border text-[13px] font-semibold text-center px-2 py-3 leading-tight ${
                        darkMode ? "border-gray-600 text-gray-100" : "border-black text-gray-900"
                      }`}
                      style={{ minWidth: "140px" }}
                    >
                      {row.test_type ?? row["Test Type"] ?? "-"}
                    </td>

                    {/* Created */}
                    <td
                      className={`border text-[13px] text-center px-2 py-3 leading-tight ${
                        darkMode ? "border-gray-600 text-gray-100" : "border-black text-gray-900"
                      }`}
                      style={{ minWidth: "150px" }}
                    >
                      {formatDbDateTime(row.created_at)}
                    </td>

                    {/* Updated */}
                    <td
                      className={`border text-[13px] text-center px-2 py-3 leading-tight ${
                        darkMode ? "border-gray-600 text-gray-100" : "border-black text-gray-900"
                      }`}
                      style={{ minWidth: "150px" }}
                    >
                      {formatDbDateTime(row.updated_at)}
                    </td>

                    {/* Actions */}
                    <td
                      className={`border text-center sticky right-0 ${
                        darkMode ? "border-gray-600 bg-gray-800" : "border-black bg-white"
                      }`}
                    >
                      <button
                        onClick={() => handleOpenActionModal(row, itemId)}
                        className={`w-full h-full px-2 py-3 transition-colors ${
                          darkMode ? "hover:bg-gray-700" : "hover:bg-gray-200"
                        }`}
                        title="Actions"
                      >
                        <svg
                          className={`w-6 h-6 mx-auto ${
                            darkMode ? "text-gray-200" : "text-gray-900"
                          }`}
                          fill="currentColor"
                          viewBox="0 0 24 24"
                        >
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
                  colSpan={5}
                  className={`border px-4 py-6 text-center text-sm ${
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
        onDelete={() => onDelete(selectedItem, selectedItemId)}
        darkMode={darkMode}
      />
    </div>
  );
};

// ============================================================================
// MAIN DASH
// ============================================================================

const Dash = ({ darkMode = false }) => {
  const [compressiveData, setCompressiveData] = useState([]);
  const [shearData, setShearData] = useState([]);
  const [flexureData, setFlexureData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [activeTab, setActiveTab] = useState("compressive");

  // View state
  const [showSpecimenView, setShowSpecimenView] = useState(false);
  const [showEditView, setShowEditView] = useState(false);
  const [selectedSpecimen, setSelectedSpecimen] = useState(null);
  const [selectedDataType, setSelectedDataType] = useState(null);

  // Delete modal
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteItem, setDeleteItem] = useState(null);
  const [deleteItemId, setDeleteItemId] = useState(null);
  const [deleteDataType, setDeleteDataType] = useState(null);

  const tabs = useMemo(
    () => [
      { id: "compressive", label: "Compressive" },
      { id: "shear", label: "Shear" },
      { id: "flexure", label: "Flexure" },
    ],
    []
  );

  useEffect(() => {
    fetchAllData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [compRes, shearRes, flexRes] = await Promise.all([
        axios.get("http://127.0.0.1:8000/api/compressive-data"),
        axios.get("http://127.0.0.1:8000/api/shear-data"),
        axios.get("http://127.0.0.1:8000/api/flexure-data"),
      ]);

      // NOTE: keep raw rows so we can read created_at / updated_at / etc
      setCompressiveData(compRes.data || []);
      setShearData(shearRes.data || []);
      setFlexureData(flexRes.data || []);
    } catch (err) {
      console.error("Error fetching data:", err);
      setError("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const handleView = (item, type) => {
    setSelectedSpecimen(item);
    setSelectedDataType(type);
    setShowSpecimenView(true);
  };

  const handleEdit = (item, type) => {
    setSelectedSpecimen(item);
    setSelectedDataType(type);
    setShowEditView(true);
  };

  const handleDelete = (item, itemId, type) => {
    setDeleteItem(item);
    setDeleteItemId(itemId);
    setDeleteDataType(type);
    setDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    try {
      await axios.delete(
        `http://127.0.0.1:8000/api/${deleteDataType}-data/${deleteItemId}`
      );
      setDeleteModalOpen(false);
      fetchAllData();
    } catch (error) {
      console.error("Error deleting data:", error);
    }
  };

  const activeRows = useMemo(() => {
    if (activeTab === "compressive") return compressiveData;
    if (activeTab === "shear") return shearData;
    return flexureData;
  }, [activeTab, compressiveData, shearData, flexureData]);

  if (loading) {
    return (
      <div
        className={`flex items-center justify-center h-full ${
          darkMode ? "bg-gray-900 text-gray-100" : "bg-gray-50 text-gray-900"
        }`}
        style={{ fontFamily: "JustSans, system-ui, sans-serif" }}
      >
        <div className="text-sm font-semibold">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={`flex items-center justify-center h-full ${
          darkMode ? "bg-gray-900 text-red-400" : "bg-gray-50 text-red-600"
        }`}
        style={{ fontFamily: "JustSans, system-ui, sans-serif" }}
      >
        <div className="text-sm font-semibold">{error}</div>
      </div>
    );
  }

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

  if (showEditView) {
    return (
      <DataEdit
        data={selectedSpecimen}
        dataType={selectedDataType}
        darkMode={darkMode}
        onClose={() => {
          setShowEditView(false);
          setSelectedSpecimen(null);
          setSelectedDataType(null);
        }}
        onSave={() => {
          fetchAllData();
          setShowEditView(false);
          setSelectedSpecimen(null);
          setSelectedDataType(null);
        }}
      />
    );
  }

  return (
    <>
      <div
        className={`overflow-hidden flex flex-col ${
          darkMode ? "bg-gray-900" : "bg-gray-50"
        }`}
        style={{
          height: "calc(100vh - 60px)",
          fontFamily: "JustSans, system-ui, sans-serif",
        }}
      >
        {/* Tabs */}
        <div className={`${darkMode ? "border-gray-700" : "border-gray-300"} border-b`}>
          <div className="flex w-full">
            {tabs.map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 text-center transition-colors border-b-2 ${
                    active
                      ? darkMode
                        ? "text-blue-300 border-blue-400 bg-gray-800"
                        : "text-black border-black bg-gray-100"
                      : darkMode
                        ? "text-gray-300 border-transparent hover:bg-gray-800"
                        : "text-gray-600 border-transparent hover:bg-gray-50"
                  }`}
                  style={{
                    paddingTop: "10px",
                    paddingBottom: "10px",
                    fontSize: "13px",
                    fontWeight: 800,
                    letterSpacing: "0.2px",
                  }}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Compact Table */}
        <div className="flex-1 overflow-hidden">
          <CompactDataTable
            data={activeRows}
            onView={(item) => handleView(item, activeTab)}
            onEdit={(item) => handleEdit(item, activeTab)}
            onDelete={(item, id) => handleDelete(item, id, activeTab)}
            darkMode={darkMode}
          />
        </div>
      </div>

      <DeleteConfirmationModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={confirmDelete}
        itemName={deleteItem?.specimen_name || "this item"}
        darkMode={darkMode}
      />
    </>
  );
};

export default Dash;
