/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(),
  },
}));

vi.mock('@/lib/bills/autopay-transaction', () => ({
  processAutopayForInstance: vi.fn(),
}));

vi.mock('@/lib/notifications/autopay-notifications', () => ({
  sendAutopaySuccessNotification: vi.fn(),
  sendAutopayFailureNotification: vi.fn(),
}));

import { db } from '@/lib/db';
import { processAutopayForInstance } from '@/lib/bills/autopay-transaction';
import {
  sendAutopaySuccessNotification,
  sendAutopayFailureNotification,
} from '@/lib/notifications/autopay-notifications';

describe('lib/bills/autopay-processor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-13T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function mockDbSelectSequence(results: unknown[]) {
    const selectImpl = vi.fn();
    for (const res of results) {
      selectImpl.mockReturnValueOnce({
        from: () => ({
          where: async () => res,
        }),
      });
    }
    (db.select as any).mockImplementation(selectImpl);
  }

  it('returns empty result when no autopay-enabled bills', async () => {
    mockDbSelectSequence([[]]);

    const { processAllAutopayBills } = await import('@/lib/bills/autopay-processor');
    const res = await processAllAutopayBills();

    expect(res).toEqual({
      processed: 0,
      successful: 0,
      failed: 0,
      skipped: 0,
      totalAmount: 0,
      errors: [],
      successes: [],
    });
    expect(processAutopayForInstance).not.toHaveBeenCalled();
  });

  it('skips instances when autopayAccountId is missing', async () => {
    const bills = [
      {
        id: 'b1',
        name: 'Bill 1',
        userId: 'u1',
        householdId: 'h1',
        expectedAmount: 10,
        categoryId: null,
        merchantId: null,
        isAutopayEnabled: true,
        autopayAccountId: null,
        autopayAmountType: 'fixed',
        autopayFixedAmount: 10,
        autopayDaysBefore: 0,
        linkedAccountId: null,
        isDebt: false,
        isActive: true,
      },
    ];
    const instances = [
      {
        id: 'i1',
        billId: 'b1',
        userId: 'u1',
        householdId: 'h1',
        dueDate: '2025-01-13',
        expectedAmount: 10,
        paidAmount: null,
        remainingAmount: null,
        status: 'pending',
        paymentStatus: 'unpaid',
      },
    ];

    mockDbSelectSequence([bills, instances]);

    const { processAllAutopayBills } = await import('@/lib/bills/autopay-processor');
    const res = await processAllAutopayBills();

    expect(res.processed).toBe(0);
    expect(res.skipped).toBe(1);
    expect(processAutopayForInstance).not.toHaveBeenCalled();
  });

  it('processes eligible instances based on dueDate - autopayDaysBefore and records success + sends success notification', async () => {
    const bills = [
      {
        id: 'b1',
        name: 'Bill 1',
        userId: 'u1',
        householdId: 'h1',
        expectedAmount: 10,
        categoryId: null,
        merchantId: null,
        isAutopayEnabled: true,
        autopayAccountId: 'a1',
        autopayAmountType: 'fixed',
        autopayFixedAmount: 10,
        autopayDaysBefore: 2,
        linkedAccountId: null,
        isDebt: false,
        isActive: true,
      },
    ];
    const instances = [
      {
        id: 'i1',
        billId: 'b1',
        userId: 'u1',
        householdId: 'h1',
        dueDate: '2025-01-15', // processing date = Jan 13
        expectedAmount: 10,
        paidAmount: null,
        remainingAmount: null,
        status: 'pending',
        paymentStatus: 'unpaid',
      },
    ];

    mockDbSelectSequence([bills, instances]);
    (processAutopayForInstance as any).mockResolvedValue({
      success: true,
      amount: 10,
      transactionId: 'tx1',
    });

    const { processAllAutopayBills } = await import('@/lib/bills/autopay-processor');
    const res = await processAllAutopayBills();

    expect(res.processed).toBe(1);
    expect(res.successful).toBe(1);
    expect(res.totalAmount).toBe(10);
    expect(res.successes).toEqual([
      {
        billId: 'b1',
        billName: 'Bill 1',
        instanceId: 'i1',
        amount: 10,
        transactionId: 'tx1',
      },
    ]);
    expect(sendAutopaySuccessNotification).toHaveBeenCalledTimes(1);
    expect(sendAutopayFailureNotification).not.toHaveBeenCalled();
  });

  it('counts zero-amount success as skipped (no success notification)', async () => {
    const bills = [
      {
        id: 'b1',
        name: 'Bill 1',
        userId: 'u1',
        householdId: 'h1',
        expectedAmount: 10,
        categoryId: null,
        merchantId: null,
        isAutopayEnabled: true,
        autopayAccountId: 'a1',
        autopayAmountType: 'fixed',
        autopayFixedAmount: 10,
        autopayDaysBefore: 0,
        linkedAccountId: null,
        isDebt: false,
        isActive: true,
      },
    ];
    const instances = [
      {
        id: 'i1',
        billId: 'b1',
        userId: 'u1',
        householdId: 'h1',
        dueDate: '2025-01-13',
        expectedAmount: 10,
        paidAmount: 10,
        remainingAmount: 0,
        status: 'pending',
        paymentStatus: 'paid',
      },
    ];

    mockDbSelectSequence([bills, instances]);
    (processAutopayForInstance as any).mockResolvedValue({
      success: true,
      amount: 0,
    });

    const { processAllAutopayBills } = await import('@/lib/bills/autopay-processor');
    const res = await processAllAutopayBills();

    expect(res.processed).toBe(1);
    expect(res.successful).toBe(0);
    expect(res.skipped).toBe(1);
    expect(sendAutopaySuccessNotification).not.toHaveBeenCalled();
    expect(sendAutopayFailureNotification).not.toHaveBeenCalled();
  });

  it('records failure result and sends failure notification', async () => {
    const bills = [
      {
        id: 'b1',
        name: 'Bill 1',
        userId: 'u1',
        householdId: 'h1',
        expectedAmount: 10,
        categoryId: null,
        merchantId: null,
        isAutopayEnabled: true,
        autopayAccountId: 'a1',
        autopayAmountType: 'fixed',
        autopayFixedAmount: 10,
        autopayDaysBefore: 0,
        linkedAccountId: null,
        isDebt: false,
        isActive: true,
      },
    ];
    const instances = [
      {
        id: 'i1',
        billId: 'b1',
        userId: 'u1',
        householdId: 'h1',
        dueDate: '2025-01-13',
        expectedAmount: 10,
        paidAmount: null,
        remainingAmount: null,
        status: 'pending',
        paymentStatus: 'unpaid',
      },
    ];

    mockDbSelectSequence([bills, instances]);
    (processAutopayForInstance as any).mockResolvedValue({
      success: false,
      amount: 10,
      error: 'No funds',
      errorCode: 'INSUFFICIENT_FUNDS',
    });

    const { processAllAutopayBills } = await import('@/lib/bills/autopay-processor');
    const res = await processAllAutopayBills();

    expect(res.processed).toBe(1);
    expect(res.failed).toBe(1);
    expect(res.errors[0]).toEqual(
      expect.objectContaining({
        billId: 'b1',
        billName: 'Bill 1',
        instanceId: 'i1',
        error: 'No funds',
        errorCode: 'INSUFFICIENT_FUNDS',
      })
    );
    expect(sendAutopayFailureNotification).toHaveBeenCalledTimes(1);
  });

  it('handles thrown errors from processAutopayForInstance as SYSTEM_ERROR and sends failure notification', async () => {
    const bills = [
      {
        id: 'b1',
        name: 'Bill 1',
        userId: 'u1',
        householdId: 'h1',
        expectedAmount: 10,
        categoryId: null,
        merchantId: null,
        isAutopayEnabled: true,
        autopayAccountId: 'a1',
        autopayAmountType: 'fixed',
        autopayFixedAmount: 10,
        autopayDaysBefore: 0,
        linkedAccountId: null,
        isDebt: false,
        isActive: true,
      },
    ];
    const instances = [
      {
        id: 'i1',
        billId: 'b1',
        userId: 'u1',
        householdId: 'h1',
        dueDate: '2025-01-13',
        expectedAmount: 10,
        paidAmount: null,
        remainingAmount: null,
        status: 'pending',
        paymentStatus: 'unpaid',
      },
    ];

    mockDbSelectSequence([bills, instances]);
    (processAutopayForInstance as any).mockRejectedValue(new Error('boom'));

    const { processAllAutopayBills } = await import('@/lib/bills/autopay-processor');
    const res = await processAllAutopayBills();

    expect(res.processed).toBe(1);
    expect(res.failed).toBe(1);
    expect(res.errors[0].errorCode).toBe('SYSTEM_ERROR');
    expect(res.errors[0].error).toBe('boom');
    expect(sendAutopayFailureNotification).toHaveBeenCalledTimes(1);
  });
});


