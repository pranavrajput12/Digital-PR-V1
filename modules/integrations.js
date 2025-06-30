/**
 * IntegrationsManager - Handles external integrations
 * Supports Google Sheets, CSV, and other export options
 */
import { storageManager } from './storage.js';
import { logManager } from './logger.js';

class IntegrationsManager {
  /**
   * Initialize integrations manager
   */
  constructor() {
    this.DEFAULT_WEBAPP_URL = 'https://script.google.com/a/macros/qubit.capital/s/AKfycbxlje612pVpLl9ttLHqRegEEsk1vf6_UFfFZ_oMazrUjt2d_Jel96fwDNj-zHef6i8/exec';
    
    // Track failed requests for automatic retry
    this.pendingSends = [];
    this.retryDelay = 5000; // 5 seconds initial retry delay
    this.maxRetries = 3;    // Maximum number of retries
  }

  /**
   * Send opportunities to Google Sheets
   * @param {Array} opportunities - Opportunities to send
   * @returns {Promise<Object>} Result object
   */
  async sendToGoogleSheets(opportunities) {
    if (!opportunities || !Array.isArray(opportunities) || opportunities.length === 0) {
      logManager.warn('No opportunities to send to Google Sheets');
      return { success: false, error: 'No opportunities to send' };
    }
    
    logManager.log(`Preparing to send ${opportunities.length} opportunities to Google Sheets`);
    logManager.startPerformanceMeasure('googleSheetsSend');
    
    try {
      // Normalize data for Google Sheets
      const normalizedOpportunities = this._normalizeOpportunitiesForSheets(opportunities);
      
      // Get settings to find the web app URL
      const settings = await storageManager.getSettings();
      const webAppUrl = settings.googleSheetsWebAppUrl || this.DEFAULT_WEBAPP_URL;
      
      logManager.log('Using Google Sheets web app URL:', webAppUrl);
      
      // Send to Google Sheets via background script
      return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({
          action: 'sendToGoogleSheet',
          data: {
            opportunities: normalizedOpportunities
          }
        }, (response) => {
          logManager.endPerformanceMeasure('googleSheetsSend');
          
          if (chrome.runtime.lastError) {
            logManager.error('Error sending to Google Sheets:', chrome.runtime.lastError);
            
            // Queue for retry if it's a network error
            this._queueForRetry('googleSheets', normalizedOpportunities);
            
            resolve({ 
              success: false, 
              error: chrome.runtime.lastError.message || 'Unknown error',
              queued: true
            });
            return;
          }
          
          if (response && response.success) {
            logManager.log('Successfully sent to Google Sheets');
            
            // Update the last sync timestamp
            storageManager.updateLastSyncTime();
            
            resolve({ 
              success: true, 
              message: `Successfully sent ${opportunities.length} opportunities to Google Sheets`
            });
          } else {
            logManager.error('Failed to send to Google Sheets:', response?.error || 'Unknown error');
            
            // Queue for retry if appropriate
            if (response?.error && response.error.includes('network')) {
              this._queueForRetry('googleSheets', normalizedOpportunities);
            }
            
            resolve({ 
              success: false, 
              error: response?.error || 'Failed to send to Google Sheets',
              queued: response?.error && response.error.includes('network')
            });
          }
        });
      });
    } catch (error) {
      logManager.error('Exception in sendToGoogleSheets:', error);
      return { success: false, error: error.message || 'Unknown error' };
    }
  }

  /**
   * Queue failed request for automatic retry
   * @param {string} type - Type of request ('googleSheets', etc)
   * @param {Array} data - Data to retry sending
   * @private
   */
  _queueForRetry(type, data) {
    const retryItem = {
      type,
      data,
      timestamp: Date.now(),
      retryCount: 0,
      retryScheduled: false
    };
    
    this.pendingSends.push(retryItem);
    logManager.log(`Queued ${type} request for retry`);
    
    // Schedule retry if not already running
    this._scheduleNextRetry();
  }

  /**
   * Schedule the next retry attempt
   * @private
   */
  _scheduleNextRetry() {
    // Find items that need retry and aren't already scheduled
    const itemsToRetry = this.pendingSends.filter(item => 
      !item.retryScheduled && item.retryCount < this.maxRetries);
    
    if (itemsToRetry.length === 0) return;
    
    // Sort by timestamp (oldest first)
    itemsToRetry.sort((a, b) => a.timestamp - b.timestamp);
    
    // Schedule the oldest item
    const item = itemsToRetry[0];
    item.retryScheduled = true;
    
    // Calculate backoff delay
    const delay = this.retryDelay * Math.pow(2, item.retryCount);
    
    logManager.log(`Scheduling retry for ${item.type} in ${delay}ms (attempt ${item.retryCount + 1}/${this.maxRetries})`);
    
    setTimeout(() => {
      this._performRetry(item);
    }, delay);
  }

  /**
   * Perform a retry attempt
   * @param {Object} item - Retry item
   * @private
   */
  async _performRetry(item) {
    logManager.log(`Attempting retry for ${item.type} (attempt ${item.retryCount + 1}/${this.maxRetries})`);
    
    try {
      let result;
      if (item.type === 'googleSheets') {
        // Send without going through the regular method to avoid another retry queue
        result = await this._directSendToGoogleSheets(item.data);
      } else {
        logManager.warn(`Unknown retry type: ${item.type}`);
        result = { success: false, error: 'Unknown retry type' };
      }
      
      if (result.success) {
        logManager.log(`Retry successful for ${item.type}`);
        
        // Remove from pending sends
        this.pendingSends = this.pendingSends.filter(i => i !== item);
      } else {
        logManager.warn(`Retry failed for ${item.type}:`, result.error);
        
        // Increment retry count and unset scheduled flag
        item.retryCount++;
        item.retryScheduled = false;
        
        // If max retries reached, remove from queue
        if (item.retryCount >= this.maxRetries) {
          logManager.error(`Max retries reached for ${item.type}, giving up`);
          this.pendingSends = this.pendingSends.filter(i => i !== item);
        }
      }
    } catch (error) {
      logManager.error(`Error during retry for ${item.type}:`, error);
      
      // Increment retry count and unset scheduled flag
      item.retryCount++;
      item.retryScheduled = false;
      
      // If max retries reached, remove from queue
      if (item.retryCount >= this.maxRetries) {
        logManager.error(`Max retries reached for ${item.type}, giving up`);
        this.pendingSends = this.pendingSends.filter(i => i !== item);
      }
    }
    
    // Schedule next retry if there are any
    this._scheduleNextRetry();
  }

  /**
   * Direct send to Google Sheets (for retry mechanism)
   * @param {Array} opportunities - Opportunities to send
   * @returns {Promise<Object>} Result object
   * @private
   */
  async _directSendToGoogleSheets(opportunities) {
    try {
      const settings = await storageManager.getSettings();
      const webAppUrl = settings.googleSheetsWebAppUrl || this.DEFAULT_WEBAPP_URL;
      
      const payload = JSON.stringify({ opportunities: opportunities });
      
      const response = await fetch(webAppUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: payload
      });
      
      if (!response.ok) {
        throw new Error(`Google Sheets API responded with status: ${response.status}`);
      }
      
      const responseText = await response.text();
      let responseData;
      
      try {
        responseData = JSON.parse(responseText);
      } catch (e) {
        responseData = { message: responseText };
      }
      
      return { success: true, data: responseData };
    } catch (error) {
      return { success: false, error: error.message || 'Unknown error' };
    }
  }

  /**
   * Generate and download a CSV file
   * @param {Array} opportunities - Opportunities to include
   * @returns {Object} Result object
   */
  downloadCSV(opportunities) {
    if (!opportunities || !Array.isArray(opportunities) || opportunities.length === 0) {
      logManager.warn('No opportunities to export as CSV');
      return { success: false, error: 'No opportunities to export' };
    }
    
    logManager.log(`Generating CSV for ${opportunities.length} opportunities`);
    
    try {
      const csvContent = this._generateCSV(opportunities);
      
      if (!csvContent) {
        return { success: false, error: 'Failed to generate CSV content' };
      }
      
      // Create a data URI for the CSV
      const encodedUri = encodeURI('data:text/csv;charset=utf-8,' + csvContent);
      
      // Create a link element and trigger download
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `sourcebottle-opportunities-${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      
      // Trigger download and clean up
      link.click();
      document.body.removeChild(link);
      
      return { success: true, message: `Downloaded CSV with ${opportunities.length} opportunities` };
    } catch (error) {
      logManager.error('Error downloading CSV:', error);
      return { success: false, error: error.message || 'Unknown error' };
    }
  }

  /**
   * Generate CSV content
   * @param {Array} opportunities - Opportunities to include
   * @returns {string} CSV content
   * @private
   */
  _generateCSV(opportunities) {
    try {
      // CSV header
      let csvContent = "Title,Description,Category,Deadline,Source,Media Outlet,Journalist,Link\n";
      
      // Add each opportunity as a row
      opportunities.forEach(opp => {
        // Escape fields that might contain commas or quotes
        const escapedTitle = opp.title ? `"${opp.title.replace(/"/g, '""')}"` : '""';
        const escapedDesc = opp.description ? `"${opp.description.replace(/"/g, '""')}"` : '""';
        const escapedCategory = opp.category ? `"${opp.category.replace(/"/g, '""')}"` : '""';
        const escapedDeadline = opp.deadline ? `"${opp.deadline.replace(/"/g, '""')}"` : '""';
        const escapedSource = opp.source ? `"${opp.source.replace(/"/g, '""')}"` : '""';
        const escapedMediaOutlet = opp.mediaOutlet ? `"${opp.mediaOutlet.replace(/"/g, '""')}"` : '""';
        const escapedJournalist = opp.journalist ? `"${opp.journalist.replace(/"/g, '""')}"` : '""';
        const escapedLink = opp.submissionLink ? `"${opp.submissionLink.replace(/"/g, '""')}"` : '""';
        
        // Add row
        csvContent += `${escapedTitle},${escapedDesc},${escapedCategory},${escapedDeadline},${escapedSource},${escapedMediaOutlet},${escapedJournalist},${escapedLink}\n`;
      });
      
      return csvContent;
    } catch (error) {
      logManager.error('Error generating CSV:', error);
      return null;
    }
  }

  /**
   * Normalize opportunities for Google Sheets
   * @param {Array} opportunities - Opportunities to normalize
   * @returns {Array} Normalized opportunities
   * @private
   */
  _normalizeOpportunitiesForSheets(opportunities) {
    return opportunities.map(opp => ({
      "Title": opp.title || '',
      "Description": opp.description || '',
      "Category": opp.category || '',
      "Deadline": opp.deadline || opp.date || '',
      "Source": opp.source || 'sourcebottle',
      "Media Outlet": opp.mediaOutlet || '',
      "Journalist": opp.journalist || '',
      "Link": opp.submissionLink || opp.link || ''
    }));
  }

  /**
   * Export opportunities to Notion (placeholder for future implementation)
   * @param {Array} opportunities - Opportunities to export
   * @returns {Promise<Object>} Result object
   */
  async exportToNotion(opportunities) {
    // This is a placeholder for future Notion integration
    logManager.log('Notion export not yet implemented');
    return { success: false, error: 'Notion integration not yet implemented' };
  }

  /**
   * Export opportunities to Airtable (placeholder for future implementation)
   * @param {Array} opportunities - Opportunities to export
   * @returns {Promise<Object>} Result object
   */
  async exportToAirtable(opportunities) {
    // This is a placeholder for future Airtable integration
    logManager.log('Airtable export not yet implemented');
    return { success: false, error: 'Airtable integration not yet implemented' };
  }

  /**
   * Get pending retry count
   * @returns {number} Number of pending retries
   */
  getPendingRetryCount() {
    return this.pendingSends.length;
  }

  /**
   * Force retry of all pending sends
   */
  forceRetryAll() {
    logManager.log(`Force retrying ${this.pendingSends.length} pending sends`);
    
    // Reset all scheduled flags
    this.pendingSends.forEach(item => {
      item.retryScheduled = false;
    });
    
    // Schedule next retry
    this._scheduleNextRetry();
  }
}

// Export as a singleton
export const integrationsManager = new IntegrationsManager();
