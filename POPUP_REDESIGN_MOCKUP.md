# Main Popup Redesign - Three Screen Mockup

## 🎨 Visual Concept

### Navigation Structure
```
┌─────────────────────────────────────────┐
│  [SourceBottle] [Qwoted] [Featured]     │  <- Tab Navigation
├─────────────────────────────────────────┤
│                                         │
│         PLATFORM CONTENT AREA           │
│                                         │
├─────────────────────────────────────────┤
│    [Common Action Buttons Area]         │
└─────────────────────────────────────────┘
```

### Screen 1: SourceBottle
```
┌─────────────────────────────────────────┐
│  [SourceBottle] [Qwoted] [Featured]     │
├─────────────────────────────────────────┤
│    📢 Select a Category to Scrape       │
│                                         │
│  ┌──────────┐  ┌──────────┐           │
│  │ Business │  │ Environment│          │
│  └──────────┘  └──────────┘           │
│  ┌──────────┐  ┌──────────┐           │
│  │ General  │  │  Health   │           │
│  └──────────┘  └──────────┘           │
│  ┌──────────┐  ┌──────────┐           │
│  │Lifestyle │  │ Education │           │
│  └──────────┘  └──────────┘           │
│  ┌──────────┐  ┌──────────┐           │
│  │Marketing │  │ Services  │           │
│  └──────────┘  └──────────┘           │
│  ┌──────────┐  ┌──────────┐           │
│  │ Property │  │Technology │           │
│  └──────────┘  └──────────┘           │
│  ┌──────────┐                          │
│  │  Travel  │                          │
│  └──────────┘                          │
├─────────────────────────────────────────┤
│ [View Opportunities] [Export] [Settings]│
└─────────────────────────────────────────┘
```

### Screen 2: Qwoted
```
┌─────────────────────────────────────────┐
│  [SourceBottle] [Qwoted] [Featured]     │
├─────────────────────────────────────────┤
│                                         │
│         💬 Qwoted Opportunities         │
│                                         │
│    ┌─────────────────────────────┐     │
│    │                             │     │
│    │   SCRAPE QWOTED REQUESTS    │     │
│    │                             │     │
│    └─────────────────────────────┘     │
│                                         │
│         Last sync: 2 hours ago          │
│       23 opportunities available        │
│                                         │
├─────────────────────────────────────────┤
│ [View Opportunities] [Export] [Settings]│
└─────────────────────────────────────────┘
```

### Screen 3: Featured
```
┌─────────────────────────────────────────┐
│  [SourceBottle] [Qwoted] [Featured]     │
├─────────────────────────────────────────┤
│                                         │
│        🔍 Featured Questions            │
│                                         │
│    ┌─────────────────────────────┐     │
│    │                             │     │
│    │  SCRAPE FEATURED QUESTIONS  │     │
│    │                             │     │
│    └─────────────────────────────┘     │
│                                         │
│         Last sync: 1 day ago           │
│       45 questions available           │
│                                         │
├─────────────────────────────────────────┤
│ [View Opportunities] [Export] [Settings]│
└─────────────────────────────────────────┘
```

## 🎯 Design Principles

### 1. **Clear Platform Separation**
- Each platform has its own dedicated screen
- Visual distinction through colors/icons
- No confusion about which platform you're working with

### 2. **Simplified Actions**
- SourceBottle: Category selection (existing behavior)
- Qwoted: Single scrape action
- Featured: Single scrape action

### 3. **Consistent Navigation**
- Tab-based switching between platforms
- Active tab clearly indicated
- Smooth transitions

### 4. **Unified Actions**
- Common buttons appear on all screens
- Consistent placement and styling
- Platform-agnostic actions (view, export, settings)

### 5. **Information Display**
- Show last sync time
- Display opportunity count
- Visual feedback for actions

## 🎨 Styling Suggestions

### Color Schemes
- **SourceBottle**: Blue theme (#4b6cb7)
- **Qwoted**: Teal theme (#009688)
- **Featured**: Orange theme (#ff9800)

### Typography
- Clean, modern sans-serif font
- Clear hierarchy with sizes
- Good contrast ratios

### Interactions
- Hover effects on all clickable elements
- Loading states during scraping
- Success/error notifications
- Smooth transitions between screens

## 📱 Responsive Considerations
- Minimum width: 360px
- Maximum width: 400px
- Flexible height based on content
- Scrollable if needed