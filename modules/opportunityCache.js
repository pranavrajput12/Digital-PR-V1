/**
 * Opportunity Cache for SourceBottle Extension
 * Manages cached opportunity analysis results to avoid redundant API calls
 * Uses content-based similarity detection to identify opportunities with similar content
 */

class OpportunityCache {
  constructor() {
    // Cache of analyzed opportunities
    this.cache = new Map();
    
    // Maximum cache size
    this.maxCacheSize = 200;
    
    // Minimum text similarity threshold for reusing analysis (0.0-1.0)
    this.similarityThreshold = 0.85;
  }
  
  /**
   * Generate a fingerprint for an opportunity's content
   * @param {Object} opportunity - The opportunity to fingerprint
   * @returns {string} - A normalized fingerprint of the opportunity's content
   */
  _getContentFingerprint(opportunity) {
    if (!opportunity) return '';
    
    // Extract core content
    const title = (opportunity.title || '').trim().toLowerCase();
    const description = (opportunity.description || '').trim().toLowerCase();
    
    // Combine with higher weight for title
    return `${title} ${description} ${description}`;
  }
  
  /**
   * Calculate text similarity between two strings (Jaccard similarity)
   * @param {string} text1 - First text
   * @param {string} text2 - Second text
   * @returns {number} - Similarity score between 0 and 1
   */
  _calculateTextSimilarity(text1, text2) {
    if (!text1 || !text2) return 0;
    
    // Extract words from each text
    const getWords = (text) => {
      // Remove common punctuation and split into words
      return text.toLowerCase()
        .replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, ' ')
        .split(/\s+/)
        .filter(word => word.length > 2); // Only consider words longer than 2 chars
    };
    
    const words1 = new Set(getWords(text1));
    const words2 = new Set(getWords(text2));
    
    // Empty texts should not be considered similar
    if (words1.size === 0 || words2.size === 0) return 0;
    
    // Calculate intersection
    const intersection = new Set([...words1].filter(word => words2.has(word)));
    
    // Calculate union
    const union = new Set([...words1, ...words2]);
    
    // Jaccard similarity: size of intersection divided by size of union
    return intersection.size / union.size;
  }
  
  /**
   * Find a similar opportunity in the cache
   * @param {Object} opportunity - Opportunity to find similar match for
   * @returns {Object|null} - Similar cached opportunity analysis or null if none found
   */
  findSimilarOpportunity(opportunity) {
    if (!opportunity) return null;
    
    const fingerprint = this._getContentFingerprint(opportunity);
    
    // Check each cached opportunity for similarity
    for (const [cachedId, cachedData] of this.cache.entries()) {
      const similarity = this._calculateTextSimilarity(
        fingerprint,
        cachedData.fingerprint
      );
      
      // If similarity exceeds threshold, return the cached analysis
      if (similarity >= this.similarityThreshold) {
        console.log(`Found similar opportunity (${similarity.toFixed(2)} similarity): ${cachedId}`);
        
        // Return a copy of the cached analysis with similarity info added
        return {
          ...cachedData.analysis,
          reused_from: cachedId,
          similarity_score: similarity,
          cached_at: cachedData.timestamp
        };
      }
    }
    
    return null;
  }
  
  /**
   * Cache analysis results for an opportunity
   * @param {Object} opportunity - The analyzed opportunity
   * @param {Object} analysis - Analysis results
   */
  cacheOpportunityAnalysis(opportunity, analysis) {
    if (!opportunity || !opportunity.id || !analysis) return;
    
    const id = opportunity.id;
    const fingerprint = this._getContentFingerprint(opportunity);
    
    // Manage cache size
    if (this.cache.size >= this.maxCacheSize) {
      // Get the oldest 20% of entries and remove them
      const entries = Array.from(this.cache.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp)
        .slice(0, Math.floor(this.maxCacheSize * 0.2));
      
      entries.forEach(([key]) => this.cache.delete(key));
    }
    
    // Store in cache
    this.cache.set(id, {
      fingerprint,
      analysis: {...analysis},
      timestamp: Date.now()
    });
  }
  
  /**
   * Get the number of cached opportunity analyses
   * @returns {number} - Number of cached analyses
   */
  get size() {
    return this.cache.size;
  }
  
  /**
   * Clear all cached analyses
   */
  clear() {
    this.cache.clear();
  }
}

// Create a singleton instance and assign to window global for Chrome Extension CSP compliance
const opportunityCache = new OpportunityCache();
window.opportunityCache = opportunityCache;
