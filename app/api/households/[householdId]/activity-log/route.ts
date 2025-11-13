import { requireAuth } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { householdActivityLog, householdMembers } from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ householdId: string }> }
) {
  try {
    const { userId } = await requireAuth();
    const { householdId } = await params;

    // Verify user is a member of this household
    const membership = await db
      .select()
      .from(householdMembers)
      .where(and(eq(householdMembers.householdId, householdId), eq(householdMembers.userId, userId)))
      .then((res) => res[0]);

    if (!membership) {
      return new Response(JSON.stringify({ error: 'Not a member of this household' }), {
        status: 403,
      });
    }

    // Get query parameters
    const url = new URL(request.url);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);
    const offset = parseInt(url.searchParams.get('offset') || '0');
    const activityType = url.searchParams.get('activityType');
    const entityType = url.searchParams.get('entityType');

    // Build query conditions
    const conditions = [eq(householdActivityLog.householdId, householdId)];
    if (activityType) {
      conditions.push(eq(householdActivityLog.activityType, activityType as any));
    }
    if (entityType) {
      conditions.push(eq(householdActivityLog.entityType, entityType as any));
    }

    // Get total count
    const allResults = await db
      .select()
      .from(householdActivityLog)
      .where(and(...conditions));
    const totalCount = allResults.length;

    // Apply pagination and sorting
    const activities = await db
      .select()
      .from(householdActivityLog)
      .where(and(...conditions))
      .orderBy(desc(householdActivityLog.createdAt))
      .limit(limit)
      .offset(offset);

    // Parse metadata for each activity
    const enrichedActivities = activities.map((activity) => ({
      ...activity,
      metadata: activity.metadata ? JSON.parse(activity.metadata) : null,
    }));

    return new Response(
      JSON.stringify({
        data: enrichedActivities,
        pagination: {
          limit,
          offset,
          total: totalCount,
          hasMore: offset + limit < totalCount,
        },
      }),
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }
    console.error('Error fetching activity log:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch activity log' }), {
      status: 500,
    });
  }
}
