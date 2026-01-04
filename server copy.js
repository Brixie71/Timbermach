import { SerialPort } from "serialport";
import { ReadlineParser } from "@serialport/parser-readline";
import { WebSocketServer } from "ws";

// ============================================================================
// CONFIGURATION
// ============================================================================
const SERIAL_PORT = "COM7"; // Your Arduino Mega port
const BAUD_RATE = 9600;

const ACTUATOR_WS_PORT = 8080;  // Actuator control WebSocket
const PRESSURE_WS_PORT = 5001;   // Pressure sensor WebSocket

console.log("========================================");
console.log("  TimberMach Unified Control Server");
console.log("  Actuator + Pressure Sensor");
console.log("========================================");
console.log(`Serial Port: ${SERIAL_PORT}`);
console.log(`Baud Rate: ${BAUD_RATE}`);
console.log(`Actuator WebSocket: ws://localhost:${ACTUATOR_WS_PORT}`);
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
let actuatorClients = new Set();
let pressureClients = new Set();

// ============================================================================
// WEBSOCKET SERVERS
// ============================================================================

// Actuator Control WebSocket Server (port 8080)
const actuatorWSS = new WebSocketServer({ port: ACTUATOR_WS_PORT });

// Pressure Sensor WebSocket Server (port 5001)
const pressureWSS = new WebSocketServer({ port: PRESSURE_WS_PORT });

// ============================================================================
// SERIAL PORT EVENT HANDLERS
// ============================================================================

port.on("open", () => {
  console.log(`✓ Serial Port opened successfully on ${SERIAL_PORT}`);
  isSerialConnected = true;

  // Notify all actuator clients
  broadcastToActuatorClients("System: Serial port connected");

  // Request initial status from Arduino
  setTimeout(() => {
    port.write("POS\n", (err) => {
      if (!err) {
        console.log("→ Requested initial position from Arduino");
      }
    });
  }, 1000);
});

port.on("error", (err) => {
  console.error(`✗ Serial Port Error: ${err.message}`);
  isSerialConnected = false;
  broadcastToActuatorClients(`System: Serial port error - ${err.message}`);
});

port.on("close", () => {
  console.log("✗ Serial Port closed");
  isSerialConnected = false;
  broadcastToActuatorClients("System: Serial port closed");
});

// ============================================================================
// SERIAL DATA PARSER - Route messages to appropriate clients
// ============================================================================

parser.on("data", (data) => {
  const trimmedData = data.trim();
  
  // Check if this is pressure data
  if (trimmedData.startsWith("PRESSURE:")) {
    handlePressureData(trimmedData);
  } else {
    // All other data goes to actuator clients (position updates, status, etc.)
    console.log(`← Arduino: ${trimmedData}`);
    broadcastToActuatorClients(trimmedData);
  }
});

// ============================================================================
// PRESSURE DATA HANDLER
// ============================================================================

function handlePressureData(data) {
  try {
    // Extract voltage: "PRESSURE:3.1234"
    const parts = data.split(":");
    if (parts.length === 2) {
      const voltage = parseFloat(parts[1]);
      
      // Convert voltage to pressure (kN)
      const pressureKN = voltageToPressure(voltage);
      
      // Create JSON payload
      const pressureData = {
        pressure: pressureKN,
        voltage: voltage,
        timestamp: new Date().toISOString(),
        unit: "kN"
      };
      
      // Send to pressure clients only
      broadcastToPressureClients(JSON.stringify(pressureData));
      
      // Optional: Log (comment out if too verbose)
      // console.log(`📊 Pressure: ${pressureKN.toFixed(2)} kN`);
    }
  } catch (error) {
    console.error("Error parsing pressure data:", error);
  }
}

// ============================================================================
// PRESSURE CONVERSION FUNCTION
// ============================================================================

function voltageToPressure(voltage) {
  const SENSOR_MAX_VOLTAGE = 5.0;
  const SENSOR_MAX_PRESSURE_KN = 1600.0;
  
  let pressure = (voltage / SENSOR_MAX_VOLTAGE) * SENSOR_MAX_PRESSURE_KN;
  
  // Ensure non-negative
  if (pressure < 0) pressure = 0;
  
  // Round to 2 decimal places
  return Math.round(pressure * 100) / 100;
}

