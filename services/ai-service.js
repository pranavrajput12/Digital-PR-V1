/**
 * AI Service for SourceBottle Extension
 * Provides AI-powered features like opportunity matching, categorization and relevance scoring
 */

class AIService {
  constructor() {
    this.apiKey = null;
    this.settings = null;
    this.userProfile = null;
    this.initialized = false;
  }
  
  /**
   * Initialize the AI service with settings
   */
  async initialize() {
    try {
      const result = await new Promise(resolve => chrome.storage.local.get(['settings'], resolve));
      this.settings = result.settings || {};
      this.apiKey = this.settings.openai?.apiKey || null;
      this.userProfile = this.settings.userProfile || {};
      this.initialized = !!this.apiKey;
      
      console.log('AI Service initialized:', this.initialized);
      return this.initialized;
    } catch (err) {
      console.error('Error initializing AI service:', err);
      return false;
    }
  }
  
  /**
   * Check if the AI service is enabled and configured
   */
  isEnabled() {
    return this.initialized && this.apiKey;
  }
  
  /**
   * Process opportunities with AI analysis
   * @param {Array} opportunities - Array of opportunity objects
   * @returns {Array} Processed opportunities with AI data
   */
  async processOpportunities(opportunities) {
    if (!this.isEnabled()) {
      console.log('AI service not enabled, skipping processing');
      return opportunities;
    }
    
    try {
      const enableMatching = this.settings.openai?.enableMatching !== false;
      const enableCategories = this.settings.openai?.enableCategories !== false;
      const enableRelevance = this.settings.openai?.enableRelevance !== false;
      
      // Process in batches to avoid overwhelming the API
      const batchSize = 5;
      const processedOpportunities = [];
      
      for (let i = 0; i < opportunities.length; i += batchSize) {
        const batch = opportunities.slice(i, i + batchSize);
        const processedBatch = await Promise.all(
          batch.map(opportunity => this.processOpportunity(
            opportunity, 
            enableMatching, 
            enableCategories, 
            enableRelevance
          ))
        );
        processedOpportunities.push(...processedBatch);
      }
      
      return processedOpportunities;
    } catch (err) {
      console.error('Error processing opportunities with AI:', err);
      return opportunities;
    }
  }
  
  /**
   * Process a single opportunity with AI
   */
  async processOpportunity(opportunity, enableMatching, enableCategories, enableRelevance) {
    try {
      const enhancedOpportunity = { ...opportunity };
      
      // Skip if already processed with the same settings
      if (enhancedOpportunity.aiProcessed && 
          enhancedOpportunity.aiSettings &&
          enhancedOpportunity.aiSettings.matching === enableMatching &&
          enhancedOpportunity.aiSettings.categories === enableCategories &&
          enhancedOpportunity.aiSettings.relevance === enableRelevance) {
        return enhancedOpportunity;
      }
      
      // Prepare opportunity text for analysis
      const opportunityText = `
        Title: ${opportunity.title || ''}
        Category: ${opportunity.category || ''}
        Description: ${opportunity.description || ''}
        Media Outlet: ${opportunity.mediaOutlet || ''}
        Journalist: ${opportunity.journalist || ''}
      `;
      
      // Prepare user profile for matching
      const userProfileText = `
        Industry: ${this.userProfile.industry || ''}
        Bio: ${this.userProfile.bio || ''}
        Interests: ${(this.userProfile.interests || []).join(', ')}
      `;
      
      // Build the AI tasks based on enabled features
      const tasks = [];
      
      if (enableCategories) {
        tasks.push(`1. CATEGORIZATION: Analyze the opportunity and suggest the most accurate category from these options:
        - Technology
        - Business & Finance
        - Health & Wellbeing
        - Lifestyle, Food & Fashion
        - PR, Media & Marketing
        - Parenting & Education
        - Environment
        - Travel & Leisure
        - Professional Services
        - Property
        - General
        If the existing category is appropriate, keep it.`);
      }
      
      if (enableRelevance) {
        tasks.push(`2. RELEVANCE SCORE: Rate how relevant this opportunity is on a scale of 1-100 based solely on the content of the opportunity.`);
      }
      
      if (enableMatching && userProfileText.trim().length > 30) {
        tasks.push(`3. USER MATCH SCORE: Based on the user's profile, rate how well this opportunity matches the user's interests and industry on a scale of 1-100.
        User Profile:
        ${userProfileText}`);
      }
      
      tasks.push(`4. KEYWORDS: Extract 3-5 keywords that best represent this opportunity.`);
      
      if (tasks.length === 0) {
        return enhancedOpportunity;
      }
      
      // Call OpenAI API
      const response = await this.callOpenAI(opportunityText, tasks.join('\n\n'));
      
      // Parse response and enhance opportunity
      const aiData = this.parseAIResponse(response);
      
      enhancedOpportunity.aiProcessed = true;
      enhancedOpportunity.aiSettings = {
        matching: enableMatching,
        categories: enableCategories,
        relevance: enableRelevance
      };
      
      if (aiData.suggestedCategory && enableCategories) {
        enhancedOpportunity.suggestedCategory = aiData.suggestedCategory;
      }
      
      if (aiData.relevanceScore && enableRelevance) {
        enhancedOpportunity.relevanceScore = aiData.relevanceScore;
      }
      
      if (aiData.userMatchScore && enableMatching) {
        enhancedOpportunity.userMatchScore = aiData.userMatchScore;
      }
      
      if (aiData.keywords) {
        enhancedOpportunity.keywords = aiData.keywords;
      }
      
      return enhancedOpportunity;
    } catch (err) {
      console.error('Error processing opportunity with AI:', err);
      return opportunity;
    }
  }
  
  /**
   * Call OpenAI API
   */
  async callOpenAI(opportunityText, tasks) {
    try {
      const prompt = `
        OPPORTUNITY DETAILS:
        ${opportunityText}
        
        ANALYSIS TASKS:
        ${tasks}
        
        FORMAT YOUR RESPONSE AS JSON:
        {
          "suggestedCategory": "Category name",
          "relevanceScore": 85,
          "userMatchScore": 75,
          "keywords": ["keyword1", "keyword2", "keyword3"]
        }
      `;
      
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: 'You are an AI assistant that analyzes media opportunities and matches them to user profiles. Return your analysis as properly formatted JSON only.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.3,
          max_tokens: 500
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
      }
      
      const data = await response.json();
      return data.choices[0].message.content;
    } catch (err) {
      console.error('Error calling OpenAI API:', err);
      throw err;
    }
  }
  
  /**
   * Parse the AI response from OpenAI
   */
  parseAIResponse(response) {
    try {
      // Find JSON in the response (handle cases where AI includes explanatory text)
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const jsonText = jsonMatch[0];
        return JSON.parse(jsonText);
      }
      
      // If no JSON object found, try to parse the whole response
      return JSON.parse(response);
    } catch (err) {
      console.error('Error parsing AI response:', err);
      return {
        suggestedCategory: null,
        relevanceScore: null,
        userMatchScore: null,
        keywords: []
      };
    }
  }
}

// Create and export singleton instance
const aiService = new AIService();

// Make available globally for non-module scripts
window.aiService = aiService;
