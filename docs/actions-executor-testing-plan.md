# Actions Executor Testing - Implementation Plan

**Date Created:** 2025-11-10
**Status:** Planning
**Priority:** HIGH (95%+ coverage required)
**Depends On:** Condition Evaluator Tests ✅, Rule Matcher Tests ✅

## Overview

The Actions Executor is the core component responsible for executing rule actions on transactions. It takes matched rules and applies their actions (set category, modify description, set merchant, etc.), returning mutations to be applied to transactions. This testing plan ensures 95%+ coverage with comprehensive tests for all 9 action types, pattern variables, error handling, and multi-action scenarios.

## Component Under Test

**File:** `lib/rules/actions-executor.ts`

**Key Functions:**
1. `parseDescriptionPattern()` - Pattern variable substitution
2. `executeRuleActions()` - Main execution function
3. `validateActions()` - Validation without execution
4. `getActionDescription()` - Human-readable action descriptions
5. `isActionImplemented()` - Check if action is implemented

**Internal Functions:**
- `executeSetCategoryAction()`
- `executeSetMerchantAction()`
- `executeDescriptionAction()`
- `executeSetTaxDeductionAction()`
- `executeSetSalesTaxAction()`
- `executeSetAccountAction()`
- `executeCreateSplitAction()`
- `executeConvertToTransferAction()`
- `validateAction()`

## Action Types to Test

### Immediate Actions (Applied Directly)
1. **set_category** - Assigns transaction category
2. **set_merchant** - Assigns merchant to transaction
3. **set_description** - Replaces entire description with pattern
4. **prepend_description** - Adds text before description
5. **append_description** - Adds text after description
6. **set_tax_deduction** - Marks as tax deductible (if category allows)

### Post-Creation Actions (Stored in Mutations)
7. **convert_to_transfer** - Converts to transfer transaction
8. **create_split** - Creates transaction splits
9. **set_account** - Changes transaction account
10. **set_sales_tax** - Applies sales tax to income

## Testing Strategy

### Phase 1: Setup & Infrastructure (Task 1)
**Estimated Time:** 1 hour
**Lines of Code:** ~150 lines

Create test file and helper functions:
- Database mocking with vi.mock
- Test data factories (transactions, actions, categories, merchants)
- Assertion helpers
- Mock database responses

### Phase 2: Pattern Variable Substitution (Tasks 2-3)
**Estimated Time:** 2 hours
**Tests:** ~15 tests

Test `parseDescriptionPattern()` function:
- Single variable substitution
- Multiple variable combinations
- Missing variables (should replace with empty string)
- Edge cases (empty pattern, no variables, special characters)

### Phase 3: Category Actions (Task 4)
**Estimated Time:** 1.5 hours
**Tests:** ~10 tests

Test `set_category` action:
- Valid category assignment
- Category validation (exists and belongs to user)
- Invalid category ID
- Context update (category available for subsequent actions)
- Applied action structure

### Phase 4: Merchant Actions (Task 5)
**Estimated Time:** 1.5 hours
**Tests:** ~10 tests

Test `set_merchant` action:
- Valid merchant assignment
- Merchant validation (exists and belongs to user)
- Invalid merchant ID
- Context update (merchant available for subsequent actions)
- Applied action structure

### Phase 5: Description Actions (Task 6)
**Estimated Time:** 2.5 hours
**Tests:** ~18 tests

Test all three description modification actions:
- `set_description` - Complete replacement
- `prepend_description` - Add text before
- `append_description` - Add text after
- Pattern variable substitution in each action
- Multiple variables per pattern
- Context update (description available for subsequent actions)
- Chaining description actions

### Phase 6: Tax Deduction Actions (Task 7)
**Estimated Time:** 1.5 hours
**Tests:** ~8 tests

Test `set_tax_deduction` action:
- Category is tax deductible → mark transaction
- Category is NOT tax deductible → skip action
- No category assigned → skip action
- Category from previous action (set_category)
- Applied action structure

### Phase 7: Sales Tax Actions (Task 8)
**Estimated Time:** 2 hours
**Tests:** ~10 tests

