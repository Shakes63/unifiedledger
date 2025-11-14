import { requireAuth } from '@/lib/auth-helpers';
import {
  getOrCreatePreferences,
  updatePreferences,
} from '@/lib/notifications/notification-service';

export const dynamic = 'force-dynamic';

// Valid notification channels (extendable for future channels)
const VALID_CHANNELS = ['push', 'email'];

/**
 * Validate channel array format and content
 */
function validateChannels(channels: any, fieldName: string): string | null {
  if (channels === undefined) return null;

  // If it's a string, try to parse it as JSON
  let parsedChannels = channels;
  if (typeof channels === 'string') {
    try {
      parsedChannels = JSON.parse(channels);
    } catch {
      return `${fieldName} must be a valid JSON array`;
    }
  }

  if (!Array.isArray(parsedChannels)) {
    return `${fieldName} must be an array`;
  }

  if (parsedChannels.length === 0) {
    return `${fieldName} must have at least one channel`;
  }

  const invalidChannels = parsedChannels.filter(
    (ch) => !VALID_CHANNELS.includes(ch)
  );

  if (invalidChannels.length > 0) {
    return `${fieldName} contains invalid channels: ${invalidChannels.join(', ')}. Valid channels: ${VALID_CHANNELS.join(', ')}`;
  }

  return null;
}

/**
 * GET - Fetch user's notification preferences
 * Auto-creates preferences with defaults if they don't exist
 */
export async function GET(request: Request) {
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

/**
 * PATCH - Update user's notification preferences
 * Only updates fields provided in request body
 */
export async function PATCH(request: Request) {
  try {
    const { userId } = await requireAuth();

    const body = await request.json();

    // Validate body is an object
    if (!body || typeof body !== 'object') {
      return Response.json(
        { error: 'Request body must be an object' },
        { status: 400 }
      );
    }

    // Validate channel fields if provided
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
    ];

    for (const field of channelFields) {
      if (body[field] !== undefined) {
        const error = validateChannels(body[field], field);
        if (error) {
          return Response.json({ error }, { status: 400 });
        }
        // Ensure it's stored as JSON string
        if (Array.isArray(body[field])) {
          body[field] = JSON.stringify(body[field]);
        }
      }
    }

    // Validate specific fields if provided
    if (
      body.billReminderDaysBefore !== undefined &&
      (body.billReminderDaysBefore < 1 || body.billReminderDaysBefore > 14)
    ) {
      return Response.json(
        { error: 'billReminderDaysBefore must be between 1 and 14' },
        { status: 400 }
      );
    }

    if (
      body.budgetWarningThreshold !== undefined &&
      (body.budgetWarningThreshold < 50 || body.budgetWarningThreshold > 100)
    ) {
      return Response.json(
        { error: 'budgetWarningThreshold must be between 50 and 100' },
        { status: 400 }
      );
    }

    if (
      body.lowBalanceThreshold !== undefined &&
      body.lowBalanceThreshold < 0
    ) {
      return Response.json(
        { error: 'lowBalanceThreshold must be greater than or equal to 0' },
        { status: 400 }
      );
    }

    if (
      body.monthlySummaryDay !== undefined &&
      (body.monthlySummaryDay < 1 || body.monthlySummaryDay > 28)
    ) {
      return Response.json(
        { error: 'monthlySummaryDay must be between 1 and 28' },
        { status: 400 }
      );
    }

    if (
      body.weeklySummaryDay !== undefined &&
      ![
        'sunday',
        'monday',
        'tuesday',
        'wednesday',
        'thursday',
        'friday',
        'saturday',
      ].includes(body.weeklySummaryDay.toLowerCase())
    ) {
      return Response.json(
        { error: 'weeklySummaryDay must be a valid day of the week' },
        { status: 400 }
      );
    }

    // Basic email validation if emailNotificationsEnabled
    if (
      body.emailNotificationsEnabled &&
      body.emailAddress &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.emailAddress)
    ) {
      return Response.json(
        { error: 'Invalid email address format' },
        { status: 400 }
      );
    }

    // Time format validation for quiet hours (HH:mm)
    const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
    if (body.quietHoursStart && !timeRegex.test(body.quietHoursStart)) {
      return Response.json(
        { error: 'quietHoursStart must be in HH:mm format (24-hour)' },
        { status: 400 }
      );
    }

    if (body.quietHoursEnd && !timeRegex.test(body.quietHoursEnd)) {
      return Response.json(
        { error: 'quietHoursEnd must be in HH:mm format (24-hour)' },
        { status: 400 }
      );
    }

    // Remove fields that shouldn't be updated via API
    const { id, userId: bodyUserId, createdAt, ...updates } = body;

    // Update preferences
    await updatePreferences(userId, updates);

    // Fetch and return updated preferences
    const updatedPreferences = await getOrCreatePreferences(userId);

    return Response.json(updatedPreferences);
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
