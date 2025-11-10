# Sales Tax Boolean Refactor Plan

**Goal:** Simplify sales tax tracking from a rate-based system to a simple boolean flag (yes/no) system.

**Current Implementation:**
- Sales tax includes tax rate selection (percentage)
- Real-time calculation display (sale amount + tax + total)
- Sales tax categories with different rates
- Complex data structure in salesTaxTransactions table

**Target Implementation:**
- Simple checkbox to mark income transactions as subject to sales tax
- No rate selection or calculation display
- Simplified data structure
- Boolean flag storage

---

## Phase 1: Backend Changes (Database & API)

### Task 1.1: Database Schema Analysis
**File:** `lib/db/schema.ts`
**Action:** Review current salesTaxTransactions schema
- Identify fields to keep: id, transactionId, householdId, taxableAmount, createdAt
- Identify fields to remove: taxRate, taxAmount, filingFrequency, dueDate, categoryId, notes
- Plan migration strategy

**Estimated Time:** 15 minutes

### Task 1.2: Create Database Migration
**File:** `drizzle/0023_simplify_sales_tax.sql`
**Action:** Create migration to simplify salesTaxTransactions table
- Remove columns: taxRate, taxAmount, filingFrequency, dueDate, categoryId, notes
- Keep columns: id, transactionId, householdId, taxableAmount, createdAt
- Add comment explaining simplified structure
- Test migration rollback capability

**Estimated Time:** 20 minutes

### Task 1.3: Update Schema Definition
**File:** `lib/db/schema.ts`
**Action:** Update salesTaxTransactions table definition
- Remove deprecated fields from schema
- Update TypeScript types
- Add JSDoc comments explaining boolean nature

**Estimated Time:** 15 minutes

### Task 1.4: Simplify Sales Tax API
**File:** `app/api/sales-tax/categories/route.ts`
**Action:** Evaluate if this endpoint is still needed
- If quarterly reporting needs categories, keep endpoint but simplify
- If not needed, deprecate and remove
- Update response format to match new simplified structure

**Estimated Time:** 20 minutes

---

## Phase 2: Transaction Form UI Simplification

### Task 2.1: Update Transaction Form
**File:** `components/transactions/transaction-form.tsx`
**Action:** Simplify sales tax UI
- Keep sales tax checkbox (income transactions only)
- Remove tax rate selector completely
- Remove real-time calculation display (sale amount + tax + total)
- Remove tax categories fetching
- Simplify helper text: "Mark this income as subject to sales tax"
- Update form submission to just send boolean flag

**Changes:**
```tsx
// BEFORE
{transactionType === 'income' && (
  <div className="space-y-3">
    <div className="flex items-center space-x-2">
      <input type="checkbox" id="salesTax" checked={isSalesTaxable} onChange={...} />
      <label>Subject to sales tax</label>
    </div>
    {isSalesTaxable && (
      <>
        <select value={salesTaxRate}>
          {taxCategories.map(...)}
        </select>
        <div className="calculation-display">
          Sale Amount: $X.XX
          Sales Tax (Y%): $Z.ZZ
          Total: $A.AA
        </div>
      </>
    )}
  </div>
)}

// AFTER
{transactionType === 'income' && (
  <div className="flex items-center space-x-2">
    <input
      type="checkbox"
      id="salesTax"
      checked={isSalesTaxable}
      onChange={(e) => setIsSalesTaxable(e.target.checked)}
      className="h-4 w-4 rounded border-border bg-input"
    />
    <label
      htmlFor="salesTax"
      className="text-sm text-muted-foreground cursor-pointer"
    >
      Subject to sales tax
    </label>
  </div>
)}
```

**Estimated Time:** 30 minutes

### Task 2.2: Update Form State Management
**File:** `components/transactions/transaction-form.tsx`
**Action:** Remove unnecessary state variables
- Remove `salesTaxRate` state
- Remove `taxCategories` state
- Remove tax calculation logic
- Simplify form submission payload
- Update TypeScript types

**Estimated Time:** 15 minutes

---

## Phase 3: Rules System Simplification

### Task 3.1: Update Rule Action Types
**File:** `lib/rules/types.ts`
**Action:** Simplify SalesTaxConfig interface
- Change from `{ taxRate: number }` to `{ enabled: boolean }` or just null (action presence implies enabled)
- Update TypeScript documentation
- Consider making it a simple flag action with no config needed

**Changes:**
```typescript
// BEFORE
export interface SalesTaxConfig {
  taxRate: number; // Percentage (e.g., 7.5 for 7.5%)
}

// AFTER
// No config needed - presence of action means "mark as sales taxable"
// OR keep it simple:
export interface SalesTaxConfig {
  enabled: boolean; // Always true when action exists
}
```

