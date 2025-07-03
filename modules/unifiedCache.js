/**
 * Unified Cache System
 * Consolidates all caching functionality into a single, well-organized module
 * Replaces: embeddingCache.js, opportunityCache.js, similarityCache.js, and parts of cacheOptimizer.js
 */

// Initialize logger reference
let logManager = null;
if (typeof window !== 'undefined' && window.logManager) {
  logManager = window.logManager;
}

// Logging helper function
function log(level, message, data) {
  if (logManager && typeof logManager[level] === 'function') {
    logManager[level](`[UnifiedCache] ${message}`, data);
  } else {
    const consoleMethod = console[level] || console.log;
    consoleMethod(`[UnifiedCache] ${message}`, data || '');
  }
}

/**
 * Unified Cache Manager
 * Provides different cache types with consistent APIs and shared memory management
 */
class UnifiedCacheManager {
  constructor() {
    // Cache types
    this.caches = {
      embeddings: new EmbeddingCache(),
      opportunities: new OpportunityCache(),
      similarity: new SimilarityCache(),
      storage: new StorageCache(),
      general: new GeneralCache()
    };

    // Global cache settings
    this.config = {
      totalMemoryLimit: 500, // MB
      defaultTTL: 3600000, // 1 hour in milliseconds
      cleanupInterval: 300000, // 5 minutes
      persistentStorage: true,
      compressionEnabled: false // Future feature
    };

    // Memory monitoring
    this.memoryMonitor = {
      enabled: true,
      warningThreshold: 300, // MB
      criticalThreshold: 450, // MB
      lastCheck: Date.now(),
      checkInterval: 30000 // 30 seconds
    };

    // Statistics
    this.stats = {
      totalHits: 0,
      totalMisses: 0,
      totalEvictions: 0,
      memoryErrors: 0,
      lastReset: Date.now()
    };

    // Cleanup interval
    this.cleanupIntervalId = null;
    this.memoryCheckIntervalId = null;

    // Initialize the cache system
    this.initialize();
  }

  /**
   * Initialize the unified cache system
   * @param {Object} options - Configuration options
   * @returns {Promise<boolean>} - Whether initialization was successful
   */
  async initialize(options = {}) {
    try {
      log('log', 'Initializing unified cache system');

      // Apply configuration options
      Object.assign(this.config, options);

      // Initialize all cache types
      for (const [type, cache] of Object.entries(this.caches)) {
        try {
          await cache.initialize(this.config);
          log('log', `${type} cache initialized successfully`);
        } catch (error) {
          log('error', `Failed to initialize ${type} cache:`, error);
        }
      }

      // Start cleanup interval
      this.startCleanupInterval();

      // Start memory monitoring
      this.startMemoryMonitoring();

      log('log', 'Unified cache system initialized successfully');
      return true;
    } catch (error) {
      log('error', 'Failed to initialize unified cache system:', error);
      return false;
    }
  }

  /**
   * Get cache by type
   * @param {string} type - Cache type (embeddings, opportunities, similarity, storage, general)
   * @returns {Object} - Cache instance
   */
  getCache(type) {
    if (!this.caches[type]) {
      throw new Error(`Unknown cache type: ${type}`);
    }
    return this.caches[type];
  }

  /**
   * Get current memory usage across all caches
   * @returns {Promise<number>} - Memory usage in MB
   */
  async getTotalMemoryUsage() {
    let totalMemory = 0;
    for (const cache of Object.values(this.caches)) {
      try {
        totalMemory += await cache.getMemoryUsage();
      } catch (error) {
        log('warn', 'Error getting memory usage for cache:', error);
      }
    }
    return totalMemory;
  }

  /**
   * Clear all caches
   * @returns {Promise<void>}
   */
  async clearAll() {
    log('log', 'Clearing all caches');
    for (const [type, cache] of Object.entries(this.caches)) {
      try {
        await cache.clear();
        log('log', `${type} cache cleared`);
      } catch (error) {
        log('error', `Error clearing ${type} cache:`, error);
      }
    }
    this.resetStats();
  }

  /**
   * Get cache statistics
   * @returns {Object} - Cache statistics
   */
  getStats() {
    const individualStats = {};
    for (const [type, cache] of Object.entries(this.caches)) {
      if (typeof cache.getStats === 'function') {
        individualStats[type] = cache.getStats();
      }
    }

    return {
      global: this.stats,
      individual: individualStats,
      memoryUsage: this.getTotalMemoryUsage(),
      uptime: Date.now() - this.stats.lastReset
    };
  }