Test `set_sales_tax` action:
- Valid sales tax configuration
- Income transactions only (skip expense/transfer)
- Invalid tax category ID
- Missing configuration
- Mutation structure (applySalesTax config)
- Applied action structure

### Phase 8: Account Change Actions (Task 9)
**Estimated Time:** 1.5 hours
**Tests:** ~8 tests

Test `set_account` action:
- Valid account ID
- Transfer validation (should reject transfer_in/transfer_out)
- Missing target account
- Mutation structure (changeAccount config)
- Applied action structure

### Phase 9: Split Transaction Actions (Task 10)
**Estimated Time:** 2 hours
**Tests:** ~12 tests

Test `create_split` action:
- Valid percentage splits
- Valid fixed amount splits
- Mixed splits (percentage + fixed)
- Total percentage validation (≤100%)
- At least one split required
- Missing configuration
- Mutation structure (createSplits array)
- Applied action structure

### Phase 10: Transfer Conversion Actions (Task 11)
**Estimated Time:** 2 hours
**Tests:** ~10 tests

Test `convert_to_transfer` action:
- Valid conversion configuration
- Already a transfer → skip action
- Default configuration values
- Custom configuration (tolerance, date range, etc.)
- Mutation structure (convertToTransfer config)
- Applied action structure

### Phase 11: Multiple Actions Execution (Task 12)
**Estimated Time:** 2 hours
**Tests:** ~12 tests

Test `executeRuleActions()` with multiple actions:
- Execute actions in sequence
- Context updates between actions
- Action dependencies (e.g., set_category before set_tax_deduction)
- Multiple description actions chaining
- Error in one action doesn't stop others
- Applied actions array

### Phase 12: Validation & Error Handling (Task 13)
**Estimated Time:** 2 hours
**Tests:** ~15 tests

Test validation and error scenarios:
- `validateActions()` function
- Missing required fields
- Invalid action types
- Database errors (category/merchant not found)
- Partial success (some actions fail, others succeed)
- Error messages format

### Phase 13: Utility Functions (Task 14)
**Estimated Time:** 1 hour
**Tests:** ~10 tests

Test utility functions:
- `getActionDescription()` - All action types
- `isActionImplemented()` - All action types
- Edge cases (unknown action types)

## Test File Structure

```
__tests__/lib/rules/actions-executor.test.ts

Sections:
├── Setup & Helper Functions
├── parseDescriptionPattern() Tests
├── set_category Action Tests
├── set_merchant Action Tests
├── Description Actions Tests (set/prepend/append)
├── set_tax_deduction Action Tests
├── set_sales_tax Action Tests
├── set_account Action Tests
├── create_split Action Tests
├── convert_to_transfer Action Tests
├── executeRuleActions() - Multiple Actions Tests
├── validateActions() Tests
├── Error Handling Tests
└── Utility Functions Tests
```

## Detailed Implementation Tasks

### Task 1: Setup & Infrastructure
**Priority:** P0 (Blocking)
**Time:** 1 hour

**Checklist:**
- [ ] Create test file: `__tests__/lib/rules/actions-executor.test.ts`
- [ ] Add imports (vitest, actions-executor, types)
- [ ] Mock database with vi.mock
- [ ] Create `mockDb()` helper with categories and merchants data
- [ ] Create `createTestTransaction()` factory
- [ ] Create `createTestAction()` factory
- [ ] Create `createTestCategory()` factory
- [ ] Create `createTestMerchant()` factory
- [ ] Create `mockDatabaseQuery()` helper for dynamic mocking
- [ ] Add assertion helpers for mutations and applied actions

**Mock Database Structure:**
```typescript
const mockCategories = [
  { id: 'cat-1', name: 'Groceries', type: 'expense', userId: 'user-1', isTaxDeductible: false },
  { id: 'cat-2', name: 'Business Expenses', type: 'expense', userId: 'user-1', isTaxDeductible: true },
  { id: 'cat-3', name: 'Salary', type: 'income', userId: 'user-1', isTaxDeductible: false },
];

const mockMerchants = [
  { id: 'merch-1', name: 'Whole Foods', userId: 'user-1' },
  { id: 'merch-2', name: 'Amazon', userId: 'user-1' },
];
```

