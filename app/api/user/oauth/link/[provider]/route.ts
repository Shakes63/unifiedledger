import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { headers } from 'next/headers';

export const dynamic = 'force-dynamic';

/**
 * POST /api/user/oauth/link/[provider]
 * Validate OAuth provider and return configuration info
 * Note: Actual OAuth linking is handled by Better Auth client methods
 * Frontend should call: betterAuthClient.oauth2.link({ providerId, callbackURL })
 */
export async function POST(
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

    const { provider } = await params;

    // Validate provider
    const validProviders = ['google', 'github'];
    if (!validProviders.includes(provider)) {
      return NextResponse.json(
        { error: 'Invalid provider. Supported providers: google, github' },
        { status: 400 }
      );
    }

    // Check if provider is configured
    const envVarMap: Record<string, { id: string; secret: string }> = {
      google: {
        id: process.env.GOOGLE_CLIENT_ID || '',
        secret: process.env.GOOGLE_CLIENT_SECRET || '',
      },
      github: {
        id: process.env.GITHUB_CLIENT_ID || '',
        secret: process.env.GITHUB_CLIENT_SECRET || '',
      },
    };

    const providerConfig = envVarMap[provider];
    if (!providerConfig.id || !providerConfig.secret) {
      return NextResponse.json(
        { error: `${provider} OAuth is not configured` },
        { status: 400 }
      );
    }

    // Return success - actual linking happens via Better Auth client
    return NextResponse.json({
      success: true,
      providerId: provider,
      message: 'Provider is configured. Use Better Auth client to initiate OAuth flow.',
    });
  } catch (error) {
    console.error('Error validating OAuth provider:', error);
    return NextResponse.json(
      { error: 'Failed to validate OAuth provider' },
      { status: 500 }
    );
  }
}

