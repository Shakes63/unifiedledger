import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { userHouseholdPreferences } from '@/lib/db/schema';
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

    const { householdId, ...updateData } = body;
    
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

    if (existingPreferences && existingPreferences.length > 0) {
      // Update existing preferences
      await db
        .update(userHouseholdPreferences)
        .set({
          ...updateData,
          updatedAt: new Date().toISOString(),
        })
        .where(
          and(
            eq(userHouseholdPreferences.userId, userId),
            eq(userHouseholdPreferences.householdId, householdId)
          )
        );
    } else {
      // Create new preferences record with provided data merged with defaults
      await db.insert(userHouseholdPreferences).values({
        id: uuidv4(),
        userId,
        householdId,
        ...DEFAULT_BUDGET_SCHEDULE,
        ...updateData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

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
    const settings: BudgetScheduleSettings = {
      budgetCycleFrequency: (updatedPreferences[0].budgetCycleFrequency as BudgetCycleFrequency) || DEFAULT_BUDGET_SCHEDULE.budgetCycleFrequency,
      budgetCycleStartDay: updatedPreferences[0].budgetCycleStartDay ?? DEFAULT_BUDGET_SCHEDULE.budgetCycleStartDay,
      budgetCycleReferenceDate: updatedPreferences[0].budgetCycleReferenceDate ?? DEFAULT_BUDGET_SCHEDULE.budgetCycleReferenceDate,
      budgetCycleSemiMonthlyDays: updatedPreferences[0].budgetCycleSemiMonthlyDays ?? DEFAULT_BUDGET_SCHEDULE.budgetCycleSemiMonthlyDays,
      budgetPeriodRollover: updatedPreferences[0].budgetPeriodRollover ?? DEFAULT_BUDGET_SCHEDULE.budgetPeriodRollover,
      budgetPeriodManualAmount: updatedPreferences[0].budgetPeriodManualAmount ?? DEFAULT_BUDGET_SCHEDULE.budgetPeriodManualAmount,
    };

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

