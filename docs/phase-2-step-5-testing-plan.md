# Phase 2 Step 5: Testing & Validation - Implementation Plan

**Status:** Ready for Implementation  
**Priority:** High  
**Estimated Time:** 4-6 hours  
**Created:** 2025-01-27  
**Dependencies:** Phase 2 Steps 1-4 complete (database schema, bills API, budgets API, frontend components)

---

## Overview

This plan outlines comprehensive testing and validation for Phase 2 (Bills & Budgets) household data isolation. The goal is to ensure all bills and budgets data is properly isolated by household, with no data leakage between households.

**Key Testing Areas:**
1. Database migration verification
2. API endpoint security and filtering
3. Frontend component behavior
4. Integration scenarios
5. Edge cases and error handling

---

## Testing Strategy

### Test Environment Setup
- Use test database or ensure backup before testing
- Create test user with multiple households
- Create test data in each household
- Use browser dev tools to monitor network requests
- Check database directly for data isolation

### Test Data Requirements
- **Household A:** 3-5 bills, 2-3 budget categories with transactions
- **Household B:** 2-4 bills, 1-2 budget categories with transactions
- **Mixed Data:** Some bills/budgets in both households
- **Empty Household:** One household with no bills/budgets

---

## Detailed Testing Tasks

### Task 5.1: Database Migration Verification

**Objective:** Verify migration was applied correctly and all data has household assignments.

**Steps:**
1. **Check Migration Applied:**
   ```sql
   -- Verify migration exists
   SELECT name FROM sqlite_master WHERE type='table' AND name='bills';
   SELECT name FROM sqlite_master WHERE type='table' AND name='bill_instances';
   
   -- Check for household_id columns
   PRAGMA table_info(bills);
   PRAGMA table_info(bill_instances);
   ```

2. **Verify No NULL household_id:**
   ```sql
   -- Should return 0 rows
   SELECT COUNT(*) FROM bills WHERE household_id IS NULL;
   SELECT COUNT(*) FROM bill_instances WHERE household_id IS NULL;
   ```

3. **Check Indexes Created:**
   ```sql
   -- Verify indexes exist
   SELECT name FROM sqlite_master 
   WHERE type='index' 
   AND (name LIKE '%bills%household%' OR name LIKE '%bill_instances%household%');
   ```

4. **Test Query Performance:**
   ```sql
   -- Test query with household filter
   EXPLAIN QUERY PLAN 
   SELECT * FROM bills WHERE household_id = 'test-household-id';
   
   -- Should use index
   EXPLAIN QUERY PLAN
   SELECT * FROM bill_instances WHERE household_id = 'test-household-id';
   ```

**Success Criteria:**
- [ ] Migration file exists and was applied
- [ ] All bills have `household_id` (0 NULL values)
- [ ] All bill instances have `household_id` (0 NULL values)
- [ ] All indexes created successfully
- [ ] Queries use indexes (no full table scans)

---

### Task 5.2: Bills API Endpoint Testing

**Objective:** Verify all bills API endpoints properly filter by household and prevent cross-household access.

**Endpoints to Test:**
1. `GET /api/bills` - List bills
2. `GET /api/bills/[id]` - Get single bill
3. `POST /api/bills` - Create bill
4. `PUT /api/bills/[id]` - Update bill
5. `DELETE /api/bills/[id]` - Delete bill
6. `GET /api/bills/instances` - List bill instances
7. `GET /api/bills/instances/[id]` - Get single instance
8. `PUT /api/bills/instances/[id]` - Update instance
9. `POST /api/bills/detect` - Auto-detect bills
10. `POST /api/bills/match` - Match transaction to bill

**Test Cases for Each Endpoint:**

#### Test Case 2.1: List Bills (GET /api/bills)
- [ ] **Test 2.1.1:** Request with valid household ID returns only that household's bills
- [ ] **Test 2.1.2:** Request without household ID returns 400 error
- [ ] **Test 2.1.3:** Request with invalid household ID returns 403 error
- [ ] **Test 2.1.4:** Request with household ID user doesn't belong to returns 403 error
- [ ] **Test 2.1.5:** Switching households returns different bills

