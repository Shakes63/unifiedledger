import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-helpers';
import { isTestMode } from '@/lib/test-mode';
import { db } from '@/lib/db';
import { session } from '@/auth-schema';
import { eq, desc } from 'drizzle-orm';
import { UAParser } from 'ua-parser-js';
import { formatLocation } from '@/lib/geoip/geoip-service';

export async function GET() {
  try {
    const authUser = await requireAuth();
    const userId = authUser.userId;

    // In test mode, return mock sessions data
    if (isTestMode()) {
      return NextResponse.json({
        sessions: [{
          id: 'test-session-1',
          deviceInfo: 'Test Browser on Test OS',
          ipAddress: '127.0.0.1',
          location: 'Local Device',
          city: null,
          region: null,
          country: null,
          countryCode: null,
          lastActive: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 86400000).toISOString(),
          isCurrent: true,
        }],
      });
    }

    // Get all sessions for user
    const userSessions = await db
      .select()
      .from(session)
      .where(eq(session.userId, userId))
      .orderBy(desc(session.createdAt));

    // Get current session token to mark current session (from authUser.session if available)
    const currentSessionToken = authUser.session?.token || '';

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

      // Format location from GeoIP data
      const location = formatLocation({
        city: s.city,
        region: s.region,
        country: s.country,
        countryCode: s.countryCode,
      });

      return {
        id: s.id,
        deviceInfo,
        ipAddress: s.ipAddress,
        location,
        city: s.city,
        region: s.region,
        country: s.country,
        countryCode: s.countryCode,
        lastActive: s.updatedAt,
        createdAt: s.createdAt,
        expiresAt: s.expiresAt,
        isCurrent: s.token === currentSessionToken,
      };
    });

    return NextResponse.json({ sessions });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error fetching sessions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sessions' },
      { status: 500 }
    );
  }
}
