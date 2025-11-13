# Authentication Migration Analysis: Clerk Alternatives

## Current State: Clerk

**Pros:**
- Zero database setup required (hosted solution)
- Built-in UI components (SignIn, SignUp, UserButton)
- Session management handled automatically
- User management dashboard
- Multi-factor authentication built-in
- Social login providers pre-configured

**Cons:**
- External dependency (requires internet)
- Pricing can scale with users ($25/month after 10k MAU)
- Less control over user data
- Data stored externally, not in your SQLite database
- Vendor lock-in

**Current Usage in Unified Ledger:**
- `ClerkProvider` in `app/layout.tsx`
- `clerkMiddleware` in `middleware.ts`
- `SignIn` and `SignUp` components in auth pages
- `UserButton` in sidebar
- `auth()` from `@clerk/nextjs/server` in API routes
- User ID from Clerk used as foreign key in all tables

---

## Alternative 1: Auth.js (NextAuth.js v5) ⭐ RECOMMENDED

### Overview
Auth.js is the most popular Next.js authentication library with extensive database support.

### SQLite Compatibility
✅ **Yes** - Has official SQLite adapter via `@auth/drizzle-adapter`

### What Would Need to Change

#### 1. Database Schema Addition
Add new tables to `lib/db/schema.ts`:
```typescript
// Auth.js tables
export const accounts = sqliteTable('accounts', {
  userId: text('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  provider: text('provider').notNull(),
  providerAccountId: text('providerAccountId').notNull(),
  refresh_token: text('refresh_token'),
  access_token: text('access_token'),
  expires_at: integer('expires_at'),
  token_type: text('token_type'),
  scope: text('scope'),
  id_token: text('id_token'),
  session_state: text('session_state'),
}, (account) => ({
  compositePk: primaryKey(account.provider, account.providerAccountId),
}));

export const sessions = sqliteTable('sessions', {
  sessionToken: text('sessionToken').notNull().primaryKey(),
  userId: text('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expires: integer('expires', { mode: 'timestamp' }).notNull(),
});

export const verificationTokens = sqliteTable('verification_tokens', {
  identifier: text('identifier').notNull(),
  token: text('token').notNull(),
  expires: integer('expires', { mode: 'timestamp' }).notNull(),
}, (vt) => ({
  compositePk: primaryKey(vt.identifier, vt.token),
}));

// Update existing users table
export const users = sqliteTable('users', {
  id: text('id').primaryKey().$defaultFn(() => randomUUID()),
  clerkId: text('clerk_id').unique(), // Keep for migration
  email: text('email').notNull().unique(),
  emailVerified: integer('email_verified', { mode: 'timestamp' }),
  name: text('name'),
  image: text('image'),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});
```

#### 2. Install Dependencies
```bash
pnpm add next-auth@beta @auth/drizzle-adapter
```

#### 3. Create Auth Configuration
Create `lib/auth/config.ts`:
```typescript
import NextAuth from 'next-auth';
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import GitHub from 'next-auth/providers/github';
import { db } from '@/lib/db';
import bcrypt from 'bcryptjs';

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db),
  providers: [
    Google,
    GitHub,
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        // Custom login logic
        const user = await db.query.users.findFirst({
          where: eq(users.email, credentials.email),
        });

        if (!user || !user.passwordHash) return null;

        const isValid = await bcrypt.compare(
          credentials.password,
          user.passwordHash
        );

        if (!isValid) return null;

        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  ],
  pages: {
    signIn: '/sign-in',
    signUp: '/sign-up',
    error: '/auth/error',
  },
  session: {
    strategy: 'database', // Store sessions in SQLite
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    async session({ session, user }) {
      session.user.id = user.id;
      return session;
    },
  },
});
```

#### 4. Update Middleware
Replace `middleware.ts`:
```typescript
import { auth } from '@/lib/auth/config';
import { NextResponse } from 'next/server';

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const isProtectedRoute = req.nextUrl.pathname.startsWith('/dashboard');

  if (isProtectedRoute && !isLoggedIn) {
    return NextResponse.redirect(new URL('/sign-in', req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/((?!.*\\..*|_next).*)', '/', '/(api|trpc)(.*)'],
};
```

#### 5. Update API Routes
Replace Clerk's `auth()` with Auth.js:
```typescript
// Before (Clerk)
import { auth } from '@clerk/nextjs/server';

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

// After (Auth.js)
import { auth } from '@/lib/auth/config';

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = session.user.id;
}
```

#### 6. Update Sign-In/Sign-Up Pages
Replace Clerk components with custom forms:
```tsx
// app/sign-in/page.tsx
import { signIn } from '@/lib/auth/config';
import { AuthForm } from '@/components/auth/auth-form';

export default function SignInPage() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <AuthForm mode="signin" />
    </div>
  );
}
```

#### 7. Update Layout/Sidebar
Replace `UserButton` with custom component:
```tsx
// Before
import { UserButton } from '@clerk/nextjs';
<UserButton />

// After
import { auth } from '@/lib/auth/config';
import { UserMenu } from '@/components/auth/user-menu';

const session = await auth();
<UserMenu user={session?.user} />
```

#### 8. Files to Modify
- `app/layout.tsx` - Remove ClerkProvider
- `middleware.ts` - Replace clerkMiddleware
- `app/sign-in/[[...index]]/page.tsx` - Custom form
- `app/sign-up/[[...index]]/page.tsx` - Custom form
- `components/navigation/sidebar.tsx` - Replace UserButton
- All API routes (30+ files) - Replace auth() calls
- `lib/db/schema.ts` - Add auth tables

