# Phase 0.4: Theme & Notifications Integration - Implementation Plan

**Feature:** Household Data Isolation - Theme & Notification Per-Household Preferences
**Phase:** 0.4 of Phase 0 (Settings Architecture)
**Estimated Time:** 1 day
**Status:** Ready to implement
**Created:** 2025-11-14

---

## Overview

Phase 0.4 integrates the theme and notification systems with the new three-tier settings architecture. This enables users to have different themes and notification preferences for each household they belong to.

**Goals:**
- Theme automatically switches when user changes households
- Notifications work independently per household
- Seamless user experience with no data loss
- Maintain backward compatibility during migration

---

## Current State Analysis

### Theme System (Current)
**Storage:** `user_settings.theme` (global to user)
**Loading:**
1. ThemeProvider loads from localStorage on mount
2. Fetches from `/api/user/settings/theme`
3. Applies theme via `applyTheme(themeId)`

**Issue:** Theme is global - changing households doesn't change theme

### Notification System (Current)
**Storage:** `notification_preferences` table (separate table, linked to user)
**Loading:**
1. NotificationsTab fetches from `/api/settings/notification-preferences`
2. Updates via PATCH to same endpoint

**Issue:** Notifications are global - not per-household

### Household Context (Current)
**State:** Tracks `selectedHouseholdId` and `households` list
**Switching:** Updates `selectedHouseholdId` but doesn't reload preferences

**Issue:** No automatic preference reloading on household switch

---

## Target State

### Theme System (New)
**Storage:** `user_household_preferences.theme` (per-household)
**Loading:**
1. ThemeProvider loads from localStorage (fallback)
2. Fetches from `/api/user/households/[householdId]/preferences`
3. Applies theme for current household
4. Re-applies theme when household changes

### Notification System (New)
**Storage:** `user_household_preferences.*` (9 notification types × 2 fields each)
**Loading:**
1. NotificationsTab fetches from current household's preferences
2. Updates via POST to `/api/user/households/[householdId]/preferences`

### Household Context (Enhanced)
**State:** Same + theme reloading logic
**Switching:**
1. Updates `selectedHouseholdId`
2. Loads user preferences for new household
3. Applies theme immediately
4. Persists selection to localStorage

---

## Implementation Tasks

### Task 1: Update Household Context Provider (2 hours)

**File:** `contexts/household-context.tsx`

**Changes:**
1. Add `applyTheme` import from theme utils
2. Add `preferences` state to context
3. Create `loadHouseholdPreferences()` function
4. Call it when household switches
5. Add `persistSelectedHousehold()` to localStorage
6. Load persisted household on mount

**New Context Interface:**
```typescript
interface HouseholdContextType {
  households: Household[];
  selectedHouseholdId: string | null;
  selectedHousehold: Household | null; // NEW: Computed from selectedHouseholdId
  loading: boolean;
  preferences: UserHouseholdPreferences | null; // NEW
  setSelectedHouseholdId: (id: string) => Promise<void>; // NEW: Now async
  refreshHouseholds: () => Promise<void>;
  refreshPreferences: () => Promise<void>; // NEW
}
```

**Flow:**
```typescript
setSelectedHouseholdId(newId) {
  1. Update selectedHouseholdId state
  2. Persist to localStorage('unified-ledger:selected-household')
  3. Fetch preferences: GET /api/user/households/[newId]/preferences
  4. Update preferences state
  5. Apply theme: applyTheme(preferences.theme)
  6. Return promise
}
```

**Integration Points:**
- Used by: Household switcher dropdown, settings page
- Provides: Theme, preferences, automatic reloading

---

### Task 2: Update Theme Provider (1 hour)

**File:** `components/providers/theme-provider.tsx`

**Changes:**
1. Import `useHousehold` hook
2. Wait for household context to load
3. Fetch from new per-household endpoint
4. Watch for household changes

**New Flow:**
```typescript
ThemeProvider:
  1. Load from localStorage (immediate fallback)
  2. Wait for HouseholdContext to load
  3. If household available:
     - Fetch: GET /api/user/households/[householdId]/preferences
     - Extract theme from preferences.theme
     - Apply via applyTheme(theme)
  4. If no household:
     - Fetch: GET /api/user/settings (fallback to old user-level)
     - Apply theme

  5. Listen to selectedHouseholdId changes
  6. Re-apply theme when household switches (via HouseholdContext)
```

**Backward Compatibility:**
- If no households exist, fall back to user-level theme from `/api/user/settings`
- Keep localStorage for instant loading

---

### Task 3: Update Theme Tab Component (1.5 hours)

**File:** `components/settings/theme-tab.tsx`

