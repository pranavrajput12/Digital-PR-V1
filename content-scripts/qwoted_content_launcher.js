/**
 * Qwoted.com Content Launcher
 *
 * This content script is injected into Qwoted.com pages matching the manifest patterns.
 * It detects when the page is ready and loads the appropriate scraper module.
 *
 * DEBUG MODE: Intensive console logging is enabled
 *
 * This launcher now provides real-time visual feedback through a notification UI
 * when scraping is in progress.
 */

/* global chrome */  // Chrome extension API is available in content scripts

console.log('💬 [QWOTED DEBUG] Content launcher loaded - ' + new Date().toISOString());
console.log('💬 [QWOTED DEBUG] URL:', window.location.href);
console.log('💬 [QWOTED DEBUG] Document state:', document.readyState);

// Function to safely add notification
function showNotification(message) {
  try {
    // Create notification container if it doesn't exist
    let notification = document.getElementById('qwoted-scraper-notification');
    if (!notification) {
      notification = document.createElement('div');
      notification.id = 'qwoted-scraper-notification';
      notification.style.position = 'fixed';
      notification.style.bottom = '20px';
      notification.style.right = '20px';
      notification.style.padding = '10px 20px';
      notification.style.backgroundColor = '#4CAF50';
      notification.style.color = 'white';
      notification.style.borderRadius = '4px';
      notification.style.zIndex = '10000';
      notification.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
      notification.style.fontFamily = 'Arial, sans-serif';
      notification.style.fontSize = '14px';
      
      // Only add to DOM if body is available
      if (document.body) {
        document.body.appendChild(notification);
      } else {
        return; // Skip if body isn't available
      }
    }
    
    // Update notification content
    notification.textContent = message || 'Qwoted Scraper is active';
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
      if (notification && notification.parentNode) {
        notification.style.opacity = '0';
        setTimeout(() => {
          if (notification && notification.parentNode) {
            notification.parentNode.removeChild(notification);
          }
        }, 500);
      }
    }, 5000);
    
  } catch (error) {
    console.error('❌ [QWOTED] Error showing notification:', error);
  }
}

// Show initial notification
showNotification();

