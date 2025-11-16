# Phase 4: Business Logic Household Isolation - Implementation Plan

**Status:** Ready to Start  
**Priority:** High  
**Estimated Time:** 1-2 days  
**Created:** 2025-01-27  
**Dependencies:** Phase 3 complete ✅

---

## Overview

This plan implements household data isolation for business logic features: Rules Engine (categorization rules) and related functionality. Currently, categorization rules are filtered only by `userId`, allowing rules to apply to transactions across all households. This phase will:

1. Add `householdId` to categorization_rules table (and rule_execution_log)
2. Update all rules API endpoints to filter by household
3. Update rules engine (`lib/rules/rule-matcher.ts`) to filter by household
4. Update frontend components to use household-aware fetch hooks
5. Create and apply database migrations with data backfill

**Note:** Bill matching and usage analytics already have household filtering implemented, so they don't need updates.

---

## Current State Analysis

### Database Schema Status

**❌ Missing `householdId`:**
- `categorization_rules` - Currently only has `userId`, needs `householdId` added
- `rule_execution_log` - Currently only has `userId`, needs `householdId` added (inherit from rule or transaction)

**✅ Already Has `householdId`:**
- `usage_analytics` - Already has `householdId` (from Phase 1)
- Bill matching logic - Already filters by household (from Phase 2)

### API Endpoints Status

**Rules API Endpoints (3 files):**
- `app/api/rules/route.ts` - GET, POST (filters by `userId` only)
- `app/api/rules/[id]/route.ts` - GET, PUT, DELETE (filters by `userId` only)
- `app/api/rules/test/route.ts` - POST (filters by `userId` only)
- `app/api/rules/apply-bulk/route.ts` - POST (filters by `userId` only)

### Business Logic Status

**Rules Engine (`lib/rules/rule-matcher.ts`):**
- `findMatchingRule()` - Filters rules by `userId` only (line 105)
- Needs to filter by `householdId` as well

**Rule Action Handlers:**
- `lib/rules/account-action-handler.ts` - Already uses household context (line 195-219)
- Other action handlers may need updates

### Frontend Components Status

**Rules Components:**
- `app/dashboard/rules/page.tsx` - Uses direct `fetch()` calls
- `components/rules/` - Rule builder components
- Other components using rules API

---

## Implementation Steps

### Step 1: Database Schema Updates

**Task 1.1: Update Categorization Rules Table Schema**
- File: `lib/db/schema.ts`
- Add `householdId: text('household_id').notNull()` to `categorizationRules` table
- Add indexes:
  - `householdIdIdx: index('idx_categorization_rules_household').on(table.householdId)`
  - `userHouseholdIdx: index('idx_categorization_rules_user_household').on(table.userId, table.householdId)`
- Update existing `userIdIdx` to maintain compatibility

**Task 1.2: Update Rule Execution Log Table Schema**
- File: `lib/db/schema.ts`
- Add `householdId: text('household_id').notNull()` to `ruleExecutionLog` table
- Add indexes:
  - `householdIdIdx: index('idx_rule_execution_log_household').on(table.householdId)`
  - `userHouseholdIdx: index('idx_rule_execution_log_user_household').on(table.userId, table.householdId)`
- Note: Execution log can inherit household from rule or transaction

**Task 1.3: Generate Migration**
- Run `pnpm drizzle-kit generate` to create migration file
- Migration file will be: `drizzle/00XX_add_household_id_to_rules.sql`
- Review migration SQL before applying

**Task 1.4: Create Migration SQL with Data Backfill**
- Migration should:
  1. Add `household_id` column as NULLABLE to both tables
  2. Backfill existing records:
     ```sql
     -- Categorization Rules: Assign to user's first household
     UPDATE categorization_rules
     SET household_id = (
       SELECT hm.household_id
       FROM household_members hm
       WHERE hm.user_id = categorization_rules.user_id
       AND hm.is_active = 1
       ORDER BY hm.joined_at ASC
       LIMIT 1
     )
     WHERE household_id IS NULL;
     
     -- Rule Execution Log: Inherit from parent rule (or transaction)
     UPDATE rule_execution_log
     SET household_id = (
       SELECT COALESCE(
         (SELECT cr.household_id FROM categorization_rules cr WHERE cr.id = rule_execution_log.rule_id),
         (SELECT t.household_id FROM transactions t WHERE t.id = rule_execution_log.transaction_id)
       )
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
  - Check all rules have `household_id` (0 NULL values)
  - Check all execution logs have `household_id` (0 NULL values)
  - Verify indexes created

---

### Step 2: Rules API Endpoints Updates

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
    eq(categorizationRules.userId, userId),
    eq(categorizationRules.householdId, householdId) // ← ADD THIS
  ))
}
```

