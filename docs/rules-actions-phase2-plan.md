# Rules Actions System - Phase 2 Implementation Plan
## Advanced Actions: Transfers, Splits, Accounts & Tax Deductions

### Overview
Phase 2 extends the rules system to support complex transaction modifications:
- Setting tax deduction status
- Converting transactions to transfers with intelligent matching
- Automatically splitting transactions across multiple categories
- Changing transaction accounts
- Enhanced transfer matching suggestions

**Status:** Planning Complete - Ready for Implementation
**Prerequisites:** Phase 1 Complete ✅ (all basic actions working)
**Estimated Timeline:** 10-12 days

---

## Architecture Analysis

### Current Capabilities (Phase 1)
✅ Set category
✅ Set/modify description (with pattern variables)
✅ Set merchant
✅ Actions executor framework
✅ Rule matching engine
✅ Audit logging (appliedActions)

### Existing Infrastructure to Leverage
✅ **Transfer System:**
  - `convert-to-transfer` API endpoint (app/api/transactions/[id]/convert-to-transfer/route.ts)
  - Modal component with matching logic (components/transactions/convert-to-transfer-modal.tsx)
  - Transfer matching: ±1% amount, ±7 days, opposite type detection
  - Linked transaction creation (transfer_out + transfer_in pairs)
  - Account balance updates

✅ **Split System:**
  - `transactionSplits` table with categoryId, amount, percentage, description
  - Full CRUD API (app/api/transactions/[id]/splits/route.ts)
  - Split editor components
  - Percentage and fixed amount support
  - Sort order management

✅ **Tax System:**
  - Categories have `isTaxDeductible` flag
  - Tax categories, mappings, classifications tables
  - Tax dashboard and reporting

✅ **Account System:**
  - Account balance tracking
  - Transaction-account relationship
  - Account change triggers balance recalculation

---

## Phase 2 Features & Priority Order

### Priority 1: Set Tax Deduction Action (Simplest - 2 days)
**Rationale:** Straightforward boolean flag, no complex logic, leverages existing tax infrastructure

### Priority 2: Convert to Transfer Action (4 days)
**Rationale:** Leverages existing convert-to-transfer logic, high user value

### Priority 3: Create Split Action (3 days)
**Rationale:** Leverages existing split system, moderately complex configuration

### Priority 4: Set Account Action (2-3 days)
**Rationale:** Requires careful balance management, moderate complexity

### Priority 5: Enhanced Transfer Matching (1-2 days)
**Rationale:** Polishing existing functionality, lower priority

---

## Detailed Implementation Tasks

---

## PRIORITY 1: Set Tax Deduction Action

### Task 1.1: Backend - Tax Deduction Action Executor
**File:** `lib/rules/actions-executor.ts`
**Estimated Time:** 2 hours

**Changes:**
```typescript
/**
 * Execute a set_tax_deduction action
 * Marks transaction as tax deductible based on category setting
 */
async function executeSetTaxDeductionAction(
  action: RuleAction,
  context: ActionExecutionContext,
  mutations: TransactionMutations
): Promise<AppliedAction | null> {
  // Get category's tax deductible status
  const categoryId = mutations.categoryId || context.transaction.categoryId;

  if (!categoryId) {
    return null; // Can't set tax deduction without a category
  }

  // Fetch category to check isTaxDeductible flag
  const category = await db
    .select()
    .from(budgetCategories)
    .where(
      and(
        eq(budgetCategories.id, categoryId),
        eq(budgetCategories.userId, context.userId)
      )
    )
    .limit(1);

  if (category.length === 0 || !category[0].isTaxDeductible) {
    return null; // Category not tax deductible
  }

  // Set mutation
  const originalValue = context.transaction.isTaxDeductible || false;
  mutations.isTaxDeductible = true;

  return {
    type: 'set_tax_deduction',
    field: 'isTaxDeductible',
    originalValue: originalValue.toString(),
    newValue: 'true',
  };
}
```

**Integration Points:**
- Add to main `executeRuleActions()` function
- Update validation to allow `set_tax_deduction` type
- Add to transaction creation API mutation application

**Testing:**
- Unit test: action sets isTaxDeductible = true
- Unit test: skips if category not tax deductible
- Unit test: skips if no category set
- Integration test: transaction created with tax deduction via rule

---

### Task 1.2: Database Schema - Add isTaxDeductible to Transactions
**File:** `lib/db/schema.ts`
**Estimated Time:** 1 hour

**Changes:**
```typescript
export const transactions = sqliteTable(
  'transactions',
  {
    // ... existing fields
    isTaxDeductible: integer('is_tax_deductible', { mode: 'boolean' }).default(false),
    // ... rest of fields
  }
);
```

**Migration:**
```sql
-- Migration: 00XX_add_transaction_tax_deduction.sql
ALTER TABLE transactions ADD COLUMN is_tax_deductible INTEGER DEFAULT 0;
```

**Note:** Verify if this field already exists in schema before creating migration!

---

### Task 1.3: Frontend - Tax Deduction Action UI
**File:** `components/rules/rule-builder.tsx`
**Estimated Time:** 2 hours

**Changes:**
Add tax deduction action type to selector:
```tsx
<SelectItem value="set_tax_deduction">
  <div className="flex items-center gap-2">
    <FileText className="h-4 w-4" />
    Mark as Tax Deductible
  </div>
</SelectItem>
```

