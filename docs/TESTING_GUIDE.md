# Unified Ledger - Testing Guide

Comprehensive testing guide for Phase 8: Testing & Quality Assurance

**Table of Contents**
1. [Overview](#overview)
2. [Testing Setup](#testing-setup)
3. [Running Tests](#running-tests)
4. [Test Organization](#test-organization)
5. [Writing Tests](#writing-tests)
6. [Test Utilities](#test-utilities)
7. [Coverage Goals](#coverage-goals)
8. [Common Patterns](#common-patterns)
9. [Best Practices](#best-practices)
10. [Troubleshooting](#troubleshooting)

---

## Overview

**Current Status:** Phase 1 - Infrastructure Setup Complete
**Test Framework:** Vitest 4.0.8
**Component Testing:** React Testing Library 16.3.0
**Coverage Target:** 80%+ overall, 100% for financial calculations

### Why Testing?

This is a **financial application** - incorrect calculations can:
- Lose user money
- Calculate taxes incorrectly
- Mistrack bills and payments
- Create data integrity issues

**Zero tolerance for bugs in:**
- Financial calculations (Decimal.js precision)
- Matching algorithms (bill detection, categorization)
- Data import pipelines (CSV correctness)
- Balance calculations (account synchronization)

---

## Testing Setup

### Infrastructure Files Created

1. **`vitest.config.ts`** - Test configuration
   - Environment: jsdom
   - Coverage: v8 provider
   - Thresholds: 80% overall, stricter for critical files
   - Setup: test-setup.ts

2. **`test-setup.ts`** - Global test utilities
   - Mock Next.js modules (navigation, headers, image)
   - Mock Clerk authentication
   - Mock window APIs (localStorage, matchMedia)
   - Test helper functions
   - Global cleanup

3. **`package.json` scripts**
   ```bash
   pnpm test              # Run all tests once
   pnpm test:watch       # Watch mode for development
   pnpm test:ui          # Visual test UI (useful during development)
   pnpm test:coverage    # Generate coverage reports
   ```

4. **Test Directory Structure**
   ```
   __tests__/
   ├── lib/              # Library utility tests
   ├── api/              # API route tests
   ├── components/       # React component tests
   ├── integration/      # Integration tests
   └── utils/            # Test utilities and helpers
   ```

---

## Running Tests

### Basic Commands

```bash
# Run all tests once (CI mode)
pnpm test

# Watch mode (develop with instant feedback)
pnpm test:watch

# Visual UI (useful for development and debugging)
pnpm test:ui

# Generate coverage report
pnpm test:coverage

# Run specific test file
pnpm test __tests__/lib/rules/condition-evaluator.test.ts

# Run tests matching pattern
pnpm test --grep "financial"

# Run with debugging
pnpm test --inspect-brk
```

### Coverage Reports

```bash
# Generate all coverage formats
pnpm test:coverage

# Output files created:
# - coverage/index.html    (visual report - open in browser)
# - coverage/coverage-final.json
# - coverage/lcov.info     (for CI/CD integration)
```

### CI Mode vs Watch Mode

**CI Mode (`pnpm test`):**
- Runs once and exits
- Doesn't watch for file changes
- Generates full coverage report
- Used in CI/CD pipelines

**Watch Mode (`pnpm test:watch`):**
- Re-runs affected tests on save
- Instant feedback during development
- Useful for TDD workflow
- Skip coverage calculation for speed

---

## Test Organization

### File Naming Convention

```
__tests__/
├── lib/
│   ├── rules/
│   │   ├── condition-evaluator.test.ts     # Tests for lib/rules/condition-evaluator.ts
│   │   └── rule-matcher.test.ts
│   ├── bills/
│   │   └── bill-matcher.test.ts
│   ├── transactions/
│   │   └── split-calculator.test.ts
│   └── [feature]/
│       └── [utility].test.ts
│
├── api/
│   ├── transactions.test.ts                 # Tests for app/api/transactions/*
│   ├── bills.test.ts
│   ├── reports.test.ts
│   └── [feature].test.ts
│
├── components/
│   ├── forms/
│   │   ├── transaction-form.test.tsx
│   │   └── rule-builder.test.tsx
│   ├── widgets/
│   │   └── bills-widget.test.tsx
│   └── [component].test.tsx
│
├── integration/
│   ├── transaction-flow.test.ts
│   ├── transfer-flow.test.ts
│   └── bill-detection-flow.test.ts
│
└── utils/
    └── test-helpers.ts                     # Shared test utilities
```

### Test File Structure

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("Feature Name", () => {
  // Setup - runs before each test
  beforeEach(() => {
    // Initialize test data
    // Mock dependencies
  });

  // Cleanup - runs after each test
  afterEach(() => {
    // Clear mocks
    // Clean up resources
  });

  describe("Specific Scenario", () => {
    it("should do something specific", () => {
      // Arrange - setup test data
      const input = { /* ... */ };

      // Act - perform the action
      const result = functionUnderTest(input);

      // Assert - verify the result
      expect(result).toEqual(expected);
    });

    it("should handle edge case", () => {
      // Test edge cases
    });
  });
});
```

---

## Writing Tests

### Testing Philosophy: Arrange-Act-Assert

Every test follows this pattern:

```typescript
it("should calculate split correctly", () => {
  // ARRANGE: Setup test data
  const transaction = createTestTransaction({
    amount: "100.00",
  });

  // ACT: Execute the function
  const result = calculateSplit(transaction, splits);

  // ASSERT: Verify results
  expect(result.total).toBe("100.00");
  expect(result.remaining).toBe("0.00");
});
```

### Test Types

#### 1. Unit Tests (Most Common)
Test individual functions in isolation

```typescript
describe("lib/rules/condition-evaluator.ts", () => {
  it("should evaluate 'contains' operator", () => {
    const condition = {
      field: "description",
      operator: "contains",
      value: "coffee",
    };

    expect(evaluateCondition(condition, "Coffee Shop")).toBe(true);
    expect(evaluateCondition(condition, "Grocery")).toBe(false);
  });
});
```

#### 2. Component Tests
Test React components with user interactions

```typescript
import { render, screen, fireEvent } from "@testing-library/react";

describe("TransactionForm", () => {
  it("should submit transaction with valid data", async () => {
    render(<TransactionForm onSubmit={vi.fn()} />);

    // User types in the form
    fireEvent.change(screen.getByLabelText(/amount/i), {
      target: { value: "100.00" },
    });

    // User submits
    fireEvent.click(screen.getByRole("button", { name: /submit/i }));

    // Verify submission
    expect(onSubmit).toHaveBeenCalled();
  });
});
```

#### 3. API Route Tests
Test API endpoints with mock database

```typescript
describe("POST /api/transactions", () => {
  it("should create transaction and update balance", async () => {
    const mockDb = vi.fn();

    const response = await POST(request, {
      params: { /* ... */ },
      db: mockDb,
    });

    expect(response.status).toBe(200);
    expect(mockDb).toHaveBeenCalled();
  });
});
```

#### 4. Integration Tests
Test complete user workflows

```typescript
describe("Transaction Creation Flow", () => {
  it("should create, categorize, and split transaction", async () => {
    // 1. Create transaction via API
    const tx = await createTransaction({...});

    // 2. Auto-categorize via rules
    const categorized = await categorizeTransaction(tx);

    // 3. Split transaction
    const split = await splitTransaction(categorized, splits);

    // 4. Verify all changes
    expect(split.category).toBe("expected");
    expect(split.splits).toHaveLength(2);
  });
});
```

---

## Test Utilities

### Global Test Helpers

Available in `test-setup.ts`:

```typescript
// Create test user
const user = createTestUser({
  email: "custom@example.com",
});

// Create test account
const account = createTestAccount({
  name: "Savings",
  balance: "5000.00",
});

// Create test transaction
const tx = createTestTransaction({
  amount: "100.00",
  category: "groceries",
});

// Create test budget
const budget = createTestBudget({
  category: "groceries",
  amount: "500.00",
});

// Create test rule
const rule = createTestRule({
  name: "Coffee Shops",
  conditions: { /* ... */ },
});
```

### Common Testing Patterns

#### Testing with Mocks

```typescript
import { vi } from "vitest";

// Mock a function
const mockDb = vi.fn();
mockDb.mockReturnValue({ id: "123" });

// Verify it was called
expect(mockDb).toHaveBeenCalled();
expect(mockDb).toHaveBeenCalledWith({ amount: "100" });

// Clear mock after test
vi.clearAllMocks();
```

#### Testing Async Functions

```typescript
it("should handle async operations", async () => {
  const result = await asyncFunction();
  expect(result).toBeDefined();
});
```

#### Testing Error Handling

```typescript
it("should throw error for invalid input", () => {
  expect(() => {
    functionThatThrows(null);
  }).toThrow("Invalid input");
});
```

#### Testing with Database

```typescript
// Mock the database
vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([testData]),
      }),
    }),
  },
}));
```

---

## Coverage Goals

### Coverage Thresholds by Module

**CRITICAL (100% required):**
- ✅ `lib/transactions/split-calculator.ts` - Money calculations
- ✅ `lib/tax/*.ts` - Tax calculations
- ✅ `lib/sales-tax/*.ts` - Sales tax calculations

**HIGH PRIORITY (95% required):**
- ✅ `lib/rules/condition-evaluator.ts` - Condition matching (14 operators)
- ✅ `lib/rules/rule-matcher.ts` - Rule priority matching
- ✅ `lib/bills/bill-matcher.ts` - Bill matching algorithm
- ✅ `lib/duplicate-detection.ts` - Duplicate detection

**IMPORTANT (90% required):**
- ✅ `lib/csv-import.ts` - CSV parsing and validation
- ✅ `lib/notifications/*.ts` - Notification generation
- ✅ `lib/offline/*.ts` - Offline sync

**STANDARD (80% required):**
- ✅ API routes (`app/api/*`)
- ✅ Components (`components/*`)

### Checking Coverage

```bash
# Generate coverage report
pnpm test:coverage

# View HTML report (opens in browser)
open coverage/index.html

# Check coverage for specific file
pnpm test:coverage -- lib/rules/condition-evaluator.ts
```

---

## Common Patterns

### Testing Decimal.js (Financial Calculations)

**Important:** Always use Decimal for money calculations!

```typescript
import Decimal from "decimal.js";

it("should calculate precise split amounts", () => {
  const amount = new Decimal("100.00");
  const splits = [
    new Decimal("33.33"),
    new Decimal("33.33"),
    new Decimal("33.34"),
  ];

  const total = splits.reduce((sum, s) => sum.plus(s), new Decimal("0"));
  expect(total.toString()).toBe("100.00"); // Exact match!
});
```

### Testing Rules Engine

```typescript
it("should match all condition operators", () => {
  const testCases = [
    { operator: "equals", value: "coffee", test: "coffee", expect: true },
    { operator: "contains", value: "coff", test: "coffee", expect: true },
    { operator: "starts_with", value: "cof", test: "coffee", expect: true },
    { operator: "ends_with", value: "ee", test: "coffee", expect: true },
    { operator: "greater_than", value: "100", test: "150", expect: true },
    { operator: "less_than", value: "100", test: "50", expect: true },
    { operator: "between", value: "50,150", test: "100", expect: true },
  ];

  testCases.forEach(({ operator, value, test, expect: expected }) => {
    const result = evaluateCondition({ operator, value }, test);
    expect(result).toBe(expected);
  });
});
```

### Testing CSV Import

```typescript
it("should parse and map CSV correctly", async () => {
  const csv = `Date,Description,Amount
2024-01-01,Coffee,5.00
2024-01-02,Gas,40.00`;

  const parsed = parseCSV(csv);
  expect(parsed).toHaveLength(2);
  expect(parsed[0].Description).toBe("Coffee");
});
```

---

## Best Practices

### ✅ DO:

1. **Test behavior, not implementation**
   ```typescript
   // Good - tests the behavior
   expect(result.amount).toBe("100.00");

   // Bad - tests internal implementation
   expect(obj.internalValue).toBe(100);
   ```

2. **Keep tests simple and focused**
   ```typescript
   // Good - one assertion per test
   it("should calculate tax correctly", () => {
     const tax = calculateTax(1000);
     expect(tax).toBe(150);
   });

   // Bad - multiple unrelated assertions
   it("should do everything", () => {
     expect(tax).toBe(150);
     expect(debt).toBe(100);
     expect(savings).toBe(50);
   });
   ```

3. **Use descriptive test names**
   ```typescript
   // Good - clear what's being tested
   it("should apply 15% tax rate to gross income over $40k", () => {});

   // Bad - vague name
   it("works", () => {});
   ```

4. **Test edge cases**
   ```typescript
   it("should handle edge cases", () => {
     expect(calculateSplit(0, [])).toBe("0.00");
     expect(calculateSplit("invalid", [])).toThrow();
     expect(calculateSplit(null, [])).toThrow();
   });
   ```

5. **Use test helpers for consistency**
   ```typescript
   const tx = createTestTransaction({ amount: "100" });
   // All test transactions are created consistently
   ```

### ❌ DON'T:

1. **Don't test external dependencies**
   ```typescript
   // Bad - testing Next.js, not your code
   it("useRouter works", () => {
     const router = useRouter();
     // ...
   });
   ```

2. **Don't rely on test execution order**
   ```typescript
   // Bad - test B depends on test A running first
   it("test A", () => { setupData(); });
   it("test B", () => { /* uses setupData */ });

   // Good - each test is independent
   beforeEach(() => { setupData(); });
   ```

3. **Don't create brittle assertions**
   ```typescript
   // Bad - too specific, will break on minor changes
   expect(obj).toEqual({ a: 1, b: 2, c: 3, d: 4 });

   // Good - only assert what matters
   expect(obj.a).toBe(1);
   expect(obj.b).toBe(2);
   ```

4. **Don't leave debugging code**
   ```typescript
   // Bad - console.log left behind
   console.log("DEBUG:", result);
   expect(result).toBe(value);

   // Good - clean code
   expect(result).toBe(value);
   ```

---

## Troubleshooting

### Common Issues

#### 1. "Cannot find module" errors

**Problem:** Tests can't find imports

**Solution:** Check path aliases in `vitest.config.ts`
```typescript
resolve: {
  alias: {
    "@": path.resolve(__dirname, "./"),
  },
}
```

#### 2. "Timer not found" errors

**Problem:** Async tests timing out

**Solution:** Increase timeout in vitest.config.ts
```typescript
test: {
  testTimeout: 10000,  // 10 seconds
}
```

#### 3. Mock not working

**Problem:** Mocked functions not being called

**Solution:** Ensure mock is set up before import
```typescript
// Correct - mock before import
vi.mock("@/lib/db");
import { db } from "@/lib/db";

