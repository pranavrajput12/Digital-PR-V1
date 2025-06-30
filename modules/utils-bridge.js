/**
 * Utils Bridge Module
 * Provides utility functions for opportunities page and other components
 */

// Create an utilities object to export
const opportunityUtils = {
  /**
   * Format deadline for display
   * @param {string|Date} deadline - The deadline to format
   * @returns {string} - Formatted deadline string
   */
  formatDeadline: function(deadline) {
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
  },
  
  /**
   * Get opportunity card HTML
   * @param {Object} opp - The opportunity object
   * @returns {string} - HTML for the opportunity card
   */
  getOpportunityCardHtml: function(opp) {
    // Get core properties with fallbacks
    const title = opp.title || 'No Title';
    const description = opp.description || 'No description provided.';
    const category = opp.category || 'General';
    const categoryClass = category.toLowerCase().replace(/\s+/g, '-');
    const source = opp.source || 'SourceBottle';
    
    // Handle all possible URL field names
    const submissionLink = opp.submissionLink || opp.link || opp.url || opp.callUrl || '#';
    
    // Handle optional fields
    const mediaOutlet = opp.mediaOutlet || '';
    const journalist = opp.journalist || '';
    
    // Format the deadline
    const formattedDate = this.formatDeadline(this.getDeadlineValue(opp));
    
    // Support both ai_analysis and aiAnalysis property names
    const aiAnalysis = opp.aiAnalysis || opp.ai_analysis;
    const hasAiAnalysis = aiAnalysis && typeof aiAnalysis === 'object';
    
    // Generate relevance badge
    const relevanceBadge = this.generateRelevanceBadge(opp, hasAiAnalysis, aiAnalysis);
    
    // Generate keywords HTML
    const keywordsHtml = this.generateKeywordsHtml(opp, hasAiAnalysis);
    
    // Generate AI badge
    const aiBadge = hasAiAnalysis ? `
      <div class="ai-badge" data-id="${opp.id || ''}">
        <i class="fas fa-robot"></i> AI Analyzed
      </div>
    ` : '';
    
    // Generate unique ID
    const opportunityId = opp.id || `opp-${Date.now()}`;
    
    // Build card HTML
    return `
      <div class="opportunity-card" data-opportunity-id="${opportunityId}">
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
      </div>
    `;
  },
  
  /**
   * Generate relevance badge HTML
   * @param {Object} opp - The opportunity object
   * @param {boolean} hasAiAnalysis - Whether the opportunity has AI analysis
   * @param {Object} aiAnalysis - The AI analysis object
   * @returns {string} HTML for the relevance badge
   */
  generateRelevanceBadge: function(opp, hasAiAnalysis, aiAnalysis) {
    if (hasAiAnalysis) {
      // Support both property naming conventions
      const relevanceScore = aiAnalysis.relevanceScore || aiAnalysis.relevance_score;
      const priority = aiAnalysis.priority || 'medium';
      
      if (relevanceScore !== undefined) {
        const score = Math.round(relevanceScore * 100);
        const relevanceClass = priority;
        
        return `
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
      
      return `<div class="relevance-badge ${relevanceClass}">${score}% Match</div>`;
    }
    
    return '';
  },
  
  /**
   * Generate keywords HTML
   * @param {Object} opp - The opportunity object
   * @param {boolean} hasAiAnalysis - Whether the opportunity has AI analysis
   * @returns {string} HTML for the keywords/themes
   */
  generateKeywordsHtml: function(opp, hasAiAnalysis) {
    // Get the correct analysis object
    const analysis = opp.aiAnalysis || opp.ai_analysis;
    
    // Use AI themes if available
    if (hasAiAnalysis && analysis) {
      const themes = analysis.keyThemes || analysis.key_themes;
      if (themes && themes.length > 0) {
        const themeTags = themes.map(theme =>
          `<span class="card-tag theme-tag">${theme}</span>`
        ).join('');
        
        return `
          <div class="card-tags">
            ${themeTags}
          </div>
        `;
      }
    }
    
    // Fall back to keywords if available
    if (opp.keywords && opp.keywords.length > 0) {
      const keywordTags = opp.keywords.map(keyword =>
        `<span class="card-tag">${keyword}</span>`
      ).join('');
      
      return `
        <div class="card-tags">
          ${keywordTags}
        </div>
      `;
    }
    
    return '';
  },
  
  /**
   * Get deadline value from opportunity, checking various possible field names
   * @param {Object} opp - The opportunity object
   * @returns {string|null} The deadline value or null
   */
  getDeadlineValue: function(opp) {
    // Try each potential date field in order of likelihood
    const possibleDateFields = [
      'deadline',         // Generic field name
      'callDate',         // Most SourceBottle opportunities use this
      'dealine',          // Possible typo in API
      'callDeadline',     // Alternative name
      'call_deadline',    // Snake case variant
      'closeDate',        // Another possible name
      'close_date',       // Snake case variant
      'created',          // Fallback to creation date
      'dateCreated',      // Alternative creation date field
      'date',             // Generic date field
      'publishDate'       // Publication date as last resort
    ];
    
    // Find the first valid date field
    for (const field of possibleDateFields) {
      if (opp[field] && opp[field] !== 'Invalid Date') {
        return opp[field];
      }
    }
    
    return null;
  },
  
  /**
   * Normalize opportunity properties for consistent usage
   * @param {Object} opp - The opportunity object
   * @returns {Object} - Normalized opportunity object
   */
  normalizeProperties: function(opp) {
    if (!opp) return {};
    
    return {
      ...opp,
      id: opp.id || opp.externalId || `gen-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      title: opp.title || opp.headline || 'Untitled Opportunity',
      description: opp.description || opp.content || opp.callContent || '',
      category: opp.category || opp.categoryName || 'General',
      source: opp.source || opp.platform || 'SourceBottle',
      ai_analysis: opp.ai_analysis || opp.aiAnalysis || null,
      aiAnalysis: opp.ai_analysis || opp.aiAnalysis || null, // Duplicate for compatibility
      datePosted: opp.datePosted || opp.created || opp.createdAt || opp.date || null,
      keywords: Array.isArray(opp.keywords) ? opp.keywords : 
        (typeof opp.keywords === 'string' ? opp.keywords.split(',').map(k => k.trim()) : [])
    };
  },
  
  /**
   * Generate test opportunities for development and testing
   * @param {number} count - Number of test opportunities to generate
   * @returns {Array} Array of test opportunity objects
   */
  generateTestOpportunities: function(count = 5) {
    console.log(`Generating ${count} test opportunities`);
    
    const categories = [
      'Business & Finance', 'Technology', 'Health & Wellbeing', 
      'Lifestyle, Food & Fashion', 'Environment', 'Professional Services'
    ];
    
    const sources = ['SourceBottle', 'Twitter', 'HARO', 'LinkedIn'];
    
    const titles = [
      'Looking for financial experts to comment on market trends',
      'Seeking tech professionals for new product review',
      'Health specialists needed for wellness article',
      'Fashion designers wanted for summer collection feature',
      'Environmental scientists required for climate change story',
      'Legal professionals sought for business law article',
      'Marketing specialists needed for digital strategy piece',
      'Food bloggers wanted for restaurant review',
      'Travel experts needed for destination guide',
      'Education professionals sought for learning trends piece'
    ];
    
    const descriptions = [
      'Working on an article about the latest trends in the market and looking for expert insights and quotes.',
      'Developing a feature on cutting-edge technology and seeking experienced professionals to review new products.',
      'Writing a comprehensive guide on wellness practices and need health specialists to provide authoritative advice.',
      'Preparing a summer fashion edition and looking for designers to showcase their collections and share insights.',
      'Investigating the impacts of climate change for an in-depth report and need scientific expertise.',
      'Compiling a guide to business law changes and require legal professionals to explain implications.',
      'Exploring the evolution of digital marketing strategies and seeking specialists for case studies.',
      'Creating a series of restaurant reviews and need experienced food bloggers for diverse perspectives.',
      'Developing a travel guide for emerging destinations and looking for experts with first-hand experience.',
      'Examining trends in education and learning technologies and need insights from professionals in the field.'
    ];
    
    // Generate unique IDs based on timestamp + random
    const generateId = () => `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Generate random date within last 30 days
    const generateDate = () => {
      const now = new Date();
      const randomDays = Math.floor(Math.random() * 30);
      now.setDate(now.getDate() - randomDays);
      return now.toISOString();
    };
    
    // Generate deadline in the near future (1-14 days)
    const generateDeadline = () => {
      const now = new Date();
      const randomDays = Math.floor(Math.random() * 14) + 1;
      now.setDate(now.getDate() + randomDays);
      return now.toISOString();
    };
    
    // Generate some keywords
    const generateKeywords = () => {
      const allKeywords = [
        'expert', 'opinion', 'interview', 'quote', 'insight', 
        'professional', 'specialist', 'authority', 'trend', 'analysis',
        'research', 'data', 'study', 'report', 'feature'
      ];
      
      // Get 3-5 random keywords
      const keywordCount = Math.floor(Math.random() * 3) + 3;
      const shuffled = [...allKeywords].sort(() => 0.5 - Math.random());
      return shuffled.slice(0, keywordCount);
    };
    
    // Generate test opportunities
    return Array.from({ length: count }, (_, i) => {
      const titleIndex = i % titles.length;
      return {
        id: generateId(),
        title: titles[titleIndex],
        description: descriptions[titleIndex],
        category: categories[Math.floor(Math.random() * categories.length)],
        source: sources[Math.floor(Math.random() * sources.length)],
        datePosted: generateDate(),
        deadline: generateDeadline(),
        keywords: generateKeywords(),
        // Include some with analysis and some without to test both scenarios
        ...(Math.random() > 0.3 ? {
          ai_analysis: {
            relevance_score: Math.random(),
            priority: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)],
            key_themes: generateKeywords(),
            reasoning: "This is a generated test opportunity with AI analysis for development purposes.",
            confidence: Math.random(),
            processed_at: new Date().toISOString()
          }
        } : {})
      };
    });
  }
};

// Expose as window global for chrome extension compatibility
window.opportunityUtils = opportunityUtils;
window.utils = opportunityUtils; // Alias for backward compatibility
