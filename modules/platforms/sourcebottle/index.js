/**
 * SourceBottle Platform Implementation
 * 
 * Provides platform-specific functionality for the SourceBottle platform
 */

import authManager from './authManager.js';
import scraper from './scraper.js';
import transformer from './transformer.js';

class SourceBottlePlatform {
  constructor() {
    this.platformId = 'sourcebottle';
    this.name = 'SourceBottle';
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
      console.log('Initializing SourceBottle platform...');
      
      // Load settings
      await this._loadSettings();
      
      // Initialize auth manager
      await authManager.initialize();
      
      // Load categories
      this.categories = await this._loadCategories();
      
      // Load cached opportunities
      this.opportunities = await this._loadCachedOpportunities();
      
      this.initialized = true;
      console.log('SourceBottle platform initialized successfully');
      
      // If auto-sync is enabled and we haven't synced recently, sync now
      if (this.settings.autoSync && this._shouldSync()) {
        this.syncOpportunities().catch(err => {
          console.error('Error during initial sync:', err);
        });
      }
      
      return true;
    } catch (error) {
      console.error('Error initializing SourceBottle platform:', error);
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
   * Check authentication status
   * @returns {Promise<Object>} Authentication status
   */
  async checkAuthStatus() {
    return authManager.checkStatus();
  }
  
  /**
   * Authenticate with the platform
   * @param {Object} credentials - Login credentials
   * @returns {Promise<Object>} Authentication result
   */
  async authenticate(credentials) {
    return authManager.login(credentials);
  }
  
  /**
   * Logout from the platform
   * @returns {Promise<boolean>} True if logout was successful
   */
  async logout() {
    return authManager.logout();
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
      console.log('Syncing opportunities from SourceBottle...');
      
      // Check authentication
      const authStatus = await this.checkAuthStatus();
      if (!authStatus.authenticated) {
        throw new Error('Authentication required to sync opportunities');
      }
      
      // Get categories to scrape
      const categoriesToScrape = options.categories || this.categories.map(c => c.id);
      
      // Scrape opportunities from the platform
      const scrapedData = await scraper.scrapeOpportunities(categoriesToScrape);
      
      // Transform the scraped data to our internal format
      const transformedOpportunities = transformer.transformOpportunities(scrapedData);
      
      // Update the opportunities cache
      this.opportunities = transformedOpportunities;
      
      // Save to cache
      await this._saveCachedOpportunities(transformedOpportunities);
      
      // Update last sync time
      this.settings.lastSync = new Date().toISOString();
      await this._saveSettings();
      
      console.log(`Synced ${transformedOpportunities.length} opportunities from SourceBottle`);
      
      return transformedOpportunities;
    } catch (error) {
      console.error('Error syncing opportunities:', error);
      throw error;
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
    
    // Apply category filter
    if (options.category && options.category !== 'all') {
      filtered = filtered.filter(opp => opp.category === options.category);
    }
    
    // Apply search filter
    if (options.search) {
      const searchTerms = options.search.toLowerCase().split(' ');
      filtered = filtered.filter(opp => {
        const content = `${opp.title} ${opp.description}`.toLowerCase();
        return searchTerms.every(term => content.includes(term));
      });
    }
    
    // Apply date filter
    if (options.dateFrom) {
      const fromDate = new Date(options.dateFrom);
      filtered = filtered.filter(opp => {
        const oppDate = new Date(opp.datePosted || opp.date_posted);
        return oppDate >= fromDate;
      });
    }
    
    // Apply AI relevance filter
    if (options.relevance && options.relevance !== 'all') {
      filtered = filtered.filter(opp => {
        const aiAnalysis = opp.ai_analysis || opp.aiAnalysis;
        if (!aiAnalysis) return false;
        
        const relevanceScore = aiAnalysis.relevance_score || aiAnalysis.relevanceScore || 0;
        
        switch (options.relevance) {
          case 'high':
            return relevanceScore >= 0.7;
          case 'medium':
            return relevanceScore >= 0.4 && relevanceScore < 0.7;
          case 'low':
            return relevanceScore < 0.4;
          default:
            return true;
        }
      });
    }
    
    // Apply sorting
    if (options.sort) {
      switch (options.sort) {
        case 'date':
          filtered.sort((a, b) => {
            const dateA = new Date(a.datePosted || a.date_posted);
            const dateB = new Date(b.datePosted || b.date_posted);
            return dateB - dateA; // Newest first
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
      chrome.storage.local.get('sourcebottle_settings', (result) => {
        if (result.sourcebottle_settings) {
          this.settings = { ...this.settings, ...result.sourcebottle_settings };
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
      chrome.storage.local.set({ 'sourcebottle_settings': this.settings }, resolve);
    });
  }
  
  /**
   * Load categories from cache or default list
   * @private
   * @returns {Promise<Array>} Categories
   */
  async _loadCategories() {
    return new Promise((resolve) => {
      chrome.storage.local.get('sourcebottle_categories', (result) => {
        if (result.sourcebottle_categories && Array.isArray(result.sourcebottle_categories)) {
          resolve(result.sourcebottle_categories);
        } else {
          // Default categories if none found in storage
          const defaultCategories = [
            { id: 'business-finance', name: 'Business & Finance' },
            { id: 'technology', name: 'Technology' },
            { id: 'health-wellbeing', name: 'Health & Wellbeing' },
            { id: 'environment', name: 'Environment' },
            { id: 'lifestyle-food-fashion', name: 'Lifestyle, Food & Fashion' },
            { id: 'parenting-education', name: 'Parenting & Education' },
            { id: 'pr-media-marketing', name: 'PR, Media & Marketing' },
            { id: 'professional-services', name: 'Professional Services' },
            { id: 'property', name: 'Property' },
            { id: 'travel-leisure', name: 'Travel & Leisure' }
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
      chrome.storage.local.get('sourcebottle_opportunities', (result) => {
        if (result.sourcebottle_opportunities && Array.isArray(result.sourcebottle_opportunities)) {
          resolve(result.sourcebottle_opportunities);
        } else {
          resolve([]);
        }
      });
    });
  }
  
  /**
   * Save opportunities to cache
   * @private
   * @param {Array} opportunities - Opportunities to cache
   * @returns {Promise<void>}
   */
  async _saveCachedOpportunities(opportunities) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ 'sourcebottle_opportunities': opportunities }, resolve);
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
const sourcebottlePlatform = new SourceBottlePlatform();

// Export for module usage
export default sourcebottlePlatform;