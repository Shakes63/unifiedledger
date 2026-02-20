import { beforeEach, describe, expect, it, vi } from 'vitest';
import util from 'node:util';

import { GET as GET_TRANSFER_SUGGESTIONS } from '@/app/api/transfer-suggestions/route';
import { POST as POST_REJECT_TRANSFER_SUGGESTION } from '@/app/api/transfer-suggestions/[id]/reject/route';

vi.mock('@/lib/auth-helpers', () => ({
  requireAuth: vi.fn(),
}));

vi.mock('@/lib/api/household-auth', () => ({
  getAndVerifyHousehold: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(),
    update: vi.fn(),
  },
}));

import { requireAuth } from '@/lib/auth-helpers';
import { getAndVerifyHousehold } from '@/lib/api/household-auth';
import { db } from '@/lib/db';
import { transferSuggestions } from '@/lib/db/schema';

describe('/api/transfer-suggestions household scoping', () => {
  const TEST_USER_ID = 'user_1';
  const TEST_HOUSEHOLD_ID = 'hh_1';

  beforeEach(() => {
    vi.clearAllMocks();

    (requireAuth as unknown as { mockResolvedValue: (v: unknown) => void }).mockResolvedValue({
      userId: TEST_USER_ID,
    });

    (getAndVerifyHousehold as unknown as { mockResolvedValue: (v: unknown) => void }).mockResolvedValue({
      householdId: TEST_HOUSEHOLD_ID,
    });
  });

  it('GET /api/transfer-suggestions scopes filter and join conditions by household', async () => {
    const whereCalls: unknown[] = [];
    const joinOnCalls: unknown[] = [];
    let selectCallCount = 0;

    (db.select as unknown as {
      mockImplementation: (fn: (...args: unknown[]) => unknown) => void;
    }).mockImplementation(() => {
      selectCallCount += 1;

      if (selectCallCount === 1) {
        const joinChain = {
          leftJoin: (_table: unknown, onArg: unknown) => {
            joinOnCalls.push(onArg);
            return joinChain;
          },
          where: (whereArg: unknown) => {
            whereCalls.push(whereArg);
            return {
              orderBy: () => ({
                limit: () => ({
                  offset: async () => [],
                }),
              }),
            };
          },
        };

        return {
          from: () => joinChain,
        };
      }

      return {
        from: () => ({
          where: async (whereArg: unknown) => {
            whereCalls.push(whereArg);
            return [{ count: 0 }];
          },
        }),
      };
    });

    const request = {
      url: 'https://example.com/api/transfer-suggestions?status=pending&limit=20&offset=0',
      headers: new Headers({ 'x-household-id': TEST_HOUSEHOLD_ID }),
    } as unknown as Request;

    const response = await GET_TRANSFER_SUGGESTIONS(request as never);
    expect(response.status).toBe(200);

    expect(whereCalls.length).toBeGreaterThan(0);
    for (const whereArg of whereCalls) {
      const whereStr = util.inspect(whereArg, { depth: 10, colors: false }).toLowerCase();
      expect(whereStr).toContain('household');
      expect(whereStr).toContain('user');
    }

    expect(joinOnCalls.length).toBeGreaterThan(0);
    for (const joinOnArg of joinOnCalls) {
      const joinStr = util.inspect(joinOnArg, { depth: 10, colors: false }).toLowerCase();
      expect(joinStr).toContain('household');
      expect(joinStr).toContain('user');
    }
  });

  it('POST /api/transfer-suggestions/[id]/reject scopes select and update by household', async () => {
    const selectWhereCalls: unknown[] = [];
    const updateWhereCalls: unknown[] = [];

    (db.select as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue({
      from: () => ({
        where: (whereArg: unknown) => {
          selectWhereCalls.push(whereArg);
          return {
            limit: async () => [
              {
                id: 's_1',
                userId: TEST_USER_ID,
                householdId: TEST_HOUSEHOLD_ID,
                status: 'pending',
              },
            ],
          };
        },
      }),
    });

    (db.update as unknown as {
      mockImplementation: (fn: (table: unknown) => unknown) => void;
    }).mockImplementation((table: unknown) => ({
      set: () => ({
        where: async (whereArg: unknown) => {
          updateWhereCalls.push({ table, whereArg });
          return undefined;
        },
      }),
    }));

    const request = {
      url: 'https://example.com/api/transfer-suggestions/s_1/reject',
      headers: new Headers({ 'x-household-id': TEST_HOUSEHOLD_ID }),
    } as unknown as Request;

    const response = await POST_REJECT_TRANSFER_SUGGESTION(request as never, {
      params: Promise.resolve({ id: 's_1' }),
    });

    expect(response.status).toBe(200);

    expect(selectWhereCalls.length).toBeGreaterThan(0);
    for (const whereArg of selectWhereCalls) {
      const whereStr = util.inspect(whereArg, { depth: 10, colors: false }).toLowerCase();
      expect(whereStr).toContain('household');
      expect(whereStr).toContain('user');
    }

    const suggestionUpdate = updateWhereCalls.find((call) => call.table === transferSuggestions);
    expect(suggestionUpdate).toBeTruthy();
    const updateStr = util
      .inspect(suggestionUpdate, { depth: 10, colors: false })
      .toLowerCase();
    expect(updateStr).toContain('household');
    expect(updateStr).toContain('user');
  });
});
