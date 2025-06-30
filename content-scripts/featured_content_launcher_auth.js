/**
 * Featured.com Content Launcher (Authentication-Aware)
 *
 * This content script is injected into Featured.com pages matching the manifest patterns.
 * It detects when the page is ready, checks authentication status, and loads the appropriate scraper module.
 *
 * Enhanced version that provides clear feedback about authentication requirements
 */

console.log('🔍 [FEATURED DEBUG] Auth-aware content launcher loaded - ' + new Date().toISOString());
console.log('🔍 [FEATURED DEBUG] URL:', window.location.href);
console.log('🔍 [FEATURED DEBUG] Document state:', document.readyState);

// Create a minimal notification element for immediate feedback
const quickNotification = document.createElement('div');
quickNotification.style.cssText = `
  position: fixed;
  bottom: 20px;
  right: 20px;
  background-color: #ff9800;
  color: white;
  padding: 10px 15px;
  border-radius: 4px;
  font-family: Arial, sans-serif;
  z-index: 9999;
  box-shadow: 0 2px 5px rgba(0,0,0,0.2);
  font-size: 14px;
  transition: opacity 0.3s ease;
`;
quickNotification.textContent = '🔍 Featured.com scraper initializing...';
document.body.appendChild(quickNotification);

// Hide the notification after 5 seconds if no other actions occur
setTimeout(() => {
  quickNotification.style.opacity = '0';
  setTimeout(() => {
    if (document.body.contains(quickNotification)) {
      document.body.removeChild(quickNotification);
    }
  }, 500);
}, 5000);

// Execute main logic when DOM is fully loaded
document.addEventListener('DOMContentLoaded', function() {
  console.log('🔍 [FEATURED DEBUG] DOM loaded event fired');
  console.log('🔍 [FEATURED DEBUG] Page title:', document.title);
  initializeScraper();
});

// Also try to initialize if we're loaded after DOM is already ready
if (document.readyState === 'interactive' || document.readyState === 'complete') {
  console.log('🔍 [FEATURED DEBUG] DOM already loaded, state:', document.readyState);
  console.log('🔍 [FEATURED DEBUG] Initializing immediately');
  initializeScraper();
}

/* global chrome */

/**
 * Check if the user is authenticated on Featured.com
 * @returns {boolean} True if authenticated, false otherwise
 */
function checkAuthenticationStatus() {
  try {
    // Check for login form or login-related elements
    const loginForm = document.querySelector('form input[type="password"], .login-form, form.signin, .auth-form, #login');
    
    // Look for login-related text in headers
    const headers = document.querySelectorAll('h1, h2, h3');
    let hasLoginHeader = false;
    
    headers.forEach(header => {
      const text = header.textContent.toLowerCase();
      if (text.includes('log in') || text.includes('sign in') || text.includes('login') || 
          text.includes('account') || text.includes('join')) {
        hasLoginHeader = true;
      }
    });
    
    // Check page title
    const pageTitle = document.title.toLowerCase();
    const titleIndicatesLogin = pageTitle.includes('log in') || 
                               pageTitle.includes('sign in') || 
                               pageTitle.includes('login') ||
                               pageTitle.includes('account');
    
    // Combine all checks
    const isAuthenticated = !(loginForm || hasLoginHeader || titleIndicatesLogin);
    
    console.log('🔍 [FEATURED DEBUG] Authentication check result:', isAuthenticated ? 'Authenticated' : 'Not authenticated');
    return isAuthenticated;
  } catch (error) {
    console.error('🔍 [FEATURED DEBUG] Authentication check error:', error);
    return false;
  }
}

/**
 * Display authentication guidance notification
 */
