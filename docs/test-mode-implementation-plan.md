# Test Mode Feature Implementation Plan

## Overview

Implement a test mode feature controlled by an environment variable (`TEST_MODE=true`) that:
1. Bypasses all authentication checks
2. Auto-creates a single admin test user and household on first access
3. Allows immediate access to the application without any login

## Use Cases

- **Development:** Rapid testing without authentication overhead
- **Demo Mode:** Showcase the app without requiring account creation
- **CI/CD Testing:** Automated tests that don't require auth mocking

## Architecture Design

### Environment Variable

```bash
# .env
TEST_MODE=true  # Enable test mode (authentication bypassed)
```

### Test User Details

| Field | Value |
|-------|-------|
| ID | `test-user-001` |
| Email | `test@unifiedledger.local` |
| Name | `Test Admin` |
| Role | Application Owner + Household Owner |

### Test Household Details

| Field | Value |
|-------|-------|
| ID | `test-household-001` |
| Name | `Test Household` |
| Owner | `test-user-001` |

---

## Implementation Steps

### Step 1: Create Test Mode Utility Module

**File:** `lib/test-mode/index.ts`

Creates a centralized utility for checking test mode status and test user constants.

```typescript
// Constants for test mode
export const TEST_USER_ID = 'test-user-001';
export const TEST_USER_EMAIL = 'test@unifiedledger.local';
export const TEST_USER_NAME = 'Test Admin';
export const TEST_HOUSEHOLD_ID = 'test-household-001';
export const TEST_HOUSEHOLD_NAME = 'Test Household';
export const TEST_SESSION_TOKEN = 'test-session-token-001';

// Check if test mode is enabled
export function isTestMode(): boolean {
  return process.env.TEST_MODE === 'true';
}

// Get test user object matching AuthUser type
export function getTestUser() {
  return {
    userId: TEST_USER_ID,
    email: TEST_USER_EMAIL,
    name: TEST_USER_NAME,
    session: {
      id: 'test-session-001',
      token: TEST_SESSION_TOKEN,
      userId: TEST_USER_ID,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  };
}
```

### Step 2: Create Test Mode Initialization API

**File:** `app/api/test-mode/init/route.ts`

Creates the test user, household, user settings, and household membership if they don't exist.

**Logic:**
1. Check if test mode is enabled (return 403 if not)
2. Check if test user exists in database
3. If not, create:
   - User record in `user` table (Better Auth)
   - Account record in `account` table (for credential provider)
   - Household in `households` table
   - Household membership in `householdMembers` table
   - User settings in `userSettings` table
   - Session in `session` table (for cookie validation)
4. Return success with test user info

### Step 3: Modify Middleware for Test Mode

**File:** `middleware.ts`

**Changes:**
1. Import `isTestMode` from test mode utility
2. At the start of the middleware function:
   - If test mode is enabled:
     - Skip all session validation
     - Allow access to protected routes
     - For sign-in/sign-up pages, redirect to dashboard
3. Keep existing logic for non-test mode

**Key Logic:**
```typescript
// At the start of middleware
if (isTestMode()) {
  // Redirect auth pages to dashboard in test mode
  if (pathname.startsWith('/sign-in') || pathname.startsWith('/sign-up')) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }
  // Allow all protected routes
  return NextResponse.next();
}
```

### Step 4: Modify Auth Helpers

**File:** `lib/auth-helpers.ts`

**Changes to `getAuthUser()`:**
```typescript
export async function getAuthUser() {
  // Test mode bypass
  if (isTestMode()) {
    return getTestUser();
  }
  
  // ... existing Better Auth logic
}
```

**Changes to `requireAuth()`:**
```typescript
export async function requireAuth() {
  // Test mode bypass
  if (isTestMode()) {
    return getTestUser();
  }
  
  // ... existing logic
}
```

### Step 5: Modify Household Context for Test Mode

**File:** `contexts/household-context.tsx`

No changes required - the household context fetches from `/api/households` which will:
1. Call `requireAuth()` which returns test user in test mode
2. Return the test household

### Step 6: Create Test Mode Initialization Hook

**File:** `lib/test-mode/use-test-mode-init.ts` (client-side hook)

Ensures test mode data is initialized on first page load:

