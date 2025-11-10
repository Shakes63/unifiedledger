# Integration Tests - Implementation Plan

**Date Created:** 2025-11-10
**Status:** Planning
**Priority:** MEDIUM (Unit tests complete at 80%+, integration tests for production confidence)
**Target Coverage:** 90%+ for integration scenarios
**Estimated Tests:** ~30 tests
**Estimated Time:** 1-2 days

## Overview

Integration tests verify that the Rules System components work together correctly in real-world scenarios. While unit tests confirm individual functions work in isolation, integration tests ensure the complete flow from rule matching through action execution to database persistence operates as expected.

**What's Already Complete:**
- ✅ Condition Evaluator Tests: 154 tests (100% coverage)
- ✅ Rule Matcher Tests: 65 tests (95%+ coverage)
- ✅ Actions Executor Tests: 139 tests (100% coverage)
- **Total Unit Tests:** 358 tests

**What's Missing:**
- ⏳ End-to-end rule flows with real database operations
- ⏳ Transaction creation API integration with rules
- ⏳ Bulk apply rules API integration
- ⏳ Post-creation action handlers (transfers, splits, account changes)
- ⏳ Audit logging (ruleExecutionLog table)
- ⏳ Error scenarios and rollback behavior

## Goals

1. **Verify Complete Flows:** Test entire rule application process from start to finish
2. **Database Integration:** Ensure proper persistence and data consistency
3. **API Integration:** Validate rules work correctly through API endpoints
4. **Error Handling:** Verify graceful degradation and error recovery
5. **Real-World Scenarios:** Test common use cases and edge cases
6. **Performance:** Ensure rules perform well with realistic data volumes

## Test File Structure

```
__tests__/
└── integration/
    ├── rules-flow.test.ts                    # Complete rule flows (10 tests)
    ├── transaction-creation-rules.test.ts    # Transaction API integration (5 tests)
    ├── bulk-apply-rules.test.ts              # Bulk apply API integration (5 tests)
    ├── post-creation-actions.test.ts         # Transfer/split/account actions (7 tests)
    └── rule-execution-logging.test.ts        # Audit trail verification (3 tests)
```

## Test Implementation Tasks

### Task 1: Complete Rule Flow Tests (10 tests)
**File:** `__tests__/integration/rules-flow.test.ts`
**Focus:** End-to-end rule matching → action execution → database updates

#### Tests to Implement:

1. **Basic Rule Flow: Match → Set Category**
   - Create transaction without category
   - Rule matches on description
   - Category applied to transaction
   - Audit log created with correct data
   - **Verification:** Transaction updated, log entry exists

2. **Multi-Action Rule Flow: Set Category + Modify Description**
   - Rule with 2 actions: set_category + append_description
   - Both actions execute in sequence
   - Context propagates between actions
   - **Verification:** Both mutations applied, audit log shows both actions

3. **Pattern Variable Substitution**
   - Rule with description action using {merchant}, {category}, {amount}
   - Variables replaced with actual values
   - Description formatted correctly
   - **Verification:** Description matches expected pattern

4. **Priority-Based Matching**
   - Multiple rules that match transaction
   - Only highest priority rule applies
   - Lower priority rules ignored
   - **Verification:** Correct rule applied based on priority

5. **Complex Conditions: Nested AND/OR Groups**
   - Rule with 3+ levels of condition nesting
   - Transaction matches complex logic
   - All conditions evaluated correctly
   - **Verification:** Rule matches when expected, doesn't match otherwise

6. **No Match Scenario**
   - Transaction doesn't match any rules
   - No changes applied to transaction
   - No audit log created
   - **Verification:** Transaction unchanged, no log entries

7. **Inactive Rule Skipping**
   - Multiple rules exist, some inactive
   - Only active rules considered for matching
   - Inactive rules never applied
   - **Verification:** Inactive rules completely ignored

8. **Transfer Transaction Exemption**
   - Transfer transactions don't get rules applied
   - Rule exists that would match
   - Transfer remains uncategorized
   - **Verification:** Transfer transactions excluded from rule matching

9. **Already Categorized Transaction**
   - Transaction already has category
   - Rule would match but doesn't apply
   - Original category preserved
   - **Verification:** Existing category not overwritten

10. **Error Recovery: Invalid Category**
    - Rule tries to set non-existent category
    - Error handled gracefully
    - Transaction remains unchanged
    - Error logged
    - **Verification:** Transaction rollback, audit log shows error

---

### Task 2: Transaction Creation API Integration (5 tests)
**File:** `__tests__/integration/transaction-creation-rules.test.ts`
**Focus:** Rules applied during POST /api/transactions

#### Tests to Implement:

