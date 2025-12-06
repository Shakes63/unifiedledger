import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import {
  userHouseholdPreferences,
  accounts,
  transactions,
  bills,
  billInstances,
  budgetCategories,
} from '@/lib/db/schema';
import { eq, and, gte, lte, inArray, sum } from 'drizzle-orm';
import { isMemberOfHousehold } from '@/lib/household/permissions';
import Decimal from 'decimal.js';
import {
  getCurrentBudgetPeriod,
  getDaysUntilNextPeriod,
  getPeriodBudgetAmount,
  getPeriodLabel,
  calculateAvailableAmount,
  getDefaultBudgetScheduleSettings,
  type BudgetScheduleSettings,
  type BudgetCycleFrequency,
} from '@/lib/budgets/budget-schedule';

export const dynamic = 'force-dynamic';

// Account types considered as "cash" (liquid assets)
const CASH_ACCOUNT_TYPES = ['checking', 'savings', 'cash'] as const;
type CashAccountType = (typeof CASH_ACCOUNT_TYPES)[number];

interface BillBreakdownItem {
  id: string;
  name: string;
  amount: number;
  dueDate: string;
  isAutopay: boolean;
  categoryName?: string;
}

/**
 * GET /api/budget-schedule/available
 * Calculate available amount for current budget period
 * 
 * Query params:
 * - householdId: string (required)
 * 
 * Returns:
 * - currentPeriod: { start, end, label, daysRemaining }
 * - periodBudget: number (monthly budget / periods)
 * - cashBalance: number (sum of checking, savings, cash accounts)
 * - paidThisPeriod: number (expenses since period start)
 * - autopayDue: number (autopay bills due before period end)
 * - manualBillsDue: number (non-autopay bills due before period end)
 * - billsBreakdown: { paid, autopayUpcoming, manualUpcoming }
 * - available: number (the key calculation)
 * - rolloverFromPrevious: number (if rollover enabled)
 */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await requireAuth();
    
    const householdId = request.nextUrl.searchParams.get('householdId');
    if (!householdId) {
      return NextResponse.json(
        { error: 'householdId is required' },
        { status: 400 }
      );
    }

    // Verify user is a member of this household
    if (!(await isMemberOfHousehold(householdId, userId))) {
      return NextResponse.json(
        { error: 'Not a member of this household' },
        { status: 403 }
      );
    }

    // Fetch user's budget schedule settings
    const preferences = await db
      .select()
      .from(userHouseholdPreferences)
      .where(
        and(
          eq(userHouseholdPreferences.userId, userId),
          eq(userHouseholdPreferences.householdId, householdId)
        )
      )
      .limit(1);

    const defaultSettings = getDefaultBudgetScheduleSettings();
    const settings: BudgetScheduleSettings = preferences.length > 0
      ? {
          budgetCycleFrequency: (preferences[0].budgetCycleFrequency as BudgetCycleFrequency) || defaultSettings.budgetCycleFrequency,
          budgetCycleStartDay: preferences[0].budgetCycleStartDay ?? defaultSettings.budgetCycleStartDay,
          budgetCycleReferenceDate: preferences[0].budgetCycleReferenceDate ?? defaultSettings.budgetCycleReferenceDate,
          budgetCycleSemiMonthlyDays: preferences[0].budgetCycleSemiMonthlyDays ?? defaultSettings.budgetCycleSemiMonthlyDays,
          budgetPeriodRollover: preferences[0].budgetPeriodRollover ?? defaultSettings.budgetPeriodRollover,
          budgetPeriodManualAmount: preferences[0].budgetPeriodManualAmount ?? defaultSettings.budgetPeriodManualAmount,
        }
      : defaultSettings;

    // Get current period
    const currentPeriod = getCurrentBudgetPeriod(settings);
    const daysRemaining = getDaysUntilNextPeriod(settings);
    const periodLabel = getPeriodLabel(currentPeriod, settings.budgetCycleFrequency);

    // 1. Calculate cash balance from accounts
    const cashAccounts = await db
      .select({
        currentBalance: accounts.currentBalance,
      })
      .from(accounts)
      .where(
        and(
          eq(accounts.householdId, householdId),
          eq(accounts.isActive, true),
          inArray(accounts.type, CASH_ACCOUNT_TYPES as readonly CashAccountType[])
        )
      );

    const cashBalance = cashAccounts.reduce((sum, acc) => {
      return new Decimal(sum).plus(new Decimal(acc.currentBalance || 0)).toNumber();
    }, 0);

    // 2. Calculate expenses paid this period
    const expenseResult = await db
      .select({ total: sum(transactions.amount) })
      .from(transactions)
      .where(
        and(
          eq(transactions.householdId, householdId),
          eq(transactions.type, 'expense'),
          gte(transactions.date, currentPeriod.startStr),
          lte(transactions.date, currentPeriod.endStr)
        )
      );

    const paidThisPeriod = expenseResult[0]?.total
      ? new Decimal(expenseResult[0].total.toString()).toNumber()
      : 0;

    // Get expense transactions for breakdown
    const paidTransactions = await db
      .select({
        id: transactions.id,
        description: transactions.description,
        amount: transactions.amount,
        date: transactions.date,
        categoryId: transactions.categoryId,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.householdId, householdId),
          eq(transactions.type, 'expense'),
          gte(transactions.date, currentPeriod.startStr),
          lte(transactions.date, currentPeriod.endStr)
        )
      )
      .limit(50);

    // Get category names for paid transactions
    const categoryIds = paidTransactions
      .map((t) => t.categoryId)
      .filter((id): id is string => id !== null);
    
    const categories = categoryIds.length > 0
      ? await db
          .select({ id: budgetCategories.id, name: budgetCategories.name })
          .from(budgetCategories)
          .where(inArray(budgetCategories.id, categoryIds))
      : [];
    
    const categoryMap = new Map(categories.map((c) => [c.id, c.name]));

    // 3. Get upcoming bills due before period end
    const upcomingBills = await db
      .select({
        billId: bills.id,
        billName: bills.name,
        instanceId: billInstances.id,
        dueDate: billInstances.dueDate,
        expectedAmount: billInstances.expectedAmount,
        isAutopay: bills.isAutopayEnabled,
        categoryId: bills.categoryId,
        status: billInstances.status,
      })
      .from(billInstances)
      .innerJoin(bills, eq(billInstances.billId, bills.id))
      .where(
        and(
          eq(bills.householdId, householdId),
          eq(bills.isActive, true),
          inArray(billInstances.status, ['pending', 'overdue']),
          gte(billInstances.dueDate, currentPeriod.startStr),
          lte(billInstances.dueDate, currentPeriod.endStr)
        )
      );

    // Separate autopay vs manual bills
    const autopayBills: BillBreakdownItem[] = [];
    const manualBills: BillBreakdownItem[] = [];

    for (const bill of upcomingBills) {
      const item: BillBreakdownItem = {
        id: bill.instanceId,
        name: bill.billName,
        amount: bill.expectedAmount,
        dueDate: bill.dueDate,
        isAutopay: bill.isAutopay || false,
        categoryName: bill.categoryId ? categoryMap.get(bill.categoryId) : undefined,
      };

      if (bill.isAutopay) {
        autopayBills.push(item);
      } else {
        manualBills.push(item);
      }
    }

    const autopayDue = autopayBills.reduce((sum, b) => {
      return new Decimal(sum).plus(new Decimal(b.amount)).toNumber();
    }, 0);

    const manualBillsDue = manualBills.reduce((sum, b) => {
      return new Decimal(sum).plus(new Decimal(b.amount)).toNumber();
    }, 0);

    // 4. Calculate total monthly budget (sum of expense category budgets)
    const budgetResult = await db
      .select({ total: sum(budgetCategories.monthlyBudget) })
      .from(budgetCategories)
      .where(
        and(
          eq(budgetCategories.householdId, householdId),
          eq(budgetCategories.type, 'expense'),
          eq(budgetCategories.isActive, true)
        )
      );

    const monthlyBudget = budgetResult[0]?.total
      ? new Decimal(budgetResult[0].total.toString()).toNumber()
      : 0;

    // Calculate period budget amount
    const periodBudget = getPeriodBudgetAmount(
      monthlyBudget,
      settings.budgetCycleFrequency,
      settings.budgetPeriodManualAmount
    );

    // 5. Calculate rollover (simplified - in real implementation, would track from previous period)
    const rolloverFromPrevious = 0; // TODO: Implement actual rollover tracking

    // 6. Calculate available amount
    const available = calculateAvailableAmount(
      cashBalance,
      paidThisPeriod,
      autopayDue,
      manualBillsDue,
      rolloverFromPrevious
    );

    return NextResponse.json({
      currentPeriod: {
        start: currentPeriod.startStr,
        end: currentPeriod.endStr,
        label: periodLabel,
        daysRemaining,
        periodNumber: currentPeriod.periodNumber,
        periodsInMonth: currentPeriod.periodsInMonth,
      },
      settings: {
        frequency: settings.budgetCycleFrequency,
        rolloverEnabled: settings.budgetPeriodRollover,
      },
      periodBudget,
      monthlyBudget,
      cashBalance,
      paidThisPeriod,
      autopayDue,
      manualBillsDue,
      billsBreakdown: {
        paid: paidTransactions.map((t) => ({
          id: t.id,
          description: t.description,
          amount: t.amount || 0,
          date: t.date,
          categoryName: t.categoryId ? categoryMap.get(t.categoryId) : undefined,
        })),
        autopayUpcoming: autopayBills.sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
        manualUpcoming: manualBills.sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
      },
      available,
      rolloverFromPrevious,
      // Summary stats
      summary: {
        totalCommitted: new Decimal(paidThisPeriod)
          .plus(autopayDue)
          .plus(manualBillsDue)
          .toNumber(),
        percentOfBudgetUsed: periodBudget > 0
          ? new Decimal(paidThisPeriod)
              .dividedBy(periodBudget)
              .times(100)
              .toDecimalPlaces(1)
              .toNumber()
          : 0,
        dailyBudgetRemaining: daysRemaining > 0
          ? new Decimal(available).dividedBy(daysRemaining).toDecimalPlaces(2).toNumber()
          : 0,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Failed to calculate available amount:', error);
    return NextResponse.json(
      { error: 'Failed to calculate available amount' },
      { status: 500 }
    );
  }
}

