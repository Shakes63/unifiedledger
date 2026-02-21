import {
  handleDeleteTransactionById,
  handleGetTransactionById,
  handleUpdateTransactionById,
} from '@/lib/transactions/transaction-id-route-handlers';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return handleGetTransactionById(request, { params });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return handleUpdateTransactionById(request, { params });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return handleDeleteTransactionById(request, { params });
}