**Task 2.1: Update `/api/rules/route.ts`**
- **GET endpoint:**
  - Extract `householdId` from request header
  - Verify household membership
  - Add `eq(categorizationRules.householdId, householdId)` to WHERE clause
- **POST endpoint:**
  - Extract `householdId` from request body
  - Verify household membership
  - Add `householdId` to rule creation
  - Ensure `categoryId` belongs to same household (validation)

**Task 2.2: Update `/api/rules/[id]/route.ts`**
- **GET endpoint:**
  - Extract `householdId` from request header
  - Verify household membership
  - Add household filter to rule query
  - Verify rule belongs to household (security check)
- **PUT endpoint:**
  - Extract `householdId` from request body
  - Verify household membership
  - Verify existing rule belongs to household
  - Add household filter to update query
- **DELETE endpoint:**
  - Extract `householdId` from request header
  - Verify household membership
  - Verify rule belongs to household before deletion

**Task 2.3: Update `/api/rules/test/route.ts`**
- **POST endpoint:**
  - Extract `householdId` from request body
  - Verify household membership
  - Filter rules by household when testing
  - Ensure test transaction belongs to household (if provided)

**Task 2.4: Update `/api/rules/apply-bulk/route.ts`**
- **POST endpoint:**
  - Extract `householdId` from request body
  - Verify household membership
  - Filter transactions by household
  - Filter rules by household
  - Ensure all operations use household-filtered data

**Task 2.5: Add Validation Helpers**
- Create helper function to verify rule belongs to household:
  ```typescript
  async function verifyRuleBelongsToHousehold(
    ruleId: string,
    householdId: string,
    userId: string
  ): Promise<boolean>
  ```
- Reuse category validation helper from Phase 1

---

### Step 3: Rules Engine Updates

**Task 3.1: Update `findMatchingRule()` Function**
- File: `lib/rules/rule-matcher.ts`
- Add `householdId` parameter to function signature
- Update query to filter by both `userId` and `householdId`:
  ```typescript
  export async function findMatchingRule(
    userId: string,
    householdId: string, // ← ADD THIS
    transaction: TransactionData
  ): Promise<RuleEvaluationResult> {
    const rules = await db
      .select()
      .from(categorizationRules)
      .where(
        and(
          eq(categorizationRules.userId, userId),
          eq(categorizationRules.householdId, householdId), // ← ADD THIS
          eq(categorizationRules.isActive, true)
        )
      )
      .orderBy(asc(categorizationRules.priority));
    // ... rest of function
  }
  ```

**Task 3.2: Update All Callers of `findMatchingRule()`**
- Search codebase for all calls to `findMatchingRule()`
- Update each call to pass `householdId` parameter
- Files to check:
  - `app/api/transactions/route.ts` - Transaction creation
  - `app/api/rules/apply-bulk/route.ts` - Bulk rule application
  - `app/api/rules/test/route.ts` - Rule testing
  - Any other files using rules

