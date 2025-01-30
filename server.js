import { SerialPort } from "serialport";
import { ReadlineParser } from "@serialport/parser-readline";
import { WebSocketServer } from "ws";

// Setup SerialPort
const port = new SerialPort({ path: "COM7", baudRate: 9600 }); // Updated to COM7
const parser = port.pipe(new ReadlineParser({ delimiter: "\n" }));

// Setup WebSocket Server
const wss = new WebSocketServer({ port: 8080 });

wss.on("connection", (ws) => {
  console.log("Client connected");

  // Forward data from Arduino to WebSocket clients
  parser.on("data", (data) => {
    console.log(`Received from Arduino: ${data}`);
    ws.send(data.trim()); // Send to WebSocket client
  });

  ws.on("close", () => {
    console.log("Client disconnected");
  });
});
