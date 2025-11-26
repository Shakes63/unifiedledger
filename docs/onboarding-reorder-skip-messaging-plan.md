# Onboarding: Reorder Steps & Clear Skip Messaging - Implementation Plan

## Overview

This plan combines two related features:
1. **Reorder Steps** - Move Transaction step earlier (after Category), making Bill/Goal/Debt optional
2. **Clear Skip Messaging** - Change "Skip" to "Set Up Later" with reassurance messaging

## Current Step Order

1. Welcome
2. Household (or DemoData for invited users)
3. Account
4. Category
5. Bill
6. Goal
7. Debt
8. Transaction
9. Complete (or DemoDataChoice for demo)
10. Complete (demo only)

## New Step Order

1. Welcome
2. Household (or DemoData for invited users)
3. Account
4. Category
5. **Transaction** (moved from 8) - Core essentials complete!
6. **Bill** (optional - "Set Up Later")
7. **Goal** (optional - "Set Up Later")
8. **Debt** (optional - "Set Up Later")
9. Complete (or DemoDataChoice for demo)
10. Complete (demo only)

## Rationale

The new order creates two logical groups:

**Essential Steps (1-5):**
- Welcome → Household → Account → Category → Transaction
- These are the minimum needed to start using the app

**Optional Advanced Features (6-8):**
- Bill → Goal → Debt
- These enhance the experience but aren't required to get started
- Can be "Set Up Later" from the dashboard

## Implementation Plan

### Phase 1: Update OnboardingStep Component
**File:** `components/onboarding/onboarding-step.tsx`

**Changes:**
1. Add new props: `skipLabel` and `skipDescription`
2. Change default skip button text from "Skip" to "Set Up Later"
3. Add optional reassurance tooltip/text below skip button

### Phase 2: Reorder Steps in Modal
**File:** `components/onboarding/onboarding-modal.tsx`

**Changes:**
- Move Transaction from case 8 to case 5
- Shift Bill, Goal, Debt to cases 6, 7, 8
- Update step numbers accordingly

### Phase 3: Update Step Numbers in Components
Update `stepNumber` prop in step components:

| Component | Current Step | New Step |
|-----------|-------------|----------|
| CreateTransactionStep | 8 | 5 |
| CreateBillStep | 5 | 6 |
| CreateGoalStep | 6 | 7 |
| CreateDebtStep | 7 | 8 |

### Phase 4: Add "Optional" Badge to Bill/Goal/Debt Steps
**Files:** 
- `create-bill-step.tsx`
- `create-goal-step.tsx`
- `create-debt-step.tsx`

**Changes:**
- Add visual "Optional" badge in step header
- Update descriptions to mention "Set Up Later" option
- Pass custom skipLabel prop

### Phase 5: Update Welcome Step Content
**File:** `components/onboarding/steps/welcome-step.tsx`

**Changes:**
- Update the step list to show new order
- Mark Bill/Goal/Debt as "(Optional)" in the list

---

## Component Specifications

### OnboardingStep Updates

```tsx
interface OnboardingStepProps {
  // ... existing props
  skipLabel?: string;        // Default: "Set Up Later"
  skipDescription?: string;  // Optional tooltip/text
  isOptional?: boolean;      // Shows "Optional" badge
}
```

### Skip Button Design
```
┌─────────────────────────────────┐
│  Set Up Later                   │
│  ────────────────────────────   │
│  You can access this from the   │
│  dashboard menu anytime.        │
└─────────────────────────────────┘
```

### Optional Badge Design
```
┌─────────────────────────────────────────┐
│  Set Up Your First Bill      [Optional] │
│                                         │
│  Never miss a payment - bills auto-     │
│  match transactions and send reminders  │
│  before due dates.                      │
└─────────────────────────────────────────┘
```

---

## Step-by-Step Implementation Order

1. **Step 1:** Update OnboardingStep with new props (skipLabel, skipDescription, isOptional)
2. **Step 2:** Update onboarding-modal.tsx to reorder steps
3. **Step 3:** Update CreateTransactionStep stepNumber (8 → 5)
4. **Step 4:** Update CreateBillStep (stepNumber 5 → 6, add isOptional, skipLabel)
5. **Step 5:** Update CreateGoalStep (stepNumber 6 → 7, add isOptional, skipLabel)
6. **Step 6:** Update CreateDebtStep (stepNumber 7 → 8, add isOptional, skipLabel)
7. **Step 7:** Update welcome-step.tsx to reflect new order
8. **Step 8:** Update features.md to mark both features as complete

---

## Files to Modify

- `components/onboarding/onboarding-step.tsx` - Add new props
- `components/onboarding/onboarding-modal.tsx` - Reorder cases
- `components/onboarding/steps/welcome-step.tsx` - Update step list
- `components/onboarding/steps/create-transaction-step.tsx` - stepNumber 8 → 5
- `components/onboarding/steps/create-bill-step.tsx` - stepNumber 5 → 6, add optional props
- `components/onboarding/steps/create-goal-step.tsx` - stepNumber 6 → 7, add optional props
- `components/onboarding/steps/create-debt-step.tsx` - stepNumber 7 → 8, add optional props
- `docs/features.md` - Mark features as complete

---

## Estimated Time: 1-1.5 hours

