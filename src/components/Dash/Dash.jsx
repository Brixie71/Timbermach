import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import SpecimenView from "./SpecimenView";
import DataEdit from "./SpecimenEdit";

// Keep in sync with Header height in App/Header.jsx
const HEADER_H = 64;

// ============================================================================
// SMALL HELPERS (compact datetime formatting for 800x480)
// ============================================================================
function formatDbDateTime(value) {
  if (!value) return "-";
  const s = String(value).trim();

  // If already looks like "YYYY-MM-DD HH:MM:SS"
  const m = s.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})(?::\d{2})?/);
  if (m) return `${m[1]} ${m[2]}`;

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
      style={{ top: `${HEADER_H}px`, left: 0, right: 0, bottom: 0 }}
      onClick={onClose}
    >
      <div
        className={[
          "shadow-2xl overflow-hidden rounded-2xl border",
          darkMode
            ? "bg-gray-900/80 border-gray-800 text-gray-100"
            : "bg-white/80 border-gray-200 text-gray-900",
          "backdrop-blur supports-[backdrop-filter]:backdrop-blur",
        ].join(" ")}
        style={{ width: "min(420px, 92vw)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={[
            "px-4 py-3 flex justify-between items-center border-b",
            darkMode ? "border-gray-800" : "border-gray-200",
          ].join(" ")}
        >
          <h3 className="text-base font-semibold">Options</h3>

          <button
            onClick={onClose}
            className={[
              "transition-colors p-2 rounded-xl",
              darkMode ? "hover:bg-white/10" : "hover:bg-black/5",
            ].join(" ")}
            title="Close"
          >
            <svg
              className="w-5 h-5"
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
            label: "View",
            onClick: () => {
              onView();
              onClose();
            },
            danger: false,
          },
          {
            label: "Edit",
            onClick: () => {
              onEdit();
              onClose();
            },
            danger: false,
          },
          {
            label: "Delete",
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
            className={[
              "w-full px-5 py-4 text-left transition-colors flex items-center justify-between",
              "border-b last:border-b-0",
              darkMode ? "border-gray-800" : "border-gray-200",
              item.danger
                ? darkMode
                  ? "text-red-200 hover:bg-red-500/10"
                  : "text-red-600 hover:bg-red-500/10"
                : darkMode
                  ? "text-gray-100 hover:bg-white/10"
                  : "text-gray-900 hover:bg-black/5",
            ].join(" ")}
          >
            <span className="text-sm font-extrabold tracking-wide">
              {item.label.toUpperCase()}
            </span>
            <span className={["text-sm", darkMode ? "text-gray-300" : "text-gray-500"].join(" ")}>
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
      style={{ top: `${HEADER_H}px`, left: 0, right: 0, bottom: 0 }}
      onClick={onClose}
    >
      <div
        className={[
          "shadow-2xl rounded-2xl overflow-hidden border",
          darkMode
            ? "bg-gray-900/80 border-gray-800 text-gray-100"
            : "bg-white/80 border-gray-200 text-gray-900",
          "backdrop-blur supports-[backdrop-filter]:backdrop-blur",
        ].join(" ")}
        style={{ width: "min(520px, 92vw)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={[
            "px-5 py-4 border-b",
            darkMode ? "border-gray-800" : "border-gray-200",
          ].join(" ")}
        >
          <h2 className="text-base font-bold">Confirm Deletion</h2>
        </div>

        <div className="p-5">
          <div
            className={[
              "p-4 rounded-xl mb-4 border",
              darkMode
                ? "bg-red-500/10 border-red-500/20"
                : "bg-red-500/10 border-red-500/20",
            ].join(" ")}
          >
            <p className="text-sm">
              Are you sure you want to delete{" "}
              <strong>"{itemName}"</strong>?
            </p>
            <p className={["text-xs mt-1", darkMode ? "text-gray-300" : "text-gray-600"].join(" ")}>
              This action cannot be undone.
            </p>
          </div>

          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              className={[
                "px-4 py-2 text-sm rounded-xl transition-colors",
                darkMode
                  ? "bg-white/10 hover:bg-white/15 text-gray-100"
                  : "bg-black/5 hover:bg-black/10 text-gray-900",
              ].join(" ")}
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              className={[
                "px-4 py-2 text-sm rounded-xl transition-colors font-semibold",
                darkMode
                  ? "bg-red-500/20 hover:bg-red-500/30 text-red-100"
                  : "bg-red-600 hover:bg-red-700 text-white",
              ].join(" ")}
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

  const thBase = [
    "text-[12px] sm:text-[13px] font-extrabold text-center px-2 py-2 leading-tight",
    darkMode ? "text-gray-200" : "text-gray-700",
  ].join(" ");
  
  const tdBase = [
    "text-[12px] sm:text-[13px] px-2 py-3 leading-tight text-center",
    darkMode ? "text-gray-100" : "text-gray-900",
  ].join(" ");

  const borderCls = darkMode ? "border-gray-700" : "border-gray-200";
  const headBg = darkMode ? "bg-gray-900/80" : "bg-white/80";
  const cellBg = darkMode ? "bg-gray-900/60" : "bg-white";
  const hoverBg = darkMode ? "hover:bg-white/5" : "hover:bg-black/5";

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-auto">
        <table
          className={[
            "w-full border-collapse",
            darkMode ? "text-gray-100" : "text-gray-900",
          ].join(" ")}
        >
          <thead className={`sticky top-0 z-10 ${headBg} backdrop-blur`}>
            <tr>
              {["Specimen", "Test Type", "Test Date", "Modified"].map((h) => (
                <th
                  key={h}
                  className={`border ${borderCls} ${thBase}`}
                >
                  {h}
                </th>
              ))}

              <th
                className={`border ${borderCls} ${thBase} sticky right-0 ${headBg} backdrop-blur`}
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
                  <tr key={idx} className={`transition-colors ${hoverBg}`}>
                    <td
                      className={`border ${borderCls} ${tdBase} font-semibold`}
                      style={{ minWidth: "160px" }}
                    >
                      {row.specimen_name ?? row["Specimen Name"] ?? "-"}
                    </td>

                    <td
                      className={`border ${borderCls} ${tdBase} font-semibold`}
                      style={{ minWidth: "140px" }}
                    >
                      {row.test_type ?? row["Test Type"] ?? "-"}
                    </td>

                    <td
                      className={`border ${borderCls} ${tdBase}`}
                      style={{ minWidth: "150px" }}
                    >
                      {formatDbDateTime(row.created_at)}
                    </td>

                    <td
                      className={`border ${borderCls} ${tdBase}`}
                      style={{ minWidth: "150px" }}
                    >
                      {formatDbDateTime(row.updated_at)}
                    </td>

                    <td
                      className={[
                        `border ${borderCls} text-center sticky right-0`,
                        cellBg,
                      ].join(" ")}
                    >
                      <button
                        onClick={() => handleOpenActionModal(row, itemId)}
                        className={[
                          "w-full h-full px-2 py-3 transition-colors",
                          darkMode ? "hover:bg-white/10" : "hover:bg-black/10",
                        ].join(" ")}
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
                  className={`border ${borderCls} px-4 py-6 text-center text-sm ${
                    darkMode ? "text-gray-400" : "text-gray-500"
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

  const extractRows = (payload) => {
    if (Array.isArray(payload)) return payload;
    if (payload && Array.isArray(payload.data)) return payload.data;
    return [];
  };

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [compRes, shearRes, flexRes] = await Promise.all([
        axios.get("http://127.0.0.1:8000/api/compressive-data"),
        axios.get("http://127.0.0.1:8000/api/shear-data"),
        axios.get("http://127.0.0.1:8000/api/flexure-data"),
      ]);

      setCompressiveData(extractRows(compRes.data));
      setShearData(extractRows(shearRes.data));
      setFlexureData(extractRows(flexRes.data));
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
        className={`h-full overflow-hidden flex flex-col ${
          darkMode ? "bg-gray-900" : "bg-gray-50"
        }`}
        style={{ fontFamily: "JustSans, system-ui, sans-serif" }}
      >
        {/* Tabs */}
        <div className={`${darkMode ? "border-gray-800" : "border-gray-200"} border-b`}>
          <div className="flex w-full">
            {tabs.map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={[
                    "flex-1 text-center transition-colors border-b-2",
                    "py-3 text-[13px] font-extrabold tracking-wide",
                    active
                      ? darkMode
                        ? "text-blue-300 border-blue-400 bg-white/5"
                        : "text-gray-900 border-gray-900 bg-black/5"
                      : darkMode
                        ? "text-gray-300 border-transparent hover:bg-white/5"
                        : "text-gray-600 border-transparent hover:bg-black/5",
                  ].join(" ")}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Table */}
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
