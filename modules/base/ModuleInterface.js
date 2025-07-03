/**
 * Module Interface Definition
 * Defines the standard interface that all extension modules should implement
 * Part of Phase 3 Architecture Improvements
 */

/**
 * Standard Module Interface
 * All modules should implement these methods for consistency
 */
class ModuleInterface {
  /**
   * Initialize the module with given options
   * @param {Object} options - Initialization options
   * @returns {Promise<boolean>} - Whether initialization was successful
   */
  async initialize(options = {}) {
    throw new Error('initialize() method must be implemented by module');
  }

  /**
   * Check if the module is ready for operations
   * @returns {boolean} - Whether the module is ready
   */
  isReady() {
    throw new Error('isReady() method must be implemented by module');
  }

  /**
   * Get module status and health information
   * @returns {Object} - Module status object
   */
  getStatus() {
    throw new Error('getStatus() method must be implemented by module');
  }

  /**
   * Get module configuration
   * @returns {Object} - Current module configuration
   */
  getConfig() {
    throw new Error('getConfig() method must be implemented by module');
  }

  /**
   * Update module configuration
   * @param {Object} newConfig - New configuration options
   * @returns {Promise<boolean>} - Whether configuration update was successful
   */
  async updateConfig(newConfig) {
    throw new Error('updateConfig() method must be implemented by module');
  }

  /**
   * Reset module to initial state
   * @returns {Promise<boolean>} - Whether reset was successful
   */
  async reset() {
    throw new Error('reset() method must be implemented by module');
  }

  /**
   * Destroy module and clean up resources
   * @returns {Promise<void>}
   */
  async destroy() {
    throw new Error('destroy() method must be implemented by module');
  }

  /**
   * Get module metrics and performance data
   * @returns {Object} - Module metrics
   */
  getMetrics() {
    throw new Error('getMetrics() method must be implemented by module');
  }

  /**
   * Handle errors gracefully
   * @param {Error} error - Error that occurred
   * @param {string} context - Context where error occurred
   * @returns {boolean} - Whether error was handled successfully
   */
  handleError(error, context) {
    throw new Error('handleError() method must be implemented by module');
  }
}

/**
 * Service Module Interface
 * For modules that provide services to other modules
 */
class ServiceModuleInterface extends ModuleInterface {
  /**
   * Start the service
   * @returns {Promise<boolean>} - Whether service started successfully
   */
  async start() {
    throw new Error('start() method must be implemented by service module');
  }

  /**
   * Stop the service
   * @returns {Promise<boolean>} - Whether service stopped successfully
   */
  async stop() {
    throw new Error('stop() method must be implemented by service module');
  }

  /**
   * Restart the service
   * @returns {Promise<boolean>} - Whether service restarted successfully
   */
  async restart() {
    return await this.stop() && await this.start();
  }

  /**
   * Check if service is running
   * @returns {boolean} - Whether service is running
   */
  isRunning() {
    throw new Error('isRunning() method must be implemented by service module');
  }

  /**
   * Get service health status
   * @returns {Object} - Service health information
   */
  getHealth() {
    throw new Error('getHealth() method must be implemented by service module');
  }
}

/**
 * Cache Module Interface
 * For modules that provide caching functionality
 */
class CacheModuleInterface extends ModuleInterface {
  /**
   * Get item from cache
   * @param {string} key - Cache key
   * @returns {Promise<any>} - Cached value or null
   */
  async get(key) {
    throw new Error('get() method must be implemented by cache module');
  }

  /**
   * Set item in cache
   * @param {string} key - Cache key
   * @param {any} value - Value to cache
   * @param {number} ttl - Time to live in milliseconds
   * @returns {Promise<boolean>} - Whether set was successful
   */
  async set(key, value, ttl) {
    throw new Error('set() method must be implemented by cache module');
  }

  /**
   * Delete item from cache
   * @param {string} key - Cache key
   * @returns {Promise<boolean>} - Whether delete was successful
   */
  async delete(key) {
    throw new Error('delete() method must be implemented by cache module');
  }

  /**
   * Clear all items from cache
   * @returns {Promise<boolean>} - Whether clear was successful
   */
  async clear() {
    throw new Error('clear() method must be implemented by cache module');
  }

  /**
   * Get cache size information
   * @returns {Object} - Cache size data (count, memory usage, etc.)
   */
  getCacheSize() {
    throw new Error('getCacheSize() method must be implemented by cache module');
  }

  /**
   * Cleanup expired items
   * @returns {Promise<number>} - Number of items cleaned up
   */
  async cleanup() {
    throw new Error('cleanup() method must be implemented by cache module');
  }
}

/**
 * Storage Module Interface
 * For modules that handle data persistence
 */
class StorageModuleInterface extends ModuleInterface {
  /**
   * Save data to storage
   * @param {string} key - Storage key
   * @param {any} data - Data to save
   * @returns {Promise<boolean>} - Whether save was successful
   */
  async save(key, data) {
    throw new Error('save() method must be implemented by storage module');
  }

  /**
   * Load data from storage
   * @param {string} key - Storage key
   * @returns {Promise<any>} - Loaded data or null
   */
  async load(key) {
    throw new Error('load() method must be implemented by storage module');
  }

  /**
   * Remove data from storage
   * @param {string} key - Storage key
   * @returns {Promise<boolean>} - Whether removal was successful
   */
  async remove(key) {
    throw new Error('remove() method must be implemented by storage module');
  }

  /**
   * List all keys in storage
   * @returns {Promise<string[]>} - Array of storage keys
   */
  async listKeys() {
    throw new Error('listKeys() method must be implemented by storage module');
  }

  /**
   * Get storage usage information
   * @returns {Promise<Object>} - Storage usage data
   */
  async getUsage() {
    throw new Error('getUsage() method must be implemented by storage module');
  }

  /**
   * Backup storage data
   * @returns {Promise<Object>} - Backup data
   */
  async backup() {
    throw new Error('backup() method must be implemented by storage module');
  }

  /**
   * Restore storage data from backup
   * @param {Object} backupData - Backup data to restore
   * @returns {Promise<boolean>} - Whether restore was successful
   */
  async restore(backupData) {
    throw new Error('restore() method must be implemented by storage module');
  }
}

/**
 * AI Module Interface
 * For modules that provide AI functionality
 */
class AIModuleInterface extends ServiceModuleInterface {
  /**
   * Analyze data with AI
   * @param {any} data - Data to analyze
   * @param {Object} options - Analysis options
   * @returns {Promise<Object>} - Analysis result
   */
  async analyze(data, options = {}) {
    throw new Error('analyze() method must be implemented by AI module');
  }

  /**
   * Process batch of data
   * @param {Array} dataArray - Array of data to process
   * @param {Object} options - Processing options
   * @returns {Promise<Array>} - Array of results
   */
  async processBatch(dataArray, options = {}) {
    throw new Error('processBatch() method must be implemented by AI module');
  }

  /**
   * Get AI model information
   * @returns {Object} - Model information
   */
  getModelInfo() {
    throw new Error('getModelInfo() method must be implemented by AI module');
  }

  /**
   * Update AI model configuration
   * @param {Object} modelConfig - New model configuration
   * @returns {Promise<boolean>} - Whether update was successful
   */
  async updateModelConfig(modelConfig) {
    throw new Error('updateModelConfig() method must be implemented by AI module');
  }
}

/**
 * Scraper Module Interface
 * For modules that scrape data from websites
 */
class ScraperModuleInterface extends ServiceModuleInterface {
  /**
   * Scrape data from a URL or page
   * @param {string|Object} target - URL or page object to scrape
   * @param {Object} options - Scraping options
   * @returns {Promise<Object>} - Scraped data
   */
  async scrape(target, options = {}) {
    throw new Error('scrape() method must be implemented by scraper module');
  }

  /**
   * Validate scraping target
   * @param {string|Object} target - Target to validate
   * @returns {boolean} - Whether target is valid
   */
  validateTarget(target) {
    throw new Error('validateTarget() method must be implemented by scraper module');
  }

  /**
   * Get supported platforms/websites
   * @returns {string[]} - Array of supported platforms
   */
  getSupportedPlatforms() {
    throw new Error('getSupportedPlatforms() method must be implemented by scraper module');
  }

  /**
   * Set scraping rate limits
   * @param {Object} limits - Rate limit configuration
   * @returns {boolean} - Whether limits were set successfully
   */
  setRateLimits(limits) {
    throw new Error('setRateLimits() method must be implemented by scraper module');
  }
}

/**
 * Integration Module Interface
 * For modules that integrate with external services
 */
class IntegrationModuleInterface extends ServiceModuleInterface {
  /**
   * Connect to external service
   * @param {Object} credentials - Service credentials
   * @returns {Promise<boolean>} - Whether connection was successful
   */
  async connect(credentials) {
    throw new Error('connect() method must be implemented by integration module');
  }

  /**
   * Disconnect from external service
   * @returns {Promise<boolean>} - Whether disconnection was successful
   */
  async disconnect() {
    throw new Error('disconnect() method must be implemented by integration module');
  }

  /**
   * Check connection status
   * @returns {boolean} - Whether connected to service
   */
  isConnected() {
    throw new Error('isConnected() method must be implemented by integration module');
  }

  /**
   * Send data to external service
   * @param {any} data - Data to send
   * @param {Object} options - Send options
   * @returns {Promise<Object>} - Send result
   */
  async send(data, options = {}) {
    throw new Error('send() method must be implemented by integration module');
  }

  /**
   * Receive data from external service
   * @param {Object} options - Receive options
   * @returns {Promise<any>} - Received data
   */
  async receive(options = {}) {
    throw new Error('receive() method must be implemented by integration module');
  }

  /**
   * Test connection to external service
   * @returns {Promise<Object>} - Test result
   */
  async testConnection() {
    throw new Error('testConnection() method must be implemented by integration module');
  }
}

/**
 * Module Factory
 * Utility to validate that modules implement required interfaces
 */
class ModuleFactory {
  /**
   * Validate that a module implements the required interface
   * @param {Object} module - Module to validate
   * @param {Class} interfaceClass - Interface class to validate against
   * @returns {boolean} - Whether module implements interface
   */
  static validateInterface(module, interfaceClass) {
    const interfacePrototype = interfaceClass.prototype;
    const modulePrototype = Object.getPrototypeOf(module);

    for (const methodName of Object.getOwnPropertyNames(interfacePrototype)) {
      if (methodName === 'constructor') continue;
      
      if (typeof interfacePrototype[methodName] === 'function') {
        if (typeof module[methodName] !== 'function') {
          throw new Error(`Module ${module.constructor.name} missing required method: ${methodName}`);
        }
      }
    }

    return true;
  }

  /**
   * Create a module with interface validation
   * @param {Class} ModuleClass - Module class to instantiate
   * @param {Class} InterfaceClass - Interface class to validate against
   * @param {...any} args - Arguments for module constructor
   * @returns {Object} - Validated module instance
   */
  static createModule(ModuleClass, InterfaceClass, ...args) {
    const module = new ModuleClass(...args);
    this.validateInterface(module, InterfaceClass);
    return module;
  }
}

// Export interfaces and factory
export {
  ModuleInterface,
  ServiceModuleInterface,
  CacheModuleInterface,
  StorageModuleInterface,
  AIModuleInterface,
  ScraperModuleInterface,
  IntegrationModuleInterface,
  ModuleFactory
};

export default {
  ModuleInterface,
  ServiceModuleInterface,
  CacheModuleInterface,
  StorageModuleInterface,
  AIModuleInterface,
  ScraperModuleInterface,
  IntegrationModuleInterface,
  ModuleFactory
};