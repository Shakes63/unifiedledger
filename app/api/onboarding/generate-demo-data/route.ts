import { requireAuth } from '@/lib/auth-helpers';
import { requireHouseholdAuth } from '@/lib/api/household-auth';
import { generateDemoData } from '@/lib/onboarding/demo-data-generator';

export const dynamic = 'force-dynamic';

/**
 * POST /api/onboarding/generate-demo-data
 * Generate demo data for invited users
 * Request body: { householdId }
 */
export async function POST(request: Request) {
  try {
    const { userId } = await requireAuth();

    const body = await request.json();
    const { householdId } = body;

    if (!householdId) {
      return Response.json(
        { error: 'Household ID is required' },
        { status: 400 }
      );
    }

    // Verify user is a member of the household
    await requireHouseholdAuth(userId, householdId);

    // Generate demo data
    const result = await generateDemoData(householdId, userId);

    return Response.json({
      success: true,
      ...result,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
      }
      if (error.message.includes('Household')) {
        return Response.json(
          { error: error.message },
          { status: 403 }
        );
      }
    }
    console.error('[Demo Data API] Error generating demo data:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

