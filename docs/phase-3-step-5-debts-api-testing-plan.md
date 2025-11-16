# Phase 3 Step 5.2: Debts API Endpoint Testing - Detailed Implementation Plan

**Status:** Ready to Start  
**Priority:** High  
**Estimated Time:** 2-3 hours  
**Created:** 2025-01-27  
**Dependencies:** Phase 3 Steps 1-4 complete ✅, Task 5.1 complete ✅

---

## Overview

This plan details the comprehensive testing required for all 13 Debts API endpoints to ensure household isolation is working correctly. All endpoints must be tested for:
1. Household filtering (returns only data for specified household)
2. Cross-household access prevention (403/404 errors)
3. Missing household ID handling (400 errors)
4. Related entity validation (accounts, categories, transactions)
5. Data integrity (payments, milestones inherit household correctly)

**Testing Approach:**
- Manual testing via browser DevTools and API calls
- Test with multiple households (Household A and Household B)
- Verify data isolation at each step
- Document all test results in `docs/phase-3-step-5-test-results.md`

---

## Test Environment Setup

### Prerequisites
1. ✅ Two households created (Household A and Household B)
2. ✅ User is member of both households
3. ✅ At least one account in each household
4. ✅ At least one category in each household
5. ✅ Test data ready (or will create during testing)

### Test Data Structure
- **Household A:**
  - Account: "Test Account A"
  - Category: "Test Category A"
  - Debt: "Test Debt A" (will create)
  - Payment: (will create)
  
- **Household B:**
  - Account: "Test Account B"
  - Category: "Test Category B"
  - Debt: "Test Debt B" (will create)
  - Payment: (will create)

---

## Testing Checklist

### 5.2.7: GET `/api/debts`

**Endpoint:** `GET /api/debts?householdId={householdId}&status={status}`

**Test Cases:**

1. **Valid Request - Household A**
   - **Setup:** Create debt in Household A
   - **Action:** `GET /api/debts?householdId={householdAId}`
   - **Expected:** 200 OK, returns only debts for Household A
   - **Verify:** Response contains only Household A debts, `householdId` matches

2. **Valid Request - Household B**
   - **Setup:** Create debt in Household B
   - **Action:** `GET /api/debts?householdId={householdBId}`
   - **Expected:** 200 OK, returns only debts for Household B
   - **Verify:** Response contains only Household B debts, Household A debts NOT included

3. **Status Filter - Active Debts**
   - **Action:** `GET /api/debts?householdId={householdAId}&status=active`
   - **Expected:** 200 OK, returns only active debts for Household A
   - **Verify:** All returned debts have `status: 'active'`

4. **Missing Household ID**
   - **Action:** `GET /api/debts` (no householdId header or query param)
   - **Expected:** 400 Bad Request
   - **Verify:** Error message indicates missing household ID

5. **Invalid Household ID**
   - **Action:** `GET /api/debts?householdId=invalid-id`
   - **Expected:** 403 Forbidden
   - **Verify:** Error message indicates user is not member of household

6. **Household User Not Member Of**
   - **Action:** `GET /api/debts?householdId={otherUserHouseholdId}`
   - **Expected:** 403 Forbidden
   - **Verify:** Access denied

**Success Criteria:**
- ✅ Returns only debts for specified household
- ✅ Filters by status correctly
- ✅ Returns 400 when household ID missing
- ✅ Returns 403 when household ID invalid or user not member
- ✅ Response includes correct `householdId` for each debt

---

### 5.2.8: POST `/api/debts`

**Endpoint:** `POST /api/debts`

**Test Cases:**

1. **Create Debt - Valid Household A**
   - **Setup:** Have account and category in Household A
   - **Action:** `POST /api/debts` with:
     ```json
     {
       "householdId": "{householdAId}",
       "name": "Test Debt A",
       "creditorName": "Test Creditor A",
       "originalAmount": 10000,
       "remainingBalance": 8000,
       "minimumPayment": 200,
       "accountId": "{accountAId}",
       "startDate": "2025-01-01",
       "type": "credit-card"
     }
     ```
   - **Expected:** 201 Created
   - **Verify:** 
     - Debt created with correct `householdId`
     - Category created automatically with same `householdId`
     - Account belongs to same household
     - Response includes created debt with `householdId`

