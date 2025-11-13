// Better Auth middleware for protecting routes
// Checks for valid session and redirects to sign-in if not authenticated

import { betterFetch } from "@better-fetch/fetch";
import type { Session } from "better-auth/types";
import { NextResponse, type NextRequest } from "next/server";

export default async function middleware(request: NextRequest) {
  const { data: session } = await betterFetch<Session>(
    "/api/better-auth/get-session",
    {
      baseURL: request.nextUrl.origin,
      headers: {
        cookie: request.headers.get("cookie") || "",
      },
    }
  );

  // Define protected routes
  const isProtectedRoute =
    request.nextUrl.pathname.startsWith("/dashboard") ||
    request.nextUrl.pathname.startsWith("/transactions") ||
    request.nextUrl.pathname.startsWith("/bills") ||
    request.nextUrl.pathname.startsWith("/budgets") ||
    request.nextUrl.pathname.startsWith("/settings");

  // Redirect to sign-in if accessing protected route without session
  if (isProtectedRoute && !session) {
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }

  // Redirect to dashboard if accessing auth pages with active session
  if ((request.nextUrl.pathname.startsWith("/sign-in") ||
       request.nextUrl.pathname.startsWith("/sign-up")) && session) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};
