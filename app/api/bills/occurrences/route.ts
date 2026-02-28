import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth-helpers';
import { getAndVerifyHousehold } from '@/lib/api/household-auth';
import type { BillType, OccurrenceStatus } from '@/lib/bills/contracts';
import { listOccurrences } from '@/lib/bills/service';
import { toBillsV2Error } from '@/lib/bills/route-helpers';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { userId } = await requireAuth();
    const { householdId } = await getAndVerifyHousehold(request, userId);

    const statusParam = request.nextUrl.searchParams.get('status');
    const status = statusParam
      ? statusParam
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean) as OccurrenceStatus[]
      : undefined;

    const result = await listOccurrences({
      userId,
      householdId,
      status,
      from: request.nextUrl.searchParams.get('from') || undefined,
      to: request.nextUrl.searchParams.get('to') || undefined,
      periodOffset: request.nextUrl.searchParams.get('periodOffset')
        ? parseInt(request.nextUrl.searchParams.get('periodOffset') || '0', 10)
        : undefined,
      billType: (request.nextUrl.searchParams.get('billType') as BillType | null) ?? undefined,
      limit: request.nextUrl.searchParams.get('limit')
        ? parseInt(request.nextUrl.searchParams.get('limit') || '50', 10)
        : undefined,
      offset: request.nextUrl.searchParams.get('offset')
        ? parseInt(request.nextUrl.searchParams.get('offset') || '0', 10)
        : undefined,
    });

    return Response.json(result);
  } catch (error) {
    return toBillsV2Error(error, 'occurrences GET');
  }
}
