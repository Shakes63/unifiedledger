# Dual Auth Testing Strategy: Running Clerk + Better Auth Side by Side

## Overview

This document outlines how to safely test Better Auth while keeping Clerk operational, allowing you to:
- Test Better Auth without breaking existing functionality
- Migrate users gradually
- Compare both systems
- Roll back if needed
- Cut over when confident

---

## Strategy: Parallel Auth Systems

### Phase 1: Add Better Auth Alongside Clerk (Week 1)

#### Step 1: Install Better Auth (No Conflicts)

```bash
# Install Better Auth (doesn't conflict with Clerk)
pnpm add better-auth
```

#### Step 2: Generate Better Auth Schema

```bash
npx @better-auth/cli generate
```

This creates Better Auth tables with **different names** than Clerk:
- `user` (Better Auth) vs `users` (your existing table with `clerk_id`)
- `session` (Better Auth)
- `account` (Better Auth)
- `verification` (Better Auth)

**No conflicts!** The tables coexist peacefully.

#### Step 3: Update Your Existing Users Table

Modify `lib/db/schema.ts` to support BOTH auth systems:

```typescript
export const users = sqliteTable('users', {
  id: text('id').primaryKey().$defaultFn(() => randomUUID()),

  // Keep existing Clerk field (for backward compatibility)
  clerkId: text('clerk_id').unique(),

  // Add Better Auth fields
  betterAuthId: text('better_auth_id').unique(),
  email: text('email').notNull().unique(),
  emailVerified: integer('email_verified', { mode: 'timestamp' }),
  name: text('name'),
  image: text('image'),
  passwordHash: text('password_hash'), // For email/password auth

  // Migration tracking
  authProvider: text('auth_provider', { enum: ['clerk', 'better-auth'] }).default('clerk'),
  migratedAt: integer('migrated_at', { mode: 'timestamp' }),

  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});
```

**Key points:**
- Keep `clerkId` - existing functionality still works
- Add `betterAuthId` - links to Better Auth user
- Add `authProvider` - track which system the user uses
- Both can reference the same user record!

#### Step 4: Configure Better Auth with Different Routes

Create `lib/auth.ts`:

```typescript
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/lib/db";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "sqlite",
    usePlural: true,
  }),
  // Use different base path to avoid conflicts with Clerk
  basePath: "/api/better-auth", // NOT /api/auth
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false, // Start simple for testing
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days
  },
});
```

**Important:** We use `/api/better-auth` instead of `/api/auth` to avoid conflicts with any Clerk routes.

#### Step 5: Create Better Auth API Route Handler

Create `app/api/better-auth/[...all]/route.ts`:

```typescript
import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

export const { POST, GET } = toNextJsHandler(auth);
```

**Routes now available:**
- `/api/better-auth/sign-in` (Better Auth)
- `/api/better-auth/sign-up` (Better Auth)
- `/api/better-auth/sign-out` (Better Auth)
- All existing Clerk routes still work!

#### Step 6: Create Better Auth Client

Create `lib/auth-client.ts`:

```typescript
import { createAuthClient } from "better-auth/react";

export const betterAuthClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  basePath: "/api/better-auth", // Match server config
});
```

**Now you have TWO auth clients:**
- Clerk's client (existing)
- `betterAuthClient` (new)

---

## Strategy: Feature Flag Approach

### Environment Variable to Switch Between Systems

Update `.env.local`:

```bash
# Auth system selector
NEXT_PUBLIC_AUTH_PROVIDER=clerk  # or "better-auth"

# Clerk (existing)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/dashboard
NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/dashboard

# Better Auth (new)
BETTER_AUTH_SECRET=your-secret-key-min-32-chars
BETTER_AUTH_URL=http://localhost:3000
```

### Create Auth Abstraction Layer

Create `lib/auth-wrapper.ts`:

```typescript
import { auth as clerkAuth } from '@clerk/nextjs/server';
import { auth as betterAuth } from '@/lib/auth';
import { headers } from 'next/headers';

const AUTH_PROVIDER = process.env.NEXT_PUBLIC_AUTH_PROVIDER || 'clerk';

export async function getAuthUser() {
  if (AUTH_PROVIDER === 'clerk') {
    const { userId } = await clerkAuth();
    if (!userId) return null;

    // Get user from your database using clerkId
    const user = await db.query.users.findFirst({
      where: eq(users.clerkId, userId),
    });

    return user;
  } else {
    // Better Auth
    const session = await betterAuth.api.getSession({
      headers: await headers(),
    });

    if (!session) return null;

    // Get user from your database using betterAuthId
    const user = await db.query.users.findFirst({
      where: eq(users.betterAuthId, session.user.id),
    });

    return user;
  }
}

export async function requireAuth() {
  const user = await getAuthUser();
  if (!user) {
    throw new Error('Unauthorized');
  }
  return user;
}
```

### Update API Routes to Use Abstraction

**Before:**
```typescript
import { auth } from '@clerk/nextjs/server';

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = await db.query.users.findFirst({
    where: eq(users.clerkId, userId),
  });
  // ...
}
```

