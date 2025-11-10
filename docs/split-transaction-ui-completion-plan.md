# Split Transaction Action - Frontend UI Completion Plan
## Phase 2C Frontend Implementation - Detailed Step-by-Step Plan

**Status:** Planning Complete - Ready for Implementation
**Date:** 2025-11-10
**Current Progress:** Backend 100% ✅, Frontend 40% (needs 60% more)
**Estimated Time:** 4-5 hours total

---

## Overview

Complete the frontend UI for the Split Transaction action in the rules system. The backend is fully functional and waiting for the UI to expose its capabilities to users.

---

## What's Already Done ✅

1. **Backend Complete (100%)**:
   - `lib/rules/split-action-handler.ts` - Split creation logic
   - `lib/rules/actions-executor.ts` - Execute split action
   - `lib/rules/types.ts` - SplitConfig interface
   - API integration in transaction creation and bulk apply

2. **Frontend Partial (40%)**:
   - Scissors, DollarSign, Percent icons imported ✅
   - "Split Transaction" added to action type selector ✅
   - Helper functions implemented (addSplit, removeSplit, updateSplitField) ✅
   - Categories and accounts data fetched and available ✅

---

## What Needs to Be Done ⏳

### **Task 1: Add Split Configuration UI in rule-builder.tsx** (~3 hours)
**Priority:** CRITICAL
**Location:** `components/rules/rule-builder.tsx` (around line 839, after convert_to_transfer section)

#### Component Structure:

