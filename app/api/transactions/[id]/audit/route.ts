import { handleGetTransactionAudit } from '@/lib/transactions/transaction-audit-route-handler';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return handleGetTransactionAudit(request, id);
}
