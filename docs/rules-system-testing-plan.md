# Rules System Testing - Implementation Plan

**Date Created:** 2025-11-10
**Status:** Planning
**Priority:** HIGH (95% coverage required)

## Overview

The Rules System is a critical component that handles auto-categorization of transactions based on complex condition matching. It supports 14 operators, 8 fields, recursive AND/OR groups, and priority-based matching with 11 action types. This testing plan ensures 95%+ coverage with comprehensive tests for all operators, edge cases, and integration scenarios.

## Components to Test

### 1. **lib/rules/condition-evaluator.ts** (HIGH PRIORITY)
- **Purpose:** Evaluates individual conditions using 14 operators
- **Complexity:** 14 operators × 8 fields = 112+ combinations
- **Operators to Test:**
  - `equals`, `not_equals`
  - `contains`, `not_contains`
  - `starts_with`, `ends_with`
  - `greater_than`, `less_than`, `between`
  - `regex`
  - `in_list`
  - `matches_day`, `matches_weekday`, `matches_month`

### 2. **lib/rules/rule-matcher.ts** (HIGH PRIORITY)
- **Purpose:** Matches rules against transactions with priority ordering
- **Features:**
  - Priority-based matching (lower number = higher priority)
  - First matching rule applies
  - AND/OR group recursion
  - Returns actions array for matched rule

### 3. **lib/rules/actions-executor.ts** (HIGH PRIORITY)
- **Purpose:** Executes multiple actions on transactions
- **Actions to Test:**
  - `set_category`
  - `set_description`, `prepend_description`, `append_description`
  - `set_merchant`
  - `set_tax_deduction`
  - `convert_to_transfer`
  - `create_split`
  - `set_account`
  - `set_sales_tax`
  - Pattern variables: {original}, {merchant}, {category}, {amount}, {date}

### 4. **Integration Tests**
- **Scenarios:**
  - Complete rule matching → action execution flow
  - Multiple rules with priorities
  - Complex AND/OR condition groups
  - Edge cases (empty rules, no matches, etc.)

## Testing Strategy

### Phase 1: Condition Evaluator Tests (Days 1-2)
**Target Coverage:** 100%
**Test Count:** ~140+ tests

#### Task 1.1: String Operators (20 tests)
- `equals` and `not_equals` (case-sensitive and case-insensitive)
- `contains` and `not_contains`
- `starts_with` and `ends_with`
- Edge cases: empty strings, special characters, null/undefined

#### Task 1.2: Numeric Operators (15 tests)
- `greater_than` and `less_than`
- `between` (inclusive ranges)
- Edge cases: zero, negative numbers, decimals, infinity

#### Task 1.3: Date Operators (20 tests)
- `matches_day` (1-31)
- `matches_weekday` (0-6, Sunday=0)
- `matches_month` (1-12)
- Edge cases: invalid dates, leap years, month boundaries

#### Task 1.4: Advanced Operators (20 tests)
- `regex` (pattern matching)
- `in_list` (comma-separated values)
- Edge cases: invalid regex, empty lists, whitespace

#### Task 1.5: Field Evaluation (15 tests)
- Test all 8 fields: description, amount, account_name, date, day_of_month, weekday, month, notes
- Field extraction from transaction objects
- Missing/null field handling

#### Task 1.6: Edge Cases & Error Handling (10 tests)
- Invalid operators
- Missing values
- Type mismatches
- Null/undefined conditions

### Phase 2: Rule Matcher Tests (Days 3-4)
**Target Coverage:** 95%+
**Test Count:** ~50+ tests

#### Task 2.1: Basic Rule Matching (10 tests)
- Single condition matches
- Single condition doesn't match
- Multiple conditions with AND logic
- Multiple conditions with OR logic

#### Task 2.2: Priority-Based Matching (10 tests)
- Rules with different priorities
- First matching rule applies (not all rules)
- Higher priority rule matches before lower priority
- Same priority behavior

#### Task 2.3: Recursive AND/OR Groups (15 tests)
- Nested condition groups
- AND within OR groups
- OR within AND groups
- Deep nesting (3+ levels)
- Empty groups

#### Task 2.4: Transaction Field Matching (10 tests)
- Match on different transaction fields
- Complex field combinations
- Date-based matching
- Amount-based matching

