# Usage Tracking Performance Analysis - Documentation Index

## Overview

This documentation provides a complete analysis of the current usage tracking implementation in Unified Ledger, identifying performance bottlenecks and providing concrete optimization strategies.

**Analysis Date:** November 8, 2025
**Status:** 8 critical issues identified, 20-80% performance improvement possible

---

## Three-Document Structure

### 1. USAGE_TRACKING_QUICK_REFERENCE.md (8.6 KB, 284 lines)
**Best for:** Quick understanding of issues and priorities
- Key findings summary table
- Critical issues list (8 issues)
- Missing database indexes
- Transaction creation performance breakdown
- Expected results before/after optimization
- Optimization priorities by phase

**Read this first if you have 5-10 minutes**

---

### 2. USAGE_TRACKING_ANALYSIS.md (18 KB, 529 lines)
**Best for:** Deep technical understanding
- Complete database schema analysis
- Line-by-line code review of all API endpoints
- Component analysis showing frontend issues
- Performance bottleneck identification
- Detailed query analysis with examples
- Index recommendations with SQL
- Optimization strategies (Database, Application, Data Model)
- Implementation roadmap (4-phase plan)
- Estimated impact calculations

**Read this for comprehensive understanding (30-45 minutes)**

---

### 3. USAGE_TRACKING_CODE_LOCATIONS.md (12 KB, 408 lines)
**Best for:** Developer implementation reference
- Complete file-by-file breakdown
- Exact line numbers for all issues
- Code snippets showing problems
- Tables mapping tables to missing indexes
- API endpoint analysis with severity
- Frontend component analysis
- Summary table with files needing changes
- Priority indicators

**Use this as you implement fixes**

---

## Quick Facts

### What's Being Tracked
- 9 database tables with usage fields
- 10+ API endpoints writing usage data
- 7+ API endpoints reading usage data
- 4 React components making usage queries

### Critical Issues Found
| Issue | Count | Severity | Impact |
|-------|-------|----------|--------|
| Missing indexes | 9 | 🔴 CRITICAL | Full table scans on dropdown load |
| N+1 query patterns | 2 | 🔴 CRITICAL | 20+ queries instead of 1 |
| Duplicate API calls | 1 | 🟠 HIGH | Same data fetched twice |
| No batching | 1 | 🔴 CRITICAL | 12+ sequential DB ops per transaction |
| Double queries | 1 | 🔴 CRITICAL | Count query doesn't benefit from pagination |

---

## Navigation Guide

### I want to understand the problems
→ Start with **QUICK_REFERENCE.md** (Issues section, pages 1-3)

### I want to fix specific code
→ Use **CODE_LOCATIONS.md** (look up file name, find line numbers)

### I want to understand the full scope
→ Read **ANALYSIS.md** (sections 1-4, then skip to implementation roadmap)

### I want to implement optimizations
→ Follow **ANALYSIS.md** section 6 (Optimization Strategies)
→ Reference **CODE_LOCATIONS.md** for exact locations

### I want to create database migration
→ Use **ANALYSIS.md** section 5 (Index Recommendations)

---

## Implementation Checklist

### Phase 1: Database Indexes (30 minutes)
- [ ] Review recommended indexes in ANALYSIS.md section 5
- [ ] Update `/lib/db/schema.ts` with 9 new indexes
- [ ] Create migration file
- [ ] Deploy to production
- **Impact:** 20-40% improvement

Files to modify:
- `/lib/db/schema.ts` (add indexes)

### Phase 2: Query Optimization (2-3 hours)
- [ ] Fix N+1 in `/api/transfers/suggest`
- [ ] Consolidate count query in `/api/tags`
- [ ] Add type filtering in `/api/categories`
- **Impact:** Additional 20-30% improvement

Files to modify:
- `/app/api/accounts/route.ts`
- `/app/api/categories/route.ts`
- `/app/api/merchants/route.ts`
- `/app/api/tags/route.ts`
- `/app/api/transfers/suggest/route.ts`

### Phase 3: Batching & Consolidation (3-4 hours)
- [ ] Batch usage updates in `/api/transactions`
- [ ] Combine form data API calls
- [ ] Share tag data via React Context
- **Impact:** Additional 15-25% improvement

Files to modify:
- `/app/api/transactions/route.ts`
- `/components/transactions/transaction-form.tsx`
- `/components/tags/tag-selector.tsx`

### Phase 4: Caching (2-3 hours)
- [ ] Implement Redis caching
- [ ] Add cache invalidation
- [ ] Monitor cache hit rates
- **Impact:** Additional 10-20% improvement

Files to modify:
- API endpoints (add caching logic)

---

