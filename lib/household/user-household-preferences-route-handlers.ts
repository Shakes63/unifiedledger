import { and, eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { db } from '@/lib/db';
import { userHouseholdPreferences } from '@/lib/db/schema';
import {
  handleHouseholdRouteError,
  requireActiveHouseholdMember,
} from '@/lib/household/route-guards';
import {
  isTestMode,
  logTestModeWarning,
  TEST_HOUSEHOLD_ID,
  TEST_USER_ID,
} from '@/lib/test-mode';
import { isValidThemeId } from '@/lib/themes/theme-utils';

export const DEFAULT_USER_HOUSEHOLD_PREFERENCES = {
  dateFormat: 'MM/DD/YYYY' as const,
  numberFormat: 'en-US' as const,
  defaultAccountId: null,
  firstDayOfWeek: 'sunday' as const,
  showCents: true,
  negativeNumberFormat: '-$100',
  defaultTransactionType: 'expense',
  combinedTransferView: true,
  theme: 'dark-mode',
  billRemindersEnabled: true,
  billRemindersChannels: '["push","email"]',
  budgetWarningsEnabled: true,
  budgetWarningsChannels: '["push","email"]',
  budgetExceededEnabled: true,
  budgetExceededChannels: '["push","email"]',
  budgetReviewEnabled: true,
  budgetReviewChannels: '["push","email"]',
  lowBalanceEnabled: true,
  lowBalanceChannels: '["push","email"]',
  savingsMilestonesEnabled: true,
  savingsMilestonesChannels: '["push","email"]',
  debtMilestonesEnabled: true,
  debtMilestonesChannels: '["push","email"]',
  weeklySummariesEnabled: false,
  weeklySummariesChannels: '["email"]',
  monthlySummariesEnabled: true,
  monthlySummariesChannels: '["email"]',
  highUtilizationEnabled: true,
  highUtilizationThreshold: 75,
  highUtilizationChannels: '["push"]',
  creditLimitChangeEnabled: true,
  creditLimitChangeChannels: '["push"]',
  incomeLateEnabled: true,
  incomeLateChannels: '["push"]',
  budgetCycleFrequency: 'monthly' as const,
  budgetCycleStartDay: null,
  budgetCycleReferenceDate: null,
  budgetCycleSemiMonthlyDays: '[1, 15]',
  budgetPeriodRollover: false,
  budgetPeriodManualAmount: null,
};

function selectUserPreferences(userId: string, householdId: string) {
  return db
    .select()
    .from(userHouseholdPreferences)
    .where(
      and(
        eq(userHouseholdPreferences.userId, userId),
        eq(userHouseholdPreferences.householdId, householdId)
      )
    )
    .limit(1);
}

export async function handleGetUserHouseholdPreferences(
  _request: Request,
  householdId: string
) {
  try {
    const { userId } = await requireActiveHouseholdMember(householdId);

    if (isTestMode() && userId === TEST_USER_ID && householdId === TEST_HOUSEHOLD_ID) {
      logTestModeWarning('user/households/preferences GET');
      return Response.json(DEFAULT_USER_HOUSEHOLD_PREFERENCES);
    }

    const preferences = await selectUserPreferences(userId, householdId);
    if (preferences.length === 0) {
      return Response.json(DEFAULT_USER_HOUSEHOLD_PREFERENCES);
    }

    return Response.json({
      ...DEFAULT_USER_HOUSEHOLD_PREFERENCES,
      ...preferences[0],
    });
  } catch (error) {
    return handleHouseholdRouteError(error, {
      defaultError: 'Failed to fetch household preferences',
      logLabel: 'Failed to fetch household preferences:',
    });
  }
}

export async function handleUpdateUserHouseholdPreferences(
  request: Request,
  householdId: string
) {
  try {
    const { userId } = await requireActiveHouseholdMember(householdId);
    const body = await request.json();

    const {
      id: _id,
      userId: _bodyUserId,
      householdId: _bodyHouseholdId,
      createdAt: _createdAt,
      ...updateData
    } = body;

    if (typeof updateData.theme !== 'undefined') {
      if (typeof updateData.theme !== 'string' || !isValidThemeId(updateData.theme)) {
        return Response.json({ error: 'Invalid theme ID' }, { status: 400 });
      }
    }

    const existingPreferences = await selectUserPreferences(userId, householdId);

    if (existingPreferences.length > 0) {
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
      await db.insert(userHouseholdPreferences).values({
        id: uuidv4(),
        userId,
        householdId,
        ...DEFAULT_USER_HOUSEHOLD_PREFERENCES,
        ...updateData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    const updatedPreferences = await selectUserPreferences(userId, householdId);

    return Response.json({
      success: true,
      preferences: updatedPreferences[0],
    });
  } catch (error) {
    return handleHouseholdRouteError(error, {
      defaultError: 'Failed to update household preferences',
      logLabel: 'Failed to update household preferences:',
    });
  }
}

export async function handleResetUserHouseholdPreferences(
  _request: Request,
  householdId: string
) {
  try {
    const { userId } = await requireActiveHouseholdMember(householdId);
    const existingPreferences = await selectUserPreferences(userId, householdId);

    if (existingPreferences.length > 0) {
      await db
        .update(userHouseholdPreferences)
        .set({
          ...DEFAULT_USER_HOUSEHOLD_PREFERENCES,
          updatedAt: new Date().toISOString(),
        })
        .where(
          and(
            eq(userHouseholdPreferences.userId, userId),
            eq(userHouseholdPreferences.householdId, householdId)
          )
        );
    } else {
      await db.insert(userHouseholdPreferences).values({
        id: uuidv4(),
        userId,
        householdId,
        ...DEFAULT_USER_HOUSEHOLD_PREFERENCES,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    const resetPreferences = await selectUserPreferences(userId, householdId);

    return Response.json({
      success: true,
      preferences: resetPreferences[0],
      message: 'Preferences reset to defaults',
    });
  } catch (error) {
    return handleHouseholdRouteError(error, {
      defaultError: 'Failed to reset household preferences',
      logLabel: 'Failed to reset household preferences:',
    });
  }
}
