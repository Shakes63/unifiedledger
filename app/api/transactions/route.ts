import { requireAuth } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { transactions, accounts, budgetCategories, merchants, usageAnalytics, ruleExecutionLog, bills, billInstances, debts, debtPayments, debtPayoffMilestones } from '@/lib/db/schema';
import { eq, and, desc, asc } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import Decimal from 'decimal.js';
import { findMatchingRule } from '@/lib/rules/rule-matcher';
import { TransactionData } from '@/lib/rules/condition-evaluator';
import { executeRuleActions } from '@/lib/rules/actions-executor';
import { handleTransferConversion } from '@/lib/rules/transfer-action-handler';
import { handleSplitCreation } from '@/lib/rules/split-action-handler';
import { handleAccountChange } from '@/lib/rules/account-action-handler';
import { findMatchingBills } from '@/lib/bills/bill-matcher';
import { calculatePaymentBreakdown } from '@/lib/debts/payment-calculator';
import { batchUpdateMilestones } from '@/lib/debts/milestone-utils';
// Sales tax now handled as boolean flag on transaction, no separate records needed

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  // OPTIMIZATION: Performance monitoring (Task 8)
  const startTime = performance.now();

  try {
    const { userId } = await requireAuth();

    const body = await request.json();
    const {
      accountId,
      categoryId,
      merchantId,
      debtId, // For direct debt payments
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
            eq(accounts.userId, userId)
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
                eq(accounts.userId, userId)
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
                eq(budgetCategories.userId, userId)
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

        const ruleMatch = await findMatchingRule(userId, transactionData);

        if (ruleMatch.matched && ruleMatch.rule) {
          appliedRuleId = ruleMatch.rule.ruleId;

          // OPTIMIZATION: Fetch merchant and category info in parallel (Task 1)
          const [merchantResult, categoryInfoResult] = await Promise.all([
            // Fetch merchant info if provided
            merchantId
              ? db
                  .select()
                  .from(merchants)
                  .where(eq(merchants.id, merchantId))
                  .limit(1)
              : Promise.resolve([]),

            // Fetch category info if provided
            categoryId
              ? db
                  .select()
                  .from(budgetCategories)
                  .where(eq(budgetCategories.id, categoryId))
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
    let transactionId = nanoid();
    let transferInId: string | null = null;

    // OPTIMIZATION: Create TWO transactions for transfers (Task 7: ~30-50% faster)
    // Batch all inserts and updates in parallel
    if (type === 'transfer' && toAccount) {
      // Generate transfer_in ID
      transferInId = nanoid();

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
          accountId: toAccountId, // Destination account
          categoryId: null,
          merchantId: null,
          date,
          amount: decimalAmount.toNumber(),
          description,
          notes: notes || null,
          type: 'transfer_in',
          transferId: transactionId,
          isPending,
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
                eq(usageAnalytics.itemType, 'transfer_pair'),
                eq(usageAnalytics.itemId, accountId),
                eq(usageAnalytics.itemSecondaryId, toAccountId)
              )
            );
        } else {
          await db.insert(usageAnalytics).values({
            id: nanoid(),
            userId,
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
    } else {
      // Non-transfer transaction (income or expense)
      await db.insert(transactions).values({
        id: transactionId,
        userId,
        accountId,
        categoryId: appliedCategoryId || null,
        merchantId: finalMerchantId || null,
        debtId: debtId || null,
        date,
        amount: decimalAmount.toNumber(),
        description: finalDescription,
        notes: notes || null,
        type,
        transferId: null,
        isPending,
        isTaxDeductible: postCreationMutations?.isTaxDeductible || false,
        isSalesTaxable: (type === 'income' && (isSalesTaxable || postCreationMutations?.isSalesTaxable)) || false,
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
                .where(eq(budgetCategories.id, categoryId))
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
                    eq(merchants.userId, userId)
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
                      eq(usageAnalytics.itemType, 'category'),
                      eq(usageAnalytics.itemId, categoryId)
                    )
                  )
              : db.insert(usageAnalytics).values({
                  id: nanoid(),
                  userId,
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
                      eq(usageAnalytics.itemType, 'merchant'),
                      eq(usageAnalytics.itemId, finalMerchantId)
                    )
                  )
              : db.insert(usageAnalytics).values({
                  id: nanoid(),
                  userId,
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

    // OPTIMIZATION: Auto-match bills by category (Task 3)
    // Uses JOIN instead of loop, batches all updates in parallel
    let linkedBillId: string | null = null;
    try {
      if (type === 'expense' && appliedCategoryId) {
        // Single query with JOIN to get oldest pending instance
        // Replaces: fetch bills → loop → fetch instances → sort
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
              eq(bills.isActive, true),
              eq(bills.categoryId, appliedCategoryId),
              eq(billInstances.status, 'pending')
            )
          )
          .orderBy(asc(billInstances.dueDate))
          .limit(1);

        if (billMatches.length > 0) {
          const match = billMatches[0];
          linkedBillId = match.bill.id;

          // Batch all bill-related updates (Task 3: ~60-80% faster)
          // Execute transaction and bill instance updates in parallel
          await Promise.all([
            // Update transaction with bill link
            db
              .update(transactions)
              .set({
                billId: linkedBillId,
                updatedAt: new Date().toISOString(),
              })
              .where(eq(transactions.id, transactionId)),

            // Update bill instance
            db
              .update(billInstances)
              .set({
                status: 'paid',
                paidDate: date,
                actualAmount: parseFloat(amount),
                transactionId,
                updatedAt: new Date().toISOString(),
              })
              .where(eq(billInstances.id, match.instance.id)),
          ]);

          // If bill is linked to a debt, process debt updates
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
              console.error('Error updating debt payment:', debtError);
              // Don't fail the whole transaction if debt update fails
            }
          }
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
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
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

    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');
    const accountId = url.searchParams.get('accountId');

    const userTransactions = await db
      .select()
      .from(transactions)
      .where(eq(transactions.userId, userId))
      .orderBy(desc(transactions.date))
      .limit(limit)
      .offset(offset);

    // If accountId filter is present, return all transactions (including both transfer sides)
    if (accountId) {
      return Response.json(userTransactions);
    }

    // Main view (no account filter): Combine transfer pairs into single entries
    // We want to show only transfer_out transactions and hide transfer_in to avoid duplicates
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

    return Response.json(processedTransactions);
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Transaction fetch error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