  /**
   * Reset statistics
   * @private
   */
  resetStats() {
    this.stats = {
      totalHits: 0,
      totalMisses: 0,
      totalEvictions: 0,
      memoryErrors: 0,
      lastReset: Date.now()
    };
  }

  /**
   * Start cleanup interval
   * @private
   */
  startCleanupInterval() {
    if (this.cleanupIntervalId) {
      clearInterval(this.cleanupIntervalId);
    }

    this.cleanupIntervalId = setInterval(async () => {
      await this.performCleanup();
    }, this.config.cleanupInterval);
  }

  /**
   * Start memory monitoring
   * @private
   */
  startMemoryMonitoring() {
    if (this.memoryCheckIntervalId) {
      clearInterval(this.memoryCheckIntervalId);
    }

    this.memoryCheckIntervalId = setInterval(async () => {
      await this.checkMemoryUsage();
    }, this.memoryMonitor.checkInterval);
  }

  /**
   * Perform cleanup across all caches
   * @private
   */
  async performCleanup() {
    try {
      for (const [type, cache] of Object.entries(this.caches)) {
        if (typeof cache.cleanup === 'function') {
          await cache.cleanup();
        }
      }
    } catch (error) {
      log('error', 'Error during cleanup:', error);
    }
  }

  /**
   * Check memory usage and perform emergency cleanup if needed
   * @private
   */
  async checkMemoryUsage() {
    try {
      const totalMemory = await this.getTotalMemoryUsage();

      if (totalMemory > this.memoryMonitor.criticalThreshold) {
        log('warn', `Critical memory usage: ${totalMemory}MB, performing emergency cleanup`);
        await this.performEmergencyCleanup();
      } else if (totalMemory > this.memoryMonitor.warningThreshold) {
        log('warn', `High memory usage: ${totalMemory}MB, performing preventive cleanup`);
        await this.performPreventiveCleanup();
      }
    } catch (error) {
      log('error', 'Error checking memory usage:', error);
    }
  }

  /**
   * Perform emergency cleanup
   * @private
   */
  async performEmergencyCleanup() {
    // Clear least important caches first
    const cleanupOrder = ['general', 'similarity', 'storage', 'opportunities', 'embeddings'];
    
    for (const cacheType of cleanupOrder) {
      const cache = this.caches[cacheType];
      if (cache && typeof cache.emergencyCleanup === 'function') {
        await cache.emergencyCleanup();
        
        // Check if we're under threshold
        const currentMemory = await this.getTotalMemoryUsage();
        if (currentMemory < this.memoryMonitor.warningThreshold) {
          break;
        }
      }
    }
  }

  /**
   * Perform preventive cleanup
   * @private
   */
  async performPreventiveCleanup() {
    for (const cache of Object.values(this.caches)) {
      if (typeof cache.preventiveCleanup === 'function') {
        await cache.preventiveCleanup();
      }
    }
  }

  /**
   * Destroy the cache system
   */
  destroy() {
    if (this.cleanupIntervalId) {
      clearInterval(this.cleanupIntervalId);
    }
    if (this.memoryCheckIntervalId) {
      clearInterval(this.memoryCheckIntervalId);
    }

    for (const cache of Object.values(this.caches)) {
      if (typeof cache.destroy === 'function') {
        cache.destroy();
      }
    }

    log('log', 'Unified cache system destroyed');
  }
}

/**
 * Base Cache Class
 * Provides common functionality for all cache types
 */
