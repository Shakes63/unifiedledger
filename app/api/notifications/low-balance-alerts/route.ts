import { checkAndCreateLowBalanceAlerts } from '@/lib/notifications/low-balance-alerts';

export const dynamic = 'force-dynamic';

/**
 * POST /api/notifications/low-balance-alerts
 *
 * Check all accounts and create low balance notifications if balance falls below threshold
 *
 * This endpoint is designed to be called by cron jobs to periodically check account balances
 * and notify users when their account balance falls below their configured threshold.
 *
 * Query Parameters:
 * - (none)
 *
 * Response:
 * {
 *   success: boolean,
 *   notificationsCreated: number,
 *   checkedAccounts: number
 * }
 *
 * Cron Setup Examples:
 * - Vercel Cron: { schedule: "0 8 * * *" } // Daily at 8 AM UTC
 * - cron-job.org: 0 8 * * * (same format)
 * - Call from external service: POST https://yourdomain.com/api/notifications/low-balance-alerts
 *
 * Note: This runs independently from bill reminders and budget warnings.
 * You may want to schedule these at slightly different times to distribute load.
 */
export async function POST(request: Request) {
  try {
    const result = await checkAndCreateLowBalanceAlerts();

    return Response.json(result, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('Low balance alerts endpoint error:', error);
    return Response.json(
      {
        error: 'Failed to check low balance alerts',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/notifications/low-balance-alerts
 *
 * Returns information about the low balance alerts check endpoint
 * Useful for monitoring and debugging
 */
export async function GET(request: Request) {
  return Response.json({
    endpoint: '/api/notifications/low-balance-alerts',
    description: 'Check all accounts and create low balance alerts',
    method: 'POST',
    frequency: 'Recommended: Daily (e.g., 8 AM UTC)',
    documentation: 'See POST response for details'
  });
}
