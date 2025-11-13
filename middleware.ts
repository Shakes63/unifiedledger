// Better Auth middleware for protecting routes
// Checks for valid session cookie and redirects to sign-in if not authenticated

import { NextResponse, type NextRequest } from "next/server";

export default async function middleware(request: NextRequest) {
  // Check if Better Auth session cookie exists
  const sessionCookie = request.cookies.get("better-auth.session_token");
  const hasSession = !!sessionCookie;

  // Define protected routes
  const isProtectedRoute =
    request.nextUrl.pathname.startsWith("/dashboard") ||
    request.nextUrl.pathname.startsWith("/transactions") ||
    request.nextUrl.pathname.startsWith("/bills") ||
    request.nextUrl.pathname.startsWith("/budgets") ||
    request.nextUrl.pathname.startsWith("/settings");

  // Redirect to sign-in if accessing protected route without session cookie
  if (isProtectedRoute && !hasSession) {
    const signInUrl = new URL("/sign-in", request.url);
    signInUrl.searchParams.set("callbackUrl", request.nextUrl.pathname);
    return NextResponse.redirect(signInUrl);
  }

  // Redirect to dashboard if accessing auth pages with active session
  if ((request.nextUrl.pathname.startsWith("/sign-in") ||
       request.nextUrl.pathname.startsWith("/sign-up")) && hasSession) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};