2. **Create Debt - Valid Household B**
   - **Action:** `POST /api/debts` with Household B data
   - **Expected:** 201 Created
   - **Verify:** Debt created in Household B, separate from Household A

3. **Create Debt - Account from Different Household**
   - **Action:** `POST /api/debts` with Household A `householdId` but Household B `accountId`
   - **Expected:** 400 Bad Request
   - **Verify:** Error message indicates account doesn't belong to household

4. **Create Debt - Missing Household ID**
   - **Action:** `POST /api/debts` without `householdId`
   - **Expected:** 400 Bad Request
   - **Verify:** Error message indicates missing household ID

5. **Create Debt - Invalid Household ID**
   - **Action:** `POST /api/debts` with invalid `householdId`
   - **Expected:** 403 Forbidden
   - **Verify:** Access denied

6. **Create Debt - Missing Required Fields**
   - **Action:** `POST /api/debts` without `name` or `creditorName`
   - **Expected:** 400 Bad Request
   - **Verify:** Error message lists missing fields

**Success Criteria:**
- ✅ Creates debt with correct `householdId`
- ✅ Validates account belongs to household
- ✅ Creates category with same `householdId`
- ✅ Returns 400 when household ID missing
- ✅ Returns 403 when household ID invalid
- ✅ Returns 400 when account from different household

---

### 5.2.9: GET `/api/debts/[id]`

**Endpoint:** `GET /api/debts/[id]?householdId={householdId}`

**Test Cases:**

1. **Get Debt - Valid Household A**
   - **Setup:** Create debt in Household A
   - **Action:** `GET /api/debts/{debtAId}?householdId={householdAId}`
   - **Expected:** 200 OK
   - **Verify:**
     - Returns debt with correct `householdId`
     - Includes payments filtered by household
     - Includes milestones filtered by household
     - All related data has matching `householdId`

2. **Get Debt - Different Household**
   - **Setup:** Create debt in Household A
   - **Action:** `GET /api/debts/{debtAId}?householdId={householdBId}`
   - **Expected:** 404 Not Found (not 403 to prevent enumeration)
   - **Verify:** Error message indicates debt not found

3. **Get Debt - Missing Household ID**
   - **Action:** `GET /api/debts/{debtAId}` (no householdId)
   - **Expected:** 400 Bad Request
   - **Verify:** Error message indicates missing household ID

4. **Get Debt - Invalid Debt ID**
   - **Action:** `GET /api/debts/invalid-id?householdId={householdAId}`
   - **Expected:** 404 Not Found
   - **Verify:** Error message indicates debt not found

**Success Criteria:**
- ✅ Returns debt with correct `householdId`
- ✅ Includes payments filtered by household
- ✅ Includes milestones filtered by household
- ✅ Returns 404 when debt belongs to different household
- ✅ Returns 400 when household ID missing

---

### 5.2.10: PUT `/api/debts/[id]`

**Endpoint:** `PUT /api/debts/[id]`

**Test Cases:**

1. **Update Debt - Valid Household A**
   - **Setup:** Create debt in Household A
   - **Action:** `PUT /api/debts/{debtAId}` with:
     ```json
     {
       "householdId": "{householdAId}",
       "name": "Updated Debt A",
       "remainingBalance": 7500
     }
     ```
   - **Expected:** 200 OK
   - **Verify:**
     - Debt updated successfully
     - `householdId` remains unchanged
     - Updated fields reflected in response

2. **Update Debt - Different Household**
   - **Setup:** Create debt in Household A
   - **Action:** `PUT /api/debts/{debtAId}` with Household B `householdId`
   - **Expected:** 404 Not Found
   - **Verify:** Debt not found (cross-household access blocked)

3. **Update Debt - Account from Different Household**
   - **Setup:** Create debt in Household A
   - **Action:** `PUT /api/debts/{debtAId}` with Household B `accountId`
   - **Expected:** 400 Bad Request
   - **Verify:** Error indicates account doesn't belong to household

4. **Update Debt - Missing Household ID**
   - **Action:** `PUT /api/debts/{debtAId}` without `householdId`
   - **Expected:** 400 Bad Request
   - **Verify:** Error message indicates missing household ID

