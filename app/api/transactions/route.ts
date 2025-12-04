import { requireAuth } from '@/lib/auth-helpers';
import { getHouseholdIdFromRequest, requireHouseholdAuth } from '@/lib/api/household-auth';
import { db } from '@/lib/db';
import { transactions, accounts, budgetCategories, merchants, usageAnalytics, ruleExecutionLog, bills, billInstances, debts, debtPayments, betterAuthUser } from '@/lib/db/schema';
import { eq, and, desc, asc, inArray, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import Decimal from 'decimal.js';
import { findMatchingRule } from '@/lib/rules/rule-matcher';
import { TransactionData } from '@/lib/rules/condition-evaluator';
import { executeRuleActions } from '@/lib/rules/actions-executor';
import { handleTransferConversion } from '@/lib/rules/transfer-action-handler';
import { handleSplitCreation } from '@/lib/rules/split-action-handler';
import { handleAccountChange } from '@/lib/rules/account-action-handler';
import { findMatchingBillInstance } from '@/lib/bills/bill-matching-helpers';
import { calculatePaymentBreakdown } from '@/lib/debts/payment-calculator';
import { batchUpdateMilestones } from '@/lib/debts/milestone-utils';
import { processBillPayment, findCreditPaymentBillInstance } from '@/lib/bills/bill-payment-utils';
import { getCombinedTransferViewPreference } from '@/lib/preferences/transfer-view-preference';
import { logTransactionAudit, createTransactionSnapshot } from '@/lib/transactions/audit-logger';
import { autoClassifyTransaction } from '@/lib/tax/auto-classify';
import { handleGoalContribution, handleMultipleContributions } from '@/lib/goals/contribution-handler';
// Sales tax now handled as boolean flag on transaction, no separate records needed

// Type for goal contributions in split mode
interface GoalContribution {
  goalId: string;
  amount: number;
}

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  // OPTIMIZATION: Performance monitoring (Task 8)
  const startTime = performance.now();

  try {
    const { userId } = await requireAuth();

    const body = await request.json();

    // Get and validate household
    const householdId = getHouseholdIdFromRequest(request, body);
    await requireHouseholdAuth(userId, householdId);
    // TypeScript: householdId is guaranteed to be non-null after requireHouseholdAuth
    if (!householdId) {
      return Response.json(
        { error: 'Household ID is required' },
        { status: 400 }
  );
}

    const {
      accountId,
      categoryId,
      merchantId,
      debtId, // For direct debt payments
      billInstanceId, // For direct bill payment matching
      date,
      amount,
      description,
      notes,
      type = 'expense',
      isPending = false,
      toAccountId, // For transfers
      isSalesTaxable = false, // Sales taxable flag (boolean)
      // Offline sync tracking fields
      offlineId,
      syncStatus = 'synced',
      // Phase 18: Savings goal linking
      savingsGoalId, // Single goal link
      goalContributions, // Split across multiple goals: { goalId: string, amount: number }[]
    } = body;

    // Validate required fields
    if (!accountId || !date || !amount || !description) {
      return Response.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate toAccountId for transfers
    if (type === 'transfer' && !toAccountId) {
      return Response.json(
        { error: 'Transfer requires a destination account (toAccountId)' },
        { status: 400 }
      );
    }

    // OPTIMIZATION: Parallel validation queries (Task 1)
    // Fetch account, toAccount, and category in parallel instead of sequentially
    const [account, toAccountResult, categoryResult] = await Promise.all([
      // Query 1: Always validate source account
      db
        .select()
        .from(accounts)
        .where(
          and(
            eq(accounts.id, accountId),
            eq(accounts.userId, userId),
            eq(accounts.householdId, householdId)
          )
        )
        .limit(1),

      // Query 2: Validate destination account (only for transfers)
      type === 'transfer' && toAccountId
        ? db
            .select()
            .from(accounts)
            .where(
              and(
                eq(accounts.id, toAccountId),
                eq(accounts.userId, userId),
                eq(accounts.householdId, householdId)
              )
            )
            .limit(1)
        : Promise.resolve([]),

      // Query 3: Validate category (only if provided)
      categoryId
        ? db
            .select()
            .from(budgetCategories)
            .where(
              and(
                eq(budgetCategories.id, categoryId),
                eq(budgetCategories.userId, userId),
                eq(budgetCategories.householdId, householdId)
              )
            )
            .limit(1)
        : Promise.resolve([]),
    ]);

    // Validate account exists
    if (account.length === 0) {
      return Response.json(
        { error: 'Account not found' },
        { status: 404 }
      );
    }

    // Validate toAccount for transfers
    let toAccount = null;
    if (type === 'transfer' && toAccountId) {
      if (toAccountResult.length === 0) {
        return Response.json(
          { error: 'Destination account not found' },
          { status: 404 }
        );
      }
      toAccount = toAccountResult[0];
    }

    // Validate category if provided
    if (categoryId && categoryResult.length === 0) {
      return Response.json(
        { error: 'Category not found' },
        { status: 404 }
      );
    }

    // Apply categorization rules if no category provided
    let appliedCategoryId = categoryId;
    let appliedRuleId: string | null = null;
    let appliedActions: any[] = [];
    let finalDescription = description;
    let finalMerchantId = merchantId;
    let postCreationMutations: any = null;

    if (!appliedCategoryId && type !== 'transfer_in' && type !== 'transfer_out' && type !== 'transfer') {
      try {
        const transactionData: TransactionData = {
          description,
          amount: parseFloat(amount),
          accountName: account[0].name,
          date,
          notes: notes || undefined,
        };

        const ruleMatch = await findMatchingRule(userId, householdId, transactionData);

        if (ruleMatch.matched && ruleMatch.rule) {
          appliedRuleId = ruleMatch.rule.ruleId;

          // OPTIMIZATION: Fetch merchant and category info in parallel (Task 1)
          const [merchantResult, categoryInfoResult] = await Promise.all([
            // Fetch merchant info if provided
            merchantId
              ? db
                  .select()
                  .from(merchants)
                  .where(
                    and(
                      eq(merchants.id, merchantId),
                      eq(merchants.userId, userId),
                      eq(merchants.householdId, householdId)
                    )
                  )
                  .limit(1)
              : Promise.resolve([]),

            // Fetch category info if provided
            categoryId
              ? db
                  .select()
                  .from(budgetCategories)
                  .where(
                    and(
                      eq(budgetCategories.id, categoryId),
                      eq(budgetCategories.userId, userId),
                      eq(budgetCategories.householdId, householdId)
                    )
                  )
                  .limit(1)
              : Promise.resolve([]),
          ]);

          // Build merchant info object
          let merchantInfo = null;
          if (merchantResult.length > 0) {
            merchantInfo = {
              id: merchantResult[0].id,
              name: merchantResult[0].name,
            };
          }

          // Build category info object
          let categoryInfo = null;
          if (categoryInfoResult.length > 0) {
            categoryInfo = {
              id: categoryInfoResult[0].id,
              name: categoryInfoResult[0].name,
              type: categoryInfoResult[0].type,
            };
          }

          // Execute rule actions
          const executionResult = await executeRuleActions(
            userId,
            ruleMatch.rule.actions,
            {
              categoryId: appliedCategoryId || null,
              description,
              merchantId: merchantId || null,
              accountId,
              amount: parseFloat(amount),
              date,
              type,
              isTaxDeductible: false,
            },
            merchantInfo,
            categoryInfo
          );

          // Apply mutations
          if (executionResult.mutations.categoryId !== undefined) {
            appliedCategoryId = executionResult.mutations.categoryId;
          }
          if (executionResult.mutations.description) {
            finalDescription = executionResult.mutations.description;
          }
          if (executionResult.mutations.merchantId !== undefined) {
            finalMerchantId = executionResult.mutations.merchantId;
          }

          // Store applied actions for logging
          appliedActions = executionResult.appliedActions;

          // Store execution result for post-creation processing
          postCreationMutations = executionResult.mutations;

          // Log any errors from action execution (non-fatal)
          if (executionResult.errors && executionResult.errors.length > 0) {
            console.warn('Rule action execution errors:', executionResult.errors);
          }
        }
      } catch (error) {
        // Log error but don't fail transaction creation
        console.error('Error applying categorization rules:', error);
      }
    }

    // Create transaction(s)
    const decimalAmount = new Decimal(amount);
    const transactionId = nanoid();
    let transferInId: string | null = null;

    // OPTIMIZATION: Create TWO transactions for transfers (Task 7: ~30-50% faster)
    // Batch all inserts and updates in parallel
    if (type === 'transfer' && toAccount) {
      // Generate transfer_in ID
      transferInId = nanoid();

      // PHASE 5: Detect balance transfers (credit-to-credit)
      const sourceIsCreditAccount = account[0].type === 'credit' || account[0].type === 'line_of_credit';
      const destIsCreditAccount = toAccount.type === 'credit' || toAccount.type === 'line_of_credit';
      const isBalanceTransfer = sourceIsCreditAccount && destIsCreditAccount;

      // Calculate account balances
      const sourceBalance = new Decimal(account[0].currentBalance || 0);
      const updatedSourceBalance = sourceBalance.minus(decimalAmount);
      const destBalance = new Decimal(toAccount.currentBalance || 0);
      const updatedDestBalance = destBalance.plus(decimalAmount);

      // Batch all transfer operations in parallel
      await Promise.all([
        // Create transfer_out transaction
        db.insert(transactions).values({
          id: transactionId,
          userId,
          householdId,
          accountId, // Source account
          categoryId: null, // Transfers don't have categories
          merchantId: null,
          date,
          amount: decimalAmount.toNumber(),
          description,
          notes: notes || null,
          type: 'transfer_out',
          transferId: toAccountId,
          isPending,
          isBalanceTransfer, // PHASE 5: Mark as balance transfer if credit-to-credit
          offlineId: offlineId || null,
          syncStatus: syncStatus,
          syncedAt: syncStatus === 'synced' ? new Date().toISOString() : null,
          syncAttempts: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),

        // Create transfer_in transaction
        db.insert(transactions).values({
          id: transferInId,
          userId,
          householdId,
          accountId: toAccountId, // Destination account
          categoryId: null,
          merchantId: null,
          savingsGoalId: savingsGoalId || null, // Phase 18: Link to savings goal
          date,
          amount: decimalAmount.toNumber(),
          description,
          notes: notes || null,
          type: 'transfer_in',
          transferId: transactionId,
          isPending,
          isBalanceTransfer, // PHASE 5: Mark as balance transfer if credit-to-credit
          offlineId: offlineId ? `${offlineId}_in` : null,
          syncStatus: syncStatus,
          syncedAt: syncStatus === 'synced' ? new Date().toISOString() : null,
          syncAttempts: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),

        // Update source account balance
        db
          .update(accounts)
          .set({
            currentBalance: updatedSourceBalance.toNumber(),
            lastUsedAt: new Date().toISOString(),
            usageCount: (account[0].usageCount || 0) + 1,
          })
          .where(eq(accounts.id, accountId)),

        // Update destination account balance
        db
          .update(accounts)
          .set({
            currentBalance: updatedDestBalance.toNumber(),
            lastUsedAt: new Date().toISOString(),
            usageCount: (toAccount.usageCount || 0) + 1,
          })
          .where(eq(accounts.id, toAccountId)),
      ]);

      // Track transfer pair usage in analytics (separate to avoid blocking main operations)
      try {
        const existingAnalytics = await db
          .select()
          .from(usageAnalytics)
          .where(
            and(
              eq(usageAnalytics.userId, userId),
              eq(usageAnalytics.householdId, householdId),
              eq(usageAnalytics.itemType, 'transfer_pair'),
              eq(usageAnalytics.itemId, accountId),
              eq(usageAnalytics.itemSecondaryId, toAccountId)
            )
          )
          .limit(1);

        // Upsert analytics
        if (existingAnalytics.length > 0) {
          await db
            .update(usageAnalytics)
            .set({
              usageCount: (existingAnalytics[0].usageCount || 0) + 1,
              lastUsedAt: new Date().toISOString(),
            })
            .where(
              and(
                eq(usageAnalytics.userId, userId),
                eq(usageAnalytics.householdId, householdId),
                eq(usageAnalytics.itemType, 'transfer_pair'),
                eq(usageAnalytics.itemId, accountId),
                eq(usageAnalytics.itemSecondaryId, toAccountId)
              )
            );
        } else {
          await db.insert(usageAnalytics).values({
            id: nanoid(),
            userId,
            householdId,
            itemType: 'transfer_pair',
            itemId: accountId,
            itemSecondaryId: toAccountId,
            usageCount: 1,
            lastUsedAt: new Date().toISOString(),
            createdAt: new Date().toISOString(),
          });
        }
      } catch (error) {
        console.error('Error tracking transfer pair usage:', error);
      }

      // PHASE 5: Auto-detect credit card payments
      // When transferring TO a credit card or line of credit, auto-mark linked bill instance as paid
      // SKIP for balance transfers (credit-to-credit) - those are not payments
      if (toAccount && (toAccount.type === 'credit' || toAccount.type === 'line_of_credit') && !isBalanceTransfer) {
        try {
          // Find linked payment bill for this credit account
          const billMatch = await findCreditPaymentBillInstance(
            toAccountId,
            decimalAmount.toNumber(),
            date,
            userId,
            householdId,
            7 // Date tolerance: 7 days
          );

          if (billMatch) {
            // Process the payment using the new bill payment utility
            const paymentResult = await processBillPayment({
              billId: billMatch.billId,
              instanceId: billMatch.instanceId,
              transactionId: transferInId!, // Use the transfer_in transaction as the linked transaction
              paymentAmount: decimalAmount.toNumber(),
              paymentDate: date,
              userId,
              householdId,
              paymentMethod: 'transfer',
              linkedAccountId: accountId, // The source account (where payment came from)
              notes: `Auto-linked from transfer: ${description}`,
            });

            if (paymentResult.success) {
              console.log(`Credit card payment auto-linked: Bill ${billMatch.billId}, Instance ${billMatch.instanceId}, Status: ${paymentResult.paymentStatus}`);
            }
          }
        } catch (error) {
          // Non-blocking: Don't fail the transfer if bill matching fails
          console.error('Error auto-linking credit card payment to bill:', error);
        }
      }

      // Phase 18: Handle savings goal contributions for transfers
      // Use transferInId for the contribution since it's the transfer_in that goes to the savings account
      if (transferInId && (savingsGoalId || (goalContributions && goalContributions.length > 0))) {
        try {
          if (goalContributions && goalContributions.length > 0) {
            // Split contributions across multiple goals
            const contributionResults = await handleMultipleContributions(
              goalContributions as GoalContribution[],
              transferInId,
              userId,
              householdId
            );
            const achievedMilestones = contributionResults.flatMap(r => r.milestonesAchieved);
            if (achievedMilestones.length > 0) {
              console.log(`Transfer ${transferInId}: Milestones achieved: ${achievedMilestones.join(', ')}%`);
            }
          } else if (savingsGoalId) {
            // Single goal contribution
            const result = await handleGoalContribution(
              savingsGoalId,
              decimalAmount.toNumber(),
              transferInId,
              userId,
              householdId
            );
            if (result.milestonesAchieved.length > 0) {
              console.log(`Transfer ${transferInId}: Milestones achieved: ${result.milestonesAchieved.join(', ')}%`);
            }
          }
        } catch (error) {
          // Non-blocking: Don't fail the transfer if goal contribution fails
          console.error('Error handling savings goal contribution:', error);
        }
      }
    } else {
      // Non-transfer transaction (income or expense)
      
      // Check if merchant is sales tax exempt (for income transactions)
      let merchantIsSalesTaxExempt = false;
      if (type === 'income' && finalMerchantId) {
        const merchantExemptCheck = await db
          .select({ isSalesTaxExempt: merchants.isSalesTaxExempt })
          .from(merchants)
          .where(eq(merchants.id, finalMerchantId))
          .limit(1);
        merchantIsSalesTaxExempt = merchantExemptCheck[0]?.isSalesTaxExempt || false;
      }

      // PHASE 5: Detect credit card refunds
      // Income on a credit account is a refund (reduces balance/debt)
      const accountIsCreditAccount = account[0].type === 'credit' || account[0].type === 'line_of_credit';
      const isRefund = type === 'income' && accountIsCreditAccount;
      
      await db.insert(transactions).values({
        id: transactionId,
        userId,
        householdId,
        accountId,
        categoryId: appliedCategoryId || null,
        merchantId: finalMerchantId || null,
        debtId: debtId || null,
        savingsGoalId: savingsGoalId || null, // Phase 18: Link to savings goal
        date,
        amount: decimalAmount.toNumber(),
        description: finalDescription,
        notes: notes || null,
        type,
        transferId: null,
        isPending,
        isRefund, // PHASE 5: Mark as refund if income on credit account
        isTaxDeductible: postCreationMutations?.isTaxDeductible || false,
        // Auto-detect tax deduction type based on account's tax deduction tracking flag
        // Falls back to isBusinessAccount for backward compatibility
        taxDeductionType: (postCreationMutations?.isTaxDeductible) 
          ? ((account[0].enableTaxDeductions ?? account[0].isBusinessAccount) ? 'business' : 'personal')
          : 'none',
        // Auto-exclude sales tax if merchant is tax exempt
        isSalesTaxable: (type === 'income' && !merchantIsSalesTaxExempt && (isSalesTaxable || postCreationMutations?.isSalesTaxable)) || false,
        // Offline sync tracking
        offlineId: offlineId || null,
        syncStatus: syncStatus,
        syncedAt: syncStatus === 'synced' ? new Date().toISOString() : null,
        syncAttempts: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      // Update account balance and usage
      const newBalance = new Decimal(account[0].currentBalance || 0);
      const updatedBalance =
        type === 'expense'
          ? newBalance.minus(decimalAmount)
          : newBalance.plus(decimalAmount);

      await db
        .update(accounts)
        .set({
          currentBalance: updatedBalance.toNumber(),
          lastUsedAt: new Date().toISOString(),
          usageCount: (account[0].usageCount || 0) + 1,
        })
        .where(eq(accounts.id, accountId));

      // Handle post-creation actions (convert to transfer, etc.)
      if (postCreationMutations?.convertToTransfer) {
        try {
          const transferResult = await handleTransferConversion(
            userId,
            transactionId,
            postCreationMutations.convertToTransfer
          );

          if (!transferResult.success) {
            console.error('Transfer conversion failed:', transferResult.error);
            // Don't fail the transaction, just log the error
          } else if (transferResult.matchedTransactionId) {
            console.log(`Transfer conversion: matched with transaction ${transferResult.matchedTransactionId}`);
          } else if (transferResult.createdTransactionId) {
            console.log(`Transfer conversion: created new transaction ${transferResult.createdTransactionId}`);
          }
        } catch (error) {
          console.error('Transfer conversion error:', error);
          // Don't fail the transaction
        }
      }

      // Handle split creation
      if (postCreationMutations?.createSplits) {
        try {
          const splitResult = await handleSplitCreation(
            userId,
            transactionId,
            postCreationMutations.createSplits
          );

          if (!splitResult.success) {
            console.error('Split creation failed:', splitResult.error);
            // Don't fail the transaction, just log the error
          } else {
            console.log(`Split creation: created ${splitResult.createdSplits.length} splits`);
          }
        } catch (error) {
          console.error('Split creation error:', error);
          // Don't fail the transaction
        }
      }

      // Handle account change
      if (postCreationMutations?.changeAccount) {
        try {
          const accountResult = await handleAccountChange(
            userId,
            transactionId,
            postCreationMutations.changeAccount.targetAccountId
          );

          if (!accountResult.success) {
            console.error('Account change failed:', accountResult.error);
            // Don't fail the transaction, just log the error
          } else {
            console.log(`Account change: moved from ${accountResult.oldAccountId} to ${accountResult.newAccountId}`);
          }
        } catch (error) {
          console.error('Account change error:', error);
          // Don't fail the transaction
        }
      }

      // Sales tax is now handled as a boolean flag on the transaction itself
      // No separate salesTaxTransactions records needed for simplified tracking

      // Auto-classify transaction for tax purposes if marked as tax deductible
      // Creates transactionTaxClassifications record if category has a tax mapping
      const isTaxDeductible = postCreationMutations?.isTaxDeductible || false;
      if (isTaxDeductible && appliedCategoryId) {
        try {
          const taxClassification = await autoClassifyTransaction(
            userId,
            transactionId,
            appliedCategoryId,
            decimalAmount.toNumber(),
            date,
            isTaxDeductible
          );
          if (taxClassification) {
            console.log(`[TAX] Auto-classified transaction ${transactionId} to ${taxClassification.taxCategoryName}`);
          }
        } catch (error) {
          // Non-fatal: don't fail transaction creation if tax classification fails
          console.error('Error auto-classifying transaction for tax:', error);
        }
      }

      // Phase 18: Handle savings goal contributions for non-transfer transactions
      if (savingsGoalId || (goalContributions && goalContributions.length > 0)) {
        try {
          if (goalContributions && goalContributions.length > 0) {
            // Split contributions across multiple goals
            const contributionResults = await handleMultipleContributions(
              goalContributions as GoalContribution[],
              transactionId,
              userId,
              householdId
            );
            const achievedMilestones = contributionResults.flatMap(r => r.milestonesAchieved);
            if (achievedMilestones.length > 0) {
              console.log(`Transaction ${transactionId}: Milestones achieved: ${achievedMilestones.join(', ')}%`);
            }
          } else if (savingsGoalId) {
            // Single goal contribution
            const result = await handleGoalContribution(
              savingsGoalId,
              decimalAmount.toNumber(),
              transactionId,
              userId,
              householdId
            );
            if (result.milestonesAchieved.length > 0) {
              console.log(`Transaction ${transactionId}: Milestones achieved: ${result.milestonesAchieved.join(', ')}%`);
            }
          }
        } catch (error) {
          // Non-blocking: Don't fail the transaction if goal contribution fails
          console.error('Error handling savings goal contribution:', error);
        }
      }
    }

    // OPTIMIZATION: Batch usage analytics updates (Task 2: ~50-70% faster)
    // Fetch category and merchant data in parallel, then batch all updates
    if (categoryId || finalMerchantId) {
      try {
        // Fetch category, merchant, and existing analytics in parallel
        const [categoryData, merchantData, categoryAnalytics, merchantAnalytics] = await Promise.all([
          // Fetch category if provided
          categoryId
            ? db
                .select()
                .from(budgetCategories)
                .where(
                  and(
                    eq(budgetCategories.id, categoryId),
                    eq(budgetCategories.userId, userId),
                    eq(budgetCategories.householdId, householdId)
                  )
                )
                .limit(1)
            : Promise.resolve([]),

          // Fetch merchant if provided
          finalMerchantId
            ? db
                .select()
                .from(merchants)
                .where(
                  and(
                    eq(merchants.id, finalMerchantId),
                    eq(merchants.userId, userId),
                    eq(merchants.householdId, householdId)
                  )
                )
                .limit(1)
            : Promise.resolve([]),

          // Fetch category analytics if provided
          categoryId
            ? db
                .select()
                .from(usageAnalytics)
                .where(
                  and(
                    eq(usageAnalytics.userId, userId),
                    eq(usageAnalytics.householdId, householdId),
                    eq(usageAnalytics.itemType, 'category'),
                    eq(usageAnalytics.itemId, categoryId)
                  )
                )
                .limit(1)
            : Promise.resolve([]),

          // Fetch merchant analytics if provided
          finalMerchantId
            ? db
                .select()
                .from(usageAnalytics)
                .where(
                  and(
                    eq(usageAnalytics.userId, userId),
                    eq(usageAnalytics.householdId, householdId),
                    eq(usageAnalytics.itemType, 'merchant'),
                    eq(usageAnalytics.itemId, finalMerchantId)
                  )
                )
                .limit(1)
            : Promise.resolve([]),
        ]);

        // Build batch update operations
        const usageUpdates: Promise<any>[] = [];

        // Category updates
        if (categoryId && categoryData.length > 0) {
          const category = categoryData[0];

          usageUpdates.push(
            // Update category usage
            db
              .update(budgetCategories)
              .set({
                lastUsedAt: new Date().toISOString(),
                usageCount: (category.usageCount || 0) + 1,
              })
              .where(eq(budgetCategories.id, categoryId)),

            // Upsert category analytics
            categoryAnalytics.length > 0
              ? db
                  .update(usageAnalytics)
                  .set({
                    usageCount: (categoryAnalytics[0].usageCount || 0) + 1,
                    lastUsedAt: new Date().toISOString(),
                  })
                  .where(
                    and(
                      eq(usageAnalytics.userId, userId),
                      eq(usageAnalytics.householdId, householdId),
                      eq(usageAnalytics.itemType, 'category'),
                      eq(usageAnalytics.itemId, categoryId)
                    )
                  )
              : db.insert(usageAnalytics).values({
                  id: nanoid(),
                  userId,
                  householdId,
                  itemType: 'category',
                  itemId: categoryId,
                  usageCount: 1,
                  lastUsedAt: new Date().toISOString(),
                  createdAt: new Date().toISOString(),
                })
          );
        }

        // Merchant updates
        if (finalMerchantId && merchantData.length > 0) {
          const merchant = merchantData[0];
          const currentSpent = new Decimal(merchant.totalSpent || 0);
          const newSpent = currentSpent.plus(decimalAmount);
          const usageCount = (merchant.usageCount || 0);
          const avgTransaction = newSpent.dividedBy(usageCount + 1);

          usageUpdates.push(
            // Update merchant usage
            db
              .update(merchants)
              .set({
                usageCount: usageCount + 1,
                lastUsedAt: new Date().toISOString(),
                totalSpent: newSpent.toNumber(),
                averageTransaction: avgTransaction.toNumber(),
              })
              .where(eq(merchants.id, finalMerchantId)),

            // Upsert merchant analytics
            merchantAnalytics.length > 0
              ? db
                  .update(usageAnalytics)
                  .set({
                    usageCount: (merchantAnalytics[0].usageCount || 0) + 1,
                    lastUsedAt: new Date().toISOString(),
                  })
                  .where(
                    and(
                      eq(usageAnalytics.userId, userId),
                      eq(usageAnalytics.householdId, householdId),
                      eq(usageAnalytics.itemType, 'merchant'),
                      eq(usageAnalytics.itemId, finalMerchantId)
                    )
                  )
              : db.insert(usageAnalytics).values({
                  id: nanoid(),
                  userId,
                  householdId,
                  itemType: 'merchant',
                  itemId: finalMerchantId,
                  usageCount: 1,
                  lastUsedAt: new Date().toISOString(),
                  createdAt: new Date().toISOString(),
                })
          );
        }

        // Execute all usage updates in parallel
        if (usageUpdates.length > 0) {
          await Promise.all(usageUpdates);
        }
      } catch (error) {
        // Log error but don't fail transaction creation
        console.error('Error updating usage analytics:', error);
      }
    }

    // Log rule execution if a rule was applied
    if (appliedRuleId) {
      try {
        await db.insert(ruleExecutionLog).values({
          id: nanoid(),
          userId,
          householdId,
          ruleId: appliedRuleId,
          transactionId,
          appliedCategoryId: appliedCategoryId || null,
          appliedActions: appliedActions.length > 0 ? JSON.stringify(appliedActions) : null,
          matched: true,
          executedAt: new Date().toISOString(),
        });
      } catch (error) {
        // Log error but don't fail transaction creation
        console.error('Error logging rule execution:', error);
      }
    }

    // OPTIMIZATION: Auto-match bills
    // Priority 1: Direct bill instance ID matching (for explicit bill payments)
    // Priority 2: Bill-matcher (description/amount/date matching)
    // Priority 3: Category-only matching (fallback)
    let linkedBillId: string | null = null;
    let linkedInstanceId: string | null = null;
    try {
      if (type === 'expense') {
        // Priority 1: Direct bill instance ID matching (bypasses all matching logic)
        if (billInstanceId) {
          // Validate bill instance belongs to user/household
          const [instance] = await db
            .select({
              instance: billInstances,
              bill: bills,
            })
            .from(billInstances)
            .innerJoin(bills, eq(bills.id, billInstances.billId))
            .where(
              and(
                eq(billInstances.id, billInstanceId),
                eq(billInstances.userId, userId),
                eq(billInstances.householdId, householdId),
                inArray(billInstances.status, ['pending', 'overdue'])
              )
            )
            .limit(1);

          if (instance) {
            linkedBillId = instance.bill.id;
            linkedInstanceId = instance.instance.id;

            // PHASE 5: Use processBillPayment for proper partial payment and debt handling
            const paymentResult = await processBillPayment({
              billId: linkedBillId,
              instanceId: linkedInstanceId,
              transactionId,
              paymentAmount: parseFloat(amount),
              paymentDate: date,
              userId,
              householdId,
              paymentMethod: 'manual',
              linkedAccountId: accountId,
              notes: `Bill payment: ${instance.bill.name}`,
            });

            if (paymentResult.success) {
              // Update transaction with bill link
              await db
                .update(transactions)
                .set({
                  billId: linkedBillId,
                  updatedAt: new Date().toISOString(),
                })
                .where(eq(transactions.id, transactionId));

              console.log(`Bill payment processed: ${linkedBillId}, Status: ${paymentResult.paymentStatus}, Paid: ${paymentResult.paidAmount}, Remaining: ${paymentResult.remainingAmount}`);

              // LEGACY SUPPORT: If bill is linked to old debts table, also update there
              if (instance.bill.debtId) {
                try {
                  const paymentAmount = parseFloat(amount);

                  // Get current debt to calculate interest/principal split
                  const [currentDebt] = await db
                    .select()
                    .from(debts)
                    .where(eq(debts.id, instance.bill.debtId));

                  if (currentDebt) {
                    // Calculate payment breakdown
                    const breakdown = calculatePaymentBreakdown(
                      paymentAmount,
                      currentDebt.remainingBalance,
                      currentDebt.interestRate || 0,
                      currentDebt.interestType || 'none',
                      currentDebt.loanType || 'revolving',
                      currentDebt.compoundingFrequency || 'monthly',
                      currentDebt.billingCycleDays || 30
                    );

                    // Calculate new balance
                    const newBalance = Math.max(0, currentDebt.remainingBalance - breakdown.principalAmount);

                    // Batch all debt-related operations
                    await Promise.all([
                      // Create debt payment record
                      db.insert(debtPayments).values({
                        id: nanoid(),
                        debtId: instance.bill.debtId,
                        userId,
                        householdId,
                        amount: paymentAmount,
                        principalAmount: breakdown.principalAmount,
                        interestAmount: breakdown.interestAmount,
                        paymentDate: date,
                        transactionId,
                        notes: `Automatic payment from bill: ${instance.bill.name}`,
                        createdAt: new Date().toISOString(),
                      }),

                      // Update debt balance
                      db
                        .update(debts)
                        .set({
                          remainingBalance: newBalance,
                          status: newBalance === 0 ? 'paid_off' : 'active',
                          updatedAt: new Date().toISOString(),
                        })
                        .where(eq(debts.id, instance.bill.debtId)),

                      // Batch update milestones (replaces loop)
                      batchUpdateMilestones(instance.bill.debtId, newBalance),
                    ]);
                  }
                } catch (debtError) {
                  console.error('Error updating legacy debt payment:', debtError);
                  // Don't fail the whole transaction if debt update fails
                }
              }
            }
          }
        } else {
          // PHASE 5: Priority 1.5 - Check for bills with chargedToAccountId matching this account
          // These are subscriptions/charges that auto-charge to a specific account
          const chargedToBills = await db
            .select({
              bill: bills,
              instance: billInstances,
            })
            .from(bills)
            .innerJoin(billInstances, eq(billInstances.billId, bills.id))
            .where(
              and(
                eq(bills.chargedToAccountId, accountId),
                eq(bills.userId, userId),
                eq(bills.householdId, householdId),
                eq(bills.isActive, true),
                inArray(billInstances.status, ['pending', 'overdue'])
              )
            )
            .orderBy(
              sql`CASE WHEN ${billInstances.status} = 'overdue' THEN 0 ELSE 1 END`,
              asc(billInstances.dueDate)
            );

          // Find best match based on description similarity, amount, and date
          if (chargedToBills.length > 0) {
            // Use Levenshtein distance for description matching
            const { distance } = await import('fastest-levenshtein');
            const transactionDescLower = description.toLowerCase();
            const paymentAmount = parseFloat(amount);
            const transactionDate = new Date(date);

            let bestMatch: { bill: typeof chargedToBills[0]['bill']; instance: typeof chargedToBills[0]['instance']; score: number } | null = null;

            for (const { bill, instance } of chargedToBills) {
              let score = 0;

              // Description similarity (40% weight)
              const billNameLower = bill.name.toLowerCase();
              const maxLen = Math.max(transactionDescLower.length, billNameLower.length);
              const descSimilarity = maxLen > 0 ? 1 - (distance(transactionDescLower, billNameLower) / maxLen) : 0;
              score += descSimilarity * 40;

              // Amount matching (30% weight) - within 5% tolerance by default
              const amountTolerance = bill.amountTolerance || 5;
              const expectedAmount = instance.expectedAmount || bill.expectedAmount;
              const amountDiff = Math.abs(paymentAmount - expectedAmount) / expectedAmount * 100;
              if (amountDiff <= amountTolerance) {
                score += 30 * (1 - amountDiff / amountTolerance);
              }

              // Date proximity (30% weight) - within 3 days
              const dueDate = new Date(instance.dueDate);
              const dateDiffDays = Math.abs(Math.floor((transactionDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)));
              if (dateDiffDays <= 3) {
                score += 30 * (1 - dateDiffDays / 3);
              }

              if (!bestMatch || score > bestMatch.score) {
                bestMatch = { bill, instance, score };
              }
            }

            // Only auto-link if confidence is >= 85%
            if (bestMatch && bestMatch.score >= 85) {
              linkedBillId = bestMatch.bill.id;
              linkedInstanceId = bestMatch.instance.id;

              // Process the payment
              const paymentResult = await processBillPayment({
                billId: linkedBillId,
                instanceId: linkedInstanceId,
                transactionId,
                paymentAmount: parseFloat(amount),
                paymentDate: date,
                userId,
                householdId,
                paymentMethod: 'manual',
                linkedAccountId: accountId,
                notes: `Auto-matched from chargedToAccountId: ${bestMatch.bill.name}`,
              });

              if (paymentResult.success) {
                await db
                  .update(transactions)
                  .set({
                    billId: linkedBillId,
                    updatedAt: new Date().toISOString(),
                  })
                  .where(eq(transactions.id, transactionId));

                console.log(`ChargedToAccountId match: ${linkedBillId}, Score: ${bestMatch.score}, Status: ${paymentResult.paymentStatus}`);
              }
            }
          }

          // Priority 2: If no chargedToAccountId match, try bill-matcher
          if (!linkedBillId) {
          const billMatch = await findMatchingBillInstance(
          {
            id: transactionId,
            description,
            amount: parseFloat(amount),
            date,
            type,
            categoryId: appliedCategoryId,
          },
          userId,
          householdId,
          70 // min confidence threshold
        );

        if (billMatch) {
          linkedBillId = billMatch.billId;
          linkedInstanceId = billMatch.instanceId;

          // Get the bill to check for debt linkage
          const [bill] = await db
            .select()
            .from(bills)
            .where(eq(bills.id, linkedBillId))
            .limit(1);

          if (bill) {
            // PHASE 5: Use processBillPayment for proper partial payment and debt handling
            const paymentResult = await processBillPayment({
              billId: linkedBillId,
              instanceId: linkedInstanceId!,
              transactionId,
              paymentAmount: parseFloat(amount),
              paymentDate: date,
              userId,
              householdId,
              paymentMethod: 'manual',
              linkedAccountId: accountId,
              notes: `Auto-matched bill payment: ${bill.name}`,
            });

            if (paymentResult.success) {
              // Update transaction with bill link
              await db
                .update(transactions)
                .set({
                  billId: linkedBillId,
                  updatedAt: new Date().toISOString(),
                })
                .where(eq(transactions.id, transactionId));

              console.log(`Auto-matched bill payment: ${linkedBillId}, Status: ${paymentResult.paymentStatus}`);

              // LEGACY SUPPORT: If bill is linked to old debts table, also update there
              if (bill.debtId) {
                try {
                  const paymentAmount = parseFloat(amount);

                  // Get current debt to calculate interest/principal split
                  const [currentDebt] = await db
                    .select()
                    .from(debts)
                    .where(eq(debts.id, bill.debtId));

                  if (currentDebt) {
                    // Calculate payment breakdown
                    const breakdown = calculatePaymentBreakdown(
                      paymentAmount,
                      currentDebt.remainingBalance,
                      currentDebt.interestRate || 0,
                      currentDebt.interestType || 'none',
                      currentDebt.loanType || 'revolving',
                      currentDebt.compoundingFrequency || 'monthly',
                      currentDebt.billingCycleDays || 30
                    );

                    // Calculate new balance
                    const newBalance = Math.max(0, currentDebt.remainingBalance - breakdown.principalAmount);

                    // Batch all debt-related operations
                    await Promise.all([
                      // Create debt payment record
                      db.insert(debtPayments).values({
                        id: nanoid(),
                        debtId: bill.debtId,
                        userId,
                        householdId,
                        amount: paymentAmount,
                        principalAmount: breakdown.principalAmount,
                        interestAmount: breakdown.interestAmount,
                        paymentDate: date,
                        transactionId,
                        notes: `Automatic payment from bill: ${bill.name}`,
                        createdAt: new Date().toISOString(),
                      }),

                      // Update debt balance
                      db
                        .update(debts)
                        .set({
                          remainingBalance: newBalance,
                          status: newBalance === 0 ? 'paid_off' : 'active',
                          updatedAt: new Date().toISOString(),
                        })
                        .where(eq(debts.id, bill.debtId)),

                      // Batch update milestones (replaces loop)
                      batchUpdateMilestones(bill.debtId, newBalance),
                    ]);
                  }
                } catch (debtError) {
                  console.error('Error updating legacy debt payment:', debtError);
                  // Don't fail the whole transaction if debt update fails
                }
              }
            }
          }
        } else if (appliedCategoryId) {
          // Fallback: Category-only matching (backwards compatibility)
          // Single query with JOIN to get oldest instance (prioritize overdue, then pending)
          const billMatches = await db
            .select({
              bill: bills,
              instance: billInstances,
            })
            .from(bills)
            .innerJoin(billInstances, eq(billInstances.billId, bills.id))
            .where(
              and(
                eq(bills.userId, userId),
                eq(bills.householdId, householdId),
                eq(bills.isActive, true),
                eq(bills.categoryId, appliedCategoryId),
                inArray(billInstances.status, ['pending', 'overdue'])
              )
            )
            .orderBy(
              // Prioritize overdue bills first (0), then pending (1), then by due date (oldest first)
              sql`CASE WHEN ${billInstances.status} = 'overdue' THEN 0 ELSE 1 END`,
              asc(billInstances.dueDate)
            )
            .limit(1);

          if (billMatches.length > 0) {
            const match = billMatches[0];
            linkedBillId = match.bill.id;
            linkedInstanceId = match.instance.id;

            // PHASE 5: Use processBillPayment for proper partial payment and debt handling
            const paymentResult = await processBillPayment({
              billId: linkedBillId,
              instanceId: linkedInstanceId,
              transactionId,
              paymentAmount: parseFloat(amount),
              paymentDate: date,
              userId,
              householdId,
              paymentMethod: 'manual',
              linkedAccountId: accountId,
              notes: `Category-matched bill payment: ${match.bill.name}`,
            });

            if (paymentResult.success) {
              // Update transaction with bill link
              await db
                .update(transactions)
                .set({
                  billId: linkedBillId,
                  updatedAt: new Date().toISOString(),
                })
                .where(eq(transactions.id, transactionId));

              console.log(`Category-matched bill payment: ${linkedBillId}, Status: ${paymentResult.paymentStatus}`);

              // LEGACY SUPPORT: If bill is linked to old debts table, also update there
              if (match.bill.debtId) {
                try {
                  const paymentAmount = parseFloat(amount);

                  // Get current debt to calculate interest/principal split
                  const [currentDebt] = await db
                    .select()
                    .from(debts)
                    .where(eq(debts.id, match.bill.debtId));

                  if (currentDebt) {
                    // Calculate payment breakdown
                    const breakdown = calculatePaymentBreakdown(
                      paymentAmount,
                      currentDebt.remainingBalance,
                      currentDebt.interestRate || 0,
                      currentDebt.interestType || 'none',
                      currentDebt.loanType || 'revolving',
                      currentDebt.compoundingFrequency || 'monthly',
                      currentDebt.billingCycleDays || 30
                    );

                    // Calculate new balance
                    const newBalance = Math.max(0, currentDebt.remainingBalance - breakdown.principalAmount);

                    // Batch all debt-related operations
                    await Promise.all([
                      // Create debt payment record
                      db.insert(debtPayments).values({
                        id: nanoid(),
                        debtId: match.bill.debtId,
                        userId,
                        householdId,
                        amount: paymentAmount,
                        principalAmount: breakdown.principalAmount,
                        interestAmount: breakdown.interestAmount,
                        paymentDate: date,
                        transactionId,
                        notes: `Automatic payment from bill: ${match.bill.name}`,
                        createdAt: new Date().toISOString(),
                      }),

                      // Update debt balance
                      db
                        .update(debts)
                        .set({
                          remainingBalance: newBalance,
                          status: newBalance === 0 ? 'paid_off' : 'active',
                          updatedAt: new Date().toISOString(),
                        })
                        .where(eq(debts.id, match.bill.debtId)),

                      // Batch update milestones (replaces loop)
                      batchUpdateMilestones(match.bill.debtId, newBalance),
                    ]);
                  }
                } catch (debtError) {
                  console.error('Error updating legacy debt payment:', debtError);
                  // Don't fail the whole transaction if debt update fails
                }
              }
            }
          }
        }
        } // End Priority 2 (!linkedBillId check)
        }
      }
    } catch (error) {
      // Log error but don't fail transaction creation
      console.error('Error auto-linking bill:', error);
    }

    // OPTIMIZATION: Auto-match debts by category (Task 4)
    // Batch all debt updates in parallel
    // Skip if already matched to a bill to avoid double-counting
    let linkedDebtId: string | null = null;
    try {
      if (type === 'expense' && appliedCategoryId && !linkedBillId) {
        // Find debts with matching category (only debts with their own category, not bill-linked)
        const matchingDebts = await db
          .select()
          .from(debts)
          .where(
            and(
              eq(debts.userId, userId),
              eq(debts.householdId, householdId),
              eq(debts.status, 'active'),
              eq(debts.categoryId, appliedCategoryId)
            )
          )
          .limit(1); // Only need the first match

        if (matchingDebts.length > 0) {
          const debt = matchingDebts[0];
          linkedDebtId = debt.id;

          const paymentAmount = parseFloat(amount);

          // Calculate payment breakdown
          const breakdown = calculatePaymentBreakdown(
            paymentAmount,
            debt.remainingBalance,
            debt.interestRate || 0,
            debt.interestType || 'none',
            debt.loanType || 'revolving',
            debt.compoundingFrequency || 'monthly',
            debt.billingCycleDays || 30
          );

          // Calculate new balance
          const newBalance = Math.max(0, debt.remainingBalance - breakdown.principalAmount);

          // Batch all debt-related operations (Task 4: ~60-80% faster)
          await Promise.all([
            // Update transaction with debt link
            db
              .update(transactions)
              .set({
                debtId: linkedDebtId,
                updatedAt: new Date().toISOString(),
              })
              .where(eq(transactions.id, transactionId)),

            // Create debt payment record
            db.insert(debtPayments).values({
              id: nanoid(),
              debtId: linkedDebtId,
              userId,
              householdId,
              amount: paymentAmount,
              principalAmount: breakdown.principalAmount,
              interestAmount: breakdown.interestAmount,
              paymentDate: date,
              transactionId,
              notes: `Automatic payment via category: ${debt.name}`,
              createdAt: new Date().toISOString(),
            }),

            // Update debt balance
            db
              .update(debts)
              .set({
                remainingBalance: newBalance,
                status: newBalance === 0 ? 'paid_off' : 'active',
                updatedAt: new Date().toISOString(),
              })
              .where(eq(debts.id, linkedDebtId)),

            // Batch update milestones (replaces loop)
            batchUpdateMilestones(linkedDebtId, newBalance),
          ]);
        }
      }
    } catch (error) {
      // Log error but don't fail transaction creation
      console.error('Error auto-linking debt by category:', error);
    }

    // OPTIMIZATION: Handle direct debt payments (Task 4)
    // Batch all updates in parallel
    if (type === 'expense' && debtId) {
      try {
        const paymentAmount = parseFloat(amount);

        // Get current debt to calculate interest/principal split
        const [currentDebt] = await db
          .select()
          .from(debts)
          .where(eq(debts.id, debtId));

        if (currentDebt) {
          // Calculate payment breakdown
          const breakdown = calculatePaymentBreakdown(
            paymentAmount,
            currentDebt.remainingBalance,
            currentDebt.interestRate || 0,
            currentDebt.interestType || 'none',
            currentDebt.loanType || 'revolving',
            currentDebt.compoundingFrequency || 'monthly',
            currentDebt.billingCycleDays || 30
          );

          // Calculate new balance
          const newBalance = Math.max(0, currentDebt.remainingBalance - breakdown.principalAmount);

          // Batch all debt payment operations (Task 4: ~60-80% faster)
          await Promise.all([
            // Create debt payment record
            db.insert(debtPayments).values({
              id: nanoid(),
              debtId: debtId,
              userId,
              householdId,
              amount: paymentAmount,
              principalAmount: breakdown.principalAmount,
              interestAmount: breakdown.interestAmount,
              paymentDate: date,
              transactionId,
              notes: `Direct payment: ${description}`,
              createdAt: new Date().toISOString(),
            }),

            // Update debt balance
            db
              .update(debts)
              .set({
                remainingBalance: newBalance,
                status: newBalance === 0 ? 'paid_off' : 'active',
                updatedAt: new Date().toISOString(),
              })
              .where(eq(debts.id, debtId)),

            // Batch update milestones (replaces loop)
            batchUpdateMilestones(debtId, newBalance),
          ]);
        }
      } catch (debtError) {
        console.error('Error updating direct debt payment:', debtError);
        // Don't fail the whole transaction if debt update fails
      }
    }

    // OPTIMIZATION: Log performance metrics (Task 8)
    const duration = performance.now() - startTime;
    console.log(`[PERF] Transaction created in ${duration.toFixed(2)}ms`, {
      type,
      hasCategory: !!appliedCategoryId,
      hasMerchant: !!finalMerchantId,
      hasBill: !!linkedBillId,
      hasDebt: !!linkedDebtId,
      hasRules: !!appliedRuleId,
      isTransfer: type === 'transfer',
    });

    // Log audit trail for transaction creation (non-blocking)
    try {
      // Fetch user name and related entity names for audit log
      const [userRecord, accountName, categoryName, merchantName] = await Promise.all([
        db.select({ name: betterAuthUser.name }).from(betterAuthUser).where(eq(betterAuthUser.id, userId)).limit(1),
        db.select({ name: accounts.name }).from(accounts).where(eq(accounts.id, accountId)).limit(1),
        appliedCategoryId
          ? db.select({ name: budgetCategories.name }).from(budgetCategories).where(eq(budgetCategories.id, appliedCategoryId)).limit(1)
          : Promise.resolve([]),
        finalMerchantId
          ? db.select({ name: merchants.name }).from(merchants).where(eq(merchants.id, finalMerchantId)).limit(1)
          : Promise.resolve([]),
      ]);

      const snapshot = createTransactionSnapshot({
        id: transactionId,
        accountId,
        categoryId: appliedCategoryId,
        merchantId: finalMerchantId,
        date,
        amount: decimalAmount.toNumber(),
        description: finalDescription,
        notes: notes || null,
        type: type === 'transfer' ? 'transfer_out' : type,
        isPending,
        isTaxDeductible: postCreationMutations?.isTaxDeductible || false,
        isSalesTaxable: (type === 'income' && (isSalesTaxable || postCreationMutations?.isSalesTaxable)) || false,
        billId: linkedBillId,
        debtId: linkedDebtId || debtId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }, {
        accountName: accountName[0]?.name,
        categoryName: categoryName[0]?.name,
        merchantName: merchantName[0]?.name,
      });

      await logTransactionAudit({
        transactionId,
        userId,
        householdId,
        userName: userRecord[0]?.name || 'Unknown User',
        actionType: 'created',
        snapshot,
      });
    } catch (auditError) {
      // Non-fatal: don't fail the create if audit logging fails
      console.error('Failed to log transaction creation audit:', auditError);
    }

    return Response.json(
      {
        id: transactionId,
        transferInId: transferInId || undefined, // ID of transfer_in transaction if transfer
        message: 'Transaction created successfully',
        appliedCategoryId: appliedCategoryId ? appliedCategoryId : undefined,
        appliedRuleId: appliedRuleId ? appliedRuleId : undefined,
        linkedBillId: linkedBillId ? linkedBillId : undefined,
        linkedDebtId: linkedDebtId ? linkedDebtId : undefined,
      },
      { status: 201 }
    );
    } catch (error) {
    // Handle authentication errors (401)
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Handle household authorization errors (403)
    if (error instanceof Error) {
      if (error.message.includes('Household ID is required')) {
        return Response.json(
          { error: 'Household ID is required. Please select a household.' },
          { status: 400 }
        );
      }
      if (error.message.includes('Not a member') || error.message.includes('Unauthorized: Not a member')) {
        return Response.json(
          { error: 'You are not a member of this household.' },
          { status: 403 }
        );
      }
      if (error.message.includes('Household') || error.message.includes('member')) {
        return Response.json({ error: error.message }, { status: 403 });
      }
    }
    
    console.error('Transaction creation error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
    }
}

export async function GET(request: Request) {
  try {
    const { userId } = await requireAuth();

    // Get and validate household
    const householdId = getHouseholdIdFromRequest(request);
    await requireHouseholdAuth(userId, householdId);
    // TypeScript: householdId is guaranteed to be non-null after requireHouseholdAuth
    if (!householdId) {
      return Response.json(
        { error: 'Household ID is required' },
        { status: 400 }
  );
}

    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');
    const accountId = url.searchParams.get('accountId');

    const userTransactions = await db
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          eq(transactions.householdId, householdId)
        )
      )
      .orderBy(desc(transactions.date))
      .limit(limit)
      .offset(offset);

    // If accountId filter is present, return all transactions (including both transfer sides)
    if (accountId) {
      return Response.json(userTransactions);
    }

    // Main view (no account filter): Respect user's transfer view preference
    const combinedTransferView = await getCombinedTransferViewPreference(userId, householdId);
    
    // Debug logging to trace filtering logic
    const transferOutCount = userTransactions.filter(tx => tx.type === 'transfer_out').length;
    const transferInCount = userTransactions.filter(tx => tx.type === 'transfer_in').length;
    const otherCount = userTransactions.filter(tx => tx.type !== 'transfer_out' && tx.type !== 'transfer_in').length;
    
    console.log('[Transfer View] Preference:', combinedTransferView, 'Total transactions:', userTransactions.length);
    console.log('[Transfer View] Breakdown - transfer_out:', transferOutCount, 'transfer_in:', transferInCount, 'other:', otherCount);

    // If combined view is enabled, filter out transfer_in transactions
    if (combinedTransferView) {
      const processedTransactions = [];
      const transferInIds = new Set();

      // First pass: collect all transfer_in IDs to skip them
      for (const tx of userTransactions) {
        if (tx.type === 'transfer_in') {
          transferInIds.add(tx.id);
        }
      }

      // Second pass: add all non-transfer_in transactions
      for (const tx of userTransactions) {
        if (!transferInIds.has(tx.id)) {
          processedTransactions.push(tx);
        }
      }

      const filteredTransferOutCount = processedTransactions.filter(tx => tx.type === 'transfer_out').length;
      const filteredTransferInCount = processedTransactions.filter(tx => tx.type === 'transfer_in').length;
      const filteredOtherCount = processedTransactions.filter(tx => tx.type !== 'transfer_out' && tx.type !== 'transfer_in').length;
      
      console.log('[Transfer View] Combined: Filtered to', processedTransactions.length, 'transactions');
      console.log('[Transfer View] Filtered breakdown - transfer_out:', filteredTransferOutCount, 'transfer_in:', filteredTransferInCount, 'other:', filteredOtherCount);
      return Response.json(processedTransactions);
    }

    // Separate view: return all transactions including both transfer sides
    console.log('[Transfer View] Separate: Returning all', userTransactions.length, 'transactions (both transfer_out and transfer_in)');
    return Response.json(userTransactions);
    } catch (error) {
    // Handle authentication errors (401)
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Handle household authorization errors (403)
    if (error instanceof Error) {
      if (error.message.includes('Household ID is required')) {
        return Response.json(
          { error: 'Household ID is required. Please select a household.' },
          { status: 400 }
        );
      }
      if (error.message.includes('Not a member') || error.message.includes('Unauthorized: Not a member')) {
        return Response.json(
          { error: 'You are not a member of this household.' },
          { status: 403 }
        );
      }
      if (error.message.includes('Household') || error.message.includes('member')) {
        return Response.json({ error: error.message }, { status: 403 });
      }
    }
    
    console.error('Transaction fetch error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
    }
}