**Configuration UI:**
```tsx
{action.type === 'set_tax_deduction' && (
  <div className="flex-1 bg-elevated rounded-lg p-3">
    <div className="flex items-start gap-2">
      <AlertCircle className="h-4 w-4 text-[var(--color-warning)] mt-0.5" />
      <div className="flex-1">
        <p className="text-sm text-foreground">
          This action will mark transactions as tax deductible if their category is configured as tax deductible.
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Requires a category to be set (either manually or via a set_category action).
        </p>
      </div>
    </div>
  </div>
)}
```

**Theme Integration:**
- Use `text-[var(--color-warning)]` for alert icon
- Use `bg-elevated` for info box
- Use `text-foreground` and `text-muted-foreground` for text

---

### Task 1.4: Testing - Tax Deduction Action
**Estimated Time:** 2 hours

**Test Cases:**
1. ✅ Creates transaction with tax deduction when category is tax deductible
2. ✅ Skips tax deduction when category is not tax deductible
3. ✅ Skips tax deduction when no category is set
4. ✅ Works with set_category action in same rule
5. ✅ Audit log records tax deduction action
6. ✅ Bulk apply sets tax deduction on matching transactions

---

## PRIORITY 2: Convert to Transfer Action

### Task 2.1: Backend - Transfer Conversion Action Executor
**File:** `lib/rules/actions-executor.ts`
**Estimated Time:** 4 hours

**Action Configuration:**
```typescript
{
  type: 'convert_to_transfer',
  config: {
    targetAccountId?: string,        // Specific account (optional)
    autoMatch: boolean,               // Auto-match with existing transaction
    matchTolerance: number,           // Amount tolerance % (default 1%)
    matchDayRange: number,            // Date range in days (default 7)
    createIfNoMatch: boolean,         // Create transfer_in if no match found
  }
}
```

**Implementation:**
```typescript
/**
 * Execute a convert_to_transfer action
 * Converts transaction to transfer, optionally matching with existing transaction
 */
async function executeConvertToTransferAction(
  action: RuleAction,
  context: ActionExecutionContext,
  mutations: TransactionMutations
): Promise<AppliedAction | null> {
  const config = action.config || {};

  // Validate: can't convert if already a transfer
  if (context.transaction.type === 'transfer_in' || context.transaction.type === 'transfer_out') {
    return null;
  }

  // Store conversion request in mutations
  // Actual conversion happens AFTER transaction is created
  mutations.convertToTransfer = {
    targetAccountId: config.targetAccountId,
    autoMatch: config.autoMatch ?? true,
    matchTolerance: config.matchTolerance ?? 1,
    matchDayRange: config.matchDayRange ?? 7,
    createIfNoMatch: config.createIfNoMatch ?? true,
  };

  return {
    type: 'convert_to_transfer',
    field: 'type',
    originalValue: context.transaction.type,
    newValue: 'transfer_out',
  };
}
```

**Note:** Transfer conversion is a **post-creation action** because:
1. Need transaction ID to create matching pair
2. Requires account balance updates
3. May need to match/link with existing transaction

---

### Task 2.2: Backend - Post-Creation Transfer Handler
**File:** `lib/rules/transfer-action-handler.ts` (NEW FILE)
**Estimated Time:** 4 hours

**Purpose:** Handle transfer conversion AFTER transaction creation

