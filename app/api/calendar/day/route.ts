import { requireAuth } from '@/lib/auth-helpers';
import { getAndVerifyHousehold } from '@/lib/api/household-auth';
import { normalizeCalendarBillDisplayMode } from '@/lib/calendar/bill-display-mode';
import { toLocalDateString } from '@/lib/utils/local-date';
import { getDayCalendarDetails } from '@/lib/calendar/data-service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/calendar/day
 * Get detailed transaction, bill, autopay, and payoff information for a specific day
 * Query params: date (ISO string)
 */
export async function GET(request: Request) {
  try {
    const { userId } = await requireAuth();
    const { householdId } = await getAndVerifyHousehold(request, userId);

    const { searchParams } = new URL(request.url);
    const dateStr = searchParams.get('date');
    const billDisplayMode = normalizeCalendarBillDisplayMode(
      searchParams.get('billDisplayMode')
    );

    if (!dateStr) {
      return Response.json(
        { error: 'date is required' },
        { status: 400 }
      );
    }

    // The client sends a date-only key ('YYYY-MM-DD'); use it verbatim. The old
    // code took the client's UTC instant (date.toISOString()) and re-formatted
    // it in the SERVER's timezone, so the modal could show the wrong day's data
    // whenever client and server offsets differed (bug-hunt finding T1). Fall
    // back to server-local formatting only for a legacy full-ISO value.
    const dateKey = /^\d{4}-\d{2}-\d{2}$/.test(dateStr)
      ? dateStr
      : toLocalDateString(new Date(dateStr));
    const {
      transactions,
      bills,
      goals,
      debts,
      autopayEvents,
      payoffDates,
      billMilestones,
      summary,
    } = await getDayCalendarDetails({
      userId,
      householdId,
      dateKey,
      billDisplayMode,
    });

    return Response.json({
      date: dateKey,
      transactions,
      bills,
      goals,
      debts,
      autopayEvents,
      payoffDates,
      billMilestones,
      summary,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error fetching calendar day data:', error);
    return Response.json(
      { error: 'Failed to fetch day details' },
      { status: 500 }
    );
  }
}
