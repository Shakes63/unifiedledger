# Phase 10: Notifications - Implementation Plan

**Feature:** Unified Debt, Bill & Credit Card Architecture - Phase 10
**Status:** In Progress
**Start Date:** 2025-12-04
**Estimated Effort:** 4-6 hours

## Overview

Phase 10 adds comprehensive notification support for credit card/line of credit utilization monitoring and enhances the payoff milestone system to work with the new unified architecture (credit accounts + debt bills).

## Current State Analysis

### Existing Notification Infrastructure
- **Notification Service:** `lib/notifications/notification-service.ts` - Core notification creation/management
- **Notification Types:** bill_due, bill_overdue, budget_warning, budget_exceeded, budget_review, low_balance, savings_milestone, debt_milestone, spending_summary, reminder, system
- **Existing Notification Modules:**
  - `autopay-notifications.ts` - Autopay success/failure (Phase 6 - COMPLETE)
  - `bill-reminders.ts` - Bill due date reminders
  - `budget-review.ts` - Monthly budget reviews
  - `budget-warnings.ts` - Budget threshold alerts
  - `debt-milestones.ts` - Debt payoff milestones (needs unified architecture update)
  - `low-balance-alerts.ts` - Low cash balance warnings
  - `savings-milestones.ts` - Savings goal milestones

### Database Schema Available
- `creditLimitHistory` table - Tracks credit limit changes over time
- `accountBalanceHistory` table - Tracks balance/utilization snapshots
- `notificationPreferences` table - User notification settings
- `notifications` table - Notification storage

### UI Components
- `NotificationsTab` in settings - Per-notification-type toggle with channel selection
- Notification bell with badge in navigation

## Implementation Tasks

### Task 1: Schema Updates (Migration)

Add new fields to `notificationPreferences` table:

```sql
-- Add high utilization alert settings
ALTER TABLE notification_preferences ADD COLUMN high_utilization_enabled INTEGER DEFAULT 1;
ALTER TABLE notification_preferences ADD COLUMN high_utilization_threshold INTEGER DEFAULT 75;
ALTER TABLE notification_preferences ADD COLUMN high_utilization_channels TEXT DEFAULT '["push"]';

-- Add credit limit change notification settings  
ALTER TABLE notification_preferences ADD COLUMN credit_limit_change_enabled INTEGER DEFAULT 1;
ALTER TABLE notification_preferences ADD COLUMN credit_limit_change_channels TEXT DEFAULT '["push"]';
```

### Task 2: Update Schema Types (lib/db/schema.ts)

Add new fields to `notificationPreferences` schema:

```typescript
// High utilization alerts
highUtilizationEnabled: integer('high_utilization_enabled', { mode: 'boolean' }).default(true),
highUtilizationThreshold: integer('high_utilization_threshold').default(75),
highUtilizationChannels: text('high_utilization_channels').default('["push"]'),

// Credit limit change notifications
creditLimitChangeEnabled: integer('credit_limit_change_enabled', { mode: 'boolean' }).default(true),
creditLimitChangeChannels: text('credit_limit_change_channels').default('["push"]'),
```

### Task 3: Create High Utilization Alerts Service

**File:** `lib/notifications/high-utilization-alerts.ts`

Features:
- Check utilization across all credit accounts in household
- Configurable thresholds (30%, 50%, 75%, 90%)
- Track which thresholds have been notified to prevent duplicate alerts
- Notify when utilization crosses a threshold (up or down)
- Reset notification state when utilization drops below threshold

```typescript
interface UtilizationThreshold {
  percentage: number;
  severity: 'info' | 'warning' | 'high' | 'urgent';
}

const THRESHOLDS: UtilizationThreshold[] = [
  { percentage: 30, severity: 'info' },
  { percentage: 50, severity: 'warning' },
  { percentage: 75, severity: 'high' },
  { percentage: 90, severity: 'urgent' },
];
```

Algorithm:
1. Calculate current utilization for each credit account
2. Compare with last recorded utilization
3. For each account crossing a threshold:
   - Create notification with appropriate priority
   - Record that threshold was notified
4. When utilization drops below a threshold, reset notification state

### Task 4: Create Credit Limit Change Notifications Service

**File:** `lib/notifications/credit-limit-change-notifications.ts`

