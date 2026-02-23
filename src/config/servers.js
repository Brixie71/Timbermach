const requireEnv = (key) => {
  const value = import.meta.env[key];
  if (!value) {
    throw new Error(`[config] Missing required environment variable: ${key}`);
  }
  return value;
};

const trimTrailingSlash = (value) => String(value).replace(/\/+$/, "");

const joinUrl = (base, path = "") => {
  if (!path) return base;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
};

export const LARAVEL_BASE_URL = trimTrailingSlash(requireEnv("VITE_API_BASE_URL"));
export const FLASK_BASE_URL = trimTrailingSlash(requireEnv("VITE_PYTHON_API_URL"));
export const ACTUATOR_WS_URL = requireEnv("VITE_ACTUATOR_WS_URL");
export const SENSOR_WS_URL = requireEnv("VITE_SENSOR_WS_URL");

export const laravelUrl = (path = "") => joinUrl(LARAVEL_BASE_URL, path);
export const flaskUrl = (path = "") => joinUrl(FLASK_BASE_URL, path);
