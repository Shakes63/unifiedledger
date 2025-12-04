/**
 * Autopay Cron Job Endpoint
 * 
 * Processes all autopay-enabled bills that are due for processing.
 * Should be called daily at 6:00 AM UTC (before bill reminders at 9:00 AM).
 * 
 * POST - Process autopay (for cron jobs)
 * GET - Preview what would be processed (for debugging)
 */

import { processAllAutopayBills, getAutopayDueToday } from '@/lib/bills/autopay-processor';
import { getAutopayProcessingSummary } from '@/lib/notifications/autopay-notifications';

export const dynamic = 'force-dynamic';

// Cron secret for production security (optional)
const CRON_SECRET = process.env.CRON_SECRET;

/**
 * POST - Process all autopay bills due today
 * 
 * In production, verify the cron secret to prevent unauthorized access.
 * Called by: External cron service (e.g., Vercel Cron, GitHub Actions, etc.)
 * Schedule: Daily at 6:00 AM UTC
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

    console.log(`[Autopay Cron] Starting autopay processing at ${new Date().toISOString()}`);

    const result = await processAllAutopayBills();
    const summary = getAutopayProcessingSummary(result);

    console.log(`[Autopay Cron] Completed: ${summary}`);

    return Response.json({
      success: true,
      message: 'Autopay processing completed',
      summary,
      timestamp: new Date().toISOString(),
      stats: {
        processed: result.processed,
        successful: result.successful,
        failed: result.failed,
        skipped: result.skipped,
        totalAmount: result.totalAmount,
      },
      errors: result.errors.length > 0 ? result.errors : undefined,
      successes: result.successes.length > 0 ? result.successes : undefined,
    });
  } catch (error) {
    console.error('[Autopay Cron] Error:', error);
    return Response.json(
      { 
        success: false,
        error: 'Failed to process autopay bills',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

/**
 * GET - Preview autopay bills due today without processing
 * 
 * Useful for debugging and monitoring.
 * Does NOT require cron secret - shows only non-sensitive metadata.
 */
export async function GET(_request: Request) {
  try {
    const preview = await getAutopayDueToday();

    return Response.json({
      success: true,
      message: preview.count > 0 
        ? `${preview.count} autopay bill${preview.count !== 1 ? 's' : ''} due today`
        : 'No autopay bills due today',
      timestamp: new Date().toISOString(),
      count: preview.count,
      bills: preview.bills.map(b => ({
        billId: b.billId,
        billName: b.billName,
        dueDate: b.dueDate,
        expectedAmount: b.expectedAmount,
        autopayAmountType: b.autopayAmountType,
      })),
    });
  } catch (error) {
    console.error('[Autopay Preview] Error:', error);
    return Response.json(
      { 
        success: false,
        error: 'Failed to get autopay preview',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

