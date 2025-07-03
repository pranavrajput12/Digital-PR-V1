# V6 Field Mapping Analysis - Display Fix

## 📊 Data Structure Summary

### Storage Keys
- **SourceBottle**: `sourceBottleOpportunities`
- **Featured**: `featuredOpportunities`
- **Qwoted**: `qwotedOpportunities`
- **Global**: `opportunities` (merged from all platforms)

## 🔄 Field Mapping for Display

### Common Display Fields Needed
```javascript
{
  title: '',       // Main heading on card
  description: '', // Body text on card
  outlet: '',      // Media outlet/publication
  deadline: '',    // Due date
  url: '',         // Link to opportunity
  platform: '',    // Platform indicator
  category: '',    // Category/type
  dateAdded: ''    // When scraped
}
```

### Platform-to-Display Mapping

#### SourceBottle → Display
```javascript
{
  title: data.title,                    // ✅ Direct mapping
  description: data.description,        // ✅ Direct mapping
  outlet: data.mediaOutlet || 'N/A',    // ❌ MISSING - not in stored data!
  deadline: data.deadline,              // ✅ Direct mapping (format: "31 Dec 2024")
  url: data.url,                        // ✅ Direct mapping
  platform: 'SourceBottle',             // ✅ Use source field or hardcode
  category: data.category,              // ✅ Direct mapping
  dateAdded: data.dateAdded             // ✅ Direct mapping
}
```

#### Featured → Display
```javascript
{
  title: data.title,                    // ✅ Direct mapping
  description: data.description,        // ✅ Direct mapping
  outlet: data.outlet || 'N/A',         // ❌ MISSING - not in stored data!
  deadline: data.deadline,              // ⚠️ Exists but may need formatting
  url: data.url,                        // ✅ Direct mapping
  platform: 'Featured',                 // ✅ Use platform field
  category: data.category,              // ✅ Direct mapping (predefined)
  dateAdded: data.scrapedAt             // ✅ Map from scrapedAt
}
```

#### Qwoted → Display
```javascript
{
  title: data.title,                    // ✅ Direct mapping
  description: data.description,        // ✅ Direct mapping
  outlet: data.outlet || 'N/A',         // ❌ MISSING - not in stored data!
  deadline: 'Not specified',            // ❌ NOT SCRAPED by Qwoted!
  url: data.url,                        // ✅ Direct mapping
  platform: 'Qwoted',                   // ✅ Use source field or platform field
  category: 'Media Request',            // ❌ NOT IMPLEMENTED - use default
  dateAdded: data.scrapedAt             // ✅ Map from scrapedAt
}
```

## 🚨 Critical Issues Found

### 1. **Missing Media Outlet Field**
- **Problem**: None of the scrapers capture media outlet/publication name
- **Impact**: Outlet shows as empty on all cards
- **Fix Options**:
  - Option A: Display "N/A" or platform name
  - Option B: Extract from URL or description (risky)
  - Option C: Update scrapers to capture this field (DO NOT DO - breaks working code)

### 2. **Qwoted Missing Deadline**
- **Problem**: Qwoted scraper doesn't extract deadline information
- **Impact**: Deadline always empty for Qwoted opportunities
- **Fix**: Display "Check listing" or "Not specified"

### 3. **Date Format Inconsistency**
- **SourceBottle**: "31 Dec 2024" (string format)
- **Featured**: "2024-01-15" (ISO date format)
- **Qwoted**: No deadline
- **Fix**: Standardize display format in opportunities.js

### 4. **Category Handling**
- **SourceBottle**: Dynamic intelligent categorization
- **Featured**: Predefined categories
- **Qwoted**: No categories
- **Fix**: Use defaults where missing

## 🔧 Implementation Strategy for opportunities.js

### Step 1: Fix Storage Key Reading
```javascript
// Current issue: May be reading wrong keys
const storageKeys = [
  'sourceBottleOpportunities',
  'featuredOpportunities', 
  'qwotedOpportunities',
  'opportunities'  // Global merged data
];
```

### Step 2: Create Field Mapping Function
```javascript
function mapOpportunityToDisplay(opportunity, platform) {
  const baseMapping = {
    title: opportunity.title || 'Untitled',
    description: opportunity.description || 'No description available',
    url: opportunity.url || '#',
    id: opportunity.id,
    dateAdded: opportunity.dateAdded || opportunity.scrapedAt || opportunity.timestamp
  };
  
  // Platform-specific mappings
  switch(platform) {
    case 'sourcebottle':
      return {
        ...baseMapping,
        outlet: 'SourceBottle Media',  // Default since not captured
        deadline: formatDeadline(opportunity.deadline),
        platform: 'SourceBottle',
        category: opportunity.category || 'General'
      };
      
    case 'featured':
      return {
        ...baseMapping,
        outlet: 'Featured.com',  // Default since not captured
        deadline: formatDeadline(opportunity.deadline),
        platform: 'Featured',
        category: opportunity.category || 'Press Q&A'
      };
      
    case 'qwoted':
      return {
        ...baseMapping,
        outlet: 'Qwoted Platform',  // Default since not captured
        deadline: 'Check listing',  // Not captured by scraper
        platform: 'Qwoted',
        category: 'Media Request'
      };
  }
}
```

### Step 3: Fix Date Formatting
```javascript
function formatDeadline(deadline) {
  if (!deadline) return 'Not specified';
  
  // Handle different formats
  if (deadline.includes('-')) {
    // ISO format (Featured)
    const date = new Date(deadline);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  } else {
    // Already formatted (SourceBottle) or use as-is
    return deadline;
  }
}
```

## ✅ Safe Implementation Checklist

1. **DO NOT modify any scraper files**
2. **DO NOT change how data is stored**
3. **ONLY modify opportunities.js display logic**
4. **Test after each mapping change**
5. **Use fallback values for missing fields**
6. **Preserve all working functionality**

## 🎯 Expected Result

After implementing these mappings:
- ✅ All cards will show titles and descriptions
- ✅ Deadlines will display (with appropriate defaults)
- ✅ Platform indicators will be correct
- ✅ Categories will show
- ⚠️ Media outlets will show platform names (since not scraped)

---

*This analysis provides the exact field mappings needed to fix the display without modifying any working scrapers.*