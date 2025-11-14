# Phase 0.4: Remaining Tasks - Detailed Implementation Plan

**Status:** 43% Complete (Tasks 1-3 done, Tasks 4-7 remaining)
**Estimated Time Remaining:** ~5.5 hours
**Created:** 2025-11-14

---

## Completed Tasks ✅

- ✅ Task 1: Update Household Context Provider (2 hours) - COMPLETE
- ✅ Task 2: Update Theme Provider (1 hour) - COMPLETE
- ✅ Task 3: Update Theme Tab Component (1.5 hours) - COMPLETE

---

## Remaining Tasks

### Task 4: Update Notifications Tab Component (2 hours) ⏳ NEXT

**File:** `components/settings/notifications-tab.tsx`

**Current State Issues:**
- Using old API endpoint: `/api/settings/notification-preferences`
- Using old schema field names (e.g., `billReminderEnabled`)
- Has extra fields not in new schema (billReminderDaysBefore, billReminderOnDueDate, billOverdueReminder, budgetWarningThreshold, lowBalanceThreshold, weeklySummaryDay, monthlySummaryDay)
- Not household-scoped

**Implementation Steps:**

#### 4.1: Import household context (5 mins)
```typescript
import { useHousehold } from '@/contexts/household-context';
```

#### 4.2: Update state and hooks (10 mins)
- Remove local `preferences` state
- Use `preferences` from `useHousehold()` hook
- Remove local `fetchPreferences()` function
- Use `refreshPreferences()` from household context
- Update loading states to use `preferencesLoading` from context

**New hooks:**
```typescript
const { preferences, preferencesLoading, refreshPreferences, selectedHousehold } = useHousehold();
```

#### 4.3: Update field name mapping (30 mins)
Map all old field names to new schema:

**Old Schema → New Schema:**
```
billReminderEnabled          → billRemindersEnabled
billReminderChannels         → billRemindersChannels
budgetWarningEnabled         → budgetWarningsEnabled
budgetWarningChannels        → budgetWarningsChannels
budgetExceededAlert          → budgetExceededEnabled
budgetExceededChannels       → budgetExceededChannels
budgetReviewEnabled          → (same)
budgetReviewChannels         → (same)
lowBalanceAlertEnabled       → lowBalanceEnabled
lowBalanceChannels           → (same)
savingsMilestoneEnabled      → savingsMilestonesEnabled
savingsMilestoneChannels     → savingsMilestonesChannels
debtMilestoneEnabled         → debtMilestonesEnabled
debtMilestoneChannels        → debtMilestonesChannels
weeklySummaryEnabled         → weeklySummariesEnabled
weeklySummaryChannels        → weeklySummariesChannels
monthlySummaryEnabled        → monthlySummariesEnabled
monthlySummaryChannels       → monthlySummariesChannels
```

#### 4.4: Remove deprecated fields (20 mins)
**Fields to REMOVE from UI:**
- `billReminderDaysBefore` (input + label + description)
- `billReminderOnDueDate` (switch + label + description)
- `billOverdueReminder` (switch + label + description)
- `budgetWarningThreshold` (slider + label + description)
- `lowBalanceThreshold` (input + label + description)
- `weeklySummaryDay` (select dropdown)
- `monthlySummaryDay` (input + label)

These don't exist in the new `user_household_preferences` schema.

#### 4.5: Update API calls (30 mins)
Change from:
```typescript
// OLD
GET /api/settings/notification-preferences
PATCH /api/settings/notification-preferences
```

To:
```typescript
// NEW - using household context
POST /api/user/households/[householdId]/preferences
Body: { billRemindersEnabled: true }
```

**New updatePreference function:**
```typescript
const updatePreference = async (key: string, value: any) => {
  if (!selectedHousehold) return;

  setIsSaving(true);
  try {
    const response = await fetch(`/api/user/households/${selectedHousehold.id}/preferences`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [key]: value }),
    });

    if (!response.ok) {
      throw new Error('Failed to update preference');
    }

    // Refresh preferences from context
    await refreshPreferences();
    toast.success('Preference updated');
  } catch (err) {
    toast.error('Failed to update preference');
  } finally {
    setIsSaving(false);
  }
};
```

