# Phase 3: Goals & Debts API Isolation - Implementation Plan

**Status:** Ready to Start  
**Priority:** High  
**Estimated Time:** 1-2 days  
**Created:** 2025-01-27  
**Dependencies:** Phase 2 complete ✅

---

## Overview

This plan implements household data isolation for Goals (Savings Goals) and Debts features. Currently, goals and debts data are filtered only by `userId`, allowing data leakage between households. This phase will:

1. Add `householdId` to goals and debts tables (and related tables)
2. Update all goals API endpoints to filter by household
3. Update all debts API endpoints to filter by household
4. Update frontend components to use household-aware fetch hooks
5. Create and apply database migrations with data backfill

---

## Current State Analysis

### Database Schema Status

**❌ Missing `householdId`:**
- `savings_goals` - Currently only has `userId`, needs `householdId` added
- `savings_milestones` - Currently only has `userId`, needs `householdId` added (inherit from goal)
- `debts` - Currently only has `userId`, needs `householdId` added
- `debt_payments` - Currently only has `userId`, needs `householdId` added (inherit from debt)
- `debt_payoff_milestones` - Currently only has `userId`, needs `householdId` added (inherit from debt)
- `debt_settings` - Currently only has `userId`, needs `householdId` added (user-level, but should be per-household)

**Note:** `budget_categories` already has `householdId` from Phase 1, so debt category creation will work correctly after migration.

### API Endpoints Status

**Savings Goals API Endpoints (3 files):**
- `app/api/savings-goals/route.ts` - GET, POST (filters by `userId` only)
- `app/api/savings-goals/[id]/route.ts` - GET, PUT, DELETE (filters by `userId` only)
- `app/api/savings-goals/[id]/progress/route.ts` - GET (filters by `userId` only)

**Debts API Endpoints (13 files):**
- `app/api/debts/route.ts` - GET, POST (filters by `userId` only)
- `app/api/debts/[id]/route.ts` - GET, PUT, DELETE (filters by `userId` only)
- `app/api/debts/[id]/payments/route.ts` - GET, POST (filters by `userId` only)
- `app/api/debts/stats/route.ts` - GET (filters by `userId` only)
- `app/api/debts/settings/route.ts` - GET, PUT (filters by `userId` only)
- `app/api/debts/payoff-strategy/route.ts` - GET (filters by `userId` only)
- `app/api/debts/scenarios/route.ts` - GET (filters by `userId` only)
- `app/api/debts/adherence/route.ts` - GET (filters by `userId` only)
- `app/api/debts/countdown/route.ts` - GET (filters by `userId` only)
- `app/api/debts/credit-utilization/route.ts` - GET (filters by `userId` only)
- `app/api/debts/minimum-warning/route.ts` - GET (filters by `userId` only)
- `app/api/debts/reduction-chart/route.ts` - GET (filters by `userId` only)
- `app/api/debts/streak/route.ts` - GET (filters by `userId` only)

### Frontend Components Status

**Goals Components:**
- `app/dashboard/goals/page.tsx` - Uses direct `fetch()` calls (4 calls)
- Other goal components may exist (need to search)

**Debts Components:**
- `app/dashboard/debts/page.tsx` - Uses direct `fetch()` calls (5+ calls)
- `app/dashboard/reports/page.tsx` - Uses debts API endpoints (2 calls)
- Other debt components may exist (need to search)

---

## Implementation Steps

### Step 1: Database Schema Updates

**Task 1.1: Update Savings Goals Table Schema**
- File: `lib/db/schema.ts`
- Add `householdId: text('household_id').notNull()` to `savingsGoals` table
- Add indexes:
  - `householdIdIdx: index('idx_savings_goals_household').on(table.householdId)`
  - `userHouseholdIdx: index('idx_savings_goals_user_household').on(table.userId, table.householdId)`
- Update existing `userIdIdx` to maintain compatibility

**Task 1.2: Update Savings Milestones Table Schema**
- File: `lib/db/schema.ts`
- Add `householdId: text('household_id').notNull()` to `savingsMilestones` table
- Add indexes:
  - `householdIdIdx: index('idx_savings_milestones_household').on(table.householdId)`
  - `userHouseholdIdx: index('idx_savings_milestones_user_household').on(table.userId, table.householdId)`
- Note: Milestones inherit household from parent goal

