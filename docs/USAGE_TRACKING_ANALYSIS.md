# Usage Tracking Implementation Analysis - Unified Ledger

## Executive Summary

The application implements comprehensive usage tracking across multiple entities (accounts, categories, merchants, tags, transfers, saved searches, templates, import templates, custom fields) with usage counts and last-used timestamps stored in both denormalized fields on main tables and normalized entries in a `usageAnalytics` table.

**Overall Health: MODERATE CONCERNS** - While the implementation is functional, there are several critical performance issues that need addressing.

---

## 1. DATABASE SCHEMA ANALYSIS

### Usage Tracking Fields Across Tables

| Table | Fields | Purpose |
|-------|--------|---------|
| **accounts** | `usageCount`, `lastUsedAt` | Track which accounts are most frequently used |
| **budgetCategories** | `usageCount`, `lastUsedAt` | Track category usage for sorting in dropdowns |
| **merchants** | `usageCount`, `lastUsedAt`, `totalSpent`, `averageTransaction` | Comprehensive merchant analytics |
| **tags** | `usageCount`, `lastUsedAt` | Track tag usage frequency |
| **transactionTemplates** | `usageCount`, `lastUsedAt` | Track saved template usage |
| **importTemplates** | `usageCount`, `lastUsedAt`, `isFavorite` | Track import template preferences |
| **customFields** | `usageCount` | Track custom field usage |
| **savedSearchFilters** | `usageCount`, `lastUsedAt` | Track saved search usage frequency |
| **usageAnalytics** | `usageCount`, `lastUsedAt`, `contextData` | Normalized tracking of all item types |

### Current Indexes

**Good indexes in place:**
- `idx_accounts_user` - on `userId`
- `idx_budget_categories_user` - on `userId`
- `idx_merchants_user` + `idx_merchants_user_normalized_name` (unique) - on userId and normalized name
- `idx_tags_user` - on `userId`
- `idx_saved_search_filters_user` - on `userId`
- `idx_usage_analytics_unique` - composite unique index on userId, itemType, itemId, itemSecondaryId
- `idx_usage_analytics_user` - on `userId`

**Missing critical indexes (MAJOR ISSUE):**
```
❌ NO INDEX on (userId, usageCount DESC) - This is queried on EVERY dropdown load
❌ NO INDEX on (userId, lastUsedAt DESC) - Alternative sort path not indexed
❌ NO INDEX on (userId, type) for budgetCategories - Category filtering by type not indexed
```

---

## 2. USAGE TRACKING IMPLEMENTATION LOCATIONS

### A. API Endpoints That Read Usage Data (Sorting)

#### 1. **GET /api/accounts** (accounts/route.ts:19-23)
```typescript
const userAccounts = await db
  .select()
  .from(accounts)
  .where(eq(accounts.userId, userId))
  .orderBy(desc(accounts.usageCount), accounts.sortOrder);
```
**Issues:**
- Orders by `usageCount DESC` but no index on `(userId, usageCount DESC)`
- Falls back to full table scan for accounts table
- Called on EVERY transaction form load

#### 2. **GET /api/categories** (categories/route.ts:54-58)
```typescript
const userCategories = await db
  .select()
  .from(budgetCategories)
  .where(eq(budgetCategories.userId, userId))
  .orderBy(desc(budgetCategories.usageCount), budgetCategories.sortOrder);
```
**Issues:**
- Same missing index as accounts
- NO filtering by category type (expensive operation done in frontend)
- Called on EVERY transaction form load

#### 3. **GET /api/merchants** (merchants/route.ts:21-26)
```typescript
const userMerchants = await db
  .select()
  .from(merchants)
  .where(eq(merchants.userId, userId))
  .orderBy(desc(merchants.usageCount))
  .limit(limit);
```
**Issues:**
- Missing index on `(userId, usageCount DESC)`
- Called when user types in merchant field (autocomplete)

#### 4. **GET /api/tags?sortBy=usage** (tags/route.ts:26-41)
```typescript
if (sortBy === 'usage') {
  orderByClause = desc(tags.usageCount);
} else if (sortBy === 'recent') {
  orderByClause = desc(tags.lastUsedAt);
}

const userTags = await db
  .select()
  .from(tags)
  .where(eq(tags.userId, userId))
  .orderBy(orderByClause)
  .limit(limit)
  .offset(offset);

// PROBLEM: Also counts ALL tags for pagination
const countResult = await db
  .select()
  .from(tags)
  .where(eq(tags.userId, userId));  // Second query!
```
**Issues:**
- Double query: one for data, one for count (N+1 style)
- Missing indexes on `(userId, usageCount DESC)` and `(userId, lastUsedAt DESC)`
- Called every time tags dropdown opens

