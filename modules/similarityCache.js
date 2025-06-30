/**
 * Similarity Cache Module for SourceBottle Extension
 * Caches semantic similarity scores between text and canonical themes
 * Reduces computational cost for repeated similarity checks
 */

class SimilarityCache {
  constructor() {
    // In-memory cache for quick lookups of similarity scores
    this.cache = new Map();
    
    // Size limit to prevent memory issues
    this.maxCacheSize = 1000;
    
    // Cache settings
    this.enabled = true; // Caching enabled by default
    this.ttlHours = 24; // Default TTL: 24 hours
    
    // Load cache settings
    this._loadSettings();
  }
  
  /**
   * Load cache settings from storage
   * @private
   */
  _loadSettings() {
    chrome.storage.local.get(['cacheEnabled', 'cacheTtl'], (result) => {
      if (result.cacheEnabled !== undefined) {
        this.enabled = result.cacheEnabled;
      }
      
      if (result.cacheTtl) {
        this.ttlHours = parseInt(result.cacheTtl, 10) || 24;
      }
    });
  }
  
  /**
   * Enable or disable the cache
   * @param {boolean} enabled - Whether the cache should be enabled
   */
  setEnabled(enabled) {
    this.enabled = !!enabled;
    if (!this.enabled) {
      this.clear(); // Clear cache when disabled
    }
  }
  
  /**
   * Set the cache time-to-live (TTL) in hours
   * @param {number} hours - Number of hours before cache entries expire
   */
  setTtl(hours) {
    this.ttlHours = parseInt(hours, 10) || 24;
  }
  
  /**
   * Get the current size of the cache in bytes
   * @returns {Promise<number>} - Size in bytes
   */
  async getSize() {
    let totalSize = 0;
    
    // Estimate size of each entry in the cache
    for (const [key, value] of this.cache.entries()) {
      // Key size (2 bytes per character for JavaScript strings)
      totalSize += key.length * 2;
      
      // Value size (8 bytes for number)
      totalSize += 8;
      
      // Fixed overhead per entry
      totalSize += 32;
    }
    
    return totalSize;
  }
  
  /**
   * Generate a stable cache key from text and theme
   * @private
   * @param {string} text - Input text
   * @param {string} theme - Canonical theme
   * @returns {string} - Cache key
   */
  _generateKey(text, theme) {
    // Create a stable key by sorting the two strings
    const normalizedText = text.trim().toLowerCase();
    const normalizedTheme = theme.trim().toLowerCase();
    
    // Sort to ensure (A,B) and (B,A) generate the same key
    return [normalizedText, normalizedTheme].sort().join('|||');
  }
  
  /**
   * Get cached similarity score if available
   * @param {string} text - Input text
   * @param {string} theme - Canonical theme
   * @returns {number|null} - Cached similarity score or null if not found
   */
  getSimilarity(text, theme) {
    const key = this._generateKey(text, theme);
    return this.cache.has(key) ? this.cache.get(key) : null;
  }
  
  /**
   * Store similarity score in cache
   * @param {string} text - Input text
   * @param {string} theme - Canonical theme
   * @param {number} score - Similarity score
   */
  storeSimilarity(text, theme, score) {
    // Only store numeric scores
    if (typeof score !== 'number') return;
    
    // Check if we need to clear some cache entries
    if (this.cache.size >= this.maxCacheSize) {
      // Remove random 20% of entries when cache gets full
      const keysToDelete = [...this.cache.keys()]
        .sort(() => 0.5 - Math.random())
        .slice(0, Math.floor(this.maxCacheSize * 0.2));
      
      keysToDelete.forEach(key => this.cache.delete(key));
    }
    
    const key = this._generateKey(text, theme);
    this.cache.set(key, score);
  }
  
  /**
   * Clear the entire cache
   */
  clear() {
    this.cache.clear();
  }
  
  /**
   * Get current cache size
   * @returns {number} - Number of cached similarity scores
   */
  size() {
    return this.cache.size;
  }
}

// Create and expose a singleton instance as a window global for Chrome Extension CSP compliance
const similarityCache = new SimilarityCache();
window.similarityCache = similarityCache;
