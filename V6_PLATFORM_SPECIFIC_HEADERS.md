# V6 Platform-Specific Headers and Scraping Guide

## 🎯 The Problem: We're Using SourceBottle's Template Everywhere

You're right - we're trying to force SourceBottle's structure onto Featured and Qwoted, when each platform has its own unique way of presenting data.

## 📊 What Each Platform Actually Shows

### 1. **SourceBottle Structure**
- **Opportunity Cards**: Each in a `div.result`
- **Title**: In `h4 a` element
- **Description**: In `.result-description`
- **Publication**: In `p.publication strong`
- **Journalist Type**: In `p.publication` (parentheses)
- **Deadline**: In `.result-deadline` or `p.date-deadline`
- **Category**: From URL parameters or class names

### 2. **Featured.com Structure**
Featured likely uses different terminology and structure:
- **Questions** instead of opportunities
- **Journalist/Reporter** asking the question
- **Publication** they write for
- **Topic/Beat** instead of category
- **Response Deadline**
- Different HTML structure/classes

### 3. **Qwoted Structure**
Qwoted has its own unique approach:
- **Expert Requests** instead of opportunities
- **Brand/Media Outlet** making the request
- **Query/Pitch** details
- **Expertise Needed** (tags)
- **Deadline** for responses
- React-based UI with different selectors

## 🔍 Questions to Help Me Understand Each Platform Better

### For Featured.com:
1. **What does Featured call their opportunities?**
   - Questions? Queries? Requests?

2. **What information is shown on each card?**
   - Journalist name?
   - Publication name?
   - Question/topic?
   - Deadline?
   - Category/beat?

3. **What are the HTML elements/classes?**
   - What class wraps each opportunity?
   - Where is the journalist name?
   - Where is the publication?

### For Qwoted:
1. **What's the exact structure of an opportunity card?**
   - Is the brand name always visible?
   - Where's the deadline shown?
   - How are tags/categories displayed?

2. **Are there specific labels we should look for?**
   - "EXPERT REQUEST"?
   - "Looking for"?
   - "Deadline"?

## 🛠️ Customization Needed

### SourceBottle Scraper (Working Well)
```javascript
// Current selectors - WORKING
{
  container: 'div.result',
  title: 'h4 a',
  description: '.result-description',
  publication: 'p.publication strong',
  deadline: '.result-deadline'
}
```

### Featured Scraper (Needs Customization)
```javascript
// Need to update these selectors
{
  container: '???',  // What wraps each question?
  question: '???',   // Where's the question text?
  journalist: '???', // Where's the journalist name?
  publication: '???', // Where's the outlet?
  deadline: '???',   // Where's the deadline?
  category: '???'    // Topic/beat?
}
```

### Qwoted Scraper (Partially Working)
```javascript
// Current selectors may need adjustment
{
  container: '[data-cy="opp-cards"]',
  brandName: '.w-75.mb-0.fw-bold.mt-0',
  request: '.ais-Highlight',
  deadline: '.source-request-deadline',
  tags: '.badge'
}
```

## 📋 Action Items

1. **For each platform, I need to know:**
   - Exact terminology used
   - HTML structure/classes
   - What data is available
   - What's most important to capture

2. **Platform-specific field names:**
   - Don't force SourceBottle's structure
   - Use each platform's natural terminology
   - Map to common display later

3. **Scraper customization:**
   - Unique selectors for each platform
   - Platform-specific extraction logic
   - Respect each platform's data model

## 🤝 How You Can Help

Could you provide:

1. **Screenshots or descriptions** of what each platform's opportunity/question cards look like?

2. **The exact labels/headers** each platform uses?

3. **Which fields are most important** for your workflow on each platform?

4. **Any specific quirks** about how each platform displays data?

This will help me create proper platform-specific scrapers instead of trying to force one template on all three!

---

*Each platform is unique - let's embrace that instead of fighting it!*