/**
 * Income Alerts Cron Job Endpoint
 * 
 * Checks for late income and sends notifications to users.
 * Should be called daily at 9:00 AM UTC (same time as bill reminders).
 * 
 * POST - Process income alerts (for cron jobs)
 * GET - Preview late income (for debugging)
 */

import { 
  checkAndCreateIncomeAlerts, 
  checkAndCreateIncomeReminders,
} from '@/lib/notifications/income-alerts';

export const dynamic = 'force-dynamic';

// Cron secret for production security (optional)
const CRON_SECRET = process.env.CRON_SECRET;

/**
 * POST - Check for late income and create notifications
 * 
 * In production, verify the cron secret to prevent unauthorized access.
 * Called by: External cron service (e.g., Vercel Cron, GitHub Actions, etc.)
 * Schedule: Daily at 9:00 AM UTC
 */
export async function POST(request: Request) {
  try {
    // Verify cron secret in production
    if (CRON_SECRET) {
      const authHeader = request.headers.get('authorization');
      const providedSecret = authHeader?.replace('Bearer ', '');
      
      if (providedSecret !== CRON_SECRET) {
        return Response.json(
          { error: 'Unauthorized - Invalid cron secret' },
          { status: 401 }
        );
      }
    }

    console.log(`[Income Alerts Cron] Starting income alerts check at ${new Date().toISOString()}`);

    // Check for late income
    const lateIncomeResult = await checkAndCreateIncomeAlerts();
    
    // Check for upcoming income reminders
    const remindersResult = await checkAndCreateIncomeReminders();

    const summary = `Late income alerts: ${lateIncomeResult.notificationsCreated} created from ${lateIncomeResult.checkedInstances} checked. Income reminders: ${remindersResult.notificationsCreated} created from ${remindersResult.checkedInstances} checked.`;

    console.log(`[Income Alerts Cron] Completed: ${summary}`);

    return Response.json({
      success: true,
      message: 'Income alerts processing completed',
      summary,
      details: {
        lateIncome: lateIncomeResult,
        reminders: remindersResult,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Income Alerts Cron] Error:', error);
    return Response.json(
      { 
        error: 'Failed to process income alerts', 
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * GET - Preview what income alerts would be created
 * 
 * For debugging purposes - shows late income without creating notifications.
 * Note: This endpoint requires authentication in production.
 */
export async function GET() {
  try {
    // Note: In a real implementation, you'd get the user from auth
    // For now, this just returns the structure
    
    return Response.json({
      message: 'Income alerts preview endpoint',
      description: 'POST to this endpoint to process income alerts',
      nextScheduledRun: 'Daily at 9:00 AM UTC',
      checksPerformed: [
        'Late income notifications (income expected but not received)',
        'Upcoming income reminders (expected today, tomorrow, or in 3 days)',
      ],
    });
  } catch (error) {
    console.error('[Income Alerts Cron] Preview error:', error);
    return Response.json(
      { error: 'Failed to preview income alerts' },
      { status: 500 }
    );
  }
}

