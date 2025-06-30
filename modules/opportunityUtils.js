/**
 * Utility functions for working with opportunities
 */

/**
 * Format a date string for display
 * @param {string} dateString - ISO date string
 * @returns {string} - Formatted date
 */
function formatDate(dateString) {
  if (!dateString) return 'Deadline: Not specified';
  
  // If the dateString is 'Not specified' or similar, pass it through
  if (typeof dateString === 'string' && 
      (dateString.toLowerCase().includes('not specified') ||
       dateString.toLowerCase().includes('no deadline'))) {
    return `Deadline: ${dateString}`;
  }
  
  try {
    // Handle SourceBottle date formats specifically first
    if (typeof dateString === 'string') {
      // Common SourceBottle format: "24 April 2025" or "30 April 2025 @ 5pm"
      const sbDatePattern = /(\d+)\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})(?:\s+@\s+(\d+)(?::\d+)?\s*(am|pm)?)?/i;
      const sbMatch = dateString.match(sbDatePattern);
      
      if (sbMatch) {
        console.log('Found SourceBottle date format:', dateString);
        const day = parseInt(sbMatch[1], 10);
        const month = sbMatch[2];
        const year = parseInt(sbMatch[3], 10);
        
        // Create a proper date string that JavaScript can parse
        const standardDate = new Date(`${day} ${month} ${year}`);
        
        // Check if this created a valid date
        if (!isNaN(standardDate.getTime())) {
          // Add time if available
          if (sbMatch[4]) {
            let hour = parseInt(sbMatch[4], 10);
            const isPM = sbMatch[5]?.toLowerCase() === 'pm';
            
            // Adjust for PM
            if (isPM && hour < 12) {
              hour += 12;
            }
            
            standardDate.setHours(hour, 0, 0, 0);
          }
          
          return standardDate.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          });
        }
      }
      
      // Try other common date formats
      // MM/DD/YYYY format
      const slashDatePattern = /(\d{1,2})\/(\d{1,2})\/(\d{2,4})/;
      const slashMatch = dateString.match(slashDatePattern);
      if (slashMatch) {
        const month = parseInt(slashMatch[1], 10) - 1; // JS months are 0-based
        const day = parseInt(slashMatch[2], 10);
        let year = parseInt(slashMatch[3], 10);
        
        // Handle 2-digit years
        if (year < 100) {
          year += year < 50 ? 2000 : 1900;
        }
        
        const parsedDate = new Date(year, month, day);
        if (!isNaN(parsedDate.getTime())) {
          return parsedDate.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          });
        }
      }
      
      // If the string contains words like "weeks", "days", etc., it might be a relative deadline
      if (dateString.match(/\b(day|days|week|weeks|month|months)\b/i)) {
        return dateString; // Return as is, it's likely a description like "2 weeks from now"
      }
    }
    
    // Try standard date parsing as fallback
    const date = new Date(dateString);
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      // Return the original string if it's not parseable but seems descriptive
      if (typeof dateString === 'string' && dateString.length > 3) {
        return dateString;
      }
      return 'See details';
    }
    
    // If date is valid, format it
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (e) {
    console.error('Error formatting date:', e);
    return 'See details';
  }
}

/**
 * Get priority badge HTML
 * @param {string} priority - Priority level (high/medium/low)
 * @returns {string} - HTML for the badge
 */
function getPriorityBadge(priority) {
  const priorityClasses = {
    high: 'bg-red-100 text-red-800',
    medium: 'bg-yellow-100 text-yellow-800',
    low: 'bg-gray-100 text-gray-800'
  };
  
  const className = priorityClasses[priority.toLowerCase()] || 'bg-gray-100 text-gray-800';
  return `<span class="px-2 py-1 text-xs font-semibold rounded-full ${className}">
    ${priority.charAt(0).toUpperCase() + priority.slice(1)} Priority
  </span>`;
}

/**
 * Get relevance score indicator HTML
 * @param {number} score - Relevance score (0-1)
 * @returns {string} - HTML for the score indicator
 */
function getScoreIndicator(score) {
  const percentage = Math.round(score * 100);
  let colorClass = 'bg-red-500';
  
  if (score >= 0.7) colorClass = 'bg-green-500';
  else if (score >= 0.4) colorClass = 'bg-yellow-500';
  
  return `
    <div class="w-full bg-gray-200 rounded-full h-2.5">
      <div class="h-2.5 rounded-full ${colorClass}" 
           style="width: ${percentage}%">
      </div>
    </div>
    <div class="text-xs text-gray-500 mt-1">Relevance: ${percentage}%</div>
  `;
}

/**
 * Get HTML for key themes
 * @param {Array} themes - Array of theme strings
 * @returns {string} - HTML for the themes
 */
function getThemesHtml(themes = []) {
  if (!themes.length) return '';
  
  return `
    <div class="mt-2">
      <div class="text-xs font-medium text-gray-500 mb-1">Key Themes:</div>
      <div class="flex flex-wrap gap-1">
        ${themes.slice(0, 5).map(theme => 
          `<span class="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">
            ${theme}
          </span>`
        ).join('')}
      </div>
    </div>
  `;
}

/**
 * Get HTML for AI analysis section
 * @param {Object} analysis - AI analysis object
 * @returns {string} - HTML for the analysis section
 */
