# V6 Complete Field Mapping - What Each Platform Actually Captures

## 🎯 The Reality: Each Platform Uses Different Terms

### What We're Trying to Display (Common Fields)
1. **Title** - The main headline of the opportunity
2. **Description** - The details/context
3. **Media Outlet** - The publication/brand making the request
4. **Deadline** - When responses are due
5. **Category/Type** - What kind of opportunity
6. **URL** - Link to the original

## 📊 What Each Platform Actually Captures

### 1. **SourceBottle**
```javascript
{
  title: "Opportunity headline",              // ✅ Captured
  description: "Full description text",       // ✅ Captured
  deadline: "31 Dec 2024",                   // ✅ Captured (formatted string)
  category: "Technology",                     // ✅ Captured (intelligent categorization)
  url: "https://sourcebottle.com/...",      // ✅ Captured
  // MISSING: Media outlet name!
}
```
**Note**: SourceBottle doesn't capture the media outlet/publication name at all!

### 2. **Featured**
```javascript
{
  title: "Question text",                     // ✅ Captured (they call it question)
  description: "Question details",            // ✅ Captured
  deadline: "2024-01-15",                    // ✅ Captured (ISO format)
  category: "Press Q&A",                     // ✅ Captured (predefined)
  url: "https://featured.com/...",          // ✅ Captured
  // MISSING: Media outlet/journalist info!
}
```
**Note**: Featured doesn't capture who's asking the question!

### 3. **Qwoted**
```javascript
{
  title: "What brand is looking for",        // ✅ Captured (pitchTitle)
  description: "Request details",            // ✅ Captured
  mediaOutlet: "CNN",                        // ✅ CAPTURED! (extracted)
  brandName: "CNN",                          // ✅ CAPTURED! (duplicate)
  deadline: "December 15, 2024",             // ✅ CAPTURED! (various formats)
  tags: ["Technology", "AI"],                // ✅ Captured (hashtags)
  url: "https://app.qwoted.com/...",       // ✅ Captured
  hasExpertRequest: true,                    // ✅ Qwoted-specific flag
  postedTime: "2 days ago",                  // ✅ When posted
}
```
**Note**: Qwoted is the ONLY platform that captures media outlet!

## 🔄 The Mapping Solution

### Unified Display Structure
```javascript
function mapToUnifiedStructure(data, platform) {
  switch(platform) {
    case 'sourcebottle':
      return {
        title: data.title,
        description: data.description,
        outlet: 'Media Outlet Not Available',    // ❌ Not captured
        deadline: data.deadline,                 // "31 Dec 2024"
        category: data.category,
        url: data.url,
        platform: 'SourceBottle'
      };
      
    case 'featured':
      return {
        title: data.title || data.question,      // They call it "question"
        description: data.description || data.details,
        outlet: 'Publication Not Available',     // ❌ Not captured
        deadline: formatDate(data.deadline),     // Convert ISO to readable
        category: data.category || 'Press Q&A',
        url: data.url,
        platform: 'Featured'
      };
      
    case 'qwoted':
      return {
        title: data.title || data.pitchTitle,
        description: data.description,
        outlet: data.mediaOutlet || data.brandName || 'Unknown', // ✅ We have this!
        deadline: data.deadline || 'Check listing',
        category: data.tags?.[0] || 'Media Request',
        url: data.url,
        platform: 'Qwoted'
      };
  }
}
```

## 🎨 Display Strategy

### For Missing Media Outlets:
1. **SourceBottle**: Show "Check Listing" or extract from description if possible
2. **Featured**: Show "Featured.com Member" or "Anonymous Journalist"
3. **Qwoted**: Actually show the real outlet! (CNN, Forbes, etc.)

### For Deadlines:
1. **SourceBottle**: Already formatted ("31 Dec 2024")
2. **Featured**: Convert ISO to readable format
3. **Qwoted**: Parse various formats or show "Check listing"

### For Categories:
1. **SourceBottle**: Use intelligent categorization
2. **Featured**: Use predefined categories
3. **Qwoted**: Use first tag or "Media Request"

## 🚨 Key Insights

1. **Qwoted is the winner** - It captures the most complete data including media outlet
2. **SourceBottle is missing outlet** - Critical info not scraped
3. **Featured is missing outlet** - No journalist/publication info
4. **Different date formats** - Need unified formatting
5. **Different terminology** - question vs title, brandName vs mediaOutlet

## 💡 Recommendations

### Option 1: Work with What We Have (Recommended)
- Display "Not Available" for missing outlets on SourceBottle/Featured
- Use Qwoted's complete data as-is
- Focus on consistent date formatting

### Option 2: Enhanced Extraction (Risky)
- Try to extract outlet from description text
- Risk: May get incorrect data
- Risk: May break working scrapers

### Option 3: Update Scrapers (Not Recommended)
- Modify scrapers to capture missing fields
- Risk: Break working functionality
- Risk: Platform HTML changes could break it

## 📝 Implementation Code for opportunities.js

```javascript
// Storage keys to read from
const STORAGE_KEYS = {
  sourcebottle: 'sourceBottleOpportunities',
  featured: 'featuredOpportunities',
  qwoted: 'qwotedOpportunities'
};

// Field mappings for each platform
const FIELD_MAPPINGS = {
  sourcebottle: {
    title: 'title',
    description: 'description',
    outlet: null,  // Not available
    deadline: 'deadline',
    category: 'category',
    url: 'url'
  },
  featured: {
    title: 'title',
    description: 'description',
    outlet: null,  // Not available
    deadline: 'deadline',
    category: 'category',
    url: 'url'
  },
  qwoted: {
    title: 'title',
    description: 'description',
    outlet: 'mediaOutlet',  // or 'brandName'
    deadline: 'deadline',
    category: (item) => item.tags?.[0] || 'Media Request',
    url: 'url'
  }
};

// Default values for missing fields
const DEFAULTS = {
  sourcebottle: {
    outlet: 'SourceBottle Media'
  },
  featured: {
    outlet: 'Featured.com Member'
  },
  qwoted: {
    outlet: 'Media Outlet'
  }
};
```

---

*This mapping shows exactly what each platform captures and how to display it properly without breaking the scrapers.*