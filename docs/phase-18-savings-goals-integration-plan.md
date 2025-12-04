# Phase 18: Savings-Goals Integration - Implementation Plan

## Overview
This phase integrates savings goals with the transaction system, allowing users to track contributions to goals through transfers and transactions, split contributions across multiple goals, and view savings rate metrics.

## Current State Analysis

### Already Implemented (Phase 1.5)
- `savingsGoalId` field exists in `transactions` table
- Index `idx_transactions_savings_goal` exists
- Savings goals CRUD (API, form, page) fully functional
- Goals dashboard widget (`savings-goals-widget.tsx`)
- Manual "Add Contribution" button in GoalTracker (updates `currentAmount` directly)
- Goals have `accountId` field for linking to accounts

### What Needs Implementation
1. Link savings transfers to goals via UI and API
2. Split contributions across multiple goals
3. Auto-categorize transfers to savings accounts
4. Enhanced savings dashboard widget
5. Savings rate tracking

---

## Implementation Tasks

### Task 1: Goal Selector Component
**File:** `components/transactions/goal-selector.tsx`

Create a reusable component for selecting savings goal(s) in transaction forms.

**Features:**
- Dropdown to select single or multiple goals
- Shows goal progress (current/target)
- Shows linked account if any
- Filter by active goals only
- Option to split amount across goals

**Interface:**
```typescript
interface GoalSelectorProps {
  selectedGoalId?: string | null;
  selectedGoalIds?: string[];
  multiSelect?: boolean;
  accountId?: string; // Filter goals linked to this account
  onChange: (goalId: string | null) => void;
  onMultiChange?: (goalIds: string[], amounts?: Record<string, number>) => void;
  amount?: number; // For calculating split amounts
}
```

---

### Task 2: Update Transaction Form for Goal Selection
**Files:**
- `components/transactions/transaction-form.tsx`
- `components/transactions/quick-transaction-modal.tsx`

**Changes:**
1. Add GoalSelector component below account selector for transfer types
2. Show goal selector when:
   - Transaction type is `transfer` AND destination account type is `savings`
   - OR any transaction with an account that has linked goals
3. Auto-suggest goal based on destination account's `accountId` match in goals
4. Store selected `savingsGoalId` in form state

**UI Flow:**
1. User selects transfer to savings account
2. System checks for goals linked to that account
3. If goals found, show "Link to Savings Goal" section
4. User can select goal(s) and optionally split contribution

---

### Task 3: Update Transaction API for Goal Linking
**Files:**
- `app/api/transactions/route.ts` (POST)
- `app/api/transactions/[id]/route.ts` (PUT)

**Changes:**
1. Accept `savingsGoalId` in request body
2. Accept `goalContributions` for split contributions: `{ goalId: string, amount: number }[]`
3. On transaction save:
   - Update `savingsGoalId` on transaction
   - For split contributions, update each goal's `currentAmount`
   - Check for milestone achievements
4. On transaction delete/update:
   - Adjust goal `currentAmount` accordingly

---

### Task 4: Savings Goal Contributions Table
**File:** `lib/db/schema.ts`

Create new table to track split contributions:

```typescript
export const savingsGoalContributions = sqliteTable(
  'savings_goal_contributions',
  {
    id: text('id').primaryKey(),
    transactionId: text('transaction_id').notNull(),
    goalId: text('goal_id').notNull(),
    userId: text('user_id').notNull(),
    householdId: text('household_id').notNull(),
    amount: real('amount').notNull(),
    createdAt: text('created_at').default(new Date().toISOString()),
  },
  (table) => ({
    transactionIdx: index('idx_goal_contributions_transaction').on(table.transactionId),
    goalIdx: index('idx_goal_contributions_goal').on(table.goalId),
    userHouseholdIdx: index('idx_goal_contributions_user_household').on(table.userId, table.householdId),
  })
);
```

**Migration:** `drizzle/00XX_add_savings_goal_contributions.sql`

---

### Task 5: Auto-Detection for Savings Transfers
**Files:**
- `components/transactions/transaction-form.tsx`
- `lib/transactions/savings-detection.ts` (new)

**Logic:**
1. When transfer destination account is selected:
   - Check if account type is `savings`
   - Query goals where `accountId` matches destination
   - If exactly one goal matches, auto-select it
   - If multiple goals match, show selector with suggestions
2. Show informational banner: "This transfer will contribute to your [Goal Name] goal"

---

### Task 6: Goal Progress Updates on Contribution
**Files:**
- `app/api/savings-goals/[id]/progress/route.ts` (update)
- `lib/goals/contribution-handler.ts` (new)

**Features:**
1. New function `handleGoalContribution(goalId, amount, transactionId)`:
   - Update goal's `currentAmount`
   - Check milestone thresholds (25%, 50%, 75%, 100%)
   - Create milestone records if achieved
   - Send notifications for milestones
2. Reverse function `revertGoalContribution(goalId, amount)` for deleted transactions

---

### Task 7: Transaction History with Goal Info
**Files:**
- `app/api/transactions/route.ts` (GET)
- `components/transactions/recent-transactions.tsx`
- `components/transactions/transaction-card.tsx`

**Changes:**
1. Include goal info in transaction response when `savingsGoalId` is set
2. Show goal badge/indicator on transaction cards for linked transactions
3. Add filter for "Savings contributions" in transaction list

---

### Task 8: Savings Rate Tracking
**Files:**
- `app/api/reports/savings-rate/route.ts` (new)
- `components/charts/savings-rate-chart.tsx` (new)
- `components/dashboard/savings-rate-widget.tsx` (new)

