/**
 * Qwoted Diagnostic Launcher
 * This script injects the diagnostic tool into the Qwoted page
 * to help identify why the scraper isn't working
 */

console.log('🔍 [QWOTED DIAGNOSTIC] Launcher loaded: ' + new Date().toISOString());

// Get the appropriate runtime API (Chrome or Firefox)
function getRuntime() {
  if (typeof chrome !== 'undefined' && chrome.runtime) {
    return chrome.runtime;
  } else if (typeof browser !== 'undefined' && browser.runtime) {
    return browser.runtime;
  }
  return null;
}

// Function to inject the diagnostic script
function injectDiagnosticScript() {
  console.log('🔍 [QWOTED DIAGNOSTIC] Injecting diagnostic script');
  
  try {
    // Create a script element with the diagnostic code directly
    const script = document.createElement('script');
    script.textContent = `
      // Run in page context
      (function() {
        // Check if scraper is available
        const checkScraper = () => {
          const scraperAvailable = !!window.qwotedScraper;
          const registryAvailable = !!window.scrapers;
          let isRegistered = false;
          let registrySources = [];
          
          if (scraperAvailable) {
            console.log('🔍 [QWOTED DIAGNOSTIC] Scraper detected in window:', true);
            console.log('🔍 [QWOTED DIAGNOSTIC] Scraper initialization state:', 
              window.qwotedScraper.initialized ? 'Initialized' : 'Not initialized');
            
            // Check if registered with scrapers registry
            if (registryAvailable) {
              try {
                // Check if Qwoted is in the registry
                registrySources = window.scrapers.getAllSources ? window.scrapers.getAllSources() : [];
                isRegistered = registrySources.includes('Qwoted');
                
                console.log('🔍 [QWOTED DIAGNOSTIC] Scrapers registry available');
                console.log('🔍 [QWOTED DIAGNOSTIC] Registered sources:', registrySources);
                console.log('🔍 [QWOTED DIAGNOSTIC] Qwoted registered:', isRegistered);
                
                // If not registered but we have the scraper, try to register it
                if (!isRegistered && window.qwotedScraper) {
                  console.log('🔍 [QWOTED DIAGNOSTIC] Attempting to register Qwoted scraper...');
                  isRegistered = window.scrapers.register('Qwoted', window.qwotedScraper);
                  console.log('🔍 [QWOTED DIAGNOSTIC] Registration result:', isRegistered);
                }
              } catch (e) {
                console.error('🔍 [QWOTED DIAGNOSTIC] Error checking registry:', e);
              }
            } else {
              console.log('🔍 [QWOTED DIAGNOSTIC] Scrapers registry not available');
            }
          } else {
            console.log('🔍 [QWOTED DIAGNOSTIC] Scraper not detected in window');
          }
          
          // Dispatch event to communicate back to content script
          document.dispatchEvent(new CustomEvent('qwotedDiagnosticComplete', {
            detail: {
              scraperAvailable,
              registryAvailable,
              isRegistered,
              registrySources,
              scraperInitialized: window.qwotedScraper?.initialized || false
            }
          }));
          
          return scraperAvailable;
        };

        // Initial check
        if (!checkScraper()) {
          // If not immediately available, set up a mutation observer
          const observer = new MutationObserver(() => {
            if (checkScraper()) {
              observer.disconnect();
            }
          });

          // Start observing the document with the configured parameters
          observer.observe(document.documentElement, {
            childList: true,
            subtree: true
          });

          // Set a timeout to stop observing after 10 seconds
          setTimeout(() => {
            observer.disconnect();
            console.log('🔍 [QWOTED DIAGNOSTIC] Diagnostic check timeout');
          }, 10000);
        }
      })();
    `;
    
    // Set up event listener for diagnostic results
    const onDiagnosticComplete = (event) => {
      const { detail } = event;
      console.log('🔍 [QWOTED DIAGNOSTIC] Diagnostic complete:', detail);
      document.removeEventListener('qwotedDiagnosticComplete', onDiagnosticComplete);
    };
    
    document.addEventListener('qwotedDiagnosticComplete', onDiagnosticComplete);
    
    // Execute the script in the page's context
    (document.head || document.documentElement).appendChild(script);
    script.remove();
    
    // Clean up event listener after timeout
    setTimeout(() => {
      document.removeEventListener('qwotedDiagnosticComplete', onDiagnosticComplete);
    }, 15000);
    
  } catch (error) {
    console.error('🔍 [QWOTED DIAGNOSTIC] Error in injectDiagnosticScript:', error);
  }
}

// Function to check if main content script is loaded
function isMainScriptLoaded() {
  return window.qwotedScraper !== undefined;
}

// Function to wait for main script with timeout
async function waitForMainScript(timeout = 10000) {
  const start = Date.now();
  return new Promise((resolve) => {
    const check = () => {
      if (isMainScriptLoaded()) {
        console.log('🔍 [QWOTED DIAGNOSTIC] Main script detected');
        resolve(true);
      } else if (Date.now() - start > timeout) {
        console.log('🔍 [QWOTED DIAGNOSTIC] Timeout waiting for main script');
        resolve(false);
      } else {
        setTimeout(check, 100);
      }
    };
    check();
  });
}

// Main initialization
async function initializeDiagnostics() {
  console.log('🔍 [QWOTED DIAGNOSTIC] Waiting for main script to load...');
  const mainScriptLoaded = await waitForMainScript();
  
  if (!mainScriptLoaded) {
    console.warn('⚠️ [QWOTED DIAGNOSTIC] Main script not detected, running in limited mode');
  }
  
  // Inject diagnostic script
  injectDiagnosticScript();
}

// Start initialization
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeDiagnostics);
} else {
  initializeDiagnostics();
}
