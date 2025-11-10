# Sales Tax Income Tracking Implementation Plan

## Overview
Implement comprehensive sales tax tracking for income transactions, allowing businesses to track sales tax collected on revenue. This includes both manual marking of transactions and automatic rule-based application.

**Features:**
- Feature 6: Allow income transactions to be marked as subject to sales tax
- Feature 7: Allow transactions to be marked as subject to sales tax with a rule

**Estimated Time:** 6-8 hours total

---

## Current State Analysis

### Existing Implementation
✅ **Sales Tax Infrastructure:**
- `salesTaxSettings` table - user tax configuration
- `salesTaxCategories` table - multiple tax rates
- `salesTaxTransactions` table - transaction-level tracking
- `quarterlyFilingRecords` table - filing status
- Sales tax dashboard at `/dashboard/sales-tax`
- Quarterly reporting API at `/api/sales-tax/quarterly`
- Utilities library at `lib/sales-tax/sales-tax-utils.ts`

✅ **Transaction System:**
- Transaction creation with income/expense types
- Rules system with 11 action types already implemented
- Transaction form with category, merchant, tags, custom fields

### Gap Analysis
❌ **Missing:**
1. UI field on transaction form to mark income as subject to sales tax
2. Sales tax category selector for transaction form
3. Automatic sales tax calculation and salesTaxTransactions record creation
4. Display of sales tax info on transaction list/detail views
5. New rule action type: `set_sales_tax`
6. Rule action executor for sales tax
7. Rule builder UI for sales tax configuration

---

## Implementation Plan

### Phase 1: Database Schema Updates
**Status:** ✅ No changes needed (salesTaxTransactions table already exists)

The existing `salesTaxTransactions` table has all required fields:
- `transactionId` - link to main transaction
- `taxCategoryId` - which rate to apply
- `saleAmount` - amount before tax
- `taxRate` - rate as decimal (e.g., 0.0825)
- `taxAmount` - calculated tax amount
- `quarter` - fiscal quarter (1-4)
- `taxYear` - year for reporting
- `reportedStatus` - pending/reported/filed/paid

**Decision:** No migration needed, use existing table structure.

---

### Phase 2: Type System Updates (~30 minutes)

#### Task 2.1: Update Rule Action Types
**File:** `lib/rules/types.ts`

**Changes:**
1. Add new action type to `RuleActionType`:
   ```typescript
   | 'set_sales_tax'  // Mark transaction as subject to sales tax
   ```

2. Add sales tax configuration interface:
   ```typescript
   /**
    * Sales tax configuration for set_sales_tax action
    */
   export interface SalesTaxConfig {
     taxCategoryId: string;
     enabled: boolean;
   }
   ```

3. Update `AppliedAction` field type to include sales tax:
   ```typescript
   field: 'categoryId' | 'description' | 'merchantId' | 'accountId' |
          'isTaxDeductible' | 'type' | 'isSplit' | 'salesTax';
   ```

4. Update `TransactionMutations` interface:
   ```typescript
   /** Sales tax to apply (if set_sales_tax action) */
   applySalesTax?: {
     taxCategoryId: string;
     enabled: boolean;
   };
   ```

5. Update `ActionExecutionContext` transaction type:
   ```typescript
   transaction: {
     // ... existing fields
     type: string;
     amount: number;
   }
   ```

**Validation:**
- TypeScript compile successful
- No breaking changes to existing action types

---

### Phase 3: Sales Tax Utility Functions (~45 minutes)

#### Task 3.1: Create Sales Tax Helper Library
**File:** `lib/sales-tax/transaction-sales-tax.ts` (NEW FILE)

**Purpose:** Centralized logic for calculating and managing sales tax on transactions

**Functions to implement:**

1. **calculateSalesTax(amount, taxRate)**
   - Input: transaction amount (Decimal), tax rate (number 0-1)
   - Output: { saleAmount, taxAmount, totalAmount }
   - Use Decimal.js for precision
   ```typescript
   export function calculateSalesTax(amount: Decimal, taxRate: number): {
     saleAmount: Decimal;
     taxAmount: Decimal;
     totalAmount: Decimal;
   }
   ```