**Success Criteria:**
- ✅ Updates debt successfully
- ✅ Maintains `householdId` integrity
- ✅ Validates account belongs to household
- ✅ Returns 404 when debt belongs to different household
- ✅ Returns 400 when household ID missing

---

### 5.2.11: DELETE `/api/debts/[id]`

**Endpoint:** `DELETE /api/debts/[id]?householdId={householdId}`

**Test Cases:**

1. **Delete Debt - Valid Household A**
   - **Setup:** Create debt in Household A with payments and milestones
   - **Action:** `DELETE /api/debts/{debtAId}?householdId={householdAId}`
   - **Expected:** 200 OK
   - **Verify:**
     - Debt deleted successfully
     - Payments cascade deleted (or orphaned with proper handling)
     - Milestones cascade deleted (or orphaned with proper handling)
     - Debt no longer appears in GET list

2. **Delete Debt - Different Household**
   - **Setup:** Create debt in Household A
   - **Action:** `DELETE /api/debts/{debtAId}?householdId={householdBId}`
   - **Expected:** 404 Not Found
   - **Verify:** Debt not found (cross-household access blocked)

3. **Delete Debt - Missing Household ID**
   - **Action:** `DELETE /api/debts/{debtAId}` (no householdId)
   - **Expected:** 400 Bad Request
   - **Verify:** Error message indicates missing household ID

**Success Criteria:**
- ✅ Deletes debt successfully
- ✅ Cascades delete to payments and milestones
- ✅ Returns 404 when debt belongs to different household
- ✅ Returns 400 when household ID missing

---

### 5.2.12: GET `/api/debts/[id]/payments`

**Endpoint:** `GET /api/debts/[id]/payments?householdId={householdId}`

**Test Cases:**

1. **Get Payments - Valid Household A**
   - **Setup:** Create debt in Household A with payments
   - **Action:** `GET /api/debts/{debtAId}/payments?householdId={householdAId}`
   - **Expected:** 200 OK
   - **Verify:**
     - Returns payments filtered by household
     - All payments have matching `householdId`
     - Payments ordered by date

2. **Get Payments - Different Household**
   - **Setup:** Create debt in Household A
   - **Action:** `GET /api/debts/{debtAId}/payments?householdId={householdBId}`
   - **Expected:** 404 Not Found
   - **Verify:** Debt not found (cross-household access blocked)

3. **Get Payments - Missing Household ID**
   - **Action:** `GET /api/debts/{debtAId}/payments` (no householdId)
   - **Expected:** 400 Bad Request
   - **Verify:** Error message indicates missing household ID

**Success Criteria:**
- ✅ Returns payments filtered by household
- ✅ Returns 404 when debt belongs to different household
- ✅ Returns 400 when household ID missing

---

### 5.2.13: POST `/api/debts/[id]/payments`

**Endpoint:** `POST /api/debts/[id]/payments`

**Test Cases:**

1. **Create Payment - Valid Household A**
   - **Setup:** Create debt in Household A, create transaction in Household A
   - **Action:** `POST /api/debts/{debtAId}/payments` with:
     ```json
     {
       "householdId": "{householdAId}",
       "transactionId": "{transactionAId}",
       "paymentDate": "2025-01-15",
       "amount": 200
     }
     ```
   - **Expected:** 201 Created
   - **Verify:**
     - Payment created with correct `householdId`
     - Payment inherits `householdId` from debt
     - Transaction belongs to same household

2. **Create Payment - Transaction from Different Household**
   - **Setup:** Create debt in Household A, transaction in Household B
   - **Action:** `POST /api/debts/{debtAId}/payments` with Household B transaction
   - **Expected:** 400 Bad Request
   - **Verify:** Error indicates transaction doesn't belong to household

3. **Create Payment - Debt from Different Household**
   - **Setup:** Create debt in Household A
   - **Action:** `POST /api/debts/{debtAId}/payments` with Household B `householdId`
   - **Expected:** 404 Not Found
   - **Verify:** Debt not found (cross-household access blocked)

4. **Create Payment - Missing Household ID**
   - **Action:** `POST /api/debts/{debtAId}/payments` without `householdId`
   - **Expected:** 400 Bad Request
   - **Verify:** Error message indicates missing household ID

