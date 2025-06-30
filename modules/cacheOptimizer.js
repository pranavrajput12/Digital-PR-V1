/**
 * Cache Optimizer Module
 * Provides memory monitoring and optimization for the extension
 * Implements memory usage tracking and automatic cleanup when thresholds are exceeded
 */

// Define the cache optimizer object
const cacheOptimizer = (() => {
  // Internal state
  const state = {
    memoryWarningThreshold: 350, // MB
    memoryCriticalThreshold: 500, // MB
    cleanupRunning: false,
    monitoringInterval: null,
    lastMemoryUsage: 0,
    cacheStorageKeys: ['embeddingCache', 'similarityCache', 'aiCache'],
    listenerCallbacks: [],
    monitoringEnabled: true,
    intervalTime: 30000, // Check every 30 seconds
    memoryUsageHistory: [] // Stores recent memory readings
  };

  // Add a listener for memory threshold events
  function addMemoryListener(callback) {
    if (typeof callback === 'function') {
      state.listenerCallbacks.push(callback);
      return true;
    }
    return false;
  }

  // Remove a memory listener
  function removeMemoryListener(callback) {
    const index = state.listenerCallbacks.indexOf(callback);
    if (index !== -1) {
      state.listenerCallbacks.splice(index, 1);
      return true;
    }
    return false;
  }

  // Start memory monitoring
  function startMonitoring() {
    console.log('Starting memory monitoring service');
    
    // Prevent multiple intervals
    if (state.monitoringInterval) {
      clearInterval(state.monitoringInterval);
    }
    
    // Set monitoring flag
    state.monitoringEnabled = true;
    
    // Check memory immediately on start
    checkMemoryUsage();
    
    // Set up interval for continuous monitoring
    state.monitoringInterval = setInterval(() => {
      if (state.monitoringEnabled) {
        checkMemoryUsage();
      }
    }, state.intervalTime);
  }

  // Stop memory monitoring
  function stopMonitoring() {
    console.log('Stopping memory monitoring service');
    state.monitoringEnabled = false;
    
    if (state.monitoringInterval) {
      clearInterval(state.monitoringInterval);
      state.monitoringInterval = null;
    }
  }

  // Set the memory warning threshold
  function setWarningThreshold(thresholdMB) {
    if (typeof thresholdMB === 'number' && thresholdMB > 0) {
      state.memoryWarningThreshold = thresholdMB;
      return true;
    }
    return false;
  }

  // Set the critical threshold
  function setCriticalThreshold(thresholdMB) {
    if (typeof thresholdMB === 'number' && thresholdMB > 0) {
      state.memoryCriticalThreshold = thresholdMB;
      return true;
    }
    return false;
  }

  // Check current memory usage
  function checkMemoryUsage() {
    try {
      // Use Performance API if available (Chrome, Firefox)
      if (window.performance && window.performance.memory) {
        const memoryInfo = window.performance.memory;
        const usedHeapSize = memoryInfo.usedJSHeapSize / (1024 * 1024); // Convert to MB
        
        // Store for tracking
        state.lastMemoryUsage = usedHeapSize;
        
        // Add to history, keeping last 10 readings
        state.memoryUsageHistory.push({
          timestamp: Date.now(),
          usage: usedHeapSize
        });
        
        // Keep only last 10 readings
        if (state.memoryUsageHistory.length > 10) {
          state.memoryUsageHistory.shift();
        }
        
        // Log current memory usage
        console.log(`Current memory usage: ${Math.round(usedHeapSize)}MB`);
        
        // Check against thresholds
        checkThresholds(usedHeapSize);
        
        return usedHeapSize;
      } 
      
      // Fallback for browsers without memory API - use estimation
      else {
        // Use a simple estimation based on allocated objects
        // This is not accurate but gives some insight
        let memoryEstimate = 5; // Start with 5MB baseline
        
        // Check if embeddings exist and estimate their size
        if (window.aiService && window.aiService.embeddings) {
          const embeddingCount = Object.keys(window.aiService.embeddings).length;
          // Each embedding is approximately 1536 dimensions * 4 bytes per float = ~6KB
          memoryEstimate += (embeddingCount * 0.006); // Add MB from embeddings
        }
        
        // Log estimated memory usage
        console.log(`Estimated memory usage: ${Math.round(memoryEstimate)}MB (limited accuracy)`);
        
        // Store for tracking
        state.lastMemoryUsage = memoryEstimate;
        
        // Add to history, keeping last 10 readings
        state.memoryUsageHistory.push({
          timestamp: Date.now(),
          usage: memoryEstimate
        });
        
        // Keep only last 10 readings
        if (state.memoryUsageHistory.length > 10) {
          state.memoryUsageHistory.shift();
        }
        
        // Check against thresholds
        checkThresholds(memoryEstimate);
        
        return memoryEstimate;
      }
    } catch (error) {
      console.error('Error checking memory usage:', error);
      return 0;
    }
  }

  // Check memory usage against thresholds
  function checkThresholds(memoryUsage) {
    // Determine memory usage trend
    const trend = calculateMemoryTrend();
    
    // Critical threshold breach
    if (memoryUsage >= state.memoryCriticalThreshold) {
      console.warn(`CRITICAL MEMORY USAGE: ${Math.round(memoryUsage)}MB exceeds critical threshold of ${state.memoryCriticalThreshold}MB`);
      
      // Notify listeners
      notifyListeners('critical', memoryUsage);
      
      // Perform emergency cleanup
      if (!state.cleanupRunning) {
        performEmergencyCleanup();
      }
    }
    // Warning threshold breach
    else if (memoryUsage >= state.memoryWarningThreshold) {
      console.warn(`WARNING: Memory usage (${Math.round(memoryUsage)}MB) exceeds warning threshold of ${state.memoryWarningThreshold}MB`);
      
      // Notify listeners
      notifyListeners('warning', memoryUsage);
      
      // Perform preventive cleanup if trend is upward
      if (trend === 'increasing' && !state.cleanupRunning) {
        performPreventiveCleanup();
      }
    }
    // Normal usage but rapid increase
    else if (trend === 'rapidly_increasing' && !state.cleanupRunning) {
      console.warn(`WARNING: Rapidly increasing memory usage detected (currently ${Math.round(memoryUsage)}MB)`);
      
      // Notify listeners
      notifyListeners('increasing', memoryUsage);
      
      // Perform light cleanup
      performLightCleanup();
    }
  }

  // Calculate memory usage trend based on history
  function calculateMemoryTrend() {
    if (state.memoryUsageHistory.length < 3) {
      return 'unknown'; // Not enough data
    }
    
    // Get the last 3 readings
    const recent = state.memoryUsageHistory.slice(-3);
    
    // Calculate differences
    const diff1 = recent[1].usage - recent[0].usage;
    const diff2 = recent[2].usage - recent[1].usage;
    
    // Calculate rate of change (MB per minute)
    const timeSpan1 = (recent[1].timestamp - recent[0].timestamp) / 60000; // minutes
    const timeSpan2 = (recent[2].timestamp - recent[1].timestamp) / 60000; // minutes
    
    const rate1 = diff1 / timeSpan1;
    const rate2 = diff2 / timeSpan2;
    
    // Determine trend
    if (rate1 > 0 && rate2 > 0) {
      // Both increasing
      if (rate2 > rate1 * 1.5) {
        return 'rapidly_increasing';
      }
      return 'increasing';
    } else if (rate1 < 0 && rate2 < 0) {
      return 'decreasing';
    } else if (Math.abs(rate1) < 1 && Math.abs(rate2) < 1) {
      return 'stable';
    }
    
    return 'fluctuating';
  }

  // Notify listeners of threshold events
  function notifyListeners(level, memoryUsage) {
    state.listenerCallbacks.forEach(callback => {
      try {
        callback({
          level,
          memoryUsage,
          timestamp: Date.now(),
          thresholds: {
            warning: state.memoryWarningThreshold,
            critical: state.memoryCriticalThreshold
          }
        });
      } catch (error) {
        console.error('Error in memory listener callback:', error);
      }
    });
  }

  // Perform emergency cleanup when critical threshold is exceeded
  function performEmergencyCleanup() {
    if (state.cleanupRunning) return;
    
    console.warn('Performing EMERGENCY memory cleanup');
    state.cleanupRunning = true;
    
    try {
      // 1. Clear all caches
      clearAllCaches();
      
      // 2. Force garbage collection hint (not guaranteed but worth trying)
      if (window.gc) {
        window.gc();
      }
      
      // 3. Try to release large objects
      if (window.aiService) {
        // Reset embedding cache
        if (typeof window.aiService.resetEmbeddingCache === 'function') {
          window.aiService.resetEmbeddingCache();
        }
        
        // Clear similarity cache if available
        if (typeof window.aiService.clearSimilarityCache === 'function') {
          window.aiService.clearSimilarityCache();
        }
      }
    } catch (error) {
      console.error('Error during emergency cleanup:', error);
    } finally {
      state.cleanupRunning = false;
      
      // Recheck memory after cleanup
      setTimeout(checkMemoryUsage, 1000);
    }
  }

  // Perform preventive cleanup when warning threshold is exceeded
  function performPreventiveCleanup() {
    if (state.cleanupRunning) return;
    
    console.warn('Performing preventive memory cleanup');
    state.cleanupRunning = true;
    
    try {
      // 1. Clear non-essential caches
      clearNonEssentialCaches();
      
      // 2. Try to trim large caches
      if (window.aiService) {
        // Trim embedding cache if available
        if (typeof window.aiService.trimEmbeddingCache === 'function') {
          window.aiService.trimEmbeddingCache(0.5); // Keep only 50%
        }
        
        // Trim similarity cache if available
        if (typeof window.aiService.trimSimilarityCache === 'function') {
          window.aiService.trimSimilarityCache(0.5); // Keep only 50%
        }
      }
    } catch (error) {
      console.error('Error during preventive cleanup:', error);
    } finally {
      state.cleanupRunning = false;
      
      // Recheck memory after cleanup
      setTimeout(checkMemoryUsage, 1000);
    }
  }

  // Perform light cleanup when memory is increasing rapidly
  function performLightCleanup() {
    if (state.cleanupRunning) return;
    
    console.log('Performing light memory cleanup');
    state.cleanupRunning = true;
    
    try {
      // 1. Clear expired items from caches
      if (window.aiService) {
        // Clean expired items from embedding cache
        if (typeof window.aiService.cleanExpiredEmbeddings === 'function') {
          window.aiService.cleanExpiredEmbeddings();
        }
        
        // Clean expired items from similarity cache
        if (typeof window.aiService.cleanExpiredSimilarities === 'function') {
          window.aiService.cleanExpiredSimilarities();
        }
      }
    } catch (error) {
      console.error('Error during light cleanup:', error);
    } finally {
      state.cleanupRunning = false;
    }
  }

  // Clear all caches
  function clearAllCaches() {
    try {
      // 1. Clear embedding cache
      if (window.aiService && typeof window.aiService.clearCache === 'function') {
        window.aiService.clearCache();
      }
      
      // 2. Clear localStorage caches
      state.cacheStorageKeys.forEach(key => {
        try {
          localStorage.removeItem(key);
        } catch (e) {
          console.error(`Error clearing localStorage cache for ${key}:`, e);
        }
      });
      
      // 3. Clear Chrome storage caches
      chrome.storage.local.get(state.cacheStorageKeys, (result) => {
        const keysToRemove = Object.keys(result);
        if (keysToRemove.length > 0) {
          chrome.storage.local.remove(keysToRemove, () => {
            console.log('Cleared cache keys from Chrome storage:', keysToRemove);
          });
        }
      });
      
      console.log('All caches cleared successfully');
    } catch (error) {
      console.error('Error clearing all caches:', error);
    }
  }

  // Clear non-essential caches
  function clearNonEssentialCaches() {
    try {
      // 1. Clear similarity cache but preserve embedding cache
      if (window.aiService && typeof window.aiService.clearSimilarityCache === 'function') {
        window.aiService.clearSimilarityCache();
      }
      
      // 2. Clear localStorage non-essential caches
      ['similarityCache', 'aiCache'].forEach(key => {
        try {
          localStorage.removeItem(key);
        } catch (e) {
          console.error(`Error clearing localStorage cache for ${key}:`, e);
        }
      });
      
      console.log('Non-essential caches cleared successfully');
    } catch (error) {
      console.error('Error clearing non-essential caches:', error);
    }
  }

  // Get memory usage statistics
  function getMemoryStats() {
    return {
      current: state.lastMemoryUsage,
      history: state.memoryUsageHistory,
      thresholds: {
        warning: state.memoryWarningThreshold,
        critical: state.memoryCriticalThreshold
      },
      trend: calculateMemoryTrend()
    };
  }

  // Public API
  return {
    startMonitoring,
    stopMonitoring,
    checkMemoryUsage,
    getMemoryStats,
    clearAllCaches,
    addMemoryListener,
    removeMemoryListener,
    setWarningThreshold,
    setCriticalThreshold
  };
})();

// Expose as window global
window.cacheOptimizer = cacheOptimizer;

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = cacheOptimizer;
}
