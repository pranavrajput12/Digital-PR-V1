/**
 * OpportunityClassifier Module for SourceBottle Extension
 * Provides a lightweight machine learning classifier for opportunity relevance
 * Implements logistic regression with feature extraction from opportunities
 */

class OpportunityClassifier {
  constructor(aiService) {
    // Reference to AIService for getting embeddings
    this.aiService = aiService;
    
    // Classification model
    this.weights = null;
    this.bias = 0;
    
    // Learning rate for training
    this.learningRate = 0.1;
    
    // Training dataset
    this.trainingData = {
      relevant: [], // Array of relevant opportunities
      irrelevant: [] // Array of irrelevant opportunities
    };
    
    // Feature extraction configuration
    this.featureConfig = {
      useEmbeddings: true,
      useKeywordGroups: true,
      useDeadlineUrgency: true,
      useEntityCounts: true
    };
    
    // Load saved model if available
    this._loadModel();
  }
  
  /**
   * Check if the classifier has been trained
   * @returns {boolean} Whether the model is trained and ready
   */
  isTrained() {
    return this.weights !== null;
  }
  
  /**
   * Extract features from an opportunity
   * @param {Object} opportunity - The opportunity to extract features from
   * @returns {Promise<Array<number>>} Feature vector
   */
  async extractFeatures(opportunity) {
    const features = [];
    
    // Get embedding similarity if enabled and available
    if (this.featureConfig.useEmbeddings && this.aiService) {
      try {
        const title = opportunity.title || '';
        const description = opportunity.description || '';
        const combinedText = `${title} ${description}`;
        
        // Get semantic similarity score
        const { score } = await this.aiService.checkSemanticSimilarity(combinedText);
        features.push(score);
      } catch (error) {
        console.error('Error getting embedding similarity:', error);
        features.push(0);
      }
    }
    
    // Get keyword group scores if enabled
    if (this.featureConfig.useKeywordGroups && this.aiService) {
      const title = opportunity.title || '';
      const description = opportunity.description || '';
      
      // Extract scores for each keyword group
      for (const [groupName, groupData] of Object.entries(this.aiService.KEYWORD_GROUPS)) {
        let groupScore = 0;
        
        // Check for each term in the group
        for (const term of groupData.terms) {
          const regex = new RegExp(`\\b${term}\\b`, 'gi');
          
          // Count matches in title (with higher weight)
          const titleMatches = (title.match(regex) || []).length;
          
          // Count matches in description
          const descMatches = (description.match(regex) || []).length;
          
          // Weighted score for this term
          groupScore += (titleMatches * 1.5 + descMatches) * groupData.weight;
        }
        
        // Normalize group score
        groupScore = Math.min(groupScore / (groupData.terms.length * 2), 1.0);
        features.push(groupScore);
      }
    }
    
    // Extract deadline urgency if enabled
    if (this.featureConfig.useDeadlineUrgency) {
      let urgency = 0;
      
      if (opportunity.deadline) {
        try {
          const deadlineDate = new Date(opportunity.deadline);
          const currentDate = new Date();
          
          // Calculate days until deadline
          const daysUntilDeadline = Math.max(0, Math.floor((deadlineDate - currentDate) / (1000 * 60 * 60 * 24)));
          
          // Convert to urgency score (closer deadline = higher urgency)
          if (daysUntilDeadline <= 1) {
            urgency = 1.0; // Immediate (0-1 days)
          } else if (daysUntilDeadline <= 3) {
            urgency = 0.8; // Very soon (2-3 days)
          } else if (daysUntilDeadline <= 7) {
            urgency = 0.6; // This week (4-7 days)
          } else if (daysUntilDeadline <= 14) {
            urgency = 0.4; // Next week (8-14 days)
          } else if (daysUntilDeadline <= 30) {
            urgency = 0.2; // This month (15-30 days)
          } else {
            urgency = 0.1; // Future (30+ days)
          }
        } catch (error) {
          console.error('Error parsing deadline:', error);
        }
      }
      
      features.push(urgency);
    }
    
    // Extract entity counts if enabled
    if (this.featureConfig.useEntityCounts) {
      const text = `${opportunity.title || ''} ${opportunity.description || ''}`;
      
      // Count currency mentions (simple regex for USD, EUR, etc.)
      const currencyMatches = (text.match(/\$|\€|\£|\¥|[0-9]+\s*(dollars|euros|pounds)/gi) || []).length;
      const normalizedCurrencyScore = Math.min(currencyMatches / 5, 1.0);
      features.push(normalizedCurrencyScore);
      
      // Count company mentions (simple heuristic)
      const companyMatches = (text.match(/\b(inc|llc|ltd|corp|company|co\.|group)\b/gi) || []).length;
      const normalizedCompanyScore = Math.min(companyMatches / 3, 1.0);
      features.push(normalizedCompanyScore);
    }
    
    return features;
  }
  
