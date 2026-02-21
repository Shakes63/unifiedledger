import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth-helpers';
import { getAndVerifyHousehold } from '@/lib/api/household-auth';
import type { UpdateOccurrenceAllocationsRequest } from '@/lib/bills-v2/contracts';
import { updateOccurrenceAllocations } from '@/lib/bills-v2/service';
import { toBillsV2Error } from '@/lib/bills-v2/route-helpers';

export const dynamic = 'force-dynamic';

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await requireAuth();
    const body: UpdateOccurrenceAllocationsRequest = await request.json();
    const { householdId } = await getAndVerifyHousehold(
      request,
      userId,
      body as unknown as Record<string, unknown>
    );
    const { id } = await context.params;

    const allocations = await updateOccurrenceAllocations(householdId, id, body);
    return Response.json({ data: allocations });
  } catch (error) {
    return toBillsV2Error(error, 'occurrences [id] allocations PUT');
  }
}
