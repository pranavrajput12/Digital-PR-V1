/**
 * FeaturedScraperOptimized.js
 * Optimized scraper for Featured.com's authenticated questions page
 *
 * This scraper is specifically designed for the authenticated user experience at
 * Featured.com/experts/questions, focusing on extracting opportunities from the
 * table-based structure observed in this view.
 *
 * @author SourceBottle Team
 */

// Using non-module pattern for compatibility with content script loading
// BaseScraper, logManager and scrapers will be accessed from window globals

/**
 * FeaturedScraperOptimized - Class for scraping opportunities from Featured.com's authenticated view
 * Implementation without ES modules for content script compatibility
 */
class FeaturedScraperOptimized {
  /**
   * Constructor for FeaturedScraperOptimized
   */
  constructor() {
    // Initialize as if extending BaseScraper
    this.storageKey = 'featuredOpportunities';
    this.sourceName = 'Featured';
    
    this.name = 'Featured.com';
    this.opportunities = [];
    
    // Memory management - use Map with timestamps instead of unbounded Set
    this.processedIds = new Map(); // Store ID -> timestamp for memory management
    this.maxCachedIds = 5000; // Maximum number of IDs to keep in memory
    
    // Debug settings - disabled by default for production use
    this.debugMode = false;
    this.maxScrolls = 20; // Number of scrolls to load all content
    this.scrollDelay = 1000; // Delay between scrolls in ms
    
    // Pagination settings
    this.autoPaginate = true; // Featured.com may use pagination
    this.pagesSinceNewContent = 0;
    this.lastContentCount = 0;
    this.lastProcessedPage = 0;
    this.pageDelay = 2000;
    this.currentPage = 1;
    this.maxPages = 10;
    this.isPaused = false;
    
    // Authenticated view selectors based on browser snapshot analysis
    // These selectors target the specific table structure of the authenticated view
    this.tableSelector = 'table, div[role="table"]';
    this.rowSelector = 'tbody tr, div[role="row"]';
    this.rowContentSelector = 'td, div[role="cell"]';
    
    // Column indexes based on the observed structure
    this.checkboxColumnIndex = 0;
    this.questionColumnIndex = 1;
    this.publicationColumnIndex = 2;
    this.deadlineColumnIndex = 3;
    this.domainAuthorityColumnIndex = 4;
    this.attributionColumnIndex = 5;
    this.actionsColumnIndex = 6;
    
    // Pagination selectors
    this.paginationSelector = '.pagination, nav[aria-label="pagination"]';
    // Don't use jQuery :contains() selector as it doesn't work with querySelector
  this.nextPageSelector = 'a[rel="next"], button[aria-label="Go to next page"], button[aria-label*="next"]';
    
    // Debug panel
    this.debugPanelCreated = false;
  }
  
