/**
 * Unit tests for StorageManager module with BaseModule integration
 */

import { storageManager } from '../../modules/storage.js';

describe('StorageManager with BaseModule', () => {
  beforeEach(async () => {
    // Reset storage and module state
    global.extension.reset();
    
    // Reinitialize the module
    if (storageManager.isInitialized) {
      await storageManager.shutdown();
    }
    await storageManager.initialize();
  });
  
  afterEach(async () => {
    await storageManager.shutdown();
  });
  
  describe('BaseModule Integration', () => {
    test('should extend BaseModule correctly', () => {
      expect(storageManager.name).toBe('StorageManager');
      expect(storageManager.isInitialized).toBe(true);
      expect(storageManager.state).toBe('ready');
    });
    
    test('should have proper health monitoring', () => {
      const health = storageManager.getHealth();
      expect(health.status).toBeDefined();
      expect(health.uptime).toBeGreaterThan(0);
      expect(health.successRate).toBeDefined();
    });
    
    test('should track metrics for operations', async () => {
      await storageManager.saveOpportunity({
        id: 'test-1',
        platform: 'test',
        title: 'Test Opportunity'
      });
      
      const health = storageManager.getHealth();
      expect(health.operations.saveOpportunity).toBeDefined();
      expect(health.operations.saveOpportunity.count).toBeGreaterThan(0);
    });
  });
  
  describe('Opportunity Management', () => {
    const testOpportunity = {
      id: 'opp-123',
      platform: 'sourcebottle',
      title: 'Test Opportunity',
      description: 'Test description',
      deadline: new Date().toISOString(),
      url: 'https://example.com'
    };
    
    test('should save single opportunity', async () => {
      const result = await storageManager.saveOpportunity(testOpportunity);
      
      expect(result.success).toBe(true);
      expect(result.opportunity).toMatchObject(testOpportunity);
    });
    
    test('should retrieve saved opportunity', async () => {
      await storageManager.saveOpportunity(testOpportunity);
      
      const retrieved = await storageManager.getOpportunity('opp-123');
      expect(retrieved).toMatchObject(testOpportunity);
    });
    
    test('should update existing opportunity', async () => {
      await storageManager.saveOpportunity(testOpportunity);
      
      const updated = {
        ...testOpportunity,
        title: 'Updated Title',
        status: 'applied'
      };
      
      await storageManager.saveOpportunity(updated);
      
      const retrieved = await storageManager.getOpportunity('opp-123');
      expect(retrieved.title).toBe('Updated Title');
      expect(retrieved.status).toBe('applied');
    });
    
    test('should save multiple opportunities', async () => {
      const opportunities = [
        { ...testOpportunity, id: 'opp-1' },
        { ...testOpportunity, id: 'opp-2' },
        { ...testOpportunity, id: 'opp-3' }
      ];
      
      const result = await storageManager.saveOpportunities(opportunities);
      
      expect(result.success).toBe(true);
      expect(result.saved).toBe(3);
      expect(result.errors).toHaveLength(0);
    });
    
    test('should handle duplicate opportunities', async () => {
      const opp1 = { ...testOpportunity, id: 'dup-1' };
      const opp2 = { ...testOpportunity, id: 'dup-1', title: 'Different' };
      
      await storageManager.saveOpportunity(opp1);
      const result = await storageManager.saveOpportunity(opp2);
      
      expect(result.success).toBe(true);
      expect(result.updated).toBe(true);
      
      const stored = await storageManager.getOpportunity('dup-1');
      expect(stored.title).toBe('Different');
    });
    
    test('should delete opportunity', async () => {
      await storageManager.saveOpportunity(testOpportunity);
      
      const deleteResult = await storageManager.deleteOpportunity('opp-123');
      expect(deleteResult.success).toBe(true);
      
      const retrieved = await storageManager.getOpportunity('opp-123');
      expect(retrieved).toBeNull();
    });
  });
  
  describe('Platform-specific Operations', () => {
    test('should filter opportunities by platform', async () => {
      const opportunities = [
        { id: '1', platform: 'sourcebottle', title: 'SB 1' },
        { id: '2', platform: 'qwoted', title: 'QW 1' },
        { id: '3', platform: 'sourcebottle', title: 'SB 2' },
        { id: '4', platform: 'featured', title: 'FT 1' }
      ];
      
      await storageManager.saveOpportunities(opportunities);
      
      const sbOpps = await storageManager.getOpportunitiesByPlatform('sourcebottle');
      expect(sbOpps).toHaveLength(2);
      expect(sbOpps.every(o => o.platform === 'sourcebottle')).toBe(true);
    });
    
    test('should get all opportunities across platforms', async () => {
      const opportunities = [
        { id: '1', platform: 'sourcebottle', title: 'Opp 1' },
        { id: '2', platform: 'qwoted', title: 'Opp 2' },
        { id: '3', platform: 'featured', title: 'Opp 3' }
      ];
      
      await storageManager.saveOpportunities(opportunities);
      
      const allOpps = await storageManager.getAllOpportunities();
      expect(allOpps).toHaveLength(3);
      expect(allOpps.map(o => o.platform).sort()).toEqual(['featured', 'qwoted', 'sourcebottle']);
    });
  });
  
  describe('Search and Filtering', () => {
    beforeEach(async () => {
      const opportunities = [
        {
          id: '1',
          platform: 'sourcebottle',
          title: 'JavaScript Developer Needed',
          description: 'Looking for React expert',
          tags: ['javascript', 'react'],
          deadline: '2025-07-10'
        },
        {
          id: '2',
          platform: 'qwoted',
          title: 'Python AI Expert',
          description: 'Machine learning project',
          tags: ['python', 'ai', 'ml'],
          deadline: '2025-07-05'
        },
        {
          id: '3',
          platform: 'featured',
          title: 'Full Stack Developer',
          description: 'JavaScript and Python required',
          tags: ['javascript', 'python', 'fullstack'],
          deadline: '2025-07-15'
        }
      ];
      
      await storageManager.saveOpportunities(opportunities);
    });
    
    test('should search by text query', async () => {
      const results = await storageManager.searchOpportunities('javascript');
      expect(results).toHaveLength(2);
      expect(results.map(r => r.id).sort()).toEqual(['1', '3']);
    });
    
    test('should filter by tags', async () => {
      const results = await storageManager.filterByTags(['python']);
      expect(results).toHaveLength(2);
      expect(results.map(r => r.id).sort()).toEqual(['2', '3']);
    });
    
    test('should filter by deadline', async () => {
      const results = await storageManager.filterByDeadline(
        new Date('2025-07-01'),
        new Date('2025-07-10')
      );
      expect(results).toHaveLength(2);
      expect(results.map(r => r.id).sort()).toEqual(['1', '2']);
    });
    
    test('should combine multiple filters', async () => {
      const results = await storageManager.searchOpportunities('developer', {
        platforms: ['sourcebottle', 'featured'],
        tags: ['javascript'],
        deadlineAfter: new Date('2025-07-08')
      });
      
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('3');
    });
  });
  
  describe('Status Management', () => {
    test('should update opportunity status', async () => {
      await storageManager.saveOpportunity({
        id: 'status-1',
        platform: 'qwoted',
        title: 'Test',
        status: 'new'
      });
      
      await storageManager.updateStatus('status-1', 'applied');
      
      const updated = await storageManager.getOpportunity('status-1');
      expect(updated.status).toBe('applied');
      expect(updated.statusHistory).toBeDefined();
      expect(updated.statusHistory).toHaveLength(2);
    });
    
    test('should track status history', async () => {
      await storageManager.saveOpportunity({
        id: 'history-1',
        platform: 'featured',
        title: 'Test'
      });
      
      await storageManager.updateStatus('history-1', 'viewed');
      await storageManager.updateStatus('history-1', 'applied');
      await storageManager.updateStatus('history-1', 'accepted');
      
      const opp = await storageManager.getOpportunity('history-1');
      expect(opp.statusHistory).toHaveLength(4);
      expect(opp.statusHistory.map(s => s.status)).toEqual(['new', 'viewed', 'applied', 'accepted']);
    });
    
    test('should get opportunities by status', async () => {
      const opportunities = [
        { id: '1', platform: 'sourcebottle', title: 'Opp 1', status: 'new' },
        { id: '2', platform: 'qwoted', title: 'Opp 2', status: 'applied' },
        { id: '3', platform: 'featured', title: 'Opp 3', status: 'new' },
        { id: '4', platform: 'sourcebottle', title: 'Opp 4', status: 'applied' }
      ];
      
      await storageManager.saveOpportunities(opportunities);
      
      const newOpps = await storageManager.getOpportunitiesByStatus('new');
      expect(newOpps).toHaveLength(2);
      
      const appliedOpps = await storageManager.getOpportunitiesByStatus('applied');
      expect(appliedOpps).toHaveLength(2);
    });
  });
  
  describe('Error Handling', () => {
    test('should handle storage errors gracefully', async () => {
      // Mock storage error
      chrome.storage.local.set.mockImplementationOnce((items, callback) => {
        chrome.runtime.lastError = { message: 'Storage quota exceeded' };
        callback();
      });
      
      const result = await storageManager.saveOpportunity({
        id: 'error-1',
        platform: 'test',
        title: 'Test'
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Storage quota exceeded');
    });
    
    test('should validate opportunity data', async () => {
      const invalidOpp = {
        // Missing required fields
        title: 'Test'
      };
      
      const result = await storageManager.saveOpportunity(invalidOpp);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing required fields');
    });
    
    test('should handle concurrent operations', async () => {
      const operations = [];
      
      // Create 10 concurrent save operations
      for (let i = 0; i < 10; i++) {
        operations.push(
          storageManager.saveOpportunity({
            id: `concurrent-${i}`,
            platform: 'test',
            title: `Concurrent ${i}`
          })
        );
      }
      
      const results = await Promise.all(operations);
      expect(results.every(r => r.success)).toBe(true);
      
      const allOpps = await storageManager.getAllOpportunities();
      expect(allOpps).toHaveLength(10);
    });
  });
  
  describe('Data Migration', () => {
    test('should migrate legacy data format', async () => {
      // Simulate legacy data in storage
      chrome.storage.local.get.mockImplementationOnce((keys, callback) => {
        callback({
          sourceBottleOpportunities: [
            { externalId: 'old-1', title: 'Legacy Opp' }
          ]
        });
      });
      
      await storageManager._migrateLegacyData();
      
      const migrated = await storageManager.getOpportunitiesByPlatform('sourcebottle');
      expect(migrated).toHaveLength(1);
      expect(migrated[0].id).toBe('sourcebottle-old-1');
    });
  });
  
  describe('Performance Monitoring', () => {
    test('should track operation performance', async () => {
      const startTime = Date.now();
      
      await storageManager.saveOpportunity({
        id: 'perf-1',
        platform: 'test',
        title: 'Performance Test'
      });
      
      const health = storageManager.getHealth();
      const saveMetrics = health.operations.saveOpportunity;
      
      expect(saveMetrics.avgDuration).toBeGreaterThan(0);
      expect(saveMetrics.avgDuration).toBeLessThan(100); // Should be fast
    });
    
    test('should handle bulk operations efficiently', async () => {
      const opportunities = Array.from({ length: 100 }, (_, i) => ({
        id: `bulk-${i}`,
        platform: 'test',
        title: `Bulk Opportunity ${i}`
      }));
      
      const startTime = Date.now();
      const result = await storageManager.saveOpportunities(opportunities);
      const duration = Date.now() - startTime;
      
      expect(result.success).toBe(true);
      expect(result.saved).toBe(100);
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });
  });
});