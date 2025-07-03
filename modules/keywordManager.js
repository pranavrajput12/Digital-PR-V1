/**
 * KeywordManager - Manages keyword groups for opportunity matching
 * Allows externalized configuration of keywords and weights
 */

// Import dependencies
import { logManager } from './logger.js';
class KeywordManager {
  constructor() {
    // Storage key for persisting keyword groups
    this.STORAGE_KEY = 'sourcebottle_keyword_groups';
    this.SYNONYM_STORAGE_KEY = 'sourcebottle_synonyms';
    this.CONFIG_PATH = '/config/keyword-groups.json';
    
    // Configuration defaults
    this.config = {
      scoreThresholds: {
        high: 0.7,
        medium: 0.4,
        low: 0.1
      },
      titleMultiplier: 2.0,
      minBasicScore: 0.1,
      deadlineMaxDays: 30
    };
    
    // Keyword groups will be loaded from storage or config file
    this.keywordGroups = {};
    this.synonyms = {}; // Map of terms to their synonyms
    this.expandedTerms = {}; // Cache for synonym expansions
    this.flattened = []; // Flattened array of all keywords including synonyms
  }
  
  /**
   * Initialize the manager and load keyword groups from storage or config
   * @returns {Promise<boolean>} True if initialization was successful
   */
  async initialize() {
    try {
      // First try to load from Chrome storage
      const result = await this.loadFromStorage();
      
      if (result) {
        console.log('Loaded keyword groups from Chrome storage');
        return true;
      }
      
      // If not in storage, try to load from config file
      const configResult = await this.loadFromConfigFile();
      
      if (configResult) {
        console.log('Loaded keyword groups from config file');
        return true;
      }
      
      console.warn('Failed to load keyword groups from storage or config file');
      return false;
    } catch (error) {
      console.error('Error initializing KeywordManager:', error);
      return false;
    }
  }
  
  /**
   * Load keyword groups from Chrome storage
   * @returns {Promise<boolean>} True if loading was successful
   */
  async loadFromStorage() {
    return new Promise(resolve => {
      chrome.storage.local.get([this.STORAGE_KEY, this.SYNONYM_STORAGE_KEY], result => {
        if (chrome.runtime.lastError) {
          console.error('Error loading from storage:', chrome.runtime.lastError);
          resolve(false);
          return;
        }
        
        let loaded = false;
        
        // Load keyword groups
        if (result && result[this.STORAGE_KEY]) {
          this.keywordGroups = result[this.STORAGE_KEY];
          loaded = true;
        }
        
        // Load synonyms
        if (result && result[this.SYNONYM_STORAGE_KEY]) {
          this.synonyms = result[this.SYNONYM_STORAGE_KEY];
          console.log(`Loaded ${Object.keys(this.synonyms).length} synonym sets from storage`);
          loaded = true;
        }
        
        // Update expanded terms and flattened list if anything was loaded
        if (loaded) {
          this.updateExpandedTerms();
          this.updateFlattenedKeywords();
          resolve(true);
        } else {
          resolve(false);
        }
      });
    });
  }
  
  /**
   * Load keyword groups from config file
   * @returns {Promise<boolean>} True if loading was successful
   */
  async loadFromConfigFile() {
    try {
      const response = await fetch(this.CONFIG_PATH);
      
      if (!response.ok) {
        console.error('Failed to load config file:', response.status);
        return false;
      }
      
      const config = await response.json();
      
      if (!config || !config.keywordGroups) {
        console.error('Invalid config file format');
        return false;
      }
      
      this.keywordGroups = config.keywordGroups;
      
      // Load synonyms if available
      if (config.synonyms) {
        this.synonyms = config.synonyms;
        console.log(`Loaded ${Object.keys(this.synonyms).length} synonym sets from config`);
      }
      
      // Also load other configuration if available
      if (config.defaults) {
        this.config = {...this.config, ...config.defaults};
      }
      
      // Update expanded terms and flattened keywords list
      this.updateExpandedTerms();
      this.updateFlattenedKeywords();
      
      // Save to Chrome storage for future use
      await this.saveToStorage();
      return true;
    } catch (error) {
      console.error('Error loading from config file:', error);
      return false;
    }
  }
  
  /**
   * Save keyword groups to Chrome storage
   * @returns {Promise<boolean>} True if saving was successful
   */
  async saveToStorage() {
    return new Promise(resolve => {
      chrome.storage.local.set({
        [this.STORAGE_KEY]: this.keywordGroups,
        [this.SYNONYM_STORAGE_KEY]: this.synonyms
      }, () => {
        if (chrome.runtime.lastError) {
          console.error('Error saving to storage:', chrome.runtime.lastError);
          resolve(false);
        } else {
          console.log('Saved keyword groups and synonyms to Chrome storage');
          resolve(true);
        }
      });
    });
  }
  