---

### Task 2: Pattern Variable Substitution - Basic
**Priority:** P0 (Blocking for description actions)
**Time:** 1 hour
**Tests:** ~8 tests

**Test Cases:**
1. ✅ Replace {original} with current description
2. ✅ Replace {merchant} with merchant name
3. ✅ Replace {category} with category name
4. ✅ Replace {amount} with transaction amount
5. ✅ Replace {date} with transaction date
6. ✅ Handle missing merchant (replace with empty string)
7. ✅ Handle missing category (replace with empty string)
8. ✅ No variables in pattern (return as-is)

**Example Test:**
```typescript
describe("parseDescriptionPattern()", () => {
  it("should replace {original} with current description", () => {
    const context = {
      userId: "user-1",
      transaction: { description: "Coffee Shop", amount: 5.50, date: "2025-01-23", ... },
      merchant: null,
      category: null,
    };
    const result = parseDescriptionPattern("Purchase: {original}", context);
    expect(result).toBe("Purchase: Coffee Shop");
  });
});
```

---

### Task 3: Pattern Variable Substitution - Advanced
**Priority:** P1
**Time:** 1 hour
**Tests:** ~7 tests

**Test Cases:**
1. ✅ Multiple variables in single pattern
2. ✅ Same variable used multiple times
3. ✅ All variables in one pattern
4. ✅ Empty pattern string
5. ✅ Pattern with special characters
6. ✅ Large amounts (formatting)
7. ✅ Date formats

**Example Test:**
```typescript
it("should replace multiple variables in pattern", () => {
  const context = {
    userId: "user-1",
    transaction: { description: "Purchase", amount: 25.00, date: "2025-01-23", ... },
    merchant: { id: "merch-1", name: "Amazon" },
    category: { id: "cat-1", name: "Shopping", type: "expense" },
  };
  const result = parseDescriptionPattern(
    "{merchant} - {category} - ${amount} on {date}",
    context
  );
  expect(result).toBe("Amazon - Shopping - $25 on 2025-01-23");
});
```

---

### Task 4: set_category Action Tests
**Priority:** P0
**Time:** 1.5 hours
**Tests:** ~10 tests

**Test Cases:**
1. ✅ Set valid category ID
2. ✅ Category exists and belongs to user
3. ✅ Invalid category ID (not found)
4. ✅ Category belongs to different user (not found)
5. ✅ Missing category ID (validation error)
6. ✅ Mutations.categoryId is set correctly
7. ✅ Context.category is updated for subsequent actions
8. ✅ Applied action structure is correct
9. ✅ Original value captured (null if no previous category)
10. ✅ Original value captured (existing category ID)

**Example Test:**
```typescript
describe("set_category action", () => {
  it("should set valid category and update context", async () => {
    const action = { type: "set_category", value: "cat-1" };
    const transaction = createTestTransaction();

    const result = await executeRuleActions("user-1", [action], transaction);

    expect(result.mutations.categoryId).toBe("cat-1");
    expect(result.appliedActions).toHaveLength(1);
    expect(result.appliedActions[0]).toEqual({
      type: "set_category",
      field: "categoryId",
      originalValue: null,
      newValue: "cat-1",
    });
  });
});
```

---

### Task 5: set_merchant Action Tests
**Priority:** P0
**Time:** 1.5 hours
**Tests:** ~10 tests

**Test Cases:**
1. ✅ Set valid merchant ID
2. ✅ Merchant exists and belongs to user
3. ✅ Invalid merchant ID (not found)
4. ✅ Merchant belongs to different user (not found)
5. ✅ Missing merchant ID (validation error)
6. ✅ Mutations.merchantId is set correctly
7. ✅ Context.merchant is updated for subsequent actions
8. ✅ Applied action structure is correct
9. ✅ Original value captured (null if no previous merchant)
10. ✅ Original value captured (existing merchant ID)

---

### Task 6: Description Actions Tests
**Priority:** P0
**Time:** 2.5 hours
**Tests:** ~18 tests

**Test Cases:**

