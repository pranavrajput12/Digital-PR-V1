/**
 * Unit tests for the utils-bridge module
 */

import { expect } from 'chai';
import { utilsBridge } from '../../modules/utils-bridge.js';

// Mock window global for tests
global.window = { opportunityUtils: {} };

describe('Utils Bridge', () => {
  describe('Property Normalization', () => {
    it('should convert snake_case to camelCase properties', () => {
      const input = {
        id: '123',
        ai_analysis: {
          relevance_score: 0.8,
          key_themes: ['tech', 'business'],
          is_relevant: true
        },
        date_posted: '2025-06-01'
      };
      
      const expected = {
        id: '123',
        aiAnalysis: {
          relevanceScore: 0.8,
          keyThemes: ['tech', 'business'],
          isRelevant: true
        },
        datePosted: '2025-06-01'
      };
      
      const result = utilsBridge.normalizeProperties(input, true);
      expect(result).to.deep.equal(expected);
    });
    
    it('should convert camelCase to snake_case properties', () => {
      const input = {
        id: '123',
        aiAnalysis: {
          relevanceScore: 0.8,
          keyThemes: ['tech', 'business'],
          isRelevant: true
        },
        datePosted: '2025-06-01'
      };
      
      const expected = {
        id: '123',
        ai_analysis: {
          relevance_score: 0.8,
          key_themes: ['tech', 'business'],
          is_relevant: true
        },
        date_posted: '2025-06-01'
      };
      
      const result = utilsBridge.normalizeProperties(input, false);
      expect(result).to.deep.equal(expected);
    });
    
    it('should handle arrays of objects', () => {
      const input = {
        items: [
          { relevance_score: 0.8 },
          { relevance_score: 0.6 }
        ]
      };
      
      const expected = {
        items: [
          { relevanceScore: 0.8 },
          { relevanceScore: 0.6 }
        ]
      };
      
      const result = utilsBridge.normalizeProperties(input);
      expect(result).to.deep.equal(expected);
    });
    
    it('should handle null or undefined values', () => {
      expect(utilsBridge.normalizeProperties(null)).to.be.null;
      expect(utilsBridge.normalizeProperties(undefined)).to.be.undefined;
      
      const input = {
        id: '123',
        aiAnalysis: null,
        items: [null, { relevanceScore: 0.8 }]
      };
      
      const result = utilsBridge.normalizeProperties(input, false);
      expect(result.ai_analysis).to.be.null;
      expect(result.items[0]).to.be.null;
    });
  });
  
  describe('ID Normalization', () => {
    it('should ensure both id and externalId exist', () => {
      // Test with only id
      const withIdOnly = { id: '123', title: 'Test' };
      const normalizedWithId = utilsBridge.normalizeOpportunityId(withIdOnly);
      expect(normalizedWithId.id).to.equal('123');
      expect(normalizedWithId.externalId).to.equal('123');
      
      // Test with only externalId
      const withExternalIdOnly = { externalId: '456', title: 'Test' };
      const normalizedWithExternalId = utilsBridge.normalizeOpportunityId(withExternalIdOnly);
      expect(normalizedWithExternalId.id).to.equal('456');
      expect(normalizedWithExternalId.externalId).to.equal('456');
      
      // Test with both
      const withBoth = { id: '789', externalId: '789', title: 'Test' };
      const normalizedWithBoth = utilsBridge.normalizeOpportunityId(withBoth);
      expect(normalizedWithBoth.id).to.equal('789');
      expect(normalizedWithBoth.externalId).to.equal('789');
    });
    
    it('should handle null or undefined values', () => {
      expect(utilsBridge.normalizeOpportunityId(null)).to.be.null;
      expect(utilsBridge.normalizeOpportunityId(undefined)).to.be.undefined;
    });
  });
  
  describe('String Case Conversion', () => {
    it('should convert snake_case to camelCase', () => {
      expect(utilsBridge.snakeToCamel('hello_world')).to.equal('helloWorld');
      expect(utilsBridge.snakeToCamel('multiple_word_string')).to.equal('multipleWordString');
      expect(utilsBridge.snakeToCamel('already_camel_case')).to.equal('alreadyCamelCase');
      expect(utilsBridge.snakeToCamel('single')).to.equal('single');
    });
    
    it('should convert camelCase to snake_case', () => {
      expect(utilsBridge.camelToSnake('helloWorld')).to.equal('hello_world');
      expect(utilsBridge.camelToSnake('multipleWordString')).to.equal('multiple_word_string');
      expect(utilsBridge.camelToSnake('single')).to.equal('single');
    });
    
    it('should handle null or undefined values', () => {
      expect(utilsBridge.snakeToCamel(null)).to.be.null;
      expect(utilsBridge.snakeToCamel(undefined)).to.be.undefined;
      expect(utilsBridge.camelToSnake(null)).to.be.null;
      expect(utilsBridge.camelToSnake(undefined)).to.be.undefined;
    });
  });
  
  describe('Date Formatting', () => {
    it('should format date strings correctly', () => {
      // Test ISO date string
      const isoDate = '2025-06-03T12:00:00Z';
      const formattedIso = utilsBridge.formatDate(isoDate);
      expect(formattedIso).to.include('2025');
      
      // Test with SourceBottle specific format
      const sbDate = '3 June 2025';
      const formattedSb = utilsBridge.formatDeadline(sbDate);
      expect(formattedSb).to.include('June 3, 2025');
    });
    
    it('should handle invalid dates gracefully', () => {
      expect(utilsBridge.formatDate(null)).to.equal('No deadline');
      expect(utilsBridge.formatDate(undefined)).to.equal('No deadline');
      expect(utilsBridge.formatDate('invalid-date')).to.be.a('string');
    });
  });
});