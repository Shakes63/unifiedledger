# Actions Executor Tests - Completion Plan

**Date Created:** 2025-11-10
**Status:** Implementation Ready
**Current Progress:** 70/138 tests (51% complete)
**Remaining:** 68 tests across 7 task categories
**Priority:** HIGH (95%+ coverage required for production readiness)

## Overview

This plan details the step-by-step implementation of the remaining 68 tests for the Actions Executor component. All infrastructure and immediate actions (category, merchant, description, tax deduction) are complete. This plan focuses on **post-creation actions** (sales tax, account changes, splits, transfers), **multi-action execution**, **validation**, and **utility functions**.

## Current Status

### Completed Tasks (7/14) ✅
1. ✅ **Test infrastructure** (6 tests) - Database mocking, test factories, helpers
2. ✅ **Pattern variables - basic** (8 tests) - Single variable substitution
3. ✅ **Pattern variables - advanced** (7 tests) - Multiple variables, edge cases
4. ✅ **set_category action** (10 tests) - Category assignment with validation
5. ✅ **set_merchant action** (10 tests) - Merchant assignment with validation
6. ✅ **Description actions** (21 tests) - set/prepend/append with pattern support
7. ✅ **set_tax_deduction action** (8 tests) - Tax deduction marking based on category

**Total Completed:** 70 tests

### Remaining Tasks (7/14) ⏳
8. ⏳ **set_sales_tax action** (10 tests) - Lines 1185-1187
9. ⏳ **set_account action** (8 tests) - Lines 1189-1191
10. ⏳ **create_split action** (12 tests) - Lines 1193-1195
11. ⏳ **convert_to_transfer action** (10 tests) - Lines 1197-1199
12. ⏳ **Multiple actions execution** (12 tests) - Lines 1201-1203
13. ⏳ **Validation & error handling** (15 tests) - Lines 1205-1210
14. ⏳ **Utility functions** (10 tests) - Lines 1213-1215

**Total Remaining:** 68 tests

## Test File Structure

**File:** `__tests__/lib/rules/actions-executor.test.ts` (1,215 lines)

**Existing Infrastructure:**
- ✅ Database mocking with vi.mock
- ✅ Mock categories (4 categories with tax deduction flags)
- ✅ Mock merchants (3 merchants)
- ✅ Test factories: `createTestTransaction()`, `createTestAction()`, `createTestCategory()`, `createTestMerchant()`
- ✅ Database query helpers: `mockCategoryQuery()`, `mockMerchantQuery()`, `setupDbMock()`

**Current Test Sections:**
```
Lines 1-230:    Setup & Helper Functions ✅
Lines 231-360:  parseDescriptionPattern() - Basic ✅
Lines 361-480:  parseDescriptionPattern() - Advanced ✅
Lines 481-650:  set_category Action Tests ✅
Lines 651-800:  set_merchant Action Tests ✅
Lines 801-1030: Description Actions Tests ✅
Lines 1031-1183: set_tax_deduction Action Tests ✅
Lines 1185-1187: set_sales_tax Action (TODO)
Lines 1189-1191: set_account Action (TODO)
Lines 1193-1195: create_split Action (TODO)
Lines 1197-1199: convert_to_transfer Action (TODO)
Lines 1201-1203: Multiple Actions (TODO)
Lines 1205-1210: Validation & Error Handling (TODO)
Lines 1213-1215: Utility Functions (TODO)
```

---

## Task 8: set_sales_tax Action Tests

**Priority:** P1 (Post-creation action)
**Lines:** ~200 lines
**Tests:** 10 tests
**Estimated Time:** 2 hours

### Background
The `set_sales_tax` action applies sales tax configuration to **income transactions only**. It stores the config in `mutations.applySalesTax` for post-creation processing. The action validates that:
- Transaction type is `income` (skip expense/transfer)
- Config has required `taxCategoryId`
- Config structure includes `enabled` flag

### Implementation Details

**Location:** Replace `it.todo()` at line 1185-1187

**Test Cases:**

1. **Valid sales tax on income transaction**
   ```typescript
   it("should apply sales tax to income transaction", async () => {
     const action = createTestAction("set_sales_tax", {
       config: { taxCategoryId: "tax-cat-1", enabled: true }
     });
     const transaction = createTestTransaction({ type: "income" });

     const result = await executeRuleActions("user-1", [action], transaction);

     expect(result.mutations.applySalesTax).toEqual({
       taxCategoryId: "tax-cat-1",
       enabled: true
     });
     expect(result.appliedActions).toHaveLength(1);
     expect(result.appliedActions[0].type).toBe("set_sales_tax");
   });
   ```