```tsx
{action.type === 'create_split' && (
  <div className="flex-1 space-y-4">
    {/* Split Items List */}
    {action.config?.splits && action.config.splits.length > 0 ? (
      <div className="space-y-3">
        {action.config.splits.map((split, splitIndex) => (
          <div key={splitIndex} className="bg-elevated border border-border rounded-lg p-4 space-y-3">
            {/* Split Header with Remove Button */}
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">
                Split {splitIndex + 1}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeSplit(index, splitIndex)}
                className="text-[var(--color-error)] hover:bg-[var(--color-error)]/20 h-7 w-7 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Category Selector */}
            <div className="space-y-2">
              <Label className="text-sm text-foreground">Category</Label>
              <Select
                value={split.categoryId || ''}
                onValueChange={(val) =>
                  updateSplitField(index, splitIndex, 'categoryId', val)
                }
              >
                <SelectTrigger className="bg-input border-border">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {loadingData ? (
                    <div className="p-2 text-sm text-muted-foreground">Loading...</div>
                  ) : categories.length > 0 ? (
                    categories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        <div className="flex items-center gap-2">
                          <Tag className="w-3 h-3" />
                          {category.name}
                          <span className="text-xs text-muted-foreground">
                            ({category.type})
                          </span>
                        </div>
                      </SelectItem>
                    ))
                  ) : (
                    <div className="p-2 text-sm text-muted-foreground">No categories found</div>
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Amount Type Toggle (Fixed vs Percentage) */}
            <div className="space-y-2">
              <Label className="text-sm text-foreground">Amount Type</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    updateSplitField(index, splitIndex, 'isPercentage', false);
                    if (!split.amount) {
                      updateSplitField(index, splitIndex, 'amount', 0);
                    }
                  }}
                  className={`flex-1 ${
                    !split.isPercentage
                      ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)] hover:bg-[var(--color-primary)] hover:opacity-90'
                      : 'bg-elevated border-border text-foreground hover:bg-elevated hover:border-[var(--color-primary)]/30'
                  }`}
                >
                  <DollarSign className="h-4 w-4 mr-1" />
                  Fixed Amount
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    updateSplitField(index, splitIndex, 'isPercentage', true);
                    if (!split.percentage) {
                      updateSplitField(index, splitIndex, 'percentage', 0);
                    }
                  }}
                  className={`flex-1 ${
                    split.isPercentage
                      ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)] hover:bg-[var(--color-primary)] hover:opacity-90'
                      : 'bg-elevated border-border text-foreground hover:bg-elevated hover:border-[var(--color-primary)]/30'
                  }`}
                >
                  <Percent className="h-4 w-4 mr-1" />
                  Percentage
                </Button>
              </div>
            </div>

            {/* Amount/Percentage Input */}
            <div className="space-y-2">
              {split.isPercentage ? (
                <>
                  <Label className="text-sm text-foreground">Percentage (%)</Label>
                  <Input
                    type="number"
                    min="0.1"
                    max="100"
                    step="0.1"
                    value={split.percentage || ''}
                    onChange={(e) =>
                      updateSplitField(
                        index,
                        splitIndex,
                        'percentage',
                        parseFloat(e.target.value) || 0
                      )
                    }
                    placeholder="e.g., 50"
                    className="bg-input border-border"
                  />
                  <p className="text-xs text-muted-foreground">
                    Enter percentage of total transaction amount (0.1% - 100%)
                  </p>
                </>
              ) : (
                <>
                  <Label className="text-sm text-foreground">Amount ($)</Label>
                  <Input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={split.amount || ''}
                    onChange={(e) =>
                      updateSplitField(
                        index,
                        splitIndex,
                        'amount',
                        parseFloat(e.target.value) || 0
                      )
                    }
                    placeholder="e.g., 25.00"
                    className="bg-input border-border"
                  />
                  <p className="text-xs text-muted-foreground">
                    Enter fixed dollar amount
                  </p>
                </>
              )}
            </div>

            {/* Optional Description */}
            <div className="space-y-2">
              <Label className="text-sm text-foreground">
                Description
                <span className="text-muted-foreground ml-1">(Optional)</span>
              </Label>
              <Input
                type="text"
                value={split.description || ''}
                onChange={(e) =>
                  updateSplitField(index, splitIndex, 'description', e.target.value)
                }
                placeholder="Optional note for this split"
                className="bg-input border-border"
              />
            </div>
          </div>
        ))}
      </div>
    ) : (
      // Empty State
      <div className="text-center p-6 bg-card border border-border rounded-lg border-dashed">
        <Scissors className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-50" />
        <p className="text-sm text-muted-foreground mb-1">No splits configured</p>
        <p className="text-xs text-muted-foreground">
          Add splits to divide this transaction across multiple categories.
        </p>
      </div>
    )}

    {/* Add Split Button */}
    <Button
      type="button"
      variant="outline"
      onClick={() => addSplit(index)}
      className="w-full border-dashed border-2 border-border bg-elevated hover:bg-elevated hover:border-[var(--color-primary)]/30 text-foreground"
    >
      <Plus className="h-4 w-4 mr-2" />
      Add Split
    </Button>

    {/* Validation Display */}
    {action.config?.splits && action.config.splits.length > 0 && (
      <div className="space-y-2">
        {/* Total Percentage Display */}
        {(() => {
          const percentageSplits = action.config.splits.filter((s: any) => s.isPercentage);
          const totalPercentage = percentageSplits.reduce(
            (sum: number, s: any) => sum + (s.percentage || 0),
            0
          );
          const hasPercentage = percentageSplits.length > 0;

          if (hasPercentage) {
            return (
              <div
                className={`flex items-center gap-2 p-3 rounded-lg border ${
                  totalPercentage > 100
                    ? 'bg-[var(--color-error)]/10 border-[var(--color-error)]/30'
                    : totalPercentage === 100
                    ? 'bg-[var(--color-success)]/10 border-[var(--color-success)]/30'
                    : 'bg-elevated border-border'
                }`}
              >
                <Percent className="h-4 w-4 text-foreground" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">
                    Total Percentage: {totalPercentage.toFixed(1)}%
                  </p>
                  {totalPercentage > 100 && (
                    <p className="text-xs text-[var(--color-error)] mt-0.5">
                      Total exceeds 100% - please adjust your splits
                    </p>
                  )}
                  {totalPercentage < 100 && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {(100 - totalPercentage).toFixed(1)}% will remain unallocated
                    </p>
                  )}
                </div>
              </div>
            );
          }
          return null;
        })()}

        {/* Fixed Amount Summary */}
        {(() => {
          const fixedSplits = action.config.splits.filter((s: any) => !s.isPercentage);
          const totalFixed = fixedSplits.reduce(
            (sum: number, s: any) => sum + (s.amount || 0),
            0
          );
          const hasFixed = fixedSplits.length > 0;

          if (hasFixed) {
            return (
              <div className="flex items-center gap-2 p-3 rounded-lg border bg-elevated border-border">
                <DollarSign className="h-4 w-4 text-foreground" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">
                    Total Fixed Amount: ${totalFixed.toFixed(2)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    This amount will be allocated regardless of transaction total
                  </p>
                </div>
              </div>
            );
          }
          return null;
        })()}
      </div>
    )}

    {/* Information Box */}
    <div className="flex items-start gap-2 bg-elevated rounded-lg p-3">
      <Lightbulb className="h-4 w-4 text-[var(--color-primary)] mt-0.5 flex-shrink-0" />
      <div className="flex-1">
        <p className="text-xs text-foreground leading-relaxed">
          <strong>How it works:</strong> This action automatically splits transactions across multiple categories.
          You can use percentages (e.g., 60% Groceries, 40% Household) or fixed amounts (e.g., $50 Food, $30 Gas).
          Mixed splits are also supported. Any unallocated amount remains with the original transaction.
        </p>
      </div>
    </div>
  </div>
)}
```

