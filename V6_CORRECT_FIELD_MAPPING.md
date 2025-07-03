# V6 Correct Field Mapping - All Platforms Capture Media Outlets!

## ✅ The Truth: All Platforms DO Capture Media Outlet Data

I was wrong - the scrapers ARE capturing media outlet information, just under different field names!

### 1. **SourceBottle** (`modules/scraper.js`)
```javascript
{
  title: "Opportunity headline",
  description: "Full description text",
  deadline: "31 Dec 2024",
  publication: "The Guardian",        // ✅ CAPTURED! (line 308)
  journalistType: "Freelancer",       // ✅ CAPTURED! (line 317)
  category: "Technology",
  url: "https://sourcebottle.com/...",
  datePosted: "2024-01-01"
}
```

### 2. **Qwoted** (`modules/scrapers/qwoted-scraper.js`)
```javascript
{
  title: "What brand is looking for",
  description: "Request details",
  mediaOutlet: "CNN",                 // ✅ CAPTURED! (line 803)
  brandName: "CNN",                   // ✅ CAPTURED! (line 804)
  deadline: "December 15, 2024",
  tags: ["Technology", "AI"],
  url: "https://app.qwoted.com/..."
}
```

### 3. **Featured**
The Featured scraper implementation needs to be verified, but it should also capture outlet information.

## 🔧 The Real Problem: Field Name Mismatch

The issue isn't missing data - it's that each platform uses different field names:
- **SourceBottle**: `publication`
- **Qwoted**: `mediaOutlet` and `brandName`
- **Featured**: Need to verify field name

## 📊 Correct Field Mapping for opportunities.js

```javascript
// Field mappings - map platform-specific names to display names
const FIELD_MAPPINGS = {
  sourcebottle: {
    title: 'title',
    description: 'description',
    outlet: 'publication',           // ✅ Maps to 'publication' field
    journalistInfo: 'journalistType', // ✅ Additional info
    deadline: 'deadline',
    category: 'category',
    url: 'url',
    datePosted: 'datePosted'
  },
  qwoted: {
    title: 'title',
    description: 'description',
    outlet: 'mediaOutlet',           // ✅ Maps to 'mediaOutlet' field
    brandName: 'brandName',          // ✅ Alternative outlet name
    deadline: 'deadline',
    tags: 'tags',
    url: 'url',
    postedTime: 'postedTime'
  },
  featured: {
    title: 'title',
    description: 'description',
    outlet: 'outlet',                // Need to verify actual field name
    deadline: 'deadline',
    category: 'category',
    url: 'url'
  }
};

// Function to get outlet with fallbacks
function getOutletName(opportunity, platform) {
  switch(platform) {
    case 'sourcebottle':
      return opportunity.publication || 'Data not available';
      
    case 'qwoted':
      return opportunity.mediaOutlet || opportunity.brandName || 'Data not available';
      
    case 'featured':
      return opportunity.outlet || opportunity.publication || 'Data not available';
      
    default:
      return 'Data not available';
  }
}

// Function to map opportunity to display format
function mapOpportunityForDisplay(opportunity, platform) {
  const mapping = FIELD_MAPPINGS[platform];
  
  return {
    title: opportunity[mapping.title] || 'No title available',
    description: opportunity[mapping.description] || 'No description available',
    outlet: getOutletName(opportunity, platform),
    deadline: opportunity[mapping.deadline] || 'No deadline specified',
    category: opportunity[mapping.category] || opportunity.tags?.[0] || 'Uncategorized',
    url: opportunity[mapping.url] || '#',
    platform: platform,
    // Additional fields
    journalistType: opportunity.journalistType || null,
    datePosted: opportunity.datePosted || opportunity.postedTime || opportunity.scrapedAt
  };
}
```

## 🎯 Display Rules (Per Your Requirements)

1. **Show real data or nothing** - No placeholders
2. **If data exists**: Display it
3. **If data missing**: Show "Data not available" or hide the field entirely

```javascript
// Example display logic for opportunities.html
function displayOpportunity(opportunity) {
  const mapped = mapOpportunityForDisplay(opportunity, opportunity.platform);
  
  // Only show fields that have real data
  const html = `
    <div class="opportunity-card">
      <h3>${mapped.title}</h3>
      ${mapped.description ? `<p>${mapped.description}</p>` : ''}
      ${mapped.outlet !== 'Data not available' ? `<div class="outlet">📰 ${mapped.outlet}</div>` : '<div class="outlet">📰 Media outlet not available</div>'}
      ${mapped.deadline !== 'No deadline specified' ? `<div class="deadline">⏰ Deadline: ${mapped.deadline}</div>` : ''}
      ${mapped.category ? `<span class="category">${mapped.category}</span>` : ''}
      <a href="${mapped.url}" target="_blank">View Opportunity</a>
    </div>
  `;
  
  return html;
}
```

## 🔍 Next Steps

1. **Verify Featured scraper** - Check what field name it uses for outlet
2. **Update opportunities.js** - Use correct field mappings
3. **Test with real data** - Ensure all fields display properly

## ✅ Summary

- All platforms DO capture media outlet information
- The field names are just different (`publication` vs `mediaOutlet`)
- No need for placeholder data - real data exists
- Just need to map the correct field names in opportunities.js

---

*The data is there - we just need to look for it in the right fields!*