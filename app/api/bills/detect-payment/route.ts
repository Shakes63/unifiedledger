import { requireAuth } from '@/lib/auth-helpers';
import { getHouseholdIdFromRequest, requireHouseholdAuth } from '@/lib/api/household-auth';
import { detectPaymentBill } from '@/lib/bills/payment-bill-detection';

export const dynamic = 'force-dynamic';

/**
 * GET /api/bills/detect-payment
 * Detect payment bills linked to a destination credit account
 * Used to show auto-detection banner when creating transfers
 * 
 * Query params:
 * - accountId: The destination account ID (credit card) to check for linked payment bills
 */
export async function GET(request: Request) {
  try {
    const { userId } = await requireAuth();

    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get('accountId');

    if (!accountId) {
      return Response.json(
        { error: 'accountId query parameter is required' },
        { status: 400 }
      );
    }

    // Get household ID from request
    const householdId = getHouseholdIdFromRequest(request);
    await requireHouseholdAuth(userId, householdId);

    if (!householdId) {
      return Response.json(
        { error: 'Household ID is required' },
        { status: 400 }
      );
    }

    // Run detection
    const result = await detectPaymentBill(accountId, householdId);

    return Response.json(result);
  } catch (error) {
    console.error('Error detecting payment bills:', error);
    
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    if (error instanceof Error && error.message.includes('Household')) {
      return Response.json({ error: error.message }, { status: 403 });
    }
    
    return Response.json(
      { error: 'Failed to detect payment bills' },
      { status: 500 }
    );
  }
}
