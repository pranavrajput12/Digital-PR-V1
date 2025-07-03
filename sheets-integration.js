// SourceBottle Opportunities Tracker - Google Sheets Integration

/**
 * Send opportunities data to Google Sheets
 * @param {Array} opportunities - Array of opportunity objects to send
 * @param {Function} callback - Callback function to run after sending
 */
function sendToGoogleSheets(opportunities, callback) {
  try {
    if (!opportunities || !Array.isArray(opportunities) || opportunities.length === 0) {
      console.error('No valid opportunities to send to Google Sheets');
      if (callback) callback({ success: false, error: 'No valid opportunities to send' });
      return;
    }
    
    console.log(`Preparing to send ${opportunities.length} opportunities to Google Sheets`);
    
    // Normalize data for Google Sheets format
    const normalizedOpportunities = opportunities.map(opp => ({
      Title: opp.title || '',
      Description: opp.description || '',
      Category: opp.category || '',
      Deadline: opp.deadline || opp.date || '',
      Source: opp.source || 'sourcebottle',
      "Media Outlet": opp.mediaOutlet || '',
      Journalist: opp.journalist || '',
      Link: opp.submissionLink || opp.link || ''
    }));
    
    // Get the Google Sheet URL from settings
    chrome.storage.local.get(['settings'], (result) => {
      const settings = result.settings || {};
      
      // Use the configured web app URL, or fall back to the default
      const webAppUrl = settings.googleSheetsWebAppUrl || 
                        'https://script.google.com/a/macros/qubit.capital/s/AKfycbxlje612pVpLl9ttLHqRegEEsk1vf6_UFfFZ_oMazrUjt2d_Jel96fwDNj-zHef6i8/exec';
      
      console.log('Using Google Sheets web app URL:', webAppUrl);
      
      // Send to background script for handling
      chrome.runtime.sendMessage({
        action: 'sendToGoogleSheet',
        data: {
          opportunities: normalizedOpportunities
        }
      }, (response) => {
        console.log('Response from send to Google Sheets:', response);
        
        if (chrome.runtime.lastError) {
          console.error('Error sending to Google Sheets:', chrome.runtime.lastError);
          if (callback) callback({ 
            success: false, 
            error: chrome.runtime.lastError.message || 'Unknown error'
          });
          return;
        }
        
        if (response && response.success) {
          console.log('Successfully sent to Google Sheets');
          
          // Update the last sync timestamp
          chrome.storage.local.set({
            'lastGoogleSheetsSync': new Date().toISOString()
          });
          
          if (callback) callback({ 
            success: true, 
            message: `Successfully sent ${opportunities.length} opportunities to Google Sheets`
          });
        } else {
          console.error('Failed to send to Google Sheets:', response?.error || 'Unknown error');
          if (callback) callback({ 
            success: false, 
            error: response?.error || 'Failed to send to Google Sheets'
          });
        }
      });
    });
  } catch (error) {
    console.error('Exception in sendToGoogleSheets:', error);
    if (callback) callback({ success: false, error: error.message || 'Unknown error' });
  }
}

/**
 * Generate CSV data from opportunities
 * @param {Array} opportunities - Array of opportunity objects 
 * @returns {string} CSV data as a string
 */
function generateCSV(opportunities) {
  if (!opportunities || !Array.isArray(opportunities) || opportunities.length === 0) {
    console.error('No valid opportunities to generate CSV');
    return null;
  }
  
  try {
    // CSV header
    let csvContent = "Title,Description,Category,Deadline,Source,Media Outlet,Journalist,Link\n";
    
    // Add each opportunity as a row
    opportunities.forEach(opp => {
      // Escape fields that might contain commas or quotes
      const escapedTitle = opp.title ? `"${opp.title.replace(/"/g, '""')}"` : '""';
      const escapedDesc = opp.description ? `"${opp.description.replace(/"/g, '""')}"` : '""';
      const escapedCategory = opp.category ? `"${opp.category.replace(/"/g, '""')}"` : '""';
      const escapedDeadline = opp.deadline ? `"${opp.deadline.replace(/"/g, '""')}"` : '""';
      const escapedSource = opp.source ? `"${opp.source.replace(/"/g, '""')}"` : '""';
      const escapedMediaOutlet = opp.mediaOutlet ? `"${opp.mediaOutlet.replace(/"/g, '""')}"` : '""';
      const escapedJournalist = opp.journalist ? `"${opp.journalist.replace(/"/g, '""')}"` : '""';
      const escapedLink = opp.submissionLink ? `"${opp.submissionLink.replace(/"/g, '""')}"` : '""';
      
      // Add row
      csvContent += `${escapedTitle},${escapedDesc},${escapedCategory},${escapedDeadline},${escapedSource},${escapedMediaOutlet},${escapedJournalist},${escapedLink}\n`;
    });
    
    return csvContent;
  } catch (error) {
    console.error('Error generating CSV:', error);
    return null;
  }
}

/**
 * Download opportunities as CSV file
 * @param {Array} opportunities - Array of opportunity objects
 */
function downloadCSV(opportunities) {
  try {
    const csvContent = generateCSV(opportunities);
    
    if (!csvContent) {
      console.error('Failed to generate CSV content');
      return false;
    }
    
    // Create a data URI for the CSV
    const encodedUri = encodeURI('data:text/csv;charset=utf-8,' + csvContent);
    
    // Create a link element and trigger download
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `sourcebottle-opportunities-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    
    // Trigger download and clean up
    link.click();
    document.body.removeChild(link);
    
    return true;
  } catch (error) {
    console.error('Error downloading CSV:', error);
    return false;
  }
}

// Export the functions
window.SheetsIntegration = {
  sendToGoogleSheets,
  generateCSV,
  downloadCSV
};
