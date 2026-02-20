/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock('@/lib/bills/bill-payment-utils', () => ({
  processBillPayment: vi.fn(),
}));

vi.mock('@/lib/bills/autopay-calculator', async () => {
  const actual = await vi.importActual<typeof import('@/lib/bills/autopay-calculator')>(
    '@/lib/bills/autopay-calculator'
  );
  return {
    ...actual,
    calculateAutopayAmount: vi.fn(),
    validateAutopayConfiguration: vi.fn(),
  };
});

vi.mock('nanoid', () => ({
  nanoid: vi.fn(),
}));

import { db } from '@/lib/db';
import { processBillPayment } from '@/lib/bills/bill-payment-utils';
import { calculateAutopayAmount, validateAutopayConfiguration } from '@/lib/bills/autopay-calculator';
import { nanoid } from 'nanoid';

const baseBill = (overrides: any = {}) => ({
  id: 'bill-1',
  name: 'Test Bill',
  userId: 'user-1',
  householdId: 'house-1',
  expectedAmount: 100,
  categoryId: null,
  merchantId: null,
  isAutopayEnabled: true,
  autopayAccountId: 'pay-acc',
  autopayAmountType: 'fixed',
  autopayFixedAmount: 100,
  autopayDaysBefore: 0,
  linkedAccountId: null,
  isDebt: false,
  ...overrides,
});

const baseInstance = (overrides: any = {}) => ({
  id: 'inst-1',
  billId: 'bill-1',
  userId: 'user-1',
  householdId: 'house-1',
  dueDate: '2025-01-15',
  expectedAmount: 100,
  paidAmount: null,
  remainingAmount: null,
  status: 'pending',
  paymentStatus: 'unpaid',
  ...overrides,
});

