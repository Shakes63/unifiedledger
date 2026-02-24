import { requireAuth } from '@/lib/auth-helpers';
import { getAndVerifyHousehold } from '@/lib/api/household-auth';
import {
  getDebtStrategySettings,
  isValidPayoffMethod,
  isValidPaymentFrequency,
  upsertDebtStrategySettings,
} from '@/lib/debts/unified-debt-sources';
import { syncAllDebtPayoffDates } from '@/lib/debts/payoff-date-utils';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { userId } = await requireAuth();
    const { householdId } = await getAndVerifyHousehold(request, userId);

    const settings = await getDebtStrategySettings(userId, householdId);
    return Response.json(settings);
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
    if (paymentFrequency && !isValidPaymentFrequency(paymentFrequency)) {
      return Response.json({ 
        error: 'Invalid payment frequency. Must be "weekly", "biweekly", "monthly", or "quarterly"' 
      }, { status: 400 });
    }

    // Validate preferred method
    if (preferredMethod && !isValidPayoffMethod(preferredMethod)) {
      return Response.json({ 
        error: 'Invalid preferred method. Must be "snowball" or "avalanche"' 
      }, { status: 400 });
    }

    await upsertDebtStrategySettings(userId, householdId, {
      extraMonthlyPayment:
        extraMonthlyPayment !== undefined
          ? Number(extraMonthlyPayment)
          : undefined,
      preferredMethod: preferredMethod || undefined,
      paymentFrequency: paymentFrequency || undefined,
      debtStrategyEnabled:
        debtStrategyEnabled !== undefined ? Boolean(debtStrategyEnabled) : undefined,
    });

    // Recalculate payoff dates for active standalone debts.
    // (Credit accounts and debt bills compute payoff through unified strategy routes.)
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