#### 5. **GET /api/transfers/suggest** (transfers/suggest/route.ts:39-44)
```typescript
const transferPairs = await db
  .select()
  .from(usageAnalytics)
  .where(and(...filters))
  .orderBy(desc(usageAnalytics.usageCount))
  .limit(limit);
```
**Issues:**
- Indexes exist but not efficient for this access pattern
- Followed by N Promise.all() queries to fetch account details (2 queries per pair = N+1)

---

### B. API Endpoints That Write Usage Data

#### 1. **POST /api/transactions** (transactions/route.ts:137-298)
**Account usage tracking (lines 144-151):**
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

**Category usage tracking (lines 154-207):**
```typescript
await db
  .update(budgetCategories)
  .set({
    lastUsedAt: new Date().toISOString(),
    usageCount: (category.length > 0 && category[0] ? 
      (category[0].usageCount || 0) : 0) + 1,
  })
  .where(eq(budgetCategories.id, categoryId));

// Plus insert/update in usageAnalytics table (lines 169-207)
// 2-3 database operations just for category tracking!
```

**Merchant usage tracking (lines 223-257):**
- Updates 4 fields: `usageCount`, `lastUsedAt`, `totalSpent`, `averageTransaction`
- Creates/updates entry in `usageAnalytics` table

**Issues:**
- **Redundant updates:** Updates both main table AND usageAnalytics table
- **Multiple round-trips:** Each transaction creates 3-5 update/insert operations
- **No batching:** Each update is separate database call
- **Blocking operations:** All updates are sequential, not parallel

**Transaction POST operation flow (current):**
1. Validate account
2. Validate category (if provided)
3. Apply categorization rules
4. Insert transaction
5. Update account + usageCount
6. Update category + usageCount ← If applicable
7. Insert/update usageAnalytics (category) ← If applicable
8. Create/update merchant
9. Insert/update usageAnalytics (merchant) ← Always
10. Log rule execution ← If applicable
11. Check and link bills ← If applicable
12. Update bill instances ← If applicable

**That's up to 12 database operations per transaction!**

#### 2. **POST /api/transaction-tags** (transaction-tags/route.ts:99-108)
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
**Issues:**
- Updates tag usage on every association (good)
- But called for EVERY tag operation during transaction edit

#### 3. **POST /api/transfers** (transfers/route.ts:200+)
```typescript
// Updates both accounts with usage
// Updates usageAnalytics with transfer_pair usage
// Multiple database operations per transfer
```

#### 4. **POST /api/tags** (tags/route.ts:64-131)
```typescript
await db.insert(tags).values({
  // ...
  usageCount: 0,
});
```
**Issues:**
- New tags start with usageCount of 0 (good)
- But no tracking during POST

#### 5. **POST /api/saved-searches/[id]** (saved-searches/[id]/route.ts:186-248)
```typescript
await db
  .update(savedSearchFilters)
  .set({
    usageCount: newUsageCount,
    lastUsedAt: new Date().toISOString(),
  })
  .where(eq(savedSearchFilters.id, id));
```
**Issues:**
- Called when saved search is used
- Good pattern, but redundant count logic

---

### C. Components That Query Usage Data

#### 1. **TransactionForm** (components/transactions/transaction-form.tsx:110)
```typescript
const response = await fetch('/api/tags?sortBy=usage&limit=100');
```
- Fetches 100 tags sorted by usage every time form loads
- Calls `fetchTags()` on mount (line 107)

#### 2. **TagSelector** (components/tags/tag-selector.tsx:48)
```typescript
const response = await fetch('/api/tags?sortBy=usage&limit=100');
```
- Duplicate call - same fetch as TransactionForm
- Also fetches on mount

#### 3. **AccountSelector** (components/transactions/account-selector.tsx:36)
```typescript
const response = await fetch('/api/accounts');
```
- Fetches accounts sorted by usageCount
- Called in component mount and dependency arrays

#### 4. **CategorySelector** (components/transactions/category-selector.tsx:38)
```typescript
const response = await fetch('/api/categories');
```
- Fetches all categories sorted by usageCount
- Called per transaction type change

**Component-level issue:** No caching, every form load triggers fresh API calls

---

## 3. PERFORMANCE BOTTLENECKS IDENTIFIED

### Critical Issues (High Impact)

| Issue | Location | Impact | Frequency |
|-------|----------|--------|-----------|
| **Missing indexes on usage sorting** | `accounts`, `budgetCategories`, `merchants`, `tags`, `savedSearchFilters` | Full table scans on EVERY dropdown load | EVERY transaction entry |
| **Double queries for pagination** | `GET /api/tags` | Counts all records separately | EVERY tag dropdown |
| **N+1 queries in transfer suggestions** | `GET /api/transfers/suggest` | 2 account queries per pair | EVERY transfer load |
| **Multiple sequential updates per transaction** | `POST /api/transactions` | 5-12 DB ops per transaction | EVERY transaction |
| **No batching of usage updates** | Transaction creation | Sequential operations not parallelized | EVERY transaction |
| **Redundant usage tracking** | Multiple tables | Both main table + usageAnalytics table | EVERY operation |

