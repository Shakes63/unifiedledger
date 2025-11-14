import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/lib/db";
import * as authSchema from "@/auth-schema";
import { sendVerificationEmail } from "@/lib/email/email-service";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "sqlite",
    schema: authSchema,
  }),
  // Use different base path to avoid conflicts with Clerk
  basePath: "/api/better-auth",
  emailAndPassword: {
    enabled: true,
    // Email verification - Soft launch: emails are sent but not required for login
    // Set to true once ready for full enforcement
    requireEmailVerification: false,
    sendVerificationEmail: async ({ user, url, token }) => {
      try {
        await sendVerificationEmail({
          to: user.email,
          userName: user.name,
          verificationUrl: url,
        });
      } catch (error) {
        console.error('[Better Auth] Failed to send verification email:', error);
        // Don't throw - allow signup to continue even if email fails
        // User can request resend later
      }
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24, // Update every 24 hours
  },
  secret: process.env.BETTER_AUTH_SECRET || "fallback-secret-for-development-only-change-in-production",
});

export type Session = typeof auth.$Infer.Session;
