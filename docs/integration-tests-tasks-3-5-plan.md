# Integration Tests - Tasks 3-5 Completion Plan

**Date Created:** 2025-11-10
**Status:** Planning
**Priority:** HIGH (Complete final 50% of integration tests)
**Target Coverage:** Complete 15 remaining tests (Tasks 3-5)
**Estimated Time:** 4-6 hours

## Overview

Complete the remaining integration tests for the Rules System. Tasks 1-2 are complete (15 tests, 50%). This plan covers Tasks 3-5 to achieve 100% integration test coverage.

**Completed:**
- ✅ Task 1: Complete Rule Flow Tests (10 tests) - COMPLETE
- ✅ Task 2: Transaction Creation API Integration (5 tests) - COMPLETE

**Remaining:**
- ⏳ Task 3: Bulk Apply Rules API Integration (5 tests) - **THIS PLAN**
- ⏳ Task 4: Post-Creation Action Handlers (7 tests) - **THIS PLAN**
- ⏳ Task 5: Rule Execution Logging (3 tests) - **THIS PLAN**

## Implementation Strategy

### Approach
1. **Reuse Existing Test Infrastructure**: Use `test-utils.ts` data factories and assertion helpers
2. **Follow Established Patterns**: Match structure from completed tests
3. **Database Integration**: Real database operations with proper cleanup
4. **Sequential Implementation**: Complete one task at a time
5. **Verification**: Run tests after each task to ensure they pass

### Theme Integration
While integration tests focus on backend logic, we ensure:
- No hardcoded colors in test data (use existing theme-aware factories)
- Test data uses standard category colors from theme system
- UI-related assertions (if any) use CSS variable patterns

---

## Task 3: Bulk Apply Rules API Integration (5 tests)

**File:** `__tests__/integration/bulk-apply-rules.test.ts`
**Focus:** POST /api/rules/apply-bulk functionality
**Estimated Time:** 1.5-2 hours

### Test File Structure

```typescript
/**
 * Integration Tests: Bulk Apply Rules API
 *
 * Tests bulk rule application via POST /api/rules/apply-bulk
 *
 * Coverage:
 * - Bulk apply to uncategorized transactions
 * - Date range filtering
 * - Specific rule ID application
 * - Pagination with limit parameter
 * - Error handling and partial success
 *
 * Target: 5 tests covering bulk apply API integration
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { db } from "@/lib/db";
import {
  transactions,
  accounts,
  budgetCategories,
  ruleExecutionLog,
  categorizationRules,
} from "@/lib/db/schema";
import { eq, and, gte, lte } from "drizzle-orm";
import {
  generateTestUserId,
  createTestAccount,
  createTestCategory,
  createTestTransaction,
  createTestRule,
  createTestCondition,
  createTestAction,
} from "./test-utils";

describe("Integration: Bulk Apply Rules API", () => {
  let testUserId: string;
  let testAccountId: string;
  let testCategoryId1: string;
  let testCategoryId2: string;

  beforeEach(async () => {
    // Setup test data
  });

  afterEach(async () => {
    // Cleanup
  });

  // Tests here...
});
```

### Test 1: Bulk Apply to Uncategorized Transactions

**Scenario:** Create 10 uncategorized transactions, 1 rule matches 5 of them
**Expected:** 5 transactions updated, 5 unchanged, correct result summary

```typescript
it("should apply rule to matching uncategorized transactions", async () => {
  // 1. Create test category
  const categoryData = createTestCategory(testUserId, {
    name: "Groceries",
    type: "expense",
  });
  const [category] = await db.insert(budgetCategories).values(categoryData).returning();
  testCategoryId1 = category.id;

  // 2. Create rule: If description contains "Store" → set category
  const condition = createTestCondition("description", "contains", "Store");
  const action = createTestAction("set_category", { categoryId: testCategoryId1 });
  const ruleData = createTestRule(testUserId, [condition], [action], {
    name: "Grocery Store Rule",
    priority: 1,
  });
  const [rule] = await db.insert(categorizationRules).values(ruleData).returning();

  // 3. Create 10 transactions: 5 match "Store", 5 don't match
  const transactionIds: string[] = [];
  for (let i = 0; i < 5; i++) {
    const txnData = createTestTransaction(testUserId, testAccountId, {
      description: `Grocery Store Purchase ${i + 1}`,
      amount: 50.00,
      categoryId: null, // Uncategorized
    });
    const [txn] = await db.insert(transactions).values(txnData).returning();
    transactionIds.push(txn.id);
  }
  for (let i = 0; i < 5; i++) {
    const txnData = createTestTransaction(testUserId, testAccountId, {
      description: `Gas Station Purchase ${i + 1}`,
      amount: 40.00,
      categoryId: null, // Uncategorized
    });
    const [txn] = await db.insert(transactions).values(txnData).returning();
    transactionIds.push(txn.id);
  }

  // 4. Import and call applyRulesToTransactions (internal function from API)
  // Note: We'll need to import the actual implementation or simulate API call
  const { applyRulesToTransactions } = await import("@/app/api/rules/apply-bulk/route");

  const result = await applyRulesToTransactions(testUserId, {
    limit: 100, // Process all
  });

  // 5. Verify result summary
  expect(result.totalProcessed).toBe(10);
  expect(result.totalUpdated).toBe(5); // Only "Store" transactions
  expect(result.errors).toHaveLength(0);
  expect(result.appliedRules).toHaveLength(5);

  // 6. Verify database: 5 transactions have category, 5 don't
  const updatedTransactions = await db
    .select()
    .from(transactions)
    .where(eq(transactions.userId, testUserId));

  const categorized = updatedTransactions.filter(t => t.categoryId === testCategoryId1);
  const uncategorized = updatedTransactions.filter(t => t.categoryId === null);

  expect(categorized).toHaveLength(5);
  expect(uncategorized).toHaveLength(5);

  // Verify only "Store" transactions were categorized
  categorized.forEach(txn => {
    expect(txn.description).toContain("Store");
  });

  // 7. Verify audit log created for each updated transaction
  const logEntries = await db
    .select()
    .from(ruleExecutionLog)
    .where(eq(ruleExecutionLog.userId, testUserId));

  expect(logEntries).toHaveLength(5);
  logEntries.forEach(log => {
    expect(log.ruleId).toBe(rule.id);
    expect(log.matched).toBe(true);
    expect(log.appliedCategoryId).toBe(testCategoryId1);
  });
});
```

### Test 2: Bulk Apply with Date Range Filter

**Scenario:** 20 transactions across 3 months, bulk apply with date range
**Expected:** Only transactions in range processed

