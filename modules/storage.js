/**
 * StorageManager - Handles all storage operations for the extension
 * Uses modern ES6+ features and provides a clean API for data management
 */
class StorageManager {
  /**
   * Initialize the storage manager
   */
  constructor() {
    this.KEYS = {
      OPPORTUNITIES: 'sourceBottleOpportunities',
      PAGINATION: 'paginationData',
      SETTINGS: 'settings',
      LAST_SYNC: 'lastGoogleSheetsSync',
      UI_SETTINGS: 'uiSettings'
    };
  }

  /**
   * Get all opportunities from storage
   * @returns {Promise<Array>} Array of opportunities
   */
  async getOpportunities() {
    const data = await this.get(this.KEYS.OPPORTUNITIES);
    return data || [];
  }

  /**
   * Save opportunities to storage
   * @param {Array} newOpportunities - Array of new opportunities to save
   * @returns {Promise<Array>} All opportunities after saving
   */
  /**
   * Save opportunities to storage
   * @param {Array} newOpportunities - Array of new opportunities to save
   * @returns {Promise<Array>} All opportunities after saving
   */
  async saveOpportunities(newOpportunities) {
    if (!newOpportunities || newOpportunities.length === 0) {
      return [];
    }
    
    try {
      // Get existing opportunities
      const result = await this.get(this.KEYS.OPPORTUNITIES);
      const existingOpportunities = result || [];
      
      // Create a map of existing opportunities by ID for quick lookup
      const existingMap = new Map();
      existingOpportunities.forEach(opp => {
        // Determine the unique identifier, prioritizing id then externalId
        const uniqueId = this._getOpportunityUniqueId(opp);
        if (uniqueId) {
          existingMap.set(uniqueId, opp);
        }
      });
      
      // Add new opportunities, replacing any with the same ID
      newOpportunities.forEach(opp => {
        // Normalize ID fields to ensure consistency
        const normalizedOpp = this._normalizeOpportunityIds(opp);
        const uniqueId = this._getOpportunityUniqueId(normalizedOpp);
        
        if (uniqueId) {
          existingMap.set(uniqueId, {
            ...normalizedOpp,
            savedAt: new Date().toISOString()
          });
        }
      });
      
      // Convert map back to array
      const updatedOpportunities = Array.from(existingMap.values());
      
      // Save to storage
      await this.set(this.KEYS.OPPORTUNITIES, updatedOpportunities);
      
      return updatedOpportunities;
    } catch (error) {
      console.error('Error saving opportunities:', error);
      return [];
    }
  }

  /**
   * Get pagination state
   * @returns {Promise<Object>} Current pagination state
   */
  async getPaginationState() {
    const data = await this.get(this.KEYS.PAGINATION);
    return data || null;
  }

  /**
   * Save pagination state
   * @param {Object} state - Pagination state to save
   * @returns {Promise<void>}
   */
  async savePaginationState(state) {
    if (!state) return;
    
    await this.set(this.KEYS.PAGINATION, {
      ...state,
      lastUpdated: new Date().toISOString()
    });
  }

  /**
   * Clear pagination state
   * @returns {Promise<void>}
   */
  async clearPaginationState() {
    await this.remove(this.KEYS.PAGINATION);
  }

  /**
   * Get settings
   * @returns {Promise<Object>} Current settings
   */
  async getSettings() {
    const data = await this.get(this.KEYS.SETTINGS);
    
    // Return default settings if none exist
    if (!data) {
      const defaultSettings = {
        refreshInterval: 60, // minutes
        notifyNew: true,
        autoScrape: false,
        categories: ['all'],
        keywordFilters: [
          'marketing', 'technology', 'ai', 'startup', 
          'innovation', 'business', 'entrepreneur'
        ]
      };
      
      await this.saveSettings(defaultSettings);
      return defaultSettings;
    }
    
    return data;
  }

  /**
   * Save settings
   * @param {Object} settings - Settings to save
   * @returns {Promise<Object>} Updated settings
   */
  async saveSettings(settings) {
    if (!settings) return this.getSettings();
    
    await this.set(this.KEYS.SETTINGS, settings);
    return settings;
  }

  /**
   * Update last sync time
   * @returns {Promise<string>} ISO timestamp
   */
  async updateLastSyncTime() {
    const timestamp = new Date().toISOString();
    await this.set(this.KEYS.LAST_SYNC, timestamp);
    return timestamp;
  }

  /**
   * Get last sync time
   * @returns {Promise<string>} ISO timestamp or null
   */
  async getLastSyncTime() {
    return await this.get(this.KEYS.LAST_SYNC);
  }

  /**
   * Get last updated timestamp
   * @returns {Promise<string>} ISO timestamp or null
   */
  async getLastUpdated() {
    const data = await this.get('lastUpdated');
    return data || null;
  }

  /**
   * Save UI preferences
   * @param {Object} preferences - UI preferences to save
   * @returns {Promise<Object>} Updated preferences
   */
  async saveUIPreference(preferences) {
    if (!preferences) return this.getUISettings();
    
    // Get existing settings
    const settings = await this.getSettings();
    
    // Update UI settings
    settings.ui = {
      ...settings.ui,
      ...preferences
    };
    
    // Save updated settings
    await this.set(this.KEYS.SETTINGS, settings);
    return settings.ui;
  }

  /**
   * Get UI settings
   * @returns {Promise<Object>} UI settings
   */
  async getUISettings() {
    const settings = await this.getSettings();
    return settings.ui || {};
  }

  /**
   * Generic get method for chrome.storage.local
   * @param {string} key - Storage key
   * @returns {Promise<any>} Stored data
   */
  async get(key) {
    return new Promise(resolve => {
      chrome.storage.local.get([key], result => {
        resolve(result[key]);
      });
    });
  }

  /**
   * Generic set method for chrome.storage.local
   * @param {string} key - Storage key
   * @param {any} value - Value to store
   * @returns {Promise<void>}
   */
  async set(key, value) {
    return new Promise(resolve => {
      const data = {};
      data[key] = value;
      chrome.storage.local.set(data, () => {
        resolve();
      });
    });
  }

  /**
   * Generic remove method for chrome.storage.local
   * @param {string} key - Storage key to remove
   * @returns {Promise<void>}
   */
  async remove(key) {
    return new Promise(resolve => {
      chrome.storage.local.remove(key, () => {
        resolve();
      });
    });
  }
  /**
   * Normalize opportunity ID fields to ensure consistency
   * @param {Object} opportunity - The opportunity to normalize
   * @returns {Object} Normalized opportunity
   * @private
   */
  _normalizeOpportunityIds(opportunity) {
    if (!opportunity) return opportunity;
    
    const normalized = { ...opportunity };
    
    // Ensure both id and externalId exist and are consistent
    if (normalized.id && !normalized.externalId) {
      normalized.externalId = normalized.id;
    } else if (normalized.externalId && !normalized.id) {
      normalized.id = normalized.externalId;
    }
    
    return normalized;
  }
  
  /**
   * Get a unique identifier for an opportunity
   * @param {Object} opportunity - The opportunity to get ID for
   * @returns {string|null} Unique ID or null if not found
   * @private
   */
  _getOpportunityUniqueId(opportunity) {
    if (!opportunity) return null;
    
    // Try id first, then externalId, then generate a fallback
    if (opportunity.id) {
      return opportunity.id;
    } else if (opportunity.externalId) {
      return opportunity.externalId;
    }
    
    // If no ID exists (should be rare), log warning and generate one
    console.warn('Opportunity without ID found:', opportunity);
    return `generated-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }
}

// Export as a singleton
export const storageManager = new StorageManager();
