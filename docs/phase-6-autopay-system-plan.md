# Phase 6: Autopay System - Implementation Plan

## Overview

This phase implements an automated bill payment system that processes bills on their due dates (or configured days before). The system:
- Automatically creates transactions for autopay-enabled bills
- Creates transfers for credit card payments (from paying account to credit account)
- Creates expenses for regular bills and loan payments
- Records payment history in the `bill_payments` table
- Sends notifications (success and failure)
- Suppresses standard bill due reminders for autopay bills

## Schema Review

The following autopay fields already exist in the `bills` table (Phase 1.2):
```typescript
isAutopayEnabled: boolean,           // Toggle autopay on/off
autopayAccountId: text,              // Account to pay from
autopayAmountType: enum,             // 'fixed', 'minimum_payment', 'statement_balance', 'full_balance'
autopayFixedAmount: real,            // Amount when autopayAmountType = 'fixed'
autopayDaysBefore: integer,          // Days before due date to process (0-5)
```

The `billPayments` table already supports `paymentMethod: 'autopay'`.

---

## Implementation Tasks

### Task 6.1: Autopay Amount Calculator Utility
**File:** `lib/bills/autopay-calculator.ts`

Create utility to calculate the correct autopay amount based on `autopayAmountType`:

```typescript
interface AutopayAmountResult {
  amount: number;
  amountSource: string;
  minimumRequired: number;
  insufficientFunds?: boolean;
}

function calculateAutopayAmount(
  bill: BillWithAccount,
  instance: BillInstance,
  payingAccountBalance: number
): AutopayAmountResult {
  switch (bill.autopayAmountType) {
    case 'fixed':
      return { amount: bill.autopayFixedAmount, amountSource: 'Fixed Amount' };
    
    case 'minimum_payment':
      // For linked credit accounts, get minimum payment from account
      if (bill.linkedAccountId && linkedAccount.minimumPaymentAmount) {
        return { amount: linkedAccount.minimumPaymentAmount, amountSource: 'Minimum Payment' };
      }
      return { amount: instance.expectedAmount, amountSource: 'Minimum Payment' };
    
    case 'statement_balance':
      // Get statement balance from linked credit account
      if (bill.linkedAccountId && linkedAccount.statementBalance) {
        return { amount: linkedAccount.statementBalance, amountSource: 'Statement Balance' };
      }
      return { amount: instance.expectedAmount, amountSource: 'Statement Balance' };
    
    case 'full_balance':
      // Pay full current balance on credit account
      if (bill.linkedAccountId && linkedAccount.currentBalance) {
        return { amount: Math.abs(linkedAccount.currentBalance), amountSource: 'Full Balance' };
      }
      return { amount: instance.expectedAmount, amountSource: 'Full Balance' };
    
    default:
      return { amount: instance.expectedAmount, amountSource: 'Expected Amount' };
  }
}
```

**Implementation Notes:**
- For credit cards, `currentBalance` is negative (debt), so use `Math.abs()`
- For loans/debts, use the expected amount from the bill instance
- Validate that paying account has sufficient funds

---

### Task 6.2: Autopay Transaction Creator
**File:** `lib/bills/autopay-transaction.ts`

Create the core autopay transaction creation logic:

```typescript
interface AutopayResult {
  success: boolean;
  transactionId?: string;
  transferId?: string;
  amount: number;
  paymentId?: string;
  error?: string;
  errorCode?: 'INSUFFICIENT_FUNDS' | 'ACCOUNT_NOT_FOUND' | 'BILL_NOT_FOUND' | 'ALREADY_PAID' | 'SYSTEM_ERROR';
}

async function processAutopayForInstance(
  bill: Bill,
  instance: BillInstance,
  userId: string,
  householdId: string
): Promise<AutopayResult>
```

**Logic Flow:**

1. **Validate prerequisites:**
   - Bill has autopay enabled
   - Autopay account exists and is active
   - Instance is pending (not already paid)