**Success Criteria:**
- ✅ Creates payment with correct `householdId`
- ✅ Validates transaction belongs to household
- ✅ Returns 404 when debt belongs to different household
- ✅ Returns 400 when transaction from different household
- ✅ Returns 400 when household ID missing

---

### 5.2.14: GET `/api/debts/stats`

**Endpoint:** `GET /api/debts/stats?householdId={householdId}`

**Test Cases:**

1. **Get Stats - Household A**
   - **Setup:** Create debts and payments in Household A
   - **Action:** `GET /api/debts/stats?householdId={householdAId}`
   - **Expected:** 200 OK
   - **Verify:**
     - Stats include only Household A debts
     - Stats include only Household A payments
     - Stats include only Household A transactions
     - Totals match Household A data only

2. **Get Stats - Household B**
   - **Setup:** Create debts and payments in Household B
   - **Action:** `GET /api/debts/stats?householdId={householdBId}`
   - **Expected:** 200 OK
   - **Verify:** Stats different from Household A, only include Household B data

3. **Get Stats - Missing Household ID**
   - **Action:** `GET /api/debts/stats` (no householdId)
   - **Expected:** 400 Bad Request
   - **Verify:** Error message indicates missing household ID

4. **Get Stats - Empty Household**
   - **Action:** `GET /api/debts/stats?householdId={emptyHouseholdId}`
   - **Expected:** 200 OK
   - **Verify:** Returns zero/empty stats gracefully

**Success Criteria:**
- ✅ Returns stats filtered by household
- ✅ Includes debts, payments, transactions from same household only
- ✅ Returns 400 when household ID missing
- ✅ Handles empty households gracefully

---

### 5.2.15: GET `/api/debts/settings`

**Endpoint:** `GET /api/debts/settings?householdId={householdId}`

**Test Cases:**

1. **Get Settings - Household A (Existing)**
   - **Setup:** Create settings for Household A
   - **Action:** `GET /api/debts/settings?householdId={householdAId}`
   - **Expected:** 200 OK
   - **Verify:** Returns Household A settings

2. **Get Settings - Household A (Default)**
   - **Setup:** No settings exist for Household A
   - **Action:** `GET /api/debts/settings?householdId={householdAId}`
   - **Expected:** 200 OK
   - **Verify:** Returns default settings (or creates default)

3. **Get Settings - Household B**
   - **Action:** `GET /api/debts/settings?householdId={householdBId}`
   - **Expected:** 200 OK
   - **Verify:** Returns different settings than Household A (per-household)

4. **Get Settings - Missing Household ID**
   - **Action:** `GET /api/debts/settings` (no householdId)
   - **Expected:** 400 Bad Request
   - **Verify:** Error message indicates missing household ID

**Success Criteria:**
- ✅ Returns settings per household
- ✅ Creates default settings if missing
- ✅ Returns 400 when household ID missing
- ✅ Settings are isolated per household

---

### 5.2.16: PUT `/api/debts/settings`

**Endpoint:** `PUT /api/debts/settings`

**Test Cases:**

1. **Update Settings - Household A**
   - **Action:** `PUT /api/debts/settings` with:
     ```json
     {
       "householdId": "{householdAId}",
       "payoffStrategy": "avalanche",
       "minimumPaymentBuffer": 0.1
     }
     ```
   - **Expected:** 200 OK
   - **Verify:**
     - Settings updated for Household A
     - Settings persist correctly
     - Response includes updated settings

2. **Update Settings - Household B**
   - **Action:** `PUT /api/debts/settings` with Household B data
   - **Expected:** 200 OK
   - **Verify:** Settings different from Household A (per-household)

3. **Update Settings - Different Household (Unauthorized)**
   - **Action:** `PUT /api/debts/settings` with household user not member of
   - **Expected:** 403 Forbidden
   - **Verify:** Access denied

4. **Update Settings - Missing Household ID**
   - **Action:** `PUT /api/debts/settings` without `householdId`
   - **Expected:** 400 Bad Request
   - **Verify:** Error message indicates missing household ID

**Success Criteria:**
- ✅ Updates settings per household
- ✅ Settings isolated per household
- ✅ Returns 403 when user not member of household
- ✅ Returns 400 when household ID missing