Features:
- Listen for credit limit history entries
- Notify when limit increases (positive)
- Notify when limit decreases (may impact utilization)
- Show before/after utilization impact

```typescript
interface CreditLimitChangeNotificationInput {
  accountId: string;
  accountName: string;
  oldLimit: number;
  newLimit: number;
  changeSource: 'user_update' | 'bank_increase' | 'bank_decrease' | 'initial';
  utilizationBefore: number;
  utilizationAfter: number;
  userId: string;
  householdId: string;
}
```

### Task 5: Update Debt Milestones for Unified Architecture

**File:** `lib/notifications/debt-milestones.ts`

Current Implementation:
- Only checks `debts` table
- Uses legacy debt fields

Updated Implementation:
- Check both credit accounts (type 'credit' or 'line_of_credit') and debt bills (isDebt=true)
- Use unified debt stats from `/api/debts/unified` pattern
- Calculate milestones based on:
  - Credit accounts: (creditLimit - currentBalance) / creditLimit for payoff %
  - Debt bills: remainingBalance tracking with principalRemaining
- Celebrate milestones at 25%, 50%, 75%, 100%

### Task 6: Add Notification Preferences to API

Update `/api/user/households/[householdId]/preferences` to handle new fields:
- `highUtilizationEnabled`
- `highUtilizationThreshold`
- `highUtilizationChannels`
- `creditLimitChangeEnabled`
- `creditLimitChangeChannels`

### Task 7: Update Notifications Settings UI

**File:** `components/settings/notifications-tab.tsx`

Add new card section for "Credit Utilization Alerts":
- Toggle for high utilization alerts
- Threshold slider (30%, 50%, 75%, 90%)
- Channel selector
- Toggle for credit limit change notifications
- Channel selector

### Task 8: Create API Endpoint for Utilization Check

**File:** `app/api/notifications/check-utilization/route.ts`

Called by cron job to check all users' credit utilization:
- Iterate through active households
- Calculate utilization per credit account
- Check against thresholds
- Create notifications where needed
- Debounce to prevent spam (24-hour cooldown per threshold per account)

### Task 9: Update Cron Job

Add utilization check to daily cron job or create separate schedule:
- Check utilization once daily (with balance history snapshot)
- Or check after each transaction affecting credit accounts

## Database Migration

**File:** `drizzle/0043_add_utilization_notification_settings.sql`

```sql
-- Add high utilization alert settings to notification_preferences
ALTER TABLE notification_preferences ADD COLUMN high_utilization_enabled INTEGER DEFAULT 1;
ALTER TABLE notification_preferences ADD COLUMN high_utilization_threshold INTEGER DEFAULT 75;
ALTER TABLE notification_preferences ADD COLUMN high_utilization_channels TEXT DEFAULT '["push"]';

-- Add credit limit change notification settings
ALTER TABLE notification_preferences ADD COLUMN credit_limit_change_enabled INTEGER DEFAULT 1;
ALTER TABLE notification_preferences ADD COLUMN credit_limit_change_channels TEXT DEFAULT '["push"]';

-- Add utilization alert tracking table to prevent duplicate notifications
CREATE TABLE IF NOT EXISTS utilization_alert_state (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  household_id TEXT NOT NULL,
  threshold_30_notified INTEGER DEFAULT 0,
  threshold_50_notified INTEGER DEFAULT 0,
  threshold_75_notified INTEGER DEFAULT 0,
  threshold_90_notified INTEGER DEFAULT 0,
  last_utilization REAL,
  last_checked_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_utilization_alert_account ON utilization_alert_state(account_id);
CREATE INDEX idx_utilization_alert_household ON utilization_alert_state(household_id);
```

## UI Design

### Credit Utilization Alerts Card

