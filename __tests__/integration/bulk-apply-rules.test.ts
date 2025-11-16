/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Integration Tests: Bulk Apply Rules API
 *
 * Tests bulk rule application similar to POST /api/rules/apply-bulk
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
import { eq, and, isNull, ne, gte, lte } from "drizzle-orm";
import { nanoid } from "nanoid";
import { findMatchingRule } from "@/lib/rules/rule-matcher";
import { executeRuleActions } from "@/lib/rules/actions-executor";
import type { TransactionData } from "@/lib/rules/condition-evaluator";
import type { AppliedAction } from "@/lib/rules/types";
import {
  generateTestUserId,
  createTestAccount,
  createTestCategory,
  createTestTransaction,
  createTestRule,
  createTestCondition,
  createTestAction,
} from "./test-utils";

// ============================================================================
// HELPER FUNCTION: Simulate Bulk Apply Logic
// ============================================================================

interface BulkApplyOptions {
  ruleId?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
}

interface BulkApplyResult {
  totalProcessed: number;
  totalUpdated: number;
  errors: { transactionId: string; error: string }[];
  appliedRules: {
    transactionId: string;
    ruleId: string;
    categoryId: string | null;
    appliedActions: AppliedAction[];
  }[];
}

/**
 * Simulate bulk apply rules logic (mirrors API implementation)
 */
