import { db } from '@/lib/db';
import { billInstances, bills } from '@/lib/db/schema';
import { eq, and, lte, gte } from 'drizzle-orm';
import { addDays, parseISO, differenceInDays, startOfDay } from 'date-fns';
import { createNotification } from '@/lib/notifications/notification-service';

/**
 * Check for late income and create notifications
 * Income is considered "late" when the expected date has passed and status is still pending/overdue
 */
export async function checkAndCreateIncomeAlerts() {
  try {
    const today = new Date();
    const todayISO = today.toISOString().split('T')[0];

    // Get all pending/overdue income bill instances
    const incomeInstances = await db
      .select({
        instance: billInstances,
        bill: bills,
      })
      .from(billInstances)
      .leftJoin(bills, eq(billInstances.billId, bills.id))
      .where(
        and(
          eq(bills.billType, 'income'),
          lte(billInstances.dueDate, todayISO) // Expected date has passed
        )
      );

    // Filter to only pending/overdue (not paid or skipped)
    const lateIncomeInstances = incomeInstances.filter(
      ({ instance }) => instance.status === 'pending' || instance.status === 'overdue'
    );

    let createdNotifications = 0;

    for (const { instance, bill } of lateIncomeInstances) {
      if (!bill) continue; // Skip if bill not found

      const expectedDate = parseISO(instance.dueDate);
      const daysLate = differenceInDays(startOfDay(today), expectedDate);

      // Only create notifications for income that's 1+ days late
      if (daysLate >= 1) {
        await createLateIncomeNotification(instance, bill, daysLate);
        createdNotifications++;
      }
    }

    return {
      success: true,
      notificationsCreated: createdNotifications,
      checkedInstances: lateIncomeInstances.length,
    };
  } catch (error) {
    console.error('Error checking income alerts:', error);
    throw error;
  }
}

/**
 * Create a notification for late income
 */
async function createLateIncomeNotification(
  instance: typeof billInstances.$inferSelect,
  bill: typeof bills.$inferSelect,
  daysLate: number
) {
  try {
    const title = `${bill.name} is ${daysLate} day${daysLate !== 1 ? 's' : ''} late`;
    const message = `Your expected income of $${bill.expectedAmount.toFixed(2)} from ${bill.name} was due ${daysLate} day${daysLate !== 1 ? 's' : ''} ago. Check if payment has been received.`;

    // Determine priority based on how late
    let priority: 'low' | 'normal' | 'high' | 'urgent' = 'normal';
    if (daysLate >= 7) {
      priority = 'high';
    } else if (daysLate >= 14) {
      priority = 'urgent';
    }

    await createNotification({
      userId: instance.userId,
      householdId: instance.householdId,
      type: 'income_late',
      title,
      message,
      priority,
      actionUrl: `/dashboard/bills?filter=income`,
      actionLabel: 'View Income',
      isActionable: true,
      entityType: 'billInstance',
      entityId: instance.id,
      metadata: {
        billId: bill.id,
        billInstanceId: instance.id,
        daysLate,
        expectedDate: instance.dueDate,
        amount: bill.expectedAmount,
        billType: 'income',
        incomeSource: bill.name,
      },
    });
  } catch (error) {
    console.error(`Error creating late income notification for ${bill.name}:`, error);
  }
}

/**
 * Check for upcoming income (creates reminder-style notifications for expected income)
 */
