import { requireAuth } from '@/lib/auth-helpers';
import { getAndVerifyHousehold } from '@/lib/api/household-auth';
import { format } from 'date-fns';
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

    if (!dateStr) {
      return Response.json(
        { error: 'date is required' },
        { status: 400 }
      );
    }

    const date = new Date(dateStr);
    const dateKey = format(date, 'yyyy-MM-dd');
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
