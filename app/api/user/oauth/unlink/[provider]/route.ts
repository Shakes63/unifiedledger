import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { account } from '@/auth-schema';
import { userSettings } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { headers } from 'next/headers';

export const dynamic = 'force-dynamic';

/**
 * DELETE /api/user/oauth/unlink/[provider]
 * Unlink an OAuth provider from the user's account
 * Prevents unlinking if it's the last login method
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ provider: string }> }
) {
  try {
    const authResult = await auth.api.getSession({
      headers: await headers(),
    });

    if (!authResult?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = authResult.user.id;
    const { provider } = await params;

    // Validate provider
    const validProviders = ['google', 'github'];
    if (!validProviders.includes(provider)) {
      return NextResponse.json(
        { error: 'Invalid provider. Supported providers: google, github' },
        { status: 400 }
      );
    }

    // Check if provider is linked
    const linkedAccount = await db
      .select()
      .from(account)
      .where(
        and(
          eq(account.userId, userId),
          eq(account.providerId, provider)
        )
      )
      .limit(1);

    if (!linkedAccount || linkedAccount.length === 0) {
      return NextResponse.json(
        { error: `${provider} account is not linked` },
        { status: 404 }
      );
    }

    // Count all login methods for the user
    // Get all accounts for the user
    const allAccounts = await db
      .select({
        providerId: account.providerId,
      })
      .from(account)
      .where(eq(account.userId, userId));

    // Count email/password accounts (providerId = 'credential')
    const emailPasswordCount = allAccounts.filter(
      (acc) => acc.providerId === 'credential'
    ).length;

    // Count OAuth accounts (excluding credential)
    const oauthCount = allAccounts.filter(
      (acc) => acc.providerId !== 'credential' && acc.providerId !== 'email'
    ).length;

    // Total login methods = email/password + OAuth accounts
    const totalLoginMethods = emailPasswordCount + oauthCount;

    // Prevent unlinking if it's the last login method
    if (totalLoginMethods <= 1) {
      return NextResponse.json(
        {
          error: 'Cannot unlink your last login method. Please ensure you have at least one login method (email/password or another OAuth provider).',
        },
        { status: 400 }
      );
    }

    // Delete the OAuth account
    await db
      .delete(account)
      .where(
        and(
          eq(account.userId, userId),
          eq(account.providerId, provider)
        )
      );

    // If unlinked provider was primary, set email as primary
    const settings = await db
      .select({
        primaryLoginMethod: userSettings.primaryLoginMethod,
      })
      .from(userSettings)
      .where(eq(userSettings.userId, userId))
      .limit(1);

    if (settings[0]?.primaryLoginMethod === provider) {
      await db
        .update(userSettings)
        .set({ primaryLoginMethod: 'email' })
        .where(eq(userSettings.userId, userId));
    }

    return NextResponse.json({
      success: true,
      message: `${provider} account unlinked successfully`,
    });
  } catch (error) {
    console.error('Error unlinking OAuth provider:', error);
    return NextResponse.json(
      { error: 'Failed to unlink OAuth provider' },
      { status: 500 }
    );
  }
}