2. **Skip action for expense transaction**
   ```typescript
   it("should skip action for expense transaction", async () => {
     const action = createTestAction("set_sales_tax", {
       config: { taxCategoryId: "tax-cat-1", enabled: true }
     });
     const transaction = createTestTransaction({ type: "expense" });

     const result = await executeRuleActions("user-1", [action], transaction);

     expect(result.mutations.applySalesTax).toBeUndefined();
     expect(result.appliedActions).toHaveLength(0);
   });
   ```

3. **Skip action for transfer_out transaction**
4. **Skip action for transfer_in transaction**
5. **Validation error for missing config**
6. **Validation error for missing taxCategoryId**
7. **Correct applied action structure**
8. **Original value capture (null by default)**
9. **Config structure with both fields**
10. **Enabled flag works as boolean**

**Mock Requirements:**
- Sales tax validation is already mocked (line 49-56)
- No additional database mocks needed

**Validation Notes:**
- `validateSalesTaxConfig()` from `lib/rules/sales-tax-action-handler.ts` is mocked
- Throws error if config or taxCategoryId is missing
- executeRuleActions should catch and handle validation errors gracefully

---

## Task 9: set_account Action Tests

**Priority:** P1 (Post-creation action)
**Lines:** ~160 lines
**Tests:** 8 tests
**Estimated Time:** 1.5 hours

### Background
The `set_account` action changes the transaction's account. It stores the config in `mutations.changeAccount` for post-creation processing. The action validates that:
- Transaction is NOT a transfer (reject `transfer_out` and `transfer_in`)
- Target account ID is provided
- Account balance updates are handled post-creation

### Implementation Details

**Location:** Replace `it.todo()` at line 1189-1191

**Test Cases:**

1. **Valid account change for income transaction**
   ```typescript
   it("should set account change for income transaction", async () => {
     const action = createTestAction("set_account", { value: "account-2" });
     const transaction = createTestTransaction({
       accountId: "account-1",
       type: "income"
     });

     const result = await executeRuleActions("user-1", [action], transaction);

     expect(result.mutations.changeAccount).toEqual({
       targetAccountId: "account-2"
     });
     expect(result.appliedActions).toHaveLength(1);
     expect(result.appliedActions[0].originalValue).toBe("account-1");
   });
   ```

2. **Valid account change for expense transaction**
3. **Reject transfer_out transaction**
   ```typescript
   it("should reject transfer_out transaction", async () => {
     const action = createTestAction("set_account", { value: "account-2" });
     const transaction = createTestTransaction({ type: "transfer_out" });

     const result = await executeRuleActions("user-1", [action], transaction);

     expect(result.mutations.changeAccount).toBeUndefined();
     expect(result.appliedActions).toHaveLength(0);
   });
   ```
4. **Reject transfer_in transaction**
5. **Validation error for missing target account ID**
6. **Correct applied action structure**
7. **Original account ID captured correctly**
8. **Mutations.changeAccount has correct structure**

**Mock Requirements:**
- No database mocks needed (no validation against accounts table)
- Action only validates transfer types and stores config

---

## Task 10: create_split Action Tests

**Priority:** P1 (Post-creation action)
**Lines:** ~240 lines
**Tests:** 12 tests
**Estimated Time:** 2 hours

### Background
The `create_split` action creates transaction splits with percentage or fixed amounts. It stores the splits in `mutations.createSplits` for post-creation processing. The action validates:
- At least one split exists
- Each split has valid categoryId
- Percentage splits: total ≤ 100%
- Fixed amount splits: no validation (handled post-creation)
- Mixed splits: allowed

### Implementation Details

**Location:** Replace `it.todo()` at line 1193-1195

**Test Cases:**

1. **Valid percentage splits (total = 100%)**
   ```typescript
   it("should create valid percentage splits totaling 100%", async () => {
     mockCategoryQuery("cat-1", "user-1");
     mockCategoryQuery("cat-2", "user-1");

     const action = createTestAction("create_split", {
       config: {
         splits: [
           { categoryId: "cat-1", percentage: 60, isPercentage: true },
           { categoryId: "cat-2", percentage: 40, isPercentage: true }
         ]
       }
     });
     const transaction = createTestTransaction({ amount: 100 });

     const result = await executeRuleActions("user-1", [action], transaction);

     expect(result.mutations.createSplits).toHaveLength(2);
     expect(result.mutations.createSplits[0].percentage).toBe(60);
     expect(result.appliedActions).toHaveLength(1);
   });
   ```

