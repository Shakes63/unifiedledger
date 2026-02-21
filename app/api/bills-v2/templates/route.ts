import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth-helpers';
import { getAndVerifyHousehold } from '@/lib/api/household-auth';
import type {
  BillClassification,
  BillType,
  CreateBillTemplateRequest,
} from '@/lib/bills-v2/contracts';
import { createBillTemplate, listBillTemplates } from '@/lib/bills-v2/service';
import { toBillsV2Error } from '@/lib/bills-v2/route-helpers';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { userId } = await requireAuth();
    const { householdId } = await getAndVerifyHousehold(request, userId);

    const isActiveParam = request.nextUrl.searchParams.get('isActive');
    const isActive =
      isActiveParam === null ? undefined : isActiveParam.toLowerCase() === 'true';

    const billTypeParam = request.nextUrl.searchParams.get('billType');
    const classificationParam = request.nextUrl.searchParams.get('classification');
    const limitParam = request.nextUrl.searchParams.get('limit');
    const offsetParam = request.nextUrl.searchParams.get('offset');

    const result = await listBillTemplates({
      householdId,
      isActive,
      billType: (billTypeParam as BillType | null) ?? undefined,
      classification: (classificationParam as BillClassification | null) ?? undefined,
      limit: limitParam ? parseInt(limitParam, 10) : undefined,
      offset: offsetParam ? parseInt(offsetParam, 10) : undefined,
    });

    return Response.json(result);
  } catch (error) {
    return toBillsV2Error(error, 'templates GET');
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await requireAuth();
    const body: CreateBillTemplateRequest = await request.json();
    const { householdId } = await getAndVerifyHousehold(
      request,
      userId,
      body as unknown as Record<string, unknown>
    );

    const template = await createBillTemplate(userId, householdId, body);
    return Response.json({ data: template });
  } catch (error) {
    return toBillsV2Error(error, 'templates POST');
  }
}