```typescript
it("should only apply rules to transactions within date range", async () => {
  // 1. Create test category
  const categoryData = createTestCategory(testUserId, {
    name: "Utilities",
    type: "expense",
  });
  const [category] = await db.insert(budgetCategories).values(categoryData).returning();
  testCategoryId1 = category.id;

  // 2. Create rule: If description contains "Electric" → set category
  const condition = createTestCondition("description", "contains", "Electric");
  const action = createTestAction("set_category", { categoryId: testCategoryId1 });
  const ruleData = createTestRule(testUserId, [condition], [action]);
  await db.insert(categorizationRules).values(ruleData);

  // 3. Create 20 transactions across 3 months (all match "Electric")
  // Month 1 (January): 5 transactions
  for (let i = 1; i <= 5; i++) {
    const txnData = createTestTransaction(testUserId, testAccountId, {
      description: "Electric Company",
      amount: 100.00,
      date: `2025-01-${String(i).padStart(2, '0')}`,
      categoryId: null,
    });
    await db.insert(transactions).values(txnData);
  }

  // Month 2 (February): 10 transactions - TARGET RANGE
  for (let i = 1; i <= 10; i++) {
    const txnData = createTestTransaction(testUserId, testAccountId, {
      description: "Electric Company",
      amount: 100.00,
      date: `2025-02-${String(i).padStart(2, '0')}`,
      categoryId: null,
    });
    await db.insert(transactions).values(txnData);
  }

  // Month 3 (March): 5 transactions
  for (let i = 1; i <= 5; i++) {
    const txnData = createTestTransaction(testUserId, testAccountId, {
      description: "Electric Company",
      amount: 100.00,
      date: `2025-03-${String(i).padStart(2, '0')}`,
      categoryId: null,
    });
    await db.insert(transactions).values(txnData);
  }

  // 4. Bulk apply with date range filter (February only)
  const { applyRulesToTransactions } = await import("@/app/api/rules/apply-bulk/route");

  const result = await applyRulesToTransactions(testUserId, {
    startDate: "2025-02-01",
    endDate: "2025-02-28",
    limit: 100,
  });

  // 5. Verify only February transactions updated
  expect(result.totalProcessed).toBe(10); // Only February transactions
  expect(result.totalUpdated).toBe(10);

  // 6. Verify database state
  const allTransactions = await db
    .select()
    .from(transactions)
    .where(eq(transactions.userId, testUserId));

  const januaryTxns = allTransactions.filter(t => t.date.startsWith("2025-01"));
  const februaryTxns = allTransactions.filter(t => t.date.startsWith("2025-02"));
  const marchTxns = allTransactions.filter(t => t.date.startsWith("2025-03"));

  // January and March should remain uncategorized
  januaryTxns.forEach(txn => expect(txn.categoryId).toBeNull());
  marchTxns.forEach(txn => expect(txn.categoryId).toBeNull());

  // February should all be categorized
  februaryTxns.forEach(txn => expect(txn.categoryId).toBe(testCategoryId1));
});
```

### Test 3: Bulk Apply with Specific Rule ID

**Scenario:** Multiple rules exist, bulk apply with specific rule ID
**Expected:** Only specified rule applied, others ignored

```typescript
it("should only apply specified rule when ruleId provided", async () => {
  // 1. Create two categories
  const category1Data = createTestCategory(testUserId, {
    name: "Groceries",
    type: "expense",
  });
  const [category1] = await db.insert(budgetCategories).values(category1Data).returning();
  testCategoryId1 = category1.id;

  const category2Data = createTestCategory(testUserId, {
    name: "Dining",
    type: "expense",
  });
  const [category2] = await db.insert(budgetCategories).values(category2Data).returning();
  testCategoryId2 = category2.id;

  // 2. Create two rules with different priorities
  // Rule 1 (Priority 1): "Store" → Groceries
  const condition1 = createTestCondition("description", "contains", "Store");
  const action1 = createTestAction("set_category", { categoryId: testCategoryId1 });
  const rule1Data = createTestRule(testUserId, [condition1], [action1], {
    name: "Grocery Rule",
    priority: 1,
  });
  const [rule1] = await db.insert(categorizationRules).values(rule1Data).returning();

  // Rule 2 (Priority 2): "Restaurant" → Dining
  const condition2 = createTestCondition("description", "contains", "Restaurant");
  const action2 = createTestAction("set_category", { categoryId: testCategoryId2 });
  const rule2Data = createTestRule(testUserId, [condition2], [action2], {
    name: "Dining Rule",
    priority: 2,
  });
  const [rule2] = await db.insert(categorizationRules).values(rule2Data).returning();

  // 3. Create transactions that match both rules
  const txn1Data = createTestTransaction(testUserId, testAccountId, {
    description: "Grocery Store",
    categoryId: null,
  });
  await db.insert(transactions).values(txn1Data);

  const txn2Data = createTestTransaction(testUserId, testAccountId, {
    description: "Restaurant Meal",
    categoryId: null,
  });
  await db.insert(transactions).values(txn2Data);

  // 4. Bulk apply with only Rule 2 specified
  const { applyRulesToTransactions } = await import("@/app/api/rules/apply-bulk/route");

  const result = await applyRulesToTransactions(testUserId, {
    ruleId: rule2.id, // Only apply Rule 2
    limit: 100,
  });

  // 5. Verify only Rule 2 applied
  expect(result.totalProcessed).toBe(2); // Both transactions checked
  expect(result.totalUpdated).toBe(1); // Only "Restaurant" transaction updated

  // 6. Verify database state
  const allTransactions = await db
    .select()
    .from(transactions)
    .where(eq(transactions.userId, testUserId));

  const storeTxn = allTransactions.find(t => t.description.includes("Store"));
  const restaurantTxn = allTransactions.find(t => t.description.includes("Restaurant"));

  // "Store" should remain uncategorized (Rule 1 not applied)
  expect(storeTxn?.categoryId).toBeNull();

  // "Restaurant" should be categorized (Rule 2 applied)
  expect(restaurantTxn?.categoryId).toBe(testCategoryId2);

  // 7. Verify audit log only has Rule 2 entry
  const logEntries = await db
    .select()
    .from(ruleExecutionLog)
    .where(eq(ruleExecutionLog.userId, testUserId));

  expect(logEntries).toHaveLength(1);
  expect(logEntries[0].ruleId).toBe(rule2.id);
});
```

### Test 4: Bulk Apply with Limit

**Scenario:** 100 uncategorized transactions, bulk apply with limit=25
**Expected:** Only first 25 processed, remaining 75 uncategorized

