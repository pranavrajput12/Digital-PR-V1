/**
 * Base Module Class
 * Provides consistent API patterns and common functionality for all extension modules
 * Part of Phase 3 Architecture Improvements
 */

// Initialize logger reference
let logManager = null;
if (typeof window !== 'undefined' && window.logManager) {
  logManager = window.logManager;
}

/**
 * Base Module Class
 * All extension modules should extend this class for consistency
 */
class BaseModule {
  constructor(moduleName, options = {}) {
    this.moduleName = moduleName;
    this.initialized = false;
    this.initializing = false;
    this.initializationPromise = null;
    
    // Module configuration
    this.config = {
      enableLogging: true,
      logLevel: 'info', // debug, info, warn, error
      enableMetrics: true,
      enableErrorRecovery: true,
      initializationTimeout: 30000, // 30 seconds
      ...options
    };

    // Module state tracking
    this.state = {
      status: 'created', // created, initializing, ready, error, destroyed
      lastActivity: Date.now(),
      errorCount: 0,
      lastError: null,
      startTime: Date.now(),
      version: '1.0.0'
    };

    // Metrics collection
    this.metrics = {
      initializationTime: 0,
      operationCount: 0,
      errorCount: 0,
      lastOperationTime: 0,
      performanceData: []
    };

    // Event system
    this.eventListeners = new Map();
    
    // Error recovery system
    this.errorRecovery = {
      maxRetries: 3,
      retryDelay: 1000,
      backoffMultiplier: 2,
      currentRetries: 0
    };

    // Bind methods
    this.log = this.log.bind(this);
    this.emit = this.emit.bind(this);
    this.on = this.on.bind(this);
    this.off = this.off.bind(this);

    this.log('debug', `${this.moduleName} module created`);
  }

