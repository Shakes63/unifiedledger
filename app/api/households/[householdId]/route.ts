import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { households, householdMembers } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { hasPermission, isMemberOfHousehold } from '@/lib/household/permissions';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ householdId: string }> }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { householdId } = await params;

    // Verify user is a member
    if (!(await isMemberOfHousehold(householdId, userId))) {
      return Response.json(
        { error: 'Not a member of this household' },
        { status: 403 }
      );
    }

    // Get household details
    const household = await db
      .select()
      .from(households)
      .where(eq(households.id, householdId))
      .limit(1);

    if (household.length === 0) {
      return Response.json(
        { error: 'Household not found' },
        { status: 404 }
      );
    }

    return Response.json(household[0]);
  } catch (error) {
    console.error('Error fetching household:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ householdId: string }> }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { householdId } = await params;
    const body = await request.json();
    const { name } = body;

    if (!name) {
      return Response.json(
        { error: 'Household name is required' },
        { status: 400 }
      );
    }

    // Check permission to manage household
    const canManage = await hasPermission(householdId, userId, 'manage_permissions');
    if (!canManage) {
      return Response.json(
        { error: 'Not authorized to update household' },
        { status: 403 }
      );
    }

    // Update household
    const result = await db
      .update(households)
      .set({
        name,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(households.id, householdId))
      .returning();

    return Response.json(result[0]);
  } catch (error) {
    console.error('Error updating household:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ householdId: string }> }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { householdId } = await params;

    // Check if user is owner
    const canDelete = await hasPermission(householdId, userId, 'delete_household');
    if (!canDelete) {
      return Response.json(
        { error: 'Only household owners can delete the household' },
        { status: 403 }
      );
    }

    // Delete household (cascade will handle members and invitations)
    await db.delete(households).where(eq(households.id, householdId));

    return Response.json({ message: 'Household deleted successfully' });
  } catch (error) {
    console.error('Error deleting household:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
