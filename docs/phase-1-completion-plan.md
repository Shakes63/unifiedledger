# Phase 1 Completion Plan - Detailed Implementation Guide

**Status:** Phase 1 is 50% Complete - Infrastructure ready, now implementing endpoints
**Goal:** Complete household isolation for core financial data (transactions, categories, merchants, dashboard)
**Estimated Time:** 1-2 days

---

## What's Already Done ✅

1. ✅ Database schema updated (6 tables with household_id + 15 indexes)
2. ✅ Migration file created: `drizzle/0042_add_household_id_to_core_tables.sql`
3. ✅ Backend auth helpers: `lib/api/household-auth.ts`
4. ✅ Frontend hook: `lib/hooks/use-household-fetch.ts`
5. ✅ Accounts API endpoints working (GET, POST, PUT, DELETE)

---

## Implementation Order

We'll implement in this specific order for logical dependencies:

1. **Transactions API Endpoints** (7 endpoints) - 3-4 hours
2. **Categories API Endpoints** (4 endpoints) - 1-2 hours
3. **Merchants API Endpoints** (4 endpoints) - 1-2 hours
4. **Dashboard API Endpoints** (3 endpoints) - 1 hour
5. **Frontend Components** (20 components) - 3-4 hours
6. **Business Logic** (rules, bills, usage) - 1-2 hours
7. **Apply Migration** - 15 minutes
8. **Testing & Documentation** - 2-3 hours

**Total: ~12-18 hours over 1-2 days**

---

## Phase 1: Transactions API Endpoints (Priority 1)

### Overview
Transactions are the core of the app. These endpoints handle:
- Transaction listing with pagination/filtering
- Creating new transactions (including transfers, splits)
- Updating/deleting transactions
- Bulk CSV import
- Advanced search
- Statistics and recent transactions
- Duplicate detection

### Endpoints to Update (7 files)

#### 1.1 `/api/transactions/route.ts` - List & Create Transactions

**File:** `app/api/transactions/route.ts`

**Changes Required:**

**GET Handler:**
- Import household auth helpers
- Extract household ID from `x-household-id` header
- Validate user is household member
- Add `householdId` filter to WHERE clause
- Handle pagination with household context

**POST Handler:**
- Import household auth helpers
- Extract household ID from header and body
- Validate user is household member
- Add `householdId` to INSERT statement for main transaction
- **IMPORTANT:** If creating splits, add `householdId` to all splits too
- **IMPORTANT:** If transfer transaction, both transfer_out and transfer_in must have same `householdId`
- Update account balance queries to include household filter

**Pattern:**
```typescript
import { getHouseholdIdFromRequest, requireHouseholdAuth } from '@/lib/api/household-auth';
import { and } from 'drizzle-orm';

// GET
const householdId = getHouseholdIdFromRequest(request);
await requireHouseholdAuth(userId, householdId);

const transactions = await db
  .select()
  .from(transactions)
  .where(
    and(
      eq(transactions.userId, userId),
      eq(transactions.householdId, householdId)
    )
  );

// POST
const householdId = getHouseholdIdFromRequest(request, body);
await requireHouseholdAuth(userId, householdId);

await db.insert(transactions).values({
  id: transactionId,
  userId,
  householdId: householdId!, // Add this
  // ... rest of fields
});
```

**Testing Considerations:**
- Verify transactions only show for active household
- Verify transfer transactions stay in same household
- Verify splits inherit parent transaction's household

---

#### 1.2 `/api/transactions/[id]/route.ts` - Get, Update, Delete Transaction

**File:** `app/api/transactions/[id]/route.ts`

**Changes Required:**

**GET Handler:**
- Add household auth check
- Add `householdId` to WHERE clause when fetching transaction
- Return 404 if transaction not found in user's household

**PUT Handler:**
- Add household auth check
- Verify transaction belongs to user AND household before update
- If updating splits, ensure splits stay in same household
- If changing amount/account, verify account belongs to household

**DELETE Handler:**
- Add household auth check
- Verify transaction belongs to user AND household before delete
- If deleting transfer, verify both sides belong to household
- Update account balances with household filter

**Pattern:**
```typescript
// Verify ownership
const transaction = await db
  .select()
  .from(transactions)
  .where(
    and(
      eq(transactions.id, id),
      eq(transactions.userId, userId),
      eq(transactions.householdId, householdId)
    )
  )
  .limit(1);

if (!transaction || transaction.length === 0) {
  return Response.json({ error: 'Transaction not found' }, { status: 404 });
}
```

