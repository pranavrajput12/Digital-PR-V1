/* global chrome */

  /* global chrome */
  console.log('Opportunities page loaded');
  
  // Cache DOM elements
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
  const aiPriorityFilter = document.getElementById('ai-priority-filter');
  const aiRelevanceFilter = document.getElementById('ai-relevance-filter');
  
  // Settings modal elements
  const settingsBtn = document.getElementById('settings-btn');
  const settingsModal = document.getElementById('settings-modal');
  const closeSettingsModal = document.getElementById('close-settings-modal');
  const azureOpenaiForm = document.getElementById('azure-openai-form');
  const testApiConnectionBtn = document.getElementById('test-api-connection');
  const connectionStatus = document.getElementById('connection-status');
  
  // Azure OpenAI input fields
  const azureResourceName = document.getElementById('azure-resource-name');
  const azureApiKey = document.getElementById('azure-api-key');
  const azureDeploymentId = document.getElementById('azure-deployment-id');
  const azureApiVersion = document.getElementById('azure-api-version');
  
  // Enhanced AI settings have been removed
  
  // Store all opportunities and filtered opportunities
  let allOpportunities = [];
  let filteredOpportunities = [];
  let currentPage = 1;
  const itemsPerPage = 12;
  let aiProcessing = false;
  
  // Set up the AI service and opportunity processor
  let aiService = null;
  let opportunityProcessor = null;
  let aiEnabled = false;
  let classifierTrainedState = false;
  // Initialize the AI service and opportunity processor
  function initializeAIService() {
    try {
      // Access the AI service and processor modules from window globals
      // The module scripts are loaded in the HTML file
      if (window.aiService) {
        aiService = window.aiService;
        console.log('AI service accessed successfully');
      } else {
        console.warn('AI service not available');
        aiEnabled = false;
        return;
      }
      
      if (window.opportunityProcessor) {
        opportunityProcessor = window.opportunityProcessor;
        console.log('Opportunity processor accessed successfully');
      } else {
        console.warn('Opportunity processor not available');
        aiEnabled = false;
        return;
      }
      
      // Initialize the AI service
      if (typeof aiService.initialize === 'function') {
        aiService.initialize().then(function(initialized) {
          if (initialized) {
            console.log('AI service initialized successfully');
            
            // Initialize the opportunity processor
            if (opportunityProcessor && typeof opportunityProcessor.initialize === 'function') {
              opportunityProcessor.initialize().then(function(processorInitialized) {
                console.log('Opportunity processor initialized:', processorInitialized);
                aiEnabled = initialized && processorInitialized;
                
                // AI is now fully initialized
              }).catch(function(error) {
                console.error('Error initializing opportunity processor:', error);
                aiEnabled = false;
              });
            } else {
              console.warn('Opportunity processor has no initialize method');
              aiEnabled = false;
            }
          } else {
            console.warn('AI service initialization failed');
            aiEnabled = false;
          }
        }).catch(function(error) {
          console.error('Error initializing AI service:', error);
          aiEnabled = false;
        });
      } else {
        console.warn('AI service initialize method not available');
        aiEnabled = false;
      }
    } catch (error) {
      console.error('Error in AI service initialization:', error);
      aiEnabled = false;
    }
  }
  
  // Try to initialize after a short delay to ensure scripts are loaded
  setTimeout(initializeAIService, 500);
  
  // Initialize filters state
  const filters = {
    category: 'all',
    deadline: 'all',
    relevance: 'all',
    source: 'all',
    aiPriority: 'all',
    search: ''
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
  
  /**
   * Debounce function to limit how often a function is called
   * @param {Function} func - The function to debounce
   * @param {number} wait - The time to wait in milliseconds
   * @returns {Function} - The debounced function
   */
  function debounce(func, wait) {
    let timeout;
    return function(...args) {
      const context = this;
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(context, args), wait);
    };
  }
  
  /**
   * Enable dark mode by adding dark mode class to body and updating UI
   */
  function enableDarkMode() {
    document.body.classList.add('dark-mode');
    // Save preference to storage
    chrome.storage.local.get(['settings'], function(result) {
      const settings = result.settings || {};
      if (!settings.ui) settings.ui = {};
      settings.ui.darkMode = true;
      chrome.storage.local.set({ settings: settings });
    });
  }

  /**
   * Disable dark mode by removing dark mode class from body and updating UI
   */
  function disableDarkMode() {
    document.body.classList.remove('dark-mode');
    // Save preference to storage
    chrome.storage.local.get(['settings'], function(result) {
      const settings = result.settings || {};
      if (!settings.ui) settings.ui = {};
      settings.ui.darkMode = false;
      chrome.storage.local.set({ settings: settings });
    });
  }

  /**
   * Toggle dark mode based on checkbox state
   * @param {Event} e - Change event
   */
  function toggleDarkMode(e) {
    if (e.target.checked) {
      enableDarkMode();
    } else {
      disableDarkMode();
    }
  }

  /**
   * Toggle filters visibility
   */
  function toggleFilters() {
    if (filtersContent) {
      filtersContent.classList.toggle('hidden');
    }
  }

  /**
   * Handle apply filters button click
   */
  function applyFiltersBtnClick() {
    // Get values from filter form
    if (document.getElementById('deadline-filter')) {
      filters.deadline = document.getElementById('deadline-filter').value;
    }
    
    if (document.getElementById('relevance-filter')) {
      filters.relevance = document.getElementById('relevance-filter').value;
    }
    
    if (document.getElementById('source-filter')) {
      filters.source = document.getElementById('source-filter').value;
    }
    
    if (document.getElementById('keyword-filter')) {
      filters.keyword = document.getElementById('keyword-filter').value.trim().toLowerCase();
    }
    
    if (document.getElementById('media-outlet-filter')) {
      filters.mediaOutlet = document.getElementById('media-outlet-filter').value.trim().toLowerCase();
    }
    
    if (document.getElementById('journalist-filter')) {
      filters.journalist = document.getElementById('journalist-filter').value.trim().toLowerCase();
    }
    
    // Apply the filters
    applyFilters();
    
    // Hide filters panel after applying
    if (filtersContent) {
      filtersContent.classList.add('hidden');
    }
  }

// [Removed duplicate debounce function]

// [Removed duplicate enableDarkMode function]

// [Removed duplicate disableDarkMode function]

// [Removed duplicate toggleDarkMode function]

// [Removed duplicate toggleFilters function]

/**
 * Handle apply filters button click
 */
