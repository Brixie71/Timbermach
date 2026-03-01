/* Offload pressure data accumulation and max tracking to a worker
   to keep the React renderer lighter. */

const MAX_POINTS = 1800; // keep last N samples before trimming
const TARGET_POINTS = 600; // downsample target for UI rendering

let points = [];
let maxPressure = { value: 0, time: 0 };

const decimate = (arr) => {
  if (arr.length <= TARGET_POINTS) return arr;
  const step = Math.ceil(arr.length / TARGET_POINTS);
  const trimmed = [];
  for (let i = 0; i < arr.length; i += step) {
    trimmed.push(arr[i]);
  }
  // ensure last point kept
  if (trimmed[trimmed.length - 1] !== arr[arr.length - 1]) {
    trimmed.push(arr[arr.length - 1]);
  }
  return trimmed;
};

self.onmessage = (event) => {
  const { type, payload } = event.data || {};

  if (type === "reset") {
    points = [];
    maxPressure = { value: 0, time: 0 };
    self.postMessage({ type: "update", payload: { points: [], maxPressure } });
    return;
  }

  if (type === "add") {
    const { time = 0, pressure = 0 } = payload || {};
    const point = { time, pressure };
    points.push(point);

    if (points.length > MAX_POINTS) {
      points.shift();
    }

    if (pressure > maxPressure.value) {
      maxPressure = { value: pressure, time };
    }

    // Throttle updates to reduce postMessage chatter.
    if (points.length % 5 === 0) {
      self.postMessage({
        type: "update",
        payload: {
          points: decimate(points),
          maxPressure,
        },
      });
    }
  }
};