```typescript
it("should respect limit parameter and only process specified number", async () => {
  // 1. Create test category
  const categoryData = createTestCategory(testUserId, {
    name: "Shopping",
    type: "expense",
  });
  const [category] = await db.insert(budgetCategories).values(categoryData).returning();
  testCategoryId1 = category.id;

  // 2. Create rule: All expenses → set category
  const condition = createTestCondition("amount", "greater_than", "0");
  const action = createTestAction("set_category", { categoryId: testCategoryId1 });
  const ruleData = createTestRule(testUserId, [condition], [action]);
  await db.insert(categorizationRules).values(ruleData);

  // 3. Create 100 uncategorized transactions (all match rule)
  const transactionPromises = [];
  for (let i = 0; i < 100; i++) {
    const txnData = createTestTransaction(testUserId, testAccountId, {
      description: `Transaction ${i + 1}`,
      amount: 10.00,
      categoryId: null,
    });
    transactionPromises.push(
      db.insert(transactions).values(txnData)
    );
  }
  await Promise.all(transactionPromises);

  // 4. Bulk apply with limit=25
  const { applyRulesToTransactions } = await import("@/app/api/rules/apply-bulk/route");

  const result = await applyRulesToTransactions(testUserId, {
    limit: 25,
  });

  // 5. Verify only 25 processed
  expect(result.totalProcessed).toBe(25);
  expect(result.totalUpdated).toBe(25);

  // 6. Verify database state: exactly 25 categorized, 75 uncategorized
  const allTransactions = await db
    .select()
    .from(transactions)
    .where(eq(transactions.userId, testUserId));

  const categorized = allTransactions.filter(t => t.categoryId === testCategoryId1);
  const uncategorized = allTransactions.filter(t => t.categoryId === null);

  expect(categorized).toHaveLength(25);
  expect(uncategorized).toHaveLength(75);

  // 7. Verify audit log has exactly 25 entries
  const logEntries = await db
    .select()
    .from(ruleExecutionLog)
    .where(eq(ruleExecutionLog.userId, testUserId));

  expect(logEntries).toHaveLength(25);
});
```

### Test 5: Bulk Apply Error Handling

**Scenario:** 10 transactions to process, 2 cause errors (invalid category ID)
**Expected:** 8 transactions succeed, 2 errors reported, partial success

```typescript
it("should handle errors gracefully and report partial success", async () => {
  // 1. Create valid category
  const validCategoryData = createTestCategory(testUserId, {
    name: "Valid Category",
    type: "expense",
  });
  const [validCategory] = await db.insert(budgetCategories).values(validCategoryData).returning();

  // 2. Create two rules:
  // Rule 1 (valid): "Good" → valid category
  const condition1 = createTestCondition("description", "contains", "Good");
  const action1 = createTestAction("set_category", { categoryId: validCategory.id });
  const rule1Data = createTestRule(testUserId, [condition1], [action1], {
    priority: 1,
  });
  await db.insert(categorizationRules).values(rule1Data);

  // Rule 2 (invalid): "Bad" → non-existent category (will cause error)
  const invalidCategoryId = "invalid-category-id-12345";
  const condition2 = createTestCondition("description", "contains", "Bad");
  const action2 = createTestAction("set_category", { categoryId: invalidCategoryId });
  const rule2Data = createTestRule(testUserId, [condition2], [action2], {
    priority: 2,
  });
  await db.insert(categorizationRules).values(rule2Data);

  // 3. Create 10 transactions: 8 match "Good", 2 match "Bad"
  for (let i = 0; i < 8; i++) {
    const txnData = createTestTransaction(testUserId, testAccountId, {
      description: `Good Transaction ${i + 1}`,
      categoryId: null,
    });
    await db.insert(transactions).values(txnData);
  }
  for (let i = 0; i < 2; i++) {
    const txnData = createTestTransaction(testUserId, testAccountId, {
      description: `Bad Transaction ${i + 1}`,
      categoryId: null,
    });
    await db.insert(transactions).values(txnData);
  }

  // 4. Bulk apply (should handle errors gracefully)
  const { applyRulesToTransactions } = await import("@/app/api/rules/apply-bulk/route");

  const result = await applyRulesToTransactions(testUserId, {
    limit: 100,
  });

  // 5. Verify partial success reported
  expect(result.totalProcessed).toBe(10);
  expect(result.totalUpdated).toBe(8); // Only "Good" transactions
  expect(result.errors).toHaveLength(2); // 2 "Bad" transactions failed

  // 6. Verify error details
  result.errors.forEach(error => {
    expect(error).toHaveProperty('transactionId');
    expect(error).toHaveProperty('error');
    expect(error.error).toContain('category'); // Error related to category
  });

  // 7. Verify database state: 8 categorized, 2 uncategorized
  const allTransactions = await db
    .select()
    .from(transactions)
    .where(eq(transactions.userId, testUserId));

  const categorized = allTransactions.filter(t => t.categoryId === validCategory.id);
  const uncategorized = allTransactions.filter(t => t.categoryId === null);

  expect(categorized).toHaveLength(8);
  expect(uncategorized).toHaveLength(2);

  // Verify only "Good" transactions were categorized
  categorized.forEach(txn => {
    expect(txn.description).toContain("Good");
  });
  uncategorized.forEach(txn => {
    expect(txn.description).toContain("Bad");
  });

  // 8. Verify audit log only has successful entries
  const logEntries = await db
    .select()
    .from(ruleExecutionLog)
    .where(eq(ruleExecutionLog.userId, testUserId));

  expect(logEntries).toHaveLength(8); // Only successful applications logged
});
```

---

## Task 4: Post-Creation Action Handlers (7 tests)

**File:** `__tests__/integration/post-creation-actions.test.ts`
**Focus:** handleTransferConversion, handleSplitCreation, handleAccountChange
**Estimated Time:** 2-2.5 hours

### Test File Structure

```typescript
/**
 * Integration Tests: Post-Creation Action Handlers
 *
 * Tests complex actions that occur after transaction creation
 *
 * Coverage:
 * - Transfer conversion with auto-matching
 * - Transfer conversion creating new pairs
 * - Transfer suggestions for medium confidence
 * - Split creation (percentage and fixed amounts)
 * - Account changes with balance updates
 * - Transfer protection (cannot change account)
 *
 * Target: 7 tests covering post-creation action handlers
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { db } from "@/lib/db";
import {
  transactions,
  accounts,
  budgetCategories,
  transactionSplits,
  transferSuggestions,
} from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import Decimal from "decimal.js";
import {
  generateTestUserId,
  createTestAccount,
  createTestCategory,
  createTestTransaction,
} from "./test-utils";

describe("Integration: Post-Creation Action Handlers", () => {
  let testUserId: string;
  let testAccount1Id: string;
  let testAccount2Id: string;
  let testCategoryId: string;

  beforeEach(async () => {
    // Setup test data
  });

  afterEach(async () => {
    // Cleanup
  });

  // Tests here...
});
```

### Test 1: Convert to Transfer - Auto-Match Found

**Scenario:** Transaction A created, rule converts to transfer, Transaction B exists within range
**Expected:** Both linked with transferId, balances updated