  /**
   * Update a specific keyword group
   * @param {string} groupName - Name of the group to update
   * @param {Object} groupData - New group data (terms and weight)
   * @returns {Promise<boolean>} True if update was successful
   */
  async updateGroup(groupName, groupData) {
    if (!groupData || !Array.isArray(groupData.terms) || typeof groupData.weight !== 'number') {
      console.error('Invalid group data format');
      return false;
    }
    
    // Create a deep copy of the current groups
    const updatedGroups = JSON.parse(JSON.stringify(this.keywordGroups));
    
    // Update or add the specified group
    updatedGroups[groupName] = groupData;
    
    // Update the current instance
    this.keywordGroups = updatedGroups;
    this.updateFlattenedKeywords();
    
    // Save to storage
    return await this.saveToStorage();
  }
  
  /**
   * Get all keyword groups
   * @returns {Object} All keyword groups
   */
  getAllGroups() {
    return this.keywordGroups;
  }
  
  /**
   * Get a specific keyword group
   * @param {string} groupName - Name of the group to get
   * @returns {Object|null} The requested group or null if not found
   */
  getGroup(groupName) {
    return this.keywordGroups[groupName] || null;
  }
  
  /**
   * Get flattened array of all keywords
   * @returns {Array} Array of all keywords
   */
  getAllKeywords() {
    return this.flattened;
  }
  
  /**
   * Get all synonyms for a given term
   * @param {string} term - The term to get synonyms for
   * @returns {Array} Array of synonyms (including the term itself)
   */
  getSynonyms(term) {
    // Check if this term has synonyms in our expansion map
    if (this.expandedTerms[term]) {
      return this.expandedTerms[term];
    }
    // If not found, return just the term itself
    return [term];
  }
  
  /**
   * Get all terms and their synonyms as a map
   * @returns {Object} Map of terms to their synonyms
   */
  getAllSynonyms() {
    return this.synonyms;
  }
  
  /**
   * Check if a term has any synonyms
   * @param {string} term - The term to check
   * @returns {boolean} True if the term has synonyms
   */
  hasSynonyms(term) {
    return Boolean(this.expandedTerms[term] && this.expandedTerms[term].length > 1);
  }
  
  /**
   * Update the expandedTerms map from synonyms
   * @private
   */
  updateExpandedTerms() {
    // Clear the map first
    this.expandedTerms = {};
    
    // For each base term in the synonyms map
    Object.keys(this.synonyms).forEach(baseTerm => {
      // Add the base term itself to the expanded terms
      this.expandedTerms[baseTerm] = [baseTerm];
      
      // Add each synonym for the base term
      if (Array.isArray(this.synonyms[baseTerm])) {
        this.synonyms[baseTerm].forEach(synonym => {
          // Add the synonym to the expanded terms for the base term
          this.expandedTerms[baseTerm].push(synonym);
          
          // Also create a reverse mapping - from synonym to base term
          // This helps with keyword matching later
          if (!this.expandedTerms[synonym]) {
            this.expandedTerms[synonym] = [baseTerm];
          } else {
            this.expandedTerms[synonym].push(baseTerm);
          }
        });
      }
    });
    
    console.log(`Updated expanded terms: ${Object.keys(this.expandedTerms).length} terms have expansions`);
  }
  
  /**
   * Update the flattened keywords array from groups
   * @private
   */
  updateFlattenedKeywords() {
    this.flattened = [];
    
    // Start with the original terms from all groups
    Object.keys(this.keywordGroups).forEach(groupName => {
      const group = this.keywordGroups[groupName];
      if (group && Array.isArray(group.terms)) {
        this.flattened = [...this.flattened, ...group.terms];
      }
    });
    
    // Add all synonyms to the flattened list
    Object.keys(this.synonyms).forEach(baseTerm => {
      if (Array.isArray(this.synonyms[baseTerm])) {
        this.flattened = [...this.flattened, ...this.synonyms[baseTerm]];
      }
    });
    
    // Remove duplicates
    this.flattened = [...new Set(this.flattened)];
    
    console.log(`Updated flattened keywords: ${this.flattened.length} total terms (including synonyms)`);
  }
  
  /**
   * Get configuration values
   * @returns {Object} Configuration object
   */
  getConfig() {
    return this.config;
  }
  
  /**
   * Update configuration values
   * @param {Object} newConfig - New configuration values
   */
  updateConfig(newConfig) {
    this.config = {...this.config, ...newConfig};
  }
  
  /**
   * Update synonyms for a term
   * @param {string} term - Base term to update synonyms for
   * @param {Array} synonyms - Array of synonyms for the term
   * @returns {Promise<boolean>} True if update was successful
   */
  async updateSynonyms(term, synonyms) {
    if (!term || !Array.isArray(synonyms)) {
      console.error('Invalid synonym data format');
      return false;
    }
    
    // Create a deep copy of the current synonyms
    const updatedSynonyms = JSON.parse(JSON.stringify(this.synonyms));
    
    // Update or add the specified synonyms
    updatedSynonyms[term] = synonyms;
    
    // Update the current instance
    this.synonyms = updatedSynonyms;
    
    // Update expanded terms and flattened keywords
    this.updateExpandedTerms();
    this.updateFlattenedKeywords();
    
    // Save to storage
    return await this.saveToStorage();
  }
}

// Create a singleton instance
const keywordManager = new KeywordManager();

// Export for ES6 modules
export { keywordManager };

// Assign to window global for Chrome Extension CSP compliance
if (typeof window !== 'undefined') {
  window.keywordManager = keywordManager;
}
