/**
 * Platform Manager Module
 * 
 * Handles coordination between different PR opportunity platforms
 * Provides unified interface for the main application to interact with multiple platforms
 */

class PlatformManager {
  constructor() {
    // Platform registry - will be populated with platform implementations
    this.platforms = {};
    
    // Currently active platform
    this.activePlatform = null;
    
    // Default platform ID
    this.defaultPlatformId = 'sourcebottle';
    
    // Platform metadata - display information
    this.platformMeta = {
      'sourcebottle': {
        name: 'SourceBottle',
        icon: '📰',
        color: '#4361ee',
        description: 'Find journalist requests and PR opportunities'
      },
      'qwoted': {
        name: 'Quoted',
        icon: '💬',
        color: '#2ec4b6',
        description: 'Connect with journalists seeking expert quotes'
      },
      'featured': {
        name: 'Featured.com',
        icon: '🌟',
        color: '#ff9f1c',
        description: 'Get featured in articles, podcasts and interviews'
      }
    };
    
    // Event listeners
    this.eventListeners = {};
    
    // Initialize platform registry
    this._initializePlatformRegistry();
  }
  
  /**
   * Initialize the platform registry
   * @private
   */
  async _initializePlatformRegistry() {
    try {
      console.log('Initializing platform registry...');
      
      // Import platform modules
      const sourcebottlePlatform = await import('./sourcebottle/index.js')
        .then(module => module.default)
        .catch(err => {
          console.error('Error loading SourceBottle platform:', err);
          return null;
        });
      
      const featuredPlatform = await import('./featured/index.js')
        .then(module => module.default)
        .catch(err => {
          console.error('Error loading Featured platform:', err);
          return null;
        });
      
      const qwotedPlatform = await import('./qwoted/index.js')
        .then(module => module.default)
        .catch(err => {
          console.error('Error loading Qwoted platform:', err);
          return null;
        });
      
      // Register platforms
      this.platforms = {
        'sourcebottle': sourcebottlePlatform,
        'qwoted': qwotedPlatform,
        'featured': featuredPlatform
      };
      
      console.log('Platform registry initialized with:', Object.keys(this.platforms).filter(key => this.platforms[key]));
      
      // Set active platform to default if available
      if (this.platforms[this.defaultPlatformId]) {
        this.setActivePlatform(this.defaultPlatformId);
      }
      
      // Trigger platform registry initialized event
      this._triggerEvent('platformRegistryInitialized', {
        platforms: Object.keys(this.platforms).filter(key => this.platforms[key])
      });
    } catch (error) {
      console.error('Error initializing platform registry:', error);
    }
  }
  
  /**
   * Register a platform implementation
   * @param {string} platformId - Unique platform identifier
   * @param {Object} platformImpl - Platform implementation
   */
  registerPlatform(platformId, platformImpl) {
    if (!platformId || !platformImpl) {
      console.error('Invalid platform registration attempt');
      return false;
    }
    
    this.platforms[platformId] = platformImpl;
    console.log(`Platform ${platformId} registered successfully`);
    
    // If this is the first platform, set it as active
    if (!this.activePlatform) {
      this.setActivePlatform(platformId);
    }
    
    // Trigger platform registered event
    this._triggerEvent('platformRegistered', {
      platformId,
      platformName: this.platformMeta[platformId]?.name || platformId
    });
    
    return true;
  }
  
  /**
   * Get list of available platforms
   * @returns {Array} List of platform metadata objects
   */
  getAvailablePlatforms() {
    return Object.keys(this.platforms)
      .filter(platformId => this.platforms[platformId] !== null)
      .map(platformId => ({
        id: platformId,
        ...this.platformMeta[platformId]
      }));
  }
  
  /**
   * Activate a specific platform
   * @param {string} platformId - ID of the platform to activate
   * @returns {Promise<boolean>} True if activation was successful
   */
  async activatePlatform(platformId) {
    // Check if platform exists and is registered
    if (!this.platforms[platformId]) {
      console.error(`Cannot activate platform ${platformId}: not registered`);
      return false;
    }
    
    try {
      // Store previous platform for reference
      const previousPlatform = this.activePlatform;
      
      // Set the active platform
      this.activePlatform = platformId;
      
      // Save user preference
      this._saveActivePlatformPreference(platformId);
      
      // Trigger the 'platformChanged' event
      this._triggerEvent('platformChanged', { 
        previousPlatform, 
        newPlatform: platformId 
      });
      
      console.log(`Platform activated: ${platformId}`);
      return true;
    } catch (error) {
      console.error(`Error activating platform ${platformId}:`, error);
      return false;
    }
  }
  
  /**
   * Get the currently active platform implementation
   * @returns {Object|null} The active platform implementation or null if none active
   */
  getCurrentPlatform() {
    if (!this.activePlatform) {
      return null;
    }
    
    return this.platforms[this.activePlatform];
  }
  
