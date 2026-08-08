/**
 * Autopay Cron Job Endpoint
 * 
 * Processes all autopay-enabled bills that are due for processing.
 * Should be called daily at 6:00 AM UTC (before bill reminders at 9:00 AM).
 * 
 * POST - Process autopay (for cron jobs)
 * GET - Preview what would be processed (for debugging)
 */

import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { autopayRules } from '@/lib/db/schema';
import { getScheduledAutopayPreview, runAutopay } from '@/lib/bills/service';
import { getAutopayProcessingSummary } from '@/lib/notifications/autopay-notifications';
import { requireCronAuth } from '@/lib/api/cron-auth';

export const dynamic = 'force-dynamic';

/**
 * POST - Process all autopay bills due today
 *
 * Requires a valid CRON_SECRET (fail-closed). Called by an external cron service.
 * Schedule: Daily at 6:00 AM UTC.
 */
export async function POST(request: Request) {
  // Fail-closed cron auth (C-SEC-1). Only a caller holding CRON_SECRET may move money.
  const unauthorized = requireCronAuth(request);
  if (unauthorized) {
    return unauthorized;
  }

  try {
    console.log(`[Autopay Cron] Starting autopay processing at ${new Date().toISOString()}`);

    // The scheduler authenticates with only the CRON_SECRET and serves EVERY
    // household — the old version hard-required x-household-id/x-user-id
    // headers the scheduler never sends, so scheduled autopay 400'd on every
    // trigger and never ran (bug-hunt finding A1). An optional x-household-id
    // still scopes a manual invocation to one household.
    const scopedHouseholdId = request.headers.get('x-household-id');

    const enabledRuleHouseholds = await db
      .selectDistinct({ householdId: autopayRules.householdId })
      .from(autopayRules)
      .where(eq(autopayRules.isEnabled, true));

    const householdIds = enabledRuleHouseholds
      .map((row) => row.householdId)
      .filter((id) => !scopedHouseholdId || id === scopedHouseholdId);

    const stats = {
      households: householdIds.length,
      processed: 0,
      successful: 0,
      failed: 0,
      skipped: 0,
      totalAmount: 0,
    };
    const errors: unknown[] = [];

    for (const householdId of householdIds) {
      try {
        const runResult = await runAutopay({
          userId: null,
          householdId,
          runType: 'scheduled',
          dryRun: false,
        });
        stats.processed += runResult.processedCount;
        stats.successful += runResult.successCount;
        stats.failed += runResult.failedCount;
        stats.skipped += runResult.skippedCount;
        stats.totalAmount += runResult.totalAmountCents / 100;
        errors.push(...runResult.errors);
      } catch (error) {
        stats.failed += 1;
        errors.push({
          householdId,
          message: error instanceof Error ? error.message : 'Autopay run failed',
          code: 'AUTOPAY_RUN_FAILED',
        });
      }
    }

    const summary = getAutopayProcessingSummary(stats);

    console.log(`[Autopay Cron] Completed across ${stats.households} household(s): ${summary}`);

    return Response.json({
      success: true,
      message: 'Autopay processing completed',
      summary,
      timestamp: new Date().toISOString(),
      stats,
      errors: errors.length > 0 ? errors : undefined,
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
 * Requires a valid CRON_SECRET (C-SEC-2): the preview enumerates bills across
 * all households, so it must not be readable by unauthenticated callers.
 */
export async function GET(request: Request) {
  const unauthorized = requireCronAuth(request);
  if (unauthorized) {
    return unauthorized;
  }

  try {
    // Read-only preview on the SAME selection policy the POST uses — the old
    // preview lived in a dead parallel engine and could disagree with the run
    // that actually moved money.
    const preview = await getScheduledAutopayPreview();
    const actionable = preview.entries.filter((entry) => entry.skipReason === undefined);

    return Response.json({
      success: true,
      message:
        actionable.length > 0
          ? `${actionable.length} autopay bill${actionable.length !== 1 ? 's' : ''} due for processing`
          : 'No autopay bills due today',
      timestamp: new Date().toISOString(),
      count: actionable.length,
      bills: preview.entries.map((entry) => ({
        householdId: entry.householdId,
        billId: entry.billId,
        billName: entry.billName,
        occurrenceId: entry.occurrenceId,
        dueDate: entry.dueDate,
        expectedAmount:
          entry.expectedAmountCents !== undefined ? entry.expectedAmountCents / 100 : null,
        autopayAmountType: entry.autopayAmountType,
        skipReason: entry.skipReason,
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

