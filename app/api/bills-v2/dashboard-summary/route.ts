import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth-helpers';
import { getAndVerifyHousehold } from '@/lib/api/household-auth';
import { getDashboardSummary } from '@/lib/bills-v2/service';
import { toBillsV2Error } from '@/lib/bills-v2/route-helpers';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { userId } = await requireAuth();
    const { householdId } = await getAndVerifyHousehold(request, userId);
    const summary = await getDashboardSummary(userId, householdId);
    return Response.json({ data: summary });
  } catch (error) {
    return toBillsV2Error(error, 'dashboard summary GET');
  }
}
