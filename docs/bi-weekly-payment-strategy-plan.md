# Bi-Weekly Payment Strategy - Implementation Plan

## Overview
Add support for bi-weekly payment frequency as a third payment strategy alongside Snowball and Avalanche methods. Bi-weekly payments involve making 26 half-payments per year (every 2 weeks), which equals 13 full payments annually instead of 12. This can significantly reduce loan terms and interest paid.

## Key Benefits
- **Extra annual payment**: 26 half-payments = 13 full monthly payments (1 extra payment/year)
- **Mortgage impact**: Can shave 2-4 years off 30-year mortgages
- **Interest savings**: Reduces total interest paid significantly
- **Payment alignment**: Matches bi-weekly paychecks for many users
- **Accelerated payoff**: More frequent payments mean less interest accumulation

## Technical Approach

### Payment Frequency Model
- **Monthly**: 12 payments/year (current default)
- **Bi-Weekly**: 26 payments/year (every 14 days)
- Payment amount for bi-weekly = (monthly payment ÷ 2)
- Interest calculated per payment period (not monthly)

### Interest Calculation Adjustments
For bi-weekly payments, interest accrues between payment dates:
- Credit cards (daily compounding): Calculate interest for 14-day periods
- Installment loans: Use bi-weekly rate = (monthly rate × 12) ÷ 26
- More frequent payments = less time for interest to compound

## Implementation Steps

### Phase 1: Database & Types (Foundation)

**1.1 Add payment frequency to debt settings**
- Create migration: `0017_add_payment_frequency_to_debt_settings.sql`
- Add `paymentFrequency` field: 'monthly' | 'biweekly'
- Default to 'monthly' for backwards compatibility
- Update schema.ts with new field and enum

**1.2 Update TypeScript interfaces**
- Add `PaymentFrequency` type to payoff-calculator.ts
- Update `DebtPayoffOptions` interface
- Update `PayoffResult` interface to include frequency info
- Update API request/response types

### Phase 2: Payoff Calculator Enhancement

**2.1 Update core calculation logic (lib/debts/payoff-calculator.ts)**
- Add `paymentFrequency` parameter to `calculateDebtSchedule()`
- Create helper: `getPaymentPeriodsPerYear(frequency)` returns 12 or 26
- Create helper: `calculateInterestForPeriod(balance, apr, frequency, loanType)`
- Update payment loop to handle bi-weekly intervals
- Adjust payment amount: If bi-weekly, divide monthly minimum by 2
- Adjust extra payment: If bi-weekly, divide extra monthly by 2

**2.2 Interest calculation per frequency**
```typescript
function calculateInterestForPeriod(
  balance: Decimal,
  apr: number,
  frequency: PaymentFrequency,
  loanType: string,
  compoundingFrequency?: string
): Decimal {
  if (frequency === 'monthly') {
    // Current monthly logic (already implemented)
  } else {
    // Bi-weekly: 14 days of interest
    // Credit cards: (balance × APR ÷ 365) × 14
    // Loans: balance × ((1 + monthly_rate)^(1/2) - 1)
  }
}
```

**2.3 Update snowball/avalanche algorithms**
- Both methods work the same, just with more frequent payments
- Track payment periods instead of months
- Convert final result back to months for display

**2.4 Handle lump sum payments**
- Lump sums still applied at specific month numbers
- Need to calculate which payment period corresponds to target month
- Bi-weekly: month 6 = payment period 13 (26 ÷ 2)

### Phase 3: API Endpoint Updates

**3.1 Update debt settings API (app/api/debts/settings/route.ts)**
- Add `paymentFrequency` to GET response
- Add `paymentFrequency` to PUT validation
- Validate enum values: 'monthly' | 'biweekly'
- Return updated settings

**3.2 Update payoff strategy API (app/api/debts/payoff-strategy/route.ts)**
- Read `paymentFrequency` from settings
- Pass to calculator functions
- Return frequency in response for UI display
- Handle both compare and single strategy modes

**3.3 Update scenarios API (app/api/debts/scenarios/route.ts)**
- Accept `paymentFrequency` in request body
- Apply to all scenarios
- Show comparison of monthly vs bi-weekly in results

**3.4 Update countdown API (app/api/debts/countdown/route.ts)**
- Use saved frequency setting
- Calculate accurate months remaining based on frequency

**3.5 Update minimum warning API (app/api/debts/minimum-warning/route.ts)**
- Support frequency in both plans
- Show impact of bi-weekly on minimum-only plan

