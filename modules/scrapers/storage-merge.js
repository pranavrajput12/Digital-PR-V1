/**
 * Storage Merge Utilities
 * 
 * Functions for merging opportunities from multiple platform sources
 * and ensuring consistent source tagging.
 */

// Use window globals for CSP compatibility - access window.logManager directly

/**
 * Merge opportunities from all sources
 * @returns {Promise<Array>} Combined array of all opportunities with source tags
 */
async function mergeAllOpportunities() {
  try {
    // Define keys for all platform opportunity storage
    const keys = [
      'sourceBottleOpportunities', 
      'featuredOpportunities', 
      'qwotedOpportunities',
      'opportunities' // Include the main opportunities storage as well
    ];
    
    // Get all data from storage
    const data = await chrome.storage.local.get(keys);
    
    // Initialize combined array
    let allOpportunities = [];
    
    // Process each key
    for (const key of keys) {
      if (Array.isArray(data[key])) {
        // Map source name from storage key
        const sourceName = key === 'opportunities' 
          ? null // Don't override source for the main storage
          : key.replace('Opportunities', '');
        
        // Add opportunities from this source with proper tagging
        const sourceOpps = data[key].map(op => {
          // Only set source if not already set and we have a source name
          const source = op.source || sourceName || 'SourceBottle'; // Default to SourceBottle
          
          return {
            ...op,
            source: source,
            // Ensure consistent ID format
            id: op.id || op.externalId || `${source.toLowerCase()}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
          };
        });
        
        allOpportunities.push(...sourceOpps);
      }
    }
    
    // Deduplicate by source + externalId
    const seen = new Set();
    const dedupedOpportunities = allOpportunities.filter(op => {
      // Create a unique key using source and externalId/id
      const idValue = op.externalId || op.id;
      const key = `${op.source}:${idValue}`;
      
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    
    window.logManager.log(`Merged ${dedupedOpportunities.length} opportunities from all sources (${allOpportunities.length} before deduplication)`);
    
    return dedupedOpportunities;
  } catch (error) {
    window.logManager.error('Error merging opportunities:', error);
    return [];
  }
}

/**
 * Save merged opportunities to the main storage
 * @param {Array} opportunities - Array of opportunities to save
 * @returns {Promise<void>}
 */
async function saveMergedOpportunities(opportunities) {
  try {
    await chrome.storage.local.set({ 'opportunities': opportunities });
    window.logManager.log(`Saved ${opportunities.length} merged opportunities to main storage`);
  } catch (error) {
    window.logManager.error('Error saving merged opportunities:', error);
    throw error;
  }
}

/**
 * Get opportunities for a specific source
 * @param {string} source - Source name (e.g., 'SourceBottle', 'Featured', 'Qwoted')
 * @returns {Promise<Array>} Opportunities from the specified source
 */
async function getSourceOpportunities(source) {
  try {
    // Normalize source name for storage key
    const storageKey = `${source.toLowerCase()}Opportunities`;
    
    // Get opportunities from storage
    const data = await chrome.storage.local.get(storageKey);
    
    return Array.isArray(data[storageKey]) ? data[storageKey] : [];
  } catch (error) {
    window.logManager.error(`Error getting ${source} opportunities:`, error);
    return [];
  }
}

/**
 * Merge and sync all opportunities to the main storage
 * @returns {Promise<Array>} Merged opportunities
 */
async function syncAllOpportunities() {
  const merged = await mergeAllOpportunities();
  await saveMergedOpportunities(merged);
  return merged;
}

// Export removed for Manifest V3 CSP compliance - using window.storageUtils instead

// Expose storage utilities to window global object for Manifest V3 CSP compatibility
try {
  // Add a safety delay to ensure DOM is fully ready
  setTimeout(() => {
    window.storageUtils = {
      mergeAllOpportunities,
      saveMergedOpportunities,
      getSourceOpportunities,
      syncAllOpportunities
    };
    
    // Set a flag to indicate storage utils are loaded
    window.storageUtilsLoaded = true;
    
    // Log initialization
    console.log('💬 [QWOTED DEBUG] Storage merge utilities initialized and exposed to window.storageUtils');
    
    // Dispatch an event for content scripts to know storageUtils is ready
    document.dispatchEvent(new CustomEvent('storage-utils-ready', { 
      detail: { success: true } 
    }));
  }, 100); // Small delay to ensure window object is accessible
} catch (error) {
  console.error('💬 [QWOTED ERROR] Failed to expose storage utils to window:', error);
}