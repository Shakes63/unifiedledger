import type { TransactionUpdateInput } from '@/lib/transactions/transaction-update-validation';

export function parseTransactionUpdateRequestBody(body: Record<string, unknown>): {
  updateInput: TransactionUpdateInput;
  billInstanceId?: string;
} {
  return {
    updateInput: {
      accountId: body.accountId as string | undefined,
      categoryId: body.categoryId as string | null | undefined,
      merchantId: body.merchantId as string | null | undefined,
      date: body.date as string | undefined,
      amount: body.amount as string | number | undefined,
      description: body.description as string | undefined,
      notes: body.notes as string | null | undefined,
      isPending: body.isPending as boolean | undefined,
      transferId: body.transferId as string | undefined,
      transferDestinationAccountId: body.transferDestinationAccountId as string | undefined,
      transferSourceAccountId: body.transferSourceAccountId as string | undefined,
    },
    billInstanceId: body.billInstanceId as string | undefined,
  };
}
