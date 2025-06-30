/**
 * Unit tests for BackgroundService module
 */

// Import or recreate the module for testing
const backgroundServiceModule = `
  // Import dependencies
  import { logManager } from './logger.js';
  import { storageManager } from './storage.js';

  export const BackgroundService = class {
    constructor() {
      this.initialized = false;
      this.settings = {
        refreshInterval: 60, // Default refresh interval in minutes
        autoScrape: false
      };
    }
    
    // Initialize the background service
    async initialize() {
      try {
        if (this.initialized) return true;
        
        logManager.log('Initializing background service');
        
        // Load settings
        const savedSettings = await storageManager.getSettings();
        if (savedSettings) {
          this.settings = { ...this.settings, ...savedSettings };
        }
        
        // Set up message listeners
        this.setupMessageListeners();
        
        // Set up alarms
        this.setupAlarms();
        
        this.initialized = true;
        logManager.log('Background service initialized successfully');
        
        return true;
      } catch (error) {
        logManager.error('Error initializing background service:', error);
        return false;
      }
    }
    
    // Set up Chrome runtime message listeners
    setupMessageListeners() {
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        logManager.log('Background received message:', message);
        
        // Process different types of messages
        if (message.action === 'getOpportunities') {
          this.handleGetOpportunities(sendResponse);
          return true;
        } 
        else if (message.action === 'scrapeSourceBottle') {
          this.handleScrapeSourceBottle(message, sendResponse);
          return true;
        }
        else if (message.action === 'sendToGoogleSheet') {
          this.handleSendToGoogleSheet(message, sendResponse);
          return true;
        }
        else if (message.action === 'updateSettings') {
          this.handleUpdateSettings(message, sendResponse);
          return true;
        }
        
        // Default response for unknown actions
        sendResponse({ success: false, error: 'Unknown action' });
        return false;
      });
    }
    
    // Set up Chrome alarms for periodic tasks
    setupAlarms() {
      // Clear existing alarms
      chrome.alarms.clearAll();
      
      // Set up refresh alarm if enabled
      if (this.settings.refreshInterval > 0) {
        chrome.alarms.create('refreshData', {
          periodInMinutes: this.settings.refreshInterval
        });
        
        logManager.log(\`Set up refresh alarm with interval \${this.settings.refreshInterval} minutes\`);
      }
      
      // Set up auto-scrape alarm if enabled
      if (this.settings.autoScrape) {
        this.setupAutoScrapeAlarm();
      }
      
      // Listen for alarm events
      chrome.alarms.onAlarm.addListener((alarm) => {
        logManager.log(\`Alarm triggered: \${alarm.name}\`);
        
        if (alarm.name === 'refreshData') {
          this.handleDataRefresh();
        } 
        else if (alarm.name === 'autoScrape') {
          this.handleAutoScrape();
        }
      });
    }
    
    // Handle data refresh alarm
    async handleDataRefresh() {
      try {
        logManager.log('Handling data refresh');
        
        // This is just a placeholder - we don't want to auto-open tabs
        // We'll just update the badge with current count
        const opportunities = await storageManager.getOpportunities();
        this.updateBadge(opportunities.length);
        
        // Check if we need to send a notification
        const lastUpdated = await storageManager.getLastUpdated();
        if (lastUpdated) {
          const lastUpdateTime = new Date(lastUpdated).getTime();
          const now = Date.now();
          const daysSinceUpdate = (now - lastUpdateTime) / (1000 * 60 * 60 * 24);
          
          // If it's been more than 3 days, send a reminder notification
          if (daysSinceUpdate > 3) {
            this.showNotification(
              'SourceBottle Reminder',
              'It has been 3+ days since your last update. Click to check for new opportunities.'
            );
          }
        }
        
        return true;
      } catch (error) {
        logManager.error('Error in data refresh:', error);
        return false;
      }
    }
    
    // Set up auto-scrape alarm based on schedule
    setupAutoScrapeAlarm() {
      if (!this.settings.autoScrapeSchedule) return;
      
      const schedule = this.settings.autoScrapeSchedule;
      
      if (schedule.type === 'daily') {
        // For daily schedule, set up an alarm for the specified time each day
        const now = new Date();
        const scheduledTime = new Date();
        
        // Parse time (e.g., "09:00")
        const [hours, minutes] = schedule.time.split(':').map(part => parseInt(part, 10));
        scheduledTime.setHours(hours, minutes, 0, 0);
        
        // If the time has already passed today, schedule for tomorrow
        if (scheduledTime < now) {
          scheduledTime.setDate(scheduledTime.getDate() + 1);
        }
        
        // Calculate minutes until the scheduled time
        const delayInMinutes = (scheduledTime.getTime() - now.getTime()) / (1000 * 60);
        
        chrome.alarms.create('autoScrape', {
          delayInMinutes,
          periodInMinutes: 24 * 60 // Repeat every 24 hours
        });
        
        logManager.log(\`Set up daily auto-scrape alarm for \${schedule.time}\`);
      } 
      else if (schedule.type === 'weekly') {
        // For weekly schedule, set up an alarm for the specified day and time
        const now = new Date();
        const scheduledTime = new Date();
        
        // Parse time (e.g., "09:00")
        const [hours, minutes] = schedule.time.split(':').map(part => parseInt(part, 10));
        scheduledTime.setHours(hours, minutes, 0, 0);
        
        // Schedule for the next occurrence of the specified day (0 = Sunday, 6 = Saturday)
        const targetDay = schedule.day;
        const currentDay = scheduledTime.getDay();
        
        if (currentDay === targetDay) {
          // If it's the target day but the time has passed, schedule for next week
          if (scheduledTime < now) {
            scheduledTime.setDate(scheduledTime.getDate() + 7);
          }
        } else {
          // Calculate days until the target day
          const daysUntilTarget = (targetDay - currentDay + 7) % 7;
          scheduledTime.setDate(scheduledTime.getDate() + daysUntilTarget);
        }
        
        // Calculate minutes until the scheduled time
        const delayInMinutes = (scheduledTime.getTime() - now.getTime()) / (1000 * 60);
        
        chrome.alarms.create('autoScrape', {
          delayInMinutes,
          periodInMinutes: 7 * 24 * 60 // Repeat every 7 days
        });
        
        logManager.log(\`Set up weekly auto-scrape alarm for \${schedule.day} at \${schedule.time}\`);
      }
    }
    
    // Handle auto-scrape alarm
    async handleAutoScrape() {
      try {
        logManager.log('Handling auto-scrape alarm');
        
        // Open SourceBottle tab for scraping
        const tab = await this.openSourceBottleTab();
        
        if (tab) {
          logManager.log(\`Opened SourceBottle tab for auto-scrape: \${tab.id}\`);
          
          // The content script will handle the scraping once the tab loads
          this.showNotification(
            'SourceBottle Auto-Scrape',
            'Auto-scrape has been triggered. Check the opened tab for results.'
          );
        } else {
          logManager.error('Failed to open SourceBottle tab for auto-scrape');
        }
        
        return true;
      } catch (error) {
        logManager.error('Error in auto-scrape:', error);
        return false;
      }
    }
    
    // Handle get opportunities message
    async handleGetOpportunities(sendResponse) {
      try {
        const opportunities = await storageManager.getOpportunities();
        sendResponse({ 
          success: true, 
          opportunities,
          count: opportunities.length
        });
      } catch (error) {
        logManager.error('Error getting opportunities:', error);
        sendResponse({ success: false, error: error.message });
      }
    }
    
    // Handle scrape SourceBottle message
    async handleScrapeSourceBottle(message, sendResponse) {
      try {
        // Open a SourceBottle tab for scraping
        const tab = await this.openSourceBottleTab();
        
        if (tab) {
          logManager.log(\`Opened SourceBottle tab for scraping: \${tab.id}\`);
          sendResponse({ success: true, tabId: tab.id });
        } else {
          sendResponse({ success: false, error: 'Failed to open SourceBottle tab' });
        }
      } catch (error) {
        logManager.error('Error handling scrape SourceBottle:', error);
        sendResponse({ success: false, error: error.message });
      }
    }
    
    // Handle send to Google Sheet message
    async handleSendToGoogleSheet(message, sendResponse) {
      try {
        if (!message.data || !message.data.opportunities) {
          throw new Error('No data provided in request');
        }
        
        const opportunities = message.data.opportunities;
        logManager.log(\`Sending \${opportunities.length} opportunities to Google Sheet\`);
        
        // Get the web app URL from settings
        const settings = await storageManager.getSettings();
        const webAppUrl = settings.googleSheetsWebAppUrl || 
                        'https://script.google.com/a/macros/qubit.capital/s/AKfycbxlje612pVpLl9ttLHqRegEEsk1vf6_UFfFZ_oMazrUjt2d_Jel96fwDNj-zHef6i8/exec';
        
        // Send data to Google Sheets web app
        const response = await fetch(webAppUrl, {
          method: 'POST',
          body: JSON.stringify({
            opportunities: opportunities
          }),
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        const result = await response.text();
        logManager.log('Google Sheets response:', result);
        
        let responseData;
        try {
          responseData = JSON.parse(result);
        } catch (e) {
          responseData = { message: result };
        }
        
        sendResponse({ success: true, data: responseData });
      } catch (error) {
        logManager.error('Error handling send to Google Sheet:', error);
        sendResponse({ success: false, error: error.message });
      }
    }
    
    // Handle update settings message
    async handleUpdateSettings(message, sendResponse) {
      try {
        if (!message.settings) {
          throw new Error('No settings provided in request');
        }
        
        // Update settings in storage
        await storageManager.saveSettings(message.settings);
        
        // Update local settings
        this.settings = { ...this.settings, ...message.settings };
        
        // Update alarms if refresh interval changed
        if (message.settings.refreshInterval !== undefined) {
          this.setupAlarms();
        }
        
        // Update auto-scrape alarm if schedule changed
        if (message.settings.autoScrape !== undefined || message.settings.autoScrapeSchedule !== undefined) {
          this.setupAutoScrapeAlarm();
        }
        
        logManager.log('Settings updated successfully');
        sendResponse({ success: true });
      } catch (error) {
        logManager.error('Error updating settings:', error);
        sendResponse({ success: false, error: error.message });
      }
    }
    
    // Open a SourceBottle tab for scraping
    async openSourceBottleTab() {
      return new Promise((resolve) => {
        // Check if a SourceBottle tab is already open
        chrome.tabs.query({ url: '*://www.sourcebottle.com/industry-list-results.asp*' }, (tabs) => {
          if (tabs.length > 0) {
            // Use existing tab
            const tab = tabs[0];
            chrome.tabs.update(tab.id, { active: true }, () => {
              resolve(tab);
            });
          } else {
            // Create new tab
            chrome.tabs.create({
              url: 'https://www.sourcebottle.com/industry-list-results.asp?industry=All',
              active: true
            }, (tab) => {
              resolve(tab);
            });
          }
        });
      });
    }
    
    // Update extension badge with count
    updateBadge(count) {
      chrome.action.setBadgeText({ text: count.toString() });
      chrome.action.setBadgeBackgroundColor({ color: '#4285F4' });
    }
    
    // Show a notification
    showNotification(title, message) {
      if (chrome.notifications) {
        chrome.notifications.create({
          type: 'basic',
          iconUrl: chrome.runtime.getURL('icons/icon128.png'),
          title: title,
          message: message
        });
      }
    }
    
    // Handle tab updates for content script initialization
    handleTabUpdates() {
      chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
        // Check if this is a SourceBottle page and it's completely loaded
        if (tab.url && tab.url.includes('sourcebottle.com') && changeInfo.status === 'complete') {
          logManager.log(\`SourceBottle page loaded in tab \${tabId}\`);
          
          // Message the content script to start processing if needed
          chrome.tabs.sendMessage(tabId, { action: 'checkPageReady' }, (response) => {
            if (chrome.runtime.lastError) {
              // Content script might not be ready yet, which is normal
              logManager.debug('Content script not ready yet:', chrome.runtime.lastError);
            } else if (response) {
              logManager.log('Content script ready:', response);
            }
          });
        }
      });
    }
  };
  
  // Create a singleton instance
  export const backgroundService = new BackgroundService();
`;