2. **Valid percentage splits (total < 100%)**
3. **Invalid percentage splits (total > 100%)**
   ```typescript
   it("should reject splits with total > 100%", async () => {
     const action = createTestAction("create_split", {
       config: {
         splits: [
           { categoryId: "cat-1", percentage: 60, isPercentage: true },
           { categoryId: "cat-2", percentage: 50, isPercentage: true } // 110%
         ]
       }
     });

     const result = await executeRuleActions("user-1", [action], transaction);

     expect(result.mutations.createSplits).toBeUndefined();
     expect(result.appliedActions).toHaveLength(0);
     expect(result.errors).toHaveLength(1);
   });
   ```
4. **Valid fixed amount splits**
5. **Mixed splits (percentage + fixed)**
6. **Validation error for no splits**
7. **Validation error for empty splits array**
8. **Validation error for missing categoryId**
9. **Correct applied action structure**
10. **Optional description field per split**
11. **Mutations.createSplits has correct structure**
12. **Split with all fields (categoryId, amount/percentage, description)**

**Mock Requirements:**
- Category validation (use existing `mockCategoryQuery()`)
- Validate categories exist and belong to user

---

## Task 11: convert_to_transfer Action Tests

**Priority:** P1 (Post-creation action)
**Lines:** ~200 lines
**Tests:** 10 tests
**Estimated Time:** 2 hours

### Background
The `convert_to_transfer` action converts income/expense to a transfer. It stores the config in `mutations.convertToTransfer` for post-creation processing. The action validates:
- Transaction is NOT already a transfer
- Default values are applied if not provided
- Config includes targetAccountId (optional for auto-detect), matching tolerance, date range, etc.

### Implementation Details

**Location:** Replace `it.todo()` at line 1197-1199

**Test Cases:**

1. **Valid conversion with target account**
   ```typescript
   it("should set transfer conversion with target account", async () => {
     const action = createTestAction("convert_to_transfer", {
       config: { targetAccountId: "account-2" }
     });
     const transaction = createTestTransaction({ type: "expense" });

     const result = await executeRuleActions("user-1", [action], transaction);

     expect(result.mutations.convertToTransfer).toEqual({
       targetAccountId: "account-2",
       autoMatch: true,
       matchTolerance: 1,
       matchDayRange: 7,
       createIfNoMatch: true
     });
   });
   ```

2. **Valid conversion without target account (auto-detect)**
3. **Skip action for transfer_out transaction**
4. **Skip action for transfer_in transaction**
5. **Default configuration values applied**
6. **Custom configuration (tolerance, date range, createIfNoMatch)**
7. **Correct applied action structure**
8. **Original transaction type captured**
9. **Mutations.convertToTransfer has complete config structure**
10. **All config fields present (targetAccountId, autoMatch, matchTolerance, matchDayRange, createIfNoMatch)**

**Mock Requirements:**
- No database mocks needed
- Action only validates transfer types and applies defaults

---

## Task 12: Multiple Actions Execution Tests

**Priority:** P0 (Critical for multi-action flows)
**Lines:** ~240 lines
**Tests:** 12 tests
**Estimated Time:** 2 hours

### Background
Tests the `executeRuleActions()` function with multiple actions in sequence. Validates:
- Actions execute in order
- Context updates between actions (category, merchant, description)
- Dependencies work correctly (e.g., set_category before set_tax_deduction)
- Errors in one action don't stop others
- Applied actions array reflects all executed actions

### Implementation Details

**Location:** Replace `it.todo()` at line 1201-1203

**Test Cases:**

1. **Execute 2 actions in sequence**
   ```typescript
   it("should execute 2 actions in sequence", async () => {
     mockCategoryQuery("cat-1", "user-1");
     mockMerchantQuery("merch-1", "user-1");

     const actions = [
       createTestAction("set_category", { value: "cat-1" }),
       createTestAction("set_merchant", { value: "merch-1" })
     ];
     const transaction = createTestTransaction();

     const result = await executeRuleActions("user-1", actions, transaction);

     expect(result.mutations.categoryId).toBe("cat-1");
     expect(result.mutations.merchantId).toBe("merch-1");
     expect(result.appliedActions).toHaveLength(2);
   });
   ```

2. **Execute 3+ actions in sequence**
3. **Context updates between actions**
   ```typescript
   it("should update context for subsequent actions", async () => {
     mockCategoryQuery("cat-1", "user-1");
     mockMerchantQuery("merch-1", "user-1");

     const actions = [
       createTestAction("set_category", { value: "cat-1" }),
       createTestAction("set_merchant", { value: "merch-1" }),
       createTestAction("prepend_description", { pattern: "[{merchant}] " }),
       createTestAction("append_description", { pattern: " - {category}" })
     ];
     const transaction = createTestTransaction({ description: "Purchase" });

     const result = await executeRuleActions("user-1", actions, transaction);

     // Merchant and category should be available in patterns
     expect(result.mutations.description).toBe("[Whole Foods] Purchase - Groceries");
   });
   ```

