# SourceBottle Extension Manual Testing Checklist

This document provides a structured approach to manually test all key functionality of the SourceBottle extension after implementing the modular architecture.

## Setup Verification

- [ ] **Extension loads properly**
  - Extension icon appears in Chrome toolbar
  - Badge shows the correct count of opportunities
  - No console errors on startup

- [ ] **Manifest and dependencies**
  - Verify manifest.json references background_module.js, not background_fixed.js
  - Verify all required permissions are present
  - Verify only active scripts are referenced (not legacy scripts)

## Core Module Functionality

### Background Module

- [ ] **Initialization**
  - Extension initializes on browser startup
  - Default settings are created if none exist
  - Alarms are properly set up for refresh intervals

- [ ] **Message Handling**
  - Background script responds to all expected message types:
    - `getOpportunities`
    - `scrapeSourceBottle`
    - `sendToGoogleSheet`
    - `updateSettings`

- [ ] **Alarm Functionality**
  - Refresh alarm triggers at the specified interval
  - Auto-scrape alarm triggers according to schedule (if enabled)
  - Alarms correctly update badge counts and notifications

### Content Script Functionality

- [ ] **Page Detection**
  - Content script only activates on SourceBottle pages
  - No errors occur on non-SourceBottle pages

- [ ] **Module Loading**
  - All modules load correctly from content script
  - No console errors during import of modules

- [ ] **Scraping**
  - Content script can extract opportunities from the current page
  - Extracted opportunities contain all expected fields
  - Categories are correctly inferred when not explicitly provided

### Storage Module

- [ ] **Opportunity Storage**
  - New opportunities are saved correctly
  - Duplicate opportunities are properly deduplicated
  - Opportunities can be retrieved from storage
  - Last updated timestamp is correctly stored and retrieved

- [ ] **Settings Storage**
  - Settings can be saved and retrieved
  - UI preferences are correctly stored
  - Default settings are used when none exist

### Pagination Module

- [ ] **State Management**
  - Pagination state is correctly tracked across page navigations
  - Processed items are properly tracked to avoid duplicates
  - Current page and total pages are correctly detected

- [ ] **Multi-Page Processing**
  - Pagination can navigate through multiple pages
  - State is preserved if navigation is interrupted and resumed later
  - Correct completion status is reported when all pages are processed

### Integrations Module

- [ ] **Google Sheets Integration**
  - Opportunities can be sent to Google Sheets
  - Retry mechanism works for failed requests
  - Success/failure status is correctly reported
  - Last sync timestamp is updated

- [ ] **CSV Export**
  - Opportunities can be exported to CSV
  - CSV format is correct with proper escaping of special characters
  - File download works correctly

### Logger Module

- [ ] **Logging**
  - Different log levels work correctly (debug, info, warn, error)
  - Logs are stored according to storage level setting
  - Large logs are properly truncated to prevent storage issues

## UI Functionality

### Popup

- [ ] **Display**
  - Popup loads correctly when clicking extension icon
  - Stats about opportunities are displayed correctly
  - Options and navigation buttons work as expected

### Opportunities Page

- [ ] **Loading**
  - Opportunities page loads all opportunities from storage
  - Opportunities are displayed in the correct format
  - Last updated timestamp is displayed correctly

- [ ] **Filtering**
  - Category filters work correctly
  - Date/deadline filters work correctly
  - Keyword search works across all relevant fields
  - Filter combinations work as expected

- [ ] **View Modes**
  - Grid view displays correctly
  - List view displays correctly
  - View preference is saved between sessions

- [ ] **Dark Mode**
  - Dark mode toggle works correctly
  - Dark mode preference is saved between sessions

### Settings Page

- [ ] **Configuration**
  - All settings can be changed and saved
  - Refresh interval setting affects alarm schedule
  - Auto-scrape schedule can be configured
  - Google Sheets URL can be configured

## End-to-End Workflows

- [ ] **Full Scraping Workflow**
  - Clicking "Scrape SourceBottle" opens the correct page
  - Content script activates and extracts opportunities
  - Opportunities are saved to storage
  - Badge count updates correctly
  - Opportunities page displays the new opportunities

- [ ] **Multi-Page Scraping**
  - Pagination automatically continues to next pages
  - State is correctly preserved between pages
  - All opportunities from all pages are collected
  - Duplicates are properly handled

- [ ] **Google Sheets Export**
  - Exporting to Google Sheets works from opportunities page
  - Status is correctly reported (success or failure)
  - Retry mechanism works for temporary failures
  - Data appears correctly in Google Sheets

## Error Handling & Recovery

- [ ] **Network Errors**
  - Extension gracefully handles network failures
  - Appropriate error messages are displayed
  - Retry mechanisms work as expected

- [ ] **Storage Errors**
  - Extension handles storage quota exceeded errors
  - Data integrity is maintained during storage operations

- [ ] **Content Script Failures**
  - Extension recovers if content script fails to load
  - Error logging captures relevant information for debugging

## Browser Interaction

- [ ] **Tab Management**
  - New tabs are only opened when requested by user
  - Existing tabs are reused when appropriate
  - Tab state is correctly detected

- [ ] **Notifications**
  - Notifications appear for important events
  - Notification preferences are respected
  - Clicking notifications performs expected actions

## Complete Testing Workflow

1. Install the extension in developer mode
2. Open SourceBottle website manually
3. Test scraping on a single page
4. Test multi-page scraping
5. View extracted opportunities in the opportunities page
6. Test all filters and view modes
7. Export opportunities to Google Sheets and CSV
8. Check error handling by simulating network failures
9. Verify notification behavior
10. Test with browser restart to ensure state persistence
