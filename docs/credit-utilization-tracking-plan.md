# Feature #11: Credit Utilization Tracking - Implementation Plan

## Overview
Add comprehensive credit utilization tracking for credit cards to help users monitor and manage their credit health. Credit utilization (balance ÷ limit) is a critical factor in credit scores, and keeping it below 30% is generally recommended.

## Current State Analysis

### Existing Infrastructure
- ✅ Debts table with `type` field including 'credit_card'
- ✅ Debt tracking system with balances and payments
- ✅ DebtPayoffTracker component for displaying debt cards
- ✅ DebtForm component for creating/editing debts
- ✅ Theme system with semantic color variables
- ❌ NO `creditLimit` field in debts table (needs to be added)
- ❌ NO utilization tracking or alerts

### Current Debt Schema
```typescript
export const debts = sqliteTable('debts', {
  id: text('id').primaryKey(),
  type: text('type', {
    enum: ['credit_card', 'personal_loan', 'student_loan', 'mortgage', 'auto_loan', 'medical', 'other'],
  }),
  remainingBalance: real('remaining_balance').notNull(),
  // ... other fields
  // MISSING: creditLimit field
});
```

## Feature Requirements

### 1. Credit Limit Field
- Add `creditLimit` field to debts table (nullable, only for credit cards)
- Update debt form to show credit limit input when type is 'credit_card'
- Validate that credit limit is greater than or equal to current balance

### 2. Utilization Calculation
- Formula: `utilization = (remainingBalance / creditLimit) * 100`
- Display as percentage with color coding
- Show available credit: `availableCredit = creditLimit - remainingBalance`

### 3. Credit Health Indicators
Color-coded based on utilization:
- **Excellent** (0-10%): Green - `var(--color-success)`
- **Good** (10-30%): Green - `var(--color-success)`
- **Fair** (30-50%): Amber - `var(--color-warning)`
- **Poor** (50-75%): Orange - `var(--color-warning)`
- **Critical** (75-100%+): Red - `var(--color-error)`

### 4. Credit Utilization Dashboard Widget
Show aggregate statistics:
- Total credit limit across all cards
- Total used credit
- Overall utilization percentage
- Number of cards over 30% utilization
- Total available credit

### 5. Per-Card Utilization Display
On each credit card debt tracker:
- Utilization percentage with progress bar
- Available credit amount
- Credit limit
- Visual indicator of health level
- Alert badge if over 30%

### 6. Utilization Alerts
- Warning when adding/editing a card that pushes utilization > 30%
- Notification system integration for high utilization alerts
- Dashboard widget showing cards needing attention

## Design Specifications

### Color Scheme (Using Theme Variables)
- **Excellent/Good (< 30%)**: `var(--color-success)` - Green
- **Fair/Poor (30-75%)**: `var(--color-warning)` - Amber/Orange
- **Critical (> 75%)**: `var(--color-error)` - Red
- **Backgrounds**: `bg-card`, `bg-elevated`
- **Borders**: `border-border`
- **Text**: `text-foreground`, `text-muted-foreground`
- **Accents**: `bg-accent`, `text-accent`

### Layout Mockups

#### Credit Utilization Widget (Dashboard)
```
┌─────────────────────────────────────────────────────────┐
│  💳 Credit Utilization Overview                         │
│  ═════════════════════════════════════════              │
│                                                          │
│  Overall Utilization: 23%         🟢 GOOD               │
│  ▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░       │
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │ Total Limit  │  │  Total Used  │  │  Available   │ │
│  │   $25,000    │  │    $5,750    │  │   $19,250    │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
│                                                          │
│  ⚠️ 1 card over 30% utilization                        │
│                                                          │
│  Per Card Breakdown:                                    │
│  • Chase Freedom      45%  🟡 FAIR    $2,250 / $5,000  │
│  • Amex Blue          15%  🟢 GOOD    $1,500 / $10,000 │
│  • Discover           20%  🟢 GOOD    $2,000 / $10,000 │
└─────────────────────────────────────────────────────────┘
```

