import { NextRequest, NextResponse } from 'next/server';
import { requireOwner } from '@/lib/auth/owner-helpers';
import { db } from '@/lib/db';
import { oauthSettings } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { encryptOAuthSecret } from '@/lib/encryption/oauth-encryption';
import { v4 as uuidv4 } from 'uuid';

/**
 * GET /api/admin/oauth-settings
 * Get OAuth provider configurations (owner only)
 * Note: Client secrets are write-only and are never returned to the client.
 */
export async function GET() {
  try {
    // Verify owner access
    await requireOwner();

    // Query all OAuth settings
    const settings = await db
      .select()
      .from(oauthSettings)
      .orderBy(oauthSettings.providerId);

    return NextResponse.json({
      providers: settings.map((setting) => ({
        id: setting.id,
        providerId: setting.providerId,
        clientId: setting.clientId,
        hasClientSecret: Boolean(setting.clientSecret && setting.clientSecret.trim().length > 0),
        enabled: setting.enabled,
        createdAt: setting.createdAt,
        updatedAt: setting.updatedAt,
      })),
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    if (error instanceof Error && error.message.includes('Forbidden')) {
      return NextResponse.json(
        { error: 'Forbidden: Owner access required' },
        { status: 403 }
      );
    }
    console.error('[Admin API] Error fetching OAuth settings:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/oauth-settings
 * Update OAuth provider configuration (owner only)
 * Encrypts client secret before storing
 */
export async function POST(request: NextRequest) {
  try {
    // Verify owner access
    await requireOwner();

    const body = await request.json();
    const { providerId, clientId, clientSecret, enabled } = body as {
      providerId?: string;
      clientId?: string;
      clientSecret?: string;
      enabled?: boolean;
    };

    // Validation
    if (!providerId || typeof providerId !== 'string') {
      return NextResponse.json(
        { error: 'providerId is required' },
        { status: 400 }
      );
    }

    if (!['google', 'github', 'ticktick'].includes(providerId)) {
      return NextResponse.json(
        { error: 'providerId must be "google", "github", or "ticktick"' },
        { status: 400 }
      );
    }

    // Validate enabled flag if provided
    const isEnabled = enabled !== undefined ? Boolean(enabled) : true;

    // Check if setting already exists
    const existing = await db
      .select()
      .from(oauthSettings)
      .where(eq(oauthSettings.providerId, providerId))
      .limit(1);

    const previous = existing[0];
    const previousClientId = previous?.clientId;
    const previousEncryptedSecret = previous?.clientSecret;

    const trimmedClientId = typeof clientId === 'string' ? clientId.trim() : '';
    const trimmedClientSecret = typeof clientSecret === 'string' ? clientSecret.trim() : '';

    const finalClientId = trimmedClientId || previousClientId || '';
    const hasAnySecret = Boolean(trimmedClientSecret || (previousEncryptedSecret && previousEncryptedSecret.trim().length > 0));

    // Enabling requires a clientId and some secret (either newly provided or already stored)
    if (isEnabled) {
      if (!finalClientId) {
        return NextResponse.json(
          { error: 'clientId is required' },
          { status: 400 }
        );
      }
      if (!hasAnySecret) {
        return NextResponse.json(
          { error: 'clientSecret is required' },
          { status: 400 }
        );
      }
    } else if (!previous) {
      // Disabling without an existing record isn't meaningful (and schema requires non-empty fields)
      return NextResponse.json(
        { error: 'Cannot disable provider that has no saved settings' },
        { status: 400 }
      );
    }

    // Encrypt client secret if provided (write-only)
    let encryptedSecret: string | undefined;
    if (trimmedClientSecret) {
      try {
        encryptedSecret = encryptOAuthSecret(trimmedClientSecret);
      } catch (error) {
        console.error('[Admin API] Error encrypting secret:', error);
        return NextResponse.json(
          { error: 'Failed to encrypt client secret' },
          { status: 500 }
        );
      }
    }

    let result;
    if (existing.length > 0) {
      // Update existing setting
      const updated = await db
        .update(oauthSettings)
        .set({
          clientId: finalClientId,
          clientSecret: encryptedSecret || previous.clientSecret,
          enabled: isEnabled,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(oauthSettings.providerId, providerId))
        .returning();

      result = updated[0];
    } else {
      // Create new setting
      const inserted = await db
        .insert(oauthSettings)
        .values({
          id: uuidv4(),
          providerId,
          clientId: finalClientId,
          clientSecret: encryptedSecret!,
          enabled: isEnabled,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        .returning();

      result = inserted[0];
    }

    // Secrets are write-only; never return them.
    return NextResponse.json({
      id: result.id,
      providerId: result.providerId,
      clientId: result.clientId,
      hasClientSecret: Boolean(result.clientSecret && result.clientSecret.trim().length > 0),
      enabled: result.enabled,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    if (error instanceof Error && error.message.includes('Forbidden')) {
      return NextResponse.json(
        { error: 'Forbidden: Owner access required' },
        { status: 403 }
      );
    }
    console.error('[Admin API] Error updating OAuth settings:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
