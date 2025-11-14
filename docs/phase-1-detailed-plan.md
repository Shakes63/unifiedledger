# Phase 1: Core Financial Data Isolation - Detailed Implementation Plan

## Overview

**Goal:** Separate transaction and account data by household to ensure proper data isolation

**Scope:** Add `household_id` to core financial tables: accounts, transactions, budgetCategories, merchants, and related tables

**Estimated Time:** 2-3 days

**Priority:** CRITICAL - Blocks multi-household usage

---

## Pre-Implementation Checklist

- [ ] Database backup created
- [ ] Feature branch created: `feature/phase-1-household-isolation`
- [ ] All background dev servers killed (to prevent conflicts)
- [ ] Current git status clean

---

## Step 1: Database Schema Updates (2-3 hours)

### 1.1 Update Core Tables in schema.ts

**File:** `lib/db/schema.ts`

**Tables to Update:**
1. `accounts` - Add `householdId` field and indexes
2. `transactions` - Add `householdId` field and indexes
3. `budgetCategories` - Add `householdId` field and indexes
4. `merchants` - Add `householdId` field and indexes
5. `transactionSplits` - Add `householdId` field and indexes
6. `usageAnalytics` - Add `householdId` field and indexes

**Changes for Each Table:**
```typescript
// Example: accounts table
export const accounts = sqliteTable(
  'accounts',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    householdId: text('household_id').notNull(), // ← ADD THIS
    // ... rest of fields
  },
  (table) => ({
    userIdIdx: index('idx_accounts_user').on(table.userId),
    householdIdIdx: index('idx_accounts_household').on(table.householdId), // ← ADD INDEX
    userHouseholdIdx: index('idx_accounts_user_household').on(table.userId, table.householdId), // ← COMPOSITE INDEX
    // ... rest of indexes
  })
);
```

**Apply to:**
- [x] accounts
- [x] transactions
- [x] budgetCategories
- [x] merchants
- [x] transactionSplits
- [x] usageAnalytics

**Testing:**
- Run `pnpm drizzle-kit check` to verify schema is valid
- No TypeScript errors in schema.ts

---

## Step 2: Create Database Migrations (1-2 hours)

### 2.1 Generate Migration Files

**Command:**
```bash
pnpm drizzle-kit generate
```

This will generate migration SQL files based on schema changes.

### 2.2 Create Custom Migration for Data Backfill

**File:** `drizzle/migrations/XXXX_add_household_id_to_core_tables.sql`

**Migration Strategy:**
1. Add `household_id` column (nullable initially)
2. Backfill with user's first household
3. Create indexes
4. Add NOT NULL constraint via application logic (SQLite limitation)

