import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
  },
}));

vi.mock("@/lib/email/email-service", () => ({
  sendEmail: vi.fn(),
}));

vi.mock("nanoid", () => ({
  nanoid: vi.fn(() => "notif-1"),
}));

import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email/email-service";

type SelectChain = {
  from: () => unknown;
};

function mockSelectChain(result: unknown) {
  return {
    from: () => ({
      where: () => ({
        limit: async () => result,
      }),
      limit: async () => result,
    }),
  } as unknown as SelectChain;
}

describe("lib/notifications/notification-service delivery + rate limiting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when notification type is disabled by preferences", async () => {
    // prefs exist and disable low balance
    vi.mocked(db.select)
      // getPreferencesForUser
      .mockReturnValueOnce(
        mockSelectChain([
          {
            userId: "u1",
            lowBalanceAlertEnabled: false,
            lowBalanceChannels: '["push"]',
            pushNotificationsEnabled: true,
            emailNotificationsEnabled: false,
            emailAddress: null,
          },
        ])
      )
      // isRateLimited query (no existing)
      .mockReturnValueOnce(mockSelectChain([]));

    vi.mocked(db.insert).mockReturnValueOnce({
      values: async () => undefined,
    } as unknown as { values: () => Promise<void> });

    const { createNotification } = await import("@/lib/notifications/notification-service");
    const id = await createNotification({
      userId: "u1",
      type: "low_balance",
      title: "Low balance",
      message: "Balance low",
      entityType: "account",
      entityId: "acc-1",
    });

    expect(id).toBeNull();
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("returns null when rate limited (same type/entity recently exists)", async () => {
    vi.mocked(db.select)
      // prefs
      .mockReturnValueOnce(
        mockSelectChain([
          {
            userId: "u1",
            budgetWarningEnabled: true,
            budgetWarningChannels: '["push"]',
            pushNotificationsEnabled: true,
            emailNotificationsEnabled: false,
            emailAddress: null,
          },
        ])
      )
      // isRateLimited -> found existing
      .mockReturnValueOnce(
        mockSelectChain([
          {
            id: "existing-1",
          },
        ])
      );

    const { createNotification } = await import("@/lib/notifications/notification-service");
    const id = await createNotification({
      userId: "u1",
      type: "budget_warning",
      title: "Budget warning",
      message: "You're at 90%",
      entityType: "budgetCategory",
      entityId: "cat-1",
    });

    expect(id).toBeNull();
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("creates notification and sends email when email channel selected and globally enabled", async () => {
    vi.mocked(db.select)
      // prefs
      .mockReturnValueOnce(
        mockSelectChain([
          {
            userId: "u1",
            billReminderEnabled: true,
            billOverdueReminder: true,
            billReminderChannels: '["email"]',
            pushNotificationsEnabled: false,
            emailNotificationsEnabled: true,
            emailAddress: "u1@example.com",
          },
        ])
      )
      // isRateLimited -> none
      .mockReturnValueOnce(mockSelectChain([]));

    vi.mocked(db.insert).mockReturnValueOnce({
      values: async () => undefined,
    } as unknown as { values: () => Promise<void> });

    const { createNotification } = await import("@/lib/notifications/notification-service");
    const id = await createNotification({
      userId: "u1",
      type: "bill_due",
      title: "Bill due",
      message: "Pay your bill",
      actionUrl: "/dashboard/bills",
      actionLabel: "View Bills",
      entityType: "billInstance",
      entityId: "bi-1",
    });

    expect(id).toBe("notif-1");
    expect(db.insert).toHaveBeenCalledTimes(1);
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(vi.mocked(sendEmail).mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        to: "u1@example.com",
        subject: "Bill due",
      })
    );
  });

  it("falls back to push when channels json is invalid", async () => {
    vi.mocked(db.select)
      // prefs
      .mockReturnValueOnce(
        mockSelectChain([
          {
            userId: "u1",
            lowBalanceAlertEnabled: true,
            lowBalanceChannels: "not-json",
            pushNotificationsEnabled: true,
            emailNotificationsEnabled: false,
            emailAddress: null,
          },
        ])
      )
      // isRateLimited -> none
      .mockReturnValueOnce(mockSelectChain([]))
      // sendPushNotification: subscriptions query
      .mockReturnValueOnce({
        from: () => ({
          where: async () => [],
        }),
      } as unknown as SelectChain)
      // sendPushNotification: prefs query (push enabled)
      .mockReturnValueOnce(
        mockSelectChain([
          {
            userId: "u1",
            pushNotificationsEnabled: true,
          },
        ])
      );

    vi.mocked(db.insert).mockReturnValueOnce({
      values: async () => undefined,
    } as unknown as { values: () => Promise<void> });

    const { createNotification } = await import("@/lib/notifications/notification-service");
    const id = await createNotification({
      userId: "u1",
      type: "low_balance",
      title: "Low balance",
      message: "Balance low",
      entityType: "account",
      entityId: "acc-1",
    });

    expect(id).toBe("notif-1");
    expect(sendEmail).not.toHaveBeenCalled();
  });
});