2. **createSalesTaxRecord(transactionId, userId, accountId, taxCategoryId, amount, date)**
   - Creates record in salesTaxTransactions table
   - Calculates quarter and tax year from date
   - Returns created record ID
   ```typescript
   export async function createSalesTaxRecord(params: {
     transactionId: string;
     userId: string;
     accountId: string;
     taxCategoryId: string;
     amount: number;
     date: string;
   }): Promise<string>
   ```

3. **getSalesTaxForTransaction(transactionId)**
   - Fetches sales tax record for a transaction
   - Returns null if no record exists
   ```typescript
   export async function getSalesTaxForTransaction(transactionId: string): Promise<{
     id: string;
     taxCategoryId: string;
     taxCategoryName: string;
     saleAmount: number;
     taxRate: number;
     taxAmount: number;
     quarter: number;
     taxYear: number;
     reportedStatus: string;
   } | null>
   ```

4. **deleteSalesTaxRecord(transactionId)**
   - Removes sales tax record when transaction deleted/modified
   ```typescript
   export async function deleteSalesTaxRecord(transactionId: string): Promise<void>
   ```

5. **updateSalesTaxRecord(transactionId, amount, taxCategoryId?)**
   - Updates existing sales tax record when transaction amount changes
   ```typescript
   export async function updateSalesTaxRecord(
     transactionId: string,
     amount: number,
     taxCategoryId?: string
   ): Promise<void>
   ```

**Database Queries:**
- Use Drizzle ORM with proper indexes
- Join with salesTaxCategories for tax rate
- Error handling for missing records
- Transaction support for atomic operations

---

### Phase 4: Transaction API Updates (~1 hour)

#### Task 4.1: Update Transaction Creation API
**File:** `app/api/transactions/route.ts`

**Changes to POST handler:**

1. Add sales tax field to request body validation:
   ```typescript
   const {
     // ... existing fields
     salesTax, // { taxCategoryId: string, enabled: boolean }
   } = await req.json();
   ```

2. After transaction creation, check for sales tax:
   ```typescript
   // After creating transaction
   if (salesTax?.enabled && salesTax.taxCategoryId && type === 'income') {
     try {
       await createSalesTaxRecord({
         transactionId: transaction.id,
         userId: user.id,
         accountId: accountId,
         taxCategoryId: salesTax.taxCategoryId,
         amount: parsedAmount,
         date: date,
       });
     } catch (error) {
       console.error('Failed to create sales tax record:', error);
       // Non-fatal: transaction still created
     }
   }
   ```

3. Handle rule mutations for sales tax:
   ```typescript
   // After executing actions in rule engine
   if (mutations.applySalesTax && type === 'income') {
     await createSalesTaxRecord({
       transactionId: transaction.id,
       userId: user.id,
       accountId: accountId,
       taxCategoryId: mutations.applySalesTax.taxCategoryId,
       amount: parsedAmount,
       date: date,
     });
   }
   ```

**Error Handling:**
- Validate tax category exists and belongs to user
- Sales tax creation is non-fatal (transaction still succeeds)
- Log errors for debugging

#### Task 4.2: Update Transaction Update API (PUT)
**File:** `app/api/transactions/route.ts`

**Changes to PUT handler:**

1. Check for sales tax changes:
   ```typescript
   const { salesTax } = await req.json();

   // If sales tax changed
   if (salesTax !== undefined) {
     const existingTax = await getSalesTaxForTransaction(id);

     if (salesTax.enabled && salesTax.taxCategoryId) {
       if (existingTax) {
         // Update existing
         await updateSalesTaxRecord(id, amount, salesTax.taxCategoryId);
       } else {
         // Create new
         await createSalesTaxRecord({...});
       }
     } else if (existingTax) {
       // Remove sales tax
       await deleteSalesTaxRecord(id);
     }
   }
   ```

#### Task 4.3: Update Transaction Delete API
**File:** `app/api/transactions/route.ts`

**Changes to DELETE handler:**

1. Delete sales tax record before deleting transaction:
   ```typescript
   // Before deleting transaction
   await deleteSalesTaxRecord(id);

   // Then delete transaction
   await db.delete(transactions).where(eq(transactions.id, id));
   ```

