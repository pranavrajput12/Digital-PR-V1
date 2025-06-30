/**
 * AI Service Module for SourceBottle Extension
 * Handles AI-powered analysis of opportunities using Azure OpenAI API
 * Implements secure credential management and intelligent request handling
 * 
 * @requires KeywordManager for externalized keyword group configuration
 */

/**
 * AI Service Module for SourceBottle Extension
 * Uses window globals for Chrome Extension CSP compliance
 * Requires promptTemplates.js to be loaded first
 */

// Use the existing PromptTemplates from window global
// This avoids duplicate declarations

/**
 * Helper function for template rendering
 * @private
 */
function renderTemplate(template, data) {
  return template.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
    return data[key.trim()] || match;
  });
}

class AIService {
  constructor(config = {}) {
    // Storage keys
    this.SETTINGS_KEY = 'sourcebottle_ai_settings';
    this.EMBEDDING_KEY = 'sourcebottle_embeddings';
    this.CLASSIFIER_KEY = 'sourcebottle_classifier';
    this.KEYWORD_GROUPS_KEY = 'sourcebottle_keyword_groups';
    this.CONFIG_PATH = '/config/keyword-groups.json';
    
    // Initialize configuration from provided config or empty defaults
    // No hardcoded credentials for security
    this.apiKey = config.apiKey || '';
    this.resourceName = config.resourceName || '';
    this.deploymentId = config.deploymentId || '';
    this.apiVersion = config.apiVersion || '2023-05-15';
    this._initialized = false; // Initialization state flag
    
    // Cache for pending initialization promise to prevent concurrent calls
    this._initializationPromise = null;
    
    // Error codes for typed errors
    this.ERROR_CODES = {
      CONFIGURATION_MISSING: 'CONFIGURATION_MISSING',
      NETWORK_ERROR: 'NETWORK_ERROR',
      API_ERROR: 'API_ERROR',
      PARSE_ERROR: 'PARSE_ERROR'
    };
    
    // Model configuration
    this.modelTemperature = 0.7;
    this.modelMaxTokens = 2000;
    
    // Configuration defaults for scoring thresholds
    this.config = {
      scoreThresholds: {
        high: 0.7,
        medium: 0.4,
        low: 0.1
      },
      titleMultiplier: 2.0,
      // Increased threshold to prevent excessive API calls
      minBasicScore: 0.35,
      deadlineMaxDays: 30
    };
  }

