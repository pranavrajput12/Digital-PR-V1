/**
 * AI Enhancements Module for SourceBottle Extension
 * Provides advanced AI functionality for opportunity analysis
 */

// This module enhances the basic AI service with additional capabilities
const aiEnhancements = {
  initialized: false,
  aiService: null,

  /**
   * Initialize the AI enhancements module
   * @returns {Promise<boolean>} Whether initialization was successful
   */
  async initialize() {
    try {
      if (typeof window !== 'undefined' && window.aiService) {
        this.aiService = window.aiService;
        this.initialized = true;
        console.log('AI Enhancements initialized successfully');
        return true;
      } else {
        console.warn('AI Enhancements initialization failed: aiService not available');
        return false;
      }
    } catch (error) {
      console.error('Error initializing AI Enhancements:', error);
      return false;
    }
  },

  /**
   * Generate a personalized pitch template based on the opportunity
   * @param {Object} opportunity - The opportunity to generate a pitch for
   * @returns {Promise<Object>} - The generated pitch template
   */
  async generatePitchTemplate(opportunity) {
    if (!this.initialized || !this.aiService) {
      throw new Error('AI Enhancements not initialized');
    }

    try {
      const systemPrompt = 'You are an expert PR professional helping to create pitch templates for journalists.';
      const userPrompt = `
Create a personalized pitch template for the following opportunity:

Title: ${opportunity.title || 'N/A'}
Description: ${opportunity.description || 'N/A'}
Media Outlet: ${opportunity.mediaOutlet || 'N/A'}
Deadline: ${opportunity.deadline || 'N/A'}
Category: ${opportunity.category || 'N/A'}

Generate a structured pitch template with:
1. A compelling subject line (limited to 50-60 characters)
2. Personalized greeting
3. Brief introduction paragraph (2-3 sentences)
4. Main pitch content (3-4 bullet points of key messaging)
5. Call-to-action
6. Professional sign-off

Format your response as a JSON object with the following structure:
{
  "subject_line": "Your subject line here",
  "greeting": "Personalized greeting",
  "introduction": "Introduction paragraph",
  "key_points": ["Point 1", "Point 2", "Point 3"],
  "call_to_action": "Call to action text",
  "sign_off": "Professional sign-off"
}
`;

      const response = await this._makeAIRequest(systemPrompt, userPrompt);
      return this._parsePitchTemplateResponse(response);
    } catch (error) {
      console.error('Error generating pitch template:', error);
      return {
        error: true,
        message: 'Failed to generate pitch template: ' + error.message
      };
    }
  },

  /**
   * Generate a competitive analysis for the opportunity
   * @param {Object} opportunity - The opportunity to analyze
   * @returns {Promise<Object>} - Competitive analysis
   */
  async generateCompetitiveAnalysis(opportunity) {
    if (!this.initialized || !this.aiService) {
      throw new Error('AI Enhancements not initialized');
    }

    try {
      const systemPrompt = 'You are a strategic PR advisor helping to analyze media opportunities.';
      const userPrompt = `
Provide a competitive analysis for the following PR opportunity:

Title: ${opportunity.title || 'N/A'}
Description: ${opportunity.description || 'N/A'}
Media Outlet: ${opportunity.mediaOutlet || 'N/A'}
Category: ${opportunity.category || 'N/A'}

Generate a competitive analysis with:
1. Potential competitors likely to respond to this opportunity
2. Unique angles to stand out from competition
3. Recommended approach to maximize chance of selection
4. Key differentiators to emphasize

Format your response as a JSON object with the following structure:
{
  "potential_competitors": ["Type 1", "Type 2", "Type 3"],
  "unique_angles": ["Angle 1", "Angle 2"],
  "recommended_approach": "Detailed approach recommendation",
  "key_differentiators": ["Differentiator 1", "Differentiator 2"]
}
`;

      const response = await this._makeAIRequest(systemPrompt, userPrompt);
      return this._parseCompetitiveAnalysisResponse(response);
    } catch (error) {
      console.error('Error generating competitive analysis:', error);
      return {
        error: true,
        message: 'Failed to generate competitive analysis: ' + error.message
      };
    }
  },

  /**
   * Generate a summary of key action items for the opportunity
   * @param {Object} opportunity - The opportunity to summarize
   * @returns {Promise<Object>} - Summary with action items
   */
  async generateActionableSummary(opportunity) {
    if (!this.initialized || !this.aiService) {
      throw new Error('AI Enhancements not initialized');
    }

    try {
      const systemPrompt = 'You are a PR strategy assistant helping professionals prioritize opportunities.';
      const userPrompt = `
Create an actionable summary for the following opportunity:

Title: ${opportunity.title || 'N/A'}
Description: ${opportunity.description || 'N/A'}
Media Outlet: ${opportunity.mediaOutlet || 'N/A'}
Deadline: ${opportunity.deadline || 'N/A'}
Category: ${opportunity.category || 'N/A'}

Generate a concise summary with:
1. One-sentence opportunity summary
2. Key decision criteria (why pursue or skip)
3. 3-5 specific action items with timeframes
4. Required resources or expertise

Format your response as a JSON object with the following structure:
{
  "summary": "One-sentence summary",
  "decision_criteria": ["Criterion 1", "Criterion 2"],
  "action_items": [
    {"action": "Action 1", "timeframe": "Timeframe 1"},
    {"action": "Action 2", "timeframe": "Timeframe 2"}
  ],
  "required_resources": ["Resource 1", "Resource 2"]
}
`;

      const response = await this._makeAIRequest(systemPrompt, userPrompt);
      return this._parseActionableSummaryResponse(response);
    } catch (error) {
      console.error('Error generating actionable summary:', error);
      return {
        error: true,
        message: 'Failed to generate actionable summary: ' + error.message
      };
    }
  },

  /**
   * Make a request to the AI service
   * @private
   */
  async _makeAIRequest(systemPrompt, userPrompt) {
    try {
      // Use the existing AI service to make the request
      const result = await this.aiService._post({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 1000,
      });

      return result?.choices?.[0]?.message?.content || '';
    } catch (error) {
      console.error('Error making AI request:', error);
      throw error;
    }
  },

  /**
   * Parse the pitch template response
   * @private
   */
  _parsePitchTemplateResponse(response) {
    try {
      // Try to parse the JSON response
      let parsedResponse;
      try {
        parsedResponse = typeof response === 'string' ? JSON.parse(response) : response;
      } catch (error) {
        // If direct parsing fails, try to extract JSON using regex
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsedResponse = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('Invalid response format');
        }
      }

      // Validate and return the parsed response
      return {
        subject_line: parsedResponse.subject_line || 'N/A',
        greeting: parsedResponse.greeting || 'N/A',
        introduction: parsedResponse.introduction || 'N/A',
        key_points: Array.isArray(parsedResponse.key_points) ? parsedResponse.key_points : [],
        call_to_action: parsedResponse.call_to_action || 'N/A',
        sign_off: parsedResponse.sign_off || 'N/A'
      };
    } catch (error) {
      console.error('Error parsing pitch template response:', error);
      return {
        error: true,
        message: 'Failed to parse pitch template response: ' + error.message,
        raw_response: response
      };
    }
  },

  /**
   * Parse the competitive analysis response
   * @private
   */
  _parseCompetitiveAnalysisResponse(response) {
    try {
      // Try to parse the JSON response
      let parsedResponse;
      try {
        parsedResponse = typeof response === 'string' ? JSON.parse(response) : response;
      } catch (error) {
        // If direct parsing fails, try to extract JSON using regex
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsedResponse = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('Invalid response format');
        }
      }

      // Validate and return the parsed response
      return {
        potential_competitors: Array.isArray(parsedResponse.potential_competitors) ? parsedResponse.potential_competitors : [],
        unique_angles: Array.isArray(parsedResponse.unique_angles) ? parsedResponse.unique_angles : [],
        recommended_approach: parsedResponse.recommended_approach || 'N/A',
        key_differentiators: Array.isArray(parsedResponse.key_differentiators) ? parsedResponse.key_differentiators : []
      };
    } catch (error) {
      console.error('Error parsing competitive analysis response:', error);
      return {
        error: true,
        message: 'Failed to parse competitive analysis response: ' + error.message,
        raw_response: response
      };
    }
  },

  /**
   * Parse the actionable summary response
   * @private
   */
  _parseActionableSummaryResponse(response) {
    try {
      // Try to parse the JSON response
      let parsedResponse;
      try {
        parsedResponse = typeof response === 'string' ? JSON.parse(response) : response;
      } catch (error) {
        // If direct parsing fails, try to extract JSON using regex
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsedResponse = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('Invalid response format');
        }
      }

      // Validate and return the parsed response
      return {
        summary: parsedResponse.summary || 'N/A',
        decision_criteria: Array.isArray(parsedResponse.decision_criteria) ? parsedResponse.decision_criteria : [],
        action_items: Array.isArray(parsedResponse.action_items) ? parsedResponse.action_items : [],
        required_resources: Array.isArray(parsedResponse.required_resources) ? parsedResponse.required_resources : []
      };
    } catch (error) {
      console.error('Error parsing actionable summary response:', error);
      return {
        error: true,
        message: 'Failed to parse actionable summary response: ' + error.message,
        raw_response: response
      };
    }
  }
};

// Expose as global for Chrome Extension compatibility
window.aiEnhancements = aiEnhancements;
