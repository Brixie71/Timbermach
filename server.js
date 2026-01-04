import { SerialPort } from "serialport";
import { ReadlineParser } from "@serialport/parser-readline";
import { WebSocketServer } from "ws";

// ============================================================================
// CONFIGURATION
// ============================================================================
const SERIAL_PORT = "COM7";
const BAUD_RATE = 9600;
const PRESSURE_WS_PORT = 5001;

console.log("========================================");
console.log("  TimberMach Pressure Sensor Server");
console.log("========================================");
console.log(`Serial Port: ${SERIAL_PORT}`);
console.log(`Baud Rate: ${BAUD_RATE}`);
console.log(`Pressure WebSocket: ws://localhost:${PRESSURE_WS_PORT}`);
console.log("========================================\n");

// ============================================================================
// SERIAL PORT SETUP
// ============================================================================
const port = new SerialPort({
  path: SERIAL_PORT,
  baudRate: BAUD_RATE,
});

const parser = port.pipe(new ReadlineParser({ delimiter: "\n" }));

// ============================================================================
// CONNECTION TRACKING
// ============================================================================
let isSerialConnected = false;
let pressureClients = new Set();

// ============================================================================
// WEBSOCKET SERVER
// ============================================================================
const pressureWSS = new WebSocketServer({ port: PRESSURE_WS_PORT });

// ============================================================================
// SERIAL PORT EVENT HANDLERS
// ============================================================================

port.on("open", () => {
  console.log(`✓ Serial Port opened successfully on ${SERIAL_PORT}`);
  isSerialConnected = true;
});

port.on("error", (err) => {
  console.error(`✗ Serial Port Error: ${err.message}`);
  isSerialConnected = false;
});

port.on("close", () => {
  console.log("✗ Serial Port closed");
  isSerialConnected = false;
});

// ============================================================================
// SERIAL DATA PARSER - Pressure Data
// ============================================================================

parser.on("data", (data) => {
  const trimmedData = data.trim();
  
  // Process pressure data
  if (trimmedData.startsWith("PRESSURE:")) {
    handlePressureData(trimmedData);
  } else {
    // Log other Arduino messages
    console.log(`Arduino: ${trimmedData}`);
  }
});

// ============================================================================
// PRESSURE DATA HANDLER
// ============================================================================

function handlePressureData(data) {
  try {
    // Extract pressure value: "PRESSURE:12.34"
    const parts = data.split(":");
    if (parts.length === 2) {
      const pressureMPa = parseFloat(parts[1]);
      
      // Create JSON payload
      const pressureData = {
        pressure: pressureMPa,
        timestamp: new Date().toISOString(),
        unit: "MPa"
      };
      
      // Send to all pressure clients
      broadcastToPressureClients(JSON.stringify(pressureData));
      
      // Log pressure readings
      console.log(`📊 Pressure: ${pressureMPa.toFixed(2)} MPa`);
    }
  } catch (error) {
    console.error("Error parsing pressure data:", error);
  }
}

// ============================================================================
// PRESSURE SENSOR WEBSOCKET HANDLERS
// ============================================================================

pressureWSS.on("connection", (ws) => {
  const clientId = Date.now();
  pressureClients.add(ws);
  console.log(`✓ Pressure Client connected (Total: ${pressureClients.size})`);

  // Send initial connection confirmation
  const welcomeMsg = {
    status: "connected",
    message: "Pressure sensor stream active",
    timestamp: new Date().toISOString(),
    unit: "MPa"
  };
  ws.send(JSON.stringify(welcomeMsg));

  ws.on("close", () => {
    pressureClients.delete(ws);
    console.log(`✗ Pressure Client disconnected (Total: ${pressureClients.size})`);
  });

  ws.on("error", (error) => {
    console.error(`✗ Pressure WebSocket error:`, error.message);
    pressureClients.delete(ws);
  });
});

// ============================================================================
// BROADCAST FUNCTION
// ============================================================================

function broadcastToPressureClients(message) {
  pressureClients.forEach((client) => {
    if (client.readyState === 1) {
      try {
        client.send(message);
      } catch (error) {
        console.error("✗ Error broadcasting to pressure client:", error.message);
      }
    }
  });
}

// ============================================================================
// SERVER STATUS
// ============================================================================

console.log(`\n✓ Pressure WebSocket server running on ws://localhost:${PRESSURE_WS_PORT}`);
console.log("✓ Waiting for connections...\n");

// ============================================================================
// GRACEFUL SHUTDOWN
// ============================================================================

process.on("SIGINT", () => {
  console.log("\n========================================");
  console.log("  Shutting down server...");
  console.log("========================================");

  pressureClients.forEach((client) => client.close());

  port.close((err) => {
    if (err) {
      console.error("✗ Error closing serial port:", err.message);
    } else {
      console.log("✓ Serial port closed");
    }

    pressureWSS.close(() => {
      console.log("✓ Pressure WebSocket closed");
      console.log("\n✓ Server shutdown complete\n");
      process.exit(0);
    });
  });
});