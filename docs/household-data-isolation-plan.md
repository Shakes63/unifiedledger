# Household Data Isolation - Implementation Plan

## Problem Statement

**Critical Issue:** All financial data (transactions, accounts, budgets, bills, goals, debts) is currently shared across all households. When a user switches households, they see the same data regardless of which household is selected.

**Root Cause:** Core data tables are missing `household_id` foreign key column. Data is only filtered by `user_id`, not by household.

**Current State:**
- 111 transactions (not household-filtered)
- 45 accounts (not household-filtered)
- 49 budget categories (not household-filtered)
- Bills, goals, debts, merchants, tags, and other data also not filtered

---

## Architecture Overview

### Data Ownership Model

**Two-Tier Filtering:**
1. **User-Level Data:** User settings, sessions, profiles (no household filtering needed)
2. **Household-Level Data:** All financial data must be filtered by household_id

**Household Relationship:**
- User can belong to multiple households (via `household_members` table)
- User selects active household via `selectedHouseholdId` in HouseholdContext
- All API requests must filter by both `userId` AND `householdId`
- Data is isolated: Household A cannot see Household B's data

---

## Tables Requiring household_id Column

### Settings Tables (NEW - Phase 0)
**IMPORTANT:** Settings need THREE-TIER architecture
- **Tier 1:** `user_settings` - User-only settings (profile, security, accessibility)
- **Tier 2:** `user_household_preferences` - User-per-household settings (theme, date format, notifications)
- **Tier 3:** `household_settings` - Household-only settings (currency, fiscal year, budget method)
- See `docs/settings-three-tier-architecture.md` for full details

### Core Financial Tables (CRITICAL - Phase 1)
1. ✅ **accounts** - Bank accounts belong to household
2. ✅ **budget_categories** - Budget categories are household-specific
3. ✅ **transactions** - All transactions belong to household
4. ✅ **merchants** - Merchant history is household-specific
5. ✅ **bills** - Added household_id in Phase 2 (2025-01-27) ✓
6. ✅ **bill_instances** - Added household_id in Phase 2 (2025-01-27) ✓
7. ✅ **debts** - Debt tracking per household (Phase 3)
8. ✅ **savings_goals** - Goals are household-specific (Phase 3)

### Secondary Tables (Phase 3)
9. ✅ **tags** - Tags are household-specific
10. ✅ **custom_fields** - Custom fields per household
11. ✅ **custom_field_values** - Values belong to household transactions
12. ✅ **transaction_tags** - Tag assignments
13. ✅ **categorization_rules** - Auto-categorization rules per household
14. ✅ **budget_templates** - Already has household_id (nullable) - make NOT NULL
15. ✅ **saved_search_filters** - Already has household_id (nullable) - make NOT NULL

### Supporting Tables (Phase 3)
16. ✅ **import_templates** - Already has household_id (nullable) - make NOT NULL
17. ✅ **import_history** - Already has household_id (nullable) - make NOT NULL
18. ✅ **import_staging** - Needs household_id for data isolation
19. ✅ **usage_analytics** - Track usage per household
20. ✅ **search_history** - Search history per household

### Tax & Reporting Tables (Phase 4)
21. ✅ **transaction_tax_classifications** - Tax data per household
22. ✅ **sales_tax_transactions** - Sales tax tracking per household
23. ✅ **quarterly_filing_records** - Tax filing records per household

### Notification & Activity Tables (Already Have)
- ✅ **notifications** - Already has household_id ✓
- ✅ **household_activity_log** - Already has household_id ✓
- ✅ **bill_instances** - Already has household_id ✓

### Tables That DON'T Need household_id
- **users** - User profiles (user-level)
- **user_settings** - Has `defaultHouseholdId` reference but settings are user-level
- **user_sessions** - Session data (user-level)
- **households** - The household table itself
- **household_members** - Junction table (already filtered)
- **household_invitations** - Already has household_id ✓

---

## Database Schema Changes

### Schema Updates Needed