#### 4.6: Update TypeScript interface (15 mins)
Update `NotificationPreferences` interface to match new schema:

```typescript
// Remove old interface, use household context type
// Or create minimal interface:
interface NotificationPreferences {
  billRemindersEnabled: boolean;
  billRemindersChannels: string;
  budgetWarningsEnabled: boolean;
  budgetWarningsChannels: string;
  budgetExceededEnabled: boolean;
  budgetExceededChannels: string;
  budgetReviewEnabled: boolean;
  budgetReviewChannels: string;
  lowBalanceEnabled: boolean;
  lowBalanceChannels: string;
  savingsMilestonesEnabled: boolean;
  savingsMilestonesChannels: string;
  debtMilestonesEnabled: boolean;
  debtMilestonesChannels: string;
  weeklySummariesEnabled: boolean;
  weeklySummariesChannels: string;
  monthlySummariesEnabled: boolean;
  monthlySummariesChannels: string;
}
```

#### 4.7: Add household name to header (5 mins)
```typescript
<h2 className="text-xl font-semibold text-foreground">
  Notifications for {selectedHousehold?.name || 'Household'}
</h2>
```

#### 4.8: Update all JSX references (15 mins)
Go through all the JSX and update every field reference:
- `billReminderEnabled` → `billRemindersEnabled`
- `billReminderChannels` → `billRemindersChannels`
- etc.

Remove all JSX for deprecated fields (sections identified in 4.4).

---

### Task 5: Update Household Switcher Component (30 mins)

**File:** Find household switcher (likely `components/navigation/sidebar.tsx` or similar)

**Implementation Steps:**

#### 5.1: Find the household switcher component (5 mins)
Search for household dropdown/selector component

#### 5.2: Verify async handling (10 mins)
Ensure the switcher properly handles the async `setSelectedHouseholdId`:
```typescript
const handleHouseholdChange = async (householdId: string) => {
  setIsLoading(true);
  await setSelectedHouseholdId(householdId);
  setIsLoading(false);
};
```

#### 5.3: Add loading state UI (10 mins)
Show spinner or loading indicator while switching:
```typescript
{isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
```

#### 5.4: Test switching behavior (5 mins)
Verify theme switches immediately when household changes

---

### Task 6: Create Migration Helper Utility (1 hour)

**File:** `lib/migrations/migrate-to-household-preferences.ts` (NEW)

**Purpose:** Help migrate user data from old tables to new household preferences

**Implementation Steps:**

#### 6.1: Create migration utility file (5 mins)
Create new file with proper imports:
```typescript
import { db } from '@/lib/db';
import { userSettings, notificationPreferences, userHouseholdPreferences } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
```

#### 6.2: Implement hasHouseholdPreferences (10 mins)
```typescript
export async function hasHouseholdPreferences(
  userId: string,
  householdId: string
): Promise<boolean> {
  const result = await db.query.userHouseholdPreferences.findFirst({
    where: and(
      eq(userHouseholdPreferences.userId, userId),
      eq(userHouseholdPreferences.householdId, householdId)
    ),
  });
  return !!result;
}
```

#### 6.3: Implement migrateUserPreferences (35 mins)
```typescript
export async function migrateUserPreferences(
  userId: string,
  householdId: string
): Promise<void> {
  // Check if already migrated
  const exists = await hasHouseholdPreferences(userId, householdId);
  if (exists) return;

  // Fetch old user settings
  const oldSettings = await db.query.userSettings.findFirst({
    where: eq(userSettings.userId, userId),
  });

  // Fetch old notification preferences
  const oldNotifications = await db.query.notificationPreferences.findFirst({
    where: eq(notificationPreferences.userId, userId),
  });

  // Create new household preferences with migrated data
  await db.insert(userHouseholdPreferences).values({
    id: crypto.randomUUID(),
    userId,
    householdId,
    theme: oldSettings?.theme || 'dark-mode',
    // Copy notification settings...
    billRemindersEnabled: oldNotifications?.billReminderEnabled ?? true,
    billRemindersChannels: oldNotifications?.billReminderChannels || '["push"]',
    // ... (copy all other fields)
  });
}
```

