# Phase 0: Settings Three-Tier Architecture - Implementation Progress

**Feature:** Household Data Isolation - Settings Reorganization
**Status:** In Progress - Phase 0.1 & 0.2 Complete
**Started:** 2025-11-14
**Document Version:** 1.0

---

## Overview

Phase 0 is the foundational step for the Household Data Isolation feature. It reorganizes the settings architecture into three tiers:
1. **User-Only Settings** - Follow user across all households (profile, security, accessibility)
2. **User-Per-Household Settings** - User sets different value per household (theme, date format, notifications)
3. **Household-Only Settings** - Shared by all members (currency, fiscal year, budget method)

This architecture enables:
- Users to have different themes/preferences per household
- Households to share core financial settings (currency, fiscal year)
- Proper data isolation when switching between households

---

## ✅ Phase 0.1: Database & Migration (COMPLETE)

**Completion Date:** 2025-11-14
**Status:** ✅ All tasks complete

### Completed Tasks

#### 1. Schema Updates
**File:** `lib/db/schema.ts`

Added two new tables:

**Table 1: `userHouseholdPreferences`**
- Stores user-specific preferences per household
- Fields: theme, date format, number format, default account, notification preferences (all 9 types)
- Unique constraint: (userId, householdId)
- Indexes: userId, householdId, composite unique index

**Table 2: `householdSettings`**
- Stores household-wide shared settings
- Fields: currency, fiscal year, budget method, data retention, auto-categorization
- Unique constraint: householdId
- Indexes: householdId

#### 2. Migration Files Created

**Migration 0032:** `add_user_household_preferences.sql`
- Creates user_household_preferences table
- Adds all 18 notification preference fields (9 types × 2 fields each)
- Creates 3 indexes for performance

**Migration 0033:** `add_household_settings.sql`
- Creates household_settings table
- Includes all household-wide configuration fields
- Creates 1 index on householdId

**Migration 0034:** `populate_user_household_preferences.sql`
- Migrates existing user preferences from user_settings and notification_preferences
- Creates one record per active household membership
- Uses COALESCE to handle NULL values with defaults

**Migration 0035:** `populate_household_settings.sql`
- Creates household settings from household creator's preferences
- Uses household creator's user_settings as defaults
- One record per household

#### 3. Migration Application & Verification

**Applied:** All 4 migrations successfully applied to database

**Verification Results:**
- ✅ 9 user_household_preferences records created (one per active household member)
- ✅ 8 household_settings records created (one per household)
- ✅ No NULL values in critical fields
- ✅ Data correctly migrated from existing tables
- ✅ Sample data verified:
  - Themes: dark-blue (migrated from user_settings)
  - Date formats: MM/DD/YYYY
  - Notification channels: ["push","email"]
  - Currencies: USD

---

## ✅ Phase 0.2: API Endpoints (COMPLETE)

**Completion Date:** 2025-11-14
**Status:** ✅ All tasks complete

### New API Endpoints Created

#### 1. User-Per-Household Preferences API
**File:** `app/api/user/households/[householdId]/preferences/route.ts`

**Endpoints:**
- `GET /api/user/households/[householdId]/preferences`
  - Returns user's preferences for specific household
  - Includes defaults for new users
  - Authorization: User must be member of household

- `POST /api/user/households/[householdId]/preferences`
  - Updates user's preferences (partial updates supported)
  - Creates record if doesn't exist
  - Authorization: User must be member of household

- `PATCH /api/user/households/[householdId]/preferences`
  - Resets user's preferences to defaults
  - Authorization: User must be member of household

**Features:**
- Automatic membership verification via `isMemberOfHousehold()`
- Supports partial updates (only provided fields updated)
- Returns defaults if preferences don't exist yet
- Merges with defaults to handle new fields

#### 2. Household Settings API
**File:** `app/api/households/[householdId]/settings/route.ts`

**Endpoints:**
- `GET /api/households/[householdId]/settings`
  - Returns household-wide settings
  - Available to all household members
  - Authorization: User must be member of household

- `POST /api/households/[householdId]/settings`
  - Updates household settings (partial updates supported)
  - Creates record if doesn't exist
  - Authorization: User must be owner or admin (via `hasPermission()`)

- `PATCH /api/households/[householdId]/settings`
  - Resets household settings to defaults
  - Authorization: User must be owner or admin (via `hasPermission()`)

**Features:**
- Role-based authorization (owner/admin only for mutations)
- All members can read settings
- Supports partial updates
- Returns defaults if settings don't exist yet
- Merges with defaults to handle new fields

### Security Features

**Authentication:** All endpoints use `requireAuth()` helper
**Authorization Levels:**
1. Household membership verification via `isMemberOfHousehold()`
2. Role-based permissions via `hasPermission()` for admin-only operations

**Error Handling:**
- 401 Unauthorized - No valid session
- 403 Forbidden - Not a member or insufficient permissions
- 404 Not Found - Household doesn't exist
- 500 Internal Server Error - Database errors

---

## ✅ Phase 0.3: UI Restructure (COMPLETE)

**Completion Date:** 2025-11-14
**Status:** ✅ All tasks complete

### Completed Tasks

1. **Create Three-Section Settings Layout**
   - Household Settings section (5 tabs)
   - My Preferences section (4 tabs)
   - User Settings section (3 tabs)