```typescript
it("should auto-match and link transfer when high-confidence match found", async () => {
  // 1. Create two test accounts
  const account1Data = createTestAccount(testUserId, {
    name: "Checking",
    currentBalance: 1000.00,
  });
  const [account1] = await db.insert(accounts).values(account1Data).returning();
  testAccount1Id = account1.id;

  const account2Data = createTestAccount(testUserId, {
    name: "Savings",
    currentBalance: 500.00,
  });
  const [account2] = await db.insert(accounts).values(account2Data).returning();
  testAccount2Id = account2.id;

  // 2. Create Transaction B first (the match target)
  const txnBData = createTestTransaction(testUserId, testAccount2Id, {
    description: "Transfer from Checking",
    amount: 100.00,
    date: "2025-01-23",
    type: "income", // Money coming INTO savings
    categoryId: null,
  });
  const [txnB] = await db.insert(transactions).values(txnBData).returning();

  // 3. Create Transaction A with convert_to_transfer action
  // (Simulating rule application during creation)
  const { handleTransferConversion } = await import("@/lib/rules/transfer-action-handler");

  const txnAData = createTestTransaction(testUserId, testAccount1Id, {
    description: "Transfer to Savings",
    amount: 100.00,
    date: "2025-01-23",
    type: "expense", // Money leaving checking
    categoryId: null,
  });
  const [txnA] = await db.insert(transactions).values(txnAData).returning();

  // 4. Execute transfer conversion
  const result = await handleTransferConversion(
    testUserId,
    txnA.id,
    {
      targetAccountId: testAccount2Id,
      autoMatch: true,
      amountTolerance: 1, // ±1%
      dateRange: 7, // ±7 days
      createPairIfNoMatch: false,
    }
  );

  // 5. Verify match found and linked
  expect(result.matched).toBe(true);
  expect(result.matchedTransactionId).toBe(txnB.id);
  expect(result.confidence).toBeGreaterThanOrEqual(90); // High confidence

  // 6. Verify both transactions have transferId
  const txnAUpdated = await db
    .select()
    .from(transactions)
    .where(eq(transactions.id, txnA.id))
    .limit(1);
  const txnBUpdated = await db
    .select()
    .from(transactions)
    .where(eq(transactions.id, txnB.id))
    .limit(1);

  expect(txnAUpdated[0].transferId).toBeTruthy();
  expect(txnBUpdated[0].transferId).toBe(txnAUpdated[0].transferId); // Same transferId
  expect(txnAUpdated[0].type).toBe("transfer_out");
  expect(txnBUpdated[0].type).toBe("transfer_in");

  // 7. Verify account balances updated correctly
  const account1Updated = await db
    .select()
    .from(accounts)
    .where(eq(accounts.id, testAccount1Id))
    .limit(1);
  const account2Updated = await db
    .select()
    .from(accounts)
    .where(eq(accounts.id, testAccount2Id))
    .limit(1);

  expect(new Decimal(account1Updated[0].currentBalance).toNumber()).toBe(900.00); // 1000 - 100
  expect(new Decimal(account2Updated[0].currentBalance).toNumber()).toBe(600.00); // 500 + 100
});
```

### Test 2: Convert to Transfer - No Match, Create Pair

**Scenario:** Transaction created with convert_to_transfer, no match found
**Expected:** New transfer_in transaction created, both linked

```typescript
it("should create new transfer pair when no match found", async () => {
  // 1. Create two test accounts
  const account1Data = createTestAccount(testUserId, {
    name: "Checking",
    currentBalance: 1000.00,
  });
  const [account1] = await db.insert(accounts).values(account1Data).returning();
  testAccount1Id = account1.id;

  const account2Data = createTestAccount(testUserId, {
    name: "Savings",
    currentBalance: 500.00,
  });
  const [account2] = await db.insert(accounts).values(account2Data).returning();
  testAccount2Id = account2.id;

  // 2. Create Transaction A (no existing match)
  const txnAData = createTestTransaction(testUserId, testAccount1Id, {
    description: "Transfer to Savings",
    amount: 100.00,
    date: "2025-01-23",
    type: "expense",
    categoryId: null,
  });
  const [txnA] = await db.insert(transactions).values(txnAData).returning();

  // 3. Execute transfer conversion with createPairIfNoMatch=true
  const { handleTransferConversion } = await import("@/lib/rules/transfer-action-handler");

  const result = await handleTransferConversion(
    testUserId,
    txnA.id,
    {
      targetAccountId: testAccount2Id,
      autoMatch: true,
      amountTolerance: 1,
      dateRange: 7,
      createPairIfNoMatch: true, // Create new transfer pair
    }
  );

  // 4. Verify pair created
  expect(result.matched).toBe(false);
  expect(result.pairCreated).toBe(true);
  expect(result.createdTransactionId).toBeTruthy();

  // 5. Verify both transactions exist with transferId
  const allTransactions = await db
    .select()
    .from(transactions)
    .where(eq(transactions.userId, testUserId));

  expect(allTransactions).toHaveLength(2); // Original + created pair

  const transferOut = allTransactions.find(t => t.type === "transfer_out");
  const transferIn = allTransactions.find(t => t.type === "transfer_in");

  expect(transferOut).toBeTruthy();
  expect(transferIn).toBeTruthy();
  expect(transferOut?.transferId).toBe(transferIn?.transferId);

  // 6. Verify attributes of created pair
  expect(transferIn?.accountId).toBe(testAccount2Id);
  expect(new Decimal(transferIn?.amount || 0).toNumber()).toBe(100.00);
  expect(transferIn?.date).toBe("2025-01-23");
  expect(transferIn?.description).toContain("Transfer");

  // 7. Verify account balances
  const account1Updated = await db
    .select()
    .from(accounts)
    .where(eq(accounts.id, testAccount1Id))
    .limit(1);
  const account2Updated = await db
    .select()
    .from(accounts)
    .where(eq(accounts.id, testAccount2Id))
    .limit(1);

  expect(new Decimal(account1Updated[0].currentBalance).toNumber()).toBe(900.00);
  expect(new Decimal(account2Updated[0].currentBalance).toNumber()).toBe(600.00);
});
```

### Test 3: Convert to Transfer - Medium Confidence Suggestion

**Scenario:** Potential match found with 75% confidence
**Expected:** Suggestion stored, no auto-link

