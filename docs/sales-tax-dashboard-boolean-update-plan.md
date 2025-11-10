# Sales Tax Dashboard Boolean Update Plan

**Date:** 2025-11-10
**Status:** Planning Phase
**Goal:** Update the Sales Tax Dashboard to work with the new boolean `isSalesTaxable` flag system instead of the old rate-based system.

## Background

The boolean refactor (migration 0023) simplified sales tax tracking:
- **Old System:** Complex rate-based with tax calculations, `salesTaxTransactions` table with rates/amounts
- **New System:** Simple boolean flag (`isSalesTaxable`) on transactions table - just marks income as taxable
- **Core Functionality:** ✅ Complete (transaction form, rules, API all updated)
- **Dashboard:** ⏳ Still uses old `salesTaxTransactions` table and expects tax rates/amounts

## Problem Analysis

The dashboard currently:
1. Queries `salesTaxTransactions` table (lines 122-125 in sales-tax-utils.ts)
2. Expects `taxRate`, `taxAmount`, `saleAmount` fields
3. Calculates tax totals and effective rates
4. Shows tax rate per quarter (line 338-341 in page.tsx)
5. Charts sales vs tax (bars with tax amounts)

With the boolean system:
- We only know if income is taxable (yes/no)
- We don't store tax rates or calculate tax amounts on transactions
- We need to apply tax rates at reporting time based on household/state settings
- Users should configure their tax rate once at the household level

## Architecture Decision

**Approach:** Keep transaction entry simple (boolean only), apply tax rates during reporting.

**Data Flow:**
```
Transaction Entry: Income + isSalesTaxable checkbox (no rate)
                   ↓
              Database: transactions.isSalesTaxable = true
                   ↓
Dashboard Query: SELECT transactions WHERE isSalesTaxable = true
                   ↓
   Apply Rate: Use household tax rate from salesTaxSettings
                   ↓
     Calculate: taxableAmount × taxRate = taxAmount
                   ↓
      Display: Quarterly reports with calculated totals
```

**Benefits:**
- Simplified transaction entry (just checkbox)
- Centralized tax rate configuration
- Accurate quarterly reporting
- Easy to update rate without touching old transactions
- Maintains backward compatibility with existing data

## Implementation Tasks

### Phase 1: Data Access Layer Updates

#### Task 1.1: Update Sales Tax Utilities
**File:** `lib/sales-tax/sales-tax-utils.ts`
**Estimated Time:** 45 minutes

**Changes:**
1. **Update `getQuarterlyReport` function** (~150 lines modified):
   - Change query from `salesTaxTransactions` table to `transactions` table
   - Filter by `isSalesTaxable = true` and `transactionType = 'income'`
   - Join with accounts to filter business accounts (optional)
   - Calculate totals using transactions.amount
   - Apply tax rate from salesTaxSettings (household level)

   ```typescript
   // NEW APPROACH
   export async function getQuarterlyReport(
     userId: string,
     year: number,
     quarter: number,
     accountId?: string
   ): Promise<QuarterlyReport> {
     // 1. Get user's tax rate from settings
     const settings = await db
       .select()
       .from(salesTaxSettings)
       .where(eq(salesTaxSettings.userId, userId))
       .limit(1);

     const taxRate = settings[0]?.defaultRate || 0;

     // 2. Get quarter date range
     const quarterDates = getQuarterDates(year);
     const quarterInfo = quarterDates.find((q) => q.quarter === quarter);

     // 3. Query transactions with isSalesTaxable = true
     const whereConditions = [
       eq(transactions.userId, userId),
       eq(transactions.isSalesTaxable, true),
       eq(transactions.transactionType, 'income'),
       gte(transactions.date, quarterInfo.startDate),
       lte(transactions.date, quarterInfo.endDate),
     ];

     if (accountId) {
       whereConditions.push(eq(transactions.accountId, accountId));
     }

     const taxableTransactions = await db
       .select()
       .from(transactions)
       .where(and(...whereConditions));

     // 4. Calculate totals
     let totalSales = new Decimal(0);
     taxableTransactions.forEach((txn) => {
       totalSales = totalSales.plus(new Decimal(txn.amount));
     });

     // 5. Calculate tax using configured rate
     const taxRateDecimal = new Decimal(taxRate).dividedBy(100); // Convert percentage to decimal
     const totalTax = totalSales.times(taxRateDecimal);

     // 6. Get filing record (if exists)
     const filingRecord = await getFilingRecord(userId, year, quarter);

     return {
       year,
       quarter,
       totalSales: totalSales.toNumber(),
       totalTax: totalTax.toNumber(),
       taxRate: taxRateDecimal.toNumber(),
       dueDate: quarterInfo.dueDate,
       submittedDate: filingRecord?.submittedDate,
       status: filingRecord?.status || 'pending',
       balanceDue: filingRecord?.balanceDue || totalTax.toNumber(),
     };
   }
   ```