function applyFiltersBtnClick() {
  // Get values from filter form
  if (document.getElementById('deadline-filter')) {
    filters.deadline = document.getElementById('deadline-filter').value;
  }
  
  if (document.getElementById('relevance-filter')) {
    filters.relevance = document.getElementById('relevance-filter').value;
  }
  
  if (document.getElementById('source-filter')) {
    filters.source = document.getElementById('source-filter').value;
  }
  
  if (document.getElementById('keyword-filter')) {
    filters.keyword = document.getElementById('keyword-filter').value.trim().toLowerCase();
  }
  
  if (document.getElementById('media-outlet-filter')) {
    filters.mediaOutlet = document.getElementById('media-outlet-filter').value.trim().toLowerCase();
  }
  
  if (document.getElementById('journalist-filter')) {
    filters.journalist = document.getElementById('journalist-filter').value.trim().toLowerCase();
  }
  
  // Apply the filters
  applyFilters();
  
  // Hide filters panel after applying
  if (filtersContent) {
    filtersContent.classList.add('hidden');
  }

  // Initialize AI service first so it's ready when we load opportunities
  async function initializeAndLoad() {
  // Initialize AI service first so it's ready when we load opportunities
  if (typeof initializeAIService === 'function') {
    await initializeAIService();
    console.log('AI service initialized');
  }
  
  // Load the opportunities and render them - always run AI analysis automatically
  await loadOpportunities(true);
  
  // Set up click handlers for filter buttons
  if (applyFiltersBtn) {
    applyFiltersBtn.addEventListener('click', applyFilters);
  }
  
  if (resetFiltersBtn) {
    resetFiltersBtn.addEventListener('click', resetFilters);
  }
  
  if (searchInput) searchInput.addEventListener('input', debounce(handleSearch, 300));
  
  // Add event listeners for Azure OpenAI settings
  if (settingsBtn) settingsBtn.addEventListener('click', openSettingsModal);
  if (closeSettingsModal) closeSettingsModal.addEventListener('click', closeSettingsModalFn);
  if (azureOpenaiForm) azureOpenaiForm.addEventListener('submit', saveAzureSettings);
  if (testApiConnectionBtn) testApiConnectionBtn.addEventListener('click', testAzureConnection);
  
  // Cache management event listeners
  const cacheEnabled = document.getElementById('cache-enabled');
  const cacheTtl = document.getElementById('cache-ttl');
  const clearCacheBtn = document.getElementById('clear-cache');
  const cacheSize = document.getElementById('cache-size');
  
  if (cacheEnabled) {
    // Load saved setting
    chrome.storage.local.get('cacheEnabled', function(result) {
      if (result.cacheEnabled !== undefined) {
        cacheEnabled.checked = result.cacheEnabled;
      }
    });
    
    // Save setting when changed
    cacheEnabled.addEventListener('change', function() {
      chrome.storage.local.set({ 'cacheEnabled': this.checked });
      console.log('Cache enabled setting saved:', this.checked);
      
      // Update AI service cache settings if available
      if (aiService && typeof aiService.setCacheEnabled === 'function') {
        aiService.setCacheEnabled(this.checked);
      }
    });
  }
  
  if (cacheTtl) {
    // Load saved setting
    chrome.storage.local.get('cacheTtl', function(result) {
      if (result.cacheTtl) {
        cacheTtl.value = result.cacheTtl;
      }
    });
    
    // Save setting when changed
    cacheTtl.addEventListener('change', function() {
      chrome.storage.local.set({ 'cacheTtl': this.value });
      console.log('Cache TTL setting saved:', this.value);
      
      // Update AI service cache TTL if available
      if (aiService && typeof aiService.setCacheTtl === 'function') {
        aiService.setCacheTtl(parseInt(this.value, 10));
      }
    });
  }
  
  if (clearCacheBtn) {
    clearCacheBtn.addEventListener('click', function() {
      if (aiService && typeof aiService.clearCache === 'function') {
        aiService.clearCache().then(() => {
          showNotification('AI cache cleared successfully', 'success');
          updateCacheSize();
        }).catch(error => {
          showNotification('Error clearing cache: ' + error.message, 'error');
        });
      } else {
        showNotification('Cache clearing not available', 'warning');
      }
    });
  }
  
  // Function to update the cache size display
  function updateCacheSize() {
    if (!cacheSize) return;
    
    if (aiService && typeof aiService.getCacheSize === 'function') {
      aiService.getCacheSize().then(size => {
        cacheSize.textContent = `Current cache size: ${size.toFixed(2)} MB`;
      }).catch(() => {
        cacheSize.textContent = 'Current cache size: Unknown';
      });
    } else {
      cacheSize.textContent = 'Current cache size: Not available';
    }
  }
  
  // Update cache size on load
  updateCacheSize();
  
  // Enhanced AI model settings have been removed
  
  // Add event listeners for classifier training
  const trainClassifierBtn = document.getElementById('train-classifier');
  const resetClassifierBtn = document.getElementById('reset-classifier');
  if (trainClassifierBtn) trainClassifierBtn.addEventListener('click', trainClassifier);
  if (resetClassifierBtn) resetClassifierBtn.addEventListener('click', resetClassifier);
  
  // Add event listener for the AI modal close button
  const closeAiModalBtn = document.getElementById('close-ai-modal');
  if (closeAiModalBtn) {
    closeAiModalBtn.addEventListener('click', function() {
      const aiModal = document.getElementById('ai-modal');
      if (aiModal) aiModal.classList.add('hidden');
    });
  }
  
  // Add AI filter event listeners
  if (aiPriorityFilter) aiPriorityFilter.addEventListener('change', function() {
    filters.priority = this.value;
    applyFilters();
  });
  
  if (aiRelevanceFilter) aiRelevanceFilter.addEventListener('change', function() {
    filters.relevance = this.value;
    applyFilters();
  });
  
  // Always run AI analysis automatically when opportunities are loaded
  const urlParams = new URLSearchParams(window.location.search);
  // Force autoAnalyze to true regardless of URL parameter
  const autoAnalyze = true;
  
  // Filter input event listeners - add safety checks
  const addSafeEventListener = (id, event, handler) => {
    const element = document.getElementById(id);
    if (element) element.addEventListener(event, handler);
  };
  
  addSafeEventListener('deadline-filter', 'change', updateFilterValue);
  addSafeEventListener('relevance-filter', 'change', updateFilterValue);
  addSafeEventListener('source-filter', 'change', updateFilterValue);
  addSafeEventListener('keyword-filter', 'input', updateFilterValue);
  addSafeEventListener('media-outlet-filter', 'input', updateFilterValue);
  addSafeEventListener('journalist-filter', 'input', updateFilterValue);
  
  // Show loading state initially
  document.getElementById('loading-state').classList.remove('hidden');
  
  // Load opportunities right away - Always trigger AI analysis to ensure data is ready
  loadOpportunities(true);
  
  function loadOpportunities(triggerAiAnalysis = false) {
    // Show loading state if it exists
    const loadingState = document.getElementById('loading-state');
    if (loadingState) loadingState.classList.remove('hidden');
    
    chrome.storage.local.get(null, function(result) {
      // Hide loading state if it exists
      if (loadingState) loadingState.classList.add('hidden');
      
      // Try to get opportunities from multiple possible storage keys
      allOpportunities = [];
      
      // Check for QubitSource opportunities (main source)
      if (result.opportunities && Array.isArray(result.opportunities)) {
        allOpportunities = result.opportunities;
        const genericOps = result.opportunities.map(op => ({
          ...op,
          id: op.id || `gen-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          ai_analysis: op.ai_analysis || op.aiAnalysis
        }));
        allOpportunities = allOpportunities.concat(genericOps);
        console.log(`Found ${result.opportunities.length} generic opportunities`);
      }
      
      console.log(`Total loaded: ${allOpportunities.length} opportunities`);
      
      if (allOpportunities.length === 0) {
        // Show empty state if it exists
        const emptyState = document.getElementById('empty-state');
        if (emptyState) emptyState.classList.remove('hidden');
        
        opportunitiesContainer.innerHTML = '<div class="no-opportunities">No opportunities found. Please select a category to scrape first.</div>';
        return;
      }
      
      // Hide empty state if it exists
      const emptyState = document.getElementById('empty-state');
      if (emptyState) emptyState.classList.add('hidden');
      
      // First always initialize the view to show opportunities
      // This is what was missing compared to the backup version
      initializeView();
      
      // Always trigger AI analysis in the background
      if (aiService && typeof aiService.initialize === 'function') {
        // Run AI analysis automatically on page load
        console.log('Automatically triggering AI analysis on page load');
        triggerAIAnalysis();
      }
      
      // Log storage keys to help debug
      console.log('All storage keys:', Object.keys(result));
    });
  }
  
  // Handle AI processing errors
  function handleAIProcessingError(opportunity, error) {
    console.error(`AI processing error for opportunity ${opportunity.id}:`, error);
    
    return {
      ...opportunity,
      ai_analysis: {
        relevance_score: 0.5,
        priority: 'medium',
        key_themes: ['AI Processing Error'],
        confidence: 0,
        reasoning: `Error occurred during AI analysis: ${error.message || 'Unknown error'}`,
        error: true,
        processed_at: new Date().toISOString()
      }
    };
  }

  function processOpportunitiesWithAI() {
    // Always ensure the view is initialized, regardless of AI availability
    initializeView();

    if (!aiService || !opportunityProcessor || !aiEnabled) {
      showNotification('AI service not available or not enabled', 'warning');
      applyFilters();
      return;
    }

    // Set processing flag
    aiProcessing = true;

    // Log start of AI processing
    console.log('Starting automatic AI analysis of opportunities');

    // Count how many opportunities need analysis
    const unanalyzedOpportunities = allOpportunities.filter(opp => !opp.ai_analysis && !opp.aiAnalysis);
    const totalToProcess = unanalyzedOpportunities.length;

    if (totalToProcess === 0) {
      showNotification('All opportunities already analyzed!', 'success');
      aiProcessing = false;
      return;
    }

    // Process in batches to avoid overloading the API
    const batchSize = 5;
    let processedCount = 0;

    // Function to finish processing
    function finishProcessing(count) {
      // Save the updated opportunities
      saveOpportunities();

      // Update the view
      applyFilters();
      updateStats();

      // Show success notification
      showNotification(`Analyzed ${count} opportunities with AI`, 'success');

      // Clear processing flag
      aiProcessing = false;
    }

    // Process batch function (synchronous wrapper around async processing)
    function processBatch(startIndex) {
      // Get a batch of opportunities that haven't been analyzed yet
      const batch = [];
      let batchIndex = 0;
      
      // Find the next batch of unanalyzed opportunities
      for (let i = startIndex; i < allOpportunities.length && batchIndex < batchSize; i++) {
        if (!allOpportunities[i].ai_analysis && !allOpportunities[i].aiAnalysis) {
          batch.push(allOpportunities[i]);
          batchIndex++;
        }
      }
      
      if (batch.length === 0) {
        // All done, wrap up
        finishProcessing(processedCount);
        return;
      }
      
      // Process this batch
      opportunityProcessor.processOpportunitiesWithAI(batch)
        .then(results => {
          processedCount += results.length;
          
          // Update the opportunities with the AI analysis results
          results.forEach(result => {
            // Find the matching opportunity in the allOpportunities array
            const opportunityIndex = allOpportunities.findIndex(opp => opp.id === result.id);
            if (opportunityIndex !== -1) {
              // Update the opportunity with AI analysis
              // Support both property naming styles
              allOpportunities[opportunityIndex].ai_analysis = result.ai_analysis || result.aiAnalysis;
              allOpportunities[opportunityIndex].aiAnalysis = result.ai_analysis || result.aiAnalysis;
              
              // No need to increment processedCount here as it's already handled by the batch size
            }
          });
          
          // Log processing progress
          console.log(`Processing progress: ${processedCount}/${totalToProcess}`);
          
        // Process the next batch after a small delay
        setTimeout(() => {
          processBatch(startIndex + batchSize);
        }, 100);
      })
      .catch(error => {
        console.error('Error processing batch:', error);
        
        // Continue with next batch despite error
        setTimeout(() => {
          processBatch(startIndex + batchSize);
        }, 100);
      });
  }
  
  // Start processing the first batch
  processBatch(0);
}
  
  // Save opportunities to storage
  async function saveOpportunities() {
    try {
      await chrome.storage.local.set({ opportunities: allOpportunities });
    } catch (error) {
      console.error('Error saving opportunities:', error);
    }
  }
  
  /**
   * Helper function to show notifications
   * @param {string} message - The message to display
   * @param {string} type - The type of notification (info, success, warning, error)
   */
  function showNotification(message, type = 'info') {
    // Create notification element if it doesn't exist
    let notification = document.getElementById('notification');
    if (!notification) {
      notification = document.createElement('div');
      notification.id = 'notification';
      notification.className = 'notification hidden';
      document.body.appendChild(notification);
    }
    
    // Set notification type and message
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    // Show notification
    notification.classList.remove('hidden');
    
    // Hide notification after 3 seconds
    setTimeout(() => {
      notification.classList.add('hidden');
    }, 3000);
  }
  
    /**
   * AI button state update functionality has been removed
   * as part of the UI simplification to use automatic AI analysis
   */
  
  /**
   * Enhanced AI functionality has been removed
   */
  
  // Classifier training functions
  function updateClassifierUI() {
    // Only run if we have the aiService with a classifier
    if (!aiService || !aiService.classifier) return;
    
    // Get the training counts
    const trainClassifierBtn = document.getElementById('train-classifier');
    const relevantCount = document.getElementById('relevant-count');
    const irrelevantCount = document.getElementById('irrelevant-count');
    const classifierStatus = document.getElementById('classifier-status');
    
    // Get training data counts
    const trainingData = aiService.classifier.trainingData || { relevant: [], irrelevant: [] };
    const relevantExamples = trainingData.relevant ? trainingData.relevant.length : 0;
    const irrelevantExamples = trainingData.irrelevant ? trainingData.irrelevant.length : 0;
    
    // Update the UI
    if (relevantCount) relevantCount.textContent = relevantExamples;
    if (irrelevantCount) irrelevantCount.textContent = irrelevantExamples;
    
    // Enable/disable the train button based on training data
    if (trainClassifierBtn) {
      const hasEnoughExamples = relevantExamples >= 3 && irrelevantExamples >= 3;
      trainClassifierBtn.disabled = !hasEnoughExamples;
      
      if (hasEnoughExamples) {
        trainClassifierBtn.classList.remove('btn-secondary');
        trainClassifierBtn.classList.add('btn-primary');
      } else {
        trainClassifierBtn.classList.remove('btn-primary');
        trainClassifierBtn.classList.add('btn-secondary');
      }
    }
    
    // Update trained state
    classifierTrainedState = aiService.classifier.isTrained();
  }
  
  // Train the classifier
  async function trainClassifier() {
    if (!aiService) {
      console.error('AI service not available');
      return;
    }
    
    const classifierStatus = document.getElementById('classifier-status');
    if (classifierStatus) {
      classifierStatus.innerHTML = '<div class="alert alert-info">Training classifier...</div>';
      classifierStatus.classList.remove('hidden');
    }
    
    try {
      const result = await aiService.trainClassifier(50);
      
      if (result.success) {
        if (classifierStatus) {
          classifierStatus.innerHTML = '<div class="alert alert-success">Classifier trained successfully! The system will now better recognize relevant opportunities.</div>';
        }
        classifierTrainedState = true;
      } else {
        if (classifierStatus) {
          classifierStatus.innerHTML = `<div class="alert alert-danger">Training failed: ${result.error || 'Unknown error'}</div>`;
        }
      }
    } catch (error) {
      console.error('Error training classifier:', error);
      if (classifierStatus) {
        classifierStatus.innerHTML = `<div class="alert alert-danger">Error training classifier: ${error.message}</div>`;
      }
    }
  }
  
  // Reset the classifier
  function resetClassifier() {
    if (!aiService) {
      console.error('AI service not available');
      return;
    }
    
    const confirmReset = confirm('Are you sure you want to reset the classifier? This will delete all training data and you will need to start training from scratch.');
    if (!confirmReset) return;
    
    try {
      aiService.resetClassifier();
      
      const classifierStatus = document.getElementById('classifier-status');
      if (classifierStatus) {
        classifierStatus.innerHTML = '<div class="alert alert-warning">Classifier has been reset. All training data has been deleted.</div>';
        classifierStatus.classList.remove('hidden');
      }
      
      // Update UI
      updateClassifierUI();
      classifierTrainedState = false;
    } catch (error) {
      console.error('Error resetting classifier:', error);
    }
  }
  
  // Add an opportunity as a training example
  function addTrainingExample(opportunityId, isRelevant) {
    if (!aiService || !aiService.classifier) {
      console.error('AI service or classifier not available');
      return;
    }
    
    // Find the opportunity in our list
    const opportunity = allOpportunities.find(opp => opp.id === opportunityId);
    if (!opportunity) {
      console.error('Opportunity not found:', opportunityId);
      return;
    }
    
    // Add the example to the classifier
    aiService.addTrainingExample(opportunity, isRelevant);
    
    // Update UI counters
    updateClassifierUI();
    
    // Show feedback to the user
    const feedbackText = isRelevant ? 'relevant' : 'irrelevant';
    const cardElement = document.querySelector(`[data-opportunity-id="${opportunityId}"]`);
    if (cardElement) {
      // Find the feedback buttons container
      const feedbackContainer = cardElement.querySelector('.feedback-buttons');
      if (feedbackContainer) {
        feedbackContainer.innerHTML = `<div class="feedback-message">Added as ${feedbackText} example ✓</div>`;
      }
    }
  }
  
// Show AI analysis modal for an opportunity
function showAIAnalysisModal(opportunity) {
  console.log('Showing AI analysis for opportunity:', opportunity);
  console.log('Modal function triggered with opportunity ID:', opportunity.id || opportunity.externalId);
  
  // Get AI analysis data with fallback to aiAnalysis property if needed
  const aiData = opportunity.ai_analysis || opportunity.aiAnalysis;
  console.log('AI Analysis data structure:', aiData);
  
  // Log more detailed information about AI analysis structure to debug
  if (aiData) {
    console.log('AI Analysis keys:', Object.keys(aiData));
    if (aiData.sentiment) console.log('Sentiment data:', aiData.sentiment);
    if (aiData.key_themes) console.log('Key themes:', aiData.key_themes);
    if (aiData.priority) console.log('Priority:', aiData.priority);
    if (aiData.relevance_score) console.log('Relevance score:', aiData.relevance_score);
  } else {
    console.warn('No AI analysis data found for this opportunity');
  }
  
  // Create modal if it doesn't exist
  let modal = document.getElementById('ai-analysis-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'ai-analysis-modal';
    modal.className = 'modal hidden';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h2>AI Analysis</h2>
          <button id="close-ai-analysis" class="close-button">&times;</button>
        </div>
        <div class="modal-body">
          <div id="ai-analysis-content"></div>
          <!-- Enhanced AI button removed -->
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    // Add event listener to close button
    document.getElementById('close-ai-analysis').addEventListener('click', function() {
      console.log('Modal close button clicked');
      modal.classList.add('hidden');
      document.body.classList.remove('modal-open');
      console.log('Modal hidden, classes:', modal.className);
    });
  }
  
  // Get the content element once
  const contentElement = document.getElementById('ai-analysis-content');
  if (!contentElement) {
    console.error('AI analysis content element not found');
    return;
  }
  
  // Get the analysis data with fallback to aiAnalysis property
  const analysis = opportunity.ai_analysis || opportunity.aiAnalysis;
  
  // First check if analysis exists at all
  if (!analysis) {
    contentElement.innerHTML = '<p>No AI analysis available for this opportunity.</p><p>Click the "Analyze with AI" button at the top of the page to analyze all opportunities.</p>';
    modal.classList.remove('hidden');
    document.body.classList.add('modal-open');
    console.log('Displaying modal without analysis data');
    return;
  }
  
  // Analysis exists, but make sure it contains useful data
  if (!analysis.sentiment && !analysis.priority && 
      !analysis.relevance_score && !analysis.relevanceScore) {
    console.warn('AI analysis object exists but contains no useful data');
    contentElement.innerHTML = '<p>AI analysis data appears to be incomplete. Try running the analysis again.</p>';
    modal.classList.remove('hidden');
    document.body.classList.add('modal-open');
    return;
  }
  
  console.log('Analysis data available:', analysis);
  console.log('Analysis keys present:', Object.keys(analysis));
  
  // Debug key properties
  if (analysis.priority) console.log('Priority:', analysis.priority);
  if (analysis.relevance_score || analysis.relevanceScore) console.log('Relevance score:', analysis.relevance_score || analysis.relevanceScore);
  if (analysis.sentiment) console.log('Sentiment data:', analysis.sentiment);
  
  // Local function to process sentiment data
  function getSentimentInfo(sentimentData) {
    if (!sentimentData) return null;
    
    const label = sentimentData.sentiment_label?.toLowerCase() || 
                  sentimentData.label?.toLowerCase() || 'neutral';
    const score = typeof sentimentData.sentiment_score === 'number' ? sentimentData.sentiment_score : 
                 (typeof sentimentData.score === 'number' ? sentimentData.score : 0.5);
    
    // Map the sentiment label
    let normalizedLabel = 'neutral';
    let color = '#6c757d'; // Default gray for neutral
    let emoji = '😐';
    
    // Normalize the score to 0-100 range
    const normalizedScore = Math.round(Math.min(Math.max(score * 100, 0), 100));
    
    // Determine label based on score or explicit label
    if (label.includes('positive') || normalizedScore >= 70) {
      normalizedLabel = 'positive';
      color = '#28a745';
      emoji = label.includes('very') ? '😄' : '😊';
    } else if (label.includes('negative') || normalizedScore <= 30) {
      normalizedLabel = 'negative';
      color = '#dc3545';
      emoji = label.includes('very') ? '😠' : '😟';
    } else if (label.includes('mixed')) {
      normalizedLabel = 'mixed';
      color = '#fd7e14';
      emoji = '😕';
    }
    
    return {
      label: normalizedLabel,
      score: normalizedScore,
      color: color,
      emoji: emoji
    };
  }
  
  // Prepare sentiment data if available
  const sentiment = analysis.sentiment;
  let sentimentHtml = '';
  let sentimentLabel = 'neutral';
  let sentimentEmoji = '😐';
  let sentimentScore = 50;
  
  if (sentiment) {
    // Get sentiment info using local implementation
    const sentimentInfo = getSentimentInfo(sentiment);
    if (sentimentInfo) {
      sentimentLabel = sentimentInfo.label;
      sentimentEmoji = sentimentInfo.emoji;
      sentimentScore = sentimentInfo.score;
    }
    
    // Create detailed sentiment HTML section
    sentimentHtml = `
      <div class="ai-section">
        <h4>Sentiment Analysis</h4>
        <div class="sentiment-display ${sentimentLabel}">
          <div class="sentiment-score">
            <div class="sentiment-bar">
              <div class="sentiment-fill" style="width: ${sentimentScore}%; background-color: ${sentimentInfo?.color || '#6c757d'}"></div>
              <span class="sentiment-label">${sentimentEmoji} ${sentimentLabel.toUpperCase()} (${sentimentScore}%)</span>
            </div>
          </div>
          
          ${sentiment.confidence ? `
            <div class="mt-2 text-sm">
              <strong>Confidence:</strong> ${Math.round(sentiment.confidence * 100)}%
            </div>
          ` : ''}
          
          ${sentiment.key_emotional_indicators && sentiment.key_emotional_indicators.length > 0 ? `
            <div class="sentiment-indicators">
              <h5>Key Emotional Indicators:</h5>
              <div class="indicator-tags">
                ${sentiment.key_emotional_indicators.map(indicator => 
                  `<span class="indicator-tag">${indicator}</span>`
                ).join('')}
              </div>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }

  // Format the relevance score as a percentage
  const relevanceScore = Math.round(((analysis.relevance_score || analysis.relevanceScore || 0) * 100));
  
  // Create HTML content for the modal
  let htmlContent = `
    <div class="ai-analysis-header">
      <h3>${opportunity.title || 'Opportunity'}</h3>
      <div class="ai-meta">
        <span class="ai-priority ${analysis.priority || 'medium'}">
          ${analysis.priority ? analysis.priority.toUpperCase() : 'MEDIUM'} PRIORITY
        </span>
        <span class="ai-relevance">
          ${relevanceScore}% RELEVANCE
        </span>
        ${sentiment ? `
          <span class="ai-sentiment ${sentimentLabel}">
            ${sentimentEmoji} ${sentimentLabel.toUpperCase()}
          </span>
        ` : ''}
      </div>
    </div>
    
    <div class="ai-analysis-body">
      ${sentimentHtml}
      
      <div class="ai-section">
        <h4>Analysis</h4>
        <p>${analysis.reasoning || 'No detailed analysis available.'}</p>
      </div>
  `;
  
  // Add key themes section if available
  if (analysis.key_themes && analysis.key_themes.length > 0) {
    const themesList = analysis.key_themes.map(theme => 
      `<span class="ai-theme-tag">${theme}</span>`
    ).join('');
    
    htmlContent += `
      <div class="ai-section">
        <h4>Key Themes</h4>
        <div class="ai-themes">
          ${themesList}
        </div>
      </div>
    `;
  }
  
  // Add action items if available
  if (analysis.action_items && analysis.action_items.length > 0) {
    const actionItemsList = analysis.action_items.map(item => 
      `<li>${item}</li>`
    ).join('');
    
    htmlContent += `
      <div class="ai-section">
        <h4>Recommended Actions</h4>
        <ul class="ai-action-items">
          ${actionItemsList}
        </ul>
      </div>
    `;
  }
  
  // Close the div container
  htmlContent += `
    </div>
  `;
  
  // Add opportunity details section with all available fields
  htmlContent += `
      <div class="ai-section">
        <h4>Opportunity Details</h4>
        <ul class="ai-details">
          <li><strong>Title:</strong> ${opportunity.title || 'N/A'}</li>
          <li><strong>Company/Publication:</strong> ${opportunity.company || opportunity.publication || 'N/A'}</li>
          <li><strong>Category:</strong> ${opportunity.category || 'N/A'}</li>
          <li><strong>Date Posted:</strong> ${opportunity.datePosted || opportunity.date_posted || 'N/A'}</li>
          <li><strong>Deadline:</strong> ${opportunity.deadline || 'N/A'}</li>
          <li><strong>Journalist Type:</strong> ${opportunity.journalistType || 'N/A'}</li>
        </ul>
      </div>
  `;
  
  // Set the modal content (only once, after all HTML is built)
  contentElement.innerHTML = htmlContent;
  
  // Make the modal visible
  modal.classList.remove('hidden');
  document.body.classList.add('modal-open');
  console.log('Displaying modal:', modal);
  console.log('Modal classes after showing:', modal.className);
  console.log('Body classes after showing modal:', document.body.className);
  
  // Add event listener to close button
  const closeButton = modal.querySelector('.close-button');
  if (closeButton) {
    // Define modal close function to ensure we can remove it later
    function handleModalClose() {
      console.log('Modal close button clicked');
      modal.classList.add('hidden');
      document.body.classList.remove('modal-open');
      console.log('Modal hidden, classes:', modal.className);
    }
    
    // Remove any existing click listeners
    closeButton.removeEventListener('click', handleModalClose);
    
    // Add fresh click listener
    console.log('Adding click handler to modal close button');
    closeButton.addEventListener('click', handleModalClose);
  } else {
    console.warn('Modal close button not found!');
  }
}
  
  // Format deadline for display
  function formatDeadline(deadline) {
    if (!deadline) return 'No deadline';
    
    try {
      // Check if we have a valid date string or timestamp
      const date = new Date(deadline);
      
      // Check if date is valid
      if (isNaN(date.getTime())) {
        // If it's not a valid date object, try to parse it as a string
        return deadline.toString();
      }
      
      // Format the date
      return date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch (e) {
      console.error('Error formatting deadline:', e);
      return 'Invalid date';
    }
  }
  
  // The formatDeadline function ends here
  

// Separate function to process opportunities with AI
function triggerAIAnalysis() {
  if (aiProcessing) {
    console.log('AI analysis already in progress');
    return;
  }
  
  aiProcessing = true;
  
  try {
    // Check if AI service is properly initialized
    aiService.initialize()
      .then(initialized => {
        if (initialized) {
          // Process opportunities
          processOpportunitiesWithAI();
          
          // Success state
          console.log('AI analysis completed successfully');
        } else {
          // Initialization failed
          showNotification('AI service initialization failed', 'warning');
          
          // Analysis error - log error
          console.log('AI analysis encountered an error');
        }
        
        aiProcessing = false;
      })
      .catch(error => {
        console.error('Error during AI initialization:', error);
        showNotification('Error during AI initialization', 'error');
        
        // Analysis error - log error
        console.log('AI analysis encountered an error');
        
        aiProcessing = false;
      });
  } catch (error) {
    console.error('Error during AI processing:', error);
    showNotification('Error during AI processing', 'error');
    
    // Analysis error - log error
    console.log('AI analysis encountered an error');
    
    aiProcessing = false;
  }
}
  
// Create feedback buttons for classifier training
  function createFeedbackButtonsHTML(opportunityId) {
    if (!aiService || !aiService.classifier) {
      return ''; // Don't create buttons if classifier isn't available
    }
    
    return `
      <div class="feedback-buttons mt-3 border-t pt-2">
        <p class="text-sm mb-2"><i class="fas fa-robot mr-1"></i> Help train the AI:</p>
        <div class="flex space-x-2">
          <button 
            class="feedback-btn feedback-relevant btn-sm btn-outline-success" 
            data-opportunity-id="${opportunityId}" 
            data-relevant="true"
          >
            <i class="fas fa-check mr-1"></i> Relevant
          </button>
          <button 
            class="feedback-btn feedback-irrelevant btn-sm btn-outline-danger" 
            data-opportunity-id="${opportunityId}" 
            data-relevant="false"
          >
            <i class="fas fa-times mr-1"></i> Not Relevant
          </button>
        </div>
      </div>
    `;
  }
  
  // Setup feedback button event listeners for classifier training
  function setupFeedbackListeners() {
    // Use event delegation since buttons are added dynamically
    document.addEventListener('click', async function(event) {
      const feedbackBtn = event.target.closest('.feedback-btn');
      if (!feedbackBtn) return; // Not a feedback button click
      
      const opportunityId = feedbackBtn.getAttribute('data-opportunity-id');
      const isRelevant = feedbackBtn.getAttribute('data-relevant') === 'true';
      
      if (!opportunityId) {
        console.error('Missing opportunity ID for feedback button');
        return;
      }
      
      // Find the opportunity object
      const opportunity = filteredOpportunities.find(opp => 
        opp.id === opportunityId || `opp-${Date.now()}` === opportunityId
      );
      
      if (!opportunity) {
        console.error('Could not find opportunity with ID:', opportunityId);
        return;
      }
      
      try {
        // Add a temporary 'processing' class
        feedbackBtn.classList.add('processing');
        feedbackBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${isRelevant ? 'Relevant' : 'Not Relevant'}`;
        
        // Disable all feedback buttons for this opportunity
        const card = feedbackBtn.closest('[data-opportunity-id]');
        const allButtons = card ? card.querySelectorAll('.feedback-btn') : [];
        allButtons.forEach(btn => btn.setAttribute('disabled', 'disabled'));
        
        // Call the training method
        await aiService.addTrainingExample(opportunity, isRelevant);
        
        // Update button to show success
        feedbackBtn.classList.remove('processing');
        feedbackBtn.classList.add('selected');
        feedbackBtn.innerHTML = `<i class="fas fa-check"></i> ${isRelevant ? 'Marked Relevant' : 'Marked Irrelevant'}`;
        
        // Show a toast notification
        if (typeof showToast === 'function') {
          showToast('Feedback recorded! The AI will learn from your input.', 'success');
        } else {
          console.log('Feedback recorded for classifier training');
        }
      } catch (error) {
        console.error('Error adding training example:', error);
        // Reset the button
        feedbackBtn.classList.remove('processing');
        allButtons.forEach(btn => btn.removeAttribute('disabled'));
        
        if (typeof showToast === 'function') {
          showToast('Error recording feedback. Please try again.', 'error');
        }
      }
    });
  }
  
  function initializeView() {
    // Create category filters
    createCategoryFilters();
    
    // Setup feedback listeners for classifier training
    setupFeedbackListeners();
    
    // Apply initial filters and render
    applyFilters();
    
    // Always update statistics (will show zeros if AI is not enabled)
    updateStats();
    
    // Update the analyze button text based on AI status
    // AI state updated
    console.log('AI enabled state updated:', aiEnabled);
  }
  
  // Update AI statistics display
  function updateStats() {
    // Get the new stats elements
    const totalCountEl = document.getElementById('total-count');
    const analyzedCountEl = document.getElementById('analyzed-count');
    const highPriorityCountEl = document.getElementById('high-priority-count');
    const highRelevanceCountEl = document.getElementById('high-relevance-count');
    
    // Continue even if some elements are missing
    if (!totalCountEl && !analyzedCountEl && !highPriorityCountEl && !highRelevanceCountEl) {
      console.warn('Statistics elements not found in the DOM');
      return;
    }
    
    // Total opportunities
    const total = allOpportunities.length;
    
    // Count opportunities with AI analysis (check both possible property names)
    const analyzed = allOpportunities.filter(opp => {
      return opp.ai_analysis || opp.aiAnalysis;
    }).length;
    
    // Count high relevance opportunities (relevance score > 0.7)
    const highRelevance = allOpportunities.filter(opp => {
      const analysis = opp.ai_analysis || opp.aiAnalysis;
      if (!analysis) return false;
      
      const score = analysis.relevance_score || analysis.relevanceScore || 0;
      return score >= 0.7;
    }).length;
    
    // Count high priority opportunities (support both naming styles)
    const highPriority = allOpportunities.filter(opp => {
      const analysis = opp.ai_analysis || opp.aiAnalysis;
      if (!analysis) return false;
      
      // Check for priority property with value 'high'
      if (analysis.priority === 'high') return true;
      
      // Alternative method: check if relevance score is very high (0.8+)
      const score = analysis.relevance_score || analysis.relevanceScore || 0;
      return score >= 0.8;
    }).length;
    
    // Update UI with null checks
    if (totalCountEl) totalCountEl.textContent = total;
    if (analyzedCountEl) analyzedCountEl.textContent = analyzed;
    if (highPriorityCountEl) highPriorityCountEl.textContent = highPriority;
    if (highRelevanceCountEl) highRelevanceCountEl.textContent = highRelevance;
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
  
  function applyFilters() {
    filteredOpportunities = allOpportunities.filter(function(opportunity) {
      // Initialize as true and apply each filter sequentially
      let passesFilters = true;
      
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
      
      // Apply AI-related filters if AI is enabled
      if (aiEnabled && opportunity.ai_analysis) {
        // Priority filter from filters.priority instead of priorityFilter variable
        if (filters.priority && filters.priority !== 'all') {
          passesFilters = passesFilters && 
            opportunity.ai_analysis.priority === filters.priority;
        }
        
        // Minimum relevance filter - using filters.relevance instead
        if (filters.relevance && filters.relevance !== 'all') {
          // Convert relevance setting to number
          let minRelevance = 0;
          if (filters.relevance === 'high') {
            minRelevance = 0.7;
          } else if (filters.relevance === 'medium') {
            minRelevance = 0.4; 
          } else if (filters.relevance === 'low') {
            minRelevance = 0.1;
          }
          
          // Get relevance score from either property naming style
          const relevanceScore = opportunity.ai_analysis.relevance_score || 
                               opportunity.ai_analysis.relevanceScore || 0;
          
          passesFilters = passesFilters && relevanceScore >= minRelevance;
        }
        
        // Theme filter (using keywords as theme filter)
        if (filters.keyword && filters.keyword !== '') {
          passesFilters = passesFilters && 
            opportunity.ai_analysis.key_themes && 
            opportunity.ai_analysis.key_themes.some(theme => 
              theme.toLowerCase().includes(filters.keyword.toLowerCase())
            );
        }
      } else if (aiEnabled && !opportunity.ai_analysis && 
                 (filters.priority !== 'all' || filters.relevance !== 'all' || 
                  (filters.keyword && filters.keyword !== ''))) {
        // If AI filters are applied but this opportunity hasn't been analyzed, filter it out
        passesFilters = false;
      }
      
      // Legacy relevance filter (for backward compatibility)
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
        passesFilters = passesFilters && opportunity.source && 
          opportunity.source.toLowerCase().includes(filters.source.toLowerCase());
      }
      
      // Keyword filter
      if (filters.keyword) {
        const hasMatchingKeyword = opportunity.keywords && Array.isArray(opportunity.keywords) && 
          opportunity.keywords.some(keyword => keyword.toLowerCase().includes(filters.keyword));
        
        // If no keywords but we have text content, search that
        const contentMatch = ((opportunity.title || '') + ' ' + (opportunity.description || '')).toLowerCase().includes(filters.keyword);
        
        // Also check AI themes if available
        const themeMatch = opportunity.ai_analysis && opportunity.ai_analysis.key_themes && 
          opportunity.ai_analysis.key_themes.some(theme => 
            theme.toLowerCase().includes(filters.keyword)
          );
        
        passesFilters = passesFilters && (hasMatchingKeyword || contentMatch || themeMatch);
      }
      
      // Media outlet filter
      if (filters.mediaOutlet && opportunity.mediaOutlet) {
        passesFilters = passesFilters && opportunity.mediaOutlet.toLowerCase().includes(filters.mediaOutlet);
      }
      
      // Journalist filter
      if (filters.journalist && opportunity.journalist) {
        passesFilters = passesFilters && opportunity.journalist.toLowerCase().includes(filters.journalist);
      }
      
      // Search filter (search across all fields)
      if (filters.search) {
        const searchText = filters.search.toLowerCase();
        const searchInFields = [
          opportunity.title || '',
          opportunity.description || '',
          opportunity.category || '',
          opportunity.mediaOutlet || '',
          opportunity.journalist || '',
          ...(opportunity.keywords || [])
        ].map(field => field.toLowerCase());
        
        passesFilters = passesFilters && searchInFields.some(field => field.includes(searchText));
      }
      
      return passesFilters;
    });
    
    // After filtering, render the opportunities and pagination
    renderOpportunities();
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
  
  function renderOpportunities() {
    // Make sure container exists
    if (!opportunitiesContainer) {
      console.error('Opportunities container not found in DOM');
      return;
    }
    
    // Show empty state if no opportunities
    if (filteredOpportunities.length === 0) {
      const emptyState = document.getElementById('empty-state');
      if (emptyState) emptyState.classList.remove('hidden');
      
      opportunitiesContainer.innerHTML = '<div class="no-opportunities">No opportunities found for the selected filters.</div>';
      return;
    }
    
    // Hide empty state if we have opportunities
    const emptyState = document.getElementById('empty-state');
    if (emptyState) emptyState.classList.add('hidden');
    
    // Clear the container
    opportunitiesContainer.innerHTML = '';
    
    // Calculate pagination
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, filteredOpportunities.length);
    const currentItems = filteredOpportunities.slice(startIndex, endIndex);
    
    // No debug logging needed anymore
    
    currentItems.forEach(opp => {
      try {
        if (!opp || typeof opp !== 'object') {
          console.error('Invalid opportunity object:', opp);
          return; // Skip this invalid opportunity
        }
        // Check if we have the opportunity utils available from our utils bridge
        if (window.opportunityUtils && typeof window.opportunityUtils.getOpportunityCardHtml === 'function') {
          // Use the bridge function to generate HTML
          const cardHTML = window.opportunityUtils.getOpportunityCardHtml(opp);
          const cardElement = document.createElement('div');
          cardElement.innerHTML = cardHTML.trim();
          
          // Find the AI analysis button before appending to DOM
          const aiAnalysisBtn = cardElement.querySelector('.view-ai-analysis');
          
          // Add feedback buttons for classifier training if classifier is available
          if (aiService && aiService.classifier) {
            // Find the card footer or create one if it doesn't exist
            let cardFooter = cardElement.querySelector('.card-footer');
            if (!cardFooter) {
              // If no footer exists, find the card body and append after it
              const cardBody = cardElement.querySelector('.card-body');
              if (cardBody) {
                cardFooter = document.createElement('div');
                cardFooter.className = 'card-footer';
                cardBody.parentNode.insertBefore(cardFooter, cardBody.nextSibling);
              }
            }
            
            // If we have a place to add feedback buttons, add them
            if (cardFooter) {
              const feedbackButtons = document.createElement('div');
              feedbackButtons.innerHTML = createFeedbackButtonsHTML(opp.id || `opp-${Date.now()}`);
              cardFooter.appendChild(feedbackButtons.firstChild);
            }
          }
          
          // Append the first child (the card) to the container
          if (cardElement.firstChild) {
            const card = cardElement.firstChild;
            // Add opportunity ID as data attribute for easier reference
            card.setAttribute('data-opportunity-id', opp.id || `opp-${Date.now()}`);
            opportunitiesContainer.appendChild(card);
            
            // Add event listener for the AI analysis button if it exists
            if (aiAnalysisBtn && opp.ai_analysis) {
              console.log('Adding click handler to AI Analysis button', aiAnalysisBtn);
              aiAnalysisBtn.addEventListener('click', (e) => {
                e.preventDefault();
                console.log('AI Analysis button clicked for opportunity:', opp);
                console.log('AI analysis data available:', opp.ai_analysis || opp.aiAnalysis);
                showAIAnalysisModal(opp);
              });
            }
          }
          
          // Skip the rest of the card creation process
          return;
        }
        
        // Fallback for backwards compatibility and critical variables for rendering
        const title = opp.title || 'No Title';
        const description = opp.description || 'No description provided.';
        const category = opp.category || 'General';
        const categoryClass = category.toLowerCase().replace(/\s+/g, '-');
        const source = opp.source || 'SourceBottle';
        
        // Properly handle submission link - check all possible properties where the URL might be stored
        const submissionLink = opp.submissionLink || opp.link || opp.url || opp.callUrl || '#';
        
        // Properly handle media outlet and journalist with conditional display
        const mediaOutlet = opp.mediaOutlet || '';
        const journalist = opp.journalist || '';
        
        // This is the most comprehensive approach to handle all possible date formats
        // For SourceBottle opportunities, we need to look at many possible fields
        
        // Check for deadline in the callDate field (this is the actual field used by SourceBottle)
        let formattedDate = 'Not specified';
        
        // Try each potential date field in order of likelihood
        // This list is based on examining the SourceBottle API response structure
        const possibleDateFields = [
          'callDate',        // Most SourceBottle opportunities use this
          'deadline',        // Generic field name
          'dealine',         // Possible typo in API
          'callDeadline',    // Alternative name
          'call_deadline',   // Snake case variant
          'closeDate',       // Another possible name
          'close_date',      // Snake case variant
          'created',         // Fallback to creation date
          'dateCreated',     // Alternative creation date field
          'date',            // Generic date field
          'publishDate'      // Publication date as last resort
        ];
        
        // Find the first valid date field
        let dateValue = null;
        for (const field of possibleDateFields) {
          if (opp[field] && opp[field] !== 'Invalid Date') {
            dateValue = opp[field];
            break;
          }
        }
        
        // Special handling for SourceBottle date formats
        if (dateValue) {
          try {
            // Handle both string and numeric timestamp formats
            let deadlineDate;
            
            // Check if it's a timestamp or date string
            if (typeof dateValue === 'number' || /^\d+$/.test(dateValue)) {
              // It's a timestamp (in milliseconds) - common in SourceBottle API
              deadlineDate = new Date(parseInt(dateValue));
            } else {
              // It's a date string
              deadlineDate = new Date(dateValue);
            }
            
            // Make sure we have a valid date before formatting
            if (!isNaN(deadlineDate.getTime())) {
              // Format the date - use a more international-friendly format
              const options = { year: 'numeric', month: 'short', day: 'numeric' };
              formattedDate = deadlineDate.toLocaleDateString(undefined, options);
            }
          } catch (e) {
            // Silently handle errors - we'll use the default 'Not specified'
          }
        }
        
        // Create card
        const card = document.createElement('div');
        card.className = 'opportunity-card';
        
        // Support both ai_analysis and aiAnalysis property names for backward compatibility
        const aiAnalysis = opp.ai_analysis || opp.aiAnalysis;
        const hasAiAnalysis = aiAnalysis && (typeof aiEnabled === 'undefined' || aiEnabled);
        
        // Add relevance badge based on AI analysis if available
        let relevanceBadge = '';
        if (hasAiAnalysis) {
          // Support both property naming conventions
          const relevanceScore = aiAnalysis.relevance_score || aiAnalysis.relevanceScore;
          const priority = aiAnalysis.priority || 'medium';
          
          if (relevanceScore !== undefined) {
            const score = Math.round(relevanceScore * 100);
            let relevanceClass = priority;
            
            relevanceBadge = `
              <div class="relevance-badge ${relevanceClass}">
                <span class="score">${score}%</span>
                <span class="priority">${priority.toUpperCase()}</span>
              </div>
            `;
          }
        } else if (opp.relevanceScore !== undefined) {
          // Fallback to legacy relevance score
          const score = opp.relevanceScore;
          let relevanceClass = 'medium';
          if (score >= 80) relevanceClass = 'high';
          if (score < 50) relevanceClass = 'low';
          
          relevanceBadge = `<div class="relevance-badge ${relevanceClass}">${score}% Match</div>`;
        }
        
        // Keywords display
        let keywordsHtml = '';
        
        // Use AI themes if available, otherwise fall back to keywords
        if (hasAiAnalysis && opp.ai_analysis.key_themes && opp.ai_analysis.key_themes.length > 0) {
          const themeTags = opp.ai_analysis.key_themes.map(theme => 
            `<span class="card-tag theme-tag">${theme}</span>`
          ).join('');
          
          keywordsHtml = `
            <div class="card-tags">
              ${themeTags}
            </div>
          `;
        } else if (opp.keywords && opp.keywords.length > 0) {
          const keywordTags = opp.keywords.map(keyword => 
            `<span class="card-tag">${keyword}</span>`
          ).join('');
          
          keywordsHtml = `
            <div class="card-tags">
              ${keywordTags}
            </div>
          `;
        }
        
        // AI analysis badge
        let aiBadge = '';
        if (hasAiAnalysis) {
          aiBadge = `
            <div class="ai-badge" data-id="${opp.id || ''}">
              <i class="fas fa-robot"></i> AI Analyzed
            </div>
          `;
        }
        
        // Generate an ID for this opportunity if it doesn't have one
        const opportunityId = opp.id || `opp-${Date.now()}`;
        
        // Generate feedback buttons HTML if classifier is available
        const feedbackButtonsHTML = aiService && aiService.classifier ? createFeedbackButtonsHTML(opportunityId) : '';
        
        card.innerHTML = `
          <div class="card-header">
            <div>
              <h3 class="card-title">${title}</h3>
              <span class="card-category ${categoryClass}">${category}</span>
              ${aiBadge}
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
            ${mediaOutlet || journalist ? `
            <div class="card-meta">
              ${mediaOutlet ? `<span>📰 ${mediaOutlet}</span>` : ''}
              ${journalist ? `<span>👤 ${journalist}</span>` : ''}
            </div>` : ''}
            <div class="card-actions">
              <a href="${submissionLink}" target="_blank" class="action-button view-button">View Opportunity</a>
              ${hasAiAnalysis ? `<button class="action-button view-ai-analysis" data-id="${opportunityId}" data-opportunity-id="${opportunityId}">View AI Analysis</button>` : ''}
            </div>
          </div>
          ${feedbackButtonsHTML ? `<div class="card-footer">${feedbackButtonsHTML}</div>` : ''}
        `;
        
        // Add data attribute for opportunity ID
        card.setAttribute('data-opportunity-id', opportunityId);
        
        opportunitiesContainer.appendChild(card);
        
        // Add event listener for the AI analysis button
        if (hasAiAnalysis) {
          const aiAnalysisBtn = card.querySelector('.view-ai-analysis');
          if (aiAnalysisBtn) {
            console.log('Adding click handler to AI Analysis button', aiAnalysisBtn);
            aiAnalysisBtn.addEventListener('click', (e) => {
              e.preventDefault();
              console.log('AI Analysis button clicked for opportunity:', opp);
              console.log('AI analysis data available:', opp.ai_analysis || opp.aiAnalysis);
              showAIAnalysisModal(opp);
            });
          } else {
            console.warn('AI Analysis button not found in card');
          }
          
          // Also make the entire badge clickable to view AI analysis if present
          const aiAnalysisBadge = card.querySelector('.ai-badge');
          if (aiAnalysisBadge) {
            console.log('Adding click handler to AI badge');
            aiAnalysisBadge.addEventListener('click', (e) => {
              e.preventDefault();
              console.log('AI Analysis badge clicked for opportunity:', opportunityId);
              showAIAnalysisModal(opp); 
            });
          }
        }
      } catch (error) {
        console.error('Error rendering opportunity:', error, opp);
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
      settings.ui = settings.ui || {};
      settings.ui.defaultView = body.classList.contains('list-view') ? 'list' : 'grid';
      
      chrome.storage.local.set({ settings }, function() {
        console.log('View preference saved');
      });
    });
  }
  
  // Load Azure OpenAI settings when the page loads
  loadAzureSettings();
  
  /**
   * Open the settings modal for Azure OpenAI configuration
   */
  
  function openSettingsModal() {
    if (settingsModal) {
      settingsModal.classList.remove('hidden');
      loadAzureSettings(); // Refresh settings data
    }
  }
  
  /**
   * Close the settings modal
   */
  
  function closeSettingsModalFn() {
    if (settingsModal) {
      settingsModal.classList.add('hidden');
    }
  }
  
  /**
   * Load Azure OpenAI settings from storage
   */
  
  function loadAzureSettings() {
    chrome.storage.local.get(['azureOpenAISettings'], function(result) {
      const settings = result.azureOpenAISettings || {};
      
      if (azureResourceName) azureResourceName.value = settings.resourceName || '';
      if (azureApiKey) azureApiKey.value = settings.apiKey || '';
      if (azureDeploymentId) azureDeploymentId.value = settings.deploymentId || '';
      if (azureApiVersion) azureApiVersion.value = settings.apiVersion || '2023-05-15';
      
      // If we have settings and aiService exists, configure it
      if (aiService && typeof aiService.setConfig === 'function' && 
          settings.resourceName && settings.apiKey && settings.deploymentId) {
        aiService.setConfig({
          API_KEY: settings.apiKey,
          RESOURCE_NAME: settings.resourceName,
          DEPLOYMENT_ID: settings.deploymentId,
          API_VERSION: settings.apiVersion || '2023-05-15'
        });
        
        // Re-initialize the AI service
        aiService.initialize().then(initialized => {
          aiEnabled = initialized;
          console.log('AI service re-initialized with Azure settings:', initialized);
        });
      }
    });
  }
  
  /**
   * Save Azure OpenAI settings to storage
   * @param {Event} e - Submit event
   */
  
  function saveAzureSettings(e) {
    e.preventDefault();
    
    // Get form values
    const settings = {
      resourceName: azureResourceName.value.trim(),
      apiKey: azureApiKey.value.trim(),
      deploymentId: azureDeploymentId.value.trim(),
      apiVersion: azureApiVersion.value.trim() || '2023-05-15'
    };
    
    // Validate required fields
    if (!settings.resourceName || !settings.apiKey || !settings.deploymentId) {
      showConnectionStatus('Please fill in all required fields', 'error');
      return;
    }
    
    // Save to chrome storage
    chrome.storage.local.set({ 'azureOpenAISettings': settings }, function() {
      console.log('Azure OpenAI settings saved');
      showConnectionStatus('Settings saved successfully', 'success');
      
      // Update the AI service with new settings
      if (aiService && typeof aiService.setConfig === 'function') {
        aiService.setConfig({
          API_KEY: settings.apiKey,
          RESOURCE_NAME: settings.resourceName,
          DEPLOYMENT_ID: settings.deploymentId,
          API_VERSION: settings.apiVersion
        });
        
        // Re-initialize the AI service
        aiService.initialize().then(initialized => {
          aiEnabled = initialized;
          console.log('AI service re-initialized with Azure settings:', initialized);
          if (initialized) {
            showConnectionStatus('Settings saved and AI service initialized successfully', 'success');
          } else {
            showConnectionStatus('Settings saved but AI service failed to initialize', 'warning');
          }
        }).catch(error => {
          console.error('Error initializing AI service:', error);
          showConnectionStatus('Error initializing AI service: ' + error.message, 'error');
          aiEnabled = false;
        });
      }
    });
  }
  
  /**
   * Test Azure OpenAI connection
   */
  
  function testAzureConnection() {
    // Show testing status
    showConnectionStatus('Testing connection...', 'info');
    
    // Get current form values
    const config = {
      API_KEY: azureApiKey.value.trim(),
      RESOURCE_NAME: azureResourceName.value.trim(),
      DEPLOYMENT_ID: azureDeploymentId.value.trim(),
      API_VERSION: azureApiVersion.value.trim() || '2023-05-15'
    };
    
    // Validate required fields
    if (!config.RESOURCE_NAME || !config.API_KEY || !config.DEPLOYMENT_ID) {
      showConnectionStatus('Please fill in all required fields', 'error');
      return;
    }
    
    // Create a temporary AI service instance for testing
    if (!aiService) {
      showConnectionStatus('AI service not available', 'error');
      return;
    }
    
    // Update config and test
    aiService.setConfig(config);
    
    aiService.initialize().then(initialized => {
      if (initialized) {
        showConnectionStatus('Connection successful! Azure OpenAI API is working.', 'success');
        aiEnabled = true;
      } else {
        showConnectionStatus('Connection failed. Please check your credentials.', 'error');
        aiEnabled = false;
      }
    }).catch(error => {
      console.error('Error testing Azure OpenAI connection:', error);
      showConnectionStatus('Error: ' + error.message, 'error');
      aiEnabled = false;
    });
  }
  
  /**
   * Show connection status message in the settings modal
   * @param {string} message - Status message
   * @param {string} type - 'success', 'error', 'info', or 'warning'
   */
  
  function showConnectionStatus(message, type = 'info') {
    if (!connectionStatus) return;
    
    // Map types to tailwind classes
    const typeClasses = {
      success: 'bg-green-100 text-green-800 border-green-200',
      error: 'bg-red-100 text-red-800 border-red-200',
      warning: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      info: 'bg-blue-100 text-blue-800 border-blue-200'
    };
    
    // Apply classes and show message
    connectionStatus.className = 'mt-4 p-3 rounded-md border ' + (typeClasses[type] || typeClasses.info);
    connectionStatus.innerHTML = message;
    connectionStatus.classList.remove('hidden');
    
    // Automatically hide success and info messages after 5 seconds
    if (type === 'success' || type === 'info') {
      setTimeout(() => {
        connectionStatus.classList.add('hidden');
      }, 5000);
    }
  }

  /**
   * Run enhanced AI analysis on the currently displayed opportunities
   * This is called when the Enhanced AI button is clicked
   */
  
  // Enhanced AI functionality has been removed
  
  /**
   * Get the currently displayed opportunities based on pagination
   * @returns {Array} - Array of opportunities on the current page
   */
  
  function getCurrentPageItems() {
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    return filteredOpportunities.slice(start, end);
  }
  
  // Call our initialization function when the DOM is ready
  initializeAndLoad().catch(error => {
    console.error('Error initializing the app:', error);
  });
}


// Main event listener
document.addEventListener('DOMContentLoaded', function() {
  // Call our initialization function
  initAndLoad().catch(error => console.error('Error initializing app:', error));
});
}
