# Rule Matcher Testing - Detailed Implementation Plan

**Date Created:** 2025-11-10
**Status:** Ready to Implement
**Priority:** HIGH (Next in Phase 8 Testing)
**Estimated Tests:** 50-60 tests
**Target Coverage:** 95%+

## Overview

This plan covers comprehensive testing for `lib/rules/rule-matcher.ts`, which is responsible for matching transactions against categorization rules with priority-based ordering. The rule matcher is critical for the auto-categorization feature and integrates with the condition evaluator (already 100% tested) and actions executor.

## Prerequisites

✅ **Completed:**
- Test infrastructure setup (vitest configured)
- Condition evaluator tests complete (154 tests, 100% coverage)
- Split calculator tests complete (80+ tests, 100% coverage)

## Components Under Test

### File: `lib/rules/rule-matcher.ts`

**Functions to Test:**
1. ✅ `parseRuleActions()` - Parses actions from database format with backward compatibility
2. ✅ `evaluateRule()` - Evaluates a single rule against transaction data (internal)
3. ✅ `findMatchingRule()` - Finds highest priority matching rule (async, uses database)
4. ✅ `findAllMatchingRules()` - Finds all matching rules for debugging (async, uses database)
5. ✅ `testRule()` - Tests a rule against a transaction (sync, for UI preview)
6. ✅ `testRuleOnMultiple()` - Tests a rule against multiple transactions (sync)

**Key Features:**
- Priority-based matching (lower number = higher priority)
- First matching rule applies (stops after first match)
- AND/OR recursive group support (via condition-evaluator)
- Backward compatibility for old rules (categoryId → set_category action)
- Error handling for invalid conditions and JSON parsing

## Test File Structure

```
__tests__/
├── lib/
│   ├── rules/
│   │   ├── condition-evaluator.test.ts  ✅ (Complete - 154 tests)
│   │   └── rule-matcher.test.ts         🔨 (This plan)
```

## Test Data Setup

### Mock Database Configuration

Since `findMatchingRule()` and `findAllMatchingRules()` query the database, we need comprehensive mocking:

```typescript
import { vi } from 'vitest';
import * as dbModule from '@/lib/db';

// Mock the database module
vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockResolvedValue([]),
  },
}));
```

### Test Data Factories

```typescript
// Helper: Create test transaction
function createTestTransaction(overrides?: Partial<TransactionData>): TransactionData {
  return {
    description: "Coffee Shop Purchase",
    amount: 5.50,
    accountName: "Checking",
    date: "2025-01-23",
    notes: "Morning coffee",
    ...overrides,
  };
}

// Helper: Create test rule
function createTestRule(overrides?: Partial<TestRule>): TestRule {
  return {
    id: 'rule-1',
    name: 'Test Rule',
    userId: 'user-123',
    categoryId: 'cat-1',
    priority: 1,
    isActive: true,
    conditions: JSON.stringify({
      field: 'description',
      operator: 'contains',
      value: 'coffee',
      caseSensitive: false,
    }),
    actions: null, // Will test backward compatibility
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// Helper: Create test condition (as JSON string)
function createConditionJSON(
  field: string,
  operator: string,
  value: string,
  caseSensitive = false
): string {
  return JSON.stringify({ field, operator, value, caseSensitive });
}

// Helper: Create test action
function createTestAction(
  type: RuleActionType,
  value?: string,
  pattern?: string,
  config?: Record<string, any>
): RuleAction {
  return { type, value, pattern, config };
}

// Helper: Create actions array as JSON string
function createActionsJSON(actions: RuleAction[]): string {
  return JSON.stringify(actions);
}
```

## Test Implementation Plan

### Task 1: Setup & Utilities (Est: 30 min)

**File:** `__tests__/lib/rules/rule-matcher.test.ts`

**Tasks:**
1. Create test file with imports
2. Set up database mocking with vi.mock
3. Create helper functions for test data
4. Add beforeEach/afterEach hooks for mock cleanup
5. Verify test infrastructure works with simple smoke test

