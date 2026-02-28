import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth-helpers';
import { getAndVerifyHousehold } from '@/lib/api/household-auth';
import { resetOccurrence } from '@/lib/bills/service';
import { toBillsV2Error } from '@/lib/bills/route-helpers';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await requireAuth();
    const { householdId } = await getAndVerifyHousehold(request, userId);
    const { id } = await context.params;

    const occurrence = await resetOccurrence(householdId, id);
    return Response.json({ data: occurrence });
  } catch (error) {
    return toBillsV2Error(error, 'occurrences [id] reset POST');
  }
}