2. **Calculate payment amount:**
   - Use `calculateAutopayAmount()` from Task 6.1

3. **Check sufficient funds:**
   - For transfers: Verify autopay account has sufficient balance
   - Skip if insufficient (create failure notification instead)

4. **Create transaction:**
   - **Credit card payment (linkedAccountId set):** Create transfer
     ```typescript
     // Transfer from autopay account to credit account
     const transfer = await createTransferTransaction({
       fromAccountId: bill.autopayAccountId,
       toAccountId: bill.linkedAccountId,
       amount: paymentAmount,
       description: `Autopay: ${bill.name}`,
       date: today,
       userId,
       householdId,
     });
     ```
   - **Regular bill/loan:** Create expense
     ```typescript
     // Expense from autopay account
     const expense = await createExpenseTransaction({
       accountId: bill.autopayAccountId,
       amount: paymentAmount,
       description: `Autopay: ${bill.name}`,
       categoryId: bill.categoryId,
       date: today,
       userId,
       householdId,
       billInstanceId: instance.id,
     });
     ```

5. **Process bill payment:**
   - Call existing `processBillPayment()` utility
   - This updates the instance status and creates payment history

6. **Return result** with transaction details or error

---

### Task 6.3: Daily Autopay Cron Job
**Files:**
- `app/api/cron/autopay/route.ts` - API endpoint
- `lib/bills/autopay-processor.ts` - Core processing logic

**Cron Endpoint:**
```typescript
// POST /api/cron/autopay
export async function POST(request: Request) {
  // Verify cron secret in production
  const result = await processAllAutopayBills();
  return Response.json(result);
}
```

**Processing Logic:**
```typescript
interface AutopayProcessingResult {
  processed: number;
  successful: number;
  failed: number;
  skipped: number;
  errors: Array<{ billId: string; billName: string; error: string }>;
}

async function processAllAutopayBills(): Promise<AutopayProcessingResult> {
  const today = new Date();
  
  // Find all pending instances where:
  // 1. Bill has autopay enabled
  // 2. Due date is today + autopayDaysBefore (e.g., if autopayDaysBefore=2, process bills due in 2 days)
  // 3. Instance status is 'pending'
  
  const instancesQuery = await db
    .select({
      instance: billInstances,
      bill: bills,
      autopayAccount: accounts,
      linkedAccount: accounts,
    })
    .from(billInstances)
    .innerJoin(bills, eq(billInstances.billId, bills.id))
    .leftJoin(accounts, eq(bills.autopayAccountId, accounts.id))
    .leftJoin(accounts, eq(bills.linkedAccountId, accounts.id))
    .where(
      and(
        eq(bills.isAutopayEnabled, true),
        eq(billInstances.status, 'pending'),
        // Calculate target due date based on autopayDaysBefore
        // SQL: dueDate BETWEEN today AND today + maxAutopayDaysBefore
      )
    );
  
  // Filter instances where dueDate - autopayDaysBefore = today
  const eligibleInstances = instancesQuery.filter(item => {
    const dueDate = parseISO(item.instance.dueDate);
    const processingDate = subDays(dueDate, item.bill.autopayDaysBefore || 0);
    return isSameDay(processingDate, today);
  });
  
  const results = { processed: 0, successful: 0, failed: 0, skipped: 0, errors: [] };
  
  for (const { instance, bill, autopayAccount, linkedAccount } of eligibleInstances) {
    results.processed++;
    
    const result = await processAutopayForInstance(bill, instance, bill.userId, bill.householdId);
    
    if (result.success) {
      results.successful++;
      await sendAutopaySuccessNotification(bill, instance, result);
    } else {
      results.failed++;
      results.errors.push({ billId: bill.id, billName: bill.name, error: result.error });
      await sendAutopayFailureNotification(bill, instance, result);
    }
  }
  
  return results;
}
```

**Cron Schedule:** Run daily at 6:00 AM UTC (before bill reminders at 9:00 AM)

---