#### Key Features:
- ✅ Individual split cards with elevated background
- ✅ Category selector with icon and type display
- ✅ Amount type toggle (Fixed/Percentage) with pink primary color
- ✅ Dynamic input based on type selection
- ✅ Optional description field per split
- ✅ Remove button per split with red error color
- ✅ Empty state with scissors icon
- ✅ Add split button with dashed border
- ✅ Real-time total percentage validation
- ✅ Fixed amount summary
- ✅ Warning for >100% percentage
- ✅ Success indicator for exactly 100%
- ✅ Information for <100% (unallocated remainder)
- ✅ Educational info box with lightbulb icon
- ✅ Full theme integration with CSS variables

#### Theme Variables Used:
- `bg-elevated` - Split item cards
- `bg-input` - Input fields
- `bg-card` - Empty state background
- `border-border` - All borders
- `text-foreground` - Primary text
- `text-muted-foreground` - Helper text and labels
- `text-[var(--color-primary)]` - Selected buttons, lightbulb icon
- `text-[var(--color-error)]` - Error states, remove buttons
- `text-[var(--color-success)]` - Success states (100% total)
- `bg-[var(--color-primary)]` - Selected amount type buttons
- `hover:border-[var(--color-primary)]/30` - Hover states

---

### **Task 2: Update rules-manager.tsx Display** (~20 minutes)
**Priority:** HIGH
**Location:** `components/rules/rules-manager.tsx`

#### Changes Needed:

1. **Import Icon:**
```tsx
import { ..., Scissors } from 'lucide-react';
```

2. **Update getActionLabel function (around line 50):**
```tsx
const getActionLabel = (action: any): string => {
  switch (action.type) {
    // ... existing cases ...
    case 'create_split':
      const splitCount = action.config?.splits?.length || 0;
      return `Split into ${splitCount} ${splitCount === 1 ? 'category' : 'categories'}`;
    default:
      return action.type;
  }
};
```

3. **Update icon display in action badge (around line 150):**
```tsx
{rule.actions[0].type === 'create_split' && (
  <Scissors className="w-3 h-3 mr-1 text-[var(--color-primary)]" />
)}
```

---

### **Task 3: Add Validation in rules/page.tsx** (~30 minutes)
**Priority:** HIGH
**Location:** `app/dashboard/rules/page.tsx`

#### Add to handleSave validation (around line 100, after other action validations):

