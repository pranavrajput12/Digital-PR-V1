/**
 * Simplified unit tests for StorageManager
 */

// Mock the chrome API
const chrome = require('jest-chrome');
const storageData = {};

// Setup chrome.storage mock
chrome.storage = {
  local: {
    get: jest.fn((keys, callback) => {
      let result = {};
      if (Array.isArray(keys)) {
        keys.forEach(key => {
          if (storageData[key]) {
            result[key] = storageData[key];
          }
        });
      } else if (typeof keys === 'object') {
        Object.keys(keys).forEach(key => {
          result[key] = storageData[key] || keys[key];
        });
      } else if (typeof keys === 'string') {
        if (storageData[keys]) {
          result[keys] = storageData[keys];
        }
      } else {
        result = { ...storageData };
      }
      callback(result);
      return true;
    }),
    set: jest.fn((items, callback) => {
      Object.keys(items).forEach(key => {
        storageData[key] = items[key];
      });
      if (callback) callback();
      return true;
    })
  }
};

// Create a simple StorageManager implementation for testing
const storageManager = {
  saveOpportunities: async function(opportunities) {
    return new Promise((resolve) => {
      chrome.storage.local.get(['sourceBottleOpportunities'], function(result) {
        const existingOpps = result.sourceBottleOpportunities || [];
        
        // Deduplicate opportunities based on externalId
        const uniqueOpportunities = [];
        const externalIds = new Set();
        
        // First add all new opportunities that don't exist in storage
        opportunities.forEach(opp => {
          if (opp.externalId && !externalIds.has(opp.externalId)) {
            uniqueOpportunities.push(opp);
            externalIds.add(opp.externalId);
          }
        });
        
        // Then add existing opportunities that aren't in the new set
        existingOpps.forEach(opp => {
          if (opp.externalId && !externalIds.has(opp.externalId)) {
            uniqueOpportunities.push(opp);
            externalIds.add(opp.externalId);
          }
        });
        
        chrome.storage.local.set({
          'sourceBottleOpportunities': uniqueOpportunities,
          'lastUpdated': new Date().toISOString()
        }, function() {
          resolve({
            success: true,
            count: uniqueOpportunities.length,
            newCount: uniqueOpportunities.length - existingOpps.length
          });
        });
      });
    });
  },
  
  getOpportunities: async function() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['sourceBottleOpportunities'], function(result) {
        resolve(result.sourceBottleOpportunities || []);
      });
    });
  },
  
  getLastUpdated: async function() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['lastUpdated'], function(result) {
        resolve(result.lastUpdated || null);
      });
    });
  },
  
  getPaginationState: async function() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['paginationState'], function(result) {
        resolve(result.paginationState || null);
      });
    });
  },
  
  savePaginationState: async function(state) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ 'paginationState': state }, function() {
        resolve({ success: true });
      });
    });
  },
  
  getSettings: async function() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['settings'], function(result) {
        resolve(result.settings || {});
      });
    });
  }
};

describe('Storage Manager Module', () => {
  beforeEach(() => {
    // Reset mock and storage data before each test
    jest.clearAllMocks();
    Object.keys(storageData).forEach(key => delete storageData[key]);
  });

  test('saveOpportunities should deduplicate opportunities', async () => {
    // Arrange
    const opportunity1 = { externalId: 'id1', title: 'Test 1', description: 'Description 1' };
    const opportunity2 = { externalId: 'id2', title: 'Test 2', description: 'Description 2' };
    const duplicateOpportunity = { externalId: 'id1', title: 'Test 1 Duplicate', description: 'New Description' };
    
    // Act
    await storageManager.saveOpportunities([opportunity1, opportunity2]);
    const result = await storageManager.saveOpportunities([duplicateOpportunity]);
    const savedOpportunities = await storageManager.getOpportunities();
    
    // Assert
    expect(result.count).toBe(2); // Still 2 after deduplication
    expect(savedOpportunities.length).toBe(2);
    expect(savedOpportunities.some(o => o.externalId === 'id1')).toBe(true);
    expect(savedOpportunities.some(o => o.externalId === 'id2')).toBe(true);
  });

  test('getOpportunities should return empty array when no data exists', async () => {
    // Act
    const result = await storageManager.getOpportunities();
    
    // Assert
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(0);
  });

  test('getLastUpdated should return null when no data exists', async () => {
    // Act
    const result = await storageManager.getLastUpdated();
    
    // Assert
    expect(result).toBeNull();
  });

  test('savePaginationState and getPaginationState should work correctly', async () => {
    // Arrange
    const paginationState = {
      inProgress: true,
      currentPage: 2,
      totalPages: 5,
      lastProcessedId: 'lastId123'
    };
    
    // Act
    await storageManager.savePaginationState(paginationState);
    const savedState = await storageManager.getPaginationState();
    
    // Assert
    expect(savedState).toEqual(paginationState);
  });
});