  /**
   * Set configuration for the AI service
   * @param {Object} config - Configuration object
   * @returns {AIService} - Returns this for chaining
   */
  setConfig(config = {}) {
    // Normalize resource name by removing domain if present
    const normalizedResourceName = config.RESOURCE_NAME && config.RESOURCE_NAME.includes('.openai.azure.com') 
      ? config.RESOURCE_NAME.replace('.openai.azure.com', '') 
      : config.RESOURCE_NAME;

    // Check if the config actually changes anything
    const hasChanges = (
      (config.API_KEY && config.API_KEY !== this.apiKey) ||
      (normalizedResourceName && normalizedResourceName !== this.resourceName) ||
      (config.DEPLOYMENT_ID && config.DEPLOYMENT_ID !== this.deploymentId) ||
      (config.API_VERSION && config.API_VERSION !== this.apiVersion)
    );
    
    // If there are changes, update the configuration and reset initialization state
    if (hasChanges) {
      console.log('AI service config updated with new values');
      
      // Reset initialization state so service will re-initialize with new config
      this._initialized = false;
      
      // Update the configuration
      if (config.API_KEY) this.apiKey = config.API_KEY;
      if (normalizedResourceName) this.resourceName = normalizedResourceName;
      if (config.DEPLOYMENT_ID) this.deploymentId = config.DEPLOYMENT_ID;
      if (config.API_VERSION) {
        // Remove any trailing apostrophes from API version
        this.apiVersion = config.API_VERSION.replace(/['"`]+$/, '');
      }
      
      // Save to persistent storage
      this._saveSettings();
    }
    
    return this;
  }
  
  /**
   * Save current settings to localStorage
   * @private
   */
  _saveSettings() {
    try {
      const settings = {
        apiKey: this.apiKey,
        resourceName: this.resourceName,
        deploymentId: this.deploymentId,
        apiVersion: this.apiVersion
      };
      
      localStorage.setItem(this.SETTINGS_KEY, JSON.stringify(settings));
      console.log('AI service settings saved to localStorage');
    } catch (error) {
      console.error('Failed to save AI service settings:', error);
    }
  }
  
  /**
   * Load settings from localStorage
   * @private
   */
  _loadSettings() {
    try {
      const settingsJson = localStorage.getItem(this.SETTINGS_KEY);
      if (settingsJson) {
        const settings = JSON.parse(settingsJson);
        
        // Only update if values exist
        if (settings.apiKey) this.apiKey = settings.apiKey;
        if (settings.resourceName) this.resourceName = settings.resourceName;
        if (settings.deploymentId) this.deploymentId = settings.deploymentId;
        if (settings.apiVersion) this.apiVersion = settings.apiVersion;
        
        console.log('AI service settings loaded from localStorage');
      }
    } catch (error) {
      console.error('Failed to load AI service settings:', error);
    }
  }
  
  /**
   * Initialize the AI service
   * @returns {Promise<boolean>} True if initialization was successful
   */
  async initialize() {
    // If already initialized, return immediately
    if (this._initialized) {
      return true;
    }
    
    // If initialization is already in progress, return that promise
    if (this._initializationPromise) {
      return this._initializationPromise;
    }
    
    // Start initialization and cache the promise
    this._initializationPromise = this._doInitialize();
    
    try {
      // Wait for initialization to complete
      const result = await this._initializationPromise;
      
      // Clear the cached promise
      this._initializationPromise = null;
      
      return result;
    } catch (error) {
      // Clear the cached promise on error
      this._initializationPromise = null;
      throw error;
    }
  }
  
  /**
   * Internal initialization logic
   * @private
   * @returns {Promise<boolean>} True if initialization was successful
   */
  async _doInitialize() {
    try {
      // Load settings from localStorage
      this._loadSettings();
      
      // Check if we have the required configuration
      if (!this.apiKey || !this.resourceName || !this.deploymentId) {
        console.warn('AI service missing required configuration');
        return false;
      }
      
      // Validate API key format
      if (!/^[a-zA-Z0-9]+$/.test(this.apiKey)) {
        console.warn('AI service API key has invalid format');
        return false;
      }
      
      // Initialize keyword manager if available
      if (window.keywordManager) {
        await window.keywordManager.initialize();
      } else {
        console.warn('KeywordManager not available, some features will be limited');
      }
      
      // Initialize embedding cache if available
      if (window.embeddingCache) {
        await window.embeddingCache.initialize();
      } else {
        console.warn('EmbeddingCache not available, semantic analysis will be limited');
      }
      
      // Mark as initialized
      this._initialized = true;
      console.log('AI service initialized successfully');
      
      return true;
    } catch (error) {
      console.error('AI service initialization failed:', error);
      return false;
    }
  }
  
  /**
   * Check if the AI service is enabled
   * @returns {boolean} True if the service is enabled
   */
  isEnabled() {
    return this._initialized;
  }
  
  /**
   * Generate embeddings for a text using Azure OpenAI with persistent caching
   * Uses both in-memory and IndexedDB caching to reduce API calls
   * @param {string} text - Text to generate embeddings for
   * @returns {Promise<Array<number>>} - Embedding vector
   */
  async getEmbedding(text) {
    // Use the embedding cache if available
    if (window.embeddingCache) {
      return window.embeddingCache.getEmbedding(text, () => this._generateEmbeddingFromAPI(text));
    }
    
    // Fall back to direct API call if cache not available
    return this._generateEmbeddingFromAPI(text);
  }
  
  /**
   * Internal method to generate embeddings directly from Azure OpenAI API
   * @private
   * @param {string} text - Text to generate embeddings for
   * @returns {Promise<Array<number>|null>} - Embedding vector or null on failure
   */
  async _generateEmbeddingFromAPI(text) {
    try {
      // Ensure the service is initialized
      if (!this._initialized) {
        await this.initialize();
      }
      
      // If still not initialized, return null
      if (!this._initialized) {
        const error = new Error('Cannot generate embeddings: AI service not initialized');
        console.error(error);
        throw error;
      }
      
      // Validate input
      if (!text || typeof text !== 'string' || text.trim().length === 0) {
        const error = new Error('Invalid text input for embedding generation');
        console.error(error);
        throw error;
      }
      
      // Prepare the embedding URL for Azure OpenAI
      // Make sure to use a clean API version with no trailing apostrophes
      const cleanApiVersion = this.apiVersion.replace(/['"`]+$/, '');
      const url = `https://${this.resourceName}.openai.azure.com/openai/deployments/${this.deploymentId}/embeddings?api-version=${cleanApiVersion}`;
      
      // Log embedding request (truncate for privacy)
      console.log(`Generating embeddings from API for: ${text.substring(0, 30)}...`);
      
      // Make the API request
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': this.apiKey
        },
        body: JSON.stringify({
          input: text,
          model: this.deploymentId
        })
      });
      
      // Check for HTTP errors
      if (!response.ok) {
        const errorText = await response.text();
        const error = new Error(`Azure OpenAI API embedding error (${response.status}): ${errorText}`);
        console.error(error);
        throw error;
      }
      
      // Parse the response
      const data = await response.json();
      
      // Validate the response structure
      if (!data.data || !data.data[0] || !data.data[0].embedding) {
        const error = new Error('Invalid embedding response structure from Azure OpenAI API');
        console.error(error);
        throw error;
      }
      
      // Return the embedding vector
      return data.data[0].embedding;
    } catch (error) {
      console.error('Error generating embeddings:', error);
      return null;
    }
  }
  
  /**
   * Compute cosine similarity between two embedding vectors
   * @param {Array<number>} a - First embedding vector
   * @param {Array<number>} b - Second embedding vector
   * @returns {number} - Cosine similarity (-1 to 1, where 1 is identical)
   */
  computeSimilarity(a, b) {
    // Check if inputs are valid
    if (!a || !b || !Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
      console.error('Invalid embedding vectors for similarity computation');
      return 0;
    }
    
    try {
      // Use similarity cache if available
      if (window.similarityCache) {
        return window.similarityCache.getSimilarity(a, b);
      }
      
      // Compute dot product
      let dotProduct = 0;
      let magnitudeA = 0;
      let magnitudeB = 0;
      
      for (let i = 0; i < a.length; i++) {
        dotProduct += a[i] * b[i];
        magnitudeA += a[i] * a[i];
        magnitudeB += b[i] * b[i];
      }
      
      // Compute cosine similarity
      return dotProduct / (Math.sqrt(magnitudeA) * Math.sqrt(magnitudeB));
    } catch (error) {
      console.error('Error computing similarity:', error);
      return 0;
    }
  }
  
  /**
   * Check if a text is semantically similar to canonical themes
   * Uses caching and parallel processing for improved performance
   * @param {string} text - Text to check
   * @returns {Promise<{isSimilar: boolean, score: number}>} - Similarity result
   */
  async checkSemanticSimilarity(text, canonicalThemes = []) {
    try {
      // Ensure the service is initialized
      if (!this._initialized) {
        await this.initialize();
      }
      
      // If still not initialized, return default result with error
      if (!this._initialized) {
        const error = new Error('AI service not initialized');
        console.error(error);
        return {
          isSimilar: false,
          score: 0,
          error: error.message
        };
      }
      
      // Generate embedding for the input text
      const textEmbedding = await this.getEmbedding(text);
      if (!textEmbedding) {
        return {
          isSimilar: false,
          score: 0,
          error: 'Failed to generate embedding for input text'
        };
      }
      
      // If no canonical themes provided, use cached themes if available
      if (!canonicalThemes || canonicalThemes.length === 0) {
        if (window.keywordManager && window.keywordManager.getThemes) {
          canonicalThemes = await window.keywordManager.getThemes();
        }
        
        // If still no themes, return early with error
        if (!canonicalThemes || canonicalThemes.length === 0) {
          return {
            isSimilar: false,
            score: 0,
            error: 'No canonical themes available for comparison'
          };
        }
      }
      
      // Process each theme and compute similarity
      const results = await Promise.all(canonicalThemes.map(async theme => {
        // Get or generate embedding for the theme
        let themeEmbedding;
        if (theme.embedding) {
          themeEmbedding = theme.embedding;
        } else {
          themeEmbedding = await this.getEmbedding(theme.text || theme);
        }
        
        if (!themeEmbedding) {
          return { theme: theme.text || theme, score: 0 };
        }
        
        // Compute similarity
        const similarityScore = this.computeSimilarity(textEmbedding, themeEmbedding);
        return {
          theme: theme.text || theme,
          score: similarityScore
        };
      }));
      
      // Find best match
      const bestMatch = results.reduce((best, current) =>
        current.score > best.score ? current : best,
        { theme: '', score: 0 }
      );
      
      return {
        isSimilar: bestMatch.score > 0.6,
        score: bestMatch.score,
        bestMatchTheme: bestMatch.theme
      };
    } catch (error) {
      console.error('Error checking semantic similarity:', error);
      return { isSimilar: false, score: 0 };
    }
  }
  
  /**
   * Use the machine learning classifier to predict opportunity relevance
   * @param {Object} opportunity - The opportunity to analyze
   * @returns {Promise<{isRelevant: boolean, confidence: number}>}
   */
  async classifyOpportunity(opportunity) {
    try {
      // Ensure the service is initialized
      if (!this._initialized) {
        await this.initialize();
      }
      
      // If still not initialized, return default with error
      if (!this._initialized) {
        throw new Error('AI service not initialized');
      }
      
      // Check if we have a classifier
      if (!this.classifier) {
        console.warn('No classifier available, using semantic similarity fallback');
        
        // Use semantic similarity as fallback
        const combinedText = `${opportunity.title || ''} ${opportunity.description || ''}`.trim();
        if (!combinedText) {
          return { isRelevant: false, confidence: 0.5, method: 'default' };
        }
        
        const similarityResult = await this.checkSemanticSimilarity(combinedText);
        return {
          isRelevant: similarityResult.isSimilar,
          confidence: similarityResult.score,
          method: 'similarity'
        };
      }
      
      // If we have a trained classifier, use it
      if (this.classifier.isTrained && this.classifier.isTrained()) {
        // Extract features from opportunity
        const features = this._extractFeatures(opportunity);
        
        // Use the classifier to predict
        const prediction = await this.classifier.predict(features);
        
        return {
          isRelevant: prediction.label === 'relevant',
          confidence: prediction.confidence,
          method: 'classifier'
        };
      } else {
        console.warn('Classifier not trained, using semantic similarity');
        
        // Use semantic similarity as fallback
        const combinedText = `${opportunity.title || ''} ${opportunity.description || ''}`.trim();
        if (!combinedText) {
          return { isRelevant: false, confidence: 0.5, method: 'default' };
        }
        
        const similarityResult = await this.checkSemanticSimilarity(combinedText);
        return {
          isRelevant: similarityResult.isSimilar,
          confidence: similarityResult.score,
          method: 'similarity'
        };
      }
    } catch (error) {
      console.error('Error in opportunity classification:', error);
      return {
        isRelevant: false,
        confidence: 0.5,
        error: error.message,
        method: 'error'
      };
    }
  }
  
  /**
   * Train the classifier with the current training dataset
   * @param {number} epochs - Number of training epochs
   * @returns {Promise<{success: boolean, error: string?}>}
   */
  async trainClassifier(epochs = 50) {
    // Placeholder for classifier training
    console.log(`Training classifier with ${epochs} epochs`);
    return { success: true };
  }
  
  /**
   * Add a training example to the classifier
   * @param {Object} opportunity - The opportunity to add
   * @param {boolean} isRelevant - Whether the opportunity is relevant
   * @returns {number} Total number of training examples
   */
  addTrainingExample(opportunity, isRelevant) {
    // Placeholder for adding training examples
    console.log(`Adding training example: ${isRelevant ? 'relevant' : 'not relevant'}`);
    return 10; // Mock number of examples
  }
  
  /**
   * Reset the classifier to its initial state
   */
  resetClassifier() {
    console.log('Classifier reset');
  }
  
  /**
   * Make a POST request to the Azure OpenAI API with retry logic
   * @param {Object} payload - The request payload
   * @param {number} maxRetries - Maximum number of retry attempts
   * @returns {Promise<Object>} - The API response
   * @private
   */
  async _post(payload, maxRetries = 3) {
    let retries = 0;
    let lastError = null;
    
    while (retries <= maxRetries) {
      try {
        // Ensure the service is initialized
        if (!this._initialized) {
          const initialized = await this.initialize();
          if (!initialized) {
            throw new Error('AI service not initialized');
          }
        }
        
        // Prepare the request URL
        // Make sure to use a clean API version with no trailing apostrophes
        const cleanApiVersion = this.apiVersion.replace(/['"`]+$/, '');
        const url = `https://${this.resourceName}.openai.azure.com/openai/deployments/${this.deploymentId}/chat/completions?api-version=${cleanApiVersion}`;
        
        // Make the API request
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'api-key': this.apiKey
          },
          body: JSON.stringify(payload)
        });
        
        // Check for HTTP errors
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Azure OpenAI API error (${response.status}): ${errorText}`);
        }
        
        // Parse and return the response
        return await response.json();
      } catch (error) {
        lastError = error;
        
        // Only retry on network errors or 429/5xx status codes
        const isRetryableError = (
          error.message.includes('network') ||
          error.message.includes('429') ||
          error.message.includes('5')
        );
        
        if (!isRetryableError) {
          break; // Don't retry on non-retryable errors
        }
        
        // Exponential backoff with jitter
        const delay = Math.min(1000 * Math.pow(2, retries) + Math.random() * 1000, 10000);
        console.warn(`Retrying Azure OpenAI request after ${delay}ms (attempt ${retries + 1}/${maxRetries})`);
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, delay));
        
        retries++;
      }
    }
    
    // If we've exhausted all retries, throw the last error
    throw lastError || new Error('Failed to make Azure OpenAI request after multiple retries');
  }

  /**
   * Analyze an opportunity using Azure OpenAI with SourceBottle specific context
   * @param {Object} opportunity - The opportunity to analyze
   * @param {string} promptType - Type of analysis to perform
   * @returns {Promise<Object>} - Analysis result with relevance scoring
   */
  async analyzeOpportunity(opportunity, promptType = 'prioritize') {
    try {
      // Ensure the service is initialized
      if (!this._initialized) {
        const initialized = await this.initialize();
        if (!initialized) {
          throw new Error('AI service not initialized');
        }
      }
      
      // Get the appropriate prompt based on analysis type
      const prompt = this._getPromptForType(promptType, opportunity);
      
      // Prepare the request payload
      const payload = {
        messages: [
          { role: 'system', content: window.PromptTemplates.systemPrompt + ' Always respond with valid JSON when the prompt requests JSON format.' },
          { role: 'user', content: prompt }
        ],
        temperature: this.modelTemperature,
        max_tokens: this.modelMaxTokens,
        response_format: { type: "json_object" } // Force JSON response format
      };
      
      // Make the API request using the _post method with retry logic
      const data = await this._post(payload);
      
      // Process the AI response based on prompt type
      return this._processAIResponse(data, promptType);
    } catch (error) {
      console.error('Error analyzing opportunity with Azure OpenAI:', error);
      
      // Return error information without fallback analysis
      return {
        relevance_score: 0,
        priority: 'low',
        key_themes: [],
        confidence: 0,
        reasoning: `Error analyzing opportunity: ${error.message}`,
        error: error.message
      };
    }
  }

  /**
   * Analyze sentiment for text using Azure OpenAI
   * @param {string} text - Text to analyze
   * @returns {Promise<Object>} - Sentiment analysis result
   */
  async analyzeSentiment(text) {
    try {
      // Ensure the service is initialized
      if (!this._initialized) {
        const initialized = await this.initialize();
        if (!initialized) {
          throw new Error('AI service not initialized');
        }
      }
      
      // Prepare the request payload
      const payload = {
        messages: [
          { 
            role: 'system', 
            content: 'You are a sentiment analysis expert. Analyze the following text and respond in valid JSON format with the following structure: {"sentiment_score": number from -1 to 1, "sentiment_label": "positive", "negative", or "neutral", "key_emotional_indicators": [array of emotional words/phrases], "confidence": number from 0 to 1}.' 
          },
          { 
            role: 'user', 
            content: `Analyze the sentiment of this text: "${text}"` 
          }
        ],
        temperature: 0.3,
        max_tokens: 300,
        response_format: { type: "json_object" } // Force JSON response format
      };
      
      // Make the API request using the _post method with retry logic
      const data = await this._post(payload);
      
      // Extract content from Azure OpenAI response
      const content = data.choices?.[0]?.message?.content?.trim();
      
      if (!content) {
        throw new Error('No content in Azure OpenAI response');
      }
      
      // Try to parse as JSON
      let result;
      try {
        result = typeof content === 'string' ? JSON.parse(content) : content;
      } catch (e) {
        console.error('Failed to parse sentiment analysis response:', e);
        throw e;
      }
      
      // Normalize the result
      return {
        sentiment_score: Math.min(Math.max(Number(result.sentiment_score) || 0, -1), 1),
        sentiment_label: ['positive', 'negative', 'neutral'].includes(result.sentiment_label?.toLowerCase()) 
          ? result.sentiment_label.toLowerCase() 
          : 'neutral',
        key_emotional_indicators: Array.isArray(result.key_emotional_indicators) 
          ? result.key_emotional_indicators.slice(0, 5) 
          : [],
        confidence: Math.min(Math.max(Number(result.confidence) || 0.5, 0), 1)
      };
    } catch (error) {
      console.error('Error analyzing sentiment with Azure OpenAI:', error);
      
      // Return error information without fallback analysis
      return {
        sentiment_score: 0,
        sentiment_label: 'neutral',
        key_emotional_indicators: [],
        confidence: 0.5,
        error: error.message
      };
    }
  }
  
  /**
   * Get the appropriate prompt based on analysis type using the template system
   * @private
   */
  _getPromptForType(promptType, opportunity) {
    // Prepare the data for template rendering
    const templateData = {
      title: opportunity.title || 'N/A',
      description: opportunity.description || 'N/A',
      mediaOutlet: opportunity.mediaOutlet || 'N/A',
      deadline: opportunity.deadline || 'N/A'
    };
    
    // Get the template based on promptType or fall back to prioritize
    const templateKey = window.PromptTemplates.prompts[promptType] ? promptType : 'prioritize';
    const promptTemplate = window.PromptTemplates.prompts[templateKey];
    
    // Render the template with the opportunity data
    return renderTemplate(promptTemplate, templateData);
  }

  /**
   * Process the AI response based on prompt type
   * @private
   */
  _processAIResponse(data, promptType) {
    try {
      // Extract content from Azure OpenAI response
      const content = data.choices?.[0]?.message?.content?.trim();
      if (!content) {
        throw new Error('No content in Azure OpenAI response');
      }

      // Process based on prompt type
      switch (promptType) {
        case 'prioritize':
          try {
            // Log the raw content for debugging
            console.debug('Raw Azure OpenAI response content:', content);
            
            // Try to parse as JSON - using multiple fallback methods to ensure we get valid JSON
            let result;
            try {
              // First attempt: direct parse if it's already JSON
              result = typeof content === 'string' ? JSON.parse(content) : content;
              console.log('Successfully parsed Azure OpenAI response as JSON directly');
            } catch (parseError) {
              console.warn('Could not parse Azure OpenAI response as JSON directly:', parseError);
              
              try {
                // Second attempt: Try to extract JSON using regex (for responses that have text and then JSON)
                const jsonMatch = content.match(/{[\s\S]*}/);
                if (jsonMatch) {
                  result = JSON.parse(jsonMatch[0]);
                  console.log('Successfully extracted JSON from response using regex');
                } else {
                  // Third attempt: For conversational responses, create a default structure
                  console.warn('No JSON pattern found, creating default structure from text response');
                  // Extract potential relevance indicators from text
                  const isHighPriority = /high priority|very relevant|important/i.test(content);
                  const isLowPriority = /low priority|not relevant|irrelevant/i.test(content);
                  
                  result = {
                    relevance_score: isHighPriority ? 0.8 : (isLowPriority ? 0.2 : 0.5),
                    priority: isHighPriority ? 'high' : (isLowPriority ? 'low' : 'medium'),
                    key_themes: [],
                    confidence: 0.6,
                    reasoning: content.substring(0, 200) // Use part of the response as reasoning
                  };
                }
              } catch (extractError) {
                console.error('Failed all attempts to process response:', extractError);
                throw new Error('Unable to extract structured data from Azure OpenAI response');
              }
            }
            
            // Validate and normalize the response
            return {
              relevance_score: Math.min(Math.max(Number(result.relevance_score) || 0.5, 0), 1),
              priority: ['high', 'medium', 'low'].includes(result.priority?.toLowerCase()) 
                ? result.priority.toLowerCase() 
                : 'medium',
              key_themes: Array.isArray(result.key_themes) 
                ? result.key_themes.slice(0, 5) 
                : [],
              confidence: Math.min(Math.max(Number(result.confidence) || 0.7, 0), 1),
              reasoning: String(result.reasoning || 'No reasoning provided'),
              raw_response: content
            };
          } catch (e) {
            console.error('Error parsing Azure OpenAI response:', e);
            return {
              relevance_score: 0.5,
              priority: 'medium',
              key_themes: [],
              confidence: 0.5,
              reasoning: 'Error parsing Azure OpenAI response: ' + e.message,
              error: e.message
            };
          }
          
        case 'categorize':
          return {
            categories: content.split(',')
              .map(cat => cat.trim())
              .filter(Boolean)
              .slice(0, 5) // Limit to 5 categories
          };
          
        default:
          return { 
            content,
            relevance_score: 0.5,
            priority: 'medium',
            key_themes: []
          };
      }
    } catch (error) {
      console.error('Error processing AI response:', error);
      return { error: 'Failed to process AI response' };
    }
  }
  /**
   * Process a list of opportunities with AI analysis
   * This method is called from opportunities.js and was missing
   * @param {Array<Object>} opportunities - List of opportunities to process
   * @returns {Promise<Array<Object>>} - Processed opportunities with AI analysis
   */
  async processOpportunities(opportunities) {
    try {
      // Ensure the service is initialized
      if (!this._initialized) {
        const initialized = await this.initialize();
        if (!initialized) {
          console.error('AI service not initialized, returning opportunities without processing');
          return opportunities;
        }
      }

      console.log(`Processing ${opportunities.length} opportunities with AI`);
      
      // Process opportunities in batches to avoid overloading
      const batchSize = 5;
      const batches = [];
      
      // Split into batches
      for (let i = 0; i < opportunities.length; i += batchSize) {
        batches.push(opportunities.slice(i, i + batchSize));
      }
      
      // Process each batch sequentially
      const processedOpportunities = [];
      for (let i = 0; i < batches.length; i++) {
        console.log(`Processing batch ${i+1}/${batches.length}`);
        
        // Process each opportunity in the batch in parallel
        const batchResults = await Promise.all(batches[i].map(async opportunity => {
          try {
            // Only process if not already processed
            if (opportunity.aiProcessed) {
              return opportunity;
            }
            
            // Analyze the opportunity
            const analysis = await this.analyzeOpportunity(opportunity);
            
            // Add analysis results to the opportunity
            return {
              ...opportunity,
              relevanceScore: Math.round(analysis.relevance_score * 100),
              priority: analysis.priority,
              keyThemes: analysis.key_themes,
              aiProcessed: true,
              aiProcessedAt: new Date().toISOString()
            };
          } catch (error) {
            console.error(`Error processing opportunity: ${opportunity.title}`, error);
            return opportunity;
          }
        }));
        
        // Add batch results to processed opportunities
        processedOpportunities.push(...batchResults);
      }
      
      console.log(`AI processing complete for ${processedOpportunities.length} opportunities`);
      return processedOpportunities;
    } catch (error) {
      console.error('Error in batch processing opportunities:', error);
      return opportunities; // Return original opportunities on error
    }
  }
}

// Expose as global for Chrome Extension compatibility
window.aiService = new AIService();
