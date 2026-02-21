import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth-helpers';
import { getAndVerifyHousehold } from '@/lib/api/household-auth';
import type { UpdateBillTemplateRequest } from '@/lib/bills-v2/contracts';
import { deleteBillTemplate, updateBillTemplate } from '@/lib/bills-v2/service';
import { toBillsV2Error } from '@/lib/bills-v2/route-helpers';

export const dynamic = 'force-dynamic';

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await requireAuth();
    const body: UpdateBillTemplateRequest = await request.json();
    const { householdId } = await getAndVerifyHousehold(
      request,
      userId,
      body as unknown as Record<string, unknown>
    );
    const { id } = await context.params;

    const template = await updateBillTemplate(id, householdId, body);
    return Response.json({ data: template });
  } catch (error) {
    return toBillsV2Error(error, 'templates [id] PUT');
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await requireAuth();
    const { householdId } = await getAndVerifyHousehold(request, userId);
    const { id } = await context.params;

    await deleteBillTemplate(id, householdId);
    return Response.json({ success: true });
  } catch (error) {
    return toBillsV2Error(error, 'templates [id] DELETE');
  }
}