**After (works with both!):**
```typescript
import { requireAuth } from '@/lib/auth-wrapper';

export async function GET() {
  try {
    const user = await requireAuth();
    // Works regardless of auth provider!
    // ...
  } catch (error) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
```

**Benefit:** Change `NEXT_PUBLIC_AUTH_PROVIDER=better-auth` and ALL routes automatically use Better Auth!

---

## Testing Workflow

### Option 1: Test Route Approach (Recommended for Early Testing)

Create a separate test page that ONLY uses Better Auth:

Create `app/test-auth/page.tsx`:

```typescript
'use client';

import { useState } from 'react';
import { betterAuthClient } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

export default function TestAuthPage() {
  const [email, setEmail] = useState('test@example.com');
  const [password, setPassword] = useState('password123');
  const { data: session } = betterAuthClient.useSession();

  const handleSignUp = async () => {
    try {
      await betterAuthClient.signUp.email({
        email,
        password,
        name: 'Test User',
      });
      toast.success('Signed up with Better Auth!');
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleSignIn = async () => {
    try {
      await betterAuthClient.signIn.email({
        email,
        password,
      });
      toast.success('Signed in with Better Auth!');
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleSignOut = async () => {
    await betterAuthClient.signOut();
    toast.success('Signed out');
  };

  return (
    <div className="p-8 max-w-md mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Better Auth Test Page</h1>

      {session ? (
        <div className="space-y-4">
          <div className="p-4 bg-card border border-border rounded">
            <p className="text-sm text-muted-foreground">Signed in as:</p>
            <p className="font-medium">{session.user.email}</p>
            <p className="text-xs text-muted-foreground">ID: {session.user.id}</p>
          </div>
          <Button onClick={handleSignOut} variant="destructive" className="w-full">
            Sign Out
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <Input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <div className="flex gap-2">
            <Button onClick={handleSignUp} className="flex-1">
              Sign Up
            </Button>
            <Button onClick={handleSignIn} variant="outline" className="flex-1">
              Sign In
            </Button>
          </div>
        </div>
      )}

      <div className="p-4 bg-muted rounded text-sm">
        <p className="font-medium mb-2">Current Session Data:</p>
        <pre className="text-xs overflow-auto">
          {JSON.stringify(session, null, 2)}
        </pre>
      </div>
    </div>
  );
}
```

**Test at:** `http://localhost:3000/test-auth`

**Benefits:**
- Test Better Auth without touching existing pages
- Main app still uses Clerk
- Can compare both systems
- No risk to production functionality

### Option 2: Browser Profile Testing

1. **Chrome Profile 1:** Use Clerk (main profile)
2. **Chrome Profile 2:** Use Better Auth (testing profile)

Set different cookies, test both simultaneously.

### Option 3: Test User Accounts

Create test users in Better Auth:
- `test1@betterauth.com`
- `test2@betterauth.com`

Keep real users on Clerk until migration is complete.

---

## User Migration Strategy

### Approach: Create Sync Script

Create `scripts/migrate-users-to-better-auth.ts`:

```typescript
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { auth } from '@/lib/auth';
import { eq } from 'drizzle-orm';

async function migrateUsers() {
  console.log('Starting user migration from Clerk to Better Auth...');

  // Get all users that haven't been migrated yet
  const clerkUsers = await db.query.users.findMany({
    where: eq(users.authProvider, 'clerk'),
  });

  console.log(`Found ${clerkUsers.length} users to migrate`);

  for (const user of clerkUsers) {
    try {
      // Create user in Better Auth system
      // Note: This requires the user to reset their password since we can't access
      // Clerk's password hashes

      // For now, just create the Better Auth user record and link it
      const betterAuthUser = await auth.api.createUser({
        email: user.email,
        name: user.name,
        emailVerified: true, // Trust Clerk's verification
        // Password will need to be set by user via reset flow
      });

      // Update your users table to link both IDs
      await db.update(users)
        .set({
          betterAuthId: betterAuthUser.id,
          authProvider: 'better-auth',
          migratedAt: new Date(),
        })
        .where(eq(users.id, user.id));

      console.log(`✅ Migrated user: ${user.email}`);
    } catch (error) {
      console.error(`❌ Failed to migrate user: ${user.email}`, error);
    }
  }

  console.log('Migration complete!');
}

migrateUsers();
```

Run with:
```bash
npx tsx scripts/migrate-users-to-better-auth.ts
```

**Important:** Users will need to reset their password since you can't export password hashes from Clerk.

### Alternative: Gradual Migration

1. **New users** → Better Auth
2. **Existing users** → Stay on Clerk
3. **On next login** → Prompt to migrate ("We've upgraded our auth system!")
4. **After X days** → Force migration

---

## Middleware Strategy for Dual Auth

Update `middleware.ts` to handle both:

