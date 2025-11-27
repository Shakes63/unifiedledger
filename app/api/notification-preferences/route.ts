import { requireAuth } from '@/lib/auth-helpers';
import { getOrCreatePreferences, updatePreferences } from '@/lib/notifications/notification-service';

export const dynamic = 'force-dynamic';

// GET - Get user's notification preferences
export async function GET(_request: Request) {
  try {
    const { userId } = await requireAuth();

    const preferences = await getOrCreatePreferences(userId);

    return Response.json(preferences);
  } catch (error) {
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

    const body = await request.json();

    // Validate preferences fields
    const validFields = [
      'billReminderEnabled',
      'billReminderDaysBefore',
      'billReminderOnDueDate',
      'billOverdueReminder',
      'budgetWarningEnabled',
      'budgetWarningThreshold',
      'budgetExceededAlert',
      'lowBalanceAlertEnabled',
      'lowBalanceThreshold',
      'savingsMilestoneEnabled',
      'debtMilestoneEnabled',
      'weeklySummaryEnabled',
      'weeklySummaryDay',
      'monthlySummaryEnabled',
      'monthlySummaryDay',
      'pushNotificationsEnabled',
      'emailNotificationsEnabled',
      'emailAddress',
      'quietHoursStart',
      'quietHoursEnd',
    ];

    const updates: Record<string, any> = {};

    for (const key of Object.keys(body)) {
      if (validFields.includes(key)) {
        updates[key] = body[key];
      }
    }

    if (Object.keys(updates).length === 0) {
      return Response.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    await updatePreferences(userId, updates);

    const updated = await getOrCreatePreferences(userId);

    return Response.json(updated);
  } catch (error) {
    console.error('Error updating notification preferences:', error);
    return Response.json(
      { error: 'Failed to update notification preferences' },
      { status: 500 }
    );
  }
}
