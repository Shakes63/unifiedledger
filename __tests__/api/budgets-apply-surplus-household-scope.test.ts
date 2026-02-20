import util from 'node:util';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

import { POST } from '@/app/api/budgets/apply-surplus/route';

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
    insert: vi.fn(),
  },
}));

import { requireAuth } from '@/lib/auth-helpers';
import { getAndVerifyHousehold } from '@/lib/api/household-auth';
import { db } from '@/lib/db';
import { debtSettings, debts } from '@/lib/db/schema';

describe('POST /api/budgets/apply-surplus household scoping', () => {
  const TEST_USER_ID = 'user-1';
  const TEST_HOUSEHOLD_ID = 'hh-1';

  beforeEach(() => {
    vi.clearAllMocks();

    (requireAuth as Mock).mockResolvedValue({ userId: TEST_USER_ID });
    (getAndVerifyHousehold as Mock).mockResolvedValue({ householdId: TEST_HOUSEHOLD_ID });

    const selectCalls: Array<{ table: unknown; whereArg: unknown }> = [];
    (db.select as Mock).mockReturnValue({
      from: (table: unknown) => ({
        where: (whereArg: unknown) => {
          selectCalls.push({ table, whereArg });

          if (table === debtSettings) {
            return {
              limit: async () => [
                {
                  id: 'settings-1',
                  userId: TEST_USER_ID,
                  householdId: TEST_HOUSEHOLD_ID,
                  extraMonthlyPayment: 75,
                  preferredMethod: 'avalanche',
                  paymentFrequency: 'monthly',
                },
              ],
            };
          }

          if (table === debts) {
            return Promise.resolve([
              {
                id: 'debt-1',
                name: 'Credit Card',
                remainingBalance: 1200,
                minimumPayment: 60,
                interestRate: 18,
                type: 'credit_card',
                loanType: 'revolving',
                compoundingFrequency: 'monthly',
                billingCycleDays: 30,
                color: '#ef4444',
                icon: 'credit-card',
              },
            ]);
          }

          return { limit: async () => [] };
        },
      }),
    });

    const updateWhereCalls: Array<{ table: unknown; whereArg: unknown }> = [];
    (db.update as Mock).mockImplementation((table: unknown) => ({
      set: () => ({
        where: async (whereArg: unknown) => {
          updateWhereCalls.push({ table, whereArg });
          return undefined;
        },
      }),
    }));

    (db.insert as Mock).mockReturnValue({
      values: async () => undefined,
    });

    (db as unknown as { __selectCalls?: typeof selectCalls }).__selectCalls = selectCalls;
    (db as unknown as { __updateWhereCalls?: typeof updateWhereCalls }).__updateWhereCalls = updateWhereCalls;
  });

  it('scopes debt settings and debt reads by user + household', async () => {
    const request = {
      url: 'http://localhost/api/budgets/apply-surplus',
      headers: new Headers({ 'x-household-id': TEST_HOUSEHOLD_ID }),
      json: async () => ({
        amount: 25,
        householdId: TEST_HOUSEHOLD_ID,
      }),
    } as unknown as Request;

    const response = await POST(request);
    expect(response.status).toBe(200);

    const selectCalls = (db as unknown as {
      __selectCalls: Array<{ table: unknown; whereArg: unknown }>;
    }).__selectCalls;

    const settingsSelect = selectCalls.find((call) => call.table === debtSettings);
    expect(settingsSelect).toBeTruthy();
    const settingsWhere = util.inspect(settingsSelect!.whereArg, { depth: 8, colors: false }).toLowerCase();
    expect(settingsWhere).toContain('household');
    expect(settingsWhere).toContain('user');

    const debtsSelect = selectCalls.find((call) => call.table === debts);
    expect(debtsSelect).toBeTruthy();
    const debtsWhere = util.inspect(debtsSelect!.whereArg, { depth: 8, colors: false }).toLowerCase();
    expect(debtsWhere).toContain('household');
    expect(debtsWhere).toContain('user');

    const updateWhereCalls = (db as unknown as {
      __updateWhereCalls: Array<{ table: unknown; whereArg: unknown }>;
    }).__updateWhereCalls;
    const settingsUpdate = updateWhereCalls.find((call) => call.table === debtSettings);
    expect(settingsUpdate).toBeTruthy();
    const updateWhere = util.inspect(settingsUpdate!.whereArg, { depth: 8, colors: false }).toLowerCase();
    expect(updateWhere).toContain('household');
    expect(updateWhere).toContain('user');
  });
});