```typescript
import { db } from '@/lib/db';
import { transactions, accounts } from '@/lib/db/schema';
import { eq, and, between } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import Decimal from 'decimal.js';

interface TransferConversionConfig {
  targetAccountId?: string;
  autoMatch: boolean;
  matchTolerance: number;
  matchDayRange: number;
  createIfNoMatch: boolean;
}

export async function handleTransferConversion(
  userId: string,
  transactionId: string,
  config: TransferConversionConfig
): Promise<{
  success: boolean;
  matchedTransactionId?: string;
  createdTransactionId?: string;
  error?: string;
}> {
  // 1. Fetch the source transaction
  const sourceTx = await db
    .select()
    .from(transactions)
    .where(
      and(
        eq(transactions.id, transactionId),
        eq(transactions.userId, userId)
      )
    )
    .limit(1);

  if (sourceTx.length === 0) {
    return { success: false, error: 'Transaction not found' };
  }

  const transaction = sourceTx[0];

  // 2. If autoMatch enabled, search for matching transaction
  let matchedTx = null;
  if (config.autoMatch) {
    matchedTx = await findMatchingTransaction(
      userId,
      transaction,
      config.targetAccountId,
      config.matchTolerance,
      config.matchDayRange
    );
  }

  // 3. Generate transfer ID
  const transferId = nanoid();

  // 4. Convert source transaction to transfer_out
  await db
    .update(transactions)
    .set({
      type: transaction.type === 'income' ? 'transfer_in' : 'transfer_out',
      transferId: transferId,
    })
    .where(eq(transactions.id, transactionId));

  // 5. Handle matched or create new transfer pair
  if (matchedTx) {
    // Link with matched transaction
    await db
      .update(transactions)
      .set({
        type: transaction.type === 'income' ? 'transfer_out' : 'transfer_in',
        transferId: transferId,
      })
      .where(eq(transactions.id, matchedTx.id));

    return {
      success: true,
      matchedTransactionId: matchedTx.id,
    };
  } else if (config.createIfNoMatch && config.targetAccountId) {
    // Create new transfer pair
    const newTxId = nanoid();
    const newType = transaction.type === 'income' ? 'transfer_out' : 'transfer_in';

    await db.insert(transactions).values({
      id: newTxId,
      userId: userId,
      accountId: config.targetAccountId,
      date: transaction.date,
      amount: transaction.amount,
      description: transaction.description,
      notes: `Auto-created transfer pair from rule action`,
      type: newType,
      transferId: transferId,
      createdAt: new Date().toISOString(),
    });

    // Update account balances
    await updateAccountBalances(
      userId,
      transaction.accountId,
      config.targetAccountId,
      transaction.amount,
      transaction.type
    );

    return {
      success: true,
      createdTransactionId: newTxId,
    };
  }

  return { success: true };
}

async function findMatchingTransaction(
  userId: string,
  sourceTx: any,
  targetAccountId: string | undefined,
  tolerance: number,
  dayRange: number
): Promise<any | null> {
  // Reuse existing matching logic from convert-to-transfer modal
  const txDate = new Date(sourceTx.date);
  const startDate = new Date(txDate);
  startDate.setDate(startDate.getDate() - dayRange);
  const endDate = new Date(txDate);
  endDate.setDate(endDate.getDate() + dayRange);

  const oppositeType = sourceTx.type === 'expense' ? 'income' : 'expense';
  const txAmount = new Decimal(sourceTx.amount);
  const toleranceAmount = txAmount.times(tolerance / 100);

  // Query candidates
  let query = db
    .select()
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.type, oppositeType),
        between(
          transactions.date,
          startDate.toISOString().split('T')[0],
          endDate.toISOString().split('T')[0]
        )
      )
    );

  if (targetAccountId) {
    query = query.where(eq(transactions.accountId, targetAccountId));
  }

  const candidates = await query.limit(50);

  // Filter by amount tolerance
  const matches = candidates.filter((tx) => {
    const candidateAmount = new Decimal(tx.amount);
    const diff = candidateAmount.minus(txAmount).abs();
    return diff.lessThanOrEqualTo(toleranceAmount);
  });

  // Return best match (closest amount and date)
  if (matches.length === 0) return null;

  return matches.sort((a, b) => {
    const aDiff = Math.abs(new Date(a.date).getTime() - txDate.getTime());
    const bDiff = Math.abs(new Date(b.date).getTime() - txDate.getTime());
    return aDiff - bDiff;
  })[0];
}

async function updateAccountBalances(
  userId: string,
  sourceAccountId: string,
  targetAccountId: string,
  amount: number,
  sourceType: string
): Promise<void> {
  const amountDecimal = new Decimal(amount);

  if (sourceType === 'expense') {
    // Expense -> Transfer Out: source loses money, target gains money
    await db
      .update(accounts)
      .set({
        currentBalance: db.raw(`current_balance - ${amountDecimal.toFixed(2)}`),
      })
      .where(eq(accounts.id, sourceAccountId));

    await db
      .update(accounts)
      .set({
        currentBalance: db.raw(`current_balance + ${amountDecimal.toFixed(2)}`),
      })
      .where(eq(accounts.id, targetAccountId));
  } else {
    // Income -> Transfer In: source gains money, target loses money
    await db
      .update(accounts)
      .set({
        currentBalance: db.raw(`current_balance + ${amountDecimal.toFixed(2)}`),
      })
      .where(eq(accounts.id, sourceAccountId));

    await db
      .update(accounts)
      .set({
        currentBalance: db.raw(`current_balance - ${amountDecimal.toFixed(2)}`),
      })
      .where(eq(accounts.id, targetAccountId));
  }
}
```

---

### Task 2.3: Backend - Integrate Transfer Action with Transaction API
**File:** `app/api/transactions/route.ts`
**Estimated Time:** 2 hours

**Changes:**
After transaction creation, check for `convertToTransfer` in mutations:
```typescript
// After transaction insert
if (executionResult.mutations.convertToTransfer) {
  // Execute transfer conversion asynchronously
  const transferResult = await handleTransferConversion(
    userId,
    transactionId,
    executionResult.mutations.convertToTransfer
  );

  if (!transferResult.success) {
    console.error('Transfer conversion failed:', transferResult.error);
    // Don't fail the transaction, just log
  }
}
```

---

### Task 2.4: Frontend - Transfer Action Configuration UI
**File:** `components/rules/rule-builder.tsx`
**Estimated Time:** 3 hours

**Action Selector:**
```tsx
<SelectItem value="convert_to_transfer">
  <div className="flex items-center gap-2">
    <ArrowRightLeft className="h-4 w-4" />
    Convert to Transfer
  </div>
</SelectItem>
```