**Testing Considerations:**
- Cannot access transaction from different household
- Cannot update transaction to different household's account
- Deleting transaction doesn't affect other household's data

---

#### 1.3 `/api/transactions/bulk-import/route.ts` - CSV Bulk Import

**File:** `app/api/transactions/bulk-import/route.ts`

**Changes Required:**

**POST Handler:**
- Add household auth check
- All imported transactions must have `householdId` set
- Verify all account references belong to household
- Verify all category references belong to household
- Merchant matching should only match merchants in same household
- Bill matching should only match bills in same household

**Pattern:**
```typescript
const householdId = getHouseholdIdFromRequest(request, body);
await requireHouseholdAuth(userId, householdId);

// Verify account exists in household
const account = await db
  .select()
  .from(accounts)
  .where(
    and(
      eq(accounts.id, accountId),
      eq(accounts.userId, userId),
      eq(accounts.householdId, householdId)
    )
  )
  .limit(1);

if (!account || account.length === 0) {
  throw new Error('Account not found in household');
}

// Create all transactions with householdId
const newTransactions = importedData.map(row => ({
  id: nanoid(),
  userId,
  householdId: householdId!, // Add to all
  // ... rest of fields
}));
```

**Testing Considerations:**
- Importing creates transactions in correct household
- Cannot import to another household's accounts
- Merchant matching only uses household's merchants
- Bill matching only uses household's bills

---

#### 1.4 `/api/transactions/search/route.ts` - Advanced Search

**File:** `app/api/transactions/search/route.ts`

**Changes Required:**

**POST Handler:**
- Add household auth check
- Add `householdId` to base WHERE clause
- All search filters (account, category, merchant) must include household check
- Date range filters combined with household filter

**Pattern:**
```typescript
const conditions = [
  eq(transactions.userId, userId),
  eq(transactions.householdId, householdId), // Always filter by household
];

// Add other search conditions
if (accountId) {
  // Verify account belongs to household first
  conditions.push(eq(transactions.accountId, accountId));
}

if (categoryId) {
  // Verify category belongs to household first
  conditions.push(eq(transactions.categoryId, categoryId));
}

const results = await db
  .select()
  .from(transactions)
  .where(and(...conditions));
```

**Testing Considerations:**
- Search only returns results from active household
- Account/category/merchant filters respect household
- Cannot search across households

---

#### 1.5 `/api/transactions/stats/route.ts` - Transaction Statistics

**File:** `app/api/transactions/stats/route.ts`

**Changes Required:**

**GET Handler:**
- Add household auth check
- All aggregation queries must filter by `householdId`
- Income/expense totals per household
- Category breakdowns per household
- Monthly trends per household

**Pattern:**
```typescript
const householdId = getHouseholdIdFromRequest(request);
await requireHouseholdAuth(userId, householdId);

// Calculate stats only for household
const stats = await db
  .select({
    totalIncome: sum(transactions.amount),
    totalExpense: sum(transactions.amount),
    transactionCount: count(),
  })
  .from(transactions)
  .where(
    and(
      eq(transactions.userId, userId),
      eq(transactions.householdId, householdId),
      // ... date range, type filters
    )
  );
```

**Testing Considerations:**
- Stats only include household's transactions
- Switching households shows different stats
- Aggregations accurate per household

---

#### 1.6 `/api/transactions/recent/route.ts` - Recent Transactions

**File:** `app/api/transactions/recent/route.ts`

**Changes Required:**

**GET Handler:**
- Add household auth check
- Add `householdId` to WHERE clause
- Order by date DESC, limit to recent (default 10)

**Pattern:**
```typescript
const householdId = getHouseholdIdFromRequest(request);
await requireHouseholdAuth(userId, householdId);

const recentTransactions = await db
  .select()
  .from(transactions)
  .where(
    and(
      eq(transactions.userId, userId),
      eq(transactions.householdId, householdId)
    )
  )
  .orderBy(desc(transactions.date))
  .limit(10);
```

**Testing Considerations:**
- Only shows recent from active household
- Switching households shows different recent list

---

#### 1.7 `/api/transactions/duplicate-check/route.ts` - Duplicate Detection

**File:** `app/api/transactions/duplicate-check/route.ts`

**Changes Required:**

**POST Handler:**
- Add household auth check
- Only check for duplicates within same household
- Levenshtein matching should be household-scoped

