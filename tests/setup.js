// Jest setup file for Chrome extension testing
const chrome = require('jest-chrome');

// Initialize chrome.storage if not present
if (!chrome.storage) {
  chrome.storage = {
    local: {
      get: jest.fn(),
      set: jest.fn()
    }
  };
}

// Mock chrome.storage
const storageData = {};
chrome.storage.local.get.mockImplementation((keys, callback) => {
  let result = {};
  if (Array.isArray(keys)) {
    keys.forEach(key => {
      if (storageData[key]) {
        result[key] = storageData[key];
      }
    });
  } else if (typeof keys === 'object') {
    // Get all requested keys
    Object.keys(keys).forEach(key => {
      result[key] = storageData[key] || keys[key]; // Use default if not in storage
    });
  } else if (typeof keys === 'string') {
    if (storageData[keys]) {
      result[keys] = storageData[keys];
    }
  } else {
    // If no keys specified, return all data
    result = { ...storageData };
  }
  callback(result);
  return true;
});

chrome.storage.local.set.mockImplementation((items, callback) => {
  Object.keys(items).forEach(key => {
    storageData[key] = items[key];
  });
  if (callback) callback();
  return true;
});

// Mock chrome.runtime
if (!chrome.runtime) {
  chrome.runtime = {
    getURL: jest.fn(),
    sendMessage: jest.fn(),
    onMessage: {
      addListener: jest.fn()
    }
  };
}

chrome.runtime.getURL.mockImplementation(path => `chrome-extension://mockExtensionId/${path}`);
chrome.runtime.sendMessage.mockImplementation((message, callback) => {
  if (callback) callback({ success: true, mockResponse: true });
  return true;
});

// Mock chrome.tabs
if (!chrome.tabs) {
  chrome.tabs = {
    query: jest.fn(),
    update: jest.fn(),
    create: jest.fn(),
    onUpdated: {
      addListener: jest.fn()
    }
  };
}

chrome.tabs.query.mockImplementation((query, callback) => {
  callback([]);
  return true;
});

// Mock chrome.action
if (!chrome.action) {
  chrome.action = {
    setBadgeText: jest.fn(),
    setBadgeBackgroundColor: jest.fn()
  };
}

// Mock chrome.alarms
if (!chrome.alarms) {
  chrome.alarms = {
    create: jest.fn(),
    get: jest.fn(),
    clearAll: jest.fn(),
    onAlarm: {
      addListener: jest.fn()
    }
  };
}

// Mock chrome.notifications
if (!chrome.notifications) {
  chrome.notifications = {
    create: jest.fn()
  };
}

// Global extension object for testing
global.extension = {
  reset: () => {
    // Clear storage data
    Object.keys(storageData).forEach(key => delete storageData[key]);
  }
};

// Add chrome to global
global.chrome = chrome;
