import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Use vi.hoisted so mocks are available when vi.mock factories run (hoisted to top)
const { mockCreateNotification, mockDbSelect } = vi.hoisted(() => ({
  mockCreateNotification: vi.fn(),
  mockDbSelect: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  db: {
    select: () => ({
      from: () => ({
        leftJoin: () => ({
          where: mockDbSelect,
        }),
      }),
    }),
  },
}));

vi.mock('@/lib/db/schema', () => ({
  billInstances: { billId: 'billId', userId: 'userId', status: 'status', dueDate: 'dueDate' },
  bills: { id: 'id' },
}));

vi.mock('@/lib/notifications/notification-service', () => ({
  createNotification: mockCreateNotification,
}));

import { checkAndCreateBillReminders } from '@/lib/notifications/bill-reminders';

describe('lib/notifications/bill-reminders', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function makeBillInstance(dueDate: string, billOverrides: Record<string, unknown> = {}) {
    return {
      instance: {
        id: 'inst-1',
        billId: 'bill-1',
        userId: 'user-1',
        householdId: 'hh-1',
        dueDate,
        expectedAmount: 100,
        paidAmount: null,
        remainingAmount: null,
        status: 'pending',
        paymentTransactionId: null,
        paidAt: null,
        createdAt: '2025-01-01',
        updatedAt: '2025-01-01',
      },
      bill: {
        id: 'bill-1',
        name: 'Electric Bill',
        expectedAmount: 100,
        frequency: 'monthly',
        dueDate: 15,
        isAutopayEnabled: false,
        autopayAccountId: null,
        isActive: true,
        categoryId: null,
        merchantId: null,
        accountId: null,
        userId: 'user-1',
        householdId: 'hh-1',
        ...billOverrides,
      },
    };
  }

  it('creates notification for bill due today', async () => {
    // Use local midnight constructor to avoid UTC/local TZ mismatch
    vi.setSystemTime(new Date(2025, 0, 15));
    mockDbSelect.mockResolvedValue([makeBillInstance('2025-01-15')]);

    const result = await checkAndCreateBillReminders();

    expect(mockCreateNotification).toHaveBeenCalledTimes(1);
    expect(mockCreateNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'bill_due',
        priority: 'high',
      }),
    );
    expect(result.notificationsCreated).toBe(1);
  });

  it('creates notification for bill due tomorrow', async () => {
    vi.setSystemTime(new Date(2025, 0, 14));
    mockDbSelect.mockResolvedValue([makeBillInstance('2025-01-15')]);

    const result = await checkAndCreateBillReminders();

    expect(mockCreateNotification).toHaveBeenCalledTimes(1);
    expect(mockCreateNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'bill_due',
        priority: 'normal',
      }),
    );
    expect(result.notificationsCreated).toBe(1);
  });

  it('creates notification for bill due in 3 days', async () => {
    vi.setSystemTime(new Date(2025, 0, 12));
    mockDbSelect.mockResolvedValue([makeBillInstance('2025-01-15')]);

    const result = await checkAndCreateBillReminders();

    expect(mockCreateNotification).toHaveBeenCalledTimes(1);
    expect(mockCreateNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'bill_due',
        priority: 'low',
      }),
    );
    expect(result.notificationsCreated).toBe(1);
  });

  it('creates overdue notification for past-due bills', async () => {
    vi.setSystemTime(new Date(2025, 0, 18));
    mockDbSelect.mockResolvedValue([makeBillInstance('2025-01-15')]);

    const result = await checkAndCreateBillReminders();

    expect(mockCreateNotification).toHaveBeenCalledTimes(1);
    expect(mockCreateNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'bill_overdue',
        priority: 'urgent',
      }),
    );
    expect(result.notificationsCreated).toBe(1);
  });

  it('skips autopay-enabled bills', async () => {
    vi.setSystemTime(new Date(2025, 0, 15));
    mockDbSelect.mockResolvedValue([
      makeBillInstance('2025-01-15', { isAutopayEnabled: true, autopayAccountId: 'acc-1' }),
    ]);

    const result = await checkAndCreateBillReminders();

    expect(mockCreateNotification).not.toHaveBeenCalled();
    expect(result.skippedAutopay).toBe(1);
    expect(result.notificationsCreated).toBe(0);
  });

  it('does not skip autopay if autopayAccountId is null', async () => {
    vi.setSystemTime(new Date(2025, 0, 15));
    mockDbSelect.mockResolvedValue([
      makeBillInstance('2025-01-15', { isAutopayEnabled: true, autopayAccountId: null }),
    ]);

    const result = await checkAndCreateBillReminders();

    // Should not be skipped because autopayAccountId is null
    expect(mockCreateNotification).toHaveBeenCalledTimes(1);
    expect(result.skippedAutopay).toBe(0);
  });

  it('skips instances with no bill (null join)', async () => {
    vi.setSystemTime(new Date(2025, 0, 15));
    mockDbSelect.mockResolvedValue([{
      instance: {
        id: 'inst-1',
        billId: 'bill-1',
        userId: 'user-1',
        dueDate: '2025-01-15',
        status: 'pending',
      },
      bill: null,
    }]);

    const result = await checkAndCreateBillReminders();

    expect(mockCreateNotification).not.toHaveBeenCalled();
    expect(result.notificationsCreated).toBe(0);
  });

  it('does not create notification for bill due in 2 days (no rule for 2)', async () => {
    vi.setSystemTime(new Date(2025, 0, 13));
    mockDbSelect.mockResolvedValue([makeBillInstance('2025-01-15')]);

    const result = await checkAndCreateBillReminders();

    expect(mockCreateNotification).not.toHaveBeenCalled();
    expect(result.notificationsCreated).toBe(0);
  });

  it('returns correct total checked instances', async () => {
    vi.setSystemTime(new Date(2025, 0, 15));
    mockDbSelect.mockResolvedValue([
      makeBillInstance('2025-01-15'),
      makeBillInstance('2025-01-16'),
    ]);

    const result = await checkAndCreateBillReminders();

    expect(result.checkedInstances).toBe(2);
  });
});
