# Split Transaction Code Review

**Date:** 2025-11-27  
**Status:** Critical fix (hardcoded colors) COMPLETE. Remaining improvements documented below for future work.

## Overview

This document reviews the split transaction implementation across the following files:

| File | Purpose |
|------|---------|
| `lib/transactions/split-calculator.ts` | Core split calculation and validation logic |
| `components/transactions/split-builder.tsx` | UI component for building splits |
| `app/api/transactions/[id]/splits/route.ts` | API for split CRUD operations |
| `app/api/transactions/[id]/splits/[splitId]/route.ts` | API for individual split updates/deletes |
| `lib/rules/split-action-handler.ts` | Handler for rule-based split creation |
| `__tests__/lib/transactions/split-calculator.test.ts` | Unit tests (500 lines, comprehensive) |

---

## Issues Identified

### 1. **CRITICAL: Hardcoded Colors in SplitBuilder** (Priority: High)

The `split-builder.tsx` component uses hardcoded hex colors instead of CSS variables, violating the project's design system rules.

**Affected Lines:**
```typescript
// Line 169
<Label className="text-sm font-medium text-white">

// Lines 174-178, 186-190
className={`flex-1 ${
  splitType === 'amount'
    ? 'bg-[var(--color-primary)] text-white hover:opacity-90'
    : 'bg-[#242424] text-white border-[#3a3a3a] hover:bg-[#2a2a2a]'  // HARDCODED
}`}

// Line 201
<Label className="text-sm font-medium text-white">

// Line 211
className="border-[#2a2a2a] bg-[#242424] p-3 space-y-2"  // HARDCODED

// Line 226
className="h-8 w-8 p-0 hover:bg-[#3a3a3a]"  // HARDCODED

// Line 245
className="bg-[#1a1a1a] border-[#3a3a3a] text-white text-sm"  // HARDCODED

// Line 256
className="bg-[#1a1a1a] border-[#3a3a3a] text-white text-sm"  // HARDCODED

// Line 304
className="border-[#2a2a2a] bg-[#1a1a1a] p-3"  // HARDCODED
```

**Recommended Fix:**
Replace hardcoded colors with semantic CSS variables:
- `#242424` → `bg-elevated`
- `#2a2a2a` → `border-border`
- `#3a3a3a` → `hover:bg-[var(--color-border)]`
- `#1a1a1a` → `bg-background` or `bg-card`
- `text-white` → `text-foreground`

---

### 2. **Duplicate Validation Logic** (Priority: Medium)

Similar validation logic exists in two places:

1. **`split-calculator.ts`** - `validateSplits()`
2. **`split-action-handler.ts`** - `validateSplitConfig()`

This creates:
- Maintenance burden (changes must be made in both places)
- Potential inconsistency (different tolerance values, edge case handling)

**Differences:**
| Aspect | split-calculator.ts | split-action-handler.ts |
|--------|---------------------|------------------------|
| 0.01% tolerance | Yes (line 49) | No |
| Zero amounts allowed | Yes (line 72-79) | No (line 218-219) |
| Mixed splits check | Yes | No |

**Recommended Fix:**
- Consolidate validation into `split-calculator.ts`
- Import and use in `split-action-handler.ts`
- Add a flag for "strict mode" to handle the zero-amount difference

---

### 3. **TypeScript `any` Type Usage** (Priority: Medium)

The `[splitId]/route.ts` uses `any` type:

```typescript
// Line 107
const updateData: Record<string, any> = {
```

**Recommended Fix:**
Create a proper type:
```typescript
interface SplitUpdateData {
  categoryId?: string;
  amount?: number;
  percentage?: number;
  isPercentage?: boolean;
  description?: string;
  notes?: string;
  sortOrder?: number;
  updatedAt: string;
}
```

---

### 4. **Missing Decimal.js Rounding for Database Storage** (Priority: Medium)

When calculating split amounts, the result may have excessive decimal places:

```typescript
// split-action-handler.ts line 88
amount = totalAmount.times(split.percentage).dividedBy(100).toNumber();
```

Financial amounts should be rounded to 2 decimal places before storage.

**Recommended Fix:**
```typescript
amount = totalAmount
  .times(split.percentage)
  .dividedBy(100)
  .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
  .toNumber();
```

---

### 5. **No Batch Split Update API** (Priority: Low)

Currently, updating multiple splits requires multiple API calls:
- Update split 1: `PUT /api/transactions/[id]/splits/[splitId1]`
- Update split 2: `PUT /api/transactions/[id]/splits/[splitId2]`
- etc.

**Recommended Fix:**
Add a batch update endpoint:
```
PUT /api/transactions/[id]/splits/batch
Body: { splits: [{ id: "...", amount: ... }, ...] }
```

