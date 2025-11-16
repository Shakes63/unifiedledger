# Phase 2: Bills & Budgets API Isolation - Implementation Plan

**Status:** In Progress (Steps 1-2 complete, Steps 3-6 remaining)  
**Priority:** High  
**Estimated Time:** 1-2 days remaining  
**Created:** 2025-01-27  
**Last Updated:** 2025-01-27

---

## Overview

This plan implements household data isolation for Bills and Budgets features. Currently, bills and budget data are filtered only by `userId`, allowing data leakage between households. This phase will:

1. Add `householdId` to bills and bill instances tables
2. Update all bills API endpoints to filter by household
3. Update all budgets API endpoints to filter by household (budget categories already have `householdId` in schema)
4. Update frontend components to use household-aware fetch hooks
5. Create and apply database migrations with data backfill

---

## Current State Analysis

### Database Schema Status

**✅ Already Has `householdId`:**
- `budget_categories` - Has `householdId` field and indexes (Phase 1 complete)

**❌ Missing `householdId`:**
- `bills` - Currently only has `userId`, needs `householdId` added
- `bill_instances` - Currently only has `userId`, needs `householdId` added

### API Endpoints Status

**Bills API Endpoints (6 files):**
- `app/api/bills/route.ts` - GET, POST (filters by `userId` only)
- `app/api/bills/[id]/route.ts` - GET, PUT, DELETE (filters by `userId` only)
- `app/api/bills/instances/route.ts` - GET, POST (filters by `userId` only)
- `app/api/bills/instances/[id]/route.ts` - GET, PUT, DELETE (filters by `userId` only)
- `app/api/bills/match/route.ts` - POST (filters by `userId` only)
- `app/api/bills/detect/route.ts` - POST (filters by `userId` only)

**Budgets API Endpoints (11 files):**
- `app/api/budgets/route.ts` - GET, POST (filters by `userId` only, but `budget_categories` has `householdId`)
- `app/api/budgets/summary/route.ts` - GET (filters by `userId` only)
- `app/api/budgets/overview/route.ts` - GET (filters by `userId` only)
- `app/api/budgets/analyze/route.ts` - GET (filters by `userId` only)
- `app/api/budgets/check/route.ts` - GET (filters by `userId` only)
- `app/api/budgets/export/route.ts` - GET (filters by `userId` only)
- `app/api/budgets/copy/route.ts` - POST (filters by `userId` only)
- `app/api/budgets/apply-surplus/route.ts` - POST (filters by `userId` only)
- `app/api/budgets/surplus-suggestion/route.ts` - GET (filters by `userId` only)
- `app/api/budgets/bills/variable/route.ts` - GET (filters by `userId` only)
- `app/api/budgets/templates/route.ts` - GET, POST (filters by `userId` only)

### Frontend Components Status

**Bills Components (5 files):**
- `app/dashboard/bills/page.tsx` - Uses direct `fetch()` calls (2 calls)
- `components/dashboard/bills-widget.tsx` - Uses direct `fetch()` calls (1 call)
- `components/dashboard/enhanced-bills-widget.tsx` - Uses direct `fetch()` calls (1 call)
- `components/bills/bill-form.tsx` - Needs analysis (likely uses callbacks)
- `components/bills/bill-instance-card.tsx` - Needs analysis

**Budgets Components (8+ files):**
- `components/budgets/variable-bill-tracker.tsx` - Uses direct `fetch()` calls (1 call)
- `components/dashboard/compact-stats-bar.tsx` - May use budgets API
- Other budget components need analysis

---

## Implementation Steps

### Step 1: Database Schema Updates

**Task 1.1: Update Bills Table Schema**
- File: `lib/db/schema.ts`
- Add `householdId: text('household_id').notNull()` to `bills` table
- Add indexes:
  - `householdIdIdx: index('idx_bills_household').on(table.householdId)`
  - `userHouseholdIdx: index('idx_bills_user_household').on(table.userId, table.householdId)`
- Update existing `userIdIdx` to maintain compatibility

**Task 1.2: Update Bill Instances Table Schema**
- File: `lib/db/schema.ts`
- Add `householdId: text('household_id').notNull()` to `bill_instances` table
- Add indexes:
  - `householdIdIdx: index('idx_bill_instances_household').on(table.householdId)`
  - `userHouseholdIdx: index('idx_bill_instances_user_household').on(table.userId, table.householdId)`
