import { db } from '@/lib/db';
import { billOccurrences, billTemplates } from '@/lib/db/schema';
import { eq, and, lte, gte, inArray } from 'drizzle-orm';
import { addDays, parseISO, differenceInDays, startOfDay } from 'date-fns';
import { createNotification } from '@/lib/notifications/notification-service';
import { getTodayLocalDateString, toLocalDateString } from '@/lib/utils/local-date';

/**
 * Check for late income and create notifications
 * Income is considered "late" when the expected date has passed and status is still pending/overdue
 */
export async function checkAndCreateIncomeAlerts() {
  try {
    const today = new Date();
    const todayISO = toLocalDateString(today);

    // Get all pending/overdue income bill occurrences
    const incomeInstances = await db
      .select({
        occurrence: billOccurrences,
        template: billTemplates,
      })
      .from(billOccurrences)
      .innerJoin(billTemplates, eq(billOccurrences.templateId, billTemplates.id))
      .where(
        and(
          eq(billTemplates.billType, 'income'),
          eq(billTemplates.isActive, true),
          lte(billOccurrences.dueDate, todayISO), // Expected date has passed
          inArray(billOccurrences.status, ['unpaid', 'partial', 'overdue'])
        )
      );

    let createdNotifications = 0;

    for (const { occurrence, template } of incomeInstances) {
      if (!template) continue;

      const expectedDate = parseISO(occurrence.dueDate);
      const daysLate = differenceInDays(startOfDay(today), expectedDate);

      // Only create notifications for income that's 1+ days late
      if (daysLate >= 1) {
        await createLateIncomeNotification(occurrence, template, daysLate);
        createdNotifications++;
      }
    }

    return {
      success: true,
      notificationsCreated: createdNotifications,
      checkedInstances: incomeInstances.length,
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
  occurrence: typeof billOccurrences.$inferSelect,
  template: typeof billTemplates.$inferSelect,
  daysLate: number
) {
  try {
    const expectedAmount = occurrence.amountDueCents / 100;
    const title = `${template.name} is ${daysLate} day${daysLate !== 1 ? 's' : ''} late`;
    const message = `Your expected income of $${expectedAmount.toFixed(2)} from ${template.name} was due ${daysLate} day${daysLate !== 1 ? 's' : ''} ago. Check if payment has been received.`;

    // Determine priority based on how late
    let priority: 'low' | 'normal' | 'high' | 'urgent' = 'normal';
    if (daysLate >= 7) {
      priority = 'high';
    } else if (daysLate >= 14) {
      priority = 'urgent';
    }

    await createNotification({
      userId: template.createdByUserId,
      householdId: occurrence.householdId,
      type: 'income_late',
      title,
      message,
      priority,
      actionUrl: '/dashboard/income',
      actionLabel: 'View Income',
      isActionable: true,
      entityType: 'billOccurrence',
      entityId: occurrence.id,
      metadata: {
        templateId: template.id,
        occurrenceId: occurrence.id,
        daysLate,
        expectedDate: occurrence.dueDate,
        amount: expectedAmount,
        billType: 'income',
        incomeSource: template.name,
      },
    });
  } catch (error) {
    console.error(`Error creating late income notification for ${template.name}:`, error);
  }
}

/**
 * Check for upcoming income (creates reminder-style notifications for expected income)
 */
export async function checkAndCreateIncomeReminders() {
  try {
    const today = new Date();
    const todayISO = toLocalDateString(today);

    // Get all pending income bill occurrences for the next 7 days
    const upcomingIncomeInstances = await db
      .select({
        occurrence: billOccurrences,
        template: billTemplates,
      })
      .from(billOccurrences)
      .innerJoin(billTemplates, eq(billOccurrences.templateId, billTemplates.id))
      .where(
        and(
          eq(billTemplates.billType, 'income'),
          eq(billTemplates.isActive, true),
          inArray(billOccurrences.status, ['unpaid', 'partial']),
          gte(billOccurrences.dueDate, todayISO)
        )
      );

    let createdNotifications = 0;

    for (const { occurrence, template } of upcomingIncomeInstances) {
      if (!template) continue;

      const expectedDate = parseISO(occurrence.dueDate);
      const daysUntil = differenceInDays(expectedDate, startOfDay(today));

      // Create notifications for income expected today, tomorrow, or in 3 days
      if (daysUntil === 0 || daysUntil === 1 || daysUntil === 3) {
        await createUpcomingIncomeNotification(occurrence, template, daysUntil);
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
  occurrence: typeof billOccurrences.$inferSelect,
  template: typeof billTemplates.$inferSelect,
  daysUntil: number
) {
  try {
    let title = '';
    let message = '';
    let priority: 'low' | 'normal' | 'high' | 'urgent' = 'low';

    const expectedAmount = occurrence.amountDueCents / 100;

    if (daysUntil === 0) {
      title = `${template.name} expected today`;
      message = `You should receive $${expectedAmount.toFixed(2)} from ${template.name} today.`;
      priority = 'normal';
    } else if (daysUntil === 1) {
      title = `${template.name} expected tomorrow`;
      message = `You should receive $${expectedAmount.toFixed(2)} from ${template.name} tomorrow.`;
      priority = 'low';
    } else {
      title = `${template.name} expected in ${daysUntil} days`;
      message = `You should receive $${expectedAmount.toFixed(2)} from ${template.name} in ${daysUntil} days.`;
      priority = 'low';
    }

    await createNotification({
      userId: template.createdByUserId,
      householdId: occurrence.householdId,
      type: 'bill_due', // Reusing bill_due type for income reminders
      title,
      message,
      priority,
      actionUrl: '/dashboard/income',
      actionLabel: 'View Income',
      isActionable: true,
      entityType: 'billOccurrence',
      entityId: occurrence.id,
      metadata: {
        templateId: template.id,
        occurrenceId: occurrence.id,
        daysUntil,
        expectedDate: occurrence.dueDate,
        amount: expectedAmount,
        billType: 'income',
        incomeSource: template.name,
      },
    });
  } catch (error) {
    console.error(`Error creating upcoming income notification for ${template.name}:`, error);
  }
}

/**
 * Get all late income for a specific user
 */
export async function getLateIncomeForUser(userId: string) {
  try {
    const today = getTodayLocalDateString();

    const results = await db
      .select({
        occurrence: billOccurrences,
        template: billTemplates,
      })
      .from(billOccurrences)
      .innerJoin(billTemplates, eq(billOccurrences.templateId, billTemplates.id))
      .where(
        and(
          eq(billTemplates.createdByUserId, userId),
          eq(billTemplates.billType, 'income'),
          eq(billTemplates.isActive, true),
          lte(billOccurrences.dueDate, today),
          inArray(billOccurrences.status, ['unpaid', 'partial', 'overdue'])
        )
      );
    return results;
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
          eq(billTemplates.billType, 'income'),
          eq(billTemplates.isActive, true),
          inArray(billOccurrences.status, ['unpaid', 'partial']),
          gte(billOccurrences.dueDate, todayISO),
          lte(billOccurrences.dueDate, futureISO)
        )
      );
  } catch (error) {
    console.error('Error getting upcoming income:', error);
    return [];
  }
}