**Expected Output:** Test file skeleton with passing smoke test

---

### Task 2: parseRuleActions() Tests (Est: 45 min)

**Test Count:** 8 tests

**Test Cases:**

1. ✅ **Parse valid actions array**
   - Input: JSON string with multiple actions
   - Expected: Parsed array of RuleAction objects

2. ✅ **Parse single action**
   - Input: JSON string with one action
   - Expected: Array with single action

3. ✅ **Backward compatibility: categoryId only**
   - Input: No actions, but categoryId present
   - Expected: Array with single set_category action

4. ✅ **Invalid JSON handling**
   - Input: Malformed JSON string
   - Expected: Empty array (graceful fallback)

5. ✅ **Empty actions array**
   - Input: JSON string "[]"
   - Expected: Empty array (fallback to categoryId if present)

6. ✅ **Null actions with null categoryId**
   - Input: Both actions and categoryId are null
   - Expected: Empty array

7. ✅ **Actions array with empty string**
   - Input: actions = ""
   - Expected: Empty array or fallback to categoryId

8. ✅ **Multiple action types**
   - Input: Actions array with set_category, set_merchant, prepend_description
   - Expected: All actions parsed correctly

**Success Criteria:** All parseRuleActions() edge cases handled correctly

---

### Task 3: testRule() Function Tests (Est: 45 min)

**Test Count:** 10 tests

**Test Cases:**

1. ✅ **Single condition matches**
   - Rule: description contains "coffee"
   - Transaction: "Coffee Shop Purchase"
   - Expected: { matched: true }

2. ✅ **Single condition doesn't match**
   - Rule: description contains "restaurant"
   - Transaction: "Coffee Shop Purchase"
   - Expected: { matched: false }

3. ✅ **Multiple conditions with AND logic**
   - Rule: amount > 5 AND description contains "coffee"
   - Transaction: amount 5.50, description "Coffee Shop"
   - Expected: { matched: true }

4. ✅ **Multiple conditions with OR logic**
   - Rule: description contains "coffee" OR description contains "tea"
   - Transaction: "Coffee Shop"
   - Expected: { matched: true }

5. ✅ **Nested AND within OR**
   - Rule: (amount > 10 AND account = "Checking") OR description contains "coffee"
   - Transaction: amount 5.50, description "Coffee Shop"
   - Expected: { matched: true }

6. ✅ **Invalid conditions JSON**
   - Rule: conditions = "invalid json"
   - Expected: { matched: false, errors: [...] }

7. ✅ **Missing required fields in condition**
   - Rule: { operator: "equals", value: "test" } (no field)
   - Expected: { matched: false, errors: [...] }

8. ✅ **Rule with optional ID**
   - Rule: No ID provided (for new rule preview)
   - Expected: Works correctly with default 'test' ID

9. ✅ **Complex recursive groups (3 levels deep)**
   - Rule: ((A AND B) OR (C AND D)) AND E
   - Expected: Correct evaluation based on transaction

10. ✅ **Empty condition group**
    - Rule: { operator: "AND", conditions: [] }
    - Expected: { matched: false, errors: [...] }

**Success Criteria:** testRule() works for all condition types and edge cases

---

### Task 4: testRuleOnMultiple() Function Tests (Est: 30 min)

**Test Count:** 5 tests

**Test Cases:**

1. ✅ **Test rule against multiple transactions (all match)**
   - Rule: description contains "coffee"
   - Transactions: ["Coffee A", "Coffee B", "Coffee C"]
   - Expected: All results have matched: true

2. ✅ **Test rule against multiple transactions (mixed results)**
   - Rule: amount > 10
   - Transactions: [15.00, 5.00, 20.00]
   - Expected: [true, false, true]

3. ✅ **Test rule against empty array**
   - Transactions: []
   - Expected: []

4. ✅ **Test rule against single transaction**
   - Transactions: [one transaction]
   - Expected: Array with single result

