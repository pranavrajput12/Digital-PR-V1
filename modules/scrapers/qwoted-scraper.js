/**
 * Qwoted.com Scraper
 * Handles scraping of PR opportunities from Qwoted.com
 * 
 * UPDATED: Removed ES module imports to comply with Chrome Extension's Content Security Policy.
 * Now using window globals for dependencies, matching the Featured and SourceBottle scrapers.
 */

// Use window globals directly instead of creating local constants
// These will be accessed via window.* when the scripts are loaded in the correct order
// IMPORTANT: removed local constant declarations to prevent redeclaration errors

/**
 * QwotedScraper - Class for scraping opportunities from Qwoted.com
 * Extends BaseScraper for common functionality
 */
class QwotedScraper extends window.BaseScraper {
  constructor() {
    super('qwotedOpportunities', 'Qwoted');
    
    // Debug mode settings - disabled by default to match Featured.com scraper
    this.debugMode = false;
    this.showDebugPanel = false;
    this.debugPanelId = 'qwoted-scraper-debug-panel';
    this.lastContentFingerprint = '';
    this.processedItems = new Set(); // Track processed items to prevent duplicates
    
    // Define the debug utility functions early to avoid undefined errors
    this.updateDebugPanel = (section, content) => {
      if (!this.debugMode || !this.showDebugPanel) return;
      
      const panel = document.getElementById(this.debugPanelId);
      if (!panel) return;
      
      const sectionElement = panel.querySelector(`.${section}-section`);
      if (sectionElement) {
        sectionElement.innerHTML += content;
        sectionElement.scrollTop = sectionElement.scrollHeight; // Auto-scroll to bottom
      }
    };
    
    this.debugLog = (message) => {
      if (!this.debugMode) return;
      console.log(`💬 [QWOTED DEBUG] ${message}`);
      this.updateDebugPanel('log', `<div>${message}</div>`);
    };
    
    // Log initialization
    console.log('💬 [QWOTED DEBUG] Qwoted scraper constructor called');
    this.debugLog('Qwoted scraper initialized');
    
    /**
     * Validate if an opportunity has all required fields
     * @param {Object} item - The opportunity item to validate
     * @returns {boolean} - True if valid, false otherwise
     */
    this.isValidOpportunity = (item) => {
      if (!item) return false;
      
      // Check for required fields
      const hasTitle = !!item.title;
      const hasDescription = !!item.description;
      const hasExternalId = !!item.externalId;
      const hasUrl = !!item.url;
      
      const isValid = hasTitle && hasDescription && hasExternalId && hasUrl;
      
      // Log validation result for debugging
      if (!isValid) {
        console.warn('💬 [QWOTED DEBUG] Dropping invalid opportunity:', {
          hasTitle,
          hasDescription,
          hasExternalId,
          hasUrl,
          title: item.title || 'missing',
          externalId: item.externalId || 'missing',
          url: item.url || 'missing',
          descriptionLength: item.description ? item.description.length : 0
        });
      }
      
      return isValid;
    };
    
    // CSS Selectors for Qwoted.com elements - using robust anchoring based on CSS guidance
    // Anchor on the unique card structure with position-relative
    this.ROW_SELECTOR = 'div.card-body.position-relative';
    
    // More specific selectors anchored to the card structure
    this.selectors = {
      // Master card anchor - the unique combo that identifies Qwoted cards
      cardBody: 'div.card-body.position-relative',
      
      // Context-specific anchor if multiple card types exist
      resultsCards: 'section#results div.card-body.position-relative',
      
      // Key structural regions based on CSS guidance
      orgLogo: '.card-body img[alt*=""]',  // Fallback to .card-body .w-50 img if brand changes
      shareButtons: '.card-body .share-buttons',
      shareIcons: {
        email: '.share-buttons i.fa-envelope, .share-buttons i[class*="fa-envelope"]',
        linkedin: '.share-buttons i.fa-linkedin, .share-buttons i[class*="fa-linkedin"]', 
        twitter: '.share-buttons i.fa-x-twitter, .share-buttons i[class*="fa-twitter"]'
      },
      
      // Content selectors with robust anchoring
      brandName: '.card-body h6.fw-bold > a',  // The h6 always holds the org link
      categoryLabel: '.card-body .text-uppercase.font-size-12px',  // "EXPERT REQUEST"
      mainTitleLink: '.card-body > a[href^="/source_requests/"]',  // First top-level link
      description: '.card-body p.small',  // Contains the request snippet
      hashtagBadges: '.card-body a.badge',  // Each hashtag badge
      saveButton: '.card-body button[title*="Add to saved"], .card-body button[title*="favorites"]',
      
      // Meta information
      postedTime: '.card-body .source-request-created-at',  // Relative timestamp
      deadline: '.card-body .source-request-deadline',  // Countdown deadline
      
      // Fallback selectors for backward compatibility
      title: 'h6.fw-bold > a, .ais-Highlight, h3, h4, .fw-bold',
      pitchTitle: '.ais-Highlight, .ais-Highlight-nonHighlighted, h3, h4, .fw-bold',
      expertRequest: '.text-uppercase.text-secondary.font-size-12px.mt-3, .text-uppercase.font-size-12px',
      category: '.card-header, td.category, [data-testid="opportunity-category"], [data-testid="request-category"], .request-category, .badge, .tag, .category',
      tags: '.p-1.mb-1.me-1.text-dark.badge.bg-light.font-size-10px, td.tags, [data-testid="opportunity-tags"], [data-testid="request-tags"], .request-tags, .tags, .badge, .tag, .pill',
      pagination: '.pagination, nav, [data-react-class*="pagination"]',
      nextPageLink: 'a[rel="next"], .pagination .next a'
    };
    
    console.log('💬 [QWOTED DEBUG] Initialized with selectors:', {
      rowSelector: this.ROW_SELECTOR,
      selectors: this.selectors
    });
    
    this.opportunities = [];
    this.processedIds = new Set();
    this.maxRows = 600; // Maximum number of rows to scrape
    this.pageDelay = 3000; // Delay between page navigations (3-4 seconds)
  }
  
  /**
   * Check if we're on the opportunities page
   * @returns {boolean} True if on opportunities page
   */
  isOpportunitiesPage() {
    // Check URL
    const url = window.location.href;
    const isQwotedUrl = url.includes('app.qwoted.com') || url.includes('qwoted.com');
    const isOpportunitiesPage = url.includes('/opportunities') || url.includes('/source_requests');
    
    console.log('💬 [QWOTED DEBUG] URL check:', {
      url,
      isQwotedUrl,
      isOpportunitiesPage,
      locationPathname: window.location.pathname
    });
    
    return isQwotedUrl && isOpportunitiesPage;
  }
  
