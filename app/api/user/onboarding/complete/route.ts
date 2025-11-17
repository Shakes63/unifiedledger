import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { userSettings } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';

export const dynamic = 'force-dynamic';

/**
 * POST /api/user/onboarding/complete
 * Mark user's onboarding as complete
 */
export async function POST() {
  try {
    const { userId } = await requireAuth();

    // Check if user settings exist
    const existingSettings = await db
      .select()
      .from(userSettings)
      .where(eq(userSettings.userId, userId))
      .limit(1);

    if (existingSettings && existingSettings.length > 0) {
      // Update existing settings
      await db
        .update(userSettings)
        .set({
          onboardingCompleted: true,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(userSettings.userId, userId));
    } else {
      // Create new settings record with onboarding completed
      await db.insert(userSettings).values({
        id: nanoid(),
        userId,
        onboardingCompleted: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Failed to mark onboarding complete:', error);
    return NextResponse.json(
      { error: 'Failed to mark onboarding complete' },
      { status: 500 }
    );
  }
}

