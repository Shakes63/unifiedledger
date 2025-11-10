# Credit Utilization Tracking - Implementation Plan

## Overview
Complete the Credit Utilization Tracking feature for credit card debt management. This feature helps users monitor their credit card balances relative to credit limits, which is critical for maintaining healthy credit scores.

## Current Status
- ✅ Database Migration (0019): `creditLimit` field added to debts table
- ✅ Schema Update: debts schema updated with nullable creditLimit
- ✅ Utility Functions: Complete credit utilization calculation library in `lib/debts/credit-utilization-utils.ts`

## Remaining Implementation Steps

### Step 1: Update Debt Form with Credit Limit Input
**File**: `components/debts/debt-form.tsx`

**Tasks**:
- Add `creditLimit` field to form state
- Add credit limit input (only visible when debtType is 'Credit Card')
- Conditional rendering with proper validation
- Show helper text explaining credit utilization importance
- Format input as currency
- Validation: creditLimit must be >= current balance

**Design**:
- Input field below balance field
- Uses theme variable `border-border` for borders
- Includes helper icon with tooltip explaining 30% rule
- Shows calculated utilization % in real-time as user types

**Integration Points**:
- Form submission includes creditLimit in POST/PUT requests
- API routes already support the field (verified in schema)

---

### Step 2: Credit Utilization API Endpoint
**File**: `app/api/debts/credit-utilization/route.ts`

**Tasks**:
- Create GET endpoint to fetch credit utilization statistics
- Calculate per-card and aggregate metrics
- Include recommendations for each card
- Return data structure:
  ```typescript
  {
    cards: [{
      debtId: string,
      name: string,
      balance: number,
      creditLimit: number,
      utilization: number,
      level: 'excellent' | 'good' | 'fair' | 'poor' | 'critical',
      recommendation: string,
      paymentToTarget: number | null
    }],
    summary: {
      totalBalance: number,
      totalCreditLimit: number,
      avgUtilization: number,
      level: string,
      cardsOverTarget: number,
      healthScore: number
    }
  }
  ```

**Business Logic**:
- Filter for debtType === 'Credit Card' AND creditLimit !== null
- Use utility functions from `lib/debts/credit-utilization-utils.ts`
- Sort cards by utilization % (highest first)
- Include credit score impact estimate

---

### Step 3: CreditUtilizationWidget Component
**File**: `components/debts/credit-utilization-widget.tsx`

**Purpose**: Dashboard widget showing aggregate credit utilization health

**Features**:
- Large circular progress indicator showing total utilization %
- Color-coded by health level (using theme variables):
  - Excellent: `text-[var(--color-success)]`
  - Good: `text-[var(--color-success)]`
  - Fair: `text-[var(--color-warning)]`
  - Poor: `text-[var(--color-error)]`
  - Critical: `text-[var(--color-error)]`
- Quick stats grid:
  - Total available credit
  - Cards over 30%
  - Recommended payment amount
- Link to full debt management page
- Responsive design (adapts to grid layout)

**Design System**:
- Background: `bg-card`
- Borders: `border-border`
- Text: `text-foreground` (primary), `text-muted-foreground` (secondary)
- Hover: `hover:bg-elevated`
- Border radius: `rounded-xl` (12px)
- Spacing: Consistent padding classes

**Data Fetching**:
- Uses React Query or fetch in useEffect
- Shows loading skeleton while fetching
- Error state with retry option
- Empty state when no credit cards with limits

---

### Step 4: CreditUtilizationBadge Component
**File**: `components/debts/credit-utilization-badge.tsx`

**Purpose**: Inline badge showing utilization for individual cards

**Props**:
```typescript
interface Props {
  balance: number;
  creditLimit: number | null;
  size?: 'sm' | 'md' | 'lg';
  showPercentage?: boolean;
  showLabel?: boolean;
}
```

**Features**:
- Compact badge with color-coded background
- Shows utilization % and emoji indicator
- Size variants for different contexts
- Optional "Utilization: XX%" label
- Tooltip with detailed breakdown on hover

**Styling**:
- Uses theme-aware colors from utility functions
- Transparent background with colored border for subtle look
- Bold percentage text
- Smooth transitions on hover

**Usage Contexts**:
- Next to each debt card in DebtPayoffTracker
- In debt list views
- In debt detail modals
- In credit utilization widget detail sections

---

### Step 5: Enhance DebtPayoffTracker Component
**File**: `components/debts/debt-payoff-tracker.tsx`

**Updates**:
- Add creditLimit display for credit card debts
- Show CreditUtilizationBadge for each credit card
- Add "Credit Utilization" section within each card (collapsible)
  - Shows current utilization with visual bar
  - Displays credit limit and available credit
  - Includes recommendation if over 30%
  - Quick action button to calculate payment needed
- Conditional rendering (only for credit cards)
- Update empty state to encourage adding credit limits

**Layout**:
- Add utilization badge in card header next to debt name
- Add collapsible section between debt summary and payment tracking
- Use consistent spacing with existing sections

**Interactions**:
- Click badge to expand utilization details
- Click "Calculate Payment" to show modal with payment plan
- Hover states using `hover:bg-elevated`

---

### Step 6: Dashboard Integration
**File**: `app/dashboard/page.tsx`