## Key Metrics

### Current Performance Issues
```
Transaction form load:     ~200-400ms (3 API calls)
Transaction creation:      ~500-800ms (12 DB operations)
Tag dropdown load:         ~150-300ms (2 queries)
Transfer suggestions:      ~200-400ms (21 queries)
```

### Target Performance
```
Transaction form load:     ~50-100ms (1 cached API call)
Transaction creation:      ~100-150ms (batched operations)
Tag dropdown load:         ~50-100ms (1 indexed query)
Transfer suggestions:      ~50-80ms (1 JOIN query)
```

**Overall improvement: 50-80% faster**

---

## Critical Findings

### Issue #1: Missing Indexes (CRITICAL)
**Location:** 9 tables missing `(user_id, usage_count DESC)` indexes
**Impact:** Full table scans on EVERY dropdown load
**Fix:** Add indexes (30 min, 20-40% improvement)
**Files affected:**
- `lib/db/schema.ts` (tables: accounts, budgetCategories, merchants, tags, savedSearchFilters, etc.)

### Issue #2: N+1 Query Pattern in Transfers
**Location:** `/api/transfers/suggest` (lines 39-91)
**Impact:** 21 queries instead of 1 (10 transfer pairs × 2 account queries)
**Fix:** Use JOINs instead of Promise.all()
**Time:** 30-45 minutes

### Issue #3: Double Query for Tags Pagination
**Location:** `/api/tags` (lines 26-58)
**Impact:** Separate COUNT query doesn't benefit from pagination
**Fix:** Use COUNT(*) in same query
**Time:** 15-20 minutes

### Issue #4: 12+ Sequential DB Operations per Transaction
**Location:** `/api/transactions` (lines 137-298)
**Impact:** Each transaction takes 500-800ms (blocking operations)
**Fix:** Batch updates, parallelize operations
**Time:** 1-2 hours

### Issue #5: Duplicate Frontend API Calls
**Location:** 
- `TransactionForm` line 110
- `TagSelector` line 48
**Impact:** Same 100 tags fetched twice per form
**Fix:** Use React Context or deduplicate at component level
**Time:** 30 minutes

---

## Files Summary

### Critical Files (Modify First)
1. `/lib/db/schema.ts` - Add 9 missing indexes
2. `/app/api/tags/route.ts` - Fix double query + add index
3. `/app/api/categories/route.ts` - Add index + type filtering
4. `/app/api/accounts/route.ts` - Add index + pagination
5. `/app/api/transactions/route.ts` - Batch operations

### High Priority Files
6. `/app/api/transfers/suggest/route.ts` - Fix N+1 pattern
7. `/components/transactions/transaction-form.tsx` - Combine API calls
8. `/components/tags/tag-selector.tsx` - Deduplicate fetch

### Medium Priority Files
9. `/components/transactions/category-selector.tsx` - Server-side filtering
10. `/app/api/merchants/route.ts` - Add pagination + index

---

## Reading Time Estimates

| Document | Reading Time | Best For |
|----------|--------------|----------|
| QUICK_REFERENCE | 5-10 min | Understanding issues |
| ANALYSIS | 30-45 min | Deep technical review |
| CODE_LOCATIONS | 10-15 min | Implementation reference |
| This INDEX | 5-10 min | Navigation |

---

## Next Steps

1. **Immediate (Today):**
   - Read QUICK_REFERENCE.md to understand issues
   - Review CODE_LOCATIONS.md for affected files

2. **This Week (Phase 1):**
   - Add database indexes to schema.ts
   - Create and deploy migration
   - Verify performance improvement (expect 20-40% gain)

3. **Next Week (Phase 2):**
   - Fix N+1 queries in transfer suggestions
   - Consolidate count queries in tags API
   - Add server-side category filtering

4. **Following Week (Phase 3):**
   - Batch usage updates in transactions
   - Combine form data API calls
   - Implement React Context for shared data

5. **Optional (Phase 4):**
   - Add Redis caching for sorted lists
   - Implement cache invalidation logic

---

## Contact & Questions

For questions about specific sections:
- **Database:** See ANALYSIS.md sections 1, 5
- **API endpoints:** See CODE_LOCATIONS.md (API Endpoints section)
- **Components:** See CODE_LOCATIONS.md (Frontend Components section)
- **Implementation:** See ANALYSIS.md section 6

---

## Document Statistics

- **Total documentation:** 1,221 lines
- **SQL examples:** 20+
- **TypeScript code examples:** 30+
- **Query analysis examples:** 5
- **Performance metrics:** 20+
- **Files requiring changes:** 10
- **Missing indexes identified:** 9

Last Updated: November 8, 2025