### Phase 4: UI Components

**4.1 Update debt settings component (components/debts/debt-payoff-strategy.tsx)**
- Add payment frequency toggle above method toggle
- Options: "Monthly" | "Bi-Weekly"
- Show helper text: "Bi-weekly payments mean 26 half-payments/year (13 full payments)"
- Highlight extra payment: "That's 1 extra payment per year!"
- Auto-save frequency changes with existing debounce
- Recalculate strategy when frequency changes

**4.2 Update strategy display**
- Show payment amount per frequency:
  - Monthly: "$500/month"
  - Bi-weekly: "$250 every 2 weeks (26 payments/year)"
- Update "months to debt-free" to handle decimal months
- Show bi-weekly payment schedule in timeline

**4.3 Update what-if calculator (components/debts/what-if-calculator.tsx)**
- Add frequency selector to scenario builder
- Allow testing monthly vs bi-weekly side-by-side
- Show "Switching to bi-weekly" as a quick scenario template
- Update comparison to highlight frequency differences

**4.4 Update scenario builder (components/debts/scenario-builder.tsx)**
- Add payment frequency radio group
- Update extra payment label based on frequency:
  - Monthly: "Extra Monthly Payment"
  - Bi-weekly: "Extra Per Payment"
- Show converted annual amount below input

**4.5 Update countdown widget (components/dashboard/debt-countdown-card.tsx)**
- Show payment frequency: "Paying bi-weekly" or "Paying monthly"
- Update motivational messages to mention bi-weekly if applicable

**4.6 Update payoff timeline (components/debts/payoff-timeline.tsx)**
- Show payment periods on x-axis
- Label with months for readability: "Month 1 (Payments 1-2)"
- Update table to show bi-weekly payments
- Collapse options: Show first 6 payments and last payment per debt

### Phase 5: Testing & Validation

**5.1 Calculator unit tests**
- Test bi-weekly vs monthly calculations
- Verify 13th payment effect
- Test interest calculations for both frequencies
- Test lump sum handling with bi-weekly
- Verify snowball/avalanche work correctly

**5.2 Integration tests**
- Test API endpoints with bi-weekly frequency
- Test settings persistence
- Test scenario comparisons
- Test edge cases (0 extra payment, paid-off debts)

**5.3 Manual testing checklist**
- [ ] Toggle between monthly and bi-weekly
- [ ] Verify payment amounts halved for bi-weekly
- [ ] Check months-to-payoff reduces with bi-weekly
- [ ] Test with multiple debts
- [ ] Test what-if scenarios with bi-weekly
- [ ] Verify countdown updates correctly
- [ ] Test mobile responsiveness
- [ ] Check all tooltips and help text

### Phase 6: Documentation & Polish

**6.1 Add help text and tooltips**
- Frequency selector: "Bi-weekly payments can save years of interest"
- Payment amount: "With bi-weekly, you'll make 26 payments per year"
- Add info icon with detailed explanation

**6.2 Update educational content**
- Add section explaining bi-weekly benefits
- Show example calculation
- Link to external resources about bi-weekly payments

**6.3 Update CLAUDE.md**
- Document bi-weekly payment feature
- Add to completed features list
- Include technical details for future reference

**6.4 Update features.md**
- Mark feature #3 as completed
- List all implemented functionality

## Design Specifications

### Color Coding
- Monthly: Blue accent (existing)
- Bi-weekly: Green accent (indicates savings/acceleration)

### Layout Changes

**Debt Payoff Strategy Component:**
```
┌─────────────────────────────────────────────┐
│ Payment Frequency                            │
│ ⚪ Monthly    ⚫ Bi-Weekly                    │
│ ℹ️ Bi-weekly = 26 payments/year (1 extra)   │
├─────────────────────────────────────────────┤
│ Payment Method                               │
│ ⚫ Snowball   ⚪ Avalanche                    │
├─────────────────────────────────────────────┤
│ Extra Payment: $100 every 2 weeks            │
│ (That's $2,600/year total)                   │
└─────────────────────────────────────────────┘
```

**Scenario Builder:**
```
┌─────────────────────────────────────────────┐
│ Scenario 1: Bi-Weekly Payments              │
│                                              │
│ Frequency: ⚫ Monthly  ⚪ Bi-Weekly           │
│ Extra Payment: $50 per payment               │
│ Method: Snowball                             │
│                                              │
│ Quick Templates:                             │
│ [+$50] [+$100] [Switch to Bi-Weekly] ...   │
└─────────────────────────────────────────────┘
```

