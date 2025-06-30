document.addEventListener('DOMContentLoaded', function() {
  console.log('Settings page loaded');
  
  // Cache DOM elements
  const saveButton = document.getElementById('save-settings');
  const resetButton = document.getElementById('reset-settings');
  const statusMessage = document.getElementById('status-message');
  const enableAutoScrape = document.getElementById('enable-auto-scrape');
  const scheduleOptions = document.getElementById('schedule-options');
  const scheduleType = document.getElementById('schedule-type');
  const customDays = document.getElementById('custom-days');
  const darkModeToggle = document.getElementById('dark-mode-toggle');
  const interestTagsContainer = document.getElementById('interest-tags');
  const newInterestTag = document.getElementById('new-interest-tag');
  
  // Azure OpenAI elements
  const azureResourceName = document.getElementById('azure-resource-name');
  const azureApiKey = document.getElementById('azure-api-key');
  const azureDeploymentId = document.getElementById('azure-deployment-id');
  const azureApiVersion = document.getElementById('azure-api-version');
  const testAzureConnectionBtn = document.getElementById('test-azure-connection');
  const connectionStatus = document.getElementById('connection-status');
  
  // Initialize settings from storage
  loadSettings();
  
  // Event listeners
  saveButton.addEventListener('click', saveSettings);
  resetButton.addEventListener('click', resetSettings);
  enableAutoScrape.addEventListener('change', toggleScheduleOptions);
  scheduleType.addEventListener('change', toggleCustomDays);
  darkModeToggle.addEventListener('change', toggleDarkMode);
  newInterestTag.addEventListener('keydown', handleNewTag);
  
  // Add listener for the Azure OpenAI test connection button
  if (testAzureConnectionBtn) {
    testAzureConnectionBtn.addEventListener('click', testAzureConnection);
  }
  
  // Load settings from storage
  function loadSettings() {
    chrome.storage.local.get(['settings', 'azureOpenAISettings'], function(result) {
      const settings = result.settings || getDefaultSettings();
      const azureSettings = result.azureOpenAISettings || {};
      
      // Azure OpenAI settings
      if (azureResourceName) azureResourceName.value = azureSettings.resourceName || '';
      if (azureApiKey) azureApiKey.value = azureSettings.apiKey || '';
      if (azureDeploymentId) azureDeploymentId.value = azureSettings.deploymentId || '';
      if (azureApiVersion) azureApiVersion.value = azureSettings.apiVersion || '2023-05-15';
      document.getElementById('enable-ai-matching').checked = settings.openai?.enableMatching !== false;
      document.getElementById('enable-ai-categories').checked = settings.openai?.enableCategories !== false;
      document.getElementById('enable-ai-relevance').checked = settings.openai?.enableRelevance !== false;
      
      document.getElementById('industry').value = settings.userProfile?.industry || '';
      document.getElementById('bio').value = settings.userProfile?.bio || '';
      
      // Load interest tags
      if (settings.userProfile?.interests && Array.isArray(settings.userProfile.interests)) {
        settings.userProfile.interests.forEach(tag => addTag(tag));
      }
      
      document.getElementById('dark-mode-toggle').checked = settings.ui?.darkMode === true;
      document.getElementById('default-view').value = settings.ui?.defaultView || 'list';
      
      document.getElementById('notify-new').checked = settings.notifications?.notifyNew !== false;
      document.getElementById('notify-relevant').checked = settings.notifications?.notifyRelevant !== false;
      document.getElementById('notify-urgent').checked = settings.notifications?.notifyUrgent === true;
      document.getElementById('quiet-hours-start').value = settings.notifications?.quietHoursStart || '22:00';
      document.getElementById('quiet-hours-end').value = settings.notifications?.quietHoursEnd || '08:00';
      
      document.getElementById('enable-auto-scrape').checked = settings.schedule?.enabled === true;
      document.getElementById('schedule-type').value = settings.schedule?.type || 'daily';
      document.getElementById('scrape-time').value = settings.schedule?.time || '09:00';
      
      // Apply custom days
      if (settings.schedule?.days) {
        const days = settings.schedule.days;
        document.getElementById('day-mon').checked = days.includes('mon');
        document.getElementById('day-tue').checked = days.includes('tue');
        document.getElementById('day-wed').checked = days.includes('wed');
        document.getElementById('day-thu').checked = days.includes('thu');
        document.getElementById('day-fri').checked = days.includes('fri');
        document.getElementById('day-sat').checked = days.includes('sat');
        document.getElementById('day-sun').checked = days.includes('sun');
      }
      
      // Set categories
      if (settings.schedule?.categories && Array.isArray(settings.schedule.categories)) {
        const categoriesSelect = document.getElementById('scrape-categories');
        settings.schedule.categories.forEach(category => {
          Array.from(categoriesSelect.options).forEach(option => {
            if (option.value === category) {
              option.selected = true;
            }
          });
        });
      }
      
      // Toggle UI elements based on current settings
      toggleScheduleOptions();
      toggleCustomDays();
      applyDarkMode(settings.ui?.darkMode === true);
    });
  }
  
  // Save settings to storage
  function saveSettings() {
    // Collect Azure OpenAI settings
    const azureSettings = {
      resourceName: azureResourceName ? azureResourceName.value.trim() : '',
      apiKey: azureApiKey ? azureApiKey.value.trim() : '',
      deploymentId: azureDeploymentId ? azureDeploymentId.value.trim() : '',
      apiVersion: azureApiVersion ? azureApiVersion.value.trim() : '2023-05-15'
    };
    
    const settings = {
      openai: {
        // Maintain backward compatibility with existing structure
        apiKey: '', // No longer used, but keeping for compatibility
        enableMatching: document.getElementById('enable-ai-matching').checked,
        enableCategories: document.getElementById('enable-ai-categories').checked,
        enableRelevance: document.getElementById('enable-ai-relevance').checked
      },
      userProfile: {
        industry: document.getElementById('industry').value,
        bio: document.getElementById('bio').value,
        interests: getInterestTags()
      },
      ui: {
        darkMode: document.getElementById('dark-mode-toggle').checked,
        defaultView: document.getElementById('default-view').value
      },
      notifications: {
        notifyNew: document.getElementById('notify-new').checked,
        notifyRelevant: document.getElementById('notify-relevant').checked,
        notifyUrgent: document.getElementById('notify-urgent').checked,
        quietHoursStart: document.getElementById('quiet-hours-start').value,
        quietHoursEnd: document.getElementById('quiet-hours-end').value
      },
      schedule: {
        enabled: document.getElementById('enable-auto-scrape').checked,
        type: document.getElementById('schedule-type').value,
        time: document.getElementById('scrape-time').value,
        days: getSelectedDays(),
        categories: getSelectedCategories()
      }
    };
    
    chrome.storage.local.set({
      'settings': settings,
      'azureOpenAISettings': azureSettings
    }, function() {
      console.log('Settings saved:', settings);
      
      // Show success message
      statusMessage.textContent = 'Settings saved successfully!';
      statusMessage.className = 'status success';
      
      // Hide message after 3 seconds
      setTimeout(() => {
        statusMessage.className = 'status';
      }, 3000);
      
      // Set up scraping alarm if enabled
      if (settings.schedule.enabled) {
        setupScrapingAlarm(settings.schedule);
      } else {
        // Clear existing alarm if disabled
        chrome.alarms.clear('scrape-opportunities');
      }
      
      // Initialize AI service with new settings if available
      if (window.aiService && typeof window.aiService.setConfig === 'function' && 
          azureSettings.resourceName && azureSettings.apiKey && azureSettings.deploymentId) {
        window.aiService.setConfig({
          API_KEY: azureSettings.apiKey,
          RESOURCE_NAME: azureSettings.resourceName,
          DEPLOYMENT_ID: azureSettings.deploymentId,
          API_VERSION: azureSettings.apiVersion || '2023-05-15'
        });
        console.log('AI service config updated with new Azure OpenAI settings');
      }
    });
  }
  
  // Set up scraping alarm
  function setupScrapingAlarm(schedule) {
    // First clear any existing alarm
    chrome.alarms.clear('autoScrape', () => {
      if (!schedule.enabled) return;
      
      console.log('Setting up auto-scrape alarm:', schedule);
      
      // Parse time into hours and minutes
      const [hours, minutes] = schedule.time.split(':').map(Number);
      
      // Calculate when the next alarm should fire
      const now = new Date();
      const scheduledTime = new Date();
      scheduledTime.setHours(hours, minutes, 0, 0);
      
      // If the scheduled time is earlier today, schedule for tomorrow
      if (scheduledTime < now) {
        scheduledTime.setDate(scheduledTime.getDate() + 1);
      }
      
      // For custom days, check if the next scheduled day is valid
      if (schedule.type === 'custom') {
        const days = schedule.days;
        const dayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
        let daysToAdd = 0;
        let found = false;
        
        while (!found && daysToAdd < 7) {
          const futureDate = new Date(scheduledTime);
          futureDate.setDate(futureDate.getDate() + daysToAdd);
          const dayName = dayNames[futureDate.getDay()];
          
          if (days.includes(dayName)) {
            found = true;
            // Set to this valid future date
            scheduledTime.setDate(scheduledTime.getDate() + daysToAdd);
          } else {
            daysToAdd++;
          }
        }
      }
      
      // Calculate delay in minutes until the next scheduled time
      const delayInMinutes = (scheduledTime - now) / (1000 * 60);
      
      // Create the alarm
      chrome.alarms.create('autoScrape', {
        delayInMinutes: delayInMinutes,
        periodInMinutes: 24 * 60 // Daily
      });
      
      console.log(`Auto-scrape alarm set for ${scheduledTime.toLocaleString()}`);
    });
  }
  
  // Reset settings to default
  function resetSettings() {
    if (confirm('Are you sure you want to reset all settings to default?')) {
      const defaultSettings = getDefaultSettings();
      
      chrome.storage.local.set({ 'settings': defaultSettings }, function() {
        console.log('Settings reset to default');
        
        // Reload form with default settings
        loadSettings();
        
        // Show success message
        statusMessage.textContent = 'Settings reset to default';
        statusMessage.className = 'status success';
        
        // Hide message after 3 seconds
        setTimeout(() => {
          statusMessage.style.display = 'none';
        }, 3000);
      });
    }
  }
  
  // Toggle schedule options based on auto-scrape checkbox
  function toggleScheduleOptions() {
    if (enableAutoScrape.checked) {
      scheduleOptions.style.display = 'block';
    } else {
      scheduleOptions.style.display = 'none';
    }
  }
  
  // Toggle custom days based on schedule type
  function toggleCustomDays() {
    if (scheduleType.value === 'custom') {
      customDays.style.display = 'block';
    } else {
      customDays.style.display = 'none';
    }
  }
  
  // Toggle dark mode
  function toggleDarkMode() {
    applyDarkMode(darkModeToggle.checked);
  }
  
  function applyDarkMode(isDark) {
    if (isDark) {
      document.documentElement.style.setProperty('--color-bg', '#1a1a1a');
      document.documentElement.style.setProperty('--color-text', '#f5f5f5');
      document.documentElement.style.setProperty('--color-text-secondary', '#aaaaaa');
      document.documentElement.style.setProperty('--color-white', '#2a2a2a');
      document.documentElement.style.setProperty('--color-light', '#333333');
      document.documentElement.style.setProperty('--color-border', '#444444');
      document.body.classList.add('dark-mode');
    } else {
      document.documentElement.style.setProperty('--color-bg', '#f5f5f7');
      document.documentElement.style.setProperty('--color-text', '#333');
      document.documentElement.style.setProperty('--color-text-secondary', '#6c757d');
      document.documentElement.style.setProperty('--color-white', '#fff');
      document.documentElement.style.setProperty('--color-light', '#f8f9fa');
      document.documentElement.style.setProperty('--color-border', '#dee2e6');
      document.body.classList.remove('dark-mode');
    }
  }
  
  /**
   * Test Azure OpenAI connection
   */
  function testAzureConnection() {
    if (!connectionStatus) return;
    
    // Show testing status
    showConnectionStatus('Testing connection...', 'info');
    
    // Get current form values
    const config = {
      API_KEY: azureApiKey ? azureApiKey.value.trim() : '',
      RESOURCE_NAME: azureResourceName ? azureResourceName.value.trim() : '',
      DEPLOYMENT_ID: azureDeploymentId ? azureDeploymentId.value.trim() : '',
      API_VERSION: azureApiVersion ? azureApiVersion.value.trim() : '2023-05-15'
    };
    
    // Validate required fields
    if (!config.RESOURCE_NAME || !config.API_KEY || !config.DEPLOYMENT_ID) {
      showConnectionStatus('Please fill in all required fields', 'error');
      return;
    }
    
    // Create a temporary test connection
    // We'll need to load the aiService module here since it's not available in settings.js by default
    const tempScript = document.createElement('script');
    tempScript.src = 'modules/aiService.js';
    tempScript.onload = function() {
      // Once aiService is loaded, configure and test
      if (window.aiService && typeof window.aiService.setConfig === 'function') {
        window.aiService.setConfig(config);
        
        window.aiService.initialize().then(initialized => {
          if (initialized) {
            showConnectionStatus('Connection successful! Azure OpenAI API is working.', 'success');
          } else {
            showConnectionStatus('Connection failed. Please check your credentials.', 'error');
          }
        }).catch(error => {
          console.error('Error testing Azure OpenAI connection:', error);
          showConnectionStatus('Error: ' + error.message, 'error');
        });
      } else {
        showConnectionStatus('AI service not available. Try saving and reopening settings.', 'error');
      }
    };
    
    tempScript.onerror = function() {
      showConnectionStatus('Could not load AI service module', 'error');
    };
    
    document.head.appendChild(tempScript);
  }
  
  /**
   * Show connection status message
   * @param {string} message - Status message
   * @param {string} type - 'success', 'error', 'info', or 'warning'
   */
  function showConnectionStatus(message, type = 'info') {
    if (!connectionStatus) return;
    
    // Map types to colors
    const typeClasses = {
      success: 'bg-green-100 text-green-800 border-green-200',
      error: 'bg-red-100 text-red-800 border-red-200',
      warning: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      info: 'bg-blue-100 text-blue-800 border-blue-200'
    };
    
    // Remove all existing classes except 'mt-3 p-3 rounded-md border'
    connectionStatus.className = 'mt-3 p-3 rounded-md border';
    
    // Add the appropriate color classes
    connectionStatus.classList.add(...(typeClasses[type] || typeClasses.info).split(' '));
    
    // Set the message
    connectionStatus.textContent = message;
    
    // Make sure it's visible
    connectionStatus.classList.remove('hidden');
    
    // Auto-hide success and info messages after 5 seconds
    if (type === 'success' || type === 'info') {
      setTimeout(() => {
        connectionStatus.classList.add('hidden');
      }, 5000);
    }
  }
  
  // Handle new interest tags
  function handleNewTag(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      const tagText = newInterestTag.value.trim();
      
      if (tagText && tagText.length > 0) {
        addTag(tagText);
        newInterestTag.value = '';
      }
    }
  }
  
  // Add a tag to the interest tags container
  function addTag(text) {
    // Check if tag already exists
    const existingTags = getInterestTags();
    if (existingTags.includes(text)) return;
    
    const tag = document.createElement('div');
    tag.className = 'tag';
    tag.innerHTML = `
      ${text}
      <span class="remove-tag" onclick="this.parentElement.remove()">×</span>
    `;
    
    // Insert before the input
    interestTagsContainer.insertBefore(tag, newInterestTag);
  }
  
  // Get current interest tags
  function getInterestTags() {
    const tags = [];
    const tagElements = interestTagsContainer.querySelectorAll('.tag');
    
    tagElements.forEach(tag => {
      // Get text content excluding the × symbol
      const text = tag.textContent.trim().replace('×', '').trim();
      if (text) tags.push(text);
    });
    
    return tags;
  }
  
  // Get selected days for custom schedule
  function getSelectedDays() {
    const days = [];
    
    if (document.getElementById('day-mon').checked) days.push('mon');
    if (document.getElementById('day-tue').checked) days.push('tue');
    if (document.getElementById('day-wed').checked) days.push('wed');
    if (document.getElementById('day-thu').checked) days.push('thu');
    if (document.getElementById('day-fri').checked) days.push('fri');
    if (document.getElementById('day-sat').checked) days.push('sat');
    if (document.getElementById('day-sun').checked) days.push('sun');
    
    return days;
  }
  
  // Get selected categories
  function getSelectedCategories() {
    const select = document.getElementById('scrape-categories');
    const selectedCategories = [];
    
    Array.from(select.options).forEach(option => {
      if (option.selected) {
        selectedCategories.push(option.value);
      }
    });
    
    return selectedCategories;
  }
  
  // Default settings
  function getDefaultSettings() {
    return {
      openai: {
        apiKey: '',
        enableMatching: true,
        enableCategories: true,
        enableRelevance: true
      },
      userProfile: {
        industry: '',
        bio: '',
        interests: ['technology', 'marketing', 'business', 'finance', 'health']
      },
      ui: {
        darkMode: false,
        defaultView: 'list'
      },
      notifications: {
        notifyNew: true,
        notifyRelevant: true,
        notifyUrgent: false,
        quietHoursStart: '22:00',
        quietHoursEnd: '08:00'
      },
      schedule: {
        enabled: false,
        type: 'daily',
        time: '09:00',
        days: ['mon', 'tue', 'wed', 'thu', 'fri'],
        categories: ['all']
      }
    };
  }
});
