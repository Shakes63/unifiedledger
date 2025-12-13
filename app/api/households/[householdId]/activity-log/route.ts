import { requireAuth } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { householdActivityLog, householdMembers } from '@/lib/db/schema';
import { user as betterAuthUser } from '@/auth-schema';
import { eq, and, desc, type SQL } from 'drizzle-orm';

type ActivityType = typeof householdActivityLog.$inferSelect['activityType'];
type EntityType = typeof householdActivityLog.$inferSelect['entityType'];

const isString = (v: unknown): v is string => typeof v === 'string';

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
    const conditions: SQL[] = [eq(householdActivityLog.householdId, householdId)];
    if (activityType) {
      conditions.push(eq(householdActivityLog.activityType, activityType as ActivityType));
    }
    if (entityType) {
      conditions.push(eq(householdActivityLog.entityType, entityType as EntityType));
    }

    // Get total count
    const allResults = await db
      .select()
      .from(householdActivityLog)
      .where(and(...conditions));
    const totalCount = allResults.length;

    // Apply pagination and sorting with user avatar
    const activities = await db
      .select({
        id: householdActivityLog.id,
        householdId: householdActivityLog.householdId,
        userId: householdActivityLog.userId,
        userName: householdActivityLog.userName,
        userAvatarUrl: betterAuthUser.image,
        activityType: householdActivityLog.activityType,
        description: householdActivityLog.description,
        entityType: householdActivityLog.entityType,
        entityId: householdActivityLog.entityId,
        metadata: householdActivityLog.metadata,
        createdAt: householdActivityLog.createdAt,
      })
      .from(householdActivityLog)
      .leftJoin(betterAuthUser, eq(householdActivityLog.userId, betterAuthUser.id))
      .where(and(...conditions))
      .orderBy(desc(householdActivityLog.createdAt))
      .limit(limit)
      .offset(offset);

    // Parse metadata for each activity
    const enrichedActivities = activities.map((activity) => ({
      ...activity,
      metadata: isString(activity.metadata) ? JSON.parse(activity.metadata) : null,
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
