import { NextResponse } from 'next/server';
import { isOAuthLoginProviderConfigured } from '@/lib/auth/oauth-provider-config';

export const dynamic = 'force-dynamic';

/**
 * GET /api/user/oauth/available
 * Get list of available OAuth providers and their configuration status
 */
export async function GET() {
  try {
    const [googleEnabled, githubEnabled] = await Promise.all([
      isOAuthLoginProviderConfigured('google'),
      isOAuthLoginProviderConfigured('github'),
    ]);

    const providers = [
      {
        id: 'google',
        name: 'Google',
        icon: 'google',
        enabled: googleEnabled,
        description: 'Sign in with your Google account',
      },
      {
        id: 'github',
        name: 'GitHub',
        icon: 'github',
        enabled: githubEnabled,
        description: 'Sign in with your GitHub account',
      },
    ];

    return NextResponse.json({
      providers,
    });
  } catch (error) {
    console.error('Error fetching available providers:', error);
    return NextResponse.json(
      { error: 'Failed to fetch available providers' },
      { status: 500 }
    );
  }
}
