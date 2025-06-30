/**
 * AI Service Helper Module for SourceBottle Extension
 * Provides integration between aiService.js and the new caching modules
 * without requiring extensive modifications to the original aiService.js
 */

import embeddingCache from './embeddingCache.js';
import similarityCache from './similarityCache.js';
import cacheOptimizer from './cacheOptimizer.js';

class AIServiceHelper {
  constructor() {
    this.initialized = false;
    this.aiService = null;
  }

  /**
   * Initialize the helper with the AI service instance
   * @param {Object} aiService - The AIService instance to integrate with
   */
  initialize(aiService) {
    if (!aiService) {
      console.error("AI Service Helper: Cannot initialize without AIService instance");
      return false;
    }
    
    this.aiService = aiService;
    this.initialized = true;
    
    console.log("AI Service Helper initialized successfully");
    
    // Patch the required methods to add caching functionality
    this._patchMethods();
    
    return true;
  }
  
  /**
   * Patch the AIService methods to add caching functionality
   * @private
   */
  _patchMethods() {
    if (!this.initialized || !this.aiService) return;
    
    // Store original methods for use within our optimized versions
    const originalGetEmbedding = this.aiService.getEmbedding.bind(this.aiService);
    const originalCheckSemanticSimilarity = this.aiService.checkSemanticSimilarity.bind(this.aiService);
    
    // Replace the getEmbedding method with our cached version
    this.aiService.getEmbedding = async (text) => {
      return await cacheOptimizer.getOptimizedEmbedding(
        originalGetEmbedding, 
        text,
        this.aiService
      );
    };
    
    // Replace the checkSemanticSimilarity method with our cached version
    this.aiService.checkSemanticSimilarity = async (text) => {
      return await cacheOptimizer.getOptimizedSemanticSimilarity(
        originalCheckSemanticSimilarity,
        text,
        this.aiService.CANONICAL_THEMES,
        this.aiService
      );
    };
    
    // Add a method to warm up the cache with canonical themes
    this.aiService.warmupCache = async () => {
      if (!this.aiService.CANONICAL_THEMES || !Array.isArray(this.aiService.CANONICAL_THEMES)) {
        console.warn("Cannot warmup cache: Canonical themes not available");
        return 0;
      }
      
      // Create an embedding generator function
      const embeddingGenerator = async (text) => {
        // We use the original method to avoid infinite recursion
        return await originalGetEmbedding(text);
      };
      
      // Warm up the cache with canonical themes
      return await cacheOptimizer.warmupCache(
        this.aiService.CANONICAL_THEMES,
        embeddingGenerator
      );
    };
    
    // Add a method to get cache statistics
    this.aiService.getCacheStats = () => {
      return cacheOptimizer.getStats();
    };
    
    console.log("AI Service methods patched with caching functionality");
  }
  
  /**
   * Verify that the embedding cache is working properly
   * @returns {Promise<boolean>} - True if cache is working, false otherwise
   */
  async verifyCacheIntegration() {
    if (!this.initialized || !this.aiService) {
      return false;
    }
    
    try {
      // Test text for verification
      const testText = "This is a test text for cache verification";
      
      // First API call should miss cache and store result
      console.log("Verifying cache integration with test embedding...");
      const firstEmbed = await this.aiService.getEmbedding(testText);
      
      if (!firstEmbed || !Array.isArray(firstEmbed)) {
        console.error("Cache verification failed: First embedding generation failed");
        return false;
      }
      
      // Second call should hit cache
      const secondEmbed = await this.aiService.getEmbedding(testText);
      
      if (!secondEmbed || !Array.isArray(secondEmbed)) {
        console.error("Cache verification failed: Second embedding generation failed");
        return false;
      }
      
      // Get cache stats to verify the hit
      const stats = this.aiService.getCacheStats();
      
      // Verification passed if we had at least one cache hit
      const passed = stats && stats.cacheHits > 0;
      
      if (passed) {
        console.log("Cache integration verification passed! Cache is working properly.");
      } else {
        console.warn("Cache integration verification failed: No cache hits recorded");
      }
      
      return passed;
    } catch (error) {
      console.error("Error during cache integration verification:", error);
      return false;
    }
  }
}

// Export a singleton instance
const aiServiceHelper = new AIServiceHelper();
export default aiServiceHelper;