**SQL Template:**
```sql
-- ============================================================================
-- Phase 1: Add household_id to Core Financial Tables
-- ============================================================================

-- 1. ACCOUNTS TABLE
-- ============================================================================
ALTER TABLE accounts ADD COLUMN household_id TEXT;

-- Backfill: Assign to user's first household (ordered by join date)
UPDATE accounts
SET household_id = (
  SELECT hm.household_id
  FROM household_members hm
  WHERE hm.user_id = accounts.user_id
  AND hm.is_active = 1
  ORDER BY hm.joined_at ASC
  LIMIT 1
)
WHERE household_id IS NULL;

-- Create indexes for efficient querying
CREATE INDEX idx_accounts_household ON accounts(household_id);
CREATE INDEX idx_accounts_user_household ON accounts(user_id, household_id);

-- 2. TRANSACTIONS TABLE
-- ============================================================================
ALTER TABLE transactions ADD COLUMN household_id TEXT;

-- Backfill: Assign to user's first household
UPDATE transactions
SET household_id = (
  SELECT hm.household_id
  FROM household_members hm
  WHERE hm.user_id = transactions.user_id
  AND hm.is_active = 1
  ORDER BY hm.joined_at ASC
  LIMIT 1
)
WHERE household_id IS NULL;

-- Create indexes
CREATE INDEX idx_transactions_household ON transactions(household_id);
CREATE INDEX idx_transactions_user_household ON transactions(user_id, household_id);
CREATE INDEX idx_transactions_household_date ON transactions(household_id, date);

-- 3. BUDGET_CATEGORIES TABLE
-- ============================================================================
ALTER TABLE budget_categories ADD COLUMN household_id TEXT;

-- Backfill: Assign to user's first household
UPDATE budget_categories
SET household_id = (
  SELECT hm.household_id
  FROM household_members hm
  WHERE hm.user_id = budget_categories.user_id
  AND hm.is_active = 1
  ORDER BY hm.joined_at ASC
  LIMIT 1
)
WHERE household_id IS NULL;

-- Create indexes
CREATE INDEX idx_budget_categories_household ON budget_categories(household_id);
CREATE INDEX idx_budget_categories_user_household ON budget_categories(user_id, household_id);

-- 4. MERCHANTS TABLE
-- ============================================================================
ALTER TABLE merchants ADD COLUMN household_id TEXT;

-- Backfill: Assign to user's first household
UPDATE merchants
SET household_id = (
  SELECT hm.household_id
  FROM household_members hm
  WHERE hm.user_id = merchants.user_id
  AND hm.is_active = 1
  ORDER BY hm.joined_at ASC
  LIMIT 1
)
WHERE household_id IS NULL;

-- Create indexes
CREATE INDEX idx_merchants_household ON merchants(household_id);
CREATE INDEX idx_merchants_user_household ON merchants(user_id, household_id);
CREATE INDEX idx_merchants_household_normalized ON merchants(household_id, normalized_name);

-- 5. TRANSACTION_SPLITS TABLE
-- ============================================================================
ALTER TABLE transaction_splits ADD COLUMN household_id TEXT;

-- Backfill: Assign based on parent transaction's household
UPDATE transaction_splits
SET household_id = (
  SELECT t.household_id
  FROM transactions t
  WHERE t.id = transaction_splits.transaction_id
  LIMIT 1
)
WHERE household_id IS NULL;

-- Create indexes
CREATE INDEX idx_transaction_splits_household ON transaction_splits(household_id);
CREATE INDEX idx_transaction_splits_user_household ON transaction_splits(user_id, household_id);

-- 6. USAGE_ANALYTICS TABLE
-- ============================================================================
ALTER TABLE usage_analytics ADD COLUMN household_id TEXT;

-- Backfill: Assign to user's first household
UPDATE usage_analytics
SET household_id = (
  SELECT hm.household_id
  FROM household_members hm
  WHERE hm.user_id = usage_analytics.user_id
  AND hm.is_active = 1
  ORDER BY hm.joined_at ASC
  LIMIT 1
)
WHERE household_id IS NULL;

-- Create indexes
CREATE INDEX idx_usage_analytics_household ON usage_analytics(household_id);
CREATE INDEX idx_usage_analytics_user_household ON usage_analytics(user_id, household_id);

-- ============================================================================
-- VALIDATION QUERIES (Run these to verify migration success)
-- ============================================================================

-- Should return 0 for all tables
-- SELECT COUNT(*) FROM accounts WHERE household_id IS NULL;
-- SELECT COUNT(*) FROM transactions WHERE household_id IS NULL;
-- SELECT COUNT(*) FROM budget_categories WHERE household_id IS NULL;
-- SELECT COUNT(*) FROM merchants WHERE household_id IS NULL;
-- SELECT COUNT(*) FROM transaction_splits WHERE household_id IS NULL;
-- SELECT COUNT(*) FROM usage_analytics WHERE household_id IS NULL;
```

### 2.3 Apply Migration

**Commands:**
```bash
# Backup database first
cp local.db local.db.backup

# Apply migration
pnpm drizzle-kit migrate

# Verify migration success
sqlite3 local.db "SELECT COUNT(*) FROM accounts WHERE household_id IS NULL;"
# Should return 0
```

**Verification Checklist:**
- [ ] All tables have `household_id` column
- [ ] No NULL values in `household_id` columns
- [ ] Indexes created successfully
- [ ] Database schema matches Drizzle schema

---

## Step 3: Create Reusable API Helper (30 minutes)

### 3.1 Create Household Authorization Helper

**File:** `lib/api/household-auth.ts` (NEW FILE)