2. **Update helper functions:**
   - `getYearlyQuarterlyReports`: Already uses `getQuarterlyReport`, no changes needed
   - `getQuarterlyReportsByAccount`: Update to use new query approach
   - `getYearlyQuarterlyReportsByAccount`: Already uses `getYearlyQuarterlyReports`, no changes needed
   - `getYearToDateTax`: Already uses `getQuarterlyReport`, no changes needed

3. **Keep utility functions unchanged:**
   - `getQuarterDates()` - Still needed
   - `calculateTaxAmount()` - Still useful for calculations
   - `getStatusColor()` - Still needed for UI
   - `formatTaxRate()`, `formatCurrency()` - Still needed
   - Date/deadline helpers - All still needed

#### Task 1.2: Add Tax Rate Configuration Helper
**File:** `lib/sales-tax/sales-tax-utils.ts`
**Estimated Time:** 20 minutes

**New Function:**
```typescript
/**
 * Get or create sales tax settings for user
 * Returns default 0% if not configured
 */
export async function getUserSalesTaxRate(userId: string): Promise<number> {
  const settings = await db
    .select()
    .from(salesTaxSettings)
    .where(eq(salesTaxSettings.userId, userId))
    .limit(1);

  if (settings.length === 0) {
    // Return 0% if not configured - user needs to set up their rate
    return 0;
  }

  return settings[0].defaultRate;
}

/**
 * Update user's sales tax rate
 */
export async function updateUserSalesTaxRate(
  userId: string,
  rate: number
): Promise<void> {
  const existing = await db
    .select()
    .from(salesTaxSettings)
    .where(eq(salesTaxSettings.userId, userId))
    .limit(1);

  if (existing.length === 0) {
    // Create new settings
    await db.insert(salesTaxSettings).values({
      id: uuidv4(),
      userId,
      defaultRate: rate,
      filingFrequency: 'quarterly',
      enableTracking: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  } else {
    // Update existing
    await db
      .update(salesTaxSettings)
      .set({
        defaultRate: rate,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(salesTaxSettings.userId, userId));
  }
}
```

---

### Phase 2: API Updates

#### Task 2.1: Create Tax Rate Settings API
**File:** `app/api/sales-tax/settings/route.ts` (NEW FILE)
**Estimated Time:** 30 minutes

**Purpose:** Allow users to configure their sales tax rate at the household level

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { salesTaxSettings } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

