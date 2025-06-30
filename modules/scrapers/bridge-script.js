// Bridge script to safely expose scrapers on window and dispatch events
console.log('💬 [QWOTED BRIDGE] Running bridge script');
console.log('💬 [QWOTED BRIDGE] window.scrapers:', window.scrapers);
console.log('💬 [QWOTED BRIDGE] window.scrapersRegistryLoaded:', window.scrapersRegistryLoaded);

// Create a direct proxy for the content script
function createContentScriptProxy() {
  try {
    // Create an element to communicate with content script
    const bridgeElement = document.createElement('div');
    bridgeElement.id = 'qwoted-scrapers-bridge';
    bridgeElement.style.display = 'none';
    document.body.appendChild(bridgeElement);
    
    // Stringify the scrapers registry state for cross-context transfer
    const scrapersInfo = {
      initialized: true,
      timestamp: Date.now(),
      scrapersAvailable: !!window.scrapers,
      qwotedScraperAvailable: !!window.qwotedScraper
    };
    
    // Store data as attribute for cross-context access
    bridgeElement.setAttribute('data-scrapers-info', JSON.stringify(scrapersInfo));
    
    // Try to populate sessionStorage as another communication channel
    try {
      sessionStorage.setItem('qwoted_scrapers_bridge', JSON.stringify(scrapersInfo));
      sessionStorage.setItem('qwoted_scrapers_timestamp', Date.now().toString());
    } catch (storageErr) {
      console.warn('💬 [QWOTED BRIDGE] SessionStorage error:', storageErr);
    }
    
    // Critical: Dispatch event for content script to detect
    document.dispatchEvent(new CustomEvent('scrapers-available', {
      detail: scrapersInfo
    }));
    
    console.log('💬 [QWOTED BRIDGE] Content script proxy created');
    return true;
  } catch (err) {
    console.error('💬 [QWOTED BRIDGE] Error creating content script proxy:', err);
    return false;
  }
}

// Try to access window.scrapers with a retry mechanism
let bridgeRetries = 0;
function checkScrapers() {
  // Check for window.scrapers OR window.scrapersRegistryLoaded flag
  if (window.scrapers || window.scrapersRegistryLoaded) {
    console.log('💬 [QWOTED BRIDGE] window.scrapers found after retry:', window.scrapers);
    
    // Create the proxy for content script access
    createContentScriptProxy();
    
    // Create a mock scrapers object in window._contentScrapers for cross-context access
    window._contentScrapers = {
      initialized: true,
      timestamp: Date.now()
    };
    
    // IMPORTANT: Create a fake "scrapers" property on window
    // This won't be visible to content scripts directly, but helps track state
    try {
      Object.defineProperty(window, '_scrapersProxy', {
        value: {
          initialized: true,
          available: true,
          qwotedAvailable: true
        },
        writable: false
      });
    } catch (propError) {
      console.warn('💬 [QWOTED BRIDGE] Error defining property:', propError);
    }
    
    // Dispatch multiple events to increase chances of detection
    document.dispatchEvent(new CustomEvent('scrapers-ready', { 
      detail: { success: true } 
    }));
    
    document.dispatchEvent(new CustomEvent('qwoted-scrapers-ready', { 
      detail: { 
        success: true,
        timestamp: Date.now()
      } 
    }));
    return;
  }
  
  bridgeRetries++;
  if (bridgeRetries > 20) {
    console.error('💬 [QWOTED BRIDGE] Reached max retries waiting for window.scrapers');
    
    // If all retries exhausted, create a robust fallback scrapers registry
    console.log('💬 [QWOTED BRIDGE] Creating fallback scrapers registry after max retries');
    window.scrapers = {
      register: function(name, scraper) {
        console.log(`💬 [QWOTED BRIDGE] Registering ${name} in fallback registry`);
        window[name + 'Scraper'] = scraper;
        return true;
      },
      isInitialized: function() { return true; },
      initialized: true,
      get: function(name) {
        return window[name + 'Scraper'] || null;
      },
      getAll: function() {
        // Return an object with all registered scrapers by name
        const result = {};
        if (window.qwotedScraper) result.qwoted = window.qwotedScraper;
        if (window.featuredScraper) result.featured = window.featuredScraper;
        if (window.sourcebottleScraper) result.sourcebottle = window.sourcebottleScraper;
        return result;
      }
    };
    
    // Flag to indicate registry is available
    window.scrapersRegistryLoaded = true;
    
    // Create a proxy with the registry info
    const bridgeElement = document.createElement('div');
    bridgeElement.id = 'qwoted-scrapers-bridge';
    bridgeElement.style.display = 'none';
    bridgeElement.setAttribute('data-scrapers-fallback', 'true');
    bridgeElement.setAttribute('data-scrapers-loaded', 'true');
    document.body.appendChild(bridgeElement);
    
    // Create the content script proxy
    createContentScriptProxy();
    
    // Dispatch success event since we created a fallback
    document.dispatchEvent(new CustomEvent('scrapers-ready', { 
      detail: { success: true, fallback: true }
    }));
    return;
  }
  
  console.log(`💬 [QWOTED BRIDGE] Retry ${bridgeRetries}/20 waiting for window.scrapers...`);
  setTimeout(checkScrapers, 100);
}

// Start checking for window.scrapers right away
checkScrapers();
