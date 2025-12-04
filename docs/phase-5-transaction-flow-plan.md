# Phase 5: Transaction Flow Updates - Implementation Plan

## Overview

This phase updates transaction handling to properly support the unified debt/bill/credit card architecture. The key changes involve:
- Credit card payments as transfers (not expenses)
- Automatic bill instance marking when payments are detected
- Proper handling of credit card purchases, refunds, and balance transfers
- Migrating from direct debt linking to bill-based payment tracking
- Recording all bill payments in the `bill_payments` table

## Implementation Tasks

### Task 5.1: Credit Card Payment Detection & Transfer Flow
**Files to modify:**
- `app/api/transactions/route.ts` - POST handler
- `components/transactions/transaction-form.tsx` - UI updates
- `components/transactions/quick-transaction-modal.tsx` - UI updates

**Implementation:**
1. When creating a `transfer` where `toAccountId` is a credit card/line of credit:
   - Auto-detect linked payment bill (`bills.linkedAccountId === toAccountId`)
   - Find pending bill instance within date tolerance (±7 days)
   - Auto-mark instance as paid and record in `bill_payments`
   - Update credit account balance (reduce debt)

2. UI Enhancement:
   - Show "Payment Bill" indicator when destination is credit account
   - Option to manually select which bill instance to mark paid
   - Show payment breakdown (if partial payment)

**Schema already supports:** `bills.linkedAccountId`, `billPayments`, `billInstances.paidAmount`

---

### Task 5.2: Credit Card Purchase Handling
**Files to modify:**
- `app/api/transactions/route.ts` - POST handler  
- `components/transactions/transaction-form.tsx` - Display logic

**Implementation:**
1. Purchases on credit cards are `expense` transactions on the credit account
2. No special handling needed - already works correctly
3. Add visual indicator in transaction form showing "Credit Card Purchase"
4. Ensure balance updates correctly (increases debt/reduces available credit)

**Already works:** Credit cards are accounts, expenses reduce balance (which for credit = more debt)

---

### Task 5.3: Balance Transfers Between Credit Cards
**Files to modify:**
- `app/api/transactions/route.ts` - POST handler
- `components/transactions/transaction-form.tsx` - New transfer type
- `components/transfers/convert-to-transfer-modal.tsx` - Support credit-to-credit

**Implementation:**
1. When transfer is credit-to-credit:
   - Source credit card: Balance decreases (debt reduced)
   - Destination credit card: Balance increases (debt increased)
   - No bill instance should be auto-marked (this is NOT a payment)
   - Add `isBalanceTransfer` flag to transactions table
   
2. UI:
   - Show "Balance Transfer" label when both accounts are credit
   - Warning about potential fees (informational)
   - Note: Does not count as payment toward either card

**Database change needed:** Add `isBalanceTransfer` boolean to transactions table

---

### Task 5.4: Credit Card Refunds
**Files to modify:**
- `app/api/transactions/route.ts` - POST handler
- `components/transactions/transaction-form.tsx` - Refund handling

**Implementation:**
1. Refunds on credit cards are `income` transactions on the credit account
2. Balance decreases (debt reduced) - same as a payment
3. **Key difference:** Should NOT auto-mark any bill instance as paid
4. Add optional `isRefund` flag for proper categorization

**Database change needed:** Add `isRefund` boolean to transactions table (optional, for reporting)

---

### Task 5.5: Partial Payment Handling with Shortfall Tracking
**Files to modify:**
- `app/api/transactions/route.ts` - Payment processing
- `app/api/bills/instances/[id]/route.ts` - Partial payment updates
- `lib/bills/bill-payment-utils.ts` - New utility file

**Implementation:**
1. Create `processBillPayment()` utility function:
   ```typescript
   async function processBillPayment({
     billId,
     instanceId,
     transactionId,
     paymentAmount,
     paymentDate,
     userId,
     householdId,
     linkedAccountId, // For credit payments - the paying account
   })
   ```

2. Payment logic:
   - If `paymentAmount >= expectedAmount`: Full payment
     - Set `paymentStatus = 'paid'`, `status = 'paid'`
   - If `paymentAmount < expectedAmount`: Partial payment
     - Set `paymentStatus = 'partial'`
     - Update `paidAmount += paymentAmount`
     - Update `remainingAmount = expectedAmount - paidAmount`
     - Keep `status = 'pending'` until fully paid
   - If `paymentAmount > expectedAmount`: Overpayment
     - Set `paymentStatus = 'overpaid'`
     - Handle credit to account balance

