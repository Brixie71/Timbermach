import React, { useEffect, useMemo, useState } from "react";
import { LARAVEL_BASE_URL } from "../../../config/servers";

const baseShell = "h-full flex flex-col transition-colors";
const lightShell = "bg-gray-50 text-gray-900";
const darkShell = "bg-gray-900 text-gray-100";

const topBar = "sticky top-0 z-10 border-b backdrop-blur supports-[backdrop-filter]:bg-opacity-70";
const topBarLight = "border-gray-200 bg-white/80";
const topBarDark = "border-gray-800 bg-gray-900/70";

const card = "rounded-2xl border shadow-sm";
const cardLight = "border-gray-200 bg-white";
const cardDark = "border-gray-800 bg-gray-900/50";

const labelCls = "text-xs font-semibold text-gray-700";
const labelClsDark = "text-gray-200";

const inputBase =
  "w-full rounded-xl border px-3 py-2 text-sm outline-none transition focus:ring-2 focus:border-transparent";
const inputLight =
  "border-gray-300 bg-white text-gray-900 placeholder:text-gray-400 focus:ring-blue-500";
const inputDark =
  "border-gray-700 bg-gray-950 text-gray-100 placeholder:text-gray-500 focus:ring-blue-400";

const errorText = "text-[11px] text-red-500";

const btn =
  "inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold transition disabled:opacity-60 disabled:cursor-not-allowed";
const btnGhostLight = "border border-gray-300 bg-white hover:bg-gray-50";
const btnGhostDark = "border border-gray-700 bg-gray-900 hover:bg-gray-800";
const btnPrimary = "bg-blue-600 text-white hover:bg-blue-700";

const strengthOptions = [
  { value: "high", label: "High Strength Group" },
  { value: "moderately_high", label: "Moderately High Strength Group" },
  { value: "medium", label: "Medium Strength Group" },
];

function readNum(v) {
  const n = Number.parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : NaN;
}

const RVEdit = ({ data, darkMode = true, onClose, onSave }) => {
  const [form, setForm] = useState({
    strength_group: "high",
    common_name: "",
    botanical_name: "",
    compression_parallel: "",
    compression_perpendicular: "",
    shear_parallel: "",
    bending_tension_parallel: "",
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data) {
      setForm({
        strength_group: data.strength_group || "high",
        common_name: data.common_name || "",
        botanical_name: data.botanical_name || "",
        compression_parallel: data.compression_parallel ?? "",
        compression_perpendicular: data.compression_perpendicular ?? "",
        shear_parallel: data.shear_parallel ?? "",
        bending_tension_parallel: data.bending_tension_parallel ?? "",
      });
    }
  }, [data]);

  const shellCls = `${baseShell} ${darkMode ? darkShell : lightShell}`;
  const barCls = `${topBar} ${darkMode ? topBarDark : topBarLight}`;
  const cardCls = `${card} ${darkMode ? cardDark : cardLight}`;
  const inputCls = `${inputBase} ${darkMode ? inputDark : inputLight}`;
  const labelFinal = `${labelCls} ${darkMode ? labelClsDark : ""}`;

  const validate = () => {
    const next = {};
    if (!form.common_name.trim()) next.common_name = "Common name is required";
    ["compression_parallel", "compression_perpendicular", "shear_parallel", "bending_tension_parallel"].forEach(
      (key) => {
        const n = readNum(form[key]);
        if (!Number.isFinite(n) || n <= 0) next[key] = "Must be a positive number";
      }
    );
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const url = data?.id
        ? `${LARAVEL_BASE_URL}/api/reference-values/${data.id}`
        : `${LARAVEL_BASE_URL}/api/reference-values`;
      const method = data?.id ? "PUT" : "POST";
      const payload = {
        strength_group: form.strength_group,
        common_name: form.common_name.trim(),
        botanical_name: form.botanical_name.trim() || null,
        compression_parallel: readNum(form.compression_parallel),
        compression_perpendicular: readNum(form.compression_perpendicular),
        shear_parallel: readNum(form.shear_parallel),
        bending_tension_parallel: readNum(form.bending_tension_parallel),
      };
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await res.text());
      onSave?.();
      onClose?.();
    } catch (e) {
      alert(e?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={shellCls}>
      {/* Header */}
      <div className={barCls}>
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <div className="min-w-0">
            <div className="text-base font-extrabold tracking-tight">
              {data ? "Edit Reference Value" : "Add Reference Value"}
            </div>
            <div className={`mt-0.5 truncate text-xs ${darkMode ? "text-gray-300" : "text-gray-600"}`}>
              {form.common_name || "New entry"}
            </div>
          </div>
          <button type="button" onClick={onClose} className={`${btn} ${darkMode ? btnGhostDark : btnGhostLight}`}>
            Close
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-4">
        <div className={`${cardCls} p-4 space-y-4`}>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <label className={labelFinal}>Strength Group</label>
              <select
                value={form.strength_group}
                onChange={(e) => setForm((prev) => ({ ...prev, strength_group: e.target.value }))}
                className={`${inputCls} pr-8`}
              >
                {strengthOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              {errors.strength_group ? <div className={errorText}>{errors.strength_group}</div> : null}
            </div>

            <div className="space-y-1.5">
              <label className={labelFinal}>Common Name *</label>
              <input
                type="text"
                value={form.common_name}
                onChange={(e) => setForm((prev) => ({ ...prev, common_name: e.target.value }))}
                className={inputCls}
              />
              {errors.common_name ? <div className={errorText}>{errors.common_name}</div> : null}
            </div>

            <div className="space-y-1.5">
              <label className={labelFinal}>Botanical Name</label>
              <input
                type="text"
                value={form.botanical_name}
                onChange={(e) => setForm((prev) => ({ ...prev, botanical_name: e.target.value }))}
                className={inputCls}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[
              ["compression_parallel", "Compression Parallel (Fc)"],
              ["compression_perpendicular", "Compression ⟂ (Fc⊥)"],
              ["shear_parallel", "Shear Parallel (Fv)"],
              ["bending_tension_parallel", "Bending & Tension (FbFt)"],
            ].map(([key, label]) => (
              <div key={key} className="space-y-1.5">
                <label className={labelFinal}>{label} (MPa) *</label>
                <input
                  type="number"
                  step="0.01"
                  value={form[key]}
                  onChange={(e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))}
                  className={inputCls}
                />
                {errors[key] ? <div className={errorText}>{errors[key]}</div> : null}
              </div>
            ))}
          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={onClose} className={`${btn} ${darkMode ? btnGhostDark : btnGhostLight}`}>
              Cancel
            </button>
            <button type="button" onClick={handleSubmit} disabled={saving} className={`${btn} ${btnPrimary}`}>
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RVEdit;
