# Phase 3 Step 5: Testing & Validation - Detailed Implementation Plan

**Status:** Ready to Start  
**Priority:** High  
**Estimated Time:** 2-3 hours  
**Created:** 2025-01-27  
**Dependencies:** Phase 3 Steps 1-4 complete ✅

---

## Overview

This plan details the comprehensive testing and validation required to ensure Phase 3 (Goals & Debts household isolation) is working correctly. All components, API endpoints, and data isolation must be verified before proceeding to Step 6 (Documentation & Cleanup).

**Key Testing Areas:**
1. Database migration verification
2. API endpoint security and filtering
3. Frontend component behavior with household switching
4. Integration testing (cross-entity validation)
5. Edge case handling

---

## Testing Checklist

### Task 5.1: Database Migration Verification

**Objective:** Verify that migration `0044_add_household_id_to_goals_debts.sql` was applied successfully and all data is properly backfilled.

**Steps:**
1. **Check Migration Status**
   - Verify migration file exists: `drizzle/0044_add_household_id_to_goals_debts.sql`
   - Check if migration was applied (check migration tracking table or database schema)
   - Verify no migration errors occurred

2. **Verify Schema Changes**
   - Check `savings_goals` table has `household_id` column (NOT NULL)
   - Check `savings_milestones` table has `household_id` column (NOT NULL)
   - Check `debts` table has `household_id` column (NOT NULL)
   - Check `debt_payments` table has `household_id` column (NOT NULL)
   - Check `debt_payoff_milestones` table has `household_id` column (NOT NULL)
   - Check `debt_settings` table has `household_id` column (NOT NULL)

3. **Verify Data Backfill**
   - Query: `SELECT COUNT(*) FROM savings_goals WHERE household_id IS NULL` → Should return 0
   - Query: `SELECT COUNT(*) FROM savings_milestones WHERE household_id IS NULL` → Should return 0
   - Query: `SELECT COUNT(*) FROM debts WHERE household_id IS NULL` → Should return 0
   - Query: `SELECT COUNT(*) FROM debt_payments WHERE household_id IS NULL` → Should return 0
   - Query: `SELECT COUNT(*) FROM debt_payoff_milestones WHERE household_id IS NULL` → Should return 0
   - Query: `SELECT COUNT(*) FROM debt_settings WHERE household_id IS NULL` → Should return 0

4. **Verify Indexes Created**
   - Check indexes exist for performance:
     - `idx_savings_goals_household`
     - `idx_savings_goals_user_household`
     - `idx_savings_milestones_household`
     - `idx_savings_milestones_user_household`
     - `idx_debts_household`
     - `idx_debts_user_household`
     - `idx_debt_payments_household`
     - `idx_debt_payments_user_household`
     - `idx_debt_payoff_milestones_household`
     - `idx_debt_payoff_milestones_user_household`
     - `idx_debt_settings_household`
     - `idx_debt_settings_user_household`

5. **Verify Data Relationships**
   - Check milestones inherit household from parent goal:
     ```sql
     SELECT COUNT(*) FROM savings_milestones sm
     LEFT JOIN savings_goals sg ON sm.goal_id = sg.id
     WHERE sm.household_id != sg.household_id;
     ```
     → Should return 0
   
   - Check payments inherit household from parent debt:
     ```sql
     SELECT COUNT(*) FROM debt_payments dp
     LEFT JOIN debts d ON dp.debt_id = d.id
     WHERE dp.household_id != d.household_id;
     ```
     → Should return 0
   
   - Check payoff milestones inherit household from parent debt:
     ```sql
     SELECT COUNT(*) FROM debt_payoff_milestones dpm
     LEFT JOIN debts d ON dpm.debt_id = d.id
     WHERE dpm.household_id != d.household_id;
     ```
     → Should return 0

**Success Criteria:**
- ✅ All 6 tables have `household_id` column
- ✅ 0 NULL values in all `household_id` columns
- ✅ All 12 indexes created and working
- ✅ All data relationships verified (inheritance working correctly)

---

### Task 5.2: API Endpoint Testing

**Objective:** Verify all Goals and Debts API endpoints properly filter by household and prevent cross-household access.

#### Savings Goals API Endpoints (3 endpoints)

**5.2.1: GET `/api/savings-goals`**
- **Test Case 1:** Request with valid household ID → Should return only goals for that household
- **Test Case 2:** Request with different household ID → Should return different goals
- **Test Case 3:** Request without household ID → Should return 400 Bad Request
- **Test Case 4:** Request with household ID user is not member of → Should return 403 Forbidden
- **Test Case 5:** Request with invalid household ID → Should return 403 Forbidden