#### Task 2.5: Edge Cases (5 tests)
- No rules defined
- No matching rules
- All rules disabled
- Invalid rule structure
- Missing transaction fields

### Phase 3: Actions Executor Tests (Days 5-6)
**Target Coverage:** 95%+
**Test Count:** ~80+ tests

#### Task 3.1: Category Actions (8 tests)
- `set_category` - Basic assignment
- Category validation
- Null/invalid category handling

#### Task 3.2: Description Actions (15 tests)
- `set_description` - Replace entire description
- `prepend_description` - Add text before
- `append_description` - Add text after
- Pattern variable substitution:
  - {original} - Original description
  - {merchant} - Merchant name
  - {category} - Category name
  - {amount} - Transaction amount
  - {date} - Transaction date
- Multiple variable combinations
- Missing variable handling

#### Task 3.3: Merchant Actions (5 tests)
- `set_merchant` - Assign merchant
- Merchant validation
- Null/invalid merchant handling

#### Task 3.4: Tax Deduction Actions (5 tests)
- `set_tax_deduction` - Mark as tax deductible
- Category tax configuration integration
- Edge cases

#### Task 3.5: Transfer Actions (12 tests)
- `convert_to_transfer` - Create transfer pairs
- Auto-match existing transactions
- Amount tolerance (0-10%)
- Date range matching (1-30 days)
- Create new transfer pair
- Account balance updates
- Edge cases: no match, multiple matches

#### Task 3.6: Split Actions (15 tests)
- `create_split` - Create transaction splits
- Percentage-based splits
- Fixed amount splits
- Split validation (sum = 100% or transaction amount)
- Category assignment per split
- Edge cases: empty splits, invalid totals

#### Task 3.7: Account Actions (8 tests)
- `set_account` - Move transaction to different account
- Balance updates (old and new accounts)
- Transfer transaction validation (should reject)
- Edge cases

#### Task 3.8: Sales Tax Actions (8 tests)
- `set_sales_tax` - Apply sales tax
- Tax rate validation
- Income transaction only
- Integration with sales tax categories

#### Task 3.9: Multiple Actions (4 tests)
- Execute multiple actions in sequence
- Action order dependency
- Combined action validation
- Rollback on error

### Phase 4: Integration Tests (Day 7)
**Target Coverage:** 90%+
**Test Count:** ~30+ tests

#### Task 4.1: Complete Rule Flow (10 tests)
- Transaction → Rule Match → Actions → Result
- Multi-step workflows
- Real-world scenarios

#### Task 4.2: Transaction Creation Integration (5 tests)
- Rules applied during transaction creation
- API integration
- Database persistence

#### Task 4.3: Bulk Apply Rules (5 tests)
- Apply rules to multiple transactions
- Performance with large batches
- Error handling

#### Task 4.4: Rule Execution Logging (5 tests)
- Audit trail creation
- Applied actions tracking
- Rule execution history

#### Task 4.5: Edge Case Scenarios (5 tests)
- Complex real-world use cases
- Error recovery
- Race conditions
- Data consistency

## Test File Structure

```
__tests__/
├── lib/
│   ├── rules/
│   │   ├── condition-evaluator.test.ts       (Phase 1: ~140 tests)
│   │   ├── rule-matcher.test.ts              (Phase 2: ~50 tests)
│   │   ├── actions-executor.test.ts          (Phase 3: ~80 tests)
│   │   ├── transfer-action-handler.test.ts   (Transfer-specific)
│   │   ├── split-action-handler.test.ts      (Split-specific)
│   │   └── account-action-handler.test.ts    (Account-specific)
│   └── ...
├── integration/
│   ├── rules-flow.test.ts                    (Phase 4: ~30 tests)
│   └── ...
└── ...
```

## Theme Integration in Tests

All tests should verify theme-aware functionality where applicable:

- **CSS Variables:** Ensure no hardcoded colors in rule-related components
- **Theme Context:** Test components with both Dark Mode and Dark Pink Theme
- **Color Indicators:** Verify semantic color usage (success, warning, error)

## Success Metrics

### Coverage Targets
- **condition-evaluator.ts:** 100% coverage
- **rule-matcher.ts:** 95%+ coverage
- **actions-executor.ts:** 95%+ coverage
- **Integration tests:** 90%+ coverage

