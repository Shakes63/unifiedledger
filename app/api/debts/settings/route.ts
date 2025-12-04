import { requireAuth } from '@/lib/auth-helpers';
import { getAndVerifyHousehold } from '@/lib/api/household-auth';
import { db } from '@/lib/db';
import { householdSettings, debtSettings } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { syncAllDebtPayoffDates } from '@/lib/debts/payoff-date-utils';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { userId } = await requireAuth();
    const { householdId } = await getAndVerifyHousehold(request, userId);

    // Try to fetch from householdSettings first (new location)
    const [settings] = await db
      .select()
      .from(householdSettings)
      .where(eq(householdSettings.householdId, householdId))
      .limit(1);

    if (settings) {
      return Response.json({
        extraMonthlyPayment: settings.extraMonthlyPayment || 0,
        preferredMethod: settings.debtPayoffMethod || 'avalanche',
        paymentFrequency: settings.paymentFrequency || 'monthly',
        debtStrategyEnabled: settings.debtStrategyEnabled ?? false,
      });
    }

    // Fallback to legacy debtSettings table
    const [legacySettings] = await db
      .select()
      .from(debtSettings)
      .where(
        and(
          eq(debtSettings.userId, userId),
          eq(debtSettings.householdId, householdId)
        )
      )
      .limit(1);

    if (legacySettings) {
      return Response.json({
        extraMonthlyPayment: legacySettings.extraMonthlyPayment || 0,
        preferredMethod: legacySettings.preferredMethod || 'avalanche',
        paymentFrequency: legacySettings.paymentFrequency || 'monthly',
        debtStrategyEnabled: false, // Legacy doesn't have this field
      });
    }

    // Return default settings if none exist
    return Response.json({
      extraMonthlyPayment: 0,
      preferredMethod: 'avalanche',
      paymentFrequency: 'monthly',
      debtStrategyEnabled: false,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes('Household ID')) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    console.error('Error fetching debt settings:', error);
    return Response.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const { userId } = await requireAuth();
    const body = await request.json();
    const { householdId } = await getAndVerifyHousehold(request, userId, body);

    const { extraMonthlyPayment, preferredMethod, paymentFrequency, debtStrategyEnabled } = body;

    // Validate payment frequency
    if (paymentFrequency && !['weekly', 'biweekly', 'monthly'].includes(paymentFrequency)) {
      return Response.json({ 
        error: 'Invalid payment frequency. Must be "weekly", "biweekly", or "monthly"' 
      }, { status: 400 });
    }

    // Validate preferred method
    if (preferredMethod && !['snowball', 'avalanche'].includes(preferredMethod)) {
      return Response.json({ 
        error: 'Invalid preferred method. Must be "snowball" or "avalanche"' 
      }, { status: 400 });
    }

    // Check if householdSettings exists
    const [existingSettings] = await db
      .select()
      .from(householdSettings)
      .where(eq(householdSettings.householdId, householdId))
      .limit(1);

    if (existingSettings) {
      // Update existing household settings
      await db
        .update(householdSettings)
        .set({
          extraMonthlyPayment: extraMonthlyPayment !== undefined 
            ? extraMonthlyPayment 
            : existingSettings.extraMonthlyPayment,
          debtPayoffMethod: preferredMethod || existingSettings.debtPayoffMethod,
          paymentFrequency: paymentFrequency || existingSettings.paymentFrequency,
          debtStrategyEnabled: debtStrategyEnabled !== undefined 
            ? debtStrategyEnabled 
            : existingSettings.debtStrategyEnabled,
        })
        .where(eq(householdSettings.householdId, householdId));
    } else {
      // Create new household settings
      await db.insert(householdSettings).values({
        id: nanoid(),
        householdId,
        extraMonthlyPayment: extraMonthlyPayment || 0,
        debtPayoffMethod: preferredMethod || 'avalanche',
        paymentFrequency: paymentFrequency || 'monthly',
        debtStrategyEnabled: debtStrategyEnabled ?? false,
      });
    }

    // Also update legacy debtSettings for backwards compatibility
    // This ensures components still using the old table work correctly
    const [legacySettings] = await db
      .select()
      .from(debtSettings)
      .where(
        and(
          eq(debtSettings.userId, userId),
          eq(debtSettings.householdId, householdId)
        )
      )
      .limit(1);

    if (legacySettings) {
      await db
        .update(debtSettings)
        .set({
          extraMonthlyPayment: extraMonthlyPayment !== undefined 
            ? extraMonthlyPayment 
            : legacySettings.extraMonthlyPayment,
          preferredMethod: preferredMethod || legacySettings.preferredMethod,
          paymentFrequency: paymentFrequency || legacySettings.paymentFrequency,
          updatedAt: new Date().toISOString(),
        })
        .where(
          and(
            eq(debtSettings.userId, userId),
            eq(debtSettings.householdId, householdId)
          )
        );
    } else {
      // Create legacy settings for backwards compatibility
      await db.insert(debtSettings).values({
        id: nanoid(),
        userId,
        householdId,
        extraMonthlyPayment: extraMonthlyPayment || 0,
        preferredMethod: preferredMethod || 'avalanche',
        paymentFrequency: paymentFrequency || 'monthly',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    // Recalculate payoff dates for all active debts when settings change
    // Note: This function still uses the legacy debts table
    // TODO: Update to use unified debt sources in a future phase
    await syncAllDebtPayoffDates(userId, householdId);

    return Response.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes('Household ID')) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    console.error('Error saving debt settings:', error);
    return Response.json({ error: 'Failed to save settings' }, { status: 500 });
  }
}