```typescript
// Example: accounts table
export const accounts = sqliteTable(
  'accounts',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    householdId: text('household_id').notNull(), // ← ADD THIS
    name: text('name').notNull(),
    // ... rest of fields
  },
  (table) => ({
    userIdIdx: index('idx_accounts_user').on(table.userId),
    householdIdIdx: index('idx_accounts_household').on(table.householdId), // ← ADD INDEX
    userHouseholdIdx: index('idx_accounts_user_household').on(table.userId, table.householdId), // ← COMPOSITE INDEX
  })
);
```

### Migration Strategy

**For Existing Data:**
1. Add `household_id` column as NULLABLE first
2. Backfill existing records with user's first/default household
3. Make column NOT NULL after backfill
4. Add indexes for performance

**SQL Migration Template:**
```sql
-- Step 1: Add column (nullable)
ALTER TABLE table_name ADD COLUMN household_id TEXT;

-- Step 2: Backfill with user's first household
UPDATE table_name
SET household_id = (
  SELECT hm.household_id
  FROM household_members hm
  WHERE hm.user_id = table_name.user_id
  ORDER BY hm.joined_at ASC
  LIMIT 1
)
WHERE household_id IS NULL;

-- Step 3: Verify no NULLs remain
-- SELECT COUNT(*) FROM table_name WHERE household_id IS NULL;

-- Step 4: Create indexes
CREATE INDEX idx_table_name_household ON table_name(household_id);
CREATE INDEX idx_table_name_user_household ON table_name(user_id, household_id);
```

**Note:** SQLite doesn't support ALTER COLUMN to add NOT NULL constraint, so we'll rely on application-level validation and new inserts will use NOT NULL via Drizzle schema.

---

## API Endpoint Updates

### Current Problem
```typescript
// ❌ WRONG: Only filters by userId
const transactions = await db
  .select()
  .from(transactions)
  .where(eq(transactions.userId, userId));
```

### Required Fix
```typescript
// ✅ CORRECT: Filters by both userId AND householdId
const transactions = await db
  .select()
  .from(transactions)
  .where(
    and(
      eq(transactions.userId, userId),
      eq(transactions.householdId, householdId)
    )
  );
```

### How to Get householdId in API Routes

**Option 1: From Request Headers**
```typescript
const householdId = request.headers.get('x-household-id');
if (!householdId) {
  return Response.json({ error: 'Household ID required' }, { status: 400 });
}
```

**Option 2: From Query Parameters**
```typescript
const url = new URL(request.url);
const householdId = url.searchParams.get('householdId');
```

**Option 3: From Request Body (POST/PUT/DELETE)**
```typescript
const body = await request.json();
const { householdId } = body;
```

**Recommended:** Use request header `x-household-id` for GET requests, body for mutations.

### API Endpoints Requiring Updates

**Phase 1 - Critical (Transactions & Accounts)**
- `GET /api/transactions` - List transactions
- `POST /api/transactions` - Create transaction
- `PUT /api/transactions/[id]` - Update transaction
- `DELETE /api/transactions/[id]` - Delete transaction
- `GET /api/accounts` - List accounts
- `POST /api/accounts` - Create account
- `PUT /api/accounts/[id]` - Update account
- `DELETE /api/accounts/[id]` - Delete account

**Phase 2 - Bills & Budgets ✅ COMPLETE (2025-01-27)**
- ✅ `/api/bills/*` - Bills API (12 endpoints isolated)
- ✅ `/api/budgets/*` - Budgets API (11 endpoints isolated)

**Phase 3 - Goals, Debts & Supporting Features**
- `/api/categories/*` - Budget categories (already isolated in Phase 1)
- `/api/merchants/*` - Merchants (already isolated in Phase 1)
- `/api/goals/*` - Savings goals
- `/api/debts/*` - Debt tracking

**Phase 3 - Supporting Features**
- `/api/tags/*` - Tags
- `/api/rules/*` - Categorization rules
- `/api/reports/*` - Financial reports
- `/api/tax/*` - Tax reporting
- `/api/search/*` - Search functionality

---

## Frontend Integration

### Household Context Usage

**Get Active Household:**
```typescript
import { useHousehold } from '@/contexts/household-context';

function MyComponent() {
  const { selectedHouseholdId } = useHousehold();

  // Use in API calls
  const response = await fetch('/api/transactions', {
    headers: {
      'x-household-id': selectedHouseholdId || '',
    },
  });
}
```

