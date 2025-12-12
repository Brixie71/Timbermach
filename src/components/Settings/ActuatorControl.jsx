import React, { useState, useEffect, useRef } from 'react';
import { Play, Square, ArrowLeft, ArrowRight, Navigation, Settings, Target, RotateCcw } from 'lucide-react';

const ActuatorControl = ({ onOpenCalibration, onOpenSettings }) => {
  const [position, setPosition] = useState(0);
  const [midpoint, setMidpoint] = useState(0);
  const [isMoving, setIsMoving] = useState(false);
  const [isCalibrated, setIsCalibrated] = useState(false);
  const [status, setStatus] = useState('Disconnected');
  const [locationStatus, setLocationStatus] = useState('UNKNOWN');
  const [serialLog, setSerialLog] = useState([]);
  const [ws, setWs] = useState(null);
  
  // Manual control states
  const [manualSpeed, setManualSpeed] = useState(50);
  const [isManualControlActive, setIsManualControlActive] = useState(false);
  const [manualDirection, setManualDirection] = useState(null);
  
  const logRef = useRef(null);
  const holdTimerRef = useRef(null);
  const speedCommandIntervalRef = useRef(null);

  // WebSocket connection
  useEffect(() => {
    const websocket = new WebSocket('ws://localhost:8080');
    
    websocket.onopen = () => {
      console.log('Connected to WebSocket server');
      setStatus('Connected');
      addLog('System: Connected to Arduino');
      // Request initial status
      setTimeout(() => websocket.send('POS'), 500);
    };
    
    websocket.onmessage = (event) => {
      const data = event.data;
      console.log('Received:', data);
      addLog(`Arduino: ${data}`);
      
      // Parse position updates
      if (data.includes('POS:')) {
        parsePositionUpdate(data);
      }
      
      // Detect calibration status
      if (data.includes('CAL:YES')) {
        setIsCalibrated(true);
      } else if (data.includes('CAL:NO')) {
        setIsCalibrated(false);
      }
      
      // Detect movement status
      if (data.includes('MOVING TO') || data.includes('Direction:')) {
        setIsMoving(true);
      } else if (data.includes('TARGET REACHED') || data.includes('STOP')) {
        setIsMoving(false);
      }
    };
    
    websocket.onerror = (error) => {
      console.error('WebSocket error:', error);
      setStatus('Error');
      addLog('System: Connection error');
    };
    
    websocket.onclose = () => {
      console.log('WebSocket connection closed');
      setStatus('Disconnected');
      addLog('System: Disconnected from Arduino');
    };
    
    setWs(websocket);
    
    return () => {
      if (websocket) {
        websocket.close();
      }
      // Cleanup manual control timers
      if (holdTimerRef.current) {
        clearTimeout(holdTimerRef.current);
      }
      if (speedCommandIntervalRef.current) {
        clearInterval(speedCommandIntervalRef.current);
      }
    };
  }, []);

  const parsePositionUpdate = (data) => {
    // Example: "POS:50.23mm | MID_SET:0.00mm | TARGET:NONE | STATUS:LEFT_SIDE | CAL:YES | LIMITS:[-100.0 to 120.0]mm"
    const posMatch = data.match(/POS:([-\d.]+)mm/);
    if (posMatch) {
      setPosition(parseFloat(posMatch[1]));
    }
    
    const midMatch = data.match(/MID_SET:([-\d.]+)mm/);
    if (midMatch) {
      setMidpoint(parseFloat(midMatch[1]));
    }
    
    const statusMatch = data.match(/STATUS:(\w+)/);
    if (statusMatch) {
      setLocationStatus(statusMatch[1]);
    }
  };

  const addLog = (message) => {
    setSerialLog(prev => {
      const newLog = [...prev, { time: new Date().toLocaleTimeString(), message }];
      return newLog.slice(-50); // Keep last 50 messages
    });
  };

  // Auto-scroll log
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [serialLog]);

  const sendCommand = (cmd) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      console.log('Sending command:', cmd);
      ws.send(cmd);
      addLog(`User: ${cmd}`);
    } else {
      addLog('System: Not connected to Arduino');
    }
  };

  const handleCalibrate = () => {
    sendCommand('CAL');
  };

  const handleSetMidpoint = () => {
    if (window.confirm('Set current position as new midpoint?')) {
      sendCommand('SET_MID');
    }
  };

  const handleResetMidpoint = () => {
    if (window.confirm('Reset midpoint to 0mm?')) {
      sendCommand('RESET_MID');
    }
  };

  const handleMoveLeft = () => {
    sendCommand('LEFT');
  };

  const handleMoveCenter = () => {
    sendCommand('MID');
  };

  const handleMoveRight = () => {
    sendCommand('RIGHT');
  };

  const handleStop = () => {
    sendCommand('S');
    stopManualControl();
  };

  // Manual Control Functions
  const startManualControl = (direction) => {
    if (!isCalibrated) {
      addLog('System: Please calibrate first');
      return;
    }

    setIsManualControlActive(true);
    setManualDirection(direction);
    
    // Send initial command with speed
    const speedCommand = direction === 'LEFT' ? `L${manualSpeed}` : `R${manualSpeed}`;
    sendCommand(speedCommand);
    
    // Continue sending speed commands every 200ms to maintain movement
    speedCommandIntervalRef.current = setInterval(() => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(speedCommand);
      }
    }, 200);
  };

  const stopManualControl = () => {
    setIsManualControlActive(false);
    setManualDirection(null);
    
    // Clear interval
    if (speedCommandIntervalRef.current) {
      clearInterval(speedCommandIntervalRef.current);
      speedCommandIntervalRef.current = null;
    }
    
    // Clear hold timer if exists
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    
    // Send stop command first
    sendCommand('S');
    
    // After a short delay, return to midpoint
    setTimeout(() => {
      if (isCalibrated) {
        addLog('System: Returning to midpoint...');
        sendCommand('MID');
      }
    }, 500); // 500ms delay to ensure stop command is processed
  };

  const handleManualTouchStart = (direction) => {
    // Start hold timer (300ms delay before starting movement)
    holdTimerRef.current = setTimeout(() => {
      startManualControl(direction);
    }, 300);
  };

  const handleManualTouchEnd = () => {
    // If timer hasn't fired yet, cancel it
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    
    // Stop manual control if active
    if (isManualControlActive) {
      stopManualControl();
      sendCommand('S');
    }
  };

  const handleSpeedChange = (e) => {
    const newSpeed = parseInt(e.target.value);
    setManualSpeed(newSpeed);
  };

  const getPositionPercentage = () => {
    const maxLeft = -100;
    const maxRight = 120;
    const range = maxRight - maxLeft;
    const normalized = ((position - maxLeft) / range) * 100;
    return Math.max(0, Math.min(100, normalized));
  };

  const getMidpointPercentage = () => {
    const maxLeft = -100;
    const maxRight = 120;
    const range = maxRight - maxLeft;
    const normalized = ((midpoint - maxLeft) / range) * 100;
    return Math.max(0, Math.min(100, normalized));
  };

  const getStatusColor = () => {
    switch(locationStatus) {
      case 'AT_MID': return 'text-green-400';
      case 'AT_LEFT': return 'text-red-400';
      case 'AT_RIGHT': return 'text-blue-400';
      case 'LEFT_SIDE': return 'text-orange-400';
      case 'RIGHT_SIDE': return 'text-cyan-400';
      default: return 'text-gray-400';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white p-6">
      <div className="max-w-7xl mx-auto">
        
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-4xl font-bold mb-2">Actuator Control</h1>
              <div className="flex items-center gap-4">
                <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                  status === 'Connected' ? 'bg-green-600' : 
                  status === 'Error' ? 'bg-red-600' : 'bg-gray-600'
                }`}>
                  {status}
                </span>
                <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                  isCalibrated ? 'bg-blue-600' : 'bg-yellow-600'
                }`}>
                  {isCalibrated ? 'Calibrated' : 'Not Calibrated'}
                </span>
                <span className={`px-3 py-1 rounded-full text-sm font-semibold ${getStatusColor()} bg-gray-700`}>
                  {locationStatus.replace('_', ' ')}
                </span>
                {isMoving && (
                  <span className="px-3 py-1 rounded-full text-sm font-semibold bg-purple-600 animate-pulse">
                    Moving...
                  </span>
                )}
              </div>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={onOpenCalibration}
                className="bg-blue-600 hover:bg-blue-700 px-5 py-3 rounded-xl font-semibold flex items-center gap-2 transition-colors"
              >
                <Settings className="w-5 h-5" />
                Calibration
              </button>
            </div>
          </div>
        </div>

        {/* Main Control Panel */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Left: Position Display & Controls */}
          <div className="space-y-6">
            
            {/* Position Display */}
            <div className="bg-gray-800 rounded-2xl p-8 border border-gray-700">
              <h2 className="text-xl font-semibold mb-6">Current Position</h2>
              
              {/* Numeric Position */}
              <div className="text-center mb-6">
                <div className="text-6xl font-bold text-blue-400">
                  {position.toFixed(2)}
                </div>
                <div className="text-gray-400 text-lg mt-2">mm</div>
                {midpoint !== 0 && (
                  <div className="text-sm text-yellow-400 mt-2">
                    Custom Midpoint: {midpoint.toFixed(2)}mm
                  </div>
                )}
              </div>

              {/* Visual Position Bar */}
              <div className="mb-6">
                <div className="relative h-8 bg-gray-700 rounded-full overflow-hidden">
                  {/* Position indicator */}
                  <div 
                    className="absolute top-0 left-0 h-full bg-gradient-to-r from-red-500 via-green-500 to-blue-500 transition-all duration-300"
                    style={{ width: `${getPositionPercentage()}%` }}
                  />
                  {/* Midpoint marker */}
                  <div 
                    className="absolute top-0 h-full w-1 bg-yellow-400 z-10"
                    style={{ left: `${getMidpointPercentage()}%` }}
                  />
                  {/* Current position marker */}
                  <div 
                    className="absolute top-1/2 transform -translate-y-1/2 w-2 h-12 bg-white shadow-lg z-20"
                    style={{ left: `${getPositionPercentage()}%` }}
                  />
                </div>
                <div className="flex justify-between mt-2 text-sm text-gray-400">
                  <span>-100mm (LEFT)</span>
                  <span>0mm</span>
                  <span>+120mm (RIGHT)</span>
                </div>
              </div>
            </div>

            {/* Position Control Buttons */}
            <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700">
              <h2 className="text-xl font-semibold mb-4">Position Commands</h2>
              
              <div className="grid grid-cols-3 gap-4">
                <button
                  onClick={handleMoveLeft}
                  disabled={!isCalibrated || isMoving}
                  className="bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed px-6 py-8 rounded-xl font-semibold flex flex-col items-center justify-center gap-2 transition-colors"
                >
                  <ArrowLeft className="w-8 h-8" />
                  <span>LEFT</span>
                  <span className="text-xs opacity-75">-100mm</span>
                </button>

                <button
                  onClick={handleMoveCenter}
                  disabled={!isCalibrated || isMoving}
                  className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed px-6 py-8 rounded-xl font-semibold flex flex-col items-center justify-center gap-2 transition-colors"
                >
                  <Navigation className="w-8 h-8" />
                  <span>MID</span>
                  <span className="text-xs opacity-75">{midpoint.toFixed(0)}mm</span>
                </button>

                <button
                  onClick={handleMoveRight}
                  disabled={!isCalibrated || isMoving}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed px-6 py-8 rounded-xl font-semibold flex flex-col items-center justify-center gap-2 transition-colors"
                >
                  <ArrowRight className="w-8 h-8" />
                  <span>RIGHT</span>
                  <span className="text-xs opacity-75">+120mm</span>
                </button>
              </div>

              {/* Emergency Stop */}
              <button
                onClick={handleStop}
                className="w-full mt-4 bg-red-700 hover:bg-red-800 px-6 py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors"
              >
                <Square className="w-6 h-6" />
                EMERGENCY STOP
              </button>
            </div>

            {/* Midpoint Control */}
            <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700">
              <h2 className="text-xl font-semibold mb-4">Midpoint Setup</h2>
              
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={handleSetMidpoint}
                  disabled={!isCalibrated}
                  className="bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-600 disabled:cursor-not-allowed px-4 py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors"
                >
                  <Target className="w-5 h-5" />
                  Set Midpoint
                </button>
                
                <button
                  onClick={handleResetMidpoint}
                  disabled={!isCalibrated}
                  className="bg-orange-600 hover:bg-orange-700 disabled:bg-gray-600 disabled:cursor-not-allowed px-4 py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors"
                >
                  <RotateCcw className="w-5 h-5" />
                  Reset to 0mm
                </button>
              </div>
              
              <p className="text-sm text-gray-400 mt-3">
                Set custom midpoint: Move to desired position, then click "Set Midpoint". MID command will return here.
              </p>
            </div>

            {/* Calibration */}
            <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700">
              <h2 className="text-xl font-semibold mb-4">System Calibration</h2>
              
              <button
                onClick={handleCalibrate}
                className="w-full bg-purple-600 hover:bg-purple-700 px-6 py-4 rounded-xl font-semibold transition-colors"
              >
                Calibrate at 0mm Reference
              </button>
              
              <p className="text-sm text-gray-400 mt-3">
                Position actuator at physical center (0mm reference), then calibrate.
              </p>
            </div>

            {/* Manual Control (Touch & Hold) */}
            <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700">
              <h2 className="text-xl font-semibold mb-4">Manual Control</h2>
              
              {/* Speed Slider */}
              <div className="mb-4">
                <div className="flex justify-between items-center mb-2">
                  <label className="text-sm text-gray-400">Speed:</label>
                  <span className="text-lg font-bold text-blue-400">{manualSpeed}%</span>
                </div>
                <input
                  type="range"
                  min="20"
                  max="100"
                  step="5"
                  value={manualSpeed}
                  onChange={handleSpeedChange}
                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
                  style={{
                    background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${manualSpeed}%, #374151 ${manualSpeed}%, #374151 100%)`
                  }}
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>20%</span>
                  <span>100%</span>
                </div>
              </div>

              {/* Touch & Hold Buttons */}
              <div className="grid grid-cols-2 gap-4">
                <button
                  onMouseDown={() => handleManualTouchStart('LEFT')}
                  onMouseUp={handleManualTouchEnd}
                  onMouseLeave={handleManualTouchEnd}
                  onTouchStart={() => handleManualTouchStart('LEFT')}
                  onTouchEnd={handleManualTouchEnd}
                  disabled={!isCalibrated}
                  className={`px-6 py-12 rounded-xl font-bold text-lg flex flex-col items-center justify-center gap-3 transition-all select-none ${
                    isManualControlActive && manualDirection === 'LEFT'
                      ? 'bg-red-700 scale-95 shadow-inner'
                      : 'bg-red-600 hover:bg-red-700 active:scale-95'
                  } disabled:bg-gray-600 disabled:cursor-not-allowed`}
                >
                  <ArrowLeft className="w-10 h-10" />
                  <span>HOLD LEFT</span>
                  {isManualControlActive && manualDirection === 'LEFT' && (
                    <span className="text-xs animate-pulse">● ACTIVE</span>
                  )}
                </button>

                <button
                  onMouseDown={() => handleManualTouchStart('RIGHT')}
                  onMouseUp={handleManualTouchEnd}
                  onMouseLeave={handleManualTouchEnd}
                  onTouchStart={() => handleManualTouchStart('RIGHT')}
                  onTouchEnd={handleManualTouchEnd}
                  disabled={!isCalibrated}
                  className={`px-6 py-12 rounded-xl font-bold text-lg flex flex-col items-center justify-center gap-3 transition-all select-none ${
                    isManualControlActive && manualDirection === 'RIGHT'
                      ? 'bg-blue-700 scale-95 shadow-inner'
                      : 'bg-blue-600 hover:bg-blue-700 active:scale-95'
                  } disabled:bg-gray-600 disabled:cursor-not-allowed`}
                >
                  <ArrowRight className="w-10 h-10" />
                  <span>HOLD RIGHT</span>
                  {isManualControlActive && manualDirection === 'RIGHT' && (
                    <span className="text-xs animate-pulse">● ACTIVE</span>
                  )}
                </button>
              </div>

              <p className="text-sm text-gray-400 mt-4">
                <strong>Touch & Hold</strong> to manually move actuator. <strong>Release to stop and auto-return to midpoint.</strong>
              </p>
            </div>
          </div>

          {/* Right: Serial Monitor */}
          <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700">
            <h2 className="text-xl font-semibold mb-4">Serial Monitor</h2>
            
            <div 
              ref={logRef}
              className="bg-black rounded-xl p-4 h-[800px] overflow-y-auto font-mono text-sm"
            >
              {serialLog.map((log, index) => (
                <div key={index} className="mb-2">
                  <span className="text-gray-500">[{log.time}]</span>{' '}
                  <span className={
                    log.message.startsWith('System:') ? 'text-yellow-400' :
                    log.message.startsWith('User:') ? 'text-green-400' :
                    'text-white'
                  }>
                    {log.message}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ActuatorControl;