  /**
 * Generate a fingerprint of the current page content to detect whether the page has changed
 * Using multiple signals approach inspired by Instant Data Scraper
 * @returns {string} - A composite hash representing the current page content
 */
generateContentFingerprint() {
  try {
    // Extract data from multiple page elements (like Instant Data Scraper does)
    // This makes our fingerprint much more reliable for detecting content changes
    
    // 1. Collect content from table/list elements
    const tableSelector = this.tableSelector || 'table, [role="table"], .questions-list, .opportunity-list';
    const contentContainer = document.querySelector(tableSelector) || document.body;
    const contentText = contentContainer.innerText.trim();
    
    // 2. Count visible rows/items
    const rowElements = document.querySelectorAll('tr, div[role="row"], .question-item, [data-testid="question-item"]');
    const rowCount = rowElements.length;
    
    // 3. Check pagination indicators
    const paginationText = document.querySelector('.pagination, [aria-label*="pagination"]')?.innerText || '';
    
    // 4. Check URL parameters that might indicate page number
    const urlParams = new URLSearchParams(window.location.search);
    const pageParam = urlParams.get('page') || urlParams.get('p') || '';
    
    // 5. Document height (changes when content loads)
    const documentHeight = document.body.scrollHeight;
    
    // Combine all signals into a composite fingerprint object
    const fingerprint = {
      contentHash: this.simpleHash(contentText.substring(0, 2000)), // Hash of first 2000 chars
      rowCount: rowCount,
      paginationText: paginationText,
      pageParam: pageParam,
      height: documentHeight,
      timestamp: Date.now() // Add timestamp for debugging
    };
    
    // Store this fingerprint in history to detect duplicate pages
    this.storeContentFingerprint(fingerprint);
    
    // Return stringified version for comparison
    return JSON.stringify(fingerprint);
  } catch (error) {
    this.errorLog('[FEATURED] Error generating content fingerprint:', error);
    return Date.now().toString(); // Fallback to timestamp if error occurs
  }
}

/**
 * Simple string hashing function
 * @param {string} text - Text to hash
 * @returns {string} - Hash value as hex string
 */
simpleHash(text) {
  let hash = 0;
  if (text.length === 0) return hash.toString(16);
  
  for (let i = 0; i < Math.min(text.length, 2000); i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  
  return hash.toString(16);
}

/**
 * Store fingerprint history to detect duplicate content across pages
 * Just like Instant Data Scraper's approach to avoid rescanning the same content
 */
storeContentFingerprint(fingerprint) {
  // Initialize fingerprint history if not exists
  if (!this.fingerprintHistory) {
    this.fingerprintHistory = [];
  }
  
  // Add new fingerprint to history, keeping only last 5
  this.fingerprintHistory.push(fingerprint);
  if (this.fingerprintHistory.length > 5) {
    this.fingerprintHistory.shift(); // Remove oldest
  }
}

  /**
   * Wait for content to change after a navigation action
   * Using a sophisticated approach inspired by Instant Data Scraper
   * @param {string} originalFingerprint - The content fingerprint before navigation
   * @returns {Promise<boolean>} - True if content changed, false if timed out
   */
  async waitForContentChange(originalFingerprint) {
    // Progressive waiting strategy with shorter waits at first, longer later
    const waitPhases = [
      { attempts: 5, waitMs: 200 },  // First 5 attempts: check every 200ms
      { attempts: 5, waitMs: 500 },  // Next 5 attempts: check every 500ms
      { attempts: 5, waitMs: 1000 }, // Next 5 attempts: check every 1000ms
      { attempts: 5, waitMs: 2000 }  // Final attempts: check every 2000ms
    ];
    
    let totalAttempts = 0;
    
    // Parse original fingerprint (handle both old and new formats)
    let origFingerprintObj;
    try {
      origFingerprintObj = JSON.parse(originalFingerprint);
    } catch (error) {
      // Handle case where fingerprint is not JSON (old format)
      origFingerprintObj = { contentHash: originalFingerprint };
    }
    
    // Try each waiting phase
    for (const phase of waitPhases) {
      for (let i = 0; i < phase.attempts; i++) {
        totalAttempts++;
        
        // Wait for the specified time
        await new Promise(resolve => setTimeout(resolve, phase.waitMs));
        
        // Update debug panel
        this.updateDebugPanel('status', `<div>Waiting for content to change... (${totalAttempts}/20)</div>`);
        
        // Generate new fingerprint and check if content changed
        const newFingerprint = this.generateContentFingerprint();
        
        // Parse new fingerprint
        let newFingerprintObj;
        try {
          newFingerprintObj = JSON.parse(newFingerprint);
        } catch (error) {
          newFingerprintObj = { contentHash: newFingerprint };
        }
        
        // Check for significant changes
        // 1. Content hash changed
        const contentHashChanged = newFingerprintObj.contentHash !== origFingerprintObj.contentHash;
        
        // 2. Row count changed significantly
        const rowCountChanged = 
          newFingerprintObj.rowCount !== undefined &&
          origFingerprintObj.rowCount !== undefined &&
          Math.abs(newFingerprintObj.rowCount - origFingerprintObj.rowCount) > 2;
        
        // 3. Height changed significantly
        const heightChanged = 
          newFingerprintObj.height !== undefined &&
          origFingerprintObj.height !== undefined &&
          Math.abs(newFingerprintObj.height - origFingerprintObj.height) > 100;
        
        // 4. Pagination text changed
        const paginationChanged = newFingerprintObj.paginationText !== origFingerprintObj.paginationText;
        
        // 5. URL page parameter changed
        const pageParamChanged = newFingerprintObj.pageParam !== origFingerprintObj.pageParam;
        
        // Determine if there was a significant change - multiple signals for reliability
        const significantChange = 
          contentHashChanged || 
          (rowCountChanged && (heightChanged || paginationChanged || pageParamChanged));
        
        if (significantChange) {
          this.debugLog(`Content changed detected after ${totalAttempts} attempts`);
          
          // Check if the new content might be a duplicate of previously seen content
          // This helps detect pagination loops or failed navigation attempts
          if (this.isContentDuplicate && typeof this.isContentDuplicate === 'function') {
            const isDuplicate = this.isContentDuplicate(newFingerprintObj);
            if (isDuplicate) {
              this.updateDebugPanel('errors', '<div>Warning: Possible duplicate content detected</div>', true);
              this.debugLog('Duplicate content detected - possible pagination loop');
            }
          }
          
          return true;
        }
      }
    }
    
    // If we get here, content didn't change within our wait time
    this.updateDebugPanel('errors', '<div>Timed out waiting for content to change</div>', true);
    this.debugLog('Timed out waiting for content to change');
    return false;
  }
  
  /**
   * Check if content is a duplicate of previously seen content
   * This helps detect pagination loops and repeated content
   * @param {Object} fingerprint - Content fingerprint object
   * @returns {boolean} - True if content appears to be duplicate
   */
  isContentDuplicate(fingerprint) {
    if (!this.fingerprintHistory || this.fingerprintHistory.length < 2) {
      return false; // Not enough history to determine duplicates
    }
    
    // Skip the most recent fingerprint (which is likely the current one)
    for (let i = 0; i < this.fingerprintHistory.length - 1; i++) {
      const oldFingerprint = this.fingerprintHistory[i];
      
      // Check for content hash match (strongest signal)
      if (oldFingerprint.contentHash === fingerprint.contentHash) {
        return true;
      }
      
      // Check for very similar characteristics (multiple matching signals)
      let matchingSignals = 0;
      
      if (oldFingerprint.rowCount === fingerprint.rowCount) matchingSignals++;
      if (Math.abs((oldFingerprint.height || 0) - (fingerprint.height || 0)) < 50) matchingSignals++;
      if (oldFingerprint.paginationText === fingerprint.paginationText) matchingSignals++;
      
      // If multiple signals match, it's likely a duplicate
      if (matchingSignals >= 2) {
        return true;
      }
    }
    
    return false;
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
    this.debugLog('Initializing Featured.com optimized scraper');
    
    // Create debug panel if it doesn't exist
    if (!document.getElementById('featured-debug-panel')) {
      this.createDebugPanel();
    }
    
    // Analyze page structure to debug why elements aren't being found
    this.analyzePageStructure();
    
    // Add scraper button to the UI
    this.addScraperButton();
  }
  
  /**
   * Add a scraper button to the Featured.com UI
   * Styled consistently with the SourceBottle and Qwoted scrapers
   */
  addScraperButton() {
    try {
      // Check if button already exists
      if (document.getElementById('featured-scraper-button')) {
        return;
      }
      
      // Create a small floating button that matches the other scrapers' style
      const showButton = document.createElement('button');
      showButton.id = 'featured-show-scraper-button';
      showButton.innerHTML = '<span style="font-size: 18px;">🔍</span>';
      showButton.title = 'Source Bottle Extension';
      showButton.style.cssText = 'position: fixed; bottom: 20px; right: 20px; z-index: 9999; background-color: #007bff; color: white; border: none; width: 40px; height: 40px; border-radius: 50%; font-weight: bold; cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center;';
      document.body.appendChild(showButton);
      
      showButton.addEventListener('click', () => {
        // Show the scraper buttons and hide this button
        const buttonContainer = document.getElementById('featured-scraper-buttons');
        if (buttonContainer) {
          buttonContainer.style.display = 'flex';
          showButton.style.display = 'none';
        }
      });
      
      // Create a container for buttons with a header - styled to match other scrapers
      const buttonContainer = document.createElement('div');
      buttonContainer.id = 'featured-scraper-buttons';
      buttonContainer.style.cssText = 'position: fixed; bottom: 20px; right: 20px; z-index: 10000; display: flex; flex-direction: column; gap: 10px; background-color: white; padding: 15px; border-radius: 8px; box-shadow: 0 4px 15px rgba(0,0,0,0.15); width: 280px;';
      
      // Create header with close button
      const header = document.createElement('div');
      header.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; border-bottom: 1px solid #eaeaea; padding-bottom: 8px;';
      
      const title = document.createElement('span');
      title.textContent = 'Source Bottle Extension';
      title.style.cssText = 'font-weight: 600; font-size: 14px; color: #333;';
      
      const closeButton = document.createElement('button');
      closeButton.innerHTML = '&times;';
      closeButton.style.cssText = 'background: none; border: none; color: #666; cursor: pointer; font-size: 20px; padding: 0 5px;';
      closeButton.title = 'Close panel';
      
      closeButton.addEventListener('click', function() {
        buttonContainer.style.display = 'none';
        // Show the toggle button when closing the main panel
        const showButton = document.getElementById('featured-show-scraper-button');
        if (showButton) {
          showButton.style.display = 'flex';
        }
      });
      
      header.appendChild(title);
      header.appendChild(closeButton);
      buttonContainer.appendChild(header);
      
      // Site info
      const siteInfo = document.createElement('div');
      siteInfo.style.cssText = 'font-size: 13px; color: #666; margin-bottom: 12px;';
      siteInfo.textContent = 'Detected: Featured.com';
      buttonContainer.appendChild(siteInfo);
      
      // Create main scrape button
      const scrapeButton = document.createElement('button');
      scrapeButton.id = 'featured-scraper-button';
      scrapeButton.textContent = 'Scrape Opportunities';
      scrapeButton.style.cssText = 'background-color: #007bff; color: white; border: none; padding: 10px 15px; border-radius: 4px; font-weight: 500; cursor: pointer; width: 100%; margin-bottom: 8px; transition: background-color 0.2s;';
      
      scrapeButton.addEventListener('mouseover', function() {
        this.style.backgroundColor = '#0069d9';
      });
      
      scrapeButton.addEventListener('mouseout', function() {
        this.style.backgroundColor = '#007bff';
      });
      
      scrapeButton.addEventListener('click', () => {
        if (window.featuredScraper) {
          // Update button to show progress
          scrapeButton.textContent = 'Scraping...';
          scrapeButton.disabled = true;
          scrapeButton.style.opacity = '0.7';
          
          window.featuredScraper.run()
            .then(opportunities => {
              // Reset button
              scrapeButton.textContent = `Found ${opportunities?.length || 0} Opportunities`;
              setTimeout(() => {
                scrapeButton.textContent = 'Scrape Opportunities';
                scrapeButton.disabled = false;
                scrapeButton.style.opacity = '1';
              }, 3000);
            })
            .catch(error => {
              scrapeButton.textContent = 'Error Occurred';
              setTimeout(() => {
                scrapeButton.textContent = 'Scrape Opportunities';
                scrapeButton.disabled = false;
                scrapeButton.style.opacity = '1';
              }, 3000);
            });
        }
      });
      
      // Status message area
      const statusArea = document.createElement('div');
      statusArea.id = 'featured-scraper-status';
      statusArea.style.cssText = 'font-size: 12px; color: #666; margin-top: 10px; min-height: 18px;';
      
      // Create button container and add buttons
      const buttonsDiv = document.createElement('div');
      buttonsDiv.style.cssText = 'display: flex; flex-direction: column;';
      buttonsDiv.appendChild(scrapeButton);
      
      // Toggle debug mode option (only for advanced users)
      const debugRow = document.createElement('div');
      debugRow.style.cssText = 'display: flex; align-items: center; margin-top: 12px; font-size: 12px; color: #666;';
      
      const debugCheck = document.createElement('input');
      debugCheck.type = 'checkbox';
      debugCheck.id = 'featured-debug-toggle';
      debugCheck.style.cssText = 'margin-right: 8px;';
      debugCheck.checked = this.debugMode;
      
      const debugLabel = document.createElement('label');
      debugLabel.htmlFor = 'featured-debug-toggle';
      debugLabel.textContent = 'Show debug panel';
      
      debugCheck.addEventListener('change', (e) => {
        this.debugMode = e.target.checked;
        const debugPanel = document.getElementById('featured-debug-panel');
        if (debugPanel) {
          debugPanel.style.display = this.debugMode ? 'block' : 'none';
        }
      });
      
      debugRow.appendChild(debugCheck);
      debugRow.appendChild(debugLabel);
      
      // Add components to main container
      buttonContainer.appendChild(buttonsDiv);
      buttonContainer.appendChild(statusArea);
      buttonContainer.appendChild(debugRow);
      
      // Add container to body
      document.body.appendChild(buttonContainer);
      this.debugLog('Added scraper buttons to the UI');
    } catch (error) {
      this.errorLog('[FEATURED] Failed to add scraper button:', error);
    }
  }
  
  /**
   * Create a debug panel in the DOM for viewing scraper status
   * Hidden by default - can be toggled with the checkbox in the main UI
   */
  createDebugPanel() {
    try {
      const panel = document.createElement('div');
      panel.id = 'featured-debug-panel';
      // Add namespace to prevent style conflicts with page
      panel.style.cssText = 'position: fixed; top: 10px; right: 10px; width: 320px; max-height: 500px; overflow-y: auto; background-color: white; color: #333; font-family: system-ui, -apple-system, sans-serif; z-index: 10000; padding: 12px; border-radius: 8px; font-size: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.15); border: 1px solid #eaeaea;';
      panel.classList.add('featured-scraper-ui');
      
      // Hidden by default unless debug mode is enabled
      panel.style.display = this.debugMode ? 'block' : 'none';
      
      panel.innerHTML = `
        <div style="border-bottom: 1px solid #eee; padding-bottom: 8px; margin-bottom: 8px; font-weight: 600; display: flex; justify-content: space-between; align-items: center;">
          <span>Source Bottle Debug Panel</span>
          <button id="featured-debug-close" style="background: none; border: none; color: #666; cursor: pointer; font-size: 16px;">×</button>
        </div>
        <div style="margin-bottom: 8px; font-size: 11px; color: #666;">Showing debug information for Featured.com scraper</div>
        <div id="featured-debug-status" style="margin-bottom: 6px; padding: 6px; background-color: #f8f9fa; border-radius: 4px;"></div>
        <div id="featured-debug-log" style="margin-bottom: 6px; max-height: 200px; overflow-y: auto;"></div>
        <div id="featured-debug-errors" style="color: #dc3545; margin-top: 8px;"></div>
      `;
      
      // Add close button functionality
      const closeButton = panel.querySelector('#featured-debug-close');
      if (closeButton) {
        closeButton.addEventListener('click', function() {
          panel.style.display = 'none';
          
          // Also uncheck the debug checkbox
          const debugCheck = document.getElementById('featured-debug-toggle');
          if (debugCheck && debugCheck.checked) {
            debugCheck.checked = false;
          }
        });
      }
      
      document.body.appendChild(panel);
      this.updateDebugPanel('status', '<div>Debug panel initialized</div>');
      this.debugLog('Created debug panel - ' + (this.debugMode ? 'visible' : 'hidden'));
    } catch (error) {
      this.errorLog('[FEATURED] Failed to create debug panel:', error);
    }
  }
  
  /**
   * Update the debug panel with status, log, or error information
   * @param {string} type - The type of update: 'status', 'log', or 'error'
   * @param {string} html - The HTML content to add
   */
  updateDebugPanel(type, html) {
    try {
      // Always update the status area in the UI, regardless of debug mode
      if (type === 'status') {
        // Update simple status area in the main UI
        const statusArea = document.getElementById('featured-scraper-status');
        if (statusArea) {
          // Strip HTML for the simple status display
          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = html;
          statusArea.textContent = tempDiv.textContent || tempDiv.innerText || '';
        }
      }
      
      // Skip detailed debug panel updates if debug mode is disabled
      if (!this.debugMode) {
        return;
      }
      
      // Ensure debug panel exists
      let panel = document.getElementById('featured-debug-panel');
      if (!panel) {
        this.createDebugPanel();
        panel = document.getElementById('featured-debug-panel');
      }
      
      const section = panel.querySelector(`#featured-debug-${type}`);
      if (section) {
        // Prepend new information for logs/errors (recent at top)
        if (type === 'log' || type === 'error') {
          const timestamp = new Date().toLocaleTimeString();
          section.innerHTML = `<div><span style="color: #888;">${timestamp}</span>: ${html}</div>` + section.innerHTML;
        } else {
          // For status, replace content
          section.innerHTML = html;
        }
      }
    } catch (error) {
      console.error('[FEATURED] Debug panel update failed:', error);
    }
  }
  
  /**
   * Highlight an element on the page for debugging
   * @param {Element} element - DOM element to highlight
   */
  highlightElement(element) {
    if (!this.debugMode || !element) return;
    
    const originalStyle = element.getAttribute('style') || '';
    element.style.border = '2px solid red';
    element.style.backgroundColor = 'rgba(255, 0, 0, 0.1)';
    
    setTimeout(() => {
      if (originalStyle) {
        element.setAttribute('style', originalStyle);
      } else {
        element.removeAttribute('style');
      }
    }, 2000);
  }
  
  /**
   * Required abstract method implementation from BaseScraper
   * @override
   */
  isQuestionsPage() {
    const url = window.location.href.toLowerCase();
    return (
      url.includes('featured.com/questions') || 
      url.includes('featured.com/experts/questions')
    );
  }
  
  /**
   * Analyze the page structure to help debug why elements aren't being found
   */
  analyzePageStructure() {
    try {
      this.debugLog('Analyzing page structure');
      this.updateDebugPanel('status', '<div>Analyzing page structure...</div>');
      
      // Common parent containers that might contain question cards
      const potentialContainers = [
        'main', '.main-content', '#content', '.container', '.questions-container',
        '.feed', '.questions', '.cards', '.grid', '.listing', 'div[role="table"]', 'table'
      ];
      
      // Log important page details
      const url = window.location.href;
      const title = document.title;
      const h1s = Array.from(document.querySelectorAll('h1')).map(h => h.textContent.trim());
      
      console.log('🔍 [FEATURED STRUCTURE] Page URL:', url);
      console.log('🔍 [FEATURED STRUCTURE] Page title:', title);
      console.log('🔍 [FEATURED STRUCTURE] H1 headings:', h1s);
      
      // Check for our table selectors
      const tableElements = document.querySelectorAll(this.tableSelector);
      console.log('🔍 [FEATURED STRUCTURE] Table elements found:', tableElements.length);
      
      // Check for row selectors
      const rowElements = document.querySelectorAll(this.rowSelector);
      console.log('🔍 [FEATURED STRUCTURE] Row elements found:', rowElements.length);
      
      // Try to identify potential containers
      potentialContainers.forEach(selector => {
        const containers = document.querySelectorAll(selector);
        if (containers.length > 0) {
          console.log(`🔍 [FEATURED STRUCTURE] Found ${containers.length} '${selector}' elements`);
          
          // Look at first container more deeply
          if (containers[0]) {
            const children = containers[0].children.length;
            console.log(`🔍 [FEATURED STRUCTURE] ${selector} has ${children} children`);
            
            // Examine children
            const firstFewChildren = Array.from(containers[0].children).slice(0, 3);
            firstFewChildren.forEach((child, i) => {
              console.log(`🔍 [FEATURED STRUCTURE] Child ${i} tag: ${child.tagName}, classes: ${child.className}`);
            });
          }
        }
      });
      
      // Create a summary of the page's DOM structure
      const allElements = document.querySelectorAll('*');
      const elementCounts = {};
      
      allElements.forEach(el => {
        const tagName = el.tagName.toLowerCase();
        if (!elementCounts[tagName]) elementCounts[tagName] = 0;
        elementCounts[tagName]++;
      });
      
      const structureSummary = Object.entries(elementCounts)
        .filter(([_, count]) => count > 3) // Only elements that appear multiple times
        .sort((a, b) => b[1] - a[1]) // Sort by frequency
        .map(([tag, count]) => `${tag}: ${count}`)
        .join(', ');
      
      console.log('🔍 [FEATURED STRUCTURE] Page structure summary:', structureSummary);
      
      // Update our debug panel with findings
      this.updateDebugPanel('log', `
        <div style="margin-top: 10px; border-top: 1px solid #666; padding-top: 5px; margin-bottom: 5px;">
          <strong>Page Structure Analysis:</strong><br>
          Cards found: ${rowElements.length}<br>
          Page title: ${title}<br>
          DOM summary: ${structureSummary.substring(0, 150)}...
        </div>
      `, true);
      
      // If we found no rows, suggest checking if the page is empty or still loading
      if (rowElements.length === 0) {
        console.log('🔍 [FEATURED STRUCTURE] No question rows found. Page might be empty, still loading, or selector needs updating');
        this.updateDebugPanel('errors', '<div>No question cards found with current selectors. Try updating selectors based on analysis.</div>', true);
      }
    } catch (error) {
      this.errorLog('[FEATURED] Error analyzing page structure:', error);
      this.updateDebugPanel('errors', `<div>Error analyzing page: ${error.message}</div>`, true);
    }
  }
  
  /**
   * Generate a unique ID from text content to deduplicate opportunities
   * Also manages the processedIds cache to prevent unbounded growth
   * @param {string} text - Text to generate ID from
   * @returns {string} - Hexadecimal hash of the text
   */
  generateId(text) {
    let hash = 0;
    if (text.length === 0) return hash.toString(16);
    
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    
    const id = Math.abs(hash).toString(16);
    
    // Memory management - track when this ID was processed
    this.processedIds.set(id, Date.now());
    
    // Cleanup old IDs if we exceed the maximum cache size
    this._cleanupProcessedIds();
    
    return id;
  }
  
  /**
   * Cleans up old processed IDs to prevent memory leaks
   * @private
   */
  _cleanupProcessedIds() {
    // If we haven't exceeded the limit, no need to clean up
    if (this.processedIds.size <= this.maxCachedIds) {
      return;
    }
    
    // Get all entries sorted by timestamp (oldest first)
    const entries = [...this.processedIds.entries()]
      .sort((a, b) => a[1] - b[1]);
    
    // Keep only the newest entries
    const entriesToKeep = entries.slice(entries.length - this.maxCachedIds);
    
    // Create a new map with only the entries to keep
    this.processedIds = new Map(entriesToKeep);
    
    this.debugLog(`Memory management: Cleaned up processed IDs cache (kept ${this.processedIds.size} newest entries)`);
  }
  
  /**
   * Parse the Featured.com questions page for opportunities
   * Optimized for the authenticated view with table structure
   * @returns {Array} - Array of opportunity objects
   * @override
   */
  parse() {
    try {
      // Reset state and log start of parsing
      const startTime = performance.now();
      this.opportunities = [];
      
      // Find the main table containing question rows
      const tableElement = document.querySelector(this.tableSelector);
      if (!tableElement) {
        this.updateDebugPanel('errors', '<div>No table element found on the page</div>', true);
        this.debugLog('No table element found on the page');
        return [];
      }
      
      // Find all question rows
      const rows = tableElement.querySelectorAll(this.rowSelector);
      this.updateDebugPanel('status', `<div>Found ${rows.length} question rows in table</div>`);
      this.debugLog(`Found ${rows.length} question rows in table`);
      
      // Check if we found any rows
      if (rows.length === 0) {
        this.updateDebugPanel('errors', '<div>No question rows found in the table</div>', true);
        this.debugLog('No question rows found in the table');
        return [];
      }
      
      // Process each row (skipping the header row)
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        
        try {
          // Skip empty rows
          if (!row.textContent.trim()) {
            continue;
          }
          
          // Get all cells in the row
          const cells = row.querySelectorAll(this.rowContentSelector);
          
          // Skip rows without enough cells
          if (cells.length < 3) {
            this.debugLog(`Row ${i} has insufficient cells (${cells.length}), skipping`);
            continue;
          }
          
          // Extract cell contents carefully, handling cases where indexes might be different
          // The browser snapshot shows we have cells for: checkbox, question, publication, deadline, domain auth, attribution, actions
          const questionCell = cells[this.questionColumnIndex] || null;
          const publicationCell = cells[this.publicationColumnIndex] || null;
          const deadlineCell = cells[this.deadlineColumnIndex] || null;
          
          // Get text content safely
          const getTextContent = (cell) => cell ? cell.textContent.trim() : '';
          
          // Extract opportunity details
          const questionText = getTextContent(questionCell);
          const publication = getTextContent(publicationCell);
          const deadline = getTextContent(deadlineCell);
          
          // Skip if question text is empty
          if (!questionText) {
            continue;
          }
          
          // Generate ID from the question text
          const opportunityId = this.generateId(questionText);
          
          // Create a clean description
          const description = questionText;
          
          // Get URL if there's a link in the actions cell
          let opportunityUrl = window.location.href;
          const actionCell = cells[cells.length - 1]; // Last cell should be actions
          if (actionCell) {
            const actionLink = actionCell.querySelector('a');
            if (actionLink && actionLink.href) {
              opportunityUrl = actionLink.href;
            }
          }
          
          // Create opportunity object
          const opportunity = {
            id: opportunityId,
            title: questionText.substring(0, 100) + (questionText.length > 100 ? '...' : ''),
            description: description,
            url: opportunityUrl,
            source: 'Featured',
            platform: 'Featured.com',
            postedDate: new Date().toISOString().split('T')[0], // Today's date as we don't have posted date
            deadline: deadline,
            publication: publication,
            tags: publication, // Use publication as a tag
            timestamp: Date.now(),
            status: 'active'
          };
          
          // Add to opportunities list
          this.opportunities.push(opportunity);
          
          // Highlight the row for debugging (only first 5 rows)
          if (this.debugMode && i < 5) {
            this.highlightElement(row);
          }
          
          // Periodic update to debug panel
          if (i % 10 === 0 || i === rows.length - 1) {
            this.updateDebugPanel('log', `<div>Processed ${i}/${rows.length - 1} question rows</div>`, true);
          }
        } catch (rowError) {
          this.errorLog(`[FEATURED] Error processing row ${i}:`, rowError);
          this.updateDebugPanel('errors', `<div>Error processing row ${i}: ${rowError.message}</div>`, true);
        }
      }
      
      // Log completion and performance
      const endTime = performance.now();
      const timeElapsed = (endTime - startTime).toFixed(0);
      this.debugLog(`Parsing complete: Found ${this.opportunities.length} opportunities in ${timeElapsed}ms`);
      this.updateDebugPanel('status', `<div>Parsing complete: Found ${this.opportunities.length} opportunities in ${timeElapsed}ms</div>`);
      
      return this.opportunities;
    } catch (error) {
      this.updateDebugPanel('errors', `<div>Parsing error: ${error.message}</div>`, true);
      this.errorLog('[FEATURED] Parsing error:', error);
      return [];
    }
  }
  