/**
 * GET /api/sales-tax/settings
 * Returns user's sales tax settings
 */
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const settings = await db
      .select()
      .from(salesTaxSettings)
      .where(eq(salesTaxSettings.userId, userId))
      .limit(1);

    if (settings.length === 0) {
      // Return defaults
      return NextResponse.json({
        defaultRate: 0,
        jurisdiction: '',
        filingFrequency: 'quarterly',
        enableTracking: true,
      });
    }

    return NextResponse.json(settings[0]);
  } catch (error) {
    console.error('Error getting sales tax settings:', error);
    return NextResponse.json(
      { error: 'Failed to get settings' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/sales-tax/settings
 * Create or update sales tax settings
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { defaultRate, jurisdiction, filingFrequency } = body;

    // Validation
    if (typeof defaultRate !== 'number' || defaultRate < 0 || defaultRate > 100) {
      return NextResponse.json(
        { error: 'Tax rate must be between 0 and 100' },
        { status: 400 }
      );
    }

    // Check if settings exist
    const existing = await db
      .select()
      .from(salesTaxSettings)
      .where(eq(salesTaxSettings.userId, userId))
      .limit(1);

    if (existing.length === 0) {
      // Create new
      const newSettings = {
        id: uuidv4(),
        userId,
        defaultRate,
        jurisdiction: jurisdiction || null,
        filingFrequency: filingFrequency || 'quarterly',
        enableTracking: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await db.insert(salesTaxSettings).values(newSettings);
      return NextResponse.json(newSettings, { status: 201 });
    } else {
      // Update existing
      const updated = {
        ...existing[0],
        defaultRate,
        jurisdiction: jurisdiction || existing[0].jurisdiction,
        filingFrequency: filingFrequency || existing[0].filingFrequency,
        updatedAt: new Date().toISOString(),
      };

      await db
        .update(salesTaxSettings)
        .set(updated)
        .where(eq(salesTaxSettings.userId, userId));

      return NextResponse.json(updated);
    }
  } catch (error) {
    console.error('Error updating sales tax settings:', error);
    return NextResponse.json(
      { error: 'Failed to update settings' },
      { status: 500 }
    );
  }
}
```

#### Task 2.2: Update Quarterly API to Use New Data Source
**File:** `app/api/sales-tax/quarterly/route.ts`
**Estimated Time:** 10 minutes

**Changes:**
- No changes needed! The API just calls the utility functions
- Once we update `getQuarterlyReport()` in utils, this API automatically uses the new approach
- Test to ensure responses still match expected interface

---

### Phase 3: Dashboard UI Updates

#### Task 3.1: Add Tax Rate Configuration Section
**File:** `app/dashboard/sales-tax/page.tsx`
**Estimated Time:** 40 minutes

**New Section:** Add tax rate configuration at the top of the dashboard (before metrics)

```tsx
// Add state for tax rate
const [taxRate, setTaxRate] = useState<number>(0);
const [jurisdiction, setJurisdiction] = useState<string>('');
const [isEditingRate, setIsEditingRate] = useState(false);
const [isSavingRate, setIsSavingRate] = useState(false);

// Fetch settings on mount
useEffect(() => {
  fetchTaxRateSettings();
}, []);

const fetchTaxRateSettings = async () => {
  try {
    const response = await fetch('/api/sales-tax/settings');
    if (response.ok) {
      const settings = await response.json();
      setTaxRate(settings.defaultRate);
      setJurisdiction(settings.jurisdiction || '');
    }
  } catch (error) {
    console.error('Error fetching tax rate settings:', error);
  }
};

const saveTaxRateSettings = async () => {
  try {
    setIsSavingRate(true);
    const response = await fetch('/api/sales-tax/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        defaultRate: taxRate,
        jurisdiction,
        filingFrequency: 'quarterly',
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to save settings');
    }

    setIsEditingRate(false);
    // Refresh reports with new rate
    fetchSalesTaxData();
    toast.success('Tax rate settings saved');
  } catch (error) {
    console.error('Error saving tax rate:', error);
    toast.error('Failed to save tax rate settings');
  } finally {
    setIsSavingRate(false);
  }
};

// Add configuration card before metrics
<Card className="bg-card border-border">
  <CardHeader>
    <CardTitle className="flex items-center justify-between">
      <span className="flex items-center gap-2">
        <Settings className="w-5 h-5 text-[var(--color-primary)]" />
        Sales Tax Configuration
      </span>
      {!isEditingRate && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsEditingRate(true)}
          className="text-muted-foreground hover:text-foreground"
        >
          <Pencil className="w-4 h-4 mr-2" />
          Edit
        </Button>
      )}
    </CardTitle>
    <CardDescription>
      Configure your sales tax rate for quarterly reporting
    </CardDescription>
  </CardHeader>
  <CardContent>
    {isEditingRate ? (
      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm text-muted-foreground">
            Sales Tax Rate (%)
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            max="100"
            value={taxRate}
            onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
            className="w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground"
            placeholder="e.g., 8.5"
          />
          <p className="text-xs text-muted-foreground">
            Enter your local sales tax rate (e.g., 8.5 for 8.5%)
          </p>
        </div>

        <div className="space-y-2">
          <label className="text-sm text-muted-foreground">
            Jurisdiction (Optional)
          </label>
          <input
            type="text"
            value={jurisdiction}
            onChange={(e) => setJurisdiction(e.target.value)}
            className="w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground"
            placeholder="e.g., California, New York"
          />
        </div>

        <div className="flex gap-2">
          <Button
            onClick={saveTaxRateSettings}
            disabled={isSavingRate}
            className="bg-[var(--color-primary)] text-white hover:opacity-90"
          >
            {isSavingRate ? 'Saving...' : 'Save Settings'}
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setIsEditingRate(false);
              fetchTaxRateSettings(); // Reset to original values
            }}
            disabled={isSavingRate}
          >
            Cancel
          </Button>
        </div>
      </div>
    ) : (
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-sm text-muted-foreground mb-1">Tax Rate</p>
          <p className="text-2xl font-bold text-foreground">
            {taxRate.toFixed(2)}%
          </p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground mb-1">Jurisdiction</p>
          <p className="text-lg font-medium text-foreground">
            {jurisdiction || 'Not set'}
          </p>
        </div>
      </div>
    )}

    {taxRate === 0 && !isEditingRate && (
      <div className="mt-4 p-3 bg-[var(--color-warning)]/10 border border-[var(--color-warning)] rounded-lg">
        <div className="flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-[var(--color-warning)] mt-0.5 flex-shrink-0" />
          <div className="text-sm">
            <p className="text-foreground font-medium mb-1">
              Configure Your Tax Rate
            </p>
            <p className="text-muted-foreground">
              Set your sales tax rate to see accurate quarterly reports.
              Reports will show $0 tax until a rate is configured.
            </p>
          </div>
        </div>
      </div>
    )}
  </CardContent>
