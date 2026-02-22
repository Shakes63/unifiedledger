import { handleRouteError } from '@/lib/api/route-helpers';
import {
  getTransferAccountNames,
} from '@/lib/transfers/transfer-id-access';
import {
  buildTransferNotFoundResponse,
  buildTransferSuccessResponse,
  executeTransferDeleteById,
  executeTransferUpdateById,
} from '@/lib/transfers/transfers-id-execution';
import { loadTransferIdRouteContext } from '@/lib/transfers/transfers-id-route-context';

export const dynamic = 'force-dynamic';

/**
 * GET /api/transfers/[id]
 * Get a specific transfer by ID
 */
export async function handleGetTransferById(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const { userId, householdId, transfer } = await loadTransferIdRouteContext({
      request,
      transferId: id,
    });
    if (!transfer) {
      return buildTransferNotFoundResponse();
    }

    const accountNames = await getTransferAccountNames({
      userId,
      householdId,
      fromAccountId: transfer.fromAccountId,
      toAccountId: transfer.toAccountId,
    });
    if (!accountNames) {
      return Response.json(
        { error: 'Transfer not found' },
        { status: 404 }
      );
    }

    return Response.json({
      ...transfer,
      fromAccountName: accountNames.fromAccountName,
      toAccountName: accountNames.toAccountName,
    });
  } catch (error) {
    return handleRouteError(error, {
      defaultError: 'Failed to fetch transfer',
      logLabel: 'Error fetching transfer:',
    });
  }
}

/**
 * PUT /api/transfers/[id]
 * Update a transfer (only pending transfers can be updated)
 * Body: { description, notes }
 */
export async function handleUpdateTransferById(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const { userId, householdId, transfer } = await loadTransferIdRouteContext({
      request,
      transferId: id,
    });
    if (!transfer) {
      return buildTransferNotFoundResponse();
    }

    const body = await request.json();
    const { description, notes } = body;
    if (description === undefined && notes === undefined) {
      return Response.json(
        { error: 'No fields to update' },
        { status: 400 }
      );
    }
    await executeTransferUpdateById({
      transferId: id,
      userId,
      householdId,
      transferData: transfer,
      description,
      notes,
    });
    return buildTransferSuccessResponse('Transfer updated successfully');
  } catch (error) {
    return handleRouteError(error, {
      defaultError: 'Failed to update transfer',
      logLabel: 'Error updating transfer:',
    });
  }
}

/**
 * DELETE /api/transfers/[id]
 * Delete a transfer and revert account balances
 * Only pending transfers can be deleted
 */
export async function handleDeleteTransferById(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const { userId, householdId, transfer } = await loadTransferIdRouteContext({
      request,
      transferId: id,
    });
    if (!transfer) {
      return buildTransferNotFoundResponse();
    }
    await executeTransferDeleteById({
      transferId: id,
      userId,
      householdId,
      transferData: transfer,
    });
    return buildTransferSuccessResponse('Transfer deleted successfully');
  } catch (error) {
    return handleRouteError(error, {
      defaultError: 'Failed to delete transfer',
      logLabel: 'Error deleting transfer:',
    });
  }
}