**Changes:**
1. Import `useHousehold` hook
2. Change API endpoints from `/api/user/settings/theme` to `/api/user/households/[householdId]/preferences`
3. Fetch only `theme` field from preferences
4. Update only `theme` field via PATCH/POST

**New API Calls:**
```typescript
// GET current theme
GET /api/user/households/[householdId]/preferences
Response: { ..., theme: 'dark-blue', ... }

// UPDATE theme
POST /api/user/households/[householdId]/preferences
Body: { theme: 'light-bubblegum' }
Response: { ..., theme: 'light-bubblegum', ... }
```

**UI Changes:**
- Add household name to header: "Theme for [Household Name]"
- Show current household context
- Maintain existing theme selector UI

---

### Task 4: Update Notifications Tab Component (2 hours)

**File:** `components/settings/notifications-tab.tsx`

**Changes:**
1. Import `useHousehold` hook
2. Change API endpoint from `/api/settings/notification-preferences` to `/api/user/households/[householdId]/preferences`
3. Map old notification_preferences structure to new user_household_preferences structure
4. Update field names to match new schema

**Field Mapping (Old → New):**
```typescript
Old (notification_preferences)    →  New (user_household_preferences)
────────────────────────────────────────────────────────────────────
billReminderEnabled               →  billRemindersEnabled
billReminderChannels              →  billRemindersChannels
budgetWarningEnabled              →  budgetWarningsEnabled
budgetWarningChannels             →  budgetWarningsChannels
budgetExceededAlert               →  budgetExceededEnabled
budgetExceededChannels            →  budgetExceededChannels
budgetReviewEnabled               →  budgetReviewEnabled
budgetReviewChannels              →  budgetReviewChannels
lowBalanceAlertEnabled            →  lowBalanceEnabled
lowBalanceChannels                →  lowBalanceChannels
savingsMilestoneEnabled           →  savingsMilestonesEnabled
savingsMilestoneChannels          →  savingsMilestonesChannels
debtMilestoneEnabled              →  debtMilestonesEnabled
debtMilestoneChannels             →  debtMilestonesChannels
weeklySummaryEnabled              →  weeklySummariesEnabled
weeklySummaryChannels             →  weeklySummariesChannels
monthlySummaryEnabled             →  monthlySummariesEnabled
monthlySummaryChannels            →  monthlySummariesChannels
```

**New API Calls:**
```typescript
// GET notification preferences
GET /api/user/households/[householdId]/preferences
Response: {
  billRemindersEnabled: true,
  billRemindersChannels: '["push","email"]',
  // ... all other notification fields
}

// UPDATE notification preference
POST /api/user/households/[householdId]/preferences
Body: { billRemindersEnabled: false }
Response: { ...updated preferences... }
```

**Additional Changes:**
- Remove unused fields: billReminderDaysBefore, billReminderOnDueDate, billOverdueReminder, budgetWarningThreshold, lowBalanceThreshold, weeklySummaryDay, monthlySummaryDay
- These are not in the new schema, so remove UI elements for them
- Add household name to header: "Notifications for [Household Name]"

---

### Task 5: Update Household Switcher Component (30 mins)

**File:** Find household switcher dropdown (likely in `components/navigation/`)

**Changes:**
1. Make switcher use `setSelectedHouseholdId` from context (already async now)
2. Show loading state while preferences load
3. Provide visual feedback when household switches

**User Experience:**
```
1. User clicks household dropdown
2. User selects different household
3. Dropdown shows loading spinner
4. Theme switches immediately
5. Dropdown closes with new household name
6. All data refreshes with new household context
```

---

### Task 6: Create Migration Helper Utility (1 hour)

**File:** `lib/migrations/migrate-to-household-preferences.ts` (NEW)

**Purpose:** Helper functions for migrating data from old tables to new

**Functions:**
```typescript
// Check if user has preferences in new table
export async function hasHouseholdPreferences(
  userId: string,
  householdId: string
): Promise<boolean>

// Migrate user's settings to household preferences (one-time)
export async function migrateUserPreferences(
  userId: string,
  householdId: string
): Promise<void> {
  // Copy theme from user_settings
  // Copy notifications from notification_preferences
  // Create user_household_preferences record
}

// Get preferences with fallback to migration
export async function getOrMigratePreferences(
  userId: string,
  householdId: string
): Promise<UserHouseholdPreferences>
```

**Integration:**
- Used by ThemeProvider on first load
- Used by preference APIs to ensure data exists
- Runs once per user per household (idempotent)

---

### Task 7: Testing & Validation (2 hours)

**Manual Testing Checklist:**

