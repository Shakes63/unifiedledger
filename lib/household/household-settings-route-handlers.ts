import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { db } from '@/lib/db';
import { householdSettings } from '@/lib/db/schema';
import {
  handleHouseholdRouteError,
  requireActiveHouseholdMember,
  requireHouseholdPermission,
} from '@/lib/household/route-guards';

export const DEFAULT_HOUSEHOLD_SETTINGS = {
  currency: 'USD',
  currencySymbol: '$',
  timeFormat: '12h' as const,
  fiscalYearStart: 1,
  defaultBudgetMethod: 'monthly',
  budgetPeriod: 'monthly',
  autoCategorization: true,
  dataRetentionYears: 7,
  autoCleanupEnabled: false,
  cacheStrategy: 'normal',
  debtStrategyEnabled: false,
  debtPayoffMethod: 'avalanche' as const,
  extraMonthlyPayment: 0,
  paymentFrequency: 'monthly' as const,
};

async function upsertHouseholdSettings(
  householdId: string,
  updateData: Record<string, unknown>
) {
  const existingSettings = await db
    .select()
    .from(householdSettings)
    .where(eq(householdSettings.householdId, householdId))
    .limit(1);

  if (existingSettings.length > 0) {
    await db
      .update(householdSettings)
      .set({
        ...updateData,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(householdSettings.householdId, householdId));
  } else {
    await db.insert(householdSettings).values({
      id: uuidv4(),
      householdId,
      ...DEFAULT_HOUSEHOLD_SETTINGS,
      ...updateData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  const updatedSettings = await db
    .select()
    .from(householdSettings)
    .where(eq(householdSettings.householdId, householdId))
    .limit(1);

  return updatedSettings[0];
}

export async function handleGetHouseholdSettings(
  _request: Request,
  householdId: string
) {
  try {
    await requireActiveHouseholdMember(householdId);

    const settings = await db
      .select()
      .from(householdSettings)
      .where(eq(householdSettings.householdId, householdId))
      .limit(1);

    if (settings.length === 0) {
      return Response.json({ settings: DEFAULT_HOUSEHOLD_SETTINGS });
    }

    return Response.json({
      settings: {
        ...DEFAULT_HOUSEHOLD_SETTINGS,
        ...settings[0],
      },
    });
  } catch (error) {
    return handleHouseholdRouteError(error, {
      defaultError: 'Failed to fetch household settings',
      logLabel: 'Failed to fetch household settings:',
    });
  }
}

export async function handleUpdateHouseholdSettings(
  request: Request,
  householdId: string
) {
  try {
    const { userId } = await requireActiveHouseholdMember(householdId);
    await requireHouseholdPermission(
      householdId,
      userId,
      'manage_permissions',
      'Only household owners and admins can update household settings'
    );

    const body = await request.json();
    const {
      id: _id,
      householdId: _bodyHouseholdId,
      createdAt: _createdAt,
      ...updateData
    } = body;

    const settings = await upsertHouseholdSettings(householdId, updateData);

    return Response.json({
      success: true,
      settings,
    });
  } catch (error) {
    return handleHouseholdRouteError(error, {
      defaultError: 'Failed to update household settings',
      logLabel: 'Failed to update household settings:',
    });
  }
}

export async function handleResetHouseholdSettings(
  _request: Request,
  householdId: string
) {
  try {
    const { userId } = await requireActiveHouseholdMember(householdId);
    await requireHouseholdPermission(
      householdId,
      userId,
      'manage_permissions',
      'Only household owners and admins can reset household settings'
    );

    const settings = await upsertHouseholdSettings(
      householdId,
      DEFAULT_HOUSEHOLD_SETTINGS
    );

    return Response.json({
      success: true,
      settings,
      message: 'Household settings reset to defaults',
    });
  } catch (error) {
    return handleHouseholdRouteError(error, {
      defaultError: 'Failed to reset household settings',
      logLabel: 'Failed to reset household settings:',
    });
  }
}