**Test Script:**
```bash
# Test with household A
curl -X GET "http://localhost:3000/api/bills" \
  -H "x-household-id: household-a-id" \
  -H "Cookie: better-auth.session_data=..."

# Test without household ID (should fail)
curl -X GET "http://localhost:3000/api/bills" \
  -H "Cookie: better-auth.session_data=..."

# Test with household B (should return different bills)
curl -X GET "http://localhost:3000/api/bills" \
  -H "x-household-id: household-b-id" \
  -H "Cookie: better-auth.session_data=..."
```

#### Test Case 2.2: Get Single Bill (GET /api/bills/[id])
- [ ] **Test 2.2.1:** Request bill from same household succeeds
- [ ] **Test 2.2.2:** Request bill from different household returns 403 error
- [ ] **Test 2.2.3:** Request non-existent bill returns 404 error
- [ ] **Test 2.2.4:** Request without household ID returns 400 error

#### Test Case 2.3: Create Bill (POST /api/bills)
- [ ] **Test 2.3.1:** Create bill with valid household ID succeeds
- [ ] **Test 2.3.2:** Create bill without household ID returns 400 error
- [ ] **Test 2.3.3:** Create bill with account from different household returns 400 error
- [ ] **Test 2.3.4:** Created bill has correct household_id in database
- [ ] **Test 2.3.5:** Created bill instances have correct household_id

#### Test Case 2.4: Update Bill (PUT /api/bills/[id])
- [ ] **Test 2.4.1:** Update bill from same household succeeds
- [ ] **Test 2.4.2:** Update bill from different household returns 403 error
- [ ] **Test 2.4.3:** Update with account from different household returns 400 error
- [ ] **Test 2.4.4:** Updated bill retains correct household_id

#### Test Case 2.5: Delete Bill (DELETE /api/bills/[id])
- [ ] **Test 2.5.1:** Delete bill from same household succeeds
- [ ] **Test 2.5.2:** Delete bill from different household returns 403 error
- [ ] **Test 2.5.3:** Deleted bill's instances also deleted (cascade)

#### Test Case 2.6: List Bill Instances (GET /api/bills/instances)
- [ ] **Test 2.6.1:** Returns only instances from bills in specified household
- [ ] **Test 2.6.2:** Filtering by status works correctly
- [ ] **Test 2.6.3:** Sorting works correctly
- [ ] **Test 2.6.4:** Pagination works correctly

#### Test Case 2.7: Update Bill Instance (PUT /api/bills/instances/[id])
- [ ] **Test 2.7.1:** Update instance from same household succeeds
- [ ] **Test 2.7.2:** Update instance from different household returns 403 error
- [ ] **Test 2.7.3:** Link transaction from different household returns 400 error

#### Test Case 2.8: Bill Detection (POST /api/bills/detect)
- [ ] **Test 2.8.1:** Only detects bills from same household
- [ ] **Test 2.8.2:** Returns household-filtered results

#### Test Case 2.9: Bill Matching (POST /api/bills/match)
- [ ] **Test 2.9.1:** Only matches bills from same household
- [ ] **Test 2.9.2:** Does not match bills from different household

**Success Criteria:**
- [ ] All endpoints require household ID
- [ ] All endpoints filter by household
- [ ] Cross-household access blocked (403)
- [ ] Missing household ID returns 400
- [ ] Related entity validation works (accounts, transactions)

---

### Task 5.3: Budgets API Endpoint Testing

**Objective:** Verify all budgets API endpoints properly filter by household.

**Endpoints to Test:**
1. `GET /api/budgets` - List budget categories
2. `POST /api/budgets` - Update budgets
3. `GET /api/budgets/summary` - Budget summary
4. `GET /api/budgets/overview` - Budget overview
5. `GET /api/budgets/analyze` - Budget analytics
6. `GET /api/budgets/check` - Check budget status
7. `GET /api/budgets/export` - Export budgets
8. `POST /api/budgets/copy` - Copy budgets
9. `POST /api/budgets/apply-surplus` - Apply surplus
10. `GET /api/budgets/surplus-suggestion` - Surplus suggestion
11. `GET /api/budgets/bills/variable` - Variable bills

**Test Cases:**

#### Test Case 3.1: List Budget Categories (GET /api/budgets)
- [ ] **Test 3.1.1:** Returns only categories from specified household
- [ ] **Test 3.1.2:** Categories from other households not visible
- [ ] **Test 3.1.3:** Switching households shows different categories

