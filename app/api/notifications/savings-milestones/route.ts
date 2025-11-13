import { requireAuth, getAuthUser } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { savingsGoals } from '@/lib/db/schema';
import { checkAndCreateSavingsMilestoneNotifications } from '@/lib/notifications/savings-milestones';

export async function POST(request: Request) {
  // For cron jobs, we might not have auth context
  // In that case, check for a cron secret header
  const user = await getAuthUser();
  const userId = user?.userId;

  const authHeader = request.headers.get('Authorization');
  const isCronJob = authHeader === `Bearer ${process.env.CRON_SECRET}`;

  if (!userId && !isCronJob) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  try {
    if (userId) {
      // Single user request
      await checkAndCreateSavingsMilestoneNotifications(userId);
      return new Response(
        JSON.stringify({ success: true, message: 'Milestone notifications checked' }),
        { status: 200 }
      );
    } else if (isCronJob) {
      // Check all users' milestones - get unique users who have savings goals
      const usersWithGoals = await db
        .selectDistinct({ userId: savingsGoals.userId })
        .from(savingsGoals);
      let processedCount = 0;
      let errorCount = 0;

      for (const user of usersWithGoals) {
        try {
          await checkAndCreateSavingsMilestoneNotifications(user.userId);
          processedCount++;
        } catch (error) {
          console.error(`Error processing user ${user.userId}:`, error);
          errorCount++;
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: `Processed ${processedCount} users, ${errorCount} errors`,
          processed: processedCount,
          errors: errorCount,
        }),
        { status: 200 }
      );
    }
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }
    console.error('Error checking savings milestones:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to check savings milestones' }),
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    const { userId } = await requireAuth();
    // Get stats for current user
    const { getSavingsMilestoneStats } = await import(
      '@/lib/notifications/savings-milestones'
    );
    const stats = await getSavingsMilestoneStats(userId);
    return new Response(JSON.stringify(stats), { status: 200 });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }
    console.error('Error getting milestone stats:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to get milestone stats' }),
      { status: 500 }
    );
  }
}