**set_description (6 tests):**
1. ✅ Replace entire description with static text
2. ✅ Replace with pattern containing variables
3. ✅ Missing pattern (validation error)
4. ✅ Context.transaction.description is updated
5. ✅ Applied action structure is correct
6. ✅ Original value is preserved

**prepend_description (6 tests):**
7. ✅ Prepend static text to description
8. ✅ Prepend pattern with variables
9. ✅ Missing pattern (validation error)
10. ✅ Context.transaction.description is updated
11. ✅ Applied action structure is correct
12. ✅ Original value is preserved

**append_description (6 tests):**
13. ✅ Append static text to description
14. ✅ Append pattern with variables
15. ✅ Missing pattern (validation error)
16. ✅ Context.transaction.description is updated
17. ✅ Applied action structure is correct
18. ✅ Original value is preserved

**Chaining (bonus):**
- Multiple description actions in sequence

**Example Test:**
```typescript
describe("prepend_description action", () => {
  it("should prepend text to description with variable substitution", async () => {
    const action = { type: "prepend_description", pattern: "[{merchant}] " };
    const transaction = createTestTransaction({ description: "Purchase" });
    const merchant = { id: "merch-1", name: "Amazon" };

    const result = await executeRuleActions("user-1", [action], transaction, merchant);

    expect(result.mutations.description).toBe("[Amazon] Purchase");
  });
});
```

---

### Task 7: set_tax_deduction Action Tests
**Priority:** P1
**Time:** 1.5 hours
**Tests:** ~8 tests

**Test Cases:**
1. ✅ Category is tax deductible → mark transaction
2. ✅ Category is NOT tax deductible → skip (return null)
3. ✅ No category assigned → skip (return null)
4. ✅ Category from previous set_category action
5. ✅ Category from transaction (existing)
6. ✅ Applied action structure is correct
7. ✅ Mutations.isTaxDeductible is set to true
8. ✅ Original value captured (false by default)

**Example Test:**
```typescript
describe("set_tax_deduction action", () => {
  it("should mark transaction as tax deductible when category allows", async () => {
    const actions = [
      { type: "set_category", value: "cat-2" }, // Business Expenses (tax deductible)
      { type: "set_tax_deduction" },
    ];
    const transaction = createTestTransaction();

    const result = await executeRuleActions("user-1", actions, transaction);

    expect(result.mutations.isTaxDeductible).toBe(true);
    expect(result.appliedActions).toHaveLength(2);
  });

  it("should skip action when category is not tax deductible", async () => {
    const actions = [
      { type: "set_category", value: "cat-1" }, // Groceries (not tax deductible)
      { type: "set_tax_deduction" },
    ];
    const transaction = createTestTransaction();

    const result = await executeRuleActions("user-1", actions, transaction);

    expect(result.mutations.isTaxDeductible).toBeUndefined();
    expect(result.appliedActions).toHaveLength(1); // Only set_category applied
  });
});
```

---

### Task 8: set_sales_tax Action Tests
**Priority:** P1
**Time:** 2 hours
**Tests:** ~10 tests

**Test Cases:**
1. ✅ Valid sales tax configuration (income transaction)
2. ✅ Income transaction only (skip expense)
3. ✅ Income transaction only (skip transfer)
4. ✅ Invalid tax category ID (validation error)
5. ✅ Missing config (validation error)
6. ✅ Missing taxCategoryId in config (validation error)
7. ✅ Mutations.applySalesTax is set correctly
8. ✅ Applied action structure is correct
9. ✅ Config structure (taxCategoryId, enabled)
10. ✅ Error handling (throws on invalid config)

**Example Test:**
```typescript
describe("set_sales_tax action", () => {
  it("should apply sales tax to income transaction", async () => {
    const action = {
      type: "set_sales_tax",
      config: { taxCategoryId: "tax-cat-1", enabled: true },
    };
    const transaction = createTestTransaction({ type: "income" });

    const result = await executeRuleActions("user-1", [action], transaction);

    expect(result.mutations.applySalesTax).toEqual({
      taxCategoryId: "tax-cat-1",
      enabled: true,
    });
  });

  it("should skip action for expense transaction", async () => {
    const action = {
      type: "set_sales_tax",
      config: { taxCategoryId: "tax-cat-1", enabled: true },
    };
    const transaction = createTestTransaction({ type: "expense" });

    const result = await executeRuleActions("user-1", [action], transaction);

    expect(result.mutations.applySalesTax).toBeUndefined();
    expect(result.appliedActions).toHaveLength(0);
  });
});
```