**Calculations:**
```typescript
interface SavingsRateData {
  period: string; // month
  totalIncome: number;
  totalSavingsContributions: number;
  savingsRate: number; // percentage
}
```

**Savings Rate = (Total Savings Contributions / Total Income) × 100**

**Sources for savings contributions:**
1. Transactions linked to savings goals (`savingsGoalId` not null)
2. Transfers to savings accounts
3. Direct goal contributions

---

### Task 9: Enhanced Savings Goals Widget
**File:** `components/dashboard/savings-goals-widget.tsx`

**Enhancements:**
1. Show recent contribution amounts
2. Show savings rate mini-indicator
3. Quick-contribute button with amount presets
4. Link to view all contributions for each goal

---

### Task 10: Goal Contribution History View
**Files:**
- `app/api/savings-goals/[id]/contributions/route.ts` (new)
- `components/goals/goal-contributions-list.tsx` (new)
- Update `components/goals/goal-tracker.tsx`

**Features:**
1. View all transactions linked to a goal
2. Show contribution timeline
3. Filter by date range
4. Show running total over time

---

## Database Migration

**File:** `drizzle/00XX_add_savings_goal_contributions.sql`

```sql
-- Create savings goal contributions table
CREATE TABLE IF NOT EXISTS savings_goal_contributions (
  id TEXT PRIMARY KEY,
  transaction_id TEXT NOT NULL,
  goal_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  household_id TEXT NOT NULL,
  amount REAL NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE,
  FOREIGN KEY (goal_id) REFERENCES savings_goals(id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_goal_contributions_transaction ON savings_goal_contributions(transaction_id);
CREATE INDEX IF NOT EXISTS idx_goal_contributions_goal ON savings_goal_contributions(goal_id);
CREATE INDEX IF NOT EXISTS idx_goal_contributions_user_household ON savings_goal_contributions(user_id, household_id);
```

---

## Implementation Order

1. **Task 4: Database schema & migration** - Foundation for everything
2. **Task 1: Goal Selector Component** - Reusable UI component
3. **Task 3: Transaction API updates** - Backend support
4. **Task 2: Transaction Form updates** - Wire up UI to API
5. **Task 5: Auto-detection logic** - Smart suggestions
6. **Task 6: Progress updates** - Milestone handling
7. **Task 7: Transaction history** - Display linked goals
8. **Task 8: Savings rate tracking** - Analytics
9. **Task 10: Contribution history** - Goal detail view
10. **Task 9: Enhanced widget** - Dashboard improvements

---

## UI/UX Considerations

### Goal Selection Flow
1. **Implicit linking:** When transferring to savings account with one linked goal, auto-link
2. **Explicit selection:** When multiple goals or no account link, show selector
3. **Split mode:** Toggle to distribute amount across multiple goals

### Visual Indicators
- Goal-linked transactions show target icon with goal color
- Progress updates animate when viewing goal after contribution
- Toast notifications for milestone achievements

### Mobile Experience
- Goal selector is touch-friendly with large tap targets
- Swipe to contribute in goal list view
- Quick-contribute FAB on goals page

---

## Testing Checklist

- [ ] Create transaction linked to single goal
- [ ] Create split contribution across multiple goals
- [ ] Auto-detection for savings account transfers
- [ ] Goal progress updates correctly
- [ ] Milestones trigger when thresholds crossed
- [ ] Delete transaction reverts goal progress
- [ ] Update transaction updates goal progress correctly
- [ ] Savings rate calculations are accurate
- [ ] Contribution history displays correctly
- [ ] Widget shows recent contributions

---

## Files to Create
1. `components/transactions/goal-selector.tsx`
2. `lib/transactions/savings-detection.ts`
3. `lib/goals/contribution-handler.ts`
4. `app/api/reports/savings-rate/route.ts`
5. `components/charts/savings-rate-chart.tsx`
6. `components/dashboard/savings-rate-widget.tsx`
7. `app/api/savings-goals/[id]/contributions/route.ts`
8. `components/goals/goal-contributions-list.tsx`
9. `drizzle/00XX_add_savings_goal_contributions.sql`

## Files to Modify
1. `lib/db/schema.ts` - Add savingsGoalContributions table
2. `components/transactions/transaction-form.tsx` - Add goal selector
3. `components/transactions/quick-transaction-modal.tsx` - Add goal selector
4. `app/api/transactions/route.ts` - Handle goal linking
5. `app/api/transactions/[id]/route.ts` - Handle goal updates
6. `app/api/savings-goals/[id]/progress/route.ts` - Enhanced contribution handling
7. `components/transactions/recent-transactions.tsx` - Show goal indicator
8. `components/transactions/transaction-card.tsx` - Show goal badge
9. `components/goals/goal-tracker.tsx` - Add contributions view
10. `components/dashboard/savings-goals-widget.tsx` - Enhancements

---

## Estimated Effort
- Task 1-4: 3-4 hours (Core foundation)
- Task 5-6: 2 hours (Auto-detection and progress)
- Task 7: 1 hour (Transaction display)
- Task 8-9: 2 hours (Analytics and widget)
- Task 10: 1 hour (Contribution history)

**Total: ~9-10 hours**

---

## Success Criteria
1. Users can link transfers to savings goals
2. Progress automatically updates when transactions are linked
3. Split contributions across multiple goals work correctly
4. Savings rate is calculated and displayed
5. All existing functionality remains working
6. Performance is not degraded (< 100ms added latency)