</Card>
```

#### Task 3.2: Update No Data State
**File:** `app/dashboard/sales-tax/page.tsx`
**Estimated Time:** 15 minutes

**Changes:** Update the empty state instructions to reflect boolean system

```tsx
{!hasData && (
  <Card className="text-center py-12">
    <CardContent>
      <DollarSign className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
      <h3 className="text-xl font-semibold text-foreground mb-2">
        No Sales Tax Data Available
      </h3>
      <p className="text-muted-foreground mb-4">
        There are no taxable sales for {year}.
      </p>
      <p className="text-sm text-muted-foreground mb-2">
        To track sales tax:
      </p>
      <ul className="text-sm text-muted-foreground text-left max-w-md mx-auto space-y-2">
        <li className="flex items-start gap-2">
          <span className="text-[var(--color-primary)] mt-1">1.</span>
          <span>Configure your sales tax rate above</span>
        </li>
        <li className="flex items-start gap-2">
          <span className="text-[var(--color-primary)] mt-1">2.</span>
          <span>Create income transactions in any account</span>
        </li>
        <li className="flex items-start gap-2">
          <span className="text-[var(--color-primary)] mt-1">3.</span>
          <span>Check "Subject to sales tax" when creating income</span>
        </li>
        <li className="flex items-start gap-2">
          <span className="text-[var(--color-primary)] mt-1">4.</span>
          <span>Or use rules to automatically mark income as taxable</span>
        </li>
      </ul>
    </CardContent>
  </Card>
)}
```

#### Task 3.3: Update Quarterly Filing Cards
**File:** `app/dashboard/sales-tax/page.tsx`
**Estimated Time:** 10 minutes

**Changes:**
- Tax rate display now shows configured household rate (not per-transaction average)
- Update helper text to clarify this is the rate used for calculations

```tsx
<div>
  <p className="text-muted-foreground">Tax Rate</p>
  <p className="text-foreground font-medium">
    {(quarter.taxRate * 100).toFixed(2)}%
  </p>
  <p className="text-xs text-muted-foreground">
    (configured rate)
  </p>
</div>
```

#### Task 3.4: Add Import for New Icons
**File:** `app/dashboard/sales-tax/page.tsx`
**Estimated Time:** 2 minutes

```tsx
import {
  AlertCircle,
  Calendar,
  DollarSign,
  TrendingUp,
  CheckCircle2,
  Settings,  // NEW
  Pencil,    // NEW
} from 'lucide-react';
```

---

### Phase 4: Theme Integration & Polish

#### Task 4.1: Update All Hardcoded Colors
**File:** `app/dashboard/sales-tax/page.tsx`
**Estimated Time:** 20 minutes

**Find and Replace:**
- `text-white` → `text-foreground`
- `text-gray-400` → `text-muted-foreground`
- `text-gray-500` → `text-muted-foreground`
- `text-emerald-400` → `text-[var(--color-success)]`
- `text-blue-400` → `text-[var(--color-transfer)]`
- `text-amber-400` → `text-[var(--color-warning)]`
- `text-red-400` → `text-[var(--color-error)]`
- `text-yellow-400` → `text-[var(--color-warning)]`
- `border-border` → Keep (already semantic)
- `bg-blue-950/30 border-blue-700/50` → `bg-[var(--color-transfer)]/10 border-[var(--color-transfer)]/30`

**Chart Colors:**
```tsx
<BarChart
  title="Quarterly Sales & Tax"
  description={`Sales and tax collected by quarter for ${year}`}
  data={chartData}
  bars={[
    { dataKey: 'sales', fill: 'var(--color-income)', name: 'Sales' },
    { dataKey: 'tax', fill: 'var(--color-success)', name: 'Tax' },
  ]}
