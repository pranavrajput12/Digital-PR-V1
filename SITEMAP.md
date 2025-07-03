# Project Sitemap & File Structure

## Overview
Complete mapping of all files, directories, and their relationships in the Multi-Platform PR Opportunities Tracker Chrome Extension.

## Root Directory Structure

```
/Users/pronav/Documents/Digital-PR/
├── 📋 DOCUMENTATION
│   ├── ARCHITECTURE.md              # System architecture documentation
│   ├── CLAUDE.md                    # Claude Code guidance
│   ├── DEVELOPER_ISSUES_PLAN.md     # Issue resolution plan
│   ├── PROGRESS_TRACKER.md          # Work progress tracking
│   ├── CLEANUP_SUMMARY.md           # Codebase cleanup documentation
│   ├── README.md                    # Project overview
│   ├── SITEMAP.md                   # This file
│   └── CHECKPOINTS.md               # Development milestones
│
├── 🔧 CONFIGURATION
│   ├── manifest.json                # Chrome extension manifest
│   ├── package.json                 # NPM dependencies and scripts
│   ├── package-lock.json            # Locked dependency versions
│   ├── .eslintrc.js                 # ESLint configuration
│   ├── eslint.config.js             # ESLint modern config
│   ├── .gitignore                   # Git ignore rules
│   └── .gitattributes               # Git attributes
│
├── 🎯 ENTRY POINTS
│   ├── background_module.js         # Background service worker
│   ├── simple-popup.html            # Extension popup (main UI)
│   ├── simple-popup.js              # Popup functionality
│   ├── opportunities.html           # Opportunities management page
│   ├── opportunities.js             # Opportunities page logic
│   ├── settings.html                # Settings configuration page
│   └── settings.js                  # Settings page functionality
│
├── 🤖 CONTENT SCRIPTS
│   ├── content-scripts/
│   │   ├── sourcebottle_content_launcher.js     # SourceBottle scraper entry
│   │   ├── featured_content_launcher.js         # Featured.com scraper entry
│   │   ├── featured_content_launcher_auth.js    # Featured auth variant
│   │   ├── featured_content_launcher_optimized.js # Featured optimized
│   │   ├── featured_globals.js                  # Featured global objects
│   │   ├── qwoted_content_launcher.js           # Qwoted scraper entry
│   │   └── qwoted_diagnostic_launcher.js        # Qwoted diagnostics
│
├── ⚙️ CORE MODULES
│   ├── modules/
│   │   ├── logger.js                # Centralized logging system
│   │   ├── storage.js               # Data persistence manager
│   │   ├── scraper.js               # Core scraping coordinator
│   │   ├── aiService.js             # AI analysis service
│   │   ├── integrations.js          # External integrations
│   │   ├── pagination.js            # Multi-page scraping
│   │   ├── background-service.js    # Background operations
│   │   ├── aiServiceHelper.js       # AI service utilities
│   │   ├── aiEnhancements.js        # AI feature enhancements
│   │   ├── embeddingCache.js        # AI embedding cache
│   │   ├── enhancedAnalysisUI.js    # Enhanced UI components
│   │   ├── opportunityProcessor.js  # Opportunity data processing
│   │   ├── promptTemplates.js       # AI prompt templates
│   │   └── utils-bridge.js          # Utility bridge functions
│
├── 🕷️ SCRAPER MODULES
│   ├── modules/scrapers/
│   │   ├── base-scraper.js          # Base scraper class
│   │   ├── featured-scraper-clean.js    # Featured.com scraper
│   │   ├── featured-scraper-optimized.js # Featured optimized version
│   │   ├── qwoted-scraper.js        # Qwoted scraper implementation
│   │   ├── scraper-notification.js  # Scraper UI notifications
│   │   ├── bridge-script.js         # Cross-context communication
│   │   ├── index.js                 # Scraper module index
│   │   ├── storage-merge.js         # Storage merge utilities
│   │   └── styles.css               # Scraper UI styles
│
├── 🏗️ PLATFORM MODULES
│   ├── modules/platforms/
│   │   ├── platformManager.js       # Platform management
│   │   ├── sourcebottle/
│   │   │   └── index.js             # SourceBottle platform adapter
│   │   ├── featured/
│   │   │   └── index.js             # Featured platform adapter
│   │   └── qwoted/
│   │       └── index.js             # Qwoted platform adapter
│
├── 🛠️ UTILITIES
│   ├── modules/utils/
│   │   └── debug.js                 # Debug utilities
│   ├── modules/adapters/
│   │   └── platform-adapter.js     # Platform data adapters
│
├── 🔌 SERVICES
│   ├── services/
│   │   ├── ai-service.js            # AI service implementation
│   │   └── notification-service.js  # Notification service
│
├── 🧪 TESTING
│   ├── tests/
│   │   ├── setup.js                 # Jest test setup
│   │   └── unit/
│   │       ├── ai-service.test.js           # AI service tests
│   │       ├── background-service.test.js   # Background tests
│   │       ├── integrations.test.js         # Integration tests
│   │       ├── logger.test.js               # Logger tests
│   │       ├── opportunities-rendering.test.js # UI tests
│   │       ├── opportunity-processor.test.js # Processor tests
│   │       ├── pagination.test.js           # Pagination tests
│   │       ├── scraper.test.js              # Scraper tests
│   │       ├── storage.test.js              # Storage tests
│   │       ├── storage.simplified.test.js   # Simplified storage tests
│   │       ├── storage-id-standardization.test.js # ID tests
│   │       └── utils-bridge.test.js         # Utils tests
│
├── 🎨 ASSETS
│   ├── icons/
│   │   ├── icon16.png               # 16x16 icon
│   │   ├── icon32.png               # 32x32 icon
│   │   ├── icon48.png               # 48x48 icon
│   │   └── icon128.png              # 128x128 icon
│   ├── styles/
│   │   └── opportunities.css        # Opportunities page styles
│   ├── assets/
│   │   ├── index-B2JpnCWh.css      # Generated CSS
│   │   └── index-DhXXhbDR.js       # Generated JS
│
├── 📚 LIBRARIES
│   ├── lib/
│   │   └── mark.min.js              # Text highlighting library
│
├── ⚙️ CONFIGURATION DATA
│   ├── config/
│   │   └── keyword-groups.json     # AI categorization keywords
│
├── 🗂️ BACKUP & LEGACY
│   ├── backup-files/
│   │   ├── backup-files/            # Original backups
│   │   ├── duplicate-files/         # Duplicate versions
│   │   ├── legacy-files/            # Legacy code
│   │   ├── misc-files/              # Miscellaneous
│   │   └── test-files/              # Test files
│
├── 🔗 INTEGRATIONS
│   ├── sheets-integration.js        # Google Sheets integration
│   ├── opportunities-module.js      # Opportunities module
│   └── opportunity-loader.js        # Opportunity loader
│
├── 🧩 ADDITIONAL FILES
│   ├── opportunities.fixed.js       # Fixed opportunities logic
│   ├── popup-ext.js                # Extended popup functionality
│   ├── popup.html                  # Alternative popup
│   ├── index.html                  # Development index
│   ├── generate-icons.js           # Icon generation script
│   └── mcp_settings.json           # MCP configuration
│
└── 📦 DEPENDENCIES
    └── node_modules/                # NPM packages (362 packages)
```

