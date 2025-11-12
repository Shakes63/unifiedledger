# Transaction Save Performance Optimization Plan

## Objective
Optimize transaction creation (POST /api/transactions) to reduce save time by 50-75%, following the successful pattern used in Bug #4 (Bill Save Performance) where parallel validation and batch operations achieved 75% speed improvement.

## Current Performance Analysis

### Measured Bottlenecks
Based on code analysis of `app/api/transactions/route.ts` (962 lines), the transaction creation flow has **15+ sequential database operations**:

1. **Validation Phase** (5 sequential queries - lines 66-182):
   - Account validation
   - ToAccount validation (transfers only)
   - Category validation
   - Merchant info fetch (for rules context)
   - Category info fetch (for rules context)

2. **Core Creation Phase**:
   - Rule matching and execution
   - Transaction insert(s)
   - Account balance update(s)
   - Post-creation actions (splits, transfers, account changes)

3. **Usage Tracking Phase** (4 sequential operations - lines 468-595):
   - Category usage select → update/insert
   - Merchant usage select → update/insert
   - Each involves 2 DB queries (check existing, then update or insert)

4. **Auto-Linking Phase** (10+ sequential operations - lines 616-941):
   - Bill matching (fetch bills → fetch instances → update transaction → update instance → debt processing)
   - Debt matching (fetch debts → update transaction → calculate breakdown → insert payment → update debt → milestone updates)
   - Direct debt payment (similar to debt matching)
   - Milestone checking (loops for each milestone - 3 separate loops)

5. **Logging Phase**:
   - Rule execution logging

### Estimated Current Time
- **Light transaction** (no rules, no bills/debts): ~200-400ms
- **Medium transaction** (with rules, category/merchant): ~400-800ms
- **Heavy transaction** (with bill/debt matching, milestones): ~800-1500ms

### Target Performance
- **Light transaction**: <100ms (50% improvement)
- **Medium transaction**: <200ms (75% improvement)
- **Heavy transaction**: <400ms (73% improvement)

## Implementation Plan

### Task 1: Parallel Validation Queries (HIGH PRIORITY)
**File:** `app/api/transactions/route.ts` (lines 66-182)
**Estimated Time:** 1 hour
**Expected Improvement:** 40-60% reduction in validation time

**Current Flow:**
```typescript
// Sequential (5 separate awaits)
const account = await db.select()...
const toAccount = await db.select()...
const category = await db.select()...
const merchantInfo = await db.select()...
const categoryInfo = await db.select()...
```

**Optimized Flow:**
```typescript
// Parallel (single Promise.all)
const [account, toAccount, category, merchantInfo, categoryInfo] = await Promise.all([
  db.select().from(accounts).where(...),
  type === 'transfer' ? db.select().from(accounts).where(...) : Promise.resolve([]),
  categoryId ? db.select().from(budgetCategories).where(...) : Promise.resolve([]),
  merchantId ? db.select().from(merchants).where(...) : Promise.resolve([]),
  categoryId ? db.select().from(budgetCategories).where(...) : Promise.resolve([])
]);
```

**Benefits:**
- 5 sequential queries → 1 parallel batch
- Reduces validation time from ~100-150ms to ~30-40ms
- No logic changes, only execution order

**Implementation Steps:**
1. Create validation query builder functions
2. Conditionally construct promises based on transaction type
3. Execute Promise.all with all validation queries
4. Update validation logic to handle array results
5. Keep error handling and validation checks

---

### Task 2: Batch Usage Analytics Updates (MEDIUM PRIORITY)
**File:** `app/api/transactions/route.ts` (lines 468-595)
**Estimated Time:** 1.5 hours
**Expected Improvement:** 50-70% reduction in usage tracking time

**Current Flow:**
```typescript
// Category usage: select → update OR insert (2 queries)
const category = await db.select()...
await db.update(budgetCategories)...
const existingAnalytics = await db.select()...
await db.update/insert(usageAnalytics)...

// Merchant usage: select → update OR insert (2 queries)
const merchant = await db.select()...
await db.update(merchants)...
const existingAnalytics = await db.select()...
await db.update/insert(usageAnalytics)...
```

