import { requireAuth } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { transactions, billInstances, bills, savingsGoals, debts, debtPayoffMilestones, accounts, billMilestones } from '@/lib/db/schema';
import { eq, and, gte, lte, lt, isNotNull, sql, inArray } from 'drizzle-orm';
import { format, addDays, subDays, addMonths } from 'date-fns';

export const dynamic = 'force-dynamic';

interface AutopayEvent {
  id: string;
  billId: string;
  billName: string;
  amount: number;
  autopayAmountType: 'fixed' | 'minimum_payment' | 'statement_balance' | 'full_balance';
  sourceAccountId: string;
  sourceAccountName: string;
  linkedAccountName?: string;
}

interface UnifiedPayoffDate {
  id: string;
  name: string;
  source: 'account' | 'bill';
  sourceType: string;
  remainingBalance: number;
  monthlyPayment: number;
  color?: string;
}

interface BillMilestoneEvent {
  id: string;
  billId?: string;
  accountId?: string;
  name: string;
  percentage: number;
  achievedAt?: string;
  color?: string;
}

interface BillSummary {
  name: string;
  status: string;
  amount: number;
  isDebt?: boolean;
  isAutopayEnabled?: boolean;
  linkedAccountName?: string;
}

interface GoalSummary {
  id: string;
  name: string;
  color: string;
  targetAmount: number;
  currentAmount: number;
  progress: number;
  status: string;
}

interface DebtSummary {
  id: string;
  name: string;
  color: string;
  remainingBalance: number;
  originalAmount: number;
  progress: number;
  type: 'target' | 'milestone';
  milestonePercentage?: number;
  status: string;
}

interface DayTransactionSummary {
  incomeCount: number;
  expenseCount: number;
  transferCount: number;
  totalSpent: number;
  billDueCount: number;
  billOverdueCount: number;
  bills?: BillSummary[];
  goalCount: number;
  goals?: GoalSummary[];
  debtCount: number;
  debts?: DebtSummary[];
  autopayCount: number;
  autopayEvents?: AutopayEvent[];
  payoffDateCount: number;
  payoffDates?: UnifiedPayoffDate[];
  billMilestoneCount: number;
  billMilestones?: BillMilestoneEvent[];
}

function createEmptyDaySummary(): DayTransactionSummary {
  return {
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
    autopayCount: 0,
    autopayEvents: [],
    payoffDateCount: 0,
    payoffDates: [],
    billMilestoneCount: 0,
    billMilestones: [],
  };
}