**Configuration UI:**
```tsx
{action.type === 'convert_to_transfer' && (
  <div className="flex-1 space-y-3">
    {/* Target Account Selector */}
    <div className="space-y-2">
      <Label className="text-sm text-foreground">Target Account (Optional)</Label>
      <Select
        value={action.config?.targetAccountId || ''}
        onValueChange={(val) =>
          updateActionConfig(index, { ...action.config, targetAccountId: val })
        }
      >
        <SelectTrigger className="bg-input border-border">
          <SelectValue placeholder="Auto-detect or select account" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">Auto-detect</SelectItem>
          {accounts.map((acc) => (
            <SelectItem key={acc.id} value={acc.id}>
              {acc.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">
        Leave blank to auto-match with any account
      </p>
    </div>

    {/* Auto-Match Toggle */}
    <div className="flex items-center justify-between bg-elevated rounded-lg p-3">
      <div className="flex-1">
        <Label className="text-sm text-foreground">Auto-Match with Existing Transaction</Label>
        <p className="text-xs text-muted-foreground mt-1">
          Search for matching transaction to link as transfer pair
        </p>
      </div>
      <Switch
        checked={action.config?.autoMatch ?? true}
        onCheckedChange={(checked) =>
          updateActionConfig(index, { ...action.config, autoMatch: checked })
        }
      />
    </div>

    {/* Advanced Options (Collapsible) */}
    {action.config?.autoMatch && (
      <div className="space-y-3 border-l-2 border-border pl-4">
        <div className="space-y-2">
          <Label className="text-sm text-foreground">Amount Tolerance (%)</Label>
          <Input
            type="number"
            min="0"
            max="10"
            step="0.1"
            value={action.config?.matchTolerance || 1}
            onChange={(e) =>
              updateActionConfig(index, {
                ...action.config,
                matchTolerance: parseFloat(e.target.value),
              })
            }
            className="bg-input border-border"
          />
          <p className="text-xs text-muted-foreground">
            Allow amount difference (default 1%)
          </p>
        </div>

        <div className="space-y-2">
          <Label className="text-sm text-foreground">Date Range (days)</Label>
          <Input
            type="number"
            min="1"
            max="30"
            value={action.config?.matchDayRange || 7}
            onChange={(e) =>
              updateActionConfig(index, {
                ...action.config,
                matchDayRange: parseInt(e.target.value),
              })
            }
            className="bg-input border-border"
          />
          <p className="text-xs text-muted-foreground">
            Search ±N days from transaction date (default 7)
          </p>
        </div>

        <div className="flex items-center justify-between bg-card rounded-lg p-3 border border-border">
          <div className="flex-1">
            <Label className="text-sm text-foreground">Create Transfer Pair if No Match</Label>
            <p className="text-xs text-muted-foreground mt-1">
              Auto-create matching transaction if none found
            </p>
          </div>
          <Switch
            checked={action.config?.createIfNoMatch ?? true}
            onCheckedChange={(checked) =>
              updateActionConfig(index, { ...action.config, createIfNoMatch: checked })
            }
          />
        </div>
      </div>
    )}
  </div>
)}
```

**Theme Integration:**
- All controls use semantic color variables
- Use `bg-elevated` for nested sections
- Use `border-border` for borders
- Use Lucide icons (ArrowRightLeft)

---

### Task 2.5: Testing - Convert to Transfer Action
**Estimated Time:** 3 hours

**Test Cases:**
1. ✅ Converts expense to transfer_out with target account
2. ✅ Auto-matches with existing opposite transaction
3. ✅ Creates new transfer pair if no match found
4. ✅ Updates account balances correctly
5. ✅ Respects amount tolerance and date range
6. ✅ Links transactions with transferId
7. ✅ Works in bulk apply rules
8. ✅ Handles edge cases (no target account, no matches, etc.)

---

## PRIORITY 3: Create Split Action

### Task 3.1: Backend - Split Action Executor
**File:** `lib/rules/actions-executor.ts`
**Estimated Time:** 3 hours

**Action Configuration:**
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

**Implementation:**
```typescript
/**
 * Execute a create_split action
 * Creates transaction splits with specified categories and amounts
 */
async function executeCreateSplitAction(
  action: RuleAction,
  context: ActionExecutionContext,
  mutations: TransactionMutations
): Promise<AppliedAction | null> {
  const config = action.config || {};

  if (!config.splits || !Array.isArray(config.splits) || config.splits.length === 0) {
    return null;
  }

  // Validate split configuration
  const totalPercentage = config.splits
    .filter((s: any) => s.isPercentage)
    .reduce((sum: number, s: any) => sum + (s.percentage || 0), 0);

  if (totalPercentage > 100) {
    throw new Error('Total split percentage cannot exceed 100%');
  }

  // Store split request in mutations
  // Actual split creation happens AFTER transaction is created
  mutations.createSplits = config.splits;

  return {
    type: 'create_split',
    field: 'isSplit',
    originalValue: 'false',
    newValue: 'true',
  };
}
```

---

### Task 3.2: Backend - Post-Creation Split Handler
**File:** `lib/rules/split-action-handler.ts` (NEW FILE)
**Estimated Time:** 3 hours

