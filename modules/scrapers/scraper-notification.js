/**
 * Scraper Notification Module
 * 
 * Creates a floating notification UI to provide real-time feedback 
 * during scraping operations across all platforms.
 */

// Create the notification manager class
class ScraperNotificationManager {
  constructor() {
    this.container = null;
    this.isVisible = false;
    this.currentPlatform = null;
    this.startTime = null;
    
    this.stats = {
      totalFound: 0,
      currentPage: 1,
      totalPages: null,
      status: 'idle', // idle, running, success, error
    };
    
    // Platform styling configurations
    this.platformStyles = {
      'sourcebottle': {
        color: '#4b6cb7',
        icon: '📢',
        name: 'SourceBottle'
      },
      'featured': {
        color: '#ff9800',
        icon: '🔍',
        name: 'Featured.com'
      },
      'qwoted': {
        color: '#009688',
        icon: '💬',
        name: 'Qwoted'
      }
    };
    
    // Bind methods
    this.show = this.show.bind(this);
    this.hide = this.hide.bind(this);
    this.update = this.update.bind(this);
    this.updateProgress = this.updateProgress.bind(this);
    this.createNotificationElement = this.createNotificationElement.bind(this);
  }
  
  /**
   * Initialize the notification manager
   */
  initialize() {
    console.log('📢 [SCRAPER-NOTIFICATION] Initializing notification manager');
    // Create the notification container if it doesn't exist
    if (!this.container) {
      this.createNotificationElement();
    }
  }
  
