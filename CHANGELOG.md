# Changelog

All notable changes to PRess & Impress will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2025-07-03

### 🎉 Major Release - Complete Architecture Overhaul

#### Added
- **Featured.com Scraper Implementation** - Complete scraper with robust CSS selectors
- **Platform-Aware Field Mapping** - Dynamic field mapping for each platform's data structure
- **Unified Cache System** - Consolidated 5 separate cache modules into one efficient system
- **BaseModule Class** - Standardized foundation for all extension modules
- **Module Interfaces** - 6 specialized interfaces for different module types
- **Performance Monitoring** - Built-in metrics for every operation
- **Circuit Breaker Patterns** - Prevent cascade failures in API calls
- **Migration Guides** - Comprehensive documentation for cache system migration
- **Memory Management** - Real-time monitoring with automatic cleanup
- **Error Recovery** - Self-healing capabilities with configurable retry logic

#### Changed
- **Extension Name** - Rebranded to "PRess & Impress - Media Opportunity Hunter"
- **Storage Module** - Migrated to standardized BaseModule pattern
- **Opportunities Display** - Platform-aware field mapping fixes empty cards issue
- **Logging System** - Unified console.log and logManager usage
- **AI Service** - Fixed race conditions in concurrent initialization
- **Architecture Documentation** - Updated to reflect Phase 3 improvements
- **Background Script** - Integrated unified cache initialization

#### Fixed
- **Featured.com Display Issues** - Empty cards, missing deadlines, incorrect titles
- **Platform Field Mapping** - Each platform now uses correct field names (question vs title)
- **Popup Button Regression** - Restored functionality after caching implementation
- **AI Service Race Conditions** - Proper promise caching and sequential processing
- **Memory Leaks** - Event listener cleanup and timer management
- **Chrome API Errors** - Added runtime.lastError checks throughout
- **CSP Violations** - Fixed dynamic import issues
- **Qwoted Scraper** - Complete fix with bridge communication

#### Performance
- **60-80% reduction** in cache-related memory usage
- **Faster cache operations** through shared memory pools
- **Better cache hit rates** with improved eviction policies
- **Reduced initialization time** with unified system

## [1.2.0] - 2025-07-02

### Phase 2 - Performance & Reliability

#### Added
- **Storage Caching Layer** - 60-75% I/O reduction
- **DOM Performance Optimization** - Document fragments for batch operations
- **Event Listener Management** - Automatic cleanup to prevent memory leaks
- **AI Error Boundaries** - Circuit breaker pattern implementation
- **Qwoted Bridge Communication** - Manual trigger UI for user-initiated scraping

#### Fixed
- **Chrome API Error Handling** - Comprehensive error checks
- **CSP Violations** - Dynamic import corrections
- **Memory Management** - Improved cleanup and monitoring

## [1.1.0] - 2025-07-01

### Phase 1 - Critical Fixes

#### Added
- **Logger ES Module Export** - Proper module exports
- **Enhanced ESLint Configuration** - Better code quality rules
- **Content Security Policy** - Improved security directives

#### Fixed
- **Missing sheets-integration.js** - Restored from backup
- **Extension Loading Failures** - All critical files present
- **Package.json Metadata** - Aligned with manifest.json

#### Changed
- **Import Path Extensions** - Standardized to use .js extensions
- **Console Logging** - Reviewed and validated usage patterns

## [1.0.0] - 2025-06-10

### Initial Release

#### Features
- **Multi-Platform Support** - SourceBottle, Featured.com, and Qwoted integration
- **AI-Powered Analysis** - Azure OpenAI integration for opportunity insights
- **Automatic Scraping** - Background monitoring of PR opportunities
- **Google Sheets Integration** - Export opportunities to spreadsheets
- **Smart Deduplication** - Prevent duplicate opportunity entries
- **Real-time Notifications** - Badge updates and sound alerts
- **Advanced Filtering** - Category, deadline, relevance, and platform filters
- **Opportunity Management** - Comprehensive UI for managing opportunities

#### Supported Platforms
- SourceBottle - Industry lists and query results
- Featured.com - Expert questions and opportunities
- Qwoted - Source requests and journalist queries

---

## Version History Summary

- **2.0.0** - Major architecture overhaul with unified caching and standardized APIs
- **1.2.0** - Performance optimizations and reliability improvements
- **1.1.0** - Critical fixes and code quality enhancements
- **1.0.0** - Initial release with core functionality