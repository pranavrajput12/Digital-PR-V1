/**
 * Featured.com Content Launcher
 *
 * This content script is injected into Featured.com pages matching the manifest patterns.
 * It detects when the page is ready and loads the appropriate scraper module.
 *
 * DEBUG MODE: Intensive console logging is enabled
 *
 * This launcher now provides real-time visual feedback through a notification UI
 * when scraping is in progress.
 */

console.log('🔍 [FEATURED DEBUG] Content launcher loaded - ' + new Date().toISOString());
console.log('🔍 [FEATURED DEBUG] URL:', window.location.href);
console.log('🔍 [FEATURED DEBUG] Document state:', document.readyState);

// Create a minimal notification element for immediate feedback
const quickNotification = document.createElement('div');
quickNotification.style.cssText = `
  position: fixed;
  bottom: 20px;
  right: 20px;
  background-color: #ff9800;
  color: white;
  padding: 10px 15px;
  border-radius: 4px;
  font-family: Arial, sans-serif;
  z-index: 9999;
  box-shadow: 0 2px 5px rgba(0,0,0,0.2);
  font-size: 14px;
  transition: opacity 0.3s ease;
`;
quickNotification.textContent = '🔍 Featured.com scraper initializing...';
document.body.appendChild(quickNotification);

// Hide the notification after 5 seconds if no other actions occur
setTimeout(() => {
  quickNotification.style.opacity = '0';
  setTimeout(() => {
    if (document.body.contains(quickNotification)) {
      document.body.removeChild(quickNotification);
    }
  }, 500);
}, 5000);

// Execute main logic when DOM is fully loaded
document.addEventListener('DOMContentLoaded', function() {
  console.log('🔍 [FEATURED DEBUG] DOM loaded event fired');
  console.log('🔍 [FEATURED DEBUG] Page title:', document.title);
  initializeScraper();
});

// Also try to initialize if we're loaded after DOM is already ready
if (document.readyState === 'interactive' || document.readyState === 'complete') {
  console.log('🔍 [FEATURED DEBUG] DOM already loaded, state:', document.readyState);
  console.log('🔍 [FEATURED DEBUG] Initializing immediately');
  initializeScraper();
}

/* global chrome */

/**
 * Initialize the scraper without dynamic imports (CSP compliant)
 */
async function initializeScraper() {
  try {
    console.log('🔍 [FEATURED DEBUG] Initializing Featured.com scraper...');
    console.log('🔍 [FEATURED DEBUG] Current URL:', window.location.href);
    console.log('🔍 [FEATURED DEBUG] Pathname:', window.location.pathname);
    
    // Use global logManager injected from script tags in proper order
    console.log('🔍 [FEATURED DEBUG] Using global logManager...');
    let logManager;
    if (window.logManager) {
      logManager = window.logManager;
      console.log('🔍 [FEATURED DEBUG] Found global logManager');
    } else {
      console.error('🔍 [FEATURED DEBUG] Global logManager not found');
      // Create fallback logger
      logManager = {
        log: (msg) => console.log('🔍 [FEATURED FALLBACK]', msg),
        debug: (msg) => console.debug('🔍 [FEATURED FALLBACK]', msg),
        error: (msg, err) => console.error('🔍 [FEATURED FALLBACK]', msg, err)
      };
    }
    
    // Access the scrapers module from the global window object (loaded via script tag)
    console.log('🔍 [FEATURED DEBUG] Accessing global scrapers module...');
    let scrapers;
    if (window.scrapers) {
      scrapers = window.scrapers;
      console.log('🔍 [FEATURED DEBUG] Found global scrapers module');
    } else {
      console.error('🔍 [FEATURED DEBUG] Global scrapers module not found');
      throw new Error('Failed to access global scrapers module - ensure it is loaded before this script');
    }
    
    // Access the Featured scraper module from the global window object
    console.log('🔍 [FEATURED DEBUG] Accessing global featuredScraper...');
    let featuredScraper;
    if (window.featuredScraper) {
      featuredScraper = window.featuredScraper;
      console.log('🔍 [FEATURED DEBUG] Found global featuredScraper');
    } else {
      console.error('🔍 [FEATURED DEBUG] Global featuredScraper not found');
      throw new Error('Failed to access global featuredScraper - ensure it is loaded before this script');
    }
    
    // Register the scraper if not already registered
    console.log('🔍 [FEATURED DEBUG] Checking if featuredScraper needs registration');
    if (!scrapers.isRegistered('featured')) {
      console.log('🔍 [FEATURED DEBUG] Registering featuredScraper with scrapers registry');
      scrapers.register('featured', featuredScraper);
    }
    
    // Check if we're on a Featured.com questions page - now supports both /questions and /experts/questions
    const onFeaturedHost = location.host.endsWith('featured.com');
    const onQuestionsPage = location.pathname.startsWith('/questions') ||
                           location.pathname.startsWith('/experts/questions');
    
    console.log('🔍 [FEATURED DEBUG] URL check results:', {
      onFeaturedHost,
      onQuestionsPage,
      fullPath: location.pathname
    });
    
    if (onFeaturedHost && onQuestionsPage) {
      logManager.log('On Featured.com questions page, initializing scraper');
      console.log('🔍 [FEATURED DEBUG] On correct page, will initialize scraper');
      
      // Examine the page structure
      console.log('🔍 [FEATURED DEBUG] Page structure analysis:');
      console.log('🔍 [FEATURED DEBUG] Title:', document.title);
      console.log('🔍 [FEATURED DEBUG] Meta description:', document.querySelector('meta[name="description"]')?.content);
      console.log('🔍 [FEATURED DEBUG] Question elements:', document.querySelectorAll('.question-card, .question-item, [data-testid="question"]').length);
      
      // Initialize with a slight delay to ensure page is fully loaded
      const delay = 1000 + Math.random() * 1000;
      console.log(`🔍 [FEATURED DEBUG] Initializing scraper with ${delay}ms delay`);
      
      setTimeout(() => {
        console.log('🔍 [FEATURED DEBUG] Delay complete, calling featuredScraper.init()');
        featuredScraper.init();
      }, delay);
    } else {
      logManager.log('Not on a Featured.com questions page, skipping scraper initialization');
      console.log('🔍 [FEATURED DEBUG] Not on a questions page, skipping initialization');
    }
  } catch (error) {
    console.error('🔍 [FEATURED DEBUG] Error initializing Featured.com scraper:', error);
    console.error('🔍 [FEATURED DEBUG] Error stack:', error.stack);
  }
}