**Optimized Flow:**
```typescript
// Parallel queries for both category and merchant
const [categoryData, merchantData] = await Promise.all([
  categoryId ? db.select().from(budgetCategories).where(...) : Promise.resolve([]),
  merchantId ? db.select().from(merchants).where(...) : Promise.resolve([])
]);

// Batch all updates
await Promise.all([
  categoryId ? db.update(budgetCategories).set(...) : Promise.resolve(),
  merchantId ? db.update(merchants).set(...) : Promise.resolve(),
  categoryId ? upsertUsageAnalytics('category', categoryId) : Promise.resolve(),
  merchantId ? upsertUsageAnalytics('merchant', merchantId) : Promise.resolve()
]);
```

**Alternative Approach (Optional):**
Move usage tracking to background job queue for even faster response time
- Requires job queue infrastructure (e.g., BullMQ, pg-boss)
- Trade-off: Slight delay in usage counts updating
- Benefit: ~100ms savings on every transaction

**Implementation Steps:**
1. Extract usage tracking logic into helper functions
2. Create `upsertUsageAnalytics` helper with upsert logic
3. Batch category and merchant data fetching
4. Batch all update operations
5. Test with and without category/merchant

---

### Task 3: Optimize Bill Matching with Joins (HIGH PRIORITY)
**File:** `app/api/transactions/route.ts` (lines 616-772)
**Estimated Time:** 2 hours
**Expected Improvement:** 60-80% reduction in bill matching time

**Current Flow:**
```typescript
// Sequential queries
const matchingBills = await db.select().from(bills)...
for (const bill of matchingBills) {
  const instances = await db.select().from(billInstances)... // Loop!
}
await db.update(transactions)...
await db.update(billInstances)...
// If debt linked: fetch debt + updates
```

**Optimized Flow:**
```typescript
// Single query with join
const billMatches = await db
  .select({
    bill: bills,
    instance: billInstances,
  })
  .from(bills)
  .innerJoin(billInstances, eq(billInstances.billId, bills.id))
  .where(and(
    eq(bills.userId, userId),
    eq(bills.isActive, true),
    eq(bills.categoryId, categoryId),
    eq(billInstances.status, 'pending')
  ))
  .orderBy(asc(billInstances.dueDate))
  .limit(1); // Get oldest pending instance

// Batch updates if match found
if (billMatches.length > 0) {
  const match = billMatches[0];

  const updates = [
    db.update(transactions).set({ billId: match.bill.id }),
    db.update(billInstances).set({ status: 'paid', ... })
  ];

  // Add debt updates if applicable
  if (match.bill.debtId) {
    const debt = await db.select().from(debts).where(...);
    const breakdown = calculatePaymentBreakdown(...);
    updates.push(
      db.insert(debtPayments).values(...),
      db.update(debts).set({ remainingBalance: newBalance, ... }),
      batchUpdateMilestones(match.bill.debtId, newBalance) // New helper
    );
  }

  await Promise.all(updates);
}
```

**Implementation Steps:**
1. Rewrite bill query to use JOIN instead of loop
2. Create `batchUpdateMilestones` helper function
3. Collect all updates in array
4. Execute Promise.all for all updates
5. Test with bills linked to debts and without

---

### Task 4: Optimize Debt Matching (MEDIUM PRIORITY)
**File:** `app/api/transactions/route.ts` (lines 774-867)
**Estimated Time:** 1.5 hours
**Expected Improvement:** 60-80% reduction in debt matching time

**Current Flow:**
```typescript
// Sequential operations
const matchingDebts = await db.select()...
await db.update(transactions)...
await db.insert(debtPayments)...
await db.update(debts)...
for (const milestone of milestones) { // Loop!
  await db.update(debtPayoffMilestones)...
}
```

**Optimized Flow:**
```typescript
// Batch all debt-related updates
const matchingDebts = await db.select()...
if (matchingDebts.length > 0) {
  const debt = matchingDebts[0];
  const breakdown = calculatePaymentBreakdown(...);
  const newBalance = Math.max(0, debt.remainingBalance - breakdown.principalAmount);

  await Promise.all([
    db.update(transactions).set({ debtId: debt.id }),
    db.insert(debtPayments).values(...),
    db.update(debts).set({ remainingBalance: newBalance, ... }),
    batchUpdateMilestones(debt.id, newBalance)
  ]);
}
```