```typescript
import { db } from '@/lib/db';
import { householdMembers } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

/**
 * Extracts household ID from request headers or body
 */
export function getHouseholdIdFromRequest(
  request: Request,
  body?: { householdId?: string }
): string | null {
  // Try header first (for GET requests)
  const headerHouseholdId = request.headers.get('x-household-id');
  if (headerHouseholdId) return headerHouseholdId;

  // Try body (for POST/PUT/DELETE requests)
  if (body?.householdId) return body.householdId;

  return null;
}

/**
 * Verifies user is an active member of the household
 * Returns membership record if authorized, throws error if not
 */
export async function requireHouseholdAuth(
  userId: string,
  householdId: string | null
) {
  if (!householdId) {
    throw new Error('Household ID is required');
  }

  const membership = await db
    .select()
    .from(householdMembers)
    .where(
      and(
        eq(householdMembers.userId, userId),
        eq(householdMembers.householdId, householdId),
        eq(householdMembers.isActive, true)
      )
    )
    .get();

  if (!membership) {
    throw new Error('Unauthorized: Not a member of this household');
  }

  return membership;
}

/**
 * Checks if user has specific role permission in household
 */
export function hasPermission(
  membership: { role: string },
  requiredRole: 'owner' | 'admin' | 'member'
): boolean {
  const roleHierarchy = {
    owner: 3,
    admin: 2,
    member: 1,
  };

  const userLevel = roleHierarchy[membership.role as keyof typeof roleHierarchy] || 0;
  const requiredLevel = roleHierarchy[requiredRole];

  return userLevel >= requiredLevel;
}
```

**Testing:**
- Create unit tests for helper functions
- Test unauthorized access attempts
- Test missing household ID handling

---

## Step 4: Update API Endpoints (4-6 hours)

### 4.1 Accounts API Endpoints

**Files to Update:**
- `app/api/accounts/route.ts` - List and create
- `app/api/accounts/[id]/route.ts` - Get, update, delete
- `app/api/accounts/[id]/balance/route.ts` - Balance operations

**Changes Pattern:**

**Before:**
```typescript
export async function GET(request: Request) {
  const { userId } = await requireAuth();

  const userAccounts = await db
    .select()
    .from(accounts)
    .where(eq(accounts.userId, userId));

  return Response.json(userAccounts);
}
```

**After:**
```typescript
import { getHouseholdIdFromRequest, requireHouseholdAuth } from '@/lib/api/household-auth';

export async function GET(request: Request) {
  const { userId } = await requireAuth();

  // Get and validate household
  const householdId = getHouseholdIdFromRequest(request);
  await requireHouseholdAuth(userId, householdId);

  const userAccounts = await db
    .select()
    .from(accounts)
    .where(
      and(
        eq(accounts.userId, userId),
        eq(accounts.householdId, householdId)
      )
    );

  return Response.json(userAccounts);
}
```

**POST/PUT/DELETE Pattern:**
```typescript
export async function POST(request: Request) {
  const { userId } = await requireAuth();
  const body = await request.json();

  // Get household ID from body
  const householdId = getHouseholdIdFromRequest(request, body);
  await requireHouseholdAuth(userId, householdId);

  // ... rest of logic, include householdId in insert
  await db.insert(accounts).values({
    id: accountId,
    userId,
    householdId, // ← ADD THIS
    // ... rest of fields
  });
}
```

**Files Checklist:**
- [ ] `/api/accounts/route.ts` - GET, POST
- [ ] `/api/accounts/[id]/route.ts` - GET, PUT, DELETE
- [ ] `/api/accounts/[id]/balance/route.ts` - PUT

### 4.2 Transactions API Endpoints

**Files to Update:**
- `app/api/transactions/route.ts` - List and create
- `app/api/transactions/[id]/route.ts` - Get, update, delete
- `app/api/transactions/bulk-import/route.ts` - CSV import
- `app/api/transactions/search/route.ts` - Advanced search
- `app/api/transactions/stats/route.ts` - Statistics
- `app/api/transactions/recent/route.ts` - Recent transactions

**Special Considerations:**
- Transaction splits must inherit household_id from parent transaction
- Transfer transactions (transfer_in/transfer_out pairs) must be in same household
- Bill matching should only match bills in same household
- Debt payment matching should only match debts in same household

