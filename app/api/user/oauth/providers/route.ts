import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-helpers';
import { isTestMode } from '@/lib/test-mode';
import { db } from '@/lib/db';
import { account } from '@/auth-schema';
import { userSettings } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

/**
 * GET /api/user/oauth/providers
 * Get list of linked OAuth providers for the current user
 */
export async function GET() {
  try {
    const authUser = await requireAuth();
    const userId = authUser.userId;

    // In test mode, return empty providers
    if (isTestMode()) {
      return NextResponse.json({
        providers: [],
        primaryLoginMethod: 'email',
      });
    }

    // Get all OAuth accounts for the user (exclude email/password accounts)
    const oauthAccounts = await db
      .select({
        providerId: account.providerId,
        accountId: account.accountId,
        createdAt: account.createdAt,
      })
      .from(account)
      .where(eq(account.userId, userId));

    // Filter out email/password accounts (they have providerId as "credential" or similar)
    // OAuth providers have providerId like "google", "github", etc.
    const oauthProviders = oauthAccounts.filter(
      (acc) => acc.providerId !== 'credential' && acc.providerId !== 'email'
    );

    // Get primary login method from user settings
    const settings = await db
      .select({
        primaryLoginMethod: userSettings.primaryLoginMethod,
      })
      .from(userSettings)
      .where(eq(userSettings.userId, userId))
      .limit(1);

    const primaryLoginMethod = settings[0]?.primaryLoginMethod || 'email';

    // Format providers with metadata
    const providers = oauthProviders.map((provider) => ({
      providerId: provider.providerId,
      accountId: provider.accountId,
      linkedAt: provider.createdAt?.toISOString() || new Date().toISOString(),
      isPrimary: primaryLoginMethod === provider.providerId,
    }));

    return NextResponse.json({
      providers,
      primaryLoginMethod,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error fetching OAuth providers:', error);
    return NextResponse.json(
      { error: 'Failed to fetch OAuth providers' },
      { status: 500 }
    );
  }
}

