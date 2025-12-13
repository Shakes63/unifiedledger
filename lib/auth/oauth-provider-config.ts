import { db } from '@/lib/db';
import { oauthSettings } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';

export type OAuthLoginProviderId = 'google' | 'github';

export async function isOAuthLoginProviderConfigured(providerId: OAuthLoginProviderId): Promise<boolean> {
  if (providerId === 'google') {
    if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) return true;
  }
  if (providerId === 'github') {
    if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) return true;
  }

  const rows = await db
    .select({
      clientId: oauthSettings.clientId,
      clientSecret: oauthSettings.clientSecret,
    })
    .from(oauthSettings)
    .where(and(eq(oauthSettings.providerId, providerId), eq(oauthSettings.enabled, true)))
    .limit(1);

  if (rows.length === 0) return false;
  return Boolean(rows[0].clientId && rows[0].clientSecret);
}

