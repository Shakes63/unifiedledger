import { requireAuth } from '@/lib/auth-helpers';
import { getAndVerifyHousehold } from '@/lib/api/household-auth';
import { calculateBudgetSurplusSummary } from '@/lib/budgets/surplus-summary';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { userId } = await requireAuth();
    const { householdId } = await getAndVerifyHousehold(request, userId);
    const summary = await calculateBudgetSurplusSummary({ userId, householdId });
    return Response.json(summary);
  } catch (error) {
    // Auth errors (requireAuth throws "Unauthorized")
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    // Household membership errors (requireHouseholdAuth throws "Unauthorized: Not a member...")
    if (error instanceof Error && error.message.includes('Unauthorized:')) {
      return Response.json({ error: error.message }, { status: 403 });
    }
    // Household ID missing
    if (error instanceof Error && error.message.includes('Household ID')) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    console.error('Budget summary error:', error);
    return Response.json(
      { error: 'Failed to calculate budget summary' },
      { status: 500 }
    );
  }
}