  /**
   * Hydrate the page by scrolling to load dynamic content
   * @param {number} maxScrolls - Maximum number of scrolls to perform
   * @param {number} scrollDelay - Delay between scrolls in ms
   * @returns {Promise<number>} - Number of scrolls performed
   */
  async hydrateAll(maxScrolls = 15, scrollDelay = 1000) {
    this.updateDebugPanel('status', `<div>Hydrating page with up to ${maxScrolls} scrolls...</div>`);
    let lastHeight = 0;
    let scrollCount = 0;
    let unchangedCount = 0;
    const MAX_UNCHANGED = 3; // If height doesn't change after this many scrolls, we're done
    
    try {
      for (let i = 0; i < maxScrolls; i++) {
        // Scroll to bottom
        window.scrollTo(0, document.body.scrollHeight);
        scrollCount++;
        
        // Check if we've reached the end
        const currentHeight = document.body.scrollHeight;
        if (currentHeight === lastHeight) {
          unchangedCount++;
          if (unchangedCount >= MAX_UNCHANGED) {
            this.debugLog(`Page fully loaded after ${scrollCount} scrolls (height unchanged ${unchangedCount} times)`);
            this.updateDebugPanel('log', `<div>Page fully loaded after ${scrollCount} scrolls</div>`, true);
            break;
          }
        } else {
          unchangedCount = 0;
        }
        lastHeight = currentHeight;
        
        // Update debug panel
        this.updateDebugPanel('status', `<div>Hydrating page content (${scrollCount}/${maxScrolls} scrolls)...</div>`);
        
        // Wait between scrolls
        await new Promise((resolve) => setTimeout(resolve, scrollDelay));
      }
      
      // Scroll back to top
      window.scrollTo(0, 0);
      this.debugLog(`Hydration completed with ${scrollCount} scrolls`);
      return scrollCount;
    } catch (error) {
      this.errorLog('[FEATURED] Error during hydration:', error);
      this.updateDebugPanel('errors', `<div>Hydration error: ${error.message}</div>`, true);
      return 0;
    }
  }
  