---

### Task 9: set_account Action Tests
**Priority:** P1
**Time:** 1.5 hours
**Tests:** ~8 tests

**Test Cases:**
1. ✅ Valid account ID (income transaction)
2. ✅ Valid account ID (expense transaction)
3. ✅ Transfer validation (reject transfer_out)
4. ✅ Transfer validation (reject transfer_in)
5. ✅ Missing target account ID (validation error)
6. ✅ Mutations.changeAccount is set correctly
7. ✅ Applied action structure is correct
8. ✅ Original account ID captured

**Example Test:**
```typescript
describe("set_account action", () => {
  it("should set account change configuration", async () => {
    const action = { type: "set_account", value: "account-2" };
    const transaction = createTestTransaction({ accountId: "account-1", type: "expense" });

    const result = await executeRuleActions("user-1", [action], transaction);

    expect(result.mutations.changeAccount).toEqual({
      targetAccountId: "account-2",
    });
    expect(result.appliedActions[0].originalValue).toBe("account-1");
  });

  it("should reject transfer transactions", async () => {
    const action = { type: "set_account", value: "account-2" };
    const transaction = createTestTransaction({ type: "transfer_out" });

    const result = await executeRuleActions("user-1", [action], transaction);

    expect(result.mutations.changeAccount).toBeUndefined();
    expect(result.appliedActions).toHaveLength(0);
  });
});
```

---

### Task 10: create_split Action Tests
**Priority:** P1
**Time:** 2 hours
**Tests:** ~12 tests

**Test Cases:**
1. ✅ Valid percentage splits (total = 100%)
2. ✅ Valid percentage splits (total < 100%)
3. ✅ Invalid percentage splits (total > 100%)
4. ✅ Valid fixed amount splits
5. ✅ Mixed splits (percentage + fixed)
6. ✅ At least one split required
7. ✅ Missing splits array (validation error)
8. ✅ Empty splits array (validation error)
9. ✅ Mutations.createSplits is set correctly
10. ✅ Applied action structure is correct
11. ✅ Split configuration structure
12. ✅ Optional description per split

**Example Test:**
```typescript
describe("create_split action", () => {
  it("should create valid percentage splits", async () => {
    const action = {
      type: "create_split",
      config: {
        splits: [
          { categoryId: "cat-1", percentage: 60, isPercentage: true },
          { categoryId: "cat-2", percentage: 40, isPercentage: true },
        ],
      },
    };
    const transaction = createTestTransaction({ amount: 100 });

    const result = await executeRuleActions("user-1", [action], transaction);

    expect(result.mutations.createSplits).toHaveLength(2);
    expect(result.appliedActions).toHaveLength(1);
  });

  it("should reject splits with total > 100%", async () => {
    const action = {
      type: "create_split",
      config: {
        splits: [
          { categoryId: "cat-1", percentage: 60, isPercentage: true },
          { categoryId: "cat-2", percentage: 50, isPercentage: true }, // Total = 110%
        ],
      },
    };
    const transaction = createTestTransaction();

    const result = await executeRuleActions("user-1", [action], transaction);

    expect(result.mutations.createSplits).toBeUndefined();
    expect(result.appliedActions).toHaveLength(0);
  });
});
```

---

### Task 11: convert_to_transfer Action Tests
**Priority:** P1
**Time:** 2 hours
**Tests:** ~10 tests

**Test Cases:**
1. ✅ Valid conversion with target account
2. ✅ Valid conversion without target account (auto-detect)
3. ✅ Already transfer_out → skip action
4. ✅ Already transfer_in → skip action
5. ✅ Default configuration values
6. ✅ Custom configuration (tolerance, date range)
7. ✅ Mutations.convertToTransfer is set correctly
8. ✅ Applied action structure is correct
9. ✅ Config structure (all fields)
10. ✅ Original transaction type captured