**Pattern:**
```typescript
const householdId = getHouseholdIdFromRequest(request, body);
await requireHouseholdAuth(userId, householdId);

// Find potential duplicates only in household
const potentialDuplicates = await db
  .select()
  .from(transactions)
  .where(
    and(
      eq(transactions.userId, userId),
      eq(transactions.householdId, householdId),
      // ... similarity conditions
    )
  );
```

**Testing Considerations:**
- Duplicate detection scoped to household
- Similar transactions in other households don't trigger match

---

## Phase 2: Categories API Endpoints (Priority 2)

### Endpoints to Update (4 files)

#### 2.1 `/api/categories/route.ts` - List & Create Categories

**File:** `app/api/categories/route.ts`

**Changes Required:**
- GET: Filter by `householdId`
- POST: Include `householdId` when creating category

**Pattern:** (Same as transactions pattern above)

---

#### 2.2 `/api/categories/[id]/route.ts` - Get, Update, Delete Category

**File:** `app/api/categories/[id]/route.ts`

**Changes Required:**
- GET/PUT/DELETE: Verify category belongs to household

**Special Consideration:**
- Before deleting category, check if any transactions in household use it

---

#### 2.3 `/api/categories/[id]/budget/route.ts` - Update Category Budget

**File:** `app/api/categories/[id]/budget/route.ts`

**Changes Required:**
- Verify category belongs to household
- Budget limits are per-household

---

#### 2.4 `/api/categories/stats/route.ts` - Category Statistics

**File:** `app/api/categories/stats/route.ts`

**Changes Required:**
- All spending stats filtered by household
- Join with transactions using household filter

---

## Phase 3: Merchants API Endpoints (Priority 3)

### Endpoints to Update (4 files)

#### 3.1 `/api/merchants/route.ts` - List & Create Merchants

**File:** `app/api/merchants/route.ts`

**Changes Required:**
- GET: Filter by `householdId`
- POST: Include `householdId` when creating merchant

**Special Consideration:**
- Merchant names should be unique per household (not globally)
- Update unique constraint check to include household

---

#### 3.2 `/api/merchants/[id]/route.ts` - Get, Update, Delete Merchant

**File:** `app/api/merchants/[id]/route.ts`

**Changes Required:**
- Verify merchant belongs to household

---

#### 3.3 `/api/merchants/search/route.ts` - Search Merchants

**File:** `app/api/merchants/search/route.ts`

**Changes Required:**
- Search only in household's merchants
- Fuzzy matching scoped to household

---

#### 3.4 `/api/merchants/stats/route.ts` - Merchant Statistics

**File:** `app/api/merchants/stats/route.ts`

**Changes Required:**
- Transaction counts per merchant per household
- Spending totals per merchant per household

---

## Phase 4: Dashboard API Endpoints (Priority 4)

### Endpoints to Update (3 files)

#### 4.1 `/api/dashboard/stats/route.ts` - Dashboard Statistics

**File:** `app/api/dashboard/stats/route.ts`

**Changes Required:**
- All aggregations filtered by household
- Account balances, transaction counts, budget adherence all per-household

---

#### 4.2 `/api/dashboard/recent-activity/route.ts` - Recent Activity

**File:** `app/api/dashboard/recent-activity/route.ts`

**Changes Required:**
- Recent transactions, bills, goals all filtered by household

---

#### 4.3 `/api/analytics/route.ts` - Analytics Data

**File:** `app/api/analytics/route.ts`

**Changes Required:**
- All analytics queries filtered by household
- Trends, patterns, insights all per-household

---

## Phase 5: Frontend Components (20 components)

### Approach
Replace all `fetch()` calls with `useHouseholdFetch()` hook methods.

### Component Groups

#### 5.1 Transaction Components (6 components)

1. **`components/transactions/transaction-form.tsx`**
   - Replace `fetch('/api/transactions')` with `postWithHousehold('/api/transactions', data)`
   - No need to manually add householdId to data (hook handles it)

2. **`components/transactions/transaction-list.tsx`**
   - Replace `fetch('/api/transactions')` with `fetchWithHousehold('/api/transactions')`
   - Add dependency on `selectedHouseholdId` to refresh when household changes

3. **`components/transactions/transaction-filters.tsx`**
   - Replace `fetch('/api/transactions/search')` with `postWithHousehold('/api/transactions/search', filters)`

4. **`components/transactions/quick-entry-modal.tsx`**
   - Replace `fetch('/api/transactions')` with `postWithHousehold('/api/transactions', data)`

5. **`components/transactions/csv-import-modal.tsx`**
   - Replace `fetch('/api/transactions/bulk-import')` with `postWithHousehold('/api/transactions/bulk-import', data)`

