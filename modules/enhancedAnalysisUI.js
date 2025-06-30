/**
 * Enhanced Analysis UI Module for SourceBottle Extension
 * Provides UI components for displaying advanced AI analysis results
 */

const enhancedAnalysisUI = {
  // Cache DOM elements when initialized
  elements: {
    modalContainer: null,
    pitchSection: null,
    competitiveSection: null,
    summarySection: null,
    loadingIndicator: null,
    errorMessage: null,
  },

  /**
   * Initialize the UI module
   */
  initialize() {
    // Create the enhanced analysis modal if it doesn't exist
    if (!document.getElementById('enhanced-analysis-modal')) {
      this._createModal();
    }
    
    // Cache DOM elements
    this.elements.modalContainer = document.getElementById('enhanced-analysis-modal');
    this.elements.pitchSection = document.getElementById('pitch-template-section');
    this.elements.competitiveSection = document.getElementById('competitive-analysis-section');
    this.elements.summarySection = document.getElementById('actionable-summary-section');
    this.elements.loadingIndicator = document.getElementById('enhanced-analysis-loading');
    this.elements.errorMessage = document.getElementById('enhanced-analysis-error');
    
    // Set up event listeners
    const closeBtn = document.getElementById('close-enhanced-analysis');
    if (closeBtn) {
      closeBtn.addEventListener('click', this.hideModal.bind(this));
    }
    
    console.log('Enhanced Analysis UI initialized');
  },

  /**
   * Show the enhanced analysis modal for an opportunity
   * @param {Object} opportunity - The opportunity to analyze
   * @param {boolean} runAnalysis - Whether to automatically run the analysis
   */
  async showForOpportunity(opportunity, runAnalysis = false) {
    if (!this.elements.modalContainer) this.initialize();
    
    // Set the opportunity ID as a data attribute
    this.elements.modalContainer.dataset.opportunityId = opportunity.id;
    this.elements.modalContainer.querySelector('h2').textContent = 
      `Enhanced Analysis: ${opportunity.title || 'Opportunity'}`;
    
    // Clear previous content
    this._clearSections();
    
    // Show the modal
    this.elements.modalContainer.classList.remove('hidden');
    document.body.classList.add('modal-open');
    
    // Automatically run analysis if requested
    if (runAnalysis) {
      this.runAnalysis(opportunity);
    } else {
      // Show the run analysis button
      const runButton = document.getElementById('run-enhanced-analysis');
      if (runButton) {
        runButton.classList.remove('hidden');
        runButton.onclick = () => this.runAnalysis(opportunity);
      }
    }
  },

  /**
   * Hide the enhanced analysis modal
   */
  hideModal() {
    if (!this.elements.modalContainer) return;
    
    this.elements.modalContainer.classList.add('hidden');
    document.body.classList.remove('modal-open');
  },

  /**
   * Run the enhanced analysis for an opportunity
   * @param {Object} opportunity - The opportunity to analyze
   */
  async runAnalysis(opportunity) {
    if (!window.aiEnhancements) {
      this._showError('AI Enhancements module not available');
      return;
    }
    
    // Hide the run button and show loading indicator
    const runButton = document.getElementById('run-enhanced-analysis');
    if (runButton) runButton.classList.add('hidden');
    
    this._showLoading(true);
    this._hideError();
    
    try {
      // Initialize AI enhancements if needed
      if (!window.aiEnhancements.initialized) {
        await window.aiEnhancements.initialize();
      }
      
      // Run all analyses in parallel
      const [pitchTemplate, competitiveAnalysis, actionableSummary] = await Promise.all([
        window.aiEnhancements.generatePitchTemplate(opportunity),
        window.aiEnhancements.generateCompetitiveAnalysis(opportunity),
        window.aiEnhancements.generateActionableSummary(opportunity)
      ]);
      
      // Render the results
      this._renderPitchTemplate(pitchTemplate);
      this._renderCompetitiveAnalysis(competitiveAnalysis);
      this._renderActionableSummary(actionableSummary);
      
      // Check for any errors
      if (pitchTemplate.error || competitiveAnalysis.error || actionableSummary.error) {
        this._showError('Some analyses completed with errors. Check individual sections for details.');
      }
    } catch (error) {
      console.error('Error running enhanced analysis:', error);
      this._showError(`Error running analysis: ${error.message}`);
    } finally {
      this._showLoading(false);
    }
  },

  /**
   * Create the enhanced analysis modal
   * @private
   */
  _createModal() {
    const modalHTML = `
    <div id="enhanced-analysis-modal" class="modal hidden">
      <div class="modal-content">
        <div class="modal-header">
          <h2>Enhanced Analysis</h2>
          <button id="close-enhanced-analysis" class="close-button">&times;</button>
        </div>
        <div class="modal-body">
          <div id="enhanced-analysis-loading" class="loading-indicator hidden">
            <div class="spinner"></div>
            <p>Generating enhanced analysis...</p>
          </div>
          
          <div id="enhanced-analysis-error" class="error-message hidden"></div>
          
          <button id="run-enhanced-analysis" class="btn btn-primary">
            Run Enhanced Analysis
          </button>
          
          <div class="analysis-sections">
            <div id="pitch-template-section" class="analysis-section">
              <h3>Pitch Template</h3>
              <div class="section-content"></div>
            </div>
            
            <div id="competitive-analysis-section" class="analysis-section">
              <h3>Competitive Analysis</h3>
              <div class="section-content"></div>
            </div>
            
            <div id="actionable-summary-section" class="analysis-section">
              <h3>Actionable Summary</h3>
              <div class="section-content"></div>
            </div>
          </div>
        </div>
      </div>
    </div>`;
    
    // Add the modal to the document
    const modalContainer = document.createElement('div');
    modalContainer.innerHTML = modalHTML;
    document.body.appendChild(modalContainer.firstElementChild);
    
    // Add modal styles if not already present
    if (!document.getElementById('enhanced-analysis-styles')) {
      const styleElement = document.createElement('style');
      styleElement.id = 'enhanced-analysis-styles';
      styleElement.textContent = `
        .modal {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background-color: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }
        
        .modal-content {
          background-color: var(--color-white);
          border-radius: 8px;
          width: 90%;
          max-width: 800px;
          max-height: 90vh;
          overflow-y: auto;
          box-shadow: var(--shadow-lg);
        }
        
        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 15px 20px;
          border-bottom: 1px solid var(--color-border);
        }
        
        .modal-header h2 {
          margin: 0;
          font-size: 20px;
          color: var(--color-primary);
        }
        
        .close-button {
          background: none;
          border: none;
          font-size: 24px;
          cursor: pointer;
          color: var(--color-text-secondary);
        }
        
        .modal-body {
          padding: 20px;
        }
        
        .loading-indicator {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 30px;
        }
        
        .spinner {
          border: 4px solid rgba(0, 0, 0, 0.1);
          border-radius: 50%;
          border-top: 4px solid var(--color-primary);
          width: 40px;
          height: 40px;
          animation: spin 1s linear infinite;
          margin-bottom: 15px;
        }
        
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        .error-message {
          background-color: #f8d7da;
          color: #842029;
          padding: 10px 15px;
          border-radius: 4px;
          margin-bottom: 20px;
        }
        
        .analysis-sections {
          display: flex;
          flex-direction: column;
          gap: 25px;
          margin-top: 20px;
        }
        
        .analysis-section {
          border: 1px solid var(--color-border);
          border-radius: 8px;
          overflow: hidden;
        }
        
        .analysis-section h3 {
          margin: 0;
          padding: 12px 15px;
          background-color: var(--color-light);
          font-size: 16px;
          font-weight: 600;
          border-bottom: 1px solid var(--color-border);
        }
        
        .section-content {
          padding: 15px;
        }
        
        .pitch-template {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        
        .pitch-field {
          margin-bottom: 10px;
        }
        
        .pitch-field label {
          font-weight: 600;
          display: block;
          margin-bottom: 5px;
          color: var(--color-text-secondary);
          font-size: 14px;
        }
        
        .key-points-list, .criteria-list, .action-items-list, .resources-list, .competitors-list, .angles-list, .differentiators-list {
          padding-left: 20px;
          margin: 5px 0;
        }
        
        .key-points-list li, .criteria-list li, .action-items-list li, .resources-list li, .competitors-list li, .angles-list li, .differentiators-list li {
          margin-bottom: 5px;
        }
        
        .action-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        
        .action-timeframe {
          font-size: 12px;
          color: var(--color-text-secondary);
          background-color: var(--color-light);
          padding: 2px 6px;
          border-radius: 10px;
        }
        
        .copy-button {
          background-color: var(--color-light);
          border: 1px solid var(--color-border);
          border-radius: 4px;
          padding: 6px 10px;
          font-size: 12px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 5px;
          margin-top: 10px;
        }
        
        .copy-button:hover {
          background-color: var(--color-bg-secondary);
        }
        
        .hidden {
          display: none !important;
        }
        
        body.modal-open {
          overflow: hidden;
        }
        
        /* Dark mode support */
        body.dark-mode .modal-content {
          background-color: var(--color-bg-secondary);
          color: var(--color-text);
        }
        
        body.dark-mode .analysis-section h3 {
          background-color: rgba(255, 255, 255, 0.05);
        }
        
        body.dark-mode .error-message {
          background-color: rgba(220, 53, 69, 0.2);
          color: #f8d7da;
        }
        
        body.dark-mode .spinner {
          border-color: rgba(255, 255, 255, 0.1);
          border-top-color: var(--color-primary);
        }
      `;
      document.head.appendChild(styleElement);
    }
  },

  /**
   * Show or hide the loading indicator
   * @param {boolean} show - Whether to show or hide
   * @private
   */
  _showLoading(show) {
    if (!this.elements.loadingIndicator) return;
    
    if (show) {
      this.elements.loadingIndicator.classList.remove('hidden');
    } else {
      this.elements.loadingIndicator.classList.add('hidden');
    }
  },

  /**
   * Show an error message
   * @param {string} message - The error message
   * @private
   */
  _showError(message) {
    if (!this.elements.errorMessage) return;
    
    this.elements.errorMessage.textContent = message;
    this.elements.errorMessage.classList.remove('hidden');
  },

  /**
   * Hide the error message
   * @private
   */
  _hideError() {
    if (!this.elements.errorMessage) return;
    
    this.elements.errorMessage.classList.add('hidden');
  },

  /**
   * Clear all section contents
   * @private
   */
  _clearSections() {
    const sections = [
      this.elements.pitchSection,
      this.elements.competitiveSection,
      this.elements.summarySection
    ];
    
    sections.forEach(section => {
      if (section) {
        const content = section.querySelector('.section-content');
        if (content) content.innerHTML = '';
      }
    });
    
    // Hide error message and show run button
    this._hideError();
    const runButton = document.getElementById('run-enhanced-analysis');
    if (runButton) runButton.classList.remove('hidden');
  },

  /**
   * Render the pitch template
   * @param {Object} pitchData - The pitch template data
   * @private
   */
  _renderPitchTemplate(pitchData) {
    const section = this.elements.pitchSection;
    if (!section) return;
    
    const content = section.querySelector('.section-content');
    if (!content) return;
    
    if (pitchData.error) {
      content.innerHTML = `<div class="error-message">${pitchData.message || 'Error generating pitch template'}</div>`;
      return;
    }
    
    const pitchHTML = `
      <div class="pitch-template">
        <div class="pitch-field">
          <label>Subject Line</label>
          <div class="pitch-subject">${pitchData.subject_line}</div>
        </div>
        
        <div class="pitch-field">
          <label>Greeting</label>
          <div class="pitch-greeting">${pitchData.greeting}</div>
        </div>
        
        <div class="pitch-field">
          <label>Introduction</label>
          <div class="pitch-intro">${pitchData.introduction}</div>
        </div>
        
        <div class="pitch-field">
          <label>Key Points</label>
          <ul class="key-points-list">
            ${pitchData.key_points.map(point => `<li>${point}</li>`).join('')}
          </ul>
        </div>
        
        <div class="pitch-field">
          <label>Call to Action</label>
          <div class="pitch-cta">${pitchData.call_to_action}</div>
        </div>
        
        <div class="pitch-field">
          <label>Sign-off</label>
          <div class="pitch-signoff">${pitchData.sign_off}</div>
        </div>
        
        <button class="copy-button" data-content="pitch">
          <span class="icon">📋</span> Copy Pitch Template
        </button>
      </div>
    `;
    
    content.innerHTML = pitchHTML;
    
    // Add event listener to copy button
    const copyButton = content.querySelector('.copy-button');
    if (copyButton) {
      copyButton.addEventListener('click', () => {
        const fullPitch = `Subject: ${pitchData.subject_line}

${pitchData.greeting}

${pitchData.introduction}

${pitchData.key_points.map(point => `• ${point}`).join('\n')}

${pitchData.call_to_action}

${pitchData.sign_off}`;
        
        navigator.clipboard.writeText(fullPitch)
          .then(() => {
            copyButton.textContent = '✓ Copied!';
            setTimeout(() => {
              copyButton.innerHTML = `<span class="icon">📋</span> Copy Pitch Template`;
            }, 2000);
          })
          .catch(err => {
            console.error('Failed to copy pitch template:', err);
            copyButton.textContent = '❌ Failed to copy';
            setTimeout(() => {
              copyButton.innerHTML = `<span class="icon">📋</span> Copy Pitch Template`;
            }, 2000);
          });
      });
    }
  },

  /**
   * Render the competitive analysis
   * @param {Object} analysisData - The competitive analysis data
   * @private
   */
  _renderCompetitiveAnalysis(analysisData) {
    const section = this.elements.competitiveSection;
    if (!section) return;
    
    const content = section.querySelector('.section-content');
    if (!content) return;
    
    if (analysisData.error) {
      content.innerHTML = `<div class="error-message">${analysisData.message || 'Error generating competitive analysis'}</div>`;
      return;
    }
    
    const analysisHTML = `
      <div class="competitive-analysis">
        <div class="analysis-field">
          <label>Potential Competitors</label>
          <ul class="competitors-list">
            ${analysisData.potential_competitors.map(comp => `<li>${comp}</li>`).join('')}
          </ul>
        </div>
        
        <div class="analysis-field">
          <label>Unique Angles</label>
          <ul class="angles-list">
            ${analysisData.unique_angles.map(angle => `<li>${angle}</li>`).join('')}
          </ul>
        </div>
        
        <div class="analysis-field">
          <label>Recommended Approach</label>
          <div class="recommended-approach">${analysisData.recommended_approach}</div>
        </div>
        
        <div class="analysis-field">
          <label>Key Differentiators</label>
          <ul class="differentiators-list">
            ${analysisData.key_differentiators.map(diff => `<li>${diff}</li>`).join('')}
          </ul>
        </div>
        
        <button class="copy-button" data-content="analysis">
          <span class="icon">📋</span> Copy Analysis
        </button>
      </div>
    `;
    
    content.innerHTML = analysisHTML;
    
    // Add event listener to copy button
    const copyButton = content.querySelector('.copy-button');
    if (copyButton) {
      copyButton.addEventListener('click', () => {
        const fullAnalysis = `COMPETITIVE ANALYSIS

POTENTIAL COMPETITORS:
${analysisData.potential_competitors.map(comp => `• ${comp}`).join('\n')}

UNIQUE ANGLES:
${analysisData.unique_angles.map(angle => `• ${angle}`).join('\n')}

RECOMMENDED APPROACH:
${analysisData.recommended_approach}

KEY DIFFERENTIATORS:
${analysisData.key_differentiators.map(diff => `• ${diff}`).join('\n')}`;
        
        navigator.clipboard.writeText(fullAnalysis)
          .then(() => {
            copyButton.textContent = '✓ Copied!';
            setTimeout(() => {
              copyButton.innerHTML = `<span class="icon">📋</span> Copy Analysis`;
            }, 2000);
          })
          .catch(err => {
            console.error('Failed to copy competitive analysis:', err);
            copyButton.textContent = '❌ Failed to copy';
            setTimeout(() => {
              copyButton.innerHTML = `<span class="icon">📋</span> Copy Analysis`;
            }, 2000);
          });
      });
    }
  },

  /**
   * Render the actionable summary
   * @param {Object} summaryData - The actionable summary data
   * @private
   */
  _renderActionableSummary(summaryData) {
    const section = this.elements.summarySection;
    if (!section) return;
    
    const content = section.querySelector('.section-content');
    if (!content) return;
    
    if (summaryData.error) {
      content.innerHTML = `<div class="error-message">${summaryData.message || 'Error generating actionable summary'}</div>`;
      return;
    }
    
    const summaryHTML = `
      <div class="actionable-summary">
        <div class="summary-field">
          <label>Summary</label>
          <div class="one-sentence-summary">${summaryData.summary}</div>
        </div>
        
        <div class="summary-field">
          <label>Decision Criteria</label>
          <ul class="criteria-list">
            ${summaryData.decision_criteria.map(criterion => `<li>${criterion}</li>`).join('')}
          </ul>
        </div>
        
        <div class="summary-field">
          <label>Action Items</label>
          <ul class="action-items-list">
            ${summaryData.action_items.map(item => `
              <li>
                <div class="action-item">
                  <span>${item.action}</span>
                  <span class="action-timeframe">${item.timeframe}</span>
                </div>
              </li>
            `).join('')}
          </ul>
        </div>
        
        <div class="summary-field">
          <label>Required Resources</label>
          <ul class="resources-list">
            ${summaryData.required_resources.map(resource => `<li>${resource}</li>`).join('')}
          </ul>
        </div>
        
        <button class="copy-button" data-content="summary">
          <span class="icon">📋</span> Copy Summary
        </button>
      </div>
    `;
    
    content.innerHTML = summaryHTML;
    
    // Add event listener to copy button
    const copyButton = content.querySelector('.copy-button');
    if (copyButton) {
      copyButton.addEventListener('click', () => {
        const fullSummary = `ACTIONABLE SUMMARY

SUMMARY: ${summaryData.summary}

DECISION CRITERIA:
${summaryData.decision_criteria.map(criterion => `• ${criterion}`).join('\n')}

ACTION ITEMS:
${summaryData.action_items.map(item => `• ${item.action} (${item.timeframe})`).join('\n')}

REQUIRED RESOURCES:
${summaryData.required_resources.map(resource => `• ${resource}`).join('\n')}`;
        
        navigator.clipboard.writeText(fullSummary)
          .then(() => {
            copyButton.textContent = '✓ Copied!';
            setTimeout(() => {
              copyButton.innerHTML = `<span class="icon">📋</span> Copy Summary`;
            }, 2000);
          })
          .catch(err => {
            console.error('Failed to copy actionable summary:', err);
            copyButton.textContent = '❌ Failed to copy';
            setTimeout(() => {
              copyButton.innerHTML = `<span class="icon">📋</span> Copy Summary`;
            }, 2000);
          });
      });
    }
  }
};

// Expose as global for Chrome Extension compatibility
window.enhancedAnalysisUI = enhancedAnalysisUI;
