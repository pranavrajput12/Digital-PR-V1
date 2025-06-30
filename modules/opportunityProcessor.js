/**
 * Opportunity Processor
 * Handles filtering, scoring, and processing of opportunities with AI integration
 */

/**
 * Opportunity Processor Module
 * Uses window globals for Chrome Extension CSP compliance
 * Requires opportunityCache to be loaded first
 */

class OpportunityProcessor {
  constructor() {
    this.minRelevanceScore = 0.3; // Minimum score to be considered relevant
    this.highPriorityThreshold = 0.7; // Score above which opportunities are high priority
    this.mediumPriorityThreshold = 0.4; // Score above which opportunities are medium priority
    this.aiService = null; // Will be set when initialize is called
    this.initialized = false;
    
    // Processing state tracking
    this.processingQueue = [];
    this.isProcessing = false;
    this.maxConcurrentProcessing = 3;
    this.activeProcessingCount = 0;
    this.processedCount = 0;
    
    // Throttling parameters
    this.processingInterval = 500; // ms between opportunity processing
    this.batchSize = 5; // Process opportunities in batches
    this.maxMemoryUsage = 500 * 1024 * 1024; // 500MB max memory usage threshold
    
    // Memory monitoring
    this.lastMemoryCheck = Date.now();
    this.memoryCheckInterval = 30000; // Check memory every 30 seconds
  }
  
  /**
   * Initialize the opportunity processor
   * @returns {Promise<boolean>} - Whether initialization was successful
   */
  async initialize() {
    try {
      // Get reference to aiService from window
      if (typeof window !== 'undefined' && window.aiService) {
        this.aiService = window.aiService;
        console.log('OpportunityProcessor: aiService reference acquired');
        
        // Make sure aiService is initialized
        if (typeof this.aiService.initialize === 'function') {
          const aiInitialized = await this.aiService.initialize();
          if (aiInitialized) {
            console.log('OpportunityProcessor: aiService is initialized');
            this.initialized = true;
            return true;
          } else {
            console.warn('OpportunityProcessor: aiService failed to initialize');
            return false;
          }
        } else {
          console.warn('OpportunityProcessor: aiService missing initialize method');
          return false;
        }
      } else {
        console.warn('OpportunityProcessor: No aiService found in window');
        return false;
      }
    } catch (error) {
      console.error('OpportunityProcessor: Error during initialization:', error);
      return false;
    }
  }

  /**
   * Process and score opportunities using AI
   * @param {Array} opportunities - Array of opportunity objects
   * @returns {Promise<Object>} - Processed opportunities with scores and analysis
   */
  async processOpportunities(opportunities) {
    if (!Array.isArray(opportunities) || opportunities.length === 0) {
      return [];
    }

    // Check if we should throttle based on memory usage
    await this._checkMemoryUsage();

    // Add these opportunities to the processing queue
    return new Promise((resolve) => {
      // Create a unique batch ID for tracking
      const batchId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Create a result tracker for this batch
      const resultTracker = {
        id: batchId,
        total: opportunities.length,
        processed: 0,
        results: [],
        resolve: (results) => resolve(results)
      };
      
      // Add each opportunity to the queue with a reference to the batch
      opportunities.forEach(opp => {
        this.processingQueue.push({
          opportunity: opp,
          batchId: batchId
        });
      });
      
      // Store the result tracker
      this._resultTrackers = this._resultTrackers || new Map();
      this._resultTrackers.set(batchId, resultTracker);
      
      // Start processing if not already running
      if (!this.isProcessing) {
        this._processQueue();
      }
    });
  }
  
  /**
   * Process opportunities with AI analysis in batches
   * @param {Array} opportunities - Array of opportunities to process
   * @returns {Promise<Array>} - Array of processed opportunities
   */
  async processOpportunitiesWithAI(opportunities) {
    return this.processOpportunities(opportunities);
  }
  
