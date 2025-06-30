// Initialize logger reference
let logManager = null;

// Try to import logger if available
try {
  import(chrome.runtime.getURL('modules/logger.js'))
    .then(module => {
      logManager = module.logManager;
      logManager.debug('Popup initialized with logger');
    })
    .catch(() => {
      console.debug('Using console fallback for logging');
    });
} catch (e) {
  console.debug('Could not load logger, using console fallback');
}

/**
 * Log a debug message
 * @param {string} message - Message to log
 * @param {any} [data] - Optional data to log
 */
function debugLog(message, data) {
  try {
    if (logManager) {
      logManager.debug(`[Popup] ${message}`, data);
    } else {
      console.debug(`[Popup] ${message}`, data || '');
    }
  } catch (e) {
    console.error('Error in debugLog:', e);
  }
}

document.addEventListener('DOMContentLoaded', function() {
  debugLog('Popup initialized');
  
  // Get DOM elements
  const statusElement = document.getElementById('status');
  const opportunitiesList = document.getElementById('opportunities');
  const startButton = document.getElementById('start');
  const stopButton = document.getElementById('stop');
  const settingsButton = document.getElementById('open-settings');
  const progressBar = document.querySelector('.progress-bar');
  const pageInfo = document.getElementById('pageInfo');
  const nextPageBtn = document.getElementById('nextPageBtn');
  const statusIndicator = document.getElementById('statusIndicator');
  const categoryButtons = document.querySelectorAll('.category-button') || [];
  const statusMessage = document.getElementById('status-message');
  const refreshButton = document.getElementById('refresh-button');
  const exportButton = document.getElementById('export-csv');
  const sheetsButton = document.getElementById('send-to-sheets');
  const countDisplay = document.getElementById('count-display');
  const viewButton = document.getElementById('view-opportunities');
  const categorySelect = document.getElementById('category-select');
  const scrapeButton = document.getElementById('scrape-button');
  
  // Initialize popup state
  let isScraping = false;
  let currentPage = 1;
  let totalPages = 1;
  
  // Update UI based on scraping state
  function updateUIState(scraping) {
    isScraping = scraping;
    if (startButton) startButton.disabled = scraping;
    if (stopButton) stopButton.disabled = !scraping;
    if (statusIndicator) statusIndicator.className = `status-indicator ${scraping ? 'active' : ''}`;
  }
  
  // Update page information
  function updatePageInfo(page, total) {
    currentPage = page;
    totalPages = total;
    if (pageInfo) pageInfo.textContent = `Page ${page} of ${total}`;
    if (nextPageBtn) nextPageBtn.style.display = page < total ? 'block' : 'none';
  }
  
  // Initialize the popup
  initPopup();
  
  // Event listeners for buttons
  if (startButton) {
    startButton.addEventListener('click', async () => {
      try {
        updateUIState(true);
        setDebugStatus('Starting scraping process...');
        
        // Get active tab
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        // Send message to content script to start scraping
        const response = await chrome.tabs.sendMessage(tab.id, { action: 'startScraping' });
        
        if (response && response.success) {
          setDebugStatus(`Found ${response.count} opportunities`, 'success');
          updatePageInfo(response.currentPage || 1, response.totalPages || 1);
        } else {
          throw new Error(response?.error || 'Failed to start scraping');
        }
      } catch (error) {
        console.error('Error in startScraping:', error);
        setDebugStatus(`Error: ${error.message}`, 'error');
      } finally {
        updateUIState(false);
      }
    });
  }
  
  // Next page button handler
  if (nextPageBtn) {
    nextPageBtn.addEventListener('click', function() {
      debugLog('Next page button clicked');
      
      // Get the current page from the page info text
      let currentPage = 1;
      let totalPages = 1;
      
      if (pageInfo) {
        const pageText = pageInfo.textContent;
        const match = pageText.match(/Page (\d+) of (\d+)/);
        if (match) {
          currentPage = parseInt(match[1], 10);
          totalPages = parseInt(match[2], 10);
        }
      }
      
      // Check if we can go to the next page
      if (currentPage < totalPages) {
        // Find the currently active category
        const activeCategory = document.querySelector('.category-button.active');
        if (activeCategory) {
          const iid = activeCategory.dataset.iid;
          const categoryName = activeCategory.textContent.trim();
          
          // Show status
          setDebugStatus(`Navigating to page ${currentPage + 1} of ${categoryName}...`, false);
          
          // Update status indicator
          if (statusIndicator) {
            statusIndicator.style.backgroundColor = '#4361ee';
          }
          
          // Update status text
          if (statusElement) {
            statusElement.textContent = `Loading page ${currentPage + 1}...`;
          }
          
          // Find any existing SourceBottle tabs
          chrome.tabs.query({url: "*://www.sourcebottle.com/*"}, function(tabs) {
            if (tabs.length > 0) {
              const tabId = tabs[0].id;
              
              // Update URL with the next page parameter
              chrome.tabs.update(tabId, {
                url: `https://www.sourcebottle.com/industry-list-results.asp?iid=${iid}&p=${currentPage + 1}`,
                active: true
              }, function(tab) {
                // Force focus on the tab's window
                if (tab && tab.windowId) chrome.windows.update(tab.windowId, {focused: true});
                
                // Execute content script immediately
                chrome.scripting.executeScript({
                  target: {tabId: tab.id},
                  function: function() {
                    console.log('Injected script to extract opportunities for next page');
                    
                    // Wait for page to load then dispatch custom event
                    window.addEventListener('load', () => {
                      console.log('Page loaded, dispatching sourcebottle-scrape event');
                      document.dispatchEvent(new CustomEvent('sourcebottle-scrape'));
                    });
                  }
                }, () => {
                  if (chrome.runtime.lastError) {
                    debugLog('Error executing script:', chrome.runtime.lastError);
                  }
                });
              });
            }
          });
        }
      }
    });
  }
  
  if (exportButton) {
    exportButton.addEventListener('click', exportToCSV);
  }
  
  if (refreshButton) {
    refreshButton.addEventListener('click', loadOpportunities);
  }
  
  if (settingsButton) {
    settingsButton.addEventListener('click', openSettings);
  }
  
  if (sheetsButton) {
    sheetsButton.addEventListener('click', exportToSheets);
  }
  
  // Add click event to category buttons
  if (categoryButtons && categoryButtons.length > 0) {
    debugLog('Found ' + categoryButtons.length + ' category buttons');
    categoryButtons.forEach(button => {
      button.addEventListener('click', function() {
        const iid = this.dataset.iid;
        const categoryName = this.textContent.trim();
        
        // Show status message to inform user
        setDebugStatus(`Opening ${categoryName} category page...`, false);
        
        // Remove active class from all buttons
        categoryButtons.forEach(btn => btn.classList.remove('active'));
        
        // Add active class to clicked button
        this.classList.add('active');
        
        // Show the scraping progress indicators
        const scrapingProgress = document.getElementById('scraping-progress');
        if (scrapingProgress) {
          scrapingProgress.style.display = 'block';
        }
        
        // Update status indicator
        if (statusIndicator) {
          statusIndicator.style.backgroundColor = '#4361ee';
        }
        
        // Update status text
        if (statusElement) {
          statusElement.textContent = 'Scraping in progress...';
        }
        
        // First, check if there are any existing SourceBottle tabs
        chrome.tabs.query({url: "*://www.sourcebottle.com/*"}, function(tabs) {
          debugLog('Tab query result:', tabs);
          
          // If a SourceBottle tab exists, use it
          if (tabs.length > 0) {
            const tabId = tabs[0].id;
            
            // Update the existing tab's URL
            chrome.tabs.update(tabId, {
              url: `https://www.sourcebottle.com/industry-list-results.asp?iid=${iid}`,
              active: true
            }, function(tab) {
              debugLog(`Updated tab to category: ${categoryName} (iid: ${iid})`);
              
              // Force focus on the tab's window
              if (tab && tab.windowId) chrome.windows.update(tab.windowId, {focused: true});
              
              // Execute content script immediately
              chrome.scripting.executeScript({
                target: {tabId: tab.id},
                function: function() {
                  console.log('Injected script to extract opportunities');
                  
                  // Wait for page to load then dispatch custom event
                  window.addEventListener('load', () => {
                    console.log('Page loaded, dispatching sourcebottle-scrape event');
                    document.dispatchEvent(new CustomEvent('sourcebottle-scrape'));
                  });
                }
              }, () => {
                if (chrome.runtime.lastError) {
                  debugLog('Error executing script:', chrome.runtime.lastError);
                }
              });
            });
          } else {
            // Create a new tab if no SourceBottle tab exists
            chrome.tabs.create({ 
              url: `https://www.sourcebottle.com/industry-list-results.asp?iid=${iid}`,
              active: true
            }, tab => {
              debugLog(`Opened SourceBottle category: ${categoryName} (iid: ${iid})`);
              
              // Chrome API to execute script in the tab after creation
              chrome.scripting.executeScript({
                target: {tabId: tab.id},
                function: function() {
                  console.log('Injected script to extract opportunities');
                  
                  // Wait for page to load then dispatch custom event
                  window.addEventListener('load', () => {
                    console.log('Page loaded, dispatching sourcebottle-scrape event');
                    document.dispatchEvent(new CustomEvent('sourcebottle-scrape'));
                  });
                }
              }, () => {
                if (chrome.runtime.lastError) {
                  debugLog('Error executing script:', chrome.runtime.lastError);
                }
              });
            });
          }
        });
      });
    });
  } else {
    debugLog('No category buttons found in the popup');
  }
  
  // Listen for messages from content scripts
  chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
    debugLog('Received message from content script:', message);
    
    if (message.action === 'updateProgress') {
      // Update the progress bar
      if (progressBar) {
        progressBar.style.width = message.progress + '%';
      }
      
      // Update page info
      if (pageInfo && message.currentPage && message.totalPages) {
        pageInfo.textContent = `Page ${message.currentPage} of ${message.totalPages}`;
        
        // Show/hide next page button
        if (nextPageBtn) {
          nextPageBtn.style.display = message.currentPage < message.totalPages ? 'block' : 'none';
        }
      }
      
      // Update status text
      if (statusElement && message.status) {
        statusElement.textContent = message.status;
      }
    }
    
    // Handle completion message
    if (message.action === 'scrapingComplete') {
      if (statusIndicator) {
        statusIndicator.style.backgroundColor = '#4CAF50'; // Green for completion
      }
      
      if (statusElement) {
        statusElement.textContent = 'Scraping complete!';
      }
      
      // Update count display
      if (message.count && countDisplay) {
        countDisplay.textContent = `Found ${message.count} opportunities`;
        
        // Make the count display visible
        const container = document.getElementById('opportunities-container');
        if (container) {
          container.style.display = 'block';
        }
      }
      
      // Show next steps dialog
      showNextSteps();
    }
    
    return true; // Keep the listener active
  });
  
  // View opportunities button
  if (viewButton) {
    viewButton.addEventListener('click', function() {
      // Check if we have any opportunities
      chrome.storage.local.get(['sourceBottleOpportunities'], function(result) {
        const opportunities = result.sourceBottleOpportunities || [];
        
        if (opportunities.length === 0) {
          setDebugStatus('No opportunities found. Please select a category to scrape first.', true);
          return;
        }
        
        // Open opportunities list page
        chrome.tabs.create({ url: 'opportunities.html' });
      });
    });
  }
  
  // Initialize popup
  function initPopup() {
    // Get the opportunities list element
    const opportunitiesList = document.getElementById('opportunities-list');
    if (!opportunitiesList) {
      console.error('Opportunities list element not found');
      return;
    }
    
    loadOpportunities();
    addStyles();
  }
  
  // Load opportunities from storage
  function loadOpportunities() {
    const opportunitiesList = document.getElementById('opportunities-list');
    if (!opportunitiesList) {
      console.error('Opportunities list element not found');
      return;
    }
    
    chrome.storage.local.get(['sourceBottleOpportunities'], function(result) {
      const opportunities = result.sourceBottleOpportunities || [];
      
      // Show/hide container based on whether there are opportunities
      const container = document.getElementById('opportunities-container');
      if (container) {
        container.style.display = opportunities.length > 0 ? 'block' : 'none';
      }
      
      // Update count display
      if (countDisplay) {
        countDisplay.textContent = `Found ${opportunities.length} opportunities`;
      }
      
      // Update opportunities list
      opportunitiesList.innerHTML = '';
      opportunities.forEach(opportunity => {
        try {
          const card = createOpportunityCard(opportunity);
          if (card) {
            opportunitiesList.appendChild(card);
          }
        } catch (error) {
          console.error('Error creating opportunity card:', error);
        }
      });
    });
  }
  
  // Open settings page
  function openSettings() {
    chrome.tabs.create({ url: 'settings.html' });
  }
  
  // Export opportunities to CSV
  function exportToCSV() {
    chrome.storage.local.get(['sourceBottleOpportunities'], function(result) {
      const opportunities = result.sourceBottleOpportunities || [];
      
      // Create CSV content
      let csvContent = "data:text/csv;charset=utf-8,";
      csvContent += "Title,Description,Category,Deadline,Source,Media Outlet,Journalist,Link\n";
      
      opportunities.forEach(opp => {
        csvContent += `"${opp.title.replace(/"/g, '""')}","${opp.description.replace(/"/g, '""')}","${opp.category}","${opp.deadline}","${opp.source}","${(opp.mediaOutlet || '').replace(/"/g, '""')}","${(opp.journalist || '').replace(/"/g, '""')}","${opp.submissionLink}"\n`;
      });
      
      // Create download link
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      const filename = `sourcebottle-opportunities-${new Date().toISOString().split('T')[0]}.csv`;
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      
      // Trigger download
      link.click();
      document.body.removeChild(link);
    });
  }
  
  // Export opportunities to Google Sheets
  function exportToSheets() {
    chrome.storage.local.get(['sourceBottleOpportunities'], function(result) {
      const opportunities = result.sourceBottleOpportunities || [];
      
      // Map opportunities to match the Google Sheet columns exactly
      const mapped = opportunities.map(op => ({
        title: op.title || '',
        description: op.description || '',
        category: op.category || '',
        deadline: op.deadline || op.date || '',
        source: op.source || '',
        mediaOutlet: op.mediaOutlet || '',
        journalist: op.journalist || '',
        link: op.submissionLink || op.link || ''
      }));
      
      // Direct fetch approach to avoid background script issues
      fetch('https://script.google.com/a/macros/qubit.capital/s/AKfycbxlje612pVpLl9ttLHqRegEEsk1vf6_UFfFZ_oMazrUjt2d_Jel96fwDNj-zHef6i8/exec', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ opportunities: mapped })
      })
      .then(response => {
        debugLog('Google Sheets response', { status: response.status });
        return response.text();
      })
      .then(text => {
        debugLog('Google Sheets response data', { text });
        setDebugStatus(`Sent ${opportunities.length} opportunities to Google Sheet!`);
        
        // Show next steps dialog
        showNextSteps();
      })
      .catch(error => {
        debugLog('Error sending to Google Sheets', { error: error.message, stack: error.stack });
        setDebugStatus(`Failed: ${error.message}`, true);
        
        // Still show next steps even on error
        showNextSteps();
      });
    });
  }
  
  // Function to create opportunity card with AI analysis
  function createOpportunityCard(opportunity) {
    if (!opportunity) return null;
    
    const card = document.createElement('div');
    card.className = 'opportunity-card';
    card.dataset.id = opportunity.id || Date.now();
    
    // Format AI analysis if available
    let aiAnalysisHtml = '';
    if (opportunity.aiAnalysis) {
      const priority = Math.min(5, Math.ceil((opportunity.aiAnalysis.priority || 0) / 2));
      const priorityClass = `priority-${priority}`;
    
      aiAnalysisHtml = `
        <div class="ai-analysis">
          <div class="ai-header">
            <span class="ai-badge">AI Analysis</span>
            <span class="priority-badge ${priorityClass}">
              Priority: ${opportunity.aiAnalysis.priority || 'N/A'}/10
            </span>
          </div>
          <div class="ai-summary">${escapeHtml(opportunity.aiAnalysis.summary || 'No summary available')}</div>
          ${opportunity.aiAnalysis.categories && opportunity.aiAnalysis.categories.length ? `
            <div class="ai-tags">
              ${opportunity.aiAnalysis.categories.map(tag => 
                `<span class="ai-tag">${escapeHtml(tag)}</span>`
              ).join('')}
            </div>` : ''}
          ${opportunity.aiAnalysis.priorityReason ? `
            <div class="ai-reason">
              <strong>Reason:</strong> ${escapeHtml(opportunity.aiAnalysis.priorityReason)}
            </div>` : ''}
        </div>`;
    }
    
    // Format the deadline with a tooltip showing the raw date
    const deadlineDate = opportunity.deadline ? new Date(opportunity.deadline) : null;
    const deadlineText = deadlineDate && !isNaN(deadlineDate.getTime()) 
      ? formatDate(opportunity.deadline)
      : 'No deadline';
      
    card.innerHTML = `
      <div class="opportunity-header">
        <h3>${escapeHtml(opportunity.title || 'Untitled Opportunity')}</h3>
        <span class="source">${escapeHtml(opportunity.source || 'Unknown')}</span>
      </div>
      <p class="description">${escapeHtml(opportunity.description || 'No description available')}</p>
      <div class="meta">
        <span class="deadline" title="Deadline: ${deadlineText}">
          📅 ${deadlineText}
        </span>
        ${opportunity.aiAnalysis ? `
          <span class="ai-status">🤖 Analyzed</span>` : 
          '<span class="ai-status pending">⏳ Analyzing...</span>'}
      </div>
      ${aiAnalysisHtml}
    `;
    
    return card;
  }
  
  // Add styles for the popup
  function addStyles() {
    const style = document.createElement('style');
    style.textContent = `
      /* Base styles */
      body {
        width: 350px;
        padding: 15px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
        margin: 0;
        color: #333;
      }
      
      .opportunity-card {
        border: 1px solid #ddd;
        border-radius: 8px;
        padding: 12px;
        margin-bottom: 15px;
        background-color: #fff;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      }
      
      .opportunity-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 8px;
      }
      
      .opportunity-header h3 {
        margin: 0;
        font-size: 16px;
        color: #2a5885;
      }
      
      .source {
        font-size: 12px;
        color: #777;
        background-color: #f0f0f0;
        padding: 2px 6px;
        border-radius: 4px;
      }
      
      .description {
        font-size: 14px;
        margin: 8px 0;
        color: #555;
      }
      
      .meta {
        display: flex;
        justify-content: space-between;
        font-size: 12px;
        color: #666;
      }
      
      .ai-status {
        background-color: #e3f2fd;
        color: #0d47a1;
        padding: 2px 6px;
        border-radius: 4px;
        font-weight: bold;
      }
      
      .ai-status.pending {
        background-color: #fff8e1;
        color: #ff8f00;
      }
      
      .ai-analysis {
        margin-top: 10px;
        padding: 8px;
        background-color: #f5f9ff;
        border-radius: 4px;
        font-size: 13px;
      }
      
      .ai-priority {
        font-weight: bold;
        margin-bottom: 5px;
      }
      
      .ai-reason {
        color: #555;
        font-size: 12px;
      }
      
      .high-priority {
        color: #d32f2f;
      }
      
      .medium-priority {
        color: #f57c00;
      }
      
      .low-priority {
        color: #388e3c;
      }

      /* Status indicator */
      .status-indicator {
        display: inline-block;
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background-color: #ccc;
        margin-right: 5px;
      }
      
      .status-indicator.active {
        background-color: #4361ee;
      }
    `;
    document.head.appendChild(style);
  }
  
  /**
   * Set the debug status message
   * @param {string} message - Status message
   * @param {boolean} isError - Whether this is an error message
   */
  function setDebugStatus(message, isError = false) {
    // Update the status message display
    const statusEl = document.getElementById('status-message');
    if (statusEl) {
      statusEl.textContent = message;
      statusEl.style.display = 'block';
      statusEl.style.backgroundColor = isError ? '#f8d7da' : '#e8f4ff';
      statusEl.style.color = isError ? '#721c24' : '#0366d6';
      
      // Auto-hide after 3 seconds if not error
      if (!isError) {
        setTimeout(() => {
          statusEl.style.display = 'none';
        }, 3000);
      }
    }
    
    // Log the status
    debugLog(`Status: ${message}`, {isError});
  }
  
  /**
   * Show next steps after successful operation
   */
  function showNextSteps() {
    setDebugStatus('You can now view or export your opportunities', false);
    
    // If we have a count display element, make it stand out
    if (countDisplay) {
      countDisplay.style.fontWeight = 'bold';
      countDisplay.style.color = '#2196F3';
    }
    
    // Make the view button pulse if available
    if (viewButton) {
      viewButton.classList.add('pulse');
      // Add pulse animation if not already in CSS
      const style = document.createElement('style');
      style.textContent = `
        @keyframes pulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.05); box-shadow: 0 0 10px rgba(0,0,255,0.5); }
          100% { transform: scale(1); }
        }
        .pulse {
          animation: pulse 1.5s infinite;
          background-color: #2196F3 !important;
        }
      `;
      document.head.appendChild(style);
    }
  }
  
  /**
   * Helper function to format dates nicely
   * @param {string} dateStr - The date string to format
   * @returns {string} Formatted date string
   */
  function formatDate(dateStr) {
    if (!dateStr) return 'No deadline';
    
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return 'No deadline';
      
      // Format as "24 April 2025, 5:00 PM"
      const options = {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      };
      
      return date.toLocaleString('en-US', options);
    } catch (error) {
      console.error('Error formatting date:', error);
      return String(dateStr || 'No deadline');
    }
  }
  
  /**
   * Helper function to escape HTML
   */
  function escapeHtml(text) {
    if (!text) return '';
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
  
  // Check current opportunity count and display prominently
  chrome.storage.local.get(['sourceBottleOpportunities'], function(result) {
    const opportunities = result.sourceBottleOpportunities || [];
    const count = opportunities.length;
    
    if (count > 0) {
      // Show count in a more prominent way
      setDebugStatus(`${count} opportunities available to view or export`, false);
      
      // If we have a count display element, update it
      if (countDisplay) {
        countDisplay.textContent = `${count} opportunities`;
        countDisplay.style.display = 'block';
        
        // Make the opportunities container visible
        const container = document.getElementById('opportunities-container');
        if (container) {
          container.style.display = 'block';
        }
      }
      
      // Make the view button pulse to draw attention
      if (viewButton) {
        viewButton.classList.add('pulse');
      }
    } else {
      setDebugStatus('Select a category to find opportunities', false);
    }
  });
});