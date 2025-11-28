# Split Builder Improvements Implementation Plan

**Date:** 2025-11-28
**Priority:** Low
**Estimated Time:** 2.5 hours total

## Overview

This plan addresses two low-priority improvements from `docs/split-transaction-review.md`:

1. **Simplify auto-calculation logic** (~2 hours)
2. **Add loading states for category fetching** (~30 min)

---

## Current Issues

### Issue 1: Complex Auto-Calculation Logic

**Location:** `components/transactions/split-builder.tsx` (lines 96-130)

**Current Behavior:**
- When editing split N (not the last), the last split is silently updated to the remainder
- When editing the last split (with 3+ splits), the second-to-last split is silently updated
- No visual indication that auto-calculation is happening
- Confusing when editing splits in sequence - amounts "jump" unexpectedly

**Problems:**
1. Users don't know another split is being modified
2. Logic is asymmetric and hard to understand
3. Can cause data loss if user intended specific amounts
4. Behavior with 2 splits differs from behavior with 3+ splits

### Issue 2: Missing Loading States

**Location:** `components/transactions/split-builder.tsx` (line 226-230)

**Current Behavior:**
- `CategorySelector` is rendered directly without loading state handling
- If categories take time to load, the UI shows an empty dropdown
- User has no feedback that data is being fetched

---

## Proposed Solution

### Task 1: Simplify Auto-Calculation UX

**Approach:** Replace silent auto-calculation with an explicit "Balance Splits" button

**Benefits:**
1. User is in control - no unexpected changes
2. Clear indication of what the "Balance" action does
3. Simpler code - no complex conditional logic
4. Works consistently regardless of number of splits

**UI Changes:**
1. Remove automatic adjustment logic from `handleUpdateSplitAmount`
2. Add a "Balance Splits" button in the summary section
3. Add an "auto-balanced" badge to indicate which split was adjusted
4. Add a tooltip explaining what "Balance Splits" does

**New Function: `handleBalanceSplits`**
```typescript
const handleBalanceSplits = () => {
  if (splits.length < 2) return;
  
  // Sum all splits except the last one
  const totalAllocated = splits
    .slice(0, -1)
    .reduce((sum, s) => sum + (s.isPercentage ? s.percentage || 0 : s.amount || 0), 0);
  
  // Calculate remainder
  const target = splitType === 'percentage' ? 100 : transactionAmount;
  const remainder = Math.max(0, target - totalAllocated);
  
  // Update the last split
  const updatedSplits = [...splits];
  const lastIndex = updatedSplits.length - 1;
  updatedSplits[lastIndex] = {
    ...updatedSplits[lastIndex],
    ...(splitType === 'percentage' 
      ? { percentage: remainder }
      : { amount: remainder }),
    isAutoBalanced: true, // Track for visual indicator
  };
  
  onSplitsChange(updatedSplits);
  validateCurrentSplits(updatedSplits);
};
```

**Visual Design:**
- "Balance Splits" button appears in the summary card when splits.length >= 2
- Uses outline variant with primary color border
- Icon: `Scale` from lucide-react
- When a split is auto-balanced, show a small `Badge` labeled "Auto-balanced"

### Task 2: Add Loading States for Category Fetching

**Approach:** Add optional `isLoading` prop to `CategorySelector` and use skeleton in `SplitBuilder`

**Changes to CategorySelector:**
1. Export the loading state via an optional prop
2. Use React pattern: accept optional `onLoadingChange` callback

**Changes to SplitBuilder:**
1. Track loading state for each split's category selector
2. Show `Skeleton` component while categories load
3. Disable "Add Split" button while loading

**Implementation:**

```typescript
// In CategorySelector - add new prop
interface CategorySelectorProps {
  // ... existing props
  onLoadingChange?: (isLoading: boolean) => void;
}

// In SplitBuilder - track loading
const [categoriesLoading, setCategoriesLoading] = useState(true);

// In SplitBuilder - show skeleton
{categoriesLoading ? (
  <Skeleton className="h-[42px] w-full rounded-lg" />
) : (
  <CategorySelector 
    ... 
    onLoadingChange={setCategoriesLoading}
  />
)}
```

---

## Implementation Steps

### Phase 1: Simplify Auto-Calculation (Task 1)