**Task 1.3: Update Debts Table Schema**
- File: `lib/db/schema.ts`
- Add `householdId: text('household_id').notNull()` to `debts` table
- Add indexes:
  - `householdIdIdx: index('idx_debts_household').on(table.householdId)`
  - `userHouseholdIdx: index('idx_debts_user_household').on(table.userId, table.householdId)`
- Update existing `userIdIdx` to maintain compatibility

**Task 1.4: Update Debt Payments Table Schema**
- File: `lib/db/schema.ts`
- Add `householdId: text('household_id').notNull()` to `debtPayments` table
- Add indexes:
  - `householdIdIdx: index('idx_debt_payments_household').on(table.householdId)`
  - `userHouseholdIdx: index('idx_debt_payments_user_household').on(table.userId, table.householdId)`
- Note: Payments inherit household from parent debt

**Task 1.5: Update Debt Payoff Milestones Table Schema**
- File: `lib/db/schema.ts`
- Add `householdId: text('household_id').notNull()` to `debtPayoffMilestones` table
- Add indexes:
  - `householdIdIdx: index('idx_debt_payoff_milestones_household').on(table.householdId)`
  - `userHouseholdIdx: index('idx_debt_payoff_milestones_user_household').on(table.userId, table.householdId)`
- Note: Milestones inherit household from parent debt

**Task 1.6: Update Debt Settings Table Schema**
- File: `lib/db/schema.ts`
- Add `householdId: text('household_id').notNull()` to `debtSettings` table
- Add indexes:
  - `householdIdIdx: index('idx_debt_settings_household').on(table.householdId)`
  - `userHouseholdIdx: index('idx_debt_settings_user_household').on(table.userId, table.householdId)`
- Note: Settings are per-household (user can have different debt strategies per household)

**Task 1.7: Generate Migration**
- Run `pnpm drizzle-kit generate` to create migration file
- Migration file will be: `drizzle/00XX_add_household_id_to_goals_debts.sql`
- Review migration SQL before applying

**Task 1.8: Create Migration SQL with Data Backfill**
- Migration should:
  1. Add `household_id` column as NULLABLE to all 6 tables
  2. Backfill existing records:
     ```sql
     -- Savings Goals: Assign to user's first household
     UPDATE savings_goals
     SET household_id = (
       SELECT hm.household_id
       FROM household_members hm
       WHERE hm.user_id = savings_goals.user_id
       AND hm.is_active = 1
       ORDER BY hm.joined_at ASC
       LIMIT 1
     )
     WHERE household_id IS NULL;
     
     -- Savings Milestones: Inherit from parent goal
     UPDATE savings_milestones
     SET household_id = (
       SELECT sg.household_id
       FROM savings_goals sg
       WHERE sg.id = savings_milestones.goal_id
     )
     WHERE household_id IS NULL;
     
     -- Debts: Assign to user's first household
     UPDATE debts
     SET household_id = (
       SELECT hm.household_id
       FROM household_members hm
       WHERE hm.user_id = debts.user_id
       AND hm.is_active = 1
       ORDER BY hm.joined_at ASC
       LIMIT 1
     )
     WHERE household_id IS NULL;
     
     -- Debt Payments: Inherit from parent debt
     UPDATE debt_payments
     SET household_id = (
       SELECT d.household_id
       FROM debts d
       WHERE d.id = debt_payments.debt_id
     )
     WHERE household_id IS NULL;
     
     -- Debt Payoff Milestones: Inherit from parent debt
     UPDATE debt_payoff_milestones
     SET household_id = (
       SELECT d.household_id
       FROM debts d
       WHERE d.id = debt_payoff_milestones.debt_id
     )
     WHERE household_id IS NULL;
     
     -- Debt Settings: Assign to user's first household (create one per household if needed)
     UPDATE debt_settings
     SET household_id = (
       SELECT hm.household_id
       FROM household_members hm
       WHERE hm.user_id = debt_settings.user_id
       AND hm.is_active = 1
       ORDER BY hm.joined_at ASC
       LIMIT 1
     )
     WHERE household_id IS NULL;
     ```
  3. Verify no NULLs remain
  4. Create indexes for performance
  5. Note: SQLite doesn't support ALTER COLUMN NOT NULL, so we rely on application-level validation