6. **`app/dashboard/transactions/page.tsx`**
   - Update main page data fetching with `fetchWithHousehold`

**Pattern for all:**
```typescript
import { useHouseholdFetch } from '@/lib/hooks/use-household-fetch';

const { fetchWithHousehold, postWithHousehold, selectedHouseholdId } = useHouseholdFetch();

// For GET requests
const response = await fetchWithHousehold('/api/transactions');

// For POST requests
const response = await postWithHousehold('/api/transactions', transactionData);

// Refresh when household changes
useEffect(() => {
  loadData();
}, [selectedHouseholdId]);
```

---

#### 5.2 Category Components (5 components)

7. **`components/categories/category-form.tsx`**
8. **`components/categories/category-list.tsx`**
9. **`components/categories/category-selector.tsx`**
10. **`components/budget/budget-summary.tsx`**
11. **`app/dashboard/budget/page.tsx`**

Same pattern as transactions.

---

#### 5.3 Merchant Components (2 components)

12. **`components/merchants/merchant-selector.tsx`**
13. **`components/merchants/merchant-autocomplete.tsx`** (if exists)

Same pattern.

---

#### 5.4 Dashboard Components (4 components)

14. **`app/dashboard/page.tsx`**
15. **`components/dashboard/dashboard-stats.tsx`**
16. **`components/dashboard/recent-transactions.tsx`**
17. **`components/dashboard/monthly-summary.tsx`**

Same pattern.

---

#### 5.5 Account Components (3 components - already done, verify)

18. **`components/accounts/account-form.tsx`** ✅
19. **`components/accounts/account-list.tsx`** ✅
20. **`components/accounts/account-selector.tsx`** ✅

Verify these are using the household hook correctly.

---

## Phase 6: Business Logic Updates

### 6.1 Rules Engine

**File:** `lib/rules/rule-matcher.ts`

**Changes:**
- When fetching rules, filter by household
- When matching transactions, only use household's rules

```typescript
const rules = await db
  .select()
  .from(categorizationRules)
  .where(
    and(
      eq(categorizationRules.userId, userId),
      eq(categorizationRules.householdId, householdId), // Add this
      eq(categorizationRules.isActive, true)
    )
  )
  .orderBy(asc(categorizationRules.priority));
```

---

### 6.2 Bill Matching

**File:** `lib/bills/bill-matcher.ts`

**Changes:**
- Only match bills in same household as transaction
- Add householdId parameter to matching function

```typescript
export async function matchTransactionToBill(
  transaction: Transaction,
  userId: string,
  householdId: string // Add parameter
) {
  const activeBills = await db
    .select()
    .from(bills)
    .where(
      and(
        eq(bills.userId, userId),
        eq(bills.householdId, householdId), // Add this
        eq(bills.isActive, true)
      )
    );

  // ... rest of matching logic
}
```

---

### 6.3 Usage Analytics

**File:** Search for usage analytics tracking

**Changes:**
- Track category/merchant usage per household
- When incrementing usage counters, filter by household

---

## Phase 7: Apply Migration

**IMPORTANT:** Only do this AFTER all endpoints and components are updated!

### Steps:

1. **Backup database:**
   ```bash
   cp local.db local.db.backup.$(date +%Y%m%d_%H%M%S)
   ```

2. **Stop all dev servers** (there are 8 running currently)

3. **Apply migration:**
   ```bash
   pnpm drizzle-kit migrate
   ```

4. **Verify migration:**
   ```bash
   sqlite3 local.db "SELECT COUNT(*) FROM accounts WHERE household_id IS NULL;"
   sqlite3 local.db "SELECT COUNT(*) FROM transactions WHERE household_id IS NULL;"
   sqlite3 local.db "SELECT COUNT(*) FROM budget_categories WHERE household_id IS NULL;"
   sqlite3 local.db "SELECT COUNT(*) FROM merchants WHERE household_id IS NULL;"
   ```
   All should return `0`.

5. **Restart dev server:**
   ```bash
   pnpm dev
   ```

6. **Test basic functionality:**
   - Login
   - View dashboard
   - Create transaction
   - Switch households
   - Verify data isolation

---

## Phase 8: Testing

### Integration Tests

**File:** `__tests__/integration/household-isolation-phase1.test.ts`