**Files Checklist:**
- [ ] `/api/transactions/route.ts` - GET, POST
- [ ] `/api/transactions/[id]/route.ts` - GET, PUT, DELETE
- [ ] `/api/transactions/bulk-import/route.ts` - POST
- [ ] `/api/transactions/search/route.ts` - POST
- [ ] `/api/transactions/stats/route.ts` - GET
- [ ] `/api/transactions/recent/route.ts` - GET
- [ ] `/api/transactions/duplicate-check/route.ts` - POST

### 4.3 Categories API Endpoints

**Files to Update:**
- `app/api/categories/route.ts` - List and create
- `app/api/categories/[id]/route.ts` - Get, update, delete
- `app/api/categories/[id]/budget/route.ts` - Budget operations
- `app/api/categories/stats/route.ts` - Category statistics

**Files Checklist:**
- [ ] `/api/categories/route.ts` - GET, POST
- [ ] `/api/categories/[id]/route.ts` - GET, PUT, DELETE
- [ ] `/api/categories/[id]/budget/route.ts` - PUT
- [ ] `/api/categories/stats/route.ts` - GET

### 4.4 Merchants API Endpoints

**Files to Update:**
- `app/api/merchants/route.ts` - List and create
- `app/api/merchants/[id]/route.ts` - Get, update, delete
- `app/api/merchants/search/route.ts` - Search
- `app/api/merchants/stats/route.ts` - Statistics

**Special Consideration:**
- Merchant matching should only match merchants in same household
- Usage analytics should be household-specific

**Files Checklist:**
- [ ] `/api/merchants/route.ts` - GET, POST
- [ ] `/api/merchants/[id]/route.ts` - GET, PUT, DELETE
- [ ] `/api/merchants/search/route.ts` - GET
- [ ] `/api/merchants/stats/route.ts` - GET

### 4.5 Dashboard & Stats Endpoints

**Files to Update:**
- `app/api/dashboard/stats/route.ts` - Dashboard statistics
- `app/api/dashboard/recent-activity/route.ts` - Recent activity
- `app/api/analytics/route.ts` - Analytics data

**Files Checklist:**
- [ ] `/api/dashboard/stats/route.ts` - GET
- [ ] `/api/dashboard/recent-activity/route.ts` - GET
- [ ] `/api/analytics/route.ts` - GET

---

## Step 5: Update Frontend Components (3-4 hours)

### 5.1 Create Frontend API Helper Hook

**File:** `lib/hooks/use-household-fetch.ts` (NEW FILE)

```typescript
'use client';

import { useHousehold } from '@/contexts/household-context';

export function useHouseholdFetch() {
  const { selectedHouseholdId } = useHousehold();

  const fetchWithHousehold = async (url: string, options: RequestInit = {}) => {
    if (!selectedHouseholdId) {
      throw new Error('No household selected');
    }

    return fetch(url, {
      ...options,
      credentials: 'include',
      headers: {
        ...options.headers,
        'x-household-id': selectedHouseholdId,
      },
    });
  };

  const postWithHousehold = async (url: string, data: any, options: RequestInit = {}) => {
    if (!selectedHouseholdId) {
      throw new Error('No household selected');
    }

    return fetch(url, {
      method: 'POST',
      ...options,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
        'x-household-id': selectedHouseholdId,
      },
      body: JSON.stringify({
        ...data,
        householdId: selectedHouseholdId,
      }),
    });
  };

  const putWithHousehold = async (url: string, data: any, options: RequestInit = {}) => {
    if (!selectedHouseholdId) {
      throw new Error('No household selected');
    }

    return fetch(url, {
      method: 'PUT',
      ...options,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
        'x-household-id': selectedHouseholdId,
      },
      body: JSON.stringify({
        ...data,
        householdId: selectedHouseholdId,
      }),
    });
  };

  const deleteWithHousehold = async (url: string, options: RequestInit = {}) => {
    if (!selectedHouseholdId) {
      throw new Error('No household selected');
    }

    return fetch(url, {
      method: 'DELETE',
      ...options,
      credentials: 'include',
      headers: {
        ...options.headers,
        'x-household-id': selectedHouseholdId,
      },
    });
  };

  return {
    fetchWithHousehold,
    postWithHousehold,
    putWithHousehold,
    deleteWithHousehold,
    selectedHouseholdId,
  };
}
```

