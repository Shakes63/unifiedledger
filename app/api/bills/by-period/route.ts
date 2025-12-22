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
  billInstanceAllocations,
} from '@/lib/db/schema';
import { eq, and, inArray, asc } from 'drizzle-orm';
import {
  getCurrentBudgetPeriod,
  getNextBudgetPeriod,
  getPeriodLabel,
  getDefaultBudgetScheduleSettings,
  isDateInPeriod,
  type BudgetScheduleSettings,
  type BudgetCycleFrequency,
  type BudgetPeriod,
} from '@/lib/budgets/budget-schedule';
import { addDays, subDays, parseISO } from 'date-fns';
import Decimal from 'decimal.js';

export const dynamic = 'force-dynamic';

interface BillInstanceWithBill {
  instance: typeof billInstances.$inferSelect;
  bill: typeof bills.$inferSelect;
  category?: typeof budgetCategories.$inferSelect | null;
  account?: typeof accounts.$inferSelect | null;
  allocation?: typeof billInstanceAllocations.$inferSelect | null;
}

/**
 * Calculate period number from a date based on settings
 */
function calculatePeriodFromDate(
  dateStr: string,
  settings: BudgetScheduleSettings
): number {
  const date = parseISO(dateStr);
  const period = getCurrentBudgetPeriod(settings, date);
  return period.periodNumber;
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

    // Fetch bill instances with their bills, filtering by status
    // We need to get instances that:
    // 1. Have a due date within the period (default behavior), OR
    // 2. Have a budgetPeriodOverride matching the period number, OR
    // 3. Have a bill with budgetPeriodAssignment matching the period number
    
    // First, get all instances for the household with the requested status
    const instanceConditions = [
      eq(billInstances.userId, userId),
      eq(billInstances.householdId, householdId),
    ];

    if (statusFilter.length > 0) {
      instanceConditions.push(inArray(billInstances.status, statusFilter));
    }

    const allInstances = await db
      .select({
        instance: billInstances,
        bill: bills,
        category: budgetCategories,
        account: accounts,
      })
      .from(billInstances)
      .innerJoin(bills, eq(billInstances.billId, bills.id))
      .leftJoin(budgetCategories, eq(bills.categoryId, budgetCategories.id))
      .leftJoin(accounts, eq(bills.accountId, accounts.id))
      .where(and(...instanceConditions))
      .orderBy(asc(billInstances.dueDate));

    // Filter instances based on period assignment logic
    const filteredInstances: BillInstanceWithBill[] = [];

    for (const row of allInstances) {
      // Apply bill type filter if specified
      if (billType && row.bill.billType !== billType) {
        continue;
      }

      // Check which period this instance belongs to
      let instancePeriodNumber: number;

      // Priority 1: Instance-level override
      if (row.instance.budgetPeriodOverride !== null) {
        instancePeriodNumber = row.instance.budgetPeriodOverride;
      }
      // Priority 2: Bill-level assignment
      else if (row.bill.budgetPeriodAssignment !== null) {
        instancePeriodNumber = row.bill.budgetPeriodAssignment;
      }
      // Priority 3: Calculate from due date
      else {
        instancePeriodNumber = calculatePeriodFromDate(row.instance.dueDate, settings);
      }

      // Check if this instance belongs to the requested period
      // For monthly budgets (only 1 period), always include if due date is in the month
      if (settings.budgetCycleFrequency === 'monthly') {
        // For monthly, check if due date falls within the period
        if (isDateInPeriod(row.instance.dueDate, period)) {
          filteredInstances.push(row);
        }
      } else {
        // For non-monthly, check period number matches
        if (instancePeriodNumber === period.periodNumber) {
          const dueDate = parseISO(row.instance.dueDate);
          const periodStart = period.start;
          const periodEnd = period.end;
          
          // Check if this instance has a manual period assignment
          const hasManualAssignment = row.bill.budgetPeriodAssignment !== null || 
                                      row.instance.budgetPeriodOverride !== null;
          
          if (hasManualAssignment) {
            // Manual assignment: due date must be in the same month as the period
            // This prevents "Always Period 2" from showing January's instance in December's Period 2
            const dueDateMonth = dueDate.getMonth();
            const dueDateYear = dueDate.getFullYear();
            const periodMonth = periodStart.getMonth();
            const periodYear = periodStart.getFullYear();
            
            // For periods that span month boundaries (e.g., semi-monthly Dec 15 - Jan 1),
            // also check the end month
            const periodEndMonth = periodEnd.getMonth();
            const periodEndYear = periodEnd.getFullYear();
            
            if ((dueDateMonth === periodMonth && dueDateYear === periodYear) ||
                (dueDateMonth === periodEndMonth && dueDateYear === periodEndYear)) {
              filteredInstances.push(row);
            }
          } else {
            // Automatic assignment: use small buffer for edge cases at period boundaries
            const bufferDays = 3;
            const rangeStart = subDays(periodStart, bufferDays);
            const rangeEnd = addDays(periodEnd, bufferDays);
            
            if (dueDate >= rangeStart && dueDate <= rangeEnd) {
              filteredInstances.push(row);
            }
          }
        }
      }
    }

    // Sort by due date
    filteredInstances.sort((a, b) => 
      parseISO(a.instance.dueDate).getTime() - parseISO(b.instance.dueDate).getTime()
    );

    // Fetch ALL allocations for this user/household (not just for filtered instances)
    // This is important for split bills that appear in multiple periods
    const allAllocations = await db
      .select()
      .from(billInstanceAllocations)
      .where(
        and(
          eq(billInstanceAllocations.userId, userId),
          eq(billInstanceAllocations.householdId, householdId)
        )
      );

    type AllocationRow = typeof allAllocations[0];

    // Group allocations by instance ID
    const allocationsByInstance = new Map<string, typeof allAllocations>();
    for (const allocation of allAllocations) {
      const existing = allocationsByInstance.get(allocation.billInstanceId) || [];
      existing.push(allocation);
      allocationsByInstance.set(allocation.billInstanceId, existing);
    }

    // Find allocations for THIS period - this may include instances not yet in filteredInstances
    const allocationsForPeriod = allAllocations.filter(
      (a: AllocationRow) => a.periodNumber === period.periodNumber
    );

    // Add instances that have allocations for this period but weren't filtered in
    // (these are split bills that appear in multiple periods)
    for (const allocation of allocationsForPeriod) {
      const alreadyIncluded = filteredInstances.some(
        (r: BillInstanceWithBill) => r.instance.id === allocation.billInstanceId
      );
      
      if (!alreadyIncluded) {
        // Find the instance in allInstances
        const instanceRow = allInstances.find(
          (r: BillInstanceWithBill) => r.instance.id === allocation.billInstanceId
        );
        
        if (instanceRow && (billType ? instanceRow.bill.billType === billType : true)) {
          filteredInstances.push(instanceRow);
        }
      }
    }

    // Re-sort after adding split instances
    filteredInstances.sort((a, b) => 
      parseISO(a.instance.dueDate).getTime() - parseISO(b.instance.dueDate).getTime()
    );

    // Add allocations to instances
    const instancesWithAllocations: BillInstanceWithBill[] = filteredInstances.map(row => {
      const instanceAllocations = allocationsByInstance.get(row.instance.id) || [];
      const periodAllocation = instanceAllocations.find(
        (a: AllocationRow) => a.periodNumber === period.periodNumber
      );
      
      return {
        ...row,
        allocation: periodAllocation || null,
      };
    });

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
        const instanceAllocations = allocationsByInstance.get(row.instance.id) || [];
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
