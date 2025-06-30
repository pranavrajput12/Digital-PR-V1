/**
 * Unit tests for OpportunityScraper module
 */

// Import or recreate the module for testing
const scraperModule = `
  // Import the logger for error tracking
  import { logManager } from './logger.js';

  export const opportunityScraper = {
    // Configuration for scraping
    config: {
      categoryKeywords: {
        'business': ['business', 'entrepreneur', 'startup', 'finance', 'industry', 'company', 'management', 'leadership'],
        'technology': ['technology', 'tech', 'software', 'digital', 'computer', 'ai', 'artificial intelligence', 'data', 'internet', 'app'],
        'health': ['health', 'wellness', 'fitness', 'medical', 'medicine', 'doctor', 'nutrition', 'diet', 'exercise'],
        'lifestyle': ['lifestyle', 'home', 'fashion', 'style', 'decor', 'travel', 'food', 'cooking', 'recipe'],
        'parenting': ['parent', 'family', 'kid', 'child', 'baby', 'mom', 'dad', 'toddler', 'teen', 'education'],
        'entertainment': ['entertainment', 'movie', 'tv', 'television', 'film', 'music', 'celebrity', 'art', 'culture', 'book'],
        'marketing': ['marketing', 'promotion', 'advertising', 'market', 'brand', 'social media', 'campaign'],
        'research': ['research', 'study', 'survey', 'science', 'academic', 'university', 'college', 'professor']
      },
      opportunityElements: {
        container: '.opportunity-container, .opportunity-item, .card-opportunity',
        title: '.opportunity-title, .card-title, h3',
        description: '.opportunity-description, .card-text, p',
        date: '.opportunity-date, .card-date, .date',
        category: '.opportunity-category, .card-category, .category',
        link: 'a.opportunity-link, a.card-link, a.apply-link'
      }
    },
    
    // Initialize with custom configuration
    initialize: function(customConfig = {}) {
      this.config = { 
        ...this.config, 
        ...customConfig,
        categoryKeywords: { ...this.config.categoryKeywords, ...(customConfig.categoryKeywords || {}) },
        opportunityElements: { ...this.config.opportunityElements, ...(customConfig.opportunityElements || {}) }
      };
      
      return this;
    },
    
    // Extract opportunities from the current page
    extractOpportunitiesFromPage: function() {
      try {
        logManager.log('Extracting opportunities from current page');
        
        // Find all opportunity elements
        const opportunityElements = document.querySelectorAll(this.config.opportunityElements.container);
        logManager.log(\`Found \${opportunityElements.length} opportunity elements\`);
        
        if (opportunityElements.length === 0) {
          logManager.warn('No opportunity elements found on page');
          return [];
        }
        
        // Extract data from each element
        const opportunities = Array.from(opportunityElements).map(element => {
          try {
            return this.extractOpportunityFromElement(element);
          } catch (error) {
            logManager.error('Error extracting opportunity from element:', error);
            return null;
          }
        }).filter(opp => opp !== null);
        
        logManager.log(\`Successfully extracted \${opportunities.length} opportunities\`);
        return opportunities;
      } catch (error) {
        logManager.error('Error extracting opportunities from page:', error);
        return [];
      }
    },
    
    // Extract opportunity data from a single element
    extractOpportunityFromElement: function(element) {
      // Extract basic data
      const title = this.getTextContent(element, this.config.opportunityElements.title);
      const description = this.getTextContent(element, this.config.opportunityElements.description);
      const date = this.getTextContent(element, this.config.opportunityElements.date);
      const category = this.getTextContent(element, this.config.opportunityElements.category);
      
      // Extract submission link
      let submissionLink = '';
      const linkElement = element.querySelector(this.config.opportunityElements.link);
      if (linkElement) {
        submissionLink = linkElement.href || '';
      }
      
      // Extract external ID (using URL or a combination of title and description)
      let externalId = '';
      if (submissionLink) {
        const urlParams = new URLSearchParams(new URL(submissionLink).search);
        externalId = urlParams.get('id') || '';
      }
      
      if (!externalId && title) {
        // Use first 20 chars of title + first 10 chars of description as fallback ID
        const titlePart = title.slice(0, 20).trim();
        const descPart = description ? description.slice(0, 10).trim() : '';
        externalId = \`\${titlePart}:\${descPart}\`.replace(/\\s+/g, '-');
      }
      
      // Determine inferred category if none provided
      const inferredCategory = category || this.inferCategoryFromText(title + ' ' + description);
      
      // Extract media outlet and journalist info if available
      const mediaOutlet = this.extractMediaOutlet(description);
      const journalist = this.extractJournalist(description);
      
      // Build opportunity object
      const opportunity = {
        title,
        description,
        date,
        deadline: this.extractDeadline(description) || date,
        category: inferredCategory,
        submissionLink,
        externalId,
        source: 'sourcebottle',
        mediaOutlet,
        journalist,
        keywords: this.extractKeywords(title + ' ' + description),
        extractedAt: new Date().toISOString()
      };
      
      return opportunity;
    },
    
    // Helper to safely get text content from element
    getTextContent: function(element, selector) {
      const targetElement = element.querySelector(selector);
      return targetElement ? targetElement.textContent.trim() : '';
    },
    
    // Infer category based on text content
    inferCategoryFromText: function(text) {
      if (!text) return 'uncategorized';
      
      text = text.toLowerCase();
      
      // Check each category's keywords
      const categories = Object.keys(this.config.categoryKeywords);
      const categoryScores = {};
      
      // Calculate score for each category
      categories.forEach(category => {
        const keywords = this.config.categoryKeywords[category];
        let score = 0;
        
        keywords.forEach(keyword => {
          const regex = new RegExp('\\\\b' + keyword + '\\\\b', 'gi');
          const matches = text.match(regex);
          if (matches) {
            score += matches.length;
          }
        });
        
        categoryScores[category] = score;
      });
      
      // Find category with highest score
      let highestCategory = 'uncategorized';
      let highestScore = 0;
      
      Object.keys(categoryScores).forEach(category => {
        if (categoryScores[category] > highestScore) {
          highestScore = categoryScores[category];
          highestCategory = category;
        }
      });
      
      // Only use inferred category if we have some matches
      return highestScore > 0 ? highestCategory : 'uncategorized';
    },
    
    // Extract deadline from text
    extractDeadline: function(text) {
      if (!text) return null;
      
      // Common deadline patterns
      const patterns = [
        /deadline\\s*:?\\s*(\\d{1,2}\\s*[a-zA-Z]+\\s*\\d{4})/i,
        /due\\s*:?\\s*(\\d{1,2}\\s*[a-zA-Z]+\\s*\\d{4})/i,
        /by\\s*:?\\s*(\\d{1,2}\\s*[a-zA-Z]+\\s*\\d{4})/i,
        /closes\\s*:?\\s*(\\d{1,2}\\s*[a-zA-Z]+\\s*\\d{4})/i,
        /closing date\\s*:?\\s*(\\d{1,2}\\s*[a-zA-Z]+\\s*\\d{4})/i
      ];
      
      // Try each pattern
      for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
          return match[1];
        }
      }
      
      return null;
    },
    
    // Extract media outlet from text
    extractMediaOutlet: function(text) {
      if (!text) return '';
      
      // Common patterns for media outlet mentions
      const patterns = [
        /for\\s+([A-Z][A-Za-z0-9\\s&]+?)\\s+(?:magazine|publication|newspaper|blog|website|podcast|outlet)/i,
        /([A-Z][A-Za-z0-9\\s&]+?)\\s+(?:magazine|publication|newspaper|blog|website|podcast|outlet)\\s+is\\s+looking/i,
        /([A-Z][A-Za-z0-9\\s&]+?)\\s+needs/i
      ];
      
      // Try each pattern
      for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
          return match[1].trim();
        }
      }
      
      return '';
    },
    
    // Extract journalist from text
    extractJournalist: function(text) {
      if (!text) return '';
      
      // Common patterns for journalist mentions
      const patterns = [
        /(?:journalist|writer|editor|reporter)\\s+([A-Z][A-Za-z\\s-]+?)\\s+is/i,
        /([A-Z][A-Za-z\\s-]+?),\\s+(?:journalist|writer|editor|reporter)/i
      ];
      
      // Try each pattern
      for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
          return match[1].trim();
        }
      }
      
      return '';
    },
    
    // Extract keywords from text
    extractKeywords: function(text) {
      if (!text) return [];
      
      const keywords = [];
      const lowercaseText = text.toLowerCase();
      
      // Check all categories for keyword matches
      Object.keys(this.config.categoryKeywords).forEach(category => {
        this.config.categoryKeywords[category].forEach(keyword => {
          if (lowercaseText.includes(keyword) && !keywords.includes(keyword)) {
            keywords.push(keyword);
          }
        });
      });
      
      // Limit to top 5 keywords
      return keywords.slice(0, 5);
    }
  };
`;

