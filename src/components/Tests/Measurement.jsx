import React, { useEffect, useRef, useState } from "react";
import { Settings2, Save, RefreshCcw } from "lucide-react";

const PY_API = "http://localhost:5000";
const LARAVEL_API = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

const DEFAULT_PARAMS = {
  threshold1: 52,
  threshold2: 104,
  min_area: 1000,
  blur_kernel: 21,
  dilation: 1,
  erosion: 1,
  roi_size: 60,
  brightness: 0,
  contrast: 101,
  mm_per_pixel: 0.1,
  denoise_enabled: true,
  denoise_h: 6,          // 3–10 good range
  denoise_template: 7,   // odd
  denoise_search: 21,    // odd
};

export default function Measurement({
  onPreviousTest,
  onMainPageReturn,
  testType = "flexure",
  subType = "",
}) {
  const videoRef = useRef(null);
  const snapCanvasRef = useRef(null);

  const [stream, setStream] = useState(null);
  const [cameraReady, setCameraReady] = useState(false);

  const [params, setParams] = useState(DEFAULT_PARAMS);
  const [panelOpen, setPanelOpen] = useState(true);

  const [overlayBase64, setOverlayBase64] = useState(null);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  // Request 1920x1080 but scale full-screen using CSS
  const VIDEO_CONSTRAINTS = {
    audio: false,
    video: {
      width: { ideal: 1920 },
      height: { ideal: 1080 },
    },
  };

  const startCamera = async () => {
    setErr(null);
    try {
      const s = await navigator.mediaDevices.getUserMedia(VIDEO_CONSTRAINTS);
      setStream(s);
      if (videoRef.current) {
        videoRef.current.srcObject = s;
      }
    } catch (e) {
      setErr(e?.message || "Failed to start camera");
    }
  };

  const stopCamera = () => {
    try {
      if (stream) stream.getTracks().forEach((t) => t.stop());
    } catch {}
    setStream(null);
    setCameraReady(false);
  };

  useEffect(() => {
    startCamera();
    loadActiveSettings(); // load from Laravel on mount
    return () => stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadActiveSettings = async () => {
    try {
      const res = await fetch(`${LARAVEL_API}/api/measurement-settings/active`);
      if (!res.ok) return; // don’t hard-fail if endpoint not added yet
      const data = await res.json();
      // Expect data like: { ...fields... }
      const merged = { ...DEFAULT_PARAMS, ...data };
      // Ensure blur kernel odd
      if (merged.blur_kernel % 2 === 0) merged.blur_kernel += 1;
      setParams(merged);
    } catch {
      // silently ignore until your Laravel endpoint exists
    }
  };

  const saveSettings = async () => {
    setErr(null);
    try {
      const res = await fetch(`${LARAVEL_API}/api/measurement-settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || "Failed to save settings");
      }
    } catch (e) {
      setErr(e?.message || "Failed to save settings");
    }
  };

  const snapAndMeasure = async () => {
    setBusy(true);
    setErr(null);
    setOverlayBase64(null);
    setResult(null);
    
    try {
      const video = videoRef.current;
      const canvas = snapCanvasRef.current;
      if (!video || !canvas || !cameraReady) throw new Error("Camera not ready");

      // draw current frame at actual video size
      const w = video.videoWidth || 1920;
      const h = video.videoHeight || 1080;
      canvas.width = w;
      canvas.height = h;

      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(video, 0, 0, w, h);

      const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
      if (!blob) throw new Error("Failed to capture frame");

      const form = new FormData();
      form.append("image", blob, "snapshot.jpg");
      form.append("params", JSON.stringify(params));

      const res = await fetch(`${PY_API}/shape-detect/measure`, {
        method: "POST",
        body: form,
      });

      const data = await res.json();
      if (!data.success) {
        setOverlayBase64(data.overlayBase64 || null);
        throw new Error(data.error || "Detection failed");
      }

      setOverlayBase64(data.overlayBase64 || null);
      setResult(data.best || null);
    } catch (e) {
      setErr(e?.message || "Failed to measure");
    } finally {
      setBusy(false);
    }
  };

  const retake = () => {
    setErr(null);
    setOverlayBase64(null);
    setResult(null);
  };
  

  const Slider = ({ label, k, min, max, step = 1 }) => (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#e5e7eb" }}>
        <span>{label}</span>
        <span style={{ color: "#a78bfa", fontWeight: 700 }}>{String(params[k])}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={params[k]}
        onChange={(e) => {
          let v = Number(e.target.value);
          if (k === "blur_kernel") {
            v = Math.max(1, v);
            if (v % 2 === 0) v += 1; // keep odd
          }
          setParams((p) => ({ ...p, [k]: v }));
        }}
        style={{ width: "100%" }}
      />
    </div>
  );

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: "#000",
        minWidth: 800,
        minHeight: 480,
        overflow: "hidden",
      }}
    >
      {/* hidden capture canvas */}
      <canvas ref={snapCanvasRef} style={{ display: "none" }} />

      {/* Fullscreen video */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        onLoadedMetadata={() => setCameraReady(true)}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
        }}
      />

      {/* Overlay image from backend (optional) */}
      {overlayBase64 && (
        <img
          alt="overlay"
          src={`data:image/png;base64,${overlayBase64}`}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            pointerEvents: "none",
          }}
        />
      )}

      {/* Top-left controls (back/close) */}
      <div style={{ position: "absolute", top: 12, left: 12, display: "flex", gap: 8, zIndex: 30 }}>
        <button
          onClick={onPreviousTest}
          style={{
            background: "rgba(0,0,0,0.55)",
            color: "white",
            border: "1px solid rgba(255,255,255,0.15)",
            padding: "8px 10px",
            borderRadius: 10,
            cursor: "pointer",
          }}
        >
          ←
        </button>
        <button
          onClick={onMainPageReturn}
          style={{
            background: "rgba(0,0,0,0.55)",
            color: "white",
            border: "1px solid rgba(255,255,255,0.15)",
            padding: "8px 10px",
            borderRadius: 10,
            cursor: "pointer",
          }}
        >
          ✕
        </button>
      </div>

      {/* Mid-right SNAP + RETAKE buttons */}
        <div
          style={{
            position: "absolute",
            right: 18,
            top: "50%",
            transform: "translateY(-50%)",
            zIndex: 40,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 10,
          }}
        >
          {/* SNAP */}
          <button
            onClick={snapAndMeasure}
            disabled={!cameraReady || busy}
            title="Snap"
            style={{
              width: 76,
              height: 76,
              borderRadius: 999,
              border: "3px solid rgba(255,255,255,0.85)",
              background: busy ? "rgba(16,185,129,0.35)" : "rgba(16,185,129,0.85)",
              color: "#001b10",
              fontWeight: 900,
              letterSpacing: 1,
              cursor: busy ? "not-allowed" : "pointer",
            }}
          >
            {busy ? "..." : "SNAP"}
          </button>

          {/* RETAKE */}
          <button
            onClick={retake}
            disabled={busy || (!overlayBase64 && !result && !err)}
            title="Retake"
            style={{
              width: 76,
              height: 34,
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.25)",
              background: "rgba(0,0,0,0.55)",
              color: "white",
              fontWeight: 800,
              letterSpacing: 0.5,
              cursor: busy || (!overlayBase64 && !result && !err) ? "not-allowed" : "pointer",
              opacity: busy || (!overlayBase64 && !result && !err) ? 0.45 : 1,
            }}
          >
            RETAKE
          </button>
        </div>


      {/* Parameter panel */}
      <div
        style={{
          position: "absolute",
          left: 12,
          bottom: 12,
          width: panelOpen ? 340 : 54,
          background: "rgba(17,24,39,0.78)",
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 14,
          padding: panelOpen ? 12 : 8,
          zIndex: 50,
          backdropFilter: "blur(6px)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: panelOpen ? 10 : 0 }}>
          <button
            onClick={() => setPanelOpen((v) => !v)}
            style={{
              width: 38,
              height: 38,
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.15)",
              background: "rgba(0,0,0,0.25)",
              color: "white",
              cursor: "pointer",
            }}
            title="Parameters"
          >
            <Settings2 size={18} style={{ margin: "0 auto" }} />
          </button>

          {panelOpen && (
            <>
              <div style={{ color: "#e5e7eb", fontWeight: 800 }}>
                Shape Detect Params
                <div style={{ fontSize: 11, fontWeight: 600, color: "#9ca3af" }}>
                  {testType}{subType ? ` • ${subType}` : ""}
                </div>
              </div>

              <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                <button
                  onClick={loadActiveSettings}
                  title="Reload from Laravel"
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 12,
                    border: "1px solid rgba(255,255,255,0.15)",
                    background: "rgba(0,0,0,0.25)",
                    color: "white",
                    cursor: "pointer",
                  }}
                >
                  <RefreshCcw size={18} />
                </button>

                <button
                  onClick={saveSettings}
                  title="Save to Laravel"
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 12,
                    border: "1px solid rgba(255,255,255,0.15)",
                    background: "rgba(0,0,0,0.25)",
                    color: "white",
                    cursor: "pointer",
                  }}
                >
                  <Save size={18} />
                </button>
              </div>
            </>
          )}
        </div>

        {panelOpen && (
          <div style={{ maxHeight: 240, overflow: "auto", paddingRight: 6 }}>
            <Slider
              label="Edge Thickness"
              k="edge_thickness"
              min={1}
              max={7}
              step={1}
            />
            <Slider label="Threshold1" k="threshold1" min={0} max={255} />
            <Slider label="Threshold2" k="threshold2" min={0} max={255} />
            <Slider label="Min Area" k="min_area" min={0} max={10000} />
            <Slider label="Blur Kernel (odd)" k="blur_kernel" min={1} max={51} />
            <Slider label="Dilation" k="dilation" min={0} max={10} />
            <Slider label="Erosion" k="erosion" min={0} max={10} />
            <Slider label="ROI Size (%)" k="roi_size" min={10} max={100} />
            <Slider label="Brightness" k="brightness" min={-100} max={100} />
            <Slider label="Contrast" k="contrast" min={0} max={200} />
            <Slider label="mm_per_pixel" k="mm_per_pixel" min={0.001} max={1.0} step={0.001} />
          </div>
        )}
      </div>

      {/* Result readout */}
      <div
        style={{
          position: "absolute",
          right: 12,
          bottom: 12,
          width: 320,
          background: "rgba(0,0,0,0.55)",
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 14,
          padding: 12,
          color: "white",
          zIndex: 60,
        }}
      >
        {err && (
          <div style={{ color: "#fca5a5", fontWeight: 800, marginBottom: 8 }}>
            Error: <span style={{ fontWeight: 600 }}>{err}</span>
          </div>
        )}

        {!result ? (
          <div style={{ color: "#d1d5db", fontWeight: 700 }}>
            {busy ? "Measuring..." : "Press SNAP to measure"}
          </div>
        ) : (
          <>
            <div style={{ fontWeight: 900, marginBottom: 6 }}>Measurement</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <div>
                <div style={{ fontSize: 12, color: "#9ca3af" }}>Width</div>
                <div style={{ fontSize: 20, fontWeight: 900 }}>{result.width_mm.toFixed(1)} mm</div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: "#9ca3af" }}>Height</div>
                <div style={{ fontSize: 20, fontWeight: 900 }}>{result.height_mm.toFixed(1)} mm</div>
              </div>
            </div>

            <div style={{ marginTop: 10, fontSize: 12, color: "#9ca3af" }}>
              bbox: [{result.bbox.join(", ")}] • angle: {result.angle.toFixed(1)}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
