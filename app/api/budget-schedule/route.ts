import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { runInDatabaseTransaction } from '@/lib/db/transaction-runner';
import { billOccurrences, billTemplates, userHouseholdPreferences } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { isMemberOfHousehold } from '@/lib/household/permissions';
import {
  getCurrentBudgetPeriod,
  getNextBudgetPeriod,
  getDaysUntilNextPeriod,
  getPeriodLabel,
  validateBudgetScheduleSettings,
  getDefaultBudgetScheduleSettings,
  type BudgetScheduleSettings,
  type BudgetCycleFrequency,
} from '@/lib/budgets/budget-schedule';

export const dynamic = 'force-dynamic';

// Default budget schedule settings
const DEFAULT_BUDGET_SCHEDULE: BudgetScheduleSettings = getDefaultBudgetScheduleSettings();

function extractSettings(
  preferences: (typeof userHouseholdPreferences.$inferSelect) | undefined
): BudgetScheduleSettings {
  return preferences
    ? {
        budgetCycleFrequency:
          (preferences.budgetCycleFrequency as BudgetCycleFrequency) ||
          DEFAULT_BUDGET_SCHEDULE.budgetCycleFrequency,
        budgetCycleStartDay:
          preferences.budgetCycleStartDay ?? DEFAULT_BUDGET_SCHEDULE.budgetCycleStartDay,
        budgetCycleReferenceDate:
          preferences.budgetCycleReferenceDate ??
          DEFAULT_BUDGET_SCHEDULE.budgetCycleReferenceDate,
        budgetCycleSemiMonthlyDays:
          preferences.budgetCycleSemiMonthlyDays ??
          DEFAULT_BUDGET_SCHEDULE.budgetCycleSemiMonthlyDays,
        budgetPeriodRollover:
          preferences.budgetPeriodRollover ?? DEFAULT_BUDGET_SCHEDULE.budgetPeriodRollover,
        budgetPeriodManualAmount:
          preferences.budgetPeriodManualAmount ??
          DEFAULT_BUDGET_SCHEDULE.budgetPeriodManualAmount,
      }
    : DEFAULT_BUDGET_SCHEDULE;
}

function didBudgetCycleDefinitionChange(
  previous: BudgetScheduleSettings,
  next: Partial<BudgetScheduleSettings>
): boolean {
  const nextFrequency = next.budgetCycleFrequency ?? previous.budgetCycleFrequency;
  const nextStartDay = next.budgetCycleStartDay ?? previous.budgetCycleStartDay;
  const nextReferenceDate =
    next.budgetCycleReferenceDate ?? previous.budgetCycleReferenceDate;
  const nextSemiMonthlyDays =
    next.budgetCycleSemiMonthlyDays ?? previous.budgetCycleSemiMonthlyDays;

  return (
    previous.budgetCycleFrequency !== nextFrequency ||
    previous.budgetCycleStartDay !== nextStartDay ||
    previous.budgetCycleReferenceDate !== nextReferenceDate ||
    previous.budgetCycleSemiMonthlyDays !== nextSemiMonthlyDays
  );
}

/**
 * GET /api/budget-schedule
 * Get budget schedule settings for the current household
 * 
 * Query params:
 * - householdId: string (required)
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

    // Fetch user's preferences for this household
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

    // Extract budget schedule settings
    const settings: BudgetScheduleSettings = preferences.length > 0
      ? {
          budgetCycleFrequency: (preferences[0].budgetCycleFrequency as BudgetCycleFrequency) || DEFAULT_BUDGET_SCHEDULE.budgetCycleFrequency,
          budgetCycleStartDay: preferences[0].budgetCycleStartDay ?? DEFAULT_BUDGET_SCHEDULE.budgetCycleStartDay,
          budgetCycleReferenceDate: preferences[0].budgetCycleReferenceDate ?? DEFAULT_BUDGET_SCHEDULE.budgetCycleReferenceDate,
          budgetCycleSemiMonthlyDays: preferences[0].budgetCycleSemiMonthlyDays ?? DEFAULT_BUDGET_SCHEDULE.budgetCycleSemiMonthlyDays,
          budgetPeriodRollover: preferences[0].budgetPeriodRollover ?? DEFAULT_BUDGET_SCHEDULE.budgetPeriodRollover,
          budgetPeriodManualAmount: preferences[0].budgetPeriodManualAmount ?? DEFAULT_BUDGET_SCHEDULE.budgetPeriodManualAmount,
        }
      : DEFAULT_BUDGET_SCHEDULE;

    // Calculate current period info
    const currentPeriod = getCurrentBudgetPeriod(settings);
    const nextPeriod = getNextBudgetPeriod(settings);
    const daysRemaining = getDaysUntilNextPeriod(settings);
    const periodLabel = getPeriodLabel(currentPeriod, settings.budgetCycleFrequency);

    return NextResponse.json({
      settings,
      currentPeriod: {
        start: currentPeriod.startStr,
        end: currentPeriod.endStr,
        periodNumber: currentPeriod.periodNumber,
        periodsInMonth: currentPeriod.periodsInMonth,
        label: periodLabel,
        daysRemaining,
      },
      nextPeriod: {
        start: nextPeriod.startStr,
        end: nextPeriod.endStr,
        label: getPeriodLabel(nextPeriod, settings.budgetCycleFrequency),
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Failed to fetch budget schedule:', error);
    return NextResponse.json(
      { error: 'Failed to fetch budget schedule' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/budget-schedule
 * Update budget schedule settings for the current household
 * 
 * Request body:
 * - householdId: string (required)
 * - settings: Partial<BudgetScheduleSettings>
 */