**Tasks**:
- Add CreditUtilizationWidget to dashboard grid
- Position in 2x2 grid layout (if credit cards exist):
  - Top-left: Monthly Spending
  - Top-right: Accounts Summary (or Credit Utilization if has cards)
  - Bottom-left: Budget Surplus
  - Bottom-right: Debt Countdown
- Conditional rendering: only show if user has credit cards with limits set
- Responsive grid: 1 column on mobile, 2 columns on tablet/desktop

**Grid Layout**:
```tsx
<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
  <MonthlySpendingChart />
  {hasCreditCards ? <CreditUtilizationWidget /> : <AccountsSummary />}
  <BudgetSurplusCard />
  <DebtCountdownWidget />
</div>
```

---

### Step 7: Settings/Preferences Integration
**File**: `app/dashboard/debts/page.tsx`

**Tasks**:
- Add "Credit Utilization Settings" collapsible section
- Allow users to set target utilization % (default: 30%)
- Toggle to hide/show utilization warnings
- Preference to prioritize high-utilization cards in payment strategy

**Database**:
- Store in userSettings table (may need migration)
- Fields: `creditUtilizationTarget` (default: 30), `showUtilizationWarnings` (default: true)

---

### Step 8: Notification Integration
**File**: `lib/notifications/notification-service.ts`

**Tasks**:
- Add notification type: `CREDIT_UTILIZATION_HIGH`
- Trigger when any card exceeds target (default 30%)
- Cron job to check daily
- Notification message template with actionable advice

**Notification Schema**:
```typescript
{
  type: 'credit_utilization_high',
  title: 'Credit Card Utilization Alert',
  message: 'Your [Card Name] is at XX% utilization. Pay down $XXX to reach 30%.',
  severity: 'warning',
  actionUrl: '/dashboard/debts',
  metadata: {
    debtId: string,
    utilization: number,
    targetPayment: number
  }
}
```

---

### Step 9: Testing & Validation
**File**: `__tests__/credit-utilization.test.ts`

**Test Cases**:
- Utility function accuracy (various scenarios)
- API endpoint response format
- Component rendering with different utilization levels
- Edge cases: null limits, zero balance, over-limit balances
- Responsive layout on different screen sizes
- Theme color integration
- Notification triggers

---

### Step 10: Documentation Updates
**Files**:
- `docs/features.md`: Mark feature #11 as completed
- `.claude/CLAUDE.md`: Add credit utilization to feature list
- API documentation: Document new endpoint

---

## Design System Compliance

### Color Variables to Use
- **Backgrounds**: `bg-card`, `bg-elevated`, `bg-background`
- **Text**: `text-foreground`, `text-muted-foreground`
- **Borders**: `border-border`
- **State Colors**:
  - Success: `text-[var(--color-success)]` / `bg-[var(--color-success)]`
  - Warning: `text-[var(--color-warning)]` / `bg-[var(--color-warning)]`
  - Error: `text-[var(--color-error)]` / `bg-[var(--color-error)]`
- **Hover**: `hover:bg-elevated`

### Typography
- Debt amounts: `font-mono` (JetBrains Mono)
- Regular text: `font-sans` (Inter)
- Bold percentages: `font-semibold` or `font-bold`

### Spacing & Layout
- Card padding: `p-6`
- Section spacing: `space-y-6` or `gap-6`
- Border radius: `rounded-xl` (12px for cards), `rounded-lg` (8px for badges)

### Responsive Breakpoints
- Mobile: default
- Tablet: `md:` (768px+)
- Desktop: `lg:` (1024px+)

---

## Dependencies
All required dependencies are already installed:
- `decimal.js` - For precise calculations
- `date-fns` - For date formatting
- `recharts` - For charts (if needed)
- `lucide-react` - For icons

---

## Implementation Order Priority
1. **Step 1** (Debt Form) - Foundation for data entry ⭐ START HERE
2. **Step 2** (API Endpoint) - Data layer
3. **Step 4** (Badge Component) - Reusable UI element
4. **Step 3** (Widget Component) - Dashboard feature
5. **Step 5** (Tracker Enhancement) - Enhance existing UI
6. **Step 6** (Dashboard Integration) - User visibility
7. **Step 7** (Settings) - User customization
8. **Step 8** (Notifications) - Proactive alerts
9. **Step 9** (Testing) - Quality assurance
10. **Step 10** (Documentation) - Finalization

---

## Success Criteria
- ✅ Users can add credit limits to credit card debts
- ✅ Dashboard shows aggregate credit utilization health
- ✅ Individual cards display utilization badges
- ✅ Recommendations provided for high utilization
- ✅ All components use theme variables (no hardcoded colors)
- ✅ Responsive design works on mobile/tablet/desktop
- ✅ Calculations are accurate using Decimal.js
- ✅ Empty states and loading states handled gracefully
- ✅ Notifications alert users to high utilization
- ✅ Feature marked as complete in documentation

---

## Estimated Completion Time
- Step 1: 30 minutes
- Step 2: 45 minutes
- Steps 3-4: 1 hour
- Step 5: 45 minutes
- Steps 6-8: 1 hour
- Steps 9-10: 30 minutes

**Total**: ~4.5 hours

---

## Notes
- Credit utilization is a critical factor in credit scores (30% of FICO score)
- Industry standard: keep utilization below 30% per card and overall
- Some experts recommend below 10% for optimal scores
- This feature provides actionable insights to help users improve credit health