**5.2.2: POST `/api/savings-goals`**
- **Test Case 1:** Create goal with valid household ID → Should succeed
- **Test Case 2:** Create goal with account from same household → Should succeed
- **Test Case 3:** Create goal with account from different household → Should return 400/403
- **Test Case 4:** Create goal without household ID → Should return 400 Bad Request
- **Test Case 5:** Create goal with household ID user is not member of → Should return 403 Forbidden
- **Test Case 6:** Verify created goal has correct `household_id`

**5.2.3: GET `/api/savings-goals/[id]`**
- **Test Case 1:** Get goal from user's household → Should succeed
- **Test Case 2:** Get goal from different household → Should return 404 Not Found (not 403 to prevent enumeration)
- **Test Case 3:** Get goal without household ID → Should return 400 Bad Request
- **Test Case 4:** Verify returned goal includes milestones filtered by household

**5.2.4: PUT `/api/savings-goals/[id]`**
- **Test Case 1:** Update goal from user's household → Should succeed
- **Test Case 2:** Update goal from different household → Should return 404 Not Found
- **Test Case 3:** Update goal with account from different household → Should return 400/403
- **Test Case 4:** Verify updated goal maintains correct `household_id`

**5.2.5: DELETE `/api/savings-goals/[id]`**
- **Test Case 1:** Delete goal from user's household → Should succeed
- **Test Case 2:** Delete goal from different household → Should return 404 Not Found
- **Test Case 3:** Verify milestones are also deleted (cascade)

**5.2.6: GET `/api/savings-goals/[id]/progress`**
- **Test Case 1:** Get progress for goal from user's household → Should succeed
- **Test Case 2:** Get progress for goal from different household → Should return 404 Not Found
- **Test Case 3:** Verify transactions filtered by household (Phase 1 already done)

#### Debts API Endpoints (13 endpoints)

**5.2.7: GET `/api/debts`**
- **Test Case 1:** Request with valid household ID → Should return only debts for that household
- **Test Case 2:** Request with different household ID → Should return different debts
- **Test Case 3:** Request without household ID → Should return 400 Bad Request
- **Test Case 4:** Request with household ID user is not member of → Should return 403 Forbidden

**5.2.8: POST `/api/debts`**
- **Test Case 1:** Create debt with valid household ID → Should succeed
- **Test Case 2:** Create debt with account from same household → Should succeed
- **Test Case 3:** Create debt with account from different household → Should return 400/403
- **Test Case 4:** Create debt with category from different household → Should return 400/403
- **Test Case 5:** Verify created debt has correct `household_id`

**5.2.9: GET `/api/debts/[id]`**
- **Test Case 1:** Get debt from user's household → Should succeed
- **Test Case 2:** Get debt from different household → Should return 404 Not Found
- **Test Case 3:** Verify returned debt includes payments and milestones filtered by household

**5.2.10: PUT `/api/debts/[id]`**
- **Test Case 1:** Update debt from user's household → Should succeed
- **Test Case 2:** Update debt from different household → Should return 404 Not Found
- **Test Case 3:** Update debt with account/category from different household → Should return 400/403

**5.2.11: DELETE `/api/debts/[id]`**
- **Test Case 1:** Delete debt from user's household → Should succeed
- **Test Case 2:** Delete debt from different household → Should return 404 Not Found
- **Test Case 3:** Verify payments and milestones are also deleted (cascade)

**5.2.12: GET `/api/debts/[id]/payments`**
- **Test Case 1:** Get payments for debt from user's household → Should succeed
- **Test Case 2:** Get payments for debt from different household → Should return 404 Not Found
- **Test Case 3:** Verify payments filtered by household

**5.2.13: POST `/api/debts/[id]/payments`**
- **Test Case 1:** Create payment for debt from user's household → Should succeed
- **Test Case 2:** Create payment for debt from different household → Should return 404 Not Found
- **Test Case 3:** Create payment with transaction from different household → Should return 400/403
- **Test Case 4:** Verify created payment has correct `household_id`

**5.2.14: GET `/api/debts/stats`**
- **Test Case 1:** Get stats for user's household → Should succeed
- **Test Case 2:** Get stats for different household → Should return different stats
- **Test Case 3:** Verify stats filtered by household (debts, payments, transactions)

**5.2.15: GET `/api/debts/settings`**
- **Test Case 1:** Get settings for user's household → Should succeed (create default if missing)
- **Test Case 2:** Get settings for different household → Should return different settings
- **Test Case 3:** Verify settings are per-household

**5.2.16: PUT `/api/debts/settings`**
- **Test Case 1:** Update settings for user's household → Should succeed
- **Test Case 2:** Update settings for different household → Should return 403 Forbidden
- **Test Case 3:** Verify settings are per-household (switching households shows different settings)