```tsx
// Validate create_split actions
if (action.type === 'create_split') {
  if (!action.config?.splits || action.config.splits.length === 0) {
    toast.error('Split action must have at least one split configured');
    return;
  }

  // Validate each split
  for (let i = 0; i < action.config.splits.length; i++) {
    const split = action.config.splits[i];

    // Category required
    if (!split.categoryId) {
      toast.error(`Split ${i + 1}: Category is required`);
      return;
    }

    // Amount validation based on type
    if (split.isPercentage) {
      if (!split.percentage || split.percentage <= 0 || split.percentage > 100) {
        toast.error(`Split ${i + 1}: Percentage must be between 0.1% and 100%`);
        return;
      }
    } else {
      if (!split.amount || split.amount <= 0) {
        toast.error(`Split ${i + 1}: Amount must be greater than 0`);
        return;
      }
    }
  }

  // Validate total percentage doesn't exceed 100%
  const totalPercentage = action.config.splits
    .filter((s: any) => s.isPercentage)
    .reduce((sum: number, s: any) => sum + (s.percentage || 0), 0);

  if (totalPercentage > 100) {
    toast.error('Total split percentage cannot exceed 100%');
    return;
  }
}
```

---

## Implementation Order

### Phase 1: Split Configuration UI (3 hours)
1. Add the split configuration UI section in rule-builder.tsx after the convert_to_transfer section
2. Implement split card rendering with all fields
3. Implement amount type toggle
4. Add validation displays
5. Test theme integration with both Dark Mode and Dark Pink Theme
6. Test adding/removing splits
7. Test switching between percentage and fixed amount

### Phase 2: Display & Validation (1 hour)
8. Update rules-manager.tsx with icon and label
9. Add validation to rules/page.tsx
10. Test complete flow: create rule → add splits → save → view in list
11. Test edit flow: edit rule with splits → modify splits → save

### Phase 3: Testing & Polish (30 minutes - 1 hour)
12. Test empty states
13. Test validation warnings (>100%, missing category, etc.)
14. Test with different transaction amounts (percentage calculations)
15. Verify production build succeeds
16. Test end-to-end: create rule → match transaction → verify splits created

---

## Testing Checklist

### UI Testing:
- [ ] Add split button creates new empty split
- [ ] Remove split button removes the split
- [ ] Category selector displays all categories with icons
- [ ] Amount type toggle switches between Fixed/Percentage
- [ ] Fixed amount input accepts decimal values
- [ ] Percentage input accepts values 0.1-100
- [ ] Optional description field saves correctly
- [ ] Empty state displays when no splits configured
- [ ] Total percentage displays correctly
- [ ] Warning shows when total > 100%
- [ ] Success indicator shows when total = 100%
- [ ] Info shows for < 100% (unallocated)
- [ ] Fixed amount summary displays correctly
- [ ] Theme integration works in Dark Mode
- [ ] Theme integration works in Dark Pink Theme
- [ ] Responsive layout works on mobile

### Validation Testing:
- [ ] Cannot save rule with no splits
- [ ] Cannot save rule with split missing category
- [ ] Cannot save rule with percentage <= 0
- [ ] Cannot save rule with percentage > 100
- [ ] Cannot save rule with amount <= 0
- [ ] Cannot save rule with total percentage > 100%
- [ ] Toast messages are clear and helpful

### Integration Testing:
- [ ] Rule with splits saves correctly
- [ ] Rule with splits loads correctly for editing
- [ ] Rule with splits displays in rules list with icon
- [ ] Split count badge shows correct number
- [ ] Create transaction matching rule with splits
- [ ] Verify splits created in transaction
- [ ] Edit transaction with auto-created splits
- [ ] Delete transaction with auto-created splits

---

## Success Criteria

This feature is complete when:

1. ✅ Split configuration UI is fully implemented with all fields
2. ✅ Amount type toggle works (Fixed/Percentage)
3. ✅ Category selector works with all categories
4. ✅ Real-time validation displays correctly
5. ✅ Empty state displays when no splits
6. ✅ Add/remove split buttons work
7. ✅ Rules manager displays split icon and count
8. ✅ Rules page validation prevents invalid splits
9. ✅ Full theme integration with semantic CSS variables
10. ✅ Production build succeeds with zero errors
11. ✅ End-to-end flow works: rule → transaction → splits created
12. ✅ Splits appear in transaction detail view and can be edited

---

## Edge Cases to Handle