export async function checkAndCreateIncomeReminders() {
  try {
    const today = new Date();
    const todayISO = today.toISOString().split('T')[0];

    // Get all pending income bill instances for the next 7 days
    const upcomingIncomeInstances = await db
      .select({
        instance: billInstances,
        bill: bills,
      })
      .from(billInstances)
      .leftJoin(bills, eq(billInstances.billId, bills.id))
      .where(
        and(
          eq(bills.billType, 'income'),
          eq(billInstances.status, 'pending'),
          gte(billInstances.dueDate, todayISO)
        )
      );

    let createdNotifications = 0;

    for (const { instance, bill } of upcomingIncomeInstances) {
      if (!bill) continue;

      const expectedDate = parseISO(instance.dueDate);
      const daysUntil = differenceInDays(expectedDate, startOfDay(today));

      // Create notifications for income expected today, tomorrow, or in 3 days
      if (daysUntil === 0 || daysUntil === 1 || daysUntil === 3) {
        await createUpcomingIncomeNotification(instance, bill, daysUntil);
        createdNotifications++;
      }
    }

    return {
      success: true,
      notificationsCreated: createdNotifications,
      checkedInstances: upcomingIncomeInstances.length,
    };
  } catch (error) {
    console.error('Error checking income reminders:', error);
    throw error;
  }
}

/**
 * Create a notification for upcoming income
 */
async function createUpcomingIncomeNotification(
  instance: typeof billInstances.$inferSelect,
  bill: typeof bills.$inferSelect,
  daysUntil: number
) {
  try {
    let title = '';
    let message = '';
    let priority: 'low' | 'normal' | 'high' | 'urgent' = 'low';

    if (daysUntil === 0) {
      title = `${bill.name} expected today`;
      message = `You should receive $${bill.expectedAmount.toFixed(2)} from ${bill.name} today.`;
      priority = 'normal';
    } else if (daysUntil === 1) {
      title = `${bill.name} expected tomorrow`;
      message = `You should receive $${bill.expectedAmount.toFixed(2)} from ${bill.name} tomorrow.`;
      priority = 'low';
    } else {
      title = `${bill.name} expected in ${daysUntil} days`;
      message = `You should receive $${bill.expectedAmount.toFixed(2)} from ${bill.name} in ${daysUntil} days.`;
      priority = 'low';
    }

    await createNotification({
      userId: instance.userId,
      householdId: instance.householdId,
      type: 'bill_due', // Reusing bill_due type for income reminders
      title,
      message,
      priority,
      actionUrl: `/dashboard/bills?filter=income`,
      actionLabel: 'View Income',
      isActionable: true,
      entityType: 'billInstance',
      entityId: instance.id,
      metadata: {
        billId: bill.id,
        billInstanceId: instance.id,
        daysUntil,
        expectedDate: instance.dueDate,
        amount: bill.expectedAmount,
        billType: 'income',
        incomeSource: bill.name,
      },
    });
  } catch (error) {
    console.error(`Error creating upcoming income notification for ${bill.name}:`, error);
  }
}

/**
 * Get all late income for a specific user
 */
export async function getLateIncomeForUser(userId: string) {
  try {
    const today = new Date().toISOString().split('T')[0];

    const results = await db
      .select({
        instance: billInstances,
        bill: bills,
      })
      .from(billInstances)
      .leftJoin(bills, eq(billInstances.billId, bills.id))
      .where(
        and(
          eq(billInstances.userId, userId),
          eq(bills.billType, 'income'),
          lte(billInstances.dueDate, today)
        )
      );

    // Filter to only pending/overdue
    return results.filter(
      ({ instance }) => instance.status === 'pending' || instance.status === 'overdue'
    );
  } catch (error) {
    console.error('Error getting late income:', error);
    return [];
  }
}

/**
 * Get upcoming expected income for a specific user
 */
export async function getUpcomingIncomeForUser(
  userId: string,
  daysAhead: number = 30
) {
  try {
    const today = new Date();
    const futureDate = addDays(today, daysAhead);
    const todayISO = today.toISOString().split('T')[0];
    const futureISO = futureDate.toISOString().split('T')[0];

    return await db
      .select({
        instance: billInstances,
        bill: bills,
      })
      .from(billInstances)
      .leftJoin(bills, eq(billInstances.billId, bills.id))
      .where(
        and(
          eq(billInstances.userId, userId),
          eq(bills.billType, 'income'),
          eq(billInstances.status, 'pending'),
          gte(billInstances.dueDate, todayISO),
          lte(billInstances.dueDate, futureISO)
        )
      );
  } catch (error) {
    console.error('Error getting upcoming income:', error);
    return [];
  }
}

