"""
Pressure Sensor WebSocket Server
Reads analog pressure sensor data from Arduino and streams via WebSocket
Sensor: 0-5V output connected to Arduino A0 pin
"""

import asyncio
import json
import serial
import websockets
from datetime import datetime
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Arduino Serial Configuration
SERIAL_PORT = "COM8"  # Change to your Arduino port for pressure sensor
BAUD_RATE = 9600

# Pressure Sensor Calibration
# Adjust these values based on your sensor's specifications
SENSOR_MAX_VOLTAGE = 5.0  # Maximum voltage output
SENSOR_MAX_PRESSURE_KN = 1600.0  # Maximum pressure in kN
ADC_RESOLUTION = 1023  # Arduino 10-bit ADC

# Connected clients
connected_clients = set()
serial_connection = None


def voltage_to_pressure(voltage):
    """
    Convert voltage reading to pressure in kN
    Linear conversion based on sensor specs
    """
    pressure_kn = (voltage / SENSOR_MAX_VOLTAGE) * SENSOR_MAX_PRESSURE_KN
    return round(pressure_kn, 2)


def read_pressure_sensor():
    """
    Read pressure from Arduino serial connection
    Returns pressure in kN
    """
    global serial_connection
    
    if serial_connection is None or not serial_connection.is_open:
        return None
    
    try:
        if serial_connection.in_waiting > 0:
            line = serial_connection.readline().decode('utf-8').strip()
            
            # Expected format: "PRESSURE:voltage"
            if line.startswith("PRESSURE:"):
                voltage_str = line.split(":")[1]
                voltage = float(voltage_str)
                pressure_kn = voltage_to_pressure(voltage)
                return pressure_kn
    except Exception as e:
        logger.error(f"Error reading pressure sensor: {e}")
    
    return None


async def pressure_stream_handler(websocket, path):
    """
    WebSocket handler for pressure data streaming
    """
    logger.info(f"Client connected from {websocket.remote_address}")
    connected_clients.add(websocket)
    
    try:
        # Send initial connection confirmation
        await websocket.send(json.dumps({
            "status": "connected",
            "message": "Pressure sensor stream active",
            "timestamp": datetime.now().isoformat()
        }))
        
        # Stream pressure data
        while True:
            pressure = read_pressure_sensor()
            
            if pressure is not None:
                data = {
                    "pressure": pressure,
                    "timestamp": datetime.now().isoformat(),
                    "unit": "kN"
                }
                
                await websocket.send(json.dumps(data))
            
            # Send updates at ~20Hz (50ms interval)
            await asyncio.sleep(0.05)
            
    except websockets.exceptions.ConnectionClosed:
        logger.info(f"Client disconnected from {websocket.remote_address}")
    except Exception as e:
        logger.error(f"Error in pressure stream: {e}")
    finally:
        connected_clients.remove(websocket)


async def start_server():
    """
    Start the WebSocket server
    """
    global serial_connection
    
    # Initialize serial connection to Arduino
    try:
        serial_connection = serial.Serial(SERIAL_PORT, BAUD_RATE, timeout=1)
        logger.info(f"✓ Serial connection opened on {SERIAL_PORT}")
        
        # Wait for Arduino to initialize
        await asyncio.sleep(2)
        
    except serial.SerialException as e:
        logger.error(f"✗ Failed to open serial port {SERIAL_PORT}: {e}")
        logger.error("Please check Arduino connection and COM port")
        return
    
    # Start WebSocket server
    logger.info("========================================")
    logger.info("  Pressure Sensor WebSocket Server")
    logger.info("========================================")
    logger.info(f"Serial Port: {SERIAL_PORT}")
    logger.info(f"Baud Rate: {BAUD_RATE}")
    logger.info("WebSocket: ws://localhost:5000/pressure-stream")
    logger.info("========================================\n")
    
    async with websockets.serve(pressure_stream_handler, "localhost", 5000):
        logger.info("✓ WebSocket server running on ws://localhost:5000/pressure-stream")
        logger.info("✓ Waiting for connections...\n")
        
        # Keep server running
        await asyncio.Future()


def cleanup():
    """
    Cleanup resources on shutdown
    """
    global serial_connection
    
    logger.info("\n========================================")
    logger.info("  Shutting down server...")
    logger.info("========================================")
    
    if serial_connection and serial_connection.is_open:
        serial_connection.close()
        logger.info("✓ Serial connection closed")
    
    logger.info("✓ Server shutdown complete\n")


if __name__ == "__main__":
    try:
        asyncio.run(start_server())
    except KeyboardInterrupt:
        cleanup()