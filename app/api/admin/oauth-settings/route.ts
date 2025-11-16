import { NextRequest, NextResponse } from 'next/server';
import { requireOwner } from '@/lib/auth/owner-helpers';
import { db } from '@/lib/db';
import { oauthSettings } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { encryptOAuthSecret, decryptOAuthSecret } from '@/lib/encryption/oauth-encryption';
import { v4 as uuidv4 } from 'uuid';

/**
 * GET /api/admin/oauth-settings
 * Get OAuth provider configurations (owner only)
 * Returns decrypted client secrets
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

    // Decrypt client secrets before returning
    const decryptedSettings = settings.map((setting) => {
      try {
        const decryptedSecret = decryptOAuthSecret(setting.clientSecret);
        return {
          id: setting.id,
          providerId: setting.providerId,
          clientId: setting.clientId,
          clientSecret: decryptedSecret, // Return decrypted for owner
          enabled: setting.enabled,
          createdAt: setting.createdAt,
          updatedAt: setting.updatedAt,
        };
      } catch (error) {
        console.error(`[Admin API] Failed to decrypt secret for ${setting.providerId}:`, error);
        // Return encrypted secret if decryption fails (shouldn't happen)
        return {
          id: setting.id,
          providerId: setting.providerId,
          clientId: setting.clientId,
          clientSecret: '[DECRYPTION_ERROR]',
          enabled: setting.enabled,
          createdAt: setting.createdAt,
          updatedAt: setting.updatedAt,
        };
      }
    });

    return NextResponse.json({ providers: decryptedSettings });
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
    const { providerId, clientId, clientSecret, enabled } = body;

    // Validation
    if (!providerId || typeof providerId !== 'string') {
      return NextResponse.json(
        { error: 'providerId is required' },
        { status: 400 }
      );
    }

    if (!['google', 'github'].includes(providerId)) {
      return NextResponse.json(
        { error: 'providerId must be "google" or "github"' },
        { status: 400 }
      );
    }

    if (!clientId || typeof clientId !== 'string') {
      return NextResponse.json(
        { error: 'clientId is required' },
        { status: 400 }
      );
    }

    if (!clientSecret || typeof clientSecret !== 'string') {
      return NextResponse.json(
        { error: 'clientSecret is required' },
        { status: 400 }
      );
    }

    // Validate enabled flag if provided
    const isEnabled = enabled !== undefined ? Boolean(enabled) : true;

    // Encrypt client secret
    let encryptedSecret: string;
    try {
      encryptedSecret = encryptOAuthSecret(clientSecret);
    } catch (error) {
      console.error('[Admin API] Error encrypting secret:', error);
      return NextResponse.json(
        { error: 'Failed to encrypt client secret' },
        { status: 500 }
      );
    }

    // Check if setting already exists
    const existing = await db
      .select()
      .from(oauthSettings)
      .where(eq(oauthSettings.providerId, providerId))
      .limit(1);

    let result;
    if (existing.length > 0) {
      // Update existing setting
      const updated = await db
        .update(oauthSettings)
        .set({
          clientId,
          clientSecret: encryptedSecret,
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
          clientId,
          clientSecret: encryptedSecret,
          enabled: isEnabled,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        .returning();

      result = inserted[0];
    }

    // Return decrypted secret for response (owner can see it)
    return NextResponse.json({
      id: result.id,
      providerId: result.providerId,
      clientId: result.clientId,
      clientSecret: clientSecret, // Return original (not encrypted) for confirmation
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