### API Helper Function

**Create Reusable Fetch Helper:**
```typescript
// lib/api-client.ts
import { useHousehold } from '@/contexts/household-context';

export function useHouseholdApi() {
  const { selectedHouseholdId } = useHousehold();

  async function fetchWithHousehold(url: string, options: RequestInit = {}) {
    if (!selectedHouseholdId) {
      throw new Error('No household selected');
    }

    return fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        'x-household-id': selectedHouseholdId,
      },
    });
  }

  return { fetchWithHousehold };
}
```

### Components Requiring Updates

**All data-fetching components:**
- Transaction list/form
- Account list/form
- Budget dashboard
- Bills page
- Goals page
- Debts page
- Reports page
- Tax dashboard
- And many more...

---

## Implementation Phases

### Phase 0: Settings Reorganization (FOUNDATIONAL)
**Goal:** Separate user-level and household-level settings

**Why First:** Theme and preferences need to be household-specific before we can properly test household switching

**Tasks:**
1. Create `household_settings` table
2. Migrate settings from `user_settings` to appropriate table
3. Create household settings API endpoints
4. Restructure settings page UI (two-tier: Household & User)
5. Update theme system to use household settings

**Estimated Impact:** 15 API endpoints, 12 components, 2 new tables
**Timeline:** 7 days

See full plan: `docs/settings-three-tier-architecture.md`

### Phase 1: Core Financial Data (HIGHEST PRIORITY)
**Goal:** Separate transaction and account data by household

**Tasks:**
1. Update database schema for: accounts, transactions, budget_categories, merchants
2. Create and apply migrations with data backfill
3. Update API endpoints for transactions and accounts
4. Add household header to frontend transaction/account fetches
5. Test: Switch households and verify different data appears

**Estimated Impact:** ~40 API endpoints, ~20 components

### Phase 2: Bills & Budgets API Isolation ✅ COMPLETE (2025-01-27)
**Goal:** Complete household isolation for bills and budgets features

**Status:** ✅ COMPLETE
**Completion Date:** 2025-01-27

**Tasks Completed:**
1. ✅ Updated database schema for: bills, bill_instances (budget_categories already had household_id from Phase 1)
2. ✅ Applied migration `0043_add_household_id_to_bills.sql` with data backfill (0 NULL values)
3. ✅ Updated 12 bills API endpoints to filter by household
4. ✅ Updated 11 budgets API endpoints to filter by household
5. ✅ Updated 13 frontend components to use `useHouseholdFetch` hook
6. ✅ Comprehensive testing completed (see `docs/phase-2-step-5-test-results.md`)

**Actual Impact:** 23 API endpoints, 13 frontend components, 2 database tables migrated, 4 indexes created

**Key Achievements:**
- All bills and bill instances now isolated by household
- All budget operations filtered by household
- Complete frontend integration with household context
- Zero data leakage between households verified
- Performance maintained with optimized indexes

**Remaining for Phase 2 Scope:**
- ⏳ Goals & Debts API isolation (moved to Phase 3)
- ⏳ Tags & Custom Fields isolation (moved to Phase 3)

### Phase 3: Supporting Features
**Goal:** Household-specific categorization rules, templates, search

**Tasks:**
1. Update schema for: categorization_rules, budget_templates, saved_search_filters
2. Apply migrations
3. Update API endpoints
4. Update frontend
5. Test

**Estimated Impact:** ~15 API endpoints, ~10 components

### Phase 4: Tax & Reporting
**Goal:** Household-specific tax tracking and reports

**Tasks:**
1. Update schema for: transaction_tax_classifications, sales_tax_transactions
2. Apply migrations
3. Update reporting APIs
4. Update tax dashboard
5. Test

**Estimated Impact:** ~10 API endpoints, ~5 components

---

## Testing Strategy

### Unit Tests
- Verify household_id is added to all queries
- Test data isolation between households
- Verify user can't access other household's data

### Integration Tests
- Create data in Household A
- Switch to Household B
- Verify Household A data is not visible
- Create data in Household B
- Switch back to Household A
- Verify only Household A data is visible

