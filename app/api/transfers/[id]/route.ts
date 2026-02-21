import {
  handleDeleteTransferById,
  handleGetTransferById,
  handleUpdateTransferById,
} from '@/lib/transfers/transfers-id-route-handlers';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return handleGetTransferById(request, { params });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return handleUpdateTransferById(request, { params });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return handleDeleteTransferById(request, { params });
}
