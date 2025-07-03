// Declare variables at the global scope so showAIAnalysis can access them
let allOpportunities = [];
let filteredOpportunities = [];
let aiProcessing = false;

// Listen for notification sound requests from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'playNotificationSound') {
    console.log(`Playing notification sound for ${request.count} new opportunities`);
    playNotificationSound();
    
    // Show toast notification with count
    const notification = document.createElement('div');
    notification.className = 'ai-notification success';
    notification.textContent = `Found ${request.count} new opportunities (${request.total} total)`;
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.classList.add('show');
      setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
          document.body.removeChild(notification);
        }, 500);
      }, 3000);
    }, 100);
    
    return true; // Keep the message channel open for async response
  }
  return false;
});

/**
 * EventListenerManager - Manages event listeners and their cleanup
 */
class EventListenerManager {
  constructor() {
    this.listeners = new Map();
  }

  /**
   * Add an event listener with automatic cleanup
   * @param {Element} element - The DOM element to attach the listener to
   * @param {string} event - The event name
   * @param {Function} handler - The event handler function
   * @param {Object} [options] - Optional event listener options
   * @returns {Function} A function to remove this specific listener
   */
  add(element, event, handler, options) {
    if (!element || !event || !handler) {
      console.warn('Invalid arguments for addEventListener', { element, event, handler });
      return () => {};
    }

    const elementKey = element.id || element.className || 'anonymous';
    const listenerKey = `${elementKey}_${event}`;
    
    // Store the handler reference for later removal
    const wrappedHandler = (e) => {
      try {
        return handler(e);
      } catch (error) {
        console.error(`Error in event handler for ${event} on ${elementKey}:`, error);
      }
    };

    // Add the event listener
    element.addEventListener(event, wrappedHandler, options);

    // Store the cleanup function
    const cleanup = () => {
      element.removeEventListener(event, wrappedHandler, options);
      this.listeners.delete(listenerKey);
    };

    // Clean up any existing listener for this element and event
    if (this.listeners.has(listenerKey)) {
      this.listeners.get(listenerKey)();
    }

    this.listeners.set(listenerKey, cleanup);
    return cleanup;
  }

  /**
   * Remove all event listeners
   */
  removeAll() {
    this.listeners.forEach(cleanup => cleanup());
    this.listeners.clear();
  }

  /**
   * Remove event listeners for a specific element
   * @param {Element} element - The DOM element
   * @param {string} [event] - Optional event name
   */
  remove(element, event) {
    const elementKey = element.id || element.className || 'anonymous';
    const prefix = event ? `${elementKey}_${event}` : elementKey;
    
    for (const [key, cleanup] of this.listeners.entries()) {
      if (key.startsWith(prefix)) {
        cleanup();
        this.listeners.delete(key);
      }
    }
  }
}

// Global event listener manager
const eventManager = new EventListenerManager();

// Function to play notification sound - longer pleasant chime sequence
function playNotificationSound() {
  try {
    // Create audio context if not already created
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    const audioContext = new AudioContext();
    
    // Create a pleasant 3-tone chime sequence (C-E-G major chord arpeggiated)
    const frequencies = [523.25, 659.25, 783.99]; // C5, E5, G5
    const noteDuration = 0.4; // Each note lasts 400ms
    const totalDuration = frequencies.length * noteDuration;
    
    frequencies.forEach((frequency, index) => {
      // Create oscillator and gain node for each note
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      // Connect the nodes
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      // Set the frequency
      oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
      oscillator.type = 'sine'; // Smooth sine wave for pleasant sound
      
      // Calculate timing for this note
      const startTime = audioContext.currentTime + (index * noteDuration);
      const endTime = startTime + noteDuration;
      
      // Set volume envelope (attack, sustain, release)
      gainNode.gain.setValueAtTime(0, startTime);
      gainNode.gain.linearRampToValueAtTime(0.15, startTime + 0.05); // Quick attack
      gainNode.gain.setValueAtTime(0.15, startTime + 0.2); // Sustain
      gainNode.gain.exponentialRampToValueAtTime(0.01, endTime); // Smooth decay
      
      // Start and stop the oscillator
      oscillator.start(startTime);
      oscillator.stop(endTime);
      
      // Clean up after the note finishes
      setTimeout(() => {
        oscillator.disconnect();
        gainNode.disconnect();
      }, (endTime - audioContext.currentTime) * 1000 + 100);
    });
    
    console.log(`🔊 Playing notification chime (${totalDuration.toFixed(1)}s)`);
  } catch (error) {
    console.warn('Could not play notification sound:', error);
    // Fallback to browser beep if available
    try {
      console.log('\x07'); // ASCII bell character
    } catch (e) {
      console.warn('No fallback notification available');
    }
  }
}

