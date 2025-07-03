# Digital PR Extension - Testing Guide

## Overview

This directory contains the test suite for the Digital PR Chrome Extension. The tests are written using Jest and include unit tests, integration tests, and testing utilities.

## Test Structure

```
tests/
├── README.md                      # This file
├── setup.js                       # Jest setup and Chrome API mocks
├── unit/                          # Unit tests for individual modules
│   ├── base-module.test.js        # BaseModule class tests
│   ├── unified-cache.test.js      # UnifiedCache system tests
│   ├── storage-manager.test.js    # StorageManager with BaseModule tests
│   ├── ai-service.test.js         # AI service tests
│   ├── storage.test.js            # Legacy storage tests
│   └── ...                        # Other module tests
└── MANUAL_TESTING_CHECKLIST.md   # Manual testing procedures
```

## Running Tests

### Run all tests
```bash
npm test
```

### Run tests in watch mode
```bash
npm run test:watch
```

### Run tests with coverage
```bash
npm run test:coverage
```

### Run specific test file
```bash
npm test tests/unit/storage-manager.test.js
```

### Run tests matching a pattern
```bash
npm test -- --testNamePattern="should save opportunity"
```

## Writing Tests

### Basic Test Structure

```javascript
describe('ModuleName', () => {
  let module;
  
  beforeEach(async () => {
    // Setup before each test
    global.extension.reset();
    module = new Module();
    await module.initialize();
  });
  
  afterEach(async () => {
    // Cleanup after each test
    await module.shutdown();
  });
  
  describe('Feature Area', () => {
    test('should perform expected behavior', async () => {
      // Arrange
      const input = { /* test data */ };
      
      // Act
      const result = await module.method(input);
      
      // Assert
      expect(result).toBe(expectedValue);
    });
  });
});
```

### Testing Chrome APIs

The `setup.js` file provides mocks for Chrome Extension APIs:

```javascript
// Chrome storage is automatically mocked
await chrome.storage.local.set({ key: 'value' });

// Chrome runtime is mocked
chrome.runtime.sendMessage({ action: 'test' });

// Chrome tabs is mocked
chrome.tabs.query({ active: true });
```

### Testing Async Operations

```javascript
test('should handle async operations', async () => {
  const promise = module.asyncMethod();
  
  // Test promise resolution
  await expect(promise).resolves.toBe('success');
  
  // Test promise rejection
  await expect(module.failingMethod()).rejects.toThrow('Error message');
});
```

### Testing Error Scenarios

```javascript
test('should handle errors gracefully', async () => {
  // Mock Chrome API error
  chrome.storage.local.get.mockImplementationOnce((keys, callback) => {
    chrome.runtime.lastError = { message: 'Storage error' };
    callback({});
  });
  
  const result = await module.loadData();
  expect(result.error).toBe('Storage error');
});
```

## Best Practices

### 1. Test Isolation
- Always reset global state in `beforeEach`
- Clean up resources in `afterEach`
- Don't rely on test execution order

### 2. Mock External Dependencies
```javascript
// Mock the AI service
jest.mock('../../modules/aiService.js', () => ({
  generateResponse: jest.fn().mockResolvedValue('AI response')
}));
```

### 3. Test Coverage Goals
- Aim for >80% code coverage
- Focus on critical paths and edge cases
- Test error handling thoroughly

### 4. Performance Testing
```javascript
test('should complete within time limit', async () => {
  const start = Date.now();
  await module.performOperation();
  const duration = Date.now() - start;
  
  expect(duration).toBeLessThan(1000); // 1 second limit
});
```

### 5. Data-Driven Tests
```javascript
test.each([
  ['sourcebottle', 'sb-123', 'sourcebottle-sb-123'],
  ['qwoted', 'qw-456', 'qwoted-qw-456'],
  ['featured', 'ft-789', 'featured-ft-789']
])('should generate ID for %s platform', (platform, externalId, expected) => {
  const id = module.generateId(platform, externalId);
  expect(id).toBe(expected);
});
```

## Testing New Features

When adding new features:

1. **Write tests first** (TDD approach)
2. **Test the public API**, not implementation details
3. **Include edge cases** and error scenarios
4. **Document complex test scenarios**
5. **Update coverage thresholds** if needed

## Debugging Tests

### Enable verbose output
```bash
npm test -- --verbose
```

### Debug specific test
```javascript
test.only('should debug this test', async () => {
  // This test will run in isolation
});
```

### Add console logs (removed in production)
```javascript
console.log('Debug info:', variable);
```

### Use Jest debugging
```bash
node --inspect-brk node_modules/.bin/jest --runInBand
```

## Continuous Integration

Tests are automatically run on:
- Every commit
- Pull requests
- Before deployment

Ensure all tests pass before merging!

## Common Issues

### Chrome API not defined
Ensure test imports `setup.js` or uses Jest config

### Async timeout
Increase timeout for long operations:
```javascript
test('long operation', async () => {
  // test code
}, 10000); // 10 second timeout
```

### Storage mock not working
Reset storage in beforeEach:
```javascript
global.extension.reset();
```

## Contributing

1. Write tests for all new features
2. Ensure existing tests pass
3. Add integration tests for complex features
4. Update this README with new patterns

## Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Chrome Extension Testing](https://developer.chrome.com/docs/extensions/mv3/unit-testing/)
- [Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)