4. **set_category then set_tax_deduction (dependency)**
5. **set_merchant then description with {merchant} variable**
6. **Multiple description actions chaining**
7. **Mix of immediate and post-creation actions**
8. **Applied actions array in correct order**
9. **Partial success (one action fails, others succeed)**
10. **Error in middle action doesn't stop subsequent actions**
11. **All mutations collected correctly**
12. **Empty actions array returns empty result**

**Mock Requirements:**
- Use existing mock helpers for categories and merchants
- Test error scenarios with invalid data

---

## Task 13: Validation & Error Handling Tests

**Priority:** P0 (Critical for robustness)
**Lines:** ~300 lines
**Tests:** 15 tests
**Estimated Time:** 2 hours

### Background
Tests the `validateActions()` function and error handling throughout execution. Validates:
- Action type validation
- Required field validation per action type
- Database errors (not found)
- Execution errors (invalid config)
- Error message format
- Non-fatal vs fatal errors

### Implementation Details

**Location:** Replace `it.todo()` at lines 1205-1210

**Test Cases:**

**validateActions() function (8 tests):**

1. **Valid actions array returns no errors**
   ```typescript
   it("should return no errors for valid actions", () => {
     const actions = [
       createTestAction("set_category", { value: "cat-1" }),
       createTestAction("set_merchant", { value: "merch-1" }),
       createTestAction("set_description", { pattern: "Test" })
     ];

     const errors = validateActions(actions);

     expect(errors).toHaveLength(0);
   });
   ```

2. **Missing action type**
   ```typescript
   it("should return error for missing action type", () => {
     const actions = [{ value: "cat-1" }] as any;

     const errors = validateActions(actions);

     expect(errors).toHaveLength(1);
     expect(errors[0]).toContain("Action type is required");
   });
   ```

3. **Missing required value (set_category, set_merchant)**
4. **Missing required pattern (description actions)**
5. **Missing required config (create_split, set_sales_tax)**
6. **Invalid action type**
7. **Multiple validation errors at once**
8. **Empty actions array (valid, returns no errors)**

**Error handling in execution (7 tests):**

9. **Database error - category not found**
   ```typescript
   it("should handle category not found error", async () => {
     mockCategoryQuery("cat-1", "user-1", true); // Mock not found

     const action = createTestAction("set_category", { value: "cat-1" });
     const transaction = createTestTransaction();

     const result = await executeRuleActions("user-1", [action], transaction);

     expect(result.errors).toHaveLength(1);
     expect(result.errors[0]).toContain("Category not found");
     expect(result.appliedActions).toHaveLength(0);
   });
   ```

10. **Database error - merchant not found**
11. **Invalid configuration - split total > 100%**
12. **Errors array populated with descriptive messages**
13. **Error format includes action index**
14. **Non-fatal errors continue with other actions**
15. **Fatal errors throw exception (if implemented)**

**Mock Requirements:**
- Enhance `mockCategoryQuery()` and `mockMerchantQuery()` to accept `notFound` parameter
- Mock database to return empty arrays for not found cases

---

## Task 14: Utility Functions Tests

**Priority:** P2 (Nice to have, low priority)
**Lines:** ~200 lines
**Tests:** 10 tests
**Estimated Time:** 1 hour

### Background
Tests the utility functions `getActionDescription()` and `isActionImplemented()`. These provide human-readable descriptions and implementation status checks.

### Implementation Details

**Location:** Replace `it.todo()` at line 1213-1215

**Test Cases:**

**getActionDescription() (9 tests):**

1. **set_category description**
   ```typescript
   it("should return description for set_category", () => {
     const action = createTestAction("set_category", { value: "cat-1" });
     const description = getActionDescription(action);
     expect(description).toBe("Set category");
   });
   ```

2. **set_merchant description**
3. **set_description description**
4. **prepend_description description**
5. **append_description description**
6. **set_tax_deduction description**
7. **set_sales_tax description**
8. **convert_to_transfer description**
9. **create_split description**
10. **Unknown action type (fallback)**

**isActionImplemented() (covered in execution tests):**
- Already tested implicitly in execution tests
- No additional tests needed

**Mock Requirements:**
- None (pure utility functions)

---

## Implementation Strategy

### Phase 1: Post-Creation Actions (Days 1-2)
**Tasks:** 8, 9, 10, 11
**Tests:** 40 tests
**Time:** 7.5 hours

