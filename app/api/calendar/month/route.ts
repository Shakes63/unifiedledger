import { format } from 'date-fns';

import { getAndVerifyHousehold } from '@/lib/api/household-auth';
import { requireAuth } from '@/lib/auth-helpers';
import { getMonthCalendarSummary } from '@/lib/calendar/data-service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/calendar/month
 * Get transaction, bill, autopay, and payoff summaries for each day in a month range
 * Query params: startDate, endDate
 */
export async function GET(request: Request) {
  try {
    const { userId } = await requireAuth();
    const { householdId } = await getAndVerifyHousehold(request, userId);

    const { searchParams } = new URL(request.url);
    const startDateStr = searchParams.get('startDate');
    const endDateStr = searchParams.get('endDate');

    if (!startDateStr || !endDateStr) {
      return Response.json(
        { error: 'startDate and endDate are required' },
        { status: 400 }
      );
    }

    const startDate = new Date(startDateStr);
    const endDate = new Date(endDateStr);
    const daySummaries = await getMonthCalendarSummary({
      userId,
      householdId,
      startDate: format(startDate, 'yyyy-MM-dd'),
      endDate: format(endDate, 'yyyy-MM-dd'),
    });

    return Response.json({
      daySummaries,
      month: format(startDate, 'yyyy-MM'),
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error fetching calendar month data:', error);
    return Response.json(
      { error: 'Failed to fetch calendar data' },
      { status: 500 }
    );
  }
}