  /**
   * Initialize the module (to be overridden by subclasses)
   * @param {Object} options - Initialization options
   * @returns {Promise<boolean>} - Whether initialization was successful
   */
  async initialize(options = {}) {
    // Prevent concurrent initialization
    if (this.initialized) {
      return true;
    }

    if (this.initializing) {
      return this.initializationPromise;
    }

    this.initializing = true;
    this.state.status = 'initializing';
    const startTime = Date.now();

    this.initializationPromise = this._doInitialize(options);

    try {
      const result = await Promise.race([
        this.initializationPromise,
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Initialization timeout')), this.config.initializationTimeout)
        )
      ]);

      this.metrics.initializationTime = Date.now() - startTime;
      this.initialized = result;
      this.initializing = false;
      this.state.status = this.initialized ? 'ready' : 'error';

      if (this.initialized) {
        this.log('info', `${this.moduleName} module initialized successfully (${this.metrics.initializationTime}ms)`);
        this.emit('initialized', { module: this.moduleName, time: this.metrics.initializationTime });
      } else {
        this.log('error', `${this.moduleName} module initialization failed`);
        this.emit('initializationFailed', { module: this.moduleName });
      }

      return this.initialized;
    } catch (error) {
      this.initializing = false;
      this.state.status = 'error';
      this.state.lastError = error;
      this.state.errorCount++;
      this.metrics.errorCount++;

      this.log('error', `${this.moduleName} module initialization error:`, error);
      this.emit('error', { module: this.moduleName, error, phase: 'initialization' });

      if (this.config.enableErrorRecovery) {
        return this._attemptRecovery('initialization', options);
      }

      return false;
    } finally {
      this.initializationPromise = null;
    }
  }

  /**
   * Internal initialization method (to be overridden by subclasses)
   * @param {Object} options - Initialization options
   * @returns {Promise<boolean>} - Whether initialization was successful
   * @protected
   */
  async _doInitialize(options) {
    // Default implementation - override in subclasses
    this.log('debug', `${this.moduleName} default initialization`);
    return true;
  }

  /**
   * Check if the module is initialized and ready for use
   * @returns {boolean} - Whether the module is ready
   */
  isReady() {
    return this.initialized && this.state.status === 'ready';
  }

  /**
   * Get module status information
   * @returns {Object} - Module status and metrics
   */
  getStatus() {
    return {
      name: this.moduleName,
      initialized: this.initialized,
      state: { ...this.state },
      metrics: { ...this.metrics },
      uptime: Date.now() - this.state.startTime,
      config: { ...this.config }
    };
  }

  /**
   * Execute an operation with error handling and metrics
   * @param {string} operationName - Name of the operation
   * @param {Function} operation - Operation function to execute
   * @param {Object} options - Operation options
   * @returns {Promise<any>} - Operation result
   */
  async executeOperation(operationName, operation, options = {}) {
    if (!this.isReady() && !options.allowUninitialized) {
      throw new Error(`${this.moduleName} module not ready for operation: ${operationName}`);
    }

    const startTime = Date.now();
    this.state.lastActivity = startTime;
    this.metrics.operationCount++;

    try {
      this.log('debug', `${this.moduleName} executing operation: ${operationName}`);
      
      const result = await operation();
      
      const duration = Date.now() - startTime;
      this.metrics.lastOperationTime = duration;
      
      // Store performance data (keep last 100 operations)
      this.metrics.performanceData.push({
        operation: operationName,
        duration,
        timestamp: startTime,
        success: true
      });
      
      if (this.metrics.performanceData.length > 100) {
        this.metrics.performanceData.shift();
      }

      this.log('debug', `${this.moduleName} operation ${operationName} completed (${duration}ms)`);
      this.emit('operationCompleted', { 
        module: this.moduleName, 
        operation: operationName, 
        duration,
        success: true 
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.state.errorCount++;
      this.state.lastError = error;
      this.metrics.errorCount++;

      // Store error performance data
      this.metrics.performanceData.push({
        operation: operationName,
        duration,
        timestamp: startTime,
        success: false,
        error: error.message
      });

      if (this.metrics.performanceData.length > 100) {
        this.metrics.performanceData.shift();
      }

      this.log('error', `${this.moduleName} operation ${operationName} failed:`, error);
      this.emit('operationFailed', { 
        module: this.moduleName, 
        operation: operationName, 
        duration,
        error,
        success: false 
      });

      if (this.config.enableErrorRecovery && options.enableRecovery !== false) {
        return this._attemptRecovery(operationName, { operation, options });
      }

      throw error;
    }
  }

  /**
   * Logging method with consistent formatting
   * @param {string} level - Log level (debug, info, warn, error)
   * @param {string} message - Log message
   * @param {any} data - Additional data to log
   */
  log(level, message, data) {
    if (!this.config.enableLogging) return;

    const logLevels = { debug: 0, info: 1, warn: 2, error: 3 };
    const currentLevel = logLevels[this.config.logLevel] || 1;
    const messageLevel = logLevels[level] || 1;

    if (messageLevel < currentLevel) return;

    const timestamp = new Date().toISOString();
    const formattedMessage = `[${timestamp}] [${this.moduleName}] ${message}`;

    if (logManager && typeof logManager[level] === 'function') {
      logManager[level](formattedMessage, data);
    } else {
      const consoleMethod = console[level] || console.log;
      if (data !== undefined) {
        consoleMethod(formattedMessage, data);
      } else {
        consoleMethod(formattedMessage);
      }
    }
  }

  /**
   * Event emitter - emit an event
   * @param {string} eventName - Event name
   * @param {any} data - Event data
   */
  emit(eventName, data) {
    const listeners = this.eventListeners.get(eventName) || [];
    listeners.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        this.log('error', `Error in event listener for ${eventName}:`, error);
      }
    });
  }

  /**
   * Event emitter - add event listener
   * @param {string} eventName - Event name
   * @param {Function} callback - Event callback
   */
  on(eventName, callback) {
    if (!this.eventListeners.has(eventName)) {
      this.eventListeners.set(eventName, []);
    }
    this.eventListeners.get(eventName).push(callback);
  }

  /**
   * Event emitter - remove event listener
   * @param {string} eventName - Event name
   * @param {Function} callback - Event callback to remove
   */
  off(eventName, callback) {
    const listeners = this.eventListeners.get(eventName) || [];
    const index = listeners.indexOf(callback);
    if (index !== -1) {
      listeners.splice(index, 1);
    }
  }

  /**
   * Reset module metrics
   */
  resetMetrics() {
    this.metrics = {
      initializationTime: 0,
      operationCount: 0,
      errorCount: 0,
      lastOperationTime: 0,
      performanceData: []
    };
    this.state.errorCount = 0;
    this.state.lastError = null;
    this.log('info', `${this.moduleName} metrics reset`);
  }

  /**
   * Attempt error recovery
   * @param {string} context - Context where error occurred
   * @param {any} retryData - Data needed for retry
   * @returns {Promise<any>} - Recovery result
   * @private
   */
  async _attemptRecovery(context, retryData) {
    if (this.errorRecovery.currentRetries >= this.errorRecovery.maxRetries) {
      this.log('error', `${this.moduleName} maximum retry attempts reached for ${context}`);
      this.errorRecovery.currentRetries = 0;
      return false;
    }

    this.errorRecovery.currentRetries++;
    const delay = this.errorRecovery.retryDelay * 
      Math.pow(this.errorRecovery.backoffMultiplier, this.errorRecovery.currentRetries - 1);

    this.log('warn', `${this.moduleName} attempting recovery for ${context} (attempt ${this.errorRecovery.currentRetries}/${this.errorRecovery.maxRetries})`);

    await new Promise(resolve => setTimeout(resolve, delay));

    try {
      if (context === 'initialization') {
        return await this._doInitialize(retryData);
      } else if (retryData && retryData.operation) {
        return await retryData.operation();
      }
      return false;
    } catch (error) {
      this.log('warn', `${this.moduleName} recovery attempt ${this.errorRecovery.currentRetries} failed:`, error);
      return this._attemptRecovery(context, retryData);
    }
  }

  /**
   * Destroy the module and clean up resources
   */
  destroy() {
    this.log('info', `${this.moduleName} module destroying`);
    
    this.state.status = 'destroyed';
    this.initialized = false;
    this.initializing = false;
    this.initializationPromise = null;
    
    // Clear event listeners
    this.eventListeners.clear();
    
    // Override in subclasses for specific cleanup
    this._doDestroy();
    
    this.emit('destroyed', { module: this.moduleName });
    this.log('info', `${this.moduleName} module destroyed`);
  }

  /**
   * Internal destroy method (to be overridden by subclasses)
   * @protected
   */
  _doDestroy() {
    // Override in subclasses for specific cleanup
  }

  /**
   * Validate configuration object
   * @param {Object} config - Configuration to validate
   * @param {Object} schema - Validation schema
   * @returns {boolean} - Whether configuration is valid
   * @protected
   */
  _validateConfig(config, schema) {
    for (const [key, rules] of Object.entries(schema)) {
      const value = config[key];
      
      if (rules.required && (value === undefined || value === null)) {
        throw new Error(`${this.moduleName}: Required configuration key '${key}' is missing`);
      }
      
      if (value !== undefined && rules.type && typeof value !== rules.type) {
        throw new Error(`${this.moduleName}: Configuration key '${key}' must be of type ${rules.type}`);
      }
      
      if (rules.validate && typeof rules.validate === 'function' && !rules.validate(value)) {
        throw new Error(`${this.moduleName}: Configuration key '${key}' failed validation`);
      }
    }
    
    return true;
  }

  /**
   * Get performance report
   * @returns {Object} - Performance analysis
   */
  getPerformanceReport() {
    const successfulOps = this.metrics.performanceData.filter(op => op.success);
    const failedOps = this.metrics.performanceData.filter(op => !op.success);
    
    const avgDuration = successfulOps.length > 0 
      ? successfulOps.reduce((sum, op) => sum + op.duration, 0) / successfulOps.length 
      : 0;
    
    const operationTypes = {};
    this.metrics.performanceData.forEach(op => {
      if (!operationTypes[op.operation]) {
        operationTypes[op.operation] = { count: 0, totalDuration: 0, errors: 0 };
      }
      operationTypes[op.operation].count++;
      operationTypes[op.operation].totalDuration += op.duration;
      if (!op.success) {
        operationTypes[op.operation].errors++;
      }
    });

    return {
      module: this.moduleName,
      totalOperations: this.metrics.operationCount,
      successRate: this.metrics.operationCount > 0 
        ? ((this.metrics.operationCount - this.metrics.errorCount) / this.metrics.operationCount * 100).toFixed(2) + '%'
        : '100%',
      averageDuration: Math.round(avgDuration),
      totalErrors: this.metrics.errorCount,
      recentOperations: this.metrics.performanceData.length,
      operationBreakdown: Object.entries(operationTypes).map(([op, stats]) => ({
        operation: op,
        count: stats.count,
        avgDuration: Math.round(stats.totalDuration / stats.count),
        errorRate: stats.count > 0 ? (stats.errors / stats.count * 100).toFixed(2) + '%' : '0%'
      }))
    };
  }
}

// Export for module usage
export { BaseModule };
export default BaseModule;