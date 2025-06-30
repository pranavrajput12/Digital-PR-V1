/**
 * Unit tests for PaginationManager module
 */

// Import or recreate the module for testing
const paginationModule = `
  // Import dependencies
  import { logManager } from './logger.js';
  import { storageManager } from './storage.js';
  import { opportunityScraper } from './scraper.js';

  export const paginationManager = {
    // Pagination state
    state: {
      inProgress: false,
      currentPage: 1,
      totalPages: 0,
      pageSize: 20,
      processedItems: new Set(),
      lastProcessedId: null,
      startTime: null,
      totalFound: 0,
      totalNew: 0
    },
    
    // Initialize pagination from current page
    initializeFromPage: async function() {
      try {
        logManager.log('Initializing pagination from current page');
        
        // Check if we're in the middle of pagination
        const savedState = await storageManager.getPaginationState();
        if (savedState && savedState.inProgress) {
          logManager.log('Resuming pagination from saved state', savedState);
          this.state = {
            ...this.state,
            ...savedState,
            processedItems: new Set(savedState.processedItems || [])
          };
        } else {
          // Reset state for new pagination
          this.resetState();
        }
        
        // Detect pagination info from page
        this.detectPaginationInfo();
        
        // Save current state
        await this.saveState();
        
        return {
          currentPage: this.state.currentPage,
          totalPages: this.state.totalPages,
          inProgress: this.state.inProgress
        };
      } catch (error) {
        logManager.error('Error initializing pagination:', error);
        throw error;
      }
    },
    
    // Reset pagination state
    resetState: function() {
      this.state = {
        inProgress: true,
        currentPage: 1,
        totalPages: 0,
        pageSize: 20,
        processedItems: new Set(),
        lastProcessedId: null,
        startTime: new Date().toISOString(),
        totalFound: 0,
        totalNew: 0
      };
      
      logManager.log('Pagination state reset');
    },
    
    // Detect pagination information from current page
    detectPaginationInfo: function() {
      try {
        // Detect current page
        const pageIndicator = document.querySelector('.pagination .current, .page-indicator');
        if (pageIndicator) {
          const currentPage = parseInt(pageIndicator.textContent.trim(), 10);
          if (!isNaN(currentPage)) {
            this.state.currentPage = currentPage;
          }
        }
        
        // Detect total pages
        const lastPageLink = document.querySelector('.pagination a:last-child, .pagination-last');
        if (lastPageLink) {
          // Extract page number from href or text
          let totalPages = 0;
          
          if (lastPageLink.href) {
            const match = lastPageLink.href.match(/[?&]page=(\\d+)/);
            if (match && match[1]) {
              totalPages = parseInt(match[1], 10);
            }
          } else {
            totalPages = parseInt(lastPageLink.textContent.trim(), 10);
          }
          
          if (!isNaN(totalPages) && totalPages > 0) {
            this.state.totalPages = totalPages;
          }
        }
        
        // If we couldn't detect total pages, set a default
        if (this.state.totalPages === 0) {
          // Check if there's a "Next" link, indicating more pages
          const nextLink = document.querySelector('.pagination .next, .pagination-next');
          this.state.totalPages = nextLink ? this.state.currentPage + 1 : this.state.currentPage;
        }
        
        logManager.log(\`Detected pagination: Page \${this.state.currentPage} of \${this.state.totalPages}\`);
      } catch (error) {
        logManager.error('Error detecting pagination info:', error);
        // Default to current page only if detection fails
        this.state.totalPages = this.state.currentPage;
      }
    },
    
    // Process the current page
    processCurrentPage: async function() {
      try {
        logManager.log(\`Processing page \${this.state.currentPage} of \${this.state.totalPages}\`);
        
        // Extract opportunities from current page
        const pageOpportunities = opportunityScraper.extractOpportunitiesFromPage();
        this.state.totalFound += pageOpportunities.length;
        
        // Filter already processed items
        const newOpportunities = pageOpportunities.filter(opp => {
          // Skip if already processed in this session
          if (this.state.processedItems.has(opp.externalId)) {
            return false;
          }
          
          // Mark as processed
          this.state.processedItems.add(opp.externalId);
          this.state.lastProcessedId = opp.externalId;
          return true;
        });
        
        // Save new opportunities
        if (newOpportunities.length > 0) {
          const saveResult = await storageManager.saveOpportunities(newOpportunities);
          this.state.totalNew += saveResult.newCount;
          logManager.log(\`Saved \${saveResult.newCount} new opportunities from page \${this.state.currentPage}\`);
        }
        
        // Check if this is the last page
        const isComplete = this.state.currentPage >= this.state.totalPages;
        
        // Update state
        if (isComplete) {
          this.state.inProgress = false;
          logManager.log('Pagination complete');
        }
        
        // Save current state
        await this.saveState();
        
        return {
          currentPage: this.state.currentPage,
          totalPages: this.state.totalPages,
          isComplete,
          newCount: newOpportunities.length,
          totalCount: this.state.totalNew
        };
      } catch (error) {
        logManager.error('Error processing current page:', error);
        throw error;
      }
    },
    
    // Navigate to the next page
    navigateToNextPage: async function() {
      try {
        if (this.state.currentPage >= this.state.totalPages) {
          logManager.log('Already at last page, pagination complete');
          this.state.inProgress = false;
          await this.saveState();
          return { success: false, message: 'Already at last page' };
        }
        
        // Find and click the next page link
        const nextLink = document.querySelector('.pagination .next a, .pagination-next');
        if (nextLink && nextLink.href) {
          logManager.log('Navigating to next page');
          
          // Update state before navigation
          this.state.currentPage++;
          await this.saveState();
          
          // Navigate to next page
          window.location.href = nextLink.href;
          return { success: true };
        } else {
          logManager.error('Next page link not found');
          return { success: false, message: 'Next page link not found' };
        }
      } catch (error) {
        logManager.error('Error navigating to next page:', error);
        return { success: false, error: error.message };
      }
    },
    
    // Save current state to storage
    saveState: async function() {
      // Convert Set to Array for storage
      const stateForStorage = {
        ...this.state,
        processedItems: Array.from(this.state.processedItems)
      };
      
      return storageManager.savePaginationState(stateForStorage);
    },
    
    // Complete pagination (called manually or when reaching last page)
    completePagination: async function() {
      this.state.inProgress = false;
      await this.saveState();
      
      logManager.log('Pagination completed manually');
      return { success: true, message: 'Pagination completed' };
    }
  };
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
    getPaginationState: jest.fn(),
    savePaginationState: jest.fn(),
    saveOpportunities: jest.fn()
  };
`;

