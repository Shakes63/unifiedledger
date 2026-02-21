import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth-helpers';
import { getAndVerifyHousehold } from '@/lib/api/household-auth';
import type { PayOccurrenceRequest } from '@/lib/bills-v2/contracts';
import { payOccurrence } from '@/lib/bills-v2/service';
import { toBillsV2Error } from '@/lib/bills-v2/route-helpers';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await requireAuth();
    const body: PayOccurrenceRequest = await request.json();
    const { householdId } = await getAndVerifyHousehold(
      request,
      userId,
      body as unknown as Record<string, unknown>
    );
    const { id } = await context.params;

    const result = await payOccurrence(userId, householdId, id, body);
    return Response.json({ data: result });
  } catch (error) {
    return toBillsV2Error(error, 'occurrences [id] pay POST');
  }
}
