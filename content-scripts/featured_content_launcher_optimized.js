/**
 * Featured Content Launcher for Optimized Scraper
 * 
 * This script is injected into the Featured.com domain and checks if we're on the 
 * questions page. If so, it loads the optimized Featured scraper.
 */

(function() {
  // Check if we're on the Featured.com domain
  if (!window.location.hostname.includes('featured.com')) {
    return;
  }
  
  console.log('🔍 [FEATURED LAUNCHER] Featured.com detected, checking for questions page...');
  
  // Check if we're on the questions page
  const isQuestionsPage = window.location.href.includes('/questions') || 
                          window.location.href.includes('/experts/questions');
  
  if (!isQuestionsPage) {
    console.log('🔍 [FEATURED LAUNCHER] Not on a questions page, skipping scraper injection');
    return;
  }
  
  console.log('🔍 [FEATURED LAUNCHER] Questions page detected, injecting optimized scraper...');
  
  // Set up global namespace for Featured globals if not already existing
  if (!window.featuredGlobals) {
    window.featuredGlobals = {
      initialized: false,
      scraperLoaded: false
    };
  }
  
  // Avoid duplicate injection
  if (window.featuredGlobals && window.featuredGlobals.scraperLoaded) {
    console.log('🔍 [FEATURED LAUNCHER] Scraper already loaded, skipping');
    return;
  }
  
  // Function to inject the optimized scraper script
  function injectOptimizedScraper() {
    try {
      // Mark as loading to prevent duplicates
      window.featuredGlobals.scraperLoaded = true;
      
      // Create script element for the optimized scraper
      const scraperScript = document.createElement('script');
      scraperScript.src = chrome.runtime.getURL('modules/scrapers/featured-scraper-optimized.js');
      scraperScript.onload = function() {
        console.log('🔍 [FEATURED LAUNCHER] Optimized scraper successfully loaded');
        
        // Initialize the scraper (the script creates a global featuredScraper object)
        setTimeout(() => {
          if (window.featuredScraper && typeof window.featuredScraper.init === 'function') {
            window.featuredScraper.init();
            console.log('🔍 [FEATURED LAUNCHER] Scraper initialized');
            
            // Auto-run the scraper after initialization
            if (typeof window.featuredScraper.run === 'function') {
              console.log('🔍 [FEATURED LAUNCHER] Auto-running scraper...');
              window.featuredScraper.run()
                .then(opportunities => {
                  console.log(`🔍 [FEATURED LAUNCHER] Auto-run complete. Found ${opportunities ? opportunities.length : 0} opportunities`);
                })
                .catch(error => {
                  console.error('🔍 [FEATURED LAUNCHER] Auto-run encountered an error:', error);
                });
            }
          } else {
            console.error('🔍 [FEATURED LAUNCHER] Failed to initialize scraper - object not available');
          }
        }, 3000); // Give more time for the page to load before auto-running
      };
      
      // Handle errors
      scraperScript.onerror = function(error) {
        console.error('🔍 [FEATURED LAUNCHER] Failed to load scraper script:', error);
        window.featuredGlobals.scraperLoaded = false; // Reset so we can try again
      };
      
      // Inject script into page
      (document.head || document.documentElement).appendChild(scraperScript);
      
    } catch (error) {
      console.error('🔍 [FEATURED LAUNCHER] Error injecting scraper:', error);
      window.featuredGlobals.scraperLoaded = false; // Reset flag on error
    }
  }
  
  // Wait for page to be fully loaded before injecting
  if (document.readyState === 'complete') {
    injectOptimizedScraper();
  } else {
    window.addEventListener('load', injectOptimizedScraper);
  }
  
  // Also set up a MutationObserver to detect if the questions container loads later
  // (Featured.com is a single-page app and might load content dynamically)
  const observer = new MutationObserver(function(mutations) {
    if (!window.featuredGlobals.scraperLoaded) {
      // Check if questions content has appeared
      const questionsContent = document.querySelector('table, div[role="table"], .question-list');
      if (questionsContent) {
        console.log('🔍 [FEATURED LAUNCHER] Questions content detected, injecting scraper');
        injectOptimizedScraper();
        observer.disconnect(); // Stop observing once we've injected
      }
    }
  });
  
  // Start observing with a delay to avoid unnecessary work if page loads quickly
  setTimeout(() => {
    if (!window.featuredGlobals.scraperLoaded) {
      observer.observe(document.body, { childList: true, subtree: true });
      console.log('🔍 [FEATURED LAUNCHER] Started observing for questions content');
    }
  }, 2000);
  
})();