import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

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

vi.mock('@/lib/debts/payment-calculator', () => ({
  calculatePaymentBreakdown: vi.fn(),
}));

vi.mock('@/lib/debts/milestone-utils', () => ({
  batchUpdateMilestones: vi.fn(),
}));

import { db } from '@/lib/db';
import { processBillPayment } from '@/lib/bills/bill-payment-utils';
import { calculatePaymentBreakdown } from '@/lib/debts/payment-calculator';
import { batchUpdateMilestones } from '@/lib/debts/milestone-utils';
import { applyLegacyDebtPayment, processAndLinkBillPayment } from '@/lib/transactions/payment-linkage';

describe('transaction payment linkage helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns false when legacy debt record is not found in the household', async () => {
    (db.select as Mock).mockReturnValue({
      from: () => ({
        where: () => ({
          limit: async () => [],
        }),
      }),
    });

    const result = await applyLegacyDebtPayment({
      debtId: 'debt-1',
      userId: 'user-1',
      householdId: 'hh-1',
      paymentAmount: 100,
      paymentDate: '2026-02-18',
      transactionId: 'tx-1',
      notes: 'test',
    });

    expect(result).toBe(false);
  });

  it('creates debt payment updates when a legacy debt exists', async () => {
    const insertValues = vi.fn(async () => undefined);
    const updateWhere = vi.fn(async () => undefined);
    const updateSet = vi.fn(() => ({ where: updateWhere }));

    (db.select as Mock).mockReturnValue({
      from: () => ({
        where: () => ({
          limit: async () => [{
            id: 'debt-1',
            userId: 'user-1',
            householdId: 'hh-1',
            remainingBalance: 500,
            interestRate: 4.5,
            interestType: 'fixed',
            loanType: 'installment',
            compoundingFrequency: 'monthly',
            billingCycleDays: 30,
          }],
        }),
      }),
    });

    (db.insert as Mock).mockReturnValue({ values: insertValues });
    (db.update as Mock).mockReturnValue({ set: updateSet });
    (calculatePaymentBreakdown as Mock).mockReturnValue({
      principalAmount: 80,
      interestAmount: 20,
    });
    (batchUpdateMilestones as Mock).mockResolvedValue(undefined);

    const result = await applyLegacyDebtPayment({
      debtId: 'debt-1',
      userId: 'user-1',
      householdId: 'hh-1',
      paymentAmount: 100,
      paymentDate: '2026-02-18',
      transactionId: 'tx-1',
      notes: 'legacy payment',
    });

    expect(result).toBe(true);
    expect(insertValues).toHaveBeenCalledTimes(1);
    expect(updateSet).toHaveBeenCalledTimes(1);
    expect(batchUpdateMilestones).toHaveBeenCalledWith('debt-1', 420);
  });

  it('links processed bill payments back to the transaction', async () => {
    const updateWhere = vi.fn(async () => undefined);
    const updateSet = vi.fn(() => ({ where: updateWhere }));

    (processBillPayment as Mock).mockResolvedValue({
      success: true,
      paymentId: 'pay-1',
      paymentStatus: 'paid',
      paidAmount: 125,
      remainingAmount: 0,
    });
    (db.update as Mock).mockReturnValue({ set: updateSet });

    const result = await processAndLinkBillPayment({
      billId: 'bill-1',
      billName: 'Electric',
      instanceId: 'inst-1',
      transactionId: 'tx-1',
      paymentAmount: 125,
      paymentDate: '2026-02-18',
      userId: 'user-1',
      householdId: 'hh-1',
      linkedAccountId: 'acc-1',
      paymentMethod: 'manual',
      notes: 'Bill payment',
    });

    expect(result.success).toBe(true);
    expect(processBillPayment).toHaveBeenCalledTimes(1);
    expect(updateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        billId: 'bill-1',
      })
    );
  });
});