**Theme Testing:**
- [ ] Load app - theme applies from last used household
- [ ] Switch household - theme changes immediately
- [ ] Set different theme in different household - verify each household remembers its theme
- [ ] Reload page - theme persists
- [ ] Create new household - gets default theme (dark-mode)

**Notification Testing:**
- [ ] Load notifications tab - shows current household's preferences
- [ ] Toggle notification - saves immediately
- [ ] Change channel selection - saves immediately
- [ ] Switch household - shows different household's preferences
- [ ] Update preference - verify it's scoped to current household only

**Household Context Testing:**
- [ ] Switch household - all data refreshes
- [ ] Refresh page - returns to last selected household
- [ ] No households - app doesn't crash, shows appropriate state
- [ ] Single household - auto-selects it

**Edge Cases:**
- [ ] User with no households (shouldn't happen but handle gracefully)
- [ ] User's first time in new household (creates default preferences)
- [ ] API errors (show error, don't crash)
- [ ] Network offline (falls back to localStorage theme)

---

## File Changes Summary

### Files to Modify:
1. `contexts/household-context.tsx` - Add preference loading and theme switching
2. `components/providers/theme-provider.tsx` - Use household-scoped theme
3. `components/settings/theme-tab.tsx` - Update to household-scoped API
4. `components/settings/notifications-tab.tsx` - Migrate to new schema and API
5. `components/navigation/*` (household switcher) - Add loading state

### Files to Create:
1. `lib/migrations/migrate-to-household-preferences.ts` - Migration helpers

### Files to Update (API Routes):
- Already exist from Phase 0.2:
  - `app/api/user/households/[householdId]/preferences/route.ts` ✅
  - Supports GET, POST, PATCH for all preference fields

### Files to Deprecate (Later):
- `app/api/user/settings/theme/route.ts` - Keep for backward compat, remove in Phase 0.5
- `app/api/settings/notification-preferences/route.ts` - Keep for backward compat, remove in Phase 0.5

---

## Data Flow Diagrams

### Before (Current - Global Theme):
```
User → ThemeProvider → /api/user/settings/theme → user_settings.theme
                          ↓
                     applyTheme()
```

### After (Per-Household Theme):
```
User → HouseholdContext → selectedHouseholdId
          ↓
       ThemeProvider → /api/user/households/[id]/preferences → user_household_preferences.theme
                          ↓
                     applyTheme()
```

### Household Switch Flow:
```
User clicks dropdown → setSelectedHouseholdId(newId)
                         ↓
                    localStorage.setItem('unified-ledger:selected-household', newId)
                         ↓
                    fetch('/api/user/households/' + newId + '/preferences')
                         ↓
                    applyTheme(preferences.theme)
                         ↓
                    UI refreshes with new household context
```

---

## Migration Strategy

### Phase 0.4 (This Phase):
1. Frontend migrates to use new per-household endpoints
2. Old endpoints remain functional (backward compatibility)
3. Data exists in both old and new tables

### Phase 0.5 (Next Phase):
1. Verify all users migrated successfully
2. Remove old theme/notification API endpoints
3. Drop moved fields from user_settings table
4. Archive notification_preferences table

---

## Rollback Plan

If critical issues arise:
1. Revert frontend changes to use old endpoints
2. Old data still exists in user_settings and notification_preferences
3. No data loss - new tables remain populated
4. Fix issues and retry migration

---

## Success Criteria

- [ ] User can set different theme per household
- [ ] Theme switches automatically when household changes
- [ ] Theme persists across page reloads
- [ ] Notifications work per-household independently
- [ ] No errors in console
- [ ] No performance degradation
- [ ] Backward compatible with users who haven't switched households yet
- [ ] All existing tests still pass
- [ ] Manual testing checklist complete

---

## Timeline

| Task | Estimated Time | Dependencies |
|------|---------------|--------------|
| 1. Household Context | 2 hours | None |
| 2. Theme Provider | 1 hour | Task 1 |
| 3. Theme Tab | 1.5 hours | Task 2 |
| 4. Notifications Tab | 2 hours | Task 1 |
| 5. Household Switcher | 30 mins | Task 1 |
| 6. Migration Helper | 1 hour | None |
| 7. Testing | 2 hours | All above |
| **Total** | **10 hours (1.25 days)** | |

---

## Next Steps After Completion

1. Update phase-0-implementation-progress.md with completion status
2. Mark Phase 0.4 as complete in features.md
3. Begin Phase 0.5: Testing & Polish
4. Document any issues or technical debt
5. Prepare for Phase 1: Core Data Isolation

---

**Document Version:** 1.0
**Last Updated:** 2025-11-14
**Status:** READY FOR IMPLEMENTATION
