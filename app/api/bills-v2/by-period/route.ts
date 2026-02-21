import { subDays } from 'date-fns';
import { and, eq, inArray } from 'drizzle-orm';

import { requireAuth } from '@/lib/auth-helpers';
import {
  centsToDollars,
  legacyStatusesToOccurrenceStatuses,
  toLegacyAllocation,
  toLegacyBill,
  toLegacyInstance,
} from '@/lib/bills-v2/legacy-compat';
import { toBillsV2Error } from '@/lib/bills-v2/route-helpers';
import { listOccurrences } from '@/lib/bills-v2/service';
import { getAndVerifyHousehold } from '@/lib/api/household-auth';
import { db } from '@/lib/db';
import { accounts, budgetCategories, userHouseholdPreferences } from '@/lib/db/schema';
import {
  getCurrentBudgetPeriod,
  getDefaultBudgetScheduleSettings,
  getNextBudgetPeriod,
  getPeriodLabel,
  type BudgetCycleFrequency,
  type BudgetPeriod,
  type BudgetScheduleSettings,
} from '@/lib/budgets/budget-schedule';

export const dynamic = 'force-dynamic';

function getPeriodByOffset(settings: BudgetScheduleSettings, offset: number): BudgetPeriod {
  let period = getCurrentBudgetPeriod(settings);

  if (offset > 0) {
    for (let index = 0; index < offset; index += 1) {
      period = getNextBudgetPeriod(settings, period.end);
    }
  } else if (offset < 0) {
    for (let index = 0; index < Math.abs(offset); index += 1) {
      period = getCurrentBudgetPeriod(settings, subDays(period.start, 1));
    }
  }

  return period;
}

async function getBudgetSettings(userId: string, householdId: string): Promise<BudgetScheduleSettings> {
  const defaults = getDefaultBudgetScheduleSettings();

  const [prefs] = await db
    .select()
    .from(userHouseholdPreferences)
    .where(
      and(
        eq(userHouseholdPreferences.userId, userId),
        eq(userHouseholdPreferences.householdId, householdId)
      )
    )
    .limit(1);

  if (!prefs) return defaults;

  return {
    budgetCycleFrequency: (prefs.budgetCycleFrequency as BudgetCycleFrequency) || defaults.budgetCycleFrequency,
    budgetCycleStartDay: prefs.budgetCycleStartDay ?? defaults.budgetCycleStartDay,
    budgetCycleReferenceDate: prefs.budgetCycleReferenceDate ?? defaults.budgetCycleReferenceDate,
    budgetCycleSemiMonthlyDays: prefs.budgetCycleSemiMonthlyDays ?? defaults.budgetCycleSemiMonthlyDays,
    budgetPeriodRollover: prefs.budgetPeriodRollover ?? defaults.budgetPeriodRollover,
    budgetPeriodManualAmount: prefs.budgetPeriodManualAmount ?? defaults.budgetPeriodManualAmount,
  };
}

