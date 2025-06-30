/**
 * SourceBottle Content Launcher
 *
 * This content script is injected into SourceBottle pages matching the manifest patterns.
 * It detects when the page is ready and loads the appropriate scraper module.
 *
 * This launcher provides real-time visual feedback through a notification UI
 * when scraping is in progress.
 */

console.log('📢 [SOURCEBOTTLE] Content launcher loaded - ' + new Date().toISOString());
console.log('📢 [SOURCEBOTTLE] URL:', window.location.href);
console.log('📢 [SOURCEBOTTLE] Document state:', document.readyState);

// Chrome API is automatically available in content scripts
/* global chrome */
// ^^ This comment above is for linters to recognize the chrome API

// Define logManager for logging purposes
const logManager = {
  log: function(message, data) {
    console.log(`📢 [SOURCEBOTTLE] ${message}`, data || '');
  },
  error: function(message, data) {
    console.error(`📢 [SOURCEBOTTLE ERROR] ${message}`, data || '');
  },
  debug: function(message, data) {
    console.debug(`📢 [SOURCEBOTTLE DEBUG] ${message}`, data || '');
  }
};

// Create and inject a custom progress toggle directly instead of relying on imports
function createProgressToggle() {
  // Check if it already exists
  if (document.getElementById('sb-progress-toggle')) {
    const existingToggle = document.getElementById('sb-progress-toggle');
    
    // Return the existing toggle with all methods
    return {
      element: existingToggle,
      show: function() {
        existingToggle.style.display = 'block';
      },
      hide: function() {
        existingToggle.style.opacity = '0';
        setTimeout(() => existingToggle.style.display = 'none', 300);
      },
      update: function(message, progress, count) {
        const statusEl = document.getElementById('sb-status');
        const progressBar = document.getElementById('sb-progress-bar');
        const counterEl = document.getElementById('sb-counter');
        
        if (statusEl && message) statusEl.textContent = message;
        if (progressBar && progress !== undefined) progressBar.style.width = `${progress}%`;
        if (counterEl && count !== undefined) counterEl.textContent = count;
      },
      updateProgress: function(percent) {
        const progressBar = document.getElementById('sb-progress-bar');
        if (progressBar) {
          progressBar.style.width = `${percent}%`;
        }
      },
      addNavButton: function(text, callback) {
        let navButton = document.getElementById('sb-nav-button');
        
        if (!navButton) {
          navButton = document.createElement('button');
          navButton.id = 'sb-nav-button';
          navButton.style.cssText = `
            background-color: white;
            color: #4361ee;
            border: none;
            padding: 8px 12px;
            border-radius: 4px;
            margin-top: 10px;
            cursor: pointer;
            font-weight: bold;
            width: 100%;
          `;
          existingToggle.appendChild(navButton);
        }
        
        navButton.textContent = text;
        navButton.onclick = callback;
        navButton.style.display = 'block';
      }
    };
  }

  // Create the progress container
  const progressToggle = document.createElement('div');
  progressToggle.id = 'sb-progress-toggle';
  progressToggle.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    background-color: #4361ee;
    color: white;
    padding: 15px;
    border-radius: 8px;
    font-family: Arial, sans-serif;
    z-index: 99999;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    width: 300px;
    transition: transform 0.3s ease, opacity 0.3s ease;
    display: none;
  `;

  // Create header
  const header = document.createElement('div');
  header.style.cssText = `
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 10px;
  `;
  
  // Create title
  const title = document.createElement('div');
  title.textContent = 'SourceBottle Scraper';
  title.style.cssText = `
    font-weight: bold;
    font-size: 14px;
  `;
  
  // Create close button
  const closeButton = document.createElement('button');
  closeButton.innerHTML = '&times;';
  closeButton.style.cssText = `
    background: none;
    border: none;
    color: white;
    font-size: 18px;
    cursor: pointer;
    padding: 0;
    line-height: 1;
  `;
  
  // Add title and close button to header
  header.appendChild(title);
  header.appendChild(closeButton);
  
  // Create message element
  const message = document.createElement('div');
  message.className = 'sb-message';
  message.textContent = 'Initializing...';
  message.style.cssText = `
    margin-bottom: 10px;
    font-size: 13px;
  `;
  
  // Create count element
  const count = document.createElement('div');
  count.className = 'sb-count';
  count.textContent = '0 items';
  count.style.cssText = `
    font-size: 12px;
    margin-bottom: 8px;
    color: rgba(255,255,255,0.8);
  `;
  
  // Create progress bar container
  const progressBarContainer = document.createElement('div');
  progressBarContainer.className = 'sb-progress-bar';
  progressBarContainer.style.cssText = `
    background-color: rgba(255,255,255,0.2);
    height: 6px;
    border-radius: 3px;
    overflow: hidden;
    margin-bottom: 5px;
  `;
  
  // Create progress bar inner
  const progressBarInner = document.createElement('div');
  progressBarInner.className = 'sb-progress-bar-inner';
  progressBarInner.style.cssText = `
    background-color: white;
    height: 100%;
    width: 0%;
    transition: width 0.3s ease;
  `;
  
  // Add progress bar inner to container
  progressBarContainer.appendChild(progressBarInner);
  
  // Add all elements to progress toggle
  progressToggle.appendChild(header);
  progressToggle.appendChild(message);
  progressToggle.appendChild(count);
  progressToggle.appendChild(progressBarContainer);
  
  // Add to document
  document.body.appendChild(progressToggle);
  
  // Handle close button click
  closeButton.addEventListener('click', () => {
    progressToggle.style.display = 'none';
  });
  
  // Return the toggle with methods
  return {
    element: progressToggle,
    show: function() {
      progressToggle.style.display = 'block';
    },
    hide: function() {
      progressToggle.style.display = 'none';
    },
    update: function(message, progress, count) {
      const messageEl = progressToggle.querySelector('.sb-message');
      if (messageEl && typeof message === 'string') {
        messageEl.textContent = message;
      } else if (messageEl && typeof message === 'object') {
        // Handle object-style updates
        if (message.message) messageEl.textContent = message.message;
        if (message.status === 'error') progressToggle.style.backgroundColor = '#e63946';
        if (message.status === 'success') progressToggle.style.backgroundColor = '#2a9d8f';
      }
      
      if (progress !== undefined) {
        this.updateProgress(progress);
      }
      
      if (count !== undefined) {
        const countEl = progressToggle.querySelector('.sb-count');
        if (countEl) countEl.textContent = `${count} items`;
      }
    },
    updateProgress: function(percent) {
      const progressBar = progressToggle.querySelector('.sb-progress-bar-inner');
      if (progressBar) {
        progressBar.style.width = `${percent}%`;
      }
    },
    addNavButton: function(text, callback) {
      // Check if button already exists
      let navButton = progressToggle.querySelector('.sb-nav-button');
      if (!navButton) {
        navButton = document.createElement('button');
        navButton.className = 'sb-nav-button';
        navButton.style.cssText = `
          background-color: white;
          color: #4361ee;
          border: none;
          padding: 8px 12px;
          border-radius: 4px;
          margin-top: 10px;
          cursor: pointer;
          font-weight: bold;
          width: 100%;
        `;
        progressToggle.appendChild(navButton);
      }
      
      navButton.textContent = text;
      navButton.onclick = callback;
      navButton.style.display = 'block';
    }
  };
}

// Create a minimal notification element for immediate feedback
const title = document.createElement('div');
title.innerHTML = '<strong>📢 SourceBottle Scraper</strong>';
  
const closeBtn = document.createElement('button');
closeBtn.textContent = '✕';
closeBtn.style.cssText = `
    background: none;
    border: none;
    color: white;
    cursor: pointer;
    font-size: 16px;
  `;

// Create a minimal notification element for immediate feedback
const quickNotification = document.createElement('div');
quickNotification.style.cssText = `
  position: fixed;
  bottom: 20px;
  right: 20px;
  background-color: #4361ee;
  color: white;
  padding: 10px 15px;
  border-radius: 4px;
  font-family: Arial, sans-serif;
  z-index: 99999;
  box-shadow: 0 2px 5px rgba(0,0,0,0.2);
  font-size: 14px;
  transition: opacity 0.3s ease;
`;
quickNotification.textContent = '📢 SourceBottle scraper initializing...';

// Add a close button to the quick notification
const quickCloseBtn = document.createElement('button');
quickCloseBtn.textContent = '✕';
quickCloseBtn.style.cssText = `
  background: none;
  border: none;
  color: white;
  cursor: pointer;
  font-size: 14px;
  margin-left: 10px;
  vertical-align: middle;
`;
quickCloseBtn.onclick = () => {
  quickNotification.style.opacity = '0';
  setTimeout(() => {
    if (document.body.contains(quickNotification)) {
      document.body.removeChild(quickNotification);
    }
  }, 300);
};
quickNotification.appendChild(quickCloseBtn);

// Only append when document.body is available
if (document.body) {
  document.body.appendChild(quickNotification);
  // No auto-hide anymore - let user dismiss manually
} else {
  // If document.body is not available, wait for it
  document.addEventListener('DOMContentLoaded', () => {
    document.body.appendChild(quickNotification);
    // No auto-hide anymore - let user dismiss manually
  });
}

// Execute main functionality when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
  console.log('📢 [SOURCEBOTTLE] DOM content loaded');
  initializeScraper();
});

// Also try to initialize if we're loaded after DOM is already ready
if (document.readyState === 'interactive' || document.readyState === 'complete') {
  console.log('📢 [SOURCEBOTTLE] DOM already loaded');
  initializeScraper();
}

/**
 * Initialize the scraper with direct implementation (CSP-compliant)
 */
async function initializeScraper() {
  try {
    console.log('Initializing SourceBottle scraper...');
    
    // Create our own progress toggle for visual feedback
    const progressToggle = createProgressToggle();
    if (progressToggle) {
      progressToggle.show();
      progressToggle.update('Initializing SourceBottle scraper...', 10);
    }
    
    // Use the global logManager for logging
    
    // Check if we're on a SourceBottle opportunities page
    if (location.hostname.includes('sourcebottle.com') && 
        (location.pathname.includes('industry-list-results') || 
         location.pathname.includes('query.asp') || 
         location.pathname.includes('industry-list.asp'))) {
      logManager.log('On SourceBottle opportunities page, initializing scraper');
      
      // Initialize with a slight delay to ensure page is fully loaded
      const delay = 1000 + Math.random() * 1000;
      console.log(`📢 [SOURCEBOTTLE] Initializing scraper with ${delay}ms delay`);
      
      // Update notification with progress
      if (progressToggle) {
        progressToggle.update('Analyzing page content...', 25);
      }
      
      setTimeout(() => {
        try {
          console.log('📢 [SOURCEBOTTLE] Delay complete, extracting opportunities');
          
          // Update notification
          if (progressToggle) {
            progressToggle.update('Extracting opportunities...', 50);
          }
          
          // Extract opportunities directly using inline implementation
          const opportunities = extractOpportunitiesFromPage(progressToggle);
          logManager.log(`Extracted ${opportunities.length} opportunities from current page`);
          console.log(`📢 [SOURCEBOTTLE] Extracted ${opportunities.length} opportunities`);
          
          // Update notification
          if (progressToggle) {
            progressToggle.update(`Found ${opportunities.length} opportunities, saving...`, 75, opportunities.length);
          }
          
          // Save the extracted opportunities to storage
          if (opportunities.length > 0) {
            saveOpportunities(opportunities, progressToggle);
          } else {
            // No opportunities found
            if (progressToggle) {
              progressToggle.update('No opportunities found on this page', 100, 0);
              // No auto-hide timeout - let user dismiss manually
            }
          }
        } catch (error) {
          logManager.error('Error extracting opportunities:', error);
          console.error('📢 [SOURCEBOTTLE] Error extracting opportunities:', error);
          
          // Update notification with error
          if (progressToggle) {
            progressToggle.update(`❌ Error: ${error.message || 'Failed to extract opportunities'}`, 100);
            // No auto-hide - let user see the error and dismiss manually
          }
        }
      }, delay);
    } else {
      logManager.log('Not on a SourceBottle opportunities page, skipping scraper initialization');
      if (progressToggle) {
        progressToggle.update('Not on a SourceBottle opportunities page', 100, 0);
        setTimeout(() => progressToggle.hide(), 3000);
      }
    }
  } catch (error) {
    console.error('Error initializing SourceBottle scraper:', error);
  }
}

/**
 * Extract opportunities directly from the current page (CSP-compliant implementation)
 * @param {Object} progressToggle - Progress toggle UI object
 * @returns {Array} Array of opportunity objects
 */
function extractOpportunitiesFromPage(progressToggle) {
  try {
    console.log('📢 [SOURCEBOTTLE] Extracting opportunities from current page');
    
    // Update notification if available
    if (progressToggle) {
      progressToggle.update('Analyzing SourceBottle page...', 25);
    }
    
    // Get the current page URL for context
    const currentUrl = window.location.href;
    
    // Keep track of opportunities found on this page
    const pageOpportunities = [];
    
    // MAIN APPROACH: Look for all "result" divs with class "result" - these contain opportunities
    const resultDivs = document.querySelectorAll('div.result');
    console.log(`📢 [SOURCEBOTTLE] Found ${resultDivs.length} result divs on page`);
    
    // Update notification with preliminary count
    if (progressToggle) {
      progressToggle.update(`Found ${resultDivs.length} opportunities, processing...`, 50);
    }
    
    if (resultDivs.length > 0) {
      // Process each result div
      resultDivs.forEach((resultDiv, index) => {
        try {
          // Update notification with progress
          if (progressToggle && index % 5 === 0) {
            progressToggle.update(`Processing opportunity ${index+1} of ${resultDivs.length}...`);
            const progressPercent = 50 + Math.floor((index / resultDivs.length) * 40);
            progressToggle.updateProgress(progressPercent);
          }
          
          const opportunity = extractOpportunityFromDiv(resultDiv, index, currentUrl);
          if (opportunity) {
            pageOpportunities.push(opportunity);
            console.log(`📢 [SOURCEBOTTLE] Extracted opportunity: ${opportunity.title}`);
          }
        } catch (error) {
          console.error(`📢 [SOURCEBOTTLE] Error processing result div ${index}:`, error);
        }
      });
    }
    
    // If we didn't find any opportunities, log an error
    if (pageOpportunities.length === 0) {
      console.error('📢 [SOURCEBOTTLE] No opportunities found on page. Page structure may have changed.');
      
      // Log the HTML structure for debugging
      const htmlSample = document.body.innerHTML.substring(0, 1000);
      console.log('📢 [SOURCEBOTTLE] HTML sample from page:', htmlSample);
      
      // Update notification with error
      if (progressToggle) {
        progressToggle.update({
          status: 'error',
          message: 'No opportunities found on this page. Page structure may have changed.'
        });
      }
    }
    
    // Apply intelligent categorization to all opportunities
    pageOpportunities.forEach(opportunity => {
      opportunity.category = intelligentCategorize(opportunity.title, opportunity.description, currentUrl);
    });
    
    console.log(`📢 [SOURCEBOTTLE] Extracted ${pageOpportunities.length} opportunities from page`);
    
    // Calculate total pages for navigation context
    const totalPages = detectPagination();
    const currentPage = getCurrentPageNumber();
    
    // Update notification with final results
    if (progressToggle) {
      progressToggle.update(`Found ${pageOpportunities.length} opportunities on page ${currentPage}`, 90);
      
      // If there are multiple pages, show navigation button
      if (totalPages > currentPage) {
        const nextPageUrl = getNextPageUrl(currentUrl, currentPage);
        if (nextPageUrl) {
          progressToggle.addNavButton(`Go to Page ${currentPage + 1}`, () => {
            window.location.href = nextPageUrl;
          });
        }
      }
    }
    
    return pageOpportunities;
    
  } catch (error) {
    console.error('📢 [SOURCEBOTTLE] Error extracting opportunities from page:', error);
    if (progressToggle) {
      progressToggle.update(`Error: ${error.message || 'Failed to extract opportunities'}`, 100);
    }
    return [];
  }
}

/**
 * Extract opportunity from a result div
 * @param {Element} resultDiv - The div containing the opportunity
 * @param {number} index - Index for generating unique IDs
 * @param {string} currentUrl - Current page URL for context
 * @returns {Object|null} Opportunity object or null if invalid
 */
function extractOpportunityFromDiv(resultDiv, index, currentUrl) {
  try {
    // Extract title and link
    const titleElement = resultDiv.querySelector('h4 a');
    if (!titleElement) return null;
    
    const title = titleElement.textContent.trim();
    const url = titleElement.href;
    
    // Extract description
    const descriptionElement = resultDiv.querySelector('.result-description');
    const description = descriptionElement ? descriptionElement.textContent.trim() : '';
    
    // Extract deadline
    const deadlineElement = resultDiv.querySelector('.result-deadline');
    let deadline = '';
    if (deadlineElement) {
      const deadlineText = deadlineElement.textContent.trim();
      const deadlineMatch = deadlineText.match(/Deadline:\s*(.+)/);
      deadline = deadlineMatch ? deadlineMatch[1].trim() : '';
    }
    
    // Extract category from URL or div class
    let category = getCategoryFromUrl(url);
    if (!category) {
      // Try to extract from class names
      const categoryClasses = Array.from(resultDiv.classList)
        .filter(cls => cls.startsWith('cat-'));
      
      if (categoryClasses.length > 0) {
        const catId = categoryClasses[0].replace('cat-', '');
        category = getCategoryById(catId) || 'General';
      } else {
        category = 'General';
      }
    }
    
    // Create opportunity object
    const opportunity = {
      id: `sb-${Date.now()}-${index}`,
      title: title,
      description: description,
      url: url,
      deadline: deadline,
      category: category,
      source: 'sourcebottle',
      dateAdded: new Date().toISOString(),
      externalId: url.split('/').pop() || `sb-${Math.random().toString(36).substr(2, 9)}`
    };
    
    return opportunity;
  } catch (error) {
    console.error('📢 [SOURCEBOTTLE] Error extracting opportunity from div:', error);
    return null;
  }
}

/**
 * Get category from URL
 * @param {string} url - URL to extract category from
 * @returns {string|null} Category or null
 */
function getCategoryFromUrl(url) {
  try {
    // Extract category ID from URL
    const categoryMatch = url.match(/[?&]catid=(\d+)/);
    if (categoryMatch && categoryMatch[1]) {
      return getCategoryById(categoryMatch[1]);
    }
    return null;
  } catch (error) {
    console.error('📢 [SOURCEBOTTLE] Error getting category from URL:', error);
    return null;
  }
}

/**
 * Get category name by ID
 * @param {string} id - Category ID
 * @returns {string} Category name or 'General' if not found
 */
function getCategoryById(id) {
  const categoryMap = {
    '61': 'Business & Finance',
    '62': 'Environment',
    '63': 'General',
    '64': 'Health & Wellbeing',
    '65': 'Lifestyle, Food & Fashion',
    '66': 'Parenting & Education',
    '69': 'PR, Media & Marketing',
    '67': 'Professional Services',
    '68': 'Property',
    '70': 'Technology',
    '71': 'Travel & Leisure',
    '54': 'Samples & Prizes'
  };
  
  return categoryMap[id] || 'General';
}

/**
 * Intelligent categorization based on content analysis
 * @param {string} title - Opportunity title
 * @param {string} description - Opportunity description
 * @param {string} url - URL of the opportunity
 * @returns {string} Category
 */
function intelligentCategorize(title, description, url) {
  // First try to get category from URL
  const urlCategory = getCategoryFromUrl(url);
  if (urlCategory) return urlCategory;
  
  // Combine title and description for keyword matching
  const content = `${title} ${description}`.toLowerCase();
  
  // Define keyword-to-category mapping
  const keywordMap = {
    'tech': 'Technology',
    'technology': 'Technology',
    'software': 'Technology',
    'developer': 'Technology',
    'programming': 'Technology',
    'ai': 'Technology',
    'digital': 'Technology',
    'business': 'Business & Finance',
    'finance': 'Business & Finance',
    'money': 'Business & Finance',
    'marketing': 'PR, Media & Marketing',
    'pr': 'PR, Media & Marketing',
    'media': 'PR, Media & Marketing',
    'health': 'Health & Wellbeing',
    'wellness': 'Health & Wellbeing',
    'lifestyle': 'Lifestyle, Food & Fashion',
    'food': 'Lifestyle, Food & Fashion',
    'fashion': 'Lifestyle, Food & Fashion',
    'education': 'Parenting & Education',
    'parent': 'Parenting & Education',
    'environment': 'Environment',
    'property': 'Property',
    'travel': 'Travel & Leisure',
    'sample': 'Samples & Prizes',
    'prize': 'Samples & Prizes'
  };
  
  // Check for keyword matches
  for (const [keyword, category] of Object.entries(keywordMap)) {
    if (content.includes(keyword)) {
      return category;
    }
  }
  
  // Default to General if no matches
  return 'General';
}

/**
 * Detect pagination info on the current page
 * @returns {number} Total number of pages
 */
function detectPagination() {
  try {
    // Find pagination info in the page
    const paginationText = document.querySelector('#resultsDetails #noOfResultsText');
    if (paginationText) {
      const text = paginationText.textContent;
      const match = text.match(/There are \([\d-]+\) (\d+) results/);
      if (match && match[1]) {
        const totalResults = parseInt(match[1], 10);
        // Calculate total pages (assuming 12 results per page)
        const totalPages = Math.ceil(totalResults / 12);
        console.log(`📢 [SOURCEBOTTLE] Detected pagination: ${totalResults} total results, ${totalPages} pages`);
        return totalPages;
      }
    }
    
    // Alternative approach: look for page links in pagination section
    const paginationLinks = document.querySelectorAll('.pagination ul li a');
    if (paginationLinks.length > 0) {
      // Find the highest page number
      let maxPage = 1;
      paginationLinks.forEach(link => {
        const pageMatch = link.href.match(/p=(\d+)/);
        if (pageMatch) {
          const pageNum = parseInt(pageMatch[1], 10);
          if (pageNum > maxPage) {
            maxPage = pageNum;
          }
        }
      });
      
      if (maxPage > 1) {
        console.log(`📢 [SOURCEBOTTLE] Detected pagination from links: ${maxPage} pages`);
        return maxPage;
      }
    }
    
    // If we get here, assume there's only one page
    return 1;
  } catch (error) {
    console.error('📢 [SOURCEBOTTLE] Error detecting pagination:', error);
    return 1; // Default to 1 page
  }
}

/**
 * Get the current page number from the URL
 * @returns {number} Current page number (defaults to 1)
 */
function getCurrentPageNumber() {
  const pageMatch = window.location.href.match(/[?&]p=(\d+)/);
  if (pageMatch) {
    return parseInt(pageMatch[1], 10);
  }
  return 1;
}

/**
 * Generate the URL for the next page
 * @param {string} currentUrl - Current page URL
 * @param {number} currentPage - Current page number
 * @returns {string} URL for the next page
 */
function getNextPageUrl(currentUrl, currentPage) {
  try {
    const nextPage = currentPage + 1;
    
    // Check if URL already has a page parameter
    if (currentUrl.includes('p=')) {
      return currentUrl.replace(/([?&])p=\d+/, `$1p=${nextPage}`);
    }
    
    // Add page parameter
    const separator = currentUrl.includes('?') ? '&' : '?';
    return `${currentUrl}${separator}p=${nextPage}`;
  } catch (error) {
    console.error('📢 [SOURCEBOTTLE] Error generating next page URL:', error);
    return null;
  }
}

/**
 * Save opportunities to storage
 * @param {Array} opportunities - Array of opportunities to save
 * @param {Object} progressToggle - Progress toggle UI object
 */
async function saveOpportunities(opportunities, progressToggle) {
  try {
    // Load existing opportunities
    /* global chrome */
    chrome.storage.local.get(['sourceBottleOpportunities', 'opportunities'], function(result) {
      // Get existing opportunities
      const existingSourceBottle = result.sourceBottleOpportunities || [];
      const allOpportunities = result.opportunities || [];
      
      // Map the new opportunities to add source field
      const sourceTaggedOpportunities = opportunities.map(opp => ({
        ...opp,
        source: 'SourceBottle',
        id: opp.externalId || `sb-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
      }));
      
      // Create a map of existing opportunities by ID for quick lookup
      const existingIds = new Set();
      existingSourceBottle.forEach(opp => {
        if (opp.externalId) existingIds.add(opp.externalId);
        if (opp.id) existingIds.add(opp.id);
      });
      
      // Filter out duplicates with more detailed logging
      const newOpportunities = [];
      
      // Log some existing IDs for debugging
      console.log(`📢 [SOURCEBOTTLE] Found ${existingIds.size} existing IDs in storage`);
      
      // Create an array with timestamp to force uniqueness
      sourceTaggedOpportunities.forEach(opp => {
        // Ensure each opportunity has a unique timestamp-based ID
        const uniqueId = `sb-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        
        // Create a fresh opportunity object with the unique ID
        const freshOpp = {
          ...opp,
          id: uniqueId,
          source: 'SourceBottle',
          timestamp: new Date().toISOString()
        };
        
        // Add to new opportunities
        newOpportunities.push(freshOpp);
        console.log(`📢 [SOURCEBOTTLE] Adding unique opportunity: ${opp.title}`);
      });
      
      console.log(`📢 [SOURCEBOTTLE] Created ${newOpportunities.length} unique opportunities`);
      
      // Combine existing and new opportunities (add new ones to the beginning)
      // Also limit total number of stored opportunities to prevent storage bloat
      const MAX_STORED_OPPORTUNITIES = 100;
      const updatedSourceBottle = [...newOpportunities, ...existingSourceBottle].slice(0, MAX_STORED_OPPORTUNITIES);
      
      // Save to storage
      chrome.storage.local.set({
        'sourceBottleOpportunities': updatedSourceBottle
      }, function() {
        console.log(`📢 [SOURCEBOTTLE] Saved ${newOpportunities.length} new opportunities to storage`);
        
        // Update notification with success but don't auto-hide
        if (progressToggle) {
          progressToggle.update(`✅ Saved ${newOpportunities.length} new opportunities`, 100, newOpportunities.length);
          // No auto-hide timeout - let user dismiss manually
        }
      });
      
      // Also merge with main opportunities collection (global opportunities)
      // Use the same newOpportunities we created above with unique IDs
      
      // Add newOpportunities to the beginning of all opportunities
      const updatedAll = [...newOpportunities, ...allOpportunities];
      
      // Limit total to prevent storage bloat
      const MAX_GLOBAL_OPPORTUNITIES = 200;
      const trimmedAll = updatedAll.slice(0, MAX_GLOBAL_OPPORTUNITIES);
        
      // Save SourceBottle opportunities separately for easier filtering
      /* global chrome */
      chrome.storage.local.set({
        'opportunities': trimmedAll
      }, function() {
        console.log(`📢 [SOURCEBOTTLE] Added ${newOpportunities.length} new opportunities to global collection`);
      });
    });
  } catch (error) {
    console.error('📢 [SOURCEBOTTLE] Error saving opportunities to storage:', error);
    
    // Update notification with error but don't hide
    if (progressToggle) {
      progressToggle.update(`❌ Error: ${error.message || 'Failed to save opportunities'}`, 100);
      // No auto-hide - let user see the error and dismiss manually
    }
  }
}