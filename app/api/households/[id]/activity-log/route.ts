import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { householdActivityLog, householdMembers } from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  try {
    const { id } = await params;

    // Verify user is a member of this household
    const membership = await db
      .select()
      .from(householdMembers)
      .where(and(eq(householdMembers.householdId, id), eq(householdMembers.userId, userId)))
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

    // Build query
    let query = db
      .select()
      .from(householdActivityLog)
      .where(eq(householdActivityLog.householdId, id));

    if (activityType) {
      query = query.where(eq(householdActivityLog.activityType, activityType as any));
    }

    if (entityType) {
      query = query.where(eq(householdActivityLog.entityType, entityType as any));
    }

    // Get total count
    const allResults = await query;
    const totalCount = allResults.length;

    // Apply pagination and sorting
    const activities = await query
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
    console.error('Error fetching activity log:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch activity log' }), {
      status: 500,
    });
  }
}