#### Credit Card Debt Card (Enhanced)
```
┌─────────────────────────────────────────────────────────┐
│  🔴 Chase Freedom                        [Edit] [Delete]│
│  Chase Bank                                              │
│                                                          │
│  Balance: $2,250 / $5,000 limit                         │
│  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░░░░░         │
│                                                          │
│  💳 Utilization: 45%  🟡 FAIR                           │
│  💵 Available Credit: $2,750                            │
│                                                          │
│  ⚠️ HIGH UTILIZATION: Consider paying down this card   │
│      to improve your credit score                       │
│                                                          │
│  Progress: 30% paid off                                 │
│  $900 paid of $3,000 original                           │
└─────────────────────────────────────────────────────────┘
```

## Implementation Steps

### Step 1: Database Migration
**File**: Create new migration file

**Changes**:
```sql
ALTER TABLE debts ADD COLUMN credit_limit REAL;
```

**Migration Details**:
- Add `creditLimit: real('credit_limit')` field to debts schema
- Nullable field (not all debts are credit cards)
- Run migration with `pnpm drizzle-kit generate` and `pnpm drizzle-kit migrate`

### Step 2: Update Debt Schema
**File**: `lib/db/schema.ts`

**Changes**:
```typescript
export const debts = sqliteTable('debts', {
  // ... existing fields
  creditLimit: real('credit_limit'), // Add this field
  // ... rest of fields
});
```

### Step 3: Update Debt Form
**File**: `components/debts/debt-form.tsx`

**Changes**:
1. Add `creditLimit` to form state
2. Conditionally render credit limit input when `type === 'credit_card'`
3. Add validation: credit limit must be >= remaining balance
4. Show helpful text: "Your credit limit affects your credit score"
5. Calculate and show utilization percentage in real-time as user types

**UI Enhancement**:
```tsx
{formData.type === 'credit_card' && (
  <div>
    <Label>Credit Limit</Label>
    <Input
      type="number"
      name="creditLimit"
      value={formData.creditLimit}
      onChange={handleChange}
    />
    {formData.creditLimit && formData.remainingBalance && (
      <p className="text-sm text-muted-foreground mt-1">
        Current utilization: {calculateUtilization()}%
        {utilization > 30 && (
          <span className="text-warning"> ⚠️ Over 30%</span>
        )}
      </p>
    )}
  </div>
)}
```

### Step 4: Create Utilization Utility Functions
**File**: `lib/debts/credit-utilization-utils.ts` (NEW)

**Functions**:
```typescript
// Calculate utilization percentage
export function calculateUtilization(
  balance: number,
  limit: number
): number;

// Get utilization health level
export function getUtilizationLevel(
  utilization: number
): 'excellent' | 'good' | 'fair' | 'poor' | 'critical';

// Get color for utilization level
export function getUtilizationColor(
  utilization: number
): string; // Returns CSS variable

// Format utilization for display
export function formatUtilization(
  utilization: number
): string;

// Calculate total credit stats across all cards
export interface CreditStats {
  totalLimit: number;
  totalUsed: number;
  totalAvailable: number;
  overallUtilization: number;
  cardsOverThreshold: number;
  cards: Array<{
    id: string;
    name: string;
    balance: number;
    limit: number;
    utilization: number;
    available: number;
    level: string;
  }>;
}

export function calculateCreditStats(
  creditCards: Array<Debt>
): CreditStats;
```

### Step 5: Create Credit Utilization API Endpoint
**File**: `app/api/debts/credit-utilization/route.ts` (NEW)

**Endpoints**:
```typescript
// GET /api/debts/credit-utilization
// Returns credit utilization statistics for all credit cards
{
  totalLimit: 25000,
  totalUsed: 5750,
  totalAvailable: 19250,
  overallUtilization: 23,
  cardsOverThreshold: 1, // Cards over 30%
  cards: [
    {
      id: "debt1",
      name: "Chase Freedom",
      balance: 2250,
      limit: 5000,
      utilization: 45,
      available: 2750,
      level: "fair",
      color: "#ef4444"
    },
    // ... more cards
  ]
}
```

**Implementation**:
- Query all debts where `type = 'credit_card'` and `status = 'active'`
- Filter only cards with creditLimit set
- Calculate utilization for each
- Aggregate statistics
- Return sorted by utilization (highest first)

### Step 6: Create CreditUtilizationWidget Component
**File**: `components/debts/credit-utilization-widget.tsx` (NEW)

