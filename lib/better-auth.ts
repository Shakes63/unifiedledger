import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/lib/db";
import * as authSchema from "@/auth-schema";
import { sendVerificationEmail } from "@/lib/email/email-service";
import { lookupLocation } from "@/lib/geoip/geoip-service";
import { eq } from "drizzle-orm";
import { genericOAuth } from "better-auth/plugins/generic-oauth";
import { loadOAuthSettingsFromDatabase } from "@/lib/auth/load-oauth-settings";

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
    sendVerificationEmail: async ({ user, url, token }: { user: { email: string; name: string | null }; url: string; token: string }) => {
      try {
        await sendVerificationEmail({
          to: user.email,
          userName: user.name || user.email,
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
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5, // 5 minutes
    },
  },
  advanced: {
    cookiePrefix: "better-auth",
    useSecureCookies: false, // Set to false for localhost development
    crossSubDomainCookies: {
      enabled: false,
    },
  },
  // TODO: Re-enable GeoIP hooks once Better Auth hook structure is fixed
  // The current hook structure causes "hook.handler is not a function" error
  // hooks: {
  //   after: [
  //     {
  //       matcher: () => true,
  //       handler: async (ctx: any) => {
  //         // Hook to populate GeoIP location on session creation
  //         if (ctx.path === '/sign-in/email' || ctx.path === '/sign-up/email') {
  //           try {
  //             const session = ctx.returned?.session;
  //             const ipAddress = ctx.returned?.session?.ipAddress;

  //             if (session?.id && ipAddress) {
  //               // Lookup location asynchronously (don't block response)
  //               lookupLocation(ipAddress)
  //                 .then(async (location) => {
  //                   await db
  //                     .update(authSchema.session)
  //                     .set({
  //                       city: location.city,
  //                       region: location.region,
  //                       country: location.country,
  //                       countryCode: location.countryCode,
  //                     })
  //                     .where(eq(authSchema.session.id, session.id));
  //                 })
  //                 .catch((error) => {
  //                   console.warn('[GeoIP] Failed to update session location:', error);
  //                   // Don't throw - location is optional
  //                 });
  //             }
  //           } catch (error) {
  //             console.warn('[GeoIP] Error in session location hook:', error);
  //             // Don't throw - location is optional
  //           }
  //         }
  //       },
  //     },
  //   ],
  // },
  secret: process.env.BETTER_AUTH_SECRET || "fallback-secret-for-development-only-change-in-production",
  plugins: [
    genericOAuth({
      config: [
        // Google OAuth - Use environment variables
        // Note: Database OAuth settings require server restart to take effect
        // See lib/auth/load-oauth-settings.ts for database loading logic
        ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
          ? [
              {
                providerId: "google",
                clientId: process.env.GOOGLE_CLIENT_ID,
                clientSecret: process.env.GOOGLE_CLIENT_SECRET,
                authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth",
                tokenUrl: "https://oauth2.googleapis.com/token",
                userInfoUrl: "https://www.googleapis.com/oauth2/v2/userinfo",
                scopes: ["openid", "profile", "email"],
                pkce: true,
              },
            ]
          : []),
        // GitHub OAuth - Use environment variables
        ...(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET
          ? [
              {
                providerId: "github",
                clientId: process.env.GITHUB_CLIENT_ID,
                clientSecret: process.env.GITHUB_CLIENT_SECRET,
                authorizationUrl: "https://github.com/login/oauth/authorize",
                tokenUrl: "https://github.com/login/oauth/access_token",
                userInfoUrl: "https://api.github.com/user",
                scopes: ["read:user", "user:email"],
                authentication: "post" as const,
              },
            ]
          : []),
      ],
    }),
  ],
});

export type Session = typeof auth.$Infer.Session;
