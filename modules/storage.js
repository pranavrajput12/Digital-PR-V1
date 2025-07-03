/**
 * StorageManager - Handles all storage operations for the extension
 * Uses modern ES6+ features and provides a clean API for data management
 * Updated for Phase 3 - Implements standardized module interface
 */

import { BaseModule } from './base/BaseModule.js';
import { StorageModuleInterface } from './base/ModuleInterface.js';

class StorageManager extends BaseModule {
  /**
   * Initialize the storage manager
   */
  constructor() {
    super('StorageManager', {
      enableLogging: true,
      enableMetrics: true,
      enableErrorRecovery: true
    });

    this.KEYS = {
      OPPORTUNITIES: 'sourceBottleOpportunities',
      PAGINATION: 'paginationData',
      SETTINGS: 'settings',
      LAST_SYNC: 'lastGoogleSheetsSync',
      UI_SETTINGS: 'uiSettings'
    };

    // Storage-specific configuration
    this.storageConfig = {
      maxRetries: 3,
      retryDelay: 1000,
      compressionEnabled: false,
      encryptionEnabled: false
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
    this.log('warn', 'Opportunity without ID found:', opportunity);
    return `generated-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  // Standardized Interface Methods (StorageModuleInterface)

  /**
   * Save data to storage (standardized interface)
   * @param {string} key - Storage key
   * @param {any} data - Data to save
   * @returns {Promise<boolean>} - Whether save was successful
   */
  async save(key, data) {
    return this.executeOperation('save', async () => {
      await this.set(key, data);
      return true;
    });
  }

  /**
   * Load data from storage (standardized interface)
   * @param {string} key - Storage key
   * @returns {Promise<any>} - Loaded data or null
   */
  async load(key) {
    return this.executeOperation('load', async () => {
      const data = await this.get(key);
      return data !== undefined ? data : null;
    });
  }

  /**
   * List all keys in storage (standardized interface)
   * @returns {Promise<string[]>} - Array of storage keys
   */
  async listKeys() {
    return this.executeOperation('listKeys', async () => {
      return new Promise(resolve => {
        chrome.storage.local.get(null, (items) => {
          if (chrome.runtime.lastError) {
            this.log('error', 'Error listing storage keys:', chrome.runtime.lastError);
            resolve([]);
          } else {
            resolve(Object.keys(items));
          }
        });
      });
    });
  }

  /**
   * Get storage usage information (standardized interface)
   * @returns {Promise<Object>} - Storage usage data
   */
  async getUsage() {
    return this.executeOperation('getUsage', async () => {
      return new Promise(resolve => {
        chrome.storage.local.getBytesInUse(null, (bytesInUse) => {
          if (chrome.runtime.lastError) {
            this.log('error', 'Error getting storage usage:', chrome.runtime.lastError);
            resolve({ bytesInUse: 0, error: chrome.runtime.lastError });
          } else {
            resolve({
              bytesInUse,
              maxBytes: chrome.storage.local.QUOTA_BYTES || 5242880, // 5MB default
              percentUsed: ((bytesInUse / (chrome.storage.local.QUOTA_BYTES || 5242880)) * 100).toFixed(2)
            });
          }
        });
      });
    });
  }

  /**
   * Backup storage data (standardized interface)
   * @returns {Promise<Object>} - Backup data
   */
  async backup() {
    return this.executeOperation('backup', async () => {
      return new Promise(resolve => {
        chrome.storage.local.get(null, (items) => {
          if (chrome.runtime.lastError) {
            this.log('error', 'Error creating backup:', chrome.runtime.lastError);
            resolve({ error: chrome.runtime.lastError });
          } else {
            resolve({
              timestamp: new Date().toISOString(),
              data: items,
              version: this.state.version
            });
          }
        });
      });
    });
  }

  /**
   * Restore storage data from backup (standardized interface)
   * @param {Object} backupData - Backup data to restore
   * @returns {Promise<boolean>} - Whether restore was successful
   */
  async restore(backupData) {
    return this.executeOperation('restore', async () => {
      if (!backupData || !backupData.data) {
        throw new Error('Invalid backup data');
      }

      return new Promise(resolve => {
        chrome.storage.local.clear(() => {
          if (chrome.runtime.lastError) {
            this.log('error', 'Error clearing storage for restore:', chrome.runtime.lastError);
            resolve(false);
            return;
          }

          chrome.storage.local.set(backupData.data, () => {
            if (chrome.runtime.lastError) {
              this.log('error', 'Error restoring backup data:', chrome.runtime.lastError);
              resolve(false);
            } else {
              this.log('info', 'Storage restored from backup successfully');
              resolve(true);
            }
          });
        });
      });
    });
  }

  /**
   * Initialize storage manager (standardized interface)
   * @param {Object} options - Initialization options
   * @returns {Promise<boolean>} - Whether initialization was successful
   */
  async _doInitialize(options = {}) {
    try {
      // Apply any configuration options
      if (options.storageConfig) {
        Object.assign(this.storageConfig, options.storageConfig);
      }

      // Test storage access
      await this.set('__test__', 'test');
      const testValue = await this.get('__test__');
      await this.remove('__test__');

      if (testValue !== 'test') {
        throw new Error('Storage access test failed');
      }

      this.log('info', 'StorageManager initialized successfully');
      return true;
    } catch (error) {
      this.log('error', 'StorageManager initialization failed:', error);
      return false;
    }
  }

  /**
   * Get module configuration (standardized interface)
   * @returns {Object} - Current module configuration
   */
  getConfig() {
    return {
      ...this.config,
      storageConfig: { ...this.storageConfig },
      keys: { ...this.KEYS }
    };
  }

  /**
   * Update module configuration (standardized interface)
   * @param {Object} newConfig - New configuration options
   * @returns {Promise<boolean>} - Whether configuration update was successful
   */
  async updateConfig(newConfig) {
    return this.executeOperation('updateConfig', async () => {
      if (newConfig.storageConfig) {
        Object.assign(this.storageConfig, newConfig.storageConfig);
      }
      
      if (newConfig.moduleConfig) {
        Object.assign(this.config, newConfig.moduleConfig);
      }

      this.log('info', 'StorageManager configuration updated');
      return true;
    });
  }

  /**
   * Reset module to initial state (standardized interface)
   * @returns {Promise<boolean>} - Whether reset was successful
   */
  async reset() {
    return this.executeOperation('reset', async () => {
      // Reset metrics and state
      this.resetMetrics();
      
      // Reset configuration to defaults
      this.storageConfig = {
        maxRetries: 3,
        retryDelay: 1000,
        compressionEnabled: false,
        encryptionEnabled: false
      };

      this.log('info', 'StorageManager reset to initial state');
      return true;
    });
  }

  /**
   * Handle errors gracefully (standardized interface)
   * @param {Error} error - Error that occurred
   * @param {string} context - Context where error occurred
   * @returns {boolean} - Whether error was handled successfully
   */
  handleError(error, context) {
    this.log('error', `StorageManager error in ${context}:`, error);
    
    // Check for Chrome storage specific errors
    if (error.message?.includes('QUOTA_EXCEEDED')) {
      this.log('warn', 'Storage quota exceeded, attempting cleanup');
      // Could trigger cleanup operations here
      return true;
    }

    if (error.message?.includes('storage')) {
      this.log('warn', 'Storage-related error detected');
      return true;
    }

    return false; // Error not handled
  }

  /**
   * Cleanup method for module destruction
   * @protected
   */
  _doDestroy() {
    // Clear any pending operations
    this.log('info', 'StorageManager cleanup completed');
  }
}

// Export as a singleton
export const storageManager = new StorageManager();
