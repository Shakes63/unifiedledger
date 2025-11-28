/* eslint-disable @typescript-eslint/no-explicit-any */
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
import { nanoid } from "nanoid";
import { findMatchingRule } from "@/lib/rules/rule-matcher";
import { executeRuleActions } from "@/lib/rules/actions-executor";
import type { TransactionData } from "@/lib/rules/condition-evaluator";
import {
  setupTestUserWithHousehold,
  cleanupTestHousehold,
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

// ============================================================================
// INTEGRATION TEST SUITE: RULE EXECUTION LOGGING
// ============================================================================

describe("Integration: Rule Execution Logging", () => {
  let testUserId: string;
  let testHouseholdId: string;
  let testAccountId: string;
  let testCategoryId: string;
  let testMerchantId: string;

  // ============================================================================
  // SETUP & TEARDOWN
  // ============================================================================

  beforeEach(async () => {
    // Setup user with household FIRST (required for household isolation)
    const setup = await setupTestUserWithHousehold();
    testUserId = setup.userId;
    testHouseholdId = setup.householdId;

    // Create test account (now with householdId)
    const accountData = createTestAccount(testUserId, testHouseholdId, {
      name: "Test Checking",
      currentBalance: 1000.00,
    });
    const [account] = await db.insert(accounts).values(accountData).returning();
    testAccountId = account.id;
  });

  afterEach(async () => {
    // Cleanup all test data including household
    await cleanupTestHousehold(testUserId, testHouseholdId);
  });

  // ============================================================================
  // TEST 1: Audit Log - Successful Rule Application
  // ============================================================================

  it("should create complete audit log entry on successful rule application", async () => {
    // 1. Create test category
    const categoryData = createTestCategory(testUserId, testHouseholdId, {
      name: "Groceries",
      type: "variable_expense",
    });
    const [category] = await db.insert(budgetCategories).values(categoryData).returning();
    testCategoryId = category.id;

    // 2. Create rule
    const condition = createTestCondition("description", "contains", "Store");
    const action = createTestAction("set_category", { categoryId: testCategoryId });
    const ruleData = createTestRule(testUserId, testHouseholdId, [condition], [action], {
      name: "Grocery Store Rule",
    });
    const [rule] = await db.insert(categorizationRules).values(ruleData).returning();

    // 3. Create transaction (uncategorized)
    const txnData = createTestTransaction(testUserId, testHouseholdId, testAccountId, {
      description: "Grocery Store Purchase",
      categoryId: null,
    });
    const [txn] = await db.insert(transactions).values(txnData).returning();

    // 4. Build transaction data for rule matching
    const transactionData: TransactionData = {
      description: txn.description,
      amount: txn.amount,
      accountName: "Test Checking",
      date: txn.date,
      notes: txn.notes || undefined,
    };

    // 5. Find and apply matching rule
    const ruleMatch = await findMatchingRule(testUserId, testHouseholdId, transactionData);
    expect(ruleMatch.matched).toBe(true);
    expect(ruleMatch.rule).toBeTruthy();

    const result = await executeRuleActions(
      testUserId,
      ruleMatch.rule!.actions,
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

    // 6. Log execution
    await db.insert(ruleExecutionLog).values({
      id: nanoid(),
      userId: testUserId,
      householdId: testHouseholdId,
      ruleId: rule.id,
      transactionId: txn.id,
      appliedCategoryId: result.mutations.categoryId || null,
      appliedActions: result.appliedActions.length > 0
        ? JSON.stringify(result.appliedActions)
        : null,
      matched: true,
      executedAt: new Date().toISOString(),
    });

    // 7. Verify log entry created
    const logEntries = await db
      .select()
      .from(ruleExecutionLog)
      .where(eq(ruleExecutionLog.transactionId, txn.id));

    expect(logEntries).toHaveLength(1);

    // 8. Verify all required fields
    expectAuditLogEntry(logEntries[0], {
      ruleId: rule.id,
      transactionId: txn.id,
      appliedCategoryId: testCategoryId,
      matched: true,
      appliedActions: result.appliedActions,
    });

    // 9. Verify appliedActions structure
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

    // 10. Verify timestamps
    expect(logEntries[0].executedAt).toBeTruthy();
    expect(new Date(logEntries[0].executedAt).getTime()).toBeLessThanOrEqual(Date.now());
  });

  // ============================================================================
  // TEST 2: Audit Log - Multiple Actions Recorded
  // ============================================================================

  it("should record all applied actions in audit log", async () => {
    // 1. Create test category
    const categoryData = createTestCategory(testUserId, testHouseholdId, {
      name: "Dining",
      type: "variable_expense",
      isTaxDeductible: true, // Enable tax deduction
    });
    const [category] = await db.insert(budgetCategories).values(categoryData).returning();
    testCategoryId = category.id;

    // 2. Create test merchant
    const merchantData = createTestMerchant(testUserId, testHouseholdId, {
      name: "Restaurant ABC",
    });
    const [merchant] = await db.insert(merchants).values(merchantData).returning();
    testMerchantId = merchant.id;

    // 3. Create rule with 5 actions
    const condition = createTestCondition("description", "contains", "Restaurant");
    const actions = [
      createTestAction("set_category", { categoryId: testCategoryId }),
      createTestAction("set_merchant", { merchantId: testMerchantId }),
      createTestAction("prepend_description", { pattern: "[Dining] " }),
      createTestAction("append_description", { pattern: " - Reviewed" }),
      createTestAction("set_tax_deduction"),
    ];
    const ruleData = createTestRule(testUserId, testHouseholdId, [condition], actions, {
      name: "Dining Multi-Action Rule",
    });
    const [rule] = await db.insert(categorizationRules).values(ruleData).returning();

    // 4. Create transaction
    const txnData = createTestTransaction(testUserId, testHouseholdId, testAccountId, {
      description: "Restaurant Meal",
      categoryId: null,
    });
    const [txn] = await db.insert(transactions).values(txnData).returning();

    // 5. Build transaction data for rule matching
    const transactionData: TransactionData = {
      description: txn.description,
      amount: txn.amount,
      accountName: "Test Checking",
      date: txn.date,
      notes: txn.notes || undefined,
    };

    // 6. Find and apply matching rule
    const ruleMatch = await findMatchingRule(testUserId, testHouseholdId, transactionData);
    const result = await executeRuleActions(
      testUserId,
      ruleMatch.rule!.actions,
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
      null,
      { id: testCategoryId, name: "Dining", type: "expense" }
    );

    // 7. Log execution
    await db.insert(ruleExecutionLog).values({
      id: nanoid(),
      userId: testUserId,
      householdId: testHouseholdId,
      ruleId: rule.id,
      transactionId: txn.id,
      appliedCategoryId: result.mutations.categoryId || null,
      appliedActions: result.appliedActions.length > 0
        ? JSON.stringify(result.appliedActions)
        : null,
      matched: true,
      executedAt: new Date().toISOString(),
    });

    // 8. Verify log entry created
    const logEntries = await db
      .select()
      .from(ruleExecutionLog)
      .where(eq(ruleExecutionLog.transactionId, txn.id));

    expect(logEntries).toHaveLength(1);

    // 9. Verify all 5 actions recorded
    const appliedActions = typeof logEntries[0].appliedActions === 'string'
      ? JSON.parse(logEntries[0].appliedActions)
      : logEntries[0].appliedActions;

    expect(appliedActions).toHaveLength(5);

    // 10. Verify each action type is present
    const actionTypes = appliedActions.map((a: any) => a.type);
    expect(actionTypes).toContain("set_category");
    expect(actionTypes).toContain("set_merchant");
    expect(actionTypes).toContain("prepend_description");
    expect(actionTypes).toContain("append_description");
    expect(actionTypes).toContain("set_tax_deduction");
  });

  // ============================================================================
  // TEST 3: Audit Log - No Match, No Log
  // ============================================================================

  it("should not create log entry when no rules match", async () => {
    // 1. Create test category
    const categoryData = createTestCategory(testUserId, testHouseholdId, {
      name: "Shopping",
      type: "variable_expense",
    });
    const [category] = await db.insert(budgetCategories).values(categoryData).returning();
    testCategoryId = category.id;

    // 2. Create rule that won't match
    const condition = createTestCondition("description", "contains", "Store");
    const action = createTestAction("set_category", { categoryId: testCategoryId });
    const ruleData = createTestRule(testUserId, testHouseholdId, [condition], [action]);
    await db.insert(categorizationRules).values(ruleData);

    // 3. Create transaction that doesn't match
    const txnData = createTestTransaction(testUserId, testHouseholdId, testAccountId, {
      description: "Gas Station Purchase", // Doesn't contain "Store"
      categoryId: null,
    });
    const [txn] = await db.insert(transactions).values(txnData).returning();

    // 4. Build transaction data for rule matching
    const transactionData: TransactionData = {
      description: txn.description,
      amount: txn.amount,
      accountName: "Test Checking",
      date: txn.date,
      notes: txn.notes || undefined,
    };

    // 5. Try to find matching rule
    const ruleMatch = await findMatchingRule(testUserId, testHouseholdId, transactionData);

    // 6. Verify no match
    expect(ruleMatch.matched).toBe(false);
    expect(ruleMatch.rule).toBeUndefined();

    // 7. Verify no log entry created (we didn't create one)
    const logEntries = await db
      .select()
      .from(ruleExecutionLog)
      .where(eq(ruleExecutionLog.transactionId, txn.id));

    expect(logEntries).toHaveLength(0);

    // 8. Verify ruleExecutionLog table is empty for this user
    const allLogs = await db
      .select()
      .from(ruleExecutionLog)
      .where(eq(ruleExecutionLog.userId, testUserId));

    expect(allLogs).toHaveLength(0);
  });
});