**Example Test:**
```typescript
describe("convert_to_transfer action", () => {
  it("should set transfer conversion config with defaults", async () => {
    const action = {
      type: "convert_to_transfer",
      config: { targetAccountId: "account-2" },
    };
    const transaction = createTestTransaction({ type: "expense" });

    const result = await executeRuleActions("user-1", [action], transaction);

    expect(result.mutations.convertToTransfer).toEqual({
      targetAccountId: "account-2",
      autoMatch: true,
      matchTolerance: 1,
      matchDayRange: 7,
      createIfNoMatch: true,
    });
  });

  it("should skip action for transfer transactions", async () => {
    const action = { type: "convert_to_transfer", config: {} };
    const transaction = createTestTransaction({ type: "transfer_out" });

    const result = await executeRuleActions("user-1", [action], transaction);

    expect(result.mutations.convertToTransfer).toBeUndefined();
  });
});
```

---

### Task 12: Multiple Actions Execution Tests
**Priority:** P0
**Time:** 2 hours
**Tests:** ~12 tests

**Test Cases:**
1. ✅ Execute 2 actions in sequence
2. ✅ Execute 3+ actions in sequence
3. ✅ Context updates between actions
4. ✅ set_category then set_tax_deduction (dependency)
5. ✅ set_merchant then description with {merchant}
6. ✅ Multiple description actions (chaining)
7. ✅ Mix of immediate and post-creation actions
8. ✅ Applied actions array in correct order
9. ✅ Partial success (one action fails, others succeed)
10. ✅ Error in middle doesn't stop subsequent actions
11. ✅ All mutations collected correctly
12. ✅ Empty actions array

**Example Test:**
```typescript
describe("executeRuleActions() - multiple actions", () => {
  it("should execute multiple actions in sequence with context updates", async () => {
    const actions = [
      { type: "set_category", value: "cat-1" },
      { type: "set_merchant", value: "merch-1" },
      { type: "prepend_description", pattern: "[{merchant}] " },
      { type: "append_description", pattern: " - {category}" },
    ];
    const transaction = createTestTransaction({ description: "Purchase" });

    const result = await executeRuleActions("user-1", actions, transaction);

    expect(result.mutations.categoryId).toBe("cat-1");
    expect(result.mutations.merchantId).toBe("merch-1");
    expect(result.mutations.description).toBe("[Whole Foods] Purchase - Groceries");
    expect(result.appliedActions).toHaveLength(4);
  });
});
```

---

### Task 13: Validation & Error Handling Tests
**Priority:** P0
**Time:** 2 hours
**Tests:** ~15 tests

**Test Cases:**

**validateActions() function (8 tests):**
1. ✅ Valid actions array (no errors)
2. ✅ Missing action type
3. ✅ Missing required value (set_category, set_merchant)
4. ✅ Missing required pattern (description actions)
5. ✅ Missing required config (create_split, set_sales_tax)
6. ✅ Invalid action type
7. ✅ Multiple validation errors
8. ✅ Empty actions array

**Error handling in execution (7 tests):**
9. ✅ Database error (category not found)
10. ✅ Database error (merchant not found)
11. ✅ Invalid configuration (split total > 100%)
12. ✅ Errors array populated with messages
13. ✅ Error format includes action index
14. ✅ Non-fatal errors (continue with other actions)
15. ✅ Fatal errors (throw exception)

**Example Test:**
```typescript
describe("validateActions()", () => {
  it("should return validation errors for invalid actions", () => {
    const actions = [
      { type: "set_category" }, // Missing value
      { type: "prepend_description" }, // Missing pattern
      { type: "unknown_action" }, // Invalid type
    ];

    const errors = validateActions(actions);

    expect(errors).toHaveLength(3);
    expect(errors[0]).toContain("Action 1");
    expect(errors[1]).toContain("Action 2");
    expect(errors[2]).toContain("Action 3");
  });
});
```

---

### Task 14: Utility Functions Tests
**Priority:** P2
**Time:** 1 hour
**Tests:** ~10 tests

**Test Cases:**

