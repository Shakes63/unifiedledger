import { requireAuth } from '@/lib/auth-helpers';
import { getAndVerifyHousehold } from '@/lib/api/household-auth';
import { getMonthRangeForYearMonth } from '@/lib/utils/local-date';
import { getUnifiedDebtBudget } from '@/lib/debts/debt-budget-service';

export async function GET(request: Request): Promise<Response> {
  try {
    const { userId } = await requireAuth();
    const { householdId } = await getAndVerifyHousehold(request, userId);

    // Get month parameter from query string (default to current month)
    const url = new URL(request.url);
    const monthParam = url.searchParams.get('month');

    let year: number;
    let month: number;

    if (monthParam) {
      const [yearStr, monthStr] = monthParam.split('-');
      year = parseInt(yearStr);
      month = parseInt(monthStr);
    } else {
      const now = new Date();
      year = now.getFullYear();
      month = now.getMonth() + 1;
    }

    // Calculate month start and end dates
    const { startDate: monthStart, endDate: monthEnd } = getMonthRangeForYearMonth(year, month);

    const response = await getUnifiedDebtBudget({
      householdId,
      monthStart,
      monthEnd,
    });

    return Response.json(response);
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes('Household ID')) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    console.error('Error fetching unified debt budget:', error);
    return Response.json(
      { error: 'Failed to fetch unified debt budget' },
      { status: 500 }
    );
  }
}