**Implementation Steps:**
1. Create `batchUpdateMilestones` helper function (shared with Task 3)
2. Collect all updates in array
3. Execute Promise.all for parallel updates
4. Apply same pattern to direct debt payment (lines 869-941)

---

### Task 5: Batch Milestone Updates Helper (MEDIUM PRIORITY)
**File:** `lib/debts/milestone-utils.ts` (NEW FILE)
**Estimated Time:** 1 hour
**Expected Improvement:** Enables Task 3 & 4 optimizations

**Current Pattern:**
```typescript
// Used 3 times in transaction creation
const milestones = await db.select()...
for (const milestone of milestones) {
  if (!milestone.achievedAt && newBalance <= milestone.milestoneBalance) {
    await db.update(debtPayoffMilestones)... // Sequential updates!
  }
}
```

**New Helper:**
```typescript
// lib/debts/milestone-utils.ts
export async function batchUpdateMilestones(
  debtId: string,
  newBalance: number
): Promise<number> {
  // Single query to get all unachieved milestones
  const milestones = await db
    .select()
    .from(debtPayoffMilestones)
    .where(
      and(
        eq(debtPayoffMilestones.debtId, debtId),
        isNull(debtPayoffMilestones.achievedAt),
        lte(debtPayoffMilestones.milestoneBalance, newBalance)
      )
    );

  if (milestones.length === 0) return 0;

  // Batch update all achieved milestones
  await db
    .update(debtPayoffMilestones)
    .set({ achievedAt: new Date().toISOString() })
    .where(
      and(
        eq(debtPayoffMilestones.debtId, debtId),
        isNull(debtPayoffMilestones.achievedAt),
        lte(debtPayoffMilestones.milestoneBalance, newBalance)
      )
    );

  return milestones.length;
}
```

**Implementation Steps:**
1. Create new file `lib/debts/milestone-utils.ts`
2. Implement `batchUpdateMilestones` with single UPDATE query
3. Add proper TypeScript types
4. Update all 3 milestone checking locations to use helper
5. Add unit tests

---

### Task 6: Add Database Indexes (HIGH PRIORITY)
**File:** `lib/db/schema.ts` + migration
**Estimated Time:** 30 minutes
**Expected Improvement:** 20-40% faster queries

**Current Indexes:**
Review existing indexes and ensure coverage for:
- `transactions.userId, transactions.date` (already exists?)
- `bills.userId, bills.isActive, bills.categoryId` (composite index)
- `billInstances.billId, billInstances.status` (composite index)
- `debts.userId, debts.status, debts.categoryId` (composite index)
- `debtPayoffMilestones.debtId, debtPayoffMilestones.achievedAt` (composite index)
- `usageAnalytics.userId, usageAnalytics.itemType, usageAnalytics.itemId` (composite index)

**Implementation Steps:**
1. Check existing indexes in schema.ts
2. Create migration 0026 to add missing indexes
3. Apply migration to sqlite.db
4. Verify query performance with EXPLAIN QUERY PLAN

---

### Task 7: Optimize Transfer Creation (LOW PRIORITY)
**File:** `app/api/transactions/route.ts` (lines 236-355)
**Estimated Time:** 1 hour
**Expected Improvement:** 30-50% faster transfer creation

**Current Flow:**
```typescript
// Sequential inserts and updates
await db.insert(transactions).values(transferOut);
await db.insert(transactions).values(transferIn);
await db.update(accounts).set(...).where(eq(accounts.id, accountId));
await db.update(accounts).set(...).where(eq(accounts.id, toAccountId));
// Usage analytics (sequential)
```

**Optimized Flow:**
```typescript
// Batch all transfer operations
await Promise.all([
  db.insert(transactions).values(transferOut),
  db.insert(transactions).values(transferIn),
  db.update(accounts).set(...).where(eq(accounts.id, accountId)),
  db.update(accounts).set(...).where(eq(accounts.id, toAccountId)),
  upsertTransferPairAnalytics(userId, accountId, toAccountId)
]);
```