// Main initialization function
function initializeApp() {
  // Clean up any existing listeners
  eventManager.removeAll();
  
  // Track if initialization has completed
  let isInitialized = false;
  
  // Cleanup function to be called when the page unloads
  const cleanup = () => {
    if (isInitialized) {
      console.log('Cleaning up event listeners');
      eventManager.removeAll();
      isInitialized = false;
    }
  };
  
  // Set up unload handler
  window.addEventListener('beforeunload', cleanup);
  
  try {
  console.log('Opportunities page loaded');
  
  // Cache DOM elements - using let for elements that might be created dynamically
  const opportunitiesContainer = document.getElementById('opportunities-container');
  const categoryFilters = document.getElementById('category-filters');
  const searchInput = document.getElementById('search-input');
  const toggleViewBtn = document.getElementById('toggle-view-btn');
  const viewIcon = document.getElementById('view-icon');
  const viewText = document.getElementById('view-text');
  const toggleFiltersBtn = document.getElementById('toggle-filters');
  const filtersContent = document.getElementById('filters-content');
  const darkModeToggle = document.getElementById('dark-mode-toggle');
  const applyFiltersBtn = document.getElementById('apply-filters');
  const resetFiltersBtn = document.getElementById('reset-filters');
  const paginationContainer = document.getElementById('pagination');
  let analyzeAiBtn = document.getElementById('analyze-ai-btn');
  let aiIcon = document.getElementById('ai-icon');
  let aiText = document.getElementById('ai-text');
  
  // Initialize other variables
  let currentPage = 1;
  const itemsPerPage = 12;
  let lastOpportunityCount = 0; // Track the last count of opportunities for new item detection
  
  // Set up the AI service for opportunity processing
  let aiService = null;
  let aiServiceInitialized = false;
  let aiServiceInitializing = false;
  
  // Initialize the AI service once it's available with race condition protection
  async function initializeAIService() {
    // Prevent concurrent initialization
    if (aiServiceInitializing || aiServiceInitialized) {
      return aiServiceInitialized;
    }
    
    aiServiceInitializing = true;
    
    try {
      // Check if aiService is available in global scope (from loaded script)
      if (window.aiService) {
        aiService = window.aiService;
        console.log('AI service found in global scope');
        
        // Initialize AI service with proper await
        const initialized = await aiService.initialize();
        if (initialized) {
          console.log('AI service initialized successfully');
          aiServiceInitialized = true;
          
          // Re-process opportunities with AI if needed
          if (allOpportunities.length > 0) {
            // Don't await this to avoid blocking
            processOpportunitiesWithAI().catch(err => {
              console.error('Error processing opportunities with AI:', err);
            });
          }
        }
      } else {
        console.error('AI service not available in global scope');
        // Continue with normal operation even if AI is not available
        initializeView();
      }
    } catch (err) {
      console.error('Error initializing AI service:', err);
      // Continue with normal operation even if AI fails
      initializeView();
    } finally {
      aiServiceInitializing = false;
    }
    
    return aiServiceInitialized;
  }
  
  // Try to initialize after a short delay to ensure scripts are loaded
  setTimeout(initializeAIService, 500);
  
  // Initialize filters state
  const filters = {
    category: 'all',
    deadline: 'all',
    relevance: 'all',
    source: 'all',
    keyword: '',
    mediaOutlet: '',
    journalist: '',
    search: '',
    platforms: {
      SourceBottle: true,
      Featured: true,
      Qwoted: true
    }
  };
  
  // Check dark mode preference from storage
  chrome.storage.local.get(['settings'], function(result) {
    const settings = result.settings || {};
    const darkMode = settings.ui?.darkMode === true;
    
    if (darkMode) {
      enableDarkMode();
      darkModeToggle.checked = true;
    }
  });
  
  // Set up event listeners with cleanup
  if (searchInput) eventManager.add(searchInput, 'input', handleSearch);
  if (toggleViewBtn) eventManager.add(toggleViewBtn, 'click', toggleView);
  if (toggleFiltersBtn) eventManager.add(toggleFiltersBtn, 'click', toggleFilters);
  if (darkModeToggle) eventManager.add(darkModeToggle, 'change', toggleDarkMode);
  if (applyFiltersBtn) eventManager.add(applyFiltersBtn, 'click', applyFilters);
  if (resetFiltersBtn) eventManager.add(resetFiltersBtn, 'click', resetFilters);
  
  // Find analyze AI button by ID if not in the header
  if (!analyzeAiBtn) {
    analyzeAiBtn = document.getElementById('analyze-ai-btn');
    console.log('Found analyze button by ID:', analyzeAiBtn);
  }
  
  // Add event listener to AI button with cleanup
  if (analyzeAiBtn) {
    console.log('Setting up AI analysis button');
    eventManager.add(analyzeAiBtn, 'click', manualAIAnalysis);
  } else {
    console.error('AI Analysis button not found! Creating it...');
    
    // Create the button if it doesn't exist
    const headerControls = document.querySelector('.header-controls');
    if (headerControls) {
      const aiButton = document.createElement('button');
      aiButton.id = 'analyze-ai-btn';
      aiButton.className = 'header-btn';
      aiButton.style.cssText = 'background-color: var(--color-primary); color: white; border: 1px solid var(--color-primary); border-radius: 4px; padding: 8px 12px; font-size: 14px; display: flex; align-items: center; gap: 5px; cursor: pointer;';
      aiButton.innerHTML = '<span id="ai-icon">🤖</span><span id="ai-text">Analyze with AI</span>';
      // Add click handler with cleanup
      eventManager.add(aiButton, 'click', manualAIAnalysis);
      
      // Create refresh button
      const refreshButton = document.createElement('button');
      refreshButton.id = 'refresh-data-btn';
      refreshButton.className = 'header-btn';
      refreshButton.style.cssText = 'background-color: var(--color-primary); color: white; border: 1px solid var(--color-primary); border-radius: 4px; padding: 8px 12px; margin-right: 8px; font-size: 14px; display: flex; align-items: center; gap: 5px; cursor: pointer;';
      refreshButton.innerHTML = '<span id="refresh-icon">🔄</span><span id="refresh-text">Refresh Data</span>';
      eventManager.add(refreshButton, 'click', refreshData);
      
      // Insert buttons before the first child of the header controls
      headerControls.insertBefore(refreshButton, headerControls.firstChild);
      headerControls.insertBefore(aiButton, headerControls.firstChild);
      
      // Update our reference
      analyzeAiBtn = aiButton;
      aiIcon = aiButton.querySelector('#ai-icon');
      aiText = aiButton.querySelector('#ai-text');
      
      console.log('Created AI Analysis button');
    }
  }
  
  // Auto AI analysis removed - user must click "Do AI analysis" button manually
  
  // Filter input event listeners - with null checks
  const deadlineFilter = document.getElementById('deadline-filter');
  const relevanceFilter = document.getElementById('relevance-filter');
  const sourceFilter = document.getElementById('source-filter');
  const keywordFilter = document.getElementById('keyword-filter');
  const mediaOutletFilter = document.getElementById('media-outlet-filter');
  const journalistFilter = document.getElementById('journalist-filter');
  
  // Add filter event listeners with cleanup
  if (deadlineFilter) eventManager.add(deadlineFilter, 'change', updateFilterValue);
  if (relevanceFilter) eventManager.add(relevanceFilter, 'change', updateFilterValue);
  if (sourceFilter) eventManager.add(sourceFilter, 'change', updateFilterValue);
  if (keywordFilter) eventManager.add(keywordFilter, 'input', updateFilterValue);
  if (mediaOutletFilter) eventManager.add(mediaOutletFilter, 'input', updateFilterValue);
  if (journalistFilter) eventManager.add(journalistFilter, 'input', updateFilterValue);
  
  // Set up platform toggle buttons with cleanup
  const platformToggleButtons = document.querySelectorAll('.platform-toggle-button');
  platformToggleButtons.forEach(button => {
    eventManager.add(button, 'click', togglePlatformFilter);
  });
  
  // Set up Clear All button
  const clearAllBtn = document.getElementById('clear-all-btn');
  if (clearAllBtn) {
    eventManager.add(clearAllBtn, 'click', clearAllOpportunities);
  }
  
  // Load ALL opportunities from storage (both SourceBottle and any others that might be stored)
  loadOpportunities(); // Never auto-trigger AI analysis
  
  // Add test notification button functionality
  const testNotificationBtn = document.getElementById('test-notification-btn');
  if (testNotificationBtn) {
    eventManager.add(testNotificationBtn, 'click', () => {
      showNotification('🔊 Testing new notification chime - Listen for the pleasant 3-tone sequence!', 'success');
    });
  }
  
  /**
   * Show a toast notification with a message and sound
   * @param {string} message - The message to display
   * @param {string} type - The type of notification (success, error, info, warning)
   */
  function showNotification(message, type = 'success') {
    const toast = document.getElementById('toast-notification');
    const toastMessage = document.querySelector('.toast-message');
    const closeButton = document.querySelector('.toast-close');
    
    if (!toast || !toastMessage) return;
    
    // Set message and update styles based on type
    toastMessage.textContent = message;
    
    // Reset and set type-specific styles
    toast.className = 'toast-notification';
    switch(type) {
      case 'error':
        toast.style.backgroundColor = 'var(--color-danger)';
        break;
      case 'warning':
        toast.style.backgroundColor = 'var(--color-warning)';
        break;
      case 'info':
        toast.style.backgroundColor = 'var(--color-primary)';
        break;
      case 'success':
      default:
        toast.style.backgroundColor = 'var(--color-success)';
    }
    
    // Show the toast
    toast.classList.add('show');
    
    // Play notification sound
    playNotificationSound();
    
    // Auto-hide after 5 seconds
    const autoHide = setTimeout(() => {
      hideNotification();
    }, 5000);
    
    // Close button handler
    const closeHandler = () => {
      clearTimeout(autoHide);
      hideNotification();
      closeButton.removeEventListener('click', closeHandler);
    };
    
    if (closeButton) {
      eventManager.add(closeButton, 'click', closeHandler);
    }
    
    // Hide notification function
    function hideNotification() {
      toast.classList.remove('show');
      // Wait for animation to complete before removing from flow
      setTimeout(() => {
        toast.style.display = 'none';
      }, 300);
    }
  }
  
  function loadOpportunities() {
    chrome.storage.local.get(null, function(result) {
      // Try to get opportunities from multiple possible storage keys
      allOpportunities = [];
      
      // Check for sourceBottleOpportunities
      if (result.sourceBottleOpportunities && Array.isArray(result.sourceBottleOpportunities)) {
        // Ensure each opportunity has a source property
        const sourceBottleOps = result.sourceBottleOpportunities.map(op => ({
          ...op,
          source: op.source || 'SourceBottle'
        }));
        allOpportunities = allOpportunities.concat(sourceBottleOps);
        console.log(`Found ${sourceBottleOps.length} SourceBottle opportunities`);
        
        // Debug: Check if publication/journalist data exists
        if (sourceBottleOps.length > 0) {
          console.log('🔍 [DEBUG] Sample SourceBottle opportunity:', sourceBottleOps[0]);
          console.log('🔍 [DEBUG] Fields present:', Object.keys(sourceBottleOps[0]));
        }
      }
      
      // Check for qwotedOpportunities
      if (result.qwotedOpportunities && Array.isArray(result.qwotedOpportunities)) {
        // Ensure each opportunity has a source property
        const qwotedOps = result.qwotedOpportunities.map(op => ({
          ...op,
          source: op.source || 'Qwoted'
        }));
        allOpportunities = allOpportunities.concat(qwotedOps);
        console.log(`Found ${qwotedOps.length} Qwoted opportunities`);
        
        // Debug: Check if mediaOutlet data exists
        if (qwotedOps.length > 0) {
          console.log('🔍 [DEBUG] Sample Qwoted opportunity:', qwotedOps[0]);
          console.log('🔍 [DEBUG] Has mediaOutlet?', !!qwotedOps[0].mediaOutlet);
          console.log('🔍 [DEBUG] Has brandName?', !!qwotedOps[0].brandName);
        }
      }
      
      // Check for featuredOpportunities
      if (result.featuredOpportunities && Array.isArray(result.featuredOpportunities)) {
        // Ensure each opportunity has a source property
        const featuredOps = result.featuredOpportunities.map(op => ({
          ...op,
          source: op.source || 'Featured'
        }));
        allOpportunities = allOpportunities.concat(featuredOps);
        console.log(`Found ${featuredOps.length} Featured opportunities`);
        
        // Debug: Check if publication data exists
        if (featuredOps.length > 0) {
          console.log('🔍 [DEBUG] Sample Featured opportunity:', featuredOps[0]);
          console.log('🔍 [DEBUG] Has publication?', !!featuredOps[0].publication);
          console.log('🔍 [DEBUG] Fields:', Object.keys(featuredOps[0]));
        }
      }
      
      // Check if we have the generic 'opportunities' key (for backwards compatibility)
      // But only use it if we don't have any platform-specific opportunities
      if (result.opportunities && Array.isArray(result.opportunities)) {
        if (allOpportunities.length === 0) {
          // Only use the generic key if we didn't find any platform-specific opportunities
          allOpportunities = result.opportunities;
          console.log(`Using ${result.opportunities.length} opportunities from generic storage key`);
        } else {
          // We already have platform-specific data, so log but don't use to avoid duplicates
          console.log(`Found ${result.opportunities.length} opportunities in generic key (not using to avoid duplicates)`);
        }
      }
      
      // Log all storage keys to help debug
      console.log('All storage keys:', Object.keys(result));
      console.log(`Total loaded: ${allOpportunities.length} opportunities`);
      
      // Check if we have new opportunities
      if (allOpportunities.length > lastOpportunityCount) {
        const newCount = allOpportunities.length - lastOpportunityCount;
        if (newCount > 0) {
          // Show notification for new opportunities
          const message = newCount === 1 
            ? '1 new opportunity added!' 
            : `${newCount} new opportunities added!`;
          showNotification(message, 'success');
        }
      }
      
      // Update the last opportunity count
      lastOpportunityCount = allOpportunities.length;
      
      if (allOpportunities.length === 0) {
        if (opportunitiesContainer) {
          opportunitiesContainer.innerHTML = `
            <div class="no-opportunities">
              <h3>No opportunities found.</h3>
              <p>Please visit one of these platforms to scrape opportunities:</p>
              <div class="platform-links">
                <a href="https://www.sourcebottle.com/categories.asp" target="_blank" style="background-color: #4b6cb7; color: white; padding: 8px 15px; border-radius: 4px; margin: 5px; display: inline-block; text-decoration: none;">SourceBottle</a>
                <a href="https://featured.com/experts/questions" target="_blank" style="background-color: #ff9800; color: white; padding: 8px 15px; border-radius: 4px; margin: 5px; display: inline-block; text-decoration: none;">Featured.com</a>
                <a href="https://app.qwoted.com/source_requests" target="_blank" style="background-color: #009688; color: white; padding: 8px 15px; border-radius: 4px; margin: 5px; display: inline-block; text-decoration: none;">Qwoted</a>
              </div>
            </div>`;
        }
        return;
      }
      
      // First always initialize the view to show opportunities
      initializeView();
      
      // AI analysis only runs when user clicks "Do AI analysis" button
      // Auto-trigger removed to prevent unwanted processing
    });
  }
  
  function processOpportunitiesWithAI() {
    // Always ensure the view is initialized, regardless of AI availability
    initializeView();
    
    // Only attempt AI processing if the service is available and enabled
    if (aiService && typeof aiService.isEnabled === 'function' && aiService.isEnabled()) {
      // Update UI to show processing - with null checks
      aiProcessing = true;
      
      // Make sure UI elements exist before using them
      if (aiIcon) aiIcon.textContent = '⚙️';
      if (aiText) aiText.textContent = 'Processing...';
      if (analyzeAiBtn) analyzeAiBtn.classList.add('processing');
      
      console.log('Processing opportunities with AI...');
      aiService.processOpportunities(allOpportunities)
        .then(processed => {
          // Update allOpportunities with AI processed data
          allOpportunities = processed;
          
          // Update UI to show completion - with null checks
          aiProcessing = false;
          if (aiIcon) aiIcon.textContent = '✓';
          if (aiText) aiText.textContent = 'AI Analysis Complete';
          if (analyzeAiBtn) {
            analyzeAiBtn.classList.remove('processing');
            analyzeAiBtn.classList.add('success');
          }
          
          // Show success notification
          const notification = document.createElement('div');
          notification.className = 'ai-notification success';
          notification.textContent = `AI analyzed ${processed.length} opportunities`;
          document.body.appendChild(notification);
          
          setTimeout(() => {
            notification.classList.add('show');
            setTimeout(() => {
              notification.classList.remove('show');
              setTimeout(() => {
                document.body.removeChild(notification);
              }, 500);
            }, 3000);
          }, 100);
          
          // Refresh the current view with processed opportunities
          applyFilters();
          
          // Reset button after 2 seconds - with null checks
          setTimeout(() => {
            if (aiIcon) aiIcon.textContent = '🤖';
            if (aiText) aiText.textContent = 'Analyze with AI';
            if (analyzeAiBtn) analyzeAiBtn.classList.remove('success');
          }, 2000);
        })
        .catch(err => {
          console.error('Error processing opportunities with AI:', err);
          
          // Update UI to show error - with null checks
          aiProcessing = false;
          if (aiIcon) aiIcon.textContent = '❌';
          if (aiText) aiText.textContent = 'Error: Check Console';
          if (analyzeAiBtn) {
            analyzeAiBtn.classList.remove('processing');
            analyzeAiBtn.classList.add('error');
          }
          
          // Show error notification
          const notification = document.createElement('div');
          notification.className = 'ai-notification error';
          notification.textContent = `Error: ${err.message || 'Failed to process with AI'}`;
          document.body.appendChild(notification);
          
          setTimeout(() => {
            notification.classList.add('show');
            setTimeout(() => {
              notification.classList.remove('show');
              setTimeout(() => {
                document.body.removeChild(notification);
              }, 500);
            }, 3000);
          }, 100);
          
          // Reset button after 3 seconds - with null checks
          setTimeout(() => {
            if (aiIcon) aiIcon.textContent = '🤖';
            if (aiText) aiText.textContent = 'Analyze with AI';
            if (analyzeAiBtn) analyzeAiBtn.classList.remove('error');
          }, 3000);
        });
    } else {
      console.log('AI service not available or not enabled, skipping processing');
      
      // Show notification that API key is needed
      const notification = document.createElement('div');
      notification.className = 'ai-notification warning';
      notification.textContent = 'AI service not configured. Please add your OpenAI API key in settings.';
      document.body.appendChild(notification);
      
      setTimeout(() => {
        notification.classList.add('show');
        setTimeout(() => {
          notification.classList.remove('show');
          setTimeout(() => {
            document.body.removeChild(notification);
          }, 500);
        }, 3000);
      }, 100);
      
      applyFilters();
    }
  }

  // Manual AI analysis function (triggered by button)
  async function manualAIAnalysis() {
    if (aiProcessing) {
      // Already processing, don't start again
      return;
    }
    
    console.log('Manual AI analysis triggered');
    
    // Show a notification that we're starting analysis
    const startNotification = document.createElement('div');
    startNotification.className = 'ai-notification info';
    startNotification.textContent = 'Starting AI analysis of opportunities...';
    document.body.appendChild(startNotification);
    
    setTimeout(() => {
      startNotification.classList.add('show');
      setTimeout(() => {
        startNotification.classList.remove('show');
        setTimeout(() => {
          if (document.body.contains(startNotification)) {
            document.body.removeChild(startNotification);
          }
        }, 500);
      }, 2000);
    }, 100);
    
    // Check if AI service is available and initialize it properly
    try {
      const initialized = await initializeAIService();
      if (!initialized) {
        // Show notification to configure API key
        const notification = document.createElement('div');
        notification.className = 'ai-notification warning';
        notification.innerHTML = 'Please add your OpenAI API key in <a href="settings.html" target="_blank">settings</a>.';
        document.body.appendChild(notification);
        
        setTimeout(() => {
          notification.classList.add('show');
          setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
              if (document.body.contains(notification)) {
                document.body.removeChild(notification);
              }
            }, 500);
          }, 3000);
        }, 100);
        return;
      }
    } catch (err) {
      console.error('Error initializing AI service for manual analysis:', err);
      return;
    }
    
    // Check if the AI service has the processOpportunities method
    if (typeof aiService.processOpportunities !== 'function') {
      console.error('AI service does not have processOpportunities method');
      console.log('Available methods:', Object.keys(aiService).filter(key => typeof aiService[key] === 'function'));
      
      // Try to use the analyzeOpportunity method as a fallback
      if (typeof aiService.analyzeOpportunity === 'function') {
        console.log('Using analyzeOpportunity as fallback');
        
        // Update UI to show processing
        aiProcessing = true;
        if (aiIcon) aiIcon.textContent = '⚙️';
        if (aiText) aiText.textContent = 'Processing...';
        if (analyzeAiBtn) analyzeAiBtn.classList.add('processing');
        
        // Process each opportunity individually
        const processPromises = allOpportunities.slice(0, 10).map(opportunity => {
          return aiService.analyzeOpportunity(opportunity)
            .then(analysis => {
              return {
                ...opportunity,
                relevanceScore: Math.round(analysis.relevance_score * 100),
                priority: analysis.priority,
                keyThemes: analysis.key_themes,
                aiProcessed: true,
                aiProcessedAt: new Date().toISOString()
              };
            })
            .catch(err => {
              console.error('Error processing opportunity:', err);
              return opportunity;
            });
        });
        
        // Process all opportunities
        Promise.all(processPromises)
          .then(processedOpportunities => {
            // Replace the first 10 opportunities with processed ones
            const updatedOpportunities = [...allOpportunities];
            processedOpportunities.forEach((opp, index) => {
              updatedOpportunities[index] = opp;
            });
            
            // Update allOpportunities with AI processed data
            allOpportunities = updatedOpportunities;
            
            // Update UI to show completion
            aiProcessing = false;
            if (aiIcon) aiIcon.textContent = '✓';
            if (aiText) aiText.textContent = 'AI Analysis Complete';
            if (analyzeAiBtn) {
              analyzeAiBtn.classList.remove('processing');
              analyzeAiBtn.classList.add('success');
            }
            
            // Show success notification
            const notification = document.createElement('div');
            notification.className = 'ai-notification success';
            notification.textContent = `AI analyzed ${processedOpportunities.length} opportunities`;
            document.body.appendChild(notification);
            
            setTimeout(() => {
              notification.classList.add('show');
              setTimeout(() => {
                notification.classList.remove('show');
                setTimeout(() => {
                  if (document.body.contains(notification)) {
                    document.body.removeChild(notification);
                  }
                }, 500);
              }, 3000);
            }, 100);
            
            // Refresh the current view with processed opportunities
            applyFilters();
            
            // Reset button after 2 seconds - with null checks
            setTimeout(() => {
              if (aiIcon) aiIcon.textContent = '🤖';
              if (aiText) aiText.textContent = 'Analyze with AI';
              if (analyzeAiBtn) analyzeAiBtn.classList.remove('success');
            }, 2000);
          })
          .catch(err => {
            console.error('Error in batch processing opportunities:', err);
            
            // Update UI to show error
            aiProcessing = false;
            if (aiIcon) aiIcon.textContent = '❌';
            if (aiText) aiText.textContent = 'Error: Check Console';
            if (analyzeAiBtn) {
              analyzeAiBtn.classList.remove('processing');
              analyzeAiBtn.classList.add('error');
            }
            
            // Show error notification
            const notification = document.createElement('div');
            notification.className = 'ai-notification error';
            notification.textContent = `Error: ${err.message || 'Failed to process with AI'}`;
            document.body.appendChild(notification);
            
            setTimeout(() => {
              notification.classList.add('show');
              setTimeout(() => {
                notification.classList.remove('show');
                setTimeout(() => {
                  if (document.body.contains(notification)) {
                    document.body.removeChild(notification);
                  }
                }, 500);
              }, 3000);
            }, 100);
            
            // Reset button after 3 seconds - with null checks
            setTimeout(() => {
              if (aiIcon) aiIcon.textContent = '🤖';
              if (aiText) aiText.textContent = 'Analyze with AI';
              if (analyzeAiBtn) analyzeAiBtn.classList.remove('error');
            }, 3000);
          });
        
        return;
      }
      
      // Show error notification
      const notification = document.createElement('div');
      notification.className = 'ai-notification error';
      notification.textContent = 'AI service missing required methods';
      document.body.appendChild(notification);
      
      setTimeout(() => {
        notification.classList.add('show');
        setTimeout(() => {
          notification.classList.remove('show');
          setTimeout(() => {
            if (document.body.contains(notification)) {
              document.body.removeChild(notification);
            }
          }, 500);
        }, 3000);
      }, 100);
      
      return;
    }
    
    // AI service exists, check if it's initialized with proper race condition handling
    try {
      const initialized = await initializeAIService();
      if (initialized) {
        processOpportunitiesWithAI();
      } else {
        // Show notification to configure API key
        const notification = document.createElement('div');
        notification.className = 'ai-notification warning';
        notification.innerHTML = 'Please add your OpenAI API key in <a href="settings.html" target="_blank">settings</a>.';
        document.body.appendChild(notification);
        
        setTimeout(() => {
          notification.classList.add('show');
          setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
              if (document.body.contains(notification)) {
                document.body.removeChild(notification);
              }
            }, 500);
          }, 3000);
        }, 100);
      }
    } catch (err) {
      console.error('Error initializing AI service:', err);
      
      // Show error notification
      const notification = document.createElement('div');
      notification.className = 'ai-notification error';
      notification.textContent = `Error initializing AI: ${err.message}`;
      document.body.appendChild(notification);
      
      setTimeout(() => {
        notification.classList.add('show');
        setTimeout(() => {
          notification.classList.remove('show');
          setTimeout(() => {
            if (document.body.contains(notification)) {
              document.body.removeChild(notification);
            }
          }, 500);
        }, 3000);
      }, 100);
    }
  }
  
  function initializeView() {
    // Create category filters
    createCategoryFilters();
    
    // Apply initial filters and render
    applyFilters();
  }
  
  function createCategoryFilters() {
    // Get unique categories
    const categories = [...new Set(allOpportunities.map(opp => opp.category))];
    console.log('Categories:', categories);
    
    // Clear existing category filters except "All"
    const existingButtons = categoryFilters.querySelectorAll('.filter-button:not([data-category="all"])');
    existingButtons.forEach(button => button.remove());
    
    // Add category filters
    categories.forEach(category => {
      if (category) {  // Skip null or undefined categories
        const button = document.createElement('button');
        button.className = 'filter-button';
        button.dataset.category = category;
        button.textContent = category;
        button.addEventListener('click', function() {
          setActiveCategory(this.dataset.category);
        });
        categoryFilters.appendChild(button);
      }
    });
    
    // Add event listener to "All Categories" button if it doesn't have one
    const allButton = categoryFilters.querySelector('[data-category="all"]');
    if (allButton) {
      allButton.addEventListener('click', function() {
        setActiveCategory('all');
      });
    }
  }
  
  function setActiveCategory(category) {
    // Remove active class from all buttons
    categoryFilters.querySelectorAll('.filter-button').forEach(btn => btn.classList.remove('active'));
    
    // Add active class to clicked button
    const selectedButton = categoryFilters.querySelector(`[data-category="${category}"]`);
    if (selectedButton) {
      selectedButton.classList.add('active');
    }
    
    // Update filters and apply
    filters.category = category;
    applyFilters();
  }
  
  function updateFilterValue(e) {
    const id = e.target.id;
    
    switch(id) {
      case 'deadline-filter':
        filters.deadline = e.target.value;
        break;
      case 'relevance-filter':
        filters.relevance = e.target.value;
        break;
      case 'source-filter':
        filters.source = e.target.value;
        break;
      case 'keyword-filter':
        filters.keyword = e.target.value.trim().toLowerCase();
        break;
      case 'media-outlet-filter':
        filters.mediaOutlet = e.target.value.trim().toLowerCase();
        break;
      case 'journalist-filter':
        filters.journalist = e.target.value.trim().toLowerCase();
        break;
    }
    
    // Not applying filters immediately to avoid frequent rerenders
    // User will need to click 'Apply Filters' button
  }
  
  function handleSearch(e) {
    filters.search = e.target.value.trim().toLowerCase();
    // Apply search filter immediately
    applyFilters();
  }
  
  // Platform toggle button handler
  function togglePlatformFilter(event) {
    const button = event.currentTarget;
    const platform = button.dataset.platform;
    
    // Toggle active state
    button.classList.toggle('active');
    
    // Update filter state
    filters.platforms[platform] = button.classList.contains('active');
    
    // Update button styling
    if (button.classList.contains('active')) {
      // Active state styling - colored background
      button.style.color = 'white';
      switch (platform) {
        case 'SourceBottle':
          button.style.backgroundColor = '#4b6cb7';
          break;
        case 'Featured':
          button.style.backgroundColor = '#ff9800';
          break;
        case 'Qwoted':
          button.style.backgroundColor = '#009688';
          break;
      }
    } else {
      // Inactive state styling - white background, colored text
      button.style.backgroundColor = 'white';
      switch (platform) {
        case 'SourceBottle':
          button.style.color = '#4b6cb7';
          break;
        case 'Featured':
          button.style.color = '#ff9800';
          break;
        case 'Qwoted':
          button.style.color = '#009688';
          break;
      }
    }
    
    // Apply updated filters
    applyFilters();
  }

  function applyFilters() {
    filteredOpportunities = allOpportunities.filter(opportunity => {
      // Initialize as true and apply each filter sequentially
      let passesFilters = true;
      
      // Platform filter
      const sourceString = (opportunity.source || opportunity.platform || 'SourceBottle').toLowerCase().replace(/\s+/g, '');
      let platformPasses = false;
      
      // Check each enabled platform
      if (filters.platforms.SourceBottle && sourceString.includes('sourcebottle')) {
        platformPasses = true;
      }
      if (filters.platforms.Featured && sourceString.includes('featured')) {
        platformPasses = true;
      }
      if (filters.platforms.Qwoted && sourceString.includes('qwoted')) {
        platformPasses = true;
      }
      
      passesFilters = passesFilters && platformPasses;
      
      // Category filter
      if (filters.category !== 'all') {
        passesFilters = passesFilters && opportunity.category === filters.category;
      }
      
      // Deadline filter
      if (filters.deadline !== 'all') {
        const deadlineDate = new Date(opportunity.deadline);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        const endOfWeek = new Date(today);
        endOfWeek.setDate(endOfWeek.getDate() + (7 - endOfWeek.getDay()));
        
        const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        
        switch(filters.deadline) {
          case 'today':
            passesFilters = passesFilters && deadlineDate >= today && deadlineDate < tomorrow;
            break;
          case 'tomorrow':
            passesFilters = passesFilters && deadlineDate >= tomorrow && deadlineDate < new Date(tomorrow.getTime() + 24 * 60 * 60 * 1000);
            break;
          case 'week':
            passesFilters = passesFilters && deadlineDate >= today && deadlineDate <= endOfWeek;
            break;
          case 'month':
            passesFilters = passesFilters && deadlineDate >= today && deadlineDate <= endOfMonth;
            break;
        }
      }
      
      // Relevance filter
      if (filters.relevance !== 'all' && opportunity.relevanceScore !== undefined) {
        const score = opportunity.relevanceScore;
        switch(filters.relevance) {
          case 'high':
            passesFilters = passesFilters && score >= 80;
            break;
          case 'medium':
            passesFilters = passesFilters && score >= 50 && score < 80;
            break;
          case 'low':
            passesFilters = passesFilters && score < 50;
            break;
        }
      }
      
      // Source filter
      if (filters.source !== 'all') {
        passesFilters = passesFilters && opportunity.source && opportunity.source.toLowerCase().includes(filters.source.toLowerCase());
      }
      
      // Keyword filter
      if (filters.keyword) {
        const hasMatchingKeyword = opportunity.keywords && Array.isArray(opportunity.keywords) && 
          opportunity.keywords.some(keyword => keyword.toLowerCase().includes(filters.keyword));
        
        // If no keywords but we have text content, search that
        const contentMatch = ((opportunity.title || '') + ' ' + (opportunity.description || '')).toLowerCase().includes(filters.keyword);
        
        passesFilters = passesFilters && (hasMatchingKeyword || contentMatch);
      }
      
      // Media outlet filter - use platform-aware field mapping
      if (filters.mediaOutlet) {
        const outletName = getOutletName(opportunity);
        if (outletName && outletName !== 'Media outlet not available') {
          passesFilters = passesFilters && outletName.toLowerCase().includes(filters.mediaOutlet);
        } else {
          passesFilters = false; // No outlet data available
        }
      }
      
      // Journalist filter
      if (filters.journalist && opportunity.journalist) {
        passesFilters = passesFilters && opportunity.journalist.toLowerCase().includes(filters.journalist);
      }
      
      // Search filter (search across all fields) - use platform-aware mapping
      if (filters.search) {
        const searchText = filters.search.toLowerCase();
        const searchInFields = [
          getFieldValue(opportunity, 'title') || opportunity.title || '',
          getFieldValue(opportunity, 'description') || opportunity.description || '',
          opportunity.category || '',
          getOutletName(opportunity) || '',
          opportunity.journalist || opportunity.journalistType || '',
          ...(opportunity.keywords || [])
        ].map(field => field.toLowerCase());
        
        passesFilters = passesFilters && searchInFields.some(field => field.includes(searchText));
      }
      
      return passesFilters;
    });
    
    // Reset to first page
    currentPage = 1;
    
    // Render filtered opportunities
    renderOpportunities();
    
    // Update pagination
    renderPagination();
  }
  
  function resetFilters() {
    // Reset filter form
    document.getElementById('deadline-filter').value = 'all';
    document.getElementById('relevance-filter').value = 'all';
    document.getElementById('source-filter').value = 'all';
    document.getElementById('keyword-filter').value = '';
    document.getElementById('media-outlet-filter').value = '';
    document.getElementById('journalist-filter').value = '';
    
    // Reset filter state
    filters.deadline = 'all';
    filters.relevance = 'all';
    filters.source = 'all';
    filters.keyword = '';
    filters.mediaOutlet = '';
    filters.journalist = '';
    
    // Don't reset category or search - these are considered primary filters
    
    // Apply updated filters
    applyFilters();
  }
  
  // Field mappings for each platform
  const FIELD_MAPPINGS = {
    'sourcebottle': {
      title: 'title',
      description: 'description',
      outlet: 'publication',
      journalistInfo: 'journalistType',
      deadline: 'deadline'
    },
    'featured': {
      title: 'question',        // Featured uses 'question' instead of 'title'
      description: 'question',  // Same field for description
      outlet: 'publication',    // Featured has 'publication' field
      deadline: 'closeDate'     // Featured has 'closeDate' for absolute dates
    },
    'qwoted': {
      title: 'title',
      description: 'description', 
      outlet: 'mediaOutlet',    // Qwoted uses 'mediaOutlet'
      brandName: 'brandName',   // Additional outlet info
      deadline: 'deadline'
    }
  };

  // Function to get the correct field value based on platform
  function getFieldValue(opportunity, displayField) {
    const rawPlatform = opportunity.source || opportunity.platform || 'SourceBottle';
    const platform = rawPlatform.toLowerCase().replace(/\s+/g, '');
    
    const mapping = FIELD_MAPPINGS[platform];
    
    if (!mapping) {
      // Fallback to direct property access
      console.log(`🔍 [FIELD MAPPING] No mapping found for platform: ${platform}, using direct access for field: ${displayField}`);
      return opportunity[displayField] || null;
    }
    
    const actualField = mapping[displayField];
    if (!actualField) {
      // No mapping for this display field
      return opportunity[displayField] || null;
    }
    
    const value = opportunity[actualField] || null;
    
    // Debug logging for all missing values, not just title
    if (!value) {
      console.log(`🔍 [FIELD MAPPING] Missing ${displayField} for platform ${platform}:`, {
        displayField: displayField,
        actualField: actualField,
        mappingValue: mapping[displayField],
        opportunityKeys: Object.keys(opportunity),
        opportunitySourceField: opportunity[actualField]
      });
    }
    
    return value;
  }

  // Function to get outlet name with platform-specific fallbacks
  function getOutletName(opportunity) {
    const rawPlatform = opportunity.source || opportunity.platform || 'SourceBottle';
    const platform = rawPlatform.toLowerCase().replace(/\s+/g, '');
    
    // Debug what we're receiving (reduce logging by checking first)
    if (!opportunity.publication && !opportunity.mediaOutlet && !opportunity.brandName) {
      console.log(`🔍 [getOutletName] No outlet data found:`, {
        platform: platform,
        source: opportunity.source,
        fields: Object.keys(opportunity)
      });
    }
    
    let result;
    switch(platform) {
      case 'sourcebottle':
        result = opportunity.publication || 'Media outlet not available';
        break;
      case 'featured':
        result = opportunity.publication || 'Media outlet not available';
        break;
      case 'qwoted':
        result = opportunity.mediaOutlet || opportunity.brandName || 'Media outlet not available';
        break;
      default:
        result = opportunity.publication || opportunity.mediaOutlet || 'Media outlet not available';
    }
    
    // Debug logging for missing outlets
    if (result === 'Media outlet not available') {
      console.log(`🔍 [OUTLET MAPPING] Missing outlet for platform ${platform}:`, {
        publication: opportunity.publication,
        mediaOutlet: opportunity.mediaOutlet,
        brandName: opportunity.brandName,
        opportunity: opportunity
      });
    }
    
    return result;
  }

  function renderOpportunities() {
    if (filteredOpportunities.length === 0) {
      opportunitiesContainer.innerHTML = '<div class="no-opportunities">No opportunities found for the selected filters.</div>';
      return;
    }
    
    opportunitiesContainer.innerHTML = '';
    
    // Calculate pagination
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, filteredOpportunities.length);
    const currentItems = filteredOpportunities.slice(startIndex, endIndex);
    
    // Create document fragment for better performance
    const fragment = document.createDocumentFragment();
    const cardsToProcess = [];
    
    currentItems.forEach(opp => {
      try {
        if (!opp || typeof opp !== 'object') {
          console.error('Invalid opportunity object:', opp);
          return; // Skip this invalid opportunity
        }
        
        // Get source first (needed for debugging)
        const source = opp.source || 'SourceBottle';
        
        // Create category class (for CSS)
        const category = opp.category || 'General';
        const categoryClass = category.toLowerCase().replace(/[^a-z0-9]/g, '-');
        
        // Format date with error handling
        let formattedDate = 'Unknown';
        try {
          // Get deadline using platform-aware mapping
          const deadlineValue = getFieldValue(opp, 'deadline') || opp.deadline || opp.closeDate;
          
          // Debug what we actually got
          if (!deadlineValue || deadlineValue === 'closeDate' || deadlineValue === 'deadline') {
            console.error(`🚨 DEADLINE ERROR for ${source}:`, {
              deadlineValue: deadlineValue,
              oppDeadline: opp.deadline,
              oppCloseDate: opp.closeDate,
              allFields: Object.keys(opp),
              fullOpp: opp
            });
          }
          
          if (deadlineValue && deadlineValue !== 'closeDate' && deadlineValue !== 'deadline') {
            // Check for valid date format
            const deadlineDate = new Date(deadlineValue);
            
            // Check if date is valid (not NaN)
            if (!isNaN(deadlineDate.getTime())) {
              formattedDate = deadlineDate.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
              });
            } else if (typeof deadlineValue === 'string') {
              // If it's a string but not a valid date, just show the string
              formattedDate = deadlineValue;
            }
          }
        } catch (e) {
          console.error('Error formatting date:', e, 'Raw deadline value:', opp.deadline);
          // Use the raw value as a fallback
          formattedDate = opp.deadline || opp.closeDate || 'Unknown';
        }
        
        // Platform-aware field access with debugging
        const title = getFieldValue(opp, 'title') || opp.title || 'Untitled Opportunity';
        const description = getFieldValue(opp, 'description') || opp.description || 'No description available';
        const mediaOutlet = getOutletName(opp);
        const journalist = opp.journalist || opp.journalistType || 'Not specified';
        
        // Debug logging only for opportunities with missing data
        if (title === 'Untitled Opportunity' || mediaOutlet === 'Media outlet not available') {
          console.log(`🔍 [FIELD MAPPING DEBUG] Missing data for ${source}:`, {
            originalFields: {
              title: opp.title,
              question: opp.question,
              publication: opp.publication,
              mediaOutlet: opp.mediaOutlet,
              source: opp.source
            },
            mappedTitle: title,
            mappedOutlet: mediaOutlet
          });
        }
        
        // For the View Opportunity button, determine the correct URL to use
        let viewUrl = '#';
        if (opp.url) {
          viewUrl = opp.url;
        } else if (opp.submissionLink) {
          viewUrl = opp.submissionLink;
        } else if (source === 'Qwoted') {
          viewUrl = 'https://app.qwoted.com/source_requests';
        } else if (source === 'Featured') {
          viewUrl = 'https://featured.com/experts/questions';
        } else if (source === 'SourceBottle') {
          viewUrl = 'https://www.sourcebottle.com/categories.asp';
        }
        
        // Create card
        const card = document.createElement('div');
        card.className = 'opportunity-card';
        
        // Add relevance badge if available
        let relevanceBadge = '';
        if (opp.relevanceScore !== undefined) {
          const score = opp.relevanceScore;
          let relevanceClass = 'medium';
          if (score >= 80) relevanceClass = 'high';
          if (score < 50) relevanceClass = 'low';
          
          relevanceBadge = `<div class="relevance-badge ${relevanceClass}">${score}% Match</div>`;
        }
        
        // Keywords display if available
        let keywordsHtml = '';
        if (opp.keywords && opp.keywords.length > 0) {
          const keywordTags = opp.keywords.map(keyword => 
            `<span class="card-tag">${keyword}</span>`
          ).join('');
          
          keywordsHtml = `
            <div class="card-tags">
              ${keywordTags}
            </div>
          `;
        }
        
        card.innerHTML = `
          <div class="card-header">
            <div>
              <h3 class="card-title">${title}</h3>
              <span class="card-category ${categoryClass}">${category}</span>
            </div>
            ${relevanceBadge}
          </div>
          <div class="card-body">
            <p class="card-description">${description.substring(0, 200)}${description.length > 200 ? '...' : ''}</p>
            ${keywordsHtml}
            <div class="card-meta">
              <span>🗓️ Deadline: ${formattedDate}</span>
              <span>🔍 Source: ${source}</span>
            </div>
            <div class="card-meta">
              <span>📰 ${mediaOutlet}</span>
              <span>👤 ${journalist}</span>
            </div>
            <div class="card-actions">
              <a href="${viewUrl}" target="_blank" class="action-button view-button">View Opportunity</a>
              ${opp.aiProcessed ?
                `<button class="action-button ai-view-button" data-opportunity-id="${opp.id || opp.externalId}">
                   <span class="ai-icon">🤖</span> View AI Analysis
                 </button>` :
                `<button class="action-button save-button">Save</button>`
              }
            </div>
          </div>
        `;
        
        // Add the card to the fragment instead of directly to DOM
        fragment.appendChild(card);
        
        // Store card for later event listener attachment
        cardsToProcess.push(card);
      } catch (error) {
        console.error('Error rendering opportunity:', error, opp);
      }
    });
    
    // Append the fragment to the DOM all at once for better performance
    opportunitiesContainer.appendChild(fragment);
    
    // Attach event listeners to the cards after they've been added to the DOM
    cardsToProcess.forEach(card => {
      // Add event listeners to AI view buttons
      const aiViewButton = card.querySelector('.ai-view-button');
      if (aiViewButton) {
        aiViewButton.addEventListener('click', function() {
          const opportunityId = this.dataset.opportunityId;
          showAIAnalysis(opportunityId);
        });
      }
      
      // Add event listeners to save buttons
      const saveButton = card.querySelector('.save-button');
      if (saveButton) {
        saveButton.addEventListener('click', function() {
          // Save functionality would go here
          console.log('Save button clicked');
        });
      }
    });
  }
  
  function renderPagination() {
    if (filteredOpportunities.length <= itemsPerPage) {
      paginationContainer.innerHTML = '';
      return;
    }
    
    const totalPages = Math.ceil(filteredOpportunities.length / itemsPerPage);
    let paginationHTML = '';
    
    // Previous button
    paginationHTML += `<button class="pagination-button ${currentPage === 1 ? 'disabled' : ''}" ${currentPage === 1 ? 'disabled' : ''} data-page="prev">Previous</button>`;
    
    // Page buttons
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
    
    // Adjust if we're near the end
    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }
    
    if (startPage > 1) {
      paginationHTML += `<button class="pagination-button" data-page="1">1</button>`;
      if (startPage > 2) {
        paginationHTML += `<span class="pagination-ellipsis">...</span>`;
      }
    }
    
    for (let i = startPage; i <= endPage; i++) {
      paginationHTML += `<button class="pagination-button ${i === currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
    }
    
    if (endPage < totalPages) {
      if (endPage < totalPages - 1) {
        paginationHTML += `<span class="pagination-ellipsis">...</span>`;
      }
      paginationHTML += `<button class="pagination-button" data-page="${totalPages}">${totalPages}</button>`;
    }
    
    // Next button
    paginationHTML += `<button class="pagination-button ${currentPage === totalPages ? 'disabled' : ''}" ${currentPage === totalPages ? 'disabled' : ''} data-page="next">Next</button>`;
    
    paginationContainer.innerHTML = paginationHTML;
    
    // Add event listeners to pagination buttons
    paginationContainer.querySelectorAll('.pagination-button').forEach(button => {
      button.addEventListener('click', function() {
        if (this.disabled) return;
        
        const page = this.dataset.page;
        
        if (page === 'prev') {
          currentPage = Math.max(1, currentPage - 1);
        } else if (page === 'next') {
          currentPage = Math.min(totalPages, currentPage + 1);
        } else {
          currentPage = parseInt(page);
        }
        
        renderOpportunities();
        renderPagination();
        
        // Scroll to top of opportunities
        opportunitiesContainer.scrollIntoView({ behavior: 'smooth' });
      });
    });
  }
  
  function toggleView() {
    const body = document.body;
    
    if (body.classList.contains('list-view')) {
      // Switch to grid view
      body.classList.remove('list-view');
      body.classList.add('grid-view');
      viewIcon.textContent = '📋';
      viewText.textContent = 'List View';
    } else {
      // Switch to list view
      body.classList.remove('grid-view');
      body.classList.add('list-view');
      viewIcon.textContent = '📊';
      viewText.textContent = 'Grid View';
    }
    
    // Save preference to storage
    chrome.storage.local.get(['settings'], function(result) {
      const settings = result.settings || {};
      if (!settings.ui) settings.ui = {};
      
      settings.ui.defaultView = body.classList.contains('list-view') ? 'list' : 'grid';
      
      chrome.storage.local.set({ 'settings': settings });
    });
  }
  
  function toggleFilters() {
    const isVisible = filtersContent.style.display !== 'none';
    
    if (isVisible) {
      filtersContent.style.display = 'none';
      toggleFiltersBtn.textContent = 'Show Filters';
    } else {
      filtersContent.style.display = 'block';
      toggleFiltersBtn.textContent = 'Hide Filters';
    }
  }
  
  function toggleDarkMode() {
    const isDark = darkModeToggle.checked;
    
    if (isDark) {
      enableDarkMode();
    } else {
      disableDarkMode();
    }
    
    // Save preference to storage
    chrome.storage.local.get(['settings'], function(result) {
      const settings = result.settings || {};
      if (!settings.ui) settings.ui = {};
      
      settings.ui.darkMode = isDark;
      
      chrome.storage.local.set({ 'settings': settings });
    });
  }
  
  function enableDarkMode() {
    document.body.classList.add('dark-mode');
  }
  
  function disableDarkMode() {
    document.body.classList.remove('dark-mode');
  }
  
  // Initialize view based on saved preference
  chrome.storage.local.get(['settings'], function(result) {
    const settings = result.settings || {};
    const defaultView = settings.ui?.defaultView || 'grid';
    
    if (defaultView === 'list') {
      document.body.classList.add('list-view');
      viewIcon.textContent = '📊';
      viewText.textContent = 'Grid View';
    } else {
      document.body.classList.add('grid-view');
      viewIcon.textContent = '📋';
      viewText.textContent = 'List View';
    }
  });
  
  // Add the AI Analysis Modal to the document
  const modalHtml = `
    <div id="ai-analysis-modal" class="modal">
      <div class="modal-content">
        <div class="modal-header">
          <h2>AI Analysis Results</h2>
          <span class="close-modal">&times;</span>
        </div>
        <div class="modal-body">
          <div id="ai-analysis-content">
            <div class="analysis-section">
              <h3>Opportunity Details</h3>
              <div id="opportunity-details"></div>
            </div>
            <div class="analysis-section">
              <h3>Relevance Score</h3>
              <div id="relevance-score"></div>
            </div>
            <div class="analysis-section">
              <h3>Key Themes</h3>
              <div id="key-themes"></div>
            </div>
            <div class="analysis-section">
              <h3>Analysis Summary</h3>
              <div id="analysis-summary"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
  
  // Add modal to the document
  document.body.insertAdjacentHTML('beforeend', modalHtml);
  
  // Add modal styles
  const styleEl = document.createElement('style');
  styleEl.textContent = `
    .modal {
      display: none;
      position: fixed;
      z-index: 9999;
      left: 0;
      top: 0;
      width: 100%;
      height: 100%;
      background-color: rgba(0,0,0,0.5);
      overflow: auto;
    }
    
    .modal-content {
      background-color: var(--color-card-bg);
      margin: 10% auto;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 4px 8px rgba(0,0,0,0.2);
      width: 80%;
      max-width: 700px;
      max-height: 80vh;
      overflow-y: auto;
      position: relative;
      color: var(--color-text);
    }
    
    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid var(--color-border);
      padding-bottom: 10px;
      margin-bottom: 15px;
    }
    
    .close-modal {
      font-size: 28px;
      font-weight: bold;
      cursor: pointer;
      color: var(--color-text-light);
    }
    
    .close-modal:hover {
      color: var(--color-primary);
    }
    
    .analysis-section {
      margin-bottom: 20px;
      padding-bottom: 15px;
      border-bottom: 1px solid var(--color-border);
    }
    
    .analysis-section h3 {
      margin-bottom: 10px;
      color: var(--color-primary);
    }
    
    #relevance-score {
      font-size: 24px;
      font-weight: bold;
      padding: 10px;
      border-radius: 4px;
      display: inline-block;
    }
    
    .score-high {
      background-color: rgba(76, 175, 80, 0.2);
      color: #4CAF50;
    }
    
    .score-medium {
      background-color: rgba(255, 152, 0, 0.2);
      color: #FF9800;
    }
    
    .score-low {
      background-color: rgba(244, 67, 54, 0.2);
      color: #F44336;
    }
    
    .theme-tag {
      display: inline-block;
      background-color: var(--color-primary-light);
      color: var(--color-white);
      padding: 5px 10px;
      border-radius: 15px;
      margin: 3px;
      font-size: 14px;
    }
    
    .dark-mode .theme-tag {
      background-color: var(--color-primary-dark);
    }
  `;
  document.head.appendChild(styleEl);
  
  // Get modal elements
  const modal = document.getElementById('ai-analysis-modal');
  const closeModal = document.querySelector('.close-modal');
  
  // Close modal when clicking the X
  if (closeModal) {
    const closeHandler = () => {
      const modal = document.getElementById('ai-analysis-modal');
      if (modal) modal.style.display = 'none';
    };
    eventManager.add(closeModal, 'click', closeHandler);
  }

  // Close modal when clicking outside of it
  const windowClickHandler = (event) => {
    const modal = document.getElementById('ai-analysis-modal');
    if (event.target === modal && modal) {
      modal.style.display = 'none';
    }
  };
  eventManager.add(window, 'click', windowClickHandler);
  
  // Mark initialization as complete
  isInitialized = true;
  console.log('App initialization complete');
  
  // Return cleanup function for manual control if needed
  return cleanup;
  } catch (error) {
    console.error('Error during app initialization:', error);
    // Ensure we still return a cleanup function
    return () => eventManager.removeAll();
  }
}

