# Usage Tracking Implementation - Code Locations Reference

## Complete File Map

### Database Schema (lib/db/schema.ts)

#### Tables with Usage Tracking (Lines Referenced)
- **accounts** (16-42): `usageCount` (line 34), `lastUsedAt` (line 35)
  - Indexes: `idx_accounts_user` ✓ | Missing: `idx_accounts_user_usage` ❌
  
- **budgetCategories** (44-64): `usageCount` (line 57), `lastUsedAt` (line 58)
  - Indexes: `idx_budget_categories_user` ✓ | Missing: `idx_budget_categories_user_usage` ❌
  
- **merchants** (66-88): `usageCount` (line 74), `lastUsedAt` (line 75), `totalSpent` (line 76), `averageTransaction` (line 77)
  - Indexes: `idx_merchants_user` ✓, `idx_merchants_user_normalized_name` ✓
  - Missing: `idx_merchants_user_usage` ❌
  
- **tags** (844-863): `usageCount` (line 853), `lastUsedAt` (line 854)
  - Indexes: `idx_tags_user` ✓ | Missing: `idx_tags_user_usage` ❌
  
- **transactionTemplates** (651-673): `usageCount` (line 665), `lastUsedAt` (line 666)
  - Indexes: `idx_transaction_templates_user` ✓ | Missing: `idx_transaction_templates_user_usage` ❌
  
- **importTemplates** (765-789): `usageCount` (line 780), `lastUsedAt` (line 781), `isFavorite` (line 779)
  - Indexes: `idx_import_templates_user` ✓ | Missing: `idx_import_templates_user_usage` ❌
  
- **customFields** (885-910): `usageCount` (line 902)
  - Indexes: `idx_custom_fields_user` ✓ | Missing: `idx_custom_fields_user_usage` ❌
  
- **savedSearchFilters** (724-742): `usageCount` (line 733), `lastUsedAt` (line 734)
  - Indexes: `idx_saved_search_filters_user` ✓, `idx_saved_search_filters_user_default` ✓
  - Missing: `idx_saved_search_filters_user_usage` ❌
  
- **usageAnalytics** (90-114): `usageCount` (line 100), `lastUsedAt` (line 101)
  - Indexes: `idx_usage_analytics_unique` ✓, `idx_usage_analytics_user` ✓
  - Missing: `idx_usage_analytics_user_type` ❌

---

## API Endpoints Reading Usage (Sorted by Impact)

### CRITICAL: Missing Indexes Causing Full Table Scans

#### 1. GET /api/accounts (accounts/route.ts: 19-23)
**Issue:** Orders by `usageCount DESC` without index
```typescript
const userAccounts = await db
  .select()
  .from(accounts)
  .where(eq(accounts.userId, userId))
  .orderBy(desc(accounts.usageCount), accounts.sortOrder);
```
**Called from:** 
- `components/transactions/account-selector.tsx:36`
- Every transaction form load

**Fix:** Add index on `(user_id, usage_count DESC)`

---

#### 2. GET /api/categories (categories/route.ts: 54-58)
**Issue:** Orders by `usageCount DESC` without index
```typescript
const userCategories = await db
  .select()
  .from(budgetCategories)
  .where(eq(budgetCategories.userId, userId))
  .orderBy(desc(budgetCategories.usageCount), budgetCategories.sortOrder);
```
**Called from:**
- `components/transactions/category-selector.tsx:38`
- Every transaction form load

**Problem:** Also does NOT filter by category type (done in frontend)

**Fix:** 
1. Add index on `(user_id, usage_count DESC)`
2. Add WHERE clause for category type filtering

---

#### 3. GET /api/merchants (merchants/route.ts: 21-26)
**Issue:** Orders by `usageCount DESC` without index
```typescript
const userMerchants = await db
  .select()
  .from(merchants)
  .where(eq(merchants.userId, userId))
  .orderBy(desc(merchants.usageCount))
  .limit(limit);
```
**Called from:**
- `components/transactions/merchant-autocomplete.tsx` (estimated)
- Merchant input field with autocomplete

**Fix:** Add index on `(user_id, usage_count DESC)`

---

