import { SerialPort } from "serialport";
import { ReadlineParser } from "@serialport/parser-readline";
import { WebSocketServer } from "ws";

// Setup SerialPort
const port = new SerialPort({ path: "COM7", baudRate: 9600 }); // Updated to COM7
const parser = port.pipe(new ReadlineParser({ delimiter: "\n" }));

// Setup WebSocket Server
const wss = new WebSocketServer({ port: 8080 });

// Handle Serial Port events
port.on("open", () => {
  console.log("Serial Port opened successfully");
});

port.on("error", (err) => {
  console.error("Serial Port Error:", err.message);
});

// Forward data from Arduino to all connected WebSocket clients
parser.on("data", (data) => {
  console.log(`Received from Arduino: ${data}`);
  
  // Broadcast to all connected clients
  wss.clients.forEach((client) => {
    if (client.readyState === 1) { // WebSocket.OPEN
      client.send(data.trim());
    }
  });
});

wss.on("connection", (ws) => {
  console.log("Client connected");

  // Handle incoming messages from WebSocket client (React app)
  ws.on("message", (message) => {
    const command = message.toString().trim();
    console.log(`Received command from client: ${command}`);
    
    // Write command to Arduino with newline delimiter
    port.write(command + "\n", (err) => {
      if (err) {
        console.error("Error writing to serial port:", err.message);
        ws.send(JSON.stringify({ error: "Failed to send command to Arduino" }));
      } else {
        console.log(`Command sent to Arduino: ${command}`);
        // Optionally send confirmation back to client
        ws.send(JSON.stringify({ status: "success", command: command }));
      }
    });
  });

  ws.on("close", () => {
    console.log("Client disconnected");
  });

  ws.on("error", (error) => {
    console.error("WebSocket error:", error);
  });
});

console.log("WebSocket server running on ws://localhost:8080");
console.log("Waiting for connections...");