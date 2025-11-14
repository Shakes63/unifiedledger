# Phase 0.5: Testing & Polish - Implementation Plan

**Feature:** Household Data Isolation - Testing & Polish
**Status:** Planning
**Created:** 2025-11-14
**Estimated Time:** 1 day (~8 hours)

---

## Overview

Phase 0.5 is the final phase of the Settings Three-Tier Architecture implementation. This phase focuses on comprehensive testing of the new settings system and ensuring all features work correctly across multiple households.

**Previous Phases Completed:**
- ✅ Phase 0.1: Database & Migration
- ✅ Phase 0.2: API Endpoints
- ✅ Phase 0.3: UI Restructure
- ✅ Phase 0.4: Theme & Notifications

**Testing Scope:**
- User-per-household preferences (theme, notifications, date format, etc.)
- Household settings (currency, fiscal year, budget method, etc.)
- User settings (profile, security, accessibility)
- Authorization and permission checks
- Data isolation between households
- Migration utilities

---

## Architecture Overview

### Three-Tier Settings System

**1. User Settings (Global across households)**
- Stored in: `user`, `user_settings`, `user_sessions`
- Examples: Name, email, password, timezone, developer mode
- Follow the user across all households

**2. User-Per-Household Preferences**
- Stored in: `user_household_preferences`
- Examples: Theme, notifications, date format, default account
- User can have different values per household

**3. Household Settings (Shared by all members)**
- Stored in: `household_settings`
- Examples: Currency, fiscal year, budget method
- Same for all members, only owner/admin can change

### Key Components to Test

**Database Tables:**
- `user_household_preferences` - Per-household user preferences
- `household_settings` - Shared household settings
- Migration integrity (data from old tables)

**API Endpoints:**
- `/api/user/households/[householdId]/preferences` (GET, POST, PATCH)
- `/api/households/[householdId]/settings` (GET, POST, PATCH)

**Frontend Components:**
- `contexts/household-context.tsx` - Preference loading, theme switching
- `components/settings/notifications-tab.tsx` - Per-household notifications
- `components/settings/theme-tab.tsx` - Per-household theme
- `components/household/household-selector.tsx` - Household switching

**Utilities:**
- `lib/migrations/migrate-to-household-preferences.ts` - Migration helpers

---

## Testing Strategy

### 1. Unit Tests (4-5 hours)

Focus on isolated component/function testing without full integration.

#### 1.1 API Endpoint Tests (~2 hours)

**File:** `__tests__/api/user-household-preferences.test.ts`

**Test Cases:**
- ✅ GET returns default preferences for new user
- ✅ GET returns existing preferences
- ✅ GET returns 403 if user not member of household
- ✅ POST creates new preferences
- ✅ POST updates existing preferences (partial update)
- ✅ POST validates theme values
- ✅ POST validates notification channel arrays
- ✅ POST returns 403 if user not member of household
- ✅ PATCH resets to defaults
- ✅ Multiple users can have different preferences in same household

**File:** `__tests__/api/household-settings.test.ts`

**Test Cases:**
- ✅ GET returns default settings for new household
- ✅ GET returns existing settings
- ✅ GET returns 403 if user not member of household
- ✅ POST creates new settings (owner only)
- ✅ POST updates existing settings (admin only)
- ✅ POST validates currency codes
- ✅ POST validates budget method values
- ✅ POST returns 403 if user is viewer (not owner/admin)
- ✅ PATCH resets to defaults (owner/admin only)
- ✅ All members can read settings

#### 1.2 Migration Utility Tests (~1 hour)

**File:** `__tests__/lib/migrate-to-household-preferences.test.ts`

**Test Cases:**
- ✅ `hasHouseholdPreferences()` returns true if preferences exist
- ✅ `hasHouseholdPreferences()` returns false if no preferences
- ✅ `migrateUserPreferences()` creates preferences from user_settings
- ✅ `migrateUserPreferences()` migrates all notification fields
- ✅ `migrateUserPreferences()` uses defaults for missing fields
- ✅ `getOrMigratePreferences()` returns existing preferences
- ✅ `getOrMigratePreferences()` auto-migrates if needed
- ✅ `batchMigrateHousehold()` migrates all household members

#### 1.3 Household Context Tests (~1 hour)

**File:** `__tests__/contexts/household-context.test.tsx`