```typescript
it("should create suggestion when medium confidence match found", async () => {
  // 1. Create two test accounts
  const account1Data = createTestAccount(testUserId, {
    name: "Checking",
    currentBalance: 1000.00,
  });
  const [account1] = await db.insert(accounts).values(account1Data).returning();
  testAccount1Id = account1.id;

  const account2Data = createTestAccount(testUserId, {
    name: "Savings",
    currentBalance: 500.00,
  });
  const [account2] = await db.insert(accounts).values(account2Data).returning();
  testAccount2Id = account2.id;

  // 2. Create Transaction B (potential match with some differences)
  const txnBData = createTestTransaction(testUserId, testAccount2Id, {
    description: "Income from External", // Different description (lower confidence)
    amount: 102.00, // Slightly different amount (within tolerance)
    date: "2025-01-25", // 2 days different
    type: "income",
    categoryId: null,
  });
  const [txnB] = await db.insert(transactions).values(txnBData).returning();

  // 3. Create Transaction A
  const txnAData = createTestTransaction(testUserId, testAccount1Id, {
    description: "Transfer to Savings",
    amount: 100.00,
    date: "2025-01-23",
    type: "expense",
    categoryId: null,
  });
  const [txnA] = await db.insert(transactions).values(txnAData).returning();

  // 4. Execute transfer conversion
  const { handleTransferConversion } = await import("@/lib/rules/transfer-action-handler");

  const result = await handleTransferConversion(
    testUserId,
    txnA.id,
    {
      targetAccountId: testAccount2Id,
      autoMatch: true,
      amountTolerance: 3, // Allow 3% difference
      dateRange: 7,
      createPairIfNoMatch: false,
    }
  );

  // 5. Verify suggestion created (confidence 70-89%)
  expect(result.matched).toBe(false);
  expect(result.suggestionCreated).toBe(true);
  expect(result.confidence).toBeGreaterThanOrEqual(70);
  expect(result.confidence).toBeLessThan(90);

  // 6. Verify suggestion stored in database
  const suggestions = await db
    .select()
    .from(transferSuggestions)
    .where(eq(transferSuggestions.userId, testUserId));

  expect(suggestions).toHaveLength(1);
  expect(suggestions[0].sourceTransactionId).toBe(txnA.id);
  expect(suggestions[0].targetTransactionId).toBe(txnB.id);
  expect(suggestions[0].status).toBe("pending");
  expect(suggestions[0].confidenceScore).toBeGreaterThanOrEqual(70);

  // 7. Verify transactions NOT auto-linked
  const txnAUpdated = await db
    .select()
    .from(transactions)
    .where(eq(transactions.id, txnA.id))
    .limit(1);

  expect(txnAUpdated[0].transferId).toBeNull(); // Not auto-linked
  expect(txnAUpdated[0].type).toBe("expense"); // Type unchanged
});
```

### Test 4: Create Split - Percentage-Based

**Scenario:** $100 expense, rule creates 3 splits (50%, 30%, 20%)
**Expected:** 3 split records with correct amounts, parent marked as isSplit=true

```typescript
it("should create percentage-based splits with correct amounts", async () => {
  // 1. Create test categories
  const groceriesData = createTestCategory(testUserId, {
    name: "Groceries",
    type: "expense",
  });
  const [groceries] = await db.insert(budgetCategories).values(groceriesData).returning();

  const householdData = createTestCategory(testUserId, {
    name: "Household",
    type: "expense",
  });
  const [household] = await db.insert(budgetCategories).values(householdData).returning();

  const personalData = createTestCategory(testUserId, {
    name: "Personal",
    type: "expense",
  });
  const [personal] = await db.insert(budgetCategories).values(personalData).returning();

  // 2. Create parent transaction
  const txnData = createTestTransaction(testUserId, testAccount1Id, {
    description: "Shopping Trip",
    amount: 100.00,
    type: "expense",
    categoryId: null,
  });
  const [parentTxn] = await db.insert(transactions).values(txnData).returning();

  // 3. Execute split creation
  const { handleSplitCreation } = await import("@/lib/rules/split-action-handler");

  const splitConfig = {
    splits: [
      {
        categoryId: groceries.id,
        amountType: "percentage" as const,
        amountValue: 50, // 50%
        description: "Groceries portion",
      },
      {
        categoryId: household.id,
        amountType: "percentage" as const,
        amountValue: 30, // 30%
        description: "Household items",
      },
      {
        categoryId: personal.id,
        amountType: "percentage" as const,
        amountValue: 20, // 20%
        description: "Personal items",
      },
    ],
  };

  await handleSplitCreation(testUserId, parentTxn.id, splitConfig);

  // 4. Verify parent transaction marked as split
  const parentUpdated = await db
    .select()
    .from(transactions)
    .where(eq(transactions.id, parentTxn.id))
    .limit(1);

  expect(parentUpdated[0].isSplit).toBe(true);

  // 5. Verify 3 split records created
  const splits = await db
    .select()
    .from(transactionSplits)
    .where(eq(transactionSplits.transactionId, parentTxn.id));

  expect(splits).toHaveLength(3);

  // 6. Verify split amounts
  const grocerySplit = splits.find(s => s.categoryId === groceries.id);
  const householdSplit = splits.find(s => s.categoryId === household.id);
  const personalSplit = splits.find(s => s.categoryId === personal.id);

  expect(new Decimal(grocerySplit?.amount || 0).toNumber()).toBe(50.00); // 50% of $100
  expect(new Decimal(householdSplit?.amount || 0).toNumber()).toBe(30.00); // 30% of $100
  expect(new Decimal(personalSplit?.amount || 0).toNumber()).toBe(20.00); // 20% of $100

  // 7. Verify descriptions
  expect(grocerySplit?.description).toBe("Groceries portion");
  expect(householdSplit?.description).toBe("Household items");
  expect(personalSplit?.description).toBe("Personal items");

  // 8. Verify total equals parent amount
  const total = splits.reduce((sum, split) => {
    return sum.plus(new Decimal(split.amount));
  }, new Decimal(0));

  expect(total.toNumber()).toBe(100.00);
});
```

### Test 5: Create Split - Fixed Amounts

**Scenario:** $100 expense, rule creates 2 splits ($60 + $40)
**Expected:** Split amounts match configuration exactly

```typescript
it("should create fixed-amount splits with exact values", async () => {
  // 1. Create test categories
  const category1Data = createTestCategory(testUserId, {
    name: "Category 1",
    type: "expense",
  });
  const [category1] = await db.insert(budgetCategories).values(category1Data).returning();

  const category2Data = createTestCategory(testUserId, {
    name: "Category 2",
    type: "expense",
  });
  const [category2] = await db.insert(budgetCategories).values(category2Data).returning();

  // 2. Create parent transaction
  const txnData = createTestTransaction(testUserId, testAccount1Id, {
    description: "Split Purchase",
    amount: 100.00,
    type: "expense",
    categoryId: null,
  });
  const [parentTxn] = await db.insert(transactions).values(txnData).returning();

  // 3. Execute split creation with fixed amounts
  const { handleSplitCreation } = await import("@/lib/rules/split-action-handler");

  const splitConfig = {
    splits: [
      {
        categoryId: category1.id,
        amountType: "fixed" as const,
        amountValue: 60.00, // Fixed $60
      },
      {
        categoryId: category2.id,
        amountType: "fixed" as const,
        amountValue: 40.00, // Fixed $40
      },
    ],
  };

  await handleSplitCreation(testUserId, parentTxn.id, splitConfig);

  // 4. Verify 2 split records created
  const splits = await db
    .select()
    .from(transactionSplits)
    .where(eq(transactionSplits.transactionId, parentTxn.id));

  expect(splits).toHaveLength(2);

  // 5. Verify exact amounts
  const split1 = splits.find(s => s.categoryId === category1.id);
  const split2 = splits.find(s => s.categoryId === category2.id);

  expect(new Decimal(split1?.amount || 0).toNumber()).toBe(60.00);
  expect(new Decimal(split2?.amount || 0).toNumber()).toBe(40.00);

  // 6. Verify total equals parent amount
  const total = splits.reduce((sum, split) => {
    return sum.plus(new Decimal(split.amount));
  }, new Decimal(0));

  expect(total.toNumber()).toBe(100.00);
});
```