**Estimated Time:** 10 minutes

### Task 3.2: Update Actions Executor
**File:** `lib/rules/actions-executor.ts`
**Action:** Simplify executeSetSalesTaxAction
- Remove tax rate validation
- Remove calculation logic
- Set isSalesTaxable boolean flag only
- Simplify salesTaxData structure
- Update error messages

**Changes:**
```typescript
// BEFORE
if (action.type === 'set_sales_tax') {
  const config = action.config as SalesTaxConfig;
  if (!config?.taxRate || config.taxRate <= 0) {
    throw new Error('Invalid tax rate');
  }
  mutations.salesTaxData = {
    enabled: true,
    taxRate: config.taxRate,
    // ... calculations
  };
}

// AFTER
if (action.type === 'set_sales_tax') {
  // Simply mark as sales taxable
  mutations.isSalesTaxable = true;
}
```

**Estimated Time:** 20 minutes

### Task 3.3: Simplify Sales Tax Action Handler
**File:** `lib/sales-tax/transaction-sales-tax.ts`
**Action:** Update utility functions
- Remove calculateSalesTax function
- Remove validateTaxRate function
- Simplify createSalesTaxRecord to just create flag record
- Update getSalesTaxInfo to return boolean only
- Remove tax calculation helpers

**Estimated Time:** 25 minutes

---

## Phase 4: Rule Builder UI Simplification

### Task 4.1: Update Rule Builder Component
**File:** `components/rules/rule-builder.tsx`
**Action:** Simplify set_sales_tax action UI
- Remove tax rate selector
- Keep action type selector entry
- Update info box text to explain boolean nature
- Remove rate-based validation
- Simplify warning message

**Changes:**
```tsx
// BEFORE
{action.type === 'set_sales_tax' && (
  <>
    <select value={action.config.taxRate}>
      {taxCategories.map(...)}
    </select>
    <div className="info-box">
      Sets sales tax rate to X% when rule matches
    </div>
  </>
)}

// AFTER
{action.type === 'set_sales_tax' && (
  <div className="rounded-lg border border-border bg-card p-4">
    <div className="flex items-start space-x-2">
      <AlertCircle className="h-4 w-4 text-[var(--color-warning)] mt-0.5 flex-shrink-0" />
      <div className="text-sm">
        <p className="text-foreground font-medium mb-1">Sales Tax Marking</p>
        <p className="text-muted-foreground">
          Transactions matching this rule will be automatically marked as subject to sales tax.
          Only applies to income transactions.
        </p>
      </div>
    </div>
  </div>
)}
```

**Estimated Time:** 25 minutes

### Task 4.2: Update Rules Manager Display
**File:** `components/rules/rules-manager.tsx`
**Action:** Update action label display
- Keep "Set Sales Tax" label
- Remove rate percentage display
- Simplify tooltip/description

**Estimated Time:** 10 minutes

### Task 4.3: Update Rules Page Validation
**File:** `app/dashboard/rules/page.tsx`
**Action:** Remove rate-based validation
- Remove tax rate validation check
- Simplify error messages
- Update save logic

**Estimated Time:** 10 minutes

---

## Phase 5: API Integration Updates

### Task 5.1: Update Transaction Creation API
**File:** `app/api/transactions/route.ts`
**Action:** Simplify sales tax handling
- Accept boolean flag for sales tax
- Remove rate processing
- Simplify salesTaxTransactions record creation
- Update validation logic

**Changes:**
```typescript
// BEFORE
if (salesTaxData?.enabled && salesTaxData.taxRate) {
  await db.insert(salesTaxTransactions).values({
    id: uuidv4(),
    transactionId: transaction.id,
    householdId,
    taxableAmount: amount.toString(),
    taxRate: salesTaxData.taxRate,
    taxAmount: calculatedTax.toString(),
    // ... other fields
  });
}

// AFTER
if (isSalesTaxable && transactionType === 'income') {
  await db.insert(salesTaxTransactions).values({
    id: uuidv4(),
    transactionId: transaction.id,
    householdId,
    taxableAmount: amount.toString(),
    createdAt: new Date(),
  });
}
```

**Estimated Time:** 20 minutes

### Task 5.2: Update Transaction Update API
**File:** `app/api/transactions/[id]/route.ts`
**Action:** Simplify update logic
- Handle boolean flag changes
- Update salesTaxTransactions records accordingly
- Remove rate update logic

**Estimated Time:** 15 minutes

### Task 5.3: Update Bulk Apply Rules API
**File:** `app/api/rules/apply-bulk/route.ts`
**Action:** Ensure compatibility
- Verify sales tax action works with simplified structure
- Update any rate-specific logic
- Test bulk application