#### Task 4.4: Update Transaction GET API
**File:** `app/api/transactions/route.ts`

**Changes to GET handler:**

1. Optionally include sales tax info in response:
   ```typescript
   // For single transaction fetch
   const transaction = await db.query.transactions.findFirst({...});

   // Fetch sales tax if exists
   const salesTax = await getSalesTaxForTransaction(transaction.id);

   return Response.json({
     ...transaction,
     salesTax: salesTax || null
   });
   ```

**Note:** For list queries, only include sales tax for income transactions to optimize performance.

---

### Phase 5: Rule Action Implementation (~1 hour)

#### Task 5.1: Create Sales Tax Action Handler
**File:** `lib/rules/sales-tax-action-handler.ts` (NEW FILE)

**Purpose:** Handle sales tax application during transaction creation via rules

**Implementation:**
```typescript
import { db } from '@/lib/db';
import { salesTaxCategories } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { createSalesTaxRecord } from '@/lib/sales-tax/transaction-sales-tax';
import { SalesTaxConfig } from './types';

/**
 * Apply sales tax to a transaction after creation
 * Called by transaction creation API after transaction is saved
 */
export async function handleSalesTaxApplication(
  transactionId: string,
  userId: string,
  accountId: string,
  amount: number,
  date: string,
  config: SalesTaxConfig
): Promise<void> {
  try {
    // Validate tax category exists and belongs to user
    const taxCategory = await db.query.salesTaxCategories.findFirst({
      where: and(
        eq(salesTaxCategories.id, config.taxCategoryId),
        eq(salesTaxCategories.userId, userId),
        eq(salesTaxCategories.isActive, true)
      ),
    });

    if (!taxCategory) {
      throw new Error(`Sales tax category ${config.taxCategoryId} not found or inactive`);
    }

    // Create sales tax record
    await createSalesTaxRecord({
      transactionId,
      userId,
      accountId,
      taxCategoryId: config.taxCategoryId,
      amount,
      date,
    });

    console.log(`Sales tax applied to transaction ${transactionId}`);
  } catch (error) {
    console.error('Failed to apply sales tax:', error);
    throw error; // Re-throw for error handling in caller
  }
}

/**
 * Validate sales tax configuration
 */
export function validateSalesTaxConfig(config: any): SalesTaxConfig {
  if (!config.taxCategoryId || typeof config.taxCategoryId !== 'string') {
    throw new Error('Sales tax configuration must include taxCategoryId');
  }

  return {
    taxCategoryId: config.taxCategoryId,
    enabled: config.enabled !== false, // Default to true
  };
}
```

**Error Handling:**
- Validate tax category exists
- Validate user owns tax category
- Non-fatal errors (transaction still succeeds)
- Comprehensive logging

#### Task 5.2: Update Actions Executor
**File:** `lib/rules/actions-executor.ts`

**Changes:**

1. Import new handler:
   ```typescript
   import { validateSalesTaxConfig } from './sales-tax-action-handler';
   ```

2. Add case for `set_sales_tax` action:
   ```typescript
   case 'set_sales_tax': {
     try {
       const config = validateSalesTaxConfig(action.config);

       // Only apply to income transactions
       if (context.transaction.type === 'income') {
         result.mutations.applySalesTax = config;
         result.appliedActions.push({
           type: 'set_sales_tax',
           field: 'salesTax',
           originalValue: null,
           newValue: config.taxCategoryId,
         });
       } else {
         console.warn('Sales tax can only be applied to income transactions');
       }
     } catch (error) {
       const message = error instanceof Error ? error.message : 'Unknown error';
       result.errors?.push(`set_sales_tax action failed: ${message}`);
     }
     break;
   }
   ```

**Validation:**
- Only allow sales tax on income transactions
- Validate configuration before applying
- Add to mutations for post-creation processing

---

### Phase 6: Transaction Form UI (~2 hours)

#### Task 6.1: Update Transaction Form Component
**File:** `components/transactions/transaction-form.tsx`

**Changes:**