#### Test Case 3.2: Update Budgets (POST /api/budgets)
- [ ] **Test 3.2.1:** Updates only affect specified household
- [ ] **Test 3.2.2:** Cannot update categories from different household
- [ ] **Test 3.2.3:** Budget calculations use household-filtered transactions

#### Test Case 3.3: Budget Summary (GET /api/budgets/summary)
- [ ] **Test 3.3.1:** Summary uses only household's transactions
- [ ] **Test 3.3.2:** Summary uses only household's budget categories
- [ ] **Test 3.3.3:** Switching households shows different summaries

#### Test Case 3.4: Budget Overview (GET /api/budgets/overview)
- [ ] **Test 3.4.1:** Overview shows only household's data
- [ ] **Test 3.4.2:** Category statuses calculated from household transactions
- [ ] **Test 3.4.3:** Month filtering works correctly

#### Test Case 3.5: Budget Analytics (GET /api/budgets/analyze)
- [ ] **Test 3.5.1:** Analytics use only household's transactions
- [ ] **Test 3.5.2:** Trends calculated from household data only
- [ ] **Test 3.5.3:** Recommendations based on household data

#### Test Case 3.6: Budget Check (GET /api/budgets/check)
- [ ] **Test 3.6.1:** Checks only household's category
- [ ] **Test 3.6.2:** Uses household-filtered transactions

#### Test Case 3.7: Budget Export (GET /api/budgets/export)
- [ ] **Test 3.7.1:** Exports only household's budgets
- [ ] **Test 3.7.2:** CSV contains only household data

#### Test Case 3.8: Variable Bills (GET /api/budgets/bills/variable)
- [ ] **Test 3.8.1:** Returns only variable bills from household
- [ ] **Test 3.8.2:** Tracking data uses household-filtered instances

**Success Criteria:**
- [ ] All endpoints filter by household
- [ ] Calculations use household-filtered transactions
- [ ] No data leakage between households
- [ ] Missing household ID returns 400

---

### Task 5.4: Frontend Component Testing

**Objective:** Verify frontend components correctly display household-isolated data and handle household switching.

**Components to Test:**
1. Bills Page (`/dashboard/bills`)
2. Budgets Page (`/dashboard/budgets`)
3. Bills Widget (dashboard)
4. Enhanced Bills Widget (dashboard)
5. Budget Summary Widget (dashboard)
6. Budget Surplus Card (dashboard)
7. Budget Manager Modal
8. Budget Analytics Section
9. Variable Bill Tracker
10. Apply Surplus Modal
11. Budget Export Modal
12. Budget Warning Component

**Test Scenarios:**

#### Scenario 4.1: Bills Page Testing
- [ ] **Test 4.1.1:** Load page with Household A - shows only Household A bills
- [ ] **Test 4.1.2:** Switch to Household B - page reloads, shows only Household B bills
- [ ] **Test 4.1.3:** Create bill in Household A - appears immediately
- [ ] **Test 4.1.4:** Switch to Household B - new bill not visible
- [ ] **Test 4.1.5:** Switch back to Household A - new bill still visible
- [ ] **Test 4.1.6:** Edit bill in Household A - updates correctly
- [ ] **Test 4.1.7:** Try to edit bill ID from Household B (should fail or not be visible)

**Manual Test Steps:**
1. Sign in as test user
2. Select Household A
3. Navigate to `/dashboard/bills`
4. Verify only Household A bills visible
5. Note bill IDs/names
6. Switch to Household B in sidebar
7. Verify page reloads
8. Verify different bills visible
9. Create new bill in Household B
10. Switch back to Household A
11. Verify new bill not visible

#### Scenario 4.2: Budgets Page Testing
- [ ] **Test 4.2.1:** Load page with Household A - shows only Household A budgets
- [ ] **Test 4.2.2:** Budget calculations use Household A transactions only
- [ ] **Test 4.2.3:** Switch to Household B - shows different budgets
- [ ] **Test 4.2.4:** Update budget in Household A - affects only Household A
- [ ] **Test 4.2.5:** Switch to Household B - budget unchanged
- [ ] **Test 4.2.6:** Copy budgets from month works correctly
- [ ] **Test 4.2.7:** Export budgets contains only household data