### Task 6.4: Autopay Notifications
**File:** `lib/notifications/autopay-notifications.ts`

Add new notification types and handlers:

**Update `NotificationType` enum:**
```typescript
type NotificationType =
  | 'bill_due'
  | 'bill_overdue'
  | 'autopay_processed'   // NEW
  | 'autopay_failed'      // NEW
  | ... other types
```

**Notification Functions:**

```typescript
async function sendAutopaySuccessNotification(
  bill: Bill,
  instance: BillInstance,
  result: AutopayResult
) {
  await createNotification({
    userId: bill.userId,
    type: 'autopay_processed',
    title: `Autopay processed: ${bill.name}`,
    message: `Payment of $${result.amount.toFixed(2)} was automatically processed for ${bill.name}.`,
    priority: 'low',
    actionUrl: '/dashboard/bills',
    actionLabel: 'View Bills',
    entityType: 'billInstance',
    entityId: instance.id,
    metadata: {
      billId: bill.id,
      billInstanceId: instance.id,
      amount: result.amount,
      transactionId: result.transactionId,
      paymentMethod: 'autopay',
    },
    householdId: bill.householdId,
  });
}

async function sendAutopayFailureNotification(
  bill: Bill,
  instance: BillInstance,
  result: AutopayResult
) {
  const errorMessages: Record<string, string> = {
    INSUFFICIENT_FUNDS: 'Insufficient funds in payment account',
    ACCOUNT_NOT_FOUND: 'Payment account not found',
    BILL_NOT_FOUND: 'Bill configuration error',
    ALREADY_PAID: 'Bill was already paid',
    SYSTEM_ERROR: 'System error during processing',
  };

  await createNotification({
    userId: bill.userId,
    type: 'autopay_failed',
    title: `Autopay failed: ${bill.name}`,
    message: `Automatic payment for ${bill.name} failed. ${errorMessages[result.errorCode] || result.error}`,
    priority: 'high',
    actionUrl: '/dashboard/bills',
    actionLabel: 'Pay Now',
    entityType: 'billInstance',
    entityId: instance.id,
    metadata: {
      billId: bill.id,
      billInstanceId: instance.id,
      errorCode: result.errorCode,
      error: result.error,
    },
    householdId: bill.householdId,
  });
}
```

---

### Task 6.5: Suppress Bill Reminders for Autopay Bills
**File:** `lib/notifications/bill-reminders.ts`

Update `checkAndCreateBillReminders()` to skip autopay-enabled bills:

```typescript
// In the loop that processes pending instances:
for (const { instance, bill } of pendingInstances) {
  if (!bill) continue;
  
  // Skip autopay-enabled bills - they'll be handled by autopay processor
  if (bill.isAutopayEnabled && bill.autopayAccountId) {
    continue;
  }
  
  // ... existing reminder logic
}
```

**Rationale:** Users don't need reminders for bills that will be paid automatically.

---

### Task 6.6: Notification Preferences for Autopay
**Database:** May need migration to add autopay notification preferences

Check if `notificationPreferences` table needs:
```typescript
autopayProcessedEnabled: boolean,  // Default: true
autopayFailedEnabled: boolean,     // Default: true (critical alert)
```

**Note:** Based on existing schema review, notification preferences may already support generic types. If not, add migration.

---

## Database Changes

### Required Migration: None

All necessary schema fields already exist from Phase 1.2. The autopay fields on `bills` and `paymentMethod: 'autopay'` on `billPayments` are already in place.

### Optional Migration: Notification Preferences

If needed, add to `notificationPreferences`:
```sql
ALTER TABLE notification_preferences ADD COLUMN autopay_processed_enabled INTEGER DEFAULT 1;
ALTER TABLE notification_preferences ADD COLUMN autopay_failed_enabled INTEGER DEFAULT 1;
```

---

## Implementation Order

