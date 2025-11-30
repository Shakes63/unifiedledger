import { requireAuth } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { transactions, billInstances, bills, savingsGoals, debts, debtPayoffMilestones } from '@/lib/db/schema';
import { eq, and, gte, lte, lt, isNotNull, sql } from 'drizzle-orm';
import { format } from 'date-fns';

export const dynamic = 'force-dynamic';

/**
 * GET /api/calendar/month
 * Get transaction and bill summaries for each day in a month range
 * Query params: startDate, endDate
 */
export async function GET(request: Request) {
  try {
    const { userId } = await requireAuth();

    const { searchParams } = new URL(request.url);
    const startDateStr = searchParams.get('startDate');
    const endDateStr = searchParams.get('endDate');

    if (!startDateStr || !endDateStr) {
      return Response.json(
        { error: 'startDate and endDate are required' },
        { status: 400 }
      );
    }

    const startDate = new Date(startDateStr);
    const endDate = new Date(endDateStr);

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

    // Get all transactions for the month
    const monthTransactions = await db
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          gte(transactions.date, format(startDate, 'yyyy-MM-dd')),
          lte(transactions.date, format(endDate, 'yyyy-MM-dd'))
        )
      );

    // Group transactions by date and calculate summaries
    const daySummaries: Record<
      string,
      {
        incomeCount: number;
        expenseCount: number;
        transferCount: number;
        totalSpent: number;
        billDueCount: number;
        billOverdueCount: number;
        bills?: Array<{ name: string; status: string; amount: number }>;
        goalCount: number;
        goals?: Array<{
          id: string;
          name: string;
          color: string;
          targetAmount: number;
          currentAmount: number;
          progress: number;
          status: string;
        }>;
        debtCount: number;
        debts?: Array<{
          id: string;
          name: string;
          color: string;
          remainingBalance: number;
          originalAmount: number;
          progress: number;
          type: 'target' | 'milestone';
          milestonePercentage?: number;
          status: string;
        }>;
      }
    > = {};

    for (const txn of monthTransactions) {
      const dateKey = txn.date;

      if (!daySummaries[dateKey]) {
        daySummaries[dateKey] = {
          incomeCount: 0,
          expenseCount: 0,
          transferCount: 0,
          totalSpent: 0,
          billDueCount: 0,
          billOverdueCount: 0,
          bills: [],
          goalCount: 0,
          goals: [],
          debtCount: 0,
          debts: [],
        };
      }

      const summary = daySummaries[dateKey];

      // Count by type
      if (txn.type === 'income') {
        summary.incomeCount++;
      } else if (txn.type === 'expense') {
        summary.expenseCount++;
        summary.totalSpent += Math.abs(
          parseFloat(txn.amount?.toString() || '0')
        );
      } else if (
        txn.type === 'transfer_in' ||
        txn.type === 'transfer_out'
      ) {
        summary.transferCount++;
      }
    }

    // Get all bill instances for the month
    const monthBillInstances = await db
      .select()
      .from(billInstances)
      .where(
        and(
          eq(billInstances.userId, userId),
          gte(billInstances.dueDate, format(startDate, 'yyyy-MM-dd')),
          lte(billInstances.dueDate, format(endDate, 'yyyy-MM-dd'))
        )
      );

    // Add bill details to day summaries
    for (const billInstance of monthBillInstances) {
      const dateKey = billInstance.dueDate;

      if (!daySummaries[dateKey]) {
        daySummaries[dateKey] = {
          incomeCount: 0,
          expenseCount: 0,
          transferCount: 0,
          totalSpent: 0,
          billDueCount: 0,
          billOverdueCount: 0,
          bills: [],
          goalCount: 0,
          goals: [],
          debtCount: 0,
          debts: [],
        };
      }

      // Get bill name
      const bill = await db
        .select()
        .from(bills)
        .where(
          and(
            eq(bills.id, billInstance.billId),
            eq(bills.userId, userId)
          )
        )
        .limit(1);

      if (bill.length > 0) {
        daySummaries[dateKey].bills = daySummaries[dateKey].bills || [];
        daySummaries[dateKey].bills!.push({
          name: bill[0].name,
          status: billInstance.status || 'pending',
          amount: billInstance.expectedAmount,
        });
      }

      if (billInstance.status === 'overdue') {
        daySummaries[dateKey].billOverdueCount++;
      } else if (billInstance.status === 'pending') {
        daySummaries[dateKey].billDueCount++;
      }
    }

    // Get all savings goals with target dates in this month
    const monthGoals = await db
      .select()
      .from(savingsGoals)
      .where(
        and(
          eq(savingsGoals.userId, userId),
          isNotNull(savingsGoals.targetDate),
          gte(savingsGoals.targetDate, format(startDate, 'yyyy-MM-dd')),
          lte(savingsGoals.targetDate, format(endDate, 'yyyy-MM-dd'))
        )
      );

    // Add goal details to day summaries
    for (const goal of monthGoals) {
      if (!goal.targetDate) continue;

      const dateKey = goal.targetDate;

      if (!daySummaries[dateKey]) {
        daySummaries[dateKey] = {
          incomeCount: 0,
          expenseCount: 0,
          transferCount: 0,
          totalSpent: 0,
          billDueCount: 0,
          billOverdueCount: 0,
          bills: [],
          goalCount: 0,
          goals: [],
          debtCount: 0,
          debts: [],
        };
      }

      const targetAmount = goal.targetAmount || 0;
      const currentAmount = goal.currentAmount || 0;
      const progress = targetAmount > 0 ? Math.round((currentAmount / targetAmount) * 100) : 0;

      daySummaries[dateKey].goals = daySummaries[dateKey].goals || [];
      daySummaries[dateKey].goals!.push({
        id: goal.id,
        name: goal.name,
        color: goal.color || '#10b981',
        targetAmount,
        currentAmount,
        progress,
        status: goal.status || 'active',
      });
      daySummaries[dateKey].goalCount++;
    }

    // Get all debts with target payoff dates in this month
    const monthDebts = await db
      .select()
      .from(debts)
      .where(
        and(
          eq(debts.userId, userId),
          isNotNull(debts.targetPayoffDate),
          gte(debts.targetPayoffDate, format(startDate, 'yyyy-MM-dd')),
          lte(debts.targetPayoffDate, format(endDate, 'yyyy-MM-dd'))
        )
      );

    // Add debt target payoff dates to day summaries
    for (const debt of monthDebts) {
      if (!debt.targetPayoffDate) continue;

      const dateKey = debt.targetPayoffDate;

      if (!daySummaries[dateKey]) {
        daySummaries[dateKey] = {
          incomeCount: 0,
          expenseCount: 0,
          transferCount: 0,
          totalSpent: 0,
          billDueCount: 0,
          billOverdueCount: 0,
          bills: [],
          goalCount: 0,
          goals: [],
          debtCount: 0,
          debts: [],
        };
      }

      const originalAmount = debt.originalAmount || 0;
      const remainingBalance = debt.remainingBalance || 0;
      const progress = originalAmount > 0 
        ? Math.round(((originalAmount - remainingBalance) / originalAmount) * 100) 
        : 0;

      daySummaries[dateKey].debts = daySummaries[dateKey].debts || [];
      daySummaries[dateKey].debts!.push({
        id: debt.id,
        name: debt.name,
        color: debt.color || '#ef4444',
        remainingBalance,
        originalAmount,
        progress,
        type: 'target',
        status: debt.status || 'active',
      });
      daySummaries[dateKey].debtCount++;
    }

    // Get achieved milestones in this month
    // We need to find milestones where achievedAt date falls within the range
    const startDateStr2 = format(startDate, 'yyyy-MM-dd');
    const endDateStr2 = format(endDate, 'yyyy-MM-dd') + 'T23:59:59';
    
    const monthMilestones = await db
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
          gte(debtPayoffMilestones.achievedAt, startDateStr2),
          lte(debtPayoffMilestones.achievedAt, endDateStr2)
        )
      );

    // Add milestones to day summaries
    for (const { milestone, debt } of monthMilestones) {
      if (!milestone.achievedAt) continue;
      
      // Get date part only from achievedAt (ISO string)
      const dateKey = milestone.achievedAt.split('T')[0];

      if (!daySummaries[dateKey]) {
        daySummaries[dateKey] = {
          incomeCount: 0,
          expenseCount: 0,
          transferCount: 0,
          totalSpent: 0,
          billDueCount: 0,
          billOverdueCount: 0,
          bills: [],
          goalCount: 0,
          goals: [],
          debtCount: 0,
          debts: [],
        };
      }

      const originalAmount = debt.originalAmount || 0;
      const remainingBalance = debt.remainingBalance || 0;

      daySummaries[dateKey].debts = daySummaries[dateKey].debts || [];
      daySummaries[dateKey].debts!.push({
        id: `${debt.id}-milestone-${milestone.percentage}`,
        name: `${debt.name} - ${milestone.percentage}% Paid Off!`,
        color: debt.color || '#ef4444',
        remainingBalance,
        originalAmount,
        progress: milestone.percentage,
        type: 'milestone',
        milestonePercentage: milestone.percentage,
        status: debt.status || 'active',
      });
      daySummaries[dateKey].debtCount++;
    }

    return Response.json({
      daySummaries,
      month: format(startDate, 'yyyy-MM'),
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error fetching calendar month data:', error);
    return Response.json(
      { error: 'Failed to fetch calendar data' },
      { status: 500 }
    );
  }
}