1. **Rule Applied on Transaction Creation**
   - POST transaction without categoryId
   - Rule matches during creation
   - Response includes applied category
   - Database has categorized transaction
   - **Verification:** API response + database state

2. **Multiple Actions During Creation**
   - Rule with set_category + set_merchant + modify description
   - All actions execute during creation
   - Transaction created with all mutations
   - **Verification:** Single database insert with all changes

3. **Manual Category Overrides Rules**
   - POST transaction WITH categoryId
   - Rule would match but doesn't apply
   - Manual category respected
   - No audit log for rule application
   - **Verification:** Manual category wins, no rule execution

4. **Post-Creation Action: Set Sales Tax**
   - Rule sets isSalesTaxable = true on income transaction
   - Applied during creation
   - **Verification:** Transaction has sales tax flag set

5. **Post-Creation Action: Set Tax Deduction**
   - Rule sets isTaxDeductible = true
   - Category configured as tax deductible
   - Applied during creation
   - **Verification:** Transaction marked as tax deductible

---

### Task 3: Bulk Apply Rules API Integration (5 tests)
**File:** `__tests__/integration/bulk-apply-rules.test.ts`
**Focus:** POST /api/rules/apply-bulk functionality

#### Tests to Implement:

1. **Bulk Apply to Uncategorized Transactions**
   - 10 uncategorized transactions
   - 1 rule matches 5 of them
   - Bulk apply endpoint called
   - **Verification:** 5 transactions updated, 5 unchanged, result summary correct

2. **Bulk Apply with Date Range Filter**
   - 20 transactions across 3 months
   - Bulk apply with startDate and endDate
   - Only transactions in range processed
   - **Verification:** Only filtered transactions updated

3. **Bulk Apply with Specific Rule ID**
   - Multiple rules exist
   - Bulk apply with ruleId parameter
   - Only specified rule applied
   - Other matching rules ignored
   - **Verification:** Only target rule applied

4. **Bulk Apply with Limit**
   - 100 uncategorized transactions
   - Bulk apply with limit=25
   - Only first 25 processed
   - Remaining 75 still uncategorized
   - **Verification:** Pagination working correctly

5. **Bulk Apply Error Handling**
   - 10 transactions to process
   - 2 transactions cause errors (invalid data)
   - 8 transactions succeed
   - Errors reported in response
   - **Verification:** Partial success, errors isolated, summary accurate

---

### Task 4: Post-Creation Action Handlers (7 tests)
**File:** `__tests__/integration/post-creation-actions.test.ts`
**Focus:** handleTransferConversion, handleSplitCreation, handleAccountChange

#### Tests to Implement:

1. **Convert to Transfer: Auto-Match Found**
   - Transaction A created: $100 from Checking
   - Rule converts to transfer
   - Transaction B exists: $100 to Savings, within date range
   - Auto-match links them as transfer pair
   - **Verification:** Both transactions have transferId, balances updated

2. **Convert to Transfer: No Match, Create Pair**
   - Transaction created with convert_to_transfer rule
   - No matching opposite transaction found
   - New transfer_in transaction created
   - Both linked with transferId
   - **Verification:** Transfer pair created, balances correct

3. **Convert to Transfer: Medium Confidence Suggestion**
   - Transaction created
   - Potential match found with 75% confidence
   - Suggestion stored in transferSuggestions table
   - No auto-link
   - **Verification:** Suggestion created, no transfer link yet

4. **Create Split: Percentage-Based**
   - Transaction: $100 expense
   - Rule creates 3 splits: 50%, 30%, 20%
   - Splits created with correct amounts ($50, $30, $20)
   - Parent transaction marked as isSplit=true
   - **Verification:** 3 split records, amounts match percentages

5. **Create Split: Fixed Amounts**
   - Transaction: $100 expense
   - Rule creates 2 splits: $60 + $40
   - Splits created with exact amounts
   - **Verification:** Split amounts match configuration

6. **Set Account: Balance Updates**
   - Transaction: $50 expense on Account A
   - Rule changes to Account B
   - Account A balance increased by $50 (expense removed)
   - Account B balance decreased by $50 (expense added)
   - **Verification:** Both account balances updated correctly

