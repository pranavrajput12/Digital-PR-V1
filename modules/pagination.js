/**
 * PaginationManager - Handles multi-page scraping with reliable state tracking
 * Ensures data persistence between page navigations
 */
import { storageManager } from './storage.js';
import { logManager } from './logger.js';
import { opportunityScraper } from './scraper.js';

class PaginationManager {
  /**
   * Initialize the pagination manager
   */
  constructor() {
    this.currentState = {
      inProgress: false,
      opportunities: [],
      currentPage: 1,
      totalPages: 1,
      category: 'General',
      lastUpdated: null
    };
    
    this.uniqueOpportunityIds = new Set();
  }

  /**
   * Initialize pagination from current page
   * @returns {Promise<Object>} Pagination state
   */
  async initializeFromPage() {
    logManager.log('Initializing pagination from current page');
    logManager.startPerformanceMeasure('paginationInit');
    
    try {
      // Get pagination info from the page
      const totalPages = opportunityScraper.detectPagination();
      const currentPage = opportunityScraper.getCurrentPageNumber();
      
      logManager.log(`Detected pagination: page ${currentPage} of ${totalPages}`);
      
      // Try to load existing state from storage
      const savedState = await storageManager.getPaginationState();
      
      if (savedState && savedState.inProgress) {
        logManager.log('Found existing pagination state:', savedState);
        
        // Sanity check on the state - must match current page context
        if (savedState.currentPage !== currentPage) {
          logManager.warn(`Page mismatch: URL shows page ${currentPage}, but stored data has page ${savedState.currentPage}`);
          
          // If we're on a new page, update the state
          if (currentPage > 1) {
            savedState.currentPage = currentPage;
            logManager.log(`Updated stored page number to ${currentPage}`);
          }
        }
        
        // Restore state
        this.currentState = savedState;
        
        // Initialize unique IDs set
        this.uniqueOpportunityIds = new Set(
          savedState.opportunities.map(op => op.externalId)
        );
        
        logManager.log(`Restored pagination with ${savedState.opportunities.length} opportunities`);
      } else {
        // Initialize fresh state
        this.currentState = {
          inProgress: totalPages > 1,
          opportunities: [],
          currentPage: currentPage,
          totalPages: totalPages,
          category: this._detectCurrentCategory(),
          lastUpdated: new Date().toISOString()
        };
        
        this.uniqueOpportunityIds = new Set();
        logManager.log('Initialized fresh pagination state');
      }
      
      // Save state to storage
      await this._saveState();
      
      logManager.endPerformanceMeasure('paginationInit');
      return this.currentState;
    } catch (error) {
      logManager.error('Error initializing pagination:', error);
      logManager.endPerformanceMeasure('paginationInit');
      
      // Return a default state in case of error
      return {
        inProgress: false,
        opportunities: [],
        currentPage: 1,
        totalPages: 1,
        category: 'General',
        error: error.message
      };
    }
  }