  /**
   * Predict the relevance of an opportunity
   * @param {Object} opportunity - The opportunity to classify
   * @returns {Promise<{isRelevant: boolean, confidence: number}>} Classification result
   */
  async predict(opportunity) {
    if (!this.isTrained()) {
      console.warn('Classifier not trained yet, returning default classification');
      return { isRelevant: false, confidence: 0.5 };
    }
    
    try {
      // Extract features from opportunity
      const features = await this.extractFeatures(opportunity);
      
      // Apply logistic regression
      let z = this.bias;
      for (let i = 0; i < features.length; i++) {
        z += features[i] * this.weights[i];
      }
      
      // Apply sigmoid function to get probability
      const probability = 1 / (1 + Math.exp(-z));
      
      return {
        isRelevant: probability >= 0.5,
        confidence: probability
      };
    } catch (error) {
      console.error('Error predicting opportunity relevance:', error);
      return { isRelevant: false, confidence: 0.5 };
    }
  }
  
  /**
   * Add an opportunity to the training dataset
   * @param {Object} opportunity - The opportunity to add
   * @param {boolean} isRelevant - Whether the opportunity is relevant
   */
  addTrainingExample(opportunity, isRelevant) {
    if (isRelevant) {
      this.trainingData.relevant.push(opportunity);
    } else {
      this.trainingData.irrelevant.push(opportunity);
    }
    
    // Save updated training data
    this._saveTrainingData();
    
    console.log(`Added ${isRelevant ? 'relevant' : 'irrelevant'} training example. Total examples: ${this.getTrainingDataCount()}`);
  }
  
  /**
   * Get the total number of training examples
   * @returns {number} Total number of examples
   */
  getTrainingDataCount() {
    return this.trainingData.relevant.length + this.trainingData.irrelevant.length;
  }
  
  /**
   * Train the classifier on the current training dataset
   * @param {number} epochs - Number of training epochs
   * @returns {Promise<{success: boolean, error: string?}>} Training result
   */
  async train(epochs = 50) {
    const relevantCount = this.trainingData.relevant.length;
    const irrelevantCount = this.trainingData.irrelevant.length;
    
    if (relevantCount < 3 || irrelevantCount < 3) {
      console.error('Not enough training data. Need at least 3 examples of each class.');
      return { 
        success: false, 
        error: `Not enough training data. Current data: ${relevantCount} relevant, ${irrelevantCount} irrelevant. Need at least 3 of each.` 
      };
    }
    
    try {
      console.log(`Training classifier on ${relevantCount} relevant and ${irrelevantCount} irrelevant opportunities...`);
      
      // Extract features for all training examples
      const trainingFeatures = [];
      const trainingLabels = [];
      
      // Process relevant examples (label 1)
      for (const opportunity of this.trainingData.relevant) {
        const features = await this.extractFeatures(opportunity);
        trainingFeatures.push(features);
        trainingLabels.push(1);
      }
      
      // Process irrelevant examples (label 0)
      for (const opportunity of this.trainingData.irrelevant) {
        const features = await this.extractFeatures(opportunity);
        trainingFeatures.push(features);
        trainingLabels.push(0);
      }
      
      // Initialize weights if not already set
      if (!this.weights) {
        this.weights = new Array(trainingFeatures[0].length).fill(0);
        this.bias = 0;
      }
      
      // Train logistic regression model with gradient descent
      for (let epoch = 0; epoch < epochs; epoch++) {
        for (let i = 0; i < trainingFeatures.length; i++) {
          const features = trainingFeatures[i];
          const label = trainingLabels[i];
          
          // Make prediction
          let z = this.bias;
          for (let j = 0; j < features.length; j++) {
            z += features[j] * this.weights[j];
          }
          const prediction = 1 / (1 + Math.exp(-z));
          
          // Compute error
          const error = prediction - label;
          
          // Update bias
          this.bias -= this.learningRate * error;
          
          // Update weights
          for (let j = 0; j < features.length; j++) {
            this.weights[j] -= this.learningRate * error * features[j];
          }
        }
      }
      
      // Save trained model
      this._saveModel();
      
      console.log('Classifier training completed successfully.');
      return { success: true };
    } catch (error) {
      console.error('Error training classifier:', error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Reset the classifier to its initial state
   */
  reset() {
    this.weights = null;
    this.bias = 0;
    this.trainingData = { relevant: [], irrelevant: [] };
    this._saveModel();
    this._saveTrainingData();
    console.log('Classifier reset to initial state.');
  }
  
  /**
   * Save the model to Chrome storage
   * @private
   */
  _saveModel() {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      const modelData = {
        weights: this.weights,
        bias: this.bias
      };
      
      chrome.storage.local.set({ opportunityClassifierModel: modelData }, () => {
        console.log('Classifier model saved to storage.');
      });
    }
  }
  
  /**
   * Save training data to Chrome storage
   * @private
   */
  _saveTrainingData() {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.set({ opportunityClassifierData: this.trainingData }, () => {
        console.log('Classifier training data saved to storage.');
      });
    }
  }
  
  /**
   * Load the model from Chrome storage
   * @private
   */
  _loadModel() {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.get(['opportunityClassifierModel', 'opportunityClassifierData'], (result) => {
        if (result.opportunityClassifierModel) {
          console.log('Loaded classifier model from storage.');
          this.weights = result.opportunityClassifierModel.weights;
          this.bias = result.opportunityClassifierModel.bias;
        }
        
        if (result.opportunityClassifierData) {
          console.log('Loaded classifier training data from storage.');
          this.trainingData = result.opportunityClassifierData;
        }
      });
    }
  }
}

// Export the classifier
window.OpportunityClassifier = OpportunityClassifier;