3. Always create `billPayments` record:
   - Track `principalAmount` and `interestAmount` for debt bills
   - Link to transaction and bill instance
   - Store `balanceBeforePayment` and `balanceAfterPayment` for debt bills

---

### Task 5.6: Loan/Debt Bill Payments via Expense
**Files to modify:**
- `app/api/transactions/route.ts` - POST handler
- `components/transactions/transaction-form.tsx` - Bill selector
- `lib/bills/debt-payment-utils.ts` - New utility file

**Implementation:**
1. When creating an expense with `billInstanceId`:
   - Check if bill `isDebt === true`
   - If debt bill: Calculate principal/interest split using `calculatePaymentBreakdown()`
   - Update bill's `remainingBalance`
   - Create `billPayments` record with breakdown
   - Update bill milestones if applicable

2. UI Flow:
   - "Bill Payment" type shows debt bills with remaining balances
   - Shows minimum payment vs current balance
   - Option to pay more than minimum
   - Real-time calculation of principal vs interest

---

### Task 5.7: Remove Legacy Debt Linking
**Files to modify:**
- `app/api/transactions/route.ts` - Remove direct `debtId` handling
- `lib/db/schema.ts` - Mark `debtId` as deprecated (keep for migration)
- Migration script to convert existing `debtId` links to bill links

**Implementation:**
1. Phase out `debtId` on transactions:
   - Stop accepting `debtId` in new transactions
   - Auto-convert to bill instance link when possible
   - Keep `debtId` field for backward compatibility during migration

2. Migration script:
   - Find transactions with `debtId` but no `billId`
   - Find corresponding bill (via `bills.debtId`)
   - Link transaction to appropriate bill instance
   - Log migrations for audit

**Note:** This is a gradual deprecation - `debtId` field remains but is no longer used for new transactions.

---

### Task 5.8: Auto-Match Transactions for `chargedToAccountId` Bills
**Files to modify:**
- `app/api/transactions/route.ts` - POST handler
- `lib/bills/bill-matching-helpers.ts` - Enhanced matching

**Implementation:**
1. When creating expense on account X:
   - Check for bills where `chargedToAccountId === X`
   - These are bills that auto-charge to this account (e.g., subscriptions)
   - Use enhanced matching (name, amount, date pattern)
   - Auto-link if confidence >= 85%

2. Matching criteria for `chargedToAccountId` bills:
   - Account must match `chargedToAccountId`
   - Amount within tolerance (default 5%)
   - Date within 3 days of expected due date
   - Description similarity (using existing Levenshtein matching)

---

### Task 5.9: Payment History Recording
**Files to modify:**
- `app/api/transactions/route.ts` - All payment scenarios
- `app/api/bills/instances/[id]/payments/route.ts` - New endpoint
- `components/bills/bill-payment-history.tsx` - New component

**Implementation:**
1. Create payment history API:
   - GET `/api/bills/[id]/payments` - Get all payments for a bill
   - GET `/api/bills/instances/[id]/payments` - Get payments for specific instance

2. All payment types create `billPayments` records:
   - Transfer to credit account (credit card payment)
   - Expense with bill instance selected
   - Manual "Mark as Paid" action
   - Auto-matched payments

3. Payment history component:
   - Shows payment timeline for bill
   - Principal vs interest breakdown for debts
   - Payment method (transfer, expense, autopay)
   - Linked transaction reference

---

## Database Changes

### New Fields (Migration Required)
```sql
-- Add to transactions table
ALTER TABLE transactions ADD COLUMN is_balance_transfer INTEGER DEFAULT 0;
ALTER TABLE transactions ADD COLUMN is_refund INTEGER DEFAULT 0;
```

### Migration File: `0044_phase5_transaction_fields.sql`
```sql
-- Phase 5: Transaction Flow Updates
-- Add fields to support balance transfers and refunds

ALTER TABLE transactions ADD COLUMN is_balance_transfer INTEGER DEFAULT 0;
ALTER TABLE transactions ADD COLUMN is_refund INTEGER DEFAULT 0;

-- Create indexes for new fields
CREATE INDEX IF NOT EXISTS idx_transactions_balance_transfer ON transactions(is_balance_transfer);
CREATE INDEX IF NOT EXISTS idx_transactions_refund ON transactions(is_refund);
```

