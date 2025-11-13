import { requireAuth } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { notifications } from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import {
  createNotification,
  getUnreadCount,
  getOrCreatePreferences,
} from '@/lib/notifications/notification-service';

export const dynamic = 'force-dynamic';

// GET - List user's notifications with pagination
export async function GET(request: Request) {
  try {
    const { userId } = await requireAuth();

    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');
    const unreadOnly = url.searchParams.get('unreadOnly') === 'true';
    const type = url.searchParams.get('type');

    const conditions: any[] = [eq(notifications.userId, userId)];

    if (unreadOnly) {
      conditions.push(
        and(
          eq(notifications.isRead, false),
          eq(notifications.isDismissed, false)
        )
      );
    }

    if (type) {
      conditions.push(eq(notifications.type, type as any));
    }

    const userNotifications = await db
      .select()
      .from(notifications)
      .where(conditions.length === 1 ? conditions[0] : and(...(conditions as any)))
      .orderBy(desc(notifications.createdAt))
      .limit(limit)
      .offset(offset);

    const countResult = await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId));

    const unreadCount = await getUnreadCount(userId);

    return Response.json({
      data: userNotifications,
      total: countResult.length,
      unreadCount,
      limit,
      offset,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error fetching notifications:', error);
    return Response.json(
      { error: 'Failed to fetch notifications' },
      { status: 500 }
    );
  }
}

// POST - Create a new notification
export async function POST(request: Request) {
  try {
    const { userId } = await requireAuth();

    const body = await request.json();
    const {
      type,
      title,
      message,
      priority,
      actionUrl,
      entityType,
      entityId,
      actionLabel,
      isActionable,
      scheduledFor,
      metadata,
    } = body;

    // Validate required fields
    if (!type || !title || !message) {
      return Response.json(
        { error: 'Missing required fields: type, title, message' },
        { status: 400 }
      );
    }

    // Ensure user has notification preferences
    await getOrCreatePreferences(userId);

    const notificationId = await createNotification({
      userId,
      type,
      title,
      message,
      priority,
      actionUrl,
      entityType,
      entityId,
      actionLabel,
      isActionable,
      scheduledFor,
      metadata,
    });

    const created = await db
      .select()
      .from(notifications)
      .where(eq(notifications.id, notificationId))
      .limit(1);

    if (!created || created.length === 0) {
      return Response.json(
        { error: 'Failed to retrieve created notification' },
        { status: 500 }
      );
    }

    return Response.json(created[0], { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error creating notification:', error);
    return Response.json(
      { error: 'Failed to create notification' },
      { status: 500 }
    );
  }
}
