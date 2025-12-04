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
import { debts, households } from '@/lib/db/schema';
import { 
  checkAndCreateDebtPayoffMilestoneNotifications,
  checkAndCreateUnifiedDebtMilestoneNotifications,
  getDebtPayoffMilestoneStats,
  getUnifiedDebtMilestoneStats,
} from '@/lib/notifications/debt-milestones';
import { getHouseholdIdFromRequest, requireHouseholdAuth } from '@/lib/api/household-auth';

export const dynamic = 'force-dynamic';

/**
 * POST /api/notifications/debt-milestones
 * Check debt milestones - supports both legacy (user-based) and unified (household-based)
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
      
      if (householdId) {
        // Use unified architecture
        await requireHouseholdAuth(userId, householdId);
        const results = await checkAndCreateUnifiedDebtMilestoneNotifications(householdId);
        return Response.json({
          success: true,
          message: `Checked unified debt milestones, created ${results.length} notification(s)`,
          milestones: results,
          mode: 'unified',
        });
      } else {
        // Fallback to legacy mode
        const results = await checkAndCreateDebtPayoffMilestoneNotifications(userId);
        return Response.json({
          success: true,
          message: 'Debt milestone notifications checked (legacy mode)',
          milestones: results,
          mode: 'legacy',
        });
      }
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

      // Also check legacy debts table for backward compatibility
      const usersWithDebts = await db
        .selectDistinct({ userId: debts.userId })
        .from(debts);
      
      let legacyProcessed = 0;
      for (const userRecord of usersWithDebts) {
        try {
          const results = await checkAndCreateDebtPayoffMilestoneNotifications(userRecord.userId);
          if (results.length > 0) {
            legacyProcessed += results.length;
          }
        } catch (error) {
          console.error(`Error processing legacy user ${userRecord.userId}:`, error);
        }
      }

      return Response.json({
        success: true,
        message: `Processed ${allHouseholds.length} households, created ${totalMilestones} unified milestone(s) and ${legacyProcessed} legacy milestone(s)`,
        unified: {
          householdsProcessed: allHouseholds.length,
          householdsWithMilestones: householdResults.length,
          totalMilestones,
          details: householdResults,
        },
        legacy: {
          usersProcessed: usersWithDebts.length,
          milestonesCreated: legacyProcessed,
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
 * Get debt milestone stats - supports both legacy and unified modes
 */
export async function GET(request: Request) {
  try {
    const { userId } = await requireAuth();
    
    // Check if household context provided
    const householdId = getHouseholdIdFromRequest(request);
    
    if (householdId) {
      // Unified architecture
      await requireHouseholdAuth(userId, householdId);
      const stats = await getUnifiedDebtMilestoneStats(householdId);
      return Response.json({
        ...stats,
        mode: 'unified',
      });
    } else {
      // Legacy mode
      const stats = await getDebtPayoffMilestoneStats(userId);
      return Response.json({
        ...stats,
        mode: 'legacy',
      });
    }
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
