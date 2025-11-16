import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/user/oauth/available
 * Get list of available OAuth providers and their configuration status
 */
export async function GET() {
  try {
    const providers = [
      {
        id: 'google',
        name: 'Google',
        icon: 'google',
        enabled: !!(
          process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
        ),
        description: 'Sign in with your Google account',
      },
      {
        id: 'github',
        name: 'GitHub',
        icon: 'github',
        enabled: !!(
          process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET
        ),
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

