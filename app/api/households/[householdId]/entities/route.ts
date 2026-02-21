import { requireAuth } from '@/lib/auth-helpers';
import { requireHouseholdAuth } from '@/lib/api/household-auth';
import { createBusinessEntity, listAccessibleEntitiesForUser } from '@/lib/household/entities';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ householdId: string }> }
) {
  try {
    const { userId } = await requireAuth();
    const { householdId } = await params;

    await requireHouseholdAuth(userId, householdId);
    const entities = await listAccessibleEntitiesForUser(householdId, userId);

    return Response.json({ entities });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return Response.json({ error: error.message }, { status: 403 });
    }

    console.error('Failed to fetch household entities:', error);
    return Response.json({ error: 'Failed to fetch household entities' }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ householdId: string }> }
) {
  try {
    const { userId } = await requireAuth();
    const { householdId } = await params;

    await requireHouseholdAuth(userId, householdId);

    const body = await request.json();
    const name = String(body?.name || '').trim();
    const type = String(body?.type || 'business');
    const enableSalesTax = Boolean(body?.enableSalesTax);

    if (!name) {
      return Response.json({ error: 'Entity name is required' }, { status: 400 });
    }

    if (type !== 'business') {
      return Response.json({ error: 'Only business entities can be created via this endpoint' }, { status: 400 });
    }

    const entity = await createBusinessEntity(householdId, userId, name, enableSalesTax);
    return Response.json({ entity }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return Response.json({ error: error.message }, { status: 403 });
    }

    console.error('Failed to create business entity:', error);
    return Response.json({ error: 'Failed to create business entity' }, { status: 500 });
  }
}