  /**
   * Check system memory usage and perform cleanup if needed
   * @private
   */
  async _checkMemoryUsage() {
    // Only check periodically to avoid performance impact
    const now = Date.now();
    if (now - this.lastMemoryCheck < this.memoryCheckInterval) {
      return;
    }
    
    this.lastMemoryCheck = now;
    
    // Check memory usage if the performance API is available
    if (window.performance && window.performance.memory) {
      const memoryInfo = window.performance.memory;
      const usedHeapSize = memoryInfo.usedJSHeapSize;
      
      console.log(`Current memory usage: ${Math.round(usedHeapSize / (1024 * 1024))}MB`);
      
      // If memory usage is high, perform cleanup
      if (usedHeapSize > this.maxMemoryUsage) {
        console.warn(`Memory usage is high (${Math.round(usedHeapSize / (1024 * 1024))}MB). Performing cleanup...`);
        
        // Clear caches
        if (window.embeddingCache) {
          await window.embeddingCache.clearCache();
        }
        
        if (window.opportunityCache) {
          window.opportunityCache.clear();
        }
        
        if (window.similarityCache) {
          window.similarityCache.clear();
        }
        
        // Force garbage collection if available
        if (window.gc) {
          try {
            window.gc();
          } catch (e) {
            // Ignore if gc is not available
          }
        }
      }
    }
  }
  
  /**
   * Process the queue of opportunities with throttling
   * @private
   */
  async _processQueue() {
    if (this.processingQueue.length === 0) {
      this.isProcessing = false;
      return;
    }
    
    this.isProcessing = true;
    
    // Process a batch of opportunities
    const batch = this.processingQueue.splice(0, this.batchSize);
    const batchResults = [];
    
    // Group items by batch ID
    const batchGroups = new Map();
    batch.forEach(item => {
      if (!batchGroups.has(item.batchId)) {
        batchGroups.set(item.batchId, []);
      }
      batchGroups.get(item.batchId).push(item);
    });
    
    // Process each opportunity in the batch
    for (const item of batch) {
      try {
        const result = await this._processSingleOpportunity(item.opportunity);
        batchResults.push(result);
        this.processedCount++;
        
        // Update the result tracker for this batch
        if (this._resultTrackers && this._resultTrackers.has(item.batchId)) {
          const tracker = this._resultTrackers.get(item.batchId);
          tracker.results.push(result);
          tracker.processed++;
          
          // If all items in this batch are processed, resolve the promise
          if (tracker.processed >= tracker.total) {
            // Sort by relevance score before resolving
            const sortedResults = tracker.results.sort((a, b) =>
              (b.ai_analysis?.relevance_score || 0) - (a.ai_analysis?.relevance_score || 0)
            );
            
            tracker.resolve(sortedResults);
            this._resultTrackers.delete(item.batchId);
          }
        }
        
        // Throttle between individual opportunities
        await new Promise(resolve => setTimeout(resolve, this.processingInterval));
      } catch (error) {
        console.error('Error processing queue item:', error);
      }
    }
    
    // Check memory usage after each batch
    await this._checkMemoryUsage();
    
    // Schedule the next batch after a delay
    setTimeout(() => this._processQueue(), this.processingInterval);
  }
  
  /**
   * Process a single opportunity - public method for external access
   * @param {Object} opportunity - The opportunity to process
   * @returns {Promise<Object>} - The processed opportunity with AI analysis
   */
  async processOpportunity(opportunity) {
    return this._processSingleOpportunity(opportunity);
  }

