/**
 * Bug-hunt findings SEC2/SEC4 on POST /api/budgets/apply-surplus:
 * - SEC2: Infinity and NaN are typeof 'number', so `typeof amount !== 'number'
 *   || amount < 0` let them through into debtSettings.extraMonthlyPayment.
 * - SEC4: the amount was never bounded by the surplus that actually exists, so
 *   a client could fund payoff projections with money the household lacks.
 */
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

import { POST } from '@/app/api/budgets/apply-surplus/route';

vi.mock('@/lib/auth-helpers', () => ({ requireAuth: vi.fn() }));
vi.mock('@/lib/api/household-auth', () => ({ getAndVerifyHousehold: vi.fn() }));
vi.mock('@/lib/db', () => ({
  db: { select: vi.fn(), update: vi.fn(), insert: vi.fn() },
}));
vi.mock('@/lib/budgets/surplus-summary', () => ({
  calculateBudgetSurplusSummary: vi.fn(),
}));

import { requireAuth } from '@/lib/auth-helpers';
import { getAndVerifyHousehold } from '@/lib/api/household-auth';
import { db } from '@/lib/db';
import { calculateBudgetSurplusSummary } from '@/lib/budgets/surplus-summary';
import { debtSettings } from '@/lib/db/schema';

const TEST_USER_ID = 'user-1';
const TEST_HOUSEHOLD_ID = 'hh-1';

function requestWith(amount: unknown): Request {
  return {
    url: 'http://localhost/api/budgets/apply-surplus',
    headers: new Headers({ 'x-household-id': TEST_HOUSEHOLD_ID }),
    json: async () => ({ amount, householdId: TEST_HOUSEHOLD_ID }),
  } as unknown as Request;
}

describe('POST /api/budgets/apply-surplus validation (SEC2/SEC4)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (requireAuth as Mock).mockResolvedValue({ userId: TEST_USER_ID });
    (getAndVerifyHousehold as Mock).mockResolvedValue({ householdId: TEST_HOUSEHOLD_ID });
    (calculateBudgetSurplusSummary as Mock).mockResolvedValue({ availableToApply: 200 });

    (db.select as Mock).mockReturnValue({
      from: (table: unknown) => ({
        where: () =>
          table === debtSettings
            ? { limit: async () => [] }
            : Promise.resolve([]),
      }),
    });
    (db.insert as Mock).mockReturnValue({ values: async () => undefined });
    (db.update as Mock).mockReturnValue({ set: () => ({ where: async () => undefined }) });
  });

  it.each([Infinity, -Infinity, NaN])('SEC2: rejects %p', async (amount) => {
    const response = await POST(requestWith(amount));
    expect(response.status).toBe(400);
    expect(db.insert).not.toHaveBeenCalled();
    expect(db.update).not.toHaveBeenCalled();
  });

  it('SEC2: still rejects negatives and non-numbers', async () => {
    expect((await POST(requestWith(-5))).status).toBe(400);
    expect((await POST(requestWith('100'))).status).toBe(400);
    expect((await POST(requestWith(null))).status).toBe(400);
  });

  it('SEC4: rejects an amount above the available surplus', async () => {
    const response = await POST(requestWith(500));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ availableToApply: 200 });
    expect(db.insert).not.toHaveBeenCalled();
    expect(db.update).not.toHaveBeenCalled();
  });

  it('SEC4: accepts an amount at or below the available surplus', async () => {
    expect((await POST(requestWith(200))).status).toBe(200);
    expect((await POST(requestWith(0))).status).toBe(200);
  });
});