**Purpose**: Display overall credit utilization stats on dashboard or debts page

**Props**:
```typescript
interface CreditUtilizationWidgetProps {
  className?: string;
  compact?: boolean; // Compact mode for dashboard
}
```

**Features**:
- Fetch data from API on mount
- Show overall utilization with large progress bar
- Color-coded based on level
- Grid showing total limit, used, available
- Warning banner if any cards over 30%
- List of all cards with individual utilization
- Click card to scroll to debt tracker
- Refresh button
- Loading and error states

**Layout**:
- Header with icon and title
- Large utilization display with progress bar
- 3-column stats grid
- Alert section (if applicable)
- Card list with mini progress bars

### Step 7: Create CreditUtilizationBadge Component
**File**: `components/debts/credit-utilization-badge.tsx` (NEW)

**Purpose**: Small badge showing utilization for individual credit card

**Props**:
```typescript
interface CreditUtilizationBadgeProps {
  balance: number;
  limit: number;
  className?: string;
  showDetails?: boolean; // Show available credit
}
```

**Features**:
- Small compact display
- Color-coded percentage
- Optional available credit display
- Tooltip with full details
- Warning icon if over 30%

**Usage**:
```tsx
<CreditUtilizationBadge
  balance={2250}
  limit={5000}
  showDetails
/>
// Renders: "45% 🟡 ($2,750 available)"
```

### Step 8: Update DebtPayoffTracker Component
**File**: `components/debts/debt-payoff-tracker.tsx`

**Changes**:
1. Add credit utilization section for credit cards
2. Show credit limit and available credit
3. Display utilization progress bar with color coding
4. Show alert if over 30%
5. Add helpful tips for improving utilization

**New Section** (only shown if `debt.type === 'credit_card'` and `debt.creditLimit` exists):
```tsx
{debt.type === 'credit_card' && debt.creditLimit && (
  <div className="mt-4 p-3 bg-elevated rounded-lg">
    <div className="flex items-center justify-between mb-2">
      <span className="text-sm text-muted-foreground">Credit Utilization</span>
      <span className="text-sm font-semibold" style={{ color: getUtilizationColor(utilization) }}>
        {utilization.toFixed(1)}%
      </span>
    </div>
    <Progress value={utilization} className="mb-2" />
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted-foreground">
        ${debt.remainingBalance.toLocaleString()} / ${debt.creditLimit.toLocaleString()}
      </span>
      <span className="text-muted-foreground">
        ${availableCredit.toLocaleString()} available
      </span>
    </div>
    {utilization > 30 && (
      <div className="mt-2 p-2 bg-warning/10 border border-warning/30 rounded">
        <p className="text-xs text-warning">
          ⚠️ High utilization may impact your credit score. Consider paying down this balance.
        </p>
      </div>
    )}
  </div>
)}
```

### Step 9: Integrate CreditUtilizationWidget into Debts Page
**File**: `app/dashboard/debts/page.tsx`

**Integration Point**: After Debt-Free Countdown, before Summary Stats

**Changes**:
```tsx
{/* Debt-Free Countdown */}
{stats && stats.activeDebtCount > 0 && (
  <div className="mb-6">
    <DebtFreeCountdown />
  </div>
)}

{/* Credit Utilization Overview */}
<CreditUtilizationWidget className="mb-6" />

{/* Summary Stats */}
{stats && (
  <div className="grid grid-cols-4 gap-4">
    ...
  </div>
)}
```

### Step 10: Add Credit Utilization to Dashboard
**File**: `app/dashboard/page.tsx`

**Integration Point**: Add as a widget in the dashboard grid

**Changes**:
```tsx
<CreditUtilizationWidget compact className="..." />
```

### Step 11: Create Utilization Alert Notification Type (Optional Enhancement)
**File**: `app/api/notifications/credit-utilization-alerts/route.ts` (NEW)

**Purpose**: Send notifications when utilization crosses thresholds

**Triggers**:
- When utilization goes above 30% (warning)
- When utilization goes above 50% (alert)
- When utilization goes above 75% (critical)
- When utilization drops back below 30% (success)

**Can be run as a cron job or triggered on debt payment/update**