Create comprehensive tests covering:
- Data visibility (can only see own household's data)
- Data creation (new data has correct household_id)
- Data updates (cannot update other household's data)
- Data deletion (cannot delete other household's data)
- Cross-household security (403 errors for unauthorized access)

### Manual Testing Checklist

- [ ] Create 2 test households
- [ ] Create transactions in household A
- [ ] Switch to household B
- [ ] Verify household A transactions not visible
- [ ] Create transactions in household B
- [ ] Switch back to household A
- [ ] Verify correct data shown
- [ ] Test all CRUD operations in both households
- [ ] Verify dashboard stats update when switching
- [ ] Test search in both households
- [ ] Test CSV import in both households

---

## Phase 9: Documentation

Update these files:

1. **`docs/phase-1-progress.md`**
   - Mark all tasks complete
   - Update progress to 100%

2. **`docs/features.md`**
   - Mark Phase 1 complete
   - Update status

3. **`.claude/CLAUDE.md`**
   - Add Phase 1 to completed features
   - Update current status

---

## Error Handling Pattern

All API endpoints should follow this error handling:

```typescript
export async function GET(request: Request) {
  try {
    const { userId } = await requireAuth();
    const householdId = getHouseholdIdFromRequest(request);
    await requireHouseholdAuth(userId, householdId);

    // ... business logic

    return Response.json(data);
  } catch (error) {
    // Unauthorized (not logged in)
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Forbidden (not household member or household ID missing)
    if (error instanceof Error && (
      error.message.includes('Household') ||
      error.message.includes('member')
    )) {
      return Response.json({ error: error.message }, { status: 403 });
    }

    // Server error
    console.error('API error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

---

## UI/UX Considerations

### Theme Integration
All components should use semantic theme variables:

- **Background:** `bg-background`, `bg-card`, `bg-elevated`
- **Text:** `text-foreground`, `text-muted-foreground`
- **Borders:** `border-border`
- **States:** `bg-[var(--color-primary)]`, `bg-[var(--color-error)]`

### Loading States
When switching households, show loading indicators:

```typescript
const [isLoading, setIsLoading] = useState(false);

useEffect(() => {
  setIsLoading(true);
  loadData().finally(() => setIsLoading(false));
}, [selectedHouseholdId]);

if (isLoading) {
  return <div className="flex items-center justify-center p-8">
    <div className="text-muted-foreground">Loading...</div>
  </div>;
}
```

### Error States
Show user-friendly errors when household context missing:

```typescript
if (!selectedHouseholdId) {
  return (
    <div className="rounded-lg border border-border bg-card p-6 text-center">
      <p className="text-muted-foreground">
        Please select a household to view transactions
      </p>
    </div>
  );
}
```

---

## Success Criteria

Phase 1 is **100% complete** when:

- ✅ All 25 API endpoints filter by household
- ✅ All 20 frontend components use household context
- ✅ Migration applied successfully
- ✅ All integration tests passing
- ✅ Manual testing confirms data isolation
- ✅ No cross-household data leaks
- ✅ Performance meets requirements (< 100ms for queries)
- ✅ Documentation updated

---

## Implementation Priority Order

**Day 1 - Session 1 (4 hours):**
1. Update 7 transaction endpoints
2. Test transaction endpoints manually

**Day 1 - Session 2 (3 hours):**
3. Update 4 category endpoints
4. Update 4 merchant endpoints
5. Update 3 dashboard endpoints
6. Test all endpoints

**Day 2 - Session 1 (4 hours):**
7. Update 20 frontend components
8. Test frontend with household switching

**Day 2 - Session 2 (3 hours):**
9. Update business logic (rules, bills, usage)
10. Apply migration
11. Run integration tests
12. Manual testing
13. Update documentation

---

## Rollback Plan

If issues discovered:
1. Restore database: `cp local.db.backup.TIMESTAMP local.db`
2. Revert code changes: `git reset --hard HEAD^`
3. Fix issues
4. Re-apply when ready

---

## Next Steps After Phase 1

Once Phase 1 is complete, we'll move to:

**Phase 2: Extended Features Isolation**
- Bills & bill instances
- Savings goals & milestones
- Debts & debt payments
- Tags & custom fields
- Reports & analytics

**Phase 3: Advanced Features Isolation**
- Tax categories & classifications
- Sales tax tracking
- Notifications (already done in Phase 0)
- Activity logs
- Saved searches

**Phase 4: Final Polish**
- Performance optimization
- Security audit
- Comprehensive testing
- Production deployment

---

**Document Version:** 1.0
**Created:** 2025-11-14
**Status:** READY FOR IMPLEMENTATION
**Current Phase:** Phase 1 - 50% → 100%
**Estimated Time:** 12-18 hours (1-2 days)