class BaseCache {
  constructor(type) {
    this.type = type;
    this.data = new Map();
    this.metadata = new Map();
    this.config = {
      maxSize: 100,
      defaultTTL: 3600000, // 1 hour
      maxMemoryMB: 50
    };
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0
    };
  }

  /**
   * Initialize the cache
   * @param {Object} globalConfig - Global cache configuration
   */
  async initialize(globalConfig) {
    // Apply global config
    if (globalConfig.defaultTTL) {
      this.config.defaultTTL = globalConfig.defaultTTL;
    }
    
    // Load from persistent storage if enabled
    if (globalConfig.persistentStorage) {
      await this.loadFromStorage();
    }

    log('log', `${this.type} cache initialized`);
  }

  /**
   * Get item from cache
   * @param {string} key - Cache key
   * @returns {any} - Cached value or null
   */
  get(key) {
    const item = this.data.get(key);
    const meta = this.metadata.get(key);

    if (!item || !meta) {
      this.stats.misses++;
      return null;
    }

    // Check TTL
    if (meta.expires && Date.now() > meta.expires) {
      this.delete(key);
      this.stats.misses++;
      return null;
    }

    // Update access time
    meta.lastAccessed = Date.now();
    meta.accessCount++;
    this.metadata.set(key, meta);

    this.stats.hits++;
    return item;
  }

  /**
   * Set item in cache
   * @param {string} key - Cache key
   * @param {any} value - Value to cache
   * @param {number} ttl - Time to live in milliseconds
   */
  set(key, value, ttl = null) {
    const expires = ttl ? Date.now() + ttl : Date.now() + this.config.defaultTTL;
    const meta = {
      created: Date.now(),
      lastAccessed: Date.now(),
      expires: expires,
      accessCount: 1,
      size: this.calculateSize(value)
    };

    this.data.set(key, value);
    this.metadata.set(key, meta);

    // Check size limits
    this.enforceMemoryLimits();
  }

  /**
   * Delete item from cache
   * @param {string} key - Cache key
   */
  delete(key) {
    this.data.delete(key);
    this.metadata.delete(key);
  }

  /**
   * Clear all items from cache
   */
  clear() {
    this.data.clear();
    this.metadata.clear();
    log('log', `${this.type} cache cleared`);
  }

  /**
   * Get cache statistics
   * @returns {Object} - Cache statistics
   */
  getStats() {
    return {
      ...this.stats,
      size: this.data.size,
      memoryUsage: this.getMemoryUsage()
    };
  }

  /**
   * Get memory usage in MB
   * @returns {number} - Memory usage in MB
   */
  getMemoryUsage() {
    let totalSize = 0;
    for (const meta of this.metadata.values()) {
      totalSize += meta.size;
    }
    return totalSize / (1024 * 1024); // Convert to MB
  }

  /**
   * Calculate approximate size of a value in bytes
   * @param {any} value - Value to measure
   * @returns {number} - Size in bytes
   */
  calculateSize(value) {
    try {
      return JSON.stringify(value).length * 2; // Rough estimate (UTF-16)
    } catch {
      return 100; // Default estimate for non-serializable objects
    }
  }

  /**
   * Enforce memory limits by evicting old items
   * @private
   */
  enforceMemoryLimits() {
    const currentMemory = this.getMemoryUsage();
    
    if (currentMemory > this.config.maxMemoryMB) {
      this.evictOldItems();
    }

    if (this.data.size > this.config.maxSize) {
      this.evictOldItems();
    }
  }

  /**
   * Evict old items using LRU policy
   * @private
   */
  evictOldItems() {
    const entries = Array.from(this.metadata.entries())
      .sort((a, b) => a[1].lastAccessed - b[1].lastAccessed); // Oldest first

    const itemsToEvict = Math.max(1, Math.floor(entries.length * 0.1)); // Evict 10%

    for (let i = 0; i < itemsToEvict && entries.length > 0; i++) {
      const [key] = entries[i];
      this.delete(key);
      this.stats.evictions++;
    }

    log('log', `${this.type} cache evicted ${itemsToEvict} items`);
  }

  /**
   * Cleanup expired items
   */
  async cleanup() {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [key, meta] of this.metadata.entries()) {
      if (meta.expires && now > meta.expires) {
        this.delete(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      log('log', `${this.type} cache cleaned ${cleanedCount} expired items`);
    }
  }

  /**
   * Emergency cleanup - more aggressive eviction
   */
  async emergencyCleanup() {
    const targetSize = Math.floor(this.data.size * 0.5); // Keep only 50%
    const entries = Array.from(this.metadata.entries())
      .sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);

    let evicted = 0;
    while (this.data.size > targetSize && entries.length > evicted) {
      const [key] = entries[evicted];
      this.delete(key);
      evicted++;
    }

    log('warn', `${this.type} cache emergency cleanup evicted ${evicted} items`);
    this.stats.evictions += evicted;
  }

  /**
   * Preventive cleanup - light eviction
   */
  async preventiveCleanup() {
    await this.cleanup(); // Remove expired items
    
    // If still over 80% capacity, do light eviction
    if (this.data.size > this.config.maxSize * 0.8) {
      this.evictOldItems();
    }
  }

  /**
   * Load cache from persistent storage
   * @private
   */
  async loadFromStorage() {
    // Implementation depends on storage type
    // Override in subclasses if needed
  }

  /**
   * Save cache to persistent storage
   * @private
   */
  async saveToStorage() {
    // Implementation depends on storage type
    // Override in subclasses if needed
  }
}

/**
 * Embedding Cache
 * Specialized cache for AI embeddings
 */
class EmbeddingCache extends BaseCache {
  constructor() {
    super('embeddings');
    this.config.maxSize = 200;
    this.config.maxMemoryMB = 100;
    this.config.defaultTTL = 7 * 24 * 60 * 60 * 1000; // 7 days
  }

