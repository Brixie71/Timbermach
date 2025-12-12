import React, { useState, useEffect } from "react";
import { Wifi, WifiOff, AlertCircle, CheckCircle } from "lucide-react";

const BackendStatusIndicator = ({ compact = false }) => {
  const [laravelStatus, setLaravelStatus] = useState("checking");
  const [flaskStatus, setFlaskStatus] = useState("checking");
  const [showDetails, setShowDetails] = useState(false);

  // Hardcoded URLs to ensure correct ports
  // Laravel (PHP) = port 8000, Flask (Python) = port 5000
  const LARAVEL_URL = "http://127.0.0.1:8000";
  const FLASK_URL = "http://127.0.0.1:5000";

  const checkBackends = async () => {
    // Check Laravel
    try {
      const laravelResponse = await fetch(`${LARAVEL_URL}/api/calibration`, {
        method: "GET",
        headers: { Accept: "application/json" },
      });

      if (laravelResponse.ok) {
        setLaravelStatus("connected");
      } else {
        setLaravelStatus("error");
      }
    } catch (error) {
      setLaravelStatus("offline");
    }

    // Check Flask
    try {
      const flaskResponse = await fetch(
        `http://127.0.0.1:5000/seven-segment/calibration`,
        {
          method: "GET",
          headers: { Accept: "application/json" },
        },
      );

      if (flaskResponse.ok) {
        const data = await flaskResponse.json();
        if (data.success !== undefined) {
          setFlaskStatus("connected");
        } else {
          setFlaskStatus("error");
        }
      } else {
        setFlaskStatus("error");
      }
    } catch (error) {
      setFlaskStatus("offline");
    }
  };

  useEffect(() => {
    checkBackends();
    const interval = setInterval(checkBackends, 10000); // Check every 10 seconds
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status) => {
    switch (status) {
      case "connected":
        return "text-green-500";
      case "offline":
        return "text-red-500";
      case "error":
        return "text-yellow-500";
      case "checking":
        return "text-gray-400";
      default:
        return "text-gray-400";
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "connected":
        return <CheckCircle className="w-4 h-4" />;
      case "offline":
        return <WifiOff className="w-4 h-4" />;
      case "error":
        return <AlertCircle className="w-4 h-4" />;
      case "checking":
        return <Wifi className="w-4 h-4 animate-pulse" />;
      default:
        return <Wifi className="w-4 h-4" />;
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case "connected":
        return "Connected";
      case "offline":
        return "Offline";
      case "error":
        return "Error";
      case "checking":
        return "Checking...";
      default:
        return "Unknown";
    }
  };

  const allConnected =
    laravelStatus === "connected" && flaskStatus === "connected";
  const anyOffline = laravelStatus === "offline" || flaskStatus === "offline";

  if (compact) {
    return (
      <div
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 cursor-pointer hover:bg-gray-750 transition-colors"
        onClick={() => setShowDetails(!showDetails)}
      >
        {allConnected ? (
          <CheckCircle className="w-4 h-4 text-green-500" />
        ) : anyOffline ? (
          <WifiOff className="w-4 h-4 text-red-500" />
        ) : (
          <AlertCircle className="w-4 h-4 text-yellow-500" />
        )}
        <span className="text-sm font-medium text-gray-300">
          {allConnected ? "Backends Online" : "Backend Issue"}
        </span>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-200 flex items-center gap-2">
          <Wifi className="w-4 h-4" />
          Backend Status
        </h3>
        <button
          onClick={checkBackends}
          className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
        >
          Refresh
        </button>
      </div>

      <div className="space-y-3">
        {/* Laravel Status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`${getStatusColor(laravelStatus)}`}>
              {getStatusIcon(laravelStatus)}
            </span>
            <div>
              <div className="text-sm font-medium text-gray-300">
                Laravel (PHP)
              </div>
              <div className="text-xs text-gray-500">{LARAVEL_URL}</div>
            </div>
          </div>
          <span
            className={`text-xs font-medium ${getStatusColor(laravelStatus)}`}
          >
            {getStatusText(laravelStatus)}
          </span>
        </div>

        {/* Flask Status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`${getStatusColor(flaskStatus)}`}>
              {getStatusIcon(flaskStatus)}
            </span>
            <div>
              <div className="text-sm font-medium text-gray-300">
                Flask (Python)
              </div>
              <div className="text-xs text-gray-500">{FLASK_URL}</div>
            </div>
          </div>
          <span
            className={`text-xs font-medium ${getStatusColor(flaskStatus)}`}
          >
            {getStatusText(flaskStatus)}
          </span>
        </div>
      </div>

      {/* Error Message */}
      {anyOffline && (
        <div className="mt-4 p-3 bg-red-900/20 border border-red-700/50 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-xs font-medium text-red-300 mb-1">
                Backend Not Running
              </p>
              <p className="text-xs text-red-400/80 mb-2">
                {laravelStatus === "offline" && "Laravel backend is offline. "}
                {flaskStatus === "offline" && "Flask backend is offline. "}
                Some features won't work.
              </p>
              <div className="text-xs text-red-400/70 space-y-1">
                {laravelStatus === "offline" && (
                  <div>
                    → Start Laravel:{" "}
                    <code className="bg-red-950/50 px-1 py-0.5 rounded">
                      php artisan serve
                    </code>
                  </div>
                )}
                {flaskStatus === "offline" && (
                  <div>
                    → Start Flask:{" "}
                    <code className="bg-red-950/50 px-1 py-0.5 rounded">
                      python app.py
                    </code>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Success Message */}
      {allConnected && (
        <div className="mt-4 p-3 bg-green-900/20 border border-green-700/50 rounded-lg">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-400" />
            <p className="text-xs text-green-300">
              All backends are connected and ready!
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default BackendStatusIndicator;
