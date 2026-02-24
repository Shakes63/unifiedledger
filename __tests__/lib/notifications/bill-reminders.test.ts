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
        innerJoin: () => ({
          leftJoin: () => ({
            where: mockDbSelect,
          }),
          where: mockDbSelect,
        }),
      }),
    }),
  },
}));

vi.mock('@/lib/db/schema', () => ({
  billOccurrences: {
    templateId: 'templateId',
    status: 'status',
    dueDate: 'dueDate',
  },
  billTemplates: {
    id: 'id',
    householdId: 'householdId',
    billType: 'billType',
    isActive: 'isActive',
    createdByUserId: 'createdByUserId',
  },
  autopayRules: {
    templateId: 'templateId',
    householdId: 'householdId',
  },
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

  function makeBillOccurrence(
    dueDate: string,
    options?: { autopay?: { isEnabled: boolean; payFromAccountId: string | null } | null }
  ) {
    return {
      occurrence: {
        id: 'occ-1',
        templateId: 'tpl-1',
        householdId: 'hh-1',
        dueDate,
        amountDueCents: 10000,
        amountPaidCents: 0,
        amountRemainingCents: 10000,
        status: 'unpaid',
        createdAt: '2025-01-01',
        updatedAt: '2025-01-01',
      },
      template: {
        id: 'tpl-1',
        name: 'Electric Bill',
        billType: 'expense',
        isActive: true,
        createdByUserId: 'user-1',
        householdId: 'hh-1',
      },
      autopay: options?.autopay ?? null,
    };
  }

  it('creates notification for bill due today', async () => {
    // Use local midnight constructor to avoid UTC/local TZ mismatch
    vi.setSystemTime(new Date(2025, 0, 15));
    mockDbSelect.mockResolvedValue([makeBillOccurrence('2025-01-15')]);

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
    mockDbSelect.mockResolvedValue([makeBillOccurrence('2025-01-15')]);

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
    mockDbSelect.mockResolvedValue([makeBillOccurrence('2025-01-15')]);

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
    mockDbSelect.mockResolvedValue([makeBillOccurrence('2025-01-15')]);

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
      makeBillOccurrence('2025-01-15', {
        autopay: { isEnabled: true, payFromAccountId: 'acc-1' },
      }),
    ]);

    const result = await checkAndCreateBillReminders();

    expect(mockCreateNotification).not.toHaveBeenCalled();
    expect(result.skippedAutopay).toBe(1);
    expect(result.notificationsCreated).toBe(0);
  });

  it('does not skip autopay if source account is missing', async () => {
    vi.setSystemTime(new Date(2025, 0, 15));
    mockDbSelect.mockResolvedValue([
      makeBillOccurrence('2025-01-15', {
        autopay: { isEnabled: true, payFromAccountId: null },
      }),
    ]);

    const result = await checkAndCreateBillReminders();

    // Should not be skipped because autopayAccountId is null
    expect(mockCreateNotification).toHaveBeenCalledTimes(1);
    expect(result.skippedAutopay).toBe(0);
  });

  it('skips non-reminder days', async () => {
    vi.setSystemTime(new Date(2025, 0, 15));
    mockDbSelect.mockResolvedValue([makeBillOccurrence('2025-01-17')]);

    const result = await checkAndCreateBillReminders();

    expect(mockCreateNotification).not.toHaveBeenCalled();
    expect(result.notificationsCreated).toBe(0);
  });

  it('does not create notification for bill due in 2 days (no rule for 2)', async () => {
    vi.setSystemTime(new Date(2025, 0, 13));
    mockDbSelect.mockResolvedValue([makeBillOccurrence('2025-01-15')]);

    const result = await checkAndCreateBillReminders();

    expect(mockCreateNotification).not.toHaveBeenCalled();
    expect(result.notificationsCreated).toBe(0);
  });

  it('returns correct total checked instances', async () => {
    vi.setSystemTime(new Date(2025, 0, 15));
    mockDbSelect.mockResolvedValue([
      makeBillOccurrence('2025-01-15'),
      makeBillOccurrence('2025-01-16'),
    ]);

    const result = await checkAndCreateBillReminders();

    expect(result.checkedInstances).toBe(2);
  });
});