---

### 5.2.17-19: Other Debt Endpoints

**Endpoints to Test:**
- `GET /api/debts/payoff-strategy?householdId={householdId}`
- `POST /api/debts/scenarios?householdId={householdId}`
- `GET /api/debts/adherence?householdId={householdId}`
- `GET /api/debts/countdown?householdId={householdId}`
- `GET /api/debts/credit-utilization?householdId={householdId}`
- `GET /api/debts/minimum-warning?householdId={householdId}`
- `GET /api/debts/reduction-chart?householdId={householdId}`
- `GET /api/debts/streak?householdId={householdId}`

**Test Pattern for Each:**

1. **Valid Request - Household A**
   - **Action:** `GET /api/debts/{endpoint}?householdId={householdAId}`
   - **Expected:** 200 OK
   - **Verify:** Returns data filtered by Household A only

2. **Valid Request - Household B**
   - **Action:** `GET /api/debts/{endpoint}?householdId={householdBId}`
   - **Expected:** 200 OK
   - **Verify:** Returns different data than Household A

3. **Missing Household ID**
   - **Action:** `GET /api/debts/{endpoint}` (no householdId)
   - **Expected:** 400 Bad Request
   - **Verify:** Error message indicates missing household ID

4. **Invalid Household ID**
   - **Action:** `GET /api/debts/{endpoint}?householdId=invalid-id`
   - **Expected:** 403 Forbidden
   - **Verify:** Access denied

**Success Criteria:**
- ✅ All endpoints filter by household
- ✅ All endpoints return 400 when household ID missing
- ✅ All endpoints return 403 when household ID invalid
- ✅ Data isolation verified for all endpoints

---

## Testing Tools & Methods

### Manual Testing via Browser
1. Open browser DevTools (Network tab)
2. Navigate to `/dashboard/debts` page
3. Monitor API requests
4. Verify request headers include `X-Household-Id`
5. Verify responses filtered correctly

### Direct API Testing
1. Use browser console or Postman
2. Make direct API calls with proper authentication
3. Test edge cases (missing IDs, invalid IDs, etc.)
4. Verify response codes and error messages

### Database Verification
1. Query database directly to verify `householdId` values
2. Check data relationships (payments inherit from debts)
3. Verify no cross-household data leakage

---

## Test Results Documentation

After completing all tests, update `docs/phase-3-step-5-test-results.md` with:

1. **Test Execution Summary**
   - Date and time of testing
   - Tester name
   - Overall status (Complete/In Progress)

2. **Per-Endpoint Results**
   - Test case status (✅ Pass / ❌ Fail / ⏳ Not Tested)
   - Response codes received
   - Data verification results
   - Any issues found

3. **Issues Found**
   - List any bugs or problems discovered
   - Severity (Critical/High/Medium/Low)
   - Steps to reproduce
   - Recommended fixes

4. **Performance Notes**
   - Response times
   - Any performance concerns
   - Database query efficiency

---

## Success Criteria

### Task 5.2 Complete When:
- [ ] All 13 Debts API endpoints tested
- [ ] All test cases documented with results
- [ ] Household filtering verified for all endpoints
- [ ] Cross-household access blocked (403/404)
- [ ] Missing household ID returns 400
- [ ] Related entity validation works (accounts, categories, transactions)
- [ ] Data inheritance verified (payments inherit from debts)
- [ ] Test results documented in `docs/phase-3-step-5-test-results.md`
- [ ] Any issues found documented with severity

---

## Estimated Timeline

- **5.2.7-5.2.11 (Core CRUD):** 45 minutes
- **5.2.12-5.2.13 (Payments):** 30 minutes
- **5.2.14-5.2.16 (Stats & Settings):** 30 minutes
- **5.2.17-19 (Other Endpoints):** 45 minutes
- **Documentation:** 30 minutes

**Total:** 3 hours

---

## Notes

- Test systematically, one endpoint at a time
- Document results immediately after each test
- Fix critical issues before proceeding
- Non-critical issues can be documented for later
- All tests should be repeatable
- Use real user scenarios when possible
- Verify UI updates correctly after API calls

---

**Document Version:** 1.0  
**Created:** 2025-01-27  
**Status:** Ready for Implementation