**Implementation Steps:**
1. Move transfer pair analytics to helper function
2. Batch all inserts and updates
3. Test with various transfer scenarios

---

### Task 8: Performance Monitoring & Testing (CRITICAL)
**File:** `app/api/transactions/route.ts`
**Estimated Time:** 1 hour
**Expected Improvement:** Visibility into actual gains

**Add Performance Instrumentation:**
```typescript
export async function POST(request: Request) {
  const startTime = performance.now();

  try {
    // ... existing logic ...

    const duration = performance.now() - startTime;
    console.log(`[PERF] Transaction created in ${duration.toFixed(2)}ms`, {
      type,
      hasCategory: !!categoryId,
      hasMerchant: !!merchantId,
      hasBill: !!linkedBillId,
      hasDebt: !!linkedDebtId,
      hasRules: !!appliedRuleId,
    });

    return Response.json({ ... });
  } catch (error) {
    // ...
  }
}
```

**Implementation Steps:**
1. Add performance.now() timing at start and end
2. Log duration with transaction characteristics
3. Create performance test suite (10-20 test transactions)
4. Measure before and after optimization
5. Document actual speed improvements

---

### Task 9: Frontend Optimistic Updates (OPTIONAL)
**File:** `components/transactions/transaction-form.tsx`
**Estimated Time:** 2 hours
**Expected Improvement:** Perceived speed improvement

**Add optimistic UI updates:**
```typescript
const handleSubmit = async (e: FormEvent) => {
  e.preventDefault();
  setLoading(true);

  // Optimistic update
  const optimisticTx = { ...formData, id: nanoid() };
  router.refresh(); // Show immediately in UI

  try {
    const response = await fetch('/api/transactions', {
      method: 'POST',
      body: JSON.stringify(formData)
    });

    if (response.ok) {
      toast.success('Transaction saved');
      // UI already updated optimistically
    }
  } catch (error) {
    // Rollback optimistic update
    router.refresh();
    toast.error('Failed to save');
  }
};
```

**Trade-offs:**
- More complex rollback logic
- Risk of showing incorrect data briefly
- Best combined with server optimizations

**Implementation Steps:**
1. Create optimistic transaction object
2. Add to local state immediately
3. Call router.refresh() to update UI
4. Handle rollback on error
5. Test edge cases (errors, concurrent saves)

---

## Implementation Order

### Phase 1: High-Impact Quick Wins (Target: 50-60% improvement)
**Estimated Time:** 3-4 hours
1. ✅ Task 1: Parallel Validation Queries (1 hour)
2. ✅ Task 6: Add Database Indexes (30 minutes)
3. ✅ Task 3: Optimize Bill Matching (2 hours)
4. ✅ Task 5: Batch Milestone Updates Helper (1 hour - dependency for Task 3)

### Phase 2: Medium-Impact Improvements (Target: 65-75% improvement)
**Estimated Time:** 3-4 hours
5. ✅ Task 4: Optimize Debt Matching (1.5 hours)
6. ✅ Task 2: Batch Usage Analytics (1.5 hours)
7. ✅ Task 7: Optimize Transfer Creation (1 hour)

### Phase 3: Testing & Polish (Target: Verification)
**Estimated Time:** 1-2 hours
8. ✅ Task 8: Performance Monitoring & Testing (1 hour)
9. ⏸️ Task 9: Frontend Optimistic Updates (2 hours - OPTIONAL)

### Total Estimated Time: 7-10 hours (excluding optional Task 9)

---

## Success Metrics

### Before Optimization
- Light transaction: ~200-400ms
- Medium transaction: ~400-800ms
- Heavy transaction: ~800-1500ms

### After Optimization (Target)
- Light transaction: <100ms (50%+ improvement) ✅
- Medium transaction: <200ms (75%+ improvement) ✅
- Heavy transaction: <400ms (73%+ improvement) ✅

### Measurements
1. Add performance logging to transaction API
2. Test with 10 light, 10 medium, 10 heavy transactions
3. Calculate average time before/after
4. Document actual improvements

---

## Risks & Mitigation

### Risk 1: Breaking Existing Functionality
**Mitigation:**
- Make changes incrementally (one task at a time)
- Test each change thoroughly before moving to next
- Keep comprehensive test suite (386 existing tests)
- Use TypeScript to catch type errors

