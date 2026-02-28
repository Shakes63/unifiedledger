import { requireAuth } from '@/lib/auth-helpers';
import { getAndVerifyHousehold } from '@/lib/api/household-auth';
import { fullSync, isSyncEnabled } from '@/lib/calendar/sync-service';

export const dynamic = 'force-dynamic';

/**
 * POST /api/calendar-sync/sync
 * Trigger a full calendar sync
 * Body: {}
 * Household context: x-household-id header
 */
export async function POST(request: Request) {
  try {
    const { userId } = await requireAuth();
    const { householdId } = await getAndVerifyHousehold(request, userId);

    // Check if sync is enabled
    const syncEnabled = await isSyncEnabled(userId, householdId);
    if (!syncEnabled) {
      return Response.json(
        { error: 'No active calendar connections found. Please connect a calendar first.' },
        { status: 400 }
      );
    }

    // Perform full sync
    const result = await fullSync(userId, householdId);

    if (!result.success && result.errors.length > 0) {
      return Response.json(
        {
          ...result,
          message: 'Sync completed with errors',
        },
        { status: 207 } // Multi-Status
      );
    }

    return Response.json({
      ...result,
      message: 'Calendar sync completed successfully',
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error triggering calendar sync:', error);
    return Response.json(
      { error: 'Failed to sync calendar' },
      { status: 500 }
    );
  }
}