```typescript
import { db } from '@/lib/db';
import { transactions, transactionSplits, budgetCategories } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import Decimal from 'decimal.js';

interface SplitConfig {
  categoryId: string;
  amount?: number;
  percentage?: number;
  isPercentage: boolean;
  description?: string;
}

export async function handleSplitCreation(
  userId: string,
  transactionId: string,
  splits: SplitConfig[]
): Promise<{
  success: boolean;
  createdSplits: string[];
  error?: string;
}> {
  // 1. Fetch transaction
  const txResult = await db
    .select()
    .from(transactions)
    .where(
      and(
        eq(transactions.id, transactionId),
        eq(transactions.userId, userId)
      )
    )
    .limit(1);

  if (txResult.length === 0) {
    return { success: false, createdSplits: [], error: 'Transaction not found' };
  }

  const transaction = txResult[0];
  const totalAmount = new Decimal(transaction.amount);

  // 2. Validate categories exist
  const categoryIds = splits.map((s) => s.categoryId);
  const categories = await db
    .select()
    .from(budgetCategories)
    .where(
      and(
        eq(budgetCategories.userId, userId),
        // @ts-ignore - Drizzle typing issue with inArray
        budgetCategories.id.in(categoryIds)
      )
    );

  if (categories.length !== categoryIds.length) {
    return { success: false, createdSplits: [], error: 'Some categories not found' };
  }

  // 3. Calculate split amounts
  const calculatedSplits = splits.map((split, index) => {
    let amount: number;
    if (split.isPercentage && split.percentage) {
      amount = totalAmount.times(split.percentage).dividedBy(100).toNumber();
    } else {
      amount = split.amount || 0;
    }

    return {
      id: nanoid(),
      userId: userId,
      transactionId: transactionId,
      categoryId: split.categoryId,
      amount: amount,
      percentage: split.isPercentage ? split.percentage : null,
      isPercentage: split.isPercentage,
      description: split.description || null,
      notes: null,
      sortOrder: index,
      createdAt: new Date().toISOString(),
    };
  });

  // 4. Validate total doesn't exceed transaction amount
  const splitTotal = calculatedSplits.reduce(
    (sum, s) => sum.plus(s.amount),
    new Decimal(0)
  );

  if (splitTotal.greaterThan(totalAmount)) {
    return {
      success: false,
      createdSplits: [],
      error: 'Split total exceeds transaction amount',
    };
  }

  // 5. Insert splits
  await db.insert(transactionSplits).values(calculatedSplits);

  // 6. Mark transaction as split
  await db
    .update(transactions)
    .set({ isSplit: true })
    .where(eq(transactions.id, transactionId));

  return {
    success: true,
    createdSplits: calculatedSplits.map((s) => s.id),
  };
}
```

---

### Task 3.3: Frontend - Split Action Configuration UI
**File:** `components/rules/rule-builder.tsx`
**Estimated Time:** 4 hours

**Action Selector:**
```tsx
<SelectItem value="create_split">
  <div className="flex items-center gap-2">
    <ScissorsIcon className="h-4 w-4" />
    Split Transaction
  </div>
</SelectItem>
```

**Configuration UI (Complex):**
```tsx
{action.type === 'create_split' && (
  <div className="flex-1 space-y-3">
    <div className="flex items-center justify-between">
      <Label className="text-sm text-foreground">Split Configuration</Label>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => addSplit(index)}
        className="h-8"
      >
        <Plus className="h-3 w-3 mr-1" />
        Add Split
      </Button>
    </div>

    {/* Split Items */}
    {(action.config?.splits || []).map((split: any, splitIndex: number) => (
      <div
        key={splitIndex}
        className="bg-elevated rounded-lg p-3 space-y-3 border border-border"
      >
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-foreground">
            Split {splitIndex + 1}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => removeSplit(index, splitIndex)}
            className="h-6 w-6 p-0 hover:bg-destructive/10 hover:text-destructive"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>

        {/* Category Selector */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Category</Label>
          <Select
            value={split.categoryId || ''}
            onValueChange={(val) =>
              updateSplitField(index, splitIndex, 'categoryId', val)
            }
          >
            <SelectTrigger className="bg-input border-border">
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>
                  {cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Amount Type Toggle */}
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant={split.isPercentage ? 'outline' : 'default'}
            size="sm"
            onClick={() =>
              updateSplitField(index, splitIndex, 'isPercentage', false)
            }
            className="flex-1"
          >
            <DollarSign className="h-3 w-3 mr-1" />
            Fixed Amount
          </Button>
          <Button
            type="button"
            variant={split.isPercentage ? 'default' : 'outline'}
            size="sm"
            onClick={() =>
              updateSplitField(index, splitIndex, 'isPercentage', true)
            }
            className="flex-1"
          >
            <Percent className="h-3 w-3 mr-1" />
            Percentage
          </Button>
        </div>

        {/* Amount/Percentage Input */}
        {split.isPercentage ? (
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Percentage</Label>
            <Input
              type="number"
              min="0"
              max="100"
              step="0.1"
              placeholder="25"
              value={split.percentage || ''}
              onChange={(e) =>
                updateSplitField(
                  index,
                  splitIndex,
                  'percentage',
                  parseFloat(e.target.value)
                )
              }
              className="bg-input border-border"
            />
          </div>
        ) : (
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Amount</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              placeholder="50.00"
              value={split.amount || ''}
              onChange={(e) =>
                updateSplitField(
                  index,
                  splitIndex,
                  'amount',
                  parseFloat(e.target.value)
                )
              }
              className="bg-input border-border"
            />
          </div>
        )}

        {/* Optional Description */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">
            Description (Optional)
          </Label>
          <Input
            type="text"
            placeholder="Split description"
            value={split.description || ''}
            onChange={(e) =>
              updateSplitField(index, splitIndex, 'description', e.target.value)
            }
            className="bg-input border-border"
          />
        </div>
      </div>
    ))}

    {/* Empty State */}
    {(!action.config?.splits || action.config.splits.length === 0) && (
      <div className="bg-card rounded-lg p-6 border border-dashed border-border text-center">
        <ScissorsIcon className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">
          No splits configured. Click "Add Split" to create one.
        </p>
      </div>
    )}
  </div>
)}
```