- Update existing `billIdDueDateUnique` index if needed (should remain unique per bill)

**Task 1.3: Generate Migration**
- Run `pnpm drizzle-kit generate` to create migration file
- Migration file will be: `drizzle/00XX_add_household_id_to_bills.sql`
- Review migration SQL before applying

**Task 1.4: Create Migration SQL with Data Backfill**
- Migration should:
  1. Add `household_id` column as NULLABLE to both tables
  2. Backfill existing records with user's first/default household:
     ```sql
     UPDATE bills
     SET household_id = (
       SELECT hm.household_id
       FROM household_members hm
       WHERE hm.user_id = bills.user_id
       ORDER BY hm.joined_at ASC
       LIMIT 1
     )
     WHERE household_id IS NULL;
     
     UPDATE bill_instances
     SET household_id = (
       SELECT b.household_id
       FROM bills b
       WHERE b.id = bill_instances.bill_id
     )
     WHERE household_id IS NULL;
     ```
  3. Verify no NULLs remain
  4. Create indexes for performance
  5. Note: SQLite doesn't support ALTER COLUMN NOT NULL, so we rely on application-level validation

**Task 1.5: Apply Migration**
- Create database backup: `cp sqlite.db sqlite.db.backup-YYYYMMDD-HHMMSS`
- Run `pnpm drizzle-kit migrate` to apply migration
- Verify migration success:
  - Check all bills have `household_id`
  - Check all bill instances have `household_id`
  - Verify indexes created

---

### Step 2: Bills API Endpoints Updates

**Pattern to Apply:**
```typescript
import { requireAuth } from '@/lib/auth-helpers';
import { getAndVerifyHousehold } from '@/lib/api/household-auth';
import { eq, and } from 'drizzle-orm';

export async function GET(request: Request) {
  const { userId } = await requireAuth();
  const { householdId } = await getAndVerifyHousehold(request, userId);
  
  // Add householdId to all queries
  .where(and(
    eq(bills.userId, userId),
    eq(bills.householdId, householdId) // ← ADD THIS
  ))
}
```

**Task 2.1: Update `/api/bills/route.ts`**
- **GET endpoint:**
  - Extract `householdId` from request header
  - Verify household membership
  - Add `eq(bills.householdId, householdId)` to all WHERE clauses
  - Update bill instances query to filter by household (via bill relationship)
- **POST endpoint:**
  - Extract `householdId` from request body
  - Verify household membership
  - Add `householdId` to bill creation
  - Ensure `accountId` belongs to same household (validation)

**Task 2.2: Update `/api/bills/[id]/route.ts`**
- **GET endpoint:**
  - Extract `householdId` from request header
  - Verify household membership
  - Add household filter to bill query
  - Verify bill belongs to household (security check)
- **PUT endpoint:**
  - Extract `householdId` from request body
  - Verify household membership
  - Verify existing bill belongs to household
  - Add household filter to update query
- **DELETE endpoint:**
  - Extract `householdId` from request header
  - Verify household membership
  - Verify bill belongs to household before deletion

**Task 2.3: Update `/api/bills/instances/route.ts`**
- **GET endpoint:**
  - Extract `householdId` from request header
  - Verify household membership
  - Filter bill instances by household (via bill relationship)
  - Update overdue status check to filter by household
- **POST endpoint:**
  - Extract `householdId` from request body
  - Verify household membership
  - Verify bill belongs to household
  - Add `householdId` to instance creation

**Task 2.4: Update `/api/bills/instances/[id]/route.ts`**
- **GET endpoint:**
  - Extract `householdId` from request header
  - Verify household membership
  - Filter by household via bill relationship
- **PUT endpoint:**
  - Extract `householdId` from request body
  - Verify household membership
  - Verify instance belongs to household
- **DELETE endpoint:**
  - Extract `householdId` from request header
  - Verify household membership
  - Verify instance belongs to household

**Task 2.5: Update `/api/bills/match/route.ts`**
- **POST endpoint:**
  - Extract `householdId` from request body
  - Verify household membership
  - Filter bills query by household
  - Filter transactions query by household (already done in Phase 1)
  - Ensure matching only occurs within same household

