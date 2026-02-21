import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth-helpers';
import { getAndVerifyHousehold } from '@/lib/api/household-auth';
import { runAutopay } from '@/lib/bills-v2/service';
import { toBillsV2Error } from '@/lib/bills-v2/route-helpers';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await requireAuth();
    const body = await request.json();
    const { householdId } = await getAndVerifyHousehold(
      request,
      userId,
      body as unknown as Record<string, unknown>
    );

    const result = await runAutopay({
      userId,
      householdId,
      runDate: body?.runDate,
      runType: body?.runType,
      dryRun: body?.dryRun,
    });
    return Response.json({ data: result });
  } catch (error) {
    return toBillsV2Error(error, 'autopay run POST');
  }
}
