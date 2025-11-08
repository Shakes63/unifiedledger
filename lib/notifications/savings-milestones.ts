import { db } from '@/lib/db';
import { savingsGoals, savingsMilestones, notifications } from '@/lib/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { nanoid } from 'nanoid';

export async function checkAndCreateSavingsMilestoneNotifications(userId: string) {
  try {
    // Get all active goals for the user
    const goals = await db
      .select()
      .from(savingsGoals)
      .where(and(eq(savingsGoals.userId, userId), eq(savingsGoals.status, 'active')));

    const now = new Date().toISOString();
    const createdNotifications = [];

    for (const goal of goals) {
      // Get all milestones for this goal
      const milestones = await db
        .select()
        .from(savingsMilestones)
        .where(eq(savingsMilestones.goalId, goal.id));

      // Check for newly achieved milestones
      for (const milestone of milestones) {
        // Check if milestone has been achieved but notification not sent yet
        if (
          milestone.achievedAt &&
          !milestone.notificationSentAt &&
          goal.currentAmount >= milestone.milestoneAmount
        ) {
          // Create notification
          const notificationId = nanoid();
          const milestoneText = `${milestone.percentage}% (${goal.currentAmount >= goal.targetAmount ? 'Complete!' : `$${milestone.milestoneAmount.toFixed(2)}`})`;

          await db.insert(notifications).values({
            id: notificationId,
            userId,
            type: 'savings_milestone',
            title: `🎉 Milestone Reached: ${goal.name}`,
            message: `You've reached ${milestoneText} of your ${goal.name} goal!`,
            priority: 'high',
            metadata: {
              goalId: goal.id,
              goalName: goal.name,
              percentage: milestone.percentage,
              amount: milestone.milestoneAmount,
              currentAmount: goal.currentAmount,
              targetAmount: goal.targetAmount,
            },
            isRead: false,
            createdAt: now,
          });

          // Mark notification as sent
          await db
            .update(savingsMilestones)
            .set({ notificationSentAt: now })
            .where(eq(savingsMilestones.id, milestone.id));

          createdNotifications.push({
            goalId: goal.id,
            goalName: goal.name,
            percentage: milestone.percentage,
          });
        }
      }
    }

    return createdNotifications;
  } catch (error) {
    console.error('Error checking savings milestones:', error);
    return [];
  }
}

export async function getSavingsMilestoneStats(userId: string) {
  try {
    const goals = await db
      .select()
      .from(savingsGoals)
      .where(eq(savingsGoals.userId, userId));

    const allMilestones = await db
      .select()
      .from(savingsMilestones)
      .where(eq(savingsMilestones.userId, userId));

    const achievedCount = allMilestones.filter((m) => m.achievedAt).length;
    const totalCount = allMilestones.length;

    // Group by percentage
    const byPercentage = {
      25: { achieved: 0, total: 0 },
      50: { achieved: 0, total: 0 },
      75: { achieved: 0, total: 0 },
      100: { achieved: 0, total: 0 },
    };

    for (const milestone of allMilestones) {
      const pct = milestone.percentage as 25 | 50 | 75 | 100;
      byPercentage[pct].total += 1;
      if (milestone.achievedAt) {
        byPercentage[pct].achieved += 1;
      }
    }

    return {
      totalGoals: goals.length,
      totalMilestones: totalCount,
      achievedMilestones: achievedCount,
      byPercentage,
    };
  } catch (error) {
    console.error('Error getting milestone stats:', error);
    return {
      totalGoals: 0,
      totalMilestones: 0,
      achievedMilestones: 0,
      byPercentage: { 25: { achieved: 0, total: 0 }, 50: { achieved: 0, total: 0 }, 75: { achieved: 0, total: 0 }, 100: { achieved: 0, total: 0 } },
    };
  }
}
