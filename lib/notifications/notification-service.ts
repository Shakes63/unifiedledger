import { db } from '@/lib/db';
import { notifications, notificationPreferences, pushSubscriptions } from '@/lib/db/schema';
import { eq, and, isNull, lt, gte } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { sendEmail } from '@/lib/email/email-service';

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
  | 'system'
  | 'income_late';

export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';

export type NotificationChannel = 'push' | 'email';

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
  metadata?: Record<string, unknown>;
  householdId?: string;
}

type PreferencesRow = typeof notificationPreferences.$inferSelect;

const DEFAULT_CHANNELS: NotificationChannel[] = ['push'];

const RATE_LIMIT_WINDOWS_MINUTES: Partial<Record<NotificationType, number>> = {
  bill_due: 60 * 12,
  bill_overdue: 60 * 12,
  budget_warning: 60 * 24,
  budget_exceeded: 60 * 24,
  budget_review: 60 * 24,
  low_balance: 60 * 24,
  savings_milestone: 60 * 24,
  debt_milestone: 60 * 24,
  income_late: 60 * 24,
};

function parseChannelsJson(channelsJson: string | null | undefined): NotificationChannel[] {
  if (!channelsJson) return DEFAULT_CHANNELS;
  try {
    const parsed: unknown = JSON.parse(channelsJson);
    if (!Array.isArray(parsed)) return DEFAULT_CHANNELS;
    const filtered = parsed.filter((c): c is NotificationChannel => c === 'push' || c === 'email');
    return filtered.length > 0 ? filtered : DEFAULT_CHANNELS;
  } catch {
    return DEFAULT_CHANNELS;
  }
}

function resolveTypePreferences(
  prefs: PreferencesRow,
  type: NotificationType
): {
  enabled: boolean;
  channels: NotificationChannel[];
} {
  switch (type) {
    case 'bill_due':
    case 'bill_overdue':
      return {
        enabled:
          prefs.billReminderEnabled === true &&
          (type === 'bill_overdue' ? prefs.billOverdueReminder === true : true),
        channels: parseChannelsJson(prefs.billReminderChannels),
      };
    case 'budget_warning':
      return {
        enabled: prefs.budgetWarningEnabled === true,
        channels: parseChannelsJson(prefs.budgetWarningChannels),
      };
    case 'budget_exceeded':
      return {
        enabled: prefs.budgetExceededAlert === true,
        channels: parseChannelsJson(prefs.budgetExceededChannels),
      };
    case 'budget_review':
      return {
        enabled: prefs.budgetReviewEnabled === true,
        channels: parseChannelsJson(prefs.budgetReviewChannels),
      };
    case 'low_balance':
      return {
        enabled: prefs.lowBalanceAlertEnabled === true,
        channels: parseChannelsJson(prefs.lowBalanceChannels),
      };
    case 'savings_milestone':
      return {
        enabled: prefs.savingsMilestoneEnabled === true,
        channels: parseChannelsJson(prefs.savingsMilestoneChannels),
      };
    case 'debt_milestone':
      return {
        enabled: prefs.debtMilestoneEnabled === true,
        channels: parseChannelsJson(prefs.debtMilestoneChannels),
      };
    case 'income_late':
      return {
        enabled: prefs.incomeLateAlertEnabled === true,
        channels: parseChannelsJson(prefs.incomeLateChannels),
      };
    // Non-preference-driven types fall back to global toggles only
    default:
      return { enabled: true, channels: DEFAULT_CHANNELS };
  }
}

async function getPreferencesForUser(userId: string): Promise<PreferencesRow> {
  const prefs = await db
    .select()
    .from(notificationPreferences)
    .where(eq(notificationPreferences.userId, userId))
    .limit(1);

  // If prefs are missing for some reason, fall back to defaults via getOrCreatePreferences()
  if (prefs.length === 0) {
    return await getOrCreatePreferences(userId);
  }

  return prefs[0];
}

async function isRateLimited(params: {
  userId: string;
  type: NotificationType;
  entityType?: string;
  entityId?: string;
}): Promise<boolean> {
  const windowMinutes = RATE_LIMIT_WINDOWS_MINUTES[params.type] ?? 30;
  const cutoffIso = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();

  const where = [
    eq(notifications.userId, params.userId),
    eq(notifications.type, params.type),
    gte(notifications.createdAt, cutoffIso),
  ] as const;

  const whereClause =
    params.entityId && params.entityType
      ? and(
          where[0],
          where[1],
          where[2],
          eq(notifications.entityType, params.entityType),
          eq(notifications.entityId, params.entityId)
        )
      : and(where[0], where[1], where[2]);

  const existing = await db
    .select({ id: notifications.id })
    .from(notifications)
    .where(whereClause)
    .limit(1);
  return existing.length > 0;
}

async function sendEmailNotification(params: {
  to: string;
  title: string;
  message: string;
  actionUrl?: string;
  actionLabel?: string;
}): Promise<void> {
  const actionText = params.actionUrl
    ? `\n\n${params.actionLabel || 'Open'}: ${params.actionUrl}\n`
    : '';

  const text = `${params.message}${actionText}`.trim();

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.5; color: #111;">
      <h2 style="margin: 0 0 12px; font-size: 18px;">${params.title}</h2>
      <p style="margin: 0 0 16px; white-space: pre-wrap;">${params.message}</p>
      ${
        params.actionUrl
          ? `<p style="margin: 0;"><a href="${params.actionUrl}" style="color: #10b981; text-decoration: none;">${
              params.actionLabel || 'Open'
            }</a></p>`
          : ''
      }
    </div>
  `.trim();

  await sendEmail({
    to: params.to,
    subject: params.title,
    html,
    text,
  });
}

/**
 * Create a new notification
 */
export async function createNotification(input: CreateNotificationInput) {
  try {
    // Load preferences to decide whether to create/deliver this notification
    const prefs = await getPreferencesForUser(input.userId);
    const typePrefs = resolveTypePreferences(prefs, input.type);

    if (!typePrefs.enabled) {
      return null;
    }

    // Rate limiting (best-effort; call sites may also do daily dedupe)
    const limited = await isRateLimited({
      userId: input.userId,
      type: input.type,
      entityType: input.entityType,
      entityId: input.entityId,
    });

    if (limited) {
      return null;
    }

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

    // Delivery (best-effort; never throw)
    const channels = typePrefs.channels;

    // Push delivery
    if (channels.includes('push') && prefs.pushNotificationsEnabled) {
      await sendPushNotification(input.userId, input.title, {
        body: input.message,
        data: {
          notificationId,
          type: input.type,
          actionUrl: input.actionUrl,
          entityType: input.entityType,
          entityId: input.entityId,
        },
      });
    }

    // Email delivery
    if (
      channels.includes('email') &&
      prefs.emailNotificationsEnabled &&
      typeof prefs.emailAddress === 'string' &&
      prefs.emailAddress.length > 3
    ) {
      try {
        await sendEmailNotification({
          to: prefs.emailAddress,
          title: input.title,
          message: input.message,
          actionUrl: input.actionUrl,
          actionLabel: input.actionLabel,
        });
      } catch (error) {
        console.error('[Notifications] Email delivery failed:', error);
      }
    }

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
      incomeLateAlertEnabled: true,
      incomeLateAlertDays: 1,
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