**Task 1.9: Apply Migration**
- Create database backup: `cp sqlite.db sqlite.db.backup-YYYYMMDD-HHMMSS`
- Run `pnpm drizzle-kit migrate` to apply migration
- Verify migration success:
  - Check all goals have `household_id` (0 NULL values)
  - Check all milestones have `household_id` (0 NULL values)
  - Check all debts have `household_id` (0 NULL values)
  - Check all payments have `household_id` (0 NULL values)
  - Check all payoff milestones have `household_id` (0 NULL values)
  - Check all settings have `household_id` (0 NULL values)
  - Verify indexes created

---

### Step 2: Savings Goals API Endpoints Updates

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
    eq(savingsGoals.userId, userId),
    eq(savingsGoals.householdId, householdId) // ← ADD THIS
  ))
}
```

**Task 2.1: Update `/api/savings-goals/route.ts`**
- **GET endpoint:**
  - Extract `householdId` from request header
  - Verify household membership
  - Add `eq(savingsGoals.householdId, householdId)` to WHERE clause
- **POST endpoint:**
  - Extract `householdId` from request body
  - Verify household membership
  - Add `householdId` to goal creation
  - Ensure `accountId` belongs to same household (validation)
  - Add `householdId` to milestone creation

**Task 2.2: Update `/api/savings-goals/[id]/route.ts`**
- **GET endpoint:**
  - Extract `householdId` from request header
  - Verify household membership
  - Add household filter to goal query
  - Verify goal belongs to household (security check)
  - Filter milestones by household
- **PUT endpoint:**
  - Extract `householdId` from request body
  - Verify household membership
  - Verify existing goal belongs to household
  - Add household filter to update query
- **DELETE endpoint:**
  - Extract `householdId` from request header
  - Verify household membership
  - Verify goal belongs to household before deletion

**Task 2.3: Update `/api/savings-goals/[id]/progress/route.ts`**
- **GET endpoint:**
  - Extract `householdId` from request header
  - Verify household membership
  - Filter goal by household
  - Filter transactions by household (Phase 1 already done)
  - Ensure calculations use household-filtered data

**Task 2.4: Add Validation Helpers**
- Create helper function to verify account belongs to household:
  ```typescript
  async function verifyAccountBelongsToHousehold(
    accountId: string,
    householdId: string,
    userId: string
  ): Promise<boolean>
  ```
- Create helper function to verify goal belongs to household:
  ```typescript
  async function verifyGoalBelongsToHousehold(
    goalId: string,
    householdId: string,
    userId: string
  ): Promise<boolean>
  ```

---

### Step 3: Debts API Endpoints Updates

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
    eq(debts.userId, userId),
    eq(debts.householdId, householdId) // ← ADD THIS
  ))
}
```

**Task 3.1: Update `/api/debts/route.ts`**
- **GET endpoint:**
  - Extract `householdId` from request header
  - Verify household membership
  - Add `eq(debts.householdId, householdId)` to WHERE clause
- **POST endpoint:**
  - Extract `householdId` from request body
  - Verify household membership
  - Add `householdId` to debt creation
  - Ensure `accountId` belongs to same household (validation)
  - Ensure `categoryId` belongs to same household (validation)
  - Add `householdId` to milestone creation

**Task 3.2: Update `/api/debts/[id]/route.ts`**
- **GET endpoint:**
  - Extract `householdId` from request header
  - Verify household membership
  - Add household filter to debt query
  - Verify debt belongs to household (security check)
  - Filter payments by household
  - Filter milestones by household
- **PUT endpoint:**
  - Extract `householdId` from request body
  - Verify household membership
  - Verify existing debt belongs to household
  - Add household filter to update query
- **DELETE endpoint:**
  - Extract `householdId` from request header
  - Verify household membership
  - Verify debt belongs to household before deletion

**Task 3.3: Update `/api/debts/[id]/payments/route.ts`**
- **GET endpoint:**
  - Extract `householdId` from request header
  - Verify household membership
  - Filter debt by household
  - Filter payments by household
- **POST endpoint:**
  - Extract `householdId` from request body
  - Verify household membership
  - Verify debt belongs to household
  - Add `householdId` to payment creation
  - Ensure `transactionId` belongs to same household (validation)

**Task 3.4: Update `/api/debts/stats/route.ts`**
- **GET endpoint:**
  - Extract `householdId` from request header
  - Verify household membership
  - Filter debts by household
  - Filter payments by household
  - Filter transactions by household (Phase 1 already done)