```typescript
'use client';

import { useEffect, useState } from 'react';

export function useTestModeInit() {
  const [initialized, setInitialized] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // Only run in test mode (check via a safe endpoint)
    const init = async () => {
      try {
        const res = await fetch('/api/test-mode/init', {
          method: 'POST',
          credentials: 'include',
        });
        if (res.ok) {
          setInitialized(true);
        } else if (res.status === 403) {
          // Not in test mode, that's fine
          setInitialized(true);
        } else {
          throw new Error('Failed to initialize test mode');
        }
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'));
      }
    };
    init();
  }, []);

  return { initialized, error };
}
```

### Step 7: Update Root Layout with Test Mode Init

**File:** `app/layout.tsx`

Add a provider/component that calls the test mode init on mount:

```tsx
// Add TestModeInitializer component that uses the hook
<TestModeInitializer>
  {children}
</TestModeInitializer>
```

### Step 8: Add Visual Test Mode Indicator

**File:** `components/dev/test-mode-banner.tsx`

Display a prominent banner when test mode is active:

```tsx
// Shows warning banner at top of page in test mode
// Uses semantic CSS variables for styling
// "TEST MODE - Authentication Disabled"
```

### Step 9: Update Environment Example

**File:** `.env.example`

Add:
```bash
# Test Mode (set to 'true' to bypass authentication)
# WARNING: Only use for development/testing, never in production
# TEST_MODE=true
```

---

## File Changes Summary

| File | Action | Description |
|------|--------|-------------|
| `lib/test-mode/index.ts` | CREATE | Test mode utilities and constants |
| `app/api/test-mode/init/route.ts` | CREATE | API to initialize test user/household |
| `middleware.ts` | MODIFY | Add test mode bypass logic |
| `lib/auth-helpers.ts` | MODIFY | Return test user in test mode |
| `components/dev/test-mode-banner.tsx` | CREATE | Visual test mode indicator |
| `components/dev/test-mode-initializer.tsx` | CREATE | Client-side init component |
| `app/layout.tsx` | MODIFY | Add test mode initializer |
| `.env.example` | MODIFY | Document TEST_MODE variable |

---

## Security Considerations

1. **Production Safety:**
   - The test mode check uses a simple string comparison
   - If `TEST_MODE` is not set or set to anything other than `'true'`, test mode is disabled
   - Add warning logs when test mode is active

2. **Data Isolation:**
   - Test user and household use predictable IDs
   - Easy to identify and clean up test data
   - Does not affect real user data

3. **Access Logging:**
   - Log when test mode allows access without authentication
   - Useful for auditing and debugging

---

## Testing Strategy

1. **Unit Tests:**
   - Test `isTestMode()` function with various env values
   - Test `getTestUser()` returns correct structure
   
2. **Integration Tests:**
   - Test API routes return test user in test mode
   - Test middleware allows protected routes in test mode
   - Test middleware redirects auth pages in test mode

3. **Manual Testing:**
   - Set `TEST_MODE=true` in `.env.local`
   - Start dev server
   - Navigate to `/dashboard` without signing in
   - Verify all features work with test user

---

## Implementation Order

1. **Step 1:** Create test mode utility (`lib/test-mode/index.ts`)
2. **Step 2:** Create initialization API (`app/api/test-mode/init/route.ts`)
3. **Step 3:** Modify middleware bypass (`middleware.ts`)
4. **Step 4:** Modify auth helpers (`lib/auth-helpers.ts`)
5. **Step 5:** Create test mode banner (`components/dev/test-mode-banner.tsx`)
6. **Step 6:** Create initializer component (`components/dev/test-mode-initializer.tsx`)
7. **Step 7:** Update root layout (`app/layout.tsx`)
8. **Step 8:** Update `.env.example`
9. **Step 9:** Test the complete flow

---

## Estimated Effort

| Task | Time |
|------|------|
| Test mode utility | 15 min |
| Init API endpoint | 30 min |
| Middleware changes | 20 min |
| Auth helper changes | 15 min |
| Banner & initializer | 20 min |
| Layout integration | 10 min |
| Testing & polish | 30 min |
| **Total** | **~2.5 hours** |

---

## Rollback Plan

To disable test mode:
1. Remove or set `TEST_MODE=false` in environment
2. Restart the application
3. All authentication will be enforced normally
4. Test user data remains in database but is not auto-used

