# Demo Data Choice at End of Onboarding - Implementation Plan

## Overview

Add an option for invited users to choose whether to "Keep Demo Data" or "Clear Demo Data and Start Fresh" before completing onboarding. This gives users control over whether to keep the sample data for learning purposes or start with a clean slate.

## Current State Analysis

### Existing Components
- **OnboardingContext** (`contexts/onboarding-context.tsx`): Manages onboarding state, including `isInvitedUser` and `isDemoMode` flags
- **OnboardingModal** (`components/onboarding/onboarding-modal.tsx`): Renders steps based on `currentStep` and `isDemoMode`
- **CreateDemoDataStep** (`components/onboarding/steps/create-demo-data-step.tsx`): Creates demo data for invited users (step 2)
- **CompleteStep** (`components/onboarding/steps/complete-step.tsx`): Final step showing completion
- **Demo Data Generator** (`lib/onboarding/demo-data-generator.ts`): Creates demo accounts, categories, merchants, bills, goals, debts, and transactions - all prefixed with "Demo"

### Demo Data Pattern
All demo data is prefixed with "Demo" in the name field, making it easy to identify and delete:
- Accounts: "Demo Checking", "Demo Savings", "Demo Credit Card"
- Categories: "Demo Groceries", "Demo Utilities", etc.
- Merchants: "Demo Grocery Store", "Demo Coffee Shop", etc.
- Bills: "Demo Rent", "Demo Internet", "Demo Phone"
- Goals: "Demo Vacation Fund", "Demo Emergency Fund"
- Debts: "Demo Credit Card"
- Transactions: All linked to demo accounts/categories/merchants

## Implementation Plan

### Phase 1: Backend - Clear Demo Data API Endpoint
**File:** `app/api/onboarding/clear-demo-data/route.ts`

**Tasks:**
1. Create new API endpoint `POST /api/onboarding/clear-demo-data`
2. Accept `householdId` in request body
3. Verify user is authenticated and member of household
4. Delete demo data in dependency order (transactions first, then bills, debts, goals, merchants, categories, accounts)
5. Return summary of deleted items
6. Handle errors gracefully

**Delete Order (respecting foreign key constraints):**
1. Transactions (references accounts, categories, merchants)
2. Bills (references accounts, categories, merchants)
3. Debts (references accounts, categories)
4. Savings Goals (references accounts)
5. Merchants (references categories)
6. Budget Categories
7. Accounts

### Phase 2: Backend - Demo Data Cleaner Utility
**File:** `lib/onboarding/demo-data-cleaner.ts`

**Tasks:**
1. Create utility function `clearDemoData(householdId: string, userId: string)`
2. Query and delete all records with name starting with "Demo" or "Demo " prefix
3. Use database transactions for atomicity
4. Return detailed count of deleted items
5. Log operations for debugging

### Phase 3: Frontend - Demo Data Choice Step Component
**File:** `components/onboarding/steps/demo-data-choice-step.tsx`

**Tasks:**
1. Create new step component for demo data choice
2. Display two prominent option cards:
   - "Keep Demo Data" - Keep sample data to practice and explore
   - "Start Fresh" - Clear all demo data and begin with empty accounts
3. Show summary of what demo data exists (from context or API)
4. Use proper theme variables for styling:
   - Background: `bg-background`, `bg-card`, `bg-elevated`
   - Text: `text-foreground`, `text-muted-foreground`
   - Borders: `border-border`
   - Primary actions: `bg-[var(--color-primary)]`, `text-background`
   - Secondary info: `text-[var(--color-success)]`, `text-[var(--color-warning)]`
5. Handle loading states while clearing data
6. Show success/error feedback with toast notifications
7. Auto-advance to complete step after choice is made

### Phase 4: Update Onboarding Flow
**Files:**
- `contexts/onboarding-context.tsx`
- `components/onboarding/onboarding-modal.tsx`

**Tasks:**
1. Update `TOTAL_STEPS` from 8 to 9 (add demo data choice step before complete)
2. Add new step rendering logic in `onboarding-modal.tsx`:
   - Step 7 remains Transaction step
   - Step 8 becomes Demo Data Choice step (only for `isDemoMode`)
   - Step 9 becomes Complete step
3. For non-invited users, skip step 8 (demo choice) automatically
4. Update context to track whether demo data was kept or cleared

### Phase 5: Update Complete Step
**File:** `components/onboarding/steps/complete-step.tsx`

**Tasks:**
1. Accept new prop for whether demo data was cleared
2. Adjust messaging based on user's choice:
   - If kept: "Demo data is available for you to explore!"
   - If cleared: "You're starting fresh with a clean slate!"
3. Update tips section accordingly

### Phase 6: Testing

