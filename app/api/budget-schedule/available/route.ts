import { requireAuth } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import {
  userHouseholdPreferences,
  accounts,
  transactions,
  budgetCategories,
} from '@/lib/db/schema';
import { eq, and, gte, lte, inArray, sum, sql } from 'drizzle-orm';
import Decimal from 'decimal.js';
import { toMoneyCents } from '@/lib/utils/money-cents';
import { apiError, apiOk } from '@/lib/api/route-helpers';
import {
  getCurrentBudgetPeriod,
  getDaysUntilNextPeriod,
  getPeriodBudgetAmount,
  getPeriodLabel,
  calculateAvailableAmount,
  getDefaultBudgetScheduleSettings,
  type BudgetScheduleSettings,
  type BudgetPeriod,
  type BudgetCycleFrequency,
} from '@/lib/budgets/budget-schedule';
import { getPeriodBillsForBudgetPeriod } from '@/lib/budgets/period-bills-service';
import { getAndVerifyHousehold } from '@/lib/api/household-auth';

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

async function calculatePeriodCommittedAmount(
  householdId: string,
  period: BudgetPeriod,
  settings: BudgetScheduleSettings
): Promise<number> {
  const expenseResult = await db
    .select({ totalCents: sql<number>`COALESCE(SUM(${transactions.amountCents}), 0)` })
    .from(transactions)
    .where(
      and(
        eq(transactions.householdId, householdId),
        eq(transactions.type, 'expense'),
        gte(transactions.date, period.startStr),
        lte(transactions.date, period.endStr)
      )
    );

  const paidThisPeriod = new Decimal(expenseResult[0]?.totalCents ?? 0).div(100).toNumber();
  const periodBills = await getPeriodBillsForBudgetPeriod({
    householdId,
    settings,
    period,
    statuses: ['pending', 'overdue'],
    excludeBillType: 'income',
  });

  const unpaidBillsDue = periodBills.reduce((sum, row) => {
    const { instance, allocation } = row;
    if (allocation?.isPaid) {
      return sum;
    }

    const baseRemaining = instance.remainingAmount ?? new Decimal(instance.expectedAmount).minus(instance.paidAmount || 0).toNumber();
    const amount = allocation
      ? Decimal.max(new Decimal(allocation.allocatedAmount).minus(allocation.paidAmount || 0), 0).toNumber()
      : Decimal.max(new Decimal(baseRemaining), 0).toNumber();

    return new Decimal(sum).plus(amount).toNumber();
  }, 0);

  return new Decimal(paidThisPeriod).plus(unpaidBillsDue).toNumber();
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
export async function GET(request: Request) {
  try {
    const { userId } = await requireAuth();
    const { householdId } = await getAndVerifyHousehold(request, userId);

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
        currentBalanceCents: accounts.currentBalanceCents,
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
      const cents = acc.currentBalanceCents ?? toMoneyCents(acc.currentBalance) ?? 0;
      return new Decimal(sum).plus(new Decimal(cents).div(100)).toNumber();
    }, 0);

    // 2. Calculate expenses paid this period
    const expenseResult = await db
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

    const paidThisPeriod = new Decimal(expenseResult[0]?.totalCents ?? 0).div(100).toNumber();

    // Get expense transactions for breakdown
    const paidTransactions = await db
      .select({
        id: transactions.id,
        description: transactions.description,
        amountCents: transactions.amountCents,
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
    const upcomingBills = await getPeriodBillsForBudgetPeriod({
      householdId,
      settings,
      period: currentPeriod,
      statuses: ['pending', 'overdue'],
      excludeBillType: 'income',
    });

    const upcomingCategoryIds = [...new Set(upcomingBills.map((row) => row.bill.categoryId).filter((id): id is string => id !== null))];
    const missingCategoryIds = upcomingCategoryIds.filter((id) => !categoryMap.has(id));
    if (missingCategoryIds.length > 0) {
      const upcomingCategories = await db
        .select({ id: budgetCategories.id, name: budgetCategories.name })
        .from(budgetCategories)
        .where(inArray(budgetCategories.id, missingCategoryIds));
      for (const category of upcomingCategories) {
        categoryMap.set(category.id, category.name);
      }
    }

    // Separate autopay vs manual bills
    const autopayBills: BillBreakdownItem[] = [];
    const manualBills: BillBreakdownItem[] = [];

    for (const row of upcomingBills) {
      const { bill, instance, allocation } = row;
      if (allocation?.isPaid) {
        continue;
      }

      const baseRemaining = instance.remainingAmount ?? new Decimal(instance.expectedAmount).minus(instance.paidAmount || 0).toNumber();
      const amount = allocation
        ? Decimal.max(new Decimal(allocation.allocatedAmount).minus(allocation.paidAmount || 0), 0).toNumber()
        : Decimal.max(new Decimal(baseRemaining), 0).toNumber();

      if (amount <= 0) {
        continue;
      }

      const item: BillBreakdownItem = {
        id: instance.id,
        name: bill.name,
        amount,
        dueDate: instance.dueDate,
        isAutopay: bill.isAutopayEnabled || false,
        categoryName: bill.categoryId ? categoryMap.get(bill.categoryId) : undefined,
      };

      if (bill.isAutopayEnabled) {
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

    // 5. Calculate rollover from previous period
    let rolloverFromPrevious = 0;
    if (settings.budgetPeriodRollover) {
      const previousPeriodReference = new Date(currentPeriod.start);
      previousPeriodReference.setDate(previousPeriodReference.getDate() - 1);
      const previousPeriod = getCurrentBudgetPeriod(settings, previousPeriodReference);
      const previousPeriodBudget = getPeriodBudgetAmount(
        monthlyBudget,
        settings.budgetCycleFrequency,
        settings.budgetPeriodManualAmount
      );
      const previousCommitted = await calculatePeriodCommittedAmount(
        householdId,
        previousPeriod,
        settings
      );
      rolloverFromPrevious = new Decimal(previousPeriodBudget)
        .minus(previousCommitted)
        .toDecimalPlaces(2)
        .toNumber();
    }

    // 6. Calculate available amount
    const available = calculateAvailableAmount(
      cashBalance,
      paidThisPeriod,
      autopayDue,
      manualBillsDue,
      rolloverFromPrevious
    );

    return apiOk({
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
          amount: new Decimal(t.amountCents ?? 0).div(100).toNumber(),
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
      return apiError('Unauthorized', 401);
    }
    console.error('Failed to calculate available amount:', error);
    return apiError('Failed to calculate available amount', 500);
  }
}
