/**
 * Debug Utilities for Opportunity Diagnostics
 * Provides tools to diagnose issues with opportunity visibility
 */
import { REQUIRED_FIELDS, ARRAY_FIELDS } from '../models/Opportunity.js';

/**
 * Explains why an opportunity might be invisible on the Opportunities page
 * @param {Object} item - The opportunity item to check
 * @returns {string[]} - Array of reasons why the item might be invisible, or ['Looks valid']
 */
export function explainInvisibility(item) {
  if (!item) return ['Item is null or undefined'];
  
  const reasons = [];
  
  // Check required fields from our model definition
  for (const field of REQUIRED_FIELDS) {
    if (!item[field]) {
      reasons.push(`Missing ${field}`);
    } else if (item[field] === '') {
      reasons.push(`Empty ${field}`);
    }
  }
  
  // Check array fields
  for (const field of ARRAY_FIELDS) {
    if (!Array.isArray(item[field])) {
      reasons.push(`${field} is not an array`);
    }
  }
  
  // Additional checks for potential rendering issues
  if (item.description && item.description.length > 5000) {
    reasons.push('Description too long (>5000 chars)');
  }
  
  if (item.title && item.title.length > 500) {
    reasons.push('Title too long (>500 chars)');
  }
  
  return reasons.length ? reasons : ['Looks valid'];
}

/**
 * Analyzes the opportunity storage for potential issues
 * @param {string} storageKey - Storage key to analyze ('opportunities', 'qwotedOpportunities', etc.)
 * @returns {Promise<Object>} - Analysis results with statistics
 */
export function analyzeStorage(storageKey = 'opportunities') {
  return new Promise((resolve) => {
    chrome.storage.local.get([storageKey], (result) => {
      const items = result[storageKey] || [];
      console.log(`Analyzing ${items.length} items in '${storageKey}'`);
      
      // Stats to track
      const stats = {
        total: items.length,
        valid: 0,
        invalid: 0,
        bySource: {},
        byReason: {},
        samples: {
          valid: null,
          invalid: []
        }
      };
      
      // Analyze each item
      items.forEach((item, index) => {
        const reasons = explainInvisibility(item);
        const isValid = reasons.length === 1 && reasons[0] === 'Looks valid';
        
        // Track source stats
        const source = item.source || 'unknown';
        if (!stats.bySource[source]) {
          stats.bySource[source] = { total: 0, valid: 0, invalid: 0 };
        }
        stats.bySource[source].total++;
        
        if (isValid) {
          stats.valid++;
          stats.bySource[source].valid++;
          
          // Keep a sample valid item if we don't have one yet
          if (!stats.samples.valid && index < 10) {
            stats.samples.valid = item;
          }
        } else {
          stats.invalid++;
          stats.bySource[source].invalid++;
          
          // Track reason stats
          reasons.forEach(reason => {
            if (reason === 'Looks valid') return;
            stats.byReason[reason] = (stats.byReason[reason] || 0) + 1;
          });
          
          // Keep samples of invalid items (up to 3)
          if (stats.samples.invalid.length < 3) {
            stats.samples.invalid.push({
              item: { ...item },
              reasons
            });
          }
        }
      });
      
      console.log('Storage analysis complete:', stats);
      resolve(stats);
    });
  });
}

/**
 * Global diagnostic function that can be called from the console
 * Creates a diagnostic report for opportunities
 */
