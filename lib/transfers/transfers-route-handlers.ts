import { requireAuth } from '@/lib/auth-helpers';
import { getAndVerifyHousehold } from '@/lib/api/household-auth';
import { resolveAndRequireEntity } from '@/lib/api/entity-auth';
import { handleRouteError } from '@/lib/api/route-helpers';
import { createCanonicalTransferPair } from '@/lib/transactions/transfer-service';
import { trackTransferPairUsage } from '@/lib/analytics/usage-analytics-service';
import {
  mapTransferCreateValidationError,
  validateTransferCreateInput,
} from '@/lib/transfers/transfer-create-validation';
import {
  enrichTransfersWithAccountNames,
  listEntityScopedTransfers,
  parseTransferListParams,
} from '@/lib/transfers/transfers-list-query';

export const dynamic = 'force-dynamic';

/**
 * GET /api/transfers
 * List all transfers for the authenticated user with pagination
 * Query params: limit, offset, fromDate, toDate
 */
export async function handleListTransfers(request: Request) {
  try {
    const { userId } = await requireAuth();
    const { householdId } = await getAndVerifyHousehold(request, userId);
    const selectedEntity = await resolveAndRequireEntity(userId, householdId, request);

    const { limit, offset, fromDate, toDate } = parseTransferListParams(request);
    const entityScopedTransfers = await listEntityScopedTransfers({
      userId,
      householdId,
      selectedEntityId: selectedEntity.id,
      selectedEntityIsDefault: selectedEntity.isDefault,
      limit,
      offset,
      fromDate,
      toDate,
    });
    const enrichedTransfers = await enrichTransfersWithAccountNames({
      userId,
      householdId,
      transferList: entityScopedTransfers,
    });

    return Response.json({
      transfers: enrichedTransfers,
      total: entityScopedTransfers.length,
      limit,
      offset,
    });
  } catch (error) {
    return handleRouteError(error, {
      defaultError: 'Failed to fetch transfers',
      logLabel: 'Error fetching transfers:',
    });
  }
}

/**
 * POST /api/transfers
 * Create a new transfer between accounts
 * Body: { fromAccountId, toAccountId, amount, date, description, fees, notes }
 */
export async function handleCreateTransfer(request: Request) {
  try {
    const { userId } = await requireAuth();
    const body = await request.json();
    const { householdId } = await getAndVerifyHousehold(request, userId, body);
    const {
      fromAccountId,
      toAccountId,
      amount,
      date,
      description = 'Transfer',
      fees = 0,
      notes,
    } = body;

    let transferPayload;
    try {
      const validated = await validateTransferCreateInput({
        userId,
        householdId,
        request,
        body,
        fromAccountId,
        toAccountId,
        amount,
        date,
        description,
        fees,
        notes,
      });
      transferPayload = validated.transferPayload;
    } catch (error) {
      const mappedValidationError = mapTransferCreateValidationError(error);
      if (mappedValidationError) {
        return mappedValidationError;
      }
      throw error;
    }

    const result = await createCanonicalTransferPair(transferPayload);

    await trackTransferPairUsage({
      userId,
      householdId,
      fromAccountId,
      toAccountId,
    });

    return Response.json(
      {
        message: 'Transfer created successfully',
        transferId: result.transferGroupId,
        fromTransactionId: result.fromTransactionId,
        toTransactionId: result.toTransactionId,
      },
      { status: 201 }
    );
  } catch (error) {
    return handleRouteError(error, {
      defaultError: 'Failed to create transfer',
      logLabel: 'Error creating transfer:',
    });
  }
}