**Helper Functions:**
```typescript
const addSplit = (actionIndex: number) => {
  const newSplit = {
    categoryId: '',
    amount: 0,
    percentage: 0,
    isPercentage: false,
    description: '',
  };

  const updatedActions = [...actions];
  if (!updatedActions[actionIndex].config) {
    updatedActions[actionIndex].config = { splits: [] };
  }
  if (!updatedActions[actionIndex].config.splits) {
    updatedActions[actionIndex].config.splits = [];
  }

  updatedActions[actionIndex].config.splits.push(newSplit);
  setActions(updatedActions);
};

const removeSplit = (actionIndex: number, splitIndex: number) => {
  const updatedActions = [...actions];
  updatedActions[actionIndex].config.splits.splice(splitIndex, 1);
  setActions(updatedActions);
};

const updateSplitField = (
  actionIndex: number,
  splitIndex: number,
  field: string,
  value: any
) => {
  const updatedActions = [...actions];
  updatedActions[actionIndex].config.splits[splitIndex][field] = value;
  setActions(updatedActions);
};
```

---

### Task 3.4: Testing - Split Action
**Estimated Time:** 2 hours

**Test Cases:**
1. ✅ Creates splits with fixed amounts
2. ✅ Creates splits with percentages
3. ✅ Creates mixed splits (fixed + percentage)
4. ✅ Validates total doesn't exceed transaction amount
5. ✅ Validates all categories exist
6. ✅ Marks transaction as split
7. ✅ Works in bulk apply rules
8. ✅ Handles edge cases (empty splits, invalid amounts, etc.)

---

## PRIORITY 4: Set Account Action

### Task 4.1: Backend - Account Change Action Executor
**File:** `lib/rules/actions-executor.ts`
**Estimated Time:** 2 hours

**Action Configuration:**
```typescript
{
  type: 'set_account',
  value: string, // Target account ID
}
```

**Implementation:**
```typescript
/**
 * Execute a set_account action
 * Changes transaction's account and updates balances
 */
async function executeSetAccountAction(
  action: RuleAction,
  context: ActionExecutionContext,
  mutations: TransactionMutations
): Promise<AppliedAction | null> {
  if (!action.value) {
    return null;
  }

  // Validate account exists and belongs to user
  const account = await db
    .select()
    .from(accounts)
    .where(
      and(
        eq(accounts.id, action.value),
        eq(accounts.userId, context.userId)
      )
    )
    .limit(1);

  if (account.length === 0) {
    throw new Error('Target account not found');
  }

  // Don't change if already the same account
  if (context.transaction.accountId === action.value) {
    return null;
  }

  // Store account change in mutations
  // Balance updates happen AFTER transaction creation
  mutations.accountId = action.value;
  mutations.originalAccountId = context.transaction.accountId; // For balance correction

  return {
    type: 'set_account',
    field: 'accountId',
    originalValue: context.transaction.accountId,
    newValue: action.value,
  };
}
```

---

### Task 4.2: Backend - Account Balance Update Handler
**File:** `lib/rules/account-action-handler.ts` (NEW FILE)
**Estimated Time:** 2 hours

```typescript
import { db } from '@/lib/db';
import { accounts } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import Decimal from 'decimal.js';

export async function handleAccountChange(
  userId: string,
  transactionId: string,
  newAccountId: string,
  oldAccountId: string,
  amount: number,
  transactionType: string
): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const amountDecimal = new Decimal(amount);

    // Calculate balance adjustments based on transaction type
    let oldAccountAdjustment: Decimal;
    let newAccountAdjustment: Decimal;

    if (transactionType === 'income' || transactionType === 'transfer_in') {
      // Income/Transfer In: old account loses money, new account gains
      oldAccountAdjustment = amountDecimal.negated();
      newAccountAdjustment = amountDecimal;
    } else {
      // Expense/Transfer Out: old account gains money back, new account loses
      oldAccountAdjustment = amountDecimal;
      newAccountAdjustment = amountDecimal.negated();
    }

    // Update old account balance
    await db
      .update(accounts)
      .set({
        currentBalance: db.raw(
          `current_balance + ${oldAccountAdjustment.toFixed(2)}`
        ),
      })
      .where(eq(accounts.id, oldAccountId));

    // Update new account balance
    await db
      .update(accounts)
      .set({
        currentBalance: db.raw(
          `current_balance + ${newAccountAdjustment.toFixed(2)}`
        ),
      })
      .where(eq(accounts.id, newAccountId));

    return { success: true };
  } catch (error) {
    console.error('Account balance update failed:', error);
    return { success: false, error: String(error) };
  }
}
```

---

### Task 4.3: Frontend - Account Action Configuration UI
**File:** `components/rules/rule-builder.tsx`
**Estimated Time:** 2 hours

**Action Selector:**
```tsx
<SelectItem value="set_account">
  <div className="flex items-center gap-2">
    <Wallet className="h-4 w-4" />
    Change Account
  </div>
</SelectItem>
```

**Configuration UI:**
```tsx
{action.type === 'set_account' && (
  <div className="flex-1 space-y-2">
    <Label className="text-sm text-foreground">Target Account</Label>
    <Select
      value={action.value || ''}
      onValueChange={(val) => updateActionValue(index, val)}
    >
      <SelectTrigger className="bg-input border-border">
        <SelectValue placeholder="Select account" />
      </SelectTrigger>
      <SelectContent>
        {accounts.map((acc) => (
          <SelectItem key={acc.id} value={acc.id}>
            <div className="flex items-center gap-2">
              {/* Account icon */}
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: acc.color }}
              />
              <span>{acc.name}</span>
              <span className="text-xs text-muted-foreground">
                ({acc.type})
              </span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
    <div className="bg-elevated rounded-lg p-3 mt-2">
      <div className="flex items-start gap-2">
        <AlertCircle className="h-4 w-4 text-[var(--color-warning)] mt-0.5" />
        <p className="text-xs text-muted-foreground">
          Changing accounts will automatically update account balances to
          reflect the transaction in the new account.
        </p>
      </div>
    </div>
  </div>
)}
```

