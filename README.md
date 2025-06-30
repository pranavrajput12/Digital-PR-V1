# SourceBottle Extension - Modular Architecture

## Overview

This Chrome extension helps users track and manage opportunities from SourceBottle. The codebase has been refactored to use a modular architecture for improved maintainability, performance, and reliability.

## Architecture

### Core Modules

- **`storage.js`**: Handles all data persistence operations with deduplication and state management
- **`scraper.js`**: Contains logic for extracting and categorizing opportunities
- **`logger.js`**: Centralized logging system for debugging and performance monitoring
- **`integrations.js`**: Manages external integrations (Google Sheets, CSV export)  
- **`pagination.js`**: Manages multi-page scraping with state persistence
- **`background-service.js`**: Core service for background operations and message passing

### Entry Points

- **`background_module.js`**: Main service worker for background operations
- **`content-scripts/sourcebottle_content_launcher.js`**: Content script entry point
- **`opportunities-module.js`**: UI for viewing and managing opportunities
- **`popup.html/js`**: Extension popup interface

## Development Notes

### Migration Status

- ✅ Modular architecture implemented
- ✅ Legacy scripts moved to `/legacy` directory
- ✅ Manifest updated to reference new modules
- ✅ Content script launcher using module imports
- ✅ Opportunities page using modular architecture

### Potential Issues

1. **State Management**: Be careful with overlapping operations between `storage.js` and `pagination.js`
2. **Content Script Initialization**: The module loading happens via dynamic imports - ensure path references are correct
3. **Cross-Module Dependencies**: Some modules have dependencies on others - initialization order matters

### Common Operations

#### Adding a New Feature

1. Identify which module(s) should contain the feature
2. Add the feature to the appropriate module(s)
3. Use `chrome.runtime.sendMessage` for background communication
4. Update UI components to use the new feature

#### Debugging

- The `logger.js` module provides consistent logging with different levels
- Enable diagnostic mode via settings for more verbose output
- Check the Background console for service worker logs

## Future Improvements

- **Plugin System**: Allow custom integrations via a plugin interface
- **Web Workers**: Offload heavy parsing to improve UI responsiveness
- **Automated Tests**: Add Jest tests for core modules
- **Enhanced User Experience**: Add progress indicators and notifications
- **Security Enhancements**: Encrypt sensitive data in storage

## Legacy Code

Legacy scripts have been moved to the `/legacy` directory for reference but are no longer in use:

- `background.js` / `background_fixed.js`: Old background scripts
- `content-scripts/sourcebottle*.js`: Old content scripts (except launcher)
- `sheets-integration.js`: Standalone integration script
- `opportunities.js`: Old opportunities page handler
