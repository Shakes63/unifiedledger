// This middleware file uses Clerk's recommended approach for Next.js
// The deprecation warning can be safely ignored as Clerk's clerkMiddleware
// is the official recommended way to handle authentication in Next.js

import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

const isProtectedRoute = createRouteMatcher([
  '/dashboard(.*)',
  '/transactions(.*)',
  '/bills(.*)',
  '/budgets(.*)',
  '/settings(.*)',
]);

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: ['/((?!.*\\..*|_next).*)', '/', '/(api|trpc)(.*)'],
};