  /**
   * Process a single opportunity with AI
   * @private
   */
  /**
   * Process a single opportunity with AI
   * @private
   * @param {Object} opportunity - The opportunity to process
   * @returns {Promise<Object>} - The processed opportunity with AI analysis
   * @throws {Error} If processing fails with a detailed error message
   */
  async _processSingleOpportunity(opportunity) {
    // Create an event name for error tracking
    const processingId = `proc_${Date.now()}`;
    
    try {
      // Validate input
      if (!opportunity) {
        throw new Error('Invalid opportunity object: cannot be null or undefined');
      }
      
      // Add basic metadata
      const processedOpp = {
        ...opportunity,
        processed_at: new Date().toISOString(),
        ai_analysis: null
      };

      // Check if aiService is available and initialized
      if (!this.aiService || !this.initialized) {
        const error = new Error('AI service not initialized');
        console.warn('OpportunityProcessor: Cannot process opportunity - AI service not initialized');
        // Track the error event
        if (typeof window !== 'undefined' && window.errorTracker) {
          window.errorTracker.trackEvent('ai_processing_error', {
            type: 'initialization_error',
            processingId,
            opportunityId: opportunity.id || opportunity.externalId
          });
        }
        throw error;
      }
      
      // First check if we have a similar opportunity in the cache
      const cachedAnalysis = window.opportunityCache ? window.opportunityCache.findSimilarOpportunity(opportunity) : null;
      
      let analysis;
      let sentimentAnalysis = null;
      
      // Process sentiment analysis for the opportunity
      try {
        const textToAnalyze = `${opportunity.title || ''} ${opportunity.description || ''}`.trim();
        if (textToAnalyze) {
          sentimentAnalysis = await this.aiService.analyzeSentiment(textToAnalyze);
          console.log(`Sentiment analysis for opportunity ${opportunity.id}:`, sentimentAnalysis);
        }
      } catch (sentimentError) {
        console.warn('Error during sentiment analysis:', sentimentError);
        // Don't fail the whole process if sentiment analysis fails
        sentimentAnalysis = {
          sentiment_score: 0,
          sentiment_label: 'neutral',
          key_emotional_indicators: [],
          confidence: 0.5,
          error: sentimentError.message
        };
      }
      
      if (cachedAnalysis) {
        // Use the cached analysis but mark it as reused
        analysis = {
          ...cachedAnalysis,
          cached: true,
          processed_at: new Date().toISOString()
        };
        console.log(`Using cached analysis for opportunity ${opportunity.id} (similarity: ${cachedAnalysis.similarity_score.toFixed(2)})`);
      } else {
        // No similar opportunity found, process with AI
        console.log(`No similar opportunity found for ${opportunity.id}, processing with AI...`);
        analysis = await this.aiService.analyzeOpportunity(opportunity, 'prioritize');
        
        // Cache this new analysis for future opportunities
        if (window.opportunityCache) {
          window.opportunityCache.cacheOpportunityAnalysis(opportunity, analysis);
        }
      }
      
      // Add analysis to opportunity, including sentiment analysis
      processedOpp.ai_analysis = {
        ...analysis,
        sentiment: sentimentAnalysis,
        processed_at: new Date().toISOString(),
        is_relevant: analysis.relevance_score >= this.minRelevanceScore
      };

      return processedOpp;
    } catch (error) {
      // Log detailed error information
      console.error('Error processing opportunity:', {
        opportunityId: opportunity?.id || opportunity?.externalId || 'unknown',
        errorMessage: error.message,
        errorStack: error.stack,
        processingId
      });
      
      // Track the error event
      if (typeof window !== 'undefined' && window.errorTracker) {
        window.errorTracker.trackEvent('ai_processing_error', {
          type: error.name || 'ProcessingError',
          message: error.message,
          processingId,
          opportunityId: opportunity?.id || opportunity?.externalId
        });
      }
      
      // Display user notification if notification service is available
      if (typeof window !== 'undefined' && window.notificationService) {
        window.notificationService.showError(
          'AI Analysis Error',
          `Failed to analyze opportunity: ${error.message}. Retry or check settings.`,
          {
            autoHide: true,
            duration: 5000,
            actions: [
              { label: 'Retry', action: 'retry' },
              { label: 'Settings', action: 'settings' }
            ]
          }
        );
      }
      
      // Return opportunity with error information and fallback analysis
      return {
        ...opportunity,
        processing_error: {
          message: error.message,
          code: error.code || 'PROCESSING_ERROR',
          timestamp: new Date().toISOString(),
          processingId,
          recoverable: true
        },
        ai_analysis: {
          relevance_score: 0.5, // Neutral score as fallback
          priority: 'medium', // Medium priority as fallback
          key_themes: this._extractFallbackThemes(opportunity),
          confidence: 0,
          is_relevant: false,
          error: error.message,
          processed_at: new Date().toISOString(),
          is_fallback: true // Indicate this is a fallback analysis
        }
      };
    }
  }

