// Better Auth proxy for protecting routes
// Validates session against expiration and inactivity timeout
// NOTE: Renamed from middleware.ts to proxy.ts per Next.js 16 convention

import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";
import { validateSession, updateSessionActivity, deleteSessionByToken } from "@/lib/session-utils";
import { isTestMode, logTestModeWarning, TEST_SESSION_TOKEN } from "@/lib/test-mode";

// NOTE: Proxy always runs on Node.js runtime in Next.js 16+, no runtime config needed

/**
 * Activity update debouncing cache
 * Prevents excessive database writes by limiting updates to once per minute per session
 */
const activityUpdateCache = new Map<string, number>();
const ACTIVITY_UPDATE_INTERVAL = 60 * 1000; // 1 minute

export default async function proxy(request: NextRequest) {
  // ============================================================================
  // TEST MODE BYPASS
  // ============================================================================
  // When TEST_MODE=true, bypass all authentication checks
  // This allows immediate access to the app without logging in
  if (isTestMode()) {
    const pathname = request.nextUrl.pathname;
    
    // Log test mode access (only once per unique path to avoid spam)
    if (pathname.startsWith('/dashboard') || pathname.startsWith('/sign-in') || pathname.startsWith('/sign-up')) {
      logTestModeWarning(`middleware (${pathname})`);
    }
    
    // Redirect auth pages to dashboard in test mode
    if (pathname.startsWith('/sign-in') || pathname.startsWith('/sign-up')) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    
    // Allow access to all protected routes without session validation
    // The test session token will be used by API routes via auth helpers
    const response = NextResponse.next();
    
    // Set a test session cookie so the frontend can detect test mode
    // This cookie is used by the household context and other client-side code
    response.cookies.set('better-auth.test_mode', 'true', {
      httpOnly: false,
      secure: false,
      sameSite: 'lax',
      path: '/',
    });
    
    // Also set a fake session token for any code that checks for it
    response.cookies.set('better-auth.session_token', TEST_SESSION_TOKEN, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      path: '/',
    });
    
    return response;
  }

  // ============================================================================
  // NORMAL AUTHENTICATION FLOW
  // ============================================================================

  // Debug logging guard (set SESSION_DEBUG=1 to enable)
  const DEBUG = process.env.SESSION_DEBUG === "1";
  const debugLog = (...args: unknown[]) => {
    if (DEBUG) {
      console.log("[Proxy][Session]", ...args);
    }
  };

  // Determine if secure cookies are expected (same logic as lib/better-auth.ts)
  const expectSecureCookies =
    process.env.FORCE_SECURE_COOKIES === "true" ||
    process.env.NEXT_PUBLIC_APP_URL?.toLowerCase().startsWith("https://") ||
    false;

  // Use Better Auth's official cookie helper to extract session token
  // Try with expected secure cookie setting first, then fallback to the opposite
  // This handles cases where env vars might not be set consistently
  let sessionToken = getSessionCookie(request, {
    cookieName: "session_token",
    cookiePrefix: "better-auth",
    useSecureCookies: expectSecureCookies,
  });

  // Fallback: try the opposite secure cookie setting if first attempt failed
  if (!sessionToken) {
    sessionToken = getSessionCookie(request, {
      cookieName: "session_token",
      cookiePrefix: "better-auth",
      useSecureCookies: !expectSecureCookies,
    });
    if (sessionToken) {
      debugLog("Session token found with fallback cookie setting");
    }
  }

  // Log all cookie names for debugging (always log this for now)
  const allCookies = request.cookies.getAll();
  const cookieNames = allCookies.map(c => c.name);
  console.log("[Proxy][Session] All cookies:", cookieNames);
  console.log("[Proxy][Session] Session token extracted:", sessionToken ? "present" : "missing", { expectSecureCookies });

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
      if (DEBUG) {
        debugLog("Redirecting unauthenticated request", {
          path: request.nextUrl.pathname,
          reason: "no_token",
        });
      }
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

      if (DEBUG) {
        const now = Date.now();
        const lastActivityMs = validation.session?.lastActivityAt instanceof Date
          ? validation.session.lastActivityAt.getTime()
          : (validation.session?.lastActivityAt || 0);
        const lastActivityAgeMs = lastActivityMs ? (now - lastActivityMs) : undefined;
        debugLog("Redirecting invalid session", {
          path: request.nextUrl.pathname,
          reason: validation.reason,
          rememberMe: validation.session?.rememberMe ?? false,
          hasLastActivity: Boolean(validation.session?.lastActivityAt),
          lastActivityAgeMs,
        });
      }

      return response;
    }

    // Session is valid - update activity (debounced)
    // Always update if lastActivityAt is null or very old (> 2 minutes) to ensure it's initialized
    if (validation.session) {
      const sessionId = validation.session.id;
      const now = Date.now();
      const lastUpdate = activityUpdateCache.get(sessionId) || 0;
      
      // Check if lastActivityAt needs immediate update (null or very old)
      const lastActivityMs = validation.session.lastActivityAt instanceof Date 
        ? validation.session.lastActivityAt.getTime() 
        : (validation.session.lastActivityAt || 0);
      const needsImmediateUpdate = !lastActivityMs || (now - lastActivityMs) > 2 * 60 * 1000; // 2 minutes

      if (needsImmediateUpdate || (now - lastUpdate > ACTIVITY_UPDATE_INTERVAL)) {
        // Update activity asynchronously (don't block request)
        updateSessionActivity(sessionId).catch(err =>
          console.error('Failed to update session activity:', err)
        );
        activityUpdateCache.set(sessionId, now);
        debugLog("Updated session activity (debounced)", {
          path: request.nextUrl.pathname,
          needsImmediateUpdate,
        });
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