```
┌─────────────────────────────────────────────────────────────┐
│ 💳 Credit Utilization Alerts                                │
│ Monitor your credit card usage and get alerts              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ High utilization warnings                      [Toggle ON] │
│ Get notified when credit utilization is high               │
│                                                             │
│ Alert threshold                                             │
│ ●────────●────────●────────●                               │
│ 30%      50%      75%      90%                              │
│                   ▲ Current: 75%                            │
│                                                             │
│ Delivery channels                                           │
│ ┌────────────────┐ ┌────────────────┐                      │
│ │ ☑ Push        │ │ ☐ Email       │                      │
│ └────────────────┘ └────────────────┘                      │
│                                                             │
│ ─────────────────────────────────────────────              │
│                                                             │
│ Credit limit changes                           [Toggle ON] │
│ Get notified when your credit limit changes                │
│                                                             │
│ Delivery channels                                           │
│ ┌────────────────┐ ┌────────────────┐                      │
│ │ ☑ Push        │ │ ☐ Email       │                      │
│ └────────────────┘ └────────────────┘                      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Notification Message Templates

### High Utilization Alert (75% threshold)
```
Title: ⚠️ High Credit Utilization
Message: Your credit utilization on [Account Name] has reached 78%, 
         which exceeds your 75% alert threshold. 
         Balance: $3,900 / $5,000 limit.
Priority: high
ActionUrl: /dashboard/accounts
ActionLabel: View Account
```

### Critical Utilization Alert (90% threshold)
```
Title: 🚨 Critical Credit Utilization
Message: Your credit utilization on [Account Name] has reached 92%!
         High utilization can impact your credit score.
         Balance: $4,600 / $5,000 limit.
Priority: urgent
ActionUrl: /dashboard/accounts
ActionLabel: View Account
```

### Credit Limit Increase
```
Title: ✅ Credit Limit Increased
Message: Great news! Your credit limit on [Account Name] was increased 
         from $5,000 to $7,500. Your utilization dropped from 78% to 52%.
Priority: low
ActionUrl: /dashboard/accounts
ActionLabel: View Account
```

### Credit Limit Decrease
```
Title: ⚠️ Credit Limit Decreased
Message: Your credit limit on [Account Name] was reduced from $5,000 to $4,000. 
         Your utilization has increased from 78% to 98%.
         Consider paying down this balance.
Priority: high
ActionUrl: /dashboard/accounts
ActionLabel: View Account
```

### Unified Debt Payoff Milestone
```
Title: 🎉 Debt Milestone: 50% Paid Off!
Message: Congratulations! You've paid off 50% of your [Debt Name] debt!
         Original: $10,000 → Remaining: $5,000
         Keep up the great work!
Priority: high
ActionUrl: /dashboard/debts
ActionLabel: View Progress
```

## Testing Plan

1. **Unit Tests:**
   - High utilization threshold calculation
   - Credit limit change detection
   - Unified debt milestone calculation

2. **Integration Tests:**
   - API endpoint for utilization check
   - Notification creation flow
   - Preference updates

3. **Manual Testing:**
   - Create credit account, adjust balance to trigger thresholds
   - Update credit limit and verify notification
   - Test notification settings UI toggles and channel selection

## Implementation Order

1. ✅ Create implementation plan (this document)
2. ✅ Create database migration for new fields (`drizzle/0066_add_utilization_notifications.sql`)
3. ✅ Update schema.ts with new notification preference fields
4. ✅ Create `high-utilization-alerts.ts` service
5. ✅ Create `credit-limit-change-notifications.ts` service
6. ✅ Update `debt-milestones.ts` for unified architecture
7. ✅ Create `/api/notifications/utilization-alerts` endpoint
8. ✅ Update notifications settings UI with new Credit Utilization card
9. ✅ Update user household preferences API to handle new fields
10. Test all notification flows
11. Update features.md and architecture document

## Cron Job Configuration

Add the following cron job to check utilization alerts (recommended: daily at 8 AM UTC):

```bash
# Check utilization alerts daily
0 8 * * * curl -X POST https://your-domain.com/api/notifications/utilization-alerts \
  -H "Authorization: Bearer $CRON_SECRET"
```

This will check all households for high credit utilization and create notifications
for users who have enabled high utilization alerts in their preferences.

## Dependencies

- Phase 1.1 Schema (accounts with creditLimit) - ✅ Complete
- Phase 4 Display (utilization tracking) - ✅ Complete
- Existing notification infrastructure - ✅ Available

## Notes

- Autopay success/failure notifications already exist from Phase 6
- The existing debt-milestones.ts needs updating to work with the unified debt sources (credit accounts + debt bills)
- Consider adding a "utilization improved" notification when user pays down credit and crosses thresholds downward