### Risk 2: Database Deadlocks with Parallel Queries
**Mitigation:**
- SQLite handles concurrent reads well
- Writes are serialized by SQLite automatically
- Promise.all for reads is safe
- Be careful with parallel writes (use batching)

### Risk 3: Increased Memory Usage
**Mitigation:**
- Promise.all executes concurrently, not in memory
- Monitor memory during testing
- Limit batch sizes if needed

### Risk 4: Complex Rollback Logic
**Mitigation:**
- Keep transaction semantics simple
- Use database transactions where needed
- Log all errors comprehensively
- Don't fail entire operation for non-critical errors

---

## Architecture Integration

### Existing Patterns to Follow
1. **Non-fatal error handling**: Log errors, don't fail transaction
2. **Decimal.js for money**: Continue using for all calculations
3. **Theme CSS variables**: Use semantic colors for any UI changes
4. **Toast notifications**: Keep user feedback consistent
5. **Activity logging**: Maintain audit trail

### Files to Modify
- **Primary:** `app/api/transactions/route.ts` (~300 lines modified)
- **New:** `lib/debts/milestone-utils.ts` (~80 lines)
- **Schema:** `lib/db/schema.ts` (index additions)
- **Migration:** `drizzle/0026_add_performance_indexes.sql` (new file)
- **Optional:** `components/transactions/transaction-form.tsx` (if doing Task 9)

### Theme Integration
No UI changes required for core optimization. All changes are server-side.

If adding performance indicators (optional):
- Use `text-muted-foreground` for timing logs
- Use `text-[var(--color-success)]` for speed improvements
- Use lucide-react icons (Zap for performance)

---

## Testing Strategy

### Unit Tests
- Test new helper functions (milestone batch updates)
- Test validation query builders
- Test usage analytics batching

### Integration Tests
- Test complete transaction flow with optimizations
- Test with various scenarios (light/medium/heavy)
- Test error cases and rollbacks

### Performance Tests
1. Create test script with 100 transactions
2. Run before optimization (baseline)
3. Run after each optimization phase
4. Document improvements

### Manual Testing
- Create transactions via UI
- Verify all features still work:
  - Basic transactions
  - Transfers
  - Bill matching
  - Debt payments
  - Rule application
  - Split transactions

---

## Rollback Plan

If performance degrades or bugs appear:

1. **Immediate:** Revert latest commit
2. **Short-term:** Roll back to pre-optimization state
3. **Long-term:** Re-implement with smaller, safer changes

Each task is independent and can be reverted individually.

---

## Future Optimizations (Post-Phase 3)

### Background Job Queue
- Move usage analytics to async processing
- Move activity logging to async processing
- Requires: Redis or PostgreSQL with pg-boss
- Benefit: ~100-200ms additional savings

### Caching Layer
- Cache frequent queries (accounts, categories, rules)
- Use Redis or in-memory cache
- Benefit: 20-40% faster repeated operations

### Database Connection Pooling
- SQLite is single-threaded, consider PostgreSQL
- Connection pool for parallel queries
- Benefit: Better scaling under load

### GraphQL or tRPC
- Reduce API roundtrips
- Batch multiple operations
- Benefit: Better for complex UIs

---

## Documentation Updates

After implementation:
1. Update `.claude/CLAUDE.md` with optimization summary
2. Update `docs/features.md` to mark feature complete
3. Create performance benchmark document
4. Add comments in code explaining parallel patterns

---

## Conclusion

This optimization plan targets a **50-75% reduction in transaction save time** by:
1. Parallelizing validation queries (40-60% improvement)
2. Optimizing bill/debt matching with joins (60-80% improvement)
3. Batching usage updates (50-70% improvement)
4. Adding proper database indexes (20-40% improvement)
5. Eliminating sequential loops (60-80% improvement)

The approach follows proven patterns from Bug #4 and maintains the application's existing architecture, error handling, and user experience.

**Estimated Total Time:** 7-10 hours
**Expected Improvement:** 50-75% faster transaction saves
**Risk Level:** Low (incremental, reversible changes)
**Dependencies:** None (all changes are self-contained)
