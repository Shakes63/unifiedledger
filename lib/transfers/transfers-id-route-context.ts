import { requireAuth } from '@/lib/auth-helpers';
import { getAndVerifyHousehold } from '@/lib/api/household-auth';
import { resolveAndRequireEntity } from '@/lib/api/entity-auth';
import { getTransferForSelectedEntity } from '@/lib/transfers/transfer-id-access';

export async function loadTransferIdRouteContext({
  request,
  transferId,
}: {
  request: Request;
  transferId: string;
}): Promise<{
  userId: string;
  householdId: string;
  transfer: Awaited<ReturnType<typeof getTransferForSelectedEntity>>;
}> {
  const { userId } = await requireAuth();
  const { householdId } = await getAndVerifyHousehold(request, userId);
  const selectedEntity = await resolveAndRequireEntity(userId, householdId, request);

  const transfer = await getTransferForSelectedEntity({
    transferId,
    userId,
    householdId,
    selectedEntityId: selectedEntity.id,
    selectedEntityIsDefault: selectedEntity.isDefault,
  });

  return { userId, householdId, transfer };
}
