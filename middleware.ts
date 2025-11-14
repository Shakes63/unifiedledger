// Better Auth middleware for protecting routes
// Validates session against expiration and inactivity timeout

import { NextResponse, type NextRequest } from "next/server";
import { validateSession, updateSessionActivity, deleteSessionByToken } from "@/lib/session-utils";

// Use Node.js runtime instead of Edge runtime (required for better-sqlite3)
export const runtime = 'nodejs';

/**
 * Activity update debouncing cache
 * Prevents excessive database writes by limiting updates to once per minute per session
 */
const activityUpdateCache = new Map<string, number>();
const ACTIVITY_UPDATE_INTERVAL = 60 * 1000; // 1 minute

export default async function middleware(request: NextRequest) {
  // Check if Better Auth session cookie exists
  // Better Auth stores the full session data in this cookie
  const sessionDataCookie = request.cookies.get("better-auth.session_data");

  // Extract token from session data if it exists
  let sessionToken: string | undefined;
  if (sessionDataCookie?.value) {
    try {
      const sessionData = JSON.parse(atob(sessionDataCookie.value.split('.')[0]));
      sessionToken = sessionData?.session?.session?.token;
    } catch (e) {
      console.error('[Middleware] Failed to parse session cookie:', e);
    }
  }

  // Define protected routes
  const isProtectedRoute =
    request.nextUrl.pathname.startsWith("/dashboard") ||
    request.nextUrl.pathname.startsWith("/transactions") ||
    request.nextUrl.pathname.startsWith("/bills") ||
    request.nextUrl.pathname.startsWith("/budgets") ||
    request.nextUrl.pathname.startsWith("/settings");

  // Handle protected routes
  if (isProtectedRoute) {
    if (!sessionToken) {
      // No session cookie - redirect to sign-in
      const signInUrl = new URL("/sign-in", request.url);
      signInUrl.searchParams.set("callbackUrl", request.nextUrl.pathname);
      return NextResponse.redirect(signInUrl);
    }

    // Validate session against database
    const validation = await validateSession(sessionToken);

    if (!validation.valid) {
      // Session is invalid - delete and redirect
      if (validation.session) {
        await deleteSessionByToken(sessionToken);
      }

      const signInUrl = new URL("/sign-in", request.url);
      signInUrl.searchParams.set("callbackUrl", request.nextUrl.pathname);

      // Add reason to URL for better UX
      if (validation.reason === 'inactive') {
        signInUrl.searchParams.set("reason", "timeout");
      } else if (validation.reason === 'expired') {
        signInUrl.searchParams.set("reason", "expired");
      }

      // Create response and clear session cookie
      const response = NextResponse.redirect(signInUrl);
      response.cookies.delete("better-auth.session_data");
      response.cookies.delete("better-auth.session_token");

      return response;
    }

    // Session is valid - update activity (debounced)
    if (validation.session) {
      const sessionId = validation.session.id;
      const now = Date.now();
      const lastUpdate = activityUpdateCache.get(sessionId) || 0;

      if (now - lastUpdate > ACTIVITY_UPDATE_INTERVAL) {
        // Update activity asynchronously (don't block request)
        updateSessionActivity(sessionId).catch(err =>
          console.error('Failed to update session activity:', err)
        );
        activityUpdateCache.set(sessionId, now);
      }
    }
  }

  // Redirect to dashboard if accessing auth pages with valid session
  if (request.nextUrl.pathname.startsWith("/sign-in") ||
      request.nextUrl.pathname.startsWith("/sign-up")) {
    if (sessionToken) {
      const validation = await validateSession(sessionToken);
      if (validation.valid) {
        return NextResponse.redirect(new URL("/dashboard", request.url));
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};
