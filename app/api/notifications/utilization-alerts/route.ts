/**
 * Utilization Alerts API
 * 
 * Checks credit card/line of credit utilization for all households
 * and creates notifications when thresholds are exceeded.
 * 
 * Called by cron job or manually triggered.
 * Part of Phase 10: Notifications for the Unified Architecture.
 */

import { db } from '@/lib/db';
import { households, userHouseholdPreferences } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { checkAndCreateUtilizationAlerts, checkHouseholdUtilizationAlerts } from '@/lib/notifications/high-utilization-alerts';
import { requireAuth } from '@/lib/auth-helpers';
import { getHouseholdIdFromRequest, requireHouseholdAuth } from '@/lib/api/household-auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/notifications/utilization-alerts
 * Check utilization alerts for a specific household (user-triggered)
 * Requires household context in headers
 */
export async function GET(request: Request) {
  try {
    const { userId } = await requireAuth();

    // Get and validate household
    const householdId = getHouseholdIdFromRequest(request);
    await requireHouseholdAuth(userId, householdId);

    if (!householdId) {
      return Response.json(
        { error: 'Household ID is required' },
        { status: 400 }
      );
    }

    // Check utilization for the current user in this household
    const results = await checkAndCreateUtilizationAlerts(userId, householdId);

    return Response.json({
      success: true,
      alerts: results,
      count: results.length,
      message: results.length > 0 
        ? `Created ${results.length} utilization alert(s)`
        : 'No new utilization alerts',
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes('Household')) {
      return Response.json({ error: error.message }, { status: 403 });
    }
    console.error('Utilization alerts check error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/notifications/utilization-alerts
 * Run utilization alert check for all households (cron job)
 * Requires CRON_SECRET for authentication
 */
export async function POST(request: Request) {
  try {
    // Verify cron secret for automated calls
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    // Allow either CRON_SECRET or authenticated admin user
    let isAuthorized = false;
    let adminUserId: string | null = null;

    if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
      isAuthorized = true;
    } else {
      // Try to authenticate as user (for manual triggers)
      try {
        const auth = await requireAuth();
        adminUserId = auth.userId;
        // In production, you might want to check for admin role here
        isAuthorized = true;
      } catch {
        // Not authenticated
      }
    }

    if (!isAuthorized) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all active households
    const allHouseholds = await db
      .select({ id: households.id, name: households.name })
      .from(households);

    const results: Array<{
      householdId: string;
      householdName: string;
      alertCount: number;
    }> = [];

    let totalAlerts = 0;

    // Process each household
    for (const household of allHouseholds) {
      const alerts = await checkHouseholdUtilizationAlerts(household.id);
      
      if (alerts.length > 0) {
        results.push({
          householdId: household.id,
          householdName: household.name,
          alertCount: alerts.length,
        });
        totalAlerts += alerts.length;
      }
    }

    return Response.json({
      success: true,
      householdsProcessed: allHouseholds.length,
      householdsWithAlerts: results.length,
      totalAlerts,
      details: results,
      message: totalAlerts > 0 
        ? `Created ${totalAlerts} utilization alert(s) across ${results.length} household(s)`
        : 'No new utilization alerts',
      triggeredBy: adminUserId ? 'manual' : 'cron',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Utilization alerts cron error:', error);
    return Response.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

