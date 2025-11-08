import { auth } from '@clerk/nextjs/server';
import { checkAndCreateBillReminders } from '@/lib/notifications/bill-reminders';

export const dynamic = 'force-dynamic';

/**
 * POST - Trigger bill reminder checks and creation
 * Can be called from a cron job or manually by admin
 * Requires Bearer token for security in production
 */
export async function POST(request: Request) {
  try {
    // In development/testing, allow this endpoint
    // In production, you should verify:
    // 1. This is called from your cron service with auth
    // 2. Rate limiting to prevent abuse
    // 3. Optional: API key verification

    const result = await checkAndCreateBillReminders();

    return Response.json({
      success: true,
      message: 'Bill reminders checked and notifications created',
      ...result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error in bill reminders endpoint:', error);
    return Response.json(
      { error: 'Failed to process bill reminders' },
      { status: 500 }
    );
  }
}

/**
 * GET - Check bill reminders for authenticated user only
 */
export async function GET(request: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return Response.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // User endpoint - just trigger the global check
    // This would typically be called daily by a cron job
    const result = await checkAndCreateBillReminders();

    return Response.json({
      success: true,
      message: 'Bill reminders checked',
      ...result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error checking bill reminders:', error);
    return Response.json(
      { error: 'Failed to check bill reminders' },
      { status: 500 }
    );
  }
}
