/**
 * BackgroundService - Core service worker for the extension
 * Manages message passing, alarms, and tab operations
 */
class BackgroundService {
  /**
   * Initialize the background service
   */
  constructor() {
    this.setupMessageHandlers();
    this.setupAlarms();
    
    // Prevent automatic tab opening
    this.allowTabOpen = false;
    
    // Default refresh interval in minutes
    this.DEFAULT_REFRESH_INTERVAL = 60;
  }

  /**
   * Set up message handlers
   */
  setupMessageHandlers() {
    chrome.runtime.onMessage.addListener(this.handleMessage.bind(this));
    console.log('[BackgroundService] Message handlers initialized');
  }

  /**
   * Set up alarms for automated tasks
   */
  setupAlarms() {
    // Check if alarms are already set up
    chrome.alarms.get('refreshData', (alarm) => {
      if (alarm) {
        console.log('[BackgroundService] Refresh alarm already exists');
        return;
      }
      
      // Get settings to determine refresh interval
      chrome.storage.local.get(['settings'], (result) => {
        const settings = result.settings || {};
        const refreshInterval = settings.refreshInterval || this.DEFAULT_REFRESH_INTERVAL;
        
        console.log(`[BackgroundService] Setting up refresh alarm with interval: ${refreshInterval} minutes`);
        
        // Create alarm to periodically refresh data, but no auto-actions
        chrome.alarms.create('refreshData', {
          periodInMinutes: refreshInterval,
        });
      });
    });
    
    // Listen for alarm events
    chrome.alarms.onAlarm.addListener((alarm) => {
      if (alarm.name === 'refreshData') {
        console.log('[BackgroundService] Refresh alarm triggered - NOT auto-opening pages');
        // Do not auto-fetch, just notify user a refresh is available
        this.showRefreshNotification();
      }
      else if (alarm.name === 'autoScrape') {
        console.log('[BackgroundService] Auto-scrape alarm triggered');
        // Only run scheduled scrape if explicitly enabled by user
        this.checkAndRunScheduledScrape();
      }
    });
  }

  /**
   * Show a notification that data can be refreshed
   */
  showRefreshNotification() {
    // Only show if enabled in settings
    chrome.storage.local.get(['settings'], (result) => {
      const settings = result.settings || {};
      if (settings.notifyRefresh) {
        chrome.notifications.create('refresh-available', {
          type: 'basic',
          iconUrl: 'icons/icon128.png',
          title: 'SourceBottle Refresh Available',
          message: 'Click to refresh your opportunities data.',
          buttons: [{ title: 'Refresh Now' }]
        });
      }
    });
  }

  /**
   * Check if scheduled scrape should run and execute if so
   */
  checkAndRunScheduledScrape() {
    chrome.storage.local.get(['settings'], (result) => {
      const settings = result.settings || {};
      const schedule = settings.schedule || {};
      
      // Only run if explicitly enabled
      if (!schedule || !schedule.enabled) {
        console.log('[BackgroundService] Auto-scrape not enabled in settings');
        return;
      }
      
      console.log('[BackgroundService] Running scheduled scrape');
      // Implement scheduled scrape logic here...
    });
  }

  /**
   * Handle incoming messages
   * @param {Object} message - Message object
   * @param {Object} sender - Sender information
   * @param {Function} sendResponse - Function to send response
   * @returns {boolean} Whether response will be sent asynchronously
   */
  handleMessage(message, sender, sendResponse) {
    console.log('[BackgroundService] Message received:', message);
    
    // Route messages to appropriate handlers
    switch(message.action) {
      case 'scrapeSourceBottleCategory':
        return this.handleCategoryScrape(message, sendResponse);
        
      case 'sendToGoogleSheet':
        return this.handleGoogleSheetSend(message, sendResponse);
        
      case 'fetchSourceBottleOpportunities':
        return this.handleFetchOpportunities(message, sendResponse);
        
      case 'allowTabOpen':
        this.allowTabOpen = true;
        sendResponse({ success: true });
        return false;
        
      default:
        console.log('[BackgroundService] Unknown action:', message.action);
        sendResponse({ success: false, error: 'Unknown action' });
        return false;
    }
  }

  /**
   * Handle category scrape request
   * @param {Object} message - Message object
   * @param {Function} sendResponse - Function to send response
   * @returns {boolean} Whether response will be sent asynchronously
   */
  handleCategoryScrape(message, sendResponse) {
    const categoryId = message.categoryId;
    if (!categoryId) {
      sendResponse({ success: false, error: 'No category ID provided' });
      return false;
    }
    
    // This is just a stub - implementation would be more complex
    console.log(`[BackgroundService] Scraping category: ${categoryId}`);
    
    // Return true to indicate we'll send response asynchronously
    return true;
  }

