import { handleConvertTransactionToTransfer } from '@/lib/transactions/transaction-convert-to-transfer-route-handler';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return handleConvertTransactionToTransfer(request, { params });
}