### Quality Metrics
- **All 14 operators tested:** ✓
- **All 11 action types tested:** ✓
- **All 8 fields tested:** ✓
- **Pattern variables tested:** ✓
- **Edge cases covered:** ✓
- **Error handling verified:** ✓

### Test Characteristics
- **Fast:** Each test < 100ms
- **Isolated:** No test dependencies
- **Deterministic:** Same input = same output
- **Readable:** Clear test names and assertions

## Implementation Order

### Day 1: Setup & String Operators
1. Create test file structure
2. Add test utilities for rules
3. Implement Task 1.1 (String operators)
4. Implement Task 1.2 (Numeric operators)

### Day 2: Date & Advanced Operators
5. Implement Task 1.3 (Date operators)
6. Implement Task 1.4 (Advanced operators)
7. Implement Task 1.5 (Field evaluation)
8. Implement Task 1.6 (Edge cases)

### Day 3: Rule Matcher - Part 1
9. Implement Task 2.1 (Basic matching)
10. Implement Task 2.2 (Priority-based)
11. Implement Task 2.3 (Recursive groups)

### Day 4: Rule Matcher - Part 2
12. Implement Task 2.4 (Transaction fields)
13. Implement Task 2.5 (Edge cases)

### Day 5: Actions Executor - Part 1
14. Implement Task 3.1 (Category actions)
15. Implement Task 3.2 (Description actions)
16. Implement Task 3.3 (Merchant actions)
17. Implement Task 3.4 (Tax deduction actions)

### Day 6: Actions Executor - Part 2
18. Implement Task 3.5 (Transfer actions)
19. Implement Task 3.6 (Split actions)
20. Implement Task 3.7 (Account actions)
21. Implement Task 3.8 (Sales tax actions)
22. Implement Task 3.9 (Multiple actions)

### Day 7: Integration Tests
23. Implement Task 4.1 (Complete flow)
24. Implement Task 4.2 (Transaction creation)
25. Implement Task 4.3 (Bulk apply)
26. Implement Task 4.4 (Execution logging)
27. Implement Task 4.5 (Edge cases)

## Test Utilities to Create

### Helper Functions
```typescript
// Create test rule with conditions
createTestRule(conditions, actions, priority)

// Create test condition
createTestCondition(field, operator, value)

// Create test action
createTestAction(type, config)

// Create test transaction
createTestTransaction(overrides)

// Mock database functions
mockDb()

// Mock accounts, categories, merchants
mockAccounts()
mockCategories()
mockMerchants()
```

### Assertion Helpers
```typescript
// Verify rule matched
expectRuleMatched(rule, transaction)

// Verify actions executed
expectActionsExecuted(actions, mutations)

// Verify audit log
expectAuditLogged(ruleId, transactionId)
```

## Dependencies & Mocks

### External Dependencies to Mock
- **Database (Drizzle ORM):** Mock all queries
- **Clerk Auth:** Mock user context
- **API Routes:** Mock HTTP requests

### Internal Dependencies
- **Decimal.js:** Use actual library (no mock needed)
- **fastest-levenshtein:** Use actual library for transfer matching
- **Date utilities:** Use actual Date objects

## Expected Outcomes

After completing this plan:

1. **Rules System: 95%+ coverage** across all components
2. **300+ tests** covering all scenarios
3. **CI/CD integration** with coverage reporting
4. **Regression protection** for future changes
5. **Documentation** of all operators and actions
6. **Confidence** in deploying rules system updates

## Notes

- **Financial Precision:** All amount calculations must use Decimal.js
- **No Flaky Tests:** Each test must be deterministic
- **Fast Execution:** Full test suite should run in < 5 seconds
- **Clear Failures:** Test failures must clearly indicate what broke
- **Maintainable:** Tests should be easy to update when features change

## Future Enhancements

After completing this plan:

- **Performance Tests:** Benchmark rule matching speed with large datasets
- **Load Tests:** Test with 1000+ rules and 10000+ transactions
- **Visual Regression Tests:** Test rule builder UI components
- **E2E Tests:** Test rule creation through the UI with Playwright/Cypress
- **Mutation Tests:** Verify tests catch actual bugs (Stryker)

---

**Total Estimated Time:** 7 days
**Total Tests Created:** ~300+
**Coverage Target:** 95%+ overall
**Status:** Ready to implement starting with Task 1.1