describe('lib/bills/autopay-transaction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(nanoid).mockImplementation(() => 'id-1');
  });

  it('returns ALREADY_PAID when instance status is paid', async () => {
    const { processAutopayForInstance } = await import('@/lib/bills/autopay-transaction');
    const res = await processAutopayForInstance(baseBill(), baseInstance({ status: 'paid' }));
    expect(res.success).toBe(false);
    expect(res.errorCode).toBe('ALREADY_PAID');
  });

  it('returns INVALID_CONFIGURATION when bill isAutopayEnabled is false', async () => {
    const { processAutopayForInstance } = await import('@/lib/bills/autopay-transaction');
    const res = await processAutopayForInstance(baseBill({ isAutopayEnabled: false }), baseInstance());
    expect(res.success).toBe(false);
    expect(res.errorCode).toBe('INVALID_CONFIGURATION');
  });

  it('returns INVALID_CONFIGURATION when validateAutopayConfiguration returns an error', async () => {
    vi.mocked(validateAutopayConfiguration).mockReturnValueOnce('bad config');
    const { processAutopayForInstance } = await import('@/lib/bills/autopay-transaction');
    const res = await processAutopayForInstance(baseBill(), baseInstance());
    expect(res.success).toBe(false);
    expect(res.errorCode).toBe('INVALID_CONFIGURATION');
    expect(res.error).toBe('bad config');
  });

  it('returns ACCOUNT_NOT_FOUND when autopay account missing', async () => {
    vi.mocked(validateAutopayConfiguration).mockReturnValueOnce(null);
    // autopay account lookup returns empty
    vi.mocked(db.select).mockReturnValueOnce({
      from: () => ({
        where: () => ({
          limit: async () => [],
        }),
      }),
    } as unknown);

    const { processAutopayForInstance } = await import('@/lib/bills/autopay-transaction');
    const res = await processAutopayForInstance(baseBill(), baseInstance());
    expect(res.success).toBe(false);
    expect(res.errorCode).toBe('ACCOUNT_NOT_FOUND');
  });

  it('returns success with amount=0 when calculateAutopayAmount returns <= 0', async () => {
    vi.mocked(validateAutopayConfiguration).mockReturnValueOnce(null);
    vi.mocked(db.select).mockReturnValueOnce({
      from: () => ({
        where: () => ({
          limit: async () => [
            { id: 'pay-acc', currentBalance: 50, currentBalanceCents: 5000, type: 'checking' },
          ],
        }),
      }),
    } as unknown);

    vi.mocked(calculateAutopayAmount).mockReturnValueOnce({
      amount: 0,
      amountSource: 'Expected Amount (Nothing Owed)',
      minimumRequired: 0,
      insufficientFunds: false,
      availableBalance: 50,
    });

    const { processAutopayForInstance } = await import('@/lib/bills/autopay-transaction');
    const res = await processAutopayForInstance(baseBill(), baseInstance());
    expect(res.success).toBe(true);
    expect(res.amount).toBe(0);
    expect(res.amountSource).toContain('Nothing Owed');
    expect(processBillPayment).not.toHaveBeenCalled();
  });

  it('returns INSUFFICIENT_FUNDS when calculateAutopayAmount reports insufficientFunds', async () => {
    vi.mocked(validateAutopayConfiguration).mockReturnValueOnce(null);
    vi.mocked(db.select).mockReturnValueOnce({
      from: () => ({
        where: () => ({
          limit: async () => [
            { id: 'pay-acc', currentBalance: 10, currentBalanceCents: 1000, type: 'checking' },
          ],
        }),
      }),
    } as unknown);

    vi.mocked(calculateAutopayAmount).mockReturnValueOnce({
      amount: 100,
      amountSource: 'Expected Amount',
      minimumRequired: 100,
      insufficientFunds: true,
      availableBalance: 10,
    });

    const { processAutopayForInstance } = await import('@/lib/bills/autopay-transaction');
    const res = await processAutopayForInstance(baseBill(), baseInstance());
    expect(res.success).toBe(false);
    expect(res.errorCode).toBe('INSUFFICIENT_FUNDS');
  });

  it('creates an expense for non-linked bills and records payment', async () => {
    vi.mocked(validateAutopayConfiguration).mockReturnValueOnce(null);
    vi.mocked(db.select).mockReturnValueOnce({
      from: () => ({
        where: () => ({
          limit: async () => [
            { id: 'pay-acc', currentBalance: 500, currentBalanceCents: 50000, type: 'checking' },
          ],
        }),
      }),
    } as unknown);

    vi.mocked(calculateAutopayAmount).mockReturnValueOnce({
      amount: 25,
      amountSource: 'Fixed Amount',
      minimumRequired: 25,
      insufficientFunds: false,
      availableBalance: 500,
    });

    const values = vi.fn(async () => undefined);
    vi.mocked(db.insert).mockReturnValueOnce({ values } as unknown);
    const where = vi.fn(async () => undefined);
    const set = vi.fn(() => ({ where }));
    vi.mocked(db.update).mockReturnValueOnce({ set } as unknown);

    vi.mocked(processBillPayment).mockResolvedValueOnce({ success: true, paymentId: 'p1' });

    vi.mocked(nanoid)
      .mockReturnValueOnce('tx-expense'); // expense transaction id

    const { processAutopayForInstance } = await import('@/lib/bills/autopay-transaction');
    const res = await processAutopayForInstance(
      baseBill({ linkedAccountId: null, categoryId: 'c1', merchantId: 'm1' }),
      baseInstance({ id: 'inst-1' })
    );

    expect(res.success).toBe(true);
    expect(res.transactionId).toBe('tx-expense');
    expect(res.amount).toBe(25);
    expect(processBillPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        billId: 'bill-1',
        instanceId: 'inst-1',
        transactionId: 'tx-expense',
        paymentAmount: 25,
        paymentMethod: 'autopay',
      })
    );
  });

  it('creates a transfer when linkedAccountId is set', async () => {
    vi.mocked(validateAutopayConfiguration).mockReturnValueOnce(null);

    // first select: autopay account
    // second select: linked account
    vi.mocked(db.select)
      .mockReturnValueOnce({
        from: () => ({
          where: () => ({
            limit: async () => [
              { id: 'pay-acc', currentBalance: 500, currentBalanceCents: 50000, type: 'checking' },
            ],
          }),
        }),
      } as unknown)
      .mockReturnValueOnce({
        from: () => ({
          where: () => ({
            limit: async () => [
              {
                id: 'cc-acc',
                currentBalance: -1000,
                currentBalanceCents: -100000,
                statementBalance: -900,
                minimumPaymentAmount: 25,
                creditLimit: 5000,
              },
            ],
          }),
        }),
      } as unknown);

    vi.mocked(calculateAutopayAmount).mockReturnValueOnce({
      amount: 50,
      amountSource: 'Minimum Payment',
      minimumRequired: 25,
      insufficientFunds: false,
      availableBalance: 500,
    });

    // transfer_out + transfer_in inserts
    const values1 = vi.fn(async () => undefined);
    const values2 = vi.fn(async () => undefined);
    vi.mocked(db.insert)
      .mockReturnValueOnce({ values: values1 } as unknown)
      .mockReturnValueOnce({ values: values2 } as unknown);

    // balances update Promise.all → two update calls
    const whereA = vi.fn(async () => undefined);
    const setA = vi.fn(() => ({ where: whereA }));
    const whereB = vi.fn(async () => undefined);
    const setB = vi.fn(() => ({ where: whereB }));
    vi.mocked(db.update).mockReturnValueOnce({ set: setA } as unknown).mockReturnValueOnce({
      set: setB,
    } as unknown);

    vi.mocked(processBillPayment).mockResolvedValueOnce({ success: true, paymentId: 'p1' });

    vi.mocked(nanoid)
      .mockReturnValueOnce('transfer-id')
      .mockReturnValueOnce('tx-out')
      .mockReturnValueOnce('tx-in');

    const { processAutopayForInstance } = await import('@/lib/bills/autopay-transaction');
    const res = await processAutopayForInstance(
      baseBill({ linkedAccountId: 'cc-acc', autopayAmountType: 'minimum_payment' }),
      baseInstance({ id: 'inst-1' })
    );

    expect(res.success).toBe(true);
    expect(res.transferId).toBe('transfer-id');
    expect(res.transactionId).toBe('tx-out');
    expect(processBillPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        transactionId: 'tx-out',
        linkedAccountId: 'cc-acc',
      })
    );
  });

  it('returns SYSTEM_ERROR when processBillPayment fails', async () => {
    vi.mocked(validateAutopayConfiguration).mockReturnValueOnce(null);
    vi.mocked(db.select).mockReturnValueOnce({
      from: () => ({
        where: () => ({
          limit: async () => [
            { id: 'pay-acc', currentBalance: 500, currentBalanceCents: 50000, type: 'checking' },
          ],
        }),
      }),
    } as unknown);

    vi.mocked(calculateAutopayAmount).mockReturnValueOnce({
      amount: 25,
      amountSource: 'Fixed Amount',
      minimumRequired: 25,
      insufficientFunds: false,
      availableBalance: 500,
    });

    vi.mocked(db.insert).mockReturnValueOnce({ values: vi.fn(async () => undefined) } as unknown);
    vi.mocked(db.update).mockReturnValueOnce({
      set: vi.fn(() => ({ where: vi.fn(async () => undefined) })),
    } as unknown);

    vi.mocked(processBillPayment).mockResolvedValueOnce({ success: false, error: 'nope' });
    vi.mocked(nanoid).mockReturnValueOnce('tx-expense');

    const { processAutopayForInstance } = await import('@/lib/bills/autopay-transaction');
    const res = await processAutopayForInstance(baseBill(), baseInstance());

    expect(res.success).toBe(false);
    expect(res.errorCode).toBe('SYSTEM_ERROR');
    expect(res.transactionId).toBe('tx-expense');
    expect(res.error).toBe('nope');
  });
});