**5.2.17-19: Other Debt Endpoints**
- Test all remaining endpoints (`/payoff-strategy`, `/scenarios`, `/adherence`, `/countdown`, `/credit-utilization`, `/minimum-warning`, `/reduction-chart`, `/streak`) with same pattern:
  - Verify household filtering works
  - Verify cross-household access is blocked
  - Verify missing household ID returns 400

**Success Criteria:**
- ✅ All 16 API endpoints tested
- ✅ Household filtering verified for all endpoints
- ✅ Cross-household access blocked (403/404)
- ✅ Missing household ID returns 400
- ✅ Related entity validation works (accounts, categories, transactions)

---

### Task 5.3: Frontend Component Testing

**Objective:** Verify all frontend components correctly display household-specific data and update when switching households.

#### Goals Page Testing

**5.3.1: Goals Page (`app/dashboard/goals/page.tsx`)**
- **Test Case 1:** Load page with Household A → Should show only Household A goals
- **Test Case 2:** Create goal in Household A → Should appear in list
- **Test Case 3:** Switch to Household B → Should show only Household B goals (Household A goals hidden)
- **Test Case 4:** Create goal in Household B → Should appear in list
- **Test Case 5:** Switch back to Household A → Should show only Household A goals
- **Test Case 6:** Edit goal in Household A → Should succeed
- **Test Case 7:** Try to edit goal ID from Household B while in Household A → Should fail (404)
- **Test Case 8:** Delete goal in Household A → Should succeed
- **Test Case 9:** Verify no console errors when switching households

#### Debts Page Testing

**5.3.2: Debts Page (`app/dashboard/debts/page.tsx`)**
- **Test Case 1:** Load page with Household A → Should show only Household A debts
- **Test Case 2:** Create debt in Household A → Should appear in list
- **Test Case 3:** Switch to Household B → Should show only Household B debts (Household A debts hidden)
- **Test Case 4:** Create debt in Household B → Should appear in list
- **Test Case 5:** Switch back to Household A → Should show only Household A debts
- **Test Case 6:** Edit debt in Household A → Should succeed
- **Test Case 7:** Try to edit debt ID from Household B while in Household A → Should fail (404)
- **Test Case 8:** Delete debt in Household A → Should succeed
- **Test Case 9:** Verify no console errors when switching households

#### Widget Components Testing

**5.3.3: Savings Goals Widget (`components/dashboard/savings-goals-widget.tsx`)**
- **Test Case 1:** Widget shows correct goals for selected household
- **Test Case 2:** Switching households updates widget data
- **Test Case 3:** Widget handles empty household gracefully

**5.3.4: Debt-Free Countdown (`components/dashboard/debt-free-countdown.tsx`)**
- **Test Case 1:** Widget shows correct countdown for selected household
- **Test Case 2:** Switching households updates countdown
- **Test Case 3:** Widget handles no debts gracefully

**5.3.5: Debt Countdown Card (`components/dashboard/debt-countdown-card.tsx`)**
- **Test Case 1:** Card shows correct countdown for selected household
- **Test Case 2:** Switching households updates card data

#### Debt Component Testing

**5.3.6: Debt Payoff Strategy (`components/debts/debt-payoff-strategy.tsx`)**
- **Test Case 1:** Strategy shows correct debts for selected household
- **Test Case 2:** Switching households updates strategy
- **Test Case 3:** Settings are per-household

**5.3.7: Payment History List (`components/debts/payment-history-list.tsx`)**
- **Test Case 1:** List shows correct payments for selected household debt
- **Test Case 2:** Switching households updates payment list

**5.3.8: Other Debt Components**
- Test all remaining debt components (amortization, what-if calculator, charts, widgets) with same pattern:
  - Verify data is household-specific
  - Verify switching households updates data
  - Verify no console errors

**Success Criteria:**
- ✅ All 20 frontend components tested
- ✅ Data isolation verified (switching households shows different data)
- ✅ No console errors when switching households
- ✅ All components handle empty households gracefully
- ✅ All components use semantic theme variables

---

### Task 5.4: Integration Testing

**Objective:** Verify cross-entity relationships work correctly with household isolation.

#### Goal Integration Testing

**5.4.1: Goal Creation with Account Validation**
- **Test Case 1:** Create goal with account from same household → Should succeed
- **Test Case 2:** Create goal with account from different household → Should return 400/403
- **Test Case 3:** Create goal with account ID that doesn't exist → Should return 404
- **Test Case 4:** Verify goal progress calculations use household-filtered transactions

**5.4.2: Goal Milestone Testing**
- **Test Case 1:** Create milestone for goal → Should inherit household from goal
- **Test Case 2:** Verify milestone appears in goal details
- **Test Case 3:** Delete goal → Should cascade delete milestones

#### Debt Integration Testing

