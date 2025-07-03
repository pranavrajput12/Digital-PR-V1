/**
 * Unit tests for BaseModule class
 */

import { BaseModule } from '../../modules/base/BaseModule.js';

describe('BaseModule', () => {
  let testModule;
  
  beforeEach(() => {
    // Clear any stored state
    global.extension.reset();
    
    // Create a test module instance
    testModule = new BaseModule('TestModule', {
      maxRetries: 2,
      retryDelay: 100,
      timeout: 1000
    });
  });
  
  describe('Initialization', () => {
    test('should initialize with default options', () => {
      const module = new BaseModule('TestModule');
      expect(module.name).toBe('TestModule');
      expect(module.options.maxRetries).toBe(3);
      expect(module.options.retryDelay).toBe(1000);
      expect(module.options.timeout).toBe(30000);
      expect(module.isInitialized).toBe(false);
    });
    
    test('should initialize with custom options', () => {
      expect(testModule.options.maxRetries).toBe(2);
      expect(testModule.options.retryDelay).toBe(100);
      expect(testModule.options.timeout).toBe(1000);
    });
    
    test('should complete initialization successfully', async () => {
      await testModule.initialize();
      expect(testModule.isInitialized).toBe(true);
    });
    
    test('should not reinitialize if already initialized', async () => {
      await testModule.initialize();
      const initSpy = jest.spyOn(testModule, '_performInit');
      await testModule.initialize();
      expect(initSpy).not.toHaveBeenCalled();
    });
  });
  
  describe('Error Handling', () => {
    test('should handle errors with retry logic', async () => {
      let attempts = 0;
      const operation = jest.fn().mockImplementation(() => {
        attempts++;
        if (attempts < 2) {
          throw new Error('Test error');
        }
        return 'success';
      });
      
      const result = await testModule._executeWithRetry(operation, 'testOperation');
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(2);
    });
    
    test('should fail after max retries', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Persistent error'));
      
      await expect(
        testModule._executeWithRetry(operation, 'testOperation')
      ).rejects.toThrow('Persistent error');
      
      expect(operation).toHaveBeenCalledTimes(3); // maxRetries + 1
    });
    
    test('should not retry non-retryable errors', async () => {
      const error = new Error('Non-retryable error');
      error.retryable = false;
      const operation = jest.fn().mockRejectedValue(error);
      
      await expect(
        testModule._executeWithRetry(operation, 'testOperation')
      ).rejects.toThrow('Non-retryable error');
      
      expect(operation).toHaveBeenCalledTimes(1);
    });
  });
  
  describe('Circuit Breaker', () => {
    beforeEach(() => {
      // Enable circuit breaker for these tests
      testModule.options.circuitBreaker = {
        threshold: 3,
        timeout: 100
      };
    });
    
    test('should open circuit after threshold failures', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Circuit test error'));
      
      // Fail 3 times to open the circuit
      for (let i = 0; i < 3; i++) {
        try {
          await testModule._executeWithRetry(operation, 'circuitTest');
        } catch (e) {
          // Expected
        }
      }
      
      // Circuit should be open, next call should fail immediately
      const start = Date.now();
      await expect(
        testModule._executeWithRetry(operation, 'circuitTest')
      ).rejects.toThrow('Circuit breaker is open');
      
      const duration = Date.now() - start;
      expect(duration).toBeLessThan(50); // Should fail fast
    });
    
    test('should close circuit after timeout', async () => {
      const operation = jest.fn()
        .mockRejectedValueOnce(new Error('Error 1'))
        .mockRejectedValueOnce(new Error('Error 2'))
        .mockRejectedValueOnce(new Error('Error 3'))
        .mockResolvedValue('success');
      
      // Open the circuit
      for (let i = 0; i < 3; i++) {
        try {
          await testModule._executeWithRetry(operation, 'circuitTest');
        } catch (e) {
          // Expected
        }
      }
      
      // Wait for circuit to close
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Should work now
      const result = await testModule._executeWithRetry(operation, 'circuitTest');
      expect(result).toBe('success');
    });
  });
  
  describe('Performance Metrics', () => {
    test('should track operation metrics', async () => {
      const operation = jest.fn().mockResolvedValue('result');
      
      await testModule._executeWithRetry(operation, 'metricsTest');
      
      const metrics = testModule.metrics.metricsTest;
      expect(metrics).toBeDefined();
      expect(metrics.count).toBe(1);
      expect(metrics.success).toBe(1);
      expect(metrics.failure).toBe(0);
      expect(metrics.avgDuration).toBeGreaterThan(0);
    });
    
    test('should update metrics on failure', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Metrics error'));
      
      try {
        await testModule._executeWithRetry(operation, 'failureMetrics');
      } catch (e) {
        // Expected
      }
      
      const metrics = testModule.metrics.failureMetrics;
      expect(metrics.failure).toBeGreaterThan(0);
      expect(metrics.success).toBe(0);
    });
    
    test('should provide health status', () => {
      // Simulate some operations
      testModule.metrics.testOp = {
        count: 10,
        success: 8,
        failure: 2,
        avgDuration: 100,
        lastError: null
      };
      
      const health = testModule.getHealth();
      expect(health.status).toBe('healthy');
      expect(health.successRate).toBe(0.8);
      expect(health.operations.testOp.successRate).toBe(0.8);
    });
    
    test('should report unhealthy status on high failure rate', () => {
      testModule.metrics.badOp = {
        count: 10,
        success: 3,
        failure: 7,
        avgDuration: 100,
        lastError: new Error('Recent error')
      };
      
      const health = testModule.getHealth();
      expect(health.status).toBe('unhealthy');
      expect(health.successRate).toBe(0.3);
    });
  });
  
  describe('Module State Management', () => {
    test('should handle state transitions correctly', async () => {
      expect(testModule.state).toBe('idle');
      
      await testModule.initialize();
      expect(testModule.state).toBe('ready');
      
      await testModule.shutdown();
      expect(testModule.state).toBe('shutdown');
    });
    
    test('should emit state change events', async () => {
      const stateChanges = [];
      testModule.on('stateChange', (oldState, newState) => {
        stateChanges.push({ oldState, newState });
      });
      
      await testModule.initialize();
      await testModule.shutdown();
      
      expect(stateChanges).toEqual([
        { oldState: 'idle', newState: 'initializing' },
        { oldState: 'initializing', newState: 'ready' },
        { oldState: 'ready', newState: 'shutdown' }
      ]);
    });
  });
  
  describe('Memory Management', () => {
    test('should clean up resources on shutdown', async () => {
      await testModule.initialize();
      
      // Add some test data
      testModule._cache = { test: 'data' };
      testModule._timers = [setTimeout(() => {}, 1000)];
      
      await testModule.shutdown();
      
      expect(testModule._cache).toBeNull();
      expect(testModule._timers).toHaveLength(0);
    });
    
    test('should handle memory pressure', () => {
      // Simulate memory pressure
      testModule._handleMemoryPressure();
      
      expect(testModule.metrics).toEqual({});
    });
  });
  
  describe('Configuration Validation', () => {
    test('should validate required configuration', () => {
      class ConfigModule extends BaseModule {
        _validateConfig(config) {
          if (!config.apiKey) {
            throw new Error('apiKey is required');
          }
        }
      }
      
      expect(() => new ConfigModule('ConfigTest', {}))
        .toThrow('apiKey is required');
    });
    
    test('should merge default and provided configuration', () => {
      class DefaultsModule extends BaseModule {
        constructor(name, options) {
          const defaults = {
            timeout: 5000,
            retries: 5
          };
          super(name, { ...defaults, ...options });
        }
      }
      
      const module = new DefaultsModule('DefaultsTest', { timeout: 3000 });
      expect(module.options.timeout).toBe(3000);
      expect(module.options.retries).toBe(5);
    });
  });
});