5. ✅ **Test rule with errors against multiple transactions**
   - Rule: Invalid conditions
   - Transactions: Multiple transactions
   - Expected: All results have matched: false and errors

**Success Criteria:** Batch testing works correctly for all scenarios

---

### Task 5: findMatchingRule() - Basic Matching (Est: 1 hour)

**Test Count:** 8 tests

**Test Cases:**

1. ✅ **Single rule matches**
   - Mock DB: One active rule that matches
   - Expected: Returns matched rule with actions

2. ✅ **Single rule doesn't match**
   - Mock DB: One active rule that doesn't match
   - Expected: { matched: false }

3. ✅ **No rules in database**
   - Mock DB: Empty array
   - Expected: { matched: false }

4. ✅ **Multiple rules, first matches**
   - Mock DB: [Rule1 (matches), Rule2 (matches)]
   - Expected: Returns Rule1 only (first matching rule applies)

5. ✅ **Multiple rules, second matches**
   - Mock DB: [Rule1 (no match), Rule2 (matches)]
   - Expected: Returns Rule2

6. ✅ **Inactive rule doesn't match**
   - Mock DB: One rule with isActive: false
   - Expected: { matched: false } (inactive rules filtered by query)

7. ✅ **Rule with null priority is skipped**
   - Mock DB: One rule with priority: null
   - Expected: { matched: false }

8. ✅ **Database query error handling**
   - Mock DB: Throws error
   - Expected: { matched: false, errors: [...] }

**Success Criteria:** Basic matching logic works with database queries

---

### Task 6: findMatchingRule() - Priority-Based Matching (Est: 1 hour)

**Test Count:** 8 tests

**Test Cases:**

1. ✅ **Lower priority number matches first**
   - Mock DB: [Rule(priority: 2), Rule(priority: 1, matches)]
   - Expected: Rule with priority 1 (sorted by priority ASC)

2. ✅ **Same priority, first in list matches**
   - Mock DB: [Rule1(priority: 1, matches), Rule2(priority: 1, matches)]
   - Expected: Rule1 (first matching rule applies)

3. ✅ **Higher priority rule doesn't match, lower priority matches**
   - Mock DB: [Rule(priority: 1, no match), Rule(priority: 2, matches)]
   - Expected: Rule with priority 2

4. ✅ **Priority 0 is valid and highest**
   - Mock DB: [Rule(priority: 0, matches), Rule(priority: 1)]
   - Expected: Rule with priority 0

5. ✅ **Large priority numbers work**
   - Mock DB: [Rule(priority: 1000), Rule(priority: 999, matches)]
   - Expected: Rule with priority 999

6. ✅ **Priority ordering with 5+ rules**
   - Mock DB: Rules with priorities [5, 3, 1, 4, 2], only priority 3 matches
   - Expected: Rule with priority 3

7. ✅ **Negative priority is valid (if allowed by schema)**
   - Mock DB: Rule with priority: -1
   - Expected: Works correctly (or test schema validation)

8. ✅ **Mixed null and valid priorities**
   - Mock DB: [Rule(priority: null), Rule(priority: 1, matches)]
   - Expected: Null priority skipped, priority 1 matched

**Success Criteria:** Priority-based matching works correctly for all scenarios

---

### Task 7: findMatchingRule() - Action Parsing (Est: 45 min)

**Test Count:** 6 tests

**Test Cases:**

1. ✅ **Rule with actions array**
   - Mock DB: Rule with actions JSON string
   - Expected: Returns parsed actions array

2. ✅ **Rule with backward compatibility (categoryId only)**
   - Mock DB: Rule with categoryId but no actions
   - Expected: Returns [{ type: 'set_category', value: categoryId }]

3. ✅ **Rule with both actions and categoryId**
   - Mock DB: Rule with actions array and categoryId
   - Expected: Returns parsed actions (actions take precedence)

