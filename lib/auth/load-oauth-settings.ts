import { db } from '@/lib/db';
import { oauthSettings } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { decryptOAuthSecret } from '@/lib/encryption/oauth-encryption';

/**
 * OAuth Provider Configuration
 */
export interface OAuthProviderConfig {
  clientId: string;
  clientSecret: string;
}

/**
 * OAuth Settings from Database
 */
export interface DatabaseOAuthSettings {
  google?: OAuthProviderConfig;
  github?: OAuthProviderConfig;
  ticktick?: OAuthProviderConfig;
}

/**
 * Load OAuth settings from database
 * 
 * Returns OAuth provider configurations with decrypted secrets.
 * Returns null if no settings found or on error (fallback to env vars).
 * 
 * @returns OAuth settings object or null
 */
export async function loadOAuthSettingsFromDatabase(): Promise<DatabaseOAuthSettings | null> {
  try {
    // Query all enabled OAuth settings
    const settings = await db
      .select()
      .from(oauthSettings)
      .where(eq(oauthSettings.enabled, true));

    if (!settings || settings.length === 0) {
      // No settings in database, return null to use env vars
      return null;
    }

    const result: DatabaseOAuthSettings = {};

    // Process each provider
    for (const setting of settings) {
      try {
        // Decrypt client secret
        const decryptedSecret = decryptOAuthSecret(setting.clientSecret);

        // Add to result based on provider ID
        if (setting.providerId === 'google') {
          result.google = {
            clientId: setting.clientId,
            clientSecret: decryptedSecret,
          };
        } else if (setting.providerId === 'github') {
          result.github = {
            clientId: setting.clientId,
            clientSecret: decryptedSecret,
          };
        } else if (setting.providerId === 'ticktick') {
          result.ticktick = {
            clientId: setting.clientId,
            clientSecret: decryptedSecret,
          };
        }
      } catch (error) {
        console.error(
          `[OAuth Loader] Failed to decrypt secret for ${setting.providerId}:`,
          error
        );
        // Skip this provider if decryption fails
        continue;
      }
    }

    // Return null if no valid providers found
    if (Object.keys(result).length === 0) {
      return null;
    }

    return result;
  } catch (error) {
    console.error('[OAuth Loader] Error loading OAuth settings from database:', error);
    // Return null on error to fallback to env vars
    return null;
  }
}

