import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { generateMonthlyBudgetReview } from '@/lib/notifications/budget-review';

export const dynamic = 'force-dynamic';

/**
 * POST /api/notifications/budget-review
 * Manually trigger a budget review notification for the authenticated user
 *
 * Query params:
 * - month (optional): YYYY-MM format, defaults to last month
 */
export async function POST(request: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get month parameter from query string or default to last month
    const url = new URL(request.url);
    const monthParam = url.searchParams.get('month');

    let month: string;

    if (monthParam) {
      // Validate month format (YYYY-MM)
      const monthRegex = /^\d{4}-\d{2}$/;
      if (!monthRegex.test(monthParam)) {
        return NextResponse.json(
          { error: 'Invalid month format. Use YYYY-MM (e.g., 2025-05)' },
          { status: 400 }
        );
      }
      month = monthParam;
    } else {
      // Default to last month
      const now = new Date();
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      month = lastMonth.toISOString().slice(0, 7);
    }

    // Validate month is not in the future
    const now = new Date();
    const currentMonth = now.toISOString().slice(0, 7);
    if (month > currentMonth) {
      return NextResponse.json(
        { error: 'Cannot generate budget review for future months' },
        { status: 400 }
      );
    }

    // Generate budget review notification
    const notificationId = await generateMonthlyBudgetReview(userId, month);

    if (!notificationId) {
      return NextResponse.json(
        {
          error: 'Budget review not generated. Check if budgets are set and preference is enabled.',
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      notificationId,
      month,
      message: `Budget review notification created for ${month}`,
    });
  } catch (error) {
    console.error('Error generating budget review:', error);
    return NextResponse.json(
      { error: 'Failed to generate budget review' },
      { status: 500 }
    );
  }
}