**Task 3.5: Update `/api/debts/settings/route.ts`**
- **GET endpoint:**
  - Extract `householdId` from request header
  - Verify household membership
  - Filter settings by household (create default if missing)
- **PUT endpoint:**
  - Extract `householdId` from request body
  - Verify household membership
  - Upsert settings for household (create if missing, update if exists)

**Task 3.6: Update `/api/debts/payoff-strategy/route.ts`**
- **GET endpoint:**
  - Extract `householdId` from request header
  - Verify household membership
  - Filter debts by household
  - Filter payments by household
  - Filter transactions by household (Phase 1 already done)

**Task 3.7: Update `/api/debts/scenarios/route.ts`**
- **GET endpoint:**
  - Extract `householdId` from request header
  - Verify household membership
  - Filter debts by household
  - Filter payments by household

**Task 3.8: Update `/api/debts/adherence/route.ts`**
- **GET endpoint:**
  - Extract `householdId` from request header
  - Verify household membership
  - Filter debts by household
  - Filter payments by household
  - Filter transactions by household (Phase 1 already done)

**Task 3.9: Update `/api/debts/countdown/route.ts`**
- **GET endpoint:**
  - Extract `householdId` from request header
  - Verify household membership
  - Filter debts by household
  - Filter payments by household

**Task 3.10: Update `/api/debts/credit-utilization/route.ts`**
- **GET endpoint:**
  - Extract `householdId` from request header
  - Verify household membership
  - Filter debts by household
  - Filter transactions by household (Phase 1 already done)

**Task 3.11: Update `/api/debts/minimum-warning/route.ts`**
- **GET endpoint:**
  - Extract `householdId` from request header
  - Verify household membership
  - Filter debts by household
  - Filter transactions by household (Phase 1 already done)

**Task 3.12: Update `/api/debts/reduction-chart/route.ts`**
- **GET endpoint:**
  - Extract `householdId` from request header
  - Verify household membership
  - Filter debts by household
  - Filter payments by household

**Task 3.13: Update `/api/debts/streak/route.ts`**
- **GET endpoint:**
  - Extract `householdId` from request header
  - Verify household membership
  - Filter debts by household
  - Filter payments by household
  - Filter transactions by household (Phase 1 already done)

**Task 3.14: Add Validation Helpers**
- Create helper function to verify debt belongs to household:
  ```typescript
  async function verifyDebtBelongsToHousehold(
    debtId: string,
    householdId: string,
    userId: string
  ): Promise<boolean>
  ```