**Approach:**
1. Start with `set_sales_tax` (simplest validation)
2. Move to `set_account` (transfer validation)
3. Implement `create_split` (most complex validation)
4. Finish with `convert_to_transfer` (config defaults)

**Focus:**
- Understand mutation structure (what gets stored for post-creation)
- Test validation logic thoroughly
- Verify applied action structure

### Phase 2: Multi-Action & Validation (Day 3)
**Tasks:** 12, 13
**Tests:** 27 tests
**Time:** 4 hours

**Approach:**
1. Test multi-action scenarios with existing actions first
2. Add dependency tests (category → tax deduction)
3. Implement validation function tests
4. Add error handling for database failures

**Focus:**
- Context propagation between actions
- Error isolation (one action fails, others continue)
- Descriptive error messages

### Phase 3: Utilities & Polish (Day 3)
**Task:** 14
**Tests:** 10 tests
**Time:** 1 hour

**Approach:**
1. Quick implementation of utility function tests
2. Verify descriptions are user-friendly
3. Document any edge cases

**Focus:**
- Complete coverage
- Clean, maintainable tests

---

## Testing Best Practices

### Test Organization
- **Descriptive names:** Use "should [action] when [condition]" format
- **Arrange-Act-Assert:** Clear separation in each test
- **Mock once:** Use `beforeEach()` when mocks are reused

### Mock Database Usage
```typescript
// Category exists
mockCategoryQuery("cat-1", "user-1");

// Category not found (for error tests)
mockCategoryQuery("cat-1", "user-1", true);

// Multiple categories (for split tests)
mockCategoryQuery("cat-1", "user-1");
mockCategoryQuery("cat-2", "user-1");
```

### Assertion Patterns
```typescript
// Mutations structure
expect(result.mutations.propertyName).toBe(expectedValue);

// Applied actions
expect(result.appliedActions).toHaveLength(N);
expect(result.appliedActions[0].type).toBe("action_type");

// Error handling
expect(result.errors).toHaveLength(N);
expect(result.errors[0]).toContain("error message");
```

### Edge Cases to Test
- Empty/null values
- Boundary conditions (100% splits, 0% tolerance)
- Invalid types (transfer when expecting income/expense)
- Missing required fields
- Database failures

---

## Success Criteria

### Coverage Metrics
- **actions-executor.ts:** 95%+ line coverage
- **All 9 action types:** 100% tested
- **Error paths:** 90%+ coverage

### Test Quality
- **Fast:** All tests < 3 seconds total
- **Isolated:** No test dependencies
- **Deterministic:** No flaky tests
- **Descriptive:** Clear test names and assertions

### Completeness
- **Total Tests:** 138 tests (70 complete + 68 new)
- **All Functions Tested:**
  - executeRuleActions ✅
  - validateActions ✅
  - getActionDescription ✅
  - parseDescriptionPattern ✅
  - All internal execute functions ✅

---

## Timeline

### Day 1 (4 hours)
- ✅ Morning (2h): Task 8 - set_sales_tax (10 tests)
- ✅ Afternoon (2h): Task 9 - set_account (8 tests)

### Day 2 (4 hours)
- ✅ Morning (2h): Task 10 - create_split (12 tests)
- ✅ Afternoon (2h): Task 11 - convert_to_transfer (10 tests)

### Day 3 (4 hours)
- ✅ Morning (2h): Task 12 - Multiple actions (12 tests)
- ✅ Afternoon (2h): Task 13 - Validation & errors (15 tests)

### Day 4 (1 hour) - Final Polish
- ✅ Morning (1h): Task 14 - Utility functions (10 tests)

**Total Time:** ~13 hours
**Total Tests:** 68 new tests (138 total)

---

## Expected Outcomes

After completing this plan:

1. ✅ **95%+ coverage** of actions-executor.ts achieved
2. ✅ **138 tests** covering all 9 action types
3. ✅ **Comprehensive error handling** tested
4. ✅ **Multi-action execution** verified
5. ✅ **Production ready** - all edge cases covered
6. ✅ **Integration tests** can begin (Phase 4)

---

## Next Steps

1. **Start with Task 8** (set_sales_tax) - Replace line 1185-1187
2. **Run tests after each task** - Verify coverage increases
3. **Update features.md** - Mark progress as tests complete
4. **Document any bugs found** - Fix executor if needed
5. **Move to integration tests** - Once 95%+ coverage achieved

---

**Status:** Ready to implement starting with Task 8 (set_sales_tax)
**Next Phase:** Integration Tests (after 95%+ coverage)
**Documentation:** Update `docs/features.md` when complete