1. Add state for sales tax:
   ```typescript
   const [salesTaxEnabled, setSalesTaxEnabled] = useState(false);
   const [selectedTaxCategoryId, setSelectedTaxCategoryId] = useState<string | null>(null);
   const [taxCategories, setTaxCategories] = useState<TaxCategory[]>([]);
   const [taxCategoriesLoading, setTaxCategoriesLoading] = useState(true);
   ```

2. Fetch tax categories on mount:
   ```typescript
   useEffect(() => {
     async function fetchTaxCategories() {
       try {
         const res = await fetch('/api/sales-tax/categories');
         const data = await res.json();
         setTaxCategories(data.categories || []);
       } catch (error) {
         console.error('Failed to fetch tax categories:', error);
       } finally {
         setTaxCategoriesLoading(false);
       }
     }
     fetchTaxCategories();
   }, []);
   ```

3. Add sales tax section to form (only show for income transactions):
   ```typescript
   {type === 'income' && (
     <div className="space-y-3">
       <div className="flex items-center justify-between">
         <Label className="text-foreground">Subject to Sales Tax</Label>
         <input
           type="checkbox"
           checked={salesTaxEnabled}
           onChange={(e) => {
             setSalesTaxEnabled(e.target.checked);
             if (!e.target.checked) {
               setSelectedTaxCategoryId(null);
             }
           }}
           className="h-4 w-4 rounded border-border bg-input text-[var(--color-primary)]"
         />
       </div>

       {salesTaxEnabled && (
         <>
           <div className="space-y-2">
             <Label className="text-sm text-muted-foreground">Tax Rate</Label>
             <Select
               value={selectedTaxCategoryId || ''}
               onValueChange={setSelectedTaxCategoryId}
             >
               <SelectTrigger className="bg-input border-border">
                 <SelectValue placeholder="Select tax rate" />
               </SelectTrigger>
               <SelectContent>
                 {taxCategories.map((cat) => (
                   <SelectItem key={cat.id} value={cat.id}>
                     {cat.name} ({(cat.rate * 100).toFixed(2)}%)
                   </SelectItem>
                 ))}
               </SelectContent>
             </Select>
           </div>

           {selectedTaxCategoryId && amount && (
             <div className="rounded-lg bg-card border border-border p-3 space-y-1">
               <div className="flex justify-between text-sm">
                 <span className="text-muted-foreground">Sale Amount:</span>
                 <span className="text-foreground font-mono">
                   ${parseFloat(amount).toFixed(2)}
                 </span>
               </div>
               <div className="flex justify-between text-sm">
                 <span className="text-muted-foreground">Sales Tax:</span>
                 <span className="text-[var(--color-primary)] font-mono">
                   ${calculateTax(amount, selectedTaxCategoryId).toFixed(2)}
                 </span>
               </div>
               <div className="flex justify-between text-sm font-medium pt-1 border-t border-border">
                 <span className="text-foreground">Total:</span>
                 <span className="text-foreground font-mono">
                   ${(parseFloat(amount) + calculateTax(amount, selectedTaxCategoryId)).toFixed(2)}
                 </span>
               </div>
             </div>
           )}
         </>
       )}
     </div>
   )}
   ```

4. Add helper function for tax calculation:
   ```typescript
   function calculateTax(amount: string, taxCategoryId: string): number {
     const taxCategory = taxCategories.find(c => c.id === taxCategoryId);
     if (!taxCategory) return 0;
     return parseFloat(amount) * taxCategory.rate;
   }
   ```

5. Update form submission to include sales tax:
   ```typescript
   const payload = {
     // ... existing fields
     salesTax: salesTaxEnabled && selectedTaxCategoryId ? {
       taxCategoryId: selectedTaxCategoryId,
       enabled: true,
     } : null,
   };
   ```

**Design Specifications:**
- Use existing form layout and spacing patterns
- Checkbox aligned to the right (like other toggles)
- Tax rate selector uses shadcn Select component
- Calculation preview uses card with border
- Colors: bg-card, text-foreground, text-muted-foreground, --color-primary
- Only show for income transactions (type === 'income')
- Disable if no tax categories configured

#### Task 6.2: Load Sales Tax Data When Editing
**Changes in same file:**

