import { requireEntityAccess } from '@/lib/household/entities';

export function getEntityIdFromRequest(
  request: Request,
  body?: { entityId?: string }
): string | null {
  const headerEntityId = request.headers.get('x-entity-id');
  if (headerEntityId) {
    return headerEntityId;
  }

  if (body?.entityId) {
    return body.entityId;
  }

  return null;
}

export async function resolveAndRequireEntity(
  userId: string,
  householdId: string,
  request: Request,
  body?: { entityId?: string }
) {
  const requestedEntityId = getEntityIdFromRequest(request, body);
  return requireEntityAccess(userId, householdId, requestedEntityId);
}
