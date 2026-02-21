import { handleDeleteAccountById, handleUpdateAccountById } from '@/lib/accounts/account-id-route-handlers';

export const dynamic = 'force-dynamic';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return handleUpdateAccountById(request, { params });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return handleDeleteAccountById(request, { params });
}