1. Update transaction loading effect:
   ```typescript
   useEffect(() => {
     if (!transactionId) return;

     async function loadTransaction() {
       const res = await fetch(`/api/transactions?id=${transactionId}`);
       const data = await res.json();

       // ... existing field population

       // Load sales tax if exists
       if (data.salesTax) {
         setSalesTaxEnabled(true);
         setSelectedTaxCategoryId(data.salesTax.taxCategoryId);
       }
     }

     loadTransaction();
   }, [transactionId]);
   ```

---

### Phase 7: Sales Tax Categories API (~30 minutes)

#### Task 7.1: Create Sales Tax Categories Endpoint
**File:** `app/api/sales-tax/categories/route.ts` (NEW FILE)

**Purpose:** CRUD operations for sales tax categories

**Endpoints:**

**GET** - List all active tax categories for user
```typescript
export async function GET(req: Request) {
  const { userId } = auth();
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const categories = await db.query.salesTaxCategories.findMany({
    where: and(
      eq(salesTaxCategories.userId, userId),
      eq(salesTaxCategories.isActive, true)
    ),
    orderBy: [
      desc(salesTaxCategories.isDefault),
      asc(salesTaxCategories.name),
    ],
  });

  return Response.json({ categories });
}
```

**POST** - Create new tax category
```typescript
export async function POST(req: Request) {
  const { userId } = auth();
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { name, rate, isDefault } = await req.json();

  // Validation
  if (!name || rate === undefined) {
    return Response.json({ error: 'Name and rate required' }, { status: 400 });
  }

  if (rate < 0 || rate > 1) {
    return Response.json({ error: 'Rate must be between 0 and 1' }, { status: 400 });
  }

  // If setting as default, unset other defaults
  if (isDefault) {
    await db.update(salesTaxCategories)
      .set({ isDefault: false })
      .where(eq(salesTaxCategories.userId, userId));
  }

  const id = crypto.randomUUID();
  await db.insert(salesTaxCategories).values({
    id,
    userId,
    name,
    rate,
    isDefault: isDefault || false,
    isActive: true,
    usageCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  return Response.json({ id, name, rate, isDefault });
}
```

---

### Phase 8: Transaction List/Detail Display (~1 hour)

#### Task 8.1: Update Transaction List Item
**File:** `components/transactions/transaction-list.tsx`

**Changes:**

1. Add sales tax badge for income transactions with sales tax:
   ```typescript
   {transaction.salesTax && transaction.type === 'income' && (
     <Badge
       variant="outline"
       className="text-xs border-[var(--color-warning)] text-[var(--color-warning)]"
     >
       <Receipt className="mr-1 h-3 w-3" />
       Sales Tax: {(transaction.salesTax.taxRate * 100).toFixed(2)}%
     </Badge>
   )}
   ```

2. Show tax amount in transaction amount area:
   ```typescript
   {transaction.salesTax && (
     <div className="text-xs text-muted-foreground">
       +${transaction.salesTax.taxAmount.toFixed(2)} tax
     </div>
   )}
   ```

**Design:**
- Small badge with Receipt icon from lucide-react
- Warning color (amber) to distinguish from other badges
- Subtle tax amount display below main amount
- Only show for income transactions with sales tax

#### Task 8.2: Update Transaction Detail View
**File:** `components/transactions/transaction-detail.tsx` (if exists, or create modal)

**Changes:**

