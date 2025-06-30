/**
 * Prompt templates for the Azure OpenAI integration
 * Centralizes all prompt content for easier maintenance and customization
 */

const PromptTemplates = {
  // Base context template used in all prompts
  baseContext: 
`Analyze this PR opportunity for SourceBottle, a platform connecting experts with media opportunities.

Focus on these aspects:
- Relevance to the subject matter
- Potential value to SourceBottle users
- Newsworthiness and timeliness
- Media outlet reach and authority

Opportunity Details:
Title: {{title}}
Description: {{description}}
Media Outlet: {{mediaOutlet}}
Deadline: {{deadline}}`,

  // Specific prompt templates for different analysis types
  prompts: {
    // Summarize the opportunity concisely
    'summarize': 
`{{baseContext}}

Provide a concise 2-3 sentence summary focusing on why this matters for relevant experts.`,

    // Categorize and tag the opportunity
    'categorize': 
`{{baseContext}}

Categorize this opportunity and suggest 3-5 relevant tags (comma-separated):`,

    // Prioritize the opportunity with structured output
    'prioritize': 
`{{baseContext}}

Provide analysis in this JSON format:
{
  "relevance_score": 0.0-1.0,  // How relevant is this opportunity?
  "priority": "high|medium|low",  // Priority level
  "key_themes": ["theme1", "theme2"],  // Key themes
  "confidence": 0.0-1.0,  // Confidence in the analysis
  "reasoning": "Brief explanation"  // Why this score was given
}`,

    // Suggest a response to the opportunity
    'suggest-response': 
`{{baseContext}}

Suggest a professional 2-3 sentence response that an expert could use to respond to this opportunity.`
  },
  
  // Default system prompt for AI context
  systemPrompt: 'You are an AI assistant for SourceBottle, a platform connecting experts with media opportunities.'
};

// Template processing helper function
function renderTemplate(template, data) {
  return template.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
    // Handle nested templates (like baseContext)
    if (key === 'baseContext') {
      return renderTemplate(PromptTemplates.baseContext, data);
    }
    
    // Return the value or a fallback
    return data[key] || 'N/A';
  });
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { PromptTemplates, renderTemplate };
}

// Expose to window for browser/extension usage
if (typeof window !== 'undefined') {
  window.PromptTemplates = PromptTemplates;
  window.renderTemplate = renderTemplate;
}