**5.4.3: Debt Creation with Account/Category Validation**
- **Test Case 1:** Create debt with account from same household → Should succeed
- **Test Case 2:** Create debt with account from different household → Should return 400/403
- **Test Case 3:** Create debt with category from same household → Should succeed
- **Test Case 4:** Create debt with category from different household → Should return 400/403

**5.4.4: Debt Payment Testing**
- **Test Case 1:** Create payment for debt from same household → Should succeed
- **Test Case 2:** Create payment for debt from different household → Should return 404
- **Test Case 3:** Create payment with transaction from same household → Should succeed
- **Test Case 4:** Create payment with transaction from different household → Should return 400/403
- **Test Case 5:** Verify payment inherits household from debt
- **Test Case 6:** Verify payment appears in debt details

**5.4.5: Debt Settings Testing**
- **Test Case 1:** Get settings for Household A → Should return Household A settings
- **Test Case 2:** Update settings for Household A → Should succeed
- **Test Case 3:** Switch to Household B → Should show different settings (or default)
- **Test Case 4:** Update settings for Household B → Should succeed
- **Test Case 5:** Switch back to Household A → Should show original settings

**5.4.6: Debt Calculations Testing**
- **Test Case 1:** Verify payoff strategy uses household-filtered debts
- **Test Case 2:** Verify credit utilization uses household-filtered debts
- **Test Case 3:** Verify countdown uses household-filtered debts
- **Test Case 4:** Verify charts use household-filtered data

**Success Criteria:**
- ✅ All cross-entity validations work correctly
- ✅ Household inheritance verified (milestones, payments)
- ✅ Settings are per-household
- ✅ Calculations use household-filtered data

---

### Task 5.5: Edge Case Testing

**Objective:** Verify system handles edge cases gracefully.

**5.5.1: Multiple Households**
- **Test Case 1:** User belongs to 3+ households → All households accessible
- **Test Case 2:** User switches between multiple households → Data isolation maintained
- **Test Case 3:** User creates goals/debts in each household → All isolated correctly

**5.5.2: Single Household**
- **Test Case 1:** User belongs to only one household → System works normally
- **Test Case 2:** User cannot access non-existent household → Returns 403

**5.5.3: Empty Households**
- **Test Case 1:** Household with no goals → Goals page shows empty state
- **Test Case 2:** Household with no debts → Debts page shows empty state
- **Test Case 3:** Widgets handle empty households gracefully → No errors

**5.5.4: Data Calculations**
- **Test Case 1:** Goal progress calculations with household isolation → Correct totals
- **Test Case 2:** Debt payoff calculations with household isolation → Correct projections
- **Test Case 3:** Milestone tracking with household isolation → Correct milestones

**5.5.5: Performance**
- **Test Case 1:** Switching households is fast (< 500ms)
- **Test Case 2:** Loading goals/debts with many records is performant
- **Test Case 3:** Database queries use indexes (check query plans)

**Success Criteria:**
- ✅ All edge cases handled gracefully
- ✅ No errors or crashes
- ✅ Performance acceptable
- ✅ User experience smooth

---

## Testing Tools & Methods

### Manual Testing
- Use browser DevTools to monitor network requests
- Check console for errors
- Verify UI updates correctly
- Test with multiple user accounts and households

### Database Queries
- Use SQLite CLI or database browser to verify data
- Check migration status
- Verify indexes exist
- Check data relationships

### API Testing
- Use browser DevTools Network tab
- Use curl or Postman for direct API testing
- Verify response codes and data

### Performance Testing
- Monitor network request times
- Check database query execution times
- Verify no N+1 query problems

---

## Test Results Documentation

After completing all tests, document results in:
- `docs/phase-3-step-5-test-results.md`

**Include:**
- Test execution summary
- Any issues found
- Performance metrics
- Recommendations for fixes (if any)

---

## Success Criteria

### Step 5 Complete When:
- [ ] All database migrations verified (0 NULL values)
- [ ] All 16 API endpoints tested and working
- [ ] All 20 frontend components tested and working
- [ ] Integration tests passing
- [ ] Edge cases handled gracefully
- [ ] Performance acceptable
- [ ] No console errors
- [ ] Test results documented

---

## Estimated Timeline

- **Task 5.1 (Database Verification):** 30 minutes
- **Task 5.2 (API Testing):** 1 hour
- **Task 5.3 (Frontend Testing):** 1 hour
- **Task 5.4 (Integration Testing):** 30 minutes
- **Task 5.5 (Edge Cases):** 30 minutes
- **Documentation:** 30 minutes

**Total:** 4 hours

---

## Notes

- Test systematically, one area at a time
- Document any issues found immediately
- Fix critical issues before proceeding
- Non-critical issues can be documented for later
- All tests should be repeatable
- Use real user scenarios when possible

---

**Document Version:** 1.0  
**Created:** 2025-01-27  
**Status:** Ready for Implementation