  /**
   * Filter opportunities based on relevance and other criteria
   * @param {Array} opportunities - Array of processed opportunities
   * @param {Object} filters - Filter criteria
   * @returns {Array} - Filtered opportunities
   */
  filterOpportunities(opportunities, filters = {}) {
    return opportunities.filter(opp => {
      // Skip if no AI analysis is available
      if (!opp.ai_analysis) return false;
      
      // Apply relevance filter
      if (filters.onlyRelevant && !opp.ai_analysis.is_relevant) {
        return false;
      }
      
      // Apply priority filter
      if (filters.priority && opp.ai_analysis.priority !== filters.priority) {
        return false;
      }
      
      // Apply keyword filter
      if (filters.keyword) {
        const keyword = filters.keyword.toLowerCase();
        const text = `${opp.title || ''} ${opp.description || ''}`.toLowerCase();
        if (!text.includes(keyword)) {
          return false;
        }
      }
      
      return true;
    });
  }

  /**
   * Get statistics about the processed opportunities
   * @param {Array} opportunities - Processed opportunities
   * @returns {Object} - Statistics
   */
  getStatistics(opportunities) {
    const stats = {
      total: opportunities.length,
      relevant: 0,
      highPriority: 0,
      mediumPriority: 0,
      lowPriority: 0,
      byTheme: {}
    };

    opportunities.forEach(opp => {
      if (!opp.ai_analysis) return;
      
      if (opp.ai_analysis.is_relevant) stats.relevant++;
      
      // Count by priority
      switch (opp.ai_analysis.priority) {
        case 'high':
          stats.highPriority++;
          break;
        case 'medium':
          stats.mediumPriority++;
          break;
        default:
          stats.lowPriority++;
      }
      
      // Count by theme
      if (Array.isArray(opp.ai_analysis.key_themes)) {
        opp.ai_analysis.key_themes.forEach(theme => {
          stats.byTheme[theme] = (stats.byTheme[theme] || 0) + 1;
        });
      }
    });

    // Sort themes by frequency
    stats.byTheme = Object.entries(stats.byTheme)
      .sort((a, b) => b[1] - a[1])
      .reduce((acc, [key, value]) => ({
        ...acc,
        [key]: value
      }), {});

    return stats;
  }
  /**
   * Extract fallback themes from opportunity text for when AI analysis fails
   * @private
   * @param {Object} opportunity - The opportunity to extract themes from
   * @returns {Array<string>} - Array of extracted themes
   */
  _extractFallbackThemes(opportunity) {
    try {
      if (!opportunity) return [];
      
      // Combine title and description
      const text = `${opportunity.title || ''} ${opportunity.description || ''}`.toLowerCase();
      
      // Simple keyword extraction as fallback
      const commonKeywords = [
        'marketing', 'business', 'technology', 'health', 'finance',
        'education', 'media', 'research', 'expert', 'interview'
      ];
      
      // Extract matching keywords
      return commonKeywords
        .filter(keyword => text.includes(keyword))
        .slice(0, 3); // Limit to 3 themes
    } catch (e) {
      console.error('Error extracting fallback themes:', e);
      return [];
    }
  }
  
  /**
   * Retry processing a previously failed opportunity
   * @param {Object} opportunity - The opportunity to retry
   * @returns {Promise<Object>} - The processed opportunity
   */
  async retryProcessing(opportunity) {
    if (!opportunity) {
      throw new Error('Cannot retry processing: No opportunity provided');
    }
    
    // Log the retry attempt
    console.log(`Retrying AI processing for opportunity: ${opportunity.id || opportunity.externalId}`);
    
    // Remove previous error and analysis
    const retryOpportunity = { ...opportunity };
    delete retryOpportunity.processing_error;
    delete retryOpportunity.ai_analysis;
    
    // Process again
    return this._processSingleOpportunity(retryOpportunity);
  }
}

// Expose as global for Chrome Extension compatibility
window.opportunityProcessor = new OpportunityProcessor();
