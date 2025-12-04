import { db } from '@/lib/db';
import { billInstances, bills } from '@/lib/db/schema';
import { eq, and, lte, gte } from 'drizzle-orm';
import { addDays, parseISO, differenceInDays, startOfDay } from 'date-fns';
import { createNotification } from '@/lib/notifications/notification-service';

export async function checkAndCreateBillReminders() {
  try {
    const today = new Date();

    // Get all pending bill instances
    const pendingInstances = await db
      .select({
        instance: billInstances,
        bill: bills,
      })
      .from(billInstances)
      .leftJoin(bills, eq(billInstances.billId, bills.id))
      .where(eq(billInstances.status, 'pending'));

    let createdNotifications = 0;
    let skippedAutopay = 0;

    for (const { instance, bill } of pendingInstances) {
      if (!bill) continue; // Skip if bill not found

      // Skip autopay-enabled bills - they're handled by the autopay processor
      // Users don't need reminders for bills that will be paid automatically
      if (bill.isAutopayEnabled && bill.autopayAccountId) {
        skippedAutopay++;
        continue;
      }

      const dueDate = parseISO(instance.dueDate);
      const daysUntilDue = differenceInDays(dueDate, startOfDay(today));

      // Check if bill is overdue
      if (daysUntilDue < 0) {
        // Create overdue notification
        await createOverdueNotification(instance, bill);
        createdNotifications++;
      }
      // Check if due in 3 days (or configured days before)
      else if (daysUntilDue === 3) {
        await createUpcomingNotification(instance, bill, 3);
        createdNotifications++;
      }
      // Check if due today
      else if (daysUntilDue === 0) {
        await createUpcomingNotification(instance, bill, 0);
        createdNotifications++;
      }
      // Check if due tomorrow (1 day)
      else if (daysUntilDue === 1) {
        await createUpcomingNotification(instance, bill, 1);
        createdNotifications++;
      }
    }

    return {
      success: true,
      notificationsCreated: createdNotifications,
      checkedInstances: pendingInstances.length,
      skippedAutopay,
    };
  } catch (error) {
    console.error('Error checking bill reminders:', error);
    throw error;
  }
}

async function createUpcomingNotification(
  instance: typeof billInstances.$inferSelect,
  bill: typeof bills.$inferSelect,
  daysUntil: number
) {
  try {
    let title = '';
    let message = '';
    let priority: 'low' | 'normal' | 'high' | 'urgent' = 'normal';

    if (daysUntil === 0) {
      title = `${bill.name} is due today`;
      message = `Your bill ${bill.name} is due today for $${bill.expectedAmount.toFixed(2)}. Don't forget to pay!`;
      priority = 'high';
    } else if (daysUntil === 1) {
      title = `${bill.name} is due tomorrow`;
      message = `Your bill ${bill.name} is due tomorrow for $${bill.expectedAmount.toFixed(2)}.`;
      priority = 'normal';
    } else {
      title = `${bill.name} due in ${daysUntil} days`;
      message = `Your bill ${bill.name} is due in ${daysUntil} days for $${bill.expectedAmount.toFixed(2)}.`;
      priority = 'low';
    }

    await createNotification({
      userId: instance.userId,
      type: 'bill_due',
      title,
      message,
      priority,
      actionUrl: `/dashboard/bills`,
      actionLabel: 'View Bills',
      isActionable: true,
      entityType: 'billInstance',
      entityId: instance.id,
      metadata: {
        billId: bill.id,
        billInstanceId: instance.id,
        daysUntilDue: daysUntil,
        dueDate: instance.dueDate,
        amount: bill.expectedAmount,
      },
    });
  } catch (error) {
    console.error(`Error creating upcoming notification for ${bill.name}:`, error);
  }
}

async function createOverdueNotification(
  instance: typeof billInstances.$inferSelect,
  bill: typeof bills.$inferSelect
) {
  try {
    const daysOverdue = Math.abs(
      differenceInDays(parseISO(instance.dueDate), startOfDay(new Date()))
    );

    const title = `${bill.name} is ${daysOverdue} day${daysOverdue !== 1 ? 's' : ''} overdue`;
    const message = `Your bill ${bill.name} for $${bill.expectedAmount.toFixed(
      2
    )} is now ${daysOverdue} day${daysOverdue !== 1 ? 's' : ''} overdue. Please pay immediately.`;

    await createNotification({
      userId: instance.userId,
      type: 'bill_overdue',
      title,
      message,
      priority: 'urgent',
      actionUrl: `/dashboard/bills`,
      actionLabel: 'Pay Now',
      isActionable: true,
      entityType: 'billInstance',
      entityId: instance.id,
      metadata: {
        billId: bill.id,
        billInstanceId: instance.id,
        daysOverdue,
        dueDate: instance.dueDate,
        amount: bill.expectedAmount,
      },
    });
  } catch (error) {
    console.error(`Error creating overdue notification for ${bill.name}:`, error);
  }
}

/**
 * Get all bills due in the next N days for a specific user
 */
export async function getUpcomingBillsForUser(
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
          eq(billInstances.status, 'pending'),
          gte(billInstances.dueDate, todayISO),
          lte(billInstances.dueDate, futureISO)
        )
      );
  } catch (error) {
    console.error('Error getting upcoming bills:', error);
    return [];
  }
}

/**
 * Get overdue bills for a specific user
 */
export async function getOverdueBillsForUser(userId: string) {
  try {
    const today = new Date().toISOString().split('T')[0];

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
          eq(billInstances.status, 'pending'),
          lte(billInstances.dueDate, today)
        )
      );
  } catch (error) {
    console.error('Error getting overdue bills:', error);
    return [];
  }
}