### Test 6: Set Account - Balance Updates

**Scenario:** $50 expense on Account A, rule changes to Account B
**Expected:** Account A balance increased by $50, Account B decreased by $50

```typescript
it("should update balances correctly when changing account", async () => {
  // 1. Create two test accounts with initial balances
  const account1Data = createTestAccount(testUserId, {
    name: "Account 1",
    currentBalance: 1000.00,
  });
  const [account1] = await db.insert(accounts).values(account1Data).returning();
  testAccount1Id = account1.id;

  const account2Data = createTestAccount(testUserId, {
    name: "Account 2",
    currentBalance: 500.00,
  });
  const [account2] = await db.insert(accounts).values(account2Data).returning();
  testAccount2Id = account2.id;

  // 2. Create transaction on Account 1 (expense)
  const txnData = createTestTransaction(testUserId, testAccount1Id, {
    description: "Purchase",
    amount: 50.00,
    type: "expense",
    categoryId: null,
  });
  const [txn] = await db.insert(transactions).values(txnData).returning();

  // Initial balances should reflect the expense
  // Account 1: 1000 - 50 = 950 (expense decreases balance)
  const account1Before = await db
    .select()
    .from(accounts)
    .where(eq(accounts.id, testAccount1Id))
    .limit(1);
  // Note: Transaction creation should have already updated balance

  // 3. Execute account change
  const { handleAccountChange } = await import("@/lib/rules/account-action-handler");

  await handleAccountChange(testUserId, txn.id, {
    targetAccountId: testAccount2Id,
  });

  // 4. Verify transaction account changed
  const txnUpdated = await db
    .select()
    .from(transactions)
    .where(eq(transactions.id, txn.id))
    .limit(1);

  expect(txnUpdated[0].accountId).toBe(testAccount2Id);

  // 5. Verify Account 1 balance increased (expense removed)
  const account1After = await db
    .select()
    .from(accounts)
    .where(eq(accounts.id, testAccount1Id))
    .limit(1);

  // Account 1 should have $50 added back (expense reversed)
  expect(new Decimal(account1After[0].currentBalance).toNumber()).toBe(1000.00);

  // 6. Verify Account 2 balance decreased (expense added)
  const account2After = await db
    .select()
    .from(accounts)
    .where(eq(accounts.id, testAccount2Id))
    .limit(1);

  // Account 2 should have $50 deducted (expense applied)
  expect(new Decimal(account2After[0].currentBalance).toNumber()).toBe(450.00); // 500 - 50
});
```

### Test 7: Set Account - Transfer Protection

**Scenario:** Transfer transaction exists, rule tries to change account
**Expected:** Action rejected, transfer unchanged

```typescript
it("should reject account change for transfer transactions", async () => {
  // 1. Create two test accounts
  const account1Data = createTestAccount(testUserId, {
    name: "Checking",
    currentBalance: 1000.00,
  });
  const [account1] = await db.insert(accounts).values(account1Data).returning();
  testAccount1Id = account1.id;

  const account2Data = createTestAccount(testUserId, {
    name: "Savings",
    currentBalance: 500.00,
  });
  const [account2] = await db.insert(accounts).values(account2Data).returning();
  testAccount2Id = account2.id;

  const account3Data = createTestAccount(testUserId, {
    name: "Investment",
    currentBalance: 2000.00,
  });
  const [account3] = await db.insert(accounts).values(account3Data).returning();
  const testAccount3Id = account3.id;

  // 2. Create transfer pair
  const transferId = nanoid();

  const transferOutData = createTestTransaction(testUserId, testAccount1Id, {
    description: "Transfer to Savings",
    amount: 100.00,
    type: "transfer_out",
    transferId,
  });
  const [transferOut] = await db.insert(transactions).values(transferOutData).returning();

  const transferInData = createTestTransaction(testUserId, testAccount2Id, {
    description: "Transfer from Checking",
    amount: 100.00,
    type: "transfer_in",
    transferId,
  });
  await db.insert(transactions).values(transferInData);

  // 3. Attempt to change account on transfer_out transaction
  const { handleAccountChange } = await import("@/lib/rules/account-action-handler");

  // Should throw error or return rejection
  await expect(
    handleAccountChange(testUserId, transferOut.id, {
      targetAccountId: testAccount3Id,
    })
  ).rejects.toThrow(/transfer/i);

  // 4. Verify transaction unchanged
  const txnAfter = await db
    .select()
    .from(transactions)
    .where(eq(transactions.id, transferOut.id))
    .limit(1);

  expect(txnAfter[0].accountId).toBe(testAccount1Id); // Still on original account
  expect(txnAfter[0].type).toBe("transfer_out"); // Still a transfer

  // 5. Verify account balances unchanged
  const account1After = await db
    .select()
    .from(accounts)
    .where(eq(accounts.id, testAccount1Id))
    .limit(1);
  const account3After = await db
    .select()
    .from(accounts)
    .where(eq(accounts.id, testAccount3Id))
    .limit(1);

  expect(new Decimal(account1After[0].currentBalance).toNumber()).toBe(900.00); // 1000 - 100
  expect(new Decimal(account3After[0].currentBalance).toNumber()).toBe(2000.00); // Unchanged
});
```

---

## Task 5: Rule Execution Logging (3 tests)

**File:** `__tests__/integration/rule-execution-logging.test.ts`
**Focus:** ruleExecutionLog table audit trail
**Estimated Time:** 1 hour

### Test File Structure

```typescript
/**
 * Integration Tests: Rule Execution Logging
 *
 * Tests audit trail for rule execution in ruleExecutionLog table
 *
 * Coverage:
 * - Successful rule application logging
 * - Multiple actions recorded in appliedActions
 * - No log entry when no match occurs
 *
 * Target: 3 tests covering audit logging
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { db } from "@/lib/db";
import {
  transactions,
  accounts,
  budgetCategories,
  merchants,
  ruleExecutionLog,
  categorizationRules,
} from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import {
  generateTestUserId,
  createTestAccount,
  createTestCategory,
  createTestMerchant,
  createTestTransaction,
  createTestRule,
  createTestCondition,
  createTestAction,
  expectAuditLogEntry,
  expectAppliedActions,
} from "./test-utils";

describe("Integration: Rule Execution Logging", () => {
  let testUserId: string;
  let testAccountId: string;
  let testCategoryId: string;
  let testMerchantId: string;

  beforeEach(async () => {
    // Setup test data
  });

  afterEach(async () => {
    // Cleanup
  });

  // Tests here...
});
```