### Step 12: Update API Routes
**Files to Update**:
- `app/api/debts/route.ts` - Include creditLimit in responses
- `app/api/debts/[id]/route.ts` - Handle creditLimit in updates
- `app/api/debts/stats/route.ts` - Add credit utilization stats

**New Fields in Responses**:
```typescript
{
  id: "debt1",
  type: "credit_card",
  remainingBalance: 2250,
  creditLimit: 5000,
  utilization: 45, // Calculated field
  availableCredit: 2750, // Calculated field
  utilizationLevel: "fair", // Calculated field
  // ... other fields
}
```

### Step 13: Testing & Validation

**Test Scenarios**:
1. ✅ Add new credit card with credit limit
2. ✅ Edit existing credit card to add credit limit
3. ✅ Calculate utilization correctly (various percentages)
4. ✅ Color coding changes appropriately
5. ✅ Overall stats calculate correctly with multiple cards
6. ✅ Cards without credit limit don't break anything
7. ✅ Non-credit-card debts don't show utilization
8. ✅ Validation prevents credit limit < balance
9. ✅ Responsive design on mobile, tablet, desktop
10. ✅ Theme switching works correctly
11. ✅ Empty state (no credit cards)
12. ✅ Single credit card
13. ✅ Multiple credit cards with varying utilization
14. ✅ Credit card at 0% utilization
15. ✅ Credit card at 100%+ utilization (over limit)