**getActionDescription() (9 tests):**
1. ✅ set_category description
2. ✅ set_merchant description
3. ✅ set_description description
4. ✅ prepend_description description
5. ✅ append_description description
6. ✅ set_tax_deduction description
7. ✅ set_sales_tax description
8. ✅ convert_to_transfer description
9. ✅ create_split description
10. ✅ Unknown action type

**isActionImplemented() (test coverage in other tests):**

**Example Test:**
```typescript
describe("utility functions", () => {
  describe("getActionDescription()", () => {
    it("should return description for set_category", () => {
      const action = { type: "set_category", value: "cat-1" };
      const description = getActionDescription(action);
      expect(description).toBe("Set category to cat-1");
    });
  });
});
```

---

## Database Mocking Strategy

### Mock Setup
```typescript
import { vi } from 'vitest';

// Mock the database module
vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(),
    from: vi.fn(),
  },
}));

// Mock categories and merchants
const mockCategories = [
  { id: 'cat-1', name: 'Groceries', type: 'expense', userId: 'user-1', isTaxDeductible: false },
  { id: 'cat-2', name: 'Business Expenses', type: 'expense', userId: 'user-1', isTaxDeductible: true },
];

const mockMerchants = [
  { id: 'merch-1', name: 'Whole Foods', userId: 'user-1' },
  { id: 'merch-2', name: 'Amazon', userId: 'user-1' },
];

// Helper to setup database query responses
function setupDbMock() {
  const { db } = require('@/lib/db');

  db.select.mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockImplementation((condition) => {
        // Parse condition and return appropriate mock data
        return {
          limit: vi.fn().mockResolvedValue([/* mock data */]),
        };
      }),
    }),
  });
}
```

## Success Metrics

### Coverage Target
- **actions-executor.ts:** 95%+ line coverage
- **All 9 action types:** 100% tested
- **Pattern variables:** 100% tested
- **Error paths:** 90%+ tested

### Test Quality
- **Fast:** All tests complete in < 3 seconds
- **Isolated:** No test dependencies
- **Deterministic:** No flaky tests
- **Clear:** Descriptive test names and assertions

### Implementation Completeness
- **Total Tests:** ~138 tests
- **Test Categories:** 14 categories
- **Edge Cases:** 20+ edge cases covered
- **Error Scenarios:** 15+ error scenarios tested

## Timeline

**Total Time:** ~20 hours
**Tests Created:** ~138 tests
**Test File:** 1 file (~1,500 lines)

### Day 1 (8 hours)
- **Morning (4h):** Tasks 1-3 (Setup + Pattern Variables)
- **Afternoon (4h):** Tasks 4-5 (Category + Merchant Actions)

### Day 2 (8 hours)
- **Morning (4h):** Tasks 6-7 (Description + Tax Deduction Actions)
- **Afternoon (4h):** Tasks 8-9 (Sales Tax + Account Actions)

### Day 3 (4 hours)
- **Morning (4h):** Tasks 10-11 (Split + Transfer Actions)

### Day 4 (4 hours) - Optional Polish
- **Morning (2h):** Task 12 (Multiple Actions)
- **Afternoon (2h):** Tasks 13-14 (Validation + Utilities)

## Notes & Best Practices

### Financial Precision
- All amount comparisons must account for Decimal.js usage
- Mock amounts as numbers (executor converts to strings for pattern variables)

### Database Mocking
- Mock at module level, not implementation level
- Use vi.fn() for chainable query methods
- Return promises for async database operations

### Test Organization
- Group tests by action type
- Use descriptive test names (should...)
- Include setup comments for complex scenarios

### Error Testing
- Test both validation errors and execution errors
- Verify error messages are helpful
- Ensure non-fatal errors don't stop execution

## Expected Outcomes

After completing this plan:

1. **95%+ coverage** of actions-executor.ts
2. **138+ tests** covering all action types
3. **Comprehensive edge case testing**
4. **Clear error handling verification**
5. **Pattern variable substitution fully tested**
6. **Multi-action execution verified**
7. **Ready for integration testing** (Phase 4)

---

**Status:** Ready to implement starting with Task 1
**Next Phase:** Integration Tests (Phase 4)