// Incorrect - import before mock
import { db } from "@/lib/db";
vi.mock("@/lib/db");  // Too late!
```

#### 4. State bleeding between tests

**Problem:** Tests interfering with each other

**Solution:** Use `afterEach` to cleanup
```typescript
afterEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});
```

#### 5. Coverage not increasing

**Problem:** New tests not showing in coverage

**Solution:** Run `pnpm test:coverage` to regenerate

### Getting Help

1. **Check test output carefully** - Vitest provides detailed error messages
2. **Use `test:ui` for debugging** - Visual interface makes debugging easier
3. **Add `console.log` during development** - Fine during development, remove before committing
4. **Check the coverage report** - HTML report shows exactly what's not covered
5. **Read test patterns in this guide** - Most cases are covered above

---

## Summary

**Phase 1 Infrastructure Created:**
- ✅ vitest.config.ts configured
- ✅ test-setup.ts with mocks and helpers
- ✅ Test scripts added to package.json
- ✅ Test directory structure created
- ✅ Testing guide documentation complete

**Next Steps (Phase 2):**
1. Create financial calculation tests (split-calculator, transfers, taxes)
2. Test matching algorithms (rules, duplicates, bills)
3. Test CSV import pipeline
4. Test API routes
5. Test React components
6. Create integration tests
7. Setup CI/CD pipeline

**Remember:** This is a financial app - precision and correctness are paramount!

---

**Last Updated:** 2024-01-01
**Maintained By:** Unified Ledger Team
**Testing Framework:** Vitest 4.0.8
