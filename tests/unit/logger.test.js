/**
 * Unit tests for LogManager module
 */

// Mock console methods to track calls
const originalConsole = { ...console };
beforeEach(() => {
  console.log = jest.fn();
  console.debug = jest.fn();
  console.info = jest.fn();
  console.warn = jest.fn();
  console.error = jest.fn();
});

afterEach(() => {
  // Restore console methods
  console.log = originalConsole.log;
  console.debug = originalConsole.debug;
  console.info = originalConsole.info;
  console.warn = originalConsole.warn;
  console.error = originalConsole.error;
});

// Import or recreate the module for testing
const loggerModule = `
  export const LOG_LEVELS = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3,
    NONE: 4
  };
  
  // Default configuration
  const DEFAULT_CONFIG = {
    consoleLevel: LOG_LEVELS.DEBUG,
    storageLevel: LOG_LEVELS.WARN,
    maxLogEntries: 100,
    enableDiagnostics: false
  };
  
  export const logManager = {
    config: {...DEFAULT_CONFIG},
    
    // Initialize logger with custom configuration
    initialize: async function(customConfig = {}) {
      this.config = { ...DEFAULT_CONFIG, ...customConfig };
      
      // Load configuration from storage if available
      return new Promise((resolve) => {
        chrome.storage.local.get(['logConfig'], (result) => {
          if (result.logConfig) {
            this.config = { ...this.config, ...result.logConfig };
          }
          resolve(this.config);
        });
      });
    },
    
    // Save configuration to storage
    saveConfig: async function() {
      return new Promise((resolve) => {
        chrome.storage.local.set({ 'logConfig': this.config }, () => {
          resolve(this.config);
        });
      });
    },
    
    // Set console log level
    setConsoleLevel: function(level) {
      this.config.consoleLevel = level;
      this.saveConfig();
    },
    
    // Set storage log level
    setStorageLevel: function(level) {
      this.config.storageLevel = level;
      this.saveConfig();
    },
    
    // Toggle diagnostics mode
    toggleDiagnostics: function(enable) {
      this.config.enableDiagnostics = enable;
      this.saveConfig();
      return this.config.enableDiagnostics;
    },
    
    // Format message with timestamp and optional context
    formatMessage: function(message, ...args) {
      const timestamp = new Date().toISOString();
      let formattedMessage = \`[\${timestamp}] \${message}\`;
      
      // Add context if provided
      if (args && args.length > 0) {
        // For objects and arrays, stringify them for better logging
        const formattedArgs = args.map(arg => {
          if (typeof arg === 'object' && arg !== null) {
            try {
              return JSON.stringify(arg);
            } catch (e) {
              return arg.toString();
            }
          }
          return arg;
        });
        
        formattedMessage += ": " + formattedArgs.join(", ");
      }
      
      return formattedMessage;
    },
    
    // Store log entry in storage
    storeLogEntry: function(level, formattedMessage) {
      if (level >= this.config.storageLevel) {
        chrome.storage.local.get(['logEntries'], (result) => {
          const entries = result.logEntries || [];
          
          // Add new entry
          entries.push({
            timestamp: new Date().toISOString(),
            level,
            message: formattedMessage
          });
          
          // Trim to max size
          while (entries.length > this.config.maxLogEntries) {
            entries.shift();
          }
          
          chrome.storage.local.set({ 'logEntries': entries });
        });
      }
    },
    
    // Debug level log
    debug: function(message, ...args) {
      const formattedMessage = this.formatMessage(message, ...args);
      
      if (this.config.consoleLevel <= LOG_LEVELS.DEBUG) {
        console.debug(formattedMessage);
      }
      
      this.storeLogEntry(LOG_LEVELS.DEBUG, formattedMessage);
    },
    
    // Info level log
    log: function(message, ...args) {
      const formattedMessage = this.formatMessage(message, ...args);
      
      if (this.config.consoleLevel <= LOG_LEVELS.INFO) {
        console.log(formattedMessage);
      }
      
      this.storeLogEntry(LOG_LEVELS.INFO, formattedMessage);
    },
    
    // Alias for log
    info: function(message, ...args) {
      this.log(message, ...args);
    },
    
    // Warning level log
    warn: function(message, ...args) {
      const formattedMessage = this.formatMessage(message, ...args);
      
      if (this.config.consoleLevel <= LOG_LEVELS.WARN) {
        console.warn(formattedMessage);
      }
      
      this.storeLogEntry(LOG_LEVELS.WARN, formattedMessage);
    },
    
    // Error level log
    error: function(message, ...args) {
      const formattedMessage = this.formatMessage(message, ...args);
      
      if (this.config.consoleLevel <= LOG_LEVELS.ERROR) {
        console.error(formattedMessage);
      }
      
      this.storeLogEntry(LOG_LEVELS.ERROR, formattedMessage);
    },
    
    // Get all stored log entries
    getLogEntries: async function() {
      return new Promise((resolve) => {
        chrome.storage.local.get(['logEntries'], (result) => {
          resolve(result.logEntries || []);
        });
      });
    },
    
    // Clear all stored log entries
    clearLogs: async function() {
      return new Promise((resolve) => {
        chrome.storage.local.set({ 'logEntries': [] }, () => {
          resolve(true);
        });
      });
    }
  };
`;

