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
  const sessionTokenCookie = request.cookies.get("better-auth.session_token");

  // Debug logging guard (set SESSION_DEBUG=1 to enable)
  const DEBUG = process.env.SESSION_DEBUG === "1";
  const debugLog = (...args: unknown[]) => {
    if (DEBUG) {
      // eslint-disable-next-line no-console
      console.log("[Middleware][Session]", ...args);
    }
  };

  // Extract token from session data if it exists
  let sessionToken: string | undefined;
  let tokenSource: string | undefined;
  if (sessionDataCookie?.value) {
    const raw = sessionDataCookie.value;
    const candidates: string[] = [];
    // Try all dot-delimited segments (JWT-like header.payload.signature) and full string
    const parts = raw.split(".");
    for (const part of parts) {
      if (part) candidates.push(part);
    }
    candidates.push(raw);

    for (let i = 0; i < candidates.length; i++) {
      const candidate = candidates[i]!;
      for (const encoding of ["base64url", "base64"] as const) {
        try {
          const decoded = Buffer.from(candidate, encoding).toString("utf-8");
          const obj = JSON.parse(decoded);
          // Probe common shapes
          const token =
            obj?.session?.session?.token ??
            obj?.session?.token ??
            obj?.token;
          if (typeof token === "string" && token.length > 0) {
            sessionToken = token;
            tokenSource = i < parts.length ? `session_data.part[${i}]` : "session_data.raw";
            break;
          }
        } catch {
          // Try next candidate/encoding silently
        }
      }
      if (sessionToken) break;
    }

    if (!sessionToken) {
      debugLog("Failed to extract token from session_data cookie");
    } else {
      debugLog("Extracted session token from", tokenSource);
    }
  }

  // Fallback: explicit token cookie if provided by provider
  if (!sessionToken && sessionTokenCookie?.value) {
    sessionToken = sessionTokenCookie.value;
    debugLog("Fell back to session_token cookie");
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