1. Add sales tax section:
   ```typescript
   {transaction.salesTax && (
     <div className="border-t border-border pt-4 space-y-2">
       <h4 className="text-sm font-medium text-foreground">Sales Tax</h4>
       <div className="space-y-1">
         <div className="flex justify-between text-sm">
           <span className="text-muted-foreground">Tax Rate:</span>
           <span className="text-foreground">
             {transaction.salesTax.taxCategoryName} ({(transaction.salesTax.taxRate * 100).toFixed(2)}%)
           </span>
         </div>
         <div className="flex justify-between text-sm">
           <span className="text-muted-foreground">Sale Amount:</span>
           <span className="text-foreground font-mono">
             ${transaction.salesTax.saleAmount.toFixed(2)}
           </span>
         </div>
         <div className="flex justify-between text-sm">
           <span className="text-muted-foreground">Tax Amount:</span>
           <span className="text-[var(--color-warning)] font-mono">
             ${transaction.salesTax.taxAmount.toFixed(2)}
           </span>
         </div>
         <div className="flex justify-between text-sm">
           <span className="text-muted-foreground">Quarter:</span>
           <span className="text-foreground">Q{transaction.salesTax.quarter} {transaction.salesTax.taxYear}</span>
         </div>
         <div className="flex justify-between text-sm">
           <span className="text-muted-foreground">Status:</span>
           <Badge variant="outline" className="text-xs">
             {transaction.salesTax.reportedStatus}
           </Badge>
         </div>
       </div>
     </div>
   )}
   ```

---

### Phase 9: Rule Builder UI (~1.5 hours)

#### Task 9.1: Update Rule Builder Component
**File:** `components/rules/rule-builder.tsx`

**Changes:**

1. Add sales tax state:
   ```typescript
   const [salesTaxCategories, setSalesTaxCategories] = useState<TaxCategory[]>([]);
   const [taxCategoriesLoading, setTaxCategoriesLoading] = useState(true);
   ```

2. Fetch tax categories:
   ```typescript
   useEffect(() => {
     async function fetchTaxCategories() {
       try {
         const res = await fetch('/api/sales-tax/categories');
         const data = await res.json();
         setSalesTaxCategories(data.categories || []);
       } catch (error) {
         console.error('Failed to fetch tax categories:', error);
       } finally {
         setTaxCategoriesLoading(false);
       }
     }
     fetchTaxCategories();
   }, []);
   ```

3. Add "Set Sales Tax" to action type selector:
   ```typescript
   <SelectItem value="set_sales_tax">
     <div className="flex items-center gap-2">
       <Receipt className="h-4 w-4 text-[var(--color-warning)]" />
       <span>Set Sales Tax</span>
     </div>
   </SelectItem>
   ```

4. Add sales tax configuration UI:
   ```typescript
   {action.type === 'set_sales_tax' && (
     <div className="space-y-3">
       <div className="space-y-2">
         <Label className="text-sm text-muted-foreground">Tax Rate</Label>
         <Select
           value={action.config?.taxCategoryId || ''}
           onValueChange={(value) => updateActionField(index, 'config', {
             ...action.config,
             taxCategoryId: value,
           })}
         >
           <SelectTrigger className="bg-input border-border">
             <SelectValue placeholder="Select tax rate" />
           </SelectTrigger>
           <SelectContent>
             {salesTaxCategories.map((cat) => (
               <SelectItem key={cat.id} value={cat.id}>
                 {cat.name} ({(cat.rate * 100).toFixed(2)}%)
               </SelectItem>
             ))}
           </SelectContent>
         </Select>
       </div>

       <div className="rounded-lg bg-card border border-border p-3 space-y-2">
         <div className="flex items-start gap-2">
           <AlertTriangle className="h-4 w-4 text-[var(--color-warning)] mt-0.5 flex-shrink-0" />
           <div className="text-xs text-muted-foreground space-y-1">
             <p className="font-medium text-foreground">Important Notes:</p>
             <ul className="list-disc list-inside space-y-0.5 ml-1">
               <li>Only applies to income transactions</li>
               <li>Creates sales tax record for quarterly reporting</li>
               <li>Tax amount calculated automatically based on rate</li>
             </ul>
           </div>
         </div>
       </div>

       <div className="rounded-lg bg-[var(--color-accent)] bg-opacity-10 border border-[var(--color-accent)] p-3">
         <div className="flex items-start gap-2">
           <Lightbulb className="h-4 w-4 text-[var(--color-accent)] mt-0.5 flex-shrink-0" />
           <div className="text-xs text-muted-foreground space-y-1">
             <p className="font-medium text-foreground">Common Use Cases:</p>
             <ul className="list-disc list-inside space-y-0.5 ml-1">
               <li>Apply tax to all product sales</li>
               <li>Apply different rates for different product categories</li>
               <li>Automatically track taxable income for filing</li>
             </ul>
           </div>
         </div>
       </div>
     </div>
   )}
   ```

