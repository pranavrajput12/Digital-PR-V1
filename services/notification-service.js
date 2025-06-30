/**
 * SourceBottle Notification Service
 * Handles scheduling scraping jobs and sending notifications
 */

const NotificationService = {
  /**
   * Initialize the notification service
   */
  initialize: function() {
    console.log('Initializing notification service');
    this.setupAlarms();
    this.addAlarmListener();
    return true;
  },

  /**
   * Set up alarms based on user settings
   */
  setupAlarms: function() {
    chrome.storage.local.get(['settings'], (result) => {
      const settings = result.settings || {};
      const notifications = settings.notifications || {};
      
      // Clear any existing alarms
      chrome.alarms.clearAll();
      
      if (notifications.enabled) {
        console.log('Setting up notification alarms');
        
        if (notifications.scheduleType === 'daily') {
          // Set daily alarm at specified time
          const dailyTime = notifications.dailyTime || '09:00';
          const [hours, minutes] = dailyTime.split(':').map(Number);
          
          const now = new Date();
          const scheduledTime = new Date();
          scheduledTime.setHours(hours, minutes, 0, 0);
          
          // If time has already passed today, schedule for tomorrow
          if (now > scheduledTime) {
            scheduledTime.setDate(scheduledTime.getDate() + 1);
          }
          
          const delayInMinutes = (scheduledTime - now) / (1000 * 60);
          
          chrome.alarms.create('sourcebottle-daily-check', {
            delayInMinutes: delayInMinutes,
            periodInMinutes: 24 * 60 // Daily
          });
          
          console.log(`Daily alarm scheduled for ${dailyTime}, in ${delayInMinutes.toFixed(2)} minutes`);
        } else if (notifications.scheduleType === 'weekly') {
          // Set weekly alarms for specific days
          const weeklyDays = notifications.weeklyDays || [];
          const weeklyTime = notifications.weeklyTime || '09:00';
          const [hours, minutes] = weeklyTime.split(':').map(Number);
          
          if (weeklyDays.length > 0) {
            const now = new Date();
            const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
            const todayDay = daysOfWeek[now.getDay()];
            
            weeklyDays.forEach(day => {
              const dayIndex = daysOfWeek.indexOf(day.toLowerCase());
              if (dayIndex !== -1) {
                let daysUntil = (dayIndex - now.getDay() + 7) % 7;
                if (daysUntil === 0 && now.getHours() > hours) {
                  // If it's today but the time has passed, schedule for next week
                  daysUntil = 7;
                }
                
                const scheduledTime = new Date();
                scheduledTime.setDate(scheduledTime.getDate() + daysUntil);
                scheduledTime.setHours(hours, minutes, 0, 0);
                
                const delayInMinutes = (scheduledTime - now) / (1000 * 60);
                
                chrome.alarms.create(`sourcebottle-${day}-check`, {
                  delayInMinutes: delayInMinutes,
                  periodInMinutes: 7 * 24 * 60 // Weekly
                });
                
                console.log(`Weekly alarm for ${day} scheduled at ${weeklyTime}, in ${delayInMinutes.toFixed(2)} minutes`);
              }
            });
          }
        }
      }
    });
  },

  /**
   * Add listener for alarm events
   */
  addAlarmListener: function() {
    chrome.alarms.onAlarm.addListener((alarm) => {
      if (alarm.name.startsWith('sourcebottle')) {
        console.log(`Alarm triggered: ${alarm.name}`);
        this.checkForNewOpportunities();
      }
    });
  },

  /**
   * Check for new opportunities by running scrape
   */
  checkForNewOpportunities: function() {
    chrome.storage.local.get(['settings'], (result) => {
      const settings = result.settings || {};
      const notifications = settings.notifications || {};
      
      // Check if we're in quiet hours
      if (this.isInQuietHours(notifications)) {
        console.log('In quiet hours, skipping notification check');
        return;
      }
      
      // Get the default category to check from settings
      const defaultCategory = settings.defaultCategory || '63'; // Default to General
      
      // Get current opportunities to compare for new ones
      chrome.storage.local.get(['sourceBottleOpportunities'], (result) => {
        const currentOpportunities = result.sourceBottleOpportunities || [];
        const currentIds = new Set(currentOpportunities.map(op => op.id));
        
        // Run a scrape job for the default category
        this.scrapeCategory(defaultCategory, (newOpportunities) => {
          if (newOpportunities && newOpportunities.length > 0) {
            // Filter out truly new opportunities
            const brandNewOpportunities = newOpportunities.filter(op => !currentIds.has(op.id));
            
            if (brandNewOpportunities.length > 0) {
              this.sendNotifications(brandNewOpportunities);
              
              // Merge with existing opportunities
              const updatedOpportunities = [...brandNewOpportunities, ...currentOpportunities];
              chrome.storage.local.set({ sourceBottleOpportunities: updatedOpportunities });
            }
          }
        });
      });
    });
  },

  /**
   * Check if current time is within quiet hours
   */
  isInQuietHours: function(notifications) {
    if (!notifications.quietHoursEnabled) return false;
    
    const quietStart = notifications.quietHoursStart || '22:00';
    const quietEnd = notifications.quietHoursEnd || '07:00';
    
    const [startHours, startMinutes] = quietStart.split(':').map(Number);
    const [endHours, endMinutes] = quietEnd.split(':').map(Number);
    
    const now = new Date();
    const currentHours = now.getHours();
    const currentMinutes = now.getMinutes();
    
    // Convert all times to minutes for easier comparison
    const currentTimeInMinutes = currentHours * 60 + currentMinutes;
    const startTimeInMinutes = startHours * 60 + startMinutes;
    const endTimeInMinutes = endHours * 60 + endMinutes;
    
    // Handle case where quiet hours span midnight
    if (startTimeInMinutes > endTimeInMinutes) {
      return currentTimeInMinutes >= startTimeInMinutes || currentTimeInMinutes <= endTimeInMinutes;
    } else {
      return currentTimeInMinutes >= startTimeInMinutes && currentTimeInMinutes <= endTimeInMinutes;
    }
  },

  /**
   * Scrape a specific category
   */
  scrapeCategory: function(categoryId, callback) {
    // Send message to background script to perform the scrape
    chrome.runtime.sendMessage({
      action: 'scrapeSourceBottleCategory',
      categoryId: categoryId
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('Error scraping category:', chrome.runtime.lastError);
        callback([]);
        return;
      }
      
      if (response && response.success) {
        callback(response.opportunities);
      } else {
        console.error('Error scraping category:', response.error);
        callback([]);
      }
    });
  },

  /**
   * Send notifications for new opportunities
   */
  sendNotifications: function(opportunities) {
    chrome.storage.local.get(['settings'], (result) => {
      const settings = result.settings || {};
      const notifications = settings.notifications || {};
      
      // Get user interests for relevance filtering
      const userInterests = settings.interests || [];
      
      // Filter opportunities by relevance if requested
      let notificationOpportunities = opportunities;
      
      if (notifications.relevanceFilter && userInterests.length > 0) {
        // Use AI service if available to determine relevance
        if (window.aiService && window.aiService.isEnabled()) {
          window.aiService.processOpportunities(opportunities)
            .then(processedOps => {
              const relevantOpps = processedOps.filter(op => 
                op.relevanceScore && op.relevanceScore >= 0.7
              );
              
              this.createNotifications(relevantOpps);
            })
            .catch(err => {
              console.error('Error processing opportunities for notifications:', err);
              this.createNotifications(opportunities.slice(0, 3)); // Fallback to first 3
            });
        } else {
          // Simple keyword matching as fallback
          const matchingOps = opportunities.filter(op => {
            const content = `${op.title} ${op.description}`.toLowerCase();
            return userInterests.some(interest => 
              content.includes(interest.toLowerCase())
            );
          });
          
          notificationOpportunities = matchingOps.length > 0 ? matchingOps : opportunities.slice(0, 3);
          this.createNotifications(notificationOpportunities);
        }
      } else {
        // Just show the first few opportunities
        this.createNotifications(opportunities.slice(0, 3));
      }
    });
  },

  /**
   * Create Chrome notifications
   */
  createNotifications: function(opportunities) {
    // Limit to 3 notifications at most
    opportunities = opportunities.slice(0, 3);
    
    if (opportunities.length === 0) return;
    
    // Show a summary notification if there are multiple
    if (opportunities.length > 1) {
      chrome.notifications.create('sourcebottle-new-opportunities', {
        type: 'basic',
        iconUrl: 'icons/icon128.png',
        title: 'New SourceBottle Opportunities',
        message: `${opportunities.length} new opportunities found. Click to view.`,
        priority: 1
      });
    } else {
      // Show details for a single opportunity
      const opportunity = opportunities[0];
      chrome.notifications.create(`sourcebottle-opportunity-${opportunity.id || Date.now()}`, {
        type: 'basic',
        iconUrl: 'icons/icon128.png',
        title: opportunity.title || 'New Opportunity',
        message: opportunity.description ? opportunity.description.substring(0, 100) + '...' : 'Click to view details',
        priority: 1
      });
    }
    
    // Add notification click listener if not already added
    if (!this.notificationListenerAdded) {
      chrome.notifications.onClicked.addListener((notificationId) => {
        if (notificationId.startsWith('sourcebottle')) {
          chrome.tabs.create({ url: 'opportunities.html' });
        }
      });
      this.notificationListenerAdded = true;
    }
  }
};

// Export the module
export default NotificationService;