- Reuse account validation helper from Step 2

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
      const response = await fetchWithHousehold('/api/savings-goals');
      // ... handle response
    };
    
    loadData();
  }, [selectedHouseholdId, fetchWithHousehold]);
}
```

**Task 4.1: Update Goals Page**
- File: `app/dashboard/goals/page.tsx`
- Replace direct `fetch()` calls with `useHouseholdFetch` hook
- Add household context readiness check
- Update 4 fetch calls:
  - `GET /api/savings-goals`
  - `GET /api/savings-goals/[id]`
  - `POST /api/savings-goals`
  - `PUT /api/savings-goals/[id]`
  - `DELETE /api/savings-goals/[id]`
- Add error handling for missing household

**Task 4.2: Update Debts Page**
- File: `app/dashboard/debts/page.tsx`
- Replace direct `fetch()` calls with `useHouseholdFetch` hook
- Add household context readiness check
- Update 5+ fetch calls:
  - `GET /api/debts`
  - `GET /api/debts/stats`
  - `GET /api/debts/[id]`
  - `POST /api/debts`
  - `PUT /api/debts/[id]`
  - `DELETE /api/debts/[id]`
  - `GET /api/debts/settings`
- Add error handling for missing household

**Task 4.3: Update Reports Page**
- File: `app/dashboard/reports/page.tsx`
- Replace direct `fetch()` calls with `useHouseholdFetch` hook
- Update 2 fetch calls:
  - `GET /api/debts/settings`
  - `GET /api/debts/payoff-strategy`
- Add household context readiness check

**Task 4.4: Search for Other Components**
- Search codebase for components using `/api/savings-goals/*` endpoints
- Search codebase for components using `/api/debts/*` endpoints
- Update each component to use `useHouseholdFetch`
- Ensure all goal/debt-related components are updated

---

### Step 5: Testing & Validation

**Task 5.1: Database Migration Testing**
- Verify migration applied successfully
- Check all goals have `household_id` (no NULLs)
- Check all milestones have `household_id` (no NULLs)
- Check all debts have `household_id` (no NULLs)
- Check all payments have `household_id` (no NULLs)
- Check all payoff milestones have `household_id` (no NULLs)
- Check all settings have `household_id` (no NULLs)
- Verify indexes created and working
- Test query performance with new indexes

**Task 5.2: API Endpoint Testing**
- Test each goals API endpoint:
  - Verify household filtering works
  - Verify cross-household access is blocked (403)
  - Verify missing household ID returns 400
  - Test with multiple households
- Test each debts API endpoint:
  - Verify household filtering works
  - Verify cross-household access is blocked (403)
  - Verify missing household ID returns 400
  - Test with multiple households

**Task 5.3: Frontend Component Testing**
- Test goals page with multiple households:
  - Create goals in Household A
  - Switch to Household B
  - Verify Household A goals not visible
  - Create goals in Household B
  - Switch back to Household A
  - Verify only Household A goals visible
- Test debts page with multiple households:
  - Create debts in Household A
  - Switch to Household B
  - Verify Household A debts not visible
  - Create debts in Household B
  - Switch back to Household A
  - Verify only Household A debts visible

**Task 5.4: Integration Testing**
- Test goal creation with account validation:
  - Create goal with account from different household (should fail)
  - Create goal with account from same household (should succeed)
- Test debt creation with account/category validation:
  - Create debt with account from different household (should fail)
  - Create debt with account from same household (should succeed)
- Test payment creation:
  - Create payment for debt in different household (should fail)
  - Create payment for debt in same household (should succeed)
- Test debt settings:
  - Verify settings are per-household
  - Verify switching households shows different settings

**Task 5.5: Edge Case Testing**
- Test with user who belongs to multiple households
- Test with user who belongs to only one household
- Test with empty households (no goals/debts)
- Test goal/debt calculations with household isolation
- Test milestone tracking with household isolation

---

### Step 6: Documentation & Cleanup

**Task 6.1: Update Documentation**
- Update `docs/household-data-isolation-plan.md` to mark Phase 3 as complete
- Update `docs/features.md` to mark Phase 3 as complete
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
   - Goals must use accounts from same household
   - Debts must use accounts/categories from same household
   - Payments must belong to debts from same household
   - Milestones must belong to goals/debts from same household

### Prevent Data Leaks

- **Never trust client-sent household_id** - Always verify membership
- **Use parameterized queries** - Prevent SQL injection
- **Validate relationships** - Ensure accounts/goals/debts belong to household
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

### Phase 3 Complete When:
- [ ] `savings_goals` table has `householdId` column with all data backfilled
- [ ] `savings_milestones` table has `householdId` column with all data backfilled
- [ ] `debts` table has `householdId` column with all data backfilled
- [ ] `debt_payments` table has `householdId` column with all data backfilled
- [ ] `debt_payoff_milestones` table has `householdId` column with all data backfilled
- [ ] `debt_settings` table has `householdId` column with all data backfilled
- [ ] All 3 goals API endpoints filter by household
- [ ] All 13 debts API endpoints filter by household
- [ ] All frontend components use `useHouseholdFetch` hook
- [ ] Switching households shows different goals/debts
- [ ] User cannot access other household's goals/debts
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
- **Step 2 (Goals API):** 1-2 hours
- **Step 3 (Debts API):** 4-5 hours
- **Step 4 (Frontend Components):** 2-3 hours
- **Step 5 (Testing):** 2-3 hours
- **Step 6 (Documentation):** 1 hour

**Total:** 12-17 hours (1.5-2 days)

---

## Dependencies

- Phase 2 must be complete (bills & budgets isolation) ✅
- `useHouseholdFetch` hook must exist (already exists) ✅
- `household-auth.ts` helpers must exist (already exists) ✅
- Household context must be working (already working) ✅

---

## Notes

- Goals and debts are user-level financial tracking features, so household isolation is critical
- Debt settings should be per-household (user can have different strategies per household)
- Milestones and payments inherit household from parent goal/debt
- All styling should use semantic theme variables (already standard practice)
- All error messages should be user-friendly and use toast notifications

---

**Document Version:** 1.0  
**Created:** 2025-01-27  
**Status:** Ready for Implementation

