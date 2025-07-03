/**
 * Featured.com Scraper
 * 
 * Extracts opportunities from Featured.com's table-based layout
 * Based on analysis in V6_FEATURED_DATA_STRUCTURE.md
 */

class FeaturedScraper {
  constructor() {
    this.name = 'Featured';
    this.baseUrl = 'https://featured.com';
    this.isEnabled = true;
    
    // CSS selectors for Featured.com table structure - using robust anchoring
    this.selectors = {
      // Anchor on the unique table with all three utility classes
      table: 'table.w-full.caption-bottom.text-sm',
      
      // More specific row selectors within the anchored table
      headerRow: 'table.w-full.caption-bottom.text-sm > thead > tr',
      bodyRows: 'table.w-full.caption-bottom.text-sm > tbody > tr',
      
      // Positional cell selectors anchored to the specific table
      questionCell: 'table.w-full.caption-bottom.text-sm > tbody > tr > td.md\:table-cell:nth-child(2)',
      publicationCell: 'table.w-full.caption-bottom.text-sm > tbody > tr > td.md\:table-cell:nth-child(3)',
      deadlineCell: 'table.w-full.caption-bottom.text-sm > tbody > tr > td.md\:table-cell:nth-child(4)',
      closeDateCell: 'table.w-full.caption-bottom.text-sm > tbody > tr > td.md\:table-cell:nth-child(5)',
      
      // More specific element selectors within cells
      questionText: 'td.md\:table-cell:nth-child(2) span.whitespace-pre-line',
      publicationLink: 'td.md\:table-cell:nth-child(3) a[href*="/publication-source"] span.truncate',
      publicationLogo: 'td.md\:table-cell:nth-child(3) img[alt=""]',
      
      // Status indicators
      urgentDeadline: 'span.text-destructive',
      specialIcons: 'svg.lucide'
    };
    
    this.logPrefix = '🔍 [FEATURED SCRAPER]';
  }

  /**
   * Initialize the scraper
   */
  init() {
    try {
      console.log(`${this.logPrefix} Initializing Featured.com scraper`);
      
      // Check if we're on the correct page
      if (!this.isOnFeaturedPage()) {
        console.log(`${this.logPrefix} Not on Featured questions page, skipping`);
        return;
      }
      
      // Wait for the page to fully load
      this.waitForPageLoad().then(() => {
        this.extractOpportunities();
      });
      
    } catch (error) {
      console.error(`${this.logPrefix} Error in init:`, error);
    }
  }

  /**
   * Check if we're on a Featured.com questions page
   */
  isOnFeaturedPage() {
    const host = window.location.host;
    const pathname = window.location.pathname;
    
    return host.includes('featured.com') && 
           (pathname.includes('/questions') || pathname.includes('/experts/questions'));
  }

  /**
   * Wait for the page to fully load and for the table to appear
   */
  async waitForPageLoad() {
    return new Promise((resolve) => {
      let attempts = 0;
      const maxAttempts = 20;
      
      const checkTable = () => {
        attempts++;
        const table = document.querySelector(this.selectors.table);
        const rows = document.querySelectorAll(this.selectors.bodyRows);
        
        console.log(`${this.logPrefix} Attempt ${attempts}: Table found: ${!!table}, Rows: ${rows.length}`);
        
        if (table && rows.length > 1) { // More than just header row
          console.log(`${this.logPrefix} Table loaded with ${rows.length} rows`);
          resolve();
        } else if (attempts >= maxAttempts) {
          console.log(`${this.logPrefix} Max attempts reached, proceeding anyway`);
          resolve();
        } else {
          setTimeout(checkTable, 500);
        }
      };
      
      // Start checking after a short delay
      setTimeout(checkTable, 1000);
    });
  }

  /**
   * Extract all opportunities from the page
   */
  async extractOpportunities() {
    try {
      console.log(`${this.logPrefix} Starting extraction...`);
      
      const table = document.querySelector(this.selectors.table);
      if (!table) {
        console.error(`${this.logPrefix} No table found with selector: ${this.selectors.table}`);
        return;
      }
      
      // Use more specific body row selector
      const rows = document.querySelectorAll(this.selectors.bodyRows);
      console.log(`${this.logPrefix} Found ${rows.length} body rows`);
      
      const opportunities = [];
      
      // No need to skip header since we're using tbody rows directly
      const dataRows = Array.from(rows);
      
      for (let i = 0; i < dataRows.length; i++) {
        try {
          const opportunity = this.extractOpportunityFromRow(dataRows[i], i);
          if (opportunity) {
            opportunities.push(opportunity);
            console.log(`${this.logPrefix} Extracted: ${opportunity.question?.substring(0, 50)}...`);
          }
        } catch (error) {
          console.error(`${this.logPrefix} Error processing row ${i}:`, error);
        }
      }
      
      console.log(`${this.logPrefix} Extracted ${opportunities.length} opportunities`);
      
      if (opportunities.length > 0) {
        await this.saveOpportunities(opportunities);
      }
      
    } catch (error) {
      console.error(`${this.logPrefix} Error in extractOpportunities:`, error);
    }
  }

