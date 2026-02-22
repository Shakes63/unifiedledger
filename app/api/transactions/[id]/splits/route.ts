import {
  handleCreateTransactionSplit,
  handleGetTransactionSplits,
} from '@/lib/transactions/transaction-splits-route-handler';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: transactionId } = await params;
  return handleGetTransactionSplits(request, transactionId);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: transactionId } = await params;
  return handleCreateTransactionSplit(request, transactionId);
}
