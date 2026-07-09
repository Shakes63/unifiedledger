/**
 * H-DBG-8 / H-DBG-9: the payoff simulator must scale payments per frequency
 * (weekly used to apply a full MONTH's payment every 7 days; quarterly one
 * month's payment per quarter — both while counting each period as one month),
 * and lump sums must apply exactly once (biweekly's month mapping used to match
 * two consecutive periods and double-apply every lump sum).
 */
import { describe, expect, it } from 'vitest';
import { calculatePayoffStrategy, type DebtInput } from '@/lib/debts/payoff-calculator';

function debt(overrides: Partial<DebtInput> = {}): DebtInput {
  return {
    id: 'd1',
    name: 'Loan',
    remainingBalance: 1200,
    minimumPayment: 100,
    interestRate: 0, // zero interest -> exact arithmetic on timelines
    type: 'personal_loan',
    loanType: 'installment',
    compoundingFrequency: 'monthly',
    ...overrides,
  };
}

describe('payoff frequency scaling (H-DBG-8)', () => {
  it('weekly and monthly pay off a 0% debt in the same number of MONTHS', () => {
    // $1,200 at $100/month = 12 months regardless of payment frequency.
    const monthly = calculatePayoffStrategy([debt()], 0, 'avalanche', 'monthly');
    const weekly = calculatePayoffStrategy([debt()], 0, 'avalanche', 'weekly');

    expect(monthly.totalMonths).toBe(12);
    // Weekly pays 100 * 12/52 per week; the same $1,200 total over ~52 weeks.
    // The old code paid $100 every WEEK (12x the intended rate) and reported
    // each week as a month.
    expect(weekly.totalMonths).toBeGreaterThanOrEqual(11);
    expect(weekly.totalMonths).toBeLessThanOrEqual(13);
  });

  it('quarterly pays 3x the monthly amount per period and finishes in ~12 months', () => {
    const quarterly = calculatePayoffStrategy([debt()], 0, 'avalanche', 'quarterly');
    // $300 per quarter against $1,200 -> 4 quarters = 12 months. The old code
    // paid $100 per quarter (1/3 the rate) and counted each quarter as a month.
    expect(quarterly.totalMonths).toBeGreaterThanOrEqual(11);
    expect(quarterly.totalMonths).toBeLessThanOrEqual(13);
  });
});

describe('lump sums apply exactly once (H-DBG-9)', () => {
  it('biweekly: a $500 lump sum shortens the payoff by ~5 months, not ~10', () => {
    // $1,200 at 0%: monthly baseline 12 months. With a single $500 lump sum in
    // month 1 the remaining $700 takes 7 more payments.
    const withLump = calculatePayoffStrategy(
      [debt()],
      0,
      'avalanche',
      'biweekly',
      [{ month: 1, amount: 500 }]
    );
    const withoutLump = calculatePayoffStrategy([debt()], 0, 'avalanche', 'biweekly');

    const saved = withoutLump.totalInterestPaid === 0
      ? withoutLump.totalMonths - withLump.totalMonths
      : 0;
    // One $500 application saves ~5 months of $100 payments. The old code
    // applied it twice ($1,000) and saved ~10.
    expect(saved).toBeGreaterThanOrEqual(4);
    expect(saved).toBeLessThanOrEqual(6);
  });
});