**Edge Cases**:
- Credit limit = 0 (prevent division by zero)
- Balance > credit limit (over-limit situation, show as 100%+)
- Null/undefined credit limit (don't show utilization)
- Very large numbers (formatting)
- Decimal precision (round to 1 decimal place)

### Step 14: Update Documentation
**File**: `docs/features.md`

**Update Feature #11**:
```markdown
11. ✅ Credit Utilization Tracking (COMPLETED)

  For credit cards specifically:
  - Track utilization % (balance ÷ limit)
  - Alert when over 30% (impacts credit score)
  - Show credit limit fields
  - Calculate total available credit

  Implementation complete with:
  - **Database Migration**: Added `creditLimit` field to debts table
  - **CreditUtilizationWidget Component**: Dashboard widget showing overall credit health
    - Overall utilization percentage with color-coded progress bar
    - Total credit statistics (limit, used, available)
    - Per-card breakdown with individual utilization
    - Warning indicators for cards over 30%
    - Click-to-scroll navigation to specific debt cards
  - **CreditUtilizationBadge Component**: Compact badge for individual cards
    - Color-coded utilization percentage
    - Available credit display
    - Tooltip with full details
  - **Enhanced DebtPayoffTracker**: Credit cards show utilization section
    - Utilization progress bar with color coding
    - Credit limit and available credit display
    - Alert messages for high utilization (>30%)
    - Helpful tips for improving credit health
  - **Updated Debt Form**: Credit limit input for credit cards
    - Conditional field (only for credit_card type)
    - Real-time utilization calculation
    - Validation (limit must be >= balance)
    - Inline warnings for high utilization
  - **Credit Utilization API**: GET /api/debts/credit-utilization
    - Aggregate statistics across all credit cards
    - Per-card utilization calculations
    - Sorted by utilization (highest first)
    - Filters for cards over threshold
  - **Utility Functions**: lib/debts/credit-utilization-utils.ts
    - calculateUtilization() - Calculate percentage
    - getUtilizationLevel() - Determine health level
    - getUtilizationColor() - Get theme color
    - calculateCreditStats() - Aggregate stats
  - **Color-Coded Health Levels**:
    - Excellent/Good (0-30%): Green
    - Fair (30-50%): Amber
    - Poor (50-75%): Orange
    - Critical (75%+): Red
  - **Theme Integration**: All colors use CSS variables
  - **Responsive Design**: Optimized for mobile, tablet, desktop
  - **Integrated on Debts Page**: Widget positioned after Debt-Free Countdown
  - **Dashboard Integration**: Compact widget on main dashboard
  - **Empty States**: Gracefully handles no credit cards
  - **Validation**: Prevents invalid credit limits
  - **Accessibility**: ARIA labels, keyboard navigation, color contrast
```

## Technical Considerations

### Data Integrity
- Credit limit is optional (only for credit cards)
- Validate credit limit >= current balance
- Handle null/undefined gracefully
- Prevent division by zero

### Performance
- Memoize utilization calculations
- Cache credit stats API response (5 minutes)
- Efficient database queries (index on type and status)
- Lazy load widget data

### Accessibility
- ARIA labels for progress bars
- Color is not the only indicator (use icons/text too)
- Keyboard navigation for all interactive elements
- Screen reader friendly tooltips
- Sufficient color contrast (4.5:1 minimum)

### Security
- Validate user owns all debts before calculating stats
- Sanitize inputs
- Rate limit API endpoints

### Backwards Compatibility
- Existing credit cards without creditLimit continue to work
- Utilization features gracefully hidden when creditLimit is null
- No breaking changes to existing components

## File Structure Summary

```
lib/db/
└── schema.ts                                (MODIFIED - add creditLimit field)

lib/debts/
└── credit-utilization-utils.ts              (NEW - utility functions)

app/api/debts/
├── route.ts                                 (MODIFIED - include creditLimit)
├── [id]/route.ts                            (MODIFIED - handle creditLimit updates)
├── stats/route.ts                           (MODIFIED - add utilization stats)
└── credit-utilization/route.ts              (NEW - utilization endpoint)

components/debts/
├── debt-form.tsx                            (MODIFIED - add credit limit field)
├── debt-payoff-tracker.tsx                  (MODIFIED - add utilization section)
├── credit-utilization-widget.tsx            (NEW - main widget)
└── credit-utilization-badge.tsx             (NEW - compact badge)

app/dashboard/
├── debts/page.tsx                           (MODIFIED - add widget)
└── page.tsx                                 (MODIFIED - add compact widget)

drizzle/
└── 0019_add_credit_limit_to_debts.sql       (NEW - migration file)

docs/
└── features.md                              (UPDATE - mark complete)
```

## Estimated Effort
- **Step 1**: 0.25 hours - Database migration
- **Step 2**: 0.25 hours - Update schema
- **Step 3**: 1 hour - Update debt form
- **Step 4**: 1 hour - Utility functions
- **Step 5**: 1 hour - API endpoint
- **Step 6**: 2 hours - CreditUtilizationWidget component
- **Step 7**: 0.5 hours - CreditUtilizationBadge component
- **Step 8**: 1 hour - Update DebtPayoffTracker
- **Step 9**: 0.5 hours - Integrate into debts page
- **Step 10**: 0.5 hours - Integrate into dashboard
- **Step 11**: 1 hour - Notification system (optional)
- **Step 12**: 0.5 hours - Update API routes
- **Step 13**: 1.5 hours - Testing and validation
- **Step 14**: 0.25 hours - Documentation

**Total**: ~11 hours (skip Step 11 for now: ~10 hours)

## Success Criteria
- ✅ Credit limit field added to debts table
- ✅ Debt form shows credit limit input for credit cards
- ✅ Utilization calculated correctly for all credit cards
- ✅ Color-coded indicators work as expected
- ✅ Widget shows aggregate statistics accurately
- ✅ Individual debt cards show utilization for credit cards
- ✅ Alerts displayed when utilization > 30%
- ✅ Theme variables used consistently (no hardcoded colors)
- ✅ Responsive on all screen sizes
- ✅ No errors in console
- ✅ Build succeeds
- ✅ Accessible to screen readers and keyboard users
- ✅ Empty states handled gracefully

## Future Enhancements (Not in Scope)
- Historical utilization tracking over time
- Utilization trend charts
- Credit score impact estimator
- Automated alerts via email/SMS
- Credit limit increase recommendations
- Balance transfer optimization
- Integration with credit bureaus (Experian, etc.)
- Per-card utilization goals
- Utilization-based notifications

## Dependencies
- ✅ Drizzle ORM (already installed)
- ✅ SQLite database (already configured)
- ✅ Decimal.js for calculations (already installed)
- ✅ Recharts (already installed, for potential charts)
- ✅ Theme system (already implemented)
- ✅ UI components (already available)

## Risk Assessment
- **Low Risk**: Well-understood domain, straightforward calculations
- **Medium Complexity**: Multiple components and integrations
- **High Value**: Critical feature for credit card users
- **Good Foundation**: Existing debt tracking infrastructure
- **Clear Requirements**: Industry standard (30% threshold)