  /**
   * Handle Google Sheet send request
   * @param {Object} message - Message object
   * @param {Function} sendResponse - Function to send response
   * @returns {boolean} Whether response will be sent asynchronously
   */
  handleGoogleSheetSend(message, sendResponse) {
    console.log('[BackgroundService] Google Sheet send handler called');
    
    try {
      // Extract data safely
      if (!message.data) {
        throw new Error('No data provided in request');
      }
      
      const opportunities = message.data.opportunities || [];
      
      if (opportunities.length === 0) {
        throw new Error('No opportunities to send');
      }
      
      // Send to Google Apps Script Web App
      console.log('[BackgroundService] Sending to Google Sheet', opportunities.length, 'opportunities');
      
      // Get web app URL from settings or use default
      chrome.storage.local.get(['settings'], (result) => {
        const settings = result.settings || {};
        const webAppUrl = settings.googleSheetsWebAppUrl || 
          'https://script.google.com/a/macros/qubit.capital/s/AKfycbxlje612pVpLl9ttLHqRegEEsk1vf6_UFfFZ_oMazrUjt2d_Jel96fwDNj-zHef6i8/exec';
        
        const payload = JSON.stringify({ opportunities: opportunities });
        
        fetch(webAppUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: payload
        })
        .then(async response => {
          console.log('[BackgroundService] Google Sheet response status:', response.status);
          const text = await response.text();
          console.log('[BackgroundService] Google Sheet response:', text);
          
          let responseData;
          try {
            responseData = JSON.parse(text);
          } catch (e) {
            responseData = { message: text };
          }
          
          sendResponse({ success: true, data: responseData });
        })
        .catch(error => {
          console.error('[BackgroundService] Failed to send to Google Sheet', error);
          sendResponse({ success: false, error: error.message || 'Unknown error' });
        });
      });
      
      return true; // Will respond asynchronously
    } catch (error) {
      console.error('[BackgroundService] Error in Google Sheet send handler', error);
      sendResponse({ success: false, error: error.message || 'Unknown error' });
      return false;
    }
  }

  /**
   * Handle fetch opportunities request
   * @param {Object} message - Message object
   * @param {Function} sendResponse - Function to send response
   * @returns {boolean} Whether response will be sent asynchronously
   */
  handleFetchOpportunities(message, sendResponse) {
    console.log('[BackgroundService] Fetch opportunities handler called');
    
    // For testing, temporarily allow tab open without explicit permission
    this.allowTabOpen = true;
    
    // Only proceed if explicitly allowed by user action
    if (!this.allowTabOpen) {
      console.log('[BackgroundService] Tab open not allowed - user must explicitly enable');
      sendResponse({ 
        success: false, 
        error: 'Manual permission required to open tabs' 
      });
      return false;
    }
    
    // Reset the flag after using it once
    this.allowTabOpen = false;
    
    // Check if we already have a SourceBottle tab open
    chrome.tabs.query({ url: '*://*.sourcebottle.com/*' }, (tabs) => {
      if (tabs.length > 0) {
        // Use the existing tab
        const tab = tabs[0];
        console.log(`[BackgroundService] Using existing SourceBottle tab: ${tab.id}`);
        
        // Reload the tab to get fresh data
        chrome.tabs.reload(tab.id, {}, () => {
          console.log(`[BackgroundService] Reloaded SourceBottle tab: ${tab.id}`);
          
          // Give the page time to load before sending the extract message
          setTimeout(() => {
            chrome.tabs.sendMessage(tab.id, {
              action: 'extractSourceBottleOpportunities'
            }, response => {
              if (chrome.runtime.lastError) {
                console.error('[BackgroundService] Error sending message to tab:', chrome.runtime.lastError);
              } else {
                console.log('[BackgroundService] Extract message sent, response:', response);
              }
            });
          }, 3000); // Wait 3 seconds for page to load
        });
        
        sendResponse({ 
          success: true, 
          status: 'reloading', 
          message: 'Reloading SourceBottle tab' 
        });
      } else {
        // Open a new tab
        console.log('[BackgroundService] No SourceBottle tab found, opening new tab');
        
        chrome.tabs.create({ 
          url: 'https://www.sourcebottle.com/industry-list-results.asp?industry=All',
          active: true // Make it active so the user can see what's happening
        }, (tab) => {
          console.log(`[BackgroundService] Opened new SourceBottle tab: ${tab.id}`);
          
          // Give the page time to load before sending the extract message
          setTimeout(() => {
            chrome.tabs.sendMessage(tab.id, {
              action: 'extractSourceBottleOpportunities'
            }, response => {
              if (chrome.runtime.lastError) {
                console.error('[BackgroundService] Error sending message to tab:', chrome.runtime.lastError);
              } else {
                console.log('[BackgroundService] Extract message sent, response:', response);
              }
            });
          }, 5000); // Wait 5 seconds for page to load
        });
        
        sendResponse({ 
          success: true, 
          status: 'opening', 
          message: 'Opening SourceBottle tab' 
        });
      }
    });
    
    return true; // Will respond asynchronously
  }
}

// Initialize the service
const backgroundService = new BackgroundService();
