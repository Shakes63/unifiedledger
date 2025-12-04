import { requireAuth } from '@/lib/auth-helpers';
import { getHouseholdIdFromRequest, requireHouseholdAuth } from '@/lib/api/household-auth';
import { detectSavingsGoal } from '@/lib/transactions/savings-detection';

export const dynamic = 'force-dynamic';

/**
 * GET /api/savings-goals/detect
 * Detect savings goals linked to a destination account for auto-suggestion
 * 
 * Query params:
 * - accountId: The destination account ID to check for linked goals
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
    const result = await detectSavingsGoal(accountId, householdId);

    return Response.json(result);
  } catch (error) {
    console.error('Error detecting savings goals:', error);
    
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    return Response.json(
      { error: 'Failed to detect savings goals' },
      { status: 500 }
    );
  }
}

