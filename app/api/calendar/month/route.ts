import { getAndVerifyHousehold } from '@/lib/api/household-auth';
import { requireAuth } from '@/lib/auth-helpers';
import { normalizeCalendarBillDisplayMode } from '@/lib/calendar/bill-display-mode';
import { toLocalDateString } from '@/lib/utils/local-date';
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
    const billDisplayMode = normalizeCalendarBillDisplayMode(
      searchParams.get('billDisplayMode')
    );

    if (!startDateStr || !endDateStr) {
      return Response.json(
        { error: 'startDate and endDate are required' },
        { status: 400 }
      );
    }

    // Use the client's date-only keys verbatim (bug-hunt finding T4): the old
    // code re-formatted the client's UTC instant in the server's timezone,
    // shifting the range and the reported `month` a day under TZ skew.
    const startDate = /^\d{4}-\d{2}-\d{2}$/.test(startDateStr)
      ? startDateStr
      : toLocalDateString(new Date(startDateStr));
    const endDate = /^\d{4}-\d{2}-\d{2}$/.test(endDateStr)
      ? endDateStr
      : toLocalDateString(new Date(endDateStr));
    const daySummaries = await getMonthCalendarSummary({
      userId,
      householdId,
      startDate,
      endDate,
      billDisplayMode,
    });

    return Response.json({
      daySummaries,
      month: startDate.slice(0, 7),
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