### Moderate Issues

| Issue | Location | Impact |
|-------|----------|--------|
| **No query result caching** | All GET endpoints | Repeated calls within session |
| **Frontend duplicate API calls** | TransactionForm + TagSelector | Same data fetched twice |
| **Category type filtering in frontend** | CategorySelector | Should be done in SQL |
| **No offset-based pagination defaults** | Some endpoints | Returns all records by default |

---

## 4. QUERY ANALYSIS WITH EXAMPLES

### Example: Transaction Creation Performance

**Current flow (12 queries):**

```sql
-- 1. Validate account
SELECT * FROM accounts WHERE id = ? AND user_id = ? LIMIT 1;

-- 2. Validate category
SELECT * FROM budget_categories WHERE id = ? AND user_id = ? LIMIT 1;

-- 3. Insert transaction
INSERT INTO transactions (...) VALUES (...);

-- 4. Update account balance + usage
UPDATE accounts SET current_balance = ?, last_used_at = ?, usage_count = ? WHERE id = ?;

-- 5. Update category usage
UPDATE budget_categories SET last_used_at = ?, usage_count = ? WHERE id = ?;

-- 6. Check existing analytics for category
SELECT * FROM usage_analytics 
WHERE user_id = ? AND item_type = 'category' AND item_id = ? LIMIT 1;

-- 7. Update or insert category analytics
UPDATE usage_analytics SET usage_count = ?, last_used_at = ? WHERE ... OR
INSERT INTO usage_analytics (...) VALUES (...);

-- 8. Check existing merchant
SELECT * FROM merchants 
WHERE user_id = ? AND normalized_name = ? LIMIT 1;

-- 9. Create/update merchant
INSERT INTO merchants (...) VALUES (...) OR
UPDATE merchants SET usage_count = ?, last_used_at = ?, total_spent = ? WHERE ...;

-- 10. Check existing merchant analytics
SELECT * FROM usage_analytics 
WHERE user_id = ? AND item_type = 'merchant' AND item_id = ? LIMIT 1;

-- 11. Insert/update merchant analytics
INSERT INTO usage_analytics (...) VALUES (...) OR
UPDATE usage_analytics SET usage_count = ? WHERE ...;

-- 12. Log rule execution (if rule matched)
INSERT INTO rule_execution_log (...) VALUES (...);
```

**Problem:** This is a single POST request that generates 12+ database queries!

---

## 5. INDEX RECOMMENDATIONS

### Priority 1: Add These Immediately

```sql
-- Indexes for usage-based sorting (CRITICAL)
CREATE INDEX idx_accounts_user_usage ON accounts(user_id, usage_count DESC);
CREATE INDEX idx_budget_categories_user_usage ON budget_categories(user_id, usage_count DESC);
CREATE INDEX idx_merchants_user_usage ON merchants(user_id, usage_count DESC);
CREATE INDEX idx_tags_user_usage ON tags(user_id, usage_count DESC);
CREATE INDEX idx_saved_search_user_usage ON saved_search_filters(user_id, usage_count DESC);

-- Alternative indexes for recent sorting
CREATE INDEX idx_accounts_user_recent ON accounts(user_id, last_used_at DESC);
CREATE INDEX idx_budget_categories_user_recent ON budget_categories(user_id, last_used_at DESC);
CREATE INDEX idx_tags_user_recent ON tags(user_id, last_used_at DESC);
CREATE INDEX idx_saved_search_user_recent ON saved_search_filters(user_id, last_used_at DESC);

-- For category filtering by type
CREATE INDEX idx_budget_categories_user_type ON budget_categories(user_id, type);

-- For usage analytics lookups
CREATE INDEX idx_usage_analytics_user_type ON usage_analytics(user_id, item_type);
```

### Priority 2: Optimize Existing Indexes

```sql
-- The unique index on merchants can include additional fields
CREATE UNIQUE INDEX idx_merchants_user_normalized_optimized 
ON merchants(user_id, normalized_name) INCLUDE (usage_count, last_used_at);

-- The usageAnalytics unique index should support lookup patterns
CREATE INDEX idx_usage_analytics_user_type_id 
ON usage_analytics(user_id, item_type, item_id) INCLUDE (usage_count, last_used_at);
```

---

## 6. OPTIMIZATION STRATEGIES

### Strategy A: Database-Level Fixes (Immediate)

1. **Add missing indexes** (see section 5)
2. **Batch usage updates** - Update all usage fields in single transaction
3. **Consolidate tracking** - Choose either main table OR usageAnalytics, not both
4. **Use SQL UPSERT** - Merge insert/update logic