// Function to inject the scraper script
function injectScraperScript() {
  return new Promise((resolve) => {
    console.log(' [QWOTED] Injecting scraper script...');
    
    // Create a script element to inject our code
    const script = document.createElement('script');
    
    // Create a unique ID for our script
    const scriptId = 'qwoted-scraper-bundle';
    
    // Remove any existing script with the same ID
    const existingScript = document.getElementById(scriptId);
    if (existingScript) {
      existingScript.remove();
    }
    
    // Set the script ID
    script.id = scriptId;
    
    // Create the script content as a data URL to avoid CSP issues with inline scripts
    const scriptContent = `
      // BaseScraper class
      class BaseScraper {
        constructor() {
          this.platform = 'base';
          this.opportunities = [];
          this.isInitialized = false;
          console.log('[QWOTED] BaseScraper initialized');
        }
        
        async init() {
          this.isInitialized = true;
          return true;
        }
        
        async scrape() {
          throw new Error('Scrape method must be implemented by child class');
        }
      }
      
      // QwotedScraper class
      class QwotedScraper extends BaseScraper {
        constructor() {
          super();
          this.platform = 'qwoted';
          console.log('[QWOTED] QwotedScraper initialized');
        }
        
        async init() {
          await super.init();
          console.log('[QWOTED] Initializing Qwoted scraper...');
          return true;
        }
        
        // Show a live status popup similar to Source Bottle
        showStatusPopup(message, isDone = false) {
          let popup = document.getElementById('qwoted-scraper-status-popup');
          if (!popup) {
            popup = document.createElement('div');
            popup.id = 'qwoted-scraper-status-popup';
            popup.style.position = 'fixed';
            popup.style.top = '20px';
            popup.style.right = '20px';
            popup.style.background = '#222';
            popup.style.color = '#fff';
            popup.style.padding = '16px 24px';
            popup.style.borderRadius = '8px';
            popup.style.zIndex = 99999;
            popup.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)';
            popup.style.fontFamily = 'inherit';
            popup.style.fontSize = '16px';
            document.body.appendChild(popup);
          }
          popup.textContent = message;
          popup.style.display = 'block';
          if (isDone) {
            setTimeout(() => { popup.style.display = 'none'; }, 2500);
          }
        }

        // Placeholder for infinite scroll support (future enhancement)
        async scrapeAllPages() {
          // For now, just scrape the current page. Infinite scroll support can be added here.
          return await this.scrape();
        }

        async scrape() {
          this.showStatusPopup('Qwoted: Scraping opportunities...');
          console.log('[QWOTED] Starting to scrape Qwoted...');
          try {
            const opportunities = [];
            const cards = document.querySelectorAll('.source-request-card');
            cards.forEach((card, index) => {
              try {
                const title = card.querySelector('h6 a')?.textContent.trim() || 'No title';
                const url = card.querySelector('h6 a')?.href || window.location.href;
                const description = card.querySelector('.font-size-12px')?.textContent.trim() || 'No description';
                opportunities.push({
                  id: 'qwoted-' + Date.now() + '-' + index,
                  title,
                  url,
                  description,
                  platform: 'qwoted',
                  timestamp: new Date().toISOString(),
                });
              } catch (e) {
                console.error('[QWOTED] Error parsing opportunity card:', e);
              }
            });
            console.log('[QWOTED] Found ' + opportunities.length + ' opportunities');
            this.showStatusPopup('Qwoted: Found ' + opportunities.length + ' opportunities', true);
            // Send to backend if any
            if (opportunities.length > 0 && typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
              chrome.runtime.sendMessage({
                type: 'OPPORTUNITIES_EXTRACTED',
                platform: 'qwoted',
                opportunities
              }, (response) => {
                console.log('[QWOTED] Opportunities sent to backend', response);
              });
            }
            return opportunities;
          } catch (error) {
            console.error('[QWOTED] Error in scrape:', error);
            this.showStatusPopup('Qwoted: Error during scraping', true);
            throw error;
          }
        }
      }
      
      // Initialize the scraper and expose it to the window
      (function() {
        try {
          window.qwotedScraper = new QwotedScraper();
          
          // Use a promise to handle async initialization
          var initPromise = window.qwotedScraper.init()
            .then(function() {
              console.log('[QWOTED] Scraper initialized successfully');
              
              function registerWithRegistry() {
                try {
                  if (window.scrapers && typeof window.scrapers.register === 'function') {
                    var registered = window.scrapers.register('Qwoted', window.qwotedScraper);
                    console.log('[QWOTED] Scraper ' + (registered ? 'registered' : 'registration failed') + ' with scrapers registry');
                    return true;
                  }
                } catch (e) {
                  console.error('[QWOTED] Error registering with scrapers registry:', e);
                }
                return false;
              }

              // Try to register immediately
              if (!registerWithRegistry()) {
                console.log('[QWOTED] Scrapers registry not available yet, will retry...');
                // Set up a retry mechanism
                var maxRetries = 10;
                var retryCount = 0;
                
                var tryRegister = setInterval(function() {
                  if (registerWithRegistry()) {
                    clearInterval(tryRegister);
                  } else if (retryCount >= maxRetries) {
                    clearInterval(tryRegister);
                    console.warn('[QWOTED] Failed to register with scrapers registry after multiple attempts');
                    // Create a fallback registry if all retries fail
                    if (!window.scrapers) {
                      window.scrapers = {
                        register: function(name, scraper) {
                          console.log('[QWOTED] Created fallback registry for:', name);
                          window[name + 'Scraper'] = scraper;
                          return true;
                        }
                      };
                      window.scrapers.register('Qwoted', window.qwotedScraper);
                    }
                  }
                  retryCount++;
                }, 500);
              }  
                
              // Dispatch event to notify that scraper is ready
              document.dispatchEvent(new CustomEvent('qwotedScraperReady', {
                detail: { success: true }
              }));
            })
            .catch(function(error) {
              console.error('[QWOTED] Failed to initialize scraper:', error);
              document.dispatchEvent(new CustomEvent('qwotedScraperError', {
                detail: { error: error && error.message ? error.message : 'Unknown error' }
              }));
            });
            
          // Store the promise in case other scripts need to wait for initialization
          window.qwotedScraper.initialized = initPromise;
          
        } catch (error) {
          console.error('[QWOTED] Error in scraper initialization:', error);
          document.dispatchEvent(new CustomEvent('qwotedScraperError', {
            detail: { error: error && error.message ? error.message : 'Unknown error' }
          }));
        }
      })();
    `;
    
    // Create a data URL with the script content
    const dataUrl = 'data:text/javascript;charset=utf-8,' + encodeURIComponent(scriptContent);
    
    // Set the script source to the data URL
    script.src = dataUrl;
    
    // Handle script load
    script.onload = function() {
      console.log('[QWOTED] Scraper script injected successfully');
      resolve();
    };
    
    script.onerror = function(error) {
      console.error('[QWOTED] Error injecting scraper script:', error);
      resolve(); // Resolve anyway to prevent blocking
    };
    
    // Add to the page
    (document.head || document.documentElement).appendChild(script);
    
    // Set a timeout to clean up the script element
    setTimeout(function() {
      try {
        if (script.parentNode) {
          script.parentNode.removeChild(script);
        }
      } catch (e) {
        console.error('[QWOTED] Error removing script element:', e);
      }
    }, 5000); // Increased timeout to 5 seconds to ensure script has time to execute
  });
}

