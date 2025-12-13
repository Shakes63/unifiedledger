import { requireOwner } from '@/lib/auth/owner-helpers';
import { db } from '@/lib/db';
import { households, householdMembers } from '@/lib/db/schema';
import { eq, sql, type SQL } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/households
 * List all households in the system (owner only)
 * Query params: limit?, offset?, search?
 */
export async function GET(request: Request) {
  try {
    // Verify owner access
    await requireOwner();

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '100', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const search = searchParams.get('search') || '';

    // Build where clause for search
    let whereClause: SQL | undefined;
    if (search) {
      // Case-insensitive search on household name
      const searchPattern = `%${search}%`;
      whereClause = sql`LOWER(${households.name}) LIKE LOWER(${searchPattern})`;
    }

    // Get total count (with search filter if applicable)
    const allHouseholds = whereClause
      ? await db.select({ id: households.id }).from(households).where(whereClause)
      : await db.select({ id: households.id }).from(households);
    const total = allHouseholds.length;

    // Get paginated households
    const householdsQuery = db
      .select({
        id: households.id,
        name: households.name,
        createdAt: households.createdAt,
      })
      .from(households)
      .$dynamic();

    const householdsList = await (whereClause
      ? householdsQuery.where(whereClause)
      : householdsQuery)
      .limit(limit)
      .offset(offset)
      .orderBy(households.createdAt);

    // Get member count for each household
    const householdsWithMemberCount = await Promise.all(
      householdsList.map(async (household) => {
        const members = await db
          .select({ id: householdMembers.id })
          .from(householdMembers)
          .where(eq(householdMembers.householdId, household.id));

        return {
          ...household,
          memberCount: members.length,
        };
      })
    );

    return Response.json({
      households: householdsWithMemberCount,
      total,
      limit,
      offset,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
      }
      if (error.message.includes('Forbidden') || error.message.includes('Owner')) {
        return Response.json(
          { error: 'Forbidden: Owner access required' },
          { status: 403 }
        );
      }
    }
    console.error('[Admin Households API] Error listing households:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

