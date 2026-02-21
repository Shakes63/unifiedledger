import { and, eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { requireAuth } from '@/lib/auth-helpers';
import { requireHouseholdAuth } from '@/lib/api/household-auth';
import { db } from '@/lib/db';
import { householdEntities, householdEntityMembers, householdMembers } from '@/lib/db/schema';
import { hasPermission } from '@/lib/household/permissions';

export const dynamic = 'force-dynamic';

async function requireManagePermissions(householdId: string, userId: string) {
  const allowed = await hasPermission(householdId, userId, 'manage_permissions');
  if (!allowed) {
    throw new Error('Unauthorized: Not authorized to manage entity access');
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ householdId: string; entityId: string }> }
) {
  try {
    const { userId } = await requireAuth();
    const { householdId, entityId } = await params;

    await requireHouseholdAuth(userId, householdId);

    const entity = await db
      .select()
      .from(householdEntities)
      .where(
        and(
          eq(householdEntities.id, entityId),
          eq(householdEntities.householdId, householdId),
          eq(householdEntities.isActive, true)
        )
      )
      .limit(1);

    if (entity.length === 0) {
      return Response.json({ error: 'Entity not found' }, { status: 404 });
    }

    const members = await db
      .select({
        id: householdEntityMembers.id,
        userId: householdEntityMembers.userId,
        role: householdEntityMembers.role,
        canManageEntity: householdEntityMembers.canManageEntity,
        isActive: householdEntityMembers.isActive,
        userEmail: householdMembers.userEmail,
        userName: householdMembers.userName,
      })
      .from(householdEntityMembers)
      .innerJoin(
        householdMembers,
        and(
          eq(householdMembers.userId, householdEntityMembers.userId),
          eq(householdMembers.householdId, householdEntityMembers.householdId)
        )
      )
      .where(
        and(
          eq(householdEntityMembers.entityId, entityId),
          eq(householdEntityMembers.isActive, true)
        )
      );

    return Response.json({ members });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.error('Failed to fetch entity members:', error);
    return Response.json({ error: 'Failed to fetch entity members' }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ householdId: string; entityId: string }> }
) {
  try {
    const { userId } = await requireAuth();
    const { householdId, entityId } = await params;

    await requireHouseholdAuth(userId, householdId);
    await requireManagePermissions(householdId, userId);

    const body = await request.json();
    const targetUserId = String(body?.userId || '');
    const role = (body?.role || 'viewer') as 'owner' | 'manager' | 'editor' | 'viewer';
    const canManageEntity = Boolean(body?.canManageEntity);

    if (!targetUserId) {
      return Response.json({ error: 'userId is required' }, { status: 400 });
    }

    const householdMember = await db
      .select({ id: householdMembers.id })
      .from(householdMembers)
      .where(
        and(
          eq(householdMembers.householdId, householdId),
          eq(householdMembers.userId, targetUserId),
          eq(householdMembers.isActive, true)
        )
      )
      .limit(1);

    if (householdMember.length === 0) {
      return Response.json({ error: 'Target user is not an active household member' }, { status: 400 });
    }

    const existing = await db
      .select({ id: householdEntityMembers.id })
      .from(householdEntityMembers)
      .where(
        and(
          eq(householdEntityMembers.entityId, entityId),
          eq(householdEntityMembers.userId, targetUserId)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(householdEntityMembers)
        .set({
          role,
          canManageEntity,
          isActive: true,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(householdEntityMembers.id, existing[0].id));
    } else {
      await db.insert(householdEntityMembers).values({
        id: nanoid(),
        entityId,
        householdId,
        userId: targetUserId,
        role,
        canManageEntity,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    return Response.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes('Not authorized')) {
      return Response.json({ error: error.message }, { status: 403 });
    }

    console.error('Failed to update entity member:', error);
    return Response.json({ error: 'Failed to update entity member' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ householdId: string; entityId: string }> }
) {
  try {
    const { userId } = await requireAuth();
    const { householdId, entityId } = await params;

    await requireHouseholdAuth(userId, householdId);
    await requireManagePermissions(householdId, userId);

    const body = await request.json();
    const targetUserId = String(body?.userId || '');

    if (!targetUserId) {
      return Response.json({ error: 'userId is required' }, { status: 400 });
    }

    await db
      .update(householdEntityMembers)
      .set({
        isActive: false,
        updatedAt: new Date().toISOString(),
      })
      .where(
        and(
          eq(householdEntityMembers.entityId, entityId),
          eq(householdEntityMembers.userId, targetUserId)
        )
      );

    return Response.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes('Not authorized')) {
      return Response.json({ error: error.message }, { status: 403 });
    }

    console.error('Failed to remove entity member:', error);
    return Response.json({ error: 'Failed to remove entity member' }, { status: 500 });
  }
}
