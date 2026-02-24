import { db } from '@/lib/db';
import { autopayRules, billOccurrences, billTemplates } from '@/lib/db/schema';
import { eq, and, lte, gte, inArray } from 'drizzle-orm';
import { addDays, parseISO, differenceInDays, startOfDay } from 'date-fns';
import { createNotification } from '@/lib/notifications/notification-service';
import { getTodayLocalDateString, toLocalDateString } from '@/lib/utils/local-date';

export async function checkAndCreateBillReminders(options?: {
  userId?: string;
  householdId?: string;
}) {
  try {
    const today = new Date();

    // Get all unpaid/overdue expense occurrences with optional autopay rules
    const queryFilters = [
      eq(billTemplates.billType, 'expense'),
      eq(billTemplates.isActive, true),
      inArray(billOccurrences.status, ['unpaid', 'partial', 'overdue']),
    ];
    if (options?.userId) {
      queryFilters.push(eq(billTemplates.createdByUserId, options.userId));
    }
    if (options?.householdId) {
      queryFilters.push(eq(billTemplates.householdId, options.householdId));
    }

    const pendingOccurrences = await db
      .select({
        occurrence: billOccurrences,
        template: billTemplates,
        autopay: autopayRules,
      })
      .from(billOccurrences)
      .innerJoin(billTemplates, eq(billOccurrences.templateId, billTemplates.id))
      .leftJoin(
        autopayRules,
        and(
          eq(autopayRules.templateId, billTemplates.id),
          eq(autopayRules.householdId, billTemplates.householdId)
        )
      )
      .where(
        and(...queryFilters)
      );

    let createdNotifications = 0;
    let skippedAutopay = 0;

    for (const { occurrence, template, autopay } of pendingOccurrences) {
      // Skip autopay-enabled bills - they're handled by the autopay processor
      // Users don't need reminders for bills that will be paid automatically
      if (autopay?.isEnabled && autopay.payFromAccountId) {
        skippedAutopay++;
        continue;
      }

      const dueDate = parseISO(occurrence.dueDate);
      const daysUntilDue = differenceInDays(dueDate, startOfDay(today));
      const isOverdue = occurrence.status === 'overdue' || daysUntilDue < 0;

      // Check if bill is overdue
      if (isOverdue) {
        // Create overdue notification
        await createOverdueNotification(occurrence, template);
        createdNotifications++;
      }
      // Check if due in 3 days (or configured days before)
      else if (daysUntilDue === 3) {
        await createUpcomingNotification(occurrence, template, 3);
        createdNotifications++;
      }
      // Check if due today
      else if (daysUntilDue === 0) {
        await createUpcomingNotification(occurrence, template, 0);
        createdNotifications++;
      }
      // Check if due tomorrow (1 day)
      else if (daysUntilDue === 1) {
        await createUpcomingNotification(occurrence, template, 1);
        createdNotifications++;
      }
    }

    return {
      success: true,
      notificationsCreated: createdNotifications,
      checkedInstances: pendingOccurrences.length,
      skippedAutopay,
    };
  } catch (error) {
    console.error('Error checking bill reminders:', error);
    throw error;
  }
}

async function createUpcomingNotification(
  occurrence: typeof billOccurrences.$inferSelect,
  template: typeof billTemplates.$inferSelect,
  daysUntil: number
) {
  try {
    let title = '';
    let message = '';
    let priority: 'low' | 'normal' | 'high' | 'urgent' = 'normal';
    const amount = occurrence.amountDueCents / 100;

    if (daysUntil === 0) {
      title = `${template.name} is due today`;
      message = `Your bill ${template.name} is due today for $${amount.toFixed(2)}. Don't forget to pay!`;
      priority = 'high';
    } else if (daysUntil === 1) {
      title = `${template.name} is due tomorrow`;
      message = `Your bill ${template.name} is due tomorrow for $${amount.toFixed(2)}.`;
      priority = 'normal';
    } else {
      title = `${template.name} due in ${daysUntil} days`;
      message = `Your bill ${template.name} is due in ${daysUntil} days for $${amount.toFixed(2)}.`;
      priority = 'low';
    }

    await createNotification({
      userId: template.createdByUserId,
      householdId: occurrence.householdId,
      type: 'bill_due',
      title,
      message,
      priority,
      actionUrl: `/dashboard/bills`,
      actionLabel: 'View Bills',
      isActionable: true,
      entityType: 'billOccurrence',
      entityId: occurrence.id,
      metadata: {
        templateId: template.id,
        occurrenceId: occurrence.id,
        daysUntilDue: daysUntil,
        dueDate: occurrence.dueDate,
        amount,
      },
    });
  } catch (error) {
    console.error(`Error creating upcoming notification for ${template.name}:`, error);
  }
}

async function createOverdueNotification(
  occurrence: typeof billOccurrences.$inferSelect,
  template: typeof billTemplates.$inferSelect
) {
  try {
    const daysOverdue = Math.abs(
      differenceInDays(parseISO(occurrence.dueDate), startOfDay(new Date()))
    );
    const amount = occurrence.amountDueCents / 100;

    const title = `${template.name} is ${daysOverdue} day${daysOverdue !== 1 ? 's' : ''} overdue`;
    const message = `Your bill ${template.name} for $${amount.toFixed(
      2
    )} is now ${daysOverdue} day${daysOverdue !== 1 ? 's' : ''} overdue. Please pay immediately.`;

    await createNotification({
      userId: template.createdByUserId,
      householdId: occurrence.householdId,
      type: 'bill_overdue',
      title,
      message,
      priority: 'urgent',
      actionUrl: `/dashboard/bills`,
      actionLabel: 'Pay Now',
      isActionable: true,
      entityType: 'billOccurrence',
      entityId: occurrence.id,
      metadata: {
        templateId: template.id,
        occurrenceId: occurrence.id,
        daysOverdue,
        dueDate: occurrence.dueDate,
        amount,
      },
    });
  } catch (error) {
    console.error(`Error creating overdue notification for ${template.name}:`, error);
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
    const todayISO = toLocalDateString(today);
    const futureISO = toLocalDateString(futureDate);

    return await db
      .select({
        occurrence: billOccurrences,
        template: billTemplates,
      })
      .from(billOccurrences)
      .innerJoin(billTemplates, eq(billOccurrences.templateId, billTemplates.id))
      .where(
        and(
          eq(billTemplates.createdByUserId, userId),
          eq(billTemplates.billType, 'expense'),
          eq(billTemplates.isActive, true),
          inArray(billOccurrences.status, ['unpaid', 'partial']),
          gte(billOccurrences.dueDate, todayISO),
          lte(billOccurrences.dueDate, futureISO)
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
    const today = getTodayLocalDateString();

    return await db
      .select({
        occurrence: billOccurrences,
        template: billTemplates,
      })
      .from(billOccurrences)
      .innerJoin(billTemplates, eq(billOccurrences.templateId, billTemplates.id))
      .where(
        and(
          eq(billTemplates.createdByUserId, userId),
          eq(billTemplates.billType, 'expense'),
          eq(billTemplates.isActive, true),
          inArray(billOccurrences.status, ['unpaid', 'partial', 'overdue']),
          lte(billOccurrences.dueDate, today)
        )
      );
  } catch (error) {
    console.error('Error getting overdue bills:', error);
    return [];
  }
}