#### Scenario 4.3: Dashboard Widgets Testing
- [ ] **Test 4.3.1:** Bills Widget shows only current household's bills
- [ ] **Test 4.3.2:** Budget Summary Widget shows only current household's budgets
- [ ] **Test 4.3.3:** Budget Surplus Card shows only current household's surplus
- [ ] **Test 4.3.4:** Switching households updates all widgets
- [ ] **Test 4.3.5:** Widgets show loading state when no household selected

#### Scenario 4.4: Modal Components Testing
- [ ] **Test 4.4.1:** Budget Manager Modal loads only household's categories
- [ ] **Test 4.4.2:** Cannot select categories from other households
- [ ] **Test 4.4.3:** Apply Surplus Modal uses household's data
- [ ] **Test 4.4.4:** Budget Export Modal exports only household data

#### Scenario 4.5: Error Handling Testing
- [ ] **Test 4.5.1:** Components handle "No household selected" gracefully
- [ ] **Test 4.5.2:** Components show appropriate loading states
- [ ] **Test 4.5.3:** Network errors handled gracefully
- [ ] **Test 4.5.4:** 403 errors show user-friendly messages

**Success Criteria:**
- [ ] All components show household-isolated data
- [ ] Switching households updates all components
- [ ] No data leakage between households
- [ ] Error handling works correctly
- [ ] Loading states appropriate

---

### Task 5.5: Integration Testing

**Objective:** Test interactions between bills, budgets, accounts, and transactions across households.

**Test Scenarios:**

#### Scenario 5.1: Bill-Account Integration
- [ ] **Test 5.1.1:** Create bill with account from same household - succeeds
- [ ] **Test 5.1.2:** Create bill with account from different household - fails with 400
- [ ] **Test 5.1.3:** Update bill to use account from different household - fails with 400
- [ ] **Test 5.1.4:** Bill instances use correct account from same household

#### Scenario 5.2: Bill-Transaction Integration
- [ ] **Test 5.2.1:** Match transaction to bill in same household - succeeds
- [ ] **Test 5.2.2:** Match transaction to bill in different household - fails
- [ ] **Test 5.2.3:** Auto-detection only matches bills from same household
- [ ] **Test 5.2.4:** Bill instance links transaction from same household

#### Scenario 5.3: Budget-Transaction Integration
- [ ] **Test 5.3.1:** Budget calculations use only household's transactions
- [ ] **Test 5.3.2:** Budget warnings based on household transactions only
- [ ] **Test 5.3.3:** Budget analytics use household transactions only
- [ ] **Test 5.3.4:** Budget surplus calculated from household data only

#### Scenario 5.4: Budget-Category Integration
- [ ] **Test 5.4.1:** Budget categories belong to correct household
- [ ] **Test 5.4.2:** Cannot create budget for category from different household
- [ ] **Test 5.4.3:** Budget operations affect only household's categories

#### Scenario 5.5: Variable Bills Integration
- [ ] **Test 5.5.1:** Variable bill tracker shows only household's bills
- [ ] **Test 5.5.2:** Variable bill tracking uses household-filtered instances
- [ ] **Test 5.5.3:** Variable bill updates affect only household's bills

**Success Criteria:**
- [ ] All integrations respect household boundaries
- [ ] Cross-household operations fail appropriately
- [ ] Data consistency maintained within households

---

### Task 5.6: Edge Case Testing

**Objective:** Test edge cases and boundary conditions.

**Test Cases:**

#### Edge Case 6.1: Multiple Households
- [ ] **Test 6.1.1:** User belongs to 3+ households
- [ ] **Test 6.1.2:** Switching between all households works correctly
- [ ] **Test 6.1.3:** Each household has isolated data
- [ ] **Test 6.1.4:** No performance degradation with many households

#### Edge Case 6.2: Single Household
- [ ] **Test 6.2.1:** User belongs to only one household
- [ ] **Test 6.2.2:** All features work correctly
- [ ] **Test 6.2.3:** No errors when only one household exists

#### Edge Case 6.3: Empty Households
- [ ] **Test 6.3.1:** Household with no bills - page loads correctly
- [ ] **Test 6.3.2:** Household with no budgets - page loads correctly
- [ ] **Test 6.3.3:** Empty state messages display correctly
- [ ] **Test 6.3.4:** Can create first bill/budget in empty household