---

## Implementation Order

1. **Task 5.5** - Partial Payment Handling (foundation for other tasks)
2. **Task 5.9** - Payment History Recording (used by all payment flows)
3. **Task 5.1** - Credit Card Payment Detection (core feature)
4. **Task 5.6** - Loan/Debt Bill Payments (leverages 5.5)
5. **Task 5.8** - Auto-Match for chargedToAccountId (leverages existing matching)
6. **Task 5.3** - Balance Transfers (needs schema change)
7. **Task 5.4** - Credit Card Refunds (needs schema change)
8. **Task 5.2** - Credit Card Purchase Display (polish)
9. **Task 5.7** - Remove Legacy Debt Linking (final cleanup)

---

## Testing Checklist

### Task 5.1: Credit Card Payments
- [ ] Transfer from checking to credit card auto-marks bill instance
- [ ] Payment within date tolerance is matched correctly
- [ ] Payment outside tolerance prompts for manual selection
- [ ] Bill instance status updates to 'paid'
- [ ] Credit card balance decreases correctly
- [ ] Bill payment record is created

### Task 5.3: Balance Transfers
- [ ] Transfer between credit cards shows "Balance Transfer" label
- [ ] Source card balance decreases (debt down)
- [ ] Destination card balance increases (debt up)
- [ ] No bill instance is auto-marked

### Task 5.4: Refunds
- [ ] Income on credit card decreases balance
- [ ] No bill instance is auto-marked for refunds
- [ ] Refund flag is set correctly

### Task 5.5: Partial Payments
- [ ] Partial payment updates `paidAmount` correctly
- [ ] `remainingAmount` is calculated correctly
- [ ] `paymentStatus` shows 'partial'
- [ ] Multiple partial payments accumulate
- [ ] Full payment after partial marks as 'paid'

### Task 5.6: Debt Bill Payments
- [ ] Principal/interest split is calculated
- [ ] Remaining balance is updated
- [ ] Milestones are checked/achieved
- [ ] Bill payment record includes breakdown

### Task 5.8: Auto-Match for chargedToAccountId
- [ ] Expenses on account match bills with that `chargedToAccountId`
- [ ] Matching respects amount tolerance
- [ ] Matching respects date tolerance
- [ ] Low confidence matches are not auto-linked

---

## Estimated Effort

| Task | Complexity | Estimated Time |
|------|------------|----------------|
| 5.1 | Medium | 3-4 hours |
| 5.2 | Low | 1 hour |
| 5.3 | Medium | 2-3 hours |
| 5.4 | Low | 1-2 hours |
| 5.5 | High | 4-5 hours |
| 5.6 | Medium | 3-4 hours |
| 5.7 | Medium | 2-3 hours |
| 5.8 | Medium | 2-3 hours |
| 5.9 | Medium | 3-4 hours |

**Total Estimated:** 22-29 hours (3-4 days)

---

## Dependencies

- **Phase 1-4 (COMPLETED):** Schema for bills, bill_payments, bill_instances with partial payment fields
- **Existing:** Bill matching logic in `lib/bills/`
- **Existing:** Transfer creation flow in transactions API
- **Existing:** Payment breakdown calculation in `lib/debts/`

---

## Files to Create

1. `lib/bills/bill-payment-utils.ts` - Central payment processing utility
2. `lib/bills/debt-payment-utils.ts` - Debt-specific payment calculations
3. `app/api/bills/[id]/payments/route.ts` - Bill payment history API
4. `app/api/bills/instances/[id]/payments/route.ts` - Instance payment history API
5. `components/bills/bill-payment-history.tsx` - Payment timeline component
6. `drizzle/0044_phase5_transaction_fields.sql` - Migration for new fields

## Files to Modify

1. `app/api/transactions/route.ts` - Core transaction creation logic
2. `components/transactions/transaction-form.tsx` - UI for payment types
3. `components/transactions/quick-transaction-modal.tsx` - Quick entry updates
4. `lib/bills/bill-matching-helpers.ts` - Enhanced matching for chargedToAccountId
5. `components/transfers/convert-to-transfer-modal.tsx` - Balance transfer support
6. `lib/db/schema.ts` - New transaction fields