2. **Household Settings Components** (Shared by all members)
   - Preferences tab: Currency, Time Format, Fiscal Year
   - Financial tab: Budget Method, Budget Period, Auto-Categorization
   - Rules tab: Categorization Rules
   - Data Management tab: Retention, Cleanup, Cache
   - Members tab: Household Member Management

3. **User-Per-Household Preferences Components**
   - Preferences tab: Date Format, Number Format, Default Account, Start of Week
   - Financial tab: Amount Display, Negative Format, Default Transaction Type
   - Theme tab: Active Theme selector
   - Notifications tab: All 9 notification types with channel selection

4. **User Settings Components** (Global across households)
   - Profile tab: Name, Email, Bio, Avatar, Timezone
   - Privacy & Security tab: Visibility, Sessions, Data Export, Account Deletion
   - Accessibility & Advanced tab: Motion, Contrast, Text Size, Developer Mode

### Technical Requirements
- Update existing settings page at `/dashboard/settings`
- Use semantic theme variables throughout
- Integrate with new API endpoints
- Handle household context switching
- Auto-save preferences on change
- Loading states for async operations

---

## ⏳ Phase 0.4: Theme & Notifications (PENDING)

**Estimated Time:** 1 day
**Status:** Not yet started

### Planned Tasks

1. **Update Theme System**
   - Load theme from user_household_preferences instead of user_settings
   - Apply theme on household switch
   - Update theme context provider
   - Clear user-level theme from user_settings (after frontend migration)

2. **Update Notification System**
   - Move notification preferences to user_household_preferences
   - Update notification preference API
   - Update notification sending to use per-household preferences
   - Test notifications work per-household

3. **Household Switching Integration**
   - Load preferences when switching households
   - Apply theme immediately on switch
   - Reload data with new household context
   - Persist last-selected household

---

## ⏳ Phase 0.5: Testing & Polish (PENDING)

**Estimated Time:** 1 day
**Status:** Not yet started

### Planned Tests

1. **Unit Tests**
   - User-per-household preferences save/load
   - Household settings shared across members
   - User settings remain global
   - Authorization checks work correctly

2. **Integration Tests**
   - Theme switching per household
   - Notifications per household
   - Settings persist across sessions
   - Migration of existing data

3. **Manual Testing**
   - Create/update preferences in multiple households
   - Verify different themes per household
   - Test admin-only settings endpoints
   - Verify data isolation

---

## Timeline Summary

| Phase | Description | Estimated | Status |
|-------|-------------|-----------|--------|
| 0.1 | Database & Migration | 1.5 days | ✅ Complete |
| 0.2 | API Endpoints | 1.5 days | ✅ Complete |
| 0.3 | UI Restructure | 2 days | ✅ Complete |
| 0.4 | Theme & Notifications | 1 day | ⏳ Pending |
| 0.5 | Testing & Polish | 1 day | ⏳ Pending |
| **Total** | **Phase 0 Complete** | **7 days** | **71% Complete** |

---

## Files Modified/Created

### Database Files
- ✅ `lib/db/schema.ts` - Added 2 new tables (118 lines added)
- ✅ `drizzle/0032_add_user_household_preferences.sql` - New migration (72 lines)
- ✅ `drizzle/0033_add_household_settings.sql` - New migration (32 lines)
- ✅ `drizzle/0034_populate_user_household_preferences.sql` - New migration (65 lines)
- ✅ `drizzle/0035_populate_household_settings.sql` - New migration (39 lines)

### API Files
- ✅ `app/api/user/households/[householdId]/preferences/route.ts` - New endpoint (263 lines)
- ✅ `app/api/households/[householdId]/settings/route.ts` - New endpoint (236 lines)

### UI Files
- ✅ `app/dashboard/settings/page.tsx` - Restructured with three-section layout (339 lines)

### Documentation Files
- ✅ `docs/phase-0-implementation-progress.md` - This file

**Total Lines Added:** ~1,164 lines
**Total Files Created:** 8 files
**Total Files Modified:** 2 files

---

## Next Steps

1. **Immediate:** Begin Phase 0.3 (UI Restructure)
   - Restructure `/dashboard/settings` page with three-section layout
   - Create components for household settings (read-only for non-admins)
   - Create components for user-per-household preferences
   - Update user settings components (remove moved fields)

2. **After Phase 0.3:** Begin Phase 0.4 (Theme & Notifications)
   - Update theme context to load from user_household_preferences
   - Update household switcher to apply theme on switch
   - Update notification system to use per-household preferences

3. **After Phase 0.4:** Begin Phase 0.5 (Testing & Polish)
   - Write comprehensive tests
   - Manual testing across multiple households
   - Bug fixes and polish

4. **After Phase 0 Complete:** Begin Phase 1 (Core Data Isolation)
   - Add household_id to transactions, accounts, categories, merchants
   - Update all transaction/account APIs
   - Update frontend to pass household context

---

## Technical Debt Notes

**Deferred Tasks:**
- Updating user_settings table to remove moved fields (will do after frontend migration)
- Updating existing user_settings API endpoints (will do after frontend migration)
- Cleaning up old notification_preferences table (will do after notification migration)

**Reasoning:** Keeping old fields temporarily ensures backward compatibility while frontend is being updated. Once Phase 0.3 and 0.4 are complete, we can safely remove old fields and update the user settings API.

---

**Last Updated:** 2025-11-14
**Next Review:** After Phase 0.3 completion