1. **Empty Splits Array:** Show empty state with clear CTA
2. **All Percentage Splits:** Show total percentage validation
3. **All Fixed Amount Splits:** Show total fixed amount summary
4. **Mixed Splits:** Show both validations
5. **Total Percentage < 100%:** Allow it, show unallocated info
6. **Total Percentage > 100%:** Prevent saving, show error
7. **Removing Last Split:** Allow it, show empty state
8. **Category Deleted:** Existing rules with deleted categories should display "[Deleted Category]" instead of crashing
9. **Large Number of Splits:** UI should scroll if needed
10. **Decimal Precision:** Use 2 decimals for fixed amounts, 1 decimal for percentages

---

## Files to Modify

### 1. `components/rules/rule-builder.tsx`
**Lines to Add:** ~300 lines
**Location:** After line 838 (after convert_to_transfer section)
**Changes:** Add complete split configuration UI

### 2. `components/rules/rules-manager.tsx`
**Lines to Modify:** ~15 lines
**Changes:**
- Import Scissors icon
- Add case to getActionLabel function
- Add icon display for create_split action type

### 3. `app/dashboard/rules/page.tsx`
**Lines to Add:** ~40 lines
**Location:** In handleSave function, in action validation section
**Changes:** Add validation for create_split actions

**Total New/Modified Lines:** ~355 lines

---

## Theme Integration Reference

All UI elements use semantic color variables from the theme system:

**Background Colors:**
- `bg-background` - Main page background
- `bg-card` - Card/surface background (empty state)
- `bg-elevated` - Split item cards, hover states
- `bg-input` - Input field backgrounds

**Text Colors:**
- `text-foreground` - Primary text
- `text-muted-foreground` - Secondary/helper text

**Border Colors:**
- `border-border` - All borders and dividers

**State Colors:**
- `text-[var(--color-primary)]` - Primary actions (pink)
- `bg-[var(--color-primary)]` - Selected buttons (pink)
- `text-[var(--color-error)]` - Error states (red/rose)
- `bg-[var(--color-error)]/10` - Error backgrounds
- `text-[var(--color-success)]` - Success states (green/turquoise)
- `bg-[var(--color-success)]/10` - Success backgrounds
- `text-[var(--color-warning)]` - Warning states (amber)

**Icons Used:**
- Scissors - Main split action icon
- Plus - Add split button
- X - Remove split button
- Tag - Category indicators
- DollarSign - Fixed amount indicator
- Percent - Percentage indicator
- Lightbulb - Information/tips
- AlertCircle - Warnings and empty states

---

## Risk Mitigation

**High-Risk Areas:**

1. **Complex Nested State Management:** Multiple splits with multiple fields
   - **Mitigation:** Helper functions already implemented (addSplit, removeSplit, updateSplitField)

2. **Real-time Validation:** Calculating totals while user types
   - **Mitigation:** Use computed values in render, don't store in state

3. **Theme Variables:** Ensuring all colors use CSS variables
   - **Mitigation:** Reference guide above, test with both themes

**Rollback Plan:**

If critical issues arise:
1. Comment out split configuration UI section
2. Remove "create_split" from action type selector temporarily
3. Backend remains functional for existing rules
4. Fix issues and re-enable

---

## Next Steps After Completion

Once this feature is complete:

1. **User Documentation:** Add to docs folder explaining how to use split rules
2. **Unit Tests:** Add tests for split validation logic
3. **Integration Tests:** Test rule creation → transaction → splits
4. **Priority 4 Feature:** Move to "Set Account Action" (next in Phase 2 plan)

---

## Ready to Start! 🚀

This plan provides complete specifications for finishing the Split Transaction UI. The implementation is straightforward since:
- ✅ Backend is 100% complete and tested
- ✅ Helper functions are already implemented
- ✅ Categories and accounts data is already fetched
- ✅ Theme system is well-established
- ✅ Similar patterns exist in convert_to_transfer section

Let's complete this feature!

**First Command:**
```bash
# Verify current implementation
grep -n "create_split" components/rules/rule-builder.tsx

# Then start implementing
```
