/**
 * Bug-hunt finding A3: runAutopay implemented only the 'fixed' amount type —
 * minimum_payment / statement_balance / full_balance silently fell through to
 * paying the FULL remaining amount (a $35-minimum rule drained the $1,200
 * statement). Every type now resolves explicitly, and types whose data source
 * is missing SKIP instead of guessing.
 */
import { describe, expect, it } from 'vitest';
import { resolveAutopayAmountCents } from '@/lib/bills/service';

function creditAccount(overrides: Partial<{
  currentBalance: number | null;
  currentBalanceCents: number | null;
  statementBalance: number | null;
  minimumPaymentAmount: number | null;
}> = {}) {
  return {
    type: 'credit',
    currentBalance: 850,
    currentBalanceCents: 85000,
    statementBalance: 620,
    minimumPaymentAmount: 35,
    ...overrides,
  };
}

describe('resolveAutopayAmountCents', () => {
  const occurrence = { amountRemainingCents: 120000 }; // $1,200 billed

  it('fixed pays the configured amount capped at the remaining balance', () => {
    expect(
      resolveAutopayAmountCents({
        rule: { amountType: 'fixed', fixedAmountCents: 10000 },
        occurrence,
      })
    ).toEqual({ amountCents: 10000 });
    expect(
      resolveAutopayAmountCents({
        rule: { amountType: 'fixed', fixedAmountCents: 500000 },
        occurrence,
      })
    ).toEqual({ amountCents: 120000 });
  });

  it('fixed with no configured amount skips', () => {
    const result = resolveAutopayAmountCents({
      rule: { amountType: 'fixed', fixedAmountCents: null },
      occurrence,
    });
    expect(result.skipReason).toMatch(/no amount configured/i);
  });

  it('minimum_payment pays the linked account minimum, NOT the full remaining', () => {
    expect(
      resolveAutopayAmountCents({
        rule: { amountType: 'minimum_payment', fixedAmountCents: null },
        occurrence,
        linkedAccount: creditAccount(),
      })
    ).toEqual({ amountCents: 3500 });
  });

  it('minimum_payment without a linked minimum skips instead of draining', () => {
    const noAccount = resolveAutopayAmountCents({
      rule: { amountType: 'minimum_payment', fixedAmountCents: null },
      occurrence,
    });
    expect(noAccount.skipReason).toMatch(/minimum/i);

    const noMinimum = resolveAutopayAmountCents({
      rule: { amountType: 'minimum_payment', fixedAmountCents: null },
      occurrence,
      linkedAccount: creditAccount({ minimumPaymentAmount: null }),
    });
    expect(noMinimum.skipReason).toMatch(/minimum/i);
  });

  it('statement_balance pays the tracked statement capped at remaining', () => {
    expect(
      resolveAutopayAmountCents({
        rule: { amountType: 'statement_balance', fixedAmountCents: null },
        occurrence,
        linkedAccount: creditAccount({ statementBalance: 620 }),
      })
    ).toEqual({ amountCents: 62000 });
  });

  it('statement_balance without a tracked statement pays the billed amount', () => {
    expect(
      resolveAutopayAmountCents({
        rule: { amountType: 'statement_balance', fixedAmountCents: null },
        occurrence,
      })
    ).toEqual({ amountCents: 120000 });
  });

  it('full_balance pays everything owed on the linked account (may exceed the billed amount)', () => {
    expect(
      resolveAutopayAmountCents({
        rule: { amountType: 'full_balance', fixedAmountCents: null },
        occurrence: { amountRemainingCents: 62000 },
        linkedAccount: creditAccount({ currentBalance: 850, currentBalanceCents: 85000 }),
      })
    ).toEqual({ amountCents: 85000 });
  });

  it('full_balance with nothing owed skips', () => {
    const result = resolveAutopayAmountCents({
      rule: { amountType: 'full_balance', fixedAmountCents: null },
      occurrence,
      linkedAccount: creditAccount({ currentBalance: 0, currentBalanceCents: 0 }),
    });
    expect(result.skipReason).toMatch(/no balance/i);
  });
});
