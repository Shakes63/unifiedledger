import { createAuthClient } from "better-auth/react";

export const betterAuthClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  basePath: "/api/better-auth", // Match server config
});

// Export hooks and methods for easy access
export const {
  signIn,
  signUp,
  signOut,
  useSession,
} = betterAuthClient;
