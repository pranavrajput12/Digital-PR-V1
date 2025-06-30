/**
 * Unit tests for StorageManager module
 */

// Import or recreate the module for testing
const storageModule = `
  export const storageManager = {
    // Methods to test
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
    },
    
    saveSettings: async function(settings) {
      return new Promise((resolve) => {
        chrome.storage.local.set({ 'settings': settings }, function() {
          resolve({ success: true });
        });
      });
    },
    
    saveUIPreference: async function(key, value) {
      return new Promise((resolve) => {
        chrome.storage.local.get(['settings'], function(result) {
          const settings = result.settings || {};
          if (!settings.ui) settings.ui = {};
          
          settings.ui[key] = value;
          
          chrome.storage.local.set({ 'settings': settings }, function() {
            resolve({ success: true });
          });
        });
      });
    },
    
    getUISettings: async function() {
      return new Promise((resolve) => {
        chrome.storage.local.get(['settings'], function(result) {
          const settings = result.settings || {};
          resolve(settings.ui || {});
        });
      });
    }
  };
`;

// Create module in memory
const moduleURL = 'blob:' + URL.createObjectURL(new Blob([storageModule], { type: 'application/javascript' }));
let storageManager;

describe('Storage Manager Module', () => {
  beforeAll(async () => {
    const module = await import(moduleURL);
    storageManager = module.storageManager;
  });

  beforeEach(() => {
    // Reset the mock storage before each test
    extension.reset();
    jest.clearAllMocks();
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

  test('saveSettings and getSettings should work correctly', async () => {
    // Arrange
    const testSettings = {
      refreshInterval: 30,
      notifyNew: true,
      keywordFilters: ['test', 'marketing']
    };
    
    // Act
    await storageManager.saveSettings(testSettings);
    const savedSettings = await storageManager.getSettings();
    
    // Assert
    expect(savedSettings).toEqual(testSettings);
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
  
  test('saveUIPreference should update just the specified UI preference', async () => {
    // Arrange
    const initialSettings = {
      refreshInterval: 60,
      ui: {
        darkMode: false,
        defaultView: 'grid'
      }
    };
    await storageManager.saveSettings(initialSettings);
    
    // Act
    await storageManager.saveUIPreference('darkMode', true);
    const settings = await storageManager.getSettings();
    
    // Assert
    expect(settings.ui.darkMode).toBe(true);
    expect(settings.ui.defaultView).toBe('grid');
    expect(settings.refreshInterval).toBe(60); // Other settings untouched
  });
  
  test('getUISettings should return empty object when no UI settings exist', async () => {
    // Act
    const uiSettings = await storageManager.getUISettings();
    
    // Assert
    expect(uiSettings).toEqual({});
  });
});
