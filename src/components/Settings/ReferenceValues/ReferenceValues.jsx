import React, { useEffect, useMemo, useState } from "react";
import RVView from "./RVView";
import RVEdit from "./RVEdit";
import { LARAVEL_BASE_URL } from "../../../config/servers";

const ActionModal = ({ isOpen, onClose, onView, onEdit, onDelete, darkMode = true }) => {
  if (!isOpen) return null;
  return (
    <div
      className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm grid place-items-center p-4"
      onClick={onClose}
    >
      <div
        className={`w-full max-w-md rounded-2xl border ${darkMode ? "border-gray-800 bg-gray-900" : "border-gray-200 bg-white"}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`px-4 py-3 border-b ${darkMode ? "border-gray-800" : "border-gray-200"}`}>
          <div className="text-base font-bold">Options</div>
        </div>
        {[
          { label: "View", onClick: onView },
          { label: "Edit", onClick: onEdit },
          { label: "Delete", onClick: onDelete, danger: true },
        ].map((item) => (
          <button
            key={item.label}
            onClick={() => {
              item.onClick();
              onClose();
            }}
            className={[
              "w-full px-4 py-3 text-left text-sm font-semibold transition-colors",
              item.danger
                ? "text-red-400 hover:bg-red-500/10"
                : darkMode
                  ? "text-gray-100 hover:bg-white/10"
                  : "text-gray-800 hover:bg-gray-100",
              "border-b",
              darkMode ? "border-gray-800" : "border-gray-200",
            ].join(" ")}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
};

const DeleteModal = ({ isOpen, onClose, onConfirm, name, darkMode = true }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-40 bg-black/70 grid place-items-center p-4" onClick={onClose}>
      <div
        className={`w-full max-w-md rounded-2xl border ${darkMode ? "border-gray-800 bg-gray-900" : "border-gray-200 bg-white"}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-gray-800 text-lg font-bold">Delete?</div>
        <div className="px-4 py-4 text-sm text-gray-200">
          Are you sure you want to delete <b>{name || "this entry"}</b>? This cannot be undone.
        </div>
        <div className="px-4 py-3 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-2 text-sm rounded-xl border border-gray-700 bg-gray-800 hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-3 py-2 text-sm rounded-xl bg-red-600 hover:bg-red-700 text-white"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
};

const DataTable = ({ data, onView, onEdit, onDelete, sortConfig, onSort, darkMode = true }) => {
  const [actionOpen, setActionOpen] = useState(false);
  const [selected, setSelected] = useState(null);

  const headerCls = `text-[12px] font-extrabold text-center px-2 py-2 leading-tight ${
    darkMode ? "text-gray-200" : "text-gray-700"
  }`;
  const cellCls = `text-[12px] px-2 py-3 leading-tight text-center ${
    darkMode ? "text-gray-100" : "text-gray-900"
  }`;
  const border = darkMode ? "border-gray-700" : "border-gray-200";
  const headBg = darkMode ? "bg-gray-900/80" : "bg-white/80";
  const rowHover = darkMode ? "hover:bg-white/5" : "hover:bg-black/5";

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse">
          <thead className={`sticky top-0 z-10 ${headBg} backdrop-blur`}>
            <tr>
              <th className={`border ${border} ${headerCls}`}>Group</th>
              <th
                className={`border ${border} ${headerCls} cursor-pointer`}
                onClick={() => onSort("common_name")}
              >
                Common Name {sortConfig.field === "common_name" ? (sortConfig.order === "asc" ? "↑" : "↓") : ""}
              </th>
              <th className={`border ${border} ${headerCls}`}>Botanical</th>
              <th className={`border ${border} ${headerCls}`}>Fc</th>
              <th className={`border ${border} ${headerCls}`}>Fc⊥</th>
              <th className={`border ${border} ${headerCls}`}>Fv</th>
              <th className={`border ${border} ${headerCls}`}>FbFt</th>
              <th className={`border ${border} ${headerCls} sticky right-0 ${headBg}`}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {data?.length ? (
              data.map((row) => (
                <tr key={row.id} className={`${rowHover}`}>
                  <td className={`border ${border} ${cellCls}`}>
                    <span
                      className={`px-2 py-1 text-xs font-bold rounded ${
                        row.strength_group === "high"
                          ? "bg-purple-600 text-white"
                          : row.strength_group === "moderately_high"
                            ? "bg-blue-600 text-white"
                            : "bg-green-600 text-white"
                      }`}
                    >
                      {row.strength_group}
                    </span>
                  </td>
                  <td className={`border ${border} ${cellCls} font-semibold`}>{row.common_name}</td>
                  <td className={`border ${border} ${cellCls} italic text-gray-300`}>{row.botanical_name || "-"}</td>
                  <td className={`border ${border} ${cellCls}`}>{row.compression_parallel}</td>
                  <td className={`border ${border} ${cellCls}`}>{row.compression_perpendicular}</td>
                  <td className={`border ${border} ${cellCls}`}>{row.shear_parallel}</td>
                  <td className={`border ${border} ${cellCls}`}>{row.bending_tension_parallel}</td>
                  <td className={`border ${border} ${cellCls} sticky right-0 ${headBg}`}>
                    <button
                      onClick={() => {
                        setSelected(row);
                        setActionOpen(true);
                      }}
                      className={`w-full h-full px-2 py-2 transition-colors rounded ${
                        darkMode ? "hover:bg-gray-700" : "hover:bg-gray-200"
                      }`}
                    >
                      ⋮
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td className={`border ${border} px-4 py-6 text-center text-sm text-gray-500`} colSpan={8}>
                  No data available
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <ActionModal
        isOpen={actionOpen}
        onClose={() => setActionOpen(false)}
        onView={() => onView(selected)}
        onEdit={() => onEdit(selected)}
        onDelete={() => onDelete(selected)}
        darkMode={darkMode}
      />
    </div>
  );
};

const ReferenceValues = ({ darkMode = true }) => {
  const [referenceValues, setReferenceValues] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedGroup, setSelectedGroup] = useState("all");
  const [sortConfig, setSortConfig] = useState({ field: "common_name", order: "asc" });

  const [showView, setShowView] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  useEffect(() => {
    fetchAllData();
  }, []);

  const extractRows = (payload) => {
    if (Array.isArray(payload)) return payload;
    if (payload && Array.isArray(payload.data)) return payload.data;
    return [];
  };

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${LARAVEL_BASE_URL}/api/reference-values`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const rows = extractRows(data);
      setReferenceValues(rows);
    } catch (err) {
      setError("Failed to load reference values.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let filtered = [...referenceValues];
    if (selectedGroup !== "all") {
      filtered = filtered.filter((item) => item.strength_group === selectedGroup);
    }
    if (searchTerm) {
      filtered = filtered.filter(
        (item) =>
          item.common_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (item.botanical_name || "").toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    filtered.sort((a, b) => {
      const aVal = a[sortConfig.field];
      const bVal = b[sortConfig.field];
      if (typeof aVal === "number") return sortConfig.order === "asc" ? aVal - bVal : bVal - aVal;
      return sortConfig.order === "asc"
        ? String(aVal).localeCompare(String(bVal))
        : String(bVal).localeCompare(String(aVal));
    });
    setFilteredData(filtered);
  }, [referenceValues, searchTerm, selectedGroup, sortConfig]);

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
    setSelectedItem(item);
    setDeleteOpen(true);
  };

  const confirmDelete = async () => {
    if (!selectedItem) return;
    try {
      await fetch(`${LARAVEL_BASE_URL}/api/reference-values/${selectedItem.id}`, { method: "DELETE" });
      setDeleteOpen(false);
      setSelectedItem(null);
      fetchAllData();
    } catch (e) {
      alert("Delete failed");
    }
  };

  if (loading) {
    return (
      <div className={`flex items-center justify-center h-full ${darkMode ? "bg-gray-900 text-gray-100" : "bg-white"}`}>
        Loading...
      </div>
    );
  }

  if (error) {
    return (
      <div className={`flex items-center justify-center h-full ${darkMode ? "bg-gray-900 text-red-400" : "bg-white text-red-600"}`}>
        {error}
      </div>
    );
  }

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

  return (
    <>
      <div
        className={`overflow-hidden flex flex-col ${darkMode ? "bg-gray-900" : "bg-gray-50"}`}
        style={{ height: "calc(100vh - 60px)" }}
      >
        <div className={`border-b ${darkMode ? "border-gray-800" : "border-gray-200"}`}>
          <div className="flex items-center justify-between px-6 py-3 gap-3">
            <div className="flex items-center gap-3">
              <input
                type="text"
                placeholder="Search species..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`px-3 py-2 text-sm rounded-lg border ${
                  darkMode
                    ? "bg-gray-900 border-gray-700 text-gray-100 placeholder-gray-500"
                    : "bg-white border-gray-300 text-gray-900 placeholder-gray-400"
                }`}
                style={{ width: "260px" }}
              />
              <select
                value={selectedGroup}
                onChange={(e) => setSelectedGroup(e.target.value)}
                className={`px-3 py-2 text-sm rounded-lg border ${
                  darkMode ? "bg-gray-900 border-gray-700 text-gray-100" : "bg-white border-gray-300 text-gray-900"
                }`}
              >
                <option value="all">All Groups</option>
                <option value="high">High</option>
                <option value="moderately_high">Moderately High</option>
                <option value="medium">Medium</option>
              </select>
              <button
                onClick={fetchAllData}
                className={`px-3 py-2 text-sm rounded-lg border ${
                  darkMode ? "bg-gray-900 border-gray-700 text-gray-100 hover:bg-gray-800" : "bg-white border-gray-300 hover:bg-gray-50"
                }`}
              >
                ↻
              </button>
            </div>
            <button
              onClick={() => handleEdit(null)}
              className="px-4 py-2 text-sm font-bold bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              + Add
            </button>
          </div>
        </div>

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

      <DeleteModal
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={confirmDelete}
        name={selectedItem?.common_name}
        darkMode={darkMode}
      />
    </>
  );
};

export default ReferenceValues;
