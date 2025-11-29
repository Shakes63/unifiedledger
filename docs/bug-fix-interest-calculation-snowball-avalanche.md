# Bug Fix: Identical Interest Calculations for Snowball vs Avalanche

## Problem Statement

The Debt Payoff Strategy comparison shows identical total interest amounts for both Snowball and Avalanche methods even when the payoff timeframes differ significantly (e.g., 50 months vs 35 months).

**Example:** With $200 extra payment, Snowball shows 50 months/$1,350.53 interest while Avalanche shows 35 months/$1,350.53 interest. Mathematically, paying debt for 15 additional months should accumulate more interest with the slower method.

## Root Cause Analysis

Located in `/lib/debts/payoff-calculator.ts`:

### The Core Issue

The current implementation calculates each debt's schedule **independently** rather than simulating all debts **in parallel**:

```typescript
while (remainingDebts.length > 0) {
  // Calculate schedule for first debt only
  const schedule = calculateDebtSchedule(
    remainingDebts[0],      // Only first (focus) debt
    firstDebtPayment,
    currentMonth,           // Start month for THIS debt
    ...
  );
  schedules.push(schedule);
  currentMonth += schedule.monthsToPayoff;
  remainingDebts = remainingDebts.slice(1); // Move to next
}
```

### What Goes Wrong

1. **Interest on "waiting" debts is not calculated properly:**
   - While paying off Debt A, Debt B (and C, D...) are also accruing interest
   - The current code doesn't track this interest accumulation

2. **Minimum payments on other debts not simulated:**
   - While focusing on Debt A, minimum payments go to B, C, D...
   - These payments reduce those balances AND pay interest
   - When Debt B becomes the focus, its balance should be different than original

3. **Balance drift not tracked:**
   - If minimum payment < interest, balance grows while waiting
   - If minimum payment > interest, balance shrinks while waiting
   - Neither scenario is handled - original balance is always used

### Example Trace

Debts:
- A: $1,000 @ 20% APR, $50 min
- B: $5,000 @ 10% APR, $100 min
- Extra: $100/month, so total $250/month

**Avalanche (focus on high-rate first = A):**
```
Month 1-5: Focus on A
- A gets $150/mo ($100 extra + $50 min)
- B gets $100/mo (min only)
- A accrues ~$16.67/mo interest
- B accrues ~$41.67/mo interest

When A paid off (~month 5):
- B has been receiving $100/mo for 5 months
- B has accrued ~$208 interest over 5 months
- B's new balance should be ~$5,208 - $500 = ~$4,708 (not $5,000!)
```

**The bug:** Code starts B's schedule at month 6 with original $5,000 balance, ignoring 5 months of min payments and interest.

## Fix Strategy

Replace the sequential approach with a **parallel simulation** that tracks ALL debts simultaneously each month:

1. Each period: Calculate interest on ALL debt balances
2. Each period: Apply minimum payments to all non-focus debts
3. Each period: Apply extra payment to focus debt
4. Track cumulative interest across ALL debts
5. When a debt hits $0, roll its payment to next focus debt

## Implementation Plan

### Step 1: Create new parallel simulation function

```typescript
function simulatePayoffParallel(
  debts: DebtInput[],
  extraPayment: number,
  method: PayoffMethod,
  paymentFrequency: PaymentFrequency
): { totalMonths: number; totalInterest: number; schedules: DebtPayoffSchedule[] }
```

### Step 2: Month-by-month simulation loop

```typescript
while (activeDebts.length > 0) {
  period++;
  
  // 1. Calculate interest on ALL debts
  for (const debt of activeDebts) {
    debt.periodInterest = calculateInterestForPeriod(debt.balance, ...);
    totalInterest += debt.periodInterest;
  }
  
  // 2. Apply payments
  let availableExtra = extraPayment / paymentDivisor;
  
  for (const debt of activeDebts) {
    const isFocusDebt = debt === getSortedFocusDebt(activeDebts, method);
    const payment = isFocusDebt 
      ? debt.minimum + availableExtra 
      : debt.minimum;
    
    const principal = payment - debt.periodInterest;
    debt.balance -= principal;
    
    if (debt.balance <= 0) {
      // Debt paid off - roll payment to next
      availableExtra += debt.minimum;
      markAsPaidOff(debt);
    }
  }
  
  // 3. Remove paid-off debts from active list
  activeDebts = activeDebts.filter(d => !d.paidOff);
}
```

### Step 3: Update `calculatePayoffStrategy` to use new function

Replace the sequential while loop with a call to `simulatePayoffParallel`.

### Step 4: Keep backward compatibility

- Return same `PayoffStrategyResult` structure
- Generate same `schedules` array format for UI consumption

## Files to Modify

1. **`lib/debts/payoff-calculator.ts`** - Core calculation logic

## Testing Plan

1. **Create test case with known answer:**
   - Debt A: $1,000 @ 20%, $50 min
   - Debt B: $5,000 @ 5%, $100 min
   - Extra: $100/month
   
   Calculate expected total interest manually for both methods.

2. **Verify different methods produce different interest totals:**
   - Avalanche should always produce equal or lower total interest
   - Time difference should correlate with interest difference

3. **Edge cases:**
   - Single debt (methods should be identical)
   - Two debts with same rate (order shouldn't matter for interest)
   - Zero extra payment (minimum-only scenario)

## Estimated Effort

- Implementation: 45-60 minutes
- Testing: 30 minutes
- Total: ~90 minutes

## Risk Assessment

**Medium Risk:**
- Core calculation logic change
- All downstream features depend on this
- Need thorough testing before deployment
- Easy to verify with manual calculations

