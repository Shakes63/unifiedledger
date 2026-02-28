/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/notifications/notification-service', () => ({
  createNotification: vi.fn(),
}));

import { createNotification } from '@/lib/notifications/notification-service';

import {
  sendAutopaySuccessNotification,
  sendAutopayFailureNotification,
  getAutopayProcessingSummary,
} from '@/lib/notifications/autopay-notifications';

const bill: any = {
  id: 'b1',
  name: 'Bill 1',
  userId: 'u1',
  householdId: 'h1',
};

const instance: any = {
  id: 'i1',
  dueDate: '2025-01-15',
};

describe('lib/notifications/autopay-notifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (createNotification as any).mockResolvedValue('notif-1');
  });

  describe('sendAutopaySuccessNotification', () => {
    it('returns null and does not notify for zero-amount payments', async () => {
      const res = await sendAutopaySuccessNotification(bill, instance, {
        success: true,
        amount: 0,
      });
      expect(res).toBeNull();
      expect(createNotification).not.toHaveBeenCalled();
    });

    it('creates a low priority notification for success with amount > 0', async () => {
      const res = await sendAutopaySuccessNotification(bill, instance, {
        success: true,
        amount: 12.34,
        amountSource: 'Fixed Amount',
        transactionId: 'tx1',
        transferId: 'tr1',
        paymentId: 'p1',
      });

      expect(res).toBe('notif-1');
      expect(createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'u1',
          title: 'Autopay processed: Bill 1',
          priority: 'low',
          entityType: 'billInstance',
          entityId: 'i1',
          householdId: 'h1',
          metadata: expect.objectContaining({
            billId: 'b1',
            instanceId: 'i1',
            amount: 12.34,
            transactionId: 'tx1',
            transferId: 'tr1',
            paymentId: 'p1',
            isAutopayNotification: true,
          }),
        })
      );
    });
  });

  describe('sendAutopayFailureNotification', () => {
    it('creates a high priority notification including mapped error + amount', async () => {
      const res = await sendAutopayFailureNotification(bill, instance, {
        success: false,
        amount: 50,
        error: 'Raw error',
        errorCode: 'INSUFFICIENT_FUNDS',
      });

      expect(res).toBe('notif-1');
      const args = (createNotification as any).mock.calls[0][0];
      expect(args.title).toBe('Autopay failed: Bill 1');
      expect(args.priority).toBe('high');
      expect(args.message).toContain('Insufficient funds in payment account');
      expect(args.message).toContain('Amount: $50.00');
      expect(args.message).toContain('Please pay manually.');
    });
  });

  describe('getAutopayProcessingSummary', () => {
    it('returns "No autopay bills due today" when nothing happened', () => {
      expect(
        getAutopayProcessingSummary({
          processed: 0,
          successful: 0,
          failed: 0,
          skipped: 0,
          totalAmount: 0,
        })
      ).toBe('No autopay bills due today');
    });

    it('formats counts and total amount', () => {
      expect(
        getAutopayProcessingSummary({
          processed: 3,
          successful: 2,
          failed: 1,
          skipped: 4,
          totalAmount: 12.5,
        })
      ).toBe('2 payments processed ($12.50 total), 1 failed, 4 skipped');
    });
  });
});