  /**
   * Get embedding with generator fallback
   * @param {string} text - Text to get embedding for
   * @param {Function} generator - Function to generate embedding if not cached
   * @returns {Promise<Array>} - Embedding vector
   */
  async getEmbedding(text, generator) {
    const key = this.hashText(text);
    let embedding = this.get(key);

    if (!embedding && generator) {
      embedding = await generator(text);
      if (embedding) {
        this.set(key, embedding);
      }
    }

    return embedding;
  }

  /**
   * Hash text for consistent key generation
   * @param {string} text - Text to hash
   * @returns {string} - Hash key
   */
  hashText(text) {
    // Simple hash function - can be improved
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return `emb_${hash.toString(36)}`;
  }

  /**
   * Calculate size of embedding vector
   * @param {Array} embedding - Embedding vector
   * @returns {number} - Size in bytes
   */
  calculateSize(embedding) {
    if (Array.isArray(embedding)) {
      return embedding.length * 4; // 4 bytes per float32
    }
    return super.calculateSize(embedding);
  }
}

/**
 * Opportunity Cache
 * Cache for opportunity analysis results
 */
class OpportunityCache extends BaseCache {
  constructor() {
    super('opportunities');
    this.config.maxSize = 150;
    this.config.maxMemoryMB = 75;
    this.config.defaultTTL = 24 * 60 * 60 * 1000; // 24 hours
  }

  /**
   * Get cached analysis for opportunity
   * @param {Object} opportunity - Opportunity object
   * @returns {Object|null} - Cached analysis or null
   */
  getAnalysis(opportunity) {
    const key = this.generateOpportunityKey(opportunity);
    return this.get(key);
  }

  /**
   * Cache opportunity analysis
   * @param {Object} opportunity - Opportunity object
   * @param {Object} analysis - Analysis result
   */
  setAnalysis(opportunity, analysis) {
    const key = this.generateOpportunityKey(opportunity);
    this.set(key, analysis);
  }

  /**
   * Generate cache key for opportunity
   * @param {Object} opportunity - Opportunity object
   * @returns {string} - Cache key
   */
  generateOpportunityKey(opportunity) {
    const content = `${opportunity.title || ''} ${opportunity.description || ''}`;
    return `opp_${this.hashContent(content)}`;
  }

  /**
   * Hash opportunity content
   * @param {string} content - Content to hash
   * @returns {string} - Hash string
   */
  hashContent(content) {
    // Normalize content
    const normalized = content.toLowerCase().trim().replace(/\s+/g, ' ');
    
    // Simple hash
    let hash = 0;
    for (let i = 0; i < normalized.length; i++) {
      const char = normalized.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  }
}

/**
 * Similarity Cache
 * Cache for semantic similarity scores
 */
class SimilarityCache extends BaseCache {
  constructor() {
    super('similarity');
    this.config.maxSize = 500;
    this.config.maxMemoryMB = 25;
    this.config.defaultTTL = 6 * 60 * 60 * 1000; // 6 hours
  }

  /**
   * Get similarity score
   * @param {Array} vectorA - First vector
   * @param {Array} vectorB - Second vector
   * @returns {number|null} - Similarity score or null
   */
  getSimilarity(vectorA, vectorB) {
    const key = this.generateSimilarityKey(vectorA, vectorB);
    return this.get(key);
  }

  /**
   * Cache similarity score
   * @param {Array} vectorA - First vector
   * @param {Array} vectorB - Second vector
   * @param {number} score - Similarity score
   */
  setSimilarity(vectorA, vectorB, score) {
    const key = this.generateSimilarityKey(vectorA, vectorB);
    this.set(key, score);
  }

  /**
   * Generate cache key for similarity pair
   * @param {Array} vectorA - First vector
   * @param {Array} vectorB - Second vector
   * @returns {string} - Cache key
   */
  generateSimilarityKey(vectorA, vectorB) {
    // Create deterministic key regardless of parameter order
    const hashA = this.hashVector(vectorA);
    const hashB = this.hashVector(vectorB);
    const sortedHashes = [hashA, hashB].sort();
    return `sim_${sortedHashes[0]}_${sortedHashes[1]}`;
  }

