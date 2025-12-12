import { SerialPort } from "serialport";
import { ReadlineParser } from "@serialport/parser-readline";
import { WebSocketServer } from "ws";

// Setup SerialPort - CHANGE COM PORT TO MATCH YOUR SYSTEM
const SERIAL_PORT = "COM7"; // Change this to your Arduino's port
const BAUD_RATE = 9600;

console.log("========================================");
console.log("  TimberMach Actuator Control Server");
console.log("========================================");
console.log(`Serial Port: ${SERIAL_PORT}`);
console.log(`Baud Rate: ${BAUD_RATE}`);
console.log(`WebSocket: ws://localhost:8080`);
console.log("========================================\n");

// Setup SerialPort
const port = new SerialPort({
  path: SERIAL_PORT,
  baudRate: BAUD_RATE,
});

const parser = port.pipe(new ReadlineParser({ delimiter: "\n" }));

// Setup WebSocket Server
const wss = new WebSocketServer({ port: 8080 });

// Track connection status
let isSerialConnected = false;
let connectedClients = new Set();

// Handle Serial Port events
port.on("open", () => {
  console.log(`✓ Serial Port opened successfully on ${SERIAL_PORT}`);
  isSerialConnected = true;

  // Notify all clients
  broadcastToClients("System: Serial port connected");

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

  // Notify all clients
  broadcastToClients(`System: Serial port error - ${err.message}`);
});

port.on("close", () => {
  console.log("✗ Serial Port closed");
  isSerialConnected = false;

  // Notify all clients
  broadcastToClients("System: Serial port closed");
});

// Forward data from Arduino to all connected WebSocket clients
parser.on("data", (data) => {
  const trimmedData = data.trim();
  console.log(`← Arduino: ${trimmedData}`);

  // Broadcast to all connected clients
  broadcastToClients(trimmedData);
});

// WebSocket Server
wss.on("connection", (ws) => {
  const clientId = Date.now();
  connectedClients.add(ws);
  console.log(
    `✓ Client ${clientId} connected (Total: ${connectedClients.size})`,
  );

  // Send connection status
  if (isSerialConnected) {
    ws.send("System: Connected to Arduino");
  } else {
    ws.send("System: Arduino not connected");
  }

  // Handle incoming messages from WebSocket client (React app)
  ws.on("message", (message) => {
    const command = message.toString().trim().toUpperCase();
    console.log(`→ Client ${clientId}: ${command}`);

    // Validate command format
    if (!command) {
      ws.send("ERROR: Empty command");
      return;
    }

    // Check if serial port is connected
    if (!isSerialConnected) {
      const errorMsg = "ERROR: Arduino not connected";
      console.error(`✗ ${errorMsg}`);
      ws.send(errorMsg);
      return;
    }

    // Write command to Arduino with newline delimiter
    port.write(command + "\n", (err) => {
      if (err) {
        const errorMsg = `ERROR: Failed to send command - ${err.message}`;
        console.error(`✗ ${errorMsg}`);
        ws.send(errorMsg);
      } else {
        console.log(`✓ Command sent to Arduino: ${command}`);

        // Send confirmation back to client
        ws.send(`ACK: ${command}`);
      }
    });
  });

  ws.on("close", () => {
    connectedClients.delete(ws);
    console.log(
      `✗ Client ${clientId} disconnected (Total: ${connectedClients.size})`,
    );
  });

  ws.on("error", (error) => {
    console.error(`✗ WebSocket error from client ${clientId}:`, error.message);
    connectedClients.delete(ws);
  });
});

// Broadcast message to all connected clients
function broadcastToClients(message) {
  connectedClients.forEach((client) => {
    if (client.readyState === 1) {
      // WebSocket.OPEN
      try {
        client.send(message);
      } catch (error) {
        console.error("✗ Error broadcasting to client:", error.message);
      }
    }
  });
}

// Periodic status check (every 5 seconds)
setInterval(() => {
  if (isSerialConnected && connectedClients.size > 0) {
    port.write("POS\n", (err) => {
      if (err) {
        console.error("✗ Error requesting position:", err.message);
      }
    });
  }
}, 5000);

console.log("\n✓ WebSocket server running on ws://localhost:8080");
console.log("✓ Waiting for connections...\n");

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\n\n========================================");
  console.log("  Shutting down server...");
  console.log("========================================");

  // Close all WebSocket connections
  connectedClients.forEach((client) => {
    client.close();
  });

  // Close serial port
  port.close((err) => {
    if (err) {
      console.error("✗ Error closing serial port:", err.message);
    } else {
      console.log("✓ Serial port closed");
    }

    // Close WebSocket server
    wss.close(() => {
      console.log("✓ WebSocket server closed");
      console.log("\n✓ Server shutdown complete\n");
      process.exit(0);
    });
  });
});