  /**
   * Initialize the scraper
   */
  async initialize() {
    this.debugLog('Initializing Qwoted.com scraper');
    console.log('💬 [QWOTED DEBUG] Initialize called');
    
    // Check if we're on the opportunities page
    if (!this.isOpportunitiesPage()) {
      this.debugLog('Not on opportunities page, scraper not initialized');
      console.log('💬 [QWOTED DEBUG] Not on opportunities/source_requests page, aborting initialization');
      return false;
    }
    
    // Debug DOM structure to help with selector issues
    console.log('💬 [QWOTED DEBUG] Document title:', document.title);
    console.log('💬 [QWOTED DEBUG] Body classes:', document.body.className);
    
    // For client-side rendered content, we need to wait for React to load the data
    console.log('💬 [QWOTED DEBUG] Waiting for client-side content to render...');
    await this.waitForContentToLoad();
    
    // Test all selectors after waiting for content
    console.log('💬 [QWOTED DEBUG] Testing primary row selector:', this.ROW_SELECTOR);
    const rows = document.querySelectorAll(this.ROW_SELECTOR);
    console.log(`💬 [QWOTED DEBUG] Primary row selector found ${rows.length} elements`);
    
    // Test table selector
    const tables = document.querySelectorAll(this.selectors.table);
    console.log(`💬 [QWOTED DEBUG] Table selector found ${tables.length} tables`);
    
    // If no rows found directly, try finding them through tables
    if (rows.length === 0 && tables.length > 0) {
      const tableRows = tables[0].querySelectorAll(this.selectors.row);
      console.log(`💬 [QWOTED DEBUG] Found ${tableRows.length} rows through table selector`);
    }
    
    // Look for React components that might contain our data
    const reactComponents = document.querySelectorAll('[data-react-class]');
    console.log(`💬 [QWOTED DEBUG] Found ${reactComponents.length} React components`);
    if (reactComponents.length > 0) {
      console.log('💬 [QWOTED DEBUG] React component classes:',
        Array.from(reactComponents).map(el => el.getAttribute('data-react-class')).join(', '));
    }
    
    console.log('💬 [QWOTED DEBUG] Initialization complete');
    return true;
  }
  
  /**
   * Wait for client-side rendered content to load
   * This is especially important for React-based sites like Qwoted
   * @param {number} maxWaitTime - Maximum time to wait in milliseconds
   * @param {number} checkInterval - Interval between checks in milliseconds
   * @returns {Promise<boolean>} - True if content loaded, false if timed out
   */
  async waitForContentToLoad(maxWaitTime = 8000, checkInterval = 500) {
    console.log(`💬 [QWOTED DEBUG] Waiting up to ${maxWaitTime}ms for content to load...`);
    
    const startTime = Date.now();
    let contentFound = false;
    
    // Look for indicators that content has loaded
    const contentIndicators = [
      // React components related to opportunities
      '[data-react-class*="source_requests"]',
      '[data-react-class*="opportunity"]',
      // Generic opportunity containers
      '.source-request-item',
      '.opportunity-row',
      // Any cards that might be used for opportunities
      '.card:not(.loading)',
      // React-rendered divs with meaningful content
      'div:not(:empty)',
      'h3', 'h4', 'p.card-text'
    ];
    
    // Wait until content is found or timeout
    while (!contentFound && (Date.now() - startTime) < maxWaitTime) {
      console.log(`💬 [QWOTED DEBUG] Checking for content... (${Math.round((Date.now() - startTime) / 1000)}s elapsed)`);
      
      // Check each indicator
      for (const selector of contentIndicators) {
        try {
          const elements = document.querySelectorAll(selector);
          if (elements.length > 0) {
            console.log(`💬 [QWOTED DEBUG] Content found with selector: ${selector} (${elements.length} elements)`);
            contentFound = true;
            break;
          }
        } catch (error) {
          console.log(`💬 [QWOTED DEBUG] Error checking selector ${selector}:`, error.message);
        }
      }
      
      // Also check for React elements that might contain our data
      const reactElements = document.querySelectorAll('[data-react-class]');
      if (reactElements.length > 0) {
        console.log(`💬 [QWOTED DEBUG] Found ${reactElements.length} React elements`);
      }
      
      // Check if we have React with meaningful content
      const reactWithContent = document.querySelectorAll('[data-react-class]:not(:empty)');
      if (reactWithContent.length > 0) {
        console.log(`💬 [QWOTED DEBUG] Found ${reactWithContent.length} non-empty React elements`);
        
        // If it's been at least 2 seconds and we have React content, consider it loaded
        if ((Date.now() - startTime) > 2000) {
          console.log('💬 [QWOTED DEBUG] React content appears to be loaded');
          contentFound = true;
          break;
        }
      }
      
      if (!contentFound) {
        // Wait before checking again
        await this.sleep(checkInterval);
      }
    }
    
    if (contentFound) {
      console.log(`💬 [QWOTED DEBUG] Content loaded after ${Math.round((Date.now() - startTime) / 1000)}s`);
    } else {
      console.log(`💬 [QWOTED DEBUG] Timed out waiting for content after ${Math.round(maxWaitTime / 1000)}s`);
    }
    
    return contentFound;
  }
  
