import { requireAuth } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { households, householdMembers } from '@/lib/db/schema';
import { user as betterAuthUser } from '@/auth-schema';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
export const dynamic = 'force-dynamic';

export async function GET(_request: Request) {
  try {
    const { userId } = await requireAuth();

    // Get all households the user is a member of, including when they joined and favorite status
    const result = await db
      .select({
        id: households.id,
        name: households.name,
        createdBy: households.createdBy,
        createdAt: households.createdAt,
        joinedAt: householdMembers.joinedAt,
        isFavorite: householdMembers.isFavorite,
      })
      .from(households)
      .innerJoin(householdMembers, eq(households.id, householdMembers.householdId))
      .where(eq(householdMembers.userId, userId));

    return Response.json(result);
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Household fetch error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { userId, email } = await requireAuth();

    const body = await request.json();
    const { name } = body;

    if (!name) {
      return Response.json(
        { error: 'Household name is required' },
        { status: 400 }
      );
    }

    const householdId = nanoid();

    // Get user info from Better Auth
    const user = await db
      .select()
      .from(betterAuthUser)
      .where(eq(betterAuthUser.id, userId))
      .get();

    const userEmail = user?.email || email || '';
    const userName = user?.name || '';

    // Create household
    await db.insert(households).values({
      id: householdId,
      name,
      createdBy: userId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Add creator as owner
    await db.insert(householdMembers).values({
      id: nanoid(),
      householdId,
      userId,
      userEmail,
      userName: userName || null,
      role: 'owner',
      joinedAt: new Date().toISOString(),
    });

    return Response.json(
      {
        id: householdId,
        name,
        message: 'Household created successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Household creation error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
