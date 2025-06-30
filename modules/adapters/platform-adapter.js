/**
 * Platform Adapter Module
 * Normalizes opportunities from different platforms into a consistent format
 * for storage and display in the UI
 */
import { explainInvisibility, logDroppedOpportunity } from '../utils/debug.js';
import { REQUIRED_FIELDS, ARRAY_FIELDS, DEFAULT_VALUES } from '../models/Opportunity.js';

/**
 * Normalizes an opportunity from a specific platform into a standard format
 * @param {Object} item - The raw opportunity item from the scraper
 * @param {string} platform - The platform name (e.g., 'qwoted', 'sourcebottle')
 * @returns {Object} - Normalized opportunity object with consistent field structure
 */
export function normalizeOpportunity(item, platform) {
  if (!item) return null;

  // Create normalized opportunity with default values
  const normalized = {
    // Required fields
    title: null,
    description: null,
    url: null,
    externalId: null,
    source: platform || 'unknown',
    
    // Optional fields with defaults
    tags: [],
    category: DEFAULT_VALUES.category,
    scrapedAt: new Date().toISOString(),
    
    // Optional fields without defaults
    deadline: null,
    postedTime: null,
    mediaOutlet: null,
    hasExpertRequest: DEFAULT_VALUES.hasExpertRequest
  };

  // Platform-specific normalization
  if (platform === 'qwoted') {
    normalized.title = item.title?.trim() || item.pitchTitle?.trim() || item.brandName?.trim() || null;
    normalized.description = item.description?.trim() || null;
    normalized.url = item.url || null;
    normalized.deadline = item.deadline || null;
    normalized.postedTime = item.postedTime || null;
    normalized.tags = Array.isArray(item.tags) ? item.tags : (item.tags ? [item.tags] : []);
    normalized.externalId = item.externalId || null;
    normalized.category = item.category || 'General';
    normalized.mediaOutlet = item.mediaOutlet || item.brandName || 'Not specified';
    normalized.brandName = item.brandName || null;
  } 
  else if (platform === 'sourcebottle') {
    normalized.title = item.title?.trim() || null;
    normalized.description = item.description?.trim() || null;
    normalized.url = item.url || null;
    normalized.deadline = item.deadline || null;
    normalized.postedTime = item.postedTime || item.publishedDate || null;
    normalized.tags = Array.isArray(item.tags) ? item.tags : (item.tags ? [item.tags] : []);
    normalized.externalId = item.externalId || null;
    normalized.category = item.category || 'General';
    normalized.mediaOutlet = item.mediaOutlet || 'SourceBottle';
  }
  // Add other platforms as needed

  return normalized;
}

/**
 * Validates that an opportunity has all required fields
 * @param {Object} item - The normalized opportunity to validate
 * @returns {boolean} - True if the opportunity is valid, false otherwise
 */
export function isValidOpportunity(item) {
  if (!item) return false;
  
  // Use explainInvisibility to get the list of reasons why an item might be invalid
  const reasons = explainInvisibility(item);
  
  // Item is valid if the only reason is "Looks valid"
  return reasons.length === 1 && reasons[0] === 'Looks valid';
}

/**
 * Normalizes and validates an opportunity
 * @param {Object} item - The raw opportunity item from the scraper
 * @param {string} platform - The platform name
 * @returns {Object|null} - Normalized and validated opportunity or null if invalid
 */
export function processOpportunity(item, platform) {
  // Handle null items gracefully
  if (!item) {
    console.warn(`[${platform.toUpperCase()}] Received null item to process`);
    return null;
  }
  
  try {
    const normalized = normalizeOpportunity(item, platform);
    
    if (!normalized || !isValidOpportunity(normalized)) {
      // Use the debug utility to log dropped items with detailed reasons
      logDroppedOpportunity(item, platform);
      
      // Also log the normalized version if we have one
      if (normalized) {
        console.debug(`[${platform.toUpperCase()}] Normalized version failed validation:`,
          explainInvisibility(normalized));
      }
      
      return null;
    }
    
    return normalized;
  } catch (error) {
    console.error(`[${platform.toUpperCase()}] Error processing opportunity:`, error);
    return null;
  }
}