import { createAuthClient } from "better-auth/react";

// Detect base URL at runtime - use browser's current origin on client side
// This allows the container to work with any URL without rebuilding
function getBaseURL(): string {
  // Client-side: use current browser URL
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  // Server-side: use env var or default
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}

export const betterAuthClient = createAuthClient({
  baseURL: getBaseURL(),
  basePath: "/api/better-auth", // Match server config
  fetchOptions: {
    credentials: "include", // Required for cookies to work
  },
});

// Export hooks and methods for easy access
export const {
  signIn,
  signUp,
  signOut,
  useSession,
} = betterAuthClient;
