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
import { eq, and, gte, lte, inArray, sum, sql } from 'drizzle-orm';
import { isMemberOfHousehold } from '@/lib/household/permissions';
import Decimal from 'decimal.js';
import { toMoneyCents } from '@/lib/utils/money-cents';
import {
  getCurrentBudgetPeriod,
  getDaysUntilNextPeriod,
  getPeriodBudgetAmount,
  getPeriodLabel,
  getDefaultBudgetScheduleSettings,
  type BudgetScheduleSettings,
  type BudgetCycleFrequency,
} from '@/lib/budgets/budget-schedule';
import { getPeriodBillsForBudgetPeriod } from '@/lib/budgets/period-bills-service';

export const dynamic = 'force-dynamic';

interface IncomeBreakdownItem {
  id: string;
  name: string;
  expectedAmount: number;
  actualAmount: number | null;
  status: 'received' | 'pending' | 'overdue';
  dueDate: string;
  variance: number;
}

interface BillBreakdownItem {
  id: string;
  name: string;
  amount: number;
  dueDate: string;
  isAutopay: boolean;
  categoryName?: string;
}

interface AccountItem {
  id: string;
  name: string;
  balance: number;
  type: string;
}

/**
 * GET /api/budget-schedule/paycheck-balance
 * Calculate paycheck balance / discretionary amount for current budget period
 * 
 * Query params:
 * - householdId: string (required)
 * 
 * Returns comprehensive data for the Paycheck Balance Widget including:
 * - Account balances (from accounts marked includeInDiscretionary = true)
 * - Expected and actual income for the period
 * - Bills due (paid and pending)
 * - Prorated budget with actual spending
 * - Discretionary calculations
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
    // ========================================================================
    // 1. Get accounts marked for discretionary calculation
    // ========================================================================
    const discretionaryAccounts = await db
      .select({
        id: accounts.id,
        name: accounts.name,
        currentBalance: accounts.currentBalance,
        currentBalanceCents: accounts.currentBalanceCents,
        type: accounts.type,
      })
      .from(accounts)
      .where(
        and(
          eq(accounts.householdId, householdId),
          eq(accounts.isActive, true),
          eq(accounts.includeInDiscretionary, true)
        )
      );

    const includedAccounts: AccountItem[] = discretionaryAccounts.map((acc) => ({
      id: acc.id,
      name: acc.name,
      balance: new Decimal(
        acc.currentBalanceCents ?? toMoneyCents(acc.currentBalance) ?? 0
      ).div(100).toNumber(),
      type: acc.type,
    }));

    const includedBalance = discretionaryAccounts.reduce((sum, acc) => {
      const cents = acc.currentBalanceCents ?? toMoneyCents(acc.currentBalance) ?? 0;
      return new Decimal(sum).plus(new Decimal(cents).div(100)).toNumber();
    }, 0);

    // Count excluded accounts
    const excludedAccountsResult = await db
      .select({ id: accounts.id })
      .from(accounts)
      .where(
        and(
          eq(accounts.householdId, householdId),
          eq(accounts.isActive, true),
          eq(accounts.includeInDiscretionary, false)
        )
      );
    const excludedCount = excludedAccountsResult.length;

    // ========================================================================
    // 2. Get income for the period (from income bills)
    // ========================================================================
    const incomeBillsData = await db
      .select({
        billId: bills.id,
        billName: bills.name,
        instanceId: billInstances.id,
        dueDate: billInstances.dueDate,
        expectedAmount: billInstances.expectedAmount,
        actualAmount: billInstances.actualAmount,
        status: billInstances.status,
        paidDate: billInstances.paidDate,
      })
      .from(billInstances)
      .innerJoin(bills, eq(billInstances.billId, bills.id))
      .where(
        and(
          eq(bills.householdId, householdId),
          eq(bills.isActive, true),
          eq(bills.billType, 'income'),
          gte(billInstances.dueDate, currentPeriod.startStr),
          lte(billInstances.dueDate, currentPeriod.endStr)
        )
      );

    const incomeBreakdown: IncomeBreakdownItem[] = incomeBillsData.map((item) => {
      const isReceived = item.status === 'paid';
      const isOverdue = item.status === 'overdue';
      const actualAmount = isReceived ? (item.actualAmount || item.expectedAmount) : null;
      const variance = actualAmount !== null 
        ? new Decimal(actualAmount).minus(item.expectedAmount).toNumber()
        : 0;

      return {
        id: item.instanceId,
        name: item.billName,
        expectedAmount: item.expectedAmount,
        actualAmount,
        status: isReceived ? 'received' : (isOverdue ? 'overdue' : 'pending'),
        dueDate: item.dueDate,
        variance,
      };
    });

    const expectedIncome = incomeBreakdown.reduce((sum, item) => {
      return new Decimal(sum).plus(item.expectedAmount).toNumber();
    }, 0);

    const actualIncome = incomeBreakdown
      .filter((item) => item.actualAmount !== null)
      .reduce((sum, item) => {
        return new Decimal(sum).plus(item.actualAmount!).toNumber();
      }, 0);

    const pendingIncome = new Decimal(expectedIncome).minus(actualIncome).toNumber();
    const incomeVariance = new Decimal(actualIncome).minus(expectedIncome).toNumber();
    const incomeVariancePercent = expectedIncome > 0
      ? new Decimal(incomeVariance).dividedBy(expectedIncome).times(100).toDecimalPlaces(1).toNumber()
      : 0;

    // ========================================================================
    // 3. Get expense bills for the period
    // ========================================================================
    const periodExpenseBills = await getPeriodBillsForBudgetPeriod({
      householdId,
      settings,
      period: currentPeriod,
      statuses: ['pending', 'overdue', 'paid'],
      excludeBillType: 'income',
    });

    // Get category names
    const categoryIds = [...new Set(periodExpenseBills.map((row) => row.bill.categoryId).filter((id): id is string => id !== null))];
    const categoriesData = categoryIds.length > 0
      ? await db
          .select({ id: budgetCategories.id, name: budgetCategories.name })
          .from(budgetCategories)
          .where(inArray(budgetCategories.id, categoryIds))
      : [];
    const categoryMap = new Map(categoriesData.map((c) => [c.id, c.name]));

    // Separate into paid, autopay upcoming, and manual upcoming
    const paidBills: BillBreakdownItem[] = [];
    const autopayUpcoming: BillBreakdownItem[] = [];
    const manualUpcoming: BillBreakdownItem[] = [];

    for (const row of periodExpenseBills) {
      const { bill, instance, allocation } = row;
      const baseRemaining = instance.remainingAmount ?? new Decimal(instance.expectedAmount).minus(instance.paidAmount || 0).toNumber();

      const paidAmount = allocation
        ? (allocation.paidAmount && allocation.paidAmount > 0 ? allocation.paidAmount : allocation.allocatedAmount)
        : (instance.actualAmount ?? instance.paidAmount ?? instance.expectedAmount);

      const remainingAmount = allocation
        ? Decimal.max(new Decimal(allocation.allocatedAmount).minus(allocation.paidAmount || 0), 0).toNumber()
        : Decimal.max(new Decimal(baseRemaining), 0).toNumber();

      const isPaid = allocation
        ? allocation.isPaid || remainingAmount <= 0
        : instance.status === 'paid';

      const displayAmount = isPaid ? paidAmount : remainingAmount;
      const item: BillBreakdownItem = {
        id: instance.id,
        name: bill.name,
        amount: displayAmount,
        dueDate: instance.dueDate,
        isAutopay: bill.isAutopayEnabled || false,
        categoryName: bill.categoryId ? categoryMap.get(bill.categoryId) : undefined,
      };

      if (isPaid) {
        paidBills.push(item);
      } else if (bill.isAutopayEnabled) {
        autopayUpcoming.push(item);
      } else {
        manualUpcoming.push(item);
      }
    }

    const billsPaid = paidBills.reduce((sum, b) => new Decimal(sum).plus(b.amount).toNumber(), 0);
    const billsAutopayPending = autopayUpcoming.reduce((sum, b) => new Decimal(sum).plus(b.amount).toNumber(), 0);
    const billsManualPending = manualUpcoming.reduce((sum, b) => new Decimal(sum).plus(b.amount).toNumber(), 0);
    const billsPending = new Decimal(billsAutopayPending).plus(billsManualPending).toNumber();
    const billsTotal = new Decimal(billsPaid).plus(billsPending).toNumber();

    // ========================================================================
    // 4. Calculate prorated budget
    // ========================================================================
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

    const monthlyTotal = budgetResult[0]?.total
      ? new Decimal(budgetResult[0].total.toString()).toNumber()
      : 0;

    const periodAllocation = getPeriodBudgetAmount(
      monthlyTotal,
      settings.budgetCycleFrequency,
      settings.budgetPeriodManualAmount
    );

    // Get actual spending this period (excluding bill payments - those are tracked separately)
    const spendingResult = await db
      .select({ totalCents: sql<number>`COALESCE(SUM(${transactions.amountCents}), 0)` })
      .from(transactions)
      .where(
        and(
          eq(transactions.householdId, householdId),
          eq(transactions.type, 'expense'),
          gte(transactions.date, currentPeriod.startStr),
          lte(transactions.date, currentPeriod.endStr)
        )
      );

    const actualSpent = new Decimal(spendingResult[0]?.totalCents ?? 0).div(100).toNumber();

    const budgetRemaining = new Decimal(periodAllocation).minus(actualSpent).toNumber();
    const percentUsed = periodAllocation > 0
      ? new Decimal(actualSpent).dividedBy(periodAllocation).times(100).toDecimalPlaces(1).toNumber()
      : 0;

    // ========================================================================
    // 5. Calculate discretionary amounts
    // ========================================================================
    // Formula: Account Balance + Expected Income - Bills - Remaining Budget = Discretionary
    
    const expectedDiscretionary = new Decimal(includedBalance)
      .plus(expectedIncome)
      .minus(billsTotal)
      .minus(periodAllocation)
      .toDecimalPlaces(2)
      .toNumber();

    const currentDiscretionary = new Decimal(includedBalance)
      .plus(actualIncome)
      .minus(billsPaid)
      .minus(actualSpent)
      .toDecimalPlaces(2)
      .toNumber();

    // What's actually available right now (balance - pending obligations)
    const projectedDiscretionary = new Decimal(includedBalance)
      .minus(billsPending)
      .minus(Math.max(0, budgetRemaining))
      .toDecimalPlaces(2)
      .toNumber();

    const discretionaryVariance = new Decimal(actualIncome)
      .minus(expectedIncome)
      .toDecimalPlaces(2)
      .toNumber();

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
      },

      // Income section
      income: {
        expected: expectedIncome,
        actual: actualIncome,
        pending: pendingIncome,
        variance: incomeVariance,
        variancePercent: incomeVariancePercent,
        breakdown: incomeBreakdown.sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
      },

      // Bills section
      bills: {
        total: billsTotal,
        paid: billsPaid,
        pending: billsPending,
        breakdown: {
          paid: paidBills.sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
          autopayUpcoming: autopayUpcoming.sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
          manualUpcoming: manualUpcoming.sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
        },
      },

      // Budget section
      budget: {
        monthlyTotal,
        periodAllocation,
        actualSpent,
        remaining: budgetRemaining,
        percentUsed,
      },

      // Accounts section
      accounts: {
        includedBalance,
        includedAccounts,
        excludedCount,
      },

      // Discretionary calculations
      discretionary: {
        accountBalance: includedBalance,
        expectedIncome,
        actualIncome,
        billsTotal,
        billsPaid,
        billsPending,
        budgetAllocation: periodAllocation,
        budgetSpent: actualSpent,
        budgetRemaining,
        expectedDiscretionary,
        currentDiscretionary,
        projectedDiscretionary,
        variance: discretionaryVariance,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Failed to calculate paycheck balance:', error);
    return NextResponse.json(
      { error: 'Failed to calculate paycheck balance' },
      { status: 500 }
    );
  }
}