**Test Cases:**
- ✅ Loads preferences on household change
- ✅ Applies theme on household change
- ✅ Persists last-selected household to localStorage
- ✅ Shows loading state during household switch
- ✅ Handles API errors gracefully
- ✅ Loads defaults if no preferences exist

#### 1.4 Theme Provider Tests (~30 min)

**File:** `__tests__/providers/theme-provider.test.tsx`

**Test Cases:**
- ✅ Uses theme from household context
- ✅ Applies theme CSS variables
- ✅ Updates theme when household context changes
- ✅ Persists theme to localStorage
- ✅ Loads theme from localStorage on mount

### 2. Integration Tests (2-3 hours)

Focus on end-to-end flows across multiple components.

#### 2.1 Theme Switching Integration (~1 hour)

**File:** `__tests__/integration/theme-switching.test.tsx`

**Test Cases:**
- ✅ User switches household, theme changes
- ✅ User updates theme in one household, other households unchanged
- ✅ Theme persists across page reloads
- ✅ Theme applies immediately (no flash of wrong theme)
- ✅ Multiple tabs sync theme changes

#### 2.2 Notification Preferences Integration (~1 hour)

**File:** `__tests__/integration/notification-preferences.test.tsx`

**Test Cases:**
- ✅ User saves notification preferences in one household
- ✅ Preferences don't affect other households
- ✅ Channel arrays validate correctly (require at least one)
- ✅ Preferences persist across page reloads
- ✅ Admin can't see other users' notification preferences

#### 2.3 Household Settings Integration (~1 hour)

**File:** `__tests__/integration/household-settings.test.tsx`

**Test Cases:**
- ✅ Owner updates currency, all members see change
- ✅ Admin updates budget method, all members see change
- ✅ Viewer can read settings but can't update
- ✅ Settings persist across page reloads
- ✅ Settings are isolated per household

### 3. Manual Testing (1-2 hours)

Hands-on testing to verify UX and edge cases.

#### 3.1 Multi-Household Testing (~30 min)

**Scenario 1: User with 3 households**
- Create 3 test households
- Set different theme for each (e.g., dark-blue, light-bubblegum, dark-pink)
- Switch between households and verify theme changes
- Set different notification preferences per household
- Verify preferences are isolated

**Scenario 2: Multiple users in same household**
- Create 2 test users in same household
- User A sets dark-blue theme
- User B sets light-turquoise theme
- Verify each user sees their own theme
- Owner updates currency to EUR
- Verify both users see EUR

#### 3.2 Permission Testing (~30 min)

**Test owner permissions:**
- ✅ Can update household settings
- ✅ Can reset household settings
- ✅ Can view all settings tabs

**Test admin permissions:**
- ✅ Can update household settings
- ✅ Can reset household settings
- ✅ Can view all settings tabs

**Test viewer permissions:**
- ✅ Cannot update household settings (API returns 403)
- ✅ Can view household settings (read-only)
- ✅ Can update own preferences
- ✅ Settings inputs disabled or hidden

#### 3.3 Edge Case Testing (~30 min)

**Test migration edge cases:**
- User joins new household (no preferences yet)
- Verify defaults are loaded
- User updates preferences
- Verify preferences saved correctly

**Test household switching:**
- Rapid household switching (click multiple times)
- Verify no race conditions
- Verify loading state shows correctly

**Test data isolation:**
- User has household A and B
- Create preferences in household A
- Switch to household B
- Verify household A preferences not visible

---

## Test Implementation Order

### Step 1: API Endpoint Tests (2 hours)
1. Create test files in `__tests__/api/`
2. Test user-per-household preferences endpoint
3. Test household settings endpoint
4. Run tests: `pnpm test __tests__/api/`

### Step 2: Migration Utility Tests (1 hour)
1. Create test file in `__tests__/lib/`
2. Test all migration helper functions
3. Run tests: `pnpm test __tests__/lib/migrate-to-household-preferences`

### Step 3: Component Tests (1.5 hours)
1. Test household context
2. Test theme provider
3. Run tests: `pnpm test __tests__/contexts/ __tests__/providers/`

### Step 4: Integration Tests (2 hours)
1. Test theme switching flow
2. Test notification preferences flow
3. Test household settings flow
4. Run tests: `pnpm test __tests__/integration/`

### Step 5: Manual Testing (1.5 hours)
1. Multi-household scenarios
2. Permission testing
3. Edge case testing
4. Document any bugs found

### Step 6: Bug Fixes & Polish (Varies)
1. Fix any bugs found during testing
2. Update documentation
3. Final verification