4. ✅ **Rule with multiple action types**
   - Mock DB: Rule with [set_category, set_merchant, prepend_description]
   - Expected: All actions returned correctly

5. ✅ **Rule with invalid actions JSON**
   - Mock DB: Rule with malformed actions JSON but valid categoryId
   - Expected: Falls back to set_category action from categoryId

6. ✅ **Rule with empty actions array and no categoryId**
   - Mock DB: actions = "[]", categoryId = null
   - Expected: Returns empty actions array

**Success Criteria:** Action parsing works with all edge cases and backward compatibility

---

### Task 8: findAllMatchingRules() Tests (Est: 45 min)

**Test Count:** 6 tests

**Test Cases:**

1. ✅ **Multiple rules match**
   - Mock DB: 3 rules, all match
   - Expected: Returns all 3 rules in priority order

2. ✅ **Some rules match**
   - Mock DB: 5 rules, 2 match
   - Expected: Returns 2 matching rules

3. ✅ **No rules match**
   - Mock DB: 3 rules, none match
   - Expected: Returns empty array

4. ✅ **Priority ordering in results**
   - Mock DB: Rules with priorities [3, 1, 2], all match
   - Expected: Returns in order [1, 2, 3]

5. ✅ **Skips null priorities**
   - Mock DB: [Rule(priority: null), Rule(priority: 1, matches)]
   - Expected: Returns only priority 1 rule

6. ✅ **Database error handling**
   - Mock DB: Throws error
   - Expected: Returns empty array, logs error

**Success Criteria:** findAllMatchingRules() returns all matching rules correctly

---

### Task 9: Edge Cases & Error Handling (Est: 45 min)

**Test Count:** 8 tests

**Test Cases:**

1. ✅ **Transaction with missing fields**
   - Transaction: { description: "test" } (no amount, account, etc.)
   - Rule: Requires multiple fields
   - Expected: Evaluates available fields correctly

2. ✅ **Transaction with null/undefined values**
   - Transaction: { description: null, amount: undefined }
   - Expected: Handles gracefully without crashing

3. ✅ **Rule conditions with special characters**
   - Rule: description contains "café ☕"
   - Expected: Matches correctly

4. ✅ **Very large transaction amount**
   - Transaction: amount = 999999999.99
   - Rule: amount > 1000000
   - Expected: Evaluates correctly with Decimal.js precision

5. ✅ **Date edge cases**
   - Transaction: date = "2024-02-29" (leap year)
   - Rule: matches_day = 29
   - Expected: Matches correctly

6. ✅ **Empty description matching**
   - Transaction: description = ""
   - Rule: description equals ""
   - Expected: Matches correctly

7. ✅ **Unicode and emoji in descriptions**
   - Transaction: description = "🎉 Party expense 🎊"
   - Rule: description contains "Party"
   - Expected: Matches correctly

8. ✅ **Concurrent rule evaluation (same userId, multiple transactions)**
   - Scenario: Simulate multiple calls to findMatchingRule
   - Expected: No race conditions, consistent results

**Success Criteria:** All edge cases handled gracefully without errors

---

## Mock Database Setup Examples

### Example 1: Mock Single Rule Match

```typescript
import { vi } from 'vitest';
import * as dbModule from '@/lib/db';

// In beforeEach or individual test
const mockRules = [
  createTestRule({
    id: 'rule-1',
    priority: 1,
    conditions: createConditionJSON('description', 'contains', 'coffee'),
    actions: createActionsJSON([
      { type: 'set_category', value: 'cat-123' }
    ])
  })
];

vi.mocked(dbModule.db.select().from().where().orderBy).mockResolvedValue(mockRules);
```

### Example 2: Mock Multiple Rules with Priorities

```typescript
const mockRules = [
  createTestRule({ id: 'rule-1', priority: 1, /* ... */ }),
  createTestRule({ id: 'rule-2', priority: 2, /* ... */ }),
  createTestRule({ id: 'rule-3', priority: 3, /* ... */ })
];

vi.mocked(dbModule.db.select().from().where().orderBy).mockResolvedValue(mockRules);
```