function showAuthenticationNotification() {
  // Remove any existing notification first
  const existingNotification = document.getElementById('featured-auth-notification');
  if (existingNotification) {
    document.body.removeChild(existingNotification);
  }

  // Create a prominent notification
  const authNotification = document.createElement('div');
  authNotification.id = 'featured-auth-notification';
  authNotification.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    background-color: #f8d7da;
    color: #721c24;
    padding: 15px 20px;
    border-radius: 5px;
    box-shadow: 0 0 10px rgba(0,0,0,0.2);
    max-width: 400px;
    text-align: center;
    z-index: 10000;
    font-family: Arial, sans-serif;
  `;
  
  authNotification.innerHTML = `
    <h3 style="margin-top: 0;">Authentication Required</h3>
    <p>The SourceBottle Featured scraper needs you to login to access questions:</p>
    <ol style="text-align: left; padding-left: 20px;">
      <li>Sign in to your Featured.com account</li>
      <li>Once logged in, the scraper will activate automatically</li>
    </ol>
    <button id="close-auth-notification" style="padding: 8px 16px; margin-top: 10px; cursor: pointer; background-color: #721c24; color: white; border: none; border-radius: 4px;">Close</button>
  `;
  
  document.body.appendChild(authNotification);
  
  // Add close button functionality
  document.getElementById('close-auth-notification').addEventListener('click', () => {
    document.body.removeChild(authNotification);
  });
  
  console.log('🔍 [FEATURED DEBUG] Displayed authentication required notification');
}

/**
 * Initialize the scraper without dynamic imports (CSP compliant)
 */
async function initializeScraper() {
  try {
    console.log('🔍 [FEATURED DEBUG] Initializing Featured.com scraper...');
    console.log('🔍 [FEATURED DEBUG] Current URL:', window.location.href);
    console.log('🔍 [FEATURED DEBUG] Pathname:', window.location.pathname);
    
    // Use global logManager injected from script tags in proper order
    console.log('🔍 [FEATURED DEBUG] Using global logManager...');
    let logManager;
    if (window.logManager) {
      logManager = window.logManager;
      console.log('🔍 [FEATURED DEBUG] Found global logManager');
    } else {
      console.error('🔍 [FEATURED DEBUG] Global logManager not found');
      // Create fallback logger
      logManager = {
        log: (msg) => console.log('🔍 [FEATURED FALLBACK]', msg),
        debug: (msg) => console.debug('🔍 [FEATURED FALLBACK]', msg),
        error: (msg, err) => console.error('🔍 [FEATURED FALLBACK]', msg, err)
      };
    }
    
    // Access the scrapers module from the global window object (loaded via script tag)
    console.log('🔍 [FEATURED DEBUG] Accessing global scrapers module...');
    let scrapers;
    if (window.scrapers) {
      scrapers = window.scrapers;
      console.log('🔍 [FEATURED DEBUG] Found global scrapers module');
    } else {
      console.error('🔍 [FEATURED DEBUG] Global scrapers module not found');
      throw new Error('Failed to access global scrapers module - ensure it is loaded before this script');
    }
    
    // Access the Featured scraper module from the global window object
    console.log('🔍 [FEATURED DEBUG] Accessing global featuredScraper...');
    let featuredScraper;
    if (window.featuredScraper) {
      featuredScraper = window.featuredScraper;
      console.log('🔍 [FEATURED DEBUG] Found global featuredScraper');
    } else {
      console.error('🔍 [FEATURED DEBUG] Global featuredScraper not found');
      throw new Error('Failed to access global featuredScraper - ensure it is loaded before this script');
    }
    
    // Register the scraper if not already registered
    console.log('🔍 [FEATURED DEBUG] Checking if featuredScraper needs registration');
    if (!scrapers.isRegistered('featured')) {
      console.log('🔍 [FEATURED DEBUG] Registering featuredScraper with scrapers registry');
      scrapers.register('featured', featuredScraper);
    }
    
    // Check if we're on a Featured.com questions page - now supports both /questions and /experts/questions
    const onFeaturedHost = location.host.endsWith('featured.com');
    const onQuestionsPage = location.pathname.startsWith('/questions') ||
                           location.pathname.startsWith('/experts/questions');
    
    console.log('🔍 [FEATURED DEBUG] URL check results:', {
      onFeaturedHost,
      onQuestionsPage,
      fullPath: location.pathname
    });
    
    if (onFeaturedHost && onQuestionsPage) {
      logManager.log('On Featured.com questions page, checking authentication');
      console.log('🔍 [FEATURED DEBUG] On correct page, checking authentication');
      
      // Check if the user is authenticated
      const isAuthenticated = checkAuthenticationStatus();
      
      if (!isAuthenticated) {
        console.log('🔍 [FEATURED DEBUG] User is not authenticated, showing guidance');
        showAuthenticationNotification();
        
        // Set up listener for auth state changes (e.g., if user logs in later)
        setupAuthChangeListener();
        return;
      }
      
      // Examine the page structure
      console.log('🔍 [FEATURED DEBUG] Page structure analysis:');
      console.log('🔍 [FEATURED DEBUG] Title:', document.title);
      console.log('🔍 [FEATURED DEBUG] Meta description:', document.querySelector('meta[name="description"]')?.content);
      console.log('🔍 [FEATURED DEBUG] Question elements:', document.querySelectorAll('.question-card, .question-item, [data-testid="question"]').length);
      
      // Initialize with a slight delay to ensure page is fully loaded
      const delay = 1000 + Math.random() * 1000;
      console.log(`🔍 [FEATURED DEBUG] Initializing scraper with ${delay}ms delay`);
      
      setTimeout(() => {
        console.log('🔍 [FEATURED DEBUG] Delay complete, calling featuredScraper.init()');
        featuredScraper.init();
      }, delay);
    } else {
      logManager.log('Not on a Featured.com questions page, skipping scraper initialization');
      console.log('🔍 [FEATURED DEBUG] Not on a questions page, skipping initialization');
    }
  } catch (error) {
    console.error('🔍 [FEATURED DEBUG] Error initializing Featured.com scraper:', error);
    console.error('🔍 [FEATURED DEBUG] Error stack:', error.stack);
  }
}

/**
 * Set up a listener to detect when the authentication state changes
 * This helps if a user logs in while the extension is running
 */
function setupAuthChangeListener() {
  // Create a small observer to watch for URL or DOM changes that might indicate login
  const authCheckInterval = setInterval(() => {
    if (checkAuthenticationStatus()) {
      console.log('🔍 [FEATURED DEBUG] Authentication state changed to authenticated');
      clearInterval(authCheckInterval);
      
      // Hide any auth notifications
      const authNotification = document.getElementById('featured-auth-notification');
      if (authNotification) {
        authNotification.style.opacity = '0';
        setTimeout(() => {
          if (document.body.contains(authNotification)) {
            document.body.removeChild(authNotification);
          }
        }, 500);
      }
      
      // Show success notification
      const successNotification = document.createElement('div');
      successNotification.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background-color: #d4edda;
        color: #155724;
        padding: 15px 20px;
        border-radius: 5px;
        box-shadow: 0 0 10px rgba(0,0,0,0.2);
        z-index: 10000;
        font-family: Arial, sans-serif;
        transition: opacity 0.3s ease;
      `;
      successNotification.textContent = '✓ Authenticated! Initializing Featured scraper...';
      document.body.appendChild(successNotification);
      
      // Initialize scraper now that we're authenticated
      setTimeout(() => {
        initializeScraper();
        
        // Hide success notification after a few seconds
        setTimeout(() => {
          successNotification.style.opacity = '0';
          setTimeout(() => {
            if (document.body.contains(successNotification)) {
              document.body.removeChild(successNotification);
            }
          }, 500);
        }, 3000);
      }, 1000);
    }
  }, 2000); // Check every 2 seconds
  
  // Clear interval after 5 minutes to avoid memory leaks
  setTimeout(() => {
    clearInterval(authCheckInterval);
  }, 5 * 60 * 1000);
}