  /**
   * Process the current page and extract opportunities
   * @returns {Promise<Object>} Processing result
   */
  async processCurrentPage() {
    logManager.log(`Processing page ${this.currentState.currentPage} of ${this.currentState.totalPages}`);
    logManager.startPerformanceMeasure('pageProcessing');
    
    try {
      // Extract opportunities from the current page
      const pageOpportunities = opportunityScraper.extractOpportunitiesFromPage();
      logManager.log(`Found ${pageOpportunities.length} opportunities on current page`);
      
      // Filter out opportunities we already have
      const newOpportunities = pageOpportunities.filter(
        op => !this.uniqueOpportunityIds.has(op.externalId)
      );
      
      logManager.log(`After filtering duplicates: ${newOpportunities.length} new opportunities`);
      
      // Add new opportunities to our tracking set
      newOpportunities.forEach(op => this.uniqueOpportunityIds.add(op.externalId));
      
      // Add to full collection
      this.currentState.opportunities = [
        ...newOpportunities,
        ...this.currentState.opportunities
      ];
      
      // Update state
      this.currentState.lastUpdated = new Date().toISOString();
      
      // Save state
      await this._saveState();
      
      // Show feedback message on the page
      this._showFeedback(
        `Found ${newOpportunities.length} new opportunities on page ${this.currentState.currentPage}/${this.currentState.totalPages}. Total: ${this.currentState.opportunities.length}`,
        'success'
      );
      
      // Add progress widget to page
      this._addProgressWidget();
      
      // Handle navigation if more pages exist
      if (this.currentState.currentPage < this.currentState.totalPages) {
        this._setupNextPageNavigation();
      } else {
        // We're done, finalize
        logManager.log('All pages processed, finalizing');
        await this.finalize();
      }
      
      logManager.endPerformanceMeasure('pageProcessing');
      
      return {
        success: true,
        newCount: newOpportunities.length,
        totalCount: this.currentState.opportunities.length,
        isComplete: this.currentState.currentPage >= this.currentState.totalPages,
        opportunities: pageOpportunities
      };
    } catch (error) {
      logManager.error('Error processing page:', error);
      logManager.endPerformanceMeasure('pageProcessing');
      
      // Show error on page
      this._showFeedback(`Error processing page: ${error.message}`, 'error');
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Finalize pagination and clean up
   * @returns {Promise<Object>} Final collection of opportunities
   */
  async finalize() {
    logManager.log('Finalizing pagination');
    
    try {
      // Only consider pagination complete if we're on the last page
      if (this.currentState.currentPage >= this.currentState.totalPages) {
        const opportunityCount = this.currentState.opportunities.length;
        const pageCount = this.currentState.totalPages;
        
        logManager.log(`Pagination complete, saving ${opportunityCount} opportunities from ${pageCount} pages`);
        
        // Store opportunities in main storage
        if (opportunityCount > 0) {
          await storageManager.saveOpportunities(this.currentState.opportunities);
        }
        
        // Clear pagination state
        await storageManager.clearPaginationState();
        
        // Store the counts before resetting state for the success message
        const result = {
          success: true,
          opportunityCount,
          pageCount
        };
        
        // Show completion message with the correct counts
        this._showFeedback(
          `Pagination complete! Collected ${opportunityCount} opportunities across ${pageCount} pages.`,
          'success'
        );
        
        // Reset manager state after we've used the counts
        this.currentState = {
          inProgress: false,
          opportunities: [],
          currentPage: 1,
          totalPages: 1,
          category: 'General',
          lastUpdated: null
        };
        
        this.uniqueOpportunityIds = new Set();
        
        return result;
      } else {
        logManager.warn(
          `Attempted to finalize pagination while not on last page (${this.currentState.currentPage}/${this.currentState.totalPages})`
        );
        
        return {
          success: false,
          error: 'Pagination not complete yet',
          currentPage: this.currentState.currentPage,
          totalPages: this.currentState.totalPages
        };
      }
    } catch (error) {
      logManager.error('Error finalizing pagination:', error);
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Cancel ongoing pagination
   * @returns {Promise<boolean>} Success status
   */
  async cancelPagination() {
    try {
      logManager.log('Cancelling pagination');
      
      // Clear pagination state
      await storageManager.clearPaginationState();
      
      // Reset manager state
      this.currentState = {
        inProgress: false,
        opportunities: [],
        currentPage: 1,
        totalPages: 1,
        category: 'General',
        lastUpdated: null
      };
      
      this.uniqueOpportunityIds = new Set();
      
      return true;
    } catch (error) {
      logManager.error('Error cancelling pagination:', error);
      return false;
    }
  }

  /**
   * Save current state to storage
   * @returns {Promise<void>}
   * @private
   */
  async _saveState() {
    try {
      await storageManager.savePaginationState(this.currentState);
      logManager.log('Saved pagination state');
    } catch (error) {
      logManager.error('Error saving pagination state:', error);
    }
  }

  /**
   * Detect current category from the page URL
   * @returns {string} Category name
   * @private
   */
  _detectCurrentCategory() {
    const url = window.location.href;
    const category = opportunityScraper.getCategoryFromUrl(url);
    return category || 'General';
  }

  /**
   * Show feedback message on the page
   * @param {string} message - Message to show
   * @param {string} type - Message type (success, info, warning, error)
   * @private
   */
  _showFeedback(message, type = 'info') {
    // Remove any existing feedback to prevent stacking
    const existing = document.getElementById('sb-feedback-message');
    if (existing) existing.remove();
  
    // Create feedback element
    const feedbackDiv = document.createElement('div');
    feedbackDiv.id = 'sb-feedback-message';
    feedbackDiv.setAttribute('role', 'alert'); // Accessibility
    feedbackDiv.setAttribute('aria-live', 'polite');
  
    // Set styles based on type
    let backgroundColor;
  
    switch (type) {
      case 'success':
        backgroundColor = '#4CAF50'; // Green
        break;
      case 'error':
        backgroundColor = '#F44336'; // Red
        break;
      case 'warning':
        backgroundColor = '#FF9800'; // Orange
        break;
      default:
        backgroundColor = '#2196F3'; // Blue
    }
  
    feedbackDiv.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background-color: ${backgroundColor};
      color: white;
      padding: 15px;
      border-radius: 5px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.2);
      z-index: 9999;
      font-family: Arial, sans-serif;
      font-size: 16px;
      font-weight: bold;
      max-width: 300px;
    `;
  
    feedbackDiv.textContent = message;
    document.body.appendChild(feedbackDiv);
  
    // Remove after 5 seconds
    setTimeout(() => {
      if (feedbackDiv.parentNode) {
        feedbackDiv.parentNode.removeChild(feedbackDiv);
      }
    }, 5000);
  }

  /**
   * Add progress widget to the page
   * @private
   */
  _addProgressWidget() {
    // Remove existing widget if present
    const existing = document.getElementById('sb-pagination-stats');
    if (existing) existing.remove();
    
    // Create widget
    const statsDiv = document.createElement('div');
    statsDiv.id = 'sb-pagination-stats';
    statsDiv.style.cssText = `
      position: fixed;
      top: 150px;
      right: 20px;
      background-color: #333;
      color: white;
      padding: 15px;
      border-radius: 5px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.5);
      z-index: 9999;
      font-family: Arial, sans-serif;
      font-size: 14px;
    `;
    
    statsDiv.innerHTML = `
      <strong>SourceBottle Tracker</strong><br>
      Current Page: ${this.currentState.currentPage} of ${this.currentState.totalPages}<br>
      Opportunities collected: ${this.currentState.opportunities.length}<br>
      <span style="color:#4CAF50">Click Next Page to continue →</span>
    `;
    
    document.body.appendChild(statsDiv);
  }

  /**
   * Set up next page navigation elements
   * @private
   */
  _setupNextPageNavigation() {
    const nextPageNum = this.currentState.currentPage + 1;
    
    // Find pagination links
    const nextPageLinks = Array.from(document.querySelectorAll('a[href*="page="]'));
    
    // Find the link for the next page
    const nextPageLink = nextPageLinks.find(link => {
      const pageMatch = link.href.match(/page=(\d+)/);
      if (pageMatch) {
        const pageNum = parseInt(pageMatch[1], 10);
        return pageNum === nextPageNum;
      }
      return false;
    });
    
    if (nextPageLink) {
      logManager.log(`Found link to page ${nextPageNum}: ${nextPageLink.href}`);
      
      // Show guidance to the user
      this._showFeedback(
        `Please click "Next" for page ${nextPageNum} to continue scraping. Your progress is being saved.`,
        'info'
      );
      
      // Highlight the next page link to make it obvious
      nextPageLink.style.backgroundColor = '#ffff00';
      nextPageLink.style.fontWeight = 'bold';
      nextPageLink.style.padding = '5px';
      nextPageLink.style.border = '2px solid #ff0000';
      
      // Add click event listener to preserve data
      nextPageLink.addEventListener('click', this._handleNextPageClick.bind(this));
      
      // Scroll to the pagination area
      nextPageLink.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
      // If we can't find specific next page link, try generic "Next" link
      logManager.log('Could not find specific next page link, checking for generic "Next" link');
      
      const genericNextLink = Array.from(document.querySelectorAll('a')).find(link => 
        link.textContent.trim().toLowerCase() === 'next' || 
        link.textContent.trim().toLowerCase().includes('next') ||
        link.textContent.trim().includes('›') ||
        link.textContent.trim().includes('>'));
      
      if (genericNextLink) {
        logManager.log('Found generic next link:', genericNextLink.href);
        
        // Similar behavior as above
        this._showFeedback('Please click "Next" to continue scraping the next page', 'info');
        
        // Highlight the generic next link
        genericNextLink.style.backgroundColor = '#ffff00';
        genericNextLink.style.fontWeight = 'bold';
        genericNextLink.style.padding = '5px';
        genericNextLink.style.border = '2px solid #ff0000';
        
        // Add click event listener
        genericNextLink.addEventListener('click', this._handleNextPageClick.bind(this));
        
        // Scroll to the element
        genericNextLink.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        // No pagination links found
        logManager.warn('No pagination links found, assuming all data is on this page');
        
        // Finalize if we can't find navigation
        this.finalize();
      }
    }
  }

  /**
   * Handle click on next page link
   * @param {Event} e - Click event
   * @private
   */
  _handleNextPageClick(e) {
    logManager.log(`User clicked to navigate to page ${this.currentState.currentPage + 1}`);
    
    // Update the state to indicate we're expecting to move to the next page
    this.currentState.nextExpectedPage = this.currentState.currentPage + 1;
    this.currentState.lastClicked = new Date().toISOString();
    
    // Save state
    this._saveState();
  }
}

// Export as a singleton
export const paginationManager = new PaginationManager();
