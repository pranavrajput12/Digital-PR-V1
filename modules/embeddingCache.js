/**
 * Embedding Cache Module
 * Provides efficient storage and retrieval of embeddings with memory limits
 * Implements LRU (Least Recently Used) eviction policy to prevent memory leaks
 */

// Create the embedding cache
const embeddingCache = (() => {
  // Internal cache state
  const state = {
    embeddings: {}, // Main embeddings storage
    metadata: {}, // Metadata for each embedding (size, timestamp, etc.)
    maxCacheSize: 200, // Maximum cache size in MB
    currentSize: 0, // Current cache size in MB
    accessCounts: {}, // Count accesses for LRU implementation
    accessTimestamps: {}, // When each embedding was last accessed
    initialized: false, // Flag to track initialization
    vectorDimension: 1536, // Default OpenAI embedding dimension
    bytesPerFloat: 4, // Size of each float (32-bit)
    maxEmbeddingAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
    usePersistentStorage: true, // Whether to use Chrome storage for persistence
    autoCleanupInterval: 30 * 60 * 1000, // 30 minutes in milliseconds
    cleanupIntervalId: null, // ID for the cleanup interval
    cacheHits: 0, // Count cache hits for statistics
    cacheMisses: 0, // Count cache misses for statistics
    evictionCount: 0, // Count how many items were evicted
    memoryErrors: 0 // Count memory-related errors
  };

  /**
   * Initialize the embedding cache
   * @param {Object} options - Configuration options
   * @returns {Promise<boolean>} - Whether initialization was successful
   */
  async function initialize(options = {}) {
    try {
      console.log('Initializing embeddings database...');

      // Apply options if provided
      if (options.maxCacheSize) state.maxCacheSize = options.maxCacheSize;
      if (options.vectorDimension) state.vectorDimension = options.vectorDimension;
      if (options.usePersistentStorage !== undefined) state.usePersistentStorage = options.usePersistentStorage;
      if (options.maxEmbeddingAge) state.maxEmbeddingAge = options.maxEmbeddingAge;

      // Calculate size of a single embedding vector in bytes
      const singleEmbeddingSize = state.vectorDimension * state.bytesPerFloat;
      console.log(`Each embedding requires ${(singleEmbeddingSize / 1024).toFixed(2)}KB of memory`);

      // Load embeddings from storage if enabled
      if (state.usePersistentStorage) {
        await loadFromStorage();
      }

      // Set up automatic cleanup interval
      if (state.cleanupIntervalId) {
        clearInterval(state.cleanupIntervalId);
      }

      state.cleanupIntervalId = setInterval(() => {
        cleanExpiredEmbeddings();
      }, state.autoCleanupInterval);

      state.initialized = true;
      console.log('Embeddings database initialized successfully');

      // Log initial cache statistics
      const stats = getCacheStats();
      console.log(`Initial cache stats: ${stats.count} embeddings, ${stats.size.toFixed(2)}MB used (${stats.percentUsed.toFixed(1)}% of limit)`);

      return true;
    } catch (error) {
      console.error('Error initializing embedding cache:', error);
      state.memoryErrors++;
      state.initialized = false;
      return false;
    }
  }

  /**
   * Load embeddings from Chrome storage
   * @returns {Promise<void>}
   */
  async function loadFromStorage() {
    return new Promise((resolve, reject) => {
      try {
        chrome.storage.local.get(['embeddingCache'], function(result) {
          if (chrome.runtime.lastError) {
            console.error('Error loading from storage:', chrome.runtime.lastError);
            resolve(); // Continue even if loading fails
            return;
          }

          if (result.embeddingCache) {
            try {
              const cachedData = result.embeddingCache;

              // Reset cache state
              state.embeddings = {};
              state.metadata = {};
              state.accessCounts = {};
              state.accessTimestamps = {};
              state.currentSize = 0;

              // Load embeddings with validation
              if (cachedData.embeddings) {
                // Calculate current timestamp for age validation
                const now = Date.now();
                const maxAge = state.maxEmbeddingAge;
                const keysToLoad = Object.keys(cachedData.embeddings);

                // Filter out expired embeddings
                let validCount = 0;
                let expiredCount = 0;

                keysToLoad.forEach(key => {
                  const metadata = cachedData.metadata && cachedData.metadata[key];
                  
                  // Skip if no metadata or embedding is expired
                  if (!metadata || (now - metadata.timestamp > maxAge)) {
                    expiredCount++;
                    return;
                  }

                  // Add valid embedding to cache
                  state.embeddings[key] = cachedData.embeddings[key];
                  state.metadata[key] = metadata;
                  state.accessCounts[key] = (cachedData.accessCounts && cachedData.accessCounts[key]) || 1;
                  state.accessTimestamps[key] = (cachedData.accessTimestamps && cachedData.accessTimestamps[key]) || now;
                  state.currentSize += metadata.size || 0;
                  validCount++;
                });

                console.log(`Loaded ${validCount} embeddings from storage, skipped ${expiredCount} expired embeddings`);
              }

              // Check if we exceeded the maximum cache size
              if (state.currentSize > state.maxCacheSize) {
                console.warn(`Cache size (${state.currentSize.toFixed(2)}MB) exceeds limit (${state.maxCacheSize}MB), running cleanup`);
                trimCache(state.maxCacheSize * 0.75); // Trim to 75% of max
              }
            } catch (error) {
              console.error('Error parsing stored embedding cache:', error);
              // Reset cache on error
              state.embeddings = {};
              state.metadata = {};
              state.accessCounts = {};
              state.accessTimestamps = {};
              state.currentSize = 0;
            }
          } else {
            console.log('No embedding cache found in storage');
          }

          resolve();
        });
      } catch (error) {
        console.error('Error in loadFromStorage:', error);
        state.memoryErrors++;
        resolve(); // Continue even if there's an error
      }
    });
  }

  /**
   * Save embeddings to Chrome storage
   * @returns {Promise<void>}
   */
  async function saveToStorage() {
    return new Promise((resolve, reject) => {
      try {
        if (!state.usePersistentStorage) {
          resolve();
          return;
        }

        // Create a snapshot of the current cache state
        const cacheSnapshot = {
          embeddings: { ...state.embeddings },
          metadata: { ...state.metadata },
          accessCounts: { ...state.accessCounts },
          accessTimestamps: { ...state.accessTimestamps },
          stats: {
            size: state.currentSize,
            count: Object.keys(state.embeddings).length,
            timestamp: Date.now()
          }
        };

        // Save to chrome.storage
        chrome.storage.local.set({ 'embeddingCache': cacheSnapshot }, function() {
          if (chrome.runtime.lastError) {
            console.error('Error saving embedding cache:', chrome.runtime.lastError);
            reject(chrome.runtime.lastError);
            return;
          }
          console.log(`Saved ${Object.keys(state.embeddings).length} embeddings to storage (${state.currentSize.toFixed(2)}MB)`);
          resolve();
        });
      } catch (error) {
        console.error('Error in saveToStorage:', error);
        state.memoryErrors++;
        resolve(); // Continue even if there's an error
      }
    });
  }

  /**
   * Store an embedding in the cache
   * @param {string} key - Unique identifier for the embedding
   * @param {Array|Float32Array} embedding - The embedding vector
   * @returns {boolean} - Whether the operation was successful
   */
  function storeEmbedding(key, embedding) {
    if (!state.initialized) {
      console.warn('Cannot store embedding: cache not initialized');
      return false;
    }

    if (!key || !embedding) {
      console.error('Invalid key or embedding');
      return false;
    }

    try {
      // Calculate embedding size in MB
      const embeddingSize = (embedding.length * state.bytesPerFloat) / (1024 * 1024);

      // Check if we need to make room in the cache
      const projectedSize = state.currentSize + embeddingSize;
      if (projectedSize > state.maxCacheSize) {
        console.warn(`Adding embedding would exceed cache limit (${projectedSize.toFixed(2)}MB > ${state.maxCacheSize}MB), running cleanup`);
        trimCache(state.maxCacheSize * 0.75); // Trim to 75% of max
      }

      // Store the embedding
      state.embeddings[key] = embedding;
      state.metadata[key] = {
        size: embeddingSize,
        timestamp: Date.now(),
        dimension: embedding.length
      };
      state.accessCounts[key] = 1;
      state.accessTimestamps[key] = Date.now();
      state.currentSize += embeddingSize;

      // Save to storage if close to full
      if (state.currentSize > state.maxCacheSize * 0.9) {
        saveToStorage();
      }

      return true;
    } catch (error) {
      console.error('Error storing embedding:', error);
      state.memoryErrors++;
      return false;
    }
  }

  /**
   * Retrieve an embedding from the cache
   * @param {string} key - Unique identifier for the embedding
   * @returns {Array|null} - The embedding vector or null if not found
   */
  function getEmbedding(key) {
    if (!state.initialized) {
      console.warn('Cannot retrieve embedding: cache not initialized');
      state.cacheMisses++;
      return null;
    }

    if (!key) {
      console.error('Invalid key');
      state.cacheMisses++;
      return null;
    }

    try {
      const embedding = state.embeddings[key];
      if (!embedding) {
        state.cacheMisses++;
        return null;
      }

      // Update access metadata
      state.accessCounts[key] = (state.accessCounts[key] || 0) + 1;
      state.accessTimestamps[key] = Date.now();
      state.cacheHits++;

      return embedding;
    } catch (error) {
      console.error('Error retrieving embedding:', error);
      state.memoryErrors++;
      state.cacheMisses++;
      return null;
    }
  }

  /**
   * Check if an embedding exists in the cache
   * @param {string} key - Unique identifier for the embedding
   * @returns {boolean} - Whether the embedding exists
   */
  function hasEmbedding(key) {
    if (!state.initialized || !key) {
      return false;
    }

    return !!state.embeddings[key];
  }

  /**
   * Remove an embedding from the cache
   * @param {string} key - Unique identifier for the embedding
   * @returns {boolean} - Whether the operation was successful
   */
  function removeEmbedding(key) {
    if (!state.initialized) {
      console.warn('Cannot remove embedding: cache not initialized');
      return false;
    }

    if (!key || !state.embeddings[key]) {
      return false;
    }

    try {
      // Subtract size from current cache size
      if (state.metadata[key]) {
        state.currentSize -= state.metadata[key].size || 0;
      }

      // Remove from cache
      delete state.embeddings[key];
      delete state.metadata[key];
      delete state.accessCounts[key];
      delete state.accessTimestamps[key];

      return true;
    } catch (error) {
      console.error('Error removing embedding:', error);
      state.memoryErrors++;
      return false;
    }
  }

  /**
   * Clear all embeddings from the cache
   * @returns {boolean} - Whether the operation was successful
   */
  function clearCache() {
    if (!state.initialized) {
      console.warn('Cannot clear cache: not initialized');
      return false;
    }

    try {
      // Reset all cache state
      state.embeddings = {};
      state.metadata = {};
      state.accessCounts = {};
      state.accessTimestamps = {};
      state.currentSize = 0;

      // Save empty cache to storage
      if (state.usePersistentStorage) {
        saveToStorage();
      }

      console.log('Embedding cache cleared');
      return true;
    } catch (error) {
      console.error('Error clearing embedding cache:', error);
      state.memoryErrors++;
      return false;
    }
  }

  /**
   * Trim the cache to a specified size by removing least recently used embeddings
   * @param {number} targetSizeMB - Target size in MB
   * @returns {boolean} - Whether the operation was successful
   */
  function trimCache(targetSizeMB) {
    if (!state.initialized) {
      console.warn('Cannot trim cache: not initialized');
      return false;
    }

    if (typeof targetSizeMB !== 'number' || targetSizeMB <= 0) {
      targetSizeMB = state.maxCacheSize * 0.75; // Default to 75% of max
    }

    try {
      // If we're already below target, no need to trim
      if (state.currentSize <= targetSizeMB) {
        return true;
      }

      console.log(`Trimming embedding cache from ${state.currentSize.toFixed(2)}MB to ${targetSizeMB.toFixed(2)}MB`);

      // Get all keys and sort by last access time (oldest first)
      const allKeys = Object.keys(state.embeddings);
      allKeys.sort((a, b) => {
        return (state.accessTimestamps[a] || 0) - (state.accessTimestamps[b] || 0);
      });

      // Remove embeddings until we're below target size
      let removedCount = 0;
      for (const key of allKeys) {
        if (state.currentSize <= targetSizeMB) {
          break;
        }

        if (removeEmbedding(key)) {
          removedCount++;
          state.evictionCount++;
        }
      }

      console.log(`Removed ${removedCount} embeddings, new cache size: ${state.currentSize.toFixed(2)}MB`);

      // Save updated cache to storage
      if (state.usePersistentStorage && removedCount > 0) {
        saveToStorage();
      }

      return true;
    } catch (error) {
      console.error('Error trimming embedding cache:', error);
      state.memoryErrors++;
      return false;
    }
  }

  /**
   * Clean expired embeddings from the cache
   * @returns {boolean} - Whether the operation was successful
   */
  function cleanExpiredEmbeddings() {
    if (!state.initialized) {
      console.warn('Cannot clean cache: not initialized');
      return false;
    }

    try {
      const now = Date.now();
      const maxAge = state.maxEmbeddingAge;
      const allKeys = Object.keys(state.embeddings);
      let removedCount = 0;

      for (const key of allKeys) {
        const metadata = state.metadata[key];
        if (metadata && (now - metadata.timestamp > maxAge)) {
          if (removeEmbedding(key)) {
            removedCount++;
          }
        }
      }

      if (removedCount > 0) {
        console.log(`Removed ${removedCount} expired embeddings, new cache size: ${state.currentSize.toFixed(2)}MB`);
        
        // Save updated cache to storage
        if (state.usePersistentStorage) {
          saveToStorage();
        }
      }

      return true;
    } catch (error) {
      console.error('Error cleaning expired embeddings:', error);
      state.memoryErrors++;
      return false;
    }
  }

  /**
   * Get cache statistics
   * @returns {Object} - Cache statistics
   */
  function getCacheStats() {
    const count = Object.keys(state.embeddings).length;
    const percentUsed = (state.currentSize / state.maxCacheSize) * 100;
    
    return {
      initialized: state.initialized,
      count,
      size: state.currentSize,
      maxSize: state.maxCacheSize,
      percentUsed,
      hits: state.cacheHits,
      misses: state.cacheMisses,
      hitRate: state.cacheHits + state.cacheMisses > 0 ? 
        (state.cacheHits / (state.cacheHits + state.cacheMisses)) * 100 : 0,
      evictions: state.evictionCount,
      errors: state.memoryErrors
    };
  }

  /**
   * Set the maximum cache size
   * @param {number} maxSizeMB - Maximum cache size in MB
   * @returns {boolean} - Whether the operation was successful
   */
  function setMaxCacheSize(maxSizeMB) {
    if (typeof maxSizeMB !== 'number' || maxSizeMB <= 0) {
      console.error('Invalid maximum cache size');
      return false;
    }

    state.maxCacheSize = maxSizeMB;
    console.log(`Maximum cache size set to ${maxSizeMB}MB`);

    // If current size exceeds new max, trim the cache
    if (state.currentSize > state.maxCacheSize) {
      trimCache(state.maxCacheSize * 0.75);
    }

    return true;
  }

  /**
   * Set the maximum embedding age
   * @param {number} maxAgeMs - Maximum age in milliseconds
   * @returns {boolean} - Whether the operation was successful
   */
  function setMaxEmbeddingAge(maxAgeMs) {
    if (typeof maxAgeMs !== 'number' || maxAgeMs <= 0) {
      console.error('Invalid maximum embedding age');
      return false;
    }

    state.maxEmbeddingAge = maxAgeMs;
    console.log(`Maximum embedding age set to ${maxAgeMs}ms (${(maxAgeMs / (24 * 60 * 60 * 1000)).toFixed(1)} days)`);

    // Clean expired embeddings with new age limit
    cleanExpiredEmbeddings();

    return true;
  }

  // Public API
  return {
    initialize,
    storeEmbedding,
    getEmbedding,
    hasEmbedding,
    removeEmbedding,
    clearCache,
    trimCache,
    cleanExpiredEmbeddings,
    getCacheStats,
    setMaxCacheSize,
    setMaxEmbeddingAge,
    saveToStorage
  };
})();

// Expose as window global
window.embeddingCache = embeddingCache;

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = embeddingCache;
}