export function setupGlobalDiagnostics() {
  try {
    // Ensure we're in the browser context
    if (typeof window === 'undefined') {
      console.warn('Cannot setup diagnostics: not in browser context');
      return;
    }
    
    // Add debugOpportunities to window
    window.debugOpportunities = async function() {
      console.log('=== OPPORTUNITY DIAGNOSTICS ===');
      
      try {
        // Analyze main opportunities
        const mainStats = await analyzeStorage('opportunities');
        console.log('Main opportunities stats:', mainStats);
        
        // Analyze Qwoted opportunities
        const qwotedStats = await analyzeStorage('qwotedOpportunities');
        console.log('Qwoted opportunities stats:', qwotedStats);
        
        // Check for other potential opportunity storage keys
        const sourcebottleStats = await analyzeStorage('sourcebottleOpportunities');
        console.log('SourceBottle opportunities stats:', sourcebottleStats);
        
        return {
          main: mainStats,
          qwoted: qwotedStats,
          sourcebottle: sourcebottleStats,
          ui: 'Open the Opportunities page and check the console for rendering diagnostics'
        };
      } catch (error) {
        console.error('Error in diagnostics:', error);
        return { error: error.message };
      }
    };
    
    // Add fixOpportunities for browser console use
    window.fixOpportunities = async function() {
      console.log('=== ATTEMPTING TO FIX OPPORTUNITIES ===');
      
      try {
        // Get all opportunities
        const storageKeys = ['opportunities', 'qwotedOpportunities', 'sourcebottleOpportunities'];
        const allOpportunities = {};
        
        for (const key of storageKeys) {
          const result = await new Promise(resolve => chrome.storage.local.get([key], resolve));
          allOpportunities[key] = result[key] || [];
          console.log(`Found ${allOpportunities[key].length} items in ${key}`);
        }
        
        // Fixes to apply
        const fixedOpportunities = {};
        let totalFixed = 0;
        
        for (const [key, opportunities] of Object.entries(allOpportunities)) {
          fixedOpportunities[key] = opportunities.map(opp => {
            if (!opp) return null;
            
            const reasons = explainInvisibility(opp);
            const isValid = reasons.length === 1 && reasons[0] === 'Looks valid';
            
            if (isValid) return opp; // Already valid
            
            // Clone the opportunity
            const fixed = { ...opp };
            let wasFixed = false;
            
            // Apply fixes
            if (!fixed.title && fixed.pitchTitle) {
              fixed.title = fixed.pitchTitle;
              wasFixed = true;
            } else if (!fixed.title && fixed.brandName) {
              fixed.title = fixed.brandName;
              wasFixed = true;
            } else if (!fixed.title) {
              fixed.title = `Untitled ${fixed.source || 'Opportunity'}`;
              wasFixed = true;
            }
            
            if (!fixed.description) {
              fixed.description = fixed.title ? `Details for ${fixed.title}` : 'No description available';
              wasFixed = true;
            }
            
            if (!fixed.externalId) {
              fixed.externalId = `generated-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
              wasFixed = true;
            }
            
            if (!fixed.url) {
              if (fixed.source === 'Qwoted') {
                fixed.url = 'https://app.qwoted.com/source_requests';
              } else if (fixed.source === 'SourceBottle') {
                fixed.url = 'https://www.sourcebottle.com/';
              } else {
                fixed.url = 'https://example.com';
              }
              wasFixed = true;
            }
            
            if (!Array.isArray(fixed.tags)) {
              fixed.tags = fixed.tags ? [fixed.tags] : [];
              wasFixed = true;
            }
            
            if (!fixed.source) {
              fixed.source = key === 'qwotedOpportunities' ? 'Qwoted' :
                            (key === 'sourcebottleOpportunities' ? 'SourceBottle' : 'Unknown');
              wasFixed = true;
            }
            
            if (wasFixed) totalFixed++;
            
            return fixed;
          }).filter(Boolean); // Remove nulls
        }
        
        // Save fixed opportunities
        for (const [key, opportunities] of Object.entries(fixedOpportunities)) {
          if (opportunities.length > 0) {
            await new Promise(resolve => {
              chrome.storage.local.set({ [key]: opportunities }, () => {
                console.log(`Saved ${opportunities.length} items to ${key}`);
                resolve();
              });
            });
          }
        }
        
        console.log(`Fixed ${totalFixed} opportunities. Run debugOpportunities() to verify.`);
        return { totalFixed };
      } catch (error) {
        console.error('Error fixing opportunities:', error);
        return { error: error.message };
      }
    };
    
    // Verify functions were added to window
    if (typeof window.debugOpportunities === 'function' &&
        typeof window.fixOpportunities === 'function') {
      console.log('Opportunity diagnostics ready.');
      console.log('- Run window.debugOpportunities() to analyze issues');
      console.log('- Run window.fixOpportunities() to attempt automatic fixes');
    } else {
      console.warn('Failed to add diagnostic functions to window object');
    }
  } catch (error) {
    console.error('Error setting up diagnostics:', error);
  }
}

/**
 * Logger for dropped opportunities
 * @param {Object} item - The raw item being dropped
 * @param {string} platform - The platform name
 */
export function logDroppedOpportunity(item, platform) {
  // Handle null/undefined items gracefully
  if (!item) {
    console.warn(`[${platform.toUpperCase()}] Dropped null/undefined item`);
    return;
  }
  
  const reasons = explainInvisibility(item);
  console.warn(`[${platform.toUpperCase()}] Dropped invalid item:`, {
    reasons,
    item: {
      title: item.title || item.pitchTitle || 'missing',
      description: item.description ?
        (item.description.length > 50 ? item.description.substring(0, 50) + '...' : item.description) :
        'missing',
      externalId: item.externalId || 'missing',
      url: item.url || 'missing',
      source: item.source || platform
    }
  });
}