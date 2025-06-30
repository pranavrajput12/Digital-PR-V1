/**
 * OpportunityScraper - Handles scraping of SourceBottle opportunities
 * Features intelligent scraping algorithms and categorization
 *
 * Updated with notification system for real-time feedback
 */
import { storageManager } from './storage.js';
import { logManager } from './logger.js';

// Import the notification system if available
let scraperNotification = null;
try {
  import('./scrapers/scraper-notification.js').then(module => {
    scraperNotification = module.scraperNotification;
    console.log('📢 [SOURCEBOTTLE] Notification module imported in scraper');
  }).catch(err => {
    console.error('📢 [SOURCEBOTTLE] Error importing notification module:', err);
  });
} catch (e) {
  console.error('📢 [SOURCEBOTTLE] Cannot import notification module:', e);
}

// ========== DEBUG LOGGING ========== //
function debugLog(msg, ...args) {
  try {
    console.log('📢 [SOURCEBOTTLE]', msg, ...args);
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ extensionDebugLast: `[${new Date().toISOString()}] ${msg}` });
    }
  } catch (e) {}
}

debugLog('Scraper module loaded');

class OpportunityScraper {
  /**
   * Initialize the scraper
   */
  constructor() {
    this.categoryMap = {
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
      '71': 'Travel & Leisure'
    };
    
    // Intelligence mapping for keywords to categories
    this.keywordCategoryMap = {
      // Technology keywords
      'tech': 'Technology',
      'technology': 'Technology',
      'software': 'Technology',
      'developer': 'Technology',
      'programming': 'Technology',
      'ai': 'Technology',
      'artificial intelligence': 'Technology',
      'machine learning': 'Technology',
      'cyber': 'Technology',
      'crypto': 'Technology',
      'blockchain': 'Technology',
      'digital': 'Technology',
      
      // Business keywords
      'business': 'Business & Finance',
      'entrepreneur': 'Business & Finance',
      'startup': 'Business & Finance',
      'company': 'Business & Finance',
      'investment': 'Business & Finance',
      'finance': 'Business & Finance',
      'money': 'Business & Finance',
      'banking': 'Business & Finance',
      'investing': 'Business & Finance',
      'fintech': 'Business & Finance',
      
      // PR & Marketing keywords
      'marketing': 'PR, Media & Marketing',
      'branding': 'PR, Media & Marketing',
      'advertising': 'PR, Media & Marketing',
      'social media': 'PR, Media & Marketing',
      'seo': 'PR, Media & Marketing',
      'content': 'PR, Media & Marketing',
      'pr': 'PR, Media & Marketing',
      'journalist': 'PR, Media & Marketing',
      'media': 'PR, Media & Marketing',
      
      // Health keywords
      'health': 'Health & Wellbeing',
      'wellness': 'Health & Wellbeing',
      'medical': 'Health & Wellbeing',
      'fitness': 'Health & Wellbeing',
      'healthcare': 'Health & Wellbeing',
      'mindfulness': 'Health & Wellbeing',
      'mental health': 'Health & Wellbeing',
      
      // Lifestyle keywords
      'lifestyle': 'Lifestyle, Food & Fashion',
      'food': 'Lifestyle, Food & Fashion',
      'fashion': 'Lifestyle, Food & Fashion',
      'recipe': 'Lifestyle, Food & Fashion',
      'cooking': 'Lifestyle, Food & Fashion',
      'beauty': 'Lifestyle, Food & Fashion',
      
      // Education keywords
      'education': 'Parenting & Education',
      'teaching': 'Parenting & Education',
      'learning': 'Parenting & Education',
      'school': 'Parenting & Education',
      'college': 'Parenting & Education',
      'university': 'Parenting & Education',
      'parent': 'Parenting & Education',
      'child': 'Parenting & Education',
      'family': 'Parenting & Education',
      
      // Environment keywords
      'sustainability': 'Environment',
      'climate': 'Environment',
      'environment': 'Environment',
      'green': 'Environment',
      'eco': 'Environment',
      'renewable': 'Environment',
      'sustainable': 'Environment',
      'conservation': 'Environment'
    };
  }