  /**
   * Hash vector for key generation
   * @param {Array} vector - Vector to hash
   * @returns {string} - Hash string
   */
  hashVector(vector) {
    if (!Array.isArray(vector)) return '0';
    
    // Sample a few values for hashing (performance optimization)
    const samples = [
      vector[0] || 0,
      vector[Math.floor(vector.length / 4)] || 0,
      vector[Math.floor(vector.length / 2)] || 0,
      vector[Math.floor(3 * vector.length / 4)] || 0,
      vector[vector.length - 1] || 0
    ];
    
    let hash = 0;
    for (const sample of samples) {
      hash = ((hash << 5) - hash) + (sample * 1000); // Scale up for precision
      hash = hash & hash;
    }
    
    return hash.toString(36);
  }
}

/**
 * Storage Cache
 * Cache for Chrome storage operations
 */
class StorageCache extends BaseCache {
  constructor() {
    super('storage');
    this.config.maxSize = 100;
    this.config.maxMemoryMB = 30;
    this.config.defaultTTL = 30 * 60 * 1000; // 30 minutes
  }

  /**
   * Get from storage with caching
   * @param {string} key - Storage key
   * @param {number} ttlMinutes - Cache TTL in minutes
   * @returns {Promise<any>} - Cached or fetched value
   */
  async get(key, ttlMinutes = null) {
    const cacheKey = `storage_${key}`;
    let value = super.get(cacheKey);

    if (value === null) {
      // Fetch from Chrome storage
      value = await new Promise((resolve) => {
        chrome.storage.local.get([key], (result) => {
          if (chrome.runtime.lastError) {
            log('error', 'Storage get error:', chrome.runtime.lastError);
            resolve(null);
          } else {
            resolve(result[key]);
          }
        });
      });

      if (value !== undefined) {
        const ttl = ttlMinutes ? ttlMinutes * 60 * 1000 : this.config.defaultTTL;
        super.set(cacheKey, value, ttl);
      }
    }

    return value;
  }

  /**
   * Set to storage with caching
   * @param {string} key - Storage key
   * @param {any} value - Value to store
   * @param {number} ttlMinutes - Cache TTL in minutes
   * @returns {Promise<void>}
   */
  async set(key, value, ttlMinutes = null) {
    // Update Chrome storage
    await new Promise((resolve, reject) => {
      chrome.storage.local.set({ [key]: value }, () => {
        if (chrome.runtime.lastError) {
          log('error', 'Storage set error:', chrome.runtime.lastError);
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve();
        }
      });
    });

    // Update cache
    const cacheKey = `storage_${key}`;
    const ttl = ttlMinutes ? ttlMinutes * 60 * 1000 : this.config.defaultTTL;
    super.set(cacheKey, value, ttl);
  }

  /**
   * Get multiple keys from storage with caching
   * @param {string[]} keys - Storage keys
   * @param {number} ttlMinutes - Cache TTL in minutes
   * @returns {Promise<Object>} - Object with cached/fetched values
   */
  async getMultiple(keys, ttlMinutes = null) {
    const result = {};
    const keysToFetch = [];

    // Check cache first
    for (const key of keys) {
      const cacheKey = `storage_${key}`;
      const cachedValue = super.get(cacheKey);
      if (cachedValue !== null) {
        result[key] = cachedValue;
      } else {
        keysToFetch.push(key);
      }
    }

    // Fetch missing keys from Chrome storage
    if (keysToFetch.length > 0) {
      const storageResult = await new Promise((resolve) => {
        chrome.storage.local.get(keysToFetch, (storageData) => {
          if (chrome.runtime.lastError) {
            log('error', 'Storage getMultiple error:', chrome.runtime.lastError);
            resolve({});
          } else {
            resolve(storageData);
          }
        });
      });

      // Cache the fetched values
      const ttl = ttlMinutes ? ttlMinutes * 60 * 1000 : this.config.defaultTTL;
      for (const [key, value] of Object.entries(storageResult)) {
        result[key] = value;
        const cacheKey = `storage_${key}`;
        super.set(cacheKey, value, ttl);
      }
    }

    return result;
  }
}

/**
 * General Cache
 * For miscellaneous caching needs
 */
class GeneralCache extends BaseCache {
  constructor() {
    super('general');
    this.config.maxSize = 50;
    this.config.maxMemoryMB = 20;
    this.config.defaultTTL = 60 * 60 * 1000; // 1 hour
  }
}

// Create and expose the unified cache manager
const unifiedCache = new UnifiedCacheManager();

// Expose to window for global access
if (typeof window !== 'undefined') {
  window.unifiedCache = unifiedCache;
  
  // Maintain backward compatibility
  window.embeddingCache = unifiedCache.getCache('embeddings');
  window.opportunityCache = unifiedCache.getCache('opportunities');
  window.similarityCache = unifiedCache.getCache('similarity');
  window.storageCache = unifiedCache.getCache('storage');
}

// Export for module usage (only if using ES6 modules)
// Commented out since we're using script tags
// export { unifiedCache, UnifiedCacheManager };
// export default unifiedCache;