// Start the application when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', initializeApp);

// Function to clear all opportunities from storage
function clearAllOpportunities() {
  if (confirm('Are you sure you want to clear all opportunities? This action cannot be undone.')) {
      // Stop any ongoing AI processing
      aiProcessing = false;
      
      // Clear all opportunity data from storage - comprehensive cleanup
      const keysToRemove = [
        // Platform-specific opportunity keys
        'sourceBottleOpportunities',
        'featuredOpportunities',
        'qwotedOpportunities',
        
        // Legacy/generic keys
        'opportunities',
        'aiProcessedOpportunities',
        
        // Cache and processing keys
        'aiCache',
        'processedOpportunities',
        'cachedOpportunities',
        'opportunitiesCache',
        
        // Related data that should be cleared
        'lastScrapeTime',
        'scrapeHistory',
        'extensionStats',
        'processingQueue',
        'failedOpportunities',
        'extensionData',
        'scrapedData'
      ];
      
      console.log('🧹 Clearing all opportunity data:', keysToRemove);
      
      // First clear the unified cache to prevent it from reloading data
      if (window.unifiedCache && typeof window.unifiedCache.clearAll === 'function') {
        window.unifiedCache.clearAll();
        console.log('Pre-cleared unified cache system');
      } else {
        console.log('Unified cache not available, proceeding with direct storage clear');
      }
      
      // Also do a comprehensive storage scan to remove any opportunity-related data
      chrome.storage.local.get(null, function(allData) {
        const opportunityKeys = Object.keys(allData).filter(key => 
          key.toLowerCase().includes('opportunit') || 
          key.toLowerCase().includes('scrape') ||
          key.toLowerCase().includes('cache') ||
          key.toLowerCase().includes('processed')
        );
        
        console.log('Found additional opportunity-related keys:', opportunityKeys);
        const allKeysToRemove = [...new Set([...keysToRemove, ...opportunityKeys])];
        
        chrome.storage.local.remove(allKeysToRemove, function() {
          // Check for any error
          if (chrome.runtime.lastError) {
            console.error('Error clearing opportunities:', chrome.runtime.lastError);
          
          // Show error notification
          const notification = document.createElement('div');
          notification.className = 'ai-notification error';
          notification.textContent = `Error: ${chrome.runtime.lastError.message || 'Failed to clear opportunities'}`;
          document.body.appendChild(notification);
          
          setTimeout(() => {
            notification.classList.add('show');
            setTimeout(() => {
              notification.classList.remove('show');
              setTimeout(() => {
                if (document.body.contains(notification)) {
                  document.body.removeChild(notification);
                }
              }, 500);
            }, 3000);
          }, 100);
          
          return;
        }
        
        // Also explicitly disable AI to prevent auto-processing
        if (aiService && typeof aiService.setEnabled === 'function') {
          aiService.setEnabled(false);
          console.log('AI service disabled to prevent auto-processing');
        }
        
        // Reset the opportunity arrays and ensure they're brand new arrays
        allOpportunities = [];
        filteredOpportunities = [];
        
        // Clear unified cache system if available
        if (window.unifiedCache && typeof window.unifiedCache.clearAll === 'function') {
          window.unifiedCache.clearAll();
          console.log('Cleared unified cache system');
        }
        
        // Clear individual caches if they exist
        if (window.storageCache && typeof window.storageCache.clear === 'function') {
          window.storageCache.clear();
          console.log('Cleared storage cache');
        }
        
        // Cancel any in-progress AI operations
        if (window.aiService && typeof window.aiService.cancelOperations === 'function') {
          window.aiService.cancelOperations();
          console.log('Cancelled any in-progress AI operations');
        }
        
        // Force reload the page to clear any in-memory data completely
        const shouldReload = confirm('Data cleared successfully. Would you like to reload the page to ensure all in-memory data is cleared?');
        if (shouldReload) {
          location.reload();
          return; // Stop execution as page will reload
        }
        
        // Update UI if not reloading
        opportunitiesContainer.innerHTML = `
          <div class="no-opportunities">
            <h3>No opportunities found.</h3>
            <p>Please visit one of these platforms to scrape opportunities:</p>
            <div class="platform-links">
              <a href="https://www.sourcebottle.com/categories.asp" target="_blank" style="background-color: #4b6cb7; color: white; padding: 8px 15px; border-radius: 4px; margin: 5px; display: inline-block; text-decoration: none;">SourceBottle</a>
              <a href="https://featured.com/experts/questions" target="_blank" style="background-color: #ff9800; color: white; padding: 8px 15px; border-radius: 4px; margin: 5px; display: inline-block; text-decoration: none;">Featured.com</a>
              <a href="https://app.qwoted.com/source_requests" target="_blank" style="background-color: #009688; color: white; padding: 8px 15px; border-radius: 4px; margin: 5px; display: inline-block; text-decoration: none;">Qwoted</a>
            </div>
          </div>`;
          
        // Reset pagination
        paginationContainer.innerHTML = '';
        
        // Show success notification
        const notification = document.createElement('div');
        notification.className = 'ai-notification success';
        notification.textContent = 'All opportunities have been cleared successfully.';
        document.body.appendChild(notification);
        
        setTimeout(() => {
          notification.classList.add('show');
          setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
              if (document.body.contains(notification)) {
                document.body.removeChild(notification);
              }
            }, 500);
          }, 3000);
        }, 100);
        
        // Update the count displays to zero
        const totalCountEl = document.getElementById('total-count');
        const analyzedCountEl = document.getElementById('analyzed-count');
        const highPriorityCountEl = document.getElementById('high-priority-count');
        const highRelevanceCountEl = document.getElementById('high-relevance-count');
        
        if (totalCountEl) totalCountEl.textContent = '0';
        if (analyzedCountEl) analyzedCountEl.textContent = '0';
        if (highPriorityCountEl) highPriorityCountEl.textContent = '0';
        if (highRelevanceCountEl) highRelevanceCountEl.textContent = '0';
        
        // Verify clearing worked by checking storage again
        chrome.storage.local.get(keysToRemove, function(remainingData) {
          const remainingKeys = Object.keys(remainingData).filter(key => 
            remainingData[key] && (Array.isArray(remainingData[key]) ? remainingData[key].length > 0 : true)
          );
          
          if (remainingKeys.length > 0) {
            console.warn('⚠️ Some data may still remain after clearing:', remainingKeys, remainingData);
          } else {
            console.log('✅ All opportunity data successfully cleared and verified');
          }
          
            // Force a complete reload of opportunities from storage to ensure UI is updated
            setTimeout(() => {
              console.log('🔄 Reloading opportunities after clear to verify UI update');
              loadOpportunities();
            }, 100);
          });
        });
      });
    }
  }
  
  // Function to refresh data from storage
  function refreshData() {
    // Show a loading notification
    const notification = document.createElement('div');
    notification.className = 'ai-notification info';
    notification.textContent = 'Refreshing data from storage...';
    document.body.appendChild(notification);
    
    // Show notification
    setTimeout(() => {
      notification.classList.add('show');
    }, 100);
    
    // Update button to show loading
    const refreshIcon = document.getElementById('refresh-icon');
    const refreshText = document.getElementById('refresh-text');
    
    if (refreshIcon) refreshIcon.textContent = '⏳';
    if (refreshText) refreshText.textContent = 'Loading...';
    
    // Reload opportunities from storage
    chrome.storage.local.get(null, function(result) {
      // Reset arrays to avoid duplicates
      allOpportunities = [];
      
      // Check for sourceBottleOpportunities
      if (result.sourceBottleOpportunities && Array.isArray(result.sourceBottleOpportunities)) {
        const sourceBottleOps = result.sourceBottleOpportunities.map(op => ({
          ...op,
          source: op.source || 'SourceBottle'
        }));
        allOpportunities = allOpportunities.concat(sourceBottleOps);
        console.log(`Refreshed: Found ${sourceBottleOps.length} SourceBottle opportunities`);
      }
      
      // Check for qwotedOpportunities
      if (result.qwotedOpportunities && Array.isArray(result.qwotedOpportunities)) {
        const qwotedOps = result.qwotedOpportunities.map(op => ({
          ...op,
          source: op.source || 'Qwoted',
          category: op.category || 'General' // Ensure category is set
        }));
        allOpportunities = allOpportunities.concat(qwotedOps);
        console.log(`Refreshed: Found ${qwotedOps.length} Qwoted opportunities`);
      }
      
      // Check for featuredOpportunities
      if (result.featuredOpportunities && Array.isArray(result.featuredOpportunities)) {
        const featuredOps = result.featuredOpportunities.map(op => ({
          ...op,
          source: op.source || 'Featured'
        }));
        allOpportunities = allOpportunities.concat(featuredOps);
        console.log(`Refreshed: Found ${featuredOps.length} Featured opportunities`);
      }
      
      // Check if we have the generic 'opportunities' key (for backwards compatibility)
      // But only use it if we don't have any platform-specific opportunities
      if (result.opportunities && Array.isArray(result.opportunities)) {
        if (allOpportunities.length === 0) {
          // Only use the generic key if we didn't find any platform-specific opportunities
          allOpportunities = result.opportunities;
          console.log(`Refreshed: Using ${result.opportunities.length} opportunities from generic storage key`);
        } else {
          // We already have platform-specific data, so log but don't use to avoid duplicates
          console.log(`Refreshed: Found ${result.opportunities.length} opportunities in generic key (not using to avoid duplicates)`);
        }
      }
      
      console.log(`Refreshed: Total loaded ${allOpportunities.length} opportunities`);
      
      // Reset the view and filters
      initializeView();
      
      // Update button to show success
      if (refreshIcon) refreshIcon.textContent = '✅';
      if (refreshText) refreshText.textContent = 'Data Refreshed';
      
      // Update notification
      notification.className = 'ai-notification success';
      notification.textContent = `Successfully refreshed ${allOpportunities.length} opportunities`;
      
      // Auto-hide notification and reset button
      setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
          if (document.body.contains(notification)) {
            document.body.removeChild(notification);
          }
          
          // Reset button after notification is gone
          setTimeout(() => {
            if (refreshIcon) refreshIcon.textContent = '🔄';
        }, 500);
      }, 500);
    }, 2000);
  });
}

