/**
 * SourceBottle Opportunities Display Page
 * Refactored to use the modular architecture
 */

document.addEventListener('DOMContentLoaded', async function() {
  console.log('Opportunities page loaded - modular version');
  
  // Dynamically import modules
  try {
    const { logManager } = await import(chrome.runtime.getURL('modules/logger.js'));
    const { storageManager } = await import(chrome.runtime.getURL('modules/storage.js'));
    const { integrationsManager } = await import(chrome.runtime.getURL('modules/integrations.js'));
    
    // Initialize logging
    logManager.log('Opportunities page loaded - modules imported successfully');
    
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
    const analyzeAiBtn = document.getElementById('analyze-ai-btn');
    const aiIcon = document.getElementById('ai-icon');
    const aiText = document.getElementById('ai-text');
    const exportCsvButton = document.getElementById('export-csv');
    const exportSheetsButton = document.getElementById('export-sheets');
    
    // Store all opportunities and filtered opportunities
    let allOpportunities = [];
    let filteredOpportunities = [];
    let currentPage = 1;
    const itemsPerPage = 12;
    let aiProcessing = false;
    
    // Set up the AI service for opportunity processing
    let aiService = null;
    
    // Initialize the AI service once it's available
    function initializeAIService() {
      // Check if aiService is available in global scope (from loaded script)
      if (window.aiService) {
        aiService = window.aiService;
        logManager.log('AI service found in global scope');
        
        // Initialize AI service
        aiService.initialize().then(initialized => {
          if (initialized) {
            logManager.log('AI service initialized successfully');
            // Re-process opportunities with AI if needed
            if (allOpportunities.length > 0) {
              processOpportunitiesWithAI();
            }
          }
        }).catch(err => {
          logManager.error('Error initializing AI service:', err);
          // Continue with normal operation even if AI fails
          initializeView();
        });
      } else {
        logManager.error('AI service not available in global scope');
        // Continue with normal operation even if AI is not available
        initializeView();
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
      keyword: '',
      mediaOutlet: '',
      journalist: '',
      search: ''
    };
    
    // Check dark mode preference from storage
    const settings = await storageManager.getSettings();
    if (settings?.ui?.darkMode === true) {
      enableDarkMode();
      darkModeToggle.checked = true;
    }
    
    // Set up event listeners
    searchInput.addEventListener('input', handleSearch);
    toggleViewBtn.addEventListener('click', toggleView);
    toggleFiltersBtn.addEventListener('click', toggleFilters);
    darkModeToggle.addEventListener('change', toggleDarkMode);
    applyFiltersBtn.addEventListener('click', applyFilters);
    resetFiltersBtn.addEventListener('click', resetFilters);
    analyzeAiBtn.addEventListener('click', manualAIAnalysis);
    
    if (exportCsvButton) {
      exportCsvButton.addEventListener('click', exportToCSV);
    }
    
    if (exportSheetsButton) {
      exportSheetsButton.addEventListener('click', exportToGoogleSheets);
    }
    
    // Check if we should automatically run AI analysis (from URL parameter)
    const urlParams = new URLSearchParams(window.location.search);
    const autoAnalyze = urlParams.get('analyze') === 'true';
    
    // Filter input event listeners
    document.getElementById('deadline-filter').addEventListener('change', updateFilterValue);
    document.getElementById('relevance-filter').addEventListener('change', updateFilterValue);
    document.getElementById('source-filter').addEventListener('change', updateFilterValue);
    document.getElementById('keyword-filter').addEventListener('input', updateFilterValue);
    document.getElementById('media-outlet-filter').addEventListener('input', updateFilterValue);
    document.getElementById('journalist-filter').addEventListener('input', updateFilterValue);
    
    // Load opportunities from storage
    loadOpportunities(autoAnalyze);
    
    /**
     * Load opportunities from storage
     */
    async function loadOpportunities(triggerAiAnalysis = false) {
      try {
        logManager.log('Loading opportunities from storage');
        
        // Use the storageManager module to get opportunities
        const storedOpportunities = await storageManager.getOpportunities();
        allOpportunities = storedOpportunities || [];
        
        logManager.log(`Loaded ${allOpportunities.length} opportunities from storage`);
        
        // Get last updated timestamp
        const lastUpdated = await storageManager.getLastUpdated();
        if (lastUpdated) {
          const timestamp = new Date(lastUpdated);
          const options = { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
          document.getElementById('last-updated').textContent = `Last updated: ${timestamp.toLocaleString(undefined, options)}`;
        }
        
        // Initialize filters and view
        createCategoryFilters();
        applyFilters();
        
        // Run AI analysis if requested
        if (triggerAiAnalysis) {
          processOpportunitiesWithAI();
        }
      } catch (error) {
        logManager.error('Error loading opportunities:', error);
        // Show error message
        opportunitiesContainer.innerHTML = `
          <div class="error-container">
            <h3>Error Loading Opportunities</h3>
            <p>There was a problem loading your opportunities. Please try refreshing the page.</p>
            <p>Error: ${error.message}</p>
          </div>
        `;
      }
    }
    
    /**
     * Process opportunities with AI
     */
    async function processOpportunitiesWithAI() {
      if (!aiService || aiProcessing) {
        return;
      }
      
      try {
        aiProcessing = true;
        aiIcon.classList.add('spin');
        aiText.textContent = 'Processing...';
        
        logManager.log('Starting AI analysis of opportunities');
        
        // Process opportunities in batches to avoid timeouts
        const batchSize = 10;
        let processed = 0;
        let enhanced = 0;
        
        for (let i = 0; i < allOpportunities.length; i += batchSize) {
          const batch = allOpportunities.slice(i, i + batchSize);
          const needsAnalysis = batch.filter(opp => !opp.aiProcessed);
          
          if (needsAnalysis.length === 0) {
            processed += batch.length;
            continue;
          }
          
          // Update all opportunities that need processing
          const results = await Promise.all(
            needsAnalysis.map(opp => aiService.enhanceOpportunity(opp))
          );
          
          // Mark opportunities as processed and update with AI results
          results.forEach((result, index) => {
            if (result) {
              const currentOpp = needsAnalysis[index];
              const oppIndex = allOpportunities.findIndex(o => o.externalId === currentOpp.externalId);
              
              if (oppIndex !== -1) {
                allOpportunities[oppIndex] = {
                  ...allOpportunities[oppIndex],
                  ...result,
                  aiProcessed: true
                };
                enhanced++;
              }
            }
          });
          
          processed += batch.length;
          
          // Update UI to show progress
          aiText.textContent = `Processing ${Math.round((processed / allOpportunities.length) * 100)}%`;
        }
        
        // Save enhanced opportunities back to storage
        await storageManager.saveOpportunities(allOpportunities);
        
        logManager.log(`AI analysis complete - Enhanced ${enhanced} opportunities`);
        
        // Re-render with enhanced data
        applyFilters();
        
      } catch (error) {
        logManager.error('Error in AI processing:', error);
      } finally {
        aiProcessing = false;
        aiIcon.classList.remove('spin');
        aiText.textContent = 'Analyze with AI';
      }
    }
    
    /**
     * Export opportunities to CSV
     */
    async function exportToCSV() {
      try {
        logManager.log('Exporting opportunities to CSV');
        const opportunities = filteredOpportunities.length > 0 ? filteredOpportunities : allOpportunities;
        
        if (opportunities.length === 0) {
          alert('No opportunities to export');
          return;
        }
        
        const result = await integrationsManager.exportToCSV(opportunities);
        
        if (result.success) {
          logManager.log('Successfully exported to CSV');
        } else {
          logManager.error('CSV export failed:', result.error);
          alert(`Export failed: ${result.error}`);
        }
      } catch (error) {
        logManager.error('Error exporting to CSV:', error);
        alert(`Export error: ${error.message}`);
      }
    }
    
    /**
     * Export opportunities to Google Sheets
     */
    async function exportToGoogleSheets() {
      try {
        logManager.log('Exporting opportunities to Google Sheets');
        const opportunities = filteredOpportunities.length > 0 ? filteredOpportunities : allOpportunities;
        
        if (opportunities.length === 0) {
          alert('No opportunities to export');
          return;
        }
        
        // Update UI to show loading state
        if (exportSheetsButton) {
          exportSheetsButton.textContent = 'Sending...';
          exportSheetsButton.disabled = true;
        }
        
        const result = await integrationsManager.sendToGoogleSheets(opportunities);
        
        if (result.success) {
          logManager.log('Successfully sent to Google Sheets');
          alert('Successfully sent to Google Sheets');
        } else {
          logManager.error('Google Sheets export failed:', result.error);
          alert(`Export failed: ${result.error}`);
        }
      } catch (error) {
        logManager.error('Error exporting to Google Sheets:', error);
        alert(`Export error: ${error.message}`);
      } finally {
        // Restore button state
        if (exportSheetsButton) {
          exportSheetsButton.textContent = 'Export to Google Sheets';
          exportSheetsButton.disabled = false;
        }
      }
    }
    
    /**
     * Manual AI analysis function
     */
    async function manualAIAnalysis() {
      if (aiProcessing) {
        return;
      }
      
      // Check if AI service is available
      if (!aiService) {
        alert('AI service is not available');
        return;
      }
      
      // Confirm with user
      if (confirm('This will analyze all opportunities using AI. Continue?')) {
        processOpportunitiesWithAI();
      }
    }
    
    /**
     * Initialize the view
     */
    function initializeView() {
      createCategoryFilters();
      applyFilters();
    }
    
    /**
     * Create category filter buttons
     */
    function createCategoryFilters() {
      // Create a "set" of unique categories
      const categories = new Set();
      categories.add('all');
      
      allOpportunities.forEach(opportunity => {
        if (opportunity.category) {
          categories.add(opportunity.category.toLowerCase());
        }
      });
      
      // Convert set to array and sort
      const sortedCategories = Array.from(categories).sort();
      
      // Create buttons for each category
      let categoryHTML = '';
      sortedCategories.forEach(category => {
        const displayName = category === 'all' ? 'All Categories' : 
          category.charAt(0).toUpperCase() + category.slice(1);
        categoryHTML += `
          <button class="category-button ${category === 'all' ? 'active' : ''}" 
            data-category="${category}">
            ${displayName}
          </button>
        `;
      });
      
      categoryFilters.innerHTML = categoryHTML;
      
      // Add event listeners to category buttons
      categoryFilters.querySelectorAll('.category-button').forEach(button => {
        button.addEventListener('click', function() {
          setActiveCategory(this.dataset.category);
        });
      });
    }
    
    /**
     * Set active category
     */
    function setActiveCategory(category) {
      // Update filters
      filters.category = category;
      
      // Update UI
      categoryFilters.querySelectorAll('.category-button').forEach(button => {
        if (button.dataset.category === category) {
          button.classList.add('active');
        } else {
          button.classList.remove('active');
        }
      });
      
      // Apply filters
      applyFilters();
    }
    
    /**
     * Update filter value based on input
     */
    function updateFilterValue(e) {
      const filterId = e.target.id;
      const value = e.target.value;
      
      switch (filterId) {
        case 'deadline-filter':
          filters.deadline = value;
          break;
        case 'relevance-filter':
          filters.relevance = value;
          break;
        case 'source-filter':
          filters.source = value;
          break;
        case 'keyword-filter':
          filters.keyword = value.toLowerCase();
          break;
        case 'media-outlet-filter':
          filters.mediaOutlet = value.toLowerCase();
          break;
        case 'journalist-filter':
          filters.journalist = value.toLowerCase();
          break;
      }
    }
    
    /**
     * Handle search input
     */
    function handleSearch(e) {
      filters.search = e.target.value.toLowerCase();
      applyFilters();
    }
    
    /**
     * Apply all filters to opportunities
     */
    function applyFilters() {
      // Start with all opportunities
      filteredOpportunities = [...allOpportunities];
      
      // Apply category filter
      if (filters.category !== 'all') {
        filteredOpportunities = filteredOpportunities.filter(opp => 
          opp.category && opp.category.toLowerCase() === filters.category
        );
      }
      
      // Apply deadline filter
      if (filters.deadline !== 'all') {
        const now = new Date();
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);
        
        const nextWeek = new Date(now);
        nextWeek.setDate(nextWeek.getDate() + 7);
        nextWeek.setHours(0, 0, 0, 0);
        
        filteredOpportunities = filteredOpportunities.filter(opp => {
          if (!opp.deadline) return true;
          
          try {
            const deadlineDate = new Date(opp.deadline);
            
            switch (filters.deadline) {
              case 'today':
                return deadlineDate <= tomorrow;
              case 'week':
                return deadlineDate <= nextWeek;
              case 'open':
                return deadlineDate > now;
              default:
                return true;
            }
          } catch (e) {
            // If date parsing fails, include the opportunity
            return true;
          }
        });
      }
      
      // Apply source filter
      if (filters.source !== 'all') {
        filteredOpportunities = filteredOpportunities.filter(opp => 
          opp.source && opp.source.toLowerCase() === filters.source
        );
      }
      
      // Apply relevance filter
      if (filters.relevance !== 'all') {
        filteredOpportunities = filteredOpportunities.filter(opp => {
          // If no aiRelevance, include by default for 'medium' and 'low'
          if (!opp.aiRelevance) return filters.relevance !== 'high';
          
          switch (filters.relevance) {
            case 'high':
              return opp.aiRelevance >= 80;
            case 'medium':
              return opp.aiRelevance >= 50 && opp.aiRelevance < 80;
            case 'low':
              return opp.aiRelevance < 50;
            default:
              return true;
          }
        });
      }
      
      // Apply keyword filter
      if (filters.keyword) {
        filteredOpportunities = filteredOpportunities.filter(opp => 
          (opp.keywords && opp.keywords.some(kw => kw.toLowerCase().includes(filters.keyword))) ||
          (opp.title && opp.title.toLowerCase().includes(filters.keyword)) ||
          (opp.description && opp.description.toLowerCase().includes(filters.keyword))
        );
      }
      
      // Apply media outlet filter
      if (filters.mediaOutlet) {
        filteredOpportunities = filteredOpportunities.filter(opp => 
          opp.mediaOutlet && opp.mediaOutlet.toLowerCase().includes(filters.mediaOutlet)
        );
      }
      
      // Apply journalist filter
      if (filters.journalist) {
        filteredOpportunities = filteredOpportunities.filter(opp => 
          opp.journalist && opp.journalist.toLowerCase().includes(filters.journalist)
        );
      }
      
      // Apply search filter (across multiple fields)
      if (filters.search) {
        filteredOpportunities = filteredOpportunities.filter(opp => 
          (opp.title && opp.title.toLowerCase().includes(filters.search)) ||
          (opp.description && opp.description.toLowerCase().includes(filters.search)) ||
          (opp.category && opp.category.toLowerCase().includes(filters.search)) ||
          (opp.journalist && opp.journalist.toLowerCase().includes(filters.search)) ||
          (opp.mediaOutlet && opp.mediaOutlet.toLowerCase().includes(filters.search))
        );
      }
      
      // Reset to first page
      currentPage = 1;
      
      // Render filtered opportunities
      renderOpportunities();
      renderPagination();
    }
    
    /**
     * Reset all filters
     */
    function resetFilters() {
      // Reset filter state
      filters.category = 'all';
      filters.deadline = 'all';
      filters.relevance = 'all';
      filters.source = 'all';
      filters.keyword = '';
      filters.mediaOutlet = '';
      filters.journalist = '';
      filters.search = '';
      
      // Reset UI
      categoryFilters.querySelectorAll('.category-button').forEach(button => {
        if (button.dataset.category === 'all') {
          button.classList.add('active');
        } else {
          button.classList.remove('active');
        }
      });
      
      // Reset select inputs
      document.getElementById('deadline-filter').value = 'all';
      document.getElementById('relevance-filter').value = 'all';
      document.getElementById('source-filter').value = 'all';
      
      // Reset text inputs
      document.getElementById('keyword-filter').value = '';
      document.getElementById('media-outlet-filter').value = '';
      document.getElementById('journalist-filter').value = '';
      searchInput.value = '';
      
      // Apply filters
      applyFilters();
    }
    
    /**
     * Render opportunities
     */
    function renderOpportunities() {
      if (filteredOpportunities.length === 0) {
        opportunitiesContainer.innerHTML = `
          <div class="no-opportunities">
            <h3>No opportunities found</h3>
            <p>Try adjusting your filters or search criteria.</p>
          </div>
        `;
        return;
      }
      
      // Calculate pagination
      const startIndex = (currentPage - 1) * itemsPerPage;
      const endIndex = startIndex + itemsPerPage;
      const paginatedOpportunities = filteredOpportunities.slice(startIndex, endIndex);
      
      // Build HTML
      let opportunitiesHTML = '';
      
      paginatedOpportunities.forEach(opportunity => {
        // Format deadline
        let deadlineDisplay = 'No deadline';
        if (opportunity.deadline) {
          try {
            const deadlineDate = new Date(opportunity.deadline);
            deadlineDisplay = deadlineDate.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
            
            // Check if deadline is past
            const now = new Date();
            if (deadlineDate < now) {
              deadlineDisplay += ' (Past)';
            }
          } catch (e) {
            deadlineDisplay = opportunity.deadline;
          }
        }
        
        // Create relevance indicator if AI processed
        let relevanceIndicator = '';
        if (opportunity.aiProcessed && typeof opportunity.aiRelevance === 'number') {
          let relevanceClass = 'low';
          if (opportunity.aiRelevance >= 80) {
            relevanceClass = 'high';
          } else if (opportunity.aiRelevance >= 50) {
            relevanceClass = 'medium';
          }
          
          relevanceIndicator = `
            <div class="relevance-indicator ${relevanceClass}" 
              title="AI Relevance Score: ${opportunity.aiRelevance}%">
              ${opportunity.aiRelevance}%
            </div>
          `;
        }
        
        // Format keywords
        let keywordsHTML = '';
        if (opportunity.keywords && opportunity.keywords.length > 0) {
          keywordsHTML = `
            <div class="keywords">
              ${opportunity.keywords.map(keyword => `<span class="keyword-tag">${keyword}</span>`).join('')}
            </div>
          `;
        }
        
        opportunitiesHTML += `
          <div class="opportunity-card">
            ${relevanceIndicator}
            <div class="opportunity-header">
              <h3 class="opportunity-title">${opportunity.title || 'Untitled Opportunity'}</h3>
              <span class="opportunity-category">${opportunity.category || 'Uncategorized'}</span>
            </div>
            <div class="opportunity-body">
              <p class="opportunity-description">${opportunity.description || 'No description available'}</p>
              ${keywordsHTML}
            </div>
            <div class="opportunity-footer">
              <div class="opportunity-details">
                <span class="opportunity-deadline">${deadlineDisplay}</span>
                <span class="opportunity-outlet">${opportunity.mediaOutlet || 'Unknown outlet'}</span>
                <span class="opportunity-journalist">${opportunity.journalist || 'Unknown journalist'}</span>
              </div>
              <a href="${opportunity.submissionLink || opportunity.link || '#'}" 
                target="_blank" 
                class="opportunity-link" 
                ${!opportunity.submissionLink && !opportunity.link ? 'disabled' : ''}>
                Apply
              </a>
            </div>
          </div>
        `;
      });
      
      opportunitiesContainer.innerHTML = opportunitiesHTML;
    }
    
    /**
     * Render pagination
     */
    function renderPagination() {
      const totalPages = Math.ceil(filteredOpportunities.length / itemsPerPage);
      
      if (totalPages <= 1) {
        paginationContainer.innerHTML = '';
        return;
      }
      
      // Determine which page buttons to show
      let startPage = Math.max(1, currentPage - 2);
      let endPage = Math.min(totalPages, startPage + 4);
      
      if (endPage - startPage < 4) {
        startPage = Math.max(1, endPage - 4);
      }
      
      let paginationHTML = '';
      
      // Previous button
      paginationHTML += `<button class="pagination-button ${currentPage === 1 ? 'disabled' : ''}" ${currentPage === 1 ? 'disabled' : ''} data-page="prev">Previous</button>`;
      
      // First page and ellipsis
      if (startPage > 1) {
        paginationHTML += `<button class="pagination-button" data-page="1">1</button>`;
        if (startPage > 2) {
          paginationHTML += `<span class="pagination-ellipsis">...</span>`;
        }
      }
      
      // Page numbers
      for (let i = startPage; i <= endPage; i++) {
        paginationHTML += `<button class="pagination-button ${i === currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
      }
      
      // Last page and ellipsis
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
    
    /**
     * Toggle view between grid and list
     */
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
      storageManager.saveUIPreference('defaultView', body.classList.contains('list-view') ? 'list' : 'grid');
    }
    
    /**
     * Toggle filters visibility
     */
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
    
    /**
     * Toggle dark mode
     */
    function toggleDarkMode() {
      const isDark = darkModeToggle.checked;
      
      if (isDark) {
        enableDarkMode();
      } else {
        disableDarkMode();
      }
      
      // Save preference to storage
      storageManager.saveUIPreference('darkMode', isDark);
    }
    
    /**
     * Enable dark mode
     */
    function enableDarkMode() {
      document.body.classList.add('dark-mode');
    }
    
    /**
     * Disable dark mode
     */
    function disableDarkMode() {
      document.body.classList.remove('dark-mode');
    }
    
    // Initialize view based on saved preference
    const uiSettings = await storageManager.getUISettings();
    const defaultView = uiSettings?.defaultView || 'grid';
    
    if (defaultView === 'list') {
      document.body.classList.add('list-view');
      viewIcon.textContent = '📊';
      viewText.textContent = 'Grid View';
    } else {
      document.body.classList.add('grid-view');
      viewIcon.textContent = '📋';
      viewText.textContent = 'List View';
    }
  } catch (error) {
    console.error('Error initializing opportunities page:', error);
    document.getElementById('opportunities-container').innerHTML = `
      <div class="error-container">
        <h3>Error Loading Application</h3>
        <p>There was a problem loading the application. Please try refreshing the page.</p>
        <p>Error: ${error.message}</p>
      </div>
    `;
  }
});
