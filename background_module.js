/**
 * SourceBottle Opportunities Tracker - Background Script (Module Version)
 * This is the modernized version that uses the modular architecture
 */

// Import our modules
import { logManager } from './modules/logger.js';
import { storageManager } from './modules/storage.js';
import { integrationsManager } from './modules/integrations.js';
import { opportunityScraper } from './modules/scraper.js';
import { aiService } from './modules/aiService.js';

// Constants
const DEFAULT_REFRESH_INTERVAL = 60; // minutes

/**
 * BackgroundController - Main controller for the extension background functions
 */
class BackgroundController {
  constructor() {
    logManager.log('Initializing SourceBottle background controller');
    this.debugLog('BackgroundController constructor called');
    
    // State tracking
    this.allowTabOpen = false;
    this.pendingResponses = new Map();
    
    // Initialize components
    this.setupMessageHandlers();
    this.setupAlarms();
    this.setupBadge();
    this.setupNotificationListeners();
    
    logManager.log('Background controller initialized');
    this.debugLog('Background controller initialized');
  }
  
  /**
   * Set up message handlers for communication with content scripts and popup
   */
  setupMessageHandlers() {
    this.debugLog('setupMessageHandlers called');
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      logManager.debug('Message received', { action: request.action, sender: sender.tab?.url || 'unknown' });
      
      // Create a unique request ID for tracking
      const requestId = Date.now() + '-' + Math.random().toString(36).substring(2, 15);
      
      // Process the message based on action type
      switch (request.action) {
        case 'scrapeSourceBottleCategory':
          this.handleCategoryScrape(request, sender, sendResponse, requestId);
          return true; // Will respond asynchronously
          
        case 'sendToGoogleSheet':
          this.handleGoogleSheetSend(request, sender, sendResponse, requestId);
          return true; // Will respond asynchronously
          
        case 'fetchSourceBottleOpportunities':
          this.handleFetchOpportunities(request, sender, sendResponse, requestId);
          return true; // Will respond asynchronously
          
        case 'scheduleAutoScrape':
          this.handleScheduleAutoScrape(request, sender, sendResponse);
          return true; // Will respond asynchronously
          
        case 'exportToCSV':
          this.handleExportToCSV(request, sender, sendResponse);
          return false; // Will respond synchronously
          
        case 'sourceBottleOpportunitiesExtracted':
          this.handleOpportunitiesExtracted(request, sender, sendResponse);
          return true; // Will respond asynchronously
          
        case 'extractFromSourceBottleTabs':
          this.handleExtractFromTabs(request, sender, sendResponse);
          return true; // Will respond asynchronously
          
        case 'allowTabOpen':
          this.allowTabOpen = true;
          sendResponse({ success: true });
          return false; // Will respond synchronously
          
        case 'extractedOpportunities':
          this.handleExtractedOpportunities(request, sender, sendResponse);
          return true; // Will respond asynchronously
          
        case 'opportunityUpdated':
          this.handleOpportunityUpdated(request, sender, sendResponse);
          return true; // Will respond asynchronously
          
        default:
          logManager.warn('Unknown action received:', request.action);
          sendResponse({ success: false, error: 'Unknown action' });
          return false; // Will respond synchronously
      }
    });
  }
  
  /**
   * Set up alarm handlers for scheduling
   */
  setupAlarms() {
    this.debugLog('setupAlarms called');
    // Get settings to determine refresh interval
    storageManager.getSettings().then(settings => {
      const refreshInterval = settings.refreshInterval || DEFAULT_REFRESH_INTERVAL;
      
      // Check if alarms are already set up
      chrome.alarms.get('refreshData', (alarm) => {
        if (!alarm) {
          logManager.log(`Setting up refresh alarm with interval: ${refreshInterval} minutes`);
          
          // Create alarm to periodically refresh data
          chrome.alarms.create('refreshData', {
            periodInMinutes: refreshInterval,
          });
        }
      });
    });
    
    // Listen for alarm events
    chrome.alarms.onAlarm.addListener((alarm) => {
      logManager.log(`Alarm triggered: ${alarm.name}`);
      
      if (alarm.name === 'refreshData') {
        // Do NOT auto-fetch, just update badge and notify
        this.checkForUpdates();
      }
      else if (alarm.name === 'autoScrape') {
        // Run scheduled scrape if enabled
        this.runScheduledScrape();
      }
      else if (alarm.name === 'retryIntegrations') {
        // Retry any pending integrations
        logManager.log('Retrying pending integrations');
        integrationsManager.forceRetryAll();
      }
    });
  }
  
  /**
   * Set up badge display
   */
  setupBadge() {
    this.debugLog('setupBadge called');
    chrome.action.setBadgeBackgroundColor({ color: '#4285F4' });
    
    // Update badge with opportunity count
    storageManager.getOpportunities().then(opportunities => {
      chrome.action.setBadgeText({ 
        text: opportunities.length > 0 ? opportunities.length.toString() : ''
      });
    });
  }
  
  /**
   * Set up notification listeners
   */
  setupNotificationListeners() {
    this.debugLog('setupNotificationListeners called');
    chrome.notifications.onClicked.addListener((notificationId) => {
      if (notificationId === 'refresh-available') {
        // Open the popup
        chrome.action.openPopup();
      }
      else if (notificationId.startsWith('sourcebottle-opportunity-')) {
        // Open the opportunities page
        chrome.tabs.create({ 
          url: chrome.runtime.getURL('opportunities.html') 
        });
      }
      else if (notificationId === 'sourcebottle-new-opportunities') {
        // Open the opportunities page
        chrome.tabs.create({ 
          url: chrome.runtime.getURL('opportunities.html') 
        });
      }
    });
  }
  
  /**
   * Check for updates and notify user if needed
   */
  async checkForUpdates() {
    this.debugLog('checkForUpdates called');
    logManager.log('Checking for updates (without auto-fetching)');
    
    // Update badge with opportunity count
    const opportunities = await storageManager.getOpportunities();
    chrome.action.setBadgeText({ 
      text: opportunities.length > 0 ? opportunities.length.toString() : ''
    });
    
    // Check if we should notify
    const settings = await storageManager.getSettings();
    if (settings.notifyRefresh) {
      // Show a notification that refresh is available
      chrome.notifications.create('refresh-available', {
        type: 'basic',
        iconUrl: 'icons/icon128.png',
        title: 'SourceBottle Refresh Available',
        message: `You currently have ${opportunities.length} tracked opportunities. Click to refresh.`,
        priority: 1
      });
    }
  }
  
  /**
   * Run scheduled scrape based on settings
   */
  async runScheduledScrape() {
    this.debugLog('runScheduledScrape called');
    const settings = await storageManager.getSettings();
    const schedule = settings.schedule || {};
    
    // Only run if explicitly enabled
    if (!schedule || !schedule.enabled) {
      logManager.log('Auto-scrape not enabled in settings');
      return;
    }
    
    logManager.log('Running scheduled scrape');
    
    // Get categories to scrape
    const categories = schedule.categories || ['all'];
    
    // Map category names to IDs
    const categoryMap = {
      'Technology': '70',
      'Business & Finance': '61',
      'Health & Wellbeing': '64',
      'Lifestyle, Food & Fashion': '65',
      'PR, Media & Marketing': '69',
      'Parenting & Education': '66',
      'Environment': '62',
      'Travel & Leisure': '71',
      'Professional Services': '67',
      'Property': '68',
      'General': '63'
    };
    
    // Get the first category ID (will expand this to handle multiple categories in future)
    let categoryId = '63'; // Default to General
    
    if (categories.includes('all') || categories.length === 0) {
      categoryId = '63'; // Use General for 'all'
    } else {
      // Find first valid category
      for (const category of categories) {
        if (categoryMap[category]) {
          categoryId = categoryMap[category];
          break;
        }
      }
    }
    
    // Open a tab to the category
    if (this.isInQuietHours(settings.notifications)) {
      logManager.log('In quiet hours, skipping auto-scrape');
      return;
    }
    
    logManager.log(`Auto-scraping category: ${categoryId}`);
    
    // We'll set allowTabOpen temporarily for this automated action
    this.allowTabOpen = true;
    
    // Open a tab to the category
    chrome.tabs.create({ 
      url: `https://www.sourcebottle.com/industry-list-results.asp?industry=${categoryId}`,
      active: false
    }, (tab) => {
      logManager.log(`Opened auto-scrape tab for category ${categoryId}: ${tab.id}`);
      
      // Reset the flag
      this.allowTabOpen = false;
    });
  }
  
  /**
   * Check if current time is within quiet hours
   * @param {Object} notifications - Notification settings
   * @returns {boolean} Whether current time is in quiet hours
   */
  isInQuietHours(notifications) {
    this.debugLog('isInQuietHours called', notifications);
    if (!notifications || !notifications.quietHoursStart || !notifications.quietHoursEnd) {
      return false;
    }
    
    const quietStart = notifications.quietHoursStart || '22:00';
    const quietEnd = notifications.quietHoursEnd || '07:00';
    
    const [startHours, startMinutes] = quietStart.split(':').map(Number);
    const [endHours, endMinutes] = quietEnd.split(':').map(Number);
    
    const now = new Date();
    const currentHours = now.getHours();
    const currentMinutes = now.getMinutes();
    
    // Convert all times to minutes for easier comparison
    const currentTimeInMinutes = currentHours * 60 + currentMinutes;
    const startTimeInMinutes = startHours * 60 + startMinutes;
    const endTimeInMinutes = endHours * 60 + endMinutes;
    
    // Handle case where quiet hours span midnight
    if (startTimeInMinutes > endTimeInMinutes) {
      return currentTimeInMinutes >= startTimeInMinutes || currentTimeInMinutes <= endTimeInMinutes;
    } else {
      return currentTimeInMinutes >= startTimeInMinutes && currentTimeInMinutes <= endTimeInMinutes;
    }
  }
  
  /**
   * Handle the category scrape action
   */
  async handleCategoryScrape(request, sender, sendResponse, requestId) {
    const categoryId = request.categoryId;
    if (!categoryId) {
      sendResponse({ success: false, error: 'No category ID provided' });
      return;
    }
    
    try {
      logManager.log(`Scraping category: ${categoryId}`);
      
      // Temporarily allow tab open
      this.allowTabOpen = true;
      
      // Open a tab to the category
      chrome.tabs.create({ 
        url: `https://www.sourcebottle.com/industry-list-results.asp?industry=${categoryId}`,
        active: true
      }, (tab) => {
        logManager.log(`Opened category tab: ${tab.id}`);
        
        // Reset the flag
        this.allowTabOpen = false;
        
        // Response will be sent by the content script
        this.pendingResponses.set(requestId, sendResponse);
        
        // Send a message to the tab to scrape once it's loaded
        chrome.tabs.onUpdated.addListener(function listener(tabId, changeInfo, updatedTab) {
          if (tabId === tab.id && changeInfo.status === 'complete') {
            // Remove the listener to avoid memory leaks
            chrome.tabs.onUpdated.removeListener(listener);
            
            // Send message to extract opportunities
            chrome.tabs.sendMessage(tabId, { 
              action: 'extractSourceBottleOpportunities',
              requestId: requestId
            });
          }
        });
      });
    } catch (error) {
      logManager.error('Error in message handler', { 
        action: request?.action || 'unknown',
        error: error.message,
        stack: error.stack
      });
      sendResponse({ success: false, error: error.message });
    }
  }
  
  /**
   * Handle sending data to Google Sheets
   */
  async handleGoogleSheetSend(request, sender, sendResponse, requestId) {
    try {
      if (!request.data) {
        throw new Error('No data provided in request');
      }
      
      const opportunities = request.data.opportunities || [];
      
      if (opportunities.length === 0) {
        throw new Error('No opportunities to send');
      }
      
      logManager.log(`Sending ${opportunities.length} opportunities to Google Sheets`);
      
      // Use our integrations manager to send the data
      const result = await integrationsManager.sendToGoogleSheets(opportunities);
      
      sendResponse(result);
    } catch (error) {
      logManager.error('Error in message handler', { 
        action: request?.action || 'unknown',
        error: error.message,
        stack: error.stack
      });
      sendResponse({ success: false, error: error.message });
    }
  }
  
  /**
   * Handle fetching opportunities from SourceBottle
   */
  async handleFetchOpportunities(request, sender, sendResponse, requestId) {
    this.debugLog('handleFetchOpportunities called', request, sender);
    
    // Only proceed if explicitly allowed by user action or we're in a valid context
    if (!this.allowTabOpen && !request.userInitiated) {
      logManager.warn('Tab open not allowed - user must explicitly enable');
      sendResponse({ 
        success: false, 
        error: 'Manual permission required to open tabs' 
      });
      return;
    }
    
    try {
      // Reset the flag after using it once
      this.allowTabOpen = false;
      
      // Check if we already have a SourceBottle tab open
      chrome.tabs.query({ url: '*://*.sourcebottle.com/*' }, (tabs) => {
        if (tabs.length > 0) {
          // Use the existing tab
          const tab = tabs[0];
          logManager.log(`Using existing SourceBottle tab: ${tab.id}`);
          
          // Reload the tab to get fresh data
          chrome.tabs.reload(tab.id, {}, () => {
            logManager.log(`Reloaded SourceBottle tab: ${tab.id}`);
          });
          
          sendResponse({ 
            success: true, 
            status: 'reloading', 
            message: 'Reloading SourceBottle tab' 
          });
        } else {
          // Open a new tab
          logManager.log('No SourceBottle tab found, opening new tab');
          
          chrome.tabs.create({ 
            url: 'https://www.sourcebottle.com/industry-list-results.asp?industry=All',
            active: true // Make it active so the user can see what's happening
          }, (tab) => {
            logManager.log(`Opened new SourceBottle tab: ${tab.id}`);
          });
          
          sendResponse({ 
            success: true, 
            status: 'opening', 
            message: 'Opening SourceBottle tab' 
          });
        }
      });
    } catch (error) {
      logManager.error('Error in message handler', { 
        action: request?.action || 'unknown',
        error: error.message,
        stack: error.stack
      });
      sendResponse({ success: false, error: error.message });
    }
  }
  
  /**
   * Handle scheduling auto-scrape
   */
  async handleScheduleAutoScrape(request, sender, sendResponse) {
    try {
      const schedule = request.schedule;
      
      if (!schedule) {
        sendResponse({ success: false, error: 'No schedule provided' });
        return;
      }
      
      // Store the schedule in settings
      const settings = await storageManager.getSettings();
      settings.schedule = schedule;
      await storageManager.saveSettings(settings);
      
      // Clear existing alarms
      chrome.alarms.clear('autoScrape', () => {
        if (!schedule.enabled) {
          logManager.log('Auto-scrape disabled, not creating alarm');
          sendResponse({ success: true });
          return;
        }
        
        // Parse time into hours and minutes
        const [hours, minutes] = schedule.time.split(':').map(Number);
        
        // Calculate when the next alarm should fire
        const now = new Date();
        const scheduledTime = new Date();
        scheduledTime.setHours(hours, minutes, 0, 0);
        
        // If the scheduled time is earlier today, schedule for tomorrow
        if (scheduledTime < now) {
          scheduledTime.setDate(scheduledTime.getDate() + 1);
        }
        
        // For custom days, check if the next scheduled day is valid
        if (schedule.type === 'custom' && schedule.days && schedule.days.length > 0) {
          const days = schedule.days;
          const dayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
          let daysToAdd = 0;
          let found = false;
          
          while (!found && daysToAdd < 7) {
            const futureDate = new Date(scheduledTime);
            futureDate.setDate(futureDate.getDate() + daysToAdd);
            const dayName = dayNames[futureDate.getDay()];
            
            if (days.includes(dayName)) {
              found = true;
              // Set to this valid future date
              scheduledTime.setDate(scheduledTime.getDate() + daysToAdd);
            } else {
              daysToAdd++;
            }
          }
        }
        
        // Calculate delay in minutes until the next scheduled time
        const delayInMinutes = Math.max(1, (scheduledTime - now) / (1000 * 60));
        
        // Create the alarm
        chrome.alarms.create('autoScrape', {
          delayInMinutes: delayInMinutes,
          periodInMinutes: schedule.type === 'daily' ? 24 * 60 : 7 * 24 * 60 // Daily or weekly
        });
        
        logManager.log(`Auto-scrape alarm set for ${scheduledTime.toLocaleString()}, delay: ${delayInMinutes.toFixed(2)} minutes`);
        sendResponse({ success: true });
      });
    } catch (error) {
      logManager.error('Error in message handler', { 
        action: request?.action || 'unknown',
        error: error.message,
        stack: error.stack
      });
      sendResponse({ success: false, error: error.message });
    }
  }
  
  /**
   * Handle exporting opportunities to CSV
   */
  handleExportToCSV(request, sender, sendResponse) {
    try {
      const opportunities = request.opportunities;
      
      if (!opportunities || opportunities.length === 0) {
        sendResponse({ success: false, error: 'No opportunities to export' });
        return;
      }
      
      logManager.log(`Exporting ${opportunities.length} opportunities to CSV`);
      
      // We'll handle this in the popup/UI side now, using our integrations manager
      sendResponse({ success: true, message: 'Export handled by UI' });
    } catch (error) {
      logManager.error('Error in message handler', { 
        action: request?.action || 'unknown',
        error: error.message,
        stack: error.stack
      });
      sendResponse({ success: false, error: error.message });
    }
  }
  
  /**
   * Handle opportunities extracted from SourceBottle
   */
  async handleOpportunitiesExtracted(request, sender, sendResponse) {
    this.debugLog('handleOpportunitiesExtracted called', request, sender);
    try {
      const opportunities = request.opportunities;
      
      if (!opportunities || opportunities.length === 0) {
        sendResponse({ success: false, error: 'No opportunities extracted' });
        return;
      }
      
      logManager.log(`Received ${opportunities.length} extracted opportunities`);
      
      // Save the opportunities to storage
      const updatedOpportunities = await storageManager.saveOpportunities(opportunities);
      
      // Update badge with count and set color
      chrome.action.setBadgeText({ 
        text: updatedOpportunities.length > 0 ? updatedOpportunities.length.toString() : ''
      });
      chrome.action.setBadgeBackgroundColor({ color: '#4CAF50' }); // Green color
      
      // Play notification sound by sending message to the opportunities page
      chrome.runtime.sendMessage({
        action: 'playNotificationSound',
        count: opportunities.length,
        total: updatedOpportunities.length
      });
      
      // Show notification about new opportunities
      chrome.notifications.create('sourcebottle-new-opportunities', {
        type: 'basic',
        iconUrl: 'icons/icon128.png',
        title: 'Scraping Complete',
        message: `Found ${opportunities.length} new opportunities (${updatedOpportunities.length} total). Click to view.`,
        priority: 2,
        requireInteraction: true  // Keep notification visible until user interacts with it
      });
      
      // If this was triggered by a tab opening, also open the popup
      if (request.count) {
        // We can't open the popup directly, but we can highlight the extension icon
        chrome.action.setIcon({
          path: {
            "16": "icons/icon16.png",
            "32": "icons/icon32.png",
            "48": "icons/icon48.png",
            "128": "icons/icon128.png"
          }
        });
        
        // Reset the icon after 10 seconds
        setTimeout(() => {
          chrome.action.setIcon({
            path: {
              "16": "icons/icon16.png",
              "32": "icons/icon32.png",
              "48": "icons/icon48.png",
              "128": "icons/icon128.png"
            }
          });
        }, 10000);
      }
      
      sendResponse({ 
        success: true, 
        count: opportunities.length,
        total: updatedOpportunities.length
      });
    } catch (error) {
      logManager.error('Error in message handler', { 
        action: request?.action || 'unknown',
        error: error.message,
        stack: error.stack
      });
      sendResponse({ success: false, error: error.message });
    }
  }
  
  /**
   * Handle extracting from all SourceBottle tabs
   */
  async handleExtractFromTabs(request, sender, sendResponse) {
    this.debugLog('handleExtractFromTabs called', request, sender);
    try {
      // Find all tabs that are SourceBottle
      chrome.tabs.query({ url: '*://www.sourcebottle.com/*' }, (tabs) => {
        if (tabs.length === 0) {
          logManager.log('No SourceBottle tabs found');
          sendResponse({ status: 'no_tabs' });
          return;
        }
        
        logManager.log(`Found ${tabs.length} SourceBottle tabs, sending extract message to each`);
        
        // Send extract message to each SourceBottle tab
        tabs.forEach(tab => {
          chrome.tabs.sendMessage(tab.id, {
            action: 'extractSourceBottleOpportunities'
          }, response => {
            if (chrome.runtime.lastError) {
              logManager.error(`Error sending message to tab ${tab.id}:`, chrome.runtime.lastError);
            } else {
              logManager.log(`Extract message sent to tab ${tab.id}:`, response);
            }
          });
        });
        
        sendResponse({ status: 'extracting', tabCount: tabs.length });
      });
    } catch (error) {
      logManager.error('Error in message handler', { 
        action: request?.action || 'unknown',
        error: error.message,
        stack: error.stack
      });
      sendResponse({ success: false, error: error.message });
    }
  }
  
  /**
   * Log a debug message
   * @param {string} msg - Message to log
   * @param {...any} args - Additional data to log
   */
  debugLog(msg, ...args) {
    try {
      if (logManager) {
        logManager.debug(`[BG] ${msg}`, args.length ? args : undefined);
      } else {
        console.debug(`[BG] ${msg}`, ...args);
      }
    } catch (e) {
      console.error('Error in debugLog:', e);
    }
  }
}

// Initialize the background controller
const backgroundController = new BackgroundController();

// Export for testing
export default backgroundController;
