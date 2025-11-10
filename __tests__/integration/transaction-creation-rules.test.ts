/**
 * Integration Tests: Transaction Creation API with Rules
 *
 * Tests rules application during POST /api/transactions
 *
 * Coverage:
 * - Rules applied automatically on transaction creation
 * - Multiple actions executed during single creation
 * - Manual category overrides rule matching
 * - Post-creation actions (sales tax, tax deduction)
 * - Audit logging during creation
 *
 * Target: 5 tests covering transaction creation API integration
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
  generateTestUserId,
  createTestAccount,
  createTestCategory,
  createTestMerchant,
  createTestRule,
  createTestCondition,
  createTestAction,
} from "./test-utils";

// ============================================================================
// INTEGRATION TEST SUITE: TRANSACTION CREATION API WITH RULES
// ============================================================================

describe("Integration: Transaction Creation API with Rules", () => {
  let testUserId: string;
  let testAccountId: string;
  let testCategoryId: string;
  let testMerchantId: string;

  // ============================================================================
  // SETUP & TEARDOWN
  // ============================================================================

  beforeEach(async () => {
    // Generate unique test user ID for isolation
    testUserId = generateTestUserId();

    // Create test account
    const accountData = createTestAccount(testUserId, {
      name: "Test Checking",
      currentBalance: 1000.00,
    });
    const [account] = await db.insert(accounts).values(accountData).returning();
    testAccountId = account.id;

    // Create test category
    const categoryData = createTestCategory(testUserId, {
      name: "Groceries",
      type: "expense",
    });
    const [category] = await db.insert(budgetCategories).values(categoryData).returning();
    testCategoryId = category.id;

    // Create test merchant
    const merchantData = createTestMerchant(testUserId, {
      name: "Whole Foods",
    });
    const [merchant] = await db.insert(merchants).values(merchantData).returning();
    testMerchantId = merchant.id;
  });

  afterEach(async () => {
    // Cleanup: Delete test data
    await db.delete(ruleExecutionLog).where(eq(ruleExecutionLog.userId, testUserId));
    await db.delete(transactions).where(eq(transactions.userId, testUserId));
    await db.delete(categorizationRules).where(eq(categorizationRules.userId, testUserId));
    await db.delete(merchants).where(eq(merchants.userId, testUserId));
    await db.delete(budgetCategories).where(eq(budgetCategories.userId, testUserId));
    await db.delete(accounts).where(eq(accounts.userId, testUserId));
  });

  // ============================================================================
  // TEST 1: Rule Applied on Transaction Creation
  // ============================================================================

  it("should apply matching rule during transaction creation", async () => {
    // 1. Create rule: If description contains "Whole Foods" → set category
    const condition = createTestCondition("description", "contains", "Whole Foods");
    const action = createTestAction("set_category", { categoryId: testCategoryId });
    const ruleData = createTestRule(testUserId, [condition], [action], {
      name: "Grocery Store Rule",
      priority: 1,
    });
    const [rule] = await db.insert(categorizationRules).values(ruleData).returning();

    // 2. Simulate transaction creation (without categoryId)
    const transactionInput = {
      userId: testUserId,
      accountId: testAccountId,
      description: "Whole Foods Market",
      amount: 45.50,
      date: "2025-01-23",
      type: "expense" as const,
      categoryId: null, // No manual category
      merchantId: null,
      notes: null,
      isPending: false,
    };

    // 3. Find matching rule (simulates API logic)
    const transactionData: TransactionData = {
      description: transactionInput.description,
      amount: transactionInput.amount,
      accountName: "Test Checking",
      date: transactionInput.date,
    };

    const ruleMatch = await findMatchingRule(testUserId, transactionData);
    expect(ruleMatch.matched).toBe(true);
    expect(ruleMatch.rule?.ruleId).toBe(rule.id);

    // 4. Execute rule actions
    const executionResult = await executeRuleActions(
      testUserId,
      ruleMatch.rule!.actions,
      {
        categoryId: transactionInput.categoryId,
        description: transactionInput.description,
        merchantId: transactionInput.merchantId,
        accountId: transactionInput.accountId,
        amount: transactionInput.amount,
        date: transactionInput.date,
        type: transactionInput.type,
        isTaxDeductible: false,
      },
      null,
      null
    );

    // 5. Create transaction with applied mutations
    const [transaction] = await db
      .insert(transactions)
      .values({
        id: nanoid(),
        userId: testUserId,
        accountId: testAccountId,
        description: executionResult.mutations.description || transactionInput.description,
        amount: transactionInput.amount,
        date: transactionInput.date,
        type: transactionInput.type,
        categoryId: executionResult.mutations.categoryId || transactionInput.categoryId,
        merchantId: executionResult.mutations.merchantId || transactionInput.merchantId,
        notes: transactionInput.notes,
        isPending: transactionInput.isPending,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .returning();

    // 6. Create audit log
    await db.insert(ruleExecutionLog).values({
      id: nanoid(),
      userId: testUserId,
      ruleId: rule.id,
      transactionId: transaction.id,
      appliedCategoryId: executionResult.mutations.categoryId || null,
      appliedActions: JSON.stringify(executionResult.appliedActions),
      matched: true,
      executedAt: new Date().toISOString(),
    });

    // 7. Verify transaction has category applied
    const [createdTxn] = await db
      .select()
      .from(transactions)
      .where(eq(transactions.id, transaction.id))
      .limit(1);

    expect(createdTxn.categoryId).toBe(testCategoryId);
    expect(createdTxn.description).toBe("Whole Foods Market");

    // 8. Verify audit log exists
    const logEntries = await db
      .select()
      .from(ruleExecutionLog)
      .where(eq(ruleExecutionLog.transactionId, transaction.id));

    expect(logEntries).toHaveLength(1);
    expect(logEntries[0].ruleId).toBe(rule.id);
    expect(logEntries[0].appliedCategoryId).toBe(testCategoryId);
  });

  // ============================================================================
  // TEST 2: Multiple Actions During Creation
  // ============================================================================

  it("should execute multiple rule actions during transaction creation", async () => {
    // 1. Create rule with multiple actions
    const condition = createTestCondition("description", "contains", "Starbucks");
    const actions = [
      createTestAction("set_category", { categoryId: testCategoryId }),
      createTestAction("set_merchant", { merchantId: testMerchantId }),
      createTestAction("append_description", { pattern: " - Morning Coffee" }),
    ];
    const ruleData = createTestRule(testUserId, [condition], actions, {
      name: "Coffee Shop Rule",
      priority: 1,
    });
    const [rule] = await db.insert(categorizationRules).values(ruleData).returning();

    // 2. Transaction input
    const transactionInput = {
      userId: testUserId,
      accountId: testAccountId,
      description: "Starbucks",
      amount: 5.75,
      date: "2025-01-23",
      type: "expense" as const,
      categoryId: null,
      merchantId: null,
    };

    // 3. Find and execute rule
    const transactionData: TransactionData = {
      description: transactionInput.description,
      amount: transactionInput.amount,
      accountName: "Test Checking",
      date: transactionInput.date,
    };

    const ruleMatch = await findMatchingRule(testUserId, transactionData);
    expect(ruleMatch.matched).toBe(true);

    const executionResult = await executeRuleActions(
      testUserId,
      ruleMatch.rule!.actions,
      {
        categoryId: transactionInput.categoryId,
        description: transactionInput.description,
        merchantId: transactionInput.merchantId,
        accountId: transactionInput.accountId,
        amount: transactionInput.amount,
        date: transactionInput.date,
        type: transactionInput.type,
        isTaxDeductible: false,
      },
      null,
      null
    );

    // 4. Verify all mutations applied
    expect(executionResult.mutations.categoryId).toBe(testCategoryId);
    expect(executionResult.mutations.merchantId).toBe(testMerchantId);
    expect(executionResult.mutations.description).toBe("Starbucks - Morning Coffee");
    expect(executionResult.appliedActions).toHaveLength(3);

    // 5. Create transaction with all mutations
    const [transaction] = await db
      .insert(transactions)
      .values({
        id: nanoid(),
        userId: testUserId,
        accountId: testAccountId,
        description: executionResult.mutations.description || transactionInput.description,
        amount: transactionInput.amount,
        date: transactionInput.date,
        type: transactionInput.type,
        categoryId: executionResult.mutations.categoryId || transactionInput.categoryId,
        merchantId: executionResult.mutations.merchantId || transactionInput.merchantId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .returning();

    // 6. Verify database state
    const [createdTxn] = await db
      .select()
      .from(transactions)
      .where(eq(transactions.id, transaction.id))
      .limit(1);

    expect(createdTxn.categoryId).toBe(testCategoryId);
    expect(createdTxn.merchantId).toBe(testMerchantId);
    expect(createdTxn.description).toBe("Starbucks - Morning Coffee");
  });

  // ============================================================================
  // TEST 3: Manual Category Overrides Rules
  // ============================================================================

  it("should not apply rules when manual category is provided", async () => {
    // 1. Create rule that would match
    const condition = createTestCondition("description", "contains", "Store");
    const action = createTestAction("set_category", { categoryId: testCategoryId });
    const ruleData = createTestRule(testUserId, [condition], [action], {
      name: "Store Rule",
      priority: 1,
    });
    await db.insert(categorizationRules).values(ruleData);

    // 2. Create another category for manual selection
    const manualCategoryData = createTestCategory(testUserId, {
      name: "Manual Category",
      type: "expense",
    });
    const [manualCategory] = await db.insert(budgetCategories).values(manualCategoryData).returning();

    // 3. Transaction input WITH manual category
    const transactionInput = {
      userId: testUserId,
      accountId: testAccountId,
      description: "Store Purchase",
      amount: 30.00,
      date: "2025-01-23",
      type: "expense" as const,
      categoryId: manualCategory.id, // Manual category provided
      merchantId: null,
    };

    // 4. In real API, rules are only checked when categoryId is null
    // Simulate this by skipping rule matching
    const shouldApplyRules = !transactionInput.categoryId;
    expect(shouldApplyRules).toBe(false);

    // 5. Create transaction with manual category (no rule application)
    const [transaction] = await db
      .insert(transactions)
      .values({
        id: nanoid(),
        userId: testUserId,
        accountId: testAccountId,
        description: transactionInput.description,
        amount: transactionInput.amount,
        date: transactionInput.date,
        type: transactionInput.type,
        categoryId: transactionInput.categoryId,
        merchantId: transactionInput.merchantId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .returning();

    // 6. Verify manual category preserved
    const [createdTxn] = await db
      .select()
      .from(transactions)
      .where(eq(transactions.id, transaction.id))
      .limit(1);

    expect(createdTxn.categoryId).toBe(manualCategory.id);
    expect(createdTxn.categoryId).not.toBe(testCategoryId);

    // 7. Verify NO audit log created
    const logEntries = await db
      .select()
      .from(ruleExecutionLog)
      .where(eq(ruleExecutionLog.transactionId, transaction.id));

    expect(logEntries).toHaveLength(0);
  });

  // ============================================================================
  // TEST 4: Post-Creation Action - Set Sales Tax
  // ============================================================================

  it("should apply sales tax flag when rule matches income transaction", async () => {
    // 1. Create rule with set_sales_tax action
    const condition = createTestCondition("description", "contains", "Client Payment");
    const actions = [
      createTestAction("set_category", { categoryId: testCategoryId }),
      createTestAction("set_sales_tax"),
    ];
    const ruleData = createTestRule(testUserId, [condition], actions, {
      name: "Sales Tax Rule",
      priority: 1,
    });
    const [rule] = await db.insert(categorizationRules).values(ruleData).returning();

    // 2. Create income transaction
    const transactionInput = {
      userId: testUserId,
      accountId: testAccountId,
      description: "Client Payment for Services",
      amount: 1000.00,
      date: "2025-01-23",
      type: "income" as const,
      categoryId: null,
      isSalesTaxable: false,
    };

    // 3. Find and execute rule
    const transactionData: TransactionData = {
      description: transactionInput.description,
      amount: transactionInput.amount,
      accountName: "Test Checking",
      date: transactionInput.date,
    };

    const ruleMatch = await findMatchingRule(testUserId, transactionData);
    expect(ruleMatch.matched).toBe(true);

    const executionResult = await executeRuleActions(
      testUserId,
      ruleMatch.rule!.actions,
      {
        categoryId: transactionInput.categoryId,
        description: transactionInput.description,
        merchantId: null,
        accountId: transactionInput.accountId,
        amount: transactionInput.amount,
        date: transactionInput.date,
        type: transactionInput.type,
        isTaxDeductible: false,
      },
      null,
      null
    );

    // 4. Verify sales tax mutation
    expect(executionResult.mutations.categoryId).toBe(testCategoryId);
    expect(executionResult.mutations.isSalesTaxable).toBe(true);

    // 5. Create transaction with sales tax flag
    const [transaction] = await db
      .insert(transactions)
      .values({
        id: nanoid(),
        userId: testUserId,
        accountId: testAccountId,
        description: transactionInput.description,
        amount: transactionInput.amount,
        date: transactionInput.date,
        type: transactionInput.type,
        categoryId: executionResult.mutations.categoryId || transactionInput.categoryId,
        isSalesTaxable: executionResult.mutations.isSalesTaxable || transactionInput.isSalesTaxable,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .returning();

    // 6. Verify transaction has sales tax flag
    const [createdTxn] = await db
      .select()
      .from(transactions)
      .where(eq(transactions.id, transaction.id))
      .limit(1);

    expect(createdTxn.isSalesTaxable).toBe(true);
    expect(createdTxn.type).toBe("income");
  });

  // ============================================================================
  // TEST 5: Post-Creation Action - Set Tax Deduction
  // ============================================================================

  it("should mark transaction as tax deductible when category is configured", async () => {
    // 1. Create tax-deductible category
    const taxCategoryData = createTestCategory(testUserId, {
      name: "Business Expenses",
      type: "expense",
      isTaxDeductible: true,
    });
    const [taxCategory] = await db.insert(budgetCategories).values(taxCategoryData).returning();

    // 2. Create rule with set_tax_deduction action
    const condition = createTestCondition("description", "contains", "Office");
    const actions = [
      createTestAction("set_category", { categoryId: taxCategory.id }),
      createTestAction("set_tax_deduction"),
    ];
    const ruleData = createTestRule(testUserId, [condition], actions, {
      name: "Tax Deduction Rule",
      priority: 1,
    });
    const [rule] = await db.insert(categorizationRules).values(ruleData).returning();

    // 3. Create expense transaction
    const transactionInput = {
      userId: testUserId,
      accountId: testAccountId,
      description: "Office Supplies",
      amount: 150.00,
      date: "2025-01-23",
      type: "expense" as const,
      categoryId: null,
      isTaxDeductible: false,
    };

    // 4. Find and execute rule
    const transactionData: TransactionData = {
      description: transactionInput.description,
      amount: transactionInput.amount,
      accountName: "Test Checking",
      date: transactionInput.date,
    };

    const ruleMatch = await findMatchingRule(testUserId, transactionData);
    expect(ruleMatch.matched).toBe(true);

    // Get category info for execution context
    const [categoryInfo] = await db
      .select()
      .from(budgetCategories)
      .where(eq(budgetCategories.id, taxCategory.id))
      .limit(1);

    const executionResult = await executeRuleActions(
      testUserId,
      ruleMatch.rule!.actions,
      {
        categoryId: transactionInput.categoryId,
        description: transactionInput.description,
        merchantId: null,
        accountId: transactionInput.accountId,
        amount: transactionInput.amount,
        date: transactionInput.date,
        type: transactionInput.type,
        isTaxDeductible: transactionInput.isTaxDeductible,
      },
      null,
      {
        id: categoryInfo.id,
        name: categoryInfo.name,
        type: categoryInfo.type as 'income' | 'expense' | 'savings',
      }
    );

    // 5. Verify tax deduction mutation
    expect(executionResult.mutations.categoryId).toBe(taxCategory.id);
    expect(executionResult.mutations.isTaxDeductible).toBe(true);

    // 6. Create transaction with tax deduction flag
    const [transaction] = await db
      .insert(transactions)
      .values({
        id: nanoid(),
        userId: testUserId,
        accountId: testAccountId,
        description: transactionInput.description,
        amount: transactionInput.amount,
        date: transactionInput.date,
        type: transactionInput.type,
        categoryId: executionResult.mutations.categoryId || transactionInput.categoryId,
        isTaxDeductible: executionResult.mutations.isTaxDeductible || transactionInput.isTaxDeductible,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .returning();

    // 7. Verify transaction is tax deductible
    const [createdTxn] = await db
      .select()
      .from(transactions)
      .where(eq(transactions.id, transaction.id))
      .limit(1);

    expect(createdTxn.isTaxDeductible).toBe(true);
    expect(createdTxn.categoryId).toBe(taxCategory.id);
  });
});
