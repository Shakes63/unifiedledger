import {
  mapTransferUpdateError,
  runTransferTransactionUpdate,
} from '@/lib/transactions/transaction-update-transfer';
import type { TransactionUpdateInput } from '@/lib/transactions/transaction-update-validation';

export async function executeTransferTransactionUpdateBranch({
  id,
  userId,
  householdId,
  transactionType,
  updateInput,
}: {
  id: string;
  userId: string;
  householdId: string;
  transactionType: string;
  updateInput: TransactionUpdateInput;
}): Promise<Response> {
  try {
    await runTransferTransactionUpdate({
      userId,
      householdId,
      transactionType,
      transactionId: id,
      accountId: updateInput.accountId,
      transferId: updateInput.transferId,
      transferDestinationAccountId: updateInput.transferDestinationAccountId,
      transferSourceAccountId: updateInput.transferSourceAccountId,
      amount: updateInput.amount,
      date: updateInput.date,
      description: updateInput.description,
      notes: updateInput.notes,
      isPending: updateInput.isPending,
    });

    return Response.json(
      {
        id,
        message: 'Transaction updated successfully',
      },
      { status: 200 }
    );
  } catch (error) {
    const mappedResponse = mapTransferUpdateError(error);
    if (mappedResponse) {
      return mappedResponse;
    }

    throw error;
  }
}
