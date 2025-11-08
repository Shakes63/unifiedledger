import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { transactions, accounts, budgetCategories, merchants, usageAnalytics, ruleExecutionLog, bills, billInstances } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import Decimal from 'decimal.js';
import { findMatchingRule } from '@/lib/rules/rule-matcher';
import { TransactionData } from '@/lib/rules/condition-evaluator';
import { findMatchingBills } from '@/lib/bills/bill-matcher';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return Response.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      accountId,
      categoryId,
      merchantId,
      date,
      amount,
      description,
      notes,
      type = 'expense',
      isPending = false,
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

    // Validate account belongs to user
    const account = await db
      .select()
      .from(accounts)
      .where(
        and(
          eq(accounts.id, accountId),
          eq(accounts.userId, userId)
        )
      )
      .limit(1);

    if (account.length === 0) {
      return Response.json(
        { error: 'Account not found' },
        { status: 404 }
      );
    }

    // Validate category if provided
    if (categoryId) {
      const category = await db
        .select()
        .from(budgetCategories)
        .where(
          and(
            eq(budgetCategories.id, categoryId),
            eq(budgetCategories.userId, userId)
          )
        )
        .limit(1);

      if (category.length === 0) {
        return Response.json(
          { error: 'Category not found' },
          { status: 404 }
        );
      }
    }

    // Apply categorization rules if no category provided
    let appliedCategoryId = categoryId;
    let appliedRuleId: string | null = null;

    if (!appliedCategoryId && type !== 'transfer_in' && type !== 'transfer_out') {
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
          appliedCategoryId = ruleMatch.rule.categoryId;
          appliedRuleId = ruleMatch.rule.ruleId;
        }
      } catch (error) {
        // Log error but don't fail transaction creation
        console.error('Error applying categorization rules:', error);
      }
    }

    // Create transaction
    const transactionId = nanoid();
    const decimalAmount = new Decimal(amount);

    const result = await db.insert(transactions).values({
      id: transactionId,
      userId,
      accountId,
      categoryId: appliedCategoryId || null,
      merchantId: merchantId || null,
      date,
      amount: decimalAmount.toNumber(),
      description,
      notes: notes || null,
      type,
      isPending,
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
      type === 'expense' || type === 'transfer_out'
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

    // Update category usage if provided
    if (categoryId) {
      const category = await db
        .select()
        .from(budgetCategories)
        .where(eq(budgetCategories.id, categoryId))
        .limit(1);

      await db
        .update(budgetCategories)
        .set({
          lastUsedAt: new Date().toISOString(),
          usageCount: (category.length > 0 && category[0] ? (category[0].usageCount || 0) : 0) + 1,
        })
        .where(eq(budgetCategories.id, categoryId));

      // Track in usage analytics
      const analyticsId = nanoid();
      const existingAnalytics = await db
        .select()
        .from(usageAnalytics)
        .where(
          and(
            eq(usageAnalytics.userId, userId),
            eq(usageAnalytics.itemType, 'category'),
            eq(usageAnalytics.itemId, categoryId)
          )
        )
        .limit(1);

      if (existingAnalytics.length > 0 && existingAnalytics[0]) {
        await db
          .update(usageAnalytics)
          .set({
            usageCount: (existingAnalytics[0].usageCount || 0) + 1,
            lastUsedAt: new Date().toISOString(),
          })
          .where(
            and(
              eq(usageAnalytics.userId, userId),
              eq(usageAnalytics.itemType, 'category'),
              eq(usageAnalytics.itemId, categoryId)
            )
          );
      } else {
        await db.insert(usageAnalytics).values({
          id: analyticsId,
          userId,
          itemType: 'category',
          itemId: categoryId,
          usageCount: 1,
          lastUsedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        });
      }
    }

    // Track merchant usage if merchantId is provided
    if (merchantId) {
      // Verify merchant exists and belongs to user
      const merchant = await db
        .select()
        .from(merchants)
        .where(
          and(
            eq(merchants.id, merchantId),
            eq(merchants.userId, userId)
          )
        )
        .limit(1);

      if (merchant.length > 0) {
        const currentSpent = new Decimal(merchant[0].totalSpent || 0);
        const newSpent = currentSpent.plus(decimalAmount);
        const usageCount = (merchant[0].usageCount || 0);
        const avgTransaction = newSpent.dividedBy(usageCount + 1);

        await db
          .update(merchants)
          .set({
            usageCount: usageCount + 1,
            lastUsedAt: new Date().toISOString(),
            totalSpent: newSpent.toNumber(),
            averageTransaction: avgTransaction.toNumber(),
          })
          .where(eq(merchants.id, merchantId));

        // Track in usage analytics
        const existingAnalytics = await db
          .select()
          .from(usageAnalytics)
          .where(
            and(
              eq(usageAnalytics.userId, userId),
              eq(usageAnalytics.itemType, 'merchant'),
              eq(usageAnalytics.itemId, merchantId)
            )
          )
          .limit(1);

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
                eq(usageAnalytics.itemType, 'merchant'),
                eq(usageAnalytics.itemId, merchantId)
              )
            );
        } else {
          const analyticsId = nanoid();
          await db.insert(usageAnalytics).values({
            id: analyticsId,
            userId,
            itemType: 'merchant',
            itemId: merchantId,
            usageCount: 1,
            lastUsedAt: new Date().toISOString(),
            createdAt: new Date().toISOString(),
          });
        }
      }
    }

    // Log rule execution if a rule was applied
    if (appliedRuleId && appliedCategoryId) {
      try {
        await db.insert(ruleExecutionLog).values({
          id: nanoid(),
          userId,
          ruleId: appliedRuleId,
          transactionId,
          appliedCategoryId,
          matched: true,
          executedAt: new Date().toISOString(),
        });
      } catch (error) {
        // Log error but don't fail transaction creation
        console.error('Error logging rule execution:', error);
      }
    }

    // Auto-detect and link bills (optional, low-confidence matches only)
    let linkedBillId: string | null = null;
    try {
      if (type === 'expense') {
        const userBills = await db
          .select()
          .from(bills)
          .where(
            and(
              eq(bills.userId, userId),
              eq(bills.isActive, true)
            )
          );

        if (userBills.length > 0) {
          const billsForMatching = userBills.map((bill) => {
            const patterns = bill.payeePatterns
              ? JSON.parse(bill.payeePatterns)
              : [];

            return {
              id: bill.id,
              name: bill.name,
              expectedAmount: bill.expectedAmount,
              dueDate: bill.dueDate,
              isVariableAmount: bill.isVariableAmount ?? false,
              amountTolerance: bill.amountTolerance ?? 5.0,
              payeePatterns: Array.isArray(patterns) ? patterns : [],
            };
          });

          const matches = await findMatchingBills({
            id: transactionId,
            description,
            amount: parseFloat(amount),
            date,
            type,
          }, billsForMatching);

          // Only auto-link very high confidence matches (90+)
          if (matches.length > 0 && matches[0].confidence >= 90) {
            linkedBillId = matches[0].billId;

            // Update transaction with bill link
            await db
              .update(transactions)
              .set({
                billId: linkedBillId,
                updatedAt: new Date().toISOString(),
              })
              .where(eq(transactions.id, transactionId));

            // Find and update the corresponding bill instance
            const txDate = new Date(date);
            const billInstance = await db
              .select()
              .from(billInstances)
              .where(
                and(
                  eq(billInstances.billId, linkedBillId),
                  eq(billInstances.status, 'pending')
                )
              )
              .limit(1);

            if (billInstance.length > 0) {
              await db
                .update(billInstances)
                .set({
                  status: 'paid',
                  paidDate: date,
                  actualAmount: parseFloat(amount),
                  transactionId,
                  updatedAt: new Date().toISOString(),
                })
                .where(eq(billInstances.id, billInstance[0].id));
            }
          }
        }
      }
    } catch (error) {
      // Log error but don't fail transaction creation
      console.error('Error auto-linking bill:', error);
    }

    return Response.json(
      {
        id: transactionId,
        message: 'Transaction created successfully',
        appliedCategoryId: appliedCategoryId ? appliedCategoryId : undefined,
        appliedRuleId: appliedRuleId ? appliedRuleId : undefined,
        linkedBillId: linkedBillId ? linkedBillId : undefined,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Transaction creation error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return Response.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    const userTransactions = await db
      .select()
      .from(transactions)
      .where(eq(transactions.userId, userId))
      .orderBy(transactions.date)
      .limit(limit)
      .offset(offset);

    return Response.json(userTransactions);
  } catch (error) {
    console.error('Transaction fetch error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