  /**
   * Create the notification element and append to DOM
   */
  createNotificationElement() {
    try {
      console.log('📢 [SCRAPER-NOTIFICATION] Creating notification element');
      
      // Safety check for document and body
      if (!document || !document.body) {
        console.error('📢 [SCRAPER-NOTIFICATION] Document or body not available');
        return;
      }
    
      // Create container if it doesn't exist yet
      this.container = document.createElement('div');
      this.container.id = 'scraper-notification';
      this.container.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background-color: white;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        padding: 15px;
        width: 300px;
        z-index: 99999;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        display: none;
        transition: transform 0.3s ease, opacity 0.3s ease;
        transform: translateY(20px);
        opacity: 0;
      `;
      
      // Create header
      const header = document.createElement('div');
      header.style.cssText = `
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 10px;
        padding-bottom: 10px;
        border-bottom: 1px solid #eee;
      `;
      
      const title = document.createElement('h3');
      title.id = 'notification-title';
      title.style.cssText = `
        margin: 0;
        font-size: 16px;
        font-weight: 600;
      `;
      title.textContent = 'Scraper Status';
      
      const closeButton = document.createElement('button');
      closeButton.style.cssText = `
        background: none;
        border: none;
        cursor: pointer;
        font-size: 16px;
        color: #999;
      `;
      closeButton.textContent = '✕';
      closeButton.addEventListener('click', () => this.hide());
      
      header.appendChild(title);
      header.appendChild(closeButton);
      this.container.appendChild(header);
      
      // Create content
      const content = document.createElement('div');
      content.id = 'notification-content';
      
      // Platform info
      const platformInfo = document.createElement('div');
      platformInfo.style.cssText = `
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 10px;
      `;
      
      const platformIcon = document.createElement('span');
      platformIcon.id = 'platform-icon';
      platformIcon.style.cssText = `
        font-size: 18px;
      `;
      
      const platformName = document.createElement('span');
      platformName.id = 'platform-name';
      platformName.style.cssText = `
        font-weight: 500;
      `;
      
      platformInfo.appendChild(platformIcon);
      platformInfo.appendChild(platformName);
      content.appendChild(platformInfo);
      
      // Progress info
      const progressInfo = document.createElement('div');
      progressInfo.style.cssText = `
        margin-bottom: 15px;
      `;
      
      const statusText = document.createElement('p');
      statusText.id = 'status-text';
      statusText.style.cssText = `
        margin: 0 0 5px 0;
        font-size: 14px;
      `;
      
      const progressBarContainer = document.createElement('div');
      progressBarContainer.style.cssText = `
        height: 6px;
        background-color: #eee;
        border-radius: 3px;
        overflow: hidden;
      `;
      
      const progressBar = document.createElement('div');
      progressBar.id = 'progress-bar';
      progressBar.style.cssText = `
        height: 100%;
        width: 0%;
        background-color: #4361ee;
        transition: width 0.3s ease;
      `;
      
      progressBarContainer.appendChild(progressBar);
      progressInfo.appendChild(statusText);
      progressInfo.appendChild(progressBarContainer);
      content.appendChild(progressInfo);
      
      // Stats info
      const statsInfo = document.createElement('div');
      statsInfo.style.cssText = `
        display: flex;
        justify-content: space-between;
        font-size: 14px;
        margin-bottom: 15px;
      `;
      
      const foundCount = document.createElement('div');
      foundCount.innerHTML = '<strong>Found:</strong> <span id="found-count">0</span>';
      
      const pageCount = document.createElement('div');
      pageCount.innerHTML = '<strong>Page:</strong> <span id="page-count">0</span>';
      
      statsInfo.appendChild(foundCount);
      statsInfo.appendChild(pageCount);
      content.appendChild(statsInfo);
      
      // Navigation button (conditionally shown)
      const navButton = document.createElement('button');
      navButton.id = 'nav-button';
      navButton.style.cssText = `
        width: 100%;
        padding: 8px;
        background-color: #4361ee;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-weight: 500;
        display: none;
        margin-bottom: 8px;
      `;
      navButton.textContent = 'Go to Next Page';
      content.appendChild(navButton);
      
      // Cleanup button (used for Qwoted to fix duplicates)
      const cleanupButton = document.createElement('button');
      cleanupButton.id = 'cleanup-button';
      cleanupButton.style.cssText = `
        width: 100%;
        padding: 8px;
        background-color: #ff9800;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-weight: 500;
        display: none;
        margin-top: 8px;
      `;
      cleanupButton.textContent = 'Clean Duplicates';
      cleanupButton.addEventListener('click', () => {
        if (window.cleanQwotedStorage && typeof window.cleanQwotedStorage === 'function') {
          window.cleanQwotedStorage();
        } else {
          alert('Cleanup function not available');
        }
      });
      content.appendChild(cleanupButton);
      
      // Add content to container
      this.container.appendChild(content);
      
      // Add to document
      document.body.appendChild(this.container);
      console.log('📢 [SCRAPER-NOTIFICATION] Notification element created and added to DOM');
    } catch (error) {
      console.error('📢 [SCRAPER-NOTIFICATION] Error creating notification element:', error);
    }
  }
  
  /**
   * Show the notification for a specific platform
   * @param {string} platform - Platform identifier (sourcebottle, featured, qwoted)
   */
  show(platform) {
    console.log(`📢 [SCRAPER-NOTIFICATION] Showing notification for platform: ${platform}`);
    this.initialize();
    
    // Safety check for container
    if (!this.container) {
      console.error('📢 [SCRAPER-NOTIFICATION] Container not found when showing notification');
      // Try to initialize again
      this.initialize();
      
      // If still no container, abort
      if (!this.container) {
        console.error('📢 [SCRAPER-NOTIFICATION] Failed to create container, aborting show');
        return;
      }
    }
    
    // Reset stats
    this.stats = {
      totalFound: 0,
      currentPage: 1,
      totalPages: null,
      status: 'running',
    };
    
    this.currentPlatform = platform;
    this.startTime = new Date();
    
    // Update styling based on platform
    const style = this.platformStyles[platform] || this.platformStyles.sourcebottle;
    
    try {
      // Set platform info
      const platformIcon = document.getElementById('platform-icon');
      const platformName = document.getElementById('platform-name');
      const progressBar = document.getElementById('progress-bar');
      
      if (platformIcon) platformIcon.textContent = style.icon;
      if (platformName) platformName.textContent = style.name;
      if (progressBar) progressBar.style.backgroundColor = style.color;
      
      // Update status
      const statusText = document.getElementById('status-text');
      const foundCount = document.getElementById('found-count');
      const pageCount = document.getElementById('page-count');
      
      if (statusText) statusText.textContent = `Initializing ${style.name} scraper...`;
      if (foundCount) foundCount.textContent = '0';
      if (pageCount) pageCount.textContent = '1';
    } catch (error) {
      console.error('📢 [SCRAPER-NOTIFICATION] Error updating notification elements:', error);
    }
    
    // Show the notification with explicit styles to ensure visibility
    this.container.style.display = 'block';
    
    // Force browser to acknowledge the style change before changing transform and opacity
    setTimeout(() => {
      this.container.style.transform = 'translateY(0)';
      this.container.style.opacity = '1';
      console.log('📢 [SCRAPER-NOTIFICATION] Notification displayed');
    }, 10);
    
    this.isVisible = true;
  }
  
  /**
   * Hide the notification
   */
  hide() {
    if (!this.container) return;
    
    this.container.style.transform = 'translateY(20px)';
    this.container.style.opacity = '0';
    
    setTimeout(() => {
      this.container.style.display = 'none';
      this.isVisible = false;
    }, 300);
  }
  
  /**
   * Update notification with new information
   * @param {Object} data - Updated information
   */
  update(data = {}) {
    if (!this.isVisible || !this.container) return;
    
    // Update stats with new data
    Object.assign(this.stats, data);
    
    // Update UI elements
    if (data.totalFound !== undefined) {
      document.getElementById('found-count').textContent = data.totalFound;
    }
    
    if (data.currentPage !== undefined) {
      document.getElementById('page-count').textContent = 
        data.totalPages ? `${data.currentPage}/${data.totalPages}` : data.currentPage;
    }
    
    if (data.status) {
      const statusText = document.getElementById('status-text');
      
      switch (data.status) {
        case 'running':
          statusText.textContent = `Scraping ${this.platformStyles[this.currentPlatform].name}...`;
          break;
        case 'page_complete':
          statusText.textContent = `Completed page ${data.currentPage}`;
          break;
        case 'success':
          statusText.textContent = `Successfully found ${data.totalFound} opportunities`;
          // Show success styling
          document.getElementById('progress-bar').style.width = '100%';
          setTimeout(() => {
            this.hide();
          }, 3000);
          break;
        case 'error':
          statusText.textContent = data.message || 'Error during scraping';
          // Show error styling
          document.getElementById('progress-bar').style.backgroundColor = '#e63946';
          break;
        default:
          statusText.textContent = data.message || `Scraping ${this.platformStyles[this.currentPlatform].name}...`;
      }
    }
    
    // Show/hide navigation button
    const navButton = document.getElementById('nav-button');
    if (data.needsNavigation) {
      navButton.style.display = 'block';
      navButton.textContent = data.navButtonText || 'Go to Next Page';
      
      // Clear previous listener and add new one
      const newNavButton = navButton.cloneNode(true);
      navButton.parentNode.replaceChild(newNavButton, navButton);
      
      if (data.navCallback && typeof data.navCallback === 'function') {
        newNavButton.addEventListener('click', data.navCallback);
      }
    } else {
      navButton.style.display = 'none';
    }
    
    // Show cleanup button for Qwoted platform
    const cleanupButton = document.getElementById('cleanup-button');
    if (this.currentPlatform === 'qwoted' && data.status === 'success') {
      cleanupButton.style.display = 'block';
    } else if (data.showCleanupButton) {
      cleanupButton.style.display = 'block';
    } else {
      cleanupButton.style.display = 'none';
    }
  }
  
  /**
   * Update progress bar
   * @param {number} percent - Progress percentage (0-100)
   */
  updateProgress(percent) {
    if (!this.isVisible || !this.container) return;
    
    document.getElementById('progress-bar').style.width = `${percent}%`;
  }
}

// Create singleton instance
const scraperNotification = new ScraperNotificationManager();

// For Chrome Extension compatibility - expose as global
if (typeof window !== 'undefined') {
  window.scraperNotification = scraperNotification;
}

// Also export using ES modules for compatibility with import statements
export { scraperNotification };
export default scraperNotification;