// Function to initialize the scraper and ensure registry, registration, auto-start, and notification
async function initializeScraper() {
  try {
    console.log('💬 [QWOTED] Initializing Qwoted scraper...');

    // Inject the scraper script
    await injectScraperScript();
    // Wait a moment for the script to execute
    await new Promise(resolve => setTimeout(resolve, 500));

    // Ensure fallback registry exists if missing
    if (!window.scrapers) {
      console.log('💬 [QWOTED] Creating fallback scrapers registry');
      window.scrapers = {
        register: function(name, scraper) {
          window[name + 'Scraper'] = scraper;
          return true;
        },
        get: function(name) {
          return window[name + 'Scraper'] || null;
        },
        getAll: function() {
          const result = {};
          if (window.qwotedScraper) result.qwoted = window.qwotedScraper;
          return result;
        }
      };
    }

    // Check if the scraper is available
    if (window.qwotedScraper) {
      console.log('✅ [QWOTED] Scraper initialized successfully');
      // Register the scraper
      window.scrapers.register('qwoted', window.qwotedScraper);
      // Initialize the scraper
      try {
        await window.qwotedScraper.init();
        console.log('✅ [QWOTED] Scraper init completed');
        // Show popup at start
        showNotification('Qwoted: Scraping opportunities...');
        // Auto-trigger scraping
        if (typeof window.qwotedScraper.scrape === 'function') {
          showNotification('Qwoted: Scraping opportunities...');
          window.qwotedScraper.scrape().then(opportunities => {
            // Show popup at completion
            showNotification(`Qwoted: Scraped ${opportunities.length} opportunities!`);
            // Send to backend
            if (Array.isArray(opportunities) && opportunities.length > 0 && typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
              chrome.runtime.sendMessage({
                type: 'OPPORTUNITIES_EXTRACTED',
                platform: 'qwoted',
                opportunities
              }, (response) => {
                console.log('[QWOTED] Opportunities sent to backend', response);
              });
            }
          }).catch(error => {
            showNotification('Qwoted: Error during scraping');
            console.error('[QWOTED] Error in scrape:', error);
          });
        }
        // Dispatch event that scraper is ready
        const event = new CustomEvent('qwoted-scraper-ready', { detail: { scraper: window.qwotedScraper } });
        window.dispatchEvent(event);
      } catch (initError) {
        showNotification('Qwoted: Scraper init error');
        console.error(' [QWOTED] Error initializing scraper:', initError);
      }
    } else {
      const error = new Error('Scraper not found in window object');
      showNotification('Qwoted: Scraper not found');
      console.error(' [QWOTED]', error.message);
      throw error;
    }
  } catch (error) {
    showNotification('Qwoted: Fatal error');
    console.error(' [QWOTED] Error in initializeScraper:', error);
    throw error;
  }
}


// Function to initialize the scraper when the page is ready
function initializeWhenReady() {
  console.log(' [QWOTED] Checking page readiness...');
  
  // Check if we're on a Qwoted page that needs the scraper
  if (window.location.href.includes('app.qwoted.com/opportunities') || 
      window.location.href.includes('app.qwoted.com/source_requests')) {
    console.log(' [QWOTED] On Qwoted opportunities page, initializing scraper...');
    
    // Try to initialize immediately if DOM is already ready
    if (document.readyState === 'loading') {
      console.log(' [QWOTED] Waiting for DOM to be ready...');
      document.addEventListener('DOMContentLoaded', () => {
        console.log(' [QWOTED] DOMContentLoaded fired');
        console.log(' [QWOTED] Page title:', document.title);
        initializeScraper().catch(console.error);
      });
    } else {
      console.log(' [QWOTED] DOM already ready');
      console.log(' [QWOTED] Page title:', document.title);
      initializeScraper().catch(console.error);
    }
  } else {
    console.log(' [QWOTED] Not on a Qwoted opportunities page, skipping initialization');
  }
}

// Start the initialization process with error handling
if (typeof initializeWhenReady === 'function') {
  try {
    initializeWhenReady();
  } catch (error) {
    console.error('❌ [QWOTED] Fatal error in initialization:', error);
  }
} else {
  console.error('❌ [QWOTED] initializeWhenReady function not found');
}

/**
 * Initialize the scraper by dynamically importing the scraper module
 */
