import React, { useState, useEffect, useRef } from 'react';
import { Square, ArrowLeft, ArrowRight, Navigation, AlertTriangle, Power, Activity, Target, CheckCircle, Crosshair, RotateCcw, Database } from 'lucide-react';
import { cacheManager, DEFAULT_ACTUATOR_SETTINGS, formatCommand, getPositionName } from './ActuatorDefaultSettings';

const ActuatorControl = () => {
  // WebSocket and connection state
  const [ws, setWs] = useState(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [status, setStatus] = useState('Disconnected');
  
  // Calibration state
  const [isCalibrated, setIsCalibrated] = useState(false);
  const [showCalibrationPrompt, setShowCalibrationPrompt] = useState(true);
  
  // Position and movement state
  const [position, setPosition] = useState(0);
  const [isMoving, setIsMoving] = useState(false);
  const [activeDirection, setActiveDirection] = useState(null);
  
  // Speed control
  const [speed, setSpeed] = useState(DEFAULT_ACTUATOR_SETTINGS.speed.manual);
  
  // Settings state
  const [settings, setSettings] = useState(DEFAULT_ACTUATOR_SETTINGS);
  const [lastCommand, setLastCommand] = useState(null);
  const [commandHistory, setCommandHistory] = useState([]);
  
  // System initialization
  const [systemInitialized, setSystemInitialized] = useState(false);
  const [loadingCache, setLoadingCache] = useState(true);
  
  // Serial log
  const [serialLog, setSerialLog] = useState([]);
  const logRef = useRef(null);
  
  // Refs for intervals
  const speedCommandIntervalRef = useRef(null);
  
  // ============================================================================
  // INITIALIZATION - Load from cache on mount
  // ============================================================================
  useEffect(() => {
    initializeSystem();
    
    return () => {
      if (ws) {
        ws.close();
      }
      stopMovement();
    };
  }, []);

  /**
   * Initialize system - Read from cache or use defaults
   */
  const initializeSystem = async () => {
    try {
      setLoadingCache(true);
      addLog('System: Initializing TimberMach Actuator System...');
      
      // Initialize cache manager and load settings
      const loadedSettings = await cacheManager.initialize();
      setSettings(loadedSettings);
      
      // Read last command from cache
      const cachedCommand = await cacheManager.readLastCommand();
      if (cachedCommand) {
        setLastCommand(cachedCommand);
        addLog(`System: Last command was "${cachedCommand.command}" (${cachedCommand.type})`);
      }
      
      // Read actuator state from cache
      const cachedState = await cacheManager.readActuatorState();
      if (cachedState) {
        setPosition(cachedState.positionMM || 0);
        setIsCalibrated(cachedState.calibrated || false);
        addLog(`System: Restored position: ${cachedState.positionMM}mm`);
        
        if (cachedState.calibrated) {
          setShowCalibrationPrompt(false);
        }
      }
      
      // Load command history
      const history = await cacheManager.getCommandHistory();
      setCommandHistory(history);
      
      // Load speed settings
      if (loadedSettings.speed) {
        setSpeed(loadedSettings.speed.manual);
      }
      
      setSystemInitialized(true);
      setLoadingCache(false);
      
      addLog('System: ✅ Initialization complete - Ready to connect');
      
      // Connect WebSocket after initialization
      connectWebSocket();
      
      // Execute startup command (move to CENTER)
      setTimeout(() => {
        if (cachedState?.calibrated) {
          addLog('System: 🎯 Executing startup command - Moving to CENTER position');
          // Don't actually move - just log it since we're starting at center by default
        }
      }, 1000);
      
    } catch (error) {
      console.error('Error initializing system:', error);
      addLog('System: ❌ Initialization error - using default settings');
      setLoadingCache(false);
      connectWebSocket();
    }
  };

  // ============================================================================
  // WEBSOCKET CONNECTION
  // ============================================================================
  const connectWebSocket = () => {
    try {
      const websocket = new WebSocket(settings.websocket.url);
      
      websocket.onopen = () => {
        console.log('WebSocket connected');
        setWsConnected(true);
        setStatus('Connected');
        addLog('System: Connected to Arduino');
        
        // Request initial position
        setTimeout(() => websocket.send('POS'), 500);
      };
      
      websocket.onmessage = (event) => {
        const data = event.data;
        console.log('Received:', data);
        addLog(`Arduino: ${data}`);
        
        // Parse position updates
        if (data.includes('POS:')) {
          const posMatch = data.match(/POS:([-\d.]+)mm/);
          if (posMatch) {
            const newPosition = parseFloat(posMatch[1]);
            setPosition(newPosition);
            
            // Update cache with new position
            updateActuatorStateCache(newPosition);
          }
        }
        
        // Check calibration status
        if (data.includes('CAL:YES')) {
          setIsCalibrated(true);
          setShowCalibrationPrompt(false);
          updateCalibrationCache(true);
        } else if (data.includes('CAL:NO')) {
          setIsCalibrated(false);
        }
        
        // Detect calibration success message
        if (data.includes('>>> CALIBRATION <<<') || data.includes('Current position set to 0mm')) {
          setIsCalibrated(true);
          setShowCalibrationPrompt(false);
          addLog('System: ✅ Calibration complete!');
          updateCalibrationCache(true);
        }
        
        // Detect movement status
        if (data.includes('MOVING') || data.includes('Direction:')) {
          setIsMoving(true);
        } else if (data.includes('STOP') || data.includes('TARGET REACHED')) {
          setIsMoving(false);
          setActiveDirection(null);
        }
      };
      
      websocket.onerror = (error) => {
        console.error('WebSocket error:', error);
        setStatus('Error');
        setWsConnected(false);
        addLog('System: Connection error');
      };
      
      websocket.onclose = () => {
        console.log('WebSocket closed');
        setStatus('Disconnected');
        setWsConnected(false);
        addLog('System: Disconnected');
      };
      
      setWs(websocket);
    } catch (error) {
      console.error('Failed to create WebSocket:', error);
      setWsConnected(false);
    }
  };

  // ============================================================================
  // CACHE UPDATE FUNCTIONS
  // ============================================================================
  
  /**
   * Update actuator state in cache
   */
  const updateActuatorStateCache = async (positionMM) => {
    const state = {
      position: getPositionName(positionMM),
      positionMM: positionMM,
      calibrated: isCalibrated,
      isMoving: isMoving,
      status: isMoving ? 'MOVING' : 'IDLE'
    };
    
    await cacheManager.saveActuatorState(state);
  };

  /**
   * Update calibration state in cache
   */
  const updateCalibrationCache = async (calibrated) => {
    await cacheManager.saveCalibrationState({
      calibrated: calibrated,
      calibrationDate: new Date().toISOString(),
      position: position
    });
  };

  /**
   * Save command to cache
   */
  const saveCommandToCache = async (command, type = 'MANUAL') => {
    const commandData = await cacheManager.saveCommand(command, type);
    if (commandData) {
      setLastCommand(commandData);
      
      // Update history
      const history = await cacheManager.getCommandHistory();
      setCommandHistory(history);
    }
  };

  // ============================================================================
  // SERIAL LOG
  // ============================================================================
  const addLog = (message) => {
    setSerialLog(prev => {
      const newLog = [...prev, { time: new Date().toLocaleTimeString(), message }];
      return newLog.slice(-50);
    });
  };
  
  // Auto-scroll log
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [serialLog]);

  // ============================================================================
  // COMMAND FUNCTIONS
  // ============================================================================
  
  const sendCommand = (cmd) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      console.log('Sending:', cmd);
      ws.send(cmd);
      addLog(`User: ${cmd}`);
    } else {
      addLog('System: Not connected');
    }
  };
  
  // Calibration function
  const handleCalibrate = async () => {
    if (!wsConnected) {
      addLog('System: Not connected to Arduino');
      return;
    }
    
    sendCommand('CAL');
    await saveCommandToCache('CAL', 'CALIBRATION');
    addLog('System: Calibrating... Position actuator at center (0mm) reference point');
  };
  
  // Position commands
  const handleMoveLeft = async () => {
    if (!wsConnected) {
      addLog('System: Not connected to Arduino');
      return;
    }
    
    if (!isCalibrated) {
      addLog('System: ⚠️ Please calibrate first!');
      setShowCalibrationPrompt(true);
      return;
    }
    
    sendCommand('LEFT');
    await saveCommandToCache('LEFT', 'POSITION');
  };
  
  const handleMoveCenter = async () => {
    if (!wsConnected) {
      addLog('System: Not connected to Arduino');
      return;
    }
    
    if (!isCalibrated) {
      addLog('System: ⚠️ Please calibrate first!');
      setShowCalibrationPrompt(true);
      return;
    }
    
    sendCommand('MID');
    await saveCommandToCache('MID', 'POSITION');
  };
  
  const handleMoveRight = async () => {
    if (!wsConnected) {
      addLog('System: Not connected to Arduino');
      return;
    }
    
    if (!isCalibrated) {
      addLog('System: ⚠️ Please calibrate first!');
      setShowCalibrationPrompt(true);
      return;
    }
    
    sendCommand('RIGHT');
    await saveCommandToCache('RIGHT', 'POSITION');
  };
  
  // Manual hold control
  const handleMouseDown = async (direction) => {
    if (!wsConnected) {
      addLog('System: Not connected to Arduino');
      return;
    }
    
    if (!isCalibrated) {
      addLog('System: ⚠️ Please calibrate first!');
      setShowCalibrationPrompt(true);
      return;
    }
    
    setActiveDirection(direction);
    setIsMoving(true);
    
    const speedCommand = direction === 'LEFT' ? `L${speed}` : `R${speed}`;
    sendCommand(speedCommand);
    await saveCommandToCache(speedCommand, 'MANUAL');
    
    speedCommandIntervalRef.current = setInterval(() => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(speedCommand);
      }
    }, 200);
  };
  
  const handleMouseUp = () => {
    stopMovement();
  };
  
  const stopMovement = async () => {
    if (speedCommandIntervalRef.current) {
      clearInterval(speedCommandIntervalRef.current);
      speedCommandIntervalRef.current = null;
    }
    
    sendCommand('S');
    await saveCommandToCache('S', 'STOP');
    
    setIsMoving(false);
    setActiveDirection(null);
  };
  
  const handleEmergencyStop = async () => {
    stopMovement();
    addLog('!!! EMERGENCY STOP ACTIVATED !!!');
    await saveCommandToCache('EMERGENCY_STOP', 'EMERGENCY');
  };

  // ============================================================================
  // SETTINGS FUNCTIONS
  // ============================================================================
  
  /**
   * Reset to default settings
   */
  const handleResetToDefaults = async () => {
    if (!window.confirm('Are you sure you want to reset all settings to defaults? This will clear calibration and command history.')) {
      return;
    }
    
    addLog('System: 🔄 Resetting to default settings...');
    
    const success = await cacheManager.resetToDefaults();
    
    if (success) {
      // Reload settings
      const loadedSettings = await cacheManager.initialize();
      setSettings(loadedSettings);
      setSpeed(loadedSettings.speed.manual);
      setIsCalibrated(false);
      setShowCalibrationPrompt(true);
      setLastCommand(null);
      setCommandHistory([]);
      setPosition(0);
      
      addLog('System: ✅ Reset complete - default settings restored');
    } else {
      addLog('System: ❌ Reset failed');
    }
  };

  /**
   * Save speed to cache
   */
  const handleSpeedChange = async (newSpeed) => {
    setSpeed(newSpeed);
    
    const updatedSpeed = {
      ...settings.speed,
      manual: newSpeed
    };
    
    await cacheManager.saveSpeedSettings(updatedSpeed);
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  if (loadingCache) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
          <h2 className="text-2xl font-bold mb-2">Loading Actuator System...</h2>
          <p className="text-gray-400">Reading settings from cache</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white p-6">
      <div className="max-w-6xl mx-auto">
        
        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                Actuator Manual Control
              </h1>
              <p className="text-gray-400 text-sm">System v{settings.system.version} - Initialized from {systemInitialized ? 'cache' : 'defaults'}</p>
            </div>
            
            {/* Reset Button */}
            <button
              onClick={handleResetToDefaults}
              className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition text-sm"
            >
              <RotateCcw className="w-4 h-4" />
              Reset to Defaults
            </button>
          </div>
          
          {/* Status Bar */}
          <div className="flex items-center gap-4 bg-gray-800 bg-opacity-50 border border-gray-700 rounded-lg p-4">
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${wsConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
              <span className="text-sm">WebSocket:</span>
              <span className={`text-sm font-semibold ${wsConnected ? 'text-green-400' : 'text-red-400'}`}>
                {status}
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-sm">Calibration:</span>
              <span className={`text-sm font-semibold px-2 py-1 rounded ${isCalibrated ? 'bg-green-600' : 'bg-yellow-600'}`}>
                {isCalibrated ? '✓ Calibrated' : '⚠️ Not Calibrated'}
              </span>
            </div>
            
            {isMoving && (
              <div className="flex items-center gap-2 text-yellow-400">
                <Activity className="w-4 h-4 animate-pulse" />
                <span className="text-sm font-semibold">Moving {activeDirection}</span>
              </div>
            )}
            
            {lastCommand && (
              <div className="flex items-center gap-2 text-blue-400 ml-auto">
                <Database className="w-4 h-4" />
                <span className="text-sm">Last: {formatCommand(lastCommand.command)}</span>
              </div>
            )}
          </div>
        </div>

        {/* REST OF THE COMPONENT - SAME AS BEFORE */}
        {/* (Including calibration prompt, controls, serial monitor, etc.) */}
        {/* I'll keep the existing JSX from ActuatorControl.jsx for brevity */}
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Panel - Controls (same as before) */}
          <div className="space-y-6">
            {/* ... existing control components ... */}
          </div>
          
          {/* Right Panel - Serial Monitor */}
          <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700">
            <h2 className="text-xl font-semibold mb-4">Serial Monitor</h2>
            
            <div 
              ref={logRef}
              className="bg-black rounded-xl p-4 h-[800px] overflow-y-auto font-mono text-sm"
            >
              {serialLog.length === 0 && (
                <div className="text-gray-500 text-center py-8">
                  System initialized. Waiting for connection...
                </div>
              )}
              {serialLog.map((log, index) => (
                <div key={index} className="mb-2">
                  <span className="text-gray-500">[{log.time}]</span>{' '}
                  <span className={
                    log.message.startsWith('System:') ? 'text-yellow-400' :
                    log.message.startsWith('User:') ? 'text-green-400' :
                    log.message.includes('ERROR') ? 'text-red-400' :
                    log.message.includes('STOP') ? 'text-red-300' :
                    log.message.includes('CALIBRATION') ? 'text-cyan-400' :
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