## Expected Results

### Example Scenario: Credit Card
- Balance: $10,000
- APR: 18.99%
- Minimum: $200/month

**Monthly Payments ($200 + $0 extra):**
- Months to payoff: 94 months (7.8 years)
- Total interest: $8,744

**Bi-Weekly Payments ($100 every 2 weeks):**
- Months to payoff: 72 months (6 years)
- Total interest: $6,431
- **Savings: 22 months, $2,313 in interest**

### Example Scenario: Mortgage
- Balance: $300,000
- APR: 4.5%
- Monthly payment: $1,520

**Monthly Payments:**
- Months to payoff: 360 months (30 years)
- Total interest: $247,220

**Bi-Weekly Payments ($760 every 2 weeks):**
- Months to payoff: 312 months (26 years)
- Total interest: $205,180
- **Savings: 48 months (4 years), $42,040 in interest**

## Migration Strategy

### Backwards Compatibility
- All existing users default to 'monthly' frequency
- No breaking changes to API
- Graceful degradation if frequency not set

### Data Migration
```sql
-- 0017_add_payment_frequency_to_debt_settings.sql
ALTER TABLE debt_settings ADD COLUMN payment_frequency TEXT DEFAULT 'monthly';
UPDATE debt_settings SET payment_frequency = 'monthly' WHERE payment_frequency IS NULL;
```

## Future Enhancements (Not in this iteration)

- Weekly payment frequency (52 payments/year)
- Custom payment frequencies (every X days)
- Calendar integration showing actual bi-weekly payment dates
- Automatic bi-weekly date calculation based on payday
- Bi-weekly payment reminders

## Success Metrics

- Users can successfully toggle between monthly and bi-weekly
- Calculator accurately projects 1 extra payment per year effect
- Interest savings displayed correctly
- Settings persist across sessions
- All existing features work with bi-weekly frequency
- No performance degradation
- Mobile UI remains usable

## Files to Create/Modify

### New Files:
- `drizzle/0017_add_payment_frequency_to_debt_settings.sql`

### Modified Files:
- `lib/db/schema.ts` - Add payment_frequency field
- `lib/debts/payoff-calculator.ts` - Add bi-weekly logic
- `app/api/debts/settings/route.ts` - Handle frequency field
- `app/api/debts/payoff-strategy/route.ts` - Pass frequency to calculator
- `app/api/debts/scenarios/route.ts` - Support frequency in scenarios
- `app/api/debts/countdown/route.ts` - Use frequency setting
- `app/api/debts/minimum-warning/route.ts` - Support frequency
- `components/debts/debt-payoff-strategy.tsx` - Add frequency UI
- `components/debts/scenario-builder.tsx` - Add frequency selector
- `components/debts/what-if-calculator.tsx` - Add bi-weekly template
- `components/dashboard/debt-countdown-card.tsx` - Show frequency
- `components/debts/payoff-timeline.tsx` - Handle bi-weekly display

## Risk Mitigation

### Calculation Accuracy
- Use Decimal.js throughout for precision
- Validate against known amortization schedules
- Add comprehensive unit tests
- Manual verification with online calculators

### UI Complexity
- Keep toggle simple (2 options only)
- Clear labels and help text
- Don't overwhelm users with options
- Progressive disclosure for advanced features

### Performance
- Bi-weekly means 2x more payment records
- Optimize loops in calculator
- Cache calculations where possible
- Limit timeline display to prevent DOM bloat

## Timeline Estimate

- **Phase 1 (Database)**: 30 minutes
- **Phase 2 (Calculator)**: 2 hours
- **Phase 3 (APIs)**: 1.5 hours
- **Phase 4 (UI)**: 2.5 hours
- **Phase 5 (Testing)**: 1.5 hours
- **Phase 6 (Documentation)**: 30 minutes

**Total: ~8.5 hours**

## Implementation Order

1. ✅ Create this plan document
2. 🔄 Database migration and schema update (Phase 1)
3. ⏳ Update payoff calculator core logic (Phase 2)
4. ⏳ Update API endpoints (Phase 3)
5. ⏳ Update UI components (Phase 4)
6. ⏳ Testing and validation (Phase 5)
7. ⏳ Documentation updates (Phase 6)

---

**Status**: Ready to implement
**Priority**: High - Commonly requested feature with high user value
**Complexity**: Medium - Requires careful calculation logic but UI is straightforward