1. **Task 6.1** - Autopay Amount Calculator (foundation)
2. **Task 6.2** - Autopay Transaction Creator (core logic)
3. **Task 6.3** - Daily Cron Job (orchestration)
4. **Task 6.4** - Autopay Notifications (user feedback)
5. **Task 6.5** - Suppress Bill Reminders (cleanup)
6. **Task 6.6** - Notification Preferences (optional, if needed)

---

## Testing Checklist

### Task 6.1: Amount Calculator
- [ ] Fixed amount returns correct value
- [ ] Minimum payment pulls from linked credit account
- [ ] Statement balance uses linked account's statement balance
- [ ] Full balance uses absolute value of credit balance
- [ ] Falls back to expected amount when account data unavailable

### Task 6.2: Transaction Creator
- [ ] Creates transfer for credit card payment (linkedAccountId set)
- [ ] Creates expense for regular bill (no linkedAccountId)
- [ ] Updates account balances correctly
- [ ] Calls processBillPayment() with correct parameters
- [ ] Returns error on insufficient funds
- [ ] Returns error if autopay account not found
- [ ] Skips already-paid instances

### Task 6.3: Cron Job
- [ ] Finds only eligible instances (autopay enabled + pending + correct date)
- [ ] Respects `autopayDaysBefore` setting
- [ ] Processes multiple bills across different users
- [ ] Returns accurate success/failure counts
- [ ] Handles errors gracefully without stopping other bills

### Task 6.4: Notifications
- [ ] Success notification created with correct details
- [ ] Failure notification created with error message
- [ ] Priority levels are appropriate (low for success, high for failure)
- [ ] Metadata includes transaction and bill references

### Task 6.5: Bill Reminder Suppression
- [ ] Autopay-enabled bills don't generate due reminders
- [ ] Non-autopay bills still receive reminders
- [ ] Overdue reminders still sent if autopay failed

---

## Estimated Effort

| Task | Complexity | Estimated Time |
|------|------------|----------------|
| 6.1 | Low | 1-2 hours |
| 6.2 | High | 3-4 hours |
| 6.3 | Medium | 2-3 hours |
| 6.4 | Low | 1-2 hours |
| 6.5 | Low | 0.5-1 hour |
| 6.6 | Low | 0.5-1 hour (if needed) |

**Total Estimated:** 8-13 hours (1-2 days)

---

## Files to Create

1. `lib/bills/autopay-calculator.ts` - Amount calculation utility
2. `lib/bills/autopay-transaction.ts` - Transaction creation for autopay
3. `lib/bills/autopay-processor.ts` - Batch processing logic
4. `app/api/cron/autopay/route.ts` - Cron endpoint
5. `lib/notifications/autopay-notifications.ts` - Notification helpers

## Files to Modify

1. `lib/notifications/notification-service.ts` - Add new notification types
2. `lib/notifications/bill-reminders.ts` - Skip autopay bills
3. `lib/db/schema.ts` - Add notification types to enum (if needed)
4. `docs/CRON_JOB_SETUP.md` - Document autopay cron schedule

---

## Dependencies

- **Phase 1-5 (COMPLETED):** Autopay schema fields on bills, bill_payments table, processBillPayment utility
- **Existing:** Transaction creation flow, notification service, bill payment utilities

---

## Edge Cases to Handle

1. **Insufficient funds:** Create failure notification, skip payment
2. **Account deleted:** Bill should be flagged, skip processing
3. **Bill deactivated:** Skip processing
4. **Statement balance is $0:** Either skip or process $0 payment (configurable)
5. **Multiple partial payments:** Check if already partially paid this cycle
6. **Overlapping due dates:** Process each instance independently
7. **Timezone handling:** Use UTC for cron, local time for display
8. **Credit account with credit balance (overpayment):** Skip "full balance" payment

---

## Future Considerations

- **UI Indicators:** Show autopay status on calendar (Phase 9)
- **Retry Logic:** Retry failed autopay after N days
- **SMS Notifications:** Extend to SMS channel for critical failures
- **Balance Alerts:** Warn when autopay account balance is low before due date