## File Relationships & Dependencies

### Core Dependency Graph

```
background_module.js
├── imports: logger.js, storage.js, integrations.js, scraper.js, aiService.js
├── coordinates: Content Scripts, UI Components
└── manages: Alarms, Messages, Notifications

Content Scripts
├── sourcebottle_content_launcher.js → modules/scrapers/
├── featured_content_launcher.js → featured-scraper-clean.js
├── qwoted_content_launcher.js → qwoted-scraper.js
└── all scripts → background_module.js (via chrome.runtime)

UI Components
├── simple-popup.js → background_module.js
├── opportunities.js → storage.js, aiService.js
├── settings.js → storage.js
└── all UIs → chrome.runtime for background communication

Core Modules
├── scraper.js → storage.js, logger.js
├── aiService.js → promptTemplates.js, storage.js
├── storage.js → (standalone, core dependency)
├── logger.js → (standalone, core dependency)
└── integrations.js → storage.js, logger.js
```

### Platform-Specific Flows

#### SourceBottle Flow
```
sourcebottle_content_launcher.js
    ↓
modules/scrapers/ (dynamic import)
    ↓
modules/scraper.js
    ↓
modules/storage.js + background_module.js
```

#### Featured.com Flow
```
featured_content_launcher.js + featured_globals.js
    ↓
featured-scraper-clean.js
    ↓
modules/scraper.js
    ↓
AI analysis (aiService.js) + storage
```

#### Qwoted Flow
```
qwoted_content_launcher.js
    ↓
qwoted-scraper.js
    ↓
diagnostic tools + bridge scripts
    ↓
data processing + storage
```

## Key Integration Points

### External Services
- **Google Sheets**: `sheets-integration.js` → Google Apps Script
- **OpenAI API**: `aiService.js` → Azure OpenAI
- **Chrome APIs**: All components → Chrome Extension APIs

### Cross-Module Communication
- **Background ↔ Content**: `chrome.runtime.sendMessage`
- **UI ↔ Background**: `chrome.runtime.sendMessage`
- **Modules ↔ Storage**: Direct function calls
- **AI ↔ Data**: Template-based processing

### Data Flow Endpoints
- **Input**: Website DOM → Content Scripts
- **Processing**: Core Modules → AI Analysis
- **Storage**: Chrome Storage + IndexedDB
- **Output**: UI Components + External Exports

## File Status & Ownership

### Critical Files (Never Modify Without Testing)
- `background_module.js` - Extension coordinator
- All content scripts - Platform scrapers
- `manifest.json` - Extension configuration
- Core modules: `storage.js`, `logger.js`, `scraper.js`

### Safe to Modify
- UI files (`*.html`, `*.css`)
- Documentation (`*.md`)
- Test files (`tests/**`)
- Configuration (`config/**`)

### Backup Available
- All files in `backup-files/` have original versions
- Legacy versions preserved in `legacy-files/`
- Critical files have multiple backup copies

## 🧹 Codebase Cleanup (Session 6)

### Files Removed
The following redundant/unused files were removed to clean up the codebase:

#### Alternative Implementations
- `popup.html` + `popup-ext.js` - Alternative popup (manifest uses simple-popup.html)
- `opportunities-module.js` - Alternative opportunities with dynamic imports

#### Broken References  
- `opportunity-loader.js` - References non-existent services/ directory

#### Build Artifacts
- `index.html` - React app build artifact
- `assets/` directory - React build outputs (JS/CSS)

#### Development Utilities
- `quick-clear-console.js` - Storage clearing utility
- `clear-all-data.js` - Data clearing utility

#### Redundant Modules
- `modules/aiServiceHelper.js` - Unused helper
- `modules/background-service.js` - Different from background_module.js

### Key Fix
**Popup Button Functionality**: Fixed missing `unifiedCache.js` import in `simple-popup.html`

---

*File count: 43 active files (22% reduction after cleanup)*
*Last Updated: July 3, 2025 - Session 6 (Cleanup Complete)*