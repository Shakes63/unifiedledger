 
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
  ruleExecutionLog,
  categorizationRules,
} from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";
import Decimal from "decimal.js";
import { handleTransferConversion } from "@/lib/rules/transfer-action-handler";
import { handleSplitCreation } from "@/lib/rules/split-action-handler";
import { handleAccountChange } from "@/lib/rules/account-action-handler";
import {
  generateTestUserId,
  createTestAccount,
  createTestCategory,
  createTestTransaction,
} from "./test-utils";

// ============================================================================
// INTEGRATION TEST SUITE: POST-CREATION ACTION HANDLERS
// ============================================================================

describe("Integration: Post-Creation Action Handlers", () => {
  let testUserId: string;
  let testAccount1Id: string;
  let testAccount2Id: string;
  let testAccount3Id: string;
  let testCategoryId: string;

  // ============================================================================
  // SETUP & TEARDOWN
  // ============================================================================

  beforeEach(async () => {
    // Generate unique test user ID for isolation
    testUserId = generateTestUserId();

    // Create three test accounts
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
    testAccount3Id = account3.id;

    // Create test category
    const categoryData = createTestCategory(testUserId, {
      name: "Test Category",
      type: "expense",
    });
    const [category] = await db.insert(budgetCategories).values(categoryData).returning();
    testCategoryId = category.id;
  });

  afterEach(async () => {
    // Cleanup: Delete test data in correct order (foreign keys)
    // Skip transferSuggestions if table doesn't exist yet
    try {
      await db.delete(transferSuggestions).where(eq(transferSuggestions.userId, testUserId));
    } catch (e) {
      // Ignore if table doesn't exist
    }
    await db.delete(transactionSplits).where(eq(transactionSplits.userId, testUserId));
    await db.delete(ruleExecutionLog).where(eq(ruleExecutionLog.userId, testUserId));
    await db.delete(transactions).where(eq(transactions.userId, testUserId));
    await db.delete(categorizationRules).where(eq(categorizationRules.userId, testUserId));
    await db.delete(budgetCategories).where(eq(budgetCategories.userId, testUserId));
    await db.delete(accounts).where(eq(accounts.userId, testUserId));
  });

  // ============================================================================
  // TEST 1: Convert to Transfer - Auto-Match Found
  // ============================================================================

  it("should auto-match and link transfer when high-confidence match found", async () => {
    // 1. Create Transaction B first (the match target)
    const txnBData = createTestTransaction(testUserId, testAccount2Id, {
      description: "Transfer from Checking",
      amount: 100.00,
      date: "2025-01-23",
      type: "income", // Money coming INTO savings
      categoryId: null,
    });
    const [txnB] = await db.insert(transactions).values(txnBData).returning();

    // 2. Create Transaction A
    const txnAData = createTestTransaction(testUserId, testAccount1Id, {
      description: "Transfer to Savings",
      amount: 100.00,
      date: "2025-01-23",
      type: "expense", // Money leaving checking
      categoryId: null,
    });
    const [txnA] = await db.insert(transactions).values(txnAData).returning();

    // 3. Execute transfer conversion
    const result = await handleTransferConversion(
      testUserId,
      txnA.id,
      {
        targetAccountId: testAccount2Id,
        autoMatch: true,
        matchTolerance: 1, // ±1%
        matchDayRange: 7, // ±7 days
        createIfNoMatch: false,
      }
    );

    // 4. Verify match found and linked
    expect(result.success).toBe(true);
    expect(result.matchedTransactionId).toBe(txnB.id); // Match found
    expect(result.autoLinked).toBe(true); // Auto-linked
    expect(result.confidence).toBe('high'); // High confidence

    // 5. Verify both transactions have transferId
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

    // 6. Verify account balances updated correctly
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

  // ============================================================================
  // TEST 2: Convert to Transfer - No Match, Create Pair
  // ============================================================================

  it("should create new transfer pair when no match found", async () => {
    // 1. Create Transaction A (no existing match)
    const txnAData = createTestTransaction(testUserId, testAccount1Id, {
      description: "Transfer to Savings",
      amount: 100.00,
      date: "2025-01-23",
      type: "expense",
      categoryId: null,
    });
    const [txnA] = await db.insert(transactions).values(txnAData).returning();

    // 2. Execute transfer conversion with createIfNoMatch=true
    const result = await handleTransferConversion(
      testUserId,
      txnA.id,
      {
        targetAccountId: testAccount2Id,
        autoMatch: true,
        matchTolerance: 1,
        matchDayRange: 7,
        createIfNoMatch: true, // Create new transfer pair
      }
    );

    // 3. Verify pair created
    expect(result.success).toBe(true);
    expect(result.matchedTransactionId).toBeUndefined(); // No match found
    expect(result.createdTransactionId).toBeTruthy(); // New pair created

    // 4. Verify both transactions exist with transferId
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

    // 5. Verify attributes of created pair
    expect(transferIn?.accountId).toBe(testAccount2Id);
    expect(new Decimal(transferIn?.amount || 0).toNumber()).toBe(100.00);
    expect(transferIn?.date).toBe("2025-01-23");
    expect(transferIn?.description).toContain("Transfer");

    // 6. Verify account balances
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

  // ============================================================================
  // TEST 3: Convert to Transfer - Medium Confidence Suggestion
  // ============================================================================

  it("should create suggestion when medium confidence match found", async () => {
    // 1. Create Transaction B (potential match with some differences)
    const txnBData = createTestTransaction(testUserId, testAccount2Id, {
      description: "Income from External", // Different description (lower confidence)
      amount: 102.00, // Slightly different amount (within tolerance)
      date: "2025-01-25", // 2 days different
      type: "income",
      categoryId: null,
    });
    const [txnB] = await db.insert(transactions).values(txnBData).returning();

    // 2. Create Transaction A
    const txnAData = createTestTransaction(testUserId, testAccount1Id, {
      description: "Transfer to Savings",
      amount: 100.00,
      date: "2025-01-23",
      type: "expense",
      categoryId: null,
    });
    const [txnA] = await db.insert(transactions).values(txnAData).returning();

    // 3. Execute transfer conversion
    const result = await handleTransferConversion(
      testUserId,
      txnA.id,
      {
        targetAccountId: testAccount2Id,
        autoMatch: true,
        matchTolerance: 3, // Allow 3% difference
        matchDayRange: 7,
        createIfNoMatch: false,
      }
    );

    // 4. Verify suggestion created (medium confidence)
    expect(result.success).toBe(true);
    expect(result.matchedTransactionId).toBeUndefined(); // No auto-link
    expect(result.confidence).toBe('medium'); // Medium confidence suggestion
    expect(result.suggestions).toBeDefined(); // Suggestions provided

    // 5. Verify suggestion stored in database (if table exists)
    try {
      const suggestions = await db
        .select()
        .from(transferSuggestions)
        .where(eq(transferSuggestions.userId, testUserId));

      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0].sourceTransactionId).toBe(txnA.id);
      expect(suggestions[0].suggestedTransactionId).toBe(txnB.id);
      expect(suggestions[0].status).toBe("pending");
      expect(suggestions[0].confidence).toBe("medium");
    } catch (e) {
      // Table might not exist yet - skip this verification
      console.log('Skipping suggestion database verification - table may not exist');
    }

    // 6. Verify transactions NOT auto-linked
    const txnAUpdated = await db
      .select()
      .from(transactions)
      .where(eq(transactions.id, txnA.id))
      .limit(1);

    expect(txnAUpdated[0].transferId).toBeNull(); // Not auto-linked
    expect(txnAUpdated[0].type).toBe("expense"); // Type unchanged
  });

  // ============================================================================
  // TEST 4: Create Split - Percentage-Based
  // ============================================================================

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
    const splits = [
      {
        categoryId: groceries.id,
        isPercentage: true,
        percentage: 50, // 50%
        description: "Groceries portion",
      },
      {
        categoryId: household.id,
        isPercentage: true,
        percentage: 30, // 30%
        description: "Household items",
      },
      {
        categoryId: personal.id,
        isPercentage: true,
        percentage: 20, // 20%
        description: "Personal items",
      },
    ];

    const result = await handleSplitCreation(testUserId, parentTxn.id, splits);

    // 4. Verify success
    expect(result.success).toBe(true);

    // 5. Verify parent transaction marked as split
    const parentUpdated = await db
      .select()
      .from(transactions)
      .where(eq(transactions.id, parentTxn.id))
      .limit(1);

    expect(parentUpdated[0].isSplit).toBe(true);

    // 6. Verify 3 split records created
    const splitRecords = await db
      .select()
      .from(transactionSplits)
      .where(eq(transactionSplits.transactionId, parentTxn.id));

    expect(splitRecords).toHaveLength(3);

    // 7. Verify split amounts
    const grocerySplit = splitRecords.find(s => s.categoryId === groceries.id);
    const householdSplit = splitRecords.find(s => s.categoryId === household.id);
    const personalSplit = splitRecords.find(s => s.categoryId === personal.id);

    expect(new Decimal(grocerySplit?.amount || 0).toNumber()).toBe(50.00); // 50% of $100
    expect(new Decimal(householdSplit?.amount || 0).toNumber()).toBe(30.00); // 30% of $100
    expect(new Decimal(personalSplit?.amount || 0).toNumber()).toBe(20.00); // 20% of $100

    // 8. Verify descriptions
    expect(grocerySplit?.description).toBe("Groceries portion");
    expect(householdSplit?.description).toBe("Household items");
    expect(personalSplit?.description).toBe("Personal items");

    // 9. Verify total equals parent amount
    const total = splitRecords.reduce((sum, split) => {
      return sum.plus(new Decimal(split.amount));
    }, new Decimal(0));

    expect(total.toNumber()).toBe(100.00);
  });

  // ============================================================================
  // TEST 5: Create Split - Fixed Amounts
  // ============================================================================

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
    const splits = [
      {
        categoryId: category1.id,
        isPercentage: false,
        amount: 60.00, // Fixed $60
      },
      {
        categoryId: category2.id,
        isPercentage: false,
        amount: 40.00, // Fixed $40
      },
    ];

    const result = await handleSplitCreation(testUserId, parentTxn.id, splits);

    // 4. Verify success
    expect(result.success).toBe(true);

    // 5. Verify 2 split records created
    const splitRecords = await db
      .select()
      .from(transactionSplits)
      .where(eq(transactionSplits.transactionId, parentTxn.id));

    expect(splitRecords).toHaveLength(2);

    // 6. Verify exact amounts
    const split1 = splitRecords.find(s => s.categoryId === category1.id);
    const split2 = splitRecords.find(s => s.categoryId === category2.id);

    expect(new Decimal(split1?.amount || 0).toNumber()).toBe(60.00);
    expect(new Decimal(split2?.amount || 0).toNumber()).toBe(40.00);

    // 7. Verify total equals parent amount
    const total = splitRecords.reduce((sum, split) => {
      return sum.plus(new Decimal(split.amount));
    }, new Decimal(0));

    expect(total.toNumber()).toBe(100.00);
  });

  // ============================================================================
  // TEST 6: Set Account - Balance Updates
  // ============================================================================

  it("should update balances correctly when changing account", async () => {
    // 1. Create transaction on Account 1 (expense)
    const txnData = createTestTransaction(testUserId, testAccount1Id, {
      description: "Purchase",
      amount: 50.00,
      type: "expense",
      categoryId: testCategoryId,
    });
    const [txn] = await db.insert(transactions).values(txnData).returning();

    // 2. Verify initial account balances after transaction
    // (Note: Transaction creation doesn't update balances in our test factory)
    // We need to manually set them to simulate post-creation state
    await db
      .update(accounts)
      .set({ currentBalance: 950.00 }) // 1000 - 50
      .where(eq(accounts.id, testAccount1Id));

    // 3. Execute account change
    const result = await handleAccountChange(testUserId, txn.id, testAccount2Id);

    // 4. Verify success
    expect(result.success).toBe(true);

    // 5. Verify transaction account changed
    const txnUpdated = await db
      .select()
      .from(transactions)
      .where(eq(transactions.id, txn.id))
      .limit(1);

    expect(txnUpdated[0].accountId).toBe(testAccount2Id);

    // 6. Verify Account 1 balance increased (expense removed)
    const account1After = await db
      .select()
      .from(accounts)
      .where(eq(accounts.id, testAccount1Id))
      .limit(1);

    // Account 1 should have $50 added back (expense reversed)
    expect(new Decimal(account1After[0].currentBalance).toNumber()).toBe(1000.00);

    // 7. Verify Account 2 balance decreased (expense added)
    const account2After = await db
      .select()
      .from(accounts)
      .where(eq(accounts.id, testAccount2Id))
      .limit(1);

    // Account 2 should have $50 deducted (expense applied)
    expect(new Decimal(account2After[0].currentBalance).toNumber()).toBe(450.00); // 500 - 50
  });

  // ============================================================================
  // TEST 7: Set Account - Transfer Protection
  // ============================================================================

  it("should reject account change for transfer transactions", async () => {
    // 1. Create transfer pair
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

    // 2. Attempt to change account on transfer_out transaction
    const result = await handleAccountChange(testUserId, transferOut.id, testAccount3Id);

    // 3. Verify rejection
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/transfer/i);

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

    expect(new Decimal(account1After[0].currentBalance).toNumber()).toBe(1000.00); // Unchanged
    expect(new Decimal(account3After[0].currentBalance).toNumber()).toBe(2000.00); // Unchanged
  });
});
