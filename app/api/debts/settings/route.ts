import { requireAuth } from '@/lib/auth-helpers';
import { getAndVerifyHousehold } from '@/lib/api/household-auth';
import { db } from '@/lib/db';
import { debtSettings } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { syncAllDebtPayoffDates } from '@/lib/debts/payoff-date-utils';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { userId } = await requireAuth();
    const { householdId } = await getAndVerifyHousehold(request, userId);

    const settings = await db
      .select()
      .from(debtSettings)
      .where(
        and(
          eq(debtSettings.userId, userId),
          eq(debtSettings.householdId, householdId)
        )
      )
      .limit(1);

    if (settings.length === 0) {
      // Return default settings if none exist for this household
      return Response.json({
        extraMonthlyPayment: 0,
        preferredMethod: 'avalanche',
        paymentFrequency: 'monthly',
      });
    }

    return Response.json({
      extraMonthlyPayment: settings[0].extraMonthlyPayment || 0,
      preferredMethod: settings[0].preferredMethod || 'avalanche',
      paymentFrequency: settings[0].paymentFrequency || 'monthly',
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

    const { extraMonthlyPayment, preferredMethod, paymentFrequency } = body;

    // Validate payment frequency
    if (paymentFrequency && !['weekly', 'biweekly', 'monthly', 'quarterly'].includes(paymentFrequency)) {
      return Response.json({ error: 'Invalid payment frequency. Must be "weekly", "biweekly", "monthly", or "quarterly"' }, { status: 400 });
    }

    // Check if settings exist for this household
    const existingSettings = await db
      .select()
      .from(debtSettings)
      .where(
        and(
          eq(debtSettings.userId, userId),
          eq(debtSettings.householdId, householdId)
        )
      )
      .limit(1);

    if (existingSettings.length === 0) {
      // Create new settings for this household
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
    } else {
      // Update existing settings for this household
      await db
        .update(debtSettings)
        .set({
          extraMonthlyPayment: extraMonthlyPayment !== undefined ? extraMonthlyPayment : existingSettings[0].extraMonthlyPayment,
          preferredMethod: preferredMethod || existingSettings[0].preferredMethod,
          paymentFrequency: paymentFrequency || existingSettings[0].paymentFrequency,
          updatedAt: new Date().toISOString(),
        })
        .where(
          and(
            eq(debtSettings.userId, userId),
            eq(debtSettings.householdId, householdId)
          )
        );
    }

    // Recalculate payoff dates for all active debts when settings change
    // These settings affect payoff projections (extra payment, method, frequency)
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