### Effort Estimate
- **Schema & Migration:** 2-3 hours
- **Auth Setup:** 2-4 hours
- **UI Components:** 4-6 hours
- **API Route Updates:** 3-4 hours
- **Testing:** 4-6 hours
- **Total:** ~15-23 hours

---

## Alternative 2: Lucia Auth ⭐ LIGHTWEIGHT OPTION

### Overview
Lucia is a minimalist auth library that gives you full control.

### SQLite Compatibility
✅ **Yes** - Explicitly designed for SQLite and other databases

### Key Features
- Extremely lightweight (~5KB)
- Full TypeScript support
- Session-based authentication
- Works directly with your database
- No external dependencies beyond your DB driver

### What Would Need to Change

#### 1. Install Dependencies
```bash
pnpm add lucia oslo
```

#### 2. Database Schema
```typescript
export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  hashedPassword: text('hashed_password'),
  name: text('name'),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
});
```

#### 3. Lucia Configuration
```typescript
import { Lucia } from 'lucia';
import { DrizzleSQLiteAdapter } from '@lucia-auth/adapter-drizzle';
import { db } from '@/lib/db';

const adapter = new DrizzleSQLiteAdapter(db, sessions, users);

export const lucia = new Lucia(adapter, {
  sessionCookie: {
    attributes: {
      secure: process.env.NODE_ENV === 'production',
    },
  },
  getUserAttributes: (attributes) => {
    return {
      email: attributes.email,
      name: attributes.name,
    };
  },
});
```

### Pros vs Auth.js
- Much lighter weight
- More control over authentication flow
- No external API calls
- Better for offline-first apps

### Cons vs Auth.js
- No built-in OAuth providers (need to implement manually)
- Less community support
- More code to write yourself

### Effort Estimate
- Similar to Auth.js: ~15-20 hours

---

## Alternative 3: Custom Solution with Passport.js

### SQLite Compatibility
✅ **Yes** - You control the database

### Overview
Build custom auth with Passport.js strategies

### Pros
- Maximum control
- No external dependencies
- Fully customizable

### Cons
- Most work required
- Need to implement security best practices yourself
- Session management complexity
- More security risks if not done correctly

### Effort Estimate
- **25-35 hours** (significantly more work)

---

## Alternative 4: Supabase Auth

### SQLite Compatibility
❌ **No** - Requires PostgreSQL (Supabase database)

### Overview
Hosted auth solution similar to Clerk but open source

### Migration Path
- Would require migrating entire database from SQLite to PostgreSQL
- Not recommended unless you want to change databases

---

## Comparison Matrix

| Feature | Clerk | Auth.js | Lucia | Custom |
|---------|-------|---------|-------|--------|
| SQLite Support | ❌ | ✅ | ✅ | ✅ |
| Self-Hosted | ❌ | ✅ | ✅ | ✅ |
| OAuth Built-in | ✅ | ✅ | ❌ | ❌ |
| Setup Time | ⚡ Fast | 🔧 Medium | 🔧 Medium | 🔨 Slow |
| Bundle Size | N/A | ~150KB | ~5KB | Variable |
| Offline Support | ❌ | ✅ | ✅ | ✅ |
| Cost | $25+/mo | Free | Free | Free |
| Control | Low | Medium | High | Maximum |
| Security | Managed | Well-tested | DIY | DIY |
| Migration Effort | N/A | ~20h | ~20h | ~35h |

---

## Recommendation

### For Unified Ledger: **Auth.js (NextAuth v5)** ⭐

**Reasons:**
1. **SQLite compatible** via Drizzle adapter (you're already using Drizzle)
2. **Battle-tested** - used by thousands of Next.js apps
3. **Full feature set** - OAuth, credentials, email verification, etc.
4. **Great documentation** and community support
5. **Session storage in SQLite** - true offline capability
6. **Reasonable migration effort** (~20 hours)
7. **Free and open source**

### Alternative: **Lucia** if you want:
- Lighter bundle size
- More control
- Don't need OAuth (or willing to implement it)
- Truly minimal dependencies

---

## Migration Strategy

If you decide to migrate, here's the recommended approach:

### Phase 1: Setup (Week 1)
1. Add Auth.js tables to schema
2. Create migration script
3. Set up Auth.js configuration
4. Test authentication flow in development

### Phase 2: Dual Auth (Week 2)
1. Keep Clerk running
2. Add Auth.js alongside
3. Create user migration script (Clerk → Auth.js)
4. Test both systems work

### Phase 3: Switch Over (Week 3)
1. Migrate all users
2. Update all API routes
3. Replace UI components
4. Test thoroughly

### Phase 4: Cleanup (Week 4)
1. Remove Clerk dependencies
2. Remove old auth code
3. Update documentation
4. Final testing

---

## Is It Worth It?

**Migrate if:**
- ✅ You want true offline-first capability
- ✅ You want user data in your SQLite database
- ✅ You want to avoid ongoing subscription costs
- ✅ You want more control over auth flow
- ✅ You're concerned about vendor lock-in

**Keep Clerk if:**
- ✅ You value the managed service convenience
- ✅ You need multi-tenant features Clerk provides
- ✅ You want minimal maintenance
- ✅ 20+ hours of migration work isn't worth it
- ✅ External auth is fine for your use case

---

## Next Steps

If you want to proceed with migration:
1. I can create a detailed migration plan
2. Set up Auth.js with Drizzle adapter
3. Create the database migration scripts
4. Build custom auth UI components
5. Migrate all API routes systematically
6. Create comprehensive tests

Let me know if you'd like to proceed with the migration!