async function applyRulesToTransactions(
  userId: string,
  options: BulkApplyOptions = {}
): Promise<BulkApplyResult> {
  const { ruleId, startDate, endDate, limit = 100 } = options;

  // Build query for uncategorized transactions
  const conditions = [
    eq(transactions.userId, userId),
    isNull(transactions.categoryId),
    ne(transactions.type, 'transfer_in'),
    ne(transactions.type, 'transfer_out'),
  ];

  if (startDate) {
    conditions.push(gte(transactions.date, startDate));
  }
  if (endDate) {
    conditions.push(lte(transactions.date, endDate));
  }

  const targetTransactions = await db
    .select()
    .from(transactions)
    .where(and(...conditions))
    .limit(limit);

  if (targetTransactions.length === 0) {
    return {
      totalProcessed: 0,
      totalUpdated: 0,
      errors: [],
      appliedRules: [],
    };
  }

  // Get all accounts for name lookup
  const accountList = await db.select().from(accounts).where(eq(accounts.userId, userId));
  const accountMap = new Map(accountList.map(a => [a.id, a.name]));

  const result: BulkApplyResult = {
    totalProcessed: targetTransactions.length,
    totalUpdated: 0,
    errors: [],
    appliedRules: [],
  };

  // Process each transaction
  for (const txn of targetTransactions) {
    try {
      const accountName = accountMap.get(txn.accountId) || 'Unknown';

      // Build transaction data for rule matching
      const transactionData: TransactionData = {
        description: txn.description,
        amount: txn.amount,
        accountName,
        date: txn.date,
        notes: txn.notes || undefined,
      };

      // Find matching rule
      const ruleMatch = await findMatchingRule(userId, transactionData);

      if (ruleMatch.matched && ruleMatch.rule) {
        // Skip if ruleId filter is specified and doesn't match
        if (ruleId && ruleMatch.rule.ruleId !== ruleId) {
          continue;
        }

        // Execute rule actions
        const executionResult = await executeRuleActions(
          userId,
          ruleMatch.rule.actions,
          {
            categoryId: txn.categoryId || null,
            description: txn.description,
            merchantId: txn.merchantId || null,
            accountId: txn.accountId,
            amount: txn.amount,
            date: txn.date,
            type: txn.type || 'expense',
            isTaxDeductible: txn.isTaxDeductible || false,
          },
          null, // merchantInfo
          null  // categoryInfo
        );

        // Build update object
        const updates: any = {
          updatedAt: new Date().toISOString(),
        };

        if (executionResult.mutations.categoryId !== undefined) {
          updates.categoryId = executionResult.mutations.categoryId;
        }
        if (executionResult.mutations.description) {
          updates.description = executionResult.mutations.description;
        }
        if (executionResult.mutations.merchantId !== undefined) {
          updates.merchantId = executionResult.mutations.merchantId;
        }
        if (executionResult.mutations.isTaxDeductible !== undefined) {
          updates.isTaxDeductible = executionResult.mutations.isTaxDeductible;
        }
        if (executionResult.mutations.isSalesTaxable !== undefined) {
          updates.isSalesTaxable = executionResult.mutations.isSalesTaxable;
        }

        // Update transaction
        if (Object.keys(updates).length > 1) {
          await db
            .update(transactions)
            .set(updates)
            .where(eq(transactions.id, txn.id));
        }

        // Log the rule execution
        await db.insert(ruleExecutionLog).values({
          id: nanoid(),
          userId,
          ruleId: ruleMatch.rule.ruleId,
          transactionId: txn.id,
          appliedCategoryId: executionResult.mutations.categoryId || null,
          appliedActions: executionResult.appliedActions.length > 0
            ? JSON.stringify(executionResult.appliedActions)
            : null,
          matched: true,
          executedAt: new Date().toISOString(),
        });

        result.totalUpdated++;
        result.appliedRules.push({
          transactionId: txn.id,
          ruleId: ruleMatch.rule.ruleId,
          categoryId: executionResult.mutations.categoryId || null,
          appliedActions: executionResult.appliedActions,
        });
      }
    } catch (error) {
      result.errors.push({
        transactionId: txn.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return result;
}

// ============================================================================
// INTEGRATION TEST SUITE: BULK APPLY RULES API
// ============================================================================

describe("Integration: Bulk Apply Rules API", () => {
  let testUserId: string;
  let testAccountId: string;
  let testCategoryId1: string;
  let testCategoryId2: string;

  // ============================================================================
  // SETUP & TEARDOWN
  // ============================================================================

  beforeEach(async () => {
    // Generate unique test user ID for isolation
    testUserId = generateTestUserId();

    // Create test account
    const accountData = createTestAccount(testUserId, {
      name: "Test Checking",
      currentBalance: 10000.00,
    });
    const [account] = await db.insert(accounts).values(accountData).returning();
    testAccountId = account.id;
  });

  afterEach(async () => {
    // Cleanup: Delete test data in correct order (foreign keys)
    await db.delete(ruleExecutionLog).where(eq(ruleExecutionLog.userId, testUserId));
    await db.delete(transactions).where(eq(transactions.userId, testUserId));
    await db.delete(categorizationRules).where(eq(categorizationRules.userId, testUserId));
    await db.delete(budgetCategories).where(eq(budgetCategories.userId, testUserId));
    await db.delete(accounts).where(eq(accounts.userId, testUserId));
  });

  // ============================================================================
  // TEST 1: Bulk Apply to Uncategorized Transactions
  // ============================================================================

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
    for (let i = 0; i < 5; i++) {
      const txnData = createTestTransaction(testUserId, testAccountId, {
        description: `Grocery Store Purchase ${i + 1}`,
        amount: 50.00,
        categoryId: null,
      });
      await db.insert(transactions).values(txnData);
    }
    for (let i = 0; i < 5; i++) {
      const txnData = createTestTransaction(testUserId, testAccountId, {
        description: `Gas Station Purchase ${i + 1}`,
        amount: 40.00,
        categoryId: null,
      });
      await db.insert(transactions).values(txnData);
    }

    // 4. Apply rules to all transactions
    const result = await applyRulesToTransactions(testUserId, {
      limit: 100,
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

  // ============================================================================
  // TEST 2: Bulk Apply with Date Range Filter
  // ============================================================================

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

  // ============================================================================
  // TEST 3: Bulk Apply with Specific Rule ID
  // ============================================================================

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
    const result = await applyRulesToTransactions(testUserId, {
      ruleId: rule2.id,
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

  // ============================================================================
  // TEST 4: Bulk Apply with Limit
  // ============================================================================

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

  // ============================================================================
  // TEST 5: Bulk Apply Error Handling
  // ============================================================================

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
      expect(error.error).toBeTruthy();
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
});
