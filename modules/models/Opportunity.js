/**
 * Opportunity Model
 * 
 * This file defines the expected structure of opportunity objects
 * throughout the application. All platforms should normalize their
 * scraped data to match this structure.
 */

/**
 * @typedef {Object} Opportunity
 * @property {string} title - The title/headline of the opportunity
 * @property {string} description - The detailed description of the opportunity
 * @property {string} url - URL to view the full opportunity details
 * @property {string} externalId - Unique identifier from the source platform
 * @property {string[]} tags - Array of tags/keywords associated with the opportunity
 * @property {string} source - Source platform name (e.g., 'qwoted', 'sourcebottle')
 * @property {string} [deadline] - Optional deadline date (ISO format preferred)
 * @property {string} [postedTime] - Optional posting date (ISO format preferred)
 * @property {string} [category] - Optional category classification
 * @property {string} [mediaOutlet] - Optional media outlet or brand name
 * @property {boolean} [hasExpertRequest] - Optional flag for expert requests
 * @property {string} [scrapedAt] - Timestamp when the opportunity was scraped
 */

/**
 * Expected fields that must be present for an opportunity to be valid and visible
 * in the UI.
 * 
 * @type {string[]}
 */
export const REQUIRED_FIELDS = [
  'title',
  'description',
  'url',
  'externalId',
  'source'
];

/**
 * Fields that should be arrays, even if empty
 * 
 * @type {string[]}
 */
export const ARRAY_FIELDS = [
  'tags'
];

/**
 * Default values for optional fields
 * 
 * @type {Object}
 */
export const DEFAULT_VALUES = {
  tags: [],
  category: 'General',
  hasExpertRequest: false
};

/**
 * Create a new opportunity object with default values
 * 
 * @returns {Opportunity} A new opportunity object with default values
 */
export function createEmptyOpportunity() {
  return {
    title: '',
    description: '',
    url: '',
    externalId: '',
    tags: [],
    source: '',
    category: 'General',
    scrapedAt: new Date().toISOString()
  };
}

export default {
  REQUIRED_FIELDS,
  ARRAY_FIELDS,
  DEFAULT_VALUES,
  createEmptyOpportunity
};