### 5.2 Update Transaction Components

**Components to Update:**
- `components/transactions/transaction-form.tsx` - Form submission
- `components/transactions/transaction-list.tsx` - Data fetching
- `components/transactions/transaction-filters.tsx` - Filtered queries
- `components/transactions/quick-entry-modal.tsx` - Quick entry
- `app/dashboard/transactions/page.tsx` - Main page

**Pattern:**

**Before:**
```typescript
const response = await fetch('/api/transactions', {
  credentials: 'include',
});
```

**After:**
```typescript
import { useHouseholdFetch } from '@/lib/hooks/use-household-fetch';

const { fetchWithHousehold } = useHouseholdFetch();
const response = await fetchWithHousehold('/api/transactions');
```

**Files Checklist:**
- [ ] `components/transactions/transaction-form.tsx`
- [ ] `components/transactions/transaction-list.tsx`
- [ ] `components/transactions/transaction-filters.tsx`
- [ ] `components/transactions/quick-entry-modal.tsx`
- [ ] `components/transactions/csv-import-modal.tsx`
- [ ] `app/dashboard/transactions/page.tsx`

### 5.3 Update Account Components

**Components to Update:**
- `components/accounts/account-form.tsx` - Form submission
- `components/accounts/account-list.tsx` - Data fetching
- `components/accounts/account-selector.tsx` - Account selection
- `app/dashboard/accounts/page.tsx` - Main page

**Files Checklist:**
- [ ] `components/accounts/account-form.tsx`
- [ ] `components/accounts/account-list.tsx`
- [ ] `components/accounts/account-selector.tsx`
- [ ] `app/dashboard/accounts/page.tsx`

### 5.4 Update Category Components

**Components to Update:**
- `components/categories/category-form.tsx` - Form submission
- `components/categories/category-list.tsx` - Data fetching
- `components/categories/category-selector.tsx` - Category selection
- `app/dashboard/budget/page.tsx` - Budget page

**Files Checklist:**
- [ ] `components/categories/category-form.tsx`
- [ ] `components/categories/category-list.tsx`
- [ ] `components/categories/category-selector.tsx`
- [ ] `components/budget/budget-summary.tsx`
- [ ] `app/dashboard/budget/page.tsx`

### 5.5 Update Dashboard Components

**Components to Update:**
- `app/dashboard/page.tsx` - Main dashboard
- `components/dashboard/dashboard-stats.tsx` - Statistics
- `components/dashboard/recent-transactions.tsx` - Recent activity

**Files Checklist:**
- [ ] `app/dashboard/page.tsx`
- [ ] `components/dashboard/dashboard-stats.tsx`
- [ ] `components/dashboard/recent-transactions.tsx`
- [ ] `components/dashboard/monthly-summary.tsx`

---

## Step 6: Update Business Logic & Utilities (2-3 hours)

### 6.1 Update Rules Engine

**Files to Update:**
- `lib/rules/rule-matcher.ts` - Rule matching
- `lib/rules/actions-executor.ts` - Rule actions

**Changes:**
- Ensure rules only match transactions in same household
- Categorization rules should be household-specific

**Files Checklist:**
- [ ] `lib/rules/rule-matcher.ts`
- [ ] `lib/rules/actions-executor.ts`

### 6.2 Update Bill Matching Logic

**Files to Update:**
- `lib/bills/bill-matcher.ts` - Bill matching algorithm

**Changes:**
- Only match bills in same household as transaction

**Files Checklist:**
- [ ] `lib/bills/bill-matcher.ts`

### 6.3 Update Usage Analytics

**Files to Update:**
- `lib/usage/track-usage.ts` - Usage tracking

**Changes:**
- Track usage per household

**Files Checklist:**
- [ ] `lib/usage/track-usage.ts` (if exists)

---

## Step 7: Testing (3-4 hours)

### 7.1 Create Integration Tests

**File:** `__tests__/integration/household-isolation-phase1.test.ts` (NEW FILE)