7. **Set Account: Transfer Protection**
   - Transfer transaction exists
   - Rule tries to change account
   - Action rejected (transfers can't be moved)
   - Transaction unchanged
   - **Verification:** Transfer transactions protected from account changes

---

### Task 5: Rule Execution Logging (3 tests)
**File:** `__tests__/integration/rule-execution-logging.test.ts`
**Focus:** ruleExecutionLog table audit trail

#### Tests to Implement:

1. **Audit Log: Successful Rule Application**
   - Rule applied to transaction
   - Log entry created with:
     - ruleId
     - transactionId
     - appliedCategoryId
     - appliedActions (JSON)
     - matched = true
     - executedAt timestamp
   - **Verification:** Log entry has all required fields

2. **Audit Log: Multiple Actions Recorded**
   - Rule with 5 actions all execute
   - appliedActions field contains all 5
   - Each action has type, field, value
   - **Verification:** All actions captured in log

3. **Audit Log: No Match, No Log**
   - Transaction doesn't match any rules
   - No log entry created
   - ruleExecutionLog table unchanged
   - **Verification:** No spurious log entries

---

## Testing Strategy

### Setup & Teardown

Each test file will include:

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { db } from "@/lib/db";
import { transactions, accounts, budgetCategories, ruleExecutionLog } from "@/lib/db/schema";

describe("Integration: Complete Rule Flow", () => {
  let testUserId: string;
  let testAccountId: string;
  let testCategoryId: string;
  let testRuleId: string;

  beforeEach(async () => {
    // Setup: Create test user, account, category, rule
    testUserId = "test-user-123";

    // Insert test account
    const [account] = await db.insert(accounts).values({
      id: nanoid(),
      userId: testUserId,
      name: "Test Checking",
      type: "checking",
      currentBalance: 1000,
      // ... other fields
    }).returning();
    testAccountId = account.id;

    // Insert test category
    // Insert test rule
    // ...
  });

  afterEach(async () => {
    // Cleanup: Delete test data
    await db.delete(transactions).where(eq(transactions.userId, testUserId));
    await db.delete(accounts).where(eq(accounts.userId, testUserId));
    await db.delete(budgetCategories).where(eq(budgetCategories.userId, testUserId));
    // ... other tables
  });

  it("should apply rule on transaction creation", async () => {
    // Test implementation
  });
});
```

### Mocking Strategy

**What to Mock:**
- ✅ Clerk Auth: Mock `auth()` to return test user ID
- ✅ External APIs: None in rules system

**What NOT to Mock:**
- ❌ Database: Use real database with test data (or in-memory SQLite)
- ❌ Rules Engine: Test actual implementation
- ❌ Decimal.js: Use real library for financial calculations

### Data Factory Pattern

Create reusable test data factories:

```typescript
function createTestTransaction(overrides?: Partial<Transaction>) {
  return {
    id: nanoid(),
    userId: testUserId,
    accountId: testAccountId,
    description: "Test Transaction",
    amount: 50.00,
    date: "2025-01-23",
    type: "expense",
    categoryId: null,
    merchantId: null,
    notes: null,
    isPending: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function createTestRule(conditions: Condition[], actions: RuleAction[], overrides?: Partial<Rule>) {
  return {
    id: nanoid(),
    userId: testUserId,
    name: "Test Rule",
    priority: 1,
    isActive: true,
    conditions: JSON.stringify({ operator: "and", conditions }),
    actions: JSON.stringify(actions),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}
```

### Assertion Patterns

**Database State Assertions:**
```typescript
// Verify transaction updated
const updatedTransaction = await db
  .select()
  .from(transactions)
  .where(eq(transactions.id, transactionId))
  .limit(1);

expect(updatedTransaction[0].categoryId).toBe(expectedCategoryId);
expect(updatedTransaction[0].description).toBe("Expected description");
```

**Audit Log Assertions:**
```typescript
// Verify audit log created
const logEntries = await db
  .select()
  .from(ruleExecutionLog)
  .where(eq(ruleExecutionLog.transactionId, transactionId));

expect(logEntries).toHaveLength(1);
expect(logEntries[0].ruleId).toBe(expectedRuleId);
expect(logEntries[0].matched).toBe(true);

const appliedActions = JSON.parse(logEntries[0].appliedActions);
expect(appliedActions).toHaveLength(2);
expect(appliedActions[0].type).toBe("set_category");
```

**API Response Assertions:**
```typescript
// Verify API response structure
expect(response.status).toBe(200);
const data = await response.json();

expect(data).toMatchObject({
  totalProcessed: 10,
  totalUpdated: 5,
  errors: [],
  appliedRules: expect.arrayContaining([
    expect.objectContaining({
      transactionId: expect.any(String),
      ruleId: expect.any(String),
      categoryId: expect.any(String),
      appliedActions: expect.any(Array),
    }),
  ]),
});
```

## Theme Integration

Integration tests don't directly test UI theming, but should verify:
- **Data Integrity:** Theme preferences stored correctly in database
- **API Consistency:** Theme data returned in correct format
- **No Hardcoded Colors:** Rules don't contain hex colors (should use category colors)

## Performance Considerations

### Test Speed
- **Target:** Each test < 500ms (with database operations)
- **Strategy:** Use in-memory SQLite for tests (faster than disk)
- **Parallel Execution:** Tests must be isolated (no shared state)

### Realistic Data Volumes
- **Small Tests:** 1-10 transactions (unit-level)
- **Medium Tests:** 50-100 transactions (typical bulk apply)
- **Large Tests:** 500+ transactions (stress test, optional)

## Success Metrics

### Coverage Targets
- ✅ **Complete Rule Flows:** 10 tests covering end-to-end scenarios
- ✅ **Transaction Creation API:** 5 tests for POST /api/transactions integration
- ✅ **Bulk Apply API:** 5 tests for POST /api/rules/apply-bulk
- ✅ **Post-Creation Actions:** 7 tests for transfer/split/account handlers
- ✅ **Audit Logging:** 3 tests for ruleExecutionLog

**Total:** 30 integration tests

### Quality Metrics
- ✅ All tests pass consistently (no flaky tests)
- ✅ Each test verifies multiple aspects (action + database + audit)
- ✅ Error scenarios covered
- ✅ Real-world use cases represented
- ✅ Performance acceptable (< 15 seconds total test suite)

## Implementation Order

### Phase 1: Setup (1 hour)
1. Create integration test folder structure
2. Setup test utilities and data factories
3. Configure database for testing
4. Mock Clerk auth

### Phase 2: Core Flows (3 hours)
5. Implement Task 1: Complete Rule Flow Tests (10 tests)
   - Start with simple single-action flows
   - Progress to complex multi-action scenarios
   - Cover error cases last

### Phase 3: API Integration (2 hours)
6. Implement Task 2: Transaction Creation API Integration (5 tests)
7. Implement Task 3: Bulk Apply Rules API Integration (5 tests)

### Phase 4: Advanced Actions (2 hours)
8. Implement Task 4: Post-Creation Action Handlers (7 tests)
   - Transfer conversion (3 tests)
   - Split creation (2 tests)
   - Account changes (2 tests)

### Phase 5: Audit & Cleanup (1 hour)
9. Implement Task 5: Rule Execution Logging (3 tests)
10. Run full test suite and verify coverage
11. Document any edge cases discovered

**Total Estimated Time:** 9 hours (1-2 days)

## Dependencies

### Required Packages (Already Installed)
- ✅ vitest
- ✅ @vitest/ui
- ✅ drizzle-orm
- ✅ nanoid
- ✅ decimal.js

### Test Database
- **Option 1:** Use existing SQLite database with test data cleanup
- **Option 2:** Use in-memory SQLite database (faster, isolated)
- **Recommendation:** Option 2 for CI/CD, Option 1 for local development

## Edge Cases to Cover

1. **Null/Undefined Handling**
   - Transaction with missing optional fields
   - Rule with null actions
   - Category/merchant lookup failures

2. **Concurrent Execution**
   - Multiple rules applied simultaneously
   - Race conditions in database updates
   - Transaction isolation

3. **Data Validation**
   - Invalid condition operators
   - Invalid action types
   - Malformed JSON in database

4. **Financial Precision**
   - Decimal.js used for all amounts
   - Split amounts sum exactly to transaction amount
   - Balance updates accurate to 2 decimal places

5. **Unicode & Special Characters**
   - Emoji in descriptions
   - Unicode characters in pattern variables
   - Special regex characters

## Future Enhancements (Post-MVP)

After completing these 30 tests:
- **Performance Benchmarks:** Test with 10,000+ transactions
- **Load Testing:** Concurrent bulk apply operations
- **E2E UI Tests:** Test rule builder with Playwright
- **Mutation Testing:** Verify tests catch real bugs (Stryker)
- **API Contract Tests:** Validate API schemas with Zod

## Notes

### Why Integration Tests Matter
- **Unit tests verify:** Individual functions work correctly in isolation
- **Integration tests verify:** Components work together in real scenarios
- **Production confidence:** Integration tests catch issues unit tests miss

### Test Maintenance
- Keep tests focused (one scenario per test)
- Use descriptive test names
- Update tests when features change
- Remove obsolete tests promptly

### Documentation
- Add JSDoc comments to test utilities
- Document non-obvious test setups
- Explain complex assertions
- Link to feature documentation

---

**Status:** Ready to implement
**Next Steps:**
1. Create integration test folder
2. Setup test utilities
3. Start with Task 1 (Complete Rule Flow Tests)
4. Progress through tasks 2-5 sequentially

**Expected Outcome:** 30 high-quality integration tests providing 90%+ coverage of end-to-end rule flows, giving confidence in production deployments.
