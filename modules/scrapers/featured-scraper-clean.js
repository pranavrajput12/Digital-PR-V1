/**
 * FeaturedScraper.js
 * Scraper for Featured.com
 *
 * Extracts opportunities from Featured.com questions page
 * by finding opportunity cards anchored by Answer/Skip/Save buttons
 *
 * @author SourceBottle Team
 */

// Using non-module pattern for compatibility with content script loading
// The BaseScraper, logManager and scrapers will be accessed from window globals

/**
 * FeaturedScraper - Class for scraping opportunities from Featured.com
 * Implementation without ES modules for content script compatibility
 */
class FeaturedScraper {
  /**
   * Constructor for FeaturedScraper
   */
  constructor() {
    // Initialize as if extending BaseScraper
    // BaseScraper constructor would call: super('featuredOpportunities', 'Featured')
    this.storageKey = 'featuredOpportunities';
    this.sourceName = 'Featured';
    
    this.name = 'Featured.com';
    this.opportunities = [];
    
    // Memory management - use Map with timestamps instead of unbounded Set
    this.processedIds = new Map(); // Store ID -> timestamp for memory management
    this.maxCachedIds = 5000; // Maximum number of IDs to keep in memory
    
    // Single source of truth for debug mode
    this.debugMode = true;
    this.maxScrolls = 50; // Increased to ensure we get all content with infinite scroll
    this.scrollDelay = 1000;
    this.autoPaginate = false; // Disable pagination since Featured.com uses infinite scroll
    this.pagesSinceNewContent = 0;
    this.lastContentCount = 0;
    this.lastProcessedPage = 0;
    this.pageDelay = 2000;
    this.useGridStructure = true; // Flag to try grid-based extraction
    
    // Table-based selectors for questions (with additional modern alternatives)
    this.tableSelector = 'table, tbody, div[role="table"], .data-table'; // The main table or tbody
    this.rowSelector = 'tbody tr, div[role="row"], .data-row'; // Question rows
    this.questionSelector = 'tbody tr td:nth-child(1), div[role="cell"]:nth-child(1), .question-text'; // Question column
    this.publicationSelector = 'tbody tr td:nth-child(2), div[role="cell"]:nth-child(2), .publication'; // Publication column
    this.deadlineSelector = 'tbody tr td:nth-child(3), div[role="cell"]:nth-child(3), .deadline'; // Deadline column
    this.domainAuthSelector = 'tbody tr td:nth-child(4), div[role="cell"]:nth-child(4), .domain-authority'; // Domain Authority column
    this.attributionSelector = 'tbody tr td:nth-child(5), div[role="cell"]:nth-child(5), .attribution'; // Attribution column
    this.actionsSelector = 'tbody tr td:nth-child(6), div[role="cell"]:nth-child(6), .actions'; // Actions column
    
    // Pagination selectors
    this.paginationSelector = '.pagination, nav[aria-label="pagination"]';
    this.pageLinkSelector = '.pagination a, .page-item a';
    this.activePageSelector = '.pagination .active, .page-item.active';
    this.nextPageSelector = '.pagination .next a, a[rel="next"], .page-item:last-child:not(.disabled) a';
    this.prevPageSelector = '.pagination .prev a, a[rel="prev"], .page-item:first-child:not(.disabled) a';
    
    // Card-based selectors (fallback structure with enhanced modern alternatives)
    this.cardSelector = '.card, .question-card, .opportunity-item, article, .question, .inquiry, .content-card';
    this.cardTitleSelector = '.card-title, .question-title, h3, h2, .title, .heading';
    this.cardContentSelector = '.card-content, .question-content, .description, .body, .text, p';
    this.cardDateSelector = '.card-date, .posted-date, .date, time, .timestamp, .deadline';
    this.cardTagsSelector = '.card-tags, .question-tags, .tags, .categories, .labels';
    
    // General opportunity selector (combines all possible opportunity elements)
    this.opportunitySelector = 'tbody tr, .card, .question-card, .opportunity-item, article, .question, div[role="row"], .inquiry, .content-card';
    
    // Grid-based selectors (based on page structure analysis)
    this.gridSelector = '.grid';
    this.gridItemSelector = '.grid > div';
    this.buttonSelector = 'button';
    this.linkSelector = 'a';

    /**
     * Grid item selector for questions - with fallbacks for robustness
     * @type {Array<string>}
     */
    this.gridItemSelectors = [
      // Working selectors from Instant Data Scraper
      'tr.border-b.transition-colors.hover\\:bg-muted\\/50.data-\\[state\\=selected\\]\\:bg-muted',
      '.data-table tr',
      'table > tbody > tr',
      'div#data-table tr',
      '.card',
      '.item'
    ];
    
    // Featured.com specific column indexes for data extraction
    this.columnIndexes = {
      question: 0,  // First column is usually the question
      category: 1,  // Second column is usually the category
      date: 2,      // Third column is usually the date
      status: 3     // Fourth column is usually the status
    };

    /**
     * Active grid item selector that works for current page
     * @type {string}
     */
    this.activeGridItemSelector = null;

    /**
     * Main content container selector with fallbacks
     * @type {Array<string>}
     */
    this.mainContentSelectors = [
      // Working selectors from Instant Data Scraper
      'div#data-table',
      '.data-table',
      'div.rounded-md.data-table',
      'div#main-panel',
      'div[id^="radix-"]',
      'table.w-full',
      // Original selectors as fallbacks
      '.x4iw5y6',
      'div[class^="x4i"]',
      'main',
      '#content',
      '.infinite-scroll-component',
      '.content-area'
    ];
    
    /**
     * Active main content selector that works for current page
     * @type {string}
     */
    this.activeMainContentSelector = null;
    
    /**
     * Flag to determine if infinite scroll mode should be used instead of pagination
     * @type {boolean}
     */
    this.useInfiniteScroll = false;
    
    // Debug mode and panel
    this.debugPanelCreated = false;
    
    // Pagination state
    this.currentPage = 1;
    this.maxPages = 5;
    this.isPaused = false;
  }
  