### Example 3: Mock Database Error

```typescript
vi.mocked(dbModule.db.select().from().where().orderBy).mockRejectedValue(
  new Error('Database connection failed')
);
```

## Test Utilities Reference

### Helper Functions to Implement

```typescript
// Create test transaction with sensible defaults
function createTestTransaction(overrides?: Partial<TransactionData>): TransactionData

// Create test rule with all required fields
function createTestRule(overrides?: Partial<RuleRow>): RuleRow

// Create condition as JSON string (for rule.conditions field)
function createConditionJSON(field, operator, value, caseSensitive?): string

// Create action object
function createTestAction(type, value?, pattern?, config?): RuleAction

// Create actions array as JSON string (for rule.actions field)
function createActionsJSON(actions: RuleAction[]): string

// Create AND condition group
function createAndGroup(conditions: Condition[]): ConditionGroup

// Create OR condition group
function createOrGroup(conditions: Condition[]): ConditionGroup

// Mock database with rules
function mockDatabaseRules(rules: RuleRow[]): void

// Clear all database mocks
function clearDatabaseMocks(): void
```

## Success Metrics

### Coverage Targets
- ✅ parseRuleActions: 100%
- ✅ evaluateRule: 95%+
- ✅ findMatchingRule: 95%+
- ✅ findAllMatchingRules: 95%+
- ✅ testRule: 100%
- ✅ testRuleOnMultiple: 100%
- **Overall rule-matcher.ts: 95%+**

### Test Count
- **Target:** 50-60 tests
- **Estimated Time:** 6-8 hours

### Quality Checks
- ✅ All functions tested
- ✅ Priority-based matching verified
- ✅ Backward compatibility tested
- ✅ Database mocking works correctly
- ✅ Error handling comprehensive
- ✅ Edge cases covered
- ✅ No flaky tests (deterministic)
- ✅ Fast execution (< 100ms per test)

## Theme Integration

While rule-matcher is primarily backend logic, we should verify:

- ✅ No hardcoded values that might affect UI display
- ✅ Action types are properly typed for UI consumption
- ✅ Error messages are clear and user-friendly

## Implementation Timeline

### Session 1 (2-3 hours)
- Task 1: Setup & Utilities (30 min)
- Task 2: parseRuleActions() Tests (45 min)
- Task 3: testRule() Function Tests (45 min)
- Task 4: testRuleOnMultiple() Tests (30 min)

### Session 2 (2-3 hours)
- Task 5: findMatchingRule() - Basic Matching (1 hour)
- Task 6: findMatchingRule() - Priority Matching (1 hour)
- Task 7: findMatchingRule() - Action Parsing (45 min)

### Session 3 (1-2 hours)
- Task 8: findAllMatchingRules() Tests (45 min)
- Task 9: Edge Cases & Error Handling (45 min)
- Final cleanup and coverage verification

**Total Estimated Time:** 6-8 hours

## Next Steps After Completion

Once rule-matcher tests are complete:

1. ✅ Verify 95%+ coverage for rule-matcher.ts
2. ✅ Run full test suite to ensure no regressions
3. ✅ Update `docs/features.md` with completion status
4. → Move to **Phase 8, Section 3: Actions Executor Tests** (~80 tests)

## Notes

- **Database Mocking:** Use vi.mock to mock the entire db module
- **No Real Database:** All tests should use mocked data, no real database queries
- **Deterministic:** Tests must be consistent and reproducible
- **Fast:** Target < 100ms per test, < 5s total for all rule-matcher tests
- **Isolated:** Each test should be independent, no shared state
- **Clear Failures:** Test failures should clearly indicate what broke

---

**Status:** Ready to implement - Start with Task 1
**Priority:** HIGH - Next in Phase 8 testing roadmap
**Dependencies:** None (condition-evaluator tests complete)
**Estimated Completion:** 1-2 days (6-8 hours of focused work)