/>
```

#### Task 4.2: Update Loading and Error States
**File:** `app/dashboard/sales-tax/page.tsx`
**Estimated Time:** 10 minutes

```tsx
// Loading state
<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--color-primary)] mx-auto mb-4"></div>
<p className="text-muted-foreground">Loading sales tax information...</p>

// Error state
<p className="text-[var(--color-error)] font-medium mb-2">Error</p>
<p className="text-muted-foreground mb-4">{error || 'Unknown error'}</p>
```

---

### Phase 5: Documentation & Testing

#### Task 5.1: Update Documentation
**Files:** `docs/features.md`, `.claude/CLAUDE.md`
**Estimated Time:** 15 minutes

**Changes:**
- Mark "Sales Tax Dashboard" as COMPLETE in features.md
- Update CLAUDE.md with new architecture notes
- Document the household-level tax rate approach
- Add API endpoint documentation for /api/sales-tax/settings

#### Task 5.2: Manual Testing Checklist
**Estimated Time:** 30 minutes

**Test Cases:**
- [ ] Fresh user with no settings sees 0% rate and warning
- [ ] User can configure tax rate via dashboard
- [ ] Rate is saved and persists across page reloads
- [ ] Creating income with isSalesTaxable=true appears in dashboard
- [ ] Quarterly reports show correct totals (sales × rate)
- [ ] Effective rate calculation matches configured rate
- [ ] Year selector works correctly
- [ ] Chart displays sales and tax bars correctly
- [ ] Export button works (if using configured rate)
- [ ] Filing status updates work
- [ ] Theme switching works (Dark Mode + Dark Pink)
- [ ] Mobile responsive layout works
- [ ] No console errors or warnings

#### Task 5.3: Build & Type Check
**Estimated Time:** 10 minutes

```bash
# Run build
pnpm build

# Check for errors
# Fix any TypeScript errors
# Verify all imports resolve
# Check console for warnings
```

---

## Summary

**Total Estimated Time:** 4-5 hours

**Files to Create (1):**
1. `app/api/sales-tax/settings/route.ts` - Tax rate configuration API

**Files to Modify (3):**
1. `lib/sales-tax/sales-tax-utils.ts` - Update data access to use transactions table
2. `app/dashboard/sales-tax/page.tsx` - Add rate configuration, update UI, theme integration
3. `docs/features.md` - Mark dashboard as complete

**Database Changes:**
- No migrations needed! `salesTaxSettings` table already exists
- `isSalesTaxable` field already exists on transactions table

**Key Benefits:**
- ✅ Simplified transaction entry (users already have this)
- ✅ Centralized tax rate management (one place to configure)
- ✅ Accurate quarterly reporting (apply rate at report time)
- ✅ No need to update old transactions when rate changes
- ✅ Backward compatible (can coexist with old salesTaxTransactions data)
- ✅ Full theme integration
- ✅ Production ready

**Risks:**
- Low risk - isolated to dashboard only
- No breaking changes to transaction creation
- Existing taxable transactions will appear in reports
- Rate configuration is optional (defaults to 0%)

**Testing Priority:**
1. Tax rate configuration (create/update)
2. Quarterly report calculations (verify math)
3. Theme integration (all colors semantic)
4. Mobile responsive layout

---

## Next Steps

1. Review this plan
2. Start with Phase 1 (Data Access Layer) - most critical
3. Then Phase 2 (API) and Phase 3 (UI) can be done in parallel
4. Finish with Phase 4 (Polish) and Phase 5 (Testing)
5. Deploy to production once all tests pass

---

## Alternative Approaches Considered

### Alternative 1: Keep salesTaxTransactions Table
- **Pros:** No changes to dashboard/utils
- **Cons:** Complex migration needed, contradicts boolean refactor goal
- **Decision:** Rejected - doesn't align with simplification objective

### Alternative 2: Remove Sales Tax Dashboard Entirely
- **Pros:** Complete simplification
- **Cons:** Users lose quarterly reporting capability
- **Decision:** Rejected - reporting is valuable for tax compliance

### Alternative 3: Multiple Tax Rates Per Household
- **Pros:** Handles multi-jurisdiction businesses
- **Cons:** Adds complexity back, defeats purpose of boolean system
- **Decision:** Deferred - can add later if users request it

**Chosen Approach:** Single household-level tax rate with dashboard reporting (this plan)
