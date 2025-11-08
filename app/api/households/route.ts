import { auth, clerkClient } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { households, householdMembers } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return Response.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get all households the user is a member of
    const result = await db
      .select({
        id: households.id,
        name: households.name,
        createdBy: households.createdBy,
        createdAt: households.createdAt,
      })
      .from(households)
      .innerJoin(householdMembers, eq(households.id, householdMembers.householdId))
      .where(eq(householdMembers.userId, userId));

    return Response.json(result);
  } catch (error) {
    console.error('Household fetch error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return Response.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { name } = body;

    if (!name) {
      return Response.json(
        { error: 'Household name is required' },
        { status: 400 }
      );
    }

    const householdId = nanoid();

    // Get user info from Clerk
    const user = await clerkClient.users.getUser(userId);
    const userEmail = user.emailAddresses[0]?.emailAddress || '';
    const userName = user.firstName && user.lastName
      ? `${user.firstName} ${user.lastName}`
      : user.firstName || user.username || '';

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
    console.error('Household creation error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