**Test Cases:**
```typescript
describe('Phase 1: Household Data Isolation', () => {
  describe('Accounts', () => {
    it('should only return accounts for selected household', async () => {
      // Create account in household A
      // Switch to household B
      // Verify account from A is not visible
      // Create account in household B
      // Verify only household B account is visible
      // Switch back to household A
      // Verify only household A account is visible
    });

    it('should prevent accessing another household\'s account', async () => {
      // Create account in household A
      // Try to access with household B credentials
      // Should return 403 Unauthorized
    });
  });

  describe('Transactions', () => {
    it('should only return transactions for selected household', async () => {
      // Similar to accounts test
    });

    it('should prevent creating transaction in wrong household', async () => {
      // Create account in household A
      // Try to create transaction with household B ID
      // Should fail validation
    });

    it('should isolate transaction search by household', async () => {
      // Create transactions in both households
      // Search should only return current household results
    });
  });

  describe('Categories', () => {
    it('should only return categories for selected household', async () => {
      // Similar to accounts test
    });
  });

  describe('Merchants', () => {
    it('should only return merchants for selected household', async () => {
      // Similar to accounts test
    });

    it('should prevent merchant matching across households', async () => {
      // Create merchant in household A
      // Create transaction in household B
      // Should not match merchant from household A
    });
  });

  describe('Cross-Household Security', () => {
    it('should reject requests without household ID', async () => {
      // Make request without x-household-id header
      // Should return 400 Bad Request
    });

    it('should reject requests with invalid household membership', async () => {
      // User A tries to access household B's data
      // Should return 403 Forbidden
    });
  });
});
```

### 7.2 Manual Testing Checklist

**Test Scenario 1: Data Isolation**
- [ ] Create 2 test households (A and B)
- [ ] Add test user to both households
- [ ] Create account in household A
- [ ] Create transaction in household A
- [ ] Create category in household A
- [ ] Switch to household B
- [ ] Verify no data from household A is visible
- [ ] Create account in household B
- [ ] Create transaction in household B
- [ ] Switch back to household A
- [ ] Verify only household A data is visible

**Test Scenario 2: Transfer Transactions**
- [ ] Create transfer between accounts in household A
- [ ] Verify both transfer_out and transfer_in have same household_id
- [ ] Switch to household B
- [ ] Verify transfer is not visible

**Test Scenario 3: Rules & Bill Matching**
- [ ] Create categorization rule in household A
- [ ] Create transaction in household A
- [ ] Verify rule applies
- [ ] Switch to household B
- [ ] Create similar transaction
- [ ] Verify household A rule does NOT apply

**Test Scenario 4: Dashboard & Stats**
- [ ] View dashboard in household A
- [ ] Verify stats only show household A data
- [ ] Switch to household B
- [ ] Verify stats update to show household B data

**Test Scenario 5: Security**
- [ ] Try to manipulate x-household-id header to access other household
- [ ] Should receive 403 Forbidden
- [ ] Try to submit householdId in body for household user isn't member of
- [ ] Should receive 403 Forbidden

### 7.3 Performance Testing

**Metrics to Monitor:**
- [ ] Query time for transactions list (should be < 100ms)
- [ ] Query time for accounts list (should be < 50ms)
- [ ] Dashboard load time (should be < 500ms)
- [ ] Verify indexes are being used (check EXPLAIN QUERY PLAN)

---

## Step 8: Documentation Updates (30 minutes)

### 8.1 Update Technical Documentation

**Files to Update:**
- [ ] `docs/household-data-isolation-plan.md` - Mark Phase 1 complete
- [ ] `docs/features.md` - Update status
- [ ] `docs/API.md` - Document household_id requirement (if exists)
- [ ] `README.md` - Update if needed

### 8.2 Update CLAUDE.md

**File:** `.claude/CLAUDE.md`

Add to "Current Status" section:
```markdown
- ✅ Household Data Isolation Phase 1 (100% complete - core financial data)
  - Accounts, transactions, categories, merchants fully isolated by household
  - API endpoints require household authentication
  - Frontend components pass household context
  - Comprehensive integration tests passing
```

---

## Step 9: Code Review & Cleanup (1 hour)

### 9.1 Self-Review Checklist

