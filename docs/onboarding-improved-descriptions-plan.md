# Onboarding: Improved Step Descriptions

## Overview

Enhance the descriptions in each onboarding step to highlight specific feature capabilities, automation benefits, and convenience features. The goal is to make each step's value proposition immediately clear to new users.

**Feature Request:** Enhance descriptions with feature highlights (e.g., "auto-matches transactions to bills", "sends reminders before due dates")

## Current State Analysis

Each onboarding step has two places for descriptive content:
1. **Description** - Shown below the step title in the header (via `OnboardingStep` component's `description` prop)
2. **WhyThisMatters** - Benefits list with checkmark icons (already has good feature highlights)

### Current Descriptions Review

| Step | Current Description | Quality |
|------|---------------------|---------|
| Welcome | "Let's get you started with a quick tour of the app's core features." | Generic |
| Household | "Households let you organize finances and collaborate with family - each with their own activity feed and permissions." | Good |
| Account | "Connect all your accounts to see your complete financial picture in one dashboard." | Needs improvement |
| Category | "Categories help you track where your money goes and set budgets to stay on track." | Generic |
| Transaction | "Track every dollar with smart categorization and powerful spending insights." | OK |
| Bill | "Never miss a payment - bills auto-match transactions and send reminders before due dates." | Excellent - model |
| Goal | "Watch your savings grow with progress tracking and celebrate when you hit milestones." | Good |
| Debt | "Get a clear payoff timeline with interest calculations and debt-free projections." | Good |

**Best Example:** The Bill step description is ideal - it leads with the user benefit ("Never miss a payment") and then mentions specific automation features ("auto-match transactions", "send reminders").

## Implementation Plan

### Task 1: Define Enhanced Descriptions

Create improved descriptions that follow the Bill step pattern:
- **Lead with user benefit** - What problem does this solve?
- **Highlight automation** - What does the app do automatically?
- **Mention key features** - 1-2 specific capabilities

#### New Descriptions

| Step | New Description |
|------|-----------------|
| Welcome (non-invited) | "Set up your finances in minutes with smart automation that learns your spending habits." |
| Welcome (invited) | "Practice with demo data before working with real finances - all demo items are clearly marked." |
| Household | "Keep finances separate or collaborate with family - share data while maintaining role-based privacy controls." |
| Account | "Track all balances in one place with automatic transfer detection and credit utilization alerts." |
| Category | "Organize spending with auto-categorization that learns from your patterns and budget warnings when limits approach." |
| Transaction | "Record spending with smart suggestions that auto-fill categories and merchants based on your history." |
| Bill | (Keep current - already excellent) "Never miss a payment - bills auto-match transactions and send reminders before due dates." |
| Goal | "Track savings progress with visual milestones at 25%, 50%, 75% and automatic achievement celebrations." |
| Debt | "See your debt-free date with interest projections and compare payoff strategies like snowball vs avalanche." |

### Task 2: Create Feature Highlight Component (Optional Enhancement)

Consider creating a small "feature chip" or inline highlight component that can be used in descriptions to visually emphasize automation features. This would use the theme's `--color-primary` with low opacity for background.

**Decision:** Skip this for now - the description text improvement alone will provide significant value without adding UI complexity.

### Task 3: Update Welcome Step (`welcome-step.tsx`)

**File:** `components/onboarding/steps/welcome-step.tsx`

**Changes:**
- Line 26-29: Update description for both invited and non-invited users
- The description should set the tone for the entire onboarding experience

### Task 4: Update Household Step (`create-household-step.tsx`)

**File:** `components/onboarding/steps/create-household-step.tsx`

**Changes:**
- Line 112: Update description to emphasize privacy controls and collaboration features

### Task 5: Update Account Step (`create-account-step.tsx`)

**File:** `components/onboarding/steps/create-account-step.tsx`

**Changes:**
- Line 86: Update description to highlight automatic features (transfer detection, utilization alerts)

### Task 6: Update Category Step (`create-category-step.tsx`)

**File:** `components/onboarding/steps/create-category-step.tsx`

**Changes:**
- Line 96: Update description to emphasize auto-categorization learning and budget warnings

### Task 7: Update Transaction Step (`create-transaction-step.tsx`)

**File:** `components/onboarding/steps/create-transaction-step.tsx`

**Changes:**
- Line 88: Update description to highlight smart suggestions for auto-fill

### Task 8: Update Goal Step (`create-goal-step.tsx`)

**File:** `components/onboarding/steps/create-goal-step.tsx`

**Changes:**
- Line 86: Update description to mention visual milestones and celebrations

### Task 9: Update Debt Step (`create-debt-step.tsx`)

**File:** `components/onboarding/steps/create-debt-step.tsx`

**Changes:**
- Line 86: Update description to mention debt-free date projection and strategy comparison

### Task 10: Verify Demo Mode Descriptions

Review and update the demo mode auto-advance descriptions to be consistent:

**Files to check:**
- `create-account-step.tsx` (line 65)
- `create-category-step.tsx` (line 75)
- `create-bill-step.tsx` (line 65)
- `create-goal-step.tsx` (line 65)
- `create-debt-step.tsx` (line 65)
- `create-transaction-step.tsx` (line 67)

These should maintain consistency with the new enhanced descriptions.

## Styling Guidelines

All descriptions use the existing theme variables:
- Text color: `text-muted-foreground` (already applied via `OnboardingStep`)
- Font size: `text-sm` (already applied)
- Max width: Inherited from container

No new CSS variables or styling changes needed - just text content updates.

## Testing Checklist

- [ ] Open onboarding as new user (non-invited flow)
- [ ] Verify all 9 step descriptions display correctly
- [ ] Check character limits don't cause overflow on mobile (max ~120 chars recommended)
- [ ] Open onboarding as invited user (demo mode flow)
- [ ] Verify demo mode descriptions are consistent
- [ ] Test with all 7 themes to ensure text remains readable

## Files Modified

1. `components/onboarding/steps/welcome-step.tsx`
2. `components/onboarding/steps/create-household-step.tsx`
3. `components/onboarding/steps/create-account-step.tsx`
4. `components/onboarding/steps/create-category-step.tsx`
5. `components/onboarding/steps/create-transaction-step.tsx`
6. `components/onboarding/steps/create-goal-step.tsx`
7. `components/onboarding/steps/create-debt-step.tsx`

**Bill step not modified** - already has excellent description.

## Estimated Time

- Task 1 (Define descriptions): Complete (in this document)
- Tasks 3-9 (Update step files): ~30 minutes
- Task 10 (Demo mode consistency): ~15 minutes
- Testing: ~15 minutes

**Total: ~1 hour**

## Success Criteria

1. All descriptions follow the pattern: "Benefit + automation feature + specific capability"
2. Descriptions are concise (under 120 characters where possible)
3. Feature highlights are specific, not generic
4. Demo mode descriptions maintain consistency
5. All themes display descriptions readably

