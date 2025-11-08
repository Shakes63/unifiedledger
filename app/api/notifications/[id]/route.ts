import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { notifications } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { markAsRead, markAsDismissed } from '@/lib/notifications/notification-service';

export const dynamic = 'force-dynamic';

// GET - Get a specific notification
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    const { id } = await params;

    if (!userId) {
      return Response.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const notification = await db
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.id, id),
          eq(notifications.userId, userId)
        )
      )
      .limit(1);

    if (notification.length === 0) {
      return Response.json(
        { error: 'Notification not found' },
        { status: 404 }
      );
    }

    return Response.json(notification[0]);
  } catch (error) {
    console.error('Error fetching notification:', error);
    return Response.json(
      { error: 'Failed to fetch notification' },
      { status: 500 }
    );
  }
}

// PATCH - Mark notification as read or dismissed
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    const { id } = await params;

    if (!userId) {
      return Response.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { isRead, isDismissed } = body;

    // Verify notification exists and belongs to user
    const notification = await db
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.id, id),
          eq(notifications.userId, userId)
        )
      )
      .limit(1);

    if (notification.length === 0) {
      return Response.json(
        { error: 'Notification not found' },
        { status: 404 }
      );
    }

    if (isRead === true) {
      await markAsRead(id, userId);
    }

    if (isDismissed === true) {
      await markAsDismissed(id, userId);
    }

    const updated = await db
      .select()
      .from(notifications)
      .where(eq(notifications.id, id))
      .limit(1);

    return Response.json(updated[0]);
  } catch (error) {
    console.error('Error updating notification:', error);
    return Response.json(
      { error: 'Failed to update notification' },
      { status: 500 }
    );
  }
}

// DELETE - Delete a notification
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    const { id } = await params;

    if (!userId) {
      return Response.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Verify notification exists and belongs to user
    const notification = await db
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.id, id),
          eq(notifications.userId, userId)
        )
      )
      .limit(1);

    if (notification.length === 0) {
      return Response.json(
        { error: 'Notification not found' },
        { status: 404 }
      );
    }

    await db
      .delete(notifications)
      .where(eq(notifications.id, id));

    return Response.json(
      { message: 'Notification deleted' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error deleting notification:', error);
    return Response.json(
      { error: 'Failed to delete notification' },
      { status: 500 }
    );
  }
}