- [ ] All API endpoints have household authorization check
- [ ] All database queries filter by household_id
- [ ] All frontend components use household context
- [ ] No hardcoded household IDs
- [ ] Error handling is consistent
- [ ] All theme variables used (no hardcoded colors)
- [ ] TypeScript has no errors
- [ ] All tests passing

### 9.2 Code Quality Checks

```bash
# TypeScript check
pnpm tsc --noEmit

# Run tests
pnpm test

# Build check
pnpm build
```

### 9.3 Security Review

- [ ] Verify all endpoints validate household membership
- [ ] Check for SQL injection vulnerabilities
- [ ] Verify no cross-household data leaks possible
- [ ] Test unauthorized access attempts fail gracefully

---

## Step 10: Commit & Documentation (30 minutes)

### 10.1 Git Commit

**Commit Message:**
```
feat: Phase 1 - Household data isolation for core financial tables

BREAKING CHANGE: All financial data now filtered by household

Changes:
- Added household_id to accounts, transactions, budgetCategories, merchants
- Created migration with automatic data backfill to user's first household
- Updated 25+ API endpoints with household authorization checks
- Updated 20+ frontend components to pass household context
- Created reusable household auth helper utilities
- Added comprehensive integration tests for data isolation
- Added composite indexes for performance (user_id, household_id)

Security:
- All API endpoints now verify household membership
- Cross-household data access prevented
- Request validation includes household authorization

Testing:
- 15+ new integration tests for household isolation
- Manual testing completed for all core features
- Performance benchmarks meet requirements

Migration:
- Safe migration with data backfill
- All existing data assigned to user's first household
- Zero data loss, backward compatible for single-household users

Next: Phase 2 (Bills, Goals, Debts isolation)
```

---

## Rollback Plan

If critical issues are discovered:

### Option 1: Feature Flag Disable
1. Add feature flag to temporarily disable household filtering
2. Fall back to userId-only filtering
3. Fix issues
4. Re-enable

### Option 2: Database Rollback
1. Restore database from backup: `cp local.db.backup local.db`
2. Revert schema changes in schema.ts
3. Remove migration file
4. Revert code changes

### Option 3: Revert Git Commits
```bash
git revert <commit-hash>
git push
```

---

## Success Criteria

Phase 1 is complete when:

- [x] All 6 core tables have household_id column
- [x] All existing data has been backfilled
- [x] All 25+ API endpoints filter by household
- [x] All 20+ frontend components pass household context
- [x] Switching households shows different data
- [x] User cannot access other household's data
- [x] All integration tests passing
- [x] No performance regression
- [x] Documentation updated

---

## Timeline Estimate

**Day 1:**
- Morning: Schema updates + migration creation (3 hours)
- Afternoon: Apply migration + create helpers (2 hours)
- Evening: Start API endpoint updates (2 hours)

**Day 2:**
- Morning: Finish API endpoint updates (3 hours)
- Afternoon: Frontend component updates (4 hours)

**Day 3:**
- Morning: Business logic updates + testing (4 hours)
- Afternoon: Manual testing + documentation (2 hours)
- Evening: Code review + commit (1 hour)

**Total: 21 hours over 3 days**

---

## Risk Mitigation

**Risk:** Data migration fails
- **Mitigation:** Database backup before migration, dry run on copy first

**Risk:** Performance degradation from additional filtering
- **Mitigation:** Composite indexes on (user_id, household_id), performance testing

**Risk:** Missing household filter in some endpoint
- **Mitigation:** Code review checklist, automated tests, security audit

**Risk:** Frontend breaks when no household selected
- **Mitigation:** Graceful error handling, loading states, household selection prompt

---

## Notes

- This plan focuses ONLY on Phase 1 tables (accounts, transactions, categories, merchants)
- Bills, goals, debts, and other features will be handled in Phase 2
- Settings isolation was completed in Phase 0
- Theme switching per household is already working from Phase 0
- Database uses SQLite - cannot add NOT NULL constraint after column creation, so we rely on Drizzle schema validation for new records

---

**Document Version:** 1.0
**Created:** 2025-11-14
**Status:** READY FOR IMPLEMENTATION
**Estimated Effort:** 2-3 days