  /**
   * Generate a SHA-256 hash from the given string
   * Similar to how Instant Data Scraper generates fingerprints
   * @private
   * @param {string} str - String to hash
   * @returns {string} SHA-256 hash in hex format
   */
  async generateSHA256Hash(str) {
    // Use the SubtleCrypto API (available in secure contexts)
    try {
      // Encode the string as UTF-8
      const msgBuffer = new TextEncoder().encode(str);
      
      // Hash the message with SHA-256
      const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
      
      // Convert the hash to hex string
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      
      return hashHex;
    } catch (error) {
      console.error('SHA-256 hashing error:', error);
      
      // Fallback to simpler hash if crypto API fails
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
      }
      return hash.toString(16);
    }
  }

  /**
   * Create a snapshot of the DOM structure for fingerprinting
   * This helps detect structural changes in the page even if text content is similar
   * @private
   * @returns {string} A hash representing the DOM structure
   */
  createDomSnapshot() {
    try {
      // Target the main content area for DOM snapshot
      const container = document.querySelector(this.mainContentSelector) || document.body;
      
      if (!container) return 'empty';
      
      // Generate a simplified representation of the DOM structure
      const createNodeRepresentation = (node, depth = 0, maxDepth = 3) => {
        // Limit recursion depth for performance
        if (depth > maxDepth) return '';
        
        // Skip comment nodes and script/style tags
        if (node.nodeType === 8 || 
            (node.nodeType === 1 && ['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(node.nodeName))) {
          return '';
        }
        
        // For element nodes
        if (node.nodeType === 1) {
          const classes = Array.from(node.classList || []).join('.');
          const id = node.id ? `#${node.id}` : '';
          const attrs = node.hasAttributes() ? 
            Array.from(node.attributes)
              .filter(attr => ['id', 'class', 'data-id', 'role'].includes(attr.name))
              .map(attr => `[${attr.name}=${attr.value}]`)
              .join('') : '';
          
          // Generate a string representation of this node
          const nodeRep = `${node.nodeName.toLowerCase()}${id}${classes ? `.${classes}` : ''}${attrs}`;
          
          // Process child nodes
          let childrenRep = '';
          if (node.childElementCount > 0) {
            for (let i = 0; i < Math.min(node.childElementCount, 10); i++) {
              childrenRep += createNodeRepresentation(node.children[i], depth + 1, maxDepth);
            }
          }
          
          // Include the count of children if large
          const childCount = node.childElementCount > 10 ? `(+${node.childElementCount - 10})` : '';
          
          return `${nodeRep}${childCount}${childrenRep}`;
        }
        
        return '';
      };
      
      // Create the DOM snapshot
      const domSnapshot = createNodeRepresentation(container);
      
      // For performance reasons, limit the snapshot size
      const limitedSnapshot = domSnapshot.substring(0, 10000);
      
      // Return a simple hash of the snapshot
      let hash = 0;
      for (let i = 0; i < limitedSnapshot.length; i++) {
        const char = limitedSnapshot.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
      }
      
      return hash.toString(16);
    } catch (error) {
      console.error('Error creating DOM snapshot:', error);
      return 'error-snapshot';
    }
  }

  /**
   * Generate a fingerprint of the current content to track page changes
   * Enhanced with SHA-256 hashing similar to Instant Data Scraper
   * @private
   * @returns {string} Fingerprint representing the current page content
   */
  generateContentFingerprint() {
    // Use main container element as source for fingerprinting if available
    const mainContainer = document.querySelector(this.activeMainContentSelector || this.mainContentSelectors[0]) || document;
    
    if (!mainContainer) return 'empty'; // Safety check
    
    // Get active selector or fall back to first one in the array
    const activeSelector = this.activeGridItemSelector || this.gridItemSelectors[0];
    
    // Get all grid items on the page
    const gridItems = Array.from(mainContainer.querySelectorAll(activeSelector) || []);
    
    // If no grid items, use main container text as fingerprint
    if (!gridItems.length) {
      const mainText = mainContainer.textContent.trim().substring(0, 1000);
      // Use a simpler hash method for immediate synchronous result
      let hash = 0;
      for (let i = 0; i < mainText.length; i++) {
        const char = mainText.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
      }
      return hash.toString(16);
    }
    
    // Generate fingerprint from item IDs and text content
    const fingerprintData = gridItems
      .map(item => {
        const titleEl = item.querySelector('.title') || item.querySelector('h3') || item;
        const title = titleEl ? titleEl.textContent.trim() : '';
        
        // Try to find a unique ID for the item
        const id = item.id || item.dataset.id || '';
        
        // Include position information for better fingerprinting
        const itemIndex = Array.from(mainContainer.querySelectorAll(activeSelector)).indexOf(item);
        
        // Include more properties for better identification
        const descEl = item.querySelector('.description') || item.querySelector('p');
        const description = descEl ? descEl.textContent.trim().substring(0, 100) : '';
        
        return `${id}:${title}:${description}:${itemIndex}`;
      })
      .join('|');
    
    // Use simpler hash for synchronous result
    let hash = 0;
    for (let i = 0; i < fingerprintData.length; i++) {
      const char = fingerprintData.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    
    return hash.toString(16);
  }

  /**
   * Get logger function - with fallback to console if logManager is not available
   * @returns {Object} logger functions
   */
  getLogger() {
    if (window.logManager) {
      return window.logManager;
    } else {
      return {
        log: (msg) => console.log('🔍 [FEATURED]', msg),
        debug: (msg) => console.debug('🔍 [FEATURED]', msg),
        error: (msg, err) => console.error('🔍 [FEATURED]', msg, err),
        warn: (msg) => console.warn('🔍 [FEATURED]', msg)
      };
    }
  }
  
  /**
   * Log an error message
   * @param {string} message - Error message
   * @param {Error} [error] - Optional error object 
   */
  errorLog(message, error) {
    this.getLogger().error(message, error);
  }
  
  /**
   * Debug log helper - logs to console if debug mode is enabled
   * Uses consistent logging format with logManager when available
   * @param {string} message - Message to log
   * @param {Error} [error] - Optional error object
   */
  debugLog(message, error = null) {
    if (this.debugMode) {
      if (error) {
        this.getLogger().debug(message, error);
      } else {
        this.getLogger().log(message);
      }
    }
  }
  
  /**
   * Required abstract method implementation from BaseScraper
   * @override
   */
  async init() {
    this.debugLog('Initializing Featured.com scraper');
    
    // Create debug panel if it doesn't exist
    if (!document.getElementById('featured-debug-panel')) {
      this._createDebugPanel();
      this.debugPanelCreated = true;
    }
    
    // Add scraper button to the UI
    this.addScraperButton();
  }

  /**
   * Create debug panel for displaying scraper status and logs
   * @private
   */
  _createDebugPanel() {
    try {
      // Check if panel already exists
      if (document.getElementById('featured-debug-panel')) {
        return;
      }
      
      // Create the debug panel container
      const debugPanel = document.createElement('div');
      debugPanel.id = 'featured-debug-panel';
      debugPanel.style.cssText = `
        position: fixed;
        bottom: 10px;
        right: 10px;
        width: 350px;
        max-height: 400px;
        background-color: rgba(0, 0, 0, 0.8);
        color: #fff;
        font-family: monospace;
        font-size: 12px;
        padding: 10px;
        border-radius: 5px;
        z-index: 9999;
        overflow-y: auto;
        box-shadow: 0 0 10px rgba(0, 0, 0, 0.5);
        display: none;
      `;
      
      // Create header for the debug panel
      const header = document.createElement('div');
      header.innerHTML = `<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; border-bottom: 1px solid #555;">
        <div style="font-weight: bold; font-size: 14px;">Featured.com Scraper Debug</div>
        <div>
          <button id="featured-debug-close" style="background: none; border: none; color: #fff; cursor: pointer;">✖</button>
        </div>
      </div>`;
      debugPanel.appendChild(header);
      
      // Create sections for status, logs, and errors
      const statusSection = document.createElement('div');
      statusSection.id = 'featured-debug-status';
      statusSection.innerHTML = '<div style="font-weight: bold; margin-bottom: 5px;">Status:</div>';
      debugPanel.appendChild(statusSection);
      
      const logSection = document.createElement('div');
      logSection.id = 'featured-debug-log';
      logSection.innerHTML = '<div style="font-weight: bold; margin-bottom: 5px; margin-top: 10px;">Logs:</div>';
      debugPanel.appendChild(logSection);
      
      const errorSection = document.createElement('div');
      errorSection.id = 'featured-debug-errors';
      errorSection.innerHTML = '<div style="font-weight: bold; margin-bottom: 5px; margin-top: 10px;">Errors:</div>';
      debugPanel.appendChild(errorSection);
      
      // Add to DOM
      document.body.appendChild(debugPanel);
      
      // Add event listeners
      document.getElementById('featured-debug-close').addEventListener('click', () => {
        debugPanel.style.display = 'none';
      });
      
      this.debugLog('Debug panel created');
      return debugPanel;
    } catch (error) {
      console.error('🔍 [FEATURED] Error creating debug panel:', error);
      return null;
    }
  }
  
  /**
   * Update the debug panel with new information
   * @param {string} section - Section to update (status, log, errors)
   * @param {string} content - HTML content to add
   * @param {boolean} append - Whether to append or replace content
   */
  updateDebugPanel(section, content, append = false) {
    try {
      const panel = document.getElementById('featured-debug-panel');
      if (!panel) return;
      
      // Make sure panel is visible
      panel.style.display = 'block';
      
      // Update the specified section
      const sectionEl = document.getElementById(`featured-debug-${section}`);
      if (sectionEl) {
        if (append) {
          sectionEl.innerHTML += content;
        } else {
          // Keep the section header
          const header = sectionEl.querySelector('div:first-child');
          sectionEl.innerHTML = '';
          if (header) sectionEl.appendChild(header);
          sectionEl.innerHTML += content;
        }
      }
    } catch (error) {
      console.error('🔍 [FEATURED] Error updating debug panel:', error);
    }
  }
  
  /**
   * Temporarily highlight an element on the page for visual feedback
   * @param {HTMLElement} element - Element to highlight
   * @param {number} duration - Duration in ms to show the highlight
   */
  highlightElement(element, duration = 2000) {
    try {
      if (!element) return;
      
      // Store original styles
      const originalOutline = element.style.outline;
      const originalBoxShadow = element.style.boxShadow;
      const originalPosition = element.style.position;
      const originalZIndex = element.style.zIndex;
      
      // Apply highlight
      element.style.outline = '2px solid #0f0';
      element.style.boxShadow = '0 0 10px rgba(0, 255, 0, 0.7)';
      element.style.position = element.style.position || 'relative';
      element.style.zIndex = '999'; // Ensure it's visible
      
      // Restore original styles after specified duration
      setTimeout(() => {
        element.style.outline = originalOutline;
        element.style.boxShadow = originalBoxShadow;
        element.style.position = originalPosition;
        element.style.zIndex = originalZIndex;
      }, duration);
      
    } catch (error) {
      console.error('🔍 [FEATURED] Error highlighting element:', error);
    }
  }
  
  /**
   * Add a scraper button to the Featured.com UI
   * Simplified to only include the main scraper button
   */
  addScraperButton() {
    try {
      this.debugLog('Detecting best selectors for this page...');
      this.updateDebugPanel('status', '<div>Detecting best content selectors...</div>');
      
      // Try to find main content container
      for (const selector of this.mainContentSelectors) {
        try {
          const container = document.querySelector(selector);
          if (container) {
            this.activeMainContentSelector = selector;
            this.debugLog(`Found main content container with selector: ${selector}`);
            
            // Highlight the container for visual confirmation
            if (this.debug) {
              this.highlightElement(container, 1000);
            }
            break;
          }
        } catch (error) {
          this.debugLog(`Invalid main content selector skipped: ${selector}`);
          console.warn(`🔍 [FEATURED] Invalid main content selector skipped: ${selector}`, error);
        }
      }
      
      // If no main content container found, use document
      if (!this.activeMainContentSelector) {
        this.activeMainContentSelector = 'body';
        this.debugLog('No main content container found, using body');
      }
      
      // Try to find grid items
      let bestSelector = null;
      let maxItems = 0;
      
      for (const selector of this.gridItemSelectors) {
        try {
          const items = document.querySelectorAll(selector);
          if (items && items.length > maxItems) {
            maxItems = items.length;
            bestSelector = selector;
            this.debugLog(`Found ${items.length} items with selector: ${selector}`);
            
            // Highlight the first few items for visual confirmation
            if (items.length > 0 && this.debug) {
              this.highlightElement(items[0]);
              if (items.length > 1) this.highlightElement(items[1]);
            }
          }
        } catch (error) {
          this.debugLog(`Invalid selector skipped: ${selector}`);
          console.warn(`🔍 [FEATURED] Invalid selector skipped: ${selector}`, error);
        }
      }
      
      // Use the selector that found the most items
      if (bestSelector && maxItems > 0) {
        this.activeGridItemSelector = bestSelector;
        this.gridItemSelector = bestSelector; // For backward compatibility
        this.debugLog(`Using grid item selector: ${bestSelector} (found ${maxItems} items)`);
      } else {
        // Fallback to original selector if none worked
        this.activeGridItemSelector = this.gridItemSelectors[0];
        this.gridItemSelector = this.gridItemSelectors[0];
        this.debugLog('No grid items found with any selector, using default');
      }
      
      // Detect if the page uses infinite scroll
      this.detectInfiniteScroll();
      
      return maxItems > 0;
    } catch (error) {
      console.error('Error detecting best selectors:', error);
      return false;
    }
  }

  /**
   * Detect if the page uses infinite scroll
   */
  detectInfiniteScroll() {
    // Check if the page has a next button
    const nextPageButton = document.querySelector(this.nextPageSelector);
    
    // Check if there's an infinite scroll container
    const hasInfiniteScrollContainer = document.querySelector('.infinite-scroll-component') || 
                                       document.querySelector('[data-testid="infinite-scroll"]') ||
                                       document.querySelector('.load-more');
    
    // Look for common infinite scroll indicators in the DOM
    const hasInfiniteScrollClass = Array.from(document.querySelectorAll('*'))
      .some(el => Array.from(el.classList || [])
        .some(cls => cls.toLowerCase().includes('infinite') || cls.toLowerCase().includes('scroll')));
    
    // Default to infinite scroll if no next button but has scroll indicators
    this.useInfiniteScroll = (!nextPageButton && (hasInfiniteScrollContainer || hasInfiniteScrollClass));
    
    this.debugLog(`Infinite scroll detection: ${this.useInfiniteScroll ? 'Enabled' : 'Disabled'}`);
  }

  /**
   * Cycle through available selectors to try different content structures
   * Similar to Instant Data Scraper's "Try another table" feature
   */
  cycleBestSelectors() {
    try {
      // Get current index of active grid item selector
      const currentIndex = this.gridItemSelectors.indexOf(this.activeGridItemSelector);
      let nextIndex;
      
      if (currentIndex === -1 || currentIndex >= this.gridItemSelectors.length - 1) {
        nextIndex = 0;
      } else {
        nextIndex = currentIndex + 1;
      }
      
      // Set the next selector as active
      this.activeGridItemSelector = this.gridItemSelectors[nextIndex];
      this.gridItemSelector = this.activeGridItemSelector; // For backward compatibility
      
      // Get count of items found with new selector
      const items = document.querySelectorAll(this.activeGridItemSelector);
      const count = items ? items.length : 0;
      
      this.debugLog(`Switched to selector: ${this.activeGridItemSelector} (found ${count} items)`);
      this.updateDebugPanel('status', `<div>Trying selector: ${this.activeGridItemSelector} - found ${count} items</div>`);
      
      // Highlight found items for visual feedback
      items.forEach(item => this.highlightElement(item));
      
      return count;
    } catch (error) {
      console.error('Error cycling selectors:', error);
      return 0;
    }
  }

  /**
   * Find and highlight the Next button for pagination
   * @returns {HTMLElement|null} Next button element or null if not found
   */
  findNextButton() {
    // First check for Featured.com specific pagination controls
    if (window.location.href.includes('featured.com')) {
      // Featured.com uses specific pagination components
      try {
        // Look for the next page button in the pagination component
        const nextButton = document.querySelector('button[aria-label="Next page"], [aria-label="Next"]');
        if (nextButton) {
          this.debugLog('Found Featured.com next button with aria-label');
          return nextButton;
        }
        
        // Look for arrow icons in buttons
        const arrowButtons = Array.from(document.querySelectorAll('button'));
        for (const btn of arrowButtons) {
          // Check if the button contains an SVG with right arrow
          if (btn.innerHTML.includes('svg') && 
              (btn.innerHTML.toLowerCase().includes('arrow') || 
               btn.innerHTML.toLowerCase().includes('next'))) {
            this.debugLog('Found Featured.com next button with arrow icon');
            return btn;
          }
        }
        
        // Check for pagination buttons in the table footer
        const paginationNav = document.querySelector('nav[role="navigation"]');
        if (paginationNav) {
          const buttons = Array.from(paginationNav.querySelectorAll('button'));
          // Last button is typically next
          const lastButton = buttons[buttons.length - 1];
          if (lastButton && !lastButton.disabled) {
            this.debugLog('Found Featured.com next button in pagination navigation');
            return lastButton;
          }
        }
      } catch (error) {
        console.warn(`🔍 [FEATURED] Error finding Featured.com pagination controls:`, error);
      }
    }
    
    // Try standard selectors for next button as fallbacks
    const nextButtonSelectors = [
      'button[aria-label="Next page"], [aria-label="Next"]',
      'nav[role="navigation"] button:last-child',
      'ul.pagination li:not(.disabled):last-child a',
      '.pagination-next:not(.disabled) a, .pagination-next:not(.disabled) button',
      'a.next, button.next',
      '[data-testid="pagination-next"], [data-test="pagination-next"]',
      'button:has(> svg[data-testid="ArrowRightIcon"]), a:has(> svg[data-testid="ArrowRightIcon"])',
      '.pagination__next, .paginationjs-next',
      'a[aria-label="Next"], button[aria-label="Next"]',
      '[aria-label="Next page"]',
      '.next-posts-link',
      '.load-more, .load-more-button, #load-more, #load-more-button',
    ];
    
    // Try each selector
    for (const selector of nextButtonSelectors) {
      try {
        const button = document.querySelector(selector);
        if (button) return button;
      } catch (error) {
        // Some complex selectors may not be supported in all browsers
        console.warn(`🔍 [FEATURED] Error with next button selector: ${selector}`, error);
      }
    }
    
    // Try finding by text content
    const potentialNextButtons = Array.from(document.querySelectorAll('button, a'));
    for (const button of potentialNextButtons) {
      const text = button.textContent.toLowerCase().trim();
      if (
        (text.includes('next') || text.includes('more') || text === '>' || text === '→')
        && !button.disabled
        && button.offsetParent !== null // Check if visible
      ) {
        return button;
      }
    }
    
    return null;
  }

  /**
   * Update the scrape options UI based on detected page structure
   */
  _updateScrapeOptionsUI() {
    // Update infinite scroll checkbox based on detection
    const checkbox = document.getElementById('infinite-scroll-toggle');
    if (checkbox) {
      checkbox.checked = this.useInfiniteScroll;
    }
  }
  
  /**
   * Navigate to the next page
   * @returns {Promise<boolean>} True if navigation was successful
   */
  async navigateToNextPage() {
    try {
      this.updateDebugPanel('status', '<div>Attempting to navigate to next page...</div>');
      
      // Check if we're on Featured.com
      const isOnFeatured = window.location.href.includes('featured.com');
      
      // Special handling for Featured.com's pagination
      if (isOnFeatured) {
        this.debugLog('Using Featured.com specific pagination handling');
        
        // Look for pagination indicator to see if we have pages
        const paginationInfo = document.querySelector('p[class*="text-muted"]');
        if (paginationInfo && paginationInfo.textContent.includes('of')) {
          this.debugLog(`Found pagination info: ${paginationInfo.textContent.trim()}`);
          
          // Parse out current page and total pages
          const paginationText = paginationInfo.textContent.trim();
          const matches = paginationText.match(/Page (\d+) of (\d+)/);
          
          if (matches && matches.length === 3) {
            const currentPage = parseInt(matches[1]);
            const totalPages = parseInt(matches[2]);
            
            this.updateDebugPanel('log', `<div>On page ${currentPage} of ${totalPages}</div>`, true);
            
            // If we're on the last page, stop pagination
            if (currentPage >= totalPages) {
              this.updateDebugPanel('log', '<div>Reached last page, stopping pagination</div>', true);
              return false;
            }
          }
        }
      }
      
      // Find the next button
      let nextButton = this.findNextButton();
      
      if (!nextButton) {
        // Try finding pagination container first
        const paginationContainer = document.querySelector('.pagination, [role="navigation"], nav, .data-table-pagination, .pagination-controls');
        
        if (paginationContainer) {
          this.debugLog('Found pagination container, searching for next button');
          
          // Look for the next button within pagination container
          const buttons = Array.from(paginationContainer.querySelectorAll('button, a'));
          
          // Try to find the next button by examining the buttons
          for (const button of buttons) {
            const text = button.textContent.trim().toLowerCase();
            const ariaLabel = button.getAttribute('aria-label')?.toLowerCase();
            const hasRightArrow = button.querySelector('svg[data-testid="ArrowRightIcon"], i[class*="right"], svg[class*="right"]');
            
            if (
              text === 'next' || 
              text.includes('next') || 
              (ariaLabel && ariaLabel.includes('next')) ||
              hasRightArrow ||
              button === buttons[buttons.length - 1] // Last button is often next
            ) {
              nextButton = button;
              this.debugLog(`Found next button inside pagination: ${button.outerHTML.substring(0, 100)}`);
              break;
            }
          }
        }
      }
      
      if (nextButton) {
        // Check if button is disabled
        const isDisabled = nextButton.disabled || 
          nextButton.classList.contains('disabled') || 
          nextButton.getAttribute('aria-disabled') === 'true';
          
        if (isDisabled) {
          this.debugLog('Next button is disabled');
          this.updateDebugPanel('log', '<div>Next button is disabled, end of results</div>', true);
          return false;
        }
        
        // Highlight the next button for visual feedback
        this.highlightElement(nextButton, 1000);
        
        // Store page height and content fingerprint for change detection
        const oldHeight = document.body.scrollHeight;
        const oldContent = this.generateContentFingerprint();
        
        // Click the next button
        this.debugLog('Clicking next button');
        nextButton.click();
        
        // Wait for content to load
        let contentChanged = false;
        let attempts = 0;
        const maxAttempts = 10;
        
        while (!contentChanged && attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 500));
          const newHeight = document.body.scrollHeight;
          const newContent = this.generateContentFingerprint();
          contentChanged = newHeight !== oldHeight || newContent !== oldContent;
          attempts++;
          
          // Update wait status
          this.updateDebugPanel('status', `<div>Waiting for page to load... (${attempts}/${maxAttempts})</div>`);
          
          if (contentChanged) {
            this.debugLog(`Content changed after ${attempts} attempts`);
            break;
          }
        }
        
        // Wait a little more to ensure complete loading
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // For Featured.com tables, verify rows loaded
        if (isOnFeatured) {
          const tableRows = document.querySelectorAll('div[role="row"], tr');
          this.debugLog(`Found ${tableRows.length} rows after pagination`);
          
          // If we have too few rows, something went wrong
          if (tableRows.length < 5) {
            this.updateDebugPanel('log', '<div>Warning: Few rows found after pagination, waiting longer...</div>', true);
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        }
        
        this.updateDebugPanel('log', '<div>Successfully navigated to next page</div>', true);
        return true;
        
      } else if (this.useInfiniteScroll) {
        this.updateDebugPanel('log', '<div>No next button found, trying infinite scroll...</div>', true);
        return await this.triggerInfiniteScroll();
      } else {
        this.debugLog('No pagination method found');
        this.updateDebugPanel('log', '<div>No next button or infinite scroll available</div>', true);
      }
      
      return false;
    } catch (error) {
      console.error('🔍 [FEATURED] Error navigating to next page:', error);
      this.updateDebugPanel('errors', `<div>Error navigating to next page: ${error.message}</div>`, true);
      return false;
    }
  }

  /**
   * Trigger infinite scroll by scrolling to the bottom
   * @returns {Promise<boolean>} Whether new content was loaded
   */
  async triggerInfiniteScroll() {
    try {
      this.updateDebugPanel('status', '<div>Attempting infinite scroll pagination...</div>');
      this.debugLog('Attempting infinite scroll pagination');
      
      // Store current content metrics for comparison
      const initialHeight = document.body.scrollHeight;
      const initialFingerprint = this.generateContentFingerprint();
      const initialItems = document.querySelectorAll(this.activeGridItemSelector || this.opportunitySelector);
      const initialItemCount = initialItems.length;
      
      this.updateDebugPanel('log', `<div>Initial content: ${initialItemCount} items, height ${initialHeight}px</div>`, true);
      
      // Scroll to bottom multiple times with pauses to trigger loading
      let contentChanged = false;
      let scrollAttempts = 0;
      const maxScrollAttempts = 5;
      
      while (!contentChanged && scrollAttempts < maxScrollAttempts) {
        // Scroll to bottom
        window.scrollTo(0, document.body.scrollHeight);
        this.debugLog(`Scroll attempt ${scrollAttempts+1}: scrolled to ${document.body.scrollHeight}px`);
        
        // Wait for content to potentially load
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Check if content metrics changed
        const currentHeight = document.body.scrollHeight;
        const currentFingerprint = this.generateContentFingerprint();
        const currentItems = document.querySelectorAll(this.activeGridItemSelector || this.opportunitySelector);
        const currentItemCount = currentItems.length;
        
        // Detect if content actually changed
        contentChanged = 
          currentHeight > initialHeight + 100 || // Height increased significantly
          currentItemCount > initialItemCount || // More items appeared
          currentFingerprint !== initialFingerprint; // Content fingerprint changed
        
        this.updateDebugPanel('status', `<div>Scroll attempt ${scrollAttempts+1}: ${contentChanged ? 'New content detected!' : 'No new content yet...'}</div>`);
        
        if (contentChanged) {
          this.updateDebugPanel('log', `<div>New content loaded via infinite scroll: ${currentItemCount} items (was ${initialItemCount})</div>`, true);
          return true;
        }
        
        scrollAttempts++;
      }
      
      this.updateDebugPanel('log', '<div>No new content loaded via infinite scroll after multiple attempts</div>', true);
      this.debugLog('Infinite scroll pagination unsuccessful after multiple attempts');
      return false;
    } catch (error) {
      console.error('🔍 [FEATURED] Error triggering infinite scroll:', error);
      this.updateDebugPanel('errors', `<div>Error with infinite scroll: ${error.message}</div>`, true);
      return false;
    }
  }

  generateQuickContentFingerprint() {
    try {
      // Get a valid main content selector
      let mainContainer = document;
      let mainSelector = null;
      
      try {
        // Try the active selector first
        if (this.activeMainContentSelector) {
          mainContainer = document.querySelector(this.activeMainContentSelector) || document;
          mainSelector = this.activeMainContentSelector;
        } else {
          // Try each main content selector until we find a valid one
          for (const selector of this.mainContentSelectors) {
            try {
              const container = document.querySelector(selector);
              if (container) {
                mainContainer = container;
                mainSelector = selector;
                break;
              }
            } catch (err) {
              // Skip invalid selectors
              console.warn(`🔍 [FEATURED] Skipping invalid main content selector in fingerprint: ${selector}`);
            }
          }
        }
      } catch (err) {
        console.warn(`🔍 [FEATURED] Error finding main container, using document:`, err);
      }
      
      // Find working grid item selector
      let activeSelector = null;
      let gridItems = [];
      
      // Try the active selector first
      if (this.activeGridItemSelector) {
        try {
          gridItems = document.querySelectorAll(this.activeGridItemSelector);
          if (gridItems && gridItems.length > 0) {
            activeSelector = this.activeGridItemSelector;
          }
        } catch (err) {
          console.warn(`🔍 [FEATURED] Active grid selector is invalid, trying alternatives`);
        }
      }
      
      // If active selector didn't work, try others
      if (!activeSelector) {
        for (const selector of this.gridItemSelectors) {
          try {
            const items = document.querySelectorAll(selector);
            if (items && items.length > 0) {
              activeSelector = selector;
              gridItems = items;
              break;
            }
          } catch (err) {
            // Skip invalid selectors
            console.warn(`🔍 [FEATURED] Skipping invalid grid selector in fingerprint: ${selector}`);
          }
        }
      }
      
      // Count grid items (efficient metric for content changes)
      const gridItemCount = gridItems.length;
      
      // Get visible text from the first few grid items (sample)
      const itemSampleSize = Math.min(10, gridItemCount);
      let sampleText = '';
      
      if (gridItemCount > 0) {
        for (let i = 0; i < itemSampleSize; i++) {
          if (gridItems[i]) {
            try {
              sampleText += (gridItems[i].textContent || '').trim().substring(0, 20);
            } catch (err) {
              console.warn(`🔍 [FEATURED] Error extracting text from item:`, err);
            }
          }
        }
      }
      
      // Add scroll position to the fingerprint
      const scrollY = window.scrollY;
      
      // Create fingerprint data with minimal info for speed
      const fingerprintData = `${gridItemCount}:${sampleText}:${scrollY}`;
      
      // Use simple hash for speed
      let hash = 0;
      for (let i = 0; i < fingerprintData.length; i++) {
        const char = fingerprintData.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
      }
      
      return hash.toString(16);
    } catch (error) {
      console.error('Error generating quick content fingerprint:', error);
      return 'error-' + Date.now();
    }
  }

  /**
   * Add scrapers to the UI
   * Override of BaseScraper's addScrapers method
   * @override
   * @param {HTMLElement} container - Container element for the scrapers
   */
  addScrapers(container) {
    if (!container) return;
    
    // Main scrape button
    const scraperButton = document.createElement('button');
    scraperButton.className = 'sb-btn sb-btn-primary source-bottle-btn';
    scraperButton.innerText = 'Scrape Featured Opportunities';
    scraperButton.addEventListener('click', () => this.run());
    container.appendChild(scraperButton);
    
    // Try another table/selector button - similar to Instant Data Scraper
    const tryAnotherSelectorButton = document.createElement('button');
    tryAnotherSelectorButton.className = 'sb-btn sb-btn-secondary source-bottle-btn';
    tryAnotherSelectorButton.innerText = 'Try Another Content Structure';
    tryAnotherSelectorButton.style.marginTop = '10px';
    tryAnotherSelectorButton.style.width = '100%';
    tryAnotherSelectorButton.addEventListener('click', () => this.cycleBestSelectors());
    container.appendChild(tryAnotherSelectorButton);
    
    // Pagination type toggle button
    const paginationButton = document.createElement('button');
    paginationButton.className = 'sb-btn sb-btn-secondary source-bottle-btn';
    paginationButton.innerText = 'Locate "Next" button';
    paginationButton.style.marginTop = '10px';
    paginationButton.style.width = '100%';
    paginationButton.addEventListener('click', () => this.findNextButton());
    container.appendChild(paginationButton);
    
    // Infinite scroll checkbox
    const infiniteScrollContainer = document.createElement('div');
    infiniteScrollContainer.style.marginTop = '10px';
    infiniteScrollContainer.style.display = 'flex';
    infiniteScrollContainer.style.alignItems = 'center';
    
    const infiniteScrollCheckbox = document.createElement('input');
    infiniteScrollCheckbox.type = 'checkbox';
    infiniteScrollCheckbox.id = 'infinite-scroll-toggle';
    infiniteScrollCheckbox.checked = this.useInfiniteScroll;
    infiniteScrollCheckbox.addEventListener('change', (e) => {
      this.useInfiniteScroll = e.target.checked;
      this.updateDebugPanel(`Infinite scroll mode ${this.useInfiniteScroll ? 'enabled' : 'disabled'}`);
    });
    
    const infiniteScrollLabel = document.createElement('label');
    infiniteScrollLabel.htmlFor = 'infinite-scroll-toggle';
    infiniteScrollLabel.innerText = 'Infinite scroll';
    infiniteScrollLabel.style.marginLeft = '8px';
    infiniteScrollLabel.style.cursor = 'pointer';
    
    infiniteScrollContainer.appendChild(infiniteScrollCheckbox);
    infiniteScrollContainer.appendChild(infiniteScrollLabel);
    container.appendChild(infiniteScrollContainer);
  }

  /**
   * Initialize the scraper
   * Override of BaseScraper's initialize method
   * @override
   */
  async initialize() {
    try {
      // Call parent initialize if available (BaseScraper)
      if (typeof super.initialize === 'function') {
        super.initialize();
      }
      
      // Create debug panel if not already created
      if (!this.debugPanelCreated) {
        this._createDebugPanel();
        this.debugPanelCreated = true;
      }
      
      // Set initial active selectors from arrays
      this.activeGridItemSelector = this.gridItemSelectors[0];
      this.activeMainContentSelector = this.mainContentSelectors[0];
      
      // For backward compatibility
      this.gridItemSelector = this.activeGridItemSelector;
      
      // Notify user that initialization is starting
      this.updateDebugPanel('status', '<div>Initializing Featured.com scraper...</div>');
      
      // Detect best selectors for this page structure
      await this.detectBestSelectors();
      
      // Update the UI based on detected page structure
      this._updateScrapeOptionsUI();
      
      // Add scraper button to UI
      this.addScraperButton();
      
      // Log initialization success
      this.debugLog('Scraper initialized successfully');
      this.updateDebugPanel('status', '<div>Scraper ready! Click the "Scrape" button to begin.</div>');
      
      if (window.scraperNotification) {
        window.scraperNotification.update({
          status: 'ready',
          message: 'Featured.com scraper initialized and ready to run'
        });
        window.scraperNotification.updateProgress(10);
      }
      
      return true;
    } catch (error) {
      console.error('🔍 [FEATURED] Error initializing scraper:', error);
      this.updateDebugPanel('errors', `<div>Error initializing scraper: ${error.message}</div>`, true);
      return false;
    }
  }

  /**
   * Run the scraper
   * @returns {Promise<Array>} Array of opportunities
   */
  async run() {
    try {
      // Set up pagination options
      const paginationOptions = {
        maxScrolls: this.maxScrolls,
        maxPagesToVisit: 10,
        contentFingerprintHistory: [],
        autoPaginate: true // Enable auto-pagination by default when running scraper
      };
      
      // Use runWithPagination instead of single page parse to enable our robust pagination method
      this.updateDebugPanel('status', '<div>Starting scrape with pagination support...</div>');
      console.log('🔍 [FEATURED] Running scraper with pagination support');
      
      // Run with pagination to use our robust navigateToNextPage method
      const opportunities = await this.runWithPagination(paginationOptions);
      
      // Provide guidance if no opportunities found
      if (!opportunities || opportunities.length === 0) {
        this.updateDebugPanel('log', `<div>
          <strong>No opportunities found.</strong> Try these steps:<br>
          1. Try clicking on a question or opportunity first<br>
          2. Interact with the page to ensure content is loaded<br>
          3. Click the "Analyze Page Structure" button to see what elements exist<br>
          4. Then run the scraper again
        </div>`, true);
        
        if (window.scraperNotification) {
          window.scraperNotification.update({
            status: 'warning',
            message: 'No opportunities found. Try interacting with the page first.'
          });
        }
      } else {
        // Success notification
        this.updateDebugPanel('status', `<div>Successfully scraped ${opportunities.length} opportunities across multiple pages!</div>`);
        
        if (window.scraperNotification) {
          window.scraperNotification.update({
            status: 'success',
            message: `Successfully scraped ${opportunities.length} opportunities across multiple pages!`,
            totalFound: opportunities.length
          });
          window.scraperNotification.updateProgress(100);
        }
        
        // Send opportunities to backend
        this.sendToBackend(opportunities);
      }
      
      return opportunities;
    } catch (error) {
      console.error('🔍 [FEATURED] Error running scraper:', error);
      this.updateDebugPanel('errors', `<div>Error running scraper: ${error.message}</div>`, true);
      return [];
    }
  }

  /**
   * Run the scraper with pagination support
   * @param {Object} options - Pagination options
   * @param {number} options.maxScrolls - Maximum number of scrolls per page
   * @param {number} options.maxPagesToVisit - Maximum number of pages to visit
   * @param {Array} options.contentFingerprintHistory - Array of content fingerprints
   * @param {boolean} options.autoPaginate - Whether to automatically paginate
   * @returns {Promise<Array>} Array of opportunities
   */
  async runWithPagination(options = {}) {
    const {
      maxScrolls = 5,
      maxPagesToVisit = 10,
      contentFingerprintHistory = [],
      autoPaginate = true
    } = options;
    
    let allOpportunities = [];
    let pagesVisited = 0;
    let hasMorePages = true;
    let fingerprint = '';
    
    this.updateDebugPanel('status', '<div>Starting extraction with pagination...</div>');
    
    while (hasMorePages && pagesVisited < maxPagesToVisit) {
      // Extract current page data
      const pageOpportunities = await this.extractPageContent();
      
      if (pageOpportunities && pageOpportunities.length > 0) {
        this.updateDebugPanel('log', `<div>Found ${pageOpportunities.length} items on page ${pagesVisited + 1}</div>`, true);
        allOpportunities = [...allOpportunities, ...pageOpportunities];
      } else {
        this.updateDebugPanel('log', `<div>No items found on page ${pagesVisited + 1}</div>`, true);
      }
      
      // Generate a fingerprint of this page's content
      fingerprint = this.generateQuickContentFingerprint();
      contentFingerprintHistory.push(fingerprint);
      
      pagesVisited++;
      
      if (autoPaginate && pagesVisited < maxPagesToVisit) {
        // Try to navigate to next page
        const nextPageAvailable = await this.navigateToNextPage();
        
        if (!nextPageAvailable) {
          this.updateDebugPanel('log', '<div>No more pages available</div>', true);
          hasMorePages = false;
        } else {
          // Wait for page to load new content
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          // Check if the content is different from previous pages
          const newFingerprint = this.generateQuickContentFingerprint();
          
          if (contentFingerprintHistory.includes(newFingerprint)) {
            this.updateDebugPanel('log', '<div>Page content appears to be a duplicate, stopping pagination</div>', true);
            hasMorePages = false;
          } else {
            this.updateDebugPanel('log', `<div>Moved to page ${pagesVisited + 1}</div>`, true);
          }
        }
      } else {
        hasMorePages = false;
      }
    }
    
    this.updateDebugPanel('status', `<div>Completed extracting data from ${pagesVisited} page(s)</div>`);
    return allOpportunities;
  }

  /**
   * Extract content from the current page
   * @returns {Promise<Array>} Array of opportunities extracted from current page
   */
  async extractPageContent() {
    try {
      // Find container element using active selector
      const container = document.querySelector(this.activeMainContentSelector) || document;
      
      if (!container) {
        this.debugLog('No container element found');
        return [];
      }
      
      // First, let's detect if we're working with a table
      let isTableData = false;
      let tableHeaders = [];
      let headerIndexMap = {};
      
      // Check if we have a table structure with headers
      let tableElement = container.tagName === 'TABLE' ? 
        container : 
        container.querySelector('table');
      
      // For Featured.com specific case - they may use a div with a table structure
      if (!tableElement && window.location.href.includes('featured.com')) {
        const dataTable = document.getElementById('data-table');
        if (dataTable) {
          tableElement = dataTable;
          this.debugLog('Featured.com data-table div found, treating as table structure');
        }
      }
      
      if (tableElement) {
        isTableData = true;
        this.debugLog('Table structure detected, extracting headers');
        
        // Find table headers - try multiple approaches for Featured.com
        let headerRow;
        
        // Try specific Featured.com header row selector first
        if (window.location.href.includes('featured.com')) {
          // Try with various selectors to find the header row - avoiding problematic selectors with special characters
          try {
            headerRow = tableElement.querySelector('tr[data-state="head"]') ||
                        tableElement.querySelector('table > thead > tr') ||
                        tableElement.querySelector('tr.heading') ||
                        tableElement.querySelector('tr:first-child');
                        
            if (headerRow) {
              this.debugLog('Found Featured.com specific header row');
            }
          } catch (error) {
            this.errorLog('[FEATURED] Error finding header row:', error);
          }
        }
        
        // If not found, try generic approaches
        if (!headerRow) {
          headerRow = tableElement.querySelector('thead tr') || 
                     tableElement.querySelector('tr:first-child') || 
                     (tableElement.querySelector('tr th') && tableElement.querySelector('tr'));
        }
        
        if (headerRow) {
          // Get header cells
          const headerCells = headerRow.querySelectorAll('th, td');
          if (headerCells && headerCells.length > 0) {
            Array.from(headerCells).forEach((cell, index) => {
              const headerText = cell.textContent.trim().toLowerCase();
              tableHeaders.push(headerText);
              
              // Create a mapping of column names to indexes
              headerIndexMap[headerText] = index;
              
              // Also map some common variations
              if (headerText.includes('question') || headerText.includes('title')) {
                headerIndexMap['title'] = index;
              }
              if (headerText.includes('summary') || headerText.includes('description')) {
                headerIndexMap['description'] = index;
              }
              if (headerText.includes('date')) {
                headerIndexMap['date'] = index;
              }
              if (headerText.includes('category') || headerText.includes('topic')) {
                headerIndexMap['category'] = index;
              }
              if (headerText.includes('status')) {
                headerIndexMap['status'] = index;
              }
              if (headerText.includes('link') || headerText.includes('url')) {
                headerIndexMap['url'] = index;
              }
              if (headerText.includes('company') || headerText.includes('publication') || headerText.includes('publisher')) {
                headerIndexMap['company'] = index;
              }
            });
            
            this.debugLog(`Detected ${tableHeaders.length} table headers: ${tableHeaders.join(', ')}`);
            this.updateDebugPanel('log', `<div>Table headers detected: ${tableHeaders.join(', ')}</div>`, true);
          }
        }
      }
      
      // Find all grid items using active selector
      let gridItems = [];
      try {
        // If we're dealing with a table, skip the header row
        if (isTableData && tableElement) {
          // First try to get rows from tbody
          gridItems = Array.from(tableElement.querySelectorAll('tbody tr'));
          
          // If no tbody rows, try getting all rows except the first one (header)
          if (!gridItems.length) {
            gridItems = Array.from(tableElement.querySelectorAll('tr:not(:first-child)'));
          }
          
          this.debugLog(`Found ${gridItems.length} table rows (excluding header)`); 
        } else {
          // Try using our detected grid item selector
          gridItems = Array.from(document.querySelectorAll(this.activeGridItemSelector));
          
          // For Featured.com specifically
          if (!gridItems.length && window.location.href.includes('featured.com')) {
            // Try Featured.com specific selector with exact class name pattern
            const featuredSelector = 'tr.border-b.transition-colors.hover\\:bg-muted\\/50.data-\\[state\\=selected\\]\\:bg-muted';
            try {
              gridItems = Array.from(document.querySelectorAll(featuredSelector));
              this.debugLog(`Using Featured.com specific selector found ${gridItems.length} items`);
              
              // If we found items, update the active selector
              if (gridItems.length > 0) {
                this.activeGridItemSelector = featuredSelector;
              }
            } catch (err) {
              this.debugLog('Error with Featured.com specific selector');
            }
          }
        }
      } catch (error) {
        console.warn('🔍 [FEATURED] Error with grid item selector, trying fallback:', error);
        // Try fallback selectors if the active one fails
        for (const selector of this.gridItemSelectors) {
          try {
            const items = document.querySelectorAll(selector);
            if (items && items.length > 0) {
              gridItems = Array.from(items);
              break;
            }
          } catch (err) {
            // Skip invalid selectors
          }
        }
      }
      
      this.debugLog(`Found ${gridItems.length} grid items`);
      this.updateDebugPanel('log', `<div>Extracting data from ${gridItems.length} items...</div>`, true);
      
      if (!gridItems.length) {
        return [];
      }
      
      // Process each grid item and extract data
      const opportunities = [];
      
      for (let i = 0; i < gridItems.length; i++) {
        const item = gridItems[i];
        
        try {
          // Highlight the current item being processed
          if (this.debug) {
            this.highlightElement(item, 500);
          }
          
          // Create a base opportunity object
          const opportunity = {
            source: window.location.href,
            timestamp: new Date().toISOString()
          };
          
          if (isTableData) {
            // For table data, use the header mapping
            const cells = item.querySelectorAll('td');
            
            // Process each cell according to header mapping
            Array.from(cells).forEach((cell, cellIndex) => {
              // Extract text content
              const text = cell.textContent.trim();
              
              // Find which field this cell corresponds to based on header mapping
              for (const [field, index] of Object.entries(headerIndexMap)) {
                if (index === cellIndex) {
                  opportunity[field] = text;
                  
                  // If this cell has a link and it's a title or URL column, extract the URL
                  const link = cell.querySelector('a');
                  if (link && link.href && (field === 'title' || field === 'url')) {
                    opportunity.url = link.href;
                  }
                }
              }
            });
            
            // If we didn't get some required fields, try to extract them directly
            if (!opportunity.title) {
              const titleCell = cells[0] || cells[headerIndexMap.title]; // First column is often the title/question
              opportunity.title = titleCell ? titleCell.textContent.trim() : 'Untitled Question';
            }
            
            // Make sure we have a URL if there was a link in the row
            if (!opportunity.url) {
              const anyLink = item.querySelector('a');
              if (anyLink && anyLink.href) {
                opportunity.url = anyLink.href;
              }
            }
          } else {
            // For non-table data, use generic extraction
            // Extract text content
            const titleEl = item.querySelector('a, h2, h3, strong') || item;
            const descriptionEl = item.querySelector('p, .description, td:nth-child(2)') || item;
            
            opportunity.title = titleEl.textContent.trim();
            opportunity.description = descriptionEl.textContent.trim();
            
            // Get link if available
            const linkEl = item.querySelector('a');
            if (linkEl && linkEl.href) {
              opportunity.url = linkEl.href;
            }
            
            // Get other potential data points
            const dateEl = item.querySelector('.date, time, [datetime], td:nth-child(3)');
            opportunity.date = dateEl ? dateEl.textContent.trim() : '';
            
            const companyEl = item.querySelector('.company, td:nth-child(4)');
            opportunity.company = companyEl ? companyEl.textContent.trim() : '';
          }
          
          // Ensure we have at least a title
          if (opportunity.title && opportunity.title !== '') {
            // Clean up the object - make sure all values are strings
            for (const key in opportunity) {
              if (opportunity[key] === null || opportunity[key] === undefined) {
                opportunity[key] = '';
              }
            }
            
            opportunities.push(opportunity);
          }
          
          // Update progress in debug panel every 10 items
          if (i % 10 === 0 || i === gridItems.length - 1) {
            this.updateDebugPanel('status', `<div>Processed ${i + 1}/${gridItems.length} items</div>`);
          }
        } catch (error) {
          console.warn(`🔍 [FEATURED] Error processing item ${i}:`, error);
        }
      }
      
      // Show header mapping in debug panel
      if (isTableData && tableHeaders.length > 0) {
        this.updateDebugPanel('log', `<div>Column mapping:<br>${JSON.stringify(headerIndexMap, null, 2).replace(/[{}",]/g, '').replace(/\n\s*/g, '<br>')}</div>`, true);
      }
      
      // Sample of data extracted
      if (opportunities.length > 0) {
        this.debugLog(`Sample opportunity: ${JSON.stringify(opportunities[0], null, 2)}`);
      }
      
      this.debugLog(`Extracted ${opportunities.length} opportunities`);
      return opportunities;
    } catch (error) {
      console.error('🔍 [FEATURED] Error extracting page content:', error);
      this.updateDebugPanel('errors', `<div>Error extracting content: ${error.message}</div>`, true);
      return [];
    }
  }
  
  /**
   * Send opportunities to backend storage
   * @param {Array} opportunities - Array of opportunities to save
   */
  sendToBackend(opportunities) {
    try {
      this.updateDebugPanel('status', `<div>Saving ${opportunities.length} opportunities to storage...</div>`);
      
      // Check if we have chrome storage access
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        // Tag the opportunities with source information
        const taggedOpportunities = opportunities.map(opp => ({
          ...opp,
          source: 'Featured',
          scraperType: 'Featured.com',
          timestamp: new Date().toISOString(),
          id: opp.id || `featured-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
        }));
        
        // Save to chrome storage
        chrome.storage.local.get(['opportunities', 'featuredOpportunities'], (result) => {
          // Get existing opportunities
          const existingOpportunities = result.opportunities || [];
          const existingFeatured = result.featuredOpportunities || [];
          
          // Create a set of existing IDs for quick lookup
          const existingIds = new Set();
          [...existingOpportunities, ...existingFeatured].forEach(opp => {
            if (opp.externalId) existingIds.add(opp.externalId);
            if (opp.id) existingIds.add(opp.id);
          });
          
          // Filter out duplicates
          const newOpportunities = taggedOpportunities.filter(opp => {
            const id = opp.id || opp.externalId;
            const isDuplicate = id && existingIds.has(id);
            
            if (isDuplicate) {
              this.debugLog(`Skipping duplicate opportunity: ${opp.title}`);
            }
            
            return !isDuplicate;
          });
          
          // Combine with existing Featured opportunities
          const updatedFeaturedOpps = [...existingFeatured, ...newOpportunities];
          
          // Also add to the main opportunities array
          const updatedAllOpps = [...existingOpportunities, ...newOpportunities];
          
          // Save both collections
          chrome.storage.local.set({
            featuredOpportunities: updatedFeaturedOpps,
            opportunities: updatedAllOpps
          }, () => {
            // Check for errors
            if (chrome.runtime.lastError) {
              console.error('🔍 [FEATURED] Error saving opportunities:', chrome.runtime.lastError);
              this.updateDebugPanel('errors', `<div>Error saving to storage: ${chrome.runtime.lastError.message}</div>`, true);
            } else {
              this.updateDebugPanel('log', `<div>Saved ${newOpportunities.length} new opportunities (${updatedFeaturedOpps.length} total Featured)</div>`, true);
              console.log(`🔍 [FEATURED] Saved ${newOpportunities.length} opportunities to storage`);
              
              // Send message to background script to refresh opportunities page if open
              try {
                chrome.runtime.sendMessage({
                  action: 'newOpportunitiesAvailable',
                  source: 'Featured',
                  count: newOpportunities.length
                });
              } catch (msgError) {
                // Background page might not be active, which is ok
                console.log('🔍 [FEATURED] Could not notify background page:', msgError);
              }
            }
          });
        });
      } else if (window.storageManager) {
        // Use the extension's storage manager if available
        this.debugLog('Using global storageManager');
        
        // Tag the opportunities
        const taggedOpportunities = opportunities.map(opp => ({
          ...opp,
          source: 'Featured',
          scraperType: 'Featured.com',
          timestamp: new Date().toISOString(),
          id: opp.id || `featured-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
        }));
        
        // Use the storage manager
        window.storageManager.saveOpportunities(taggedOpportunities)
          .then(result => {
            this.debugLog(`Saved ${result.newCount} new opportunities (${result.count} total)`);
            this.updateDebugPanel('log', `<div>Saved ${result.newCount} new opportunities to database</div>`, true);
          })
          .catch(error => {
            console.error('🔍 [FEATURED] Error saving with storageManager:', error);
            this.updateDebugPanel('errors', `<div>Error saving to storage: ${error.message}</div>`, true);
          });
      } else {
        console.warn('🔍 [FEATURED] No storage mechanism available');
        this.updateDebugPanel('log', '<div>No storage mechanism found. Data is available in console.</div>', true);
        
        // Log the data so it's not lost
        console.log('🔍 [FEATURED] Scraped Opportunities:', opportunities);
      }
    } catch (error) {
      console.error('🔍 [FEATURED] Error in sendToBackend:', error);
      this.updateDebugPanel('errors', `<div>Error sending data: ${error.message}</div>`, true);
    }
  }
}

