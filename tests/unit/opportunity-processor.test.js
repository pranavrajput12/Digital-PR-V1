/**
 * Unit tests for the OpportunityProcessor module
 */

import { expect } from 'chai';
import sinon from 'sinon';

// Mock window object
global.window = {
  aiService: {
    initialize: sinon.stub().resolves(true),
    analyzeOpportunity: sinon.stub(),
    analyzeSentiment: sinon.stub()
  },
  opportunityCache: {
    findSimilarOpportunity: sinon.stub(),
    cacheOpportunityAnalysis: sinon.stub()
  },
  errorTracker: {
    trackEvent: sinon.stub()
  },
  notificationService: {
    showError: sinon.stub()
  }
};

// Import the module - assuming it's been converted to ESM for testing
import { OpportunityProcessor } from '../../modules/opportunityProcessor.js';

describe('OpportunityProcessor', () => {
  let processor;
  let aiServiceMock;
  
  beforeEach(() => {
    // Reset stubs
    sinon.reset();
    
    // Create a fresh instance for each test
    processor = new OpportunityProcessor();
    
    // Mock successful initialization
    processor.initialized = true;
    processor.aiService = window.aiService;
    
    // Shorthand reference
    aiServiceMock = window.aiService;
    
    // Set up default successful response from AI service
    aiServiceMock.analyzeOpportunity.resolves({
      relevance_score: 0.8,
      priority: 'high',
      key_themes: ['business', 'technology'],
      confidence: 0.9,
      reasoning: 'Test reasoning'
    });
    
    aiServiceMock.analyzeSentiment.resolves({
      sentiment_score: 0.7,
      sentiment_label: 'positive',
      key_emotional_indicators: ['excellent', 'innovative'],
      confidence: 0.85
    });
  });
  
  describe('initialization', () => {
    it('should initialize with aiService', async () => {
      // Reset initialized state for this test
      processor.initialized = false;
      
      const result = await processor.initialize();
      
      expect(result).to.be.true;
      expect(aiServiceMock.initialize.calledOnce).to.be.true;
      expect(processor.initialized).to.be.true;
    });
    
    it('should handle initialization failure', async () => {
      // Reset initialized state for this test
      processor.initialized = false;
      
      // Make aiService initialization fail
      aiServiceMock.initialize.resolves(false);
      
      const result = await processor.initialize();
      
      expect(result).to.be.false;
      expect(processor.initialized).to.be.false;
    });
  });
  
  describe('opportunity processing', () => {
    it('should process an opportunity successfully', async () => {
      const opportunity = {
        id: 'test-1',
        title: 'Test Opportunity',
        description: 'This is a test opportunity'
      };
      
      const result = await processor._processSingleOpportunity(opportunity);
      
      expect(result.id).to.equal('test-1');
      expect(result.ai_analysis).to.exist;
      expect(result.ai_analysis.relevance_score).to.equal(0.8);
      expect(result.ai_analysis.priority).to.equal('high');
      expect(result.ai_analysis.key_themes).to.deep.equal(['business', 'technology']);
      
      // Verify API calls
      expect(aiServiceMock.analyzeOpportunity.calledOnce).to.be.true;
      expect(aiServiceMock.analyzeSentiment.calledOnce).to.be.true;
    });
    
    it('should use cached analysis when available', async () => {
      const opportunity = {
        id: 'test-2',
        title: 'Cached Opportunity',
        description: 'This opportunity has a cached analysis'
      };
      
      // Mock cache hit
      window.opportunityCache.findSimilarOpportunity.returns({
        relevance_score: 0.6,
        priority: 'medium',
        key_themes: ['cached'],
        confidence: 0.7,
        reasoning: 'Cached reasoning',
        reused_from: 'original-id',
        similarity_score: 0.95
      });
      
      const result = await processor._processSingleOpportunity(opportunity);
      
      expect(result.ai_analysis.relevance_score).to.equal(0.6);
      expect(result.ai_analysis.cached).to.be.true;
      
      // Should not call AI service for analysis
      expect(aiServiceMock.analyzeOpportunity.called).to.be.false;
      
      // Should still call for sentiment analysis
      expect(aiServiceMock.analyzeSentiment.calledOnce).to.be.true;
    });
    
    it('should handle AI service errors gracefully', async () => {
      const opportunity = {
        id: 'test-3',
        title: 'Error Opportunity',
        description: 'This opportunity will trigger an error'
      };
      
      // Make AI service throw an error
      const testError = new Error('Test AI service error');
      aiServiceMock.analyzeOpportunity.rejects(testError);
      
      const result = await processor._processSingleOpportunity(opportunity);
      
      // Should have error information
      expect(result.processing_error).to.exist;
      expect(result.processing_error.message).to.equal('Test AI service error');
      expect(result.processing_error.recoverable).to.be.true;
      
      // Should have fallback analysis
      expect(result.ai_analysis).to.exist;
      expect(result.ai_analysis.is_fallback).to.be.true;
      expect(result.ai_analysis.priority).to.equal('medium');
      
      // Should track the error
      expect(window.errorTracker.trackEvent.calledOnce).to.be.true;
      expect(window.notificationService.showError.calledOnce).to.be.true;
    });
    
    it('should extract fallback themes when analysis fails', async () => {
      // Test the fallback theme extraction
      const opportunity = {
        title: 'Marketing Business Technology',
        description: 'This contains several keywords like health and education'
      };
      
      const themes = processor._extractFallbackThemes(opportunity);
      
      expect(themes).to.be.an('array');
      expect(themes.length).to.be.at.most(3);
      expect(themes).to.include('marketing');
      expect(themes).to.include('business');
      expect(themes).to.include('technology');
    });
  });
  
  describe('retry functionality', () => {
    it('should allow retrying failed opportunities', async () => {
      const failedOpportunity = {
        id: 'failed-1',
        title: 'Failed Opportunity',
        description: 'This opportunity failed previously',
        processing_error: {
          message: 'Previous error',
          timestamp: new Date().toISOString()
        },
        ai_analysis: {
          is_fallback: true,
          relevance_score: 0.5,
          priority: 'medium'
        }
      };
      
      // Set up success for retry
      aiServiceMock.analyzeOpportunity.resolves({
        relevance_score: 0.9,
        priority: 'high',
        key_themes: ['retry', 'success'],
        confidence: 0.95
      });
      
      const result = await processor.retryProcessing(failedOpportunity);
      
      // Should not have error or fallback analysis anymore
      expect(result.processing_error).to.be.undefined;
      expect(result.ai_analysis.is_fallback).to.be.undefined;
      expect(result.ai_analysis.relevance_score).to.equal(0.9);
      
      // Should have called AI service
      expect(aiServiceMock.analyzeOpportunity.calledOnce).to.be.true;
    });
    
    it('should validate input for retry', async () => {
      try {
        await processor.retryProcessing(null);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Cannot retry processing');
      }
    });
  });
  
  describe('batch processing', () => {
    it('should process multiple opportunities', async () => {
      const opportunities = [
        { id: 'batch-1', title: 'Batch 1', description: 'First batch item' },
        { id: 'batch-2', title: 'Batch 2', description: 'Second batch item' }
      ];
      
      // Create spy for _processSingleOpportunity
      const processSpy = sinon.spy(processor, '_processSingleOpportunity');
      
      const results = await processor.processOpportunities(opportunities);
      
      expect(results.length).to.equal(2);
      expect(processSpy.calledTwice).to.be.true;
      
      // Should be sorted by relevance (descending)
      expect(results[0].ai_analysis.relevance_score).to.be.at.least(
        results[1].ai_analysis.relevance_score
      );
    });
    
    it('should handle empty input gracefully', async () => {
      const results = await processor.processOpportunities([]);
      expect(results).to.deep.equal([]);
      
      const nullResults = await processor.processOpportunities(null);
      expect(nullResults).to.deep.equal([]);
    });
  });
});