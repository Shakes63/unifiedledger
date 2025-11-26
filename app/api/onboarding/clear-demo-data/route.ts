import { requireAuth } from '@/lib/auth-helpers';
import { requireHouseholdAuth } from '@/lib/api/household-auth';
import { clearDemoData, getDemoDataSummary } from '@/lib/onboarding/demo-data-cleaner';

export const dynamic = 'force-dynamic';

/**
 * POST /api/onboarding/clear-demo-data
 * Clear all demo data from a household
 * Request body: { householdId }
 */
export async function POST(request: Request) {
  try {
    const { userId } = await requireAuth();

    const body = await request.json();
    const { householdId } = body;

    if (!householdId) {
      return Response.json(
        { error: 'Household ID is required', code: 'INVALID_HOUSEHOLD' },
        { status: 400 }
      );
    }

    // Verify user is a member of the household
    await requireHouseholdAuth(userId, householdId);

    // Clear demo data
    const result = await clearDemoData(householdId, userId);

    return Response.json({
      success: true,
      deleted: {
        transactions: result.transactions,
        bills: result.bills,
        debts: result.debts,
        goals: result.savingsGoals,
        merchants: result.merchants,
        categories: result.categories,
        accounts: result.accounts,
      },
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return Response.json(
          { error: 'Unauthorized', code: 'UNAUTHORIZED' },
          { status: 401 }
        );
      }
      if (error.message.includes('Household')) {
        return Response.json(
          { error: error.message, code: 'FORBIDDEN' },
          { status: 403 }
        );
      }
    }
    console.error('[Clear Demo Data API] Error:', error);
    return Response.json(
      { error: 'Failed to clear demo data', code: 'DELETE_FAILED' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/onboarding/clear-demo-data?householdId=xxx
 * Get summary of demo data in a household
 */
export async function GET(request: Request) {
  try {
    const { userId } = await requireAuth();

    const { searchParams } = new URL(request.url);
    const householdId = searchParams.get('householdId');

    if (!householdId) {
      return Response.json(
        { error: 'Household ID is required', code: 'INVALID_HOUSEHOLD' },
        { status: 400 }
      );
    }

    // Verify user is a member of the household
    await requireHouseholdAuth(userId, householdId);

    // Get demo data summary
    const summary = await getDemoDataSummary(householdId);

    return Response.json({
      success: true,
      summary,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return Response.json(
          { error: 'Unauthorized', code: 'UNAUTHORIZED' },
          { status: 401 }
        );
      }
      if (error.message.includes('Household')) {
        return Response.json(
          { error: error.message, code: 'FORBIDDEN' },
          { status: 403 }
        );
      }
    }
    console.error('[Demo Data Summary API] Error:', error);
    return Response.json(
      { error: 'Failed to get demo data summary', code: 'FETCH_FAILED' },
      { status: 500 }
    );
  }
}