### Test 1: Audit Log - Successful Rule Application

**Scenario:** Rule applied to transaction
**Expected:** Log entry with all required fields

```typescript
it("should create complete audit log entry on successful rule application", async () => {
  // 1. Create test data
  testUserId = generateTestUserId();

  const accountData = createTestAccount(testUserId);
  const [account] = await db.insert(accounts).values(accountData).returning();
  testAccountId = account.id;

  const categoryData = createTestCategory(testUserId, {
    name: "Groceries",
    type: "expense",
  });
  const [category] = await db.insert(budgetCategories).values(categoryData).returning();
  testCategoryId = category.id;

  // 2. Create rule
  const condition = createTestCondition("description", "contains", "Store");
  const action = createTestAction("set_category", { categoryId: testCategoryId });
  const ruleData = createTestRule(testUserId, [condition], [action], {
    name: "Grocery Store Rule",
  });
  const [rule] = await db.insert(categorizationRules).values(ruleData).returning();

  // 3. Create transaction (uncategorized)
  const txnData = createTestTransaction(testUserId, testAccountId, {
    description: "Grocery Store Purchase",
    categoryId: null,
  });
  const [txn] = await db.insert(transactions).values(txnData).returning();

  // 4. Apply rule
  const { findMatchingRule } = await import("@/lib/rules/rule-matcher");
  const { executeRuleActions } = await import("@/lib/rules/actions-executor");
  const { logRuleExecution } = await import("@/lib/rules/audit-logger");

  const matchedRule = await findMatchingRule(testUserId, txn);
  expect(matchedRule).toBeTruthy();

  const result = await executeRuleActions(
    testUserId,
    txn,
    matchedRule!.actions
  );

  // Log execution
  await logRuleExecution(testUserId, txn.id, rule.id, result.appliedActions, true);

  // 5. Verify log entry created
  const logEntries = await db
    .select()
    .from(ruleExecutionLog)
    .where(eq(ruleExecutionLog.transactionId, txn.id));

  expect(logEntries).toHaveLength(1);

  // 6. Verify all required fields
  expectAuditLogEntry(logEntries[0], {
    ruleId: rule.id,
    transactionId: txn.id,
    appliedCategoryId: testCategoryId,
    matched: true,
    appliedActions: result.appliedActions,
  });

  // 7. Verify appliedActions structure
  const appliedActions = typeof logEntries[0].appliedActions === 'string'
    ? JSON.parse(logEntries[0].appliedActions)
    : logEntries[0].appliedActions;

  expectAppliedActions(appliedActions, [
    {
      type: "set_category",
      field: "categoryId",
      value: testCategoryId,
    },
  ]);

  // 8. Verify timestamps
  expect(logEntries[0].executedAt).toBeTruthy();
  expect(new Date(logEntries[0].executedAt).getTime()).toBeLessThanOrEqual(Date.now());
});
```

### Test 2: Audit Log - Multiple Actions Recorded

**Scenario:** Rule with 5 actions all execute
**Expected:** appliedActions field contains all 5 with correct details

```typescript
it("should record all applied actions in audit log", async () => {
  // 1. Create test data
  testUserId = generateTestUserId();

  const accountData = createTestAccount(testUserId);
  const [account] = await db.insert(accounts).values(accountData).returning();
  testAccountId = account.id;

  const categoryData = createTestCategory(testUserId, {
    name: "Dining",
    type: "expense",
  });
  const [category] = await db.insert(budgetCategories).values(categoryData).returning();
  testCategoryId = category.id;

  const merchantData = createTestMerchant(testUserId, {
    name: "Restaurant ABC",
  });
  const [merchant] = await db.insert(merchants).values(merchantData).returning();
  testMerchantId = merchant.id;

  // 2. Create rule with 5 actions
  const condition = createTestCondition("description", "contains", "Restaurant");
  const actions = [
    createTestAction("set_category", { categoryId: testCategoryId }),
    createTestAction("set_merchant", { merchantId: testMerchantId }),
    createTestAction("prepend_description", { pattern: "[Dining] " }),
    createTestAction("append_description", { pattern: " - Reviewed" }),
    createTestAction("set_tax_deduction"),
  ];
  const ruleData = createTestRule(testUserId, [condition], actions, {
    name: "Dining Multi-Action Rule",
  });
  const [rule] = await db.insert(categorizationRules).values(ruleData).returning();

  // 3. Create transaction
  const txnData = createTestTransaction(testUserId, testAccountId, {
    description: "Restaurant Meal",
    categoryId: null,
  });
  const [txn] = await db.insert(transactions).values(txnData).returning();

  // 4. Apply rule
  const { findMatchingRule } = await import("@/lib/rules/rule-matcher");
  const { executeRuleActions } = await import("@/lib/rules/actions-executor");
  const { logRuleExecution } = await import("@/lib/rules/audit-logger");

  const matchedRule = await findMatchingRule(testUserId, txn);
  const result = await executeRuleActions(
    testUserId,
    txn,
    matchedRule!.actions
  );

  // Log execution
  await logRuleExecution(testUserId, txn.id, rule.id, result.appliedActions, true);

  // 5. Verify log entry created
  const logEntries = await db
    .select()
    .from(ruleExecutionLog)
    .where(eq(ruleExecutionLog.transactionId, txn.id));

  expect(logEntries).toHaveLength(1);

  // 6. Verify all 5 actions recorded
  const appliedActions = typeof logEntries[0].appliedActions === 'string'
    ? JSON.parse(logEntries[0].appliedActions)
    : logEntries[0].appliedActions;

  expect(appliedActions).toHaveLength(5);

  // 7. Verify each action type and fields
  expectAppliedActions(appliedActions, [
    { type: "set_category", field: "categoryId", value: testCategoryId },
    { type: "set_merchant", field: "merchantId", value: testMerchantId },
    { type: "prepend_description", field: "description", value: expect.stringContaining("[Dining]") },
    { type: "append_description", field: "description", value: expect.stringContaining("Reviewed") },
    { type: "set_tax_deduction", field: "isTaxDeductible", value: true },
  ]);

  // 8. Verify context propagation visible in log
  // Description should show cumulative changes
  const descriptionActions = appliedActions.filter((a: any) =>
    a.type === 'prepend_description' || a.type === 'append_description'
  );
  expect(descriptionActions).toHaveLength(2);
});
```

### Test 3: Audit Log - No Match, No Log

**Scenario:** Transaction doesn't match any rules
**Expected:** No log entry created

