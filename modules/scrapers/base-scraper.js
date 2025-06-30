/**
 * Base Scraper Class
 * 
 * This abstract class provides common functionality for all platform-specific scrapers.
 * It handles:
 * - Storage operations
 * - Text extraction from DOM elements
 * - Error handling and logging
 * - Common utility methods
 */

// Use window globals for CSP compliance
const logManager = window.logManager || console;

/**
 * BaseScraper - Abstract base class for all platform scrapers
 */
class BaseScraper {
  /**
   * Create a new BaseScraper
   * @param {string} storageKey - The key used to store opportunities in chrome.storage.local
   * @param {string} sourceName - The name of the source platform (e.g., 'SourceBottle', 'Featured', 'Qwoted')
   */
  constructor(storageKey, sourceName) {
    // Ensure the class is being extended
    if (this.constructor === BaseScraper) {
      throw new Error('BaseScraper is an abstract class and cannot be instantiated directly');
    }
    
    // Storage key for this platform's opportunities
    this.storageKey = storageKey || 'opportunities';
    
    // Source name for tagging opportunities
    this.sourceName = sourceName || 'Unknown';
    
    // Tracking processed items to avoid duplicates
    this.processedIds = new Set();
    
    // Common logging prefix
    this.logPrefix = `[${this.sourceName} Scraper]`;
  }
  
  /**
   * Debug log with prefix
   * @param {string} message - Message to log
   * @param {any} [data] - Optional data to log
   */
  debugLog(message, data) {
    if (data) {
      logManager.debug(`${this.logPrefix} ${message}`, data);
    } else {
      logManager.debug(`${this.logPrefix} ${message}`);
    }
  }
  
  /**
   * Extract text from an element using a selector
   * @param {Element} element - The parent element to search within
   * @param {string} selector - CSS selector to find the target element
   * @returns {string} Extracted text or empty string if not found
   */
  extractText(element, selector) {
    try {
      const target = element.querySelector(selector);
      return target ? target.textContent.trim() : '';
    } catch (error) {
      this.debugLog(`Error extracting text with selector "${selector}":`, error);
      return '';
    }
  }
  
  /**
   * Extract text from all matching elements
   * @param {Element} element - The parent element to search within
   * @param {string} selector - CSS selector to find target elements
   * @returns {string[]} Array of extracted text values
   */
  extractAllText(element, selector) {
    try {
      const targets = element.querySelectorAll(selector);
      return Array.from(targets).map(el => el.textContent.trim()).filter(Boolean);
    } catch (error) {
      this.debugLog(`Error extracting all text with selector "${selector}":`, error);
      return [];
    }
  }
  
  /**
   * Get an external ID from an element's data attribute or generate one
   * @param {Element} element - The element to check for ID
   * @param {string} selector - Optional selector to find a child element with the ID
   * @returns {string} The extracted or generated ID
   */
  getExternalId(element, selector = null) {
    try {
      // If a selector is provided, find that element first
      const target = selector ? element.querySelector(selector) : element;
      
      if (!target) {
        return null;
      }
      
      // Try various common ID attributes
      for (const attr of ['data-id', 'id', 'data-opportunity-id', 'data-item-id']) {
        if (target.hasAttribute(attr)) {
          return target.getAttribute(attr);
        }
      }
      
      // Try href as a last resort for unique identification
      if (target.hasAttribute('href')) {
        const href = target.getAttribute('href');
        // Extract ID from URL if possible
        const idMatch = href.match(/[?&]id=([^&]+)/);
        if (idMatch) {
          return idMatch[1];
        }
        // Otherwise use the whole URL path as an ID
        return href.replace(/[^a-zA-Z0-9]/g, '-');
      }
      
      return null;
    } catch (error) {
      this.debugLog('Error getting external ID:', error);
      return null;
    }
  }
  
