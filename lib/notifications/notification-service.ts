import { db } from '@/lib/db';
import { notifications, notificationPreferences, pushSubscriptions } from '@/lib/db/schema';
import { eq, and, isNull, lt } from 'drizzle-orm';
import { nanoid } from 'nanoid';

export type NotificationType =
  | 'bill_due'
  | 'bill_overdue'
  | 'budget_warning'
  | 'budget_exceeded'
  | 'budget_review'
  | 'low_balance'
  | 'savings_milestone'
  | 'debt_milestone'
  | 'spending_summary'
  | 'reminder'
  | 'system';

export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  priority?: NotificationPriority;
  actionUrl?: string;
  entityType?: string;
  entityId?: string;
  actionLabel?: string;
  isActionable?: boolean;
  scheduledFor?: string;
  metadata?: Record<string, any>;
  householdId?: string;
}

/**
 * Create a new notification
 */
export async function createNotification(input: CreateNotificationInput) {
  try {
    const notificationId = nanoid();

    await db.insert(notifications).values({
      id: notificationId,
      userId: input.userId,
      householdId: input.householdId,
      type: input.type,
      title: input.title,
      message: input.message,
      priority: input.priority || 'normal',
      actionUrl: input.actionUrl,
      entityType: input.entityType,
      entityId: input.entityId,
      actionLabel: input.actionLabel,
      isActionable: input.isActionable !== false,
      scheduledFor: input.scheduledFor,
      metadata: input.metadata ? JSON.stringify(input.metadata) : null,
    });

    return notificationId;
  } catch (error) {
    console.error('Error creating notification:', error);
    throw error;
  }
}

/**
 * Send a push notification to user's registered devices
 */
export async function sendPushNotification(
  userId: string,
  _title: string,
  _options: {
    body?: string;
    icon?: string;
    badge?: string;
    tag?: string;
    data?: Record<string, unknown>;
  } = {}
) {
  try {
    // Get user's push subscriptions
    const subscriptions = await db
      .select()
      .from(pushSubscriptions)
      .where(
        and(
          eq(pushSubscriptions.userId, userId),
          eq(pushSubscriptions.isActive, true)
        )
      );

    // Get user's notification preferences
    const prefs = await db
      .select()
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, userId))
      .limit(1);

    const pushEnabled = prefs.length > 0 && prefs[0].pushNotificationsEnabled;

    if (!pushEnabled || subscriptions.length === 0) {
      return 0;
    }

    // Send to all subscribed devices
    // In production, you would use a service like Firebase Cloud Messaging or web-push
    // For now, we'll prepare the notifications but not actually send them
    // This would be implemented with the 'web-push' npm package

    console.log(`Prepared push notification for ${subscriptions.length} device(s)`);
    return subscriptions.length;
  } catch (error) {
    console.error('Error sending push notification:', error);
    return 0;
  }
}

/**
 * Mark notification as read
 */
export async function markAsRead(notificationId: string, userId: string) {
  try {
    const now = new Date().toISOString();
    await db
      .update(notifications)
      .set({ isRead: true, readAt: now })
      .where(
        and(
          eq(notifications.id, notificationId),
          eq(notifications.userId, userId)
        )
      );
  } catch (error) {
    console.error('Error marking notification as read:', error);
    throw error;
  }
}

/**
 * Mark notification as dismissed
 */
export async function markAsDismissed(notificationId: string, userId: string) {
  try {
    const now = new Date().toISOString();
    await db
      .update(notifications)
      .set({ isDismissed: true, dismissedAt: now })
      .where(
        and(
          eq(notifications.id, notificationId),
          eq(notifications.userId, userId)
        )
      );
  } catch (error) {
    console.error('Error dismissing notification:', error);
    throw error;
  }
}

/**
 * Get user's notification preferences or create defaults
 */
export async function getOrCreatePreferences(userId: string) {
  try {
    const existing = await db
      .select()
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, userId))
      .limit(1);

    if (existing.length > 0) {
      return existing[0];
    }

    // Create default preferences
    const prefId = nanoid();
    await db.insert(notificationPreferences).values({
      id: prefId,
      userId,
      billReminderEnabled: true,
      billReminderDaysBefore: 3,
      billReminderOnDueDate: true,
      billOverdueReminder: true,
      budgetWarningEnabled: true,
      budgetWarningThreshold: 80,
      budgetExceededAlert: true,
      budgetReviewEnabled: true,
      lowBalanceAlertEnabled: true,
      lowBalanceThreshold: 100.0,
      savingsMilestoneEnabled: true,
      debtMilestoneEnabled: true,
      weeklySummaryEnabled: true,
      weeklySummaryDay: 'sunday',
      monthlySummaryEnabled: true,
      monthlySummaryDay: 1,
      pushNotificationsEnabled: true,
      emailNotificationsEnabled: false,
    });

    const created = await db
      .select()
      .from(notificationPreferences)
      .where(eq(notificationPreferences.id, prefId))
      .limit(1);

    return created[0];
  } catch (error) {
    console.error('Error getting/creating preferences:', error);
    throw error;
  }
}

/**
 * Update notification preferences
 */
export async function updatePreferences(
  userId: string,
  updates: Partial<typeof notificationPreferences.$inferInsert>
) {
  try {
    const now = new Date().toISOString();
    await db
      .update(notificationPreferences)
      .set({ ...updates, updatedAt: now })
      .where(eq(notificationPreferences.userId, userId));
  } catch (error) {
    console.error('Error updating preferences:', error);
    throw error;
  }
}

/**
 * Get unread notification count
 */
export async function getUnreadCount(userId: string) {
  try {
    const result = await db
      .select({ count: notifications.id })
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, userId),
          eq(notifications.isRead, false),
          eq(notifications.isDismissed, false)
        )
      );

    return result.length;
  } catch (error) {
    console.error('Error getting unread count:', error);
    return 0;
  }
}

/**
 * Get scheduled notifications that are due
 */
export async function getScheduledNotificationsDue() {
  try {
    const now = new Date().toISOString();
    return await db
      .select()
      .from(notifications)
      .where(
        and(
          isNull(notifications.sentAt),
          lt(notifications.scheduledFor, now)
        )
      );
  } catch (error) {
    console.error('Error getting scheduled notifications:', error);
    return [];
  }
}

/**
 * Mark scheduled notification as sent
 */
export async function markNotificationSent(notificationId: string) {
  try {
    const now = new Date().toISOString();
    await db
      .update(notifications)
      .set({ sentAt: now })
      .where(eq(notifications.id, notificationId));
  } catch (error) {
    console.error('Error marking notification as sent:', error);
    throw error;
  }
}

/**
 * Clean up expired notifications
 */
export async function cleanupExpiredNotifications() {
  try {
    const now = new Date().toISOString();
    const result = await db
      .delete(notifications)
      .where(lt(notifications.expiresAt, now));

    return result;
  } catch (error) {
    console.error('Error cleaning up expired notifications:', error);
    throw error;
  }
}
