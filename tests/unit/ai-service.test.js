/**
 * Unit tests for the AIService module
 */

import { expect } from 'chai';
import sinon from 'sinon';

// Mock window object
global.window = {
  keywordManager: {
    initialize: sinon.stub().resolves(),
    getThemes: sinon.stub().resolves([])
  },
  embeddingCache: {
    initialize: sinon.stub().resolves(),
    getEmbedding: sinon.stub()
  },
  PromptTemplates: {
    systemPrompt: 'You are an AI assistant',
    prompts: {
      prioritize: 'Analyze this opportunity: {{title}}, {{description}}'
    }
  }
};

// Mock localStorage
global.localStorage = {
  getItem: sinon.stub(),
  setItem: sinon.stub(),
  removeItem: sinon.stub()
};

// Mock fetch API
global.fetch = sinon.stub();

// Import the module - assuming it's been converted to ESM for testing
import { AIService } from '../../modules/aiService.js';

describe('AIService', () => {
  let aiService;
  let fetchStub;
  
  beforeEach(() => {
    // Reset stubs
    sinon.reset();
    
    // Create a fresh instance for each test
    aiService = new AIService({
      apiKey: 'test-api-key',
      resourceName: 'test-resource',
      deploymentId: 'test-deployment',
      apiVersion: '2023-05-15'
    });
    
    // Mock successful fetch response
    fetchStub = global.fetch;
    fetchStub.resolves({
      ok: true,
      json: async () => ({ data: [{ embedding: Array(1536).fill(0.1) }] })
    });
  });
  
  describe('initialization', () => {
    it('should initialize with provided configuration', () => {
      expect(aiService.apiKey).to.equal('test-api-key');
      expect(aiService.resourceName).to.equal('test-resource');
      expect(aiService.deploymentId).to.equal('test-deployment');
      expect(aiService.apiVersion).to.equal('2023-05-15');
    });
    
    it('should load settings from localStorage on initialization', async () => {
      localStorage.getItem.returns(JSON.stringify({
        apiKey: 'stored-api-key',
        resourceName: 'stored-resource',
        deploymentId: 'stored-deployment',
        apiVersion: 'stored-api-version'
      }));
      
      await aiService._doInitialize();
      
      expect(localStorage.getItem.calledOnce).to.be.true;
      expect(aiService.apiKey).to.equal('stored-api-key');
    });
    
    it('should validate API key format', async () => {
      aiService.apiKey = 'invalid@key!';
      const result = await aiService._doInitialize();
      expect(result).to.be.false;
    });
  });
  
  describe('embedding generation', () => {
    it('should call Azure OpenAI API to generate embeddings', async () => {
      aiService._initialized = true;
      
      await aiService._generateEmbeddingFromAPI('test text');
      
      expect(fetchStub.calledOnce).to.be.true;
      const [url, options] = fetchStub.firstCall.args;
      
      expect(url).to.include('https://test-resource.openai.azure.com/openai/deployments/test-deployment/embeddings');
      expect(options.headers['api-key']).to.equal('test-api-key');
      expect(JSON.parse(options.body).input).to.equal('test text');
    });
    
    it('should throw an error for empty text', async () => {
      aiService._initialized = true;
      
      try {
        await aiService._generateEmbeddingFromAPI('');
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Invalid text input');
      }
    });
    
    it('should handle API errors gracefully', async () => {
      aiService._initialized = true;
      
      fetchStub.resolves({
        ok: false,
        status: 400,
        text: async () => 'Invalid request'
      });
      
      try {
        await aiService._generateEmbeddingFromAPI('test text');
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Azure OpenAI API embedding error');
      }
    });
    
    it('should use cache when available', async () => {
      aiService._initialized = true;
      const mockEmbedding = Array(1536).fill(0.2);
      
      window.embeddingCache.getEmbedding.callsFake((text, generateFn) => {
        return Promise.resolve(mockEmbedding);
      });
      
      const result = await aiService.getEmbedding('test text');
      
      expect(result).to.deep.equal(mockEmbedding);
      expect(window.embeddingCache.getEmbedding.calledOnce).to.be.true;
      expect(fetchStub.called).to.be.false; // Should not call API directly
    });
  });
  
  describe('semantic similarity', () => {
    it('should compute cosine similarity correctly', () => {
      const a = [1, 0, 0];
      const b = [0, 1, 0];
      const c = [1, 1, 0];
      
      expect(aiService.computeSimilarity(a, a)).to.equal(1); // Same vector
      expect(aiService.computeSimilarity(a, b)).to.equal(0); // Orthogonal
      expect(aiService.computeSimilarity(a, c)).to.be.closeTo(0.7071, 0.0001); // 45 degrees
    });
    
    it('should check semantic similarity against canonical themes', async () => {
      aiService._initialized = true;
      
      // Mock the embeddings
      const textEmbedding = Array(3).fill(0.5);
      const theme1Embedding = [1, 0, 0];
      const theme2Embedding = [0.5, 0.5, 0.5]; // More similar to textEmbedding
      
      sinon.stub(aiService, 'getEmbedding')
        .onFirstCall().resolves(textEmbedding)
        .onSecondCall().resolves(theme1Embedding)
        .onThirdCall().resolves(theme2Embedding);
      
      sinon.stub(aiService, 'computeSimilarity')
        .onFirstCall().returns(0.3) // First theme
        .onSecondCall().returns(0.9); // Second theme
      
      const result = await aiService.checkSemanticSimilarity('test text', [
        { text: 'Theme 1' },
        { text: 'Theme 2' }
      ]);
      
      expect(result.isSimilar).to.be.true;
      expect(result.score).to.equal(0.9);
      expect(result.bestMatchTheme).to.equal('Theme 2');
    });
  });
  
  describe('opportunity classification', () => {
    it('should use semantic similarity if classifier is not available', async () => {
      aiService._initialized = true;
      
      // Mock semantic similarity
      sinon.stub(aiService, 'checkSemanticSimilarity').resolves({
        isSimilar: true,
        score: 0.75
      });
      
      const result = await aiService.classifyOpportunity({
        title: 'Test opportunity',
        description: 'This is a test'
      });
      
      expect(result.isRelevant).to.be.true;
      expect(result.confidence).to.equal(0.75);
      expect(result.method).to.equal('similarity');
    });
  });
  
  describe('API error handling', () => {
    it('should retry transient errors with exponential backoff', async () => {
      aiService._initialized = true;
      
      // Make fetch fail with a 429 error first, then succeed
      fetchStub.onFirstCall().resolves({
        ok: false,
        status: 429,
        text: async () => 'Too many requests'
      });
      
      fetchStub.onSecondCall().resolves({
        ok: true,
        json: async () => ({ 
          choices: [{ 
            message: { 
              content: JSON.stringify({ relevance_score: 0.8, priority: 'high', key_themes: [], confidence: 0.9, reasoning: 'Test' }) 
            } 
          }] 
        })
      });
      
      // Mock setTimeout to avoid waiting in tests
      const originalSetTimeout = global.setTimeout;
      global.setTimeout = (fn) => fn();
      
      const payload = { messages: [] };
      const result = await aiService._post(payload);
      
      expect(fetchStub.calledTwice).to.be.true;
      expect(result.choices).to.exist;
      
      // Restore setTimeout
      global.setTimeout = originalSetTimeout;
    });
  });
});