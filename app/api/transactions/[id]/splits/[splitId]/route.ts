import {
  handleDeleteTransactionSplit,
  handleUpdateTransactionSplit,
} from '@/lib/transactions/transaction-split-id-route-handler';

export const dynamic = 'force-dynamic';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; splitId: string }> }
) {
  const { id: transactionId, splitId } = await params;
  return handleUpdateTransactionSplit(request, transactionId, splitId);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; splitId: string }> }
) {
  const { id: transactionId, splitId } = await params;
  return handleDeleteTransactionSplit(request, transactionId, splitId);
}
