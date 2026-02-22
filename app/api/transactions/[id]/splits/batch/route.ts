import { handleBatchUpdateTransactionSplits } from '@/lib/transactions/transaction-splits-batch-route-handler';

export const dynamic = 'force-dynamic';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: transactionId } = await params;
  return handleBatchUpdateTransactionSplits(request, transactionId);
}
