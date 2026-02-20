/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nanoid } from 'nanoid';
import { eq } from 'drizzle-orm';

import { db } from '@/lib/db';
import {
  accounts,
  budgetCategories,
  debtSettings,
  debts,
  householdMembers,
  households,
  transactions,
} from '@/lib/db/schema';
import {
  cleanupTestHousehold,
  createTestAccount,
  createTestHousehold,
  createTestHouseholdMember,
} from './test-utils';
import { getTodayLocalDateString } from '@/lib/utils/local-date';
import { toMoneyCents } from '@/lib/utils/money-cents';

vi.mock('@/lib/auth-helpers', () => ({
  requireAuth: vi.fn(),
}));
import { requireAuth } from '@/lib/auth-helpers';

function req(url: string, householdId: string): Request {
  return new Request(url, {
    headers: { 'x-household-id': householdId },
  });
}

describe('Integration: budget summary household isolation', () => {
  let userId: string;
  let hhA: string;
  let hhB: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();

    userId = `budget-summary-iso-${crypto.randomUUID()}`;
    (requireAuth as any).mockResolvedValue({ userId });

    const householdA = createTestHousehold(userId, { name: 'Budget HH A' });
    const householdB = createTestHousehold(userId, { name: 'Budget HH B' });
    const [insertedA] = await db.insert(households).values(householdA).returning();
    const [insertedB] = await db.insert(households).values(householdB).returning();
    hhA = insertedA.id;
    hhB = insertedB.id;

    await db.insert(householdMembers).values([
      createTestHouseholdMember(hhA, userId, `${userId}@example.com`, { role: 'owner' }),
      createTestHouseholdMember(hhB, userId, `${userId}@example.com`, { role: 'owner' }),
    ]);

    const [accountA] = await db
      .insert(accounts)
      .values(createTestAccount(userId, hhA, { name: 'Checking A' }))
      .returning();
    const [accountB] = await db
      .insert(accounts)
      .values(createTestAccount(userId, hhB, { name: 'Checking B' }))
      .returning();

    const today = getTodayLocalDateString();

    await db.insert(transactions).values([
      {
        id: nanoid(),
        userId,
        householdId: hhA,
        accountId: accountA.id,
        date: today,
        amount: 5000,
        amountCents: toMoneyCents(5000) ?? 0,
        description: 'Income A',
        type: 'income',
      },
      {
        id: nanoid(),
        userId,
        householdId: hhA,
        accountId: accountA.id,
        date: today,
        amount: 1200,
        amountCents: toMoneyCents(1200) ?? 0,
        description: 'Expense A',
        type: 'expense',
      },
      {
        id: nanoid(),
        userId,
        householdId: hhB,
        accountId: accountB.id,
        date: today,
        amount: 3500,
        amountCents: toMoneyCents(3500) ?? 0,
        description: 'Income B',
        type: 'income',
      },
      {
        id: nanoid(),
        userId,
        householdId: hhB,
        accountId: accountB.id,
        date: today,
        amount: 700,
        amountCents: toMoneyCents(700) ?? 0,
        description: 'Expense B',
        type: 'expense',
      },
    ]);

    await db.insert(budgetCategories).values([
      {
        id: nanoid(),
        userId,
        householdId: hhA,
        name: 'Category A',
        type: 'expense',
        monthlyBudget: 1500,
        isActive: true,
      },
      {
        id: nanoid(),
        userId,
        householdId: hhB,
        name: 'Category B',
        type: 'expense',
        monthlyBudget: 800,
        isActive: true,
      },
    ]);

    await db.insert(debts).values([
      {
        id: nanoid(),
        userId,
        householdId: hhA,
        name: 'Debt A',
        creditorName: 'Creditor A',
        originalAmount: 6000,
        remainingBalance: 5000,
        minimumPayment: 120,
        startDate: today,
        status: 'active',
      },
      {
        id: nanoid(),
        userId,
        householdId: hhB,
        name: 'Debt B',
        creditorName: 'Creditor B',
        originalAmount: 9000,
        remainingBalance: 7000,
        minimumPayment: 300,
        startDate: today,
        status: 'active',
      },
    ]);

    await db.insert(debtSettings).values([
      {
        id: nanoid(),
        userId,
        householdId: hhA,
        extraMonthlyPayment: 50,
        preferredMethod: 'avalanche',
        paymentFrequency: 'monthly',
      },
      {
        id: nanoid(),
        userId,
        householdId: hhB,
        extraMonthlyPayment: 225,
        preferredMethod: 'avalanche',
        paymentFrequency: 'monthly',
      },
    ]);
  });

  afterEach(async () => {
    await db.delete(debtSettings).where(eq(debtSettings.userId, userId));
    await db.delete(debts).where(eq(debts.userId, userId));

    await cleanupTestHousehold(userId, hhA);

    await db.delete(householdMembers).where(eq(householdMembers.householdId, hhB));
    await db.delete(households).where(eq(households.id, hhB));
  });

  it('GET /api/budgets/summary isolates debt and debt settings by household', async () => {
    const { GET } = await import('@/app/api/budgets/summary/route');

    const responseA = await GET(req('http://localhost/api/budgets/summary', hhA) as any);
    const responseB = await GET(req('http://localhost/api/budgets/summary', hhB) as any);

    expect(responseA.status).toBe(200);
    expect(responseB.status).toBe(200);

    const dataA = await responseA.json() as {
      totalMinimumPayments: number;
      currentExtraPayment: number;
      totalDebtPayments: number;
    };
    const dataB = await responseB.json() as {
      totalMinimumPayments: number;
      currentExtraPayment: number;
      totalDebtPayments: number;
    };

    expect(dataA.totalMinimumPayments).toBe(120);
    expect(dataB.totalMinimumPayments).toBe(300);
    expect(dataA.currentExtraPayment).toBe(50);
    expect(dataB.currentExtraPayment).toBe(225);
    expect(dataA.totalDebtPayments).toBe(170);
    expect(dataB.totalDebtPayments).toBe(525);
  });
});
