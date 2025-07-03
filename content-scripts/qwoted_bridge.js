/**
 * Qwoted Bridge Script
 * Runs in ISOLATED world to provide chrome API access to MAIN world Qwoted scraper
 */

console.log('💬 [QWOTED BRIDGE] Bridge script loaded in ISOLATED world');

// Listen for messages from MAIN world
window.addEventListener('message', function(event) {
  // Only accept messages from the same origin
  if (event.origin !== window.location.origin) {
    return;
  }

  // Check if it's a message for the bridge
  if (event.data && event.data.type === 'QWOTED_BRIDGE_REQUEST') {
    const { action, data, requestId } = event.data;
    
    console.log('💬 [QWOTED BRIDGE] Received request:', action);
    
    switch (action) {
      case 'GET_EXTENSION_URL':
        try {
          const url = chrome.runtime.getURL(data.path);
          window.postMessage({
            type: 'QWOTED_BRIDGE_RESPONSE',
            requestId: requestId,
            success: true,
            data: { url: url }
          }, window.location.origin);
        } catch (error) {
          console.error('💬 [QWOTED BRIDGE] Error getting extension URL:', error);
          window.postMessage({
            type: 'QWOTED_BRIDGE_RESPONSE',
            requestId: requestId,
            success: false,
            error: error.message
          }, window.location.origin);
        }
        break;
        
      case 'INJECT_SCRIPT':
        try {
          const script = document.createElement('script');
          script.src = chrome.runtime.getURL(data.path);
          script.type = data.type || 'text/javascript';
          
          script.onload = () => {
            console.log('💬 [QWOTED BRIDGE] Script injected successfully:', data.path);
            window.postMessage({
              type: 'QWOTED_BRIDGE_RESPONSE',
              requestId: requestId,
              success: true,
              data: { loaded: true }
            }, window.location.origin);
          };
          
          script.onerror = (error) => {
            console.error('💬 [QWOTED BRIDGE] Error injecting script:', error);
            window.postMessage({
              type: 'QWOTED_BRIDGE_RESPONSE',
              requestId: requestId,
              success: false,
              error: 'Failed to load script'
            }, window.location.origin);
          };
          
          (document.head || document.documentElement).appendChild(script);
        } catch (error) {
          console.error('💬 [QWOTED BRIDGE] Error in script injection:', error);
          window.postMessage({
            type: 'QWOTED_BRIDGE_RESPONSE',
            requestId: requestId,
            success: false,
            error: error.message
          }, window.location.origin);
        }
        break;
        
      case 'SAVE_OPPORTUNITIES':
        try {
          const { opportunities, storageKey } = data;
          
          // Load existing opportunities
          chrome.storage.local.get([storageKey, 'opportunities'], (result) => {
            if (chrome.runtime.lastError) {
              console.error('💬 [QWOTED BRIDGE] Storage get error:', chrome.runtime.lastError);
              window.postMessage({
                type: 'QWOTED_BRIDGE_RESPONSE',
                requestId: requestId,
                success: false,
                error: chrome.runtime.lastError.message
              }, window.location.origin);
              return;
            }
            
            // Get existing opportunities
            const existingPlatform = result[storageKey] || [];
            const allOpportunities = result.opportunities || [];
            
            // Create unique opportunities with proper IDs
            const newOpportunities = opportunities.map(opp => ({
              ...opp,
              id: `qwoted-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
              source: 'Qwoted',
              platform: 'qwoted',
              timestamp: new Date().toISOString(),
              scrapedAt: new Date().toISOString()
            }));
            
            // Filter out duplicates based on title and URL
            const existingTitles = new Set();
            [...existingPlatform, ...allOpportunities].forEach(opp => {
              if (opp.title && opp.url) {
                existingTitles.add(`${opp.title}|${opp.url}`);
              }
            });
            
            const uniqueOpportunities = newOpportunities.filter(opp => {
              const key = `${opp.title}|${opp.url}`;
              return !existingTitles.has(key);
            });
            
            // Combine with existing (limit to prevent storage bloat)
            const MAX_STORED_OPPORTUNITIES = 100;
            const updatedPlatform = [...uniqueOpportunities, ...existingPlatform].slice(0, MAX_STORED_OPPORTUNITIES);
            
            // Also merge with main opportunities collection
            const updatedAll = [...uniqueOpportunities, ...allOpportunities];
            const MAX_GLOBAL_OPPORTUNITIES = 200;
            const trimmedAll = updatedAll.slice(0, MAX_GLOBAL_OPPORTUNITIES);
            
            // Save to storage
            chrome.storage.local.set({
              [storageKey]: updatedPlatform,
              'opportunities': trimmedAll
            }, () => {
              if (chrome.runtime.lastError) {
                console.error('💬 [QWOTED BRIDGE] Storage set error:', chrome.runtime.lastError);
                window.postMessage({
                  type: 'QWOTED_BRIDGE_RESPONSE',
                  requestId: requestId,
                  success: false,
                  error: chrome.runtime.lastError.message
                }, window.location.origin);
              } else {
                console.log(`💬 [QWOTED BRIDGE] Saved ${uniqueOpportunities.length} new opportunities to storage`);
                window.postMessage({
                  type: 'QWOTED_BRIDGE_RESPONSE',
                  requestId: requestId,
                  success: true,
                  data: { 
                    saved: uniqueOpportunities.length,
                    total: updatedPlatform.length
                  }
                }, window.location.origin);
                
                // Send notification to background script
                if (uniqueOpportunities.length > 0) {
                  chrome.runtime.sendMessage({
                    action: 'newOpportunitiesAvailable',
                    source: 'Qwoted',
                    count: uniqueOpportunities.length
                  });
                }
              }
            });
          });
        } catch (error) {
          console.error('💬 [QWOTED BRIDGE] Error saving opportunities:', error);
          window.postMessage({
            type: 'QWOTED_BRIDGE_RESPONSE',
            requestId: requestId,
            success: false,
            error: error.message
          }, window.location.origin);
        }
        break;
        
      default:
        console.warn('💬 [QWOTED BRIDGE] Unknown action:', action);
        window.postMessage({
          type: 'QWOTED_BRIDGE_RESPONSE',
          requestId: requestId,
          success: false,
          error: 'Unknown action'
        }, window.location.origin);
    }
  }
});

// Notify MAIN world that bridge is ready
window.postMessage({
  type: 'QWOTED_BRIDGE_READY',
  timestamp: Date.now()
}, window.location.origin);

console.log('💬 [QWOTED BRIDGE] Bridge ready and listening for requests');