**Manual Testing Checklist:**
1. Create invitation, accept as new user
2. Complete onboarding until demo data choice step
3. Test "Keep Demo Data" option - verify data remains
4. Test "Start Fresh" option - verify all demo data is deleted
5. Verify account balances are correct after deletion
6. Verify no orphaned records remain
7. Test error handling (network failure during deletion)
8. Test UI on mobile viewport sizes

---

## Detailed Component Specifications

### Demo Data Choice Step UI Design

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Step 8 of 9                    [Progress bar]      │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ════════════════════════════════════════════════════════  │
│                                                             │
│            What Would You Like to Do?                       │
│                                                             │
│    You have demo data set up to help you learn the app.    │
│    Choose whether to keep it or start fresh.               │
│                                                             │
│  ┌──────────────────────┐  ┌──────────────────────┐       │
│  │                      │  │                      │       │
│  │   📊 Keep Demo      │  │   ✨ Start Fresh     │       │
│  │        Data         │  │                      │       │
│  │                      │  │                      │       │
│  │  Practice with       │  │  Clear all demo     │       │
│  │  sample accounts,    │  │  data and begin     │       │
│  │  transactions, and   │  │  with a clean       │       │
│  │  bills.              │  │  slate.             │       │
│  │                      │  │                      │       │
│  │  [Selected ✓]        │  │  [Select]           │       │
│  │                      │  │                      │       │
│  └──────────────────────┘  └──────────────────────┘       │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Demo Data Summary:                                  │   │
│  │  • 3 accounts  • 5 categories  • 14 transactions    │   │
│  │  • 3 bills     • 2 goals       • 1 debt             │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ════════════════════════════════════════════════════════  │
│                                                             │
│  [← Previous]                              [Continue →]    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Styling Requirements

Use these theme variables consistently:

```tsx
// Backgrounds
className="bg-background"        // Main background
className="bg-card"              // Card surfaces
className="bg-elevated"          // Elevated/hover states

// Text
className="text-foreground"      // Primary text
className="text-muted-foreground" // Secondary text

// Borders
className="border-border"        // All borders

// Interactive States
className="bg-[var(--color-primary)]"  // Primary buttons
className="text-background"           // Text on primary buttons
className="hover:opacity-90"          // Hover state

// Semantic Colors
className="text-[var(--color-success)]"  // Success indicators
className="text-[var(--color-warning)]"  // Warning indicators
className="text-[var(--color-error)]"    // Error states

// Selection States (for option cards)
// Selected: border-[var(--color-primary)] bg-[var(--color-primary)]/10
// Unselected: border-border hover:border-[var(--color-primary)]/50
```

---

## API Endpoint Specification

### POST /api/onboarding/clear-demo-data

**Request:**
```json
{
  "householdId": "string (required)"
}
```

**Response (Success):**
```json
{
  "success": true,
  "deleted": {
    "transactions": 14,
    "bills": 3,
    "debts": 1,
    "goals": 2,
    "merchants": 6,
    "categories": 5,
    "accounts": 3
  }
}
```

**Response (Error):**
```json
{
  "error": "Error message",
  "code": "ERROR_CODE"
}
```

**Error Codes:**
- `UNAUTHORIZED` - User not authenticated
- `FORBIDDEN` - User not member of household
- `INVALID_HOUSEHOLD` - Household ID missing or invalid
- `DELETE_FAILED` - Database operation failed

---

## Step-by-Step Implementation Order

1. **Step 1:** Create `lib/onboarding/demo-data-cleaner.ts` utility
2. **Step 2:** Create `app/api/onboarding/clear-demo-data/route.ts` API endpoint
3. **Step 3:** Create `components/onboarding/steps/demo-data-choice-step.tsx` component
4. **Step 4:** Update `contexts/onboarding-context.tsx` to add step and track choice
5. **Step 5:** Update `components/onboarding/onboarding-modal.tsx` to include new step
6. **Step 6:** Update `components/onboarding/steps/complete-step.tsx` for dynamic messaging
7. **Step 7:** Manual testing of complete flow
8. **Step 8:** Update features.md to mark as complete

---

## Files to Create/Modify

### New Files
- `lib/onboarding/demo-data-cleaner.ts`
- `app/api/onboarding/clear-demo-data/route.ts`
- `components/onboarding/steps/demo-data-choice-step.tsx`

### Modified Files
- `contexts/onboarding-context.tsx` - Add `demoDataCleared` state, update TOTAL_STEPS
- `components/onboarding/onboarding-modal.tsx` - Add step 8 rendering
- `components/onboarding/steps/complete-step.tsx` - Dynamic messaging
- `docs/features.md` - Mark feature as complete

---

## Estimated Time: 2-3 hours

