# Featured.com Data Structure Analysis

## 📊 Featured.com Table Headers
1. **Question** - The journalist's question/request (this is their "opportunity")
2. **Publication** - The media outlet (Yahoo Life, Forbes, etc.)
3. **Deadline** - Relative time format (e.g., "7d 15h", "8h 12m")
4. **Close Date** - Absolute date/time (e.g., "Jul 11th, 2025 09:30 AM")

## 🎯 Key Findings

### HTML Structure
- Uses a **table-based layout** (not cards like SourceBottle)
- Table class: `w-full caption-bottom text-sm`
- Row class: `border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted`
- Modern React/Tailwind CSS classes

### Data Fields Available
1. **Question/Request**
   - Selector: `span.whitespace-pre-line`
   - Contains the full journalist question
   - This is what we should map to "title" and "description"

2. **Publication** ✅ (They DO capture this!)
   - Contains publication logo/avatar
   - Publication name (Yahoo Life, Forbes, etc.)
   - Wrapped in a link to `/publication-source/[name]`
   - Examples: "Yahoo Life", "Forbes", "https://www.amazon.com"

3. **Deadline** (Two formats!)
   - **Relative**: "7d 15h", "8h 12m", "12m" (shown in red when urgent)
   - **Absolute**: "Jul 11th, 2025 09:30 AM"
   - Both are available!

4. **Special Indicators**
   - 🕐 Clock icon - deadline indicator
   - 📧 Mail icon - response method
   - ✨ Sparkles icon - special feature/priority

## 🔧 Field Mapping for Featured

```javascript
// Featured.com field mapping
const FEATURED_FIELD_MAPPING = {
  // The "Question" column contains the full request
  title: 'question',           // First 100 chars of question
  description: 'question',     // Full question text
  
  // Publication is clearly shown!
  outlet: 'publication',       // "Yahoo Life", "Forbes", etc.
  
  // Two deadline formats available
  deadline: 'deadline',        // Relative: "7d 15h"
  closeDate: 'closeDate',      // Absolute: "Jul 11th, 2025"
  
  // Platform identifier
  platform: 'featured',
  
  // Additional fields
  urgency: 'isUrgent',        // When deadline shows in red
  hasSpecialFeature: 'hasSparkles'  // When sparkles icon present
};
```

## 📍 CSS Selectors for Scraping

```javascript
const FEATURED_SELECTORS = {
  // Table and rows
  table: 'table.w-full.caption-bottom.text-sm',
  rows: 'tr.border-b.transition-colors',
  
  // Data cells
  questionCell: 'td span.whitespace-pre-line',
  publicationCell: 'td a[href*="/publication-source"] span.truncate',
  publicationLogo: 'td img[alt=""]',
  deadlineCell: 'td:nth-child(4) span',  // Relative time
  closeDateCell: 'td:nth-child(5) span', // Absolute date
  
  // Status indicators
  urgentDeadline: 'span.text-destructive',
  specialIcons: 'svg.lucide'
};
```

## ✅ What Featured DOES Capture

1. **Question** - Full journalist request ✅
2. **Publication** - Media outlet name ✅
3. **Deadline** - Both relative and absolute ✅
4. **Journalist** - Not directly shown (might be in question text)
5. **Category** - Not visible in table view

## 🎯 Display Recommendations

For opportunities.html, we should show:
- **Title**: First 100-150 characters of the question
- **Description**: Full question text
- **Media Outlet**: Publication name (Yahoo Life, Forbes, etc.)
- **Deadline**: Use the absolute date format for consistency
- **Urgency**: Highlight if deadline is soon (red text indicator)

## 🔄 Comparison with Other Platforms

| Field | SourceBottle | Featured | Qwoted |
|-------|--------------|----------|---------|
| Opportunity Name | "title" | "question" | "pitchTitle" |
| Details | "description" | "question" (same) | "description" |
| Media Outlet | "publication" | "publication" ✅ | "mediaOutlet" |
| Deadline | "deadline" | "closeDate" + "deadline" | "deadline" |
| Format | Cards | Table | Cards |

---

*Featured.com provides complete data including publication names! The issue is just mapping the correct field names.*