function getAnalysisHtml(analysis) {
  if (!analysis) return '';
  
  // Generate sentiment display if sentiment data exists
  let sentimentHtml = '';
  if (analysis.sentiment) {
    const { emoji, label, score } = getSentimentInfo(analysis.sentiment);
    const indicators = analysis.sentiment.key_emotional_indicators || [];
    
    sentimentHtml = `
      <div class="mt-3 p-2 rounded-lg sentiment-section ${label}">
        <div class="flex items-center">
          <span class="text-lg mr-2">${emoji}</span>
          <span class="font-medium text-sm capitalize">${label} Sentiment</span>
          <span class="ml-auto text-xs bg-gray-200 px-2 py-1 rounded">${score}%</span>
        </div>
        ${indicators.length > 0 ? `
          <div class="mt-2">
            <div class="text-xs font-medium text-gray-500 mb-1">Emotional Indicators:</div>
            <div class="flex flex-wrap gap-1">
              ${indicators.slice(0, 3).map(indicator => 
                `<span class="px-2 py-1 text-xs bg-gray-100 text-gray-800 rounded-full">
                  ${indicator}
                </span>`
              ).join('')}
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }
  
  return `
    <div class="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
      <div class="flex items-center justify-between mb-2">
        <h4 class="font-medium text-gray-700">AI Analysis</h4>
        ${getPriorityBadge(analysis.priority || 'low')}
      </div>
      
      ${analysis.reasoning ? `
        <div class="text-sm text-gray-700 mb-2">
          ${analysis.reasoning}
        </div>
      ` : ''}
      
      ${getScoreIndicator(analysis.relevance_score || 0)}
      ${getThemesHtml(analysis.key_themes || [])}
      ${sentimentHtml}
      
      ${analysis.confidence ? `
        <div class="mt-2 text-xs text-gray-500">
          Confidence: ${Math.round((analysis.confidence || 0) * 100)}%
        </div>
      ` : ''}
    </div>
  `;
}

/**
 * Get sentiment information based on sentiment analysis results
 * @param {Object} sentiment - Sentiment analysis object from AI service
 * @returns {Object} - Object with emoji, color, and label for the sentiment
 */
function getSentimentInfo(sentiment) {
  if (!sentiment) {
    return { emoji: '😐', color: '#6c757d', label: 'neutral', score: 50 };
  }
  
  // Extract the sentiment label and score
  const label = sentiment.label ? sentiment.label.toLowerCase() : 'neutral';
  const score = sentiment.score ? Math.round(sentiment.score * 100) : 50;
  
  // Map sentiment labels to emojis and colors
  const sentimentMap = {
    positive: { emoji: '😊', color: '#28a745' },
    negative: { emoji: '😟', color: '#dc3545' },
    neutral: { emoji: '😐', color: '#6c757d' },
    mixed: { emoji: '😕', color: '#fd7e14' },
    very_positive: { emoji: '😄', color: '#20c997' },
    very_negative: { emoji: '😠', color: '#dc3545' }
  };
  
  // Get the mapping or default to neutral
  const mapping = sentimentMap[label] || sentimentMap.neutral;
  
  return {
    emoji: mapping.emoji,
    color: mapping.color,
    label: label,
    score: score
  };
}

/**
 * Generate HTML for displaying sentiment in the opportunity card
 * @param {Object} sentiment - Sentiment analysis object from AI service
 * @returns {string} - HTML for sentiment display
 */
function getSentimentDisplay(sentiment) {
  if (!sentiment) return '';
  
  const { emoji, label, score } = getSentimentInfo(sentiment);
  
  return `
    <div class="sentiment-badge ${label}" title="Sentiment: ${label.charAt(0).toUpperCase() + label.slice(1)} (${score}%)">
      <span class="sentiment-emoji">${emoji}</span>
    </div>
  `;
}

/**
 * Get HTML for an opportunity card
 * @param {Object} opportunity - Opportunity object
 * @returns {string} - HTML for the card
 */
function getOpportunityCardHtml(opportunity) {
  const { title, description, deadline, mediaOutlet, url, ai_analysis } = opportunity;
  
  // Always use our reliable formatDate function
  let formattedDeadline = formatDate(deadline);
  
  // Extract sentiment information if available
  let sentimentHtml = '';
  if (ai_analysis && ai_analysis.sentiment) {
    const { emoji, label } = getSentimentInfo(ai_analysis.sentiment);
    sentimentHtml = `
      <span class="inline-flex items-center ml-2 px-2 py-0.5 rounded-full text-xs font-medium sentiment-tag ${label}" 
            title="Sentiment: ${label.charAt(0).toUpperCase() + label.slice(1)}">
        ${emoji}
      </span>
    `;
  }
  
  return `
    <div class="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
      <div class="p-4">
        <div class="flex justify-between items-start">
          <h3 class="text-lg font-medium text-gray-900 mb-1 flex items-center">
            <a href="${url || '#'}" target="_blank" class="hover:underline">
              ${title || 'Untitled Opportunity'}
            </a>
            ${sentimentHtml}
          </h3>
          ${mediaOutlet ? `
            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
              ${mediaOutlet}
            </span>
          ` : ''}
        </div>
        
        <div class="mt-1 text-sm text-gray-600">
          ${description || 'No description available'}
        </div>
        
        <div class="mt-2 flex items-center text-xs text-gray-700 font-medium">
          <span class="mr-1">📅</span> ${deadline ? formattedDeadline : 'Deadline: Not specified'}
        </div>
        
        ${getAnalysisHtml(ai_analysis)}
      </div>
    </div>
  `;
}

// Export utils to window context for use across components
window.opportunityUtils = {
  formatDate,
  formatDeadline: formatDate, // Alias for backwards compatibility
  getSentimentDisplay, // Export for potential reuse
  getSentimentInfo, // Export the sentiment helper function
  getPriorityBadge,
  getScoreIndicator,
  getThemesHtml,
  getAnalysisHtml,
  getOpportunityCardHtml
};
