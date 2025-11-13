import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/lib/db";
import * as authSchema from "@/auth-schema";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "sqlite",
    schema: authSchema,
  }),
  // Use different base path to avoid conflicts with Clerk
  basePath: "/api/better-auth",
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false, // Start simple for testing
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24, // Update every 24 hours
  },
  secret: process.env.BETTER_AUTH_SECRET || "fallback-secret-for-development-only-change-in-production",
});

export type Session = typeof auth.$Infer.Session;
