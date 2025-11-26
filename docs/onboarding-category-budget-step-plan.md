# Onboarding: Category/Budget Step - Implementation Plan

## Overview

Add a new step to the onboarding flow for setting up categories and understanding budgets before transaction creation. This step will help users understand how categories work and optionally create their first custom category with a budget.

## Current Step Order

### Non-Demo Users (8 steps)
1. Welcome
2. Household
3. Account
4. Bill
5. Goal
6. Debt
7. Transaction
8. Complete

### Demo Users (9 steps)
1. Welcome
2. Demo Data Creation
3. Account
4. Bill
5. Goal
6. Debt
7. Transaction
8. Demo Data Choice
9. Complete

## New Step Order

### Non-Demo Users (9 steps)
1. Welcome
2. Household
3. Account
4. **Category/Budget (NEW)**
5. Bill (was 4)
6. Goal (was 5)
7. Debt (was 6)
8. Transaction (was 7)
9. Complete (was 8)

### Demo Users (10 steps)
1. Welcome
2. Demo Data Creation
3. Account
4. **Category/Budget (NEW)** - auto-advances since demo categories exist
5. Bill (was 4)
6. Goal (was 5)
7. Debt (was 6)
8. Transaction (was 7)
9. Demo Data Choice (was 8)
10. Complete (was 9)

## Implementation Plan

### Phase 1: Create Category/Budget Step Component
**File:** `components/onboarding/steps/create-category-step.tsx`

**Features:**
- Show explanation of how categories work
- Display different category types (income, expense, bill, etc.)
- Explain budgets and how they help track spending
- Pre-filled example category (e.g., "Groceries" with $500 budget)
- Uses CategoryForm component for creation
- For demo mode: auto-advance (demo categories already created)
- WhyThisMatters component with educational benefits

**Educational Content:**
- Categories organize your spending into trackable groups
- Budgets help you stay on track with spending limits
- The system learns your spending patterns over time
- You can set up more categories later from the dashboard

### Phase 2: Update Step Constants
**File:** `contexts/onboarding-context.tsx`

**Changes:**
- Update `TOTAL_STEPS_NON_DEMO` from 8 to 9
- Update `TOTAL_STEPS_DEMO` from 9 to 10
- Update comment to reflect new step order

### Phase 3: Update Onboarding Modal
**File:** `components/onboarding/onboarding-modal.tsx`

**Changes:**
- Import CreateCategoryStep component
- Add case 4 for CreateCategoryStep
- Renumber all subsequent cases (Bill becomes 5, Goal becomes 6, etc.)
- Update complete step case numbers

### Phase 4: Update Step Numbers in Existing Components
Update `stepNumber` prop in all step components:

| Component | Old Step | New Step |
|-----------|----------|----------|
| CreateBillStep | 4 | 5 |
| CreateGoalStep | 5 | 6 |
| CreateDebtStep | 6 | 7 |
| CreateTransactionStep | 7 | 8 |
| CompleteStep | 8/9 | 9/10 |
| DemoDataChoiceStep | 8 | 9 |

---

## Component Specification

### CreateCategoryStep Component

```tsx
interface CreateCategoryStepProps {
  onNext: () => void;
  onPrevious: () => void;
  onSkip?: () => void;
  canSkip: boolean;
}
```

**UI Design:**
```
┌─────────────────────────────────────────────────────────────┐
│                    [Icon: FolderTree]                       │
│                                                             │
│            Organize Your Spending                           │
│                                                             │
│  Categories help you track where your money goes and        │
│  set budgets to stay on track.                             │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  💡 Why This Matters                                │   │
│  │                                                     │   │
│  │  ✓ Group similar expenses for easy tracking        │   │
│  │  ✓ Set spending limits and get alerts when close   │   │
│  │  ✓ See spending trends and patterns over time      │   │
│  │  ✓ Auto-categorization learns from your habits     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  We've pre-filled an example category. Modify it    │   │
│  │  or create your own spending category with a        │   │
│  │  monthly budget.                                    │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  [CategoryForm - simplified version]                │   │
│  │  - Category Name: Groceries                         │   │
│  │  - Type: Variable Expense                           │   │
│  │  - Monthly Budget: $500                             │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Common Categories:                                 │   │
│  │  Groceries • Dining Out • Transportation • Utilities│   │
│  │  Entertainment • Shopping • Healthcare              │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  [← Previous]                              [Skip]  [Next →] │
└─────────────────────────────────────────────────────────────┘
```

---

## Educational Content

### Why This Matters Benefits
1. Group similar expenses for easy tracking
2. Set spending limits and get alerts when close
3. See spending trends and patterns over time
4. Auto-categorization learns from your habits

### Category Types Explanation
- **Income**: Money coming in (salary, freelance, gifts)
- **Variable Expense**: Spending that varies (groceries, dining, shopping)
- **Monthly Bill**: Fixed recurring expenses (rent, utilities, subscriptions)
- **Savings**: Money set aside for goals
- **Debt**: Payments toward debt reduction

---

## Step-by-Step Implementation Order

1. **Step 1:** Create `create-category-step.tsx` component
2. **Step 2:** Update `onboarding-context.tsx` constants
3. **Step 3:** Update `onboarding-modal.tsx` with new step
4. **Step 4:** Update step numbers in `create-bill-step.tsx`
5. **Step 5:** Update step numbers in `create-goal-step.tsx`
6. **Step 6:** Update step numbers in `create-debt-step.tsx`
7. **Step 7:** Update step numbers in `create-transaction-step.tsx`
8. **Step 8:** Update step numbers in `complete-step.tsx`
9. **Step 9:** Update step numbers in `demo-data-choice-step.tsx`
10. **Step 10:** Update features.md to mark as complete

---

## Files to Create/Modify

### New Files
- `components/onboarding/steps/create-category-step.tsx`

### Modified Files
- `contexts/onboarding-context.tsx` - Update step counts
- `components/onboarding/onboarding-modal.tsx` - Add new step case
- `components/onboarding/steps/create-bill-step.tsx` - stepNumber 4→5
- `components/onboarding/steps/create-goal-step.tsx` - stepNumber 5→6
- `components/onboarding/steps/create-debt-step.tsx` - stepNumber 6→7
- `components/onboarding/steps/create-transaction-step.tsx` - stepNumber 7→8
- `components/onboarding/steps/complete-step.tsx` - stepNumber 8→9
- `components/onboarding/steps/demo-data-choice-step.tsx` - stepNumber 8→9
- `docs/features.md` - Mark feature as complete

---

## Estimated Time: 1.5-2 hours

