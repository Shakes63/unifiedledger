import { db } from '@/lib/db';
import { debts, debtPayoffMilestones, notifications } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';

export async function checkAndCreateDebtPayoffMilestoneNotifications(userId: string) {
  try {
    // Get all active debts for the user
    const activeDebts = await db
      .select()
      .from(debts)
      .where(and(eq(debts.userId, userId), eq(debts.status, 'active')));

    const now = new Date().toISOString();
    const createdNotifications = [];

    for (const debt of activeDebts) {
      // Get all milestones for this debt
      const milestones = await db
        .select()
        .from(debtPayoffMilestones)
        .where(eq(debtPayoffMilestones.debtId, debt.id));

      // Check for newly achieved milestones
      for (const milestone of milestones) {
        // Check if milestone has been achieved but notification not sent yet
        if (
          milestone.achievedAt &&
          !milestone.notificationSentAt &&
          debt.remainingBalance <= milestone.milestoneBalance
        ) {
          // Create notification
          const notificationId = nanoid();
          const milestoneText = `${milestone.percentage}% paid off`;

          await db.insert(notifications).values({
            id: notificationId,
            userId,
            type: 'debt_milestone',
            title: `🎉 Progress Milestone: ${debt.name}`,
            message: `You've reached ${milestoneText} of your ${debt.creditorName} debt! Keep it up!`,
            priority: 'high',
            entityType: 'debt',
            entityId: debt.id,
            metadata: JSON.stringify({
              debtId: debt.id,
              debtName: debt.name,
              creditorName: debt.creditorName,
              percentage: milestone.percentage,
              milestoneBalance: milestone.milestoneBalance,
              remainingBalance: debt.remainingBalance,
              originalAmount: debt.originalAmount,
            }),
            isRead: false,
            createdAt: now,
          });

          // Mark notification as sent
          await db
            .update(debtPayoffMilestones)
            .set({ notificationSentAt: now })
            .where(eq(debtPayoffMilestones.id, milestone.id));

          createdNotifications.push({
            debtId: debt.id,
            debtName: debt.name,
            percentage: milestone.percentage,
          });
        }
      }
    }

    return createdNotifications;
  } catch (error) {
    console.error('Error checking debt payoff milestones:', error);
    return [];
  }
}

export async function getDebtPayoffMilestoneStats(userId: string) {
  try {
    const allDebts = await db.select().from(debts).where(eq(debts.userId, userId));

    const allMilestones = await db
      .select()
      .from(debtPayoffMilestones)
      .where(eq(debtPayoffMilestones.userId, userId));

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

    // Calculate total debt momentum
    const activeDebts = allDebts.filter((d) => d.status === 'active');
    const totalRemaining = activeDebts.reduce((sum, d) => sum + d.remainingBalance, 0);
    const totalOriginal = activeDebts.reduce((sum, d) => sum + d.originalAmount, 0);
    const percentagePaidOff = totalOriginal > 0 ? (totalOriginal - totalRemaining) / totalOriginal * 100 : 0;

    return {
      totalDebts: allDebts.length,
      activeDebts: activeDebts.length,
      totalMilestones: totalCount,
      achievedMilestones: achievedCount,
      percentagePaidOff,
      byPercentage,
    };
  } catch (error) {
    console.error('Error getting debt milestone stats:', error);
    return {
      totalDebts: 0,
      activeDebts: 0,
      totalMilestones: 0,
      achievedMilestones: 0,
      percentagePaidOff: 0,
      byPercentage: { 25: { achieved: 0, total: 0 }, 50: { achieved: 0, total: 0 }, 75: { achieved: 0, total: 0 }, 100: { achieved: 0, total: 0 } },
    };
  }
}