export async function PUT(request: NextRequest) {
  try {
    const { userId } = await requireAuth();
    const body = await request.json();

    const { householdId, confirmResetAssignments, ...updateData } = body;
    
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

    // Validate the settings
    const validation = validateBudgetScheduleSettings(updateData);
    if (!validation.valid) {
      return NextResponse.json(
        { error: 'Invalid settings', details: validation.errors },
        { status: 400 }
      );
    }

    // Check if user preferences for this household exist
    const existingPreferences = await db
      .select()
      .from(userHouseholdPreferences)
      .where(
        and(
          eq(userHouseholdPreferences.userId, userId),
          eq(userHouseholdPreferences.householdId, householdId)
        )
      )
      .limit(1);

    const previousSettings = extractSettings(existingPreferences[0]);
    const budgetCycleDefinitionChanged = didBudgetCycleDefinitionChange(
      previousSettings,
      updateData
    );

    if (budgetCycleDefinitionChanged && confirmResetAssignments !== true) {
      return NextResponse.json(
        {
          error:
            'Changing the budget cycle will reset all bill budget period assignments. Confirmation required.',
          code: 'CONFIRM_RESET_ASSIGNMENTS_REQUIRED',
        },
        { status: 409 }
      );
    }

    await runInDatabaseTransaction(async (tx) => {
      const now = new Date().toISOString();

      if (existingPreferences && existingPreferences.length > 0) {
        await tx
          .update(userHouseholdPreferences)
          .set({
            ...updateData,
            updatedAt: now,
          })
          .where(
            and(
              eq(userHouseholdPreferences.userId, userId),
              eq(userHouseholdPreferences.householdId, householdId)
            )
          );
      } else {
        await tx.insert(userHouseholdPreferences).values({
          id: uuidv4(),
          userId,
          householdId,
          ...DEFAULT_BUDGET_SCHEDULE,
          ...updateData,
          createdAt: now,
          updatedAt: now,
        });
      }

      if (budgetCycleDefinitionChanged) {
        await tx
          .update(billTemplates)
          .set({
            budgetPeriodAssignment: null,
            updatedAt: now,
          })
          .where(eq(billTemplates.householdId, householdId));

        await tx
          .update(billOccurrences)
          .set({
            budgetPeriodOverride: null,
            updatedAt: now,
          })
          .where(eq(billOccurrences.householdId, householdId));
      }
    });

    // Fetch updated preferences
    const updatedPreferences = await db
      .select()
      .from(userHouseholdPreferences)
      .where(
        and(
          eq(userHouseholdPreferences.userId, userId),
          eq(userHouseholdPreferences.householdId, householdId)
        )
      )
      .limit(1);

    // Extract updated settings
    const settings: BudgetScheduleSettings = extractSettings(updatedPreferences[0]);

    // Calculate current period info
    const currentPeriod = getCurrentBudgetPeriod(settings);
    const nextPeriod = getNextBudgetPeriod(settings);
    const daysRemaining = getDaysUntilNextPeriod(settings);
    const periodLabel = getPeriodLabel(currentPeriod, settings.budgetCycleFrequency);

    return NextResponse.json({
      success: true,
      settings,
      currentPeriod: {
        start: currentPeriod.startStr,
        end: currentPeriod.endStr,
        periodNumber: currentPeriod.periodNumber,
        periodsInMonth: currentPeriod.periodsInMonth,
        label: periodLabel,
        daysRemaining,
      },
      nextPeriod: {
        start: nextPeriod.startStr,
        end: nextPeriod.endStr,
        label: getPeriodLabel(nextPeriod, settings.budgetCycleFrequency),
      },
      assignmentsReset: budgetCycleDefinitionChanged,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Failed to update budget schedule:', error);
    return NextResponse.json(
      { error: 'Failed to update budget schedule' },
      { status: 500 }
    );
  }
}