// Global function to show AI analysis
function showAIAnalysis(opportunityId) {
  console.log('Showing AI analysis for opportunity:', opportunityId);
  
  // Find the opportunity by ID from the global allOpportunities array
  const opportunity = allOpportunities.find(opp =>
    (opp.id === opportunityId || opp.externalId === opportunityId)
  );
  
  if (!opportunity) {
    console.error('Opportunity not found with ID:', opportunityId);
    
    // Show error notification instead of alert (to avoid CSP issues)
    const notification = document.createElement('div');
    notification.className = 'ai-notification error';
    notification.textContent = 'Error: Could not find opportunity details';
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.classList.add('show');
      setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
          if (document.body.contains(notification)) {
            document.body.removeChild(notification);
          }
        }, 500);
      }, 3000);
    }, 100);
    
    return;
  }
    
    // Get modal elements
    const modal = document.getElementById('ai-analysis-modal');
    const opportunityDetails = document.getElementById('opportunity-details');
    const relevanceScore = document.getElementById('relevance-score');
    const keyThemes = document.getElementById('key-themes');
    const analysisSummary = document.getElementById('analysis-summary');
    
    // Update opportunity details
    opportunityDetails.innerHTML = `
      <h4>${opportunity.title || 'Untitled Opportunity'}</h4>
      <p><strong>Source:</strong> ${opportunity.source || 'Unknown'}</p>
      <p><strong>Category:</strong> ${opportunity.category || 'General'}</p>
      <p><strong>Deadline:</strong> ${opportunity.deadline || 'Not specified'}</p>
    `;
    
    // Update relevance score
    const score = opportunity.relevanceScore || 0;
    let scoreClass = 'score-medium';
    if (score >= 80) scoreClass = 'score-high';
    if (score < 50) scoreClass = 'score-low';
    
    relevanceScore.innerHTML = `
      <span class="${scoreClass}">${score}% Relevance</span>
      <p><strong>Priority:</strong> ${opportunity.priority || 'Medium'}</p>
    `;
    
    // Update key themes
    if (opportunity.keyThemes && opportunity.keyThemes.length > 0) {
      const themeTags = opportunity.keyThemes.map(theme =>
        `<span class="theme-tag">${theme}</span>`
      ).join('');
      keyThemes.innerHTML = themeTags;
    } else {
      keyThemes.innerHTML = '<p>No key themes identified</p>';
    }
    
    // Update analysis summary
    analysisSummary.innerHTML = `
      <p>${opportunity.aiReasoning || 'No detailed analysis available.'}</p>
      <p><em>Analyzed on: ${new Date(opportunity.aiProcessedAt || Date.now()).toLocaleString()}</em></p>
    `;
    
  // Show the modal
  modal.style.display = 'block';
}