**Task 3.3: Update Rule Execution Logging**
- File: `lib/rules/rule-executor.ts` (or wherever execution logging happens)
- Add `householdId` to execution log creation
- Ensure execution log inherits household from rule or transaction

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
      const response = await fetchWithHousehold('/api/rules');
      // ... handle response
    };
    
    loadData();
  }, [selectedHouseholdId, fetchWithHousehold]);
}
```

**Task 4.1: Update Rules Page**
- File: `app/dashboard/rules/page.tsx`
- Replace direct `fetch()` calls with `useHouseholdFetch` hook
- Add household context readiness check
- Update all fetch calls:
  - `GET /api/rules`
  - `POST /api/rules`
  - `PUT /api/rules/[id]`
  - `DELETE /api/rules/[id]`
  - `POST /api/rules/test`
  - `POST /api/rules/apply-bulk`
- Add error handling for missing household

**Task 4.2: Update Rules Components**
- Files in `components/rules/` directory
- Replace direct `fetch()` calls with `useHouseholdFetch` hook
- Add household context readiness check
- Ensure all components handle household switching correctly

**Task 4.3: Search for Other Components**
- Search codebase for components using `/api/rules/*` endpoints
- Update each component to use `useHouseholdFetch`
- Ensure all rule-related components are updated

---

### Step 5: Testing & Validation

**Task 5.1: Database Migration Testing**
- Verify migration applied successfully
- Check all rules have `household_id` (no NULLs)
- Check all execution logs have `household_id` (no NULLs)
- Verify indexes created and working
- Test query performance with new indexes

**Task 5.2: API Endpoint Testing**
- Test each rules API endpoint:
  - Verify household filtering works
  - Verify cross-household access is blocked (404)
  - Verify missing household ID returns 400
  - Test with multiple households

**Task 5.3: Rules Engine Testing**
- Test rule matching with household isolation:
  - Create rules in Household A
  - Create transaction in Household A → Rules apply
  - Create transaction in Household B → Rules from Household A don't apply
  - Create rules in Household B → Rules apply to Household B transactions

**Task 5.4: Frontend Component Testing**
- Test rules page with multiple households:
  - Create rules in Household A
  - Switch to Household B
  - Verify Household A rules not visible
  - Create rules in Household B
  - Switch back to Household A
  - Verify only Household A rules visible

**Task 5.5: Integration Testing**
- Test rule application during transaction creation:
  - Create transaction in Household A → Rules from Household A apply
  - Create transaction in Household B → Rules from Household B apply
  - Verify rules don't cross household boundaries
- Test bulk rule application:
  - Apply rules to Household A transactions → Only Household A rules apply
  - Apply rules to Household B transactions → Only Household B rules apply

---

### Step 6: Documentation & Cleanup

**Task 6.1: Update Documentation**
- Update `docs/household-data-isolation-plan.md` to mark Phase 4 as complete
- Update `docs/features.md` to mark Phase 4 as complete
- Document any breaking changes or migration notes

**Task 6.2: Code Review Checklist**
- [ ] All API endpoints filter by household
- [ ] All frontend components use `useHouseholdFetch`
- [ ] Rules engine filters by household
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
   - Rules must use categories from same household
   - Rules must apply to transactions from same household

### Prevent Data Leaks

- **Never trust client-sent household_id** - Always verify membership
- **Use parameterized queries** - Prevent SQL injection
- **Validate relationships** - Ensure categories/rules belong to household
- **Log access attempts** - Track unauthorized access attempts
- **Rate limiting** - Prevent enumeration attacks

---

## Success Criteria

### Phase 4 Complete When:
- [ ] `categorization_rules` table has `householdId` column with all data backfilled
- [ ] `rule_execution_log` table has `householdId` column with all data backfilled
- [ ] All 4 rules API endpoints filter by household
- [ ] Rules engine (`findMatchingRule`) filters by household
- [ ] All frontend components use `useHouseholdFetch` hook
- [ ] Switching households shows different rules
- [ ] User cannot access other household's rules
- [ ] Rules only apply to transactions from same household
- [ ] All tests passing
- [ ] No performance degradation
- [ ] Documentation updated

### Validation:
1. Create test rules in multiple households
2. Switch between households
3. Verify complete data isolation
4. Attempt to access other household via API manipulation (should fail)
5. Verify rules only apply to transactions from same household
6. Performance benchmarks meet requirements

---

## Estimated Timeline

- **Step 1 (Database Schema):** 1-2 hours
- **Step 2 (Rules API):** 2-3 hours
- **Step 3 (Rules Engine):** 1-2 hours
- **Step 4 (Frontend Components):** 1-2 hours
- **Step 5 (Testing):** 2-3 hours
- **Step 6 (Documentation):** 1 hour

**Total:** 8-13 hours (1-1.5 days)

---

## Dependencies

- Phase 3 must be complete (goals & debts isolation) ✅
- `useHouseholdFetch` hook must exist (already exists) ✅
- `household-auth.ts` helpers must exist (already exists) ✅
- Household context must be working (already working) ✅

---

## Notes

- Rules are household-specific (user can have different rules per household)
- Execution logs inherit household from rule or transaction
- All styling should use semantic theme variables (already standard practice)
- All error messages should be user-friendly and use toast notifications
- Bill matching and usage analytics already have household filtering, so they don't need updates

---

**Document Version:** 1.0  
**Created:** 2025-01-27  
**Status:** Ready for Implementation

