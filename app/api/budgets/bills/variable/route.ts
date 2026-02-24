import { requireAuth } from '@/lib/auth-helpers';
import { getAndVerifyHousehold } from '@/lib/api/household-auth';
import { getVariableBillsTrackingData } from '@/lib/budgets/variable-bills-service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/budgets/bills/variable
 *
 * Query Parameters:
 * - month: YYYY-MM format (optional, defaults to current month)
 * - billId: Filter to specific bill (optional)
 *
 * Returns comprehensive variable bill tracking data
 */
export async function GET(request: Request) {
  try {
    const { userId } = await requireAuth();
    const { householdId } = await getAndVerifyHousehold(request, userId);

    // Get query parameters
    const url = new URL(request.url);
    const monthParam = url.searchParams.get('month');
    const billIdParam = url.searchParams.get('billId');

    // Parse month or default to current month
    let year: number;
    let month: number;

    if (monthParam) {
      const [yearStr, monthStr] = monthParam.split('-');
      year = parseInt(yearStr);
      month = parseInt(monthStr);
      if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
        return Response.json({ error: 'Invalid month. Expected YYYY-MM' }, { status: 400 });
      }
    } else {
      const now = new Date();
      year = now.getFullYear();
      month = now.getMonth() + 1;
    }

    const response = await getVariableBillsTrackingData({
      userId,
      householdId,
      year,
      month,
      billId: billIdParam,
    });

    return Response.json(response);
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes('Household')) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    console.error('Variable bill tracking error:', error);
    return Response.json(
      { error: 'Failed to fetch variable bill data' },
      { status: 500 }
    );
  }
}