  /**
   * Extract opportunities from current page
   * @returns {Array} Array of opportunity objects
   */
  extractOpportunitiesFromPage() {
    try {
      logManager.log('Extracting opportunities from current page');
      console.log('📢 [SOURCEBOTTLE] Extracting opportunities from current page');
      
      // Update notification if available
      if (scraperNotification) {
        scraperNotification.update({
          status: 'running',
          message: 'Analyzing SourceBottle page...',
          currentPage: this.getCurrentPageNumber()
        });
        scraperNotification.updateProgress(25);
      }
      
      // Get the current page URL for context
      const currentUrl = window.location.href;
      
      // Keep track of opportunities found on this page
      const pageOpportunities = [];
      
      // MAIN APPROACH: Look for all "result" divs with class "result" - these contain opportunities
      // This is the correct selector based on the actual HTML structure
      const resultDivs = document.querySelectorAll('div.result');
      logManager.log(`Found ${resultDivs.length} result divs on page`);
      console.log(`📢 [SOURCEBOTTLE] Found ${resultDivs.length} result divs on page`);
      
      // Update notification with preliminary count
      if (scraperNotification) {
        scraperNotification.update({
          status: 'running',
          message: `Found ${resultDivs.length} opportunities, processing...`,
          totalFound: resultDivs.length
        });
        scraperNotification.updateProgress(50);
      }
      
      if (resultDivs.length > 0) {
        // Process each result div
        resultDivs.forEach((resultDiv, index) => {
          try {
            // Update notification with progress
            if (scraperNotification && index % 5 === 0) {
              scraperNotification.update({
                message: `Processing opportunity ${index+1} of ${resultDivs.length}...`,
                totalFound: pageOpportunities.length
              });
              const progressPercent = 50 + Math.floor((index / resultDivs.length) * 40);
              scraperNotification.updateProgress(progressPercent);
            }
            
            const opportunity = this.extractOpportunityFromDiv(resultDiv, index, currentUrl);
            if (opportunity) {
              pageOpportunities.push(opportunity);
              console.log(`📢 [SOURCEBOTTLE] Extracted opportunity: ${opportunity.title}`);
            }
          } catch (error) {
            logManager.error(`Error processing result div ${index}:`, error);
            console.error(`📢 [SOURCEBOTTLE] Error processing result div ${index}:`, error);
          }
        });
      }
      
      // If we didn't find any opportunities, log an error
      if (pageOpportunities.length === 0) {
        logManager.error('No opportunities found on page. Page structure may have changed.');
        console.error('📢 [SOURCEBOTTLE] No opportunities found on page. Page structure may have changed.');
        
        // Log the HTML structure for debugging
        const htmlSample = document.body.innerHTML.substring(0, 1000);
        logManager.log('HTML sample from page:', htmlSample);
        
        // Update notification with error
        if (scraperNotification) {
          scraperNotification.update({
            status: 'error',
            message: 'No opportunities found on this page. Page structure may have changed.'
          });
        }
      }
      
      // Apply intelligent categorization to all opportunities
      pageOpportunities.forEach(opportunity => {
        opportunity.category = this.intelligentCategorize(opportunity.title, opportunity.description, currentUrl);
      });
      
      logManager.log(`Extracted ${pageOpportunities.length} opportunities from page`);
      console.log(`📢 [SOURCEBOTTLE] Extracted ${pageOpportunities.length} opportunities from page`);
      
      // Calculate total pages for navigation context
      const totalPages = this.detectPagination();
      const currentPage = this.getCurrentPageNumber();
      
      // Update notification with final results
      if (scraperNotification) {
        scraperNotification.update({
          status: 'success',
          message: `Found ${pageOpportunities.length} opportunities on page ${currentPage}`,
          totalFound: pageOpportunities.length,
          currentPage: currentPage,
          totalPages: totalPages
        });
        scraperNotification.updateProgress(100);
        
        // If there are multiple pages, show navigation button
        if (totalPages > currentPage) {
          const nextPageUrl = this.getNextPageUrl(currentUrl, currentPage);
          if (nextPageUrl) {
            scraperNotification.update({
              needsNavigation: true,
              navButtonText: `Go to Page ${currentPage + 1}`,
              navCallback: () => {
                window.location.href = nextPageUrl;
              }
            });
          }
        }
      }
      
      return pageOpportunities;
      
    } catch (error) {
      logManager.error('Error extracting opportunities from page:', error);
      console.error('📢 [SOURCEBOTTLE] Error extracting opportunities from page:', error);
      
      // Update notification with error
      if (scraperNotification) {
        scraperNotification.update({
          status: 'error',
          message: `Error: ${error.message || 'Unknown error during extraction'}`
        });
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
  extractOpportunityFromDiv(resultDiv, index, currentUrl) {
    try {
      // Extract the h4 element with the title and link
      const h4Element = resultDiv.querySelector('h4');
      if (!h4Element) {
        return null;
      }
      
      // Get the title and link
      const linkElement = h4Element.querySelector('a');
      if (!linkElement) {
        return null;
      }
      
      const title = linkElement.textContent.trim();
      const url = linkElement.href;
      
      // Extract the date posted
      const dateElement = resultDiv.querySelector('p.date');
      const datePosted = dateElement ? dateElement.textContent.replace('Date Posted:', '').trim() : '';
      
      // Extract the description
      const summaryElement = resultDiv.querySelector('div.summary p.left');
      const description = summaryElement ? summaryElement.textContent.trim() : '';
      
      // Extract the publication/journalist info
      const publicationElement = resultDiv.querySelector('p.publication strong');
      const publication = publicationElement ? publicationElement.textContent.trim() : '';
      
      // Extract the journalist type (if available)
      const journalistTypeElement = resultDiv.querySelector('p.publication');
      let journalistType = '';
      if (journalistTypeElement) {
        const text = journalistTypeElement.textContent;
        const match = text.match(/\((.*?)\)/);
        if (match && match[1]) {
          journalistType = match[1].trim();
        }
      }
      
      // Extract the deadline
      const deadlineElement = resultDiv.querySelector('p.date-deadline');
      let deadline = '';
      if (deadlineElement) {
        deadline = deadlineElement.textContent.replace('Deadline:', '').trim();
      }
      
      // Generate a unique ID for this opportunity
      // Extract query ID from URL if available
      let externalId = `sb-${index}-${Date.now()}`;
      const qidMatch = url.match(/qid=(\d+)/);
      if (qidMatch && qidMatch[1]) {
        externalId = qidMatch[1];
      }
      
      // Get the category from the URL if available
      const category = this.getCategoryFromUrl(url) || this.getCategoryFromUrl(currentUrl) || 'General';
      
      // Create the opportunity object
      const opportunity = {
        title,
        description,
        url,
        externalId,
        category,
        datePosted,
        deadline,
        publication,
        journalistType,
        extractedAt: new Date().toISOString()
      };
      
      return opportunity;
    } catch (error) {
      logManager.error('Error extracting opportunity from div:', error);
      return null;
    }
  }

  /**
   * Check if a link is a valid opportunity link
   * @param {Element} link - The link element to check
   * @returns {boolean} Whether the link is a valid opportunity
   */
  isValidOpportunityLink(link) {
    // Check if the link is to a query page
    return link && link.href && link.href.includes('query.asp');
  }

  /**
   * Extract opportunity from a link element
   * @param {Element} link - The link element containing the opportunity
   * @param {number} index - Index for generating unique IDs
   * @param {string} currentUrl - Current page URL for context
   * @returns {Object|null} Opportunity object or null if invalid
   */
  extractOpportunityFromLink(link, index, currentUrl) {
    try {
      // Get the title from the link text
      const title = link.textContent.trim();
      const url = link.href;
      
      // Try to find the parent elements to extract more info
      let parentElement = link.parentElement;
      while (parentElement && !parentElement.classList.contains('result')) {
        parentElement = parentElement.parentElement;
      }
      
      // If we found the parent result div, extract more info
      let description = '';
      let datePosted = '';
      let deadline = '';
      let publication = '';
      let journalistType = '';
      
      if (parentElement) {
        // Extract the date posted
        const dateElement = parentElement.querySelector('p.date');
        datePosted = dateElement ? dateElement.textContent.replace('Date Posted:', '').trim() : '';
        
        // Extract the description
        const summaryElement = parentElement.querySelector('div.summary p.left');
        description = summaryElement ? summaryElement.textContent.trim() : '';
        
        // Extract the publication/journalist info
        const publicationElement = parentElement.querySelector('p.publication strong');
        publication = publicationElement ? publicationElement.textContent.trim() : '';
        
        // Extract the journalist type (if available)
        const journalistTypeElement = parentElement.querySelector('p.publication');
        if (journalistTypeElement) {
          const text = journalistTypeElement.textContent;
          const match = text.match(/\((.*?)\)/);
          if (match && match[1]) {
            journalistType = match[1].trim();
          }
        }
        
        // Extract the deadline
        const deadlineElement = parentElement.querySelector('p.date-deadline');
        if (deadlineElement) {
          deadline = deadlineElement.textContent.replace('Deadline:', '').trim();
        }
      }
      
      // Generate a unique ID for this opportunity
      // Extract query ID from URL if available
      let externalId = `sb-${index}-${Date.now()}`;
      const qidMatch = url.match(/qid=(\d+)/);
      if (qidMatch && qidMatch[1]) {
        externalId = qidMatch[1];
      }
      
      // Get the category from the URL if available
      const category = this.getCategoryFromUrl(url) || this.getCategoryFromUrl(currentUrl) || 'General';
      
      // Create the opportunity object
      const opportunity = {
        title,
        description,
        url,
        externalId,
        category,
        datePosted,
        deadline,
        publication,
        journalistType,
        extractedAt: new Date().toISOString()
      };
      
      return opportunity;
    } catch (error) {
      logManager.error('Error extracting opportunity from link:', error);
      return null;
    }
  }

  /**
   * Intelligent categorization based on content analysis
   * @param {string} title - Opportunity title
   * @param {string} description - Opportunity description
   * @param {string} url - URL of the opportunity
   * @returns {string} Category
   */
  intelligentCategorize(title, description, url) {
    // First check if we can determine category from URL
    const urlCategory = this.getCategoryFromUrl(url);
    if (urlCategory) {
      return urlCategory;
    }
    
    // If no URL category, use content analysis
    if (!title && !description) {
      return 'General';
    }
    
    // Combine title and description for analysis
    const text = (title + ' ' + description).toLowerCase();
    
    // Score each category based on keyword matches
    const scores = {};
    
    // Initialize scores for all categories
    for (const category of Object.values(this.categoryMap)) {
      scores[category] = 0;
    }
    
    // Check each category's keywords
    for (const [keyword, category] of Object.entries(this.keywordCategoryMap)) {
      if (text.includes(keyword.toLowerCase())) {
        // Increment score for this category
        scores[category] = (scores[category] || 0) + 1;
        
        // Give extra weight to keywords in the title
        if (title && title.toLowerCase().includes(keyword.toLowerCase())) {
          scores[category] += 2;
        }
      }
    }
    
    // Find the category with the highest score
    let bestCategory = 'General';
    let highestScore = 0;
    
    for (const [category, score] of Object.entries(scores)) {
      if (score > highestScore) {
        highestScore = score;
        bestCategory = category;
      }
    }
    
    return bestCategory;
  }

  /**
   * Get category from URL
   * @param {string} url - URL to extract category from
   * @returns {string|null} Category or null
   */
  getCategoryFromUrl(url) {
    if (!url) return null;
    
    // Check if category can be determined from URL
    if (url.includes('iid=')) {
      const iidMatch = url.match(/[?&]iid=(\d+)/);
      if (iidMatch) {
        const iid = iidMatch[1];
        return this.categoryMap[iid] || null;
      }
    }
    
    return null;
  }

  /**
   * Parse date strings from SourceBottle format
   * @param {string} dateStr - Date string to parse
   * @returns {Date} Parsed date
   */
  parseDate(dateStr) {
    if (!dateStr) return new Date();
    
    try {
      // Format: "24 April 2025" or "30 April 2025 @ 5pm"
      const datePattern = /(\d+)\s+(\w+)\s+(\d{4})(?:\s+@\s+(\d+)(?::\d+)?\s*(am|pm)?)?/i;
      const match = dateStr.match(datePattern);
      
      if (match) {
        const day = parseInt(match[1], 10);
        const month = match[2];
        const year = parseInt(match[3], 10);
        
        // Create date from parts
        const date = new Date(`${day} ${month} ${year}`);
        
        // Add time if available
        if (match[4]) {
          let hour = parseInt(match[4], 10);
          const isPM = match[5]?.toLowerCase() === 'pm';
          
          // Adjust for PM
          if (isPM && hour < 12) {
            hour += 12;
          }
          
          date.setHours(hour, 0, 0, 0);
        }
        
        return date;
      }
      
      // Fallback - direct parse
      return new Date(dateStr);
    } catch (error) {
      logManager.error('Error parsing date:', error);
      // Default to 7 days in the future
      const date = new Date();
      date.setDate(date.getDate() + 7);
      return date;
    }
  }

  /**
   * Detect pagination info on the current page
   * @returns {number} Total number of pages
   */
  detectPagination() {
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
          logManager.log(`Detected pagination: ${totalResults} total results, ${totalPages} pages`);
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
          logManager.log(`Detected pagination from links: ${maxPage} pages`);
          return maxPage;
        }
      }
      
      // If we get here, assume there's only one page
      return 1;
    } catch (error) {
      logManager.error('Error detecting pagination:', error);
      return 1; // Default to 1 page
    }
  }
  
  /**
   * Get the current page number from the URL
   * @returns {number} Current page number (defaults to 1)
   */
  getCurrentPageNumber() {
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
  getNextPageUrl(currentUrl, currentPage) {
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
}

// Export as a singleton
export const opportunityScraper = new OpportunityScraper();
