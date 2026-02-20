import util from 'node:util';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

import { GET } from '@/app/api/budgets/surplus-suggestion/route';

vi.mock('@/lib/auth-helpers', () => ({
  requireAuth: vi.fn(),
}));

vi.mock('@/lib/api/household-auth', () => ({
  getAndVerifyHousehold: vi.fn(),
}));

vi.mock('@/lib/budgets/surplus-summary', () => ({
  calculateBudgetSurplusSummary: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(),
  },
}));

import { requireAuth } from '@/lib/auth-helpers';
import { getAndVerifyHousehold } from '@/lib/api/household-auth';
import { calculateBudgetSurplusSummary } from '@/lib/budgets/surplus-summary';
import { db } from '@/lib/db';
import { debtSettings, debts } from '@/lib/db/schema';

describe('GET /api/budgets/surplus-suggestion household scoping', () => {
  const TEST_USER_ID = 'user-1';
  const TEST_HOUSEHOLD_ID = 'hh-1';

  beforeEach(() => {
    vi.clearAllMocks();

    (requireAuth as Mock).mockResolvedValue({ userId: TEST_USER_ID });
    (getAndVerifyHousehold as Mock).mockResolvedValue({ householdId: TEST_HOUSEHOLD_ID });
    (calculateBudgetSurplusSummary as Mock).mockResolvedValue({
      monthlyIncome: 5000,
      totalBudgetedExpenses: 2000,
      totalActualExpenses: 1800,
      totalMinimumPayments: 300,
      currentExtraPayment: 100,
      budgetedSurplus: 2600,
      availableToApply: 2900,
      totalDebtPayments: 400,
      debtToIncomeRatio: 8,
      debtToIncomeLevel: 'healthy',
      hasSurplus: true,
      suggestedExtraPayment: 500,
      hasDebts: true,
      hasIncome: true,
      hasBudgets: true,
    });

    const selectCalls: Array<{ table: unknown; whereArg: unknown }> = [];
    (db.select as Mock).mockReturnValue({
      from: (table: unknown) => ({
        where: (whereArg: unknown) => {
          selectCalls.push({ table, whereArg });

          if (table === debts) {
            return Promise.resolve([
              {
                id: 'debt-1',
                name: 'Debt One',
                remainingBalance: 2500,
                minimumPayment: 150,
                interestRate: 14,
                type: 'credit_card',
                loanType: 'revolving',
                compoundingFrequency: 'monthly',
                billingCycleDays: 30,
                color: '#ef4444',
                icon: 'credit-card',
              },
            ]);
          }

          if (table === debtSettings) {
            return {
              limit: async () => [
                {
                  userId: TEST_USER_ID,
                  householdId: TEST_HOUSEHOLD_ID,
                  preferredMethod: 'avalanche',
                  paymentFrequency: 'monthly',
                },
              ],
            };
          }

          return { limit: async () => [] };
        },
      }),
    });

    (db as unknown as { __selectCalls?: typeof selectCalls }).__selectCalls = selectCalls;
    (global.fetch as unknown as Mock).mockClear();
  });

  it('uses shared summary service and scopes debt/debt settings by user + household', async () => {
    const request = {
      url: 'http://localhost/api/budgets/surplus-suggestion',
      headers: new Headers({ 'x-household-id': TEST_HOUSEHOLD_ID }),
    } as unknown as Request;

    const response = await GET(request);
    expect(response.status).toBe(200);

    const payload = await response.json() as { hasSuggestion: boolean };
    expect(payload.hasSuggestion).toBe(true);
    expect(calculateBudgetSurplusSummary).toHaveBeenCalledWith({
      userId: TEST_USER_ID,
      householdId: TEST_HOUSEHOLD_ID,
    });
    expect(global.fetch).not.toHaveBeenCalled();

    const selectCalls = (db as unknown as {
      __selectCalls: Array<{ table: unknown; whereArg: unknown }>;
    }).__selectCalls;

    const debtsSelect = selectCalls.find((call) => call.table === debts);
    expect(debtsSelect).toBeTruthy();
    const debtsWhere = util.inspect(debtsSelect!.whereArg, { depth: 8, colors: false }).toLowerCase();
    expect(debtsWhere).toContain('household');
    expect(debtsWhere).toContain('user');

    const settingsSelect = selectCalls.find((call) => call.table === debtSettings);
    expect(settingsSelect).toBeTruthy();
    const settingsWhere = util.inspect(settingsSelect!.whereArg, { depth: 8, colors: false }).toLowerCase();
    expect(settingsWhere).toContain('household');
    expect(settingsWhere).toContain('user');
  });
});