**Task 2.6: Update `/api/bills/detect/route.ts`**
- **POST endpoint:**
  - Extract `householdId` from request body
  - Verify household membership
  - Filter bills query by household
  - Filter transactions query by household (already done in Phase 1)

**Task 2.7: Add Validation Helpers**
- Create helper function to verify account belongs to household:
  ```typescript
  async function verifyAccountBelongsToHousehold(
    accountId: string,
    householdId: string,
    userId: string
  ): Promise<boolean>
  ```
- Create helper function to verify bill belongs to household:
  ```typescript
  async function verifyBillBelongsToHousehold(
    billId: string,
    householdId: string,
    userId: string
  ): Promise<boolean>
  ```

---

### Step 3: Budgets API Endpoints Updates

**Pattern to Apply:**
```typescript
import { requireAuth } from '@/lib/auth-helpers';
import { getAndVerifyHousehold } from '@/lib/api/household-auth';
import { eq, and } from 'drizzle-orm';

export async function GET(request: Request) {
  const { userId } = await requireAuth();
  const { householdId } = await getAndVerifyHousehold(request, userId);
  
  // Add householdId to all queries
  .where(and(
    eq(budgetCategories.userId, userId),
    eq(budgetCategories.householdId, householdId) // ← ADD THIS
  ))
}
```

**Task 3.1: Update `/api/budgets/route.ts`**
- **GET endpoint:**
  - Extract `householdId` from request header
  - Verify household membership
  - Add `eq(budgetCategories.householdId, householdId)` to WHERE clause
- **POST endpoint:**
  - Extract `householdId` from request body
  - Verify household membership
  - Ensure all category IDs belong to household (validation)
  - Update queries to filter by household

**Task 3.2: Update `/api/budgets/summary/route.ts`**
- **GET endpoint:**
  - Extract `householdId` from request header
  - Verify household membership
  - Filter income transactions by household (Phase 1 already done)
  - Filter expense transactions by household (Phase 1 already done)
  - Filter budget categories by household

**Task 3.3: Update `/api/budgets/overview/route.ts`**
- **GET endpoint:**
  - Extract `householdId` from request header
  - Verify household membership
  - Filter budget categories by household
  - Filter transactions by household (Phase 1 already done)

**Task 3.4: Update `/api/budgets/analyze/route.ts`**
- **GET endpoint:**
  - Extract `householdId` from request header
  - Verify household membership
  - Filter budget categories by household
  - Filter transactions by household (Phase 1 already done)
  - Update `calculateBudgetAdherence` helper to accept `householdId`

**Task 3.5: Update `/api/budgets/check/route.ts`**
- **GET endpoint:**
  - Extract `householdId` from request header
  - Verify household membership
  - Filter budget categories by household
  - Filter transactions by household (Phase 1 already done)

**Task 3.6: Update `/api/budgets/export/route.ts`**
- **GET endpoint:**
  - Extract `householdId` from request header
  - Verify household membership
  - Filter budget categories by household
  - Filter transactions by household (Phase 1 already done)

**Task 3.7: Update `/api/budgets/copy/route.ts`**
- **POST endpoint:**
  - Extract `householdId` from request body
  - Verify household membership
  - Verify source categories belong to household
  - Create new categories in same household

**Task 3.8: Update `/api/budgets/apply-surplus/route.ts`**
- **POST endpoint:**
  - Extract `householdId` from request body
  - Verify household membership
  - Filter budget categories by household
  - Filter transactions by household (Phase 1 already done)

**Task 3.9: Update `/api/budgets/surplus-suggestion/route.ts`**
- **GET endpoint:**
  - Extract `householdId` from request header
  - Verify household membership
  - Filter budget categories by household
  - Filter transactions by household (Phase 1 already done)

**Task 3.10: Update `/api/budgets/bills/variable/route.ts`**
- **GET endpoint:**
  - Extract `householdId` from request header
  - Verify household membership
  - Filter bills by household (after Step 2)
  - Filter bill instances by household (after Step 2)
  - Filter transactions by household (Phase 1 already done)

**Task 3.11: Update `/api/budgets/templates/route.ts`**
- **GET endpoint:**
  - Extract `householdId` from request header
  - Verify household membership
  - Filter templates by household (check if `budget_templates` has `householdId`)
