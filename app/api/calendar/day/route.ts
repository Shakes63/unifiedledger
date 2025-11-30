import { requireAuth } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { transactions, budgetCategories, billInstances, bills, accounts, merchants, savingsGoals, debts, debtPayoffMilestones } from '@/lib/db/schema';
import { eq, and, lt, isNotNull, gte, lte } from 'drizzle-orm';
import { format } from 'date-fns';

export const dynamic = 'force-dynamic';

/**
 * GET /api/calendar/day
 * Get detailed transaction and bill information for a specific day
 * Query params: date (ISO string)
 */
export async function GET(request: Request) {
  try {
    const { userId } = await requireAuth();

    const { searchParams } = new URL(request.url);
    const dateStr = searchParams.get('date');

    if (!dateStr) {
      return Response.json(
        { error: 'date is required' },
        { status: 400 }
      );
    }

    const date = new Date(dateStr);
    const dateKey = format(date, 'yyyy-MM-dd');

    // Update any pending bills that are now overdue
    const today = format(new Date(), 'yyyy-MM-dd');
    await db
      .update(billInstances)
      .set({ status: 'overdue' })
      .where(
        and(
          eq(billInstances.userId, userId),
          eq(billInstances.status, 'pending'),
          lt(billInstances.dueDate, today)
        )
      );

    // Get all transactions for this day
    const dayTransactions = await db
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          eq(transactions.date, dateKey)
        )
      );

    // Enrich transactions with category names, merchant names, and account names
    const enrichedTransactions = await Promise.all(
      dayTransactions.map(async (txn) => {
        let categoryName: string | undefined;
        let merchantName: string | undefined;
        let accountName: string | undefined;

        if (txn.categoryId && txn.categoryId !== 'transfer_in' && txn.categoryId !== 'transfer_out') {
          const category = await db
            .select()
            .from(budgetCategories)
            .where(
              and(
                eq(budgetCategories.id, txn.categoryId),
                eq(budgetCategories.userId, userId)
              )
            )
            .limit(1);

          if (category.length > 0) {
            categoryName = category[0].name;
          }
        }

        // Get the merchant name for this transaction
        if (txn.merchantId) {
          const merchant = await db
            .select()
            .from(merchants)
            .where(
              and(
                eq(merchants.id, txn.merchantId),
                eq(merchants.userId, userId)
              )
            )
            .limit(1);

          if (merchant.length > 0) {
            merchantName = merchant[0].name;
          }
        }

        // Get the account name for this transaction
        if (txn.accountId) {
          const account = await db
            .select()
            .from(accounts)
            .where(
              and(
                eq(accounts.id, txn.accountId),
                eq(accounts.userId, userId)
              )
            )
            .limit(1);

          if (account.length > 0) {
            accountName = account[0].name;
          }
        }

        return {
          id: txn.id,
          description: txn.description,
          amount: parseFloat(txn.amount?.toString() || '0'),
          type: txn.type as
            | 'income'
            | 'expense'
            | 'transfer_in'
            | 'transfer_out',
          category: categoryName,
          merchant: merchantName || null,
          accountName: accountName,
        };
      })
    );

    // Get all bill instances for this day
    const dayBillInstances = await db
      .select()
      .from(billInstances)
      .where(
        and(
          eq(billInstances.userId, userId),
          eq(billInstances.dueDate, dateKey)
        )
      );

    // Enrich bill instances with bill details
    const enrichedBills = await Promise.all(
      dayBillInstances.map(async (instance) => {
        const bill = await db
          .select()
          .from(bills)
          .where(
            and(
              eq(bills.id, instance.billId),
              eq(bills.userId, userId)
            )
          )
          .limit(1);

        return {
          id: instance.id,
          description: bill[0]?.name || 'Unknown Bill',
          amount: instance.expectedAmount,
          dueDate: instance.dueDate,
          status: instance.status as 'pending' | 'paid' | 'overdue',
        };
      })
    );

    // Get all savings goals with target date on this day
    const dayGoals = await db
      .select()
      .from(savingsGoals)
      .where(
        and(
          eq(savingsGoals.userId, userId),
          eq(savingsGoals.targetDate, dateKey)
        )
      );

    // Enrich goals with progress calculation
    const enrichedGoals = dayGoals.map((goal) => {
      const targetAmount = goal.targetAmount || 0;
      const currentAmount = goal.currentAmount || 0;
      const progress = targetAmount > 0 ? Math.round((currentAmount / targetAmount) * 100) : 0;

      return {
        id: goal.id,
        name: goal.name,
        description: goal.description,
        targetAmount,
        currentAmount,
        progress,
        color: goal.color || '#10b981',
        icon: goal.icon || 'target',
        status: goal.status || 'active',
        category: goal.category,
      };
    });

    // Get all debts with target payoff date on this day
    const dayDebts = await db
      .select()
      .from(debts)
      .where(
        and(
          eq(debts.userId, userId),
          eq(debts.targetPayoffDate, dateKey)
        )
      );

    // Enrich debts with progress calculation
    const enrichedDebts: Array<{
      id: string;
      name: string;
      description: string | null;
      creditorName: string;
      remainingBalance: number;
      originalAmount: number;
      progress: number;
      color: string;
      icon: string;
      type: string;
      status: string;
      debtType: 'target' | 'milestone';
      milestonePercentage?: number;
    }> = dayDebts.map((debt) => {
      const originalAmount = debt.originalAmount || 0;
      const remainingBalance = debt.remainingBalance || 0;
      const progress = originalAmount > 0 
        ? Math.round(((originalAmount - remainingBalance) / originalAmount) * 100) 
        : 0;

      return {
        id: debt.id,
        name: debt.name,
        description: debt.description,
        creditorName: debt.creditorName,
        remainingBalance,
        originalAmount,
        progress,
        color: debt.color || '#ef4444',
        icon: debt.icon || 'credit-card',
        type: debt.type || 'other',
        status: debt.status || 'active',
        debtType: 'target' as const,
      };
    });

    // Get milestones achieved on this day
    // Match the date part of achievedAt (which is an ISO string)
    const dayStart = dateKey;
    const dayEnd = dateKey + 'T23:59:59';
    
    const dayMilestones = await db
      .select({
        milestone: debtPayoffMilestones,
        debt: debts
      })
      .from(debtPayoffMilestones)
      .innerJoin(debts, eq(debtPayoffMilestones.debtId, debts.id))
      .where(
        and(
          eq(debtPayoffMilestones.userId, userId),
          isNotNull(debtPayoffMilestones.achievedAt),
          gte(debtPayoffMilestones.achievedAt, dayStart),
          lte(debtPayoffMilestones.achievedAt, dayEnd)
        )
      );

    // Add milestones to enriched debts array
    for (const { milestone, debt } of dayMilestones) {
      enrichedDebts.push({
        id: `${debt.id}-milestone-${milestone.percentage}`,
        name: debt.name,
        description: `${milestone.percentage}% of debt paid off!`,
        creditorName: debt.creditorName || '',
        remainingBalance: debt.remainingBalance || 0,
        originalAmount: debt.originalAmount || 0,
        progress: milestone.percentage,
        color: debt.color || '#ef4444',
        icon: debt.icon || 'credit-card',
        type: debt.type || 'other',
        status: debt.status || 'active',
        debtType: 'milestone' as const,
        milestonePercentage: milestone.percentage,
      });
    }

    // Calculate summary statistics
    const billDueCount = dayBillInstances.filter(
      (b) => b.status === 'pending'
    ).length;
    const billOverdueCount = dayBillInstances.filter(
      (b) => b.status === 'overdue'
    ).length;

    const summary = {
      incomeCount: enrichedTransactions.filter(
        (t) => t.type === 'income'
      ).length,
      expenseCount: enrichedTransactions.filter(
        (t) => t.type === 'expense'
      ).length,
      transferCount: enrichedTransactions.filter(
        (t) =>
          t.type === 'transfer_in' || t.type === 'transfer_out'
      ).length,
      totalSpent: enrichedTransactions
        .filter((t) => t.type === 'expense')
        .reduce((sum, t) => sum + Math.abs(t.amount), 0),
      billDueCount,
      billOverdueCount,
      goalCount: enrichedGoals.length,
      debtCount: enrichedDebts.length,
    };

    return Response.json({
      date: dateKey,
      transactions: enrichedTransactions,
      bills: enrichedBills,
      goals: enrichedGoals,
      debts: enrichedDebts,
      summary,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error fetching calendar day data:', error);
    return Response.json(
      { error: 'Failed to fetch day details' },
      { status: 500 }
    );
  }
}