**Estimated Time:** 15 minutes

---

## Phase 6: Sales Tax Reporting Updates

### Task 6.1: Review Sales Tax Dashboard
**File:** `app/dashboard/sales-tax/page.tsx`
**Action:** Update quarterly reporting view
- Remove tax rate columns if present
- Focus on taxable income amounts only
- Simplify calculations (just sum taxable amounts)
- Update export functionality

**Estimated Time:** 30 minutes

### Task 6.2: Update Sales Tax Reports
**File:** `app/api/sales-tax/route.ts` (if exists)
**Action:** Simplify reporting logic
- Remove rate-based aggregations
- Return simple list of taxable income transactions
- Group by quarter
- Calculate totals without rate considerations

**Estimated Time:** 20 minutes

---

## Phase 7: Cleanup & Documentation

### Task 7.1: Remove Unused Code
**Files:** Multiple
**Action:** Clean up deprecated code
- Remove unused utility functions
- Remove unused API endpoints
- Remove unused components
- Remove unused imports

**Estimated Time:** 30 minutes

### Task 7.2: Update Documentation
**Files:**
- `.claude/CLAUDE.md`
- `docs/features.md`
- `docs/sales-tax-income-tracking-plan.md`

**Action:** Update all documentation
- Mark Features 6 & 7 as "refactored to boolean"
- Update tech stack documentation
- Update API documentation
- Add migration notes

**Estimated Time:** 20 minutes

### Task 7.3: Update TypeScript Types
**Files:** Multiple type files
**Action:** Ensure type safety
- Remove rate-based types
- Update transaction types
- Update form types
- Update API response types

**Estimated Time:** 15 minutes

---

## Phase 8: Testing & Verification

### Task 8.1: Manual Testing Checklist
**Action:** Test all affected functionality
- [ ] Create income transaction with sales tax checkbox
- [ ] Verify salesTaxTransactions record created (simplified structure)
- [ ] Edit transaction to toggle sales tax on/off
- [ ] Create rule with set_sales_tax action
- [ ] Apply rule to income transactions
- [ ] Verify bulk apply works correctly
- [ ] Check sales tax dashboard displays correctly
- [ ] Verify quarterly reports work
- [ ] Test with both themes (Dark Mode + Dark Pink)
- [ ] Test on mobile responsive view

**Estimated Time:** 45 minutes

### Task 8.2: Database Migration Testing
**Action:** Test migration
- [ ] Backup current database
- [ ] Run migration
- [ ] Verify existing data preserved (taxableAmount)
- [ ] Verify removed columns gone
- [ ] Test rollback if needed
- [ ] Verify all queries work with new schema

**Estimated Time:** 30 minutes

### Task 8.3: Build & Type Check
**Action:** Verify production readiness
- [ ] Run `pnpm build` - ensure success
- [ ] Fix any TypeScript errors
- [ ] Check for console warnings
- [ ] Verify no unused imports
- [ ] Check bundle size impact

**Estimated Time:** 20 minutes

---

## Summary

**Total Estimated Time:** 8-10 hours

**Files to Modify:**
1. Database: schema.ts, migration file (2 files)
2. Transaction Form: transaction-form.tsx (1 file)
3. Rules System: types.ts, actions-executor.ts, transaction-sales-tax.ts (3 files)
4. Rule Builder: rule-builder.tsx, rules-manager.tsx, page.tsx (3 files)
5. APIs: transactions/route.ts, transactions/[id]/route.ts, rules/apply-bulk/route.ts (3 files)
6. Sales Tax: sales-tax page, sales-tax API (2 files)
7. Documentation: CLAUDE.md, features.md (2 files)

**Total Files:** ~16 files

**Key Benefits:**
- Simpler user experience (just check a box)
- Reduced code complexity
- Fewer validation requirements
- Faster form interactions
- Cleaner data structure
- Easier to understand and maintain

**Risks:**
- Breaking change for existing users
- Data migration required
- Quarterly reports may need actual tax rates (consider adding rate configuration at household level instead)

**Rollback Plan:**
- Keep migration rollback script
- Document previous schema
- Tag release before deployment

---

## Alternative Consideration

**If users need tax rates for reporting:**
- Keep boolean flag on transactions (simplified UI)
- Add tax rate configuration at household/state level
- Apply configured rate during quarterly report generation
- This keeps transaction entry simple while maintaining reporting accuracy

**Trade-off:** One-time configuration vs. per-transaction flexibility

---

## Next Steps

1. Review this plan with stakeholders
2. Decide on tax rate handling for reports (see Alternative Consideration)
3. Begin with Task 1.1 (Database Schema Analysis)
4. Execute tasks sequentially by phase
5. Test thoroughly before production deployment
