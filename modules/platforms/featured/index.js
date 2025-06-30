/**
 * Featured.com Platform Implementation
 * 
 * Provides platform-specific functionality for the Featured.com platform
 */

import { logManager } from '../../logger.js';

class FeaturedPlatform {
  constructor() {
    this.platformId = 'featured';
    this.name = 'Featured';
    this.initialized = false;
    this.opportunities = [];
    this.categories = [];
    this.settings = {
      scrapeInterval: 60, // minutes
      autoSync: true,
      lastSync: null
    };
  }
  
  /**
   * Initialize the platform
   * @returns {Promise<boolean>} True if initialization was successful
   */
  async initialize() {
    if (this.initialized) {
      return true;
    }
    
    try {
      console.log('Initializing Featured platform...');
      
      // Load settings
      await this._loadSettings();
      
      // Load categories
      this.categories = await this._loadCategories();
      
      // Load cached opportunities
      this.opportunities = await this._loadCachedOpportunities();
      
      this.initialized = true;
      console.log('Featured platform initialized successfully');
      
      // If auto-sync is enabled and we haven't synced recently, sync now
      if (this.settings.autoSync && this._shouldSync()) {
        this.syncOpportunities().catch(err => {
          console.error('Error during initial sync:', err);
        });
      }
      
      return true;
    } catch (error) {
      console.error('Error initializing Featured platform:', error);
      return false;
    }
  }
  
  /**
   * Get opportunities with optional filtering
   * @param {Object} options - Filter options
   * @returns {Promise<Array>} Filtered opportunities
   */
  async getOpportunities(options = {}) {
    if (!this.initialized) {
      await this.initialize();
    }
    
    try {
      // Apply filters to the opportunities
      let filteredOpportunities = this._filterOpportunities(this.opportunities, options);
      
      // If we need fresh data, sync first
      if (options.refresh === true) {
        await this.syncOpportunities();
        filteredOpportunities = this._filterOpportunities(this.opportunities, options);
      }
      
      return filteredOpportunities;
    } catch (error) {
      console.error('Error getting opportunities:', error);
      return [];
    }
  }
  
  /**
   * Get available categories for this platform
   * @returns {Promise<Array>} List of categories
   */
  async getCategories() {
    if (!this.initialized) {
      await this.initialize();
    }
    
    return this.categories;
  }
  
  /**
   * Synchronize opportunities with the platform
   * @param {Object} options - Sync options
   * @returns {Promise<Array>} Updated opportunities
   */
  async syncOpportunities(options = {}) {
    if (!this.initialized) {
      await this.initialize();
    }
    
    try {
      console.log('Syncing opportunities from Featured...');
      
      // Get opportunities from storage (already scraped by content script)
      const storedOpportunities = await this._loadCachedOpportunities();
      this.opportunities = storedOpportunities;
      
      // Update last sync time
      this.settings.lastSync = new Date().toISOString();
      await this._saveSettings();
      
      return this.opportunities;
    } catch (error) {
      console.error('Error syncing Featured opportunities:', error);
      return this.opportunities;
    }
  }
  