**Design:**
- Receipt icon from lucide-react in warning/amber color
- Tax category selector with rate display
- Warning box with important notes
- Info box with use cases
- Follows existing pattern from other action types

#### Task 9.2: Update Rules Manager Display
**File:** `components/rules/rules-manager.tsx`

**Changes:**

1. Add icon import:
   ```typescript
   import { Receipt } from 'lucide-react';
   ```

2. Update `getActionLabel` function:
   ```typescript
   case 'set_sales_tax': {
     const taxCategory = action.config?.taxCategoryId
       ? salesTaxCategories.find(c => c.id === action.config.taxCategoryId)
       : null;
     return taxCategory
       ? `${taxCategory.name} (${(taxCategory.rate * 100).toFixed(2)}%)`
       : 'Sales Tax';
   }
   ```

3. Update action icon rendering:
   ```typescript
   {action.type === 'set_sales_tax' && (
     <Receipt className="h-3 w-3 text-[var(--color-warning)]" />
   )}
   ```

#### Task 9.3: Update Rules Page Validation
**File:** `app/dashboard/rules/page.tsx`

**Changes:**

1. Add validation for sales tax action:
   ```typescript
   if (action.type === 'set_sales_tax') {
     if (!action.config?.taxCategoryId) {
       toast.error('Sales tax action requires a tax rate');
       return;
     }
   }
   ```

---

### Phase 10: Bulk Apply Rules Integration (~30 minutes)

#### Task 10.1: Update Bulk Apply Rules API
**File:** `app/api/rules/apply-bulk/route.ts`

**Changes:**

1. Handle sales tax mutations:
   ```typescript
   // After applying actions
   if (mutations.applySalesTax && transaction.type === 'income') {
     try {
       await createSalesTaxRecord({
         transactionId: transaction.id,
         userId: user.id,
         accountId: transaction.accountId,
         taxCategoryId: mutations.applySalesTax.taxCategoryId,
         amount: transaction.amount,
         date: transaction.date,
       });
       appliedChanges.salesTax = true;
     } catch (error) {
       console.error('Failed to create sales tax record:', error);
     }
   }
   ```

2. Update response to include sales tax changes:
   ```typescript
   return Response.json({
     processed: transactions.length,
     updated: updatedCount,
     salesTaxApplied: salesTaxCount,
     // ... other stats
   });
   ```

---

### Phase 11: Documentation & Testing (~1 hour)

#### Task 11.1: Update Documentation Files

**File:** `docs/SALES_TAX_IMPLEMENTATION.md`

Add new section:
```markdown
## Income Sales Tax Tracking (NEW)

### Overview
Business users can now track sales tax collected on income transactions (sales/revenue).

### Features
- Manual marking of income transactions as subject to sales tax
- Automatic tax calculation based on selected rate
- Rule-based automatic application of sales tax
- Sales tax records created for quarterly reporting
- Visual indicators on transaction list/detail

### Transaction Form
- Checkbox to enable sales tax (income only)
- Tax rate selector with percentage display
- Real-time calculation preview
- Sale amount + tax amount + total display

### Rules System
- New action type: `set_sales_tax`
- Configure tax rate in rule builder
- Automatically applies to matching income transactions
- Creates sales tax records for reporting

### Use Cases
1. **E-commerce Store**: Automatically apply tax to all product sales
2. **Service Business**: Apply tax to specific service categories
3. **Multi-Rate Sales**: Different rates for different products
4. **Compliance**: Automatic quarterly tracking for filing
```

**File:** `.claude/CLAUDE.md`

Update Recent Updates section with completion summary.

**File:** `docs/features.md`

Mark features 6 and 7 as complete.

#### Task 11.2: Manual Testing Checklist

**Transaction Form Testing:**
- [ ] Create income transaction without sales tax
- [ ] Create income transaction with sales tax
- [ ] Verify tax calculation is correct
- [ ] Verify salesTaxTransactions record created
- [ ] Edit transaction to add sales tax
- [ ] Edit transaction to change tax rate
- [ ] Edit transaction to remove sales tax
- [ ] Verify tax rate selector shows all categories
- [ ] Verify calculation preview updates in real-time