  /**
   * Initialize the platform manager
   * This should be called after all platforms are registered
   */
  async initialize() {
    console.log('Initializing platform manager...');
    
    // Initialize platform registry if not already done
    await this._initializePlatformRegistry();
    
    // Load the last active platform from storage
    const lastActivePlatform = await this._loadLastActivePlatform();
    
    if (lastActivePlatform && this.platforms[lastActivePlatform]) {
      this.setActivePlatform(lastActivePlatform);
    } else if (this.platforms[this.defaultPlatformId]) {
      this.setActivePlatform(this.defaultPlatformId);
    }
    
    // Initialize all platforms
    for (const [platformId, platform] of Object.entries(this.platforms)) {
      if (platform && typeof platform.initialize === 'function') {
        try {
          await platform.initialize();
          console.log(`Platform ${platformId} initialized successfully`);
        } catch (error) {
          console.error(`Error initializing platform ${platformId}:`, error);
        }
      }
    }
    
    console.log('Platform manager initialized successfully');
    
    // Trigger platform manager initialized event
    this._triggerEvent('initialized', {
      activePlatform: this.activePlatform ? this.activePlatformId : null,
      availablePlatforms: Object.keys(this.platforms).filter(key => this.platforms[key])
    });
    
    return true;
  }
  
  /**
   * Initialize all registered platforms
   * @private
   * @returns {Promise<void>}
   */
  async _initializeAllPlatforms() {
    const initPromises = [];
    
    for (const [platformId, implementation] of Object.entries(this.platforms)) {
      if (implementation && typeof implementation.initialize === 'function') {
        console.log(`Initializing platform: ${platformId}`);
        initPromises.push(implementation.initialize());
      }
    }
    
    await Promise.all(initPromises);
  }
  
  /**
   * Save the active platform preference to storage
   * @private
   * @param {string} platformId - Platform ID to save
   */
  _saveActivePlatformPreference(platformId) {
    chrome.storage.local.set({ 'activePlatform': platformId }, () => {
      console.log(`Active platform preference saved: ${platformId}`);
    });
  }
  
  /**
   * Load the active platform preference from storage
   * @private
   * @returns {Promise<string|null>} - Stored platform ID or null
   */
  async _loadActivePlatformPreference() {
    return new Promise((resolve) => {
      chrome.storage.local.get('activePlatform', (result) => {
        resolve(result.activePlatform || null);
      });
    });
  }
  
  /**
   * Get platform-specific opportunities
   * @param {Object} options - Filtering options
   * @returns {Promise<Array>} List of opportunities
   */
  async getOpportunities(options = {}) {
    const platform = this.getCurrentPlatform();
    
    if (!platform || typeof platform.getOpportunities !== 'function') {
      console.error('Cannot get opportunities: no active platform or missing getOpportunities method');
      return [];
    }
    
    try {
      return await platform.getOpportunities(options);
    } catch (error) {
      console.error('Error getting opportunities:', error);
      return [];
    }
  }
  
  /**
   * Trigger a platform action (scrape, refresh, etc.)
   * @param {string} action - The action to perform
   * @param {Object} params - Action parameters
   * @returns {Promise<Object>} Action result
   */
  async triggerAction(action, params = {}) {
    const platform = this.getCurrentPlatform();
    
    if (!platform) {
      throw new Error('Cannot trigger action: no active platform');
    }
    
    if (typeof platform[action] !== 'function') {
      throw new Error(`Action '${action}' not supported by platform ${this.activePlatform}`);
    }
    
    return platform[action](params);
  }
  
  /**
   * Get platform-specific categories
   * @returns {Promise<Array>} List of category objects
   */
  async getCategories() {
    const platform = this.getCurrentPlatform();
    
    if (!platform || typeof platform.getCategories !== 'function') {
      console.error('Cannot get categories: no active platform or missing getCategories method');
      return [];
    }
    
    try {
      return await platform.getCategories();
    } catch (error) {
      console.error('Error getting categories:', error);
      return [];
    }
  }
  
  /**
   * Check authentication status for the current platform
   * @returns {Promise<Object>} Authentication status
   */
  async checkAuthStatus() {
    const platform = this.getCurrentPlatform();
    
    if (!platform || typeof platform.checkAuthStatus !== 'function') {
      return { authenticated: false, reason: 'Platform not available' };
    }
    
    try {
      return await platform.checkAuthStatus();
    } catch (error) {
      console.error('Error checking auth status:', error);
      return { authenticated: false, reason: error.message };
    }
  }
  
  /**
   * Add an event listener
   * @param {string} event - Event name
   * @param {Function} callback - Event callback
   */
  addEventListener(event, callback) {
    if (!this.eventListeners[event]) {
      this.eventListeners[event] = [];
    }
    
    this.eventListeners[event].push(callback);
  }
  
  /**
   * Remove an event listener
   * @param {string} event - Event name
   * @param {Function} callback - Event callback to remove
   */
  removeEventListener(event, callback) {
    if (!this.eventListeners[event]) {
      return;
    }
    
    this.eventListeners[event] = this.eventListeners[event].filter(
      listener => listener !== callback
    );
  }
  
  /**
   * Trigger an event
   * @private
   * @param {string} event - Event name
   * @param {Object} data - Event data
   */
  _triggerEvent(event, data) {
    if (!this.eventListeners[event]) {
      return;
    }
    
    for (const callback of this.eventListeners[event]) {
      try {
        callback(data);
      } catch (error) {
        console.error(`Error in ${event} event handler:`, error);
      }
    }
  }
}

// Create and expose a singleton instance
const platformManager = new PlatformManager();
window.platformManager = platformManager;

// Initialize the platform manager after the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  platformManager.initialize().catch(error => {
    console.error('Failed to initialize platform manager:', error);
  });
});

// Export for module usage
export default platformManager;