---

### 6. **Complex Auto-Calculation Logic** (Priority: Low)

The `handleUpdateSplitAmount` function (lines 87-141) has nested conditionals for auto-calculating the last split. This is fragile and hard to maintain.

**Current Logic:**
1. If editing split N (not last), update last split to remainder
2. If editing last split, update second-to-last split to remainder
3. Only applies when 2+ splits exist and using fixed amounts

**Issues:**
- Editing splits in sequence can cause unexpected jumps
- Logic becomes confusing with 3+ splits
- No clear indication to user that auto-calculation is happening

**Recommended Fix:**
Consider one of:
1. Add a visual "auto-calculated" badge to the split being adjusted
2. Only auto-calculate on a dedicated "Balance" button click
3. Simplify to always adjust the last split only

---

### 7. **Missing Loading States in SplitBuilder** (Priority: Low)

The `CategorySelector` component is used without handling loading states for category fetching. If categories take time to load, the UI shows empty dropdowns.

**Recommended Fix:**
Add loading indicator:
```tsx
{categoriesLoading ? (
  <Skeleton className="h-10 w-full" />
) : (
  <CategorySelector ... />
)}
```

---

### 8. **Inconsistent Label Color Classes** (Priority: Low)

Labels use inconsistent color classes:
- Line 169: `text-white` (hardcoded)
- Line 201: `text-white` (hardcoded)

Should use: `text-foreground`

---

### 9. **Potential State Timing Issue** (Priority: Low)

In `handleAddSplit`, validation runs after setting state:

```typescript
const updatedSplits = [...splits, newSplit];
onSplitsChange(updatedSplits);  // State update (async)
validateCurrentSplits(updatedSplits);  // Validates immediately
```

This works because we're passing `updatedSplits` to both, but it's a subtle pattern that could be error-prone.

**Recommended Fix:**
Consider combining into a single function or using `useEffect` to trigger validation.

---

### 10. **Test Coverage Gap** (Priority: Low)

The test file (`split-calculator.test.ts`) is comprehensive (500 lines, 50+ test cases) but doesn't test:
- Edge case: Division by zero (0% split with 0 transaction amount)
- Edge case: Negative amounts

**Recommended Fix:**
Add edge case tests:
```typescript
it('should handle zero transaction amount', () => {
  const split: SplitEntry = { percentage: 50, isPercentage: true };
  const metrics = calculateSplitMetrics(split, 0);
  expect(metrics.amount).toBe(0);
});

it('should handle negative amounts gracefully', () => {
  const splits: SplitEntry[] = [
    { amount: -50, isPercentage: false },
  ];
  const result = validateSplits(splits, 100);
  expect(result.valid).toBe(false);
});
```

---

## Recommended Action Plan

### Phase 1: Critical Fixes (Immediate)

1. **Fix hardcoded colors in SplitBuilder** (~15 min)
   - Replace all hex colors with CSS variables
   - Test theme switching works correctly

### Phase 2: Quality Improvements (Next Sprint)

2. **Consolidate validation logic** (~30 min)
   - Move all validation to `split-calculator.ts`
   - Update `split-action-handler.ts` to import

3. **Add proper TypeScript types** (~15 min)
   - Create `SplitUpdateData` interface
   - Replace `Record<string, any>`

4. **Add Decimal.js rounding** (~10 min)
   - Round to 2 decimal places before storage

### Phase 3: Enhancements (Future)

5. **Add batch update API** (~1 hour)
6. **Simplify auto-calculation UX** (~2 hours)
7. **Add loading states** (~30 min)
8. **Add edge case tests** (~30 min)

---

## Summary

| Priority | Issue | Effort |
|----------|-------|--------|
| High | Hardcoded colors | 15 min |
| Medium | Duplicate validation | 30 min |
| Medium | TypeScript any types | 15 min |
| Medium | Missing Decimal rounding | 10 min |
| Low | No batch update API | 1 hour |
| Low | Complex auto-calc logic | 2 hours |
| Low | Missing loading states | 30 min |
| Low | Label color inconsistency | 5 min |
| Low | State timing pattern | 15 min |
| Low | Test coverage gaps | 30 min |

**Total Estimated Effort:** ~5.5 hours for all improvements

---

## Strengths of Current Implementation

1. **Comprehensive test coverage** - 500+ lines of tests covering financial precision
2. **Proper Decimal.js usage** - Avoids floating-point errors for financial calculations
3. **Clear separation of concerns** - Calculator, UI, and API are well-separated
4. **Household-aware** - Properly scopes splits to household context
5. **Flexible split types** - Supports both percentage and fixed amount splits
6. **Good validation messages** - Clear error messages for users