const scraperModuleMock = `
  export const opportunityScraper = {
    extractOpportunitiesFromPage: jest.fn()
  };
`;

// Create modules in memory
const loggerModuleURL = 'blob:' + URL.createObjectURL(new Blob([loggerModuleMock], { type: 'application/javascript' }));
const storageModuleURL = 'blob:' + URL.createObjectURL(new Blob([storageModuleMock], { type: 'application/javascript' }));
const scraperModuleURL = 'blob:' + URL.createObjectURL(new Blob([scraperModuleMock], { type: 'application/javascript' }));
const moduleURL = 'blob:' + URL.createObjectURL(new Blob([paginationModule], { type: 'application/javascript' }));

// Mock imports
jest.mock('./logger.js', () => import(loggerModuleURL), { virtual: true });
jest.mock('./storage.js', () => import(storageModuleURL), { virtual: true });
jest.mock('./scraper.js', () => import(scraperModuleURL), { virtual: true });

// Mock document methods
const mockQuerySelector = jest.fn();

describe('Pagination Manager Module', () => {
  let paginationManager;
  let logManager;
  let storageManager;
  let opportunityScraper;

  beforeAll(async () => {
    // Import the dependencies
    const loggerModule = await import('./logger.js');
    logManager = loggerModule.logManager;
    
    const storageModule = await import('./storage.js');
    storageManager = storageModule.storageManager;
    
    const scraperModule = await import('./scraper.js');
    opportunityScraper = scraperModule.opportunityScraper;
    
    // Import the test module
    const module = await import(moduleURL);
    paginationManager = module.paginationManager;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset pagination state
    paginationManager.resetState();
    
    // Setup document mock
    global.document = {
      querySelector: mockQuerySelector
    };
    
    // Setup default mock implementations
    storageManager.getPaginationState.mockResolvedValue(null);
    storageManager.savePaginationState.mockResolvedValue({ success: true });
    storageManager.saveOpportunities.mockResolvedValue({ success: true, newCount: 0, count: 0 });
  });

  test('initializeFromPage should detect pagination info', async () => {
    // Arrange
    mockQuerySelector
      .mockImplementationOnce(() => ({ textContent: '2' })) // Current page
      .mockImplementationOnce(() => ({ href: '?page=5' })); // Last page
    
    // Act
    const result = await paginationManager.initializeFromPage();
    
    // Assert
    expect(result.currentPage).toBe(2);
    expect(result.totalPages).toBe(5);
    expect(result.inProgress).toBe(true);
    expect(logManager.log).toHaveBeenCalledWith('Detected pagination: Page 2 of 5');
  });

  test('initializeFromPage should resume from saved state', async () => {
    // Arrange
    const savedState = {
      inProgress: true,
      currentPage: 3,
      totalPages: 7,
      processedItems: ['id1', 'id2'],
      totalFound: 45,
      totalNew: 30
    };
    
    storageManager.getPaginationState.mockResolvedValue(savedState);
    
    // Act
    const result = await paginationManager.initializeFromPage();
    
    // Assert
    expect(result.currentPage).toBe(3);
    expect(result.totalPages).toBe(7);
    expect(paginationManager.state.processedItems.size).toBe(2);
    expect(paginationManager.state.processedItems.has('id1')).toBe(true);
    expect(paginationManager.state.totalFound).toBe(45);
    expect(paginationManager.state.totalNew).toBe(30);
  });

  test('processCurrentPage should extract and save opportunities', async () => {
    // Arrange
    paginationManager.state.currentPage = 1;
    paginationManager.state.totalPages = 3;
    
    const mockOpportunities = [
      { externalId: 'id1', title: 'Test 1' },
      { externalId: 'id2', title: 'Test 2' },
      { externalId: 'id3', title: 'Test 3' }
    ];
    
    opportunityScraper.extractOpportunitiesFromPage.mockReturnValue(mockOpportunities);
    storageManager.saveOpportunities.mockResolvedValue({ success: true, newCount: 3, count: 3 });
    
    // Act
    const result = await paginationManager.processCurrentPage();
    
    // Assert
    expect(result.currentPage).toBe(1);
    expect(result.totalPages).toBe(3);
    expect(result.isComplete).toBe(false);
    expect(result.newCount).toBe(3);
    expect(result.totalCount).toBe(3);
    expect(paginationManager.state.totalFound).toBe(3);
    expect(paginationManager.state.totalNew).toBe(3);
    expect(paginationManager.state.processedItems.size).toBe(3);
    expect(storageManager.saveOpportunities).toHaveBeenCalledWith(mockOpportunities);
  });

  test('processCurrentPage should skip already processed items', async () => {
    // Arrange
    paginationManager.state.currentPage = 2;
    paginationManager.state.totalPages = 3;
    paginationManager.state.processedItems = new Set(['id1', 'id2']);
    
    const mockOpportunities = [
      { externalId: 'id1', title: 'Test 1' }, // Already processed
      { externalId: 'id2', title: 'Test 2' }, // Already processed
      { externalId: 'id4', title: 'Test 4' }  // New
    ];
    
    opportunityScraper.extractOpportunitiesFromPage.mockReturnValue(mockOpportunities);
    storageManager.saveOpportunities.mockResolvedValue({ success: true, newCount: 1, count: 1 });
    
    // Act
    const result = await paginationManager.processCurrentPage();
    
    // Assert
    expect(result.newCount).toBe(1);
    expect(paginationManager.state.processedItems.size).toBe(3);
    expect(storageManager.saveOpportunities).toHaveBeenCalledWith([mockOpportunities[2]]);
  });

  test('processCurrentPage should mark pagination as complete on last page', async () => {
    // Arrange
    paginationManager.state.currentPage = 3;
    paginationManager.state.totalPages = 3;
    
    const mockOpportunities = [
      { externalId: 'id7', title: 'Test 7' },
      { externalId: 'id8', title: 'Test 8' }
    ];
    
    opportunityScraper.extractOpportunitiesFromPage.mockReturnValue(mockOpportunities);
    storageManager.saveOpportunities.mockResolvedValue({ success: true, newCount: 2, count: 2 });
    
    // Act
    const result = await paginationManager.processCurrentPage();
    
    // Assert
    expect(result.isComplete).toBe(true);
    expect(paginationManager.state.inProgress).toBe(false);
    expect(logManager.log).toHaveBeenCalledWith('Pagination complete');
  });

  test('navigateToNextPage should navigate when on an intermediate page', async () => {
    // Arrange
    paginationManager.state.currentPage = 2;
    paginationManager.state.totalPages = 5;
    
    const mockNextLink = { href: 'https://example.com?page=3' };
    mockQuerySelector.mockReturnValue(mockNextLink);
    
    // Mock window.location
    const originalLocation = window.location;
    delete window.location;
    window.location = { href: 'https://example.com?page=2' };
    
    // Act
    const result = await paginationManager.navigateToNextPage();
    
    // Assert
    expect(result.success).toBe(true);
    expect(paginationManager.state.currentPage).toBe(3);
    expect(window.location.href).toBe(mockNextLink.href);
    expect(storageManager.savePaginationState).toHaveBeenCalled();
    
    // Restore window.location
    window.location = originalLocation;
  });

  test('navigateToNextPage should not navigate on last page', async () => {
    // Arrange
    paginationManager.state.currentPage = 3;
    paginationManager.state.totalPages = 3;
    
    // Act
    const result = await paginationManager.navigateToNextPage();
    
    // Assert
    expect(result.success).toBe(false);
    expect(result.message).toBe('Already at last page');
    expect(paginationManager.state.inProgress).toBe(false);
  });

  test('completePagination should mark pagination as complete', async () => {
    // Arrange
    paginationManager.state.inProgress = true;
    
    // Act
    const result = await paginationManager.completePagination();
    
    // Assert
    expect(result.success).toBe(true);
    expect(paginationManager.state.inProgress).toBe(false);
    expect(storageManager.savePaginationState).toHaveBeenCalled();
  });
});
