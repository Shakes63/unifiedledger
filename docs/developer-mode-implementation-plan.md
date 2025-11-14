# Developer Mode Implementation Plan

**Feature:** Developer Mode - Show IDs and Debug Information
**Status:** Ready to implement
**Estimated Time:** 3-4 hours
**Created:** 2025-11-14

---

## Overview

Developer Mode is a setting that already exists in the database (`user_settings.developer_mode`) but currently doesn't do anything. This plan implements functionality to show helpful debug information when enabled.

**Goals:**
- Show database IDs for all entities
- Display technical metadata
- Add copy-to-clipboard functionality for IDs
- Provide useful debugging information
- Make it easy to toggle on/off

---

## What Developer Mode Should Show

### 1. Entity IDs
Show IDs for all major entities when developer mode is enabled:
- Transaction IDs
- Account IDs
- Category IDs
- Merchant IDs
- Bill IDs
- Goal IDs
- Debt IDs
- Household IDs
- User IDs
- Rule IDs

### 2. Technical Metadata
- Created/Updated timestamps
- Database table names
- API endpoint paths
- Component names
- State values in complex components

### 3. Performance Metrics
- API response times
- Component render counts
- Database query execution times

---

## Implementation Strategy

### Phase 1: Context Provider (30 mins)

**File:** `contexts/developer-mode-context.tsx` (NEW)

Create a context provider to manage developer mode state globally.

```typescript
interface DeveloperModeContextType {
  isDeveloperMode: boolean;
  loading: boolean;
  toggleDeveloperMode: () => Promise<void>;
}
```

**Features:**
- Load developer mode setting from user settings on mount
- Provide `isDeveloperMode` boolean to all components
- Provide `toggleDeveloperMode` function
- Persist to database when toggled

**Integration:**
- Wrap app in provider (in main layout)
- Use alongside household context

---

### Phase 2: ID Display Components (1 hour)

**Component 1: `components/dev/entity-id-badge.tsx` (NEW)**

A reusable badge component to display entity IDs.

```typescript
interface EntityIdBadgeProps {
  id: string;
  label?: string;
  className?: string;
}
```

**Features:**
- Shows ID in monospace font
- Click to copy to clipboard
- Tooltip showing "Click to copy"
- Toast notification on copy
- Only renders when developer mode is enabled
- Semantic theme variables for styling

**Component 2: `components/dev/debug-panel.tsx` (NEW)**

An expandable debug panel for complex entities.

```typescript
interface DebugPanelProps {
  title: string;
  data: Record<string, any>;
  className?: string;
}
```

**Features:**
- Collapsible panel with JSON view
- Pretty-printed JSON with syntax highlighting
- Copy entire JSON to clipboard
- Only renders when developer mode is enabled

**Component 3: `components/dev/api-timing-badge.tsx` (NEW)**

Shows API response times for debugging performance.

```typescript
interface ApiTimingBadgeProps {
  startTime: number;
  endTime: number;
  endpoint: string;
}
```

**Features:**
- Shows response time in ms
- Color-coded (green <100ms, yellow 100-500ms, red >500ms)
- Tooltip with endpoint path

---

### Phase 3: Integration into Existing Pages (1.5 hours)

Update existing pages to show developer mode information:

#### 3.1 Transactions Page
**File:** `app/dashboard/transactions/page.tsx`

**Add:**
- EntityIdBadge for each transaction ID (in table row)
- EntityIdBadge for account ID, category ID, merchant ID
- Created/updated timestamps in tooltip
- API timing badge for fetch operations

**Location:** Add as additional column in table (only visible in dev mode)

#### 3.2 Accounts Page
**File:** `app/dashboard/accounts/page.tsx`

**Add:**
- EntityIdBadge for each account ID
- Show account type, created date
- Balance calculation details

#### 3.3 Bills Page
**File:** `app/dashboard/bills/page.tsx`

**Add:**
- EntityIdBadge for bill IDs
- Show next due date calculation
- Payment matching confidence scores

#### 3.4 Settings Page
**File:** `app/dashboard/settings/page.tsx`

**Add:**
- EntityIdBadge for user ID, household ID
- Show current preferences JSON
- API endpoint being used

#### 3.5 Categories & Merchants Pages
**Files:** `app/dashboard/categories/page.tsx`, `app/dashboard/merchants/page.tsx`

**Add:**
- EntityIdBadge for each entity
- Usage count, last used timestamp
- Category-merchant relationships

#### 3.6 Goals & Debts Pages
**Files:** `app/dashboard/goals/page.tsx`, `app/dashboard/debts/page.tsx`

**Add:**
- EntityIdBadge for goal/debt IDs
- Progress calculation details
- Milestone IDs

---

### Phase 4: Navigation & Global UI (30 mins)

#### 4.1 Sidebar
**File:** `components/navigation/sidebar.tsx`

**Add:**
- Small "DEV" badge in header when developer mode is enabled
- Shows current user ID and household ID
- Quick toggle button

#### 4.2 Page Headers
**Pattern:** Add to all page headers

**Add:**
- Component name badge (e.g., "TransactionsPage")
- Current route path
- Render timestamp

---

### Phase 5: Developer Tools Panel (30 mins)