  /**
   * Collect opportunities from all pages using pagination
   * Enhanced with content fingerprinting and duplicate detection
   * @returns {Promise<Array>} Array of all collected opportunities
   */
  async collectAllPages() {
    try {
      this.debugLog('Collecting opportunities from all pages');
      console.log('💬 [QWOTED DEBUG] Starting to collect opportunities from all pages');
      
      // Update notification
      window.scraperNotification.update({
        status: 'running',
        message: 'Searching for source requests...',
        currentPage: 1
      });
      
      // Keep track of all collected opportunities
      const allOpportunities = [];
      let currentPage = 1;
      let hasMorePages = true;
      const maxPagesToCheck = 20; // Increased limit to handle larger result sets
      let duplicatePageCount = 0;
      const maxDuplicatePages = 3; // Stop after this many duplicate pages in a row
      
      while (hasMorePages && currentPage <= maxPagesToCheck) {
        console.log(`💬 [QWOTED DEBUG] Processing page ${currentPage}`);
        this.updateDebugPanel('status', `<div>Processing page ${currentPage}</div>`);
        
        // Update notification for current page
        window.scraperNotification.update({
          currentPage: currentPage,
          message: `Processing page ${currentPage}...`
        });
        
        // Generate a content fingerprint before parsing
        const beforeFingerprint = this.generateContentFingerprint();
        this.debugLog(`Page ${currentPage} content fingerprint: ${beforeFingerprint}`);
        
        // Parse opportunities from current page
        const opportunities = await this._parseRows();
        console.log(`💬 [QWOTED DEBUG] Found ${opportunities.length} opportunities on page ${currentPage} (${allOpportunities.length} total so far)`);
        
        // Add to collection, filtering duplicates using our improved method
        let newItemsOnPage = 0;
        for (const opportunity of opportunities) {
          // Skip invalid items
          if (!opportunity || !opportunity.title || !opportunity.description) continue;
          
          // Check if it's a duplicate using content fingerprinting
          if (!this.isContentDuplicate(opportunity)) {
            allOpportunities.push(opportunity);
            newItemsOnPage++;
          }
        }
        
        // Update progress percentage 
        const progressPercentage = Math.min(20 + currentPage * 5, 80); // Cap at 80%
        window.scraperNotification.updateProgress(progressPercentage);
        
        // If we found no new items on this page, increment duplicate count
        if (newItemsOnPage === 0) {
          duplicatePageCount++;
          this.debugLog(`No new items on page ${currentPage}, duplicate page count: ${duplicatePageCount}`);
          
          // If we've hit our maximum duplicate pages in a row, stop pagination
          if (duplicatePageCount >= maxDuplicatePages) {
            this.debugLog(`Reached ${maxDuplicatePages} duplicate pages in a row, stopping pagination`);
            console.log(`💬 [QWOTED DEBUG] Reached ${maxDuplicatePages} duplicate pages in a row, stopping pagination`);
            hasMorePages = false;
            break;
          }
        } else {
          // Reset duplicate count if we found new items
          duplicatePageCount = 0;
        }
        
        // Find next page button if we're continuing
        if (hasMorePages) {
          let nextButton;
          try {
            // Find the next page button using multiple strategies
            // Strategy 1: Try standard selectors
            nextButton = document.querySelector(
              'button[aria-label="Next page"], ' + 
              'a.next-page, .pagination .next, ' + 
              '.pagination-next, [data-testid="pagination-next"], ' +
              'button:has([aria-label="next"]), ' +
              'a[rel="next"], nav [aria-label="Next"]'
            );
            
            // Strategy 2: Try to find by text content if not found
            if (!nextButton) {
              const allButtons = Array.from(document.querySelectorAll('button, a.page-link, .page-link, .pagination a, nav a, nav button'));
              nextButton = allButtons.find(btn => {
                const text = btn.textContent.trim().toLowerCase();
                // Look for various forms of "next"
                return (text === 'next' || 
                       text === '›' || 
                       text === 'next page' || 
                       text === '»' || 
                       text.includes('next') ||
                       text.includes('›') ||
                       text.includes('»'));
              });
            }
            
            // Strategy 3: Look for buttons with next icons
            if (!nextButton) {
              const iconButtons = Array.from(document.querySelectorAll(
                'button:has(svg), a:has(svg), button:has(i[class*="next"]), a:has(i[class*="next"]), button:has(i[class*="arrow"]), a:has(i[class*="arrow"])'
              ));
              nextButton = iconButtons.find(btn => {
                // Check if this button has a right arrow icon or is positioned at the right side of pagination
                const hasArrowClasses = btn.innerHTML.includes('class="') && 
                  (btn.innerHTML.includes('next') || 
                   btn.innerHTML.includes('arrow') ||
                   btn.innerHTML.includes('right'));
                return hasArrowClasses;
              });
            }
          } catch (err) {
            console.warn('💬 [QWOTED DEBUG] Error finding next button:', err);
          }
          
          // If no next button found, we've reached the end
          if (!nextButton) {
            console.log(`💬 [QWOTED DEBUG] No next page button found on page ${currentPage}, stopping pagination`);
            hasMorePages = false;
            break;
          }
          
          // Check if next button is disabled
          const isDisabled = nextButton.getAttribute('aria-disabled') === 'true' ||
                          nextButton.hasAttribute('disabled') ||
                          nextButton.classList.contains('disabled') ||
                          window.getComputedStyle(nextButton).opacity === '0.5';
          
          if (isDisabled) {
            console.log('💬 [QWOTED DEBUG] Next button is disabled, reached last page');
            hasMorePages = false;
            break;
          }
          
          // Click next button and wait for content to change
          console.log('💬 [QWOTED DEBUG] Clicking next page button');
          this.updateDebugPanel('status', `<div>Navigating to page ${currentPage + 1}...</div>`);
          
          try {
            // Click the next button
            nextButton.click();
            
            // Use our content fingerprinting to verify the page actually changed
            const contentChanged = await this.waitForContentChange(beforeFingerprint);
            
            if (!contentChanged) {
              console.log('💬 [QWOTED DEBUG] Content did not change after clicking next button');
              this.debugLog('Content did not change after navigation attempt');
              duplicatePageCount++;
              
              // If we've tried several times without content changing, stop
              if (duplicatePageCount >= maxDuplicatePages) {
                console.log(`💬 [QWOTED DEBUG] Content not changing after ${maxDuplicatePages} attempts, stopping pagination`);
                hasMorePages = false;
                break;
              }
              
              // Try one more time with extra delay
              await new Promise(r => setTimeout(r, 2000));
            } else {
              // Content changed successfully, move to next page
              currentPage++;
              console.log(`💬 [QWOTED DEBUG] Advanced to page ${currentPage}`);
            }
            
          } catch (err) {
            console.error('💬 [QWOTED DEBUG] Error navigating to next page:', err);
            hasMorePages = false;
          }
        }
      }
      
      // Return all collected opportunities
      console.log(`💬 [QWOTED DEBUG] Completed pagination, found ${allOpportunities.length} total opportunities across ${currentPage} pages`);
      
      // Final notification update
      window.scraperNotification.update({
        status: allOpportunities.length > 0 ? 'success' : 'complete',
        totalFound: allOpportunities.length,
        message: `Found ${allOpportunities.length} source requests across ${currentPage} pages`
      });
      
      // Validate and filter invalid opportunities
      const validOpportunities = allOpportunities.filter(opp => {
        if (!opp) return false;
        
        // Validate required fields
        const isValid = opp.title && opp.description && opp.externalId;
        if (!isValid) {
          console.warn(`💬 [QWOTED DEBUG] Filtering invalid opportunity from page ${currentPage}`, opp);
        }
        return isValid;
      });
      
      return validOpportunities;
    } catch (error) {
      console.error('💬 [QWOTED DEBUG] Error in collectAllPages:', error);
      return [];
    }
  }
  
