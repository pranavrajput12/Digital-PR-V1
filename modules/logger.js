/**
 * LogManager - Centralized logging system with configurable levels
 * Supports error tracking and performance monitoring
 */
class LogManager {
  /**
   * Initialize the log manager
   */
  constructor() {
    this.LOG_LEVELS = {
      DEBUG: 0,
      INFO: 1,
      WARN: 2,
      ERROR: 3,
      NONE: 4
    };
    
    // Default to INFO level in production, DEBUG in development
    this.currentLevel = this.LOG_LEVELS.INFO;
    
    // Check if we should enable debug mode
    chrome.storage.local.get(['settings'], (result) => {
      if (result.settings && result.settings.debugMode) {
        this.currentLevel = this.LOG_LEVELS.DEBUG;
        this.log('Debug logging enabled');
      }
    });
    
    // Store logs for potential export or viewing in extension
    this.recentLogs = [];
    this.MAX_LOGS = 1000; // Limit stored logs to prevent memory issues
  }

  /**
   * Log a debug message
   * @param {string} message - Message to log
   * @param {any} data - Optional data to include
   */
  debug(message, data = null) {
    if (this.currentLevel <= this.LOG_LEVELS.DEBUG) {
      this._addLog('DEBUG', message, data);
      console.debug(`[SourceBottle Debug] ${message}`, data || '');
    }
  }

  /**
   * Log an info message
   * @param {string} message - Message to log
   * @param {any} data - Optional data to include
   */
  log(message, data = null) {
    if (this.currentLevel <= this.LOG_LEVELS.INFO) {
      this._addLog('INFO', message, data);
      console.log(`[SourceBottle] ${message}`, data || '');
    }
  }

  /**
   * Log a warning message
   * @param {string} message - Message to log
   * @param {any} data - Optional data to include
   */
  warn(message, data = null) {
    if (this.currentLevel <= this.LOG_LEVELS.WARN) {
      this._addLog('WARN', message, data);
      console.warn(`[SourceBottle Warning] ${message}`, data || '');
    }
  }

  /**
   * Log an error message
   * @param {string} message - Message to log
   * @param {any} data - Optional data to include
   */
  error(message, data = null) {
    if (this.currentLevel <= this.LOG_LEVELS.ERROR) {
      this._addLog('ERROR', message, data);
      console.error(`[SourceBottle Error] ${message}`, data || '');
      
      // Track error for potential reporting
      this._trackError(message, data);
    }
  }

  /**
   * Add a log entry to the recent logs array
   * @param {string} level - Log level
   * @param {string} message - Log message
   * @param {any} data - Associated data
   * @private
   */
  _addLog(level, message, data) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      data: data ? this._safeStringify(data) : null
    };
    
    this.recentLogs.unshift(logEntry);
    
    // Trim logs if needed
    if (this.recentLogs.length > this.MAX_LOGS) {
      this.recentLogs.pop();
    }
  }

  /**
   * Track an error for potential reporting
   * @param {string} message - Error message
   * @param {any} data - Error data
   * @private
   */
  _trackError(message, data) {
    try {
      const errorData = {
        message,
        data: this._safeStringify(data),
        timestamp: new Date().toISOString(),
        url: window.location?.href,
        userAgent: navigator.userAgent
      };
      
      // Store in local error log
      chrome.storage.local.get(['errorLog'], (result) => {
        const errorLog = result.errorLog || [];
        errorLog.unshift(errorData);
        
        // Keep only the last 50 errors
        if (errorLog.length > 50) {
          errorLog.pop();
        }
        
        chrome.storage.local.set({ errorLog });
      });
    } catch (e) {
      // Don't let error tracking itself cause errors
      console.error('Error in error tracking:', e);
    }
  }

  /**
   * Safely stringify objects for logging
   * @param {any} obj - Object to stringify
   * @returns {string} Stringified object
   * @private
   */
  _safeStringify(obj) {
    if (!obj) return '';
    
    try {
      if (obj instanceof Error) {
        return `${obj.message} (${obj.name}) ${obj.stack || ''}`;
      }
      
      // Handle circular references
      const seen = new WeakSet();
      return JSON.stringify(obj, (key, value) => {
        if (typeof value === 'object' && value !== null) {
          if (seen.has(value)) {
            return '[Circular Reference]';
          }
          seen.add(value);
        }
        return value;
      });
    } catch (e) {
      return `[Unstringifiable Object: ${e.message}]`;
    }
  }

  /**
   * Get recent logs
   * @param {number} count - Number of logs to retrieve 
   * @returns {Array} Recent logs
   */
  getRecentLogs(count = 100) {
    return this.recentLogs.slice(0, Math.min(count, this.recentLogs.length));
  }

  /**
   * Clear all logs
   */
  clearLogs() {
    this.recentLogs = [];
  }

  /**
   * Set the current log level
   * @param {string} level - Log level name
   */
  setLogLevel(level) {
    if (this.LOG_LEVELS[level] !== undefined) {
      this.currentLevel = this.LOG_LEVELS[level];
      this.log(`Log level set to ${level}`);
    } else {
      this.warn(`Invalid log level: ${level}. Using INFO.`);
      this.currentLevel = this.LOG_LEVELS.INFO;
    }
  }

  /**
   * Start measuring performance
   * @param {string} label - Performance marker label
   */
  startPerformanceMeasure(label) {
    if (window.performance && window.performance.mark) {
      window.performance.mark(`${label}_start`);
    }
  }

  /**
   * End measuring performance and log result
   * @param {string} label - Performance marker label
   */
  endPerformanceMeasure(label) {
    if (window.performance && window.performance.mark && window.performance.measure) {
      try {
        window.performance.mark(`${label}_end`);
        window.performance.measure(label, `${label}_start`, `${label}_end`);
        
        const entries = window.performance.getEntriesByName(label);
        if (entries.length > 0) {
          const duration = entries[0].duration.toFixed(2);
          this.log(`Performance [${label}]: ${duration}ms`);
        }
      } catch (e) {
        this.error(`Error measuring performance for ${label}:`, e);
      }
    }
  }
}

// Create as a singleton
const logManagerInstance = new LogManager();

// Expose to window global object for Manifest V3 CSP compatibility
window.logManager = logManagerInstance;

// Log initialization
console.log('[SourceBottle] Logger initialized and exposed to window.logManager');
