/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

import { POST } from '@/app/api/invitations/accept/route';

vi.mock('@/lib/auth-helpers', () => ({
  requireAuth: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(),
    transaction: vi.fn(),
  },
}));

vi.mock('nanoid', () => ({
  nanoid: vi.fn(() => 'generated-id'),
}));

import { requireAuth } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { householdInvitations, householdMembers, userSettings } from '@/lib/db/schema';

function createRequest(body: Record<string, unknown>): Request {
  return {
    json: async () => body,
  } as Request;
}

function selectWithLimit(result: unknown[]) {
  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(result),
      }),
    }),
  };
}

function selectWithGet(result: unknown) {
  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        get: vi.fn().mockResolvedValue(result),
      }),
    }),
  };
}

describe('POST /api/invitations/accept', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (requireAuth as Mock).mockResolvedValue({
      userId: 'user-1',
      email: 'invitee@example.com',
    });
  });

  it('returns 403 when the signed-in email does not match invitation email', async () => {
    const invitation = {
      id: 'inv-1',
      householdId: 'hh-1',
      invitedEmail: 'different@example.com',
      invitedBy: 'owner-1',
      role: 'member',
      status: 'pending',
      expiresAt: '2099-01-01T00:00:00.000Z',
    };

    (db.select as Mock)
      .mockReturnValueOnce(selectWithLimit([invitation]))
      .mockReturnValueOnce(
        selectWithGet({
          email: 'invitee@example.com',
          name: 'Invitee User',
        })
      );

    const response = await POST(createRequest({ token: 'token-1' }));
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe('This invitation is for a different email address');
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it('accepts a pending invitation, inserts membership/settings, and marks invitation accepted', async () => {
    const invitation = {
      id: 'inv-2',
      householdId: 'hh-2',
      invitedEmail: 'invitee@example.com',
      invitedBy: 'owner-2',
      role: 'member',
      status: 'pending',
      expiresAt: '2099-01-01T00:00:00.000Z',
    };

    (db.select as Mock)
      .mockReturnValueOnce(selectWithLimit([invitation]))
      .mockReturnValueOnce(
        selectWithGet({
          email: 'invitee@example.com',
          name: 'Invitee User',
        })
      );

    const txInsert = vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    });
    const txUpdate = vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });
    const txSelect = vi.fn().mockReturnValue({
      from: vi.fn().mockImplementation((table: unknown) => ({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue(
            table === householdMembers || table === userSettings ? [] : []
          ),
        }),
      })),
    });

    (db.transaction as Mock).mockImplementation(async (callback: (tx: any) => Promise<void>) =>
      callback({
        select: txSelect,
        insert: txInsert,
        update: txUpdate,
      })
    );

    const response = await POST(createRequest({ token: 'token-2' }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.householdId).toBe('hh-2');
    expect(data.message).toBe('Invitation accepted successfully');

    const insertedTables = txInsert.mock.calls.map((call) => call[0]);
    expect(insertedTables).toContain(householdMembers);
    expect(insertedTables).toContain(userSettings);

    const updatedTables = txUpdate.mock.calls.map((call) => call[0]);
    expect(updatedTables).toContain(householdInvitations);
  });

  it('is idempotent for already-accepted invitations and reactivates existing membership', async () => {
    const invitation = {
      id: 'inv-3',
      householdId: 'hh-3',
      invitedEmail: 'invitee@example.com',
      invitedBy: 'owner-3',
      role: 'admin',
      status: 'accepted',
      expiresAt: '2099-01-01T00:00:00.000Z',
    };

    (db.select as Mock)
      .mockReturnValueOnce(selectWithLimit([invitation]))
      .mockReturnValueOnce(
        selectWithGet({
          email: 'invitee@example.com',
          name: 'Invitee User',
        })
      );

    const txInsert = vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    });
    const txUpdate = vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });
    const txSelect = vi.fn().mockReturnValue({
      from: vi.fn().mockImplementation((table: unknown) => ({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue(
            table === householdMembers
              ? [{ id: 'member-1' }]
              : table === userSettings
                ? [{ id: 'settings-1' }]
                : []
          ),
        }),
      })),
    });

    (db.transaction as Mock).mockImplementation(async (callback: (tx: any) => Promise<void>) =>
      callback({
        select: txSelect,
        insert: txInsert,
        update: txUpdate,
      })
    );

    const response = await POST(createRequest({ token: 'token-3' }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.householdId).toBe('hh-3');
    expect(data.message).toBe('Invitation already accepted');

    const insertedTables = txInsert.mock.calls.map((call) => call[0]);
    expect(insertedTables).not.toContain(householdMembers);
    expect(insertedTables).not.toContain(userSettings);

    const updatedTables = txUpdate.mock.calls.map((call) => call[0]);
    expect(updatedTables).toContain(householdMembers);
    expect(updatedTables).toContain(userSettings);
    expect(updatedTables).not.toContain(householdInvitations);
  });
});
