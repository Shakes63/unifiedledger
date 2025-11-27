import { requireOwner } from '@/lib/auth/owner-helpers';
import { auth } from '@/lib/better-auth';
import { db } from '@/lib/db';
import { betterAuthUser, households, householdMembers } from '@/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { headers } from 'next/headers';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/users
 * Create a new user account (owner only)
 * Request body: { email, password, name?, householdId?, role? }
 */
export async function POST(request: Request) {
  try {
    // Verify owner access
    const { userId: ownerId } = await requireOwner();

    const body = await request.json();
    const { email, password, name, householdId, role = 'member' } = body;

    // Validation
    if (!email || !password) {
      return Response.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return Response.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Validate password strength (min 8 characters)
    if (password.length < 8) {
      return Response.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 }
      );
    }

    // Check if email already exists
    const existingUser = await db
      .select({ id: betterAuthUser.id })
      .from(betterAuthUser)
      .where(eq(betterAuthUser.email, email.toLowerCase()))
      .limit(1);

    if (existingUser.length > 0) {
      return Response.json(
        { error: 'Email already exists' },
        { status: 409 }
      );
    }

    // Validate household if provided
    if (householdId) {
      const household = await db
        .select({ id: households.id })
        .from(households)
        .where(eq(households.id, householdId))
        .limit(1);

      if (household.length === 0) {
        return Response.json(
          { error: 'Household not found' },
          { status: 404 }
        );
      }

      // Validate role if household is provided
      const validRoles = ['owner', 'admin', 'member', 'viewer'];
      if (!validRoles.includes(role)) {
        return Response.json(
          { error: `Invalid role. Must be one of: ${validRoles.join(', ')}` },
          { status: 400 }
        );
      }
    }

    // Create user using Better Auth API
    const signUpResult = await auth.api.signUpEmail({
      body: {
        email: email.toLowerCase(),
        password,
        name: name || email.split('@')[0], // Use email prefix as default name
      },
      headers: await headers(),
    });

    if (!signUpResult || !signUpResult.user) {
      return Response.json(
        { error: 'Failed to create user account' },
        { status: 500 }
      );
    }

    const newUserId = signUpResult.user.id;

    // Add user to household if householdId is provided
    let householdMembershipId: string | null = null;
    if (householdId) {
      // Check if user is already a member
      const existingMember = await db
        .select({ id: householdMembers.id })
        .from(householdMembers)
        .where(
          and(
            eq(householdMembers.householdId, householdId),
            eq(householdMembers.userId, newUserId)
          )
        )
        .limit(1);

      if (existingMember.length === 0) {
        householdMembershipId = nanoid();
        await db.insert(householdMembers).values({
          id: householdMembershipId,
          householdId,
          userId: newUserId,
          userEmail: email.toLowerCase(),
          userName: signUpResult.user.name || null,
          role: role as 'owner' | 'admin' | 'member' | 'viewer',
          joinedAt: new Date().toISOString(),
          invitedBy: ownerId,
        });
      }
    }

    return Response.json(
      {
        id: newUserId,
        email: signUpResult.user.email,
        name: signUpResult.user.name,
        householdId: householdId || null,
        role: householdId ? role : null,
        createdAt: new Date().toISOString(),
      },
      { status: 201 }
    );
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
      if (error.message.includes('already exists') || error.message.includes('UNIQUE constraint')) {
        return Response.json(
          { error: 'Email already exists' },
          { status: 409 }
        );
      }
    }
    console.error('[Admin Users API] Error creating user:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/users
 * List all users in the system (owner only)
 * Query params: limit?, offset?, search?
 */
export async function GET(request: Request) {
  try {
    // Verify owner access
    await requireOwner();

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const search = searchParams.get('search') || '';

    // Build where clause
    let whereClause: any = undefined;
    if (search) {
      // Use SQL template for case-insensitive search
      const searchPattern = `%${search}%`;
      whereClause = sql`LOWER(${betterAuthUser.email}) LIKE LOWER(${searchPattern}) OR LOWER(${betterAuthUser.name}) LIKE LOWER(${searchPattern})`;
    }

    // Get total count (with search filter if applicable)
    const allUsers = whereClause
      ? await db.select({ id: betterAuthUser.id }).from(betterAuthUser).where(whereClause)
      : await db.select({ id: betterAuthUser.id }).from(betterAuthUser);
    const total = allUsers.length;

    // Get paginated users
    const usersQuery = db
      .select({
        id: betterAuthUser.id,
        email: betterAuthUser.email,
        name: betterAuthUser.name,
        createdAt: betterAuthUser.createdAt,
      })
      .from(betterAuthUser)
      .$dynamic();

    const users = await (whereClause
      ? usersQuery.where(whereClause)
      : usersQuery).limit(limit).offset(offset);

    // Get household count for each user
    const usersWithHouseholdCount = await Promise.all(
      users.map(async (user) => {
        const householdMemberships = await db
          .select({ id: householdMembers.id })
          .from(householdMembers)
          .where(eq(householdMembers.userId, user.id));

        return {
          ...user,
          householdCount: householdMemberships.length,
        };
      })
    );

    return Response.json({
      users: usersWithHouseholdCount,
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
    console.error('[Admin Users API] Error listing users:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

