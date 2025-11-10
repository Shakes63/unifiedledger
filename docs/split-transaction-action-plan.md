# Split Transaction Action - Implementation Plan
## Phase 2, Priority 3 - Complete Implementation

**Status:** Planning Complete - Ready for Implementation
**Priority:** 3 of 5 in Phase 2
**Estimated Time:** 6-8 hours (3 hours backend, 4 hours UI, 1 hour testing)
**Date:** 2025-11-10

---

## Overview

This plan covers the complete implementation of the "Create Split" rule action, which allows rules to automatically split transactions across multiple categories. This is a complex action that requires both backend post-creation logic and a sophisticated UI for configuring multiple splits with amounts/percentages.

---

## Background & Context

### What is Split Transaction Action?

This action allows rules to automatically create transaction splits when conditions match. For example:
- A rule could detect "Costco" and auto-split into Groceries (60%), Household (20%), and Entertainment (20%)
- A rule could detect "Utility Bill" and split into fixed amounts across different categories
- A rule could detect "Business Trip" and split expenses into Travel, Meals, and Lodging

### Existing Split System

The application already has a complete split system:
- ✅ `transactionSplits` table with categoryId, amount, percentage, description
- ✅ Full CRUD API (`app/api/transactions/[id]/splits/route.ts`)
- ✅ Split editor components in the UI
- ✅ Percentage and fixed amount support
- ✅ Sort order management
- ✅ Validation for total amounts

**We're leveraging this existing infrastructure!**

---

## Backend Implementation

### Task 1: Split Action Executor

**File:** `lib/rules/actions-executor.ts`
**Estimated Time:** 1 hour

**Action Configuration Schema:**
```typescript
{
  type: 'create_split',
  config: {
    splits: [
      {
        categoryId: string,
        amount?: number,           // Fixed amount
        percentage?: number,        // Percentage of total (1-100)
        isPercentage: boolean,
        description?: string,
      }
    ]
  }
}
```

**Implementation Steps:**

1. Add `executeCreateSplitAction` function
2. Validate split configuration:
   - At least one split
   - Total percentage ≤ 100% (if using percentages)
   - All categoryIds present
3. Store split request in mutations object
4. Return AppliedAction for audit trail

**Key Points:**
- This is a **post-creation action** (needs transaction ID)
- Actual split creation happens AFTER transaction is created
- Validation happens upfront to fail fast

---

### Task 2: Post-Creation Split Handler

**File:** `lib/rules/split-action-handler.ts` (NEW FILE)
**Estimated Time:** 2 hours

**Purpose:** Handle split creation AFTER transaction is created

**Key Functions:**

1. **handleSplitCreation()** - Main orchestration
   - Fetch transaction
   - Validate categories exist
   - Calculate split amounts (handle percentages)
   - Validate total ≤ transaction amount
   - Insert splits
   - Mark transaction as split

2. **calculateSplitAmounts()** - Helper
   - Convert percentages to amounts
   - Handle mixed fixed + percentage splits
   - Use Decimal.js for precision

3. **validateSplitTotal()** - Helper
   - Ensure splits don't exceed transaction amount
   - Return detailed error if over