// Expose globally - this is what the content launcher expects
window.FeaturedScraper = FeaturedScraper;
window.featuredScraper = new FeaturedScraper();

// Log that the script has loaded - using console.log since logManager might not be available yet
console.log('🔍 [FEATURED] Featured.com scraper loaded and ready');

// Register with the scrapers registry if available - with retry mechanism for reliability
const attemptRegistration = (attempt = 1, maxAttempts = 5) => {
  try {
    if (window.scrapers) {
      window.scrapers.register('Featured', window.featuredScraper);
      console.log('🔍 [FEATURED] Successfully registered with scrapers registry');
      
      // Set up logger after we have potential access to it
      if (window.logManager) {
        console.log('🔍 [FEATURED] Using global logManager for logging');
      } else {
        console.warn('🔍 [FEATURED] Global logManager not available, using console fallback');
      }
    } else if (attempt < maxAttempts) {
      console.warn(`🔍 [FEATURED] Scrapers registry not available yet, will retry (${attempt}/${maxAttempts})...`);
      // Exponential backoff for retries: 500ms, 1000ms, 2000ms, 4000ms...
      setTimeout(() => attemptRegistration(attempt + 1, maxAttempts), 500 * Math.pow(2, attempt - 1));
    } else {
      console.warn('🔍 [FEATURED] Scrapers registry not available after maximum attempts, relying on content launcher for registration');
    }
  } catch (error) {
    if (attempt < maxAttempts) {
      console.warn(`🔍 [FEATURED] Failed to register with scrapers registry, will retry (${attempt}/${maxAttempts}):`, error);
      setTimeout(() => attemptRegistration(attempt + 1, maxAttempts), 500 * Math.pow(2, attempt - 1));
    } else {
      console.error('🔍 [FEATURED] Failed to register with scrapers registry after maximum attempts:', error);
    }
  }
};

// Begin registration process with initial delay
setTimeout(() => attemptRegistration(), 500);
