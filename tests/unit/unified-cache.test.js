/**
 * Unit tests for UnifiedCache module
 */

import { unifiedCache, UnifiedCache } from '../../modules/unifiedCache.js';

describe('UnifiedCache', () => {
  let cache;
  
  beforeEach(async () => {
    // Reset global cache instance
    global.extension.reset();
    
    // Create new cache instance for testing
    cache = new UnifiedCache();
    await cache.initialize();
  });
  
  afterEach(async () => {
    await cache.shutdown();
  });
  
  describe('Cache Creation and Management', () => {
    test('should create new cache with default options', () => {
      const testCache = cache.getCache('test');
      expect(testCache).toBeDefined();
      expect(testCache.maxSize).toBe(1000);
      expect(testCache.ttl).toBe(3600000); // 1 hour
    });
    
    test('should create cache with custom options', () => {
      const customCache = cache.getCache('custom', {
        maxSize: 500,
        ttl: 60000,
        priority: 2
      });
      
      expect(customCache.maxSize).toBe(500);
      expect(customCache.ttl).toBe(60000);
      expect(customCache.priority).toBe(2);
    });
    
    test('should return existing cache instance', () => {
      const cache1 = cache.getCache('singleton');
      const cache2 = cache.getCache('singleton');
      
      expect(cache1).toBe(cache2);
    });
    
    test('should list all active caches', () => {
      cache.getCache('cache1');
      cache.getCache('cache2');
      cache.getCache('cache3');
      
      const cacheList = cache.listCaches();
      expect(cacheList).toContain('cache1');
      expect(cacheList).toContain('cache2');
      expect(cacheList).toContain('cache3');
    });
  });
  
  describe('Cache Operations', () => {
    let testCache;
    
    beforeEach(() => {
      testCache = cache.getCache('operations');
    });
    
    test('should set and get values', async () => {
      await testCache.set('key1', 'value1');
      const value = await testCache.get('key1');
      expect(value).toBe('value1');
    });
    
    test('should handle complex objects', async () => {
      const complexObject = {
        id: 1,
        data: [1, 2, 3],
        nested: { foo: 'bar' }
      };
      
      await testCache.set('complex', complexObject);
      const retrieved = await testCache.get('complex');
      expect(retrieved).toEqual(complexObject);
    });
    
    test('should return null for missing keys', async () => {
      const value = await testCache.get('nonexistent');
      expect(value).toBeNull();
    });
    
    test('should delete values', async () => {
      await testCache.set('toDelete', 'value');
      expect(await testCache.get('toDelete')).toBe('value');
      
      await testCache.delete('toDelete');
      expect(await testCache.get('toDelete')).toBeNull();
    });
    
    test('should clear all values', async () => {
      await testCache.set('key1', 'value1');
      await testCache.set('key2', 'value2');
      await testCache.set('key3', 'value3');
      
      await testCache.clear();
      
      expect(await testCache.get('key1')).toBeNull();
      expect(await testCache.get('key2')).toBeNull();
      expect(await testCache.get('key3')).toBeNull();
    });
    
    test('should check if key exists', async () => {
      await testCache.set('exists', 'value');
      
      expect(await testCache.has('exists')).toBe(true);
      expect(await testCache.has('notexists')).toBe(false);
    });
  });
  
  describe('TTL and Expiration', () => {
    test('should expire values after TTL', async () => {
      const shortTTLCache = cache.getCache('ttl', { ttl: 100 });
      
      await shortTTLCache.set('expire', 'value');
      expect(await shortTTLCache.get('expire')).toBe('value');
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 150));
      
      expect(await shortTTLCache.get('expire')).toBeNull();
    });
    
    test('should update TTL on access if configured', async () => {
      const touchCache = cache.getCache('touch', { 
        ttl: 200,
        updateOnGet: true 
      });
      
      await touchCache.set('refresh', 'value');
      
      // Access after 100ms
      await new Promise(resolve => setTimeout(resolve, 100));
      await touchCache.get('refresh');
      
      // Wait another 150ms (total 250ms)
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Should still exist because TTL was refreshed
      expect(await touchCache.get('refresh')).toBe('value');
    });
  });
  
  describe('Memory Management', () => {
    test('should enforce size limits', async () => {
      const smallCache = cache.getCache('small', { maxSize: 3 });
      
      await smallCache.set('key1', 'value1');
      await smallCache.set('key2', 'value2');
      await smallCache.set('key3', 'value3');
      await smallCache.set('key4', 'value4'); // Should evict oldest
      
      expect(await smallCache.get('key1')).toBeNull(); // Evicted
      expect(await smallCache.get('key4')).toBe('value4');
    });
    
    test('should track memory usage', async () => {
      const memCache = cache.getCache('memory');
      
      const stats = memCache.getStats();
      expect(stats.memoryUsage).toBe(0);
      
      await memCache.set('data', 'x'.repeat(1000));
      
      const newStats = memCache.getStats();
      expect(newStats.memoryUsage).toBeGreaterThan(1000);
    });
    
    test('should handle memory pressure', async () => {
      const pressureCache = cache.getCache('pressure');
      
      // Fill cache
      for (let i = 0; i < 100; i++) {
        await pressureCache.set(`key${i}`, `value${i}`);
      }
      
      // Trigger memory pressure
      cache._handleMemoryPressure('pressure');
      
      const stats = pressureCache.getStats();
      expect(stats.size).toBeLessThan(100);
    });
  });
  
  describe('Cache Statistics', () => {
    test('should track hit/miss ratio', async () => {
      const statsCache = cache.getCache('stats');
      
      await statsCache.set('hit', 'value');
      
      // Generate hits
      await statsCache.get('hit');
      await statsCache.get('hit');
      
      // Generate misses
      await statsCache.get('miss1');
      await statsCache.get('miss2');
      
      const stats = statsCache.getStats();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(2);
      expect(stats.hitRate).toBe(0.5);
    });
    
    test('should provide global statistics', () => {
      const cache1 = cache.getCache('global1');
      const cache2 = cache.getCache('global2');
      
      const globalStats = cache.getGlobalStats();
      
      expect(globalStats.totalCaches).toBe(2);
      expect(globalStats.totalMemory).toBeDefined();
      expect(globalStats.cacheStats).toHaveProperty('global1');
      expect(globalStats.cacheStats).toHaveProperty('global2');
    });
  });
  
  describe('Persistence', () => {
    test('should save cache to storage', async () => {
      const persistCache = cache.getCache('persist', { 
        persistent: true 
      });
      
      await persistCache.set('saved', 'data');
      await cache._saveToStorage('persist');
      
      // Verify chrome.storage was called
      expect(chrome.storage.local.set).toHaveBeenCalledWith(
        expect.objectContaining({
          'cache_persist': expect.any(Object)
        }),
        expect.any(Function)
      );
    });
    
    test('should restore cache from storage', async () => {
      // Mock storage data
      chrome.storage.local.get.mockImplementationOnce((keys, callback) => {
        callback({
          'cache_restore': {
            data: { key: 'value' },
            metadata: { version: 1 }
          }
        });
      });
      
      await cache._loadFromStorage('restore');
      const restoreCache = cache.getCache('restore');
      
      expect(await restoreCache.get('key')).toBe('value');
    });
  });
  
  describe('Event System', () => {
    test('should emit cache events', async () => {
      const eventCache = cache.getCache('events');
      const events = [];
      
      eventCache.on('set', (key, value) => {
        events.push({ type: 'set', key, value });
      });
      
      eventCache.on('get', (key, value) => {
        events.push({ type: 'get', key, value });
      });
      
      eventCache.on('delete', (key) => {
        events.push({ type: 'delete', key });
      });
      
      await eventCache.set('test', 'value');
      await eventCache.get('test');
      await eventCache.delete('test');
      
      expect(events).toHaveLength(3);
      expect(events[0]).toEqual({ type: 'set', key: 'test', value: 'value' });
      expect(events[1]).toEqual({ type: 'get', key: 'test', value: 'value' });
      expect(events[2]).toEqual({ type: 'delete', key: 'test' });
    });
    
    test('should emit eviction events', async () => {
      const evictCache = cache.getCache('evict', { maxSize: 2 });
      let evictedKey = null;
      
      evictCache.on('evict', (key) => {
        evictedKey = key;
      });
      
      await evictCache.set('key1', 'value1');
      await evictCache.set('key2', 'value2');
      await evictCache.set('key3', 'value3'); // Should trigger eviction
      
      expect(evictedKey).toBe('key1');
    });
  });
  
  describe('Error Handling', () => {
    test('should handle storage errors gracefully', async () => {
      chrome.storage.local.set.mockImplementationOnce((items, callback) => {
        chrome.runtime.lastError = { message: 'Storage error' };
        callback();
      });
      
      const errorCache = cache.getCache('error');
      
      // Should not throw
      await expect(errorCache.set('key', 'value')).resolves.toBeUndefined();
    });
    
    test('should validate cache names', () => {
      expect(() => cache.getCache('')).toThrow('Cache name cannot be empty');
      expect(() => cache.getCache(null)).toThrow('Cache name must be a string');
    });
  });
  
  describe('Performance Optimization', () => {
    test('should batch operations efficiently', async () => {
      const batchCache = cache.getCache('batch');
      
      // Set multiple values in parallel
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(batchCache.set(`key${i}`, `value${i}`));
      }
      
      await Promise.all(promises);
      
      // Verify all values were set
      for (let i = 0; i < 10; i++) {
        expect(await batchCache.get(`key${i}`)).toBe(`value${i}`);
      }
    });
    
    test('should optimize memory layout', async () => {
      const optCache = cache.getCache('optimize');
      
      // Add entries with different access patterns
      await optCache.set('hot1', 'value');
      await optCache.set('hot2', 'value');
      await optCache.set('cold1', 'value');
      await optCache.set('cold2', 'value');
      
      // Access hot entries multiple times
      for (let i = 0; i < 5; i++) {
        await optCache.get('hot1');
        await optCache.get('hot2');
      }
      
      // Trigger optimization
      optCache._optimizeMemoryLayout();
      
      const stats = optCache.getStats();
      expect(stats.optimized).toBe(true);
    });
  });
});