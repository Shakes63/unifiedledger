import { db } from '@/lib/db';
import { households } from '@/lib/db/schema';
import { processMonthlyRollover } from '@/lib/budgets/rollover-utils';

export const dynamic = 'force-dynamic';

/**
 * Budget Rollover Cron Job
 * 
 * This endpoint processes monthly budget rollovers for all households.
 * It should be called on the 1st of each month to calculate rollovers
 * for the previous month.
 * 
 * Example cron schedule: 0 0 1 * * (midnight on the 1st of every month)
 * 
 * Security: This endpoint should be protected by a CRON_SECRET in production.
 */
export async function GET(request: Request) {
  try {
    // Verify cron secret in production
    const cronSecret = process.env.CRON_SECRET;
    const authHeader = request.headers.get('authorization');

    if (process.env.NODE_ENV === 'production') {
      if (!cronSecret) {
        console.error('CRON_SECRET not configured');
        return Response.json(
          { error: 'Server configuration error' },
          { status: 500 }
        );
      }

      if (authHeader !== `Bearer ${cronSecret}`) {
        return Response.json(
          { error: 'Unauthorized' },
          { status: 401 }
        );
      }
    }

    // Calculate the previous month (the month we're processing rollover for)
    const now = new Date();
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const monthToProcess = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, '0')}`;

    console.log(`[Budget Rollover] Starting rollover processing for month: ${monthToProcess}`);

    // Get all households
    const allHouseholds = await db.select().from(households);

    const results: Array<{
      householdId: string;
      householdName: string;
      processed: number;
      skipped: number;
      errors: string[];
    }> = [];

    let totalProcessed = 0;
    let totalSkipped = 0;
    let totalErrors = 0;

    // Process each household
    for (const household of allHouseholds) {
      try {
        const result = await processMonthlyRollover(household.id, monthToProcess);

        results.push({
          householdId: household.id,
          householdName: household.name,
          processed: result.processed,
          skipped: result.skipped,
          errors: result.errors,
        });

        totalProcessed += result.processed;
        totalSkipped += result.skipped;
        totalErrors += result.errors.length;

        if (result.processed > 0) {
          console.log(
            `[Budget Rollover] Household "${household.name}": ${result.processed} categories processed, ${result.skipped} skipped`
          );
        }

        if (result.errors.length > 0) {
          console.error(
            `[Budget Rollover] Household "${household.name}" errors:`,
            result.errors
          );
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        console.error(
          `[Budget Rollover] Failed to process household "${household.name}":`,
          errorMessage
        );
        
        results.push({
          householdId: household.id,
          householdName: household.name,
          processed: 0,
          skipped: 0,
          errors: [errorMessage],
        });

        totalErrors++;
      }
    }

    console.log(
      `[Budget Rollover] Complete. Total: ${totalProcessed} processed, ${totalSkipped} skipped, ${totalErrors} errors`
    );

    return Response.json({
      success: true,
      month: monthToProcess,
      summary: {
        householdsProcessed: allHouseholds.length,
        totalCategoriesProcessed: totalProcessed,
        totalSkipped,
        totalErrors,
      },
      details: results,
    });
  } catch (error) {
    console.error('[Budget Rollover] Fatal error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST endpoint for manual/ad-hoc rollover processing
 * 
 * Body: { month?: string, householdId?: string }
 * - month: YYYY-MM format (defaults to previous month)
 * - householdId: specific household to process (defaults to all)
 */
export async function POST(request: Request) {
  try {
    // Verify cron secret in production
    const cronSecret = process.env.CRON_SECRET;
    const authHeader = request.headers.get('authorization');

    if (process.env.NODE_ENV === 'production') {
      if (!cronSecret) {
        return Response.json(
          { error: 'Server configuration error' },
          { status: 500 }
        );
      }

      if (authHeader !== `Bearer ${cronSecret}`) {
        return Response.json(
          { error: 'Unauthorized' },
          { status: 401 }
        );
      }
    }

    const body = await request.json().catch(() => ({}));
    
    // Get month to process
    let monthToProcess = body.month as string | undefined;
    if (!monthToProcess) {
      const now = new Date();
      const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      monthToProcess = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, '0')}`;
    }

    // Validate month format
    if (!/^\d{4}-\d{2}$/.test(monthToProcess)) {
      return Response.json(
        { error: 'Invalid month format. Use YYYY-MM' },
        { status: 400 }
      );
    }

    const householdId = body.householdId as string | undefined;

    if (householdId) {
      // Process single household
      const result = await processMonthlyRollover(householdId, monthToProcess);
      
      return Response.json({
        success: true,
        month: monthToProcess,
        householdId,
        ...result,
      });
    } else {
      // Process all households
      const allHouseholds = await db.select().from(households);
      
      const results: Array<{
        householdId: string;
        householdName: string;
        processed: number;
        skipped: number;
        errors: string[];
      }> = [];

      for (const household of allHouseholds) {
        const result = await processMonthlyRollover(household.id, monthToProcess);
        results.push({
          householdId: household.id,
          householdName: household.name,
          ...result,
        });
      }

      return Response.json({
        success: true,
        month: monthToProcess,
        results,
      });
    }
  } catch (error) {
    console.error('[Budget Rollover] Manual trigger error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

