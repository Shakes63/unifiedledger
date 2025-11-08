import { checkAndCreateBudgetWarnings } from '@/lib/notifications/budget-warnings';

export const dynamic = 'force-dynamic';

/**
 * POST /api/notifications/budget-warnings
 *
 * Check all budgets and create warning notifications if spending exceeds thresholds
 *
 * This endpoint is designed to be called by cron jobs to periodically check budget spending
 * and notify users when they approach or exceed their budget limits.
 *
 * Query Parameters:
 * - (none)
 *
 * Response:
 * {
 *   success: boolean,
 *   notificationsCreated: number,
 *   checkedCategories: number
 * }
 *
 * Cron Setup Examples:
 * - Vercel Cron: { schedule: "0 9 * * *" } // Daily at 9 AM UTC
 * - cron-job.org: 0 9 * * * (same format)
 * - Call from external service: POST https://yourdomain.com/api/notifications/budget-warnings
 */
export async function POST(request: Request) {
  try {
    const result = await checkAndCreateBudgetWarnings();

    return Response.json(result, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('Budget warnings endpoint error:', error);
    return Response.json(
      {
        error: 'Failed to check budget warnings',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/notifications/budget-warnings
 *
 * Returns information about the budget warnings check endpoint
 * Useful for monitoring and debugging
 */
export async function GET(request: Request) {
  return Response.json({
    endpoint: '/api/notifications/budget-warnings',
    description: 'Check all budgets and create warning notifications',
    method: 'POST',
    frequency: 'Recommended: Daily (e.g., 9 AM UTC)',
    documentation: 'See POST response for details'
  });
}
