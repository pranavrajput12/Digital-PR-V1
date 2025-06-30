/**
 * Unit tests for the ID standardization in StorageManager
 */

import { storageManager } from '../../modules/storage.js';

describe('StorageManager ID Standardization', () => {
  // Mock chrome.storage.local
  global.chrome = {
    storage: {
      local: {
        get: jest.fn(),
        set: jest.fn(),
        remove: jest.fn()
      }
    }
  };

  beforeEach(() => {
    // Reset mocks
    chrome.storage.local.get.mockReset();
    chrome.storage.local.set.mockReset();
    chrome.storage.local.remove.mockReset();
  });

  test('_normalizeOpportunityIds should ensure both id and externalId exist', () => {
    // Test with only id
    const withIdOnly = { id: '123', title: 'Test Opportunity' };
    const normalizedWithId = storageManager._normalizeOpportunityIds(withIdOnly);
    expect(normalizedWithId.id).toBe('123');
    expect(normalizedWithId.externalId).toBe('123');
    
    // Test with only externalId
    const withExternalIdOnly = { externalId: '456', title: 'Another Test' };
    const normalizedWithExternalId = storageManager._normalizeOpportunityIds(withExternalIdOnly);
    expect(normalizedWithExternalId.id).toBe('456');
    expect(normalizedWithExternalId.externalId).toBe('456');
    
    // Test with both ids
    const withBothIds = { id: '789', externalId: '789', title: 'Both IDs' };
    const normalizedWithBoth = storageManager._normalizeOpportunityIds(withBothIds);
    expect(normalizedWithBoth.id).toBe('789');
    expect(normalizedWithBoth.externalId).toBe('789');
  });

  test('_getOpportunityUniqueId should return the correct unique identifier', () => {
    // Test with id
    expect(storageManager._getOpportunityUniqueId({ id: '123' })).toBe('123');
    
    // Test with externalId only
    expect(storageManager._getOpportunityUniqueId({ externalId: '456' })).toBe('456');
    
    // Test with both ids
    expect(storageManager._getOpportunityUniqueId({ id: '789', externalId: '789' })).toBe('789');
    
    // Test with no id (should generate one)
    const generatedId = storageManager._getOpportunityUniqueId({ title: 'No ID' });
    expect(generatedId).toContain('generated-');
  });

  test('saveOpportunities should handle different ID formats correctly', async () => {
    // Setup mock storage with existing opportunities
    const existingOpportunities = [
      { id: '1', externalId: '1', title: 'Existing 1' },
      { id: '2', externalId: '2', title: 'Existing 2' },
      { externalId: '3', title: 'Existing 3' }
    ];
    
    chrome.storage.local.get.mockImplementation((keys, callback) => {
      callback({ 'sourceBottleOpportunities': existingOpportunities });
    });
    
    chrome.storage.local.set.mockImplementation((data, callback) => {
      callback();
    });
    
    // New opportunities with different ID formats
    const newOpportunities = [
      { id: '2', title: 'Updated 2' },
      { externalId: '4', title: 'New 4' },
      { id: '5', externalId: '5', title: 'New 5' }
    ];
    
    // Call the method
    const result = await storageManager.saveOpportunities(newOpportunities);
    
    // Verify results
    expect(result.length).toBe(5); // 3 existing + 2 new (one is an update)
    
    // Check if IDs are normalized
    const updatedOpp = result.find(o => o.id === '2');
    expect(updatedOpp.title).toBe('Updated 2');
    expect(updatedOpp.externalId).toBe('2');
    
    const newOpp4 = result.find(o => o.id === '4');
    expect(newOpp4.title).toBe('New 4');
    expect(newOpp4.externalId).toBe('4');
    
    // Verify storage was called with correct data
    expect(chrome.storage.local.set).toHaveBeenCalledTimes(1);
  });
});