  /**
   * Extract opportunity data from a table row using robust selectors
   */
  extractOpportunityFromRow(row, index) {
    try {
      // Extract question using specific selector within this row
      const questionElement = row.querySelector('td.md\:table-cell:nth-child(2) span.whitespace-pre-line');
      const question = questionElement?.textContent?.trim() || '';
      
      if (!question) {
        console.log(`${this.logPrefix} Row ${index} has no question text`);
        return null;
      }
      
      // Extract publication info using specific selector
      const publicationElement = row.querySelector('td.md\:table-cell:nth-child(3) a[href*="/publication-source"] span.truncate');
      const publication = publicationElement?.textContent?.trim() || '';
      
      // Extract deadline info (relative time) from 4th column
      const deadlineElement = row.querySelector('td.md\:table-cell:nth-child(4) span');
      const deadline = deadlineElement?.textContent?.trim() || 'Deadline';
      
      // Extract close date (absolute date) from 5th column
      const closeDateElement = row.querySelector('td.md\:table-cell:nth-child(5) span');
      const closeDate = closeDateElement?.textContent?.trim() || 'Close Date';
      
      // Debug what we're getting
      if (index < 2) {
        console.log(`${this.logPrefix} Row ${index} extraction:`, {
          question: question ? question.substring(0, 50) + '...' : 'NO QUESTION',
          publication: publication || 'NO PUBLICATION',
          deadline: deadline,
          closeDate: closeDate,
          deadlineElement: deadlineElement,
          closeDateElement: closeDateElement
        });
      }
      
      // Check for urgency indicators in the deadline cell
      const isUrgent = row.querySelector('td.md\:table-cell:nth-child(4) span.text-destructive') !== null;
      
      // Generate unique ID
      const externalId = `featured-${Date.now()}-${index}`;
      
      // Create opportunity object using Featured.com's field structure
      const opportunity = {
        id: externalId,
        externalId: externalId,
        question: question,           // Featured uses 'question' instead of 'title'
        title: question.substring(0, 100), // Create a shorter title for compatibility
        description: question,        // Full question as description
        publication: publication,     // Media outlet
        deadline: deadline,          // Relative deadline (e.g., "7d 15h")
        closeDate: closeDate,        // Absolute deadline (e.g., "Jul 11th, 2025")
        source: 'Featured',
        platform: 'featured',
        category: this.categorizeOpportunity(question),
        isUrgent: isUrgent,
        url: window.location.href,
        extractedAt: new Date().toISOString(),
        scrapedAt: new Date().toISOString()
      };
      
      return opportunity;
      
    } catch (error) {
      console.error(`${this.logPrefix} Error extracting from row ${index}:`, error);
      return null;
    }
  }

  /**
   * Simple categorization based on question content
   */
  categorizeOpportunity(question) {
    const text = question.toLowerCase();
    
    if (text.includes('business') || text.includes('finance') || text.includes('startup')) return 'Business & Finance';
    if (text.includes('health') || text.includes('wellness') || text.includes('medical')) return 'Health & Wellbeing';
    if (text.includes('tech') || text.includes('ai') || text.includes('software')) return 'Technology';
    if (text.includes('food') || text.includes('recipe') || text.includes('fashion')) return 'Lifestyle, Food & Fashion';
    if (text.includes('travel') || text.includes('vacation') || text.includes('tourism')) return 'Travel & Leisure';
    if (text.includes('environment') || text.includes('climate') || text.includes('green')) return 'Environment';
    if (text.includes('education') || text.includes('school') || text.includes('parent')) return 'Parenting & Education';
    if (text.includes('marketing') || text.includes('brand') || text.includes('pr')) return 'PR, Media & Marketing';
    
    return 'General';
  }

  /**
   * Save opportunities to Chrome storage
   */
  async saveOpportunities(opportunities) {
    try {
      console.log(`${this.logPrefix} Saving ${opportunities.length} opportunities to storage`);
      
      // Get existing opportunities
      const result = await chrome.storage.local.get(['featuredOpportunities']);
      const existingOpportunities = result.featuredOpportunities || [];
      
      // Merge new opportunities (avoid duplicates based on question content)
      const mergedOpportunities = [...existingOpportunities];
      let newCount = 0;
      
      for (const newOpp of opportunities) {
        const exists = existingOpportunities.some(existing => 
          existing.question === newOpp.question && 
          existing.publication === newOpp.publication
        );
        
        if (!exists) {
          mergedOpportunities.push(newOpp);
          newCount++;
        }
      }
      
      // Save to storage
      await chrome.storage.local.set({
        featuredOpportunities: mergedOpportunities
      });
      
      console.log(`${this.logPrefix} Saved ${newCount} new opportunities (${mergedOpportunities.length} total)`);
      
      // Show notification
      this.showNotification(`Found ${newCount} new Featured.com opportunities`);
      
    } catch (error) {
      console.error(`${this.logPrefix} Error saving opportunities:`, error);
    }
  }

  /**
   * Show notification to user
   */
  showNotification(message) {
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      background-color: #ff9800;
      color: white;
      padding: 12px 16px;
      border-radius: 6px;
      font-family: Arial, sans-serif;
      z-index: 10000;
      box-shadow: 0 4px 8px rgba(0,0,0,0.3);
      font-size: 14px;
      max-width: 300px;
    `;
    notification.textContent = `🔍 ${message}`;
    
    document.body.appendChild(notification);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
      if (document.body.contains(notification)) {
        document.body.removeChild(notification);
      }
    }, 5000);
  }
}

// Create the scraper instance and expose it globally
const featuredScraper = new FeaturedScraper();

// Expose to window for content script access
window.featuredScraper = featuredScraper;

// Also register with scrapers registry if it exists
if (window.scrapers && typeof window.scrapers.register === 'function') {
  window.scrapers.register('Featured', featuredScraper);
  console.log('🔍 [FEATURED SCRAPER] Registered with scrapers registry');
}

console.log('🔍 [FEATURED SCRAPER] Module loaded and ready');