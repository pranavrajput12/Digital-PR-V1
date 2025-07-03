# V6 Data Structure Analysis Plan

## 🔍 Objective
Understand how each scraper stores data to properly display it in opportunities.html

## 📊 Analysis Steps

### Step 1: Analyze Scraped Data Structure

#### 1.1 SourceBottle Data Analysis
**Where to look:**
- Check `sourcebottle_content_launcher.js` to see what fields are scraped
- Check Chrome DevTools > Application > Storage to see actual stored data
- Look for storage keys like `sourceBottleOpportunities`

**Expected fields to find:**
- Title
- Description
- Media Outlet
- Deadline
- URL
- Category
- Any other fields?

#### 1.2 Featured Data Analysis
**Where to look:**
- Check `featured_content_launcher.js` to see what fields are scraped
- Check Chrome DevTools > Application > Storage to see actual stored data
- Look for storage keys like `featuredOpportunities` or `featuredQuestions`

**Expected fields to find:**
- Question/Title
- Details/Description
- Publication/Outlet
- Due Date/Deadline
- URL
- Any other fields?

#### 1.3 Qwoted Data Analysis
**Where to look:**
- Check `qwoted_content_launcher.js` to see what fields are scraped
- Check Chrome DevTools > Application > Storage to see actual stored data
- Look for storage keys like `qwotedOpportunities`

**Expected fields to find:**
- Subject/Title
- Query/Description
- Outlet
- Deadline
- URL
- Any other fields?

### Step 2: Document Storage Keys and Structure

Create a mapping table:

| Platform | Storage Key | Field Names | Example Data |
|----------|------------|-------------|--------------|
| SourceBottle | `sourceBottleOpportunities` | title, description, mediaOutlet, deadline, url | {...} |
| Featured | `featuredOpportunities` | question, details, publication, dueDate, url | {...} |
| Qwoted | `qwotedOpportunities` | subject, query, outlet, deadline, url | {...} |

### Step 3: Common Structure Mapping

Design a unified structure for display:

```javascript
const unifiedOpportunity = {
  // Common fields all platforms must map to
  title: '',        // SourceBottle: title, Featured: question, Qwoted: subject
  description: '',  // SourceBottle: description, Featured: details, Qwoted: query
  outlet: '',       // SourceBottle: mediaOutlet, Featured: publication, Qwoted: outlet
  deadline: '',     // SourceBottle: deadline, Featured: dueDate, Qwoted: deadline
  url: '',          // All platforms: url
  platform: '',     // 'sourcebottle', 'featured', 'qwoted'
  
  // Platform-specific fields (optional)
  category: '',     // SourceBottle only
  type: '',         // Featured: 'question', Qwoted: 'request'
  id: '',           // Unique identifier
  dateScraped: ''   // When it was scraped
};
```

### Step 4: Analysis Checklist

For each platform, document:

- [ ] Exact storage key name
- [ ] All field names in stored objects
- [ ] Data types for each field
- [ ] Date format used for deadlines
- [ ] Any nested structures
- [ ] Array vs object storage
- [ ] Any unique identifiers
- [ ] Platform-specific fields

### Step 5: Code Review Points

#### 5.1 Check Storage Writing (Read-Only Review)
Look at how each scraper saves data:
- `chrome.storage.local.set()` calls
- Key names used
- Data structure being saved

#### 5.2 Check Current Display Code
Look at opportunities.js:
- How it tries to read data
- What keys it's looking for
- How it maps fields

#### 5.3 Identify Mismatches
Document where the disconnect happens:
- Wrong storage key names?
- Wrong field names?
- Missing data transformation?
- Date parsing issues?

## 📋 Analysis Output Document

After analysis, create a document with:

### 1. Storage Structure for Each Platform
```javascript
// SourceBottle
{
  key: 'sourceBottleOpportunities',
  structure: {
    title: 'string',
    description: 'string',
    mediaOutlet: 'string',
    deadline: 'date string format',
    url: 'string',
    category: 'string'
  }
}

// Featured
{
  key: 'featuredOpportunities',
  structure: {
    // actual fields found
  }
}

// Qwoted
{
  key: 'qwotedOpportunities',
  structure: {
    // actual fields found
  }
}
```

### 2. Field Mapping Table
```javascript
const fieldMappings = {
  sourcebottle: {
    displayTitle: 'title',
    displayDescription: 'description',
    displayOutlet: 'mediaOutlet',
    displayDeadline: 'deadline',
    displayUrl: 'url'
  },
  featured: {
    displayTitle: '???',  // Find actual field name
    displayDescription: '???',
    displayOutlet: '???',
    displayDeadline: '???',
    displayUrl: 'url'
  },
  qwoted: {
    displayTitle: '???',  // Find actual field name
    displayDescription: '???',
    displayOutlet: '???',
    displayDeadline: '???',
    displayUrl: 'url'
  }
};
```

### 3. Issues Found
- List any data structure inconsistencies
- Missing fields
- Format differences
- Storage key issues

### 4. Fix Strategy
Based on findings, determine:
- Exact changes needed in opportunities.js
- Field mapping implementation
- Date parsing requirements
- Any data transformation needs

---

## 🚨 Important Rules

1. **DO NOT MODIFY SCRAPERS** - Only analyze their output
2. **DO NOT CHANGE STORAGE FORMAT** - Work with existing data
3. **ONLY FIX DISPLAY LAYER** - opportunities.js changes only
4. **TEST AFTER ANALYSIS** - Ensure scrapers still work before fixing display

---

*This analysis will give us the complete picture needed to fix the display without breaking anything.*