**Error Handling:**
- Non-fatal errors (log but don't break transaction creation)
- Detailed error messages for debugging
- Rollback support if needed

---

### Task 3: API Integration

**Files:**
- `app/api/transactions/route.ts` (transaction creation)
- `app/api/rules/apply-bulk/route.ts` (bulk apply)

**Estimated Time:** 30 minutes

**Changes:**

Add post-creation check for `createSplits` in mutations:

```typescript
// After transaction insert
if (executionResult.mutations.createSplits) {
  const splitResult = await handleSplitCreation(
    userId,
    transactionId,
    executionResult.mutations.createSplits
  );

  if (!splitResult.success) {
    console.error('Split creation failed:', splitResult.error);
    // Don't fail the transaction, just log
  }
}
```

---

## Frontend Implementation

### Task 4: Add Split Action to Selector

**File:** `components/rules/rule-builder.tsx`
**Estimated Time:** 15 minutes

**Changes:**

Add to action type selector:
```tsx
<SelectItem value="create_split">
  <div className="flex items-center gap-2">
    <ScissorsIcon className="h-4 w-4" />
    Split Transaction
  </div>
</SelectItem>
```

Import ScissorsIcon from lucide-react.

---

### Task 5: Split Configuration UI

**File:** `components/rules/rule-builder.tsx`
**Estimated Time:** 3 hours

**This is the complex part!** We need to build a UI for managing multiple splits.

**UI Components:**

1. **Split List Container**
   - Shows all configured splits
   - Empty state when no splits

2. **Split Item Card** (repeatable)
   - Category selector
   - Amount type toggle (Fixed / Percentage)
   - Amount/percentage input
   - Optional description field
   - Remove button

3. **Add Split Button**
   - Creates new empty split

4. **Validation Display**
   - Show total percentage (if using percentages)
   - Warn if > 100%
   - Show total amount (if using fixed)

**Helper Functions:**

```typescript
const addSplit = (actionIndex: number) => {
  // Add new empty split to action config
};

const removeSplit = (actionIndex: number, splitIndex: number) => {
  // Remove split from action config
};

const updateSplitField = (actionIndex: number, splitIndex: number, field: string, value: any) => {
  // Update specific field in split
};
```

**Layout:**
- Each split in an elevated card with border
- Visual hierarchy with spacing
- Clear labels and helper text
- Responsive grid for larger screens

---

### Task 6: Rules Manager Display

**File:** `components/rules/rules-manager.tsx`
**Estimated Time:** 20 minutes

**Changes:**

1. Import ScissorsIcon
2. Add case to getActionLabel:
```typescript
case 'create_split':
  const splitCount = action.config?.splits?.length || 0;
  return `Split into ${splitCount} categories`;
```
3. Add icon display:
```tsx
{rule.actions[0].type === 'create_split' && <ScissorsIcon className="w-3 h-3 mr-1" />}
```

---

### Task 7: Validation

**File:** `app/dashboard/rules/page.tsx`
**Estimated Time:** 30 minutes

**Validation Rules:**

```typescript
if (action.type === 'create_split') {
  if (!action.config?.splits || action.config.splits.length === 0) {
    toast.error('Please add at least one split for create_split action');
    return;
  }

  // Validate each split
  for (const split of action.config.splits) {
    if (!split.categoryId) {
      toast.error('All splits must have a category selected');
      return;
    }

    if (split.isPercentage) {
      if (!split.percentage || split.percentage <= 0 || split.percentage > 100) {
        toast.error('Split percentages must be between 1% and 100%');
        return;
      }
    } else {
      if (!split.amount || split.amount <= 0) {
        toast.error('Split amounts must be greater than 0');
        return;
      }
    }
  }

  // Validate total percentage
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

### Phase 1: Backend Foundation (1.5 hours)
1. Create `lib/rules/split-action-handler.ts`
   - handleSplitCreation function
   - calculateSplitAmounts helper
   - validateSplitTotal helper
2. Update `lib/rules/actions-executor.ts`
   - Add executeCreateSplitAction
   - Update TransactionMutations type

### Phase 2: API Integration (30 minutes)
3. Update transaction creation API
4. Update bulk apply rules API
5. Test with Postman/curl

### Phase 3: UI Foundation (1 hour)
6. Add action type to selector
7. Add basic split configuration container
8. Add helper functions

### Phase 4: Split UI Implementation (3 hours)
9. Build split item card component
10. Implement add/remove split logic
11. Implement amount/percentage toggle
12. Add category selectors
13. Add validation display
14. Style with theme variables

### Phase 5: Integration & Testing (1 hour)
15. Update rules manager display
16. Add validation to rules page
17. Test complete flow
18. Production build verification

---

## Type Definitions

**Update `lib/rules/types.ts`:**

```typescript
interface SplitConfig {
  categoryId: string;
  amount?: number;
  percentage?: number;
  isPercentage: boolean;
  description?: string;
}

interface TransactionMutations {
  // ... existing fields
  createSplits?: SplitConfig[];
}
```

---

## Theme Integration

All UI elements will use semantic color variables:

**Colors:**
- `bg-elevated` - Split item cards
- `bg-input` - Input fields
- `border-border` - All borders
- `text-foreground` - Primary text
- `text-muted-foreground` - Helper text
- `text-[var(--color-primary)]` - Accent elements
- `text-[var(--color-warning)]` - Validation warnings

**Icons:**
- ScissorsIcon - Main action icon
- Plus - Add split button
- X - Remove split button
- Tag - Category indicators
- DollarSign - Fixed amount indicator
- Percent - Percentage indicator

---

## Testing Checklist

### Backend Testing:
- [ ] Create split with fixed amounts
- [ ] Create split with percentages
- [ ] Create split with mixed amounts/percentages
- [ ] Validate split total equals transaction amount
- [ ] Validate split total less than transaction amount (remainder)
- [ ] Validate categories exist
- [ ] Handle invalid categoryId
- [ ] Handle percentage > 100%
- [ ] Mark transaction as split
- [ ] Audit logging works

### UI Testing:
- [ ] Add split action to rule
- [ ] Add multiple splits
- [ ] Remove split
- [ ] Toggle between fixed/percentage
- [ ] Select categories
- [ ] Enter amounts/percentages
- [ ] Validation shows errors
- [ ] Empty state displays correctly
- [ ] Theme integration (Dark Mode)
- [ ] Theme integration (Dark Pink Theme)
- [ ] Save rule with splits
- [ ] Edit rule with splits
- [ ] Display in rules list

### Integration Testing:
- [ ] Create transaction matching rule with splits
- [ ] Verify splits created automatically
- [ ] Bulk apply rules with splits
- [ ] Edit transaction with splits created by rule
- [ ] Delete transaction with splits

---

## Success Criteria

This feature is complete when:

1. ✅ Backend can create splits from rule actions
2. ✅ API integration works for transaction creation
3. ✅ API integration works for bulk apply
4. ✅ UI allows configuring multiple splits
5. ✅ UI supports both fixed amounts and percentages
6. ✅ Validation prevents invalid configurations
7. ✅ Rules manager displays split action correctly
8. ✅ Splits appear in rules list with icon
9. ✅ Full theme integration with semantic variables
10. ✅ Production build succeeds with zero errors
11. ✅ End-to-end flow works: rule creation → transaction → splits created
12. ✅ Splits appear in transaction detail view

---

## Edge Cases to Handle

1. **Remainder Handling:** What if splits total 95%? → Allow it (user may want remainder)
2. **Zero Splits:** What if user removes all splits? → Validation prevents saving
3. **Duplicate Categories:** What if user selects same category twice? → Allow it (could be intentional)
4. **Transaction Amount Changes:** If transaction amount edited, splits remain? → Yes (existing behavior)
5. **Split Deletion:** Can user delete splits created by rule? → Yes (manual override allowed)
6. **Percentage Precision:** How many decimals? → Support 0.1% precision
7. **Currency Precision:** Round to 2 decimals? → Yes, using Decimal.js

---

## Future Enhancements (Not in Scope)

These are good ideas but NOT part of this implementation:

- ⏳ Split templates (save common split configurations)
- ⏳ Proportional adjustment if total < 100% (e.g., 80% → auto-scale to 100%)
- ⏳ Category groups (split among all categories in a group)
- ⏳ Conditional splits (if amount > X, split differently)
- ⏳ Smart defaults (pre-populate based on transaction amount)
- ⏳ Visual preview of split breakdown (pie chart)

---

## Risk Mitigation

**High-Risk Areas:**

1. **Percentage Calculations:** Floating-point errors
   - **Mitigation:** Use Decimal.js everywhere

2. **Split Total Validation:** Edge cases with mixed amounts/percentages
   - **Mitigation:** Comprehensive unit tests

3. **UI Complexity:** Managing multiple dynamic splits
   - **Mitigation:** Clear state management, helper functions

**Rollback Plan:**

If critical issues arise:
1. Disable split action in UI (remove from selector)
2. Backend remains functional for manual splits
3. Fix issues and re-enable

---

## Files to Create/Modify

### New Files:
1. `lib/rules/split-action-handler.ts` (~200 lines)

### Modified Files:
1. `lib/rules/actions-executor.ts` (~50 lines added)
2. `lib/rules/types.ts` (~10 lines added)
3. `components/rules/rule-builder.tsx` (~300 lines added)
4. `components/rules/rules-manager.tsx` (~15 lines modified)
5. `app/dashboard/rules/page.tsx` (~30 lines added)
6. `app/api/transactions/route.ts` (~10 lines added)
7. `app/api/rules/apply-bulk/route.ts` (~10 lines added)

**Total New/Modified Lines:** ~625 lines

---

## Ready to Start! 🚀

This plan provides complete specifications for implementing the Split Transaction action. The implementation will be done in 5 phases with clear milestones and testing at each stage.

**Next Command:**
```bash
pnpm dev  # Start development server for testing
```

Let's build this feature!