- **POST endpoint:**
  - Extract `householdId` from request body
  - Verify household membership
  - Add `householdId` to template creation

---

### Step 4: Frontend Components Updates

**Pattern to Apply:**
```typescript
import { useHouseholdFetch } from '@/lib/hooks/use-household-fetch';
import { useHousehold } from '@/contexts/household-context';

function MyComponent() {
  const { selectedHouseholdId } = useHousehold();
  const { fetchWithHousehold, postWithHousehold } = useHouseholdFetch();
  
  useEffect(() => {
    if (!selectedHouseholdId) return;
    
    const loadData = async () => {
      const response = await fetchWithHousehold('/api/bills');
      // ... handle response
    };
    
    loadData();
  }, [selectedHouseholdId, fetchWithHousehold]);
}
```

**Task 4.1: Update Bills Page**
- File: `app/dashboard/bills/page.tsx`
- Replace direct `fetch()` calls with `useHouseholdFetch` hook
- Add household context readiness check
- Update 2 fetch calls:
  - `/api/bills?isActive=true&limit=100`
  - `/api/bills/instances?limit=1000`
- Add error handling for missing household

**Task 4.2: Update Bills Widget**
- File: `components/dashboard/bills-widget.tsx`
- Replace direct `fetch()` call with `useHouseholdFetch` hook
- Update 1 fetch call:
  - `/api/bills/instances?status=pending,paid&sortBy=dueDate`
- Add household context readiness check

**Task 4.3: Update Enhanced Bills Widget**
- File: `components/dashboard/enhanced-bills-widget.tsx`
- Replace direct `fetch()` call with `useHouseholdFetch` hook
- Update 1 fetch call:
  - `/api/bills/instances?status=pending,paid,overdue&sortBy=dueDate`
- Add household context readiness check

**Task 4.4: Update Bill Form Component**
- File: `components/bills/bill-form.tsx`
- Analyze component for API calls
- If it makes API calls, update to use `useHouseholdFetch`
- Ensure `onSubmit` callback receives `householdId` if needed

**Task 4.5: Update Variable Bill Tracker**
- File: `components/budgets/variable-bill-tracker.tsx`
- Replace direct `fetch()` call with `useHouseholdFetch` hook
- Update 1 fetch call:
  - `/api/budgets/bills/variable?month=${month}`
- Add household context readiness check

**Task 4.6: Update Compact Stats Bar**
- File: `components/dashboard/compact-stats-bar.tsx`
- Check if it uses budgets API
- If yes, update to use `useHouseholdFetch` hook
- Add household context readiness check

**Task 4.7: Search for Other Budget Components**
- Search codebase for components using `/api/budgets/*` endpoints
- Update each component to use `useHouseholdFetch`
- Ensure all budget-related components are updated

---

### Step 5: Testing & Validation

**Task 5.1: Database Migration Testing**
- Verify migration applied successfully
- Check all bills have `household_id` (no NULLs)
- Check all bill instances have `household_id` (no NULLs)
- Verify indexes created and working
- Test query performance with new indexes

**Task 5.2: API Endpoint Testing**
- Test each bills API endpoint:
  - Verify household filtering works
  - Verify cross-household access is blocked (403)
  - Verify missing household ID returns 400
  - Test with multiple households
- Test each budgets API endpoint:
  - Verify household filtering works
  - Verify cross-household access is blocked (403)
  - Verify missing household ID returns 400
  - Test with multiple households

**Task 5.3: Frontend Component Testing**
- Test bills page with multiple households:
  - Create bills in Household A
  - Switch to Household B
  - Verify Household A bills not visible
  - Create bills in Household B
  - Switch back to Household A
  - Verify only Household A bills visible
- Test budgets page with multiple households:
  - Create budgets in Household A
  - Switch to Household B
  - Verify Household A budgets not visible
  - Create budgets in Household B
  - Switch back to Household A
  - Verify only Household A budgets visible

**Task 5.4: Integration Testing**
- Test bill creation with account validation:
  - Create bill with account from different household (should fail)
  - Create bill with account from same household (should succeed)
- Test bill instance creation:
  - Create instance for bill in different household (should fail)
  - Create instance for bill in same household (should succeed)
