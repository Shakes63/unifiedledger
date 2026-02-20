import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-helpers';
import { getAndVerifyHousehold } from '@/lib/api/household-auth';
import { db } from '@/lib/db';
import {
  bills,
  billInstances,
  budgetCategories,
  accounts,
  userHouseholdPreferences,
} from '@/lib/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import {
  getCurrentBudgetPeriod,
  getNextBudgetPeriod,
  getPeriodLabel,
  getDefaultBudgetScheduleSettings,
  type BudgetScheduleSettings,
  type BudgetCycleFrequency,
  type BudgetPeriod,
} from '@/lib/budgets/budget-schedule';
import { subDays } from 'date-fns';
import Decimal from 'decimal.js';
import { getPeriodBillsForBudgetPeriod } from '@/lib/budgets/period-bills-service';

export const dynamic = 'force-dynamic';

interface BillInstanceWithBill {
  instance: typeof billInstances.$inferSelect;
  bill: typeof bills.$inferSelect;
  category?: typeof budgetCategories.$inferSelect | null;
  account?: typeof accounts.$inferSelect | null;
  allocation?: {
    allocatedAmount: number;
    paidAmount: number | null;
    isPaid: boolean | null;
  } | null;
  allAllocations?: Array<{
    periodNumber: number;
    allocatedAmount: number;
    paidAmount: number | null;
    isPaid: boolean | null;
  }>;
}

/**
 * Get a specific period by offset from current
 * offset: 0 = current, -1 = previous, 1 = next, etc.
 */
function getPeriodByOffset(
  settings: BudgetScheduleSettings,
  offset: number
): BudgetPeriod {
  let period = getCurrentBudgetPeriod(settings);
  
  if (offset > 0) {
    for (let i = 0; i < offset; i++) {
      period = getNextBudgetPeriod(settings, period.end);
    }
  } else if (offset < 0) {
    for (let i = 0; i < Math.abs(offset); i++) {
      // Go back to previous period by getting period for a date before current start
      const prevDate = subDays(period.start, 1);
      period = getCurrentBudgetPeriod(settings, prevDate);
    }
  }
  
  return period;
}

