import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { checkAndCreateSavingsMilestoneNotifications } from '@/lib/notifications/savings-milestones';

export async function POST(request: Request) {
  // For cron jobs, we might not have auth context
  // In that case, check for a cron secret header
  const { userId } = await auth();

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
      // Check all users' milestones
      const allUsers = await db.select().from(users);
      let processedCount = 0;
      let errorCount = 0;

      for (const user of allUsers) {
        try {
          await checkAndCreateSavingsMilestoneNotifications(user.id);
          processedCount++;
        } catch (error) {
          console.error(`Error processing user ${user.id}:`, error);
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
    console.error('Error checking savings milestones:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to check savings milestones' }),
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  try {
    // Get stats for current user
    const { getSavingsMilestoneStats } = await import(
      '@/lib/notifications/savings-milestones'
    );
    const stats = await getSavingsMilestoneStats(userId);
    return new Response(JSON.stringify(stats), { status: 200 });
  } catch (error) {
    console.error('Error getting milestone stats:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to get milestone stats' }),
      { status: 500 }
    );
  }
}