**File:** `components/dev/developer-tools-panel.tsx` (NEW)

A fixed-position panel (bottom-right corner) visible only in developer mode.

**Features:**
- Collapsible panel (starts collapsed)
- Shows:
  - Current user ID
  - Current household ID
  - Active route
  - Local storage contents
  - Session storage contents
  - Recent API calls (last 10)
  - Component tree depth
  - Theme variables
- Clear cache button
- Export debug data button (downloads JSON)

**Styling:**
- Fixed position: bottom-right
- z-index: 9999
- Semi-transparent background
- Rounded corners
- Drag to reposition (optional)

---

## UI/UX Considerations

### Visual Design

**ID Badges:**
```
┌─────────────────────┐
│ ID: abc123... [📋]  │
└─────────────────────┘
```
- Monospace font (JetBrains Mono)
- Muted background (`bg-elevated`)
- Truncate long IDs with ellipsis
- Show full ID in tooltip
- Copy icon on hover

**Debug Panel:**
```
┌──────────────────────────────┐
│ ▼ Transaction Debug Info     │
├──────────────────────────────┤
│ {                            │
│   "id": "abc123",            │
│   "amount": 100.50,          │
│   "createdAt": "..."         │
│ }                     [📋]   │
└──────────────────────────────┘
```
- Collapsible by default
- Syntax highlighted JSON
- Copy button in header

### Theme Integration

All developer mode components must use semantic theme variables:
- `bg-card` - Panel backgrounds
- `bg-elevated` - Badge backgrounds
- `text-foreground` - Primary text
- `text-muted-foreground` - Secondary text
- `border-border` - Borders
- `text-[var(--color-primary)]` - Accent elements

### Accessibility

- All badges have aria-labels
- Copy buttons have clear labels
- Keyboard shortcuts:
  - `Ctrl+Shift+D` - Toggle developer mode
  - `Ctrl+Shift+C` - Open developer tools panel

---

## File Structure

### New Files to Create

```
lib/
  hooks/
    use-developer-mode.ts          # Hook to access developer mode context

contexts/
  developer-mode-context.tsx       # Global developer mode state

components/
  dev/
    entity-id-badge.tsx            # Reusable ID badge component
    debug-panel.tsx                # JSON debug panel
    api-timing-badge.tsx           # API timing display
    developer-tools-panel.tsx      # Fixed developer panel
```

### Files to Modify

```
app/
  layout.tsx                       # Wrap in DeveloperModeProvider
  dashboard/
    transactions/page.tsx          # Add ID badges
    accounts/page.tsx              # Add ID badges
    bills/page.tsx                 # Add ID badges
    budgets/page.tsx               # Add ID badges
    goals/page.tsx                 # Add ID badges
    debts/page.tsx                 # Add ID badges
    categories/page.tsx            # Add ID badges
    merchants/page.tsx             # Add ID badges
    settings/page.tsx              # Add ID badges and debug info

components/
  navigation/
    sidebar.tsx                    # Add DEV badge when enabled
```

---

## Implementation Tasks

### Task 1: Create Developer Mode Context (30 mins)
- Create context provider
- Load setting from database
- Provide toggle function
- Integrate into app layout

### Task 2: Create Reusable Components (1 hour)
- EntityIdBadge component
- DebugPanel component
- ApiTimingBadge component
- Developer tools panel

### Task 3: Integrate into Transactions (20 mins)
- Add ID badges to transaction list
- Add timing badges for API calls
- Test copy functionality

### Task 4: Integrate into Other Pages (1 hour)
- Accounts, Bills, Budgets, Goals, Debts
- Categories, Merchants
- Settings page

### Task 5: Add Navigation Indicators (15 mins)
- Sidebar DEV badge
- Quick toggle button

### Task 6: Testing & Polish (30 mins)
- Test all copy functionality
- Verify theme integration
- Check accessibility
- Performance testing

---

## Success Criteria

- [ ] Developer mode can be toggled from settings
- [ ] Developer mode state persists across page reloads
- [ ] IDs are visible on all major entity pages when enabled
- [ ] IDs can be copied to clipboard with one click
- [ ] Toast notification confirms copy
- [ ] Debug panels show useful information
- [ ] Developer tools panel accessible from anywhere
- [ ] No visual changes when developer mode is disabled
- [ ] All components use semantic theme variables
- [ ] Keyboard shortcuts work
- [ ] No console errors
- [ ] Performance impact is minimal

---

## Timeline

| Task | Estimated Time |
|------|---------------|
| 1. Context Provider | 30 mins |
| 2. Reusable Components | 1 hour |
| 3. Transactions Integration | 20 mins |
| 4. Other Pages Integration | 1 hour |
| 5. Navigation Indicators | 15 mins |
| 6. Testing & Polish | 30 mins |
| **Total** | **3.5 hours** |

---

## Future Enhancements

**Phase 2 (Future):**
- Network request inspector
- Component re-render tracker
- State change history
- Performance profiler
- SQL query viewer
- Cache inspector
- Error boundary details

---

**Document Version:** 1.0
**Last Updated:** 2025-11-14
**Status:** READY FOR IMPLEMENTATION
