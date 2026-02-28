/**
 * Debt Milestones API
 * 
 * Checks debt payoff milestones for all households
 * using the unified architecture (credit accounts + debt bills).
 * 
 * Part of Phase 10: Notifications for the Unified Architecture.
 */

import { requireAuth, getAuthUser } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { households } from '@/lib/db/schema';
import { 
  checkAndCreateUnifiedDebtMilestoneNotifications,
  getUnifiedDebtMilestoneStats,
} from '@/lib/notifications/debt-milestones';
import { getHouseholdIdFromRequest, requireHouseholdAuth } from '@/lib/api/household-auth';

export const dynamic = 'force-dynamic';

/**
 * POST /api/notifications/debt-milestones
 * Check debt milestones for unified household debt sources.
 */
export async function POST(request: Request) {
  // For cron jobs, we might not have auth context
  // In that case, check for a cron secret header
  const user = await getAuthUser();
  const userId = user?.userId;

  const authHeader = request.headers.get('Authorization');
  const isCronJob = authHeader === `Bearer ${process.env.CRON_SECRET}`;

  if (!userId && !isCronJob) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    if (userId) {
      // Single user request - check their household
      const householdId = getHouseholdIdFromRequest(request);
      
      if (!householdId) {
        return Response.json(
          { error: 'Household ID is required' },
          { status: 400 }
        );
      }

      await requireHouseholdAuth(userId, householdId);
      const results = await checkAndCreateUnifiedDebtMilestoneNotifications(householdId);
      return Response.json({
        success: true,
        message: `Checked debt milestones, created ${results.length} notification(s)`,
        milestones: results,
        mode: 'unified',
      });
    } else if (isCronJob) {
      // Cron job - check all households with unified architecture
      const allHouseholds = await db
        .select({ id: households.id, name: households.name })
        .from(households);

      let totalMilestones = 0;
      const householdResults: Array<{
        householdId: string;
        householdName: string;
        milestoneCount: number;
      }> = [];

      for (const household of allHouseholds) {
        try {
          const results = await checkAndCreateUnifiedDebtMilestoneNotifications(household.id);
          if (results.length > 0) {
            householdResults.push({
              householdId: household.id,
              householdName: household.name,
              milestoneCount: results.length,
            });
            totalMilestones += results.length;
          }
        } catch (error) {
          console.error(`Error processing household ${household.id}:`, error);
        }
      }

      return Response.json({
        success: true,
        message: `Processed ${allHouseholds.length} households, created ${totalMilestones} milestone(s)`,
        unified: {
          householdsProcessed: allHouseholds.length,
          householdsWithMilestones: householdResults.length,
          totalMilestones,
          details: householdResults,
        },
        timestamp: new Date().toISOString(),
      });
    }

    return Response.json({ error: 'Invalid request' }, { status: 400 });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes('Household')) {
      return Response.json({ error: error.message }, { status: 403 });
    }
    console.error('Error checking debt payoff milestones:', error);
    return Response.json(
      { error: 'Failed to check debt payoff milestones' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/notifications/debt-milestones
 * Get debt milestone stats in unified household mode.
 */
export async function GET(request: Request) {
  try {
    const { userId } = await requireAuth();
    
    // Check if household context provided
    const householdId = getHouseholdIdFromRequest(request);
    
    if (!householdId) {
      return Response.json(
        { error: 'Household ID is required' },
        { status: 400 }
      );
    }

    await requireHouseholdAuth(userId, householdId);
    const stats = await getUnifiedDebtMilestoneStats(householdId);
    return Response.json({
      ...stats,
      mode: 'unified',
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes('Household')) {
      return Response.json({ error: error.message }, { status: 403 });
    }
    console.error('Error getting debt milestone stats:', error);
    return Response.json(
      { error: 'Failed to get debt milestone stats' },
      { status: 500 }
    );
  }
}