---

### Task 4.4: Testing - Account Change Action
**Estimated Time:** 2 hours

**Test Cases:**
1. ✅ Changes transaction account
2. ✅ Updates old account balance (removes transaction effect)
3. ✅ Updates new account balance (applies transaction effect)
4. ✅ Handles different transaction types (income, expense, transfers)
5. ✅ Validates target account exists
6. ✅ Works in bulk apply rules
7. ✅ Handles edge cases (same account, invalid account, etc.)

---

## PRIORITY 5: Enhanced Transfer Matching

### Task 5.1: Improve Transfer Matching Algorithm
**File:** `lib/rules/transfer-action-handler.ts`
**Estimated Time:** 2 hours

**Enhancements:**
1. **Multi-Factor Scoring:** Combine amount, date, description similarity
2. **Confidence Threshold:** Only auto-link if confidence ≥ 90%
3. **Manual Review Queue:** Show suggestions for 70-89% confidence
4. **Machine Learning Hints:** Track user confirmations to improve matching

**Scoring Algorithm:**
```typescript
interface MatchScore {
  transaction: any;
  amountScore: number;   // 0-40 points
  dateScore: number;     // 0-30 points
  descScore: number;     // 0-20 points
  accountScore: number;  // 0-10 points
  totalScore: number;    // 0-100 points
  confidence: 'high' | 'medium' | 'low';
}

function scoreTransferMatch(
  source: any,
  candidate: any,
  tolerance: number,
  dayRange: number
): MatchScore {
  // Amount score (40 points max)
  const sourceAmount = new Decimal(source.amount);
  const candidateAmount = new Decimal(candidate.amount);
  const amountDiff = candidateAmount.minus(sourceAmount).abs();
  const toleranceAmount = sourceAmount.times(tolerance / 100);

  const amountScore =
    amountDiff.isZero()
      ? 40
      : amountDiff.lessThanOrEqualTo(toleranceAmount)
      ? 40 - (amountDiff.dividedBy(toleranceAmount).toNumber() * 15)
      : 0;

  // Date score (30 points max)
  const sourceDate = new Date(source.date);
  const candidateDate = new Date(candidate.date);
  const daysDiff = Math.abs(
    (sourceDate.getTime() - candidateDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  const dateScore =
    daysDiff === 0
      ? 30
      : daysDiff <= dayRange
      ? 30 - (daysDiff / dayRange) * 15
      : 0;

  // Description similarity score (20 points max) - Levenshtein distance
  const descScore = calculateStringSimilarity(
    source.description,
    candidate.description
  ) * 20;

  // Account score (10 points max) - bonus if accounts commonly transfer
  const accountScore = 0; // TODO: Implement account pair history lookup

  const totalScore = amountScore + dateScore + descScore + accountScore;

  const confidence =
    totalScore >= 90 ? 'high' : totalScore >= 70 ? 'medium' : 'low';

  return {
    transaction: candidate,
    amountScore,
    dateScore,
    descScore,
    accountScore,
    totalScore,
    confidence,
  };
}
```

---

### Task 5.2: Create Transfer Suggestions API
**File:** `app/api/rules/transfer-suggestions/route.ts` (NEW FILE)
**Estimated Time:** 2 hours

**Endpoint:** `GET /api/rules/transfer-suggestions?transactionId=xxx`

**Purpose:** Return ranked list of potential transfer matches with confidence scores

**Response:**
```typescript
{
  suggestions: [
    {
      transactionId: string,
      accountId: string,
      accountName: string,
      date: string,
      amount: number,
      description: string,
      score: MatchScore,
    }
  ],
  autoLinkRecommendation: string | null, // Transaction ID if confidence ≥ 90%
}
```

---

### Task 5.3: Frontend - Transfer Suggestions UI
**File:** `components/rules/transfer-suggestions-modal.tsx` (NEW FILE)
**Estimated Time:** 3 hours

**Purpose:** Show transfer match suggestions when rule creates transfers

**UI Components:**
- Confidence badges (High/Medium/Low with colors)
- Match score breakdown (amount, date, description bars)
- Accept/Reject buttons
- "Create New" option

---

## Integration & Testing

### Task INT-1: Update Transaction Creation API
**File:** `app/api/transactions/route.ts`
**Estimated Time:** 2 hours

**Integration Points:**
```typescript
// After rule actions execution
if (executionResult.mutations.convertToTransfer) {
  await handleTransferConversion(userId, transactionId, executionResult.mutations.convertToTransfer);
}

if (executionResult.mutations.createSplits) {
  await handleSplitCreation(userId, transactionId, executionResult.mutations.createSplits);
}

if (executionResult.mutations.accountId && executionResult.mutations.originalAccountId) {
  await handleAccountChange(
    userId,
    transactionId,
    executionResult.mutations.accountId,
    executionResult.mutations.originalAccountId,
    transaction.amount,
    transaction.type
  );
}
```

---