---

## Success Criteria

**All tests pass:**
- ✅ Unit tests: 100% coverage of API endpoints, utilities, components
- ✅ Integration tests: All end-to-end flows work correctly
- ✅ Manual tests: All scenarios pass without errors

**No regressions:**
- ✅ Existing features still work (transactions, budgets, bills, etc.)
- ✅ Theme switching works in all scenarios
- ✅ Notification preferences save and load correctly
- ✅ Household settings shared correctly

**Performance:**
- ✅ Household switching is fast (<500ms)
- ✅ Theme applies without flash
- ✅ No unnecessary API calls

**UX:**
- ✅ Loading states show during async operations
- ✅ Error messages are clear and helpful
- ✅ Settings auto-save with visual feedback
- ✅ Permission checks work (no 403 errors in UI)

---

## Files to Create/Modify

### New Test Files (8 files)
1. `__tests__/api/user-household-preferences.test.ts` - API endpoint tests
2. `__tests__/api/household-settings.test.ts` - API endpoint tests
3. `__tests__/lib/migrate-to-household-preferences.test.ts` - Utility tests
4. `__tests__/contexts/household-context.test.tsx` - Context tests
5. `__tests__/providers/theme-provider.test.tsx` - Provider tests
6. `__tests__/integration/theme-switching.test.tsx` - Integration tests
7. `__tests__/integration/notification-preferences.test.tsx` - Integration tests
8. `__tests__/integration/household-settings.test.tsx` - Integration tests

### Documentation Updates (2 files)
1. `docs/phase-0-implementation-progress.md` - Mark Phase 0.5 complete
2. `docs/features.md` - Update completion status

---

## Known Issues to Test

Based on Phase 0.4 completion:
1. ✅ Fixed API response structure (theme not changing) - Verify fix works
2. ✅ Fixed credentials missing in fetch calls - Verify all endpoints include credentials
3. ✅ Fixed Date object usage in session utils - Verify no Date serialization errors

---

## Risk Assessment

**Low Risk:**
- API endpoint tests - Straightforward REST endpoint testing
- Migration utility tests - Pure functions, easy to test
- Component unit tests - Isolated component testing

**Medium Risk:**
- Integration tests - Require database setup, more complex
- Multi-household scenarios - Need proper test data setup

**High Risk:**
- Permission testing - Must verify security works correctly
- Data isolation - Critical for security, must be bulletproof

---

## Timeline

| Task | Estimated Time | Priority |
|------|----------------|----------|
| API Endpoint Tests | 2 hours | High |
| Migration Utility Tests | 1 hour | High |
| Component Tests | 1.5 hours | Medium |
| Integration Tests | 2 hours | High |
| Manual Testing | 1.5 hours | High |
| Bug Fixes & Polish | Variable | High |
| **Total** | **8+ hours** | - |

---

## Post-Testing Actions

After Phase 0.5 is complete:

1. **Update Documentation**
   - Mark Phase 0 as 100% complete
   - Update features.md
   - Document any known issues

2. **Code Cleanup**
   - Remove deprecated fields from old tables (if all tests pass)
   - Update API documentation
   - Add inline comments for complex logic

3. **Performance Review**
   - Run performance tests
   - Check for unnecessary re-renders
   - Optimize database queries if needed

4. **Prepare for Phase 1**
   - Review Phase 1 plan (Core Data Isolation)
   - Identify dependencies
   - Estimate timeline

---

## Next Steps After Phase 0

**Phase 1: Core Data Isolation** (Estimated 2-3 days)
- Add `household_id` to transactions, accounts, categories, merchants
- Update all transaction/account APIs to filter by household
- Update frontend to pass household context
- Test data isolation

**Phase 2: Financial Data Isolation** (Estimated 2-3 days)
- Add `household_id` to budgets, bills, goals, debts
- Update all financial APIs to filter by household
- Test budget/bill isolation

**Phase 3: Advanced Data Isolation** (Estimated 1-2 days)
- Add `household_id` to tags, custom fields, saved searches
- Update all advanced feature APIs
- Test complete isolation

**Phase 4: Final Testing & Migration** (Estimated 1-2 days)
- Comprehensive end-to-end testing
- Migration script for existing data
- Performance testing
- Security audit

---

**Last Updated:** 2025-11-14
**Status:** Ready to implement
**Next Action:** Begin Step 1 (API Endpoint Tests)