  /**
   * Navigate to the next page in pagination
   * Using advanced multi-strategy approach inspired by Instant Data Scraper
   * @returns {Promise<boolean>} - True if navigation succeeded, false otherwise
   */
  async navigateToNextPage() {
    try {
      this.updateDebugPanel('status', '<div>Attempting to navigate to next page...</div>');
      
      // Check if we're on Featured.com
      const isOnFeatured = window.location.href.includes('featured.com');
      
      // Special handling for Featured.com pagination
      if (isOnFeatured) {
        // Look for pagination indicator text to determine current/total pages
        const paginationSelectors = [
          'p[class*="text-muted"]',
          '.pagination-info',
          '[aria-label*="pagination"] .info',
          '.table-footer .page-info'
        ];
        
        let paginationInfo = null;
        for (const selector of paginationSelectors) {
          paginationInfo = document.querySelector(selector);
          if (paginationInfo && paginationInfo.textContent.includes('of')) break;
        }
        
        if (paginationInfo && paginationInfo.textContent.includes('of')) {
          this.debugLog(`Found pagination info: ${paginationInfo.textContent.trim()}`);
          
          // Parse out current page and total pages using regex patterns
          const paginationText = paginationInfo.textContent.trim();
          const patterns = [
            /Page (\d+) of (\d+)/,
            /(\d+) of (\d+)/,
            /Page (\d+)\/(\d+)/
          ];
          
          let matches = null;
          for (const pattern of patterns) {
            matches = paginationText.match(pattern);
            if (matches && matches.length === 3) break;
          }
          
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
      
      // Generate a content fingerprint before navigation attempt
      const contentBeforeNav = this.generateContentFingerprint();
      const itemCountBefore = document.querySelectorAll('tr, div[role="row"]').length;
      
      // Try multiple strategies to find the next button
      let nextPageButton = null;
      
      // 1. Try explicit next button selectors first
      const nextButtonSelectors = [
        'a[rel="next"]',
        'button[aria-label="Go to next page"]',
        'button[aria-label*="next"]',
        'button.next-page',
        '.pagination .next',
        '.pagination-next',
        'li.next a',
        'button[data-testid*="next"]'
      ];
      
      for (const selector of nextButtonSelectors) {
        nextPageButton = document.querySelector(selector);
        if (nextPageButton) {
          this.debugLog(`Found next button with selector: ${selector}`);
          break;
        }
      }
      
      // 2. If not found, try looking through pagination container for text/icon indicators
      if (!nextPageButton) {
        const paginationContainer = document.querySelector('.pagination, [role="navigation"], nav, .data-table-pagination');
        if (paginationContainer) {
          // Get all buttons and links in the pagination container
          const buttons = Array.from(paginationContainer.querySelectorAll('button, a'));
          
          // Look for next button markers
          for (const button of buttons) {
            const text = button.textContent.trim().toLowerCase();
            const ariaLabel = button.getAttribute('aria-label')?.toLowerCase() || '';
            
            // Look for right arrow icons
            const hasRightArrow = button.querySelector('svg[data-testid*="right"], i[class*="right"], svg[class*="right"], i.fa-chevron-right, i.fa-arrow-right');
            const hasRightArrowText = text.includes('›') || text.includes('»') || text.includes('>');
            
            if (
              text === 'next' || 
              text.includes('next') || 
              ariaLabel.includes('next') ||
              hasRightArrow ||
              hasRightArrowText
            ) {
              nextPageButton = button;
              this.debugLog('Found next button in pagination container using text/icons');
              break;
            }
          }
        }
      }
      
      // 3. Last resort: use the last button/link in pagination container if it looks like a next button
      if (!nextPageButton) {
        const paginationContainer = document.querySelector('.pagination, [role="navigation"], nav');
        if (paginationContainer) {
          const buttons = Array.from(paginationContainer.querySelectorAll('button, a'));
          if (buttons && buttons.length > 0) {
            // Check if the last button looks like a next button (has right arrow symbols or icons)
            const lastButton = buttons[buttons.length - 1];
            const lastButtonText = lastButton.textContent.trim().toLowerCase();
            const hasRightArrows = lastButtonText.includes('>') || lastButtonText.includes('›') || lastButtonText.includes('»');
            
            if (hasRightArrows || lastButton.querySelector('[class*="right"], [class*="next"]')) {
              nextPageButton = lastButton;
              this.debugLog('Using last button in pagination as next button');
            }
          }
        }
      }
      
      // Check if the next page button exists and is not disabled/hidden
      if (nextPageButton && 
          !nextPageButton.disabled &&
          !nextPageButton.classList.contains('disabled') && 
          nextPageButton.getAttribute('aria-disabled') !== 'true' && 
          nextPageButton.style.display !== 'none') {
        
        // Update debug panel
        this.updateDebugPanel('status', `<div>Navigating to page ${this.currentPage + 1}</div>`);
        this.debugLog(`Clicking next button to navigate to page ${this.currentPage + 1}`);
        
        // Store current page for validation
        const previousPage = this.currentPage;
        
        // Click the next page button
        nextPageButton.click();
        
        // Increment the current page number
        this.currentPage++;
        
        // Wait for content to change after navigation using our sophisticated approach
        // This uses all the signals from our fingerprinting system
        const contentChanged = await this.waitForContentChange(contentBeforeNav);
        
        if (!contentChanged) {
          this.debugLog('Content did not change after navigation - pagination may have failed');
          this.updateDebugPanel('errors', '<div>Warning: Page content did not change after navigation attempt</div>', true);
          
          // Revert the page counter since navigation likely failed
          this.currentPage = previousPage;
          return false;
        }
        
        // For Featured.com tables, verify enough rows loaded (important quality check)
        if (isOnFeatured) {
          const tableRows = document.querySelectorAll('div[role="row"], tr');
          this.debugLog(`Found ${tableRows.length} rows after pagination`);
          
          // If we have too few rows, wait longer for content to fully load
          if (tableRows.length < 5) {
            this.updateDebugPanel('log', '<div>Warning: Few rows found after pagination, waiting longer...</div>', true);
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        }
        
        this.updateDebugPanel('log', '<div>Successfully navigated to next page</div>', true);
        return true;
      } else {
        this.debugLog('No next page button found or button is disabled, stopping pagination');
        this.updateDebugPanel('log', '<div>Reached last page, no more pages available</div>', true);
        return false;
      }
    } catch (error) {
      this.updateDebugPanel('errors', `<div>Navigation error: ${error.message}</div>`, true);
      this.errorLog('[FEATURED] Navigation error:', error);
      return false;
    }
  }
  
  /**
   * Export opportunities as downloadable JSON file
   */
  exportOpportunities() {
    if (!this.opportunities || this.opportunities.length === 0) {
      this.updateDebugPanel('errors', '<div>No opportunities to export!</div>', true);
      return;
    }
    
    try {
      // Create export data with metadata
      const exportData = {
        source: 'featured.com',
        timestamp: new Date().toISOString(),
        pagesScraped: this.currentPage,
        totalOpportunities: this.opportunities.length,
        exportDate: new Date().toLocaleString(),
        opportunities: this.opportunities
      };
      
      // Convert to JSON string
      const jsonString = JSON.stringify(exportData, null, 2);
      
      // Create downloadable blob
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      // Create download link and trigger download
      const link = document.createElement('a');
      link.href = url;
      link.download = `featured-opportunities-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up
      URL.revokeObjectURL(url);
      
      // Update UI
      this.updateDebugPanel('log', `<div>Exported ${this.opportunities.length} opportunities</div>`, true);
      
    } catch (error) {
      this.updateDebugPanel('errors', `<div>Export error: ${error.message}</div>`, true);
      this.errorLog('[FEATURED] Export error:', error);
    }
  }
  
  /**
   * Resets scraper state before a fresh run
   * @private
   */
  _resetState() {
    this.currentPage = 1;
    this.pagesSinceNewContent = 0;
    this.opportunities = [];
    this.processedIds = new Map();
    this.lastPageContent = null;
    this.lastProcessedPage = 0;
  }
  
  /**
   * Run the scraper with pagination support
   * @param {Object} options - Options for pagination
   * @returns {Promise<Array>} - Array of opportunities
   */
  async runWithPagination(options = {}) {
    try {
      // Extract options with defaults
      const maxScrolls = options.maxScrolls || this.maxScrolls;
      const scrollDelay = options.scrollDelay || this.scrollDelay;
      const autoPaginate = options.autoPaginate !== undefined ? options.autoPaginate : this.autoPaginate;
      
      this.debugLog(`Processing page ${this.currentPage} with pagination`);
      this.updateDebugPanel('status', `<div>Processing page ${this.currentPage} with pagination</div>`);
      
      // Hydrate the page content by scrolling
      await this.hydrateAll(maxScrolls, scrollDelay);
      
      // Parse the opportunities on this page
      const opportunities = this.parse();
      
      // Check if we should continue to the next page
      const nextPageButton = document.querySelector(this.nextPageSelector);
      const hasNextPage = nextPageButton && 
                        !nextPageButton.disabled && 
                        !nextPageButton.classList.contains('disabled') &&
                        !nextPageButton.hasAttribute('aria-disabled') &&
                        nextPageButton.style.display !== 'none';
      
      // Determine if we should continue pagination
      const shouldContinue = hasNextPage && 
                           autoPaginate && 
                           !this.isPaused && 
                           this.currentPage < this.maxPages && 
                           this.pagesSinceNewContent < 3;
      
      if (shouldContinue) {
        this.updateDebugPanel('status', `<div>Navigating to next page...</div>`);
        this.debugLog(`Navigating to next page (${this.currentPage + 1})`);
        
        // Navigate to the next page
        const success = await this.navigateToNextPage();
        
        if (success) {
          // Add a slight delay before continuing
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // Continue pagination with the next page
          return this.runWithPagination(options);
        }
      }
      
      // If we're here, pagination is complete
      this.updateDebugPanel('status', `<div>Pagination complete - Found ${this.opportunities.length} opportunities</div>`);
      this.debugLog(`Pagination complete - Found ${this.opportunities.length} opportunities`);
      
      // Send opportunities to backend storage before returning
      this.sendToBackend(this.opportunities);
      
      return this.opportunities;
    } catch (error) {
      this.updateDebugPanel('errors', `<div>Error during pagination: ${error.message}</div>`, true);
      this.errorLog('[FEATURED] Pagination error:', error);
      return this.opportunities;
    }
  }
  
  /**
   * Required abstract method implementation from BaseScraper
   * Run the scraper - main entry point
   * @override
   * @returns {Promise<Array>} - Array of opportunities
   */
  async run() {
    try {
      // Check if we're on the right page
      if (!this.isQuestionsPage()) {
        console.log('🔍 [FEATURED] Not on a Featured.com questions page');
        this.updateDebugPanel('status', '<div>Not on a Featured.com questions page</div>');
        return [];
      }
      
      // Initialize the scraper if not already done
      this.init();
      
      // Reset scraper state
      this._resetState();
      
      // First, try to hydrate the page by scrolling to load all content
      this.updateDebugPanel('status', '<div>Scrolling to load all content...</div>');
      await this.hydrateAll(this.maxScrolls, this.scrollDelay);
      
      // Check if pagination is enabled
      if (this.autoPaginate) {
        // Run with pagination
        return this.runWithPagination();
      } else {
        // Just parse the current page
        this.updateDebugPanel('status', '<div>Parsing page content...</div>');
        const opportunities = this.parse();
        
        // Provide guidance if no opportunities found
        if (!opportunities || opportunities.length === 0) {
          this.updateDebugPanel('log', `<div>
            <strong>No opportunities found.</strong> Try these steps:<br>
            1. Try clicking on a question or opportunity first<br>
            2. Interact with the page to ensure content is loaded<br>
            3. Click the "Analyze Page Structure" button to see what elements exist<br>
            4. Then run the scraper again
          </div>`, true);
        } else {
          // Success notification
          this.updateDebugPanel('status', `<div>Successfully scraped ${opportunities.length} opportunities!</div>`);
          
          // Send opportunities to backend storage
          this.sendToBackend(opportunities);
        }
        
        return opportunities;
      }
    } catch (error) {
      console.error('🔍 [FEATURED] Error running scraper:', error);
      this.updateDebugPanel('errors', `<div>Error running scraper: ${error.message}</div>`, true);
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
window.FeaturedScraperOptimized = FeaturedScraperOptimized;
window.featuredScraper = new FeaturedScraperOptimized();

// Log that the script has loaded
console.log('🔍 [FEATURED] Featured.com optimized scraper loaded and ready');


// Register with the scrapers registry if available - but defer to avoid load order issues
setTimeout(() => {
  try {
    if (window.scrapers) {
      window.scrapers.register('Featured', window.featuredScraper);
      console.log('🔍 [FEATURED] Successfully registered with scrapers registry');
    } else {
      console.warn('🔍 [FEATURED] Scrapers registry not available yet, registration deferred to content launcher');
    }
  } catch (error) {
    console.error('🔍 [FEATURED] Failed to register with scrapers registry:', error);
  }
}, 500);