  /**
   * Parse rows from the current page
   * @returns {Array} Array of opportunity objects
   */
  _parseRows() {
    try {
      console.log('💬 [QWOTED DEBUG] Starting to parse rows');
      
      // Try to use the specific selector first
      console.log('💬 [QWOTED DEBUG] Trying primary row selector:', this.ROW_SELECTOR);
      let rows = document.querySelectorAll(this.ROW_SELECTOR);
      console.log(`💬 [QWOTED DEBUG] Primary selector found ${rows.length} rows`);
      
      // Check for React components first (most likely scenario for Qwoted)
      const reactComponents = document.querySelectorAll('[data-react-class*="source_requests"], [data-react-class*="opportunity"]');
      if (reactComponents.length > 0) {
        console.log(`💬 [QWOTED DEBUG] Found ${reactComponents.length} React components that may contain opportunities`);
        
        // Look for opportunity containers within React components
        for (const component of reactComponents) {
          const opportunities = component.querySelectorAll('.card, .opportunity-card, .request-card, .row > .col');
          if (opportunities.length > 0) {
            console.log(`💬 [QWOTED DEBUG] Found ${opportunities.length} opportunity containers in React component`);
            rows = opportunities;
            break;
          }
        }
      }
      
      // Fall back to generic selectors if needed
      if (!rows.length) {
        console.log('💬 [QWOTED DEBUG] Primary selector found no rows, trying fallback methods');
        
        // Try finding a table structure
        const table = document.querySelector(this.selectors.table);
        if (table) {
          console.log('💬 [QWOTED DEBUG] Table found, looking for rows within table');
          rows = table.querySelectorAll(this.selectors.row);
          console.log(`💬 [QWOTED DEBUG] Found ${rows.length} rows within table`);
        } else {
          console.log('💬 [QWOTED DEBUG] No table found, checking for card-based layout');
          
          // Look for card-based layouts (common in modern React UIs)
          rows = document.querySelectorAll('.card, .card-body, .list-item, article');
          console.log(`💬 [QWOTED DEBUG] Card selector found ${rows.length} potential items`);
          
          if (!rows.length) {
            console.log('💬 [QWOTED DEBUG] No cards found, trying generic containers');
            // Try to find any div with meaningful content
            rows = document.querySelectorAll('div h3, div h4, div p');
            console.log(`💬 [QWOTED DEBUG] Generic container selector found ${rows.length} items`);
            
            if (!rows.length) {
              // Last resort: try very generic selectors
              console.log('💬 [QWOTED DEBUG] Using last resort selectors');
              rows = document.querySelectorAll('tr, .source-request-item, .request-item, .item, .list-group-item');
              console.log(`💬 [QWOTED DEBUG] Last resort selector found ${rows.length} rows`);
            }
          }
        }
      }
      
      this.debugLog(`Found ${rows.length} rows/items in total`);
      console.log(`💬 [QWOTED DEBUG] Found ${rows.length} rows/items to process`);
      
      // If we have rows, document the structure of the first one for debugging
      if (rows.length > 0) {
        console.log('💬 [QWOTED DEBUG] First row/item HTML structure:', rows[0].outerHTML);
      }
      
      // Process all rows using base class helper methods with enhanced extraction
      return [...rows].map((item, index) => {
        try {
          console.log(`💬 [QWOTED DEBUG] Processing item ${index + 1}/${rows.length}`);
          
          // Skip empty containers/advertisements that don't have meaningful content
          if (!item.textContent.trim() || item.textContent.trim().length < 10) {
            console.log(`💬 [QWOTED DEBUG] Skipping empty item ${index + 1}`);
            return null;
          }
          
          // Extract and debug each field with enhanced fallbacks
          
          // Extract using robust selectors - anchored to card structure
          
          // Extract brand/organization name using the robust h6 selector
          let brandName = this.extractText(item, this.selectors.brandName);
          if (!brandName) {
            // Fallback to any heading element within the card
            const heading = item.querySelector('h1, h2, h3, h4, h5, h6, strong, b, .title, .header');
            brandName = heading ? heading.textContent.trim() : '';
          }
          console.log(`💬 [QWOTED DEBUG] Item ${index + 1} - Brand Name:`, brandName);

          // Check if we have an EXPERT REQUEST category label using robust selector
          const categoryElement = item.querySelector(this.selectors.categoryLabel);
          const hasExpertRequest = categoryElement && categoryElement.textContent.toUpperCase().includes('EXPERT REQUEST');
          console.log(`💬 [QWOTED DEBUG] Item ${index + 1} - Has Expert Request label:`, hasExpertRequest);

          // Extract the main title/pitch using the robust main title link selector
          let pitchTitle = this.extractText(item, this.selectors.mainTitleLink);
          if (!pitchTitle) {
            // Try the fallback pitchTitle selector
            pitchTitle = this.extractText(item, this.selectors.pitchTitle);
          }
          if (!pitchTitle) {
            // Try to find any text that looks like a pitch title (contains 'Looking for', 'Seeking', etc.)
            const allText = item.textContent;
            const seekingPattern = /(?:looking for|seeking|need|wanted|searching for)[^.]*/i;
            const match = allText.match(seekingPattern);
            if (match) {
              pitchTitle = match[0].trim();
            }
          }
          console.log(`💬 [QWOTED DEBUG] Item ${index + 1} - Pitch Title:`, pitchTitle);
          
          // Extract URL using the robust main title link selector
          let url = item.querySelector(this.selectors.mainTitleLink)?.href;
          if (!url) {
            // Try the brand name link as fallback
            url = item.querySelector(this.selectors.brandName)?.href;
          }
          if (!url) {
            // Try to find any link within the card
            const allLinks = item.querySelectorAll('a[href]');
            if (allLinks.length > 0) {
              for (const link of allLinks) {
                const href = link.href;
                // Prioritize links to source_requests or opportunities
                if (href && (href.includes('source_requests') || href.includes('opportunity'))) {
                  url = href;
                  break;
                }
              }
              
              // If no specific link found, use the first one
              if (!url && allLinks.length > 0) {
                url = allLinks[0].href;
              }
            }
          }
          
          // If we still don't have a URL, use the app.qwoted.com source_requests page
          if (!url) {
            url = 'https://app.qwoted.com/source_requests';
          }
          
          console.log(`💬 [QWOTED DEBUG] Item ${index + 1} - URL:`, url);
          
          // Extract deadline with specific selector
          let deadline = this.extractText(item, this.selectors.deadline);
          if (!deadline) {
            // Look for date patterns in text
            const datePattern = /due:\s*(.*?)(?:\s|$)|deadline:\s*(.*?)(?:\s|$)|\d{1,2}\/\d{1,2}\/\d{2,4}|\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{2,4}/i;
            const allText = item.textContent.trim();
            const dateMatch = allText.match(datePattern);
            deadline = dateMatch ? dateMatch[0] : '';
          }
          console.log(`💬 [QWOTED DEBUG] Item ${index + 1} - Deadline:`, deadline || 'Not found');
          
          // Extract posted time
          let postedTime = this.extractText(item, this.selectors.postedTime);
          console.log(`💬 [QWOTED DEBUG] Item ${index + 1} - Posted Time:`, postedTime || 'Not found');
          
          // Extract tags using robust hashtag badge selector
          let tags = [];
          const badgeElements = item.querySelectorAll(this.selectors.hashtagBadges);
          if (badgeElements.length > 0) {
            tags = Array.from(badgeElements).map(badge => badge.textContent.trim()).filter(tag => tag);
          }
          
          // If no badge tags found, try the fallback tags selector
          if (!tags.length) {
            tags = this.extractAllText(item, this.selectors.tags);
          }
          
          // If still no tags found, look for hashtag-style tags in content
          if (!tags.length) {
            const allText = item.textContent;
            const hashtagPattern = /#([A-Za-z0-9]+)/g;
            const matches = allText.matchAll(hashtagPattern);
            const hashTags = [...matches].map(match => match[1]);
            if (hashTags.length > 0) {
              tags = hashTags;
            } else {
              // Try to extract from category if available
              const category = this.extractText(item, this.selectors.category);
              if (category) tags = [category];
            }
          }
          
          console.log(`💬 [QWOTED DEBUG] Item ${index + 1} - Tags:`, tags);
          
          // Extract description using the robust snippet paragraph selector
          let description = this.extractText(item, this.selectors.description);
          if (!description) {
            // Try to find any paragraph or div with substantial text
            const paragraphs = item.querySelectorAll('p, .text, .content, .description, .details');
            for (const p of paragraphs) {
              const text = p.textContent.trim();
              if (text.length > 20 && text !== brandName && text !== pitchTitle) {
                description = text;
                break;
              }
            }
            
            // If still no description, use any substantial text in the item
            if (!description) {
              const allText = item.textContent.trim();
              if (allText.length > 20) description = allText;
            }
          }
          console.log(`💬 [QWOTED DEBUG] Item ${index + 1} - Description:`,
            description ? (description.length > 50 ? description.substring(0, 50) + '...' : description) : 'Not found');
          
          // Get external ID with fallbacks
          let externalId = this.getExternalId(item, this.selectors.title);
          if (!externalId) {
            // Try to find ID in various attributes
            for (const attr of ['data-id', 'data-key', 'data-item-id', 'id']) {
              const attrValue = item.getAttribute(attr);
              if (attrValue) {
                externalId = attrValue;
                break;
              }
            }
            
            // If still no ID, check the URL for an ID
            if (!externalId && url) {
              const urlObj = new URL(url, window.location.origin);
              const idParam = urlObj.searchParams.get('id');
              if (idParam) externalId = idParam;
              else {
                // Try to extract ID from path
                const pathParts = urlObj.pathname.split('/');
                const lastPart = pathParts[pathParts.length - 1];
                if (lastPart && /\d+/.test(lastPart)) externalId = lastPart;
              }
            }
            
            // Last resort: generate a stable ID from content instead of timestamp
            if (!externalId) {
              // Create a stable ID from the title and description content
              // This ensures same content gets same ID across scrapes
              const titleText = pitchTitle || brandName || '';
              const descText = description ? description.substring(0, 40) : '';
              
              // Generate a hash from the content with more uniqueness
              let contentHash = '';
              if (titleText) {
                // Take first 20 chars of title (if available)
                contentHash += titleText.substring(0, 20).replace(/[^a-zA-Z0-9]/g, '-');
              }
              
              if (descText) {
                // Add first 10 chars of description (if available)
                contentHash += `-${descText.substring(0, 10).replace(/[^a-zA-Z0-9]/g, '-')}`;
              }
              
              // Add timestamp for uniqueness
              const timestamp = Date.now().toString(36).substring(5);
              
              // Ensure the ID is not too long but still unique
              externalId = `qwoted-${contentHash}-${timestamp}`.substring(0, 50);
              
              // Log the generated ID
              console.log(`💬 [QWOTED DEBUG] Item ${index + 1} - Generated stable ID: ${externalId}`);
            }
          }
          console.log(`💬 [QWOTED DEBUG] Item ${index + 1} - External ID:`, externalId);
          
          // Try to extract category if available
          let category = this.extractText(item, this.selectors.category);
          if (!category && tags.length > 0) {
            // Use first tag as category if no specific category
            category = tags[0];
          }
          if (!category) category = 'Query / Event / Award';
          
          // Combine the pitch title and brand name to create the proper title and description
          // Use the pitch title as the main title if available, otherwise use the brand name
          const finalTitle = pitchTitle || brandName || 'Untitled Opportunity';
          
          // Store the brand name as the media outlet for proper display in the UI
          const mediaOutlet = brandName || 'Not specified';
          
          // Clean up the deadline text
          let cleanDeadline = deadline;
          if (deadline && deadline.toLowerCase().includes('deadline:')) {
            // Remove duplicate "Deadline:" text
            cleanDeadline = deadline.replace(/deadline:\s*deadline:/i, 'Deadline:');
            
            // If it still says "Deadline: in" without a date, try to find a better deadline
            if (cleanDeadline.toLowerCase().includes('deadline: in') && !cleanDeadline.match(/\d+/)) {
              const deadlineElements = item.querySelectorAll('time, .deadline, .due-date');
              for (const el of deadlineElements) {
                if (el.textContent.match(/\d+/)) {
                  cleanDeadline = el.textContent.trim();
                  break;
                }
              }
            }
          }
          
          // Fix garbled descriptions by cleaning up concatenated fields
          let cleanDescription = description;
          if (description) {
            // Remove "Share" prefix from descriptions
            if (description.startsWith('Share')) {
              cleanDescription = cleanDescription.replace(/^Share[A-Za-z\s]+/, '');
            }
            
            // Remove "expert request" text that gets incorrectly included
            if (cleanDescription.includes('expert request')) {
              cleanDescription = cleanDescription.replace(/expert request/g, '');
            }
            
            // Remove duplicated brand names at the beginning
            if (brandName && cleanDescription.startsWith(brandName)) {
              cleanDescription = cleanDescription.replace(new RegExp(`^${brandName}`), '');
            }
            
            // Trim the description
            cleanDescription = cleanDescription.trim();
            
            // If after cleaning we're left with nothing substantial, use the original
            if (cleanDescription.length < 10 && description.length > 10) {
              cleanDescription = description;
            }
            
            // Log the cleaning results
            if (cleanDescription !== description) {
              console.log(`💬 [QWOTED DEBUG] Item ${index + 1} - Cleaned description: "${description.substring(0, 30)}..." -> "${cleanDescription.substring(0, 30)}..."`);
            }
          }
          
          return {
            title: finalTitle,
            url,
            deadline: cleanDeadline,
            postedTime,
            tags,
            description: cleanDescription,
            externalId,
            category,
            source: 'Qwoted',
            mediaOutlet,
            brandName,
            hasExpertRequest,
            scrapedAt: new Date().toISOString()
          };
        } catch (error) {
          window.logManager.error(`Error processing Qwoted row:`, error);
          console.error(`💬 [QWOTED DEBUG] Error processing row ${index + 1}:`, error);
          console.error(`💬 [QWOTED DEBUG] Row HTML:`, item.outerHTML);
          return null;
        }
      })
      .filter(Boolean) // Remove any null entries
      .map(item => {
        try {
          // Apply additional validation before processing
          if (!item || typeof item !== 'object') {
            console.warn('💬 [QWOTED DEBUG] Skipping invalid item:', item);
            return null;
          }
          
          // Process the opportunity
          return window.processOpportunity(item, 'qwoted');
        } catch (error) {
          console.error('💬 [QWOTED DEBUG] Error processing item:', error);
          return null;
        }
      })
      .filter(Boolean); // Remove any nulls that might have resulted from processing
    } catch (error) {
      window.logManager.error('Error parsing Qwoted rows:', error);
      console.error('💬 [QWOTED DEBUG] Error parsing rows:', error);
      console.error('💬 [QWOTED DEBUG] Error stack:', error.stack);
      return [];
    }
  }

