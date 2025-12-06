import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { account } from '@/auth-schema';
import { userSettings } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

/**
 * POST /api/user/oauth/set-primary
 * Set the primary login method for the user
 * Body: { providerId: "google" | "github" | "email" }
 */
export async function POST(request: NextRequest) {
  try {
    const authUser = await requireAuth();
    const userId = authUser.userId;
    const body = await request.json();
    const { providerId } = body;

    // Validate providerId
    const validProviders = ['email', 'google', 'github'];
    if (!providerId || !validProviders.includes(providerId)) {
      return NextResponse.json(
        { error: 'Invalid providerId. Must be one of: email, google, github' },
        { status: 400 }
      );
    }

    // If setting an OAuth provider as primary, verify it's linked
    if (providerId !== 'email') {
      const linkedAccount = await db
        .select()
        .from(account)
        .where(
          and(
            eq(account.userId, userId),
            eq(account.providerId, providerId)
          )
        )
        .limit(1);

      if (!linkedAccount || linkedAccount.length === 0) {
        return NextResponse.json(
          { error: `${providerId} account is not linked. Please link it first.` },
          { status: 400 }
        );
      }
    }

    // Update primary login method in user settings
    // First, check if user settings exist
    const existingSettings = await db
      .select()
      .from(userSettings)
      .where(eq(userSettings.userId, userId))
      .limit(1);

    if (existingSettings.length === 0) {
      // Create user settings if they don't exist
      await db.insert(userSettings).values({
        id: crypto.randomUUID(),
        userId,
        primaryLoginMethod: providerId,
      });
    } else {
      // Update existing settings
      await db
        .update(userSettings)
        .set({ primaryLoginMethod: providerId })
        .where(eq(userSettings.userId, userId));
    }

    return NextResponse.json({
      success: true,
      primaryLoginMethod: providerId,
      message: `Primary login method set to ${providerId}`,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error setting primary login method:', error);
    return NextResponse.json(
      { error: 'Failed to set primary login method' },
      { status: 500 }
    );
  }
}

