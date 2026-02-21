import {
  handleGetMemberPermissions,
  handleResetMemberPermissions,
  handleUpdateMemberPermissions,
} from '@/lib/household/member-permissions-route-handlers';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ householdId: string; memberId: string }> }
) {
  const { householdId, memberId } = await params;
  return handleGetMemberPermissions(request, householdId, memberId);
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ householdId: string; memberId: string }> }
) {
  const { householdId, memberId } = await params;
  return handleUpdateMemberPermissions(request, householdId, memberId);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ householdId: string; memberId: string }> }
) {
  const { householdId, memberId } = await params;
  return handleResetMemberPermissions(request, householdId, memberId);
}