  /**
   * Create the debug panel UI
   */
  createDebugPanel() {
    // Only create if debug mode is on and panel doesn't already exist
    if (!this.debugMode || !this.showDebugPanel || document.getElementById(this.debugPanelId)) {
      return;
    }
    
    // Create panel container
    const panel = document.createElement('div');
    panel.id = this.debugPanelId;
    panel.style.cssText = `
      position: fixed;
      top: 0;
      right: 0;
      width: 400px;
      max-height: 100vh;
      background-color: white;
      border-left: 1px solid #ddd;
      z-index: 9999;
      overflow-y: auto;
      font-family: Arial, sans-serif;
      font-size: 14px;
      padding: 15px;
      box-shadow: -5px 0 15px rgba(0,0,0,0.1);
      color: #333;
    `;
    
    // Create header
    const header = document.createElement('div');
    header.innerHTML = '<h3 style="margin-top: 0; color: #333;">Qwoted Scraper Debug</h3>';
    panel.appendChild(header);
    
    // Create content sections
    const statusSection = document.createElement('div');
    statusSection.innerHTML = '<h4 style="margin-bottom: 5px; color: #444;">Status</h4>';
    const statusContent = document.createElement('div');
    statusContent.id = 'qwoted-debug-status';
    statusContent.style.cssText = 'padding: 8px; background-color: #f5f5f5; border-radius: 4px; margin-bottom: 15px;';
    statusSection.appendChild(statusContent);
    panel.appendChild(statusSection);
    
    const logSection = document.createElement('div');
    logSection.innerHTML = '<h4 style="margin-bottom: 5px; color: #444;">Log</h4>';
    const logContent = document.createElement('div');
    logContent.id = 'qwoted-debug-log';
    logContent.style.cssText = 'padding: 8px; background-color: #f5f5f5; border-radius: 4px; height: 300px; overflow-y: auto; font-family: monospace; font-size: 12px;';
    logSection.appendChild(logContent);
    panel.appendChild(logSection);
    
    // Add close button
    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Close Debug Panel';
    closeBtn.style.cssText = 'margin-top: 10px; padding: 5px 10px; background-color: #f44336; color: white; border: none; border-radius: 4px; cursor: pointer;';
    closeBtn.onclick = () => {
      panel.remove();
      this.showDebugPanel = false;
    };
    panel.appendChild(closeBtn);
    
    // Append to body
    document.body.appendChild(panel);
  }