### Manual Testing Checklist
- [ ] Create transaction in Household A
- [ ] Switch to Household B
- [ ] Verify transaction from A is not visible
- [ ] Create transaction in Household B
- [ ] Switch back to Household A
- [ ] Verify only Household A transactions visible
- [ ] Repeat for accounts, budgets, bills, goals, debts
- [ ] Test reports show household-specific data
- [ ] Test search only returns household data
- [ ] Test rules only apply to household transactions

---

## Rollout Strategy

### Development Approach
1. **Branch:** Create feature branch `feature/household-data-isolation`
2. **Incremental:** Implement phase by phase
3. **Testing:** Test each phase before moving to next
4. **Review:** Code review for security (prevent cross-household data leaks)

### Data Migration Safety
1. **Backup:** Create database backup before any migration
2. **Dry Run:** Test migrations on copy of database first
3. **Validation:** Verify all records have household_id after migration
4. **Rollback Plan:** Keep backup for 7 days

### Performance Considerations
- Add composite indexes: `(user_id, household_id)` for fast filtering
- Consider caching household_id in API routes to reduce lookups
- Monitor query performance after adding household filters

---

## Security Implications

### Authorization Checks Required

**Every API endpoint MUST:**
1. Verify user is authenticated (`requireAuth`)
2. Verify user is member of requested household
3. Verify user has permission for requested action (based on role)

**Example Security Check:**
```typescript
export async function GET(request: Request) {
  const { userId } = await requireAuth();
  const householdId = request.headers.get('x-household-id');

  // Verify user is member of household
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
    return Response.json({ error: 'Unauthorized' }, { status: 403 });
  }

  // Proceed with household-filtered query...
}
```

### Prevent Data Leaks
- **Never trust client-sent household_id** - Always verify membership
- **Use parameterized queries** - Prevent SQL injection
- **Log access attempts** - Track who accesses what household data
- **Rate limiting** - Prevent enumeration attacks

---

## Estimated Effort

### Development Time
- **Phase 1:** 2-3 days (schema, migrations, core APIs, frontend)
- **Phase 2:** 1-2 days (bills, goals, debts)
- **Phase 3:** 1 day (supporting features)
- **Phase 4:** 1 day (tax & reporting)
- **Testing & QA:** 1-2 days
- **Total:** 6-9 days

### Files to Modify
- **Database Schema:** 1 file (`lib/db/schema.ts`)
- **Migrations:** ~20 migration SQL files
- **API Routes:** ~90 endpoint files
- **Frontend Components:** ~50 component files
- **Utilities:** ~5 helper files

### Complexity: HIGH
- Touches entire application architecture
- Requires careful data migration
- Security-critical changes
- High testing requirements

---

## Success Criteria

### Feature Complete When:
- [ ] All core tables have household_id column
- [ ] All existing data assigned to correct household
- [ ] All API endpoints filter by household_id
- [ ] Frontend passes household_id in all requests
- [ ] Switching households shows different data
- [ ] User cannot access other household's data
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

## Risks & Mitigation

### Risk 1: Data Migration Errors
**Impact:** Data loss or corruption
**Mitigation:**
- Full database backup before migration
- Dry run on copy
- Validation queries after each migration

### Risk 2: Missing household_id Filters
**Impact:** Data leaks between households
**Security Risk:** HIGH
**Mitigation:**
- Code review checklist
- Automated tests for data isolation
- Security audit of all API endpoints

### Risk 3: Performance Degradation
**Impact:** Slow queries
**Mitigation:**
- Composite indexes on (user_id, household_id)
- Query performance testing
- Caching strategies

### Risk 4: Breaking Existing Functionality
**Impact:** App unusable
**Mitigation:**
- Incremental rollout by phase
- Feature flags for gradual enablement
- Rollback plan

---

## Next Steps

1. **Review & Approve Plan** - Stakeholder sign-off
2. **Create Feature Branch** - Start development
3. **Phase 1 Implementation** - Core financial data
4. **Testing & Validation** - Each phase
5. **Production Deployment** - After all phases complete

---

**Document Version:** 1.0
**Created:** 2025-11-14
**Status:** DRAFT - Awaiting Approval
**Priority:** CRITICAL - Blocks multi-household usage