#### Edge Case 6.4: Bill Matching
- [ ] **Test 6.4.1:** Transaction matches bill in same household only
- [ ] **Test 6.4.2:** Similar bills in different households don't match
- [ ] **Test 6.4.3:** Bill detection only finds bills in same household

#### Edge Case 6.5: Data Consistency
- [ ] **Test 6.5.1:** Bill instances always belong to same household as bill
- [ ] **Test 6.5.2:** Budget categories always belong to correct household
- [ ] **Test 6.5.3:** No orphaned records (instances without bills, etc.)

#### Edge Case 6.6: Performance
- [ ] **Test 6.6.1:** Large number of bills (100+) loads quickly
- [ ] **Test 6.6.2:** Large number of bill instances (1000+) loads quickly
- [ ] **Test 6.6.3:** Budget calculations perform well with many transactions
- [ ] **Test 6.6.4:** No N+1 query problems

**Success Criteria:**
- [ ] All edge cases handled gracefully
- [ ] No errors or crashes
- [ ] Performance acceptable
- [ ] Data consistency maintained

---

## Testing Tools & Methods

### Manual Testing
- Browser DevTools for network monitoring
- Database browser for direct data inspection
- Multiple browser sessions for different households

### Automated Testing (Future)
- Unit tests for API endpoints
- Integration tests for household isolation
- E2E tests for user flows

### Database Queries
```sql
-- Check household isolation
SELECT household_id, COUNT(*) 
FROM bills 
GROUP BY household_id;

-- Verify no cross-household data
SELECT b1.id, b1.household_id, b2.id, b2.household_id
FROM bills b1
JOIN bills b2 ON b1.id = b2.id
WHERE b1.household_id != b2.household_id;
-- Should return 0 rows
```

---

## Success Criteria Summary

### Phase 2 Complete When:
- [ ] All database migrations applied successfully
- [ ] All bills have household_id (0 NULL values)
- [ ] All bill instances have household_id (0 NULL values)
- [ ] All API endpoints filter by household
- [ ] All API endpoints prevent cross-household access
- [ ] All frontend components use useHouseholdFetch
- [ ] All frontend components show household-isolated data
- [ ] Switching households updates all components
- [ ] No data leakage between households
- [ ] Error handling works correctly
- [ ] Performance acceptable
- [ ] All edge cases handled

---

## Testing Checklist

### Database
- [ ] Migration applied
- [ ] No NULL household_id values
- [ ] Indexes created
- [ ] Query performance acceptable

### API Endpoints
- [ ] Bills endpoints (10 endpoints tested)
- [ ] Budgets endpoints (11 endpoints tested)
- [ ] All require household ID
- [ ] All filter by household
- [ ] Cross-household access blocked

### Frontend Components
- [ ] Bills page (1 component)
- [ ] Budgets page (1 component)
- [ ] Dashboard widgets (4 components)
- [ ] Modals (3 components)
- [ ] Other components (4 components)
- [ ] All use useHouseholdFetch
- [ ] All handle household switching

### Integration
- [ ] Bill-Account integration
- [ ] Bill-Transaction integration
- [ ] Budget-Transaction integration
- [ ] Budget-Category integration
- [ ] Variable bills integration

### Edge Cases
- [ ] Multiple households
- [ ] Single household
- [ ] Empty households
- [ ] Bill matching
- [ ] Data consistency
- [ ] Performance

---

## Estimated Timeline

- **Task 5.1:** Database Migration Verification - 30 minutes
- **Task 5.2:** Bills API Testing - 1.5 hours
- **Task 5.3:** Budgets API Testing - 1.5 hours
- **Task 5.4:** Frontend Component Testing - 1 hour
- **Task 5.5:** Integration Testing - 1 hour
- **Task 5.6:** Edge Case Testing - 1 hour

**Total:** 6-7 hours

---

## Notes

- Test with real user accounts and multiple households
- Document any bugs or issues found during testing
- Fix critical issues before proceeding to Step 6
- Performance issues should be addressed if significant
- All tests should be repeatable

---

**Document Version:** 1.0  
**Created:** 2025-01-27  
**Status:** Ready for Implementation  
**Next Step:** Begin Task 5.1 - Database Migration Verification

