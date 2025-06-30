// Multi-Platform PR Opportunities Tracker - Popup Script
document.addEventListener('DOMContentLoaded', function() {
  console.log('Popup initialized');
  
  // Current active platform
  let currentPlatform = 'SourceBottle';
  
  // Platform storage keys
  const PLATFORM_KEYS = {
    'SourceBottle': 'sourceBottleOpportunities',
    'Featured': 'featuredOpportunities',
    'Qwoted': 'qwotedOpportunities'
  };
  
  // Initialize platform tabs
  initPlatformTabs();
  
  // Show a status message to the user
  function showStatus(message, isLoading = false) {
    console.log('Status:', message, isLoading ? '(loading)' : '');
    const container = document.getElementById('opportunities-container');
    
    if (isLoading) {
      container.innerHTML = `<div class="empty-state">${message}</div>`;
    } else {
      const statusDiv = document.createElement('div');
      statusDiv.className = 'status-message';
      statusDiv.textContent = message;
      
      // Remove after 3 seconds
      setTimeout(() => {
        if (statusDiv.parentNode) {
          statusDiv.parentNode.removeChild(statusDiv);
        }
      }, 3000);
      
      // Add to container
      if (container.firstChild) {
        container.insertBefore(statusDiv, container.firstChild);
      } else {
        container.appendChild(statusDiv);
      }
    }
  }

  // Load and display opportunities for the current platform
  function loadOpportunities() {
    console.log(`Loading opportunities for ${currentPlatform} from storage`);
    
    // Get the storage key for the current platform
    const storageKey = PLATFORM_KEYS[currentPlatform];
    
    // Get opportunities and settings from storage
    chrome.storage.local.get([storageKey, 'opportunities', 'settings'], function(result) {
      console.log('Storage data retrieved:', result);
      
      // Get opportunities from platform-specific key or combined opportunities
      let platformItems = result[storageKey] || [];
      let allOpportunities = result.opportunities || [];
      
      // Filter all opportunities by platform if platform-specific key is empty
      if (platformItems.length === 0 && allOpportunities.length > 0) {
        platformItems = allOpportunities.filter(opp => 
          opp.source === currentPlatform || 
          opp.source === currentPlatform.toLowerCase()
        );
      }
      
      console.log(`Loaded ${platformItems.length} ${currentPlatform} items`);
      
      // Get settings
      const settings = result.settings || {
        keywordFilters: ['marketing', 'technology', 'ai', 'startup', 'innovation', 'business', 'entrepreneur', 'finance', 'health']
      };
      
      // Apply keyword filtering if keywords are available
      let filteredItems = platformItems;
      
      if (settings.keywordFilters && settings.keywordFilters.length > 0) {
        console.log('Filtering by keywords:', settings.keywordFilters);
        filteredItems = filterByKeywords(platformItems, settings.keywordFilters);
        console.log(`Filtered to ${filteredItems.length} items`);
      }
      
      // Update platform stats
      updatePlatformStats(currentPlatform, platformItems);
      
      // Initialize with filtered items
      renderOpportunities(filteredItems);
      
      // Show status message if no opportunities
      if (platformItems.length === 0) {
        showStatus(`No ${currentPlatform} opportunities found. Visit ${currentPlatform} in a browser tab and click Refresh.`, false);
      }
    });
  }
  
  // Update stats display for the current platform
  function updatePlatformStats(platform, opportunities) {
    const totalCountId = `${platform.toLowerCase()}-total-count`.replace('sourcebottle', 'sb');
    const newCountId = `${platform.toLowerCase()}-new-count`.replace('sourcebottle', 'sb');
    const savedCountId = `${platform.toLowerCase()}-saved-count`.replace('sourcebottle', 'sb');
    
    // Total count
    document.getElementById(totalCountId).textContent = opportunities.length;
    
    // New count (opportunities from the last 24 hours)
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);
    
    const newCount = opportunities.filter(opp => {
      const scrapedAt = opp.scrapedAt ? new Date(opp.scrapedAt) : null;
      return scrapedAt && scrapedAt > oneDayAgo;
    }).length;
    
    document.getElementById(newCountId).textContent = newCount;
    
    // Saved count
    const savedCount = opportunities.filter(opp => opp.saved).length;
    document.getElementById(savedCountId).textContent = savedCount;
  }

  // Function to filter opportunities by keywords
  function filterByKeywords(opportunities, keywords) {
    if (!keywords || keywords.length === 0) {
      return opportunities;
    }
    
    return opportunities.filter(opp => {
      const text = (opp.title + ' ' + opp.description).toLowerCase();
      return keywords.some(keyword => text.includes(keyword.toLowerCase()));
    });
  }

  // Helper function to render opportunities
  function renderOpportunities(opportunities) {
    console.log(`Rendering ${opportunities.length} opportunities`);
    const container = document.getElementById('opportunities-container');
    container.innerHTML = '';
    
    if (opportunities.length === 0) {
      container.innerHTML = `<div class="empty-state">No ${currentPlatform} opportunities found. Open ${currentPlatform} in a browser tab and click Refresh to fetch opportunities.</div>`;
      return;
    }
    
    opportunities.forEach(opp => {
      const card = document.createElement('div');
      card.className = 'opportunity-card';
      card.dataset.id = opp.id || opp.externalId;
      
      // Format date
      let formattedDate = 'N/A';
      if (opp.deadline) {
        const deadlineDate = new Date(opp.deadline);
        formattedDate = deadlineDate.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        });
      }
      
      // Create CSS-friendly category class (lowercase, remove spaces and special chars)
      const categoryClass = (opp.category || 'General').toLowerCase()
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
      
      // Ensure the source is set
      const source = opp.source || currentPlatform;
      const sourceClass = `source-${source.toLowerCase()}`;
      
      // Get the link (different properties might be used)
      const link = opp.url || opp.submissionLink || '#';
      
      card.innerHTML = `
        <div class="card-header">
          <h3 class="opportunity-title">
            ${opp.title}
            <span class="source-tag ${sourceClass}">${source}</span>
          </h3>
          <span class="opportunity-category ${categoryClass}">${opp.category || 'General'}</span>
        </div>
        <div class="card-body">
          <p class="opportunity-description">${opp.description.substring(0, 150)}${opp.description.length > 150 ? '...' : ''}</p>
          <div class="opportunity-meta">
            <span class="deadline">Deadline: ${formattedDate}</span>
          </div>
        </div>
        <div class="card-actions">
          <button class="action-btn save-btn" data-id="${opp.id || opp.externalId}" data-source="${source}" ${opp.saved ? 'disabled' : ''}>
            ${opp.saved ? 'Saved' : 'Save'}
          </button>
          <a href="${link}" target="_blank" class="action-btn view-btn">View</a>
        </div>
      `;
      
      container.appendChild(card);
    });
    
    // Add event listeners to save buttons
    document.querySelectorAll('.save-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        const oppId = this.dataset.id;
        const source = this.dataset.source;
        const storageKey = PLATFORM_KEYS[source] || PLATFORM_KEYS[currentPlatform];
        
        // Get platform opportunities
        chrome.storage.local.get([storageKey, 'opportunities'], result => {
          const platformItems = result[storageKey] || [];
          const allOpportunities = result.opportunities || [];
          
          // Find the opportunity in platform items
          const platformIndex = platformItems.findIndex(opp => (opp.id === oppId || opp.externalId === oppId));
          if (platformIndex >= 0) {
            // It's a platform-specific opportunity
            console.log(`Saving ${source} opportunity ${oppId}`);
            const updatedOpportunities = [...platformItems];
            updatedOpportunities[platformIndex] = {...updatedOpportunities[platformIndex], saved: true};
            
            chrome.storage.local.set({
              [storageKey]: updatedOpportunities
            }, () => {
              console.log(`Saved ${source} opportunity ${oppId}`);
              this.textContent = 'Saved';
              this.disabled = true;
              
              // Update combined opportunities if they exist
              if (allOpportunities.length > 0) {
                const allIndex = allOpportunities.findIndex(opp => (opp.id === oppId || opp.externalId === oppId));
                if (allIndex >= 0) {
                  const updatedAll = [...allOpportunities];
                  updatedAll[allIndex] = {...updatedAll[allIndex], saved: true};
                  chrome.storage.local.set({
                    'opportunities': updatedAll
                  });
                }
              }
              
              // Update stats
              updatePlatformStats(source, updatedOpportunities);
            });
            return;
          }
          
          // Try finding in combined opportunities
          const allIndex = allOpportunities.findIndex(opp => (opp.id === oppId || opp.externalId === oppId));
          if (allIndex >= 0) {
            console.log(`Saving combined opportunity ${oppId}`);
            const updatedAll = [...allOpportunities];
            updatedAll[allIndex] = {...updatedAll[allIndex], saved: true};
            
            chrome.storage.local.set({
              'opportunities': updatedAll
            }, () => {
              console.log(`Saved combined opportunity ${oppId}`);
              this.textContent = 'Saved';
              this.disabled = true;
            });
            return;
          }
          
          console.error(`Opportunity ${oppId} not found`);
        });
      });
    });
  }

  // Initialize platform tabs
  function initPlatformTabs() {
    const platformTabs = document.querySelectorAll('.platform-tab');
    
    platformTabs.forEach(tab => {
      tab.addEventListener('click', function() {
        const platform = this.dataset.platform;
        
        // Skip if already active
        if (platform === currentPlatform) return;
        
        console.log(`Switching to ${platform} platform`);
        
        // Update active tab
        platformTabs.forEach(t => t.classList.remove('active'));
        this.classList.add('active');
        
        // Update current platform
        currentPlatform = platform;
        
        // Hide all stats and show the current platform's stats
        document.querySelectorAll('.platform-stats').forEach(stats => {
          stats.style.display = 'none';
        });
        
        const statsClass = `${platform.toLowerCase()}-stats`;
        document.querySelector(`.${statsClass}`).style.display = 'flex';
        
        // Load opportunities for the new platform
        loadOpportunities();
      });
    });
  }

  // Add category filter functionality
  const categoryFilters = document.querySelectorAll('.category-filter');
  categoryFilters.forEach(filter => {
    filter.addEventListener('click', function() {
      const category = this.dataset.category;
      console.log('Filtering by category:', category);
      
      // Remove active class from all filters
      categoryFilters.forEach(f => f.classList.remove('active'));
      
      // Add active class to clicked filter
      this.classList.add('active');
      
      // Get current opportunities
      const storageKey = PLATFORM_KEYS[currentPlatform];
      
      chrome.storage.local.get([storageKey, 'opportunities'], function(result) {
        let platformItems = result[storageKey] || [];
        const allOpportunities = result.opportunities || [];
        
        // If platform-specific is empty, try filtering all opportunities
        if (platformItems.length === 0 && allOpportunities.length > 0) {
          platformItems = allOpportunities.filter(opp => 
            opp.source === currentPlatform || 
            opp.source === currentPlatform.toLowerCase()
          );
        }
        
        // Filter opportunities by category
        if (category === 'all') {
          renderOpportunities(platformItems);
        } else {
          // Filter using exact match for the specific category
          const filtered = platformItems.filter(opp => 
            opp.category === category
          );
          console.log(`Filtered to ${filtered.length} ${category} items`);
          renderOpportunities(filtered);
        }
      });
    });
  });

  // Update the View All button
  document.getElementById('view-all-btn').addEventListener('click', function() {
    console.log('View All button clicked');
    
    // Open opportunities.html in a new tab
    chrome.tabs.create({ url: 'opportunities.html' });
  });
  
  // Add settings button functionality
  document.getElementById('settings-btn').addEventListener('click', function() {
    console.log('Settings button clicked');
    
    // Open settings.html in a new tab
    chrome.tabs.create({ url: 'settings.html' });
  });

  // Add refresh functionality for currently active platform
  document.getElementById('refresh-btn').addEventListener('click', function() {
    console.log(`Refresh button clicked for ${currentPlatform}`);
    
    // Show loading state
    this.textContent = 'Refreshing...';
    this.disabled = true;
    
    // Get the current platform's storage key
    const storageKey = PLATFORM_KEYS[currentPlatform];
    
    // Clear current opportunities for the platform
    chrome.storage.local.remove([storageKey], () => {
      console.log(`Cleared previous ${currentPlatform} opportunities`);
      
      // Find the currently active tab and check if it matches the current platform
      chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
        const currentTab = tabs[0];
        console.log('Current tab:', currentTab.url);
        
        const isCurrentPlatformTab = (
          (currentPlatform === 'SourceBottle' && currentTab.url.includes('sourcebottle.com')) ||
          (currentPlatform === 'Featured' && currentTab.url.includes('featured.com')) ||
          (currentPlatform === 'Qwoted' && currentTab.url.includes('qwoted.com'))
        );
        
        if (currentTab && currentTab.url && isCurrentPlatformTab) {
          // If current tab matches the current platform, send a message to extract opportunities
          console.log(`Current tab is ${currentPlatform}, sending extract message`);
          
          let action;
          switch(currentPlatform) {
            case 'SourceBottle':
              action = 'extractSourceBottleOpportunities';
              break;
            case 'Featured':
              action = 'extractFeaturedOpportunities';
              break;
            case 'Qwoted':
              action = 'extractQwotedOpportunities';
              break;
            default:
              action = 'extractOpportunities';
          }
          
          chrome.tabs.sendMessage(currentTab.id, {
            action: action
          }, response => {
            console.log('Extraction response from tab:', response);
            
            showStatus(`Extracting opportunities from current ${currentPlatform} page...`, true);
            
            // Wait a bit for extraction to complete
            setTimeout(() => {
              // Restore button state
              const refreshBtn = document.getElementById('refresh-btn');
              refreshBtn.textContent = 'Refresh';
              refreshBtn.disabled = false;
              
              // Reload opportunities from storage
              loadOpportunities();
            }, 3000);
          });
        } else {
          // If current tab doesn't match the platform, message to background to handle extraction
          console.log(`Current tab is not ${currentPlatform}, sending message to background`);
          
          let action;
          switch(currentPlatform) {
            case 'SourceBottle':
              action = 'extractFromSourceBottleTabs';
              break;
            case 'Featured':
              action = 'extractFromFeaturedTabs';
              break;
            case 'Qwoted':
              action = 'extractFromQwotedTabs';
              break;
            default:
              action = 'extractFromAllTabs';
          }
          
          chrome.runtime.sendMessage({
            action: action
          }, response => {
            console.log('Background extraction response:', response);
            
            if (response && response.status === 'no_tabs') {
              showStatus(`No ${currentPlatform} tabs found. Please visit ${currentPlatform} website first.`, false);
              
              // Restore button state immediately
              this.textContent = 'Refresh';
              this.disabled = false;
            } else {
              showStatus(`Checking for ${currentPlatform} tabs...`, true);
              
              // Wait longer to allow time for the content scripts to run and update storage
              setTimeout(() => {
                // Restore button state
                const refreshBtn = document.getElementById('refresh-btn');
                refreshBtn.textContent = 'Refresh';
                refreshBtn.disabled = false;
                
                // Reload opportunities from storage
                loadOpportunities();
              }, 3000);
            }
          });
        }
      });
    });
  });
  
  // Initialize
  loadOpportunities();
});