```typescript
import { clerkMiddleware } from '@clerk/nextjs/server';
import { betterFetch } from "@better-fetch/fetch";
import type { Session } from "better-auth/types";
import { NextResponse, type NextRequest } from "next/server";

const AUTH_PROVIDER = process.env.NEXT_PUBLIC_AUTH_PROVIDER || 'clerk';

async function dualAuthMiddleware(req: NextRequest) {
  const isProtectedRoute = req.nextUrl.pathname.startsWith("/dashboard");

  if (!isProtectedRoute) {
    return NextResponse.next();
  }

  if (AUTH_PROVIDER === 'clerk') {
    // Use Clerk middleware
    return clerkMiddleware(async (auth, req) => {
      await auth.protect();
      return NextResponse.next();
    })(req);
  } else {
    // Use Better Auth
    const { data: session } = await betterFetch<Session>(
      "/api/better-auth/get-session",
      {
        baseURL: req.nextUrl.origin,
        headers: {
          cookie: req.headers.get("cookie") || "",
        },
      }
    );

    if (!session) {
      return NextResponse.redirect(new URL("/sign-in", req.url));
    }

    return NextResponse.next();
  }
}

export default dualAuthMiddleware;

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};
```

---

## Testing Checklist

### Phase 1: Basic Auth (Week 1)
- [ ] Better Auth routes work (`/api/better-auth/*`)
- [ ] Can create test user with Better Auth
- [ ] Can sign in with Better Auth
- [ ] Session persists across page reloads
- [ ] Can sign out with Better Auth
- [ ] Clerk still works normally
- [ ] No conflicts between systems

### Phase 2: API Integration (Week 2)
- [ ] Auth wrapper works with Clerk
- [ ] Auth wrapper works with Better Auth
- [ ] Can switch providers with env var
- [ ] Test API routes with both providers
- [ ] Error handling works correctly
- [ ] Session validation works

### Phase 3: UI Components (Week 3)
- [ ] Test auth page works
- [ ] Sign-in form works with Better Auth
- [ ] Sign-up form works with Better Auth
- [ ] User menu displays correct data
- [ ] Logout redirects properly
- [ ] Protected routes work

### Phase 4: Migration Testing (Week 4)
- [ ] User migration script runs successfully
- [ ] Migrated users can access their data
- [ ] No data loss during migration
- [ ] Both auth providers can coexist
- [ ] Can roll back if needed

### Phase 5: Full Cutover (Week 5)
- [ ] All users migrated
- [ ] Switch `NEXT_PUBLIC_AUTH_PROVIDER=better-auth`
- [ ] Test all functionality
- [ ] Monitor for errors
- [ ] Remove Clerk if successful

---

## Rollback Plan

If Better Auth doesn't work:

1. **Immediate rollback:**
   ```bash
   # In .env.local
   NEXT_PUBLIC_AUTH_PROVIDER=clerk
   ```

2. **User data preserved:**
   - Keep `clerkId` field in users table
   - Better Auth users can be migrated back

3. **No data loss:**
   - Both systems use same users table
   - Only `betterAuthId` field added

---

## Comparison Testing

### Create Comparison Dashboard

`app/test-auth/compare/page.tsx`:

```typescript
'use client';

import { useUser } from '@clerk/nextjs';
import { betterAuthClient } from '@/lib/auth-client';

export default function ComparisonPage() {
  const clerkUser = useUser();
  const { data: betterAuthSession } = betterAuthClient.useSession();

  return (
    <div className="p-8 grid grid-cols-2 gap-8">
      <div className="space-y-4">
        <h2 className="text-xl font-bold">Clerk Auth</h2>
        <div className="p-4 bg-card border rounded">
          <pre className="text-xs overflow-auto">
            {JSON.stringify(clerkUser, null, 2)}
          </pre>
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-bold">Better Auth</h2>
        <div className="p-4 bg-card border rounded">
          <pre className="text-xs overflow-auto">
            {JSON.stringify(betterAuthSession, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
}
```

---

## Recommended Timeline

### Week 1: Setup
- Day 1-2: Install Better Auth, generate schema
- Day 3-4: Create test routes, basic auth flow
- Day 5: Test thoroughly with test users

### Week 2: Integration
- Day 1-2: Create auth wrapper abstraction
- Day 3-4: Update 5-10 API routes as test
- Day 5: Compare both systems

### Week 3: Expand
- Day 1-3: Update remaining API routes
- Day 4-5: Build production-ready UI components

### Week 4: Migration Prep
- Day 1-2: Test user migration script
- Day 3-4: Prepare migration communication
- Day 5: Dry run of full migration

### Week 5: Cutover
- Day 1: Migrate users
- Day 2-3: Monitor, fix issues
- Day 4-5: Remove Clerk (if successful)

---

## Key Advantages of This Approach

1. ✅ **Zero Downtime** - Clerk keeps working
2. ✅ **Low Risk** - Can rollback instantly
3. ✅ **Thorough Testing** - Test everything before committing
4. ✅ **Gradual Migration** - Users can be migrated in batches
5. ✅ **Data Preserved** - No data loss possible
6. ✅ **Comparison** - See both systems side by side
7. ✅ **Confidence** - Know it works before switching

---

## Next Steps

Want me to start implementing Phase 1?

1. Install Better Auth
2. Generate schema
3. Set up test routes
4. Create test page
5. Verify it works alongside Clerk

Then you can test it yourself before we proceed further!