// ============================================================================
// ACTUATOR WEBSOCKET HANDLERS
// ============================================================================

actuatorWSS.on("connection", (ws) => {
  const clientId = Date.now();
  actuatorClients.add(ws);
  console.log(`✓ Actuator Client connected (Total: ${actuatorClients.size})`);

  // Send connection status
  if (isSerialConnected) {
    ws.send("System: Connected to Arduino");
  } else {
    ws.send("System: Arduino not connected");
  }

  // Handle incoming actuator commands
  ws.on("message", (message) => {
    const command = message.toString().trim().toUpperCase();
    console.log(`→ Actuator Command: ${command}`);

    if (!command) {
      ws.send("ERROR: Empty command");
      return;
    }

    if (!isSerialConnected) {
      const errorMsg = "ERROR: Arduino not connected";
      console.error(`✗ ${errorMsg}`);
      ws.send(errorMsg);
      return;
    }

    // Send command to Arduino
    port.write(command + "\n", (err) => {
      if (err) {
        const errorMsg = `ERROR: Failed to send command - ${err.message}`;
        console.error(`✗ ${errorMsg}`);
        ws.send(errorMsg);
      } else {
        console.log(`✓ Command sent: ${command}`);
        ws.send(`ACK: ${command}`);
      }
    });
  });

  ws.on("close", () => {
    actuatorClients.delete(ws);
    console.log(`✗ Actuator Client disconnected (Total: ${actuatorClients.size})`);
  });

  ws.on("error", (error) => {
    console.error(`✗ Actuator WebSocket error:`, error.message);
    actuatorClients.delete(ws);
  });
});

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
    timestamp: new Date().toISOString()
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
// BROADCAST FUNCTIONS
// ============================================================================

function broadcastToActuatorClients(message) {
  actuatorClients.forEach((client) => {
    if (client.readyState === 1) { // WebSocket.OPEN
      try {
        client.send(message);
      } catch (error) {
        console.error("✗ Error broadcasting to actuator client:", error.message);
      }
    }
  });
}

function broadcastToPressureClients(message) {
  pressureClients.forEach((client) => {
    if (client.readyState === 1) { // WebSocket.OPEN
      try {
        client.send(message);
      } catch (error) {
        console.error("✗ Error broadcasting to pressure client:", error.message);
      }
    }
  });
}

// ============================================================================
// PERIODIC STATUS CHECK
// ============================================================================

setInterval(() => {
  if (isSerialConnected && actuatorClients.size > 0) {
    port.write("POS\n", (err) => {
      if (err) {
        console.error("✗ Error requesting position:", err.message);
      }
    });
  }
}, 5000);

// ============================================================================
// SERVER STATUS
// ============================================================================

console.log(`\n✓ Actuator WebSocket running on ws://localhost:${ACTUATOR_WS_PORT}`);
console.log(`✓ Pressure WebSocket running on ws://localhost:${PRESSURE_WS_PORT}`);
console.log("✓ Waiting for connections...\n");

// ============================================================================
// GRACEFUL SHUTDOWN
// ============================================================================

process.on("SIGINT", () => {
  console.log("\n========================================");
  console.log("  Shutting down server...");
  console.log("========================================");

  // Close all WebSocket connections
  actuatorClients.forEach((client) => client.close());
  pressureClients.forEach((client) => client.close());

  // Close serial port
  port.close((err) => {
    if (err) {
      console.error("✗ Error closing serial port:", err.message);
    } else {
      console.log("✓ Serial port closed");
    }

    // Close WebSocket servers
    actuatorWSS.close(() => {
      console.log("✓ Actuator WebSocket closed");
      
      pressureWSS.close(() => {
        console.log("✓ Pressure WebSocket closed");
        console.log("\n✓ Server shutdown complete\n");
        process.exit(0);
      });
    });
  });
});