#### 4. GET /api/tags?sortBy=usage (tags/route.ts: 26-41)
**Issues:**
1. Orders by `usageCount DESC` without index
2. DOUBLE QUERY for pagination count
```typescript
if (sortBy === 'usage') {
  orderByClause = desc(tags.usageCount);
}

const userTags = await db
  .select()
  .from(tags)
  .where(eq(tags.userId, userId))
  .orderBy(orderByClause)
  .limit(limit)
  .offset(offset);

// PROBLEM: Separate count query
const countResult = await db
  .select()
  .from(tags)
  .where(eq(tags.userId, userId));  // Full table scan!
```
**Called from:**
- `components/transactions/transaction-form.tsx:110`
- `components/tags/tag-selector.tsx:48` (duplicate!)

**Fixes:**
1. Add index on `(user_id, usage_count DESC)`
2. Use COUNT(*) in same query, not separate SELECT

---

#### 5. GET /api/transfers/suggest (transfers/suggest/route.ts: 39-44)
**Issues:**
1. Followed by N Promise.all() queries (N+1 pattern)
2. Fetches account details one-by-one
```typescript
const transferPairs = await db
  .select()
  .from(usageAnalytics)
  .where(and(...filters))
  .orderBy(desc(usageAnalytics.usageCount))
  .limit(limit);

// PROBLEM: N Promise.all() queries
const suggestions = await Promise.all(
  transferPairs.map(async (pair) => {
    if (!pair.itemSecondaryId) return null;

    const [fromAccount, toAccount] = await Promise.all([
      db.select().from(accounts).where(...),  // ❌ Query 1
      db.select().from(accounts).where(...),  // ❌ Query 2
    ]);
```
**Result:** 1 query + (N × 2 queries) = 21 queries for 10 pairs

**Fix:** Use JOINs to fetch accounts in single query

---

### Additional Endpoints With Usage Data

#### 6. GET /api/saved-searches/[id] (saved-searches/[id]/route.ts: 186-248)
**Line 220-229:** Updates usage count when search is used
```typescript
const search = existing[0];
const newUsageCount = (search.usageCount || 0) + 1;

await db
  .update(savedSearchFilters)
  .set({
    usageCount: newUsageCount,
    lastUsedAt: new Date().toISOString(),
  })
  .where(eq(savedSearchFilters.id, id));
```
**Status:** Implementation is good, just verify indexes

---

## API Endpoints Writing Usage Data

### PRIMARY: Transaction Creation (transactions/route.ts)

**Major bottleneck with 12+ sequential operations**

#### 1. Account Usage Update (Lines 144-151)
```typescript
await db
  .update(accounts)
  .set({
    currentBalance: updatedBalance.toNumber(),
    lastUsedAt: new Date().toISOString(),
    usageCount: (account[0].usageCount || 0) + 1,
  })
  .where(eq(accounts.id, accountId));
```

#### 2. Category Usage Update (Lines 154-207)
```typescript
await db
  .update(budgetCategories)
  .set({
    lastUsedAt: new Date().toISOString(),
    usageCount: (category.length > 0 && category[0] ? 
      (category[0].usageCount || 0) : 0) + 1,
  })
  .where(eq(budgetCategories.id, categoryId));

// Plus complex analytics tracking...
const existingAnalytics = await db
  .select()
  .from(usageAnalytics)
  .where(
    and(
      eq(usageAnalytics.userId, userId),
      eq(usageAnalytics.itemType, 'category'),
      eq(usageAnalytics.itemId, categoryId)
    )
  )
  .limit(1);

if (existingAnalytics.length > 0 && existingAnalytics[0]) {
  await db.update(usageAnalytics)...
} else {
  await db.insert(usageAnalytics)...
}
```

#### 3. Merchant Usage Update (Lines 223-257)
```typescript
const existingMerchant = await db
  .select()
  .from(merchants)
  .where(
    and(
      eq(merchants.userId, userId),
      eq(merchants.normalizedName, normalizedDescription)
    )
  )
  .limit(1);

if (existingMerchant.length > 0 && existingMerchant[0]) {
  const currentSpent = new Decimal(existingMerchant[0].totalSpent || 0);
  const newSpent = currentSpent.plus(decimalAmount);
  const usageCount = (existingMerchant[0].usageCount || 0);
  const avgTransaction = newSpent.dividedBy(usageCount + 1);

  await db.update(merchants)
    .set({
      usageCount: usageCount + 1,
      lastUsedAt: new Date().toISOString(),
      totalSpent: newSpent.toNumber(),
      averageTransaction: avgTransaction.toNumber(),
    })...
} else {
  await db.insert(merchants)...
}
```

**Then also updates usageAnalytics table (Lines 260-298)** - Another SELECT + UPDATE/INSERT

---