async function initializeScraper() {
  try {
    console.log('💬 [QWOTED DEBUG] Initializing Qwoted.com scraper...');
    console.log('💬 [QWOTED DEBUG] Current URL:', window.location.href);
    
    // Create a simple logger that doesn't require dynamic imports
    const logManager = {
      log: (msg, ...args) => {
        console.log(`💬 [QWOTED] ${msg}`, ...args);
      },
      debug: (msg, ...args) => {
        console.debug(`🐛 [QWOTED DEBUG] ${msg}`, ...args);
      },
      error: (msg, ...args) => {
        console.error(`❌ [QWOTED ERROR] ${msg}`, ...args);
      },
      warn: (msg, ...args) => {
        console.warn(`⚠️ [QWOTED WARN] ${msg}`, ...args);
      }
    };
    
    // Make logManager available globally for other scripts
    window.logManager = logManager;
    
    logManager.debug('Logger initialized successfully');
    
    // Inject the scraper script into the page
    await injectScraperScript();
    
    // Define BaseScraper first if not available (to prevent errors)
    let BaseScraper = window.BaseScraper || class BaseScraper {
      constructor(storageKey, name) {
        this.storageKey = storageKey;
        this.name = name;
        this.processedItems = new Set();
        this.debugLog(`Base scraper instantiated with key ${storageKey}`);
      }
      
      debugLog(message) {
        console.log(`💬 [${this.name.toUpperCase()} DEBUG] ${message}`);
      }
      
      async init() { return true; }
    };
    
    // Define QwotedScraper class in the content script context to avoid isolation issues
    class QwotedScraper extends BaseScraper {
      constructor() {
        super('qwotedOpportunities', 'Qwoted');
        console.log('💬 [QWOTED CONTENT] Local QwotedScraper instantiated in content script');
      }
      
      // Basic implementation to allow registration with scrapers registry
      async init() {
        console.log('💬 [QWOTED CONTENT] Local scraper init called');
        return true;
      }
      
      async scrapeOpportunities() {
        console.log('💬 [QWOTED CONTENT] Delegating to injected scraper...');
        // This version just delegates to the real scraper
        return [];
      }
    }
  } catch (error) {
    console.error('💬 [QWOTED DEBUG] Error in initializeScraper:', error);
    console.error('💬 [QWOTED DEBUG] Error stack:', error.stack);
  }
}

// Declare important variables that were previously undeclared
let qwotedScraper;
let logManager = console;

/**
 * Load and initialize the scraper modules in sequence
 */
