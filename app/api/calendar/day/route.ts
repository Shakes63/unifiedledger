import { requireAuth } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { transactions, budgetCategories, billInstances, bills, accounts, merchants, savingsGoals, debts, debtPayoffMilestones, billMilestones } from '@/lib/db/schema';
import { eq, and, lt, isNotNull, gte, lte, inArray } from 'drizzle-orm';
import { format, addMonths, subDays } from 'date-fns';

export const dynamic = 'force-dynamic';

/**
 * GET /api/calendar/day
 * Get detailed transaction, bill, autopay, and payoff information for a specific day
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

        let linkedAccountName: string | undefined;
        if (bill[0]?.linkedAccountId) {
          const linkedAccount = await db
            .select()
            .from(accounts)
            .where(eq(accounts.id, bill[0].linkedAccountId))
            .limit(1);
          linkedAccountName = linkedAccount[0]?.name;
        }

        return {
          id: instance.id,
          billId: bill[0]?.id,
          description: bill[0]?.name || 'Unknown Bill',
          amount: instance.expectedAmount,
          dueDate: instance.dueDate,
          status: instance.status as 'pending' | 'paid' | 'overdue',
          isDebt: bill[0]?.isDebt || false,
          isAutopayEnabled: bill[0]?.isAutopayEnabled || false,
          linkedAccountName,
        };
      })
    );

    // ========== NEW: Autopay Events for this day ==========
    // Find bills where (dueDate - autopayDaysBefore) = this day
    const allAutopayBills = await db
      .select()
      .from(bills)
      .where(
        and(
          eq(bills.userId, userId),
          eq(bills.isAutopayEnabled, true),
          eq(bills.isActive, true)
        )
      );

    // Get pending bill instances for autopay bills to find their due dates
    const autopayBillIds = allAutopayBills.map(b => b.id);
    const pendingAutopayInstances = autopayBillIds.length > 0
      ? await db
          .select()
          .from(billInstances)
          .where(
            and(
              eq(billInstances.userId, userId),
              eq(billInstances.status, 'pending'),
              inArray(billInstances.billId, autopayBillIds)
            )
          )
      : [];

    // Calculate which autopay events fall on this day
    interface AutopayEvent {
      id: string;
      billId: string;
      billInstanceId: string;
      billName: string;
      amount: number;
      autopayAmountType: string;
      sourceAccountId: string;
      sourceAccountName: string;
      linkedAccountId?: string;
      linkedAccountName?: string;
      dueDate: string;
    }
    
    const autopayEvents: AutopayEvent[] = [];
    
    for (const instance of pendingAutopayInstances) {
      const bill = allAutopayBills.find(b => b.id === instance.billId);
      if (!bill || !bill.autopayAccountId) continue;

      const autopayDaysBefore = bill.autopayDaysBefore || 0;
      const autopayDate = format(subDays(new Date(instance.dueDate), autopayDaysBefore), 'yyyy-MM-dd');

      if (autopayDate === dateKey) {
        // Get account names
        const sourceAccount = await db
          .select()
          .from(accounts)
          .where(eq(accounts.id, bill.autopayAccountId))
          .limit(1);

        let linkedAccountName: string | undefined;
        if (bill.linkedAccountId) {
          const linkedAccount = await db
            .select()
            .from(accounts)
            .where(eq(accounts.id, bill.linkedAccountId))
            .limit(1);
          linkedAccountName = linkedAccount[0]?.name;
        }

        autopayEvents.push({
          id: `autopay-${instance.id}`,
          billId: bill.id,
          billInstanceId: instance.id,
          billName: bill.name,
          amount: bill.autopayAmountType === 'fixed' 
            ? (bill.autopayFixedAmount || instance.expectedAmount)
            : instance.expectedAmount,
          autopayAmountType: bill.autopayAmountType || 'fixed',
          sourceAccountId: bill.autopayAccountId,
          sourceAccountName: sourceAccount[0]?.name || 'Unknown Account',
          linkedAccountId: bill.linkedAccountId || undefined,
          linkedAccountName,
          dueDate: instance.dueDate,
        });
      }
    }

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

    // Get all debts with target payoff date on this day (legacy)
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
      source?: 'legacy' | 'account' | 'bill';
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
        source: 'legacy' as const,
      };
    });

    // Get milestones achieved on this day (legacy)
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

    // Add legacy milestones to enriched debts array
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
        source: 'legacy' as const,
      });
    }

    // ========== NEW: Unified Payoff Dates ==========
    interface UnifiedPayoffDate {
      id: string;
      name: string;
      source: 'account' | 'bill';
      sourceType: string;
      remainingBalance: number;
      monthlyPayment: number;
      projectedPayoffDate: string;
      color?: string;
      interestRate?: number;
    }
    
    const payoffDates: UnifiedPayoffDate[] = [];

    // Check if any credit accounts have projected payoff on this day
    const creditAccounts = await db
      .select()
      .from(accounts)
      .where(
        and(
          eq(accounts.userId, userId),
          inArray(accounts.type, ['credit', 'line_of_credit']),
          eq(accounts.isActive, true)
        )
      );

    for (const acc of creditAccounts) {
      const balance = Math.abs(acc.currentBalance || 0);
      if (balance <= 0) continue;

      const monthlyPayment = acc.budgetedMonthlyPayment || acc.minimumPaymentAmount || 0;
      if (monthlyPayment <= 0) continue;

      const monthsToPayoff = Math.ceil(balance / monthlyPayment);
      const payoffDate = format(addMonths(new Date(), monthsToPayoff), 'yyyy-MM-dd');

      if (payoffDate === dateKey) {
        payoffDates.push({
          id: acc.id,
          name: acc.name,
          source: 'account',
          sourceType: acc.type,
          remainingBalance: balance,
          monthlyPayment,
          projectedPayoffDate: payoffDate,
          color: acc.color || undefined,
          interestRate: acc.interestRate || undefined,
        });
      }
    }

    // Check if any debt bills have projected payoff on this day
    const debtBills = await db
      .select()
      .from(bills)
      .where(
        and(
          eq(bills.userId, userId),
          eq(bills.isDebt, true),
          eq(bills.isActive, true)
        )
      );

    for (const bill of debtBills) {
      const balance = bill.remainingBalance || 0;
      if (balance <= 0) continue;

      const monthlyPayment = bill.budgetedMonthlyPayment || bill.minimumPayment || bill.amount;
      if (monthlyPayment <= 0) continue;

      const monthsToPayoff = Math.ceil(balance / monthlyPayment);
      const payoffDate = format(addMonths(new Date(), monthsToPayoff), 'yyyy-MM-dd');

      if (payoffDate === dateKey) {
        payoffDates.push({
          id: bill.id,
          name: bill.name,
          source: 'bill',
          sourceType: bill.debtType || 'other',
          remainingBalance: balance,
          monthlyPayment,
          projectedPayoffDate: payoffDate,
          color: bill.billColor || undefined,
          interestRate: bill.billInterestRate || undefined,
        });
      }
    }

    // ========== NEW: Bill Milestones (unified architecture) ==========
    interface BillMilestoneEvent {
      id: string;
      billId?: string;
      accountId?: string;
      name: string;
      percentage: number;
      achievedAt: string;
      color?: string;
      milestoneBalance: number;
      source: 'account' | 'bill';
    }
    
    const billMilestoneEvents: BillMilestoneEvent[] = [];

    const dayBillMilestones = await db
      .select()
      .from(billMilestones)
      .where(
        and(
          eq(billMilestones.userId, userId),
          isNotNull(billMilestones.achievedAt),
          gte(billMilestones.achievedAt, dayStart),
          lte(billMilestones.achievedAt, dayEnd)
        )
      );

    for (const milestone of dayBillMilestones) {
      let name = 'Unknown';
      let color: string | undefined;
      let source: 'account' | 'bill' = 'bill';

      if (milestone.billId) {
        const bill = await db
          .select()
          .from(bills)
          .where(eq(bills.id, milestone.billId))
          .limit(1);
        if (bill[0]) {
          name = bill[0].name;
          color = bill[0].billColor || undefined;
        }
        source = 'bill';
      } else if (milestone.accountId) {
        const account = await db
          .select()
          .from(accounts)
          .where(eq(accounts.id, milestone.accountId))
          .limit(1);
        if (account[0]) {
          name = account[0].name;
          color = account[0].color || undefined;
        }
        source = 'account';
      }

      billMilestoneEvents.push({
        id: milestone.id,
        billId: milestone.billId || undefined,
        accountId: milestone.accountId || undefined,
        name,
        percentage: milestone.percentage,
        achievedAt: milestone.achievedAt!,
        color,
        milestoneBalance: milestone.milestoneBalance,
        source,
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
      autopayCount: autopayEvents.length,
      payoffDateCount: payoffDates.length,
      billMilestoneCount: billMilestoneEvents.length,
    };

    return Response.json({
      date: dateKey,
      transactions: enrichedTransactions,
      bills: enrichedBills,
      goals: enrichedGoals,
      debts: enrichedDebts,
      autopayEvents,
      payoffDates,
      billMilestones: billMilestoneEvents,
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