**Transaction Display Testing:**
- [ ] List view shows sales tax badge for income with tax
- [ ] Badge shows correct tax rate
- [ ] Detail view shows full sales tax breakdown
- [ ] Quarter and year calculated correctly
- [ ] Status shown correctly

**Rules System Testing:**
- [ ] Create rule with set_sales_tax action
- [ ] Verify tax category selector works
- [ ] Create income transaction matching rule
- [ ] Verify sales tax applied automatically
- [ ] Verify salesTaxTransactions record created
- [ ] Test bulk apply with sales tax rules
- [ ] Verify only income transactions get sales tax
- [ ] Test with multiple actions (category + sales tax)

**Sales Tax Dashboard Testing:**
- [ ] Income with sales tax appears in quarterly reports
- [ ] Tax amounts aggregate correctly
- [ ] Quarter assignment correct
- [ ] Year assignment correct
- [ ] Filing status updates work

**Edge Cases:**
- [ ] What happens if tax category deleted?
- [ ] What happens if transaction deleted?
- [ ] What happens if transaction amount updated?
- [ ] What happens if transaction type changed from income?
- [ ] Test with split transactions
- [ ] Test with transferred transactions

#### Task 11.3: Build Verification

```bash
pnpm build
```

Verify:
- [ ] Zero TypeScript errors
- [ ] Zero build warnings
- [ ] All pages compile successfully
- [ ] No missing dependencies

---

## Success Criteria

### Feature 6: Manual Sales Tax Marking ✅
- [ ] Income transactions can be marked as subject to sales tax
- [ ] Tax rate can be selected from user's configured categories
- [ ] Tax amount calculated automatically and displayed
- [ ] salesTaxTransactions record created on save
- [ ] Sales tax info displayed on transaction list and detail views
- [ ] Edit and delete operations handle sales tax records correctly

### Feature 7: Rule-Based Sales Tax ✅
- [ ] New rule action type `set_sales_tax` implemented
- [ ] Rule builder UI allows configuring tax rate
- [ ] Rules automatically apply sales tax to matching income transactions
- [ ] Bulk apply rules includes sales tax application
- [ ] Applied actions logged in ruleExecutionLog
- [ ] Only income transactions can have sales tax applied

### Quality ✅
- [ ] All code uses theme CSS variables
- [ ] Decimal.js used for all financial calculations
- [ ] Full TypeScript type safety
- [ ] Comprehensive error handling
- [ ] Production build successful
- [ ] Zero console errors or warnings
- [ ] Responsive design (mobile + desktop)

---

## Implementation Order

**Day 1 (4 hours):**
1. ✅ Phase 2: Type system updates (30 min)
2. ✅ Phase 3: Sales tax utilities (45 min)
3. ✅ Phase 4: Transaction API updates (1 hour)
4. ✅ Phase 5: Rule action implementation (1 hour)
5. ✅ Phase 7: Sales tax categories API (30 min)

**Day 2 (4 hours):**
6. ✅ Phase 6: Transaction form UI (2 hours)
7. ✅ Phase 8: Transaction display updates (1 hour)
8. ✅ Phase 9: Rule builder UI (1.5 hours)
9. ✅ Phase 10: Bulk apply integration (30 min)
10. ✅ Phase 11: Documentation and testing (1 hour)

---

## Notes

- **Non-Breaking:** All changes are additive, no breaking changes to existing functionality
- **Backward Compatible:** Existing transactions without sales tax continue to work
- **Theme Integration:** All UI uses CSS variables for theme support
- **Performance:** Minimal impact, sales tax only fetched when needed
- **Error Handling:** Sales tax failures are non-fatal, transaction creation still succeeds
- **Audit Trail:** All rule applications logged in ruleExecutionLog

---

## Future Enhancements (Out of Scope)

- Sales tax on expense transactions (input tax credits)
- Multi-jurisdiction tax support (nexus management)
- Automatic tax exemption handling
- Tax rate effective date changes
- Integration with tax filing services
- Destination-based sales tax calculation