### SECONDARY: Tag Usage Update (transaction-tags/route.ts: 99-108)
```typescript
await db
  .update(tags)
  .set({
    usageCount: (currentTag.usageCount || 0) + 1,
    lastUsedAt: now,
    updatedAt: now,
  })
  .where(eq(tags.id, tagId));
```

**Called from:** 
- `components/tags/tag-selector.tsx` (line 60-83 for adding)
- Every tag addition/removal

---

### TERTIARY: Transfer Usage Update (transfers/route.ts: 200+)
Multiple usage updates for:
- From account
- To account  
- Transfer pair in usageAnalytics

---

## Frontend Components Fetching Usage Data

### 1. TransactionForm (components/transactions/transaction-form.tsx)

**Line 107-142:** Load tags on mount
```typescript
useEffect(() => {
  const fetchTags = async () => {
    try {
      setTagsLoading(true);
      const response = await fetch('/api/tags?sortBy=usage&limit=100');
      if (!response.ok) throw new Error('Failed to fetch tags');

      const data = await response.json();
      setAllTags(data.data || []);
    } catch (error) {
      console.error('Error fetching tags:', error);
    } finally {
      setTagsLoading(false);
    }
  };
  // ...
  fetchTags();
}, []);
```

Also loads:
- **Line 122-138:** Custom fields on mount
- Various account/category selectors (child components)

---

### 2. TagSelector (components/tags/tag-selector.tsx)

**Line 45-58:** Duplicate tag fetch!
```typescript
const fetchTags = async () => {
  try {
    setLoading(true);
    const response = await fetch('/api/tags?sortBy=usage&limit=100');
    if (!response.ok) throw new Error('Failed to fetch tags');

    const data = await response.json();
    setAllTags(data.data || []);
  } catch (error) {
    console.error('Error fetching tags:', error);
  } finally {
    setLoading(false);
  }
};
```

**Issue:** Same exact fetch as TransactionForm (duplicate!)

**Called from:**
- `components/transactions/transaction-form.tsx` (child component)
- Independent useEffect on mount (line 41-43)

---

### 3. AccountSelector (components/transactions/account-selector.tsx)

**Line 36:** Fetches accounts on mount
```typescript
const response = await fetch('/api/accounts');
if (response.ok) {
  const data = await response.json();
  setAccounts(data);
  // Auto-select first account if none selected
  if (!selectedAccountId && data.length > 0) {
    onAccountChange(data[0].id);
  }
}
```

**Called on:** Every transaction form load

---

### 4. CategorySelector (components/transactions/category-selector.tsx)

**Line 38:** Fetches categories on mount
```typescript
const response = await fetch('/api/categories');
if (response.ok) {
  const data = await response.json();
  // Filter categories based on transaction type
  const filteredCategories = data.filter((cat: Category) => {
    if (transactionType === 'income') return cat.type === 'income';
    if (transactionType === 'transfer_in' || transactionType === 'transfer_out')
      return false;
    return cat.type === 'variable_expense' || cat.type === 'monthly_bill';
  });
  setCategories(filteredCategories);
}
```

**Issue:** Filters in frontend (should be SQL WHERE clause)

**Called on:** Every transaction form load + type change

---

## Summary Table: Files Needing Changes

| File | Lines | Issue | Priority |
|------|-------|-------|----------|
| `lib/db/schema.ts` | 40-42, 61-63, 82-87, 859-862, 738-741, 105-113 | Missing indexes | 🔴 CRITICAL |
| `app/api/accounts/route.ts` | 19-23 | No index, no pagination | 🔴 CRITICAL |
| `app/api/categories/route.ts` | 54-58 | No index, type filtering in app | 🔴 CRITICAL |
| `app/api/merchants/route.ts` | 21-26 | No index | 🔴 CRITICAL |
| `app/api/tags/route.ts` | 26-58 | Double query, no indexes | 🔴 CRITICAL |
| `app/api/transactions/route.ts` | 137-298 | 12+ sequential ops, no batching | 🔴 CRITICAL |
| `app/api/transfers/suggest/route.ts` | 39-91 | N+1 pattern with Promise.all | 🔴 CRITICAL |
| `components/transactions/transaction-form.tsx` | 107-142 | Triple API calls (duplicate) | 🟠 HIGH |
| `components/tags/tag-selector.tsx` | 45-58 | Duplicate tag fetch | 🟠 HIGH |
| `components/transactions/category-selector.tsx` | 38-58 | Frontend filtering | 🟡 MEDIUM |