async function loadScraperModules() {
  console.log('💬 [QWOTED DEBUG] Loading scraper modules in sequence - ' + new Date().toISOString());
  
  try {
    // Get the URL to the modules
    const baseScraperUrl = chrome.runtime.getURL('modules/scrapers/base-scraper.js');
    const storageMergeUrl = chrome.runtime.getURL('modules/scrapers/storage-merge.js');
    const indexUrl = chrome.runtime.getURL('modules/scrapers/index.js');
    const qwotedScraperUrl = chrome.runtime.getURL('modules/scrapers/qwoted-scraper.js');
    
    console.log('💬 [QWOTED DEBUG] Will load scripts in sequence from URLs:', {
      baseScraperUrl,
      storageMergeUrl,
      indexUrl,
      qwotedScraperUrl
    });
    
    // We'll now use a more controlled sequential loading approach to ensure proper dependency chain
    
    // First load base-scraper.js
    console.log('💬 [QWOTED DEBUG] 1/4 Loading base-scraper.js');
    await new Promise((resolve, reject) => {
      const baseScript = document.createElement('script');
      baseScript.src = baseScraperUrl;
      baseScript.type = 'text/javascript';
      baseScript.onload = function() {
        console.log('💬 [QWOTED DEBUG] base-scraper.js loaded');
        resolve();
      };
      baseScript.onerror = function(error) {
        console.error('💬 [QWOTED DEBUG] Error loading base-scraper.js:', error);
        reject(error);
      };
      document.head.appendChild(baseScript);
    });
    
    // Then load storage-merge.js
    console.log('💬 [QWOTED DEBUG] 2/4 Loading storage-merge.js');
    await new Promise((resolve, reject) => {
      const storageScript = document.createElement('script');
      storageScript.src = storageMergeUrl;
      storageScript.type = 'text/javascript';
      storageScript.onload = function() {
        console.log('💬 [QWOTED DEBUG] storage-merge.js loaded');
        // Check if window.storageUtils is defined
        if (window.storageUtils) {
          console.log('💬 [QWOTED DEBUG] window.storageUtils available after loading');
        } else {
          console.warn('💬 [QWOTED DEBUG] window.storageUtils not available immediately after loading');
        }
        resolve();
      };
      storageScript.onerror = function(error) {
        console.error('💬 [QWOTED DEBUG] Error loading storage-merge.js:', error);
        reject(error);
      };
      document.head.appendChild(storageScript);
    });
    
    // Then load index.js which requires both above
    console.log('💬 [QWOTED DEBUG] 3/4 Loading index.js');
    await new Promise((resolve, reject) => {
      const indexScript = document.createElement('script');
      indexScript.src = indexUrl;
      indexScript.type = 'text/javascript';
      indexScript.onload = function() {
        console.log('💬 [QWOTED DEBUG] index.js loaded successfully');
        // Check if scrapers is exposed immediately
        if (window.scrapers) {
          console.log('💬 [QWOTED DEBUG] window.scrapers immediately available after loading');
        } else {
          console.warn('💬 [QWOTED DEBUG] window.scrapers not available immediately');
        }
        resolve();
      };
      indexScript.onerror = function(error) {
        console.error('💬 [QWOTED DEBUG] Error loading index.js:', error);
        reject(error);
      };
      document.head.appendChild(indexScript);
    });
    
    // Finally load qwoted-scraper.js
    console.log('💬 [QWOTED DEBUG] 4/4 Loading qwoted-scraper.js');
    await new Promise((resolve, reject) => {
      const scraperScript = document.createElement('script');
      scraperScript.src = qwotedScraperUrl;
      scraperScript.type = 'text/javascript';
      scraperScript.onload = function() {
        console.log('💬 [QWOTED DEBUG] qwoted-scraper.js loaded successfully');
        resolve();
      };
      scraperScript.onerror = function(error) {
        console.error('💬 [QWOTED DEBUG] Failed to load qwoted-scraper.js:', error);
        reject(new Error('Failed to load qwoted-scraper.js'));
      };
      document.head.appendChild(scraperScript);
    });
    console.log('💬 [QWOTED DEBUG] All scripts loaded - waiting for scrapers to be initialized');
    
    // Wait a moment to ensure scripers registry is initialized before adding bridge
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Now load the bridge script that handles communication between contexts
    console.log('💬 [QWOTED DEBUG] Loading bridge script...');
    await new Promise((resolve, reject) => {
      const bridgeScript = document.createElement('script');
      bridgeScript.src = chrome.runtime.getURL('modules/scrapers/bridge-script.js');
      bridgeScript.type = 'text/javascript';
      bridgeScript.onload = () => {
        console.log('💬 [QWOTED DEBUG] Bridge script executed');
        resolve();
      };
      bridgeScript.onerror = (error) => {
        console.error('💬 [QWOTED DEBUG] Failed to load bridge script:', error);
        resolve(); // Continue even if bridge script fails
      };
      document.head.appendChild(bridgeScript);
    });
    
    console.log('💬 [QWOTED DEBUG] All scripts loaded sequentially');
    console.log('💬 [QWOTED DEBUG] Scripts loaded timestamp:', new Date().toISOString());

    // Check which scripts actually loaded
    console.log('💬 [QWOTED DEBUG] window.BaseScraper available:', !!window.BaseScraper);
    console.log('💬 [QWOTED DEBUG] window.storageUtils available:', !!window.storageUtils);
    console.log('💬 [QWOTED DEBUG] window.scrapers available:', !!window.scrapers);
    console.log('💬 [QWOTED DEBUG] window.qwotedScraper available:', !!window.qwotedScraper);
    
    // Wait for the scrapers-ready event to be dispatched
    await new Promise((resolve, reject) => {
      // Check immediately in case the event was already fired
      if (window.scrapers) {
        console.log('💬 [QWOTED DEBUG] Scrapers already available before event');
        resolve();
        return;
      }
      
      // Set a timeout to prevent hanging indefinitely
      const timeoutId = setTimeout(() => {
        console.log('💬 [QWOTED DEBUG] Timeout waiting for scrapers-ready event, checking if scrapers exists anyway');
        if (window.scrapers) {
          console.log('💬 [QWOTED DEBUG] window.scrapers exists despite no event');
          resolve();
        } else {
          // Create a fallback scrapers instance
          console.warn('💬 [QWOTED DEBUG] Creating fallback scrapers registry');
          try {
            // Minimal ScrapersRegistry implementation
            window.scrapers = {
              register: function(name, scraper) {
                console.log(`💬 [QWOTED DEBUG] Fallback registry registering ${name}`);
                return true;
              },
              initialized: true
            };
            resolve();
          } catch (fallbackError) {
            reject(new Error('Failed to create fallback scrapers registry'));
          }
        }
      }, 2000);
      
      document.addEventListener('scrapers-ready', (event) => {
        clearTimeout(timeoutId);
        if (event.detail.success) {
          console.log('💬 [QWOTED DEBUG] Scrapers are ready');
          resolve();
        } else {
          console.warn('💬 [QWOTED DEBUG] Scrapers-ready event fired, but indicates failure');
          console.warn('💬 [QWOTED DEBUG] Detail:', event.detail);
          // Still resolve as we have a fallback
          resolve();
        }
      });
    });
    
    // Diagnose window object to see what might be happening
    console.log('💬 [QWOTED DEBUG] Checking window.scrapers availability');
    console.log('💬 [QWOTED DEBUG] Current window object keys:', Object.keys(window).filter(k => k.includes('scraper')));
    console.log('💬 [QWOTED DEBUG] scrapersRegistryLoaded flag:', window.scrapersRegistryLoaded);
    console.log('💬 [QWOTED DEBUG] window.scrapers currently:', window.scrapers);
    
    // Define the scrapers global if it doesn't exist (only as a fallback)
    if (!window.scrapers) {
      console.warn('💬 [QWOTED DEBUG] window.scrapers is missing! Attempting workaround...');
      
      // Try to find ScrapersRegistry class and create a new instance as a fallback
      window.scrapers = {
        register: function(name, constructor) {
          console.log(`💬 [QWOTED DEBUG] Content context registering ${name}`);
          window[name + 'Scraper'] = constructor;
          return true;
        }
      };
      console.log('💬 [QWOTED DEBUG] Created fallback scrapers registry');
    }
    
    // Add a retry mechanism with timeout to check if window.scrapers becomes available
    await new Promise((resolve, reject) => {
      // Check if window.storageUtils is defined after loading the script
      if (!window.storageUtils) {
        console.log('💬 [QWOTED DEBUG] window.storageUtils not defined after script load!');
        
        // Add an event listener to detect when storageUtils is ready
        document.addEventListener('storage-utils-ready', function storageUtilsReadyHandler(event) {
          console.log('💬 [QWOTED DEBUG] Received storage-utils-ready event:', event.detail);
          document.removeEventListener('storage-utils-ready', storageUtilsReadyHandler);
        });
      } 
      // Check if window.scrapers is already available
      if (window.scrapers) {
        console.log('💬 [QWOTED DEBUG] window.scrapers immediately available');
        return resolve(window.scrapers);
      }
      
      // Listen for notification sound requests from background script
      const runtime = typeof chrome !== 'undefined' ? chrome.runtime : browser.runtime;

      runtime.onMessage.addListener((request, sender, sendResponse) => {});
      
      // Handler for scrapers-ready event
      eventHandlers.scrapersReady = function(event) {
        console.log('💬 [QWOTED DEBUG] Received scrapers-ready event');
        document.removeEventListener('scrapers-ready', eventHandlers.scrapersReady);
        resolve(window.scrapers);
      };

      // Handler for storage-merge-ready event
      eventHandlers.storageMergeReady = function(event) {
        console.log('💬 [QWOTED DEBUG] Received storage-merge-ready event');
        document.removeEventListener('storage-merge-ready', eventHandlers.storageMergeReady);
      };

      // Handler for qwoted-scrapers-ready event from bridge script
      eventHandlers.qwotedScrapersReady = function(event) {
        console.log('💬 [QWOTED DEBUG] Received qwoted-scrapers-ready event:', event.detail);
        // Create a minimal scrapers registry if we need to
        if (!window.scrapers) {
          console.log('💬 [QWOTED DEBUG] Creating fallback scrapers registry');
          window.scrapers = {
            register: function(name, scraper) {
              console.log(`💬 [QWOTED DEBUG] Registering ${name} in fallback registry`);
              // Store directly on window using the standard naming convention
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
        }
        document.removeEventListener('qwoted-scrapers-ready', eventHandlers.qwotedScrapersReady);
        clearInterval(intervalId);
        resolve(window.scrapers);
      };

      document.addEventListener('scrapers-ready', eventHandlers.scrapersReady);
      document.addEventListener('storage-merge-ready', eventHandlers.storageMergeReady);
      document.addEventListener('qwoted-scrapers-ready', eventHandlers.qwotedScrapersReady);

      // Set up a retry counter and interval
      let retriesCounter = 0;
      const maxRetriesAllowed = 20;
      const retryIntervalTime = 200;
      
      // Create a robust fallback scrapers registry that matches the original
      function createFallbackScrapersRegistry() {
        console.log('💬 [QWOTED DEBUG] Creating fallback scrapers registry');
        return {
          register: function(name, scraper) {
            console.log(`💬 [QWOTED DEBUG] Registering ${name} in fallback registry`);
            // Store directly on window using the standard naming convention
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
      }

      // 3. Listen for scrapers-ready (legacy)
      eventHandlers.scrapersReady = function(event) {
        console.log('💬 [QWOTED DEBUG] Received scrapers-ready event:', event.detail);
        if (event.detail && event.detail.success) {
          checkForBridgeElement();
        }
      };
      document.addEventListener('scrapers-ready', eventHandlers.scrapersReady);
      
      // Function to check for the bridge element
      function checkForBridgeElement() {
        const bridgeElement = document.getElementById('qwoted-scrapers-bridge');
        if (bridgeElement) {
          try {
            const scraperInfoAttr = bridgeElement.getAttribute('data-scrapers-info');
            if (scraperInfoAttr) {
              console.log('💬 [QWOTED DEBUG] Found bridge element with data');
              // Create a minimal scrapers registry
              if (!window.scrapers) {
                window.scrapers = createFallbackScrapersRegistry();
              }
              clearInterval(intervalId);
              resolve(window.scrapers);
              return true;
            }
          } catch (e) {
            console.error('💬 [QWOTED DEBUG] Error processing bridge data:', e);
          }
        }
        return false;
      }
      
      // Set up a retry counter and interval
      let retriesCount = 0;
      const maxRetriesCount = 20;
      const retryIntervalMs = 200;
      
      // Create a robust fallback scrapers registry that matches the original
      function createFallbackScrapersRegistry() {
        console.log('💬 [QWOTED DEBUG] Creating fallback scrapers registry');
        return {
          register: function(name, scraper) {
            console.log(`💬 [QWOTED DEBUG] Registering ${name} in fallback registry`);
            // Store directly on window using the standard naming convention
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
      }
      
      // We'll use the existing retriesCount and maxRetriesCount variables
      let intervalId;
      
      // Check function that tries multiple methods
      const checkScrapers = () => {
        retriesCount++;
        console.log(`💬 [QWOTED DEBUG] Checking for scrapers (attempt ${retriesCount}/${maxRetriesCount})`);
        
        // Method 1: Direct window.scrapers check
        if (window.scrapers) {
          console.log('💬 [QWOTED DEBUG] window.scrapers found directly!', typeof window.scrapers);
          clearInterval(intervalId);
          resolve(window.scrapers);
          return;
        }
        
        // Method 2: Check for bridge element
        if (checkForBridgeElement()) {
          return;
        }
        
        // Method 3: Check sessionStorage
        try {
          const scrapersBridge = sessionStorage.getItem('qwoted_scrapers_bridge');
          if (scrapersBridge) {
            console.log('💬 [QWOTED DEBUG] Found scrapers info in sessionStorage');
            if (!window.scrapers) {
              window.scrapers = createFallbackScrapersRegistry();
            }
            clearInterval(intervalId);
            resolve(window.scrapers);
            return;
          }
        } catch (storageErr) { /* Ignore storage errors */ }
        
        // Method 4: Check if qwotedScraper exists directly
        if (window.qwotedScraper) {
          console.log('💬 [QWOTED DEBUG] Found window.qwotedScraper directly');
          if (!window.scrapers) {
            window.scrapers = createFallbackScrapersRegistry();
          }
          clearInterval(intervalId);
          resolve(window.scrapers);
          return;
        }
        
        // Give up after max retries
        if (retriesCount >= maxRetriesCount) {
          // Last resort: Create a fallback registry anyway
          console.log('💬 [QWOTED DEBUG] Creating fallback registry as last resort');
          window.scrapers = createFallbackScrapersRegistry();
        }
        clearInterval(intervalId);
        resolve(window.scrapers);
        // Return without any value to avoid issues
        return;
      }; // End of checkScrapers function

      // Set up the interval to check for scrapers
      const checkIntervalId = setInterval(checkScrapers, retryIntervalTime);
      
      // Call once immediately
      checkScrapers();
  }); // End of checkForBridgeElement Promise

  // Continue with the primary function logic
  return new Promise((resolve, reject) => {
    try {
      // Add a special test to verify script loading
      console.log('💬 [QWOTED DEBUG] Adding window event listener for testing script loading');
      
      // Listen for script load completion
      window.addEventListener('qwoted-tests-complete', function(e) {
        console.log('💬 [QWOTED DEBUG] Test event received:', e.detail);
      });
      
      // Set up a retry counter and interval
      let retriesCount = 0;
      const maxRetriesCount = 20;
      const retryIntervalMs = 200;
      
      // Attempt multiple methods to get the scraper
      // Method 1: Try to get from bridge element
      const bridgeElement = document.getElementById('qwoted-scrapers-bridge');
      if (bridgeElement) {
        console.log('💬 [QWOTED DEBUG] Found bridge element, creating local scraper');
        
        // Create a new scraper instance in the content script context
        qwotedScraper = new QwotedScraper();
        console.log('💬 [QWOTED DEBUG] Created local QwotedScraper instance');
      } 
      // Method 2: Fallback to window object (might not work due to context isolation)
      else if (window.qwotedScraper) {
        try {
          console.log('💬 [QWOTED DEBUG] Using window.qwotedScraper');
          qwotedScraper = window.qwotedScraper;
        } catch (error) {
          console.error('💬 [QWOTED DEBUG] Error using window.qwotedScraper:', error);
        }
      } 
      // Method 3: Create a new instance as last resort
      else {
        console.log('💬 [QWOTED DEBUG] Creating a new QwotedScraper instance as fallback');
        try {
          // Make sure the class is available in this context
          if (typeof QwotedScraper === 'function') {
            qwotedScraper = new QwotedScraper();
            console.log('💬 [QWOTED DEBUG] Successfully created new QwotedScraper instance');
          } else {
            throw new Error('QwotedScraper class not found in content script context');
          }
        } catch (error) {
          console.error('💬 [QWOTED DEBUG] Failed to create scraper instance:', error);
          throw new Error('Could not create or find a usable QwotedScraper instance');
        }
      }
      console.log('💬 [QWOTED DEBUG] Qwoted scraper module loaded successfully');
    
      // Check if we're on a Qwoted.com source_requests page (updated path)
      const onQwotedHost = location.hostname === 'app.qwoted.com';
      const onSourceRequestsPage = location.pathname.startsWith('/source_requests') ||
                                 location.pathname.startsWith('/opportunities'); // Support both paths
      
      console.log('💬 [QWOTED DEBUG] Final initialization check timestamp:', new Date().toISOString());
    
      console.log('💬 [QWOTED DEBUG] URL check results:', {
        onQwotedHost,
        onSourceRequestsPage,
        fullPath: location.pathname
      });
      
      // Register the scraper with the registry
      console.log('💬 [QWOTED DEBUG] Registering qwoted scraper with scrapers registry');
      window.scrapers.register('qwoted', qwotedScraper);

      if (onQwotedHost && onSourceRequestsPage) {
        logManager.log('On Qwoted.com source requests page, initializing scraper');
        console.log('💬 [QWOTED DEBUG] On correct page, will initialize scraper');
        
        // Examine the page structure
        console.log('💬 [QWOTED DEBUG] Page structure analysis:');
        console.log('💬 [QWOTED DEBUG] Title:', document.title);
        console.log('💬 [QWOTED DEBUG] Meta description:', document.querySelector('meta[name="description"]')?.content);
        console.log('💬 [QWOTED DEBUG] Request elements:', document.querySelectorAll('.request-card, .source-request, [data-testid="request"]').length);
        
        // Initialize with a slight delay to ensure page is fully loaded
        const delay = 1000 + Math.random() * 1000;
        console.log(`💬 [QWOTED DEBUG] Initializing scraper with ${delay}ms delay`);
        
        // Wrap setTimeout in try-catch for proper structure
setTimeout(() => {
  try {
    console.log('💬 [QWOTED DEBUG] Delay complete, calling qwotedScraper.init() at:', new Date().toISOString());
    console.log('💬 [QWOTED DEBUG] Explicitly checking qwoted scraper before init');

    // Check more details about the window object and available functions
    console.log('💬 [QWOTED DEBUG] Window object keys that include "scraper":',
      Object.keys(window).filter(k => k.toLowerCase().includes('scraper')));

    // Log details about the qwotedScraper object if it exists
    if (window.qwotedScraper) {
      console.log('💬 [QWOTED DEBUG] window.qwotedScraper methods:',
        Object.getOwnPropertyNames(Object.getPrototypeOf(window.qwotedScraper)));
    }
    if (window.qwotedScraper && typeof window.qwotedScraper.init === 'function') {
      console.log('💬 [QWOTED DEBUG] Found qwotedScraper in window object, calling init() at:', new Date().toISOString());
      try {
        console.log('💬 [QWOTED DEBUG] About to call window.qwotedScraper.init()');
        window.qwotedScraper.init();
        console.log('💬 [QWOTED DEBUG] window.qwotedScraper.init() call completed');
      } catch (e) {
        console.error('💬 [QWOTED DEBUG] Error calling qwotedScraper.init():', e);
      }
    } else if (qwotedScraper && typeof qwotedScraper.init === 'function') {
      console.log('💬 [QWOTED DEBUG] Found local qwotedScraper variable, calling init()');
      try {
        qwotedScraper.init();
      } catch (e) {
        console.error('💬 [QWOTED DEBUG] Error calling local qwotedScraper.init():', e);
      }
    } else {
      console.error('💬 [QWOTED DEBUG] qwotedScraper not available or missing init method!');
    }
  } catch (timeoutError) {
    console.error('💬 [QWOTED DEBUG] Error in setTimeout callback:', timeoutError);
  }
}, 1000 + Math.random() * 1000);

// Initialize the scraper when the module loads
initializeScraper();
      }
      
      // Always resolve the Promise with the scraper (or undefined if not available)
      resolve(qwotedScraper); 
    } catch (promiseError) {
      console.error('💬 [QWOTED DEBUG] Error in Promise:', promiseError);
      reject(promiseError);
    }
  }).catch(error => {
    console.error('💬 [QWOTED DEBUG] Error in loadScraperModules Promise:', error);
  });
} catch (outerError) {
  console.error('💬 [QWOTED DEBUG] Error in loadScraperModules:', outerError);
}
} // End of loadScraperModules function