#### 6.4: Implement getOrMigratePreferences (10 mins)
```typescript
export async function getOrMigratePreferences(
  userId: string,
  householdId: string
): Promise<any> {
  // Try to get existing preferences
  let prefs = await db.query.userHouseholdPreferences.findFirst({
    where: and(
      eq(userHouseholdPreferences.userId, userId),
      eq(userHouseholdPreferences.householdId, householdId)
    ),
  });

  // If not found, migrate and try again
  if (!prefs) {
    await migrateUserPreferences(userId, householdId);
    prefs = await db.query.userHouseholdPreferences.findFirst({
      where: and(
        eq(userHouseholdPreferences.userId, userId),
        eq(userHouseholdPreferences.householdId, householdId)
      ),
    });
  }

  return prefs;
}
```

---

### Task 7: Testing & Validation (2 hours)

#### 7.1: Automated Testing (1 hour)
- Test household context preference loading
- Test theme switching on household change
- Test notification preference updates
- Test API error handling

#### 7.2: Manual Testing Checklist (1 hour)

**Theme Testing:**
- [ ] Load app - theme applies from last used household
- [ ] Switch household - theme changes immediately
- [ ] Set different theme in different household - verify persistence
- [ ] Reload page - theme persists
- [ ] Create new household - gets default theme

**Notification Testing:**
- [ ] Load notifications tab - shows current household's preferences
- [ ] Toggle notification enabled - saves immediately
- [ ] Change channel selection - saves immediately
- [ ] Switch household - shows different household's preferences
- [ ] Update preference - verify scoped to current household only

**Household Context Testing:**
- [ ] Switch household - all data refreshes
- [ ] Refresh page - returns to last selected household
- [ ] No households - app doesn't crash
- [ ] Single household - auto-selects it

**Edge Cases:**
- [ ] User with no households - graceful handling
- [ ] User's first time in new household - creates defaults
- [ ] API errors - show error, don't crash
- [ ] Network offline - falls back to localStorage theme

---

## Integration Points

### Files Modified:
1. ✅ `contexts/household-context.tsx` - DONE
2. ✅ `components/providers/theme-provider.tsx` - DONE
3. ✅ `components/settings/theme-tab.tsx` - DONE (need to verify)
4. ⏳ `components/settings/notifications-tab.tsx` - IN PROGRESS (Task 4)
5. ⏳ `components/navigation/*` (household switcher) - TODO (Task 5)

### Files Created:
1. ⏳ `lib/migrations/migrate-to-household-preferences.ts` - TODO (Task 6)

### API Routes (Already Exist):
- ✅ `/api/user/households/[householdId]/preferences` - GET, POST, PATCH

---

## Theme Variable Integration

All components must use theme variables:

**Background Colors:**
- `bg-background` - Main background
- `bg-card` - Card backgrounds
- `bg-elevated` - Elevated/hover states

**Text Colors:**
- `text-foreground` - Primary text
- `text-muted-foreground` - Secondary text

**UI States:**
- `text-[var(--color-primary)]` - Primary actions
- `text-[var(--color-success)]` - Success states
- `text-[var(--color-warning)]` - Warnings
- `text-[var(--color-error)]` - Errors

**Borders:**
- `border-border` - Standard borders

---

## Success Criteria

- [ ] Task 4: Notifications tab uses household-scoped preferences API
- [ ] Task 4: All deprecated fields removed from notifications UI
- [ ] Task 4: Household name displayed in notifications tab header
- [ ] Task 5: Household switcher handles async operation with loading state
- [ ] Task 6: Migration helper utility created and tested
- [ ] Task 7: All manual tests pass
- [ ] No console errors
- [ ] Theme switches automatically on household change
- [ ] Notification preferences isolated per household
- [ ] All theme variables used correctly

---

## Next Steps After Completion

1. Update `docs/phase-0-implementation-progress.md` - Mark Phase 0.4 as 100% complete
2. Update `docs/features.md` - Update Phase 0.4 status to complete
3. Begin Phase 0.5: Testing & Polish
4. Document any issues or technical debt
5. Prepare for Phase 1: Core Data Isolation

---

**Document Version:** 1.0
**Last Updated:** 2025-11-14
**Status:** READY TO IMPLEMENT - Starting with Task 4