  /**
   * Update the debug panel with new information
   * @param {string} section - The section to update ('status' or 'log')
   * @param {string} content - The HTML content to add
   */
  updateDebugPanel(section, content) {
    // Skip updates if debug mode is off or panel isn't shown
    if (!this.debugMode || !this.showDebugPanel) return;
    
    const sectionId = `qwoted-debug-${section}`;
    const sectionEl = document.getElementById(sectionId);
    if (!sectionEl) return;
    
    if (section === 'log') {
      // Append to log with timestamp
      const timestamp = new Date().toLocaleTimeString();
      sectionEl.innerHTML += `<div><span style="color: #888;">[${timestamp}]</span> ${content}</div>`;
      // Auto-scroll to bottom
      sectionEl.scrollTop = sectionEl.scrollHeight;
    } else {
      // Replace status content
      sectionEl.innerHTML = content;
    }
  }

  /**
   * Generate a fingerprint of the current page content to detect changes
   * @returns {string} A hash-like string representing the current content state
   */
  generateContentFingerprint() {
    const contentEl = document.querySelector('.requests-list, .opportunities-list, [data-testid="opportunities-table"], .source-requests-table');
    if (!contentEl) return 'no-content-element';
    
    const items = contentEl.querySelectorAll(this.ROW_SELECTOR);
    const itemCount = items.length;
    
    // Create fingerprint components
    const components = [
      itemCount, // Number of items
      document.title, // Page title
      window.location.href, // URL
    ];
    
    // Add text from first and last items if they exist
    if (itemCount > 0) {
      const firstItemText = items[0].textContent.trim().substring(0, 50);
      components.push(firstItemText);
      
      if (itemCount > 1) {
        const lastItemText = items[itemCount - 1].textContent.trim().substring(0, 50);
        components.push(lastItemText);
      }
    }
    
    // Combine components and create simple hash
    const fingerprint = components.join('|');
    
    // Create a simple hash of the fingerprint
    let hash = 0;
    for (let i = 0; i < fingerprint.length; i++) {
      const char = fingerprint.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    
    return hash.toString(16) + '-' + itemCount;
  }
  
  /**
   * Wait for content to change after an action like pagination
   * @param {string} beforeFingerprint - Content fingerprint before the action
   * @param {number} maxWaitTime - Maximum time to wait in ms
   * @param {number} checkInterval - Interval between checks in ms
   * @returns {Promise<boolean>} True if content changed, false if timed out
   */
  async waitForContentChange(beforeFingerprint, maxWaitTime = 5000, checkInterval = 300) {
    this.debugLog('Waiting for content change...');
    const startTime = Date.now();
    let timeoutReached = false;
    
    while (!timeoutReached) {
      // Check if timeout reached
      if (Date.now() - startTime > maxWaitTime) {
        timeoutReached = true;
        break;
      }
      
      // Wait for check interval
      await new Promise(resolve => setTimeout(resolve, checkInterval));
      
      // Generate new fingerprint and compare
      const currentFingerprint = this.generateContentFingerprint();
      
      // Debug logging
      this.debugLog(`Comparing fingerprints: ${beforeFingerprint} vs ${currentFingerprint}`);
      this.updateDebugPanel('status', `<div>Waiting for page change...</div><div>Current fingerprint: ${currentFingerprint}</div>`);
      
      // Check if content changed
      if (currentFingerprint !== beforeFingerprint) {
        this.debugLog('Content changed detected!');
        return true;
      }
    }
    
    this.debugLog('Timed out waiting for content change');
    return false;
  }
  
  /**
   * Check if an opportunity is a duplicate of already processed items
   * @param {object} opp - The opportunity object to check
   * @returns {boolean} True if duplicate, false if new
   */
  isContentDuplicate(opp) {
    if (!opp || !opp.title || !opp.description) return false;
    
    // Create a simple fingerprint for the opportunity
    const titleFingerprint = opp.title.toLowerCase().trim();
    const descFingerprint = opp.description.substring(0, 40).toLowerCase().trim();
    const fingerprint = `${titleFingerprint}|${descFingerprint}`;
    
    // Check if this fingerprint has been seen before
    if (this.processedItems.has(fingerprint)) {
      this.debugLog(`Duplicate detected: ${opp.title}`);
      return true;
    }
    
    // Add to processed items
    this.processedItems.add(fingerprint);
    return false;
  }
  
  /**
   * Main init method called from content script
   */
  async init() {
    this.debugLog('Starting Qwoted scraper initialization');
    console.log('💬 [QWOTED DEBUG] ==== QWOTED SCRAPER STARTING ====');
    console.log('💬 [QWOTED DEBUG] Page URL:', window.location.href);
    console.log('💬 [QWOTED DEBUG] Page title:', document.title);
    
    // Set up diagnostic tools
    window.setupGlobalDiagnostics();
    console.log('💬 [QWOTED DEBUG] Diagnostic tools initialized. Use window.debugOpportunities() in console to diagnose visibility issues.');
    
    // Show the notification UI
    window.scraperNotification.show('qwoted');
    window.scraperNotification.update({
      status: 'running',
      message: 'Initializing Qwoted scraper...'
    });
    window.scraperNotification.updateProgress(10);
    
    try {
      // Initialize the scraper
      console.log('💬 [QWOTED DEBUG] Step 1: Initializing scraper');
      window.scraperNotification.updateProgress(10);
      const initialized = await this.initialize();
      if (!initialized) {
        this.debugLog('Failed to initialize Qwoted scraper');
        console.log('💬 [QWOTED DEBUG] Initialization failed, aborting');
        
        // Update notification
        window.scraperNotification.update({
          status: 'error',
          message: 'Failed to initialize scraper on this page.'
        });
        
        return false;
      }
      
      // Collect opportunities from all pages
      console.log('💬 [QWOTED DEBUG] Step 2: Collecting opportunities from all pages');
      window.scraperNotification.updateProgress(20);
      window.scraperNotification.update({
        message: 'Searching for source requests...'
      });
      let opportunities = await this.collectAllPages();
      
      // Process and normalize all opportunities through platform adapter
      const rawCount = opportunities.length;
      const normalizedOpportunities = opportunities
        .map(opp => window.processOpportunity(opp, 'qwoted'))
        .filter(Boolean); // Remove null results (invalid items)
      
      // Log normalization and validation results
      console.log(`💬 [QWOTED DEBUG] Normalization results: ${normalizedOpportunities.length} valid out of ${rawCount} total opportunities`);
      
      // Replace with normalized opportunities
      opportunities = normalizedOpportunities;
      
      this.debugLog(`Collected ${opportunities.length} valid opportunities in total`);
      console.log(`💬 [QWOTED DEBUG] Collected ${opportunities.length} valid opportunities in total`);
      
      // Save opportunities to storage
      console.log('💬 [QWOTED DEBUG] Step 3: Persisting opportunities to storage');
      console.log(`💬 [QWOTED DEBUG] Attempting to save ${opportunities.length} opportunities to key: ${this.storageKey}`);
      
      window.scraperNotification.updateProgress(90);
      window.scraperNotification.update({
        message: 'Saving source requests to storage...'
      });
      
      // Enhanced persistence with better error handling
      try {
        // First, verify we have opportunities to save
        if (!opportunities || opportunities.length === 0) {
          console.error('💬 [QWOTED DEBUG] No opportunities to save!');
          throw new Error('No opportunities to save');
        }
        
        // Explicitly log the first few opportunities for debugging
        console.log('💬 [QWOTED DEBUG] Sample opportunities to save:',
          opportunities.slice(0, 2).map(o => ({
            title: o.title,
            externalId: o.externalId,
            source: o.source
          }))
        );
        
        // Direct storage approach (bypass the base class method for debugging)
        chrome.storage.local.get(this.storageKey, (result) => {
          let existingOpps = result[this.storageKey] || [];
          console.log(`💬 [QWOTED DEBUG] Found ${existingOpps.length} existing opportunities in storage`);
          
          // Merge new with existing
          let merged = [...existingOpps];
          const newOppIds = new Set();
          
          // Add new opportunities with improved duplicate detection
          for (const newOpp of opportunities) {
            const idKey = newOpp.externalId || newOpp.id;
            if (!idKey) continue;
            
            newOppIds.add(idKey);
            
            // First try exact ID match
            let existingIndex = merged.findIndex(op =>
              (op.externalId === idKey || op.id === idKey) && op.source === newOpp.source
            );
            
            // If no exact match found, try content-based duplicate detection
            if (existingIndex < 0 && newOpp.title && newOpp.description) {
              // Check for content similarity
              existingIndex = merged.findIndex(op => {
                // Skip items that don't have title or description
                if (!op.title || !op.description) return false;
                
                // First check source
                if (op.source !== newOpp.source) return false;
                
                // Check title similarity (case insensitive)
                const titleMatch = op.title.toLowerCase().includes(newOpp.title.toLowerCase()) ||
                                  newOpp.title.toLowerCase().includes(op.title.toLowerCase());
                
                // If titles are similar, check for description overlap
                if (titleMatch) {
                  const descSubstr = newOpp.description.substring(0, 30).toLowerCase();
                  return op.description.toLowerCase().includes(descSubstr);
                }
                
                return false;
              });
              
              if (existingIndex >= 0) {
                console.log(`💬 [QWOTED DEBUG] Found content-based duplicate for ${idKey}`);
              }
            }
            
            if (existingIndex >= 0) {
              merged[existingIndex] = {
                ...merged[existingIndex],
                ...newOpp,
                scrapedAt: new Date().toISOString()
              };
            } else {
              merged.push(newOpp);
            }
          }
          
          console.log(`💬 [QWOTED DEBUG] Saving ${merged.length} total opportunities (${opportunities.length} new/updated)`);
          
          // Save to storage
          chrome.storage.local.set({ [this.storageKey]: merged }, () => {
            if (chrome.runtime.lastError) {
              console.error('💬 [QWOTED DEBUG] Error saving to storage:', chrome.runtime.lastError);
              window.scraperNotification.update({
                status: 'error',
                message: `Error saving: ${chrome.runtime.lastError.message}`
              });
            } else {
              console.log(`💬 [QWOTED DEBUG] Successfully saved ${merged.length} opportunities to storage`);
              
              // Also save to main 'opportunities' key for backward compatibility
              // Get current 'opportunities' to merge our new ones
              chrome.storage.local.get('opportunities', (result) => {
                let allOpps = result.opportunities || [];
                console.log(`💬 [QWOTED DEBUG] Main 'opportunities' key has ${allOpps.length} items before merging`);
                
                // Create a map of existing opportunities by ID for faster lookup
                const existingMap = new Map();
                for (const op of allOpps) {
                  const idKey = op.externalId || op.id;
                  if (idKey) {
                    existingMap.set(`${idKey}-${op.source || 'unknown'}`, op);
                  }
                }
                
                // Count how many we're adding vs updating
                let updatedCount = 0;
                let addedCount = 0;
                
                // Process all our new opportunities with improved duplicate detection
                for (const newOpp of opportunities) {
                  const idKey = newOpp.externalId || newOpp.id;
                  if (!idKey) continue;
                  
                  // Create a key for the map lookup
                  const mapKey = `${idKey}-${newOpp.source || 'Qwoted'}`;
                  let foundDuplicate = false;
                  
                  // First check exact ID match
                  if (existingMap.has(mapKey)) {
                    // Update existing with exact ID match
                    const existingOpp = existingMap.get(mapKey);
                    foundDuplicate = true;
                    existingMap.set(mapKey, {
                      ...existingOpp,
                      ...newOpp,
                      scrapedAt: new Date().toISOString(),
                      category: newOpp.category || existingOpp.category || 'General', // Ensure category always exists
                      source: newOpp.source || 'Qwoted' // Ensure source always exists
                    });
                    updatedCount++;
                  } else {
                    // If no exact match found, try content-based duplicate detection
                    if (newOpp.title && newOpp.description) {
                      // Look through all existing opportunities to find content-based duplicates
                      for (const [existingKey, existingOpp] of existingMap.entries()) {
                        // Skip if not the same source
                        if (existingOpp.source !== (newOpp.source || 'Qwoted')) continue;
                        
                        // Skip if missing title or description
                        if (!existingOpp.title || !existingOpp.description) continue;
                        
                        // Check title similarity (case insensitive)
                        const titleMatch = existingOpp.title.toLowerCase().includes(newOpp.title.toLowerCase()) ||
                                         newOpp.title.toLowerCase().includes(existingOpp.title.toLowerCase());
                        
                        // If titles are similar, check for description overlap
                        if (titleMatch) {
                          const descSubstr = newOpp.description.substring(0, 30).toLowerCase();
                          if (existingOpp.description.toLowerCase().includes(descSubstr)) {
                            // Update the content-based duplicate
                            existingMap.set(existingKey, {
                              ...existingOpp,
                              ...newOpp,
                              scrapedAt: new Date().toISOString(),
                              category: newOpp.category || existingOpp.category || 'General',
                              source: newOpp.source || 'Qwoted'
                            });
                            updatedCount++;
                            foundDuplicate = true;
                            console.log(`💬 [QWOTED DEBUG] Found content-based duplicate in main opportunities for ${idKey}`);
                            break;
                          }
                        }
                      }
                    }
                    
                    // If no duplicate found, add as new
                    if (!foundDuplicate) {
                      existingMap.set(mapKey, {
                        ...newOpp,
                        scrapedAt: new Date().toISOString(),
                        category: newOpp.category || 'General', // Ensure category exists
                        source: newOpp.source || 'Qwoted' // Ensure source exists
                      });
                      addedCount++;
                    }
                  }
                }
                
                // Convert map back to array
                const newAllOpps = Array.from(existingMap.values());
                
                // Save to storage and force a page reload to make sure the opportunities page shows them
                chrome.storage.local.set({ 'opportunities': newAllOpps }, () => {
                  if (chrome.runtime.lastError) {
                    console.error(`💬 [QWOTED DEBUG] Error updating main opportunities: ${chrome.runtime.lastError.message}`);
                  } else {
                    console.log(`💬 [QWOTED DEBUG] Updated main 'opportunities' key with ${newAllOpps.length} total opportunities (${addedCount} added, ${updatedCount} updated)`);
                    
                    // Refresh the opportunities.html page if it's open
                    chrome.tabs.query({url: chrome.runtime.getURL("opportunities.html")}, function(tabs) {
                      if (tabs.length > 0) {
                        console.log(`💬 [QWOTED DEBUG] Found opportunities page open, refreshing it`);
                        tabs.forEach(tab => {
                          chrome.tabs.reload(tab.id);
                        });
                      }
                    });
                  }
                });
              });
            }
          });
        });
        
        // Still use base class method as a backup
        const result = await this.persist(opportunities);
        console.log(`💬 [QWOTED DEBUG] Base persist method result: ${result ? 'Success' : 'Failed'}`);
        
      } catch (error) {
        console.error('💬 [QWOTED DEBUG] Error in persistence process:', error);
        window.scraperNotification.update({
          status: 'error',
          message: `Error saving: ${error.message}`
        });
      }
      
      // Final notification update
      window.scraperNotification.updateProgress(100);
      window.scraperNotification.update({
        status: 'success',
        totalFound: opportunities.length,
        message: `Successfully saved ${opportunities.length} source requests`
      });
      
      this.debugLog('Qwoted scraping completed successfully');
      console.log('💬 [QWOTED DEBUG] ==== QWOTED SCRAPER COMPLETED SUCCESSFULLY ====');
      return true;
    } catch (error) {
      window.logManager.error('Error during Qwoted scraping:', error);
      console.error('💬 [QWOTED DEBUG] Error during Qwoted scraping:', error);
      console.error('💬 [QWOTED DEBUG] Error stack:', error.stack);
      console.error('💬 [QWOTED DEBUG] ==== QWOTED SCRAPER FAILED ====');
      
      // Update notification with error
      window.scraperNotification.update({
        status: 'error',
        message: `Error: ${error.message || 'Unknown error occurred'}`
      });
      
      return false;
    }
  }
  
  /**
   * Load existing opportunities from storage
   * @returns {Promise<Array>} Promise resolving to array of opportunities
   */
  async loadExistingOpportunities() {
    return new Promise((resolve) => {
      chrome.storage.local.get([this.storageKey], (result) => {
        const opportunities = result[this.storageKey] || [];
        console.log(`💬 [QWOTED DEBUG] Loaded ${opportunities.length} existing opportunities from storage`);
        resolve(opportunities);
      });
    });
  }

  /**
   * Reset storage to clear duplicate data
   * Call this to clean up accumulated duplicates
   */
  async resetStorage() {
    console.log('💬 [QWOTED DEBUG] Resetting Qwoted storage to clean duplicates');
    
    // Show the notification UI
    window.scraperNotification.show('qwoted');
    window.scraperNotification.update({
      status: 'running',
      message: 'Cleaning duplicate opportunities...',
    });
    window.scraperNotification.updateProgress(10);
    
    try {
      // First, get all existing opportunities
      const allOpps = await this.loadExistingOpportunities();
      console.log(`💬 [QWOTED DEBUG] Found ${allOpps.length} opportunities to clean`);
      
      // Create a map to track unique items by title+description hash
      const uniqueMap = new Map();
      
      // Process all opportunities and keep only unique ones
      for (const opp of allOpps) {
        // Create a unique key based on title and description
        const titleText = opp.title || '';
        const descText = opp.description ? opp.description.substring(0, 40) : '';
        const key = `${titleText}-${descText}`.replace(/[^a-zA-Z0-9]/g, '-').substring(0, 30);
        
        // Only keep the most recent version of each opportunity
        if (!uniqueMap.has(key) ||
            (opp.scrapedAt && uniqueMap.get(key).scrapedAt &&
             new Date(opp.scrapedAt) > new Date(uniqueMap.get(key).scrapedAt))) {
          uniqueMap.set(key, {
            ...opp,
            externalId: `qwoted-${key}`, // Ensure stable ID
            category: opp.category || 'General', // Ensure category exists
            source: 'Qwoted'
          });
        }
      }
      
      // Convert to array
      let cleanedOpps = Array.from(uniqueMap.values());
      const rawCount = cleanedOpps.length;
      
      // Process and normalize all opportunities through platform adapter
      const normalizedCleanedOpps = cleanedOpps
        .map(opp => window.processOpportunity(opp, 'qwoted'))
        .filter(Boolean); // Remove null results (invalid items)
      
      console.log(`💬 [QWOTED DEBUG] Normalization results: ${normalizedCleanedOpps.length} valid out of ${rawCount} unique opportunities`);
      
      // Replace with normalized opportunities
      cleanedOpps = normalizedCleanedOpps;
      console.log(`💬 [QWOTED DEBUG] Cleaned down to ${cleanedOpps.length} valid unique opportunities`);
      
      // Save the cleaned data
      window.scraperNotification.updateProgress(50);
      window.scraperNotification.update({
        message: 'Saving cleaned data...'
      });
      
      // Save to qwotedOpportunities
      await new Promise((resolve) => {
        chrome.storage.local.set({ [this.storageKey]: cleanedOpps }, resolve);
      });
      
      // Also update the main opportunities key
      await new Promise((resolve) => {
        chrome.storage.local.get('opportunities', (result) => {
          let allMainOpps = result.opportunities || [];
          console.log(`💬 [QWOTED DEBUG] Cleaning main opportunities key (${allMainOpps.length} items)`);
          
          // Remove any existing Qwoted opportunities
          const nonQwotedOpps = allMainOpps.filter(op => op.source !== 'Qwoted');
          
          // Merge with cleaned Qwoted opportunities
          const mergedOpps = [...nonQwotedOpps, ...cleanedOpps];
          console.log(`💬 [QWOTED DEBUG] Merged ${nonQwotedOpps.length} non-Qwoted + ${cleanedOpps.length} cleaned Qwoted items`);
          
          // Save updated opportunities
          chrome.storage.local.set({ 'opportunities': mergedOpps }, () => {
            console.log(`💬 [QWOTED DEBUG] Saved ${mergedOpps.length} total opportunities after cleanup`);
            
            // Refresh the opportunities.html page if it's open
            chrome.tabs.query({url: chrome.runtime.getURL("opportunities.html")}, function(tabs) {
              if (tabs.length > 0) {
                console.log(`💬 [QWOTED DEBUG] Found opportunities page open, refreshing it`);
                tabs.forEach(tab => {
                  chrome.tabs.reload(tab.id);
                });
              }
            });
            
            resolve();
          });
        });
      });
      
      // Show success notification
      window.scraperNotification.updateProgress(100);
      window.scraperNotification.update({
        status: 'success',
        message: `Successfully cleaned duplicate opportunities`
      });
      
      return true;
    } catch (error) {
      console.error('💬 [QWOTED DEBUG] Error cleaning storage:', error);
      window.scraperNotification.update({
        status: 'error',
        message: `Error cleaning storage: ${error.message}`
      });
      
      return false;
    }
  }
}

// Create the scraper instance
const qwotedScraper = new QwotedScraper();

// Expose the scraper to the global window object for Manifest V3 compatibility
window.qwotedScraper = qwotedScraper;

// Add cleanup function to content script context
window.cleanQwotedStorage = function() {
  console.log('💬 [QWOTED DEBUG] Running Qwoted storage cleanup');
  qwotedScraper.resetStorage().then(result => {
    console.log(`💬 [QWOTED DEBUG] Storage cleanup ${result ? 'successful' : 'failed'}`);
    alert(`Storage cleanup ${result ? 'successful' : 'failed'}. ${result ? 'Duplicates have been removed.' : 'Check console for errors.'}`);
  });
};

// Log initialization success to confirm the module is properly loaded
// Only create the instance if it doesn't exist yet
if (!window.qwotedScraper) {
  // Create an instance and expose it to window
  window.qwotedScraper = new QwotedScraper();

  // Flag to indicate scraper is available
  window.qwotedScraperLoaded = true;

  // Dispatch an event to notify content scripts
  document.dispatchEvent(new CustomEvent('qwoted-scraper-ready', {
    detail: { success: true, timestamp: Date.now() }
  }));
}

console.log('💬 [QWOTED DEBUG] Qwoted scraper module initialized and exposed to window.qwotedScraper');