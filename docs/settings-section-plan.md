# Settings Section & Theme Chooser - Implementation Plan

## Overview
Reorganize the sidebar navigation to create a dedicated "Settings" section and implement a theme chooser feature. This will improve the app's organization and prepare for future theme customization (features #14 and #15).

## Current State
- Navigation has 4 sections: Core, Financial, Tools, Tax
- Tools section contains: Categories, Merchants, Rules, Notifications, Reports
- No theme customization exists (only dark mode)
- Design system uses fixed colors defined in CLAUDE.md

## Proposed Changes

### Phase 1: Sidebar Reorganization ✅
**Goal:** Create a new "Settings" section and move relevant items from "Tools"

**Changes to Sidebar:**
```typescript
// OLD Structure:
Tools: [Categories, Merchants, Rules, Notifications, Reports]

// NEW Structure:
Tools: [Reports]
Settings: [Categories, Merchants, Rules, Notifications, Theme]
```

**Files to Modify:**
- `components/navigation/sidebar.tsx` - Update navSections array

**Implementation Steps:**
1. Add new "Settings" section to navSections array
2. Move Categories, Merchants, Rules, Notifications from Tools to Settings
3. Add new "Theme" item with Palette icon
4. Keep Reports in Tools section (it's more of a tool than a setting)
5. Ensure proper icon imports (add Palette from lucide-react)

**Design Considerations:**
- Settings section should be positioned after Tools, before Tax
- Use Palette icon for Theme item
- Maintain existing href patterns for moved items
- Theme href: `/dashboard/theme`

---

### Phase 2: Theme Page Foundation
**Goal:** Create the Theme settings page structure

**Files to Create:**
- `app/dashboard/theme/page.tsx` - Main theme page
- `components/theme/theme-selector.tsx` - Theme selection component
- `components/theme/color-preview.tsx` - Color palette preview card

**Page Structure:**
```typescript
Theme Page Layout:
├── Header (with breadcrumb)
├── Current Theme Display
│   ├── Theme name
│   ├── Color palette preview (6-8 key colors)
│   └── Applied indicator
├── Available Themes Grid
│   ├── Dark Mode (default, current)
│   ├── Pink & Turquoise (coming soon placeholder for feature #15)
│   └── Custom theme option (future)
└── Save/Apply Button
```

**Implementation Steps:**
1. Create basic page layout with proper dark mode styling
2. Add header with title "Theme Settings"
3. Create current theme display section
4. Show color palette for current theme
5. Add placeholder for future themes
6. Include helpful text explaining theme feature

---

### Phase 3: Theme Data Structure
**Goal:** Define theme structure and prepare for future themes

**Files to Create/Modify:**
- `lib/themes/theme-config.ts` - Theme definitions and color schemes
- `lib/themes/theme-utils.ts` - Theme utility functions
- `lib/db/schema.ts` - Add theme field to userSettings (if not exists)

**Theme Structure:**
```typescript
interface Theme {
  id: string;
  name: string;
  description: string;
  isAvailable: boolean;
  colors: {
    // Background colors
    background: string;        // Main background (#0a0a0a)
    surface: string;           // Cards (#1a1a1a)
    elevated: string;          // Hover states (#242424)
    border: string;            // Dividers (#2a2a2a)

    // Semantic colors
    income: string;            // Income transactions
    expense: string;           // Expense transactions
    transfer: string;          // Transfers

    // UI colors
    primary: string;           // Primary actions
    success: string;           // Success states
    warning: string;           // Warnings
    error: string;             // Errors

    // Text colors
    textPrimary: string;       // Main text
    textSecondary: string;     // Secondary text
    textMuted: string;         // Muted text
  };
  preview?: string;            // Preview image URL (future)
}
```

**Implementation Steps:**
1. Create theme configuration file
2. Define default "Dark Mode" theme with current colors
3. Add placeholder theme objects for future themes
4. Create utility functions: getTheme(), applyTheme()
5. Verify userSettings table has theme field (add if needed)

---

### Phase 4: Theme Persistence API
**Goal:** Create API endpoints to save/load user theme preferences

**Files to Create:**
- `app/api/user/settings/theme/route.ts` - GET/PUT theme preference

**API Endpoints:**

**GET /api/user/settings/theme**
- Returns: `{ theme: string }` (theme ID)
- Default: "dark-mode"

**PUT /api/user/settings/theme**
- Body: `{ theme: string }`
- Validates theme exists
- Updates userSettings.theme field
- Returns: `{ success: true, theme: string }`

**Implementation Steps:**
1. Create API route file
2. Implement GET handler (fetch from userSettings)
3. Implement PUT handler (update userSettings)
4. Add proper Clerk authentication
5. Add validation for theme IDs
6. Handle user not found (create default settings)

---

### Phase 5: Theme Selector Component
**Goal:** Build interactive theme selection UI

**Files to Create:**
- `components/theme/theme-selector.tsx` - Main selector component
- `components/theme/theme-card.tsx` - Individual theme card

**Component Features:**
- Grid layout (2-3 columns on desktop, 1 on mobile)
- Each theme card shows:
  - Theme name and description
  - Color palette preview (small circles)
  - "Current" badge if active
  - "Coming Soon" badge if not available
  - Click to select (if available)
- Radio group behavior (single selection)
- Toast notification on theme change
- Disabled state for unavailable themes

**Implementation Steps:**
1. Create ThemeCard component with preview
2. Build ThemeSelector grid layout
3. Fetch themes from theme-config.ts
4. Fetch current theme from API
5. Implement selection logic
6. Add API call to save selection
7. Show success/error toasts
8. Add loading states

---

### Phase 6: Theme Application Logic
**Goal:** Apply selected theme to the application (Preparation for feature #15)

**Files to Modify:**
- `app/layout.tsx` - Add theme data attribute
- `components/theme/theme-provider.tsx` - Create theme context (new)
- `app/globals.css` - Add CSS variables for theming (optional)

**Implementation Steps:**
1. Create ThemeProvider context component
2. Fetch user's theme preference on app load
3. Apply theme ID to root element as data attribute
4. Document how to add new themes in future
5. Add comments explaining theme system
6. Test theme switching (even though only one theme exists)

**Note:** Actual multi-theme support with different color schemes will be implemented in feature #15. This phase just sets up the infrastructure.

---

### Phase 7: Testing & Polish
**Goal:** Ensure everything works smoothly

**Testing Checklist:**
- [ ] Sidebar reorganization displays correctly
- [ ] All moved items still navigate properly
- [ ] Theme page loads without errors
- [ ] Current theme displays correctly
- [ ] Color preview shows accurate colors
- [ ] Theme selection saves to database
- [ ] Theme preference persists across sessions
- [ ] Mobile responsive design works
- [ ] Collapsed sidebar shows Theme icon
- [ ] Coming soon themes are disabled

**Polish Items:**
- [ ] Add transitions for theme switching
- [ ] Add helpful tooltips
- [ ] Ensure consistent dark mode styling
- [ ] Add keyboard navigation for theme cards
- [ ] Ensure proper focus states
- [ ] Add ARIA labels for accessibility
- [ ] Test with screen reader

---

## Database Changes Required

### Check if userSettings table has theme field:
If not present, create migration to add:
```sql
ALTER TABLE user_settings ADD COLUMN theme TEXT DEFAULT 'dark-mode';
```

**Migration file:** `drizzle/00XX_add_theme_to_user_settings.sql`

---

## Design System Compliance

### Colors (from existing design system):
- Use existing dark mode palette
- Background: `#0a0a0a`
- Surface: `#1a1a1a`
- Elevated: `#242424`
- Border: `#2a2a2a`
- Income: `#10b981` (emerald)
- Expense: `#f87171` (red)
- Transfer: `#60a5fa` (blue)

### Typography:
- Page title: text-xl font-bold mb-6 text-white
- Section headers: text-sm font-semibold text-gray-400 uppercase tracking-wider
- Body text: text-sm text-gray-400

### Components:
- Cards: border border-[#2a2a2a] bg-[#1a1a1a] rounded-xl
- Hover states: hover:bg-[#242424]
- Active states: bg-[#10b981]/20 text-[#10b981]

---

## Implementation Order

### Session 1: Sidebar Reorganization (Estimated: 15 minutes)
1. Modify sidebar.tsx navSections
2. Add Palette icon import
3. Test navigation
4. Commit: "feat: reorganize sidebar with Settings section"

### Session 2: Theme Page Structure (Estimated: 30 minutes)
1. Create theme page file
2. Build basic layout
3. Add color preview component
4. Create placeholder theme cards
5. Commit: "feat: add theme settings page structure"

### Session 3: Theme System Backend (Estimated: 30 minutes)
1. Create theme configuration file
2. Define theme data structure
3. Create API endpoints
4. Test with Postman/curl
5. Commit: "feat: add theme persistence API"

### Session 4: Theme Selection UI (Estimated: 30 minutes)
1. Create theme selector component
2. Build theme cards
3. Implement selection logic
4. Add toast notifications
5. Commit: "feat: implement theme selection UI"

### Session 5: Testing & Polish (Estimated: 20 minutes)
1. Test all functionality
2. Fix any bugs
3. Improve responsive design
4. Add accessibility features
5. Commit: "polish: theme system refinements"

**Total Estimated Time:** ~2 hours

---

## Future Enhancements (Not in this implementation)

These will be implemented separately in features #14 and #15:
- Additional theme options (pink & turquoise theme)
- Custom theme builder
- Theme preview mode
- Dark/light mode toggle
- Color picker for custom themes
- Import/export theme files
- Theme marketplace/sharing

---

## Success Criteria

✅ Sidebar has new Settings section with moved items
✅ Theme page is accessible and displays correctly
✅ Color palette preview shows current theme colors
✅ Theme preference saves to database
✅ Theme preference persists across sessions
✅ All navigation links work correctly
✅ Mobile responsive design works
✅ No console errors or warnings
✅ Follows existing design system
✅ Ready for future theme additions (feature #15)

---

## Notes

- This implementation creates the **infrastructure** for theming
- Only ONE theme (dark mode) will exist initially
- This prepares the groundwork for feature #15 (pink & turquoise theme)
- Focus is on organization and structure, not multiple themes yet
- Keep it simple - don't over-engineer for features that don't exist yet
- Ensure the theme page is useful even with just one theme (shows current colors, explains system)