  /**
   * Wait for a specified time
   * @param {number} ms - Milliseconds to wait
   * @returns {Promise<void>}
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * Load existing opportunities from storage
   * @returns {Promise<Array>} Array of existing opportunities
   */
  async loadExistingOpportunities() {
    try {
      return new Promise((resolve) => {
        chrome.storage.local.get(this.storageKey, (result) => {
          if (result[this.storageKey] && Array.isArray(result[this.storageKey])) {
            this.debugLog(`Loaded ${result[this.storageKey].length} existing opportunities from storage`);
            resolve(result[this.storageKey]);
          } else {
            this.debugLog('No existing opportunities found in storage');
            resolve([]);
          }
        });
      });
    } catch (error) {
      this.debugLog('Error loading existing opportunities:', error);
      return [];
    }
  }
  
  /**
   * Persist opportunities to storage
   * @param {Array} opportunities - Opportunities to save
   * @returns {Promise<boolean>} Success status
   */
  async persist(opportunities) {
    if (!Array.isArray(opportunities) || opportunities.length === 0) {
      this.debugLog('No opportunities to persist');
      return false;
    }
    
    try {
      // Ensure each opportunity has the correct source
      const taggedOpportunities = opportunities.map(op => ({
        ...op,
        source: op.source || this.sourceName
      }));
      
      // Load existing opportunities to merge with new ones
      const existing = await this.loadExistingOpportunities();
      
      // Create a map of existing opportunities by ID for quick lookup
      const existingMap = new Map();
      existing.forEach(op => {
        const idKey = op.externalId || op.id;
        if (idKey) {
          existingMap.set(idKey, op);
        }
      });
      
      // Merge new opportunities with existing ones, updating if needed
      const merged = [...existing];
      
      for (const newOp of taggedOpportunities) {
        const idKey = newOp.externalId || newOp.id;
        
        if (!idKey) {
          // If no ID, just add it
          merged.push(newOp);
          continue;
        }
        
        // Check if this opportunity already exists
        const existingIndex = merged.findIndex(op => 
          (op.externalId === idKey || op.id === idKey) && op.source === newOp.source
        );
        
        if (existingIndex >= 0) {
          // Update existing opportunity
          merged[existingIndex] = {
            ...merged[existingIndex],
            ...newOp,
            scrapedAt: new Date().toISOString() // Update scraped timestamp
          };
        } else {
          // Add new opportunity
          merged.push(newOp);
        }
      }
      
      // Save to storage
      return new Promise((resolve) => {
        chrome.storage.local.set({ [this.storageKey]: merged }, () => {
          this.debugLog(`Saved ${merged.length} opportunities to storage (${taggedOpportunities.length} new/updated)`);
          
          // Also save last updated timestamp
          const timestamp = new Date().toISOString();
          chrome.storage.local.set({ [`${this.storageKey}_lastUpdated`]: timestamp });
          
          resolve(true);
        });
      });
    } catch (error) {
      this.debugLog('Error persisting opportunities:', error);
      return false;
    }
  }
  
  /**
   * Process DOM to extract opportunities
   * Must be implemented by subclasses
   * @returns {Array} Extracted opportunities
   */
  parse() {
    throw new Error('Method "parse" must be implemented by subclass');
  }
  
  /**
   * Initialize the scraper
   * Must be implemented by subclasses
   * @returns {Promise<boolean>} Success status
   */
  async initialize() {
    throw new Error('Method "initialize" must be implemented by subclass');
  }
  
  /**
   * Main entry point for the scraper
   * Must be implemented by subclasses
   * @returns {Promise<boolean>} Success status
   */
  async init() {
    throw new Error('Method "init" must be implemented by subclass');
  }
}

// Export the base scraper class
// Expose the BaseScraper to the global window object for Manifest V3 CSP compatibility
window.BaseScraper = BaseScraper;

// Log initialization success
console.log('BaseScraper class loaded and exposed to window.BaseScraper');