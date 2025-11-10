# Set Account Action - Implementation Plan
## Phase 2D - Complete Implementation

**Status:** Planning Complete - Ready for Implementation
**Priority:** 4 of 5 in Phase 2
**Estimated Time:** 6-8 hours (3 hours backend, 3 hours UI, 2 hours testing)
**Date:** 2025-11-10

---

## Overview

Implement the "Set Account" rule action, which allows rules to automatically move transactions to different accounts based on conditions. This is useful for:
- Correcting misclassified transactions (e.g., business expenses to business account)
- Auto-organizing transactions by account type (e.g., all dining to credit card)
- Routing specific merchants to specific accounts
- Applying account-based categorization rules

---

## Background & Context

### What is Set Account Action?

This action allows rules to change which account a transaction belongs to. For example:
- A rule could detect "Business Travel" in description and move to Business account
- A rule could detect transactions >$100 and move to primary checking
- A rule could detect specific merchants and route to their preferred payment account

### Account Balance Impact

**CRITICAL:** When changing accounts, we must update balances for BOTH accounts:
- **Old Account:** Reverse the transaction impact
  - Income: Subtract amount from balance
  - Expense: Add amount back to balance
  - Transfer: Complex - need special handling
- **New Account:** Apply the transaction impact
  - Income: Add amount to balance
  - Expense: Subtract amount from balance
  - Transfer: Complex - need special handling

### Transfer Handling

**Decision:** Do NOT allow moving transfer transactions via rules.
- Transfers have TWO linked transactions (transfer_out + transfer_in)
- Moving one side would break the link
- Too complex for automatic rule-based changes
- **Validation:** Reject set_account action if transaction type is transfer_out or transfer_in

---

## Backend Implementation

### Task 1: Account Change Handler

**File:** `lib/rules/account-action-handler.ts` (NEW FILE)
**Estimated Time:** 2 hours

**Purpose:** Handle account changes with proper balance updates

**Key Functions:**

#### 1. `handleAccountChange()` - Main orchestration
```typescript
export async function handleAccountChange(
  userId: string,
  transactionId: string,
  targetAccountId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. Fetch transaction
    const transaction = await db.query.transactions.findFirst({
      where: and(
        eq(transactions.id, transactionId),
        eq(transactions.userId, userId)
      )
    });

    if (!transaction) {
      return { success: false, error: 'Transaction not found' };
    }

    // 2. Validate not a transfer
    if (transaction.type === 'transfer_out' || transaction.type === 'transfer_in') {
      return { success: false, error: 'Cannot change account for transfer transactions' };
    }

    // 3. Validate target account exists and belongs to user
    const targetAccount = await db.query.accounts.findFirst({
      where: and(
        eq(accounts.id, targetAccountId),
        eq(accounts.userId, userId)
      )
    });

    if (!targetAccount) {
      return { success: false, error: 'Target account not found' };
    }

    // 4. If same account, do nothing
    if (transaction.accountId === targetAccountId) {
      return { success: true };
    }

    // 5. Calculate balance adjustments
    const amount = new Decimal(transaction.amount);
    const oldAccountId = transaction.accountId;

    // 6. Update account balances
    await updateAccountBalances(oldAccountId, targetAccountId, transaction.type, amount);

    // 7. Update transaction account
    await db.update(transactions)
      .set({ accountId: targetAccountId })
      .where(eq(transactions.id, transactionId));

    // 8. Log activity
    await logAccountChange(userId, transactionId, oldAccountId, targetAccountId, amount);

    return { success: true };
  } catch (error) {
    console.error('Account change failed:', error);
    return { success: false, error: 'Failed to change account' };
  }
}
```

#### 2. `updateAccountBalances()` - Balance adjustment
```typescript
async function updateAccountBalances(
  oldAccountId: string,
  newAccountId: string,
  transactionType: string,
  amount: Decimal
): Promise<void> {
  // Reverse impact on old account
  if (transactionType === 'income') {
    // Remove income from old account
    await db.update(accounts)
      .set({ balance: sql`balance - ${amount.toString()}` })
      .where(eq(accounts.id, oldAccountId));
  } else if (transactionType === 'expense') {
    // Add back expense to old account
    await db.update(accounts)
      .set({ balance: sql`balance + ${amount.toString()}` })
      .where(eq(accounts.id, oldAccountId));
  }

  // Apply impact to new account
  if (transactionType === 'income') {
    // Add income to new account
    await db.update(accounts)
      .set({ balance: sql`balance + ${amount.toString()}` })
      .where(eq(accounts.id, newAccountId));
  } else if (transactionType === 'expense') {
    // Subtract expense from new account
    await db.update(accounts)
      .set({ balance: sql`balance - ${amount.toString()}` })
      .where(eq(accounts.id, newAccountId));
  }
}
```

#### 3. `logAccountChange()` - Activity logging
```typescript
async function logAccountChange(
  userId: string,
  transactionId: string,
  oldAccountId: string,
  newAccountId: string,
  amount: Decimal
): Promise<void> {
  // Fetch account names
  const [oldAccount, newAccount] = await Promise.all([
    db.query.accounts.findFirst({ where: eq(accounts.id, oldAccountId) }),
    db.query.accounts.findFirst({ where: eq(accounts.id, newAccountId) })
  ]);

  // Log to household activity
  await db.insert(householdActivityLog).values({
    id: nanoid(),
    householdId: /* fetch from user */,
    userId,
    activityType: 'transaction_account_changed',
    description: `Moved transaction ($${amount.toFixed(2)}) from ${oldAccount?.name} to ${newAccount?.name}`,
    entityType: 'transaction',
    entityId: transactionId,
    metadata: JSON.stringify({
      oldAccountId,
      newAccountId,
      oldAccountName: oldAccount?.name,
      newAccountName: newAccount?.name,
      amount: amount.toString()
    }),
    createdAt: new Date()
  });
}
```

**Error Handling:**
- Non-fatal errors (log but don't break transaction creation)
- Detailed error messages for debugging
- Transaction rollback if balance update fails

---

### Task 2: Actions Executor Integration

**File:** `lib/rules/actions-executor.ts`
**Estimated Time:** 30 minutes

**Changes:**

Add `executeSetAccountAction` function:

```typescript
function executeSetAccountAction(
  action: RuleAction,
  transaction: Transaction,
  context: ActionExecutionContext
): AppliedAction | null {
  const targetAccountId = action.value;

  if (!targetAccountId) {
    console.error('Set account action missing target account ID');
    return null;
  }

  // Validate not a transfer
  if (transaction.type === 'transfer_out' || transaction.type === 'transfer_in') {
    console.error('Cannot change account for transfer transactions');
    return null;
  }

  // Store for post-creation processing
  context.mutations.changeAccount = {
    targetAccountId
  };

  return {
    type: 'set_account',
    field: 'accountId',
    oldValue: transaction.accountId,
    newValue: targetAccountId,
    appliedAt: new Date().toISOString()
  };
}
```

Add to main execution switch:
```typescript
case 'set_account':
  appliedAction = executeSetAccountAction(action, transaction, context);
  break;
```

---

### Task 3: Type Definitions Update

**File:** `lib/rules/types.ts`
**Estimated Time:** 10 minutes

**Changes:**

Add to `TransactionMutations`:
```typescript
interface TransactionMutations {
  // ... existing fields
  changeAccount?: {
    targetAccountId: string;
  };
}
```

Add to `AppliedAction` field types:
```typescript
field?:
  | 'categoryId'
  | 'description'
  | 'merchantId'
  | 'isTaxDeductible'
  | 'accountId'  // NEW
  | 'isSplit'
  | 'transferId';
```

---

### Task 4: API Integration

**Files:**
- `app/api/transactions/route.ts` (transaction creation)
- `app/api/rules/apply-bulk/route.ts` (bulk apply)

**Estimated Time:** 30 minutes

**Changes:**

Add post-creation check for `changeAccount` in mutations:

```typescript
// After transaction insert
if (executionResult.mutations.changeAccount) {
  const accountResult = await handleAccountChange(
    userId,
    transactionId,
    executionResult.mutations.changeAccount.targetAccountId
  );

  if (!accountResult.success) {
    console.error('Account change failed:', accountResult.error);
    // Don't fail the transaction, just log
  }
}
```

---

## Frontend Implementation

### Task 5: Add to Action Type Selector

**File:** `components/rules/rule-builder.tsx`
**Estimated Time:** 15 minutes

**Changes:**

Add to action type selector (around line 544):
```tsx
<SelectItem value="set_account">
  <div className="flex items-center gap-2">
    <Banknote className="h-4 w-4" />
    Set Account
  </div>
</SelectItem>
```

Import Banknote icon from lucide-react.

---

### Task 6: Account Configuration UI

**File:** `components/rules/rule-builder.tsx`
**Estimated Time:** 2 hours

**This is the main UI component!**

Add after create_split section (around line 1122):

```tsx
{action.type === 'set_account' && (
  <div className="flex-1 space-y-4">
    {/* Account Selector */}
    <div className="space-y-2">
      <Label className="text-sm text-foreground">Target Account</Label>
      <Select
        value={action.value || ''}
        onValueChange={(value) => updateAction(index, { ...action, value })}
      >
        <SelectTrigger className="bg-input border-border">
          <SelectValue placeholder="Select account">
            {action.value && accounts.find(a => a.id === action.value)?.name}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {loadingData ? (
            <div className="p-2 text-sm text-muted-foreground">Loading...</div>
          ) : accounts.length > 0 ? (
            accounts.map((account) => (
              <SelectItem key={account.id} value={account.id}>
                <div className="flex items-center gap-2">
                  {account.color && (
                    <div
                      className="w-3 h-3 rounded-full border border-border"
                      style={{ backgroundColor: account.color }}
                    />
                  )}
                  <span className="text-foreground">{account.name}</span>
                  <span className="text-xs text-muted-foreground">
                    ({account.type})
                  </span>
                </div>
              </SelectItem>
            ))
          ) : (
            <div className="p-2 text-sm text-muted-foreground">No accounts found</div>
          )}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">
        Transactions matching this rule will be moved to this account
      </p>
    </div>

    {/* Warning Box */}
    <div className="flex items-start gap-2 bg-[var(--color-warning)]/10 border border-[var(--color-warning)]/30 rounded-lg p-3">
      <AlertCircle className="h-4 w-4 text-[var(--color-warning)] mt-0.5 flex-shrink-0" />
      <div className="flex-1">
        <p className="text-xs text-foreground">
          <strong>Important:</strong> Changing an account will update account balances automatically.
          Transfer transactions cannot be moved between accounts.
        </p>
      </div>
    </div>

    {/* Information Box */}
    <div className="flex items-start gap-2 bg-elevated rounded-lg p-3">
      <Lightbulb className="h-4 w-4 text-[var(--color-primary)] mt-0.5 flex-shrink-0" />
      <div className="flex-1">
        <p className="text-xs text-foreground leading-relaxed">
          <strong>How it works:</strong> This action moves transactions to a different account.
          Use this to automatically route transactions to the correct account based on merchant,
          amount, or other criteria. Account balances are updated automatically.
        </p>
      </div>
    </div>

    {/* Use Case Examples */}
    <div className="space-y-2">
      <Label className="text-sm text-foreground">Common Use Cases:</Label>
      <div className="space-y-1 text-xs text-muted-foreground pl-3">
        <p>• Move all business expenses to business account</p>
        <p>• Route specific merchants to preferred payment card</p>
        <p>• Organize transactions by account type automatically</p>
        <p>• Correct misclassified transactions by amount threshold</p>
      </div>
    </div>
  </div>
)}
```

**Key Features:**
- Account selector with color indicators
- Account type display
- Warning about balance updates and transfer restrictions
- Educational info box
- Common use case examples
- Full theme integration

---

### Task 7: Rules Manager Display

**File:** `components/rules/rules-manager.tsx`
**Estimated Time:** 15 minutes

**Changes:**

1. Import Banknote icon:
```typescript
import { ..., Banknote } from 'lucide-react';
```

2. Update `getActionLabel` function:
```typescript
case 'set_account':
  return accountName ? `Move to ${accountName}` : 'Set Account';
```

Note: Need to fetch account name in the rules list API to pass it here.

3. Add icon display:
```tsx
{rule.actions[0].type === 'set_account' && <Banknote className="w-3 h-3 mr-1 text-[var(--color-primary)]" />}
```

---

### Task 8: Validation

**File:** `app/dashboard/rules/page.tsx`
**Estimated Time:** 10 minutes

**Changes:**

Add to action validation (after create_split validation):

```typescript
// Validate set_account actions
if (action.type === 'set_account') {
  if (!action.value) {
    toast.error('Please select a target account for set_account action');
    return;
  }
}
```

---

### Task 9: API Enhancement - Fetch Account Names

**File:** `app/api/rules/route.ts`
**Estimated Time:** 30 minutes

**Changes:**

Update GET handler to fetch account names for set_account actions:

```typescript
// For each rule with set_account action
if (rule.actions) {
  for (const action of rule.actions) {
    if (action.type === 'set_account' && action.value) {
      const account = await db.query.accounts.findFirst({
        where: eq(accounts.id, action.value)
      });
      // Store account name for display
      action.accountName = account?.name;
    }
  }
}
```

---

## Implementation Order

### Phase 1: Backend Foundation (2.5 hours)
1. Create `lib/rules/account-action-handler.ts`
   - handleAccountChange function
   - updateAccountBalances helper
   - logAccountChange helper
2. Update `lib/rules/actions-executor.ts`
   - Add executeSetAccountAction
3. Update `lib/rules/types.ts`
   - Add changeAccount to TransactionMutations
   - Add accountId to AppliedAction field types

### Phase 2: API Integration (1 hour)
4. Update transaction creation API
5. Update bulk apply rules API
6. Update rules GET API to fetch account names
7. Test with Postman/curl

### Phase 3: UI Implementation (3 hours)
8. Add action type to selector
9. Add account configuration UI
10. Add use case examples
11. Update rules manager display
12. Add validation to rules page
13. Style with theme variables

### Phase 4: Testing (1.5 hours)
14. Test complete flow
15. Test balance updates
16. Test transfer rejection
17. Test with different account types
18. Production build verification

---

## Testing Checklist

### Backend Testing:
- [ ] Change account for income transaction (balance updates correctly)
- [ ] Change account for expense transaction (balance updates correctly)
- [ ] Reject transfer_out transaction
- [ ] Reject transfer_in transaction
- [ ] Reject invalid target account ID
- [ ] Reject account from different user
- [ ] Handle same account (no-op)
- [ ] Activity log created correctly
- [ ] Balance calculations use Decimal.js

### UI Testing:
- [ ] Add set_account action to rule
- [ ] Select target account
- [ ] Account selector shows color indicators
- [ ] Account selector shows account type
- [ ] Warning box displays correctly
- [ ] Info box displays correctly
- [ ] Use case examples display
- [ ] Validation prevents saving without account
- [ ] Theme integration (Dark Mode)
- [ ] Theme integration (Dark Pink Theme)
- [ ] Save rule with set_account
- [ ] Edit rule with set_account
- [ ] Display in rules list with icon

### Integration Testing:
- [ ] Create transaction matching rule with set_account
- [ ] Verify transaction moved to correct account
- [ ] Verify old account balance updated
- [ ] Verify new account balance updated
- [ ] Bulk apply rules with set_account
- [ ] Verify account changes in transaction list
- [ ] Verify activity log entries

---

## Success Criteria

This feature is complete when:

1. ✅ Backend can change transaction accounts with proper balance updates
2. ✅ API integration works for transaction creation
3. ✅ API integration works for bulk apply
4. ✅ Transfer transactions are properly rejected
5. ✅ UI allows selecting target account with color indicators
6. ✅ Validation prevents invalid configurations
7. ✅ Rules manager displays set_account action correctly
8. ✅ Activity log tracks account changes
9. ✅ Full theme integration with semantic variables
10. ✅ Production build succeeds with zero errors
11. ✅ End-to-end flow works: rule creation → transaction → account changed
12. ✅ Account balances reflect changes accurately

---

## Edge Cases to Handle

1. **Same Account:** If target account = current account → no-op (success)
2. **Deleted Account:** If target account deleted → validation prevents saving
3. **Transfer Transactions:** Always reject with clear error message
4. **Split Transactions:** Allow (splits stay with transaction)
5. **Balance Precision:** Use Decimal.js for all calculations
6. **Concurrent Updates:** Use SQL transactions if needed
7. **Account Not Found:** Clear error message
8. **Permission Check:** Verify user owns both accounts

---

## Database Schema

No schema changes needed! We use existing fields:
- `transactions.accountId` - Updated to new account
- `accounts.balance` - Updated for both old and new accounts
- `householdActivityLog` - New entry for account change

---

## Files to Create/Modify

### New Files:
1. `lib/rules/account-action-handler.ts` (~250 lines)

### Modified Files:
1. `lib/rules/actions-executor.ts` (~40 lines added)
2. `lib/rules/types.ts` (~5 lines added)
3. `components/rules/rule-builder.tsx` (~80 lines added)
4. `components/rules/rules-manager.tsx` (~10 lines modified)
5. `app/dashboard/rules/page.tsx` (~10 lines added)
6. `app/api/transactions/route.ts` (~15 lines added)
7. `app/api/rules/apply-bulk/route.ts` (~15 lines added)
8. `app/api/rules/route.ts` (~20 lines modified)

**Total New/Modified Lines:** ~445 lines

---

## Theme Integration Reference

**Colors:**
- `bg-elevated` - Info boxes
- `bg-input` - Account selector
- `border-border` - All borders
- `text-foreground` - Primary text
- `text-muted-foreground` - Helper text
- `text-[var(--color-primary)]` - Lightbulb, icon
- `text-[var(--color-warning)]` - Warning box
- `bg-[var(--color-warning)]/10` - Warning background

**Icons:**
- Banknote - Main action icon (lucide-react)
- AlertCircle - Warning indicator
- Lightbulb - Information/tips

---

## Risk Mitigation

**High-Risk Areas:**

1. **Balance Calculations:** Incorrect balance updates could corrupt data
   - **Mitigation:** Use Decimal.js, comprehensive unit tests, SQL transactions

2. **Transfer Handling:** Moving transfers could break linkage
   - **Mitigation:** Hard validation block, clear error messages

3. **Concurrent Updates:** Multiple rules changing same transaction
   - **Mitigation:** Process rules sequentially, not in parallel

**Rollback Plan:**

If critical issues arise:
1. Disable set_account action in UI (remove from selector)
2. Backend remains available for manual account changes
3. Fix issues and re-enable
4. Can write migration script to reverse bad account changes if needed

---

## Performance Considerations

- **Balance Updates:** Two UPDATE queries per account change
- **Activity Logging:** One INSERT per account change
- **Account Lookup:** Use existing query (already fetched for accounts list)
- **Optimization:** Could batch balance updates in bulk apply scenarios

---

## Ready to Start! 🚀

This plan provides complete specifications for implementing the Set Account action. The implementation is straightforward and builds on patterns established in previous action types.

**Estimated Total Time:** 6-8 hours
**Complexity:** Medium (balance updates add complexity)
**Dependencies:** None (all dependencies already implemented)

Let's build this feature!