```typescript
it("should not create log entry when no rules match", async () => {
  // 1. Create test data
  testUserId = generateTestUserId();

  const accountData = createTestAccount(testUserId);
  const [account] = await db.insert(accounts).values(accountData).returning();
  testAccountId = account.id;

  const categoryData = createTestCategory(testUserId, {
    name: "Shopping",
    type: "expense",
  });
  const [category] = await db.insert(budgetCategories).values(categoryData).returning();
  testCategoryId = category.id;

  // 2. Create rule that won't match
  const condition = createTestCondition("description", "contains", "Store");
  const action = createTestAction("set_category", { categoryId: testCategoryId });
  const ruleData = createTestRule(testUserId, [condition], [action]);
  await db.insert(categorizationRules).values(ruleData);

  // 3. Create transaction that doesn't match
  const txnData = createTestTransaction(testUserId, testAccountId, {
    description: "Gas Station Purchase", // Doesn't contain "Store"
    categoryId: null,
  });
  const [txn] = await db.insert(transactions).values(txnData).returning();

  // 4. Try to find matching rule
  const { findMatchingRule } = await import("@/lib/rules/rule-matcher");

  const matchedRule = await findMatchingRule(testUserId, txn);

  // 5. Verify no match
  expect(matchedRule).toBeNull();

  // 6. Verify no log entry created
  const logEntries = await db
    .select()
    .from(ruleExecutionLog)
    .where(eq(ruleExecutionLog.transactionId, txn.id));

  expect(logEntries).toHaveLength(0);

  // 7. Verify ruleExecutionLog table is empty for this user
  const allLogs = await db
    .select()
    .from(ruleExecutionLog)
    .where(eq(ruleExecutionLog.userId, testUserId));

  expect(allLogs).toHaveLength(0);
});
```

---

## Implementation Checklist

### Task 3: Bulk Apply Rules (5 tests)
- [ ] Create `__tests__/integration/bulk-apply-rules.test.ts`
- [ ] Setup/teardown with database cleanup
- [ ] Test 1: Bulk apply to uncategorized transactions
- [ ] Test 2: Bulk apply with date range filter
- [ ] Test 3: Bulk apply with specific rule ID
- [ ] Test 4: Bulk apply with limit
- [ ] Test 5: Bulk apply error handling
- [ ] Run tests and verify all pass
- [ ] Update features.md with completion status

### Task 4: Post-Creation Actions (7 tests)
- [ ] Create `__tests__/integration/post-creation-actions.test.ts`
- [ ] Setup/teardown with database cleanup
- [ ] Test 1: Convert to transfer - auto-match found
- [ ] Test 2: Convert to transfer - no match, create pair
- [ ] Test 3: Convert to transfer - medium confidence suggestion
- [ ] Test 4: Create split - percentage-based
- [ ] Test 5: Create split - fixed amounts
- [ ] Test 6: Set account - balance updates
- [ ] Test 7: Set account - transfer protection
- [ ] Run tests and verify all pass
- [ ] Update features.md with completion status

### Task 5: Rule Execution Logging (3 tests)
- [ ] Create `__tests__/integration/rule-execution-logging.test.ts`
- [ ] Setup/teardown with database cleanup
- [ ] Test 1: Audit log - successful rule application
- [ ] Test 2: Audit log - multiple actions recorded
- [ ] Test 3: Audit log - no match, no log
- [ ] Run tests and verify all pass
- [ ] Update features.md with completion status

### Final Verification
- [ ] Run full test suite: `pnpm test`
- [ ] Verify all 30 integration tests pass
- [ ] Check test execution time (< 15 seconds target)
- [ ] Generate coverage report: `pnpm test:coverage`
- [ ] Verify 90%+ integration coverage
- [ ] Update documentation with final results
- [ ] Mark Phase 8 as COMPLETE in features.md

---

## Notes & Considerations

### Important Implementation Details

1. **API Function Imports**: Tests import internal functions from API route files (e.g., `applyRulesToTransactions`). These functions may need to be exported separately from the route handlers.

2. **Database Cleanup**: Always use unique test user IDs and clean up in `afterEach` to prevent test interference.

3. **Decimal.js Usage**: All amount comparisons must use `Decimal.js` for precision:
   ```typescript
   expect(new Decimal(amount).toNumber()).toBe(100.00);
   ```

4. **JSON Parsing**: Handle both string and object formats for `appliedActions`:
   ```typescript
   const actions = typeof log.appliedActions === 'string'
     ? JSON.parse(log.appliedActions)
     : log.appliedActions;
   ```

5. **Error Handling**: Use `expect().rejects.toThrow()` for async error assertions.

6. **Theme Variables**: Test data uses standard colors from theme system (no hardcoded hex values).

### Common Patterns

**Database Query Pattern:**
```typescript
const results = await db
  .select()
  .from(table)
  .where(eq(table.userId, testUserId))
  .limit(1);

expect(results).toHaveLength(1);
expect(results[0].field).toBe(expectedValue);
```

**Cleanup Pattern:**
```typescript
afterEach(async () => {
  await db.delete(ruleExecutionLog).where(eq(ruleExecutionLog.userId, testUserId));
  await db.delete(transactions).where(eq(transactions.userId, testUserId));
  await db.delete(categorizationRules).where(eq(categorizationRules.userId, testUserId));
  await db.delete(merchants).where(eq(merchants.userId, testUserId));
  await db.delete(budgetCategories).where(eq(budgetCategories.userId, testUserId));
  await db.delete(accounts).where(eq(accounts.userId, testUserId));
});
```

### Success Criteria

**Task 3 Complete:**
- ✅ All 5 bulk apply tests pass
- ✅ Date filtering works correctly
- ✅ Limit parameter respected
- ✅ Error handling graceful

**Task 4 Complete:**
- ✅ All 7 post-creation tests pass
- ✅ Transfer matching works correctly
- ✅ Split creation accurate with Decimal.js
- ✅ Account balance updates correct

**Task 5 Complete:**
- ✅ All 3 audit logging tests pass
- ✅ Log entries have all required fields
- ✅ Multiple actions recorded correctly
- ✅ No spurious logs created

**Phase 8 Complete:**
- ✅ Total 30 integration tests passing
- ✅ 90%+ integration coverage achieved
- ✅ Test suite runs in < 15 seconds
- ✅ Zero flaky tests
- ✅ Documentation updated

---

## Timeline

**Total Estimated Time:** 4-6 hours

- **Task 3:** 1.5-2 hours
- **Task 4:** 2-2.5 hours
- **Task 5:** 1 hour
- **Verification & Documentation:** 30 minutes

**Recommended Approach:**
1. Start with Task 3 (bulk apply) - builds on existing patterns
2. Move to Task 5 (logging) - simpler, good momentum
3. Finish with Task 4 (post-creation) - most complex
4. Run full suite and verify coverage
5. Update all documentation

---

**Status:** Ready to implement
**Next Steps:**
1. Start with Task 3: Create `bulk-apply-rules.test.ts`
2. Implement all 5 tests sequentially
3. Run and verify tests pass
4. Move to Task 5, then Task 4
5. Final verification and documentation

**Expected Outcome:** Complete integration test coverage for Rules System, achieving 90%+ coverage and 100% confidence in production deployment.
