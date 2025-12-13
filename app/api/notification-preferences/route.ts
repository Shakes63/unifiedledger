import { requireAuth } from '@/lib/auth-helpers';
import { getOrCreatePreferences, updatePreferences } from '@/lib/notifications/notification-service';

export const dynamic = 'force-dynamic';

type NotificationChannel = 'push' | 'email';
const VALID_CHANNELS: NotificationChannel[] = ['push', 'email'];

function parseChannels(value: unknown): { json: string } | { error: string } {
  if (value === undefined) return { error: 'channels value is undefined' };

  let parsed: unknown = value;
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value);
    } catch {
      return { error: 'must be a valid JSON array' };
    }
  }

  if (!Array.isArray(parsed)) return { error: 'must be an array' };
  if (parsed.length === 0) return { error: 'must have at least one channel' };

  const invalid = parsed.filter((c) => !VALID_CHANNELS.includes(c as NotificationChannel));
  if (invalid.length > 0) {
    return { error: `contains invalid channels: ${invalid.join(', ')}` };
  }

  return { json: JSON.stringify(parsed) };
}

// GET - Get user's notification preferences
export async function GET(_request: Request) {
  try {
    const { userId } = await requireAuth();

    const preferences = await getOrCreatePreferences(userId);

    return Response.json(preferences);
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error fetching notification preferences:', error);
    return Response.json(
      { error: 'Failed to fetch notification preferences' },
      { status: 500 }
    );
  }
}

// PATCH - Update user's notification preferences
export async function PATCH(request: Request) {
  try {
    const { userId } = await requireAuth();

    const body: unknown = await request.json();
    if (!body || typeof body !== 'object') {
      return Response.json({ error: 'Request body must be an object' }, { status: 400 });
    }

    // Validate preferences fields
    const validFields = [
      'billReminderEnabled',
      'billReminderDaysBefore',
      'billReminderOnDueDate',
      'billOverdueReminder',
      'billReminderChannels',
      'budgetWarningEnabled',
      'budgetWarningThreshold',
      'budgetExceededAlert',
      'budgetWarningChannels',
      'budgetExceededChannels',
      'budgetReviewEnabled',
      'budgetReviewChannels',
      'lowBalanceAlertEnabled',
      'lowBalanceThreshold',
      'lowBalanceChannels',
      'savingsMilestoneEnabled',
      'savingsMilestoneChannels',
      'debtMilestoneEnabled',
      'debtMilestoneChannels',
      'weeklySummaryEnabled',
      'weeklySummaryDay',
      'weeklySummaryChannels',
      'monthlySummaryEnabled',
      'monthlySummaryDay',
      'monthlySummaryChannels',
      'incomeLateAlertEnabled',
      'incomeLateAlertDays',
      'incomeLateChannels',
      'pushNotificationsEnabled',
      'emailNotificationsEnabled',
      'emailAddress',
      'quietHoursStart',
      'quietHoursEnd',
    ];

    const updates: Record<string, unknown> = {};
    const bodyObj = body as Record<string, unknown>;

    for (const key of Object.keys(bodyObj)) {
      if (validFields.includes(key)) {
        updates[key] = bodyObj[key];
      }
    }

    if (Object.keys(updates).length === 0) {
      return Response.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    // Validate & normalize channel arrays
    const channelFields = [
      'billReminderChannels',
      'budgetWarningChannels',
      'budgetExceededChannels',
      'budgetReviewChannels',
      'lowBalanceChannels',
      'savingsMilestoneChannels',
      'debtMilestoneChannels',
      'weeklySummaryChannels',
      'monthlySummaryChannels',
      'incomeLateChannels',
    ];

    for (const field of channelFields) {
      if (updates[field] !== undefined) {
        const parsed = parseChannels(updates[field]);
        if ('error' in parsed) {
          return Response.json({ error: `${field} ${parsed.error}` }, { status: 400 });
        }
        updates[field] = parsed.json;
      }
    }

    // Basic email validation if email notifications enabled
    if (updates.emailNotificationsEnabled === true) {
      const emailAddress = updates.emailAddress;
      if (typeof emailAddress !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailAddress)) {
        return Response.json({ error: 'Invalid email address format' }, { status: 400 });
      }
    }

    await updatePreferences(userId, updates);

    const updated = await getOrCreatePreferences(userId);

    return Response.json(updated);
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error updating notification preferences:', error);
    return Response.json(
      { error: 'Failed to update notification preferences' },
      { status: 500 }
    );
  }
}
