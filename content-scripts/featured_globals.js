/**
 * Featured Global Initializer
 * 
 * This script initializes global objects required for the Featured.com scraper
 * It's loaded before the launcher to ensure all dependencies are available
 */

// Create global logger
window.logManager = window.logManager || {
  log: (msg) => console.log('🔍 [FEATURED LOG]', msg),
  debug: (msg) => console.debug('🔍 [FEATURED DEBUG]', msg),
  error: (msg, err) => console.error('🔍 [FEATURED ERROR]', msg, err)
};

// Create global BaseScraper class
window.BaseScraper = class BaseScraper {
  constructor(name, options = {}) {
    this.name = name;
    this.options = options;
    this.debug = options.debug || false;
    this.debugLog(`BaseScraper ${this.name} initialized`);
  }
  
  debugLog(message) {
    if (this.debug) {
      window.logManager.debug(`[${this.name}] ${message}`);
    }
  }
  
  extractText(element, selector) {
    try {
      const targetEl = typeof element.querySelector === 'function' ? 
        element.querySelector(selector) : document.querySelector(selector);
      return targetEl ? targetEl.textContent.trim() : '';
    } catch (error) {
      this.debugLog(`Error extracting text with selector "${selector}": ${error.message}`);
      return '';
    }
  }
  
  // Add notification methods
  showNotification(message, type = 'info') {
    console.log(`🔔 [${this.name}] ${message}`);
  }
  
  // Add methods for scraping
  initialize() { return true; }
  detect() { return true; }
  hydrate() { return Promise.resolve(true); }
  parse() { return []; }
  persist() { return Promise.resolve(true); }
  
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
};

// Create global scrapers registry
window.scrapers = window.scrapers || {
  registry: new Map(),
  
  register(name, scraper) {
    if (!this.registry.has(name)) {
      this.registry.set(name, scraper);
      console.log(`🔍 [FEATURED DEBUG] Registered scraper: ${name}`);
      return true;
    }
    return false;
  },
  
  isRegistered(name) {
    return this.registry.has(name);
  },
  
  get(name) {
    return this.registry.get(name);
  }
};

// Create global notification helper
window.scraperNotification = window.scraperNotification || {
  notification: null,
  progressBar: null,
  currentProgress: 0,
  status: 'idle',
  
  // Show notification UI
  show(source = 'featured') {
    console.log('🔍 [FEATURED DEBUG] Creating notification UI');
    
    // Create notification container if it doesn't exist
    if (!this.notification) {
      this.notification = document.createElement('div');
      this.notification.style.position = 'fixed';
      this.notification.style.zIndex = '9999';
      this.notification.style.bottom = '20px';
      this.notification.style.right = '20px';
      this.notification.style.padding = '10px 20px';
      this.notification.style.backgroundColor = '#ff9800'; // Featured orange
      this.notification.style.color = 'white';
      this.notification.style.borderRadius = '5px';
      this.notification.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.2)';
      this.notification.style.transition = 'all 0.3s';
      this.notification.style.fontSize = '14px';
      this.notification.style.maxWidth = '300px';
      this.notification.style.display = 'flex';
      this.notification.style.flexDirection = 'column';
      this.notification.style.gap = '10px';
      document.body.appendChild(this.notification);
    }
    
    // Show the notification
    this.update({ message: `Initializing ${source} scraper...` });
    return this.notification;
  },
  
  create(options) {
    return this.show(options.source || 'featured');
  },
  
  // Update notification content and appearance
  update(options) {
    if (!this.notification) return;
    
    // Update message
    if (options.message) {
      this.notification.innerHTML = `
        <div>${options.message || 'Processing...'}</div>
        ${this.progressBar ? '' : '<div class="progress-container" style="height: 4px; background-color: rgba(255,255,255,0.3); margin-top: 5px;"></div>'}
      `;
      
      // Re-add progress bar if it was removed
      if (!this.progressBar && this.notification.querySelector('.progress-container')) {
        const container = this.notification.querySelector('.progress-container');
        this.progressBar = document.createElement('div');
        this.progressBar.style.height = '100%';
        this.progressBar.style.backgroundColor = 'white';
        this.progressBar.style.width = `${this.currentProgress}%`;
        this.progressBar.style.transition = 'width 0.3s';
        container.appendChild(this.progressBar);
      }
    }
    
    // Update status/color
    if (options.status) {
      this.status = options.status;
      switch(options.status) {
        case 'running':
          this.notification.style.backgroundColor = '#ff9800'; // Orange
          break;
        case 'success':
          this.notification.style.backgroundColor = '#4CAF50'; // Green
          break;
        case 'error':
          this.notification.style.backgroundColor = '#F44336'; // Red
          break;
        case 'warning':
          this.notification.style.backgroundColor = '#FFC107'; // Amber
          break;
        default:
          this.notification.style.backgroundColor = '#ff9800'; // Default orange
      }
    }
    
    // If color is explicitly set, it overrides status color
    if (options.color) {
      this.notification.style.backgroundColor = options.color;
    }
  },
  
  // Update progress bar
  updateProgress(percent) {
    this.currentProgress = percent;
    if (this.progressBar) {
      this.progressBar.style.width = `${percent}%`;
    }
  }
};

console.log('🔍 [FEATURED DEBUG] Global objects initialized!');
console.log('🔍 [FEATURED DEBUG] Current URL:', window.location.href);