export async function GET(request: Request) {
  try {
    const { userId } = await requireAuth();
    const { householdId } = await getAndVerifyHousehold(request, userId);

    const url = new URL(request.url);
    const periodOffset = parseInt(url.searchParams.get('periodOffset') || '0', 10);
    const statusParam = url.searchParams.get('status');
    const billType = url.searchParams.get('billType') as 'expense' | 'income' | 'savings_transfer' | null;

    const legacyStatuses = statusParam
      ? statusParam
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean)
      : ['pending', 'overdue'];

    const statuses = legacyStatusesToOccurrenceStatuses(legacyStatuses);

    const [settings, occurrencesResult] = await Promise.all([
      getBudgetSettings(userId, householdId),
      listOccurrences({
        userId,
        householdId,
        periodOffset,
        status: statuses,
        billType: billType || undefined,
        limit: 5000,
        offset: 0,
      }),
    ]);

    const period = getPeriodByOffset(settings, periodOffset);
    const previousPeriod = getPeriodByOffset(settings, periodOffset - 1);
    const nextPeriod = getPeriodByOffset(settings, periodOffset + 1);

    const categoryIds = [...new Set(occurrencesResult.data.map((row) => row.template.categoryId).filter((id): id is string => !!id))];
    const accountIds = [...new Set(occurrencesResult.data.map((row) => row.template.paymentAccountId).filter((id): id is string => !!id))];

    const [categoriesRows, accountsRows] = await Promise.all([
      categoryIds.length > 0
        ? db
            .select()
            .from(budgetCategories)
            .where(and(eq(budgetCategories.householdId, householdId), inArray(budgetCategories.id, categoryIds)))
        : Promise.resolve([]),
      accountIds.length > 0
        ? db
            .select()
            .from(accounts)
            .where(and(eq(accounts.householdId, householdId), inArray(accounts.id, accountIds)))
        : Promise.resolve([]),
    ]);

    const categoryMap = new Map(categoriesRows.map((row) => [row.id, row]));
    const accountMap = new Map(accountsRows.map((row) => [row.id, row]));

    const data = occurrencesResult.data.map((row) => {
      const instance = toLegacyInstance(row.occurrence);
      const bill = toLegacyBill(row.template, null);
      const allAllocations = row.allocations.map((allocation) => toLegacyAllocation(allocation));
      const allocation = allAllocations.find((item) => item.periodNumber === period.periodNumber) || null;

      const displayAmount = allocation ? allocation.allocatedAmount : instance.expectedAmount;
      const displayPaidAmount = allocation ? allocation.paidAmount : instance.paidAmount || 0;
      const displayRemainingAmount = Math.max(0, displayAmount - displayPaidAmount);

      return {
        instance,
        bill,
        category: bill.categoryId ? categoryMap.get(bill.categoryId) || null : null,
        account: bill.accountId ? accountMap.get(bill.accountId) || null : null,
        allocation,
        allAllocations,
        isSplit: allAllocations.length > 1 || !!bill.splitAcrossPeriods,
        periodAssignment: {
          isOverride: instance.budgetPeriodOverride !== null && instance.budgetPeriodOverride !== undefined,
          isBillDefault: bill.budgetPeriodAssignment !== null && (instance.budgetPeriodOverride === null || instance.budgetPeriodOverride === undefined),
          isAutomatic: (instance.budgetPeriodOverride === null || instance.budgetPeriodOverride === undefined) && bill.budgetPeriodAssignment === null,
          isSplitAllocation: allocation !== null,
        },
        displayAmount,
        displayPaidAmount,
        displayRemainingAmount,
      };
    });

    const summary = {
      totalBills: data.length,
      totalAmount: data.reduce((sum, row) => sum + row.displayAmount, 0),
      pendingCount: data.filter((row) => (row.allocation ? !row.allocation.isPaid : row.instance.status === 'pending')).length,
      overdueCount: data.filter((row) => row.instance.status === 'overdue').length,
      paidCount: data.filter((row) => (row.allocation ? row.allocation.isPaid : row.instance.status === 'paid')).length,
      pendingAmount: data
        .filter((row) => (row.allocation ? !row.allocation.isPaid : row.instance.status === 'pending' || row.instance.status === 'overdue'))
        .reduce((sum, row) => sum + row.displayRemainingAmount, 0),
      paidAmount: data
        .filter((row) => (row.allocation ? row.allocation.isPaid : row.instance.status === 'paid'))
        .reduce((sum, row) => sum + row.displayPaidAmount, 0),
    };

    return Response.json({
      period: {
        start: period.startStr,
        end: period.endStr,
        periodNumber: period.periodNumber,
        periodsInMonth: period.periodsInMonth,
        label: getPeriodLabel(period, settings.budgetCycleFrequency),
        offset: periodOffset,
      },
      navigation: {
        previous: {
          label: getPeriodLabel(previousPeriod, settings.budgetCycleFrequency),
          offset: periodOffset - 1,
        },
        next: {
          label: getPeriodLabel(nextPeriod, settings.budgetCycleFrequency),
          offset: periodOffset + 1,
        },
      },
      settings: {
        frequency: settings.budgetCycleFrequency,
      },
      summary,
      data,
      totals: {
        totalAmount: centsToDollars(occurrencesResult.summary.upcomingAmountCents + occurrencesResult.summary.overdueAmountCents),
      },
    });
  } catch (error) {
    return toBillsV2Error(error, 'compat by-period GET');
  }
}
