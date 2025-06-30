// Safe script loader for opportunities.js and its dependencies
(function() {
  // First load the AI service
  const aiServiceScript = document.createElement('script');
  aiServiceScript.src = chrome.runtime.getURL('services/ai-service.js');
  aiServiceScript.type = 'text/javascript';
  
  // After AI service loads, load the opportunities.js
  aiServiceScript.onload = function() {
    const opportunitiesScript = document.createElement('script');
    opportunitiesScript.src = chrome.runtime.getURL('opportunities.js');
    opportunitiesScript.type = 'text/javascript';
    (document.head || document.documentElement).appendChild(opportunitiesScript);
    
    // Clean up after load
    opportunitiesScript.onload = function() {
      opportunitiesScript.remove();
    };
  };
  
  // Add the AI service script to the page
  (document.head || document.documentElement).appendChild(aiServiceScript);
})();
