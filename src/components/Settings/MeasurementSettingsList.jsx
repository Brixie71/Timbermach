import React, { useEffect, useState } from "react";
import {
  Sparkles,
  Plus,
} from "lucide-react";
import {
  listMeasurementSettings,
  activateMeasurementSetting,
  deleteMeasurementSetting,
} from "../../config/measurementSettings";
import { LARAVEL_BASE_URL } from "../../config/servers";

const MeasurementSettingsList = ({ onBack, onEdit }) => {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadProfiles = async () => {
    try {
      setLoading(true);
      const res = await listMeasurementSettings(LARAVEL_BASE_URL);
      if (res?.success) setProfiles(res.data || []);
    } catch (e) {
      setError(e?.message || "Failed to load profiles");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfiles();
  }, []);

  const handleActivate = async (id) => {
    setError("");
    try {
      await activateMeasurementSetting(LARAVEL_BASE_URL, id);
      loadProfiles();
    } catch (e) {
      setError(e?.message || "Activate failed");
    }
  };

  const handleDelete = async (id) => {
    setError("");
    try {
      await deleteMeasurementSetting(LARAVEL_BASE_URL, id);
      loadProfiles();
    } catch (e) {
      setError(e?.message || "Delete failed");
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="bg-gray-800 border-b border-gray-700 px-6 py-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="text-2xl hover:text-blue-400 transition-colors">
            ←
          </button>
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-blue-300 font-semibold">
              Measurement
            </div>
            <div className="text-xl font-bold flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-blue-400" />
              Shape-Detect Profiles
            </div>
          </div>
        </div>
        <button
          onClick={() => onEdit(null)}
          className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-xl font-semibold flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          New Profile
        </button>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-6 space-y-4">
        {error && (
          <div className="rounded-xl border border-red-700 bg-red-900/30 px-4 py-3 text-sm text-red-100">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12 text-gray-300 text-sm">
            Loading...
          </div>
        ) : (
          <div className="rounded-2xl border border-gray-800 bg-gray-900/70 overflow-hidden">
            <div className="px-4 py-3 flex items-center justify-between border-b border-gray-800">
              <div className="text-sm text-gray-300">
                Profiles: {profiles.length} | Active:{" "}
                {profiles.find((p) => p.is_active)?.profile_name || "None"}
              </div>
              <div className="text-xs text-gray-500">Click Load to edit</div>
            </div>
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-900/80 text-gray-300">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Name</th>
                    <th className="px-4 py-3 text-left font-semibold">ROI%</th>
                    <th className="px-4 py-3 text-left font-semibold">mm/px</th>
                    <th className="px-4 py-3 text-left font-semibold">Shape</th>
                    <th className="px-4 py-3 text-left font-semibold">Created</th>
                    <th className="px-4 py-3 text-left font-semibold">Status</th>
                    <th className="px-4 py-3 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {profiles.map((p) => (
                    <tr
                      key={p.id}
                      className={`border-t border-gray-800 ${
                        p.is_active ? "bg-blue-900/10" : "bg-gray-900/40"
                      }`}
                    >
                      <td className="px-4 py-3 font-semibold text-gray-100">
                        {p.profile_name || "Untitled"}
                      </td>
                      <td className="px-4 py-3 text-gray-200">{p.params?.roi_size ?? "-"}</td>
                      <td className="px-4 py-3 text-gray-200">
                        {p.params?.mm_per_pixel ? Number(p.params.mm_per_pixel).toFixed(4) : "-"}
                      </td>
                      <td className="px-4 py-3 text-gray-200">{p.params?.roi_shape || "-"}</td>
                      <td className="px-4 py-3 text-gray-400">
                        {p.created_at ? new Date(p.created_at).toLocaleString() : "-"}
                      </td>
                      <td className="px-4 py-3">
                        {p.is_active ? (
                          <span className="rounded-full bg-emerald-700 px-2 py-1 text-[11px] font-bold text-white">
                            Active
                          </span>
                        ) : (
                          <span className="text-gray-400 text-[11px]">Inactive</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            onClick={() => onEdit(p)}
                            className="px-2 py-1 rounded-lg bg-gray-800 hover:bg-gray-700 text-xs"
                          >
                            Load
                          </button>
                          {!p.is_active && (
                            <button
                              onClick={() => handleActivate(p.id)}
                              className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-xs"
                            >
                              Activate
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(p.id)}
                            className="px-2 py-1 rounded-lg bg-red-700 hover:bg-red-800 text-xs"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {profiles.length === 0 && (
                    <tr>
                      <td className="px-4 py-6 text-center text-gray-500" colSpan={7}>
                        No profiles yet. Create one to get started.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MeasurementSettingsList;