  /**
   * Filter opportunities based on provided options
   * @private
   * @param {Array} opportunities - Opportunities to filter
   * @param {Object} options - Filter options
   * @returns {Array} Filtered opportunities
   */
  _filterOpportunities(opportunities, options = {}) {
    let filtered = [...opportunities];
    
    // Filter by category if specified
    if (options.category && options.category !== 'all') {
      filtered = filtered.filter(op => 
        op.category === options.category || 
        (op.tags && op.tags.includes(options.category))
      );
    }
    
    // Filter by search term if specified
    if (options.search && options.search.trim()) {
      const searchTerm = options.search.trim().toLowerCase();
      filtered = filtered.filter(op => {
        const title = (op.title || '').toLowerCase();
        const desc = (op.description || '').toLowerCase();
        const tags = Array.isArray(op.tags) ? op.tags.join(' ').toLowerCase() : '';
        
        return title.includes(searchTerm) || 
               desc.includes(searchTerm) || 
               tags.includes(searchTerm);
      });
    }
    
    // Filter by date range if specified
    if (options.dateFrom) {
      const dateFrom = new Date(options.dateFrom);
      filtered = filtered.filter(op => {
        const opDate = new Date(op.deadline || op.date || op.scrapedAt);
        return opDate >= dateFrom;
      });
    }
    
    if (options.dateTo) {
      const dateTo = new Date(options.dateTo);
      filtered = filtered.filter(op => {
        const opDate = new Date(op.deadline || op.date || op.scrapedAt);
        return opDate <= dateTo;
      });
    }
    
    // Sort by specified field
    if (options.sort) {
      switch (options.sort) {
        case 'date':
          filtered.sort((a, b) => {
            const dateA = new Date(a.deadline || a.date || a.scrapedAt);
            const dateB = new Date(b.deadline || b.date || b.scrapedAt);
            return dateB - dateA; // Most recent first
          });
          break;
          
        case 'title':
          filtered.sort((a, b) => {
            return (a.title || '').localeCompare(b.title || '');
          });
          break;
          
        case 'relevance':
          filtered.sort((a, b) => {
            const scoreA = (a.ai_analysis?.relevance_score || a.aiAnalysis?.relevanceScore || 0);
            const scoreB = (b.ai_analysis?.relevance_score || b.aiAnalysis?.relevanceScore || 0);
            return scoreB - scoreA; // Highest first
          });
          break;
      }
    }
    
    return filtered;
  }
  
  /**
   * Load settings from storage
   * @private
   * @returns {Promise<Object>} Loaded settings
   */
  async _loadSettings() {
    return new Promise((resolve) => {
      chrome.storage.local.get('featured_settings', (result) => {
        if (result.featured_settings) {
          this.settings = { ...this.settings, ...result.featured_settings };
        }
        resolve(this.settings);
      });
    });
  }
  
  /**
   * Save settings to storage
   * @private
   * @returns {Promise<void>}
   */
  async _saveSettings() {
    return new Promise((resolve) => {
      chrome.storage.local.set({ 'featured_settings': this.settings }, resolve);
    });
  }
  
  /**
   * Load categories from cache or default list
   * @private
   * @returns {Promise<Array>} Categories
   */
  async _loadCategories() {
    return new Promise((resolve) => {
      chrome.storage.local.get('featured_categories', (result) => {
        if (result.featured_categories && Array.isArray(result.featured_categories)) {
          resolve(result.featured_categories);
        } else {
          // Default categories if none found in storage
          const defaultCategories = [
            { id: 'press-qa', name: 'Press Q&A' },
            { id: 'expert-insights', name: 'Expert Insights' },
            { id: 'podcast-interviews', name: 'Podcast Interviews' },
            { id: 'article-quotes', name: 'Article Quotes' },
            { id: 'media-commentary', name: 'Media Commentary' }
          ];
          resolve(defaultCategories);
        }
      });
    });
  }
  
  /**
   * Load cached opportunities from storage
   * @private
   * @returns {Promise<Array>} Cached opportunities
   */
  async _loadCachedOpportunities() {
    return new Promise((resolve) => {
      chrome.storage.local.get('featuredOpportunities', (result) => {
        if (result.featuredOpportunities && Array.isArray(result.featuredOpportunities)) {
          resolve(result.featuredOpportunities);
        } else {
          resolve([]);
        }
      });
    });
  }
  
  /**
   * Check if we should sync based on last sync time and settings
   * @private
   * @returns {boolean} True if sync is needed
   */
  _shouldSync() {
    if (!this.settings.lastSync) {
      return true;
    }
    
    const lastSync = new Date(this.settings.lastSync);
    const now = new Date();
    const diffMinutes = (now - lastSync) / (1000 * 60);
    
    return diffMinutes >= this.settings.scrapeInterval;
  }
  
  /**
   * Update platform settings
   * @param {Object} newSettings - New settings to apply
   * @returns {Promise<Object>} Updated settings
   */
  async updateSettings(newSettings) {
    this.settings = {
      ...this.settings,
      ...newSettings
    };
    
    await this._saveSettings();
    return this.settings;
  }
}

// Create platform instance
const featuredPlatform = new FeaturedPlatform();

// Export for module usage
export default featuredPlatform;