- Test budget operations:
  - Verify budget calculations use household-filtered transactions
  - Verify budget summaries show household-specific data

**Task 5.5: Edge Case Testing**
- Test with user who belongs to multiple households
- Test with user who belongs to only one household
- Test with empty households (no bills/budgets)
- Test bill matching across households (should not match)
- Test variable bill tracking with household isolation

---

### Step 6: Documentation & Cleanup

**Task 6.1: Update Documentation**
- Update `docs/household-data-isolation-plan.md` to mark Phase 2 as complete
- Update `docs/features.md` to mark Phase 2 as complete
- Document any breaking changes or migration notes

**Task 6.2: Code Review Checklist**
- [ ] All API endpoints filter by household
- [ ] All frontend components use `useHouseholdFetch`
- [ ] All queries include household validation
- [ ] Security checks prevent cross-household access
- [ ] Error handling for missing household
- [ ] Migration successfully applied
- [ ] No performance regressions
- [ ] All tests passing

**Task 6.3: Performance Validation**
- Check query performance with new indexes
- Verify no N+1 query problems
- Check API response times
- Monitor database query execution times

---

## Security Considerations

### Authorization Checks Required

**Every API endpoint MUST:**
1. Verify user is authenticated (`requireAuth`)
2. Extract and validate `householdId` from request
3. Verify user is member of household (`requireHouseholdAuth`)
4. Filter all queries by `householdId`
5. Validate related entities belong to same household:
   - Bills must use accounts from same household
   - Bill instances must belong to bills from same household
   - Budgets must use categories from same household

### Prevent Data Leaks

- **Never trust client-sent household_id** - Always verify membership
- **Use parameterized queries** - Prevent SQL injection
- **Validate relationships** - Ensure accounts/bills/categories belong to household
- **Log access attempts** - Track unauthorized access attempts
- **Rate limiting** - Prevent enumeration attacks

---

## Rollback Plan

If issues arise during implementation:

1. **Database Rollback:**
   - Restore database from backup: `cp sqlite.db.backup-YYYYMMDD-HHMMSS sqlite.db`
   - Revert schema changes in `lib/db/schema.ts`
   - Remove migration file

2. **Code Rollback:**
   - Revert API endpoint changes via git
   - Revert frontend component changes via git
   - Deploy previous version

3. **Partial Rollback:**
   - If only some endpoints have issues, fix those specific endpoints
   - Keep working endpoints as-is
   - Test thoroughly before proceeding

---

## Success Criteria

### Phase 2 Complete When:
- [ ] `bills` table has `householdId` column with all data backfilled
- [ ] `bill_instances` table has `householdId` column with all data backfilled
- [ ] All 6 bills API endpoints filter by household
- [ ] All 11 budgets API endpoints filter by household
- [ ] All frontend components use `useHouseholdFetch` hook
- [ ] Switching households shows different bills/budgets
- [ ] User cannot access other household's bills/budgets
- [ ] All tests passing
- [ ] No performance degradation
- [ ] Documentation updated

### Validation:
1. Create test data in multiple households
2. Switch between households
3. Verify complete data isolation
4. Attempt to access other household via API manipulation (should fail)
5. Performance benchmarks meet requirements

---

## Estimated Timeline

- **Step 1 (Database Schema):** 2-3 hours
- **Step 2 (Bills API):** 4-5 hours
- **Step 3 (Budgets API):** 4-5 hours
- **Step 4 (Frontend Components):** 3-4 hours
- **Step 5 (Testing):** 3-4 hours
- **Step 6 (Documentation):** 1 hour

**Total:** 17-22 hours (2-3 days)

---

## Dependencies

- Phase 1 must be complete (transactions, accounts, categories, merchants isolation)
- `useHouseholdFetch` hook must exist (already exists)
- `household-auth.ts` helpers must exist (already exists)
- Household context must be working (already working)

---

## Notes

- Budget categories already have `householdId` from Phase 1, so budgets API updates are mainly adding filters
- Bills table needs `householdId` added, so this requires migration
- Bill instances inherit household from bills, so backfill is straightforward
- All styling should use semantic theme variables (already standard practice)
- All error messages should be user-friendly and use toast notifications

---

**Document Version:** 1.0  
**Created:** 2025-01-27  
**Status:** Ready for Implementation