/**
 * GET /api/calendar/month
 * Get transaction, bill, autopay, and payoff summaries for each day in a month range
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

    const daySummaries: Record<string, DayTransactionSummary> = {};

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
    for (const txn of monthTransactions) {
      const dateKey = txn.date;

      if (!daySummaries[dateKey]) {
        daySummaries[dateKey] = createEmptyDaySummary();
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

    // Get all bills for enrichment (single query for performance)
    const billIds = [...new Set(monthBillInstances.map(bi => bi.billId))];
    const allBills = billIds.length > 0 
      ? await db
          .select()
          .from(bills)
          .where(
            and(
              eq(bills.userId, userId),
              inArray(bills.id, billIds)
            )
          )
      : [];
    
    const billMap = new Map(allBills.map(b => [b.id, b]));

    // Get accounts for linked account names
    const linkedAccountIds = allBills
      .filter(b => b.linkedAccountId)
      .map(b => b.linkedAccountId as string);
    const autopayAccountIds = allBills
      .filter(b => b.autopayAccountId)
      .map(b => b.autopayAccountId as string);
    const allAccountIds = [...new Set([...linkedAccountIds, ...autopayAccountIds])];
    
    const allAccounts = allAccountIds.length > 0
      ? await db
          .select()
          .from(accounts)
          .where(
            and(
              eq(accounts.userId, userId),
              inArray(accounts.id, allAccountIds)
            )
          )
      : [];
    
    const accountMap = new Map(allAccounts.map(a => [a.id, a]));

    // Add bill details to day summaries
    for (const billInstance of monthBillInstances) {
      const dateKey = billInstance.dueDate;

      if (!daySummaries[dateKey]) {
        daySummaries[dateKey] = createEmptyDaySummary();
      }

      const bill = billMap.get(billInstance.billId);
      if (bill) {
        const linkedAccount = bill.linkedAccountId ? accountMap.get(bill.linkedAccountId) : null;
        
        daySummaries[dateKey].bills = daySummaries[dateKey].bills || [];
        daySummaries[dateKey].bills!.push({
          name: bill.name,
          status: billInstance.status || 'pending',
          amount: billInstance.expectedAmount,
          isDebt: bill.isDebt || false,
          isAutopayEnabled: bill.isAutopayEnabled || false,
          linkedAccountName: linkedAccount?.name,
        });

        if (billInstance.status === 'overdue') {
          daySummaries[dateKey].billOverdueCount++;
        } else if (billInstance.status === 'pending') {
          daySummaries[dateKey].billDueCount++;
        }

        // Add autopay event for bills with autopay enabled
        if (bill.isAutopayEnabled && bill.autopayAccountId && billInstance.status === 'pending') {
          const autopayDaysBefore = bill.autopayDaysBefore || 0;
          const autopayDate = format(subDays(new Date(billInstance.dueDate), autopayDaysBefore), 'yyyy-MM-dd');
          
          // Only add if autopay date is within our range
          if (autopayDate >= format(startDate, 'yyyy-MM-dd') && autopayDate <= format(endDate, 'yyyy-MM-dd')) {
            if (!daySummaries[autopayDate]) {
              daySummaries[autopayDate] = createEmptyDaySummary();
            }

            const sourceAccount = accountMap.get(bill.autopayAccountId);
            
            daySummaries[autopayDate].autopayEvents = daySummaries[autopayDate].autopayEvents || [];
            daySummaries[autopayDate].autopayEvents!.push({
              id: `autopay-${billInstance.id}`,
              billId: bill.id,
              billName: bill.name,
              amount: bill.autopayAmountType === 'fixed' 
                ? (bill.autopayFixedAmount || billInstance.expectedAmount)
                : billInstance.expectedAmount,
              autopayAmountType: (bill.autopayAmountType as 'fixed' | 'minimum_payment' | 'statement_balance' | 'full_balance') || 'fixed',
              sourceAccountId: bill.autopayAccountId,
              sourceAccountName: sourceAccount?.name || 'Unknown Account',
              linkedAccountName: linkedAccount?.name,
            });
            daySummaries[autopayDate].autopayCount++;
          }
        }
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
        daySummaries[dateKey] = createEmptyDaySummary();
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

    // Get all debts with target payoff dates in this month (legacy debts table)
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

    // Add debt target payoff dates to day summaries (legacy)
    for (const debt of monthDebts) {
      if (!debt.targetPayoffDate) continue;

      const dateKey = debt.targetPayoffDate;

      if (!daySummaries[dateKey]) {
        daySummaries[dateKey] = createEmptyDaySummary();
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

    // Get achieved milestones in this month (legacy debt milestones)
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

    // Add legacy milestones to day summaries
    for (const { milestone, debt } of monthMilestones) {
      if (!milestone.achievedAt) continue;
      
      const dateKey = milestone.achievedAt.split('T')[0];

      if (!daySummaries[dateKey]) {
        daySummaries[dateKey] = createEmptyDaySummary();
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

    // ========== NEW: Unified Architecture - Projected Payoff Dates ==========
    
    // Get credit accounts with balances
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

    // Get debt bills
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

    // Calculate and add projected payoff dates for unified debts
    const unifiedDebts: Array<{
      id: string;
      name: string;
      source: 'account' | 'bill';
      sourceType: string;
      remainingBalance: number;
      monthlyPayment: number;
      color?: string;
    }> = [];

    // Add credit accounts
    for (const acc of creditAccounts) {
      const balance = Math.abs(acc.currentBalance || 0);
      if (balance <= 0) continue;

      const monthlyPayment = acc.budgetedMonthlyPayment || acc.minimumPaymentAmount || 0;
      if (monthlyPayment <= 0) continue;

      unifiedDebts.push({
        id: acc.id,
        name: acc.name,
        source: 'account',
        sourceType: acc.type,
        remainingBalance: balance,
        monthlyPayment,
        color: acc.color || undefined,
      });
    }

    // Add debt bills
    for (const bill of debtBills) {
      const balance = bill.remainingBalance || 0;
      if (balance <= 0) continue;

      const monthlyPayment = bill.budgetedMonthlyPayment || bill.minimumPayment || bill.amount;
      if (monthlyPayment <= 0) continue;

      unifiedDebts.push({
        id: bill.id,
        name: bill.name,
        source: 'bill',
        sourceType: bill.debtType || 'other',
        remainingBalance: balance,
        monthlyPayment,
        color: bill.billColor || undefined,
      });
    }

    // Calculate projected payoff dates and add to calendar
    for (const debt of unifiedDebts) {
      const monthsToPayoff = Math.ceil(debt.remainingBalance / debt.monthlyPayment);
      const payoffDate = addMonths(new Date(), monthsToPayoff);
      const payoffDateKey = format(payoffDate, 'yyyy-MM-dd');

      // Only add if payoff date is within our range
      if (payoffDateKey >= format(startDate, 'yyyy-MM-dd') && payoffDateKey <= format(endDate, 'yyyy-MM-dd')) {
        if (!daySummaries[payoffDateKey]) {
          daySummaries[payoffDateKey] = createEmptyDaySummary();
        }

        daySummaries[payoffDateKey].payoffDates = daySummaries[payoffDateKey].payoffDates || [];
        daySummaries[payoffDateKey].payoffDates!.push({
          id: debt.id,
          name: debt.name,
          source: debt.source,
          sourceType: debt.sourceType,
          remainingBalance: debt.remainingBalance,
          monthlyPayment: debt.monthlyPayment,
          color: debt.color,
        });
        daySummaries[payoffDateKey].payoffDateCount++;
      }
    }

    // ========== NEW: Bill Milestones (from unified architecture) ==========
    
    const unifiedMilestones = await db
      .select()
      .from(billMilestones)
      .where(
        and(
          eq(billMilestones.userId, userId),
          isNotNull(billMilestones.achievedAt),
          gte(billMilestones.achievedAt, startDateStr2),
          lte(billMilestones.achievedAt, endDateStr2)
        )
      );

    // Get related bills and accounts for milestone names
    const milestoneBillIds = unifiedMilestones.filter(m => m.billId).map(m => m.billId as string);
    const milestoneAccountIds = unifiedMilestones.filter(m => m.accountId).map(m => m.accountId as string);

    const milestoneBills = milestoneBillIds.length > 0
      ? await db
          .select()
          .from(bills)
          .where(inArray(bills.id, milestoneBillIds))
      : [];
    
    const milestoneAccounts = milestoneAccountIds.length > 0
      ? await db
          .select()
          .from(accounts)
          .where(inArray(accounts.id, milestoneAccountIds))
      : [];

    const milestoneBillMap = new Map(milestoneBills.map(b => [b.id, b]));
    const milestoneAccountMap = new Map(milestoneAccounts.map(a => [a.id, a]));

    // Add bill milestones to day summaries
    for (const milestone of unifiedMilestones) {
      if (!milestone.achievedAt) continue;
      
      const dateKey = milestone.achievedAt.split('T')[0];

      if (!daySummaries[dateKey]) {
        daySummaries[dateKey] = createEmptyDaySummary();
      }

      let name = 'Unknown';
      let color: string | undefined;

      if (milestone.billId) {
        const bill = milestoneBillMap.get(milestone.billId);
        if (bill) {
          name = bill.name;
          color = bill.billColor || undefined;
        }
      } else if (milestone.accountId) {
        const account = milestoneAccountMap.get(milestone.accountId);
        if (account) {
          name = account.name;
          color = account.color || undefined;
        }
      }

      daySummaries[dateKey].billMilestones = daySummaries[dateKey].billMilestones || [];
      daySummaries[dateKey].billMilestones!.push({
        id: milestone.id,
        billId: milestone.billId || undefined,
        accountId: milestone.accountId || undefined,
        name: `${name} - ${milestone.percentage}% Paid Off!`,
        percentage: milestone.percentage,
        achievedAt: milestone.achievedAt,
        color,
      });
      daySummaries[dateKey].billMilestoneCount++;
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