// Mock LogManager
const loggerModuleMock = `
  export const logManager = {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  };
`;

// Create modules in memory
const loggerModuleURL = 'blob:' + URL.createObjectURL(new Blob([loggerModuleMock], { type: 'application/javascript' }));
const moduleURL = 'blob:' + URL.createObjectURL(new Blob([scraperModule], { type: 'application/javascript' }));
let opportunityScraper;
let logManager;

// Mock imports
jest.mock('./logger.js', () => ({
  logManager: {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}), { virtual: true });

// Mock document methods
const mockQuerySelector = jest.fn();
const mockQuerySelectorAll = jest.fn();

describe('Opportunity Scraper Module', () => {
  beforeAll(async () => {
    // Import the test module
    const loggerModule = await import(loggerModuleURL);
    logManager = loggerModule.logManager;
    
    const module = await import(moduleURL);
    opportunityScraper = module.opportunityScraper;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup document mock
    global.document = {
      querySelector: mockQuerySelector,
      querySelectorAll: mockQuerySelectorAll
    };
  });

  test('initialize should merge custom configuration', () => {
    // Arrange
    const customConfig = {
      categoryKeywords: {
        'custom': ['test1', 'test2'],
        'technology': ['custom-tech', 'custom-digital'] // Override existing
      },
      opportunityElements: {
        container: '.custom-container'
      }
    };
    
    // Act
    opportunityScraper.initialize(customConfig);
    
    // Assert
    expect(opportunityScraper.config.categoryKeywords.custom).toEqual(['test1', 'test2']);
    expect(opportunityScraper.config.categoryKeywords.technology).toContain('custom-tech');
    expect(opportunityScraper.config.opportunityElements.container).toBe('.custom-container');
    // Original values should be preserved
    expect(opportunityScraper.config.categoryKeywords.business).toBeDefined();
  });

  test('extractOpportunitiesFromPage should handle empty results', () => {
    // Arrange
    mockQuerySelectorAll.mockReturnValueOnce([]);
    
    // Act
    const result = opportunityScraper.extractOpportunitiesFromPage();
    
    // Assert
    expect(result).toEqual([]);
    expect(logManager.warn).toHaveBeenCalledWith('No opportunity elements found on page');
  });

  test('extractOpportunitiesFromPage should extract from elements', () => {
    // Arrange
    const mockElement1 = {
      querySelector: jest.fn(selector => {
        if (selector === opportunityScraper.config.opportunityElements.title) {
          return { textContent: 'Test Opportunity 1' };
        } else if (selector === opportunityScraper.config.opportunityElements.description) {
          return { textContent: 'This is a test opportunity about technology.' };
        } else if (selector === opportunityScraper.config.opportunityElements.date) {
          return { textContent: '01 May 2025' };
        } else if (selector === opportunityScraper.config.opportunityElements.category) {
          return { textContent: 'Technology' };
        } else if (selector === opportunityScraper.config.opportunityElements.link) {
          return { href: 'https://example.com/opportunity?id=123' };
        }
        return null;
      })
    };
    
    const mockElement2 = {
      querySelector: jest.fn(selector => {
        if (selector === opportunityScraper.config.opportunityElements.title) {
          return { textContent: 'Test Opportunity 2' };
        } else if (selector === opportunityScraper.config.opportunityElements.description) {
          return { textContent: 'A business opportunity with deadline: 15 June 2025.' };
        } else if (selector === opportunityScraper.config.opportunityElements.date) {
          return { textContent: '10 May 2025' };
        } else if (selector === opportunityScraper.config.opportunityElements.link) {
          return { href: 'https://example.com/opportunity?id=456' };
        }
        return null;
      })
    };
    
    mockQuerySelectorAll.mockReturnValueOnce([mockElement1, mockElement2]);
    
    // Mock URL constructor
    global.URL = jest.fn(url => ({
      search: url.split('?')[1] || ''
    }));
    
    global.URLSearchParams = jest.fn(search => ({
      get: param => {
        if (param === 'id' && search === 'id=123') return '123';
        if (param === 'id' && search === 'id=456') return '456';
        return null;
      }
    }));
    
    // Act
    const result = opportunityScraper.extractOpportunitiesFromPage();
    
    // Assert
    expect(result.length).toBe(2);
    expect(result[0].title).toBe('Test Opportunity 1');
    expect(result[0].category).toBe('Technology');
    expect(result[0].externalId).toBe('123');
    
    expect(result[1].title).toBe('Test Opportunity 2');
    expect(result[1].category).toBe('business');
    expect(result[1].deadline).toBe('15 June 2025');
    expect(result[1].externalId).toBe('456');
    
    expect(logManager.log).toHaveBeenCalledWith('Successfully extracted 2 opportunities');
  });

  test('inferCategoryFromText should identify categories based on keywords', () => {
    // Reset config to original
    opportunityScraper.initialize();
    
    // Act & Assert
    expect(opportunityScraper.inferCategoryFromText('This is about technology and software')).toBe('technology');
    expect(opportunityScraper.inferCategoryFromText('Health and wellness tips')).toBe('health');
    expect(opportunityScraper.inferCategoryFromText('Business startup advice')).toBe('business');
    expect(opportunityScraper.inferCategoryFromText('No relevant keywords here')).toBe('uncategorized');
    expect(opportunityScraper.inferCategoryFromText('')).toBe('uncategorized');
  });

  test('extractDeadline should identify deadlines in text', () => {
    // Act & Assert
    expect(opportunityScraper.extractDeadline('Deadline: 15 June 2025')).toBe('15 June 2025');
    expect(opportunityScraper.extractDeadline('The deadline is 20 July 2025')).toBe('20 July 2025');
    expect(opportunityScraper.extractDeadline('Please submit by 1 August 2025')).toBe('1 August 2025');
    expect(opportunityScraper.extractDeadline('This opportunity closes 10 September 2025')).toBe('10 September 2025');
    expect(opportunityScraper.extractDeadline('The closing date 5 October 2025')).toBe('5 October 2025');
    expect(opportunityScraper.extractDeadline('No deadline mentioned')).toBeNull();
  });

  test('extractMediaOutlet should identify media outlets in text', () => {
    // Act & Assert
    expect(opportunityScraper.extractMediaOutlet('Looking for experts for Tech Magazine publication')).toBe('Tech Magazine');
    expect(opportunityScraper.extractMediaOutlet('The Daily News outlet is looking for sources')).toBe('The Daily News');
    expect(opportunityScraper.extractMediaOutlet('Business Weekly needs experts')).toBe('Business Weekly');
    expect(opportunityScraper.extractMediaOutlet('No media outlet mentioned')).toBe('');
  });

  test('extractJournalist should identify journalists in text', () => {
    // Act & Assert
    expect(opportunityScraper.extractJournalist('Journalist Jane Smith is looking for experts')).toBe('Jane Smith');
    expect(opportunityScraper.extractJournalist('John Johnson, journalist at Daily News')).toBe('John Johnson');
    expect(opportunityScraper.extractJournalist('No journalist mentioned')).toBe('');
  });

  test('extractKeywords should find relevant keywords in text', () => {
    // Act
    const keywords = opportunityScraper.extractKeywords('Looking for technology experts to discuss artificial intelligence and data science for a business publication');
    
    // Assert
    expect(keywords).toContain('technology');
    expect(keywords).toContain('ai');
    expect(keywords).toContain('data');
    expect(keywords).toContain('business');
  });
});