**Step 1.1:** Update the `Split` interface to include auto-balanced tracking
- Add optional `isAutoBalanced?: boolean` field
- Location: `components/transactions/split-builder.tsx` (line 19-23)

**Step 1.2:** Remove auto-calculation logic from `handleUpdateSplitAmount`
- Remove lines 96-130 (the entire auto-calculation block)
- Keep only the simple split update logic
- Location: `components/transactions/split-builder.tsx`

**Step 1.3:** Add `handleBalanceSplits` function
- Create new function that calculates and sets remainder on last split
- Sets `isAutoBalanced: true` on the adjusted split
- Clears `isAutoBalanced` from other splits
- Location: After `handleUpdateSplitDescription` function

**Step 1.4:** Add "Balance Splits" button to UI
- Add button in the summary card section (after line 296)
- Only show when `splits.length >= 2` and validation has errors
- Use `Scale` icon from lucide-react
- Include tooltip explaining the action
- Style: `bg-[var(--color-primary)] text-background` when enabled

**Step 1.5:** Add "Auto-balanced" badge indicator
- In the split card display (line 208-212 area)
- Show small badge when `split.isAutoBalanced === true`
- Use muted styling: `text-xs text-muted-foreground`

**Step 1.6:** Clear auto-balanced flag on manual edit
- In `handleUpdateSplitAmount`, when a split is manually edited, clear `isAutoBalanced`

### Phase 2: Add Loading States (Task 2)

**Step 2.1:** Update CategorySelector to expose loading state
- Add `onLoadingChange?: (isLoading: boolean) => void` to props interface
- Call `onLoadingChange(true)` when fetch starts
- Call `onLoadingChange(false)` when fetch completes
- Location: `components/transactions/category-selector.tsx`

**Step 2.2:** Add loading state to SplitBuilder
- Add `const [categoriesLoading, setCategoriesLoading] = useState(true)`
- Import `Skeleton` from `@/components/ui/skeleton`

**Step 2.3:** Conditionally render CategorySelector or Skeleton
- Wrap CategorySelector in loading check
- Show Skeleton while loading

**Step 2.4:** Disable interactions while loading
- Disable "Add Split" button while `categoriesLoading` is true
- Show loading indicator in button text

---

## Files to Modify

| File | Changes |
|------|---------|
| `components/transactions/split-builder.tsx` | Main changes - balance button, loading states |
| `components/transactions/category-selector.tsx` | Add `onLoadingChange` prop |

## Testing Plan

### Manual Testing

1. **Balance Button:**
   - Create 2+ splits with amounts that don't sum to total
   - Click "Balance Splits" - verify last split is adjusted correctly
   - Verify "Auto-balanced" badge appears on last split
   - Edit the auto-balanced split manually - verify badge disappears

2. **Loading States:**
   - Slow down network in DevTools
   - Navigate to transaction form with splits
   - Verify skeleton shows while categories load
   - Verify "Add Split" is disabled during loading

### Edge Cases

1. Balance with 0 remaining (all splits sum to 100% or full amount)
2. Balance when total exceeds transaction amount
3. Switching between percentage and amount modes after balancing
4. Adding new split after balancing (should not auto-balance)

---

## Styling Guidelines

All styling will use semantic CSS variables per project rules:

- Backgrounds: `bg-background`, `bg-card`, `bg-elevated`
- Text: `text-foreground`, `text-muted-foreground`
- Borders: `border-border`
- Primary: `bg-[var(--color-primary)]`, `text-[var(--color-primary)]`
- Success: `text-[var(--color-success)]`
- Error: `text-[var(--color-error)]`

---

## Success Criteria

1. ✅ Auto-calculation is opt-in via "Balance Splits" button
2. ✅ Clear visual indication when a split is auto-balanced
3. ✅ Loading skeleton shows while categories fetch
4. ✅ No hardcoded colors - all semantic CSS variables
5. ✅ All TypeScript types properly defined (no `any`)
6. ✅ Zero linter errors
7. ✅ Works correctly in all 7 themes

---

## Rollback Plan

If issues arise, the changes can be reverted by:
1. Git revert the commit
2. The original auto-calculation logic is documented in `docs/split-transaction-review.md`

---

## Dependencies

- `lucide-react` (already installed) - for `Scale` icon
- `@/components/ui/skeleton` (already exists) - for loading states
- `@/components/ui/tooltip` (already exists) - for Balance button explanation