### Task INT-2: Update Bulk Apply Rules API
**File:** `app/api/rules/apply-bulk/route.ts`
**Estimated Time:** 2 hours

**Handle Complex Actions:**
- Process transfers, splits, account changes in batch
- Track successes and failures separately
- Return detailed results with breakdown by action type

---

### Task INT-3: Comprehensive Testing Suite
**Estimated Time:** 4 hours

**Unit Tests:**
- All action executors
- Helper functions
- Validation logic

**Integration Tests:**
- Transaction creation with each action type
- Bulk apply with mixed actions
- Error handling and rollback scenarios

**E2E Tests:**
- Create rule with transfer action, verify both transactions created
- Create rule with split action, verify splits created
- Create rule with account change, verify balances updated
- Combine multiple actions, verify all applied correctly

---

## Documentation

### Task DOC-1: Update User Documentation
**File:** `docs/rules-actions-user-guide.md`
**Estimated Time:** 2 hours

**Sections:**
- Tax deduction action
- Convert to transfer action (with matching explanation)
- Split transaction action (with examples)
- Account change action
- Combining multiple actions

---

### Task DOC-2: Update Developer Documentation
**File:** `docs/rules-actions-architecture.md`
**Estimated Time:** 2 hours

**Sections:**
- Post-creation action handlers architecture
- Transfer matching algorithm
- Split calculation logic
- Account balance update flow
- Adding new complex actions

---

### Task DOC-3: Update features.md
**File:** `docs/features.md`
**Estimated Time:** 30 minutes

**Mark Phase 2 as Complete:**
- Update status
- List all implemented features
- Note any deferred enhancements

---

## Implementation Timeline

### Week 1: Tax Deduction & Transfer Actions (Days 1-6)
- **Day 1:** Task 1.1-1.4 (Tax Deduction) ✓
- **Day 2:** Task 2.1-2.2 (Transfer Backend) ✓
- **Day 3:** Task 2.3-2.4 (Transfer Frontend) ✓
- **Day 4:** Task 2.5 (Transfer Testing) ✓
- **Day 5:** Task 5.1-5.2 (Enhanced Matching) ✓
- **Day 6:** Task 5.3 (Matching UI) ✓

### Week 2: Splits, Accounts & Integration (Days 7-12)
- **Day 7:** Task 3.1-3.2 (Split Backend) ✓
- **Day 8:** Task 3.3 (Split Frontend) ✓
- **Day 9:** Task 3.4 + Task 4.1-4.2 (Split Testing + Account Backend) ✓
- **Day 10:** Task 4.3-4.4 (Account Frontend & Testing) ✓
- **Day 11:** Task INT-1, INT-2, INT-3 (Integration & Testing) ✓
- **Day 12:** Task DOC-1, DOC-2, DOC-3 (Documentation) ✓

---

## Success Criteria

Phase 2 is complete when:

- ✅ All 4 new action types implemented and tested
- ✅ Post-creation handlers work correctly
- ✅ Account balances update accurately for all actions
- ✅ Transfer matching achieves ≥90% accuracy for obvious matches
- ✅ Split creation validates and prevents over-allocation
- ✅ All actions work in bulk apply rules
- ✅ UI is intuitive with clear configuration options
- ✅ Full test coverage (unit + integration + E2E)
- ✅ Documentation complete and accurate
- ✅ No performance degradation
- ✅ Backward compatibility maintained

---

## Theme Integration Checklist

All new UI components must use semantic color tokens:

- ✅ Backgrounds: `bg-background`, `bg-card`, `bg-elevated`
- ✅ Text: `text-foreground`, `text-muted-foreground`
- ✅ Borders: `border-border`
- ✅ Inputs: `bg-input`
- ✅ Buttons: `bg-[var(--color-primary)]`, `hover:opacity-90`
- ✅ State colors: `--color-success`, `--color-warning`, `--color-error`
- ✅ Icons: Use Lucide icons (NOT emojis)
- ✅ Transaction types: `--color-income`, `--color-expense`, `--color-transfer`

---

## Risk Mitigation

### High-Risk Areas:
1. **Account Balance Calculations:** Extensive testing required
2. **Transfer Matching Accuracy:** May need ML/heuristic tuning
3. **Split Validation:** Edge cases with percentages and remainders

### Mitigation Strategies:
1. **Decimal.js everywhere** for financial calculations
2. **Rollback mechanism** for failed complex actions
3. **Dry-run mode** for testing actions without applying
4. **Audit trail** for all balance changes
5. **User confirmation** for high-impact actions (in UI)

---

## Future Enhancements (Phase 3)

After Phase 2 completion:
1. **Conditional Actions:** If/then logic within rules
2. **Action Chaining:** Trigger subsequent actions based on results
3. **Scheduled Actions:** Delay action execution to specific date/time
4. **Approval Workflow:** Require user confirmation for certain actions
5. **AI-Powered Matching:** Use ML to improve transfer/duplicate detection
6. **Batch Operations:** Group multiple transactions for bulk actions
7. **Webhooks:** Trigger external actions when rules match

---

## Getting Started

**Next Step:** Begin with **Priority 1: Set Tax Deduction Action** (simplest, quickest win)

**Command to start:**
```bash
# Create migration for isTaxDeductible field (if needed)
pnpm drizzle-kit generate

# Start development
pnpm dev

# Run tests as you build
pnpm test:watch
```

Let's build Phase 2! 🚀
