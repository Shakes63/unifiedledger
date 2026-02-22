import { transactions } from '@/lib/db/schema';
import { hasAnyTransactionUpdateField } from '@/lib/transactions/transaction-update-validation';
import { parseTransactionUpdateRequestBody } from '@/lib/transactions/transaction-update-request';
import { executeTransferTransactionUpdateBranch } from '@/lib/transactions/transaction-update-transfer-branch';
import { executeStandardTransactionUpdateBranch } from '@/lib/transactions/transaction-update-standard-branch';
import { isTransferTransactionType } from '@/lib/transactions/transaction-update-transfer';

export async function executeTransactionUpdateOrchestration({
  id,
  userId,
  householdId,
  selectedEntityId,
  transaction,
  body,
}: {
  id: string;
  userId: string;
  householdId: string;
  selectedEntityId: string;
  transaction: typeof transactions.$inferSelect;
  body: Record<string, unknown>;
}): Promise<Response> {
  const { updateInput, billInstanceId } = parseTransactionUpdateRequestBody(body);

  if (!hasAnyTransactionUpdateField(updateInput)) {
    return Response.json({ error: 'No fields to update' }, { status: 400 });
  }

  if (isTransferTransactionType(transaction.type)) {
    return executeTransferTransactionUpdateBranch({
      id,
      userId,
      householdId,
      transactionType: transaction.type as 'transfer_in' | 'transfer_out',
      updateInput,
    });
  }

  return executeStandardTransactionUpdateBranch({
    id,
    userId,
    householdId,
    selectedEntityId,
    transaction,
    updateInput,
    billInstanceId,
  });
}
