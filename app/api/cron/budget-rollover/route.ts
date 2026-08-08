import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { households } from '@/lib/db/schema';
import { processMonthlyRollover } from '@/lib/budgets/rollover-utils';
import { requireCronAuth } from '@/lib/api/cron-auth';

export const dynamic = 'force-dynamic';

/**
 * Budget Rollover Cron Job
 *
 * Processes monthly budget rollovers for every household. Runs daily; the
 * per-(category, month) history row (UNIQUE since migration 0020) makes
 * repeat runs no-ops, so a daily cadence simply guarantees the month gets
 * processed shortly after it closes.
 *
 * Security: fail-closed CRON_SECRET via the shared helper — the same guard
 * every other /api/cron/* route uses. This route previously gated its check on
 * NODE_ENV === 'production', leaving it fully unauthenticated on any other
 * build (bug-hunt finding SEC1).
 */

/** How many closed months back a run will catch up on (bug-hunt finding R2). */
const CATCH_UP_MONTHS = 3;

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * The closed months this run should process, oldest first. The route used to
 * process ONLY `now − 1 month`, so a month with no successful run (container
 * down across a boundary) was never processed by any future run — silently,
 * forever. Processing a short trailing window is safe because an
 * already-recorded month is skipped.
 */
function monthsToProcess(now: Date): string[] {
  const months: string[] = [];
  for (let i = CATCH_UP_MONTHS; i >= 1; i--) {
    months.push(monthKey(new Date(now.getFullYear(), now.getMonth() - i, 1)));
  }
  return months;
}

interface HouseholdRunResult {
  householdId: string;
  householdName: string;
  month: string;
  processed: number;
  skipped: number;
  errors: string[];
}

async function runRollover(
  months: string[],
  options: { householdId?: string; force?: boolean } = {}
): Promise<{ results: HouseholdRunResult[]; totals: { processed: number; skipped: number; errors: number } }> {
  const targetHouseholds = options.householdId
    ? await db.select().from(households).where(eq(households.id, options.householdId))
    : await db.select().from(households);

  const results: HouseholdRunResult[] = [];
  const totals = { processed: 0, skipped: 0, errors: 0 };

  for (const household of targetHouseholds) {
    for (const month of months) {
      try {
        const result = await processMonthlyRollover(household.id, month, {
          force: options.force,
        });

        // Only report months that actually did something, so catch-up months
        // don't drown the log in no-ops.
        if (result.processed > 0 || result.errors.length > 0) {
          results.push({
            householdId: household.id,
            householdName: household.name,
            month,
            processed: result.processed,
            skipped: result.skipped,
            errors: result.errors,
          });
        }

        totals.processed += result.processed;
        totals.skipped += result.skipped;
        totals.errors += result.errors.length;

        if (result.processed > 0) {
          console.log(
            `[Budget Rollover] "${household.name}" ${month}: ${result.processed} processed, ${result.skipped} skipped`
          );
        }
        if (result.errors.length > 0) {
          console.error(`[Budget Rollover] "${household.name}" ${month} errors:`, result.errors);
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        console.error(`[Budget Rollover] Failed "${household.name}" ${month}:`, errorMessage);
        results.push({
          householdId: household.id,
          householdName: household.name,
          month,
          processed: 0,
          skipped: 0,
          errors: [errorMessage],
        });
        totals.errors += 1;
      }
    }
  }

  return { results, totals };
}

export async function GET(request: Request) {
  const unauthorized = requireCronAuth(request);
  if (unauthorized) {
    return unauthorized;
  }

  try {
    const months = monthsToProcess(new Date());
    console.log(`[Budget Rollover] Starting; months in scope: ${months.join(', ')}`);

    const { results, totals } = await runRollover(months);

    console.log(
      `[Budget Rollover] Complete. ${totals.processed} processed, ${totals.skipped} skipped, ${totals.errors} errors`
    );

    return Response.json({
      success: true,
      months,
      summary: {
        totalCategoriesProcessed: totals.processed,
        totalSkipped: totals.skipped,
        totalErrors: totals.errors,
      },
      details: results,
    });
  } catch (error) {
    console.error('[Budget Rollover] Fatal error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST — manual/ad-hoc rollover.
 *
 * Body: { month?: string, householdId?: string, force?: boolean }
 * - month: YYYY-MM (defaults to the same catch-up window as the scheduled run)
 * - householdId: restrict to one household (defaults to all)
 * - force: recompute a month that already has history rows, e.g. after
 *   backdating or importing transactions for a closed month (finding R3)
 *
 * Requires CRON_SECRET — the caller is the server operator, which is what
 * makes an operator-supplied householdId acceptable here.
 */
export async function POST(request: Request) {
  const unauthorized = requireCronAuth(request);
  if (unauthorized) {
    return unauthorized;
  }

  try {
    const body = await request.json().catch(() => ({}));

    const requestedMonth = body.month as string | undefined;
    if (requestedMonth && !/^\d{4}-\d{2}$/.test(requestedMonth)) {
      return Response.json({ error: 'Invalid month format. Use YYYY-MM' }, { status: 400 });
    }

    const months = requestedMonth ? [requestedMonth] : monthsToProcess(new Date());
    const householdId = body.householdId as string | undefined;
    const force = body.force === true;

    const { results, totals } = await runRollover(months, { householdId, force });

    return Response.json({
      success: true,
      months,
      force,
      householdId,
      summary: {
        totalCategoriesProcessed: totals.processed,
        totalSkipped: totals.skipped,
        totalErrors: totals.errors,
      },
      results,
    });
  } catch (error) {
    console.error('[Budget Rollover] Manual trigger error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