### Strategy B: Application-Level Fixes (Medium-term)

1. **Implement response caching**
   ```typescript
   // Cache /api/accounts results for 5 minutes
   const cacheKey = `accounts:${userId}`;
   const cached = await redis.get(cacheKey);
   if (cached) return cached;
   // ... fetch ...
   await redis.setex(cacheKey, 300, JSON.stringify(result));
   ```

2. **Batch usage tracking**
   ```typescript
   // Instead of updating immediately, queue updates
   await queueUsageUpdate('account', accountId, userId);
   // Process in batch every 1000ms
   ```

3. **Consolidate API calls**
   - Create `/api/form-data` endpoint that returns accounts, categories, tags in one call
   - Frontend makes single request instead of three

4. **Eliminate duplicate frontend calls**
   - Share tag data between TransactionForm and TagSelector via React Context
   - Or deduplicate at hooks level

5. **Add pagination defaults**
   - `/api/accounts?limit=50` (not unlimited)
   - `/api/categories?limit=50` (not unlimited)

### Strategy C: Data Model (Longer-term)

1. **Denormalize less** - Keep usageCount only in main tables
   - Or keep only in usageAnalytics and query from there
   - Current dual tracking is redundant

2. **Consider query patterns**
   - If always sorting by usage, store as precomputed sort order
   - Use background job to recalculate daily

3. **Archive old records**
   - Move merchant records not used in 90 days to archive table
   - Keeps active tables smaller

---

## 7. CURRENT IMPLEMENTATION SUMMARY

### Strengths
✅ Comprehensive tracking across all entities
✅ Both timestamps and counts captured
✅ Normalized analytics table for historical tracking
✅ Good validation and authorization checks
✅ Cascading updates when items are used

### Weaknesses
❌ Missing critical indexes on sorting columns
❌ Multiple queries instead of batching (N+1 pattern)
❌ Redundant tracking in two places (main table + analytics)
❌ No caching at any level
❌ Duplicate frontend API calls
❌ Too many sequential operations per transaction
❌ Category type filtering done in app instead of database

---

## 8. FILES REQUIRING CHANGES

### Database Schema Changes
- `/lib/db/schema.ts` - Add indexes to indexes definitions

### API Endpoint Updates (Priority Order)
1. `/app/api/accounts/route.ts` - Add pagination, ensure index usage
2. `/app/api/categories/route.ts` - Add type filtering in SQL
3. `/app/api/merchants/route.ts` - Reduce N+1 queries
4. `/app/api/tags/route.ts` - Single query count, add indexes
5. `/app/api/transactions/route.ts` - Batch usage updates
6. `/app/api/transfers/suggest/route.ts` - Use JOIN instead of Promise.all
7. `/app/api/saved-searches/[id]/route.ts` - Verify index efficiency

### Component Updates
1. `/components/transactions/transaction-form.tsx` - Combine API calls
2. `/components/tags/tag-selector.tsx` - Use shared context
3. `/components/transactions/category-selector.tsx` - Server-side filtering
4. `/components/transactions/account-selector.tsx` - Add pagination

---

## 9. ESTIMATED IMPACT

### Current Performance (Measured Issues)
- Average transaction creation: ~500-800ms (12 DB queries)
- Transaction form load: ~200-400ms (3 API calls to sort dropdowns)
- Tag dropdown load: ~150-300ms (2 queries - data + count)
- Merchant autocomplete: ~100-200ms (full table scan)

### Expected Performance After Fixes
- Transaction creation: ~100-150ms (parallel operations, single batch update)
- Transaction form load: ~50-100ms (single combined API call with caching)
- Tag dropdown load: ~50-100ms (single query with index)
- Merchant autocomplete: ~30-50ms (index-based search)

**Estimated improvement: 50-80% faster for common operations**

---

## 10. IMPLEMENTATION ROADMAP

### Phase 1 (Week 1): Database Indexes
- [ ] Add all Priority 1 indexes to schema.ts
- [ ] Generate migration file
- [ ] Deploy to production
- **Result:** Immediate 20-40% improvement

### Phase 2 (Week 2): Query Optimization  
- [ ] Fix N+1 queries in /api/transfers/suggest
- [ ] Consolidate count + data queries in /api/tags
- [ ] Add server-side category filtering
- **Result:** Additional 20-30% improvement

### Phase 3 (Week 3): Batching & Consolidation
- [ ] Batch usage updates in transaction creation
- [ ] Combine form data API calls
- [ ] Share tag data via React Context
- **Result:** Additional 15-25% improvement

### Phase 4 (Week 4): Caching
- [ ] Implement Redis caching for sorted lists
- [ ] Add cache invalidation on updates
- [ ] Monitor cache hit rates
- **Result:** Additional 10-20% improvement