// Mock dependencies
const loggerModuleMock = `
  export const logManager = {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  };
`;

const storageModuleMock = `
  export const storageManager = {
    getSettings: jest.fn(),
    saveSettings: jest.fn(),
    getOpportunities: jest.fn(),
    getLastUpdated: jest.fn()
  };
`;

// Create modules in memory
const loggerModuleURL = 'blob:' + URL.createObjectURL(new Blob([loggerModuleMock], { type: 'application/javascript' }));
const storageModuleURL = 'blob:' + URL.createObjectURL(new Blob([storageModuleMock], { type: 'application/javascript' }));
const moduleURL = 'blob:' + URL.createObjectURL(new Blob([backgroundServiceModule], { type: 'application/javascript' }));

// Mock imports
jest.mock('./logger.js', () => import(loggerModuleURL), { virtual: true });
jest.mock('./storage.js', () => import(storageModuleURL), { virtual: true });

describe('Background Service Module', () => {
  let backgroundService;
  let logManager;
  let storageManager;
  let originalFetch;

  beforeAll(async () => {
    // Import the dependencies
    const loggerModule = await import('./logger.js');
    logManager = loggerModule.logManager;
    
    const storageModule = await import('./storage.js');
    storageManager = storageModule.storageManager;
    
    // Import the test module
    const module = await import(moduleURL);
    backgroundService = module.backgroundService;
    
    // Save original fetch
    originalFetch = global.fetch;
  });

  afterAll(() => {
    // Restore original fetch
    global.fetch = originalFetch;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset service state
    backgroundService.initialized = false;
    backgroundService.settings = {
      refreshInterval: 60,
      autoScrape: false
    };
    
    // Mock chrome APIs
    chrome.runtime.onMessage = {
      addListener: jest.fn()
    };
    
    chrome.alarms = {
      create: jest.fn(),
      clearAll: jest.fn(),
      onAlarm: {
        addListener: jest.fn()
      }
    };
    
    chrome.tabs = {
      query: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      onUpdated: {
        addListener: jest.fn()
      },
      sendMessage: jest.fn()
    };
    
    chrome.action = {
      setBadgeText: jest.fn(),
      setBadgeBackgroundColor: jest.fn()
    };
    
    chrome.notifications = {
      create: jest.fn()
    };
    
    chrome.runtime.getURL = jest.fn(() => 'chrome://extension/icon.png');
    
    // Setup default storage mocks
    storageManager.getSettings.mockResolvedValue({
      refreshInterval: 120,
      notifyNew: true
    });
    
    storageManager.getOpportunities.mockResolvedValue([
      { id: 1, title: 'Test 1' },
      { id: 2, title: 'Test 2' }
    ]);
    
    // Mock fetch
    global.fetch = jest.fn();
  });

  test('initialize should load settings and set up listeners', async () => {
    // Act
    const result = await backgroundService.initialize();
    
    // Assert
    expect(result).toBe(true);
    expect(backgroundService.initialized).toBe(true);
    expect(backgroundService.settings.refreshInterval).toBe(120);
    expect(chrome.runtime.onMessage.addListener).toHaveBeenCalled();
    expect(chrome.alarms.clearAll).toHaveBeenCalled();
    expect(chrome.alarms.create).toHaveBeenCalledWith('refreshData', {
      periodInMinutes: 120
    });
    expect(chrome.alarms.onAlarm.addListener).toHaveBeenCalled();
  });

  test('setupAlarms should create the refresh alarm with correct interval', async () => {
    // Arrange
    backgroundService.settings.refreshInterval = 240;
    
    // Act
    backgroundService.setupAlarms();
    
    // Assert
    expect(chrome.alarms.clearAll).toHaveBeenCalled();
    expect(chrome.alarms.create).toHaveBeenCalledWith('refreshData', {
      periodInMinutes: 240
    });
  });

  test('handleDataRefresh should update badge and check for notification', async () => {
    // Arrange
    const mockOpportunities = [{ id: 1 }, { id: 2 }, { id: 3 }];
    storageManager.getOpportunities.mockResolvedValue(mockOpportunities);
    
    const fourDaysAgo = new Date();
    fourDaysAgo.setDate(fourDaysAgo.getDate() - 4);
    storageManager.getLastUpdated.mockResolvedValue(fourDaysAgo.toISOString());
    
    // Act
    await backgroundService.handleDataRefresh();
    
    // Assert
    expect(chrome.action.setBadgeText).toHaveBeenCalledWith({ text: '3' });
    expect(chrome.notifications.create).toHaveBeenCalledWith(expect.objectContaining({
      title: 'SourceBottle Reminder',
      message: expect.stringContaining('3+ days')
    }));
  });

  test('handleGetOpportunities should return opportunities from storage', async () => {
    // Arrange
    const mockSendResponse = jest.fn();
    const mockOpportunities = [{ id: 1 }, { id: 2 }];
    storageManager.getOpportunities.mockResolvedValue(mockOpportunities);
    
    // Act
    await backgroundService.handleGetOpportunities(mockSendResponse);
    
    // Assert
    expect(mockSendResponse).toHaveBeenCalledWith({
      success: true,
      opportunities: mockOpportunities,
      count: 2
    });
  });

  test('handleScrapeSourceBottle should open a tab', async () => {
    // Arrange
    const mockSendResponse = jest.fn();
    const mockTab = { id: 123 };
    
    // No existing tabs
    chrome.tabs.query.mockImplementation((query, callback) => {
      callback([]);
    });
    
    // Create new tab
    chrome.tabs.create.mockImplementation((options, callback) => {
      callback(mockTab);
    });
    
    // Act
    await backgroundService.handleScrapeSourceBottle({}, mockSendResponse);
    
    // Assert
    expect(chrome.tabs.create).toHaveBeenCalledWith(
      expect.objectContaining({
        url: expect.stringContaining('sourcebottle.com'),
        active: true
      }),
      expect.any(Function)
    );
    expect(mockSendResponse).toHaveBeenCalledWith({
      success: true,
      tabId: 123
    });
  });

  test('handleSendToGoogleSheet should send data to web app', async () => {
    // Arrange
    const mockSendResponse = jest.fn();
    const mockMessage = {
      data: {
        opportunities: [
          { title: 'Test 1' },
          { title: 'Test 2' }
        ]
      }
    };
    
    // Mock successful fetch response
    global.fetch.mockResolvedValue({
      text: jest.fn().mockResolvedValue('{"success":true}')
    });
    
    // Act
    await backgroundService.handleSendToGoogleSheet(mockMessage, mockSendResponse);
    
    // Assert
    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('opportunities'),
        headers: expect.objectContaining({
          'Content-Type': 'application/json'
        })
      })
    );
    expect(mockSendResponse).toHaveBeenCalledWith({
      success: true,
      data: { success: true }
    });
  });

  test('handleUpdateSettings should update settings and alarms', async () => {
    // Arrange
    const mockSendResponse = jest.fn();
    const mockMessage = {
      settings: {
        refreshInterval: 180,
        notifyNew: false
      }
    };
    
    // Act
    await backgroundService.handleUpdateSettings(mockMessage, mockSendResponse);
    
    // Assert
    expect(storageManager.saveSettings).toHaveBeenCalledWith(mockMessage.settings);
    expect(backgroundService.settings.refreshInterval).toBe(180);
    expect(backgroundService.settings.notifyNew).toBe(false);
    expect(chrome.alarms.create).toHaveBeenCalledWith('refreshData', {
      periodInMinutes: 180
    });
    expect(mockSendResponse).toHaveBeenCalledWith({ success: true });
  });

  test('openSourceBottleTab should use existing tab if available', async () => {
    // Arrange
    const mockExistingTab = { id: 456 };
    
    // Mock existing tab
    chrome.tabs.query.mockImplementation((query, callback) => {
      callback([mockExistingTab]);
    });
    
    chrome.tabs.update.mockImplementation((tabId, options, callback) => {
      callback(mockExistingTab);
    });
    
    // Act
    const result = await backgroundService.openSourceBottleTab();
    
    // Assert
    expect(result).toBe(mockExistingTab);
    expect(chrome.tabs.update).toHaveBeenCalledWith(
      456,
      { active: true },
      expect.any(Function)
    );
    expect(chrome.tabs.create).not.toHaveBeenCalled();
  });

  test('showNotification should create a notification', () => {
    // Act
    backgroundService.showNotification('Test Title', 'Test Message');
    
    // Assert
    expect(chrome.notifications.create).toHaveBeenCalledWith({
      type: 'basic',
      iconUrl: expect.any(String),
      title: 'Test Title',
      message: 'Test Message'
    });
  });
});
