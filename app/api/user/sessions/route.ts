import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { session } from '@/auth-schema';
import { eq, desc } from 'drizzle-orm';
import { headers } from 'next/headers';
import { UAParser } from 'ua-parser-js';

export async function GET() {
  try {
    const authResult = await auth.api.getSession({
      headers: await headers(),
    });

    if (!authResult?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all sessions for user
    const userSessions = await db
      .select()
      .from(session)
      .where(eq(session.userId, authResult.user.id))
      .orderBy(desc(session.createdAt));

    // Get current session token to mark current session
    const currentSessionToken = authResult.session.token;

    // Parse user agent for device info
    const sessions = userSessions.map((s) => {
      const parser = new UAParser(s.userAgent || '');
      const ua = parser.getResult();

      let deviceInfo = 'Unknown Device';
      if (ua.browser.name && ua.os.name) {
        deviceInfo = `${ua.browser.name} on ${ua.os.name}`;
      } else if (ua.browser.name) {
        deviceInfo = ua.browser.name;
      } else if (ua.os.name) {
        deviceInfo = ua.os.name;
      }

      return {
        id: s.id,
        deviceInfo,
        ipAddress: s.ipAddress,
        location: null, // Future: GeoIP lookup
        lastActive: s.updatedAt,
        createdAt: s.createdAt,
        expiresAt: s.expiresAt,
        isCurrent: s.token === currentSessionToken,
      };
    });

    return NextResponse.json({ sessions });
  } catch (error) {
    console.error('Error fetching sessions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sessions' },
      { status: 500 }
    );
  }
}
