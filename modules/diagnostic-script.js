/**
 * Qwoted Scraper Diagnostic Tool
 * This script helps diagnose why the Qwoted scraper isn't scraping questions
 */

(function() {
  console.log('📊 [DIAGNOSTIC] Starting diagnostic script: ' + new Date().toISOString());
  
  // Create a UI element to show diagnostic results
  const diagnosticPanel = document.createElement('div');
  diagnosticPanel.id = 'qwoted-diagnostic-panel';
  diagnosticPanel.style.cssText = `
    position: fixed;
    bottom: 80px;
    right: 20px;
    width: 300px;
    background-color: #1a1a1a;
    color: #15ee15;
    border: 1px solid #454545;
    border-radius: 4px;
    padding: 10px;
    font-family: monospace;
    z-index: 99999;
    max-height: 400px;
    overflow-y: auto;
    font-size: 12px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
  `;
  
  // Add a header
  const header = document.createElement('div');
  header.style.cssText = `
    font-weight: bold;
    color: white;
    border-bottom: 1px solid #454545;
    padding-bottom: 5px;
    margin-bottom: 5px;
    display: flex;
    justify-content: space-between;
  `;
  header.innerHTML = '<span>Qwoted Scraper Diagnostics</span><button id="close-diagnostics" style="background:none;border:none;color:white;cursor:pointer;">✖</button>';
  diagnosticPanel.appendChild(header);
  
  // Add log container
  const logContainer = document.createElement('div');
  logContainer.id = 'diagnostic-log';
  logContainer.style.cssText = `
    white-space: pre-wrap;
    word-break: break-word;
  `;
  diagnosticPanel.appendChild(logContainer);
  
  // Add a test button container
  const buttonContainer = document.createElement('div');
  buttonContainer.style.cssText = `
    margin-top: 10px;
    display: flex;
    gap: 5px;
  `;
  
  // Add test buttons
  const testScraperButton = document.createElement('button');
  testScraperButton.textContent = 'Test Scraper';
  testScraperButton.style.cssText = `
    background-color: #2196F3;
    border: none;
    color: white;
    padding: 5px 10px;
    border-radius: 3px;
    cursor: pointer;
    font-size: 12px;
    flex: 1;
  `;
  
  const forceInitButton = document.createElement('button');
  forceInitButton.textContent = 'Force Init';
  forceInitButton.style.cssText = `
    background-color: #ff9800;
    border: none;
    color: white;
    padding: 5px 10px;
    border-radius: 3px;
    cursor: pointer;
    font-size: 12px;
    flex: 1;
  `;
  
  buttonContainer.appendChild(testScraperButton);
  buttonContainer.appendChild(forceInitButton);
  diagnosticPanel.appendChild(buttonContainer);
  
  // Add to the page
  document.body.appendChild(diagnosticPanel);
  
  // Add log function
  function log(message) {
    const logElement = document.getElementById('diagnostic-log');
    if (logElement) {
      const entry = document.createElement('div');
      entry.innerHTML = `<span style="color:#aaa;">[${new Date().toLocaleTimeString()}]</span> ${message}`;
      logElement.appendChild(entry);
      logElement.scrollTop = logElement.scrollHeight;
      console.log(`📊 [DIAGNOSTIC] ${message}`);
    }
  }
  
  // Close button handler
  document.getElementById('close-diagnostics').addEventListener('click', () => {
    document.body.removeChild(diagnosticPanel);
  });
  
  // Test scraper button handler
  testScraperButton.addEventListener('click', () => {
    log('Testing scraper availability...');
    
    // Check if qwotedScraper exists
    if (window.qwotedScraper) {
      log('✅ qwotedScraper exists in window object');
      
      // Check if init method exists
      if (typeof window.qwotedScraper.init === 'function') {
        log('✅ init() method exists');
        
        // Check what methods are available
        try {
          const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(window.qwotedScraper));
          log(`Available methods: ${methods.join(', ')}`);
        } catch (e) {
          log(`❌ Error getting methods: ${e.message}`);
        }
        
      } else {
        log('❌ init() method missing!');
      }
    } else {
      log('❌ qwotedScraper not found in window object!');
    }
    
    // Check scrapers registry
    if (window.scrapers) {
      log('✅ scrapers registry exists');
      
      // Check if qwoted is registered
      try {
        const allScrapers = window.scrapers.getAll ? window.scrapers.getAll() : {};
        log(`Registered scrapers: ${Object.keys(allScrapers).join(', ')}`);
      } catch (e) {
        log(`❌ Error checking registered scrapers: ${e.message}`);
      }
    } else {
      log('❌ scrapers registry not found!');
    }
    
    // Check DOM for source requests
    const requestElements = document.querySelectorAll('.request-card, .source-request, [data-testid="request"]');
    log(`Found ${requestElements.length} potential source request elements in DOM`);
    
    // Check event listeners
    log('Checking for event listeners...');
    const events = ['qwoted-scrapers-ready', 'scrapers-ready', 'storage-utils-ready'];
    events.forEach(eventName => {
      const testEvent = new CustomEvent(eventName, {
        detail: { test: true, timestamp: Date.now() }
      });
      log(`Dispatching test ${eventName} event...`);
      document.dispatchEvent(testEvent);
    });
  });
  
  // Force init button handler
  forceInitButton.addEventListener('click', () => {
    log('Attempting to force scraper initialization...');
    
    if (window.qwotedScraper && typeof window.qwotedScraper.init === 'function') {
      try {
        log('Calling window.qwotedScraper.init()...');
        window.qwotedScraper.init();
        log('init() called successfully');
      } catch (e) {
        log(`❌ Error calling init(): ${e.message}`);
        log(`Error stack: ${e.stack}`);
      }
    } else {
      log('❌ Cannot initialize: qwotedScraper or init() not available');
      
      // Try to load and create the scraper
      log('Attempting to load scraper module manually...');
      
      // Create a script element to load the scraper
      const script = document.createElement('script');
      script.src = chrome.runtime.getURL('modules/scrapers/qwoted-scraper.js');
      script.onload = () => {
        log('✅ Scraper script loaded manually');
        if (window.qwotedScraper) {
          log('✅ qwotedScraper available after manual loading');
          if (typeof window.qwotedScraper.init === 'function') {
            try {
              window.qwotedScraper.init();
              log('✅ init() called after manual loading');
            } catch (e) {
              log(`❌ Error calling init() after manual loading: ${e.message}`);
            }
          }
        } else {
          log('❌ qwotedScraper still not available after manual loading');
        }
      };
      script.onerror = (e) => {
        log(`❌ Failed to load script manually: ${e.message}`);
      };
      document.head.appendChild(script);
    }
  });
  
  // Run initial diagnostics
  setTimeout(() => {
    log('Running initial diagnostics...');
    testScraperButton.click();
  }, 2000);
})();