// Create module in memory
const moduleURL = 'blob:' + URL.createObjectURL(new Blob([loggerModule], { type: 'application/javascript' }));
let logManager;
let LOG_LEVELS;

describe('Log Manager Module', () => {
  beforeAll(async () => {
    const module = await import(moduleURL);
    logManager = module.logManager;
    LOG_LEVELS = module.LOG_LEVELS;
  });

  beforeEach(() => {
    // Reset the mock storage and logger config before each test
    extension.reset();
    logManager.config = {
      consoleLevel: LOG_LEVELS.DEBUG,
      storageLevel: LOG_LEVELS.WARN,
      maxLogEntries: 100,
      enableDiagnostics: false
    };
    jest.clearAllMocks();
  });

  test('initialize should load configuration from storage', async () => {
    // Arrange
    const storedConfig = {
      consoleLevel: LOG_LEVELS.INFO,
      storageLevel: LOG_LEVELS.ERROR,
      enableDiagnostics: true
    };
    chrome.storage.local.set({ 'logConfig': storedConfig });
    
    // Act
    const config = await logManager.initialize();
    
    // Assert
    expect(config.consoleLevel).toBe(LOG_LEVELS.INFO);
    expect(config.storageLevel).toBe(LOG_LEVELS.ERROR);
    expect(config.enableDiagnostics).toBe(true);
  });

  test('setConsoleLevel should update console logging level', async () => {
    // Act
    logManager.setConsoleLevel(LOG_LEVELS.ERROR);
    
    // Assert
    expect(logManager.config.consoleLevel).toBe(LOG_LEVELS.ERROR);
    // Verify chrome.storage.local.set was called to save config
    expect(chrome.storage.local.set).toHaveBeenCalled();
  });

  test('toggleDiagnostics should enable/disable diagnostics mode', () => {
    // Act
    const result1 = logManager.toggleDiagnostics(true);
    
    // Assert
    expect(result1).toBe(true);
    expect(logManager.config.enableDiagnostics).toBe(true);
    
    // Act again
    const result2 = logManager.toggleDiagnostics(false);
    
    // Assert
    expect(result2).toBe(false);
    expect(logManager.config.enableDiagnostics).toBe(false);
  });

  test('formatMessage should correctly format messages with timestamp', () => {
    // Act
    const formattedMessage = logManager.formatMessage('Test message');
    
    // Assert
    expect(formattedMessage).toMatch(/^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z\] Test message$/);
  });

  test('formatMessage should handle additional arguments', () => {
    // Act
    const formattedMessage = logManager.formatMessage('Test message', 123, { key: 'value' });
    
    // Assert
    expect(formattedMessage).toMatch(/^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z\] Test message: 123, {"key":"value"}$/);
  });

  test('debug level logs should use console.debug', () => {
    // Act
    logManager.debug('Debug message');
    
    // Assert
    expect(console.debug).toHaveBeenCalled();
    expect(console.log).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
  });

  test('log/info level logs should use console.log', () => {
    // Act
    logManager.log('Info message');
    
    // Assert
    expect(console.log).toHaveBeenCalled();
    expect(console.debug).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
  });

  test('warn level logs should use console.warn', () => {
    // Act
    logManager.warn('Warning message');
    
    // Assert
    expect(console.warn).toHaveBeenCalled();
    expect(console.debug).not.toHaveBeenCalled();
    expect(console.log).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
  });

  test('error level logs should use console.error', () => {
    // Act
    logManager.error('Error message');
    
    // Assert
    expect(console.error).toHaveBeenCalled();
    expect(console.debug).not.toHaveBeenCalled();
    expect(console.log).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
  });

  test('logs should respect console level settings', () => {
    // Arrange
    logManager.setConsoleLevel(LOG_LEVELS.ERROR);
    
    // Act
    logManager.debug('Debug message');
    logManager.log('Info message');
    logManager.warn('Warning message');
    logManager.error('Error message');
    
    // Assert - only error should be logged to console
    expect(console.debug).not.toHaveBeenCalled();
    expect(console.log).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalled();
  });

  test('storeLogEntry should only store logs at or above the storage level', async () => {
    // Arrange
    logManager.config.storageLevel = LOG_LEVELS.WARN;
    
    // Act
    logManager.debug('Debug message');
    logManager.info('Info message');
    logManager.warn('Warning message');
    logManager.error('Error message');
    
    // Allow async storage operations to complete
    await new Promise(resolve => setTimeout(resolve, 0));
    
    // Assert - get stored entries and check
    const entries = await logManager.getLogEntries();
    expect(entries.length).toBe(2); // Only WARN and ERROR should be stored
    expect(entries[0].level).toBe(LOG_LEVELS.WARN);
    expect(entries[1].level).toBe(LOG_LEVELS.ERROR);
  });

  test('clearLogs should remove all stored log entries', async () => {
    // Arrange
    logManager.error('Test error 1');
    logManager.error('Test error 2');
    
    // Allow async storage operations to complete
    await new Promise(resolve => setTimeout(resolve, 0));
    
    // Act
    await logManager.clearLogs();
    
    // Assert
    const entries = await logManager.getLogEntries();
    expect(entries.length).toBe(0);
  });
});