/**
 * GET /api/bills/by-period
 * Fetch bill instances for a specific budget period
 * 
 * Query params:
 * - householdId: string (required)
 * - periodOffset: number (optional, default 0 = current period, -1 = previous, 1 = next)
 * - status: string (optional, comma-separated: pending,overdue,paid,skipped)
 * - billType: string (optional, expense|income)
 */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await requireAuth();
    const { householdId } = await getAndVerifyHousehold(request, userId);

    const periodOffset = parseInt(request.nextUrl.searchParams.get('periodOffset') || '0');
    const statusParam = request.nextUrl.searchParams.get('status');
    const billType = request.nextUrl.searchParams.get('billType');

    // Parse status filter
    const statusFilter: Array<'pending' | 'paid' | 'overdue' | 'skipped'> = statusParam 
      ? statusParam.split(',').map(s => s.trim()) as Array<'pending' | 'paid' | 'overdue' | 'skipped'>
      : ['pending', 'overdue']; // Default to unpaid bills

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

    // Get the requested period
    const period = getPeriodByOffset(settings, periodOffset);
    const periodLabel = getPeriodLabel(period, settings.budgetCycleFrequency);

    const periodBills = await getPeriodBillsForBudgetPeriod({
      householdId,
      userId,
      settings,
      period,
      statuses: statusFilter,
      billType: billType ? (billType as 'expense' | 'income' | 'savings_transfer') : undefined,
    });

    const categoryIds = [...new Set(periodBills.map((row) => row.bill.categoryId).filter((id): id is string => !!id))];
    const accountIds = [...new Set(periodBills.map((row) => row.bill.accountId).filter((id): id is string => !!id))];

    const [categoriesData, accountsData] = await Promise.all([
      categoryIds.length > 0
        ? db
            .select()
            .from(budgetCategories)
            .where(inArray(budgetCategories.id, categoryIds))
        : Promise.resolve([]),
      accountIds.length > 0
        ? db
            .select()
            .from(accounts)
            .where(inArray(accounts.id, accountIds))
        : Promise.resolve([]),
    ]);

    const categoryMap = new Map(categoriesData.map((row) => [row.id, row]));
    const accountMap = new Map(accountsData.map((row) => [row.id, row]));

    const instancesWithAllocations: BillInstanceWithBill[] = periodBills.map((row) => ({
      instance: row.instance,
      bill: row.bill,
      category: row.bill.categoryId ? categoryMap.get(row.bill.categoryId) || null : null,
      account: row.bill.accountId ? accountMap.get(row.bill.accountId) || null : null,
      allocation: row.allocation
        ? {
            allocatedAmount: row.allocation.allocatedAmount,
            paidAmount: row.allocation.paidAmount,
            isPaid: row.allocation.isPaid,
          }
        : null,
      allAllocations: row.allAllocations.map((allocation) => ({
        periodNumber: allocation.periodNumber,
        allocatedAmount: allocation.allocatedAmount,
        paidAmount: allocation.paidAmount,
        isPaid: allocation.isPaid,
      })),
    }));

    // Calculate totals - use allocation amount if present, otherwise full amount
    const totalAmount = instancesWithAllocations.reduce((sum, row) => {
      const amount = row.allocation 
        ? row.allocation.allocatedAmount 
        : row.instance.expectedAmount;
      return new Decimal(sum).plus(new Decimal(amount)).toNumber();
    }, 0);

    const pendingAmount = instancesWithAllocations
      .filter(row => {
        if (row.allocation) {
          return !row.allocation.isPaid;
        }
        return row.instance.status === 'pending' || row.instance.status === 'overdue';
      })
      .reduce((sum, row) => {
        const amount = row.allocation 
          ? new Decimal(row.allocation.allocatedAmount).minus(row.allocation.paidAmount || 0).toNumber()
          : row.instance.expectedAmount;
        return new Decimal(sum).plus(new Decimal(amount)).toNumber();
      }, 0);

    const paidAmount = instancesWithAllocations
      .filter(row => {
        if (row.allocation) {
          return row.allocation.isPaid;
        }
        return row.instance.status === 'paid';
      })
      .reduce((sum, row) => {
        const amount = row.allocation 
          ? row.allocation.paidAmount || 0
          : (row.instance.actualAmount || row.instance.expectedAmount);
        return new Decimal(sum).plus(new Decimal(amount)).toNumber();
      }, 0);

    // Get previous and next period info for navigation
    const previousPeriod = getPeriodByOffset(settings, periodOffset - 1);
    const nextPeriod = getPeriodByOffset(settings, periodOffset + 1);

    return NextResponse.json({
      period: {
        start: period.startStr,
        end: period.endStr,
        periodNumber: period.periodNumber,
        periodsInMonth: period.periodsInMonth,
        label: periodLabel,
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
      summary: {
        totalBills: instancesWithAllocations.length,
        totalAmount,
        pendingCount: instancesWithAllocations.filter((r: BillInstanceWithBill) => {
          if (r.allocation) return !r.allocation.isPaid;
          return r.instance.status === 'pending';
        }).length,
        overdueCount: instancesWithAllocations.filter((r: BillInstanceWithBill) => r.instance.status === 'overdue').length,
        paidCount: instancesWithAllocations.filter((r: BillInstanceWithBill) => {
          if (r.allocation) return r.allocation.isPaid;
          return r.instance.status === 'paid';
        }).length,
        pendingAmount,
        paidAmount,
      },
      data: instancesWithAllocations.map(row => {
        const instanceAllocations = row.allAllocations || [];
        const isSplit = instanceAllocations.length > 1 || row.bill.splitAcrossPeriods;
        
        return {
          instance: row.instance,
          bill: row.bill,
          category: row.category,
          account: row.account,
          allocation: row.allocation,
          allAllocations: instanceAllocations,
          isSplit,
          periodAssignment: {
            isOverride: row.instance.budgetPeriodOverride !== null,
            isBillDefault: row.bill.budgetPeriodAssignment !== null && row.instance.budgetPeriodOverride === null,
            isAutomatic: row.instance.budgetPeriodOverride === null && row.bill.budgetPeriodAssignment === null,
            isSplitAllocation: row.allocation !== null,
          },
          // Display amounts for UI
          displayAmount: row.allocation 
            ? row.allocation.allocatedAmount 
            : row.instance.expectedAmount,
          displayPaidAmount: row.allocation
            ? row.allocation.paidAmount || 0
            : (row.instance.paidAmount || 0),
          displayRemainingAmount: row.allocation
            ? new Decimal(row.allocation.allocatedAmount).minus(row.allocation.paidAmount || 0).toNumber()
            : (row.instance.remainingAmount ?? row.instance.expectedAmount),
        };
      }),
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes('Household')) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('Failed to fetch bills by period:', error);
    return NextResponse.json(
      { error: 'Failed to fetch bills by period' },
      { status: 500 }
    );
  }
}
