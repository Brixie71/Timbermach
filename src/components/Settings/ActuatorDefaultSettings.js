/**
 * ActuatorDefaultSettings.js
 * Default configuration and cache management for TimberMach Actuator System
 * Integrates with persistent storage to restore last state on startup
 */

// ============================================================================
// DEFAULT ACTUATOR SETTINGS (FIXED STARTUP CONFIGURATION)
// ============================================================================
export const DEFAULT_ACTUATOR_SETTINGS = {
    // Position Settings (in mm)
    positions: {
      LEFT: -27,
      MID: 0,
      RIGHT: 27
    },
    
    // Initial position on machine startup
    initialPosition: 'MID', // Always start at CENTER (0mm)
    
    // Speed Settings
    speed: {
      default: 80,        // Default speed for automatic movements (0-100)
      manual: 80,         // Default speed for manual hold controls
      min: 20,            // Minimum allowed speed
      max: 100            // Maximum allowed speed
    },
    
    // Hardware Limits (from Arduino)
    hardwareLimits: {
      maxLeftMM: 27,
      maxRightMM: 27,
      safetyMarginMM: 2,
      totalRange: 54      // Total travel range
    },
    
    // Calibration Settings
    calibration: {
      required: true,           // Calibration required before movement
      calibrated: false,        // Initial calibration state
      tolerance: 2.0            // Position tolerance in mm
    },
    
    // WebSocket Configuration
    websocket: {
      url: 'ws://localhost:8080',
      reconnectInterval: 5000,  // Attempt reconnect every 5 seconds
      autoReconnect: true
    },
    
    // System State
    system: {
      machineStarted: false,
      version: '1.0.0',
      startupCommand: 'MID',    // Command to execute on startup
      emergency: false
    }
  };
  
  // ============================================================================
  // CACHE KEYS FOR PERSISTENT STORAGE
  // ============================================================================
  export const CACHE_KEYS = {
    // Last Command & State
    LAST_COMMAND: 'timbermach:actuator:last_command',
    COMMAND_HISTORY: 'timbermach:actuator:command_history',
    
    // Actuator State
    ACTUATOR_STATE: 'timbermach:actuator:state',
    POSITION: 'timbermach:actuator:position',
    
    // Settings
    SETTINGS: 'timbermach:actuator:settings',
    SPEED_SETTINGS: 'timbermach:actuator:speed',
    
    // Calibration
    CALIBRATION_STATE: 'timbermach:actuator:calibration',
    CUSTOM_MIDPOINT: 'timbermach:actuator:custom_midpoint',
    
    // System State
    MACHINE_STATE: 'timbermach:actuator:machine_state',
    STARTUP_INITIALIZED: 'timbermach:actuator:startup_initialized'
  };
  
  // ============================================================================
  // CACHE MANAGER CLASS
  // ============================================================================
  export class ActuatorCacheManager {
    constructor() {
      this.isAvailable = typeof window !== 'undefined' && window.storage;
    }
  
    /**
     * Initialize system with default settings
     * Reads from cache if available, otherwise uses defaults
     */
    async initialize() {
      try {
        console.log('🚀 Initializing Actuator System...');
        
        // Check if this is first startup
        const startupCheck = await this.get(CACHE_KEYS.STARTUP_INITIALIZED);
        
        if (!startupCheck) {
          // First time startup - use defaults and save to cache
          console.log('⚡ First startup detected - applying default settings');
          await this.setDefaults();
          return DEFAULT_ACTUATOR_SETTINGS;
        }
        
        // Load settings from cache
        console.log('📖 Loading settings from cache...');
        const settings = await this.loadSettings();
        
        return settings;
      } catch (error) {
        console.error('❌ Error initializing actuator system:', error);
        return DEFAULT_ACTUATOR_SETTINGS;
      }
    }
  
    /**
     * Set default settings to cache (first startup)
     */
    async setDefaults() {
      try {
        // Save default settings
        await this.set(CACHE_KEYS.SETTINGS, DEFAULT_ACTUATOR_SETTINGS);
        
        // Initialize actuator state at CENTER position
        const initialState = {
          position: 'MID',
          positionMM: 0,
          calibrated: false,
          isMoving: false,
          lastUpdate: new Date().toISOString(),
          status: 'INITIALIZED'
        };
        await this.set(CACHE_KEYS.ACTUATOR_STATE, initialState);
        
        // Save startup initialization command
        const startupCommand = {
          command: 'MID',
          timestamp: new Date().toISOString(),
          type: 'INITIALIZATION',
          id: Date.now()
        };
        await this.set(CACHE_KEYS.LAST_COMMAND, startupCommand);
        
        // Initialize command history
        await this.set(CACHE_KEYS.COMMAND_HISTORY, [startupCommand]);
        
        // Save speed settings
        await this.set(CACHE_KEYS.SPEED_SETTINGS, DEFAULT_ACTUATOR_SETTINGS.speed);
        
        // Initialize machine state
        const machineState = {
          started: true,
          startTime: new Date().toISOString(),
          initialPosition: 'MID',
          version: DEFAULT_ACTUATOR_SETTINGS.system.version
        };
        await this.set(CACHE_KEYS.MACHINE_STATE, machineState);
        
        // Mark as initialized
        await this.set(CACHE_KEYS.STARTUP_INITIALIZED, {
          initialized: true,
          timestamp: new Date().toISOString()
        });
        
        console.log('✅ Default settings saved to cache');
      } catch (error) {
        console.error('❌ Error setting defaults:', error);
      }
    }
  
    /**
     * Load all settings from cache
     */
    async loadSettings() {
      try {
        // Load main settings
        const settingsData = await this.get(CACHE_KEYS.SETTINGS);
        const settings = settingsData || DEFAULT_ACTUATOR_SETTINGS;
        
        // Load speed settings
        const speedData = await this.get(CACHE_KEYS.SPEED_SETTINGS);
        if (speedData) {
          settings.speed = speedData;
        }
        
        // Load calibration state
        const calibrationData = await this.get(CACHE_KEYS.CALIBRATION_STATE);
        if (calibrationData) {
          settings.calibration = { ...settings.calibration, ...calibrationData };
        }
        
        return settings;
      } catch (error) {
        console.error('❌ Error loading settings:', error);
        return DEFAULT_ACTUATOR_SETTINGS;
      }
    }
  
    /**
     * Read last command from cache
     */
    async readLastCommand() {
      try {
        const result = await this.get(CACHE_KEYS.LAST_COMMAND);
        
        if (result) {
          console.log('📋 Last command from cache:', result);
          return result;
        }
        
        console.log('⚠️ No last command found in cache');
        return null;
      } catch (error) {
        console.error('❌ Error reading last command:', error);
        return null;
      }
    }
  
    /**
     * Save command to cache
     */
    async saveCommand(command, type = 'MANUAL') {
      try {
        const commandData = {
          command: command,
          timestamp: new Date().toISOString(),
          type: type,
          id: Date.now()
        };
        
        // Save as last command
        await this.set(CACHE_KEYS.LAST_COMMAND, commandData);
        
        // Update command history (keep last 20)
        const historyData = await this.get(CACHE_KEYS.COMMAND_HISTORY);
        const history = historyData || [];
        const newHistory = [commandData, ...history].slice(0, 20);
        await this.set(CACHE_KEYS.COMMAND_HISTORY, newHistory);
        
        console.log('✅ Command saved to cache:', command);
        return commandData;
      } catch (error) {
        console.error('❌ Error saving command:', error);
        return null;
      }
    }
  
    /**
     * Read actuator state from cache
     */
    async readActuatorState() {
      try {
        const result = await this.get(CACHE_KEYS.ACTUATOR_STATE);
        
        if (result) {
          console.log('📍 Actuator state from cache:', result);
          return result;
        }
        
        console.log('⚠️ No actuator state found in cache');
        return null;
      } catch (error) {
        console.error('❌ Error reading actuator state:', error);
        return null;
      }
    }
  
    /**
     * Save actuator state to cache
     */
    async saveActuatorState(state) {
      try {
        await this.set(CACHE_KEYS.ACTUATOR_STATE, {
          ...state,
          lastUpdate: new Date().toISOString()
        });
        
        console.log('✅ Actuator state saved:', state);
      } catch (error) {
        console.error('❌ Error saving actuator state:', error);
      }
    }
  
    /**
     * Save speed settings
     */
    async saveSpeedSettings(speedSettings) {
      try {
        await this.set(CACHE_KEYS.SPEED_SETTINGS, speedSettings);
        console.log('✅ Speed settings saved:', speedSettings);
      } catch (error) {
        console.error('❌ Error saving speed settings:', error);
      }
    }
  
    /**
     * Save calibration state
     */
    async saveCalibrationState(calibrationData) {
      try {
        await this.set(CACHE_KEYS.CALIBRATION_STATE, {
          ...calibrationData,
          timestamp: new Date().toISOString()
        });
        console.log('✅ Calibration state saved');
      } catch (error) {
        console.error('❌ Error saving calibration state:', error);
      }
    }
  
    /**
     * Reset to default settings
     */
    async resetToDefaults() {
      try {
        console.log('🔄 Resetting to default settings...');
        
        // Clear all cache entries
        await this.delete(CACHE_KEYS.LAST_COMMAND);
        await this.delete(CACHE_KEYS.COMMAND_HISTORY);
        await this.delete(CACHE_KEYS.ACTUATOR_STATE);
        await this.delete(CACHE_KEYS.SETTINGS);
        await this.delete(CACHE_KEYS.SPEED_SETTINGS);
        await this.delete(CACHE_KEYS.CALIBRATION_STATE);
        await this.delete(CACHE_KEYS.MACHINE_STATE);
        await this.delete(CACHE_KEYS.STARTUP_INITIALIZED);
        
        // Reinitialize with defaults
        await this.setDefaults();
        
        console.log('✅ Reset complete - default settings applied');
        return true;
      } catch (error) {
        console.error('❌ Error resetting to defaults:', error);
        return false;
      }
    }
  
    /**
     * Get command history
     */
    async getCommandHistory() {
      try {
        const result = await this.get(CACHE_KEYS.COMMAND_HISTORY);
        return result || [];
      } catch (error) {
        console.error('❌ Error reading command history:', error);
        return [];
      }
    }
  
    // ============================================================================
    // PRIVATE HELPER METHODS
    // ============================================================================
  
    /**
     * Get data from cache
     */
    async get(key) {
      if (!this.isAvailable) {
        console.warn('⚠️ Storage not available');
        return null;
      }
  
      try {
        const result = await window.storage.get(key);
        return result ? JSON.parse(result.value) : null;
      } catch (error) {
        // Key doesn't exist
        return null;
      }
    }
  
    /**
     * Set data to cache
     */
    async set(key, value) {
      if (!this.isAvailable) {
        console.warn('⚠️ Storage not available');
        return false;
      }
  
      try {
        await window.storage.set(key, JSON.stringify(value));
        return true;
      } catch (error) {
        console.error('❌ Error setting cache:', error);
        return false;
      }
    }
  
    /**
     * Delete data from cache
     */
    async delete(key) {
      if (!this.isAvailable) {
        console.warn('⚠️ Storage not available');
        return false;
      }
  
      try {
        await window.storage.delete(key);
        return true;
      } catch (error) {
        console.error('❌ Error deleting from cache:', error);
        return false;
      }
    }
  }
  
  // ============================================================================
  // EXPORT SINGLETON INSTANCE
  // ============================================================================
  export const cacheManager = new ActuatorCacheManager();
  
  // ============================================================================
  // UTILITY FUNCTIONS
  // ============================================================================
  
  /**
   * Format command for display
   */
  export function formatCommand(command) {
    const commandMap = {
      'MID': 'Move to Center',
      'LEFT': 'Move to Left',
      'RIGHT': 'Move to Right',
      'CAL': 'Calibrate',
      'S': 'Stop',
      'STOP': 'Emergency Stop'
    };
    
    return commandMap[command] || command;
  }
  
  /**
   * Get position name from mm value
   */
  export function getPositionName(positionMM) {
    const { positions } = DEFAULT_ACTUATOR_SETTINGS;
    
    if (Math.abs(positionMM - positions.LEFT) < 2) return 'LEFT';
    if (Math.abs(positionMM - positions.MID) < 2) return 'MID';
    if (Math.abs(positionMM - positions.RIGHT) < 2) return 'RIGHT';
    
    return positionMM < 0 ? 'LEFT_SIDE' : 'RIGHT_SIDE';
  }
  
  /**
   * Validate speed value
   */
  export function validateSpeed(speed) {
    const { min, max } = DEFAULT_ACTUATOR_SETTINGS.speed;
    return Math.max(min, Math.min(max, speed));
  }
  
  /**
   * Check if position is within safe limits
   */
  export function isPositionSafe(positionMM) {
    const { hardwareLimits } = DEFAULT_ACTUATOR_SETTINGS;
    const safeLeft = -hardwareLimits.maxLeftMM + hardwareLimits.safetyMarginMM;
    const safeRight = hardwareLimits.maxRightMM - hardwareLimits.safetyMarginMM;
    
    return positionMM >= safeLeft && positionMM <= safeRight;
  }