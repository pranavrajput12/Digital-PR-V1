/**
 * Scrapers Registry
 * 
 * This module provides a central registry for all platform scrapers.
 * It handles registration, source configuration, and unified access to
 * opportunities from multiple sources.
 */

// Use window globals instead of ES module imports for CSP compliance
// Access logManager directly from window object without redeclaring
// Use destructuring for storage utils while providing fallbacks

/**
 * The scrapers registry manages all platform scrapers
 */
class ScrapersRegistry {
  constructor() {
    this.scrapers = new Map();
    this.sources = new Map();
    this.initialized = false;
    
    // Configure default source styles
    this.sourceStyles = {
      'SourceBottle': {
        color: '#4b6cb7',
        icon: '📢',
        priority: 10
      },
      'Featured': {
        color: '#ff9800',
        icon: '🔍',
        priority: 20
      },
      'Qwoted': {
        color: '#009688',
        icon: '💬',
        priority: 30
      }
    };
    
    // Bind methods
    this.register = this.register.bind(this);
    this.registerSource = this.registerSource.bind(this);
    this.getScraper = this.getScraper.bind(this);
    this.getAllOpportunities = this.getAllOpportunities.bind(this);
    this.getSourceConfig = this.getSourceConfig.bind(this);
    this.initialize = this.initialize.bind(this);
  }
  
  /**
   * Initialize the scrapers registry
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this.initialized) {
      return;
    }
    
    try {
      window.logManager.log('Initializing scrapers registry');
      
      // Load any saved source configurations
      await this._loadSourceConfigurations();
      
      this.initialized = true;
      window.logManager.log('Scrapers registry initialized successfully');
    } catch (error) {
      window.logManager.error('Error initializing scrapers registry:', error);
    }
  }
  
  /**
   * Register a scraper for a platform
   * @param {string} name - Platform name
   * @param {Object} scraper - The scraper instance
   * @returns {boolean} - Success status
   */
  register(name, scraper) {
    try {
      if (!name || !scraper) {
        window.logManager.error('Invalid scraper registration attempt');
        return false;
      }
      
      // Normalize name to lowercase for internal use
      const normalizedName = name.toLowerCase();
      
      // Store the scraper in the registry
      this.scrapers.set(normalizedName, scraper);
      
      // If we don't have a source configuration for this platform yet,
      // register it with default values
      if (!this.sources.has(name)) {
        const defaultConfig = this.sourceStyles[name] || {
          color: '#4361ee',
          icon: '📋',
          priority: 100
        };
        
        this.registerSource(name, defaultConfig);
      }
      
      window.logManager.log(`Registered scraper for platform: ${name}`);
      return true;
    } catch (error) {
      window.logManager.error(`Error registering scraper for platform ${name}:`, error);
      return false;
    }
  }
  
  /**
   * Register a source with specific configuration
   * @param {string} name - Source name
   * @param {Object} config - Source configuration (color, icon, priority)
   * @returns {boolean} - Success status
   */
  registerSource(name, config = {}) {
    try {
      if (!name) {
        window.logManager.error('Invalid source registration attempt');
        return false;
      }
      
      // Store the source configuration
      this.sources.set(name, {
        color: config.color || '#4361ee',
        icon: config.icon || '📋',
        priority: config.priority || 100,
        enabled: config.enabled !== false
      });
      
      // Save source configurations
      this._saveSourceConfigurations();
      
      window.logManager.log(`Registered source: ${name}`);
      return true;
    } catch (error) {
      window.logManager.error(`Error registering source ${name}:`, error);
      return false;
    }
  }
  
  /**
   * Get a specific scraper by name
   * @param {string} name - Platform name
   * @returns {Object|null} - The scraper instance or null if not found
   */
  getScraper(name) {
    const normalizedName = name.toLowerCase();
    return this.scrapers.get(normalizedName) || null;
  }
  
  /**
   * Get configuration for a specific source
   * @param {string} name - Source name
   * @returns {Object|null} - Source configuration or null if not found
   */
  getSourceConfig(name) {
    return this.sources.get(name) || null;
  }
  
  /**
   * Get all registered sources
   * @returns {Array} - Array of source names
   */
  getAllSources() {
    return Array.from(this.sources.keys());
  }
  
  /**
   * Get configurations for all sources
   * @returns {Object} - Map of source names to configurations
   */
  getAllSourceConfigs() {
    return Object.fromEntries(this.sources);
  }
  
  /**
   * Get opportunities from all sources
   * @returns {Promise<Array>} - Combined array of all opportunities
   */
  async getAllOpportunities() {
    await this.initialize();
    return window.storageUtils.mergeAllOpportunities();
  }
  
  /**
   * Sync opportunities from all sources
   * @returns {Promise<Array>} - Combined array of all opportunities
   */
  async syncAllOpportunities() {
    await this.initialize();
    return window.storageUtils.syncAllOpportunities();
  }
  
  /**
   * Save source configurations to storage
   * @private
   * @returns {Promise<void>}
   */
  async _saveSourceConfigurations() {
    try {
      const configs = Object.fromEntries(this.sources);
      await chrome.storage.local.set({ 'scraper_source_configs': configs });
    } catch (error) {
      window.logManager.error('Error saving source configurations:', error);
    }
  }
  
  /**
   * Load source configurations from storage
   * @private
   * @returns {Promise<void>}
   */
  async _loadSourceConfigurations() {
    try {
      const result = await chrome.storage.local.get('scraper_source_configs');
      if (result.scraper_source_configs) {
        // Clear existing sources
        this.sources.clear();
        
        // Load saved sources
        for (const [name, config] of Object.entries(result.scraper_source_configs)) {
          this.sources.set(name, config);
        }
        
        window.logManager.log('Loaded source configurations from storage');
      }
    } catch (error) {
      window.logManager.error('Error loading source configurations:', error);
    }
  }
}

// Create the scrapers registry and expose it to the window object
const scrapersRegistry = new ScrapersRegistry();

// Expose to window global object for Manifest V3 CSP compatibility - with explicit debugging
try {
  console.log('💬 [SCRAPERS DEBUG] About to set window.scrapers');
  
  // Set the registry to window
  window.scrapers = scrapersRegistry;
  
  // Flag to indicate registry is available
  window.scrapersRegistryLoaded = true;
  
  console.log('💬 [SCRAPERS DEBUG] window.scrapers has been set:', !!window.scrapers);
  console.log('💬 [SCRAPERS DEBUG] scrapers type:', typeof window.scrapers);
  
  // Dispatch events so other scripts know scrapers is ready
  document.dispatchEvent(new CustomEvent('scrapers-registry-loaded', {
    detail: { success: true, timestamp: Date.now() }
  }));
  
  // Also dispatch the original event for backward compatibility
  document.dispatchEvent(new CustomEvent('scrapers-registry-ready', {
    detail: { success: true } 
  }));
  
  // Define a getter to help with debugging
  Object.defineProperty(window, 'scrapersInfo', {
    get: function() {
      return {
        exists: !!window.scrapers,
        type: typeof window.scrapers,
        hasRegister: window.scrapers && typeof window.scrapers.register === 'function'
      };
    }
  });
} catch (error) {
  console.error('💬 [SCRAPERS ERROR] Failed to expose scrapers to window:', error);
}

// Add a debug flag to indicate successful loading
window.scrapersRegistryLoaded = true;

// Log initialization without depending on logManager
console.log('Scrapers registry initialized');

// Delay initialization to ensure logManager is available
setTimeout(() => {
  // Only initialize if logManager is available
  if (window.logManager && typeof window.logManager.log === 'function') {
    scrapersRegistry.initialize().catch(error => {
      console.error('Failed to initialize scrapers registry:', error);
      if (window.logManager && typeof window.logManager.error === 'function') {
        window.logManager.error('Failed to initialize scrapers registry:', error);
      }
    });
  } else {
    console.log('Deferring scrapers registry initialization until logManager is available');
  }
}, 500); // Longer delay to ensure dependencies are loaded

// Export removed for Manifest V3 CSP compliance - using window.scrapers instead