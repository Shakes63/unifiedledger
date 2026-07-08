/**
 * RC-4 / H-DBG-10: debt balances are maintained in integer cents so they can't
 * accumulate float drift (e.g. 11.219999999999999) and the paid-off check is
 * exact. Exercises the real create-payment path against a real DB.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '@/lib/db';
import { debtPayments, debts } from '@/lib/db/schema';
import {
  loadScopedDebt,
  persistLegacyDebtPayment,
} from '@/lib/transactions/payment-linkage-debt';
import { setupTestUserWithHousehold, cleanupTestHousehold } from './test-utils';

describe('debt balance in integer cents (RC-4 / H-DBG-10)', () => {
  let ctx: { userId: string; householdId: string } | null = null;

  afterEach(async () => {
    if (ctx) {
      await db.delete(debtPayments).where(eq(debtPayments.householdId, ctx.householdId));
      await db.delete(debts).where(eq(debts.householdId, ctx.householdId));
      await cleanupTestHousehold(ctx.userId, ctx.householdId);
      ctx = null;
    }
  });

  async function makeDebt(remainingBalance: number): Promise<string> {
    const id = nanoid();
    await db.insert(debts).values({
      id,
      userId: ctx!.userId,
      householdId: ctx!.householdId,
      name: 'Loan',
      creditorName: 'Creditor',
      debtType: 'personal_loan',
      originalAmount: remainingBalance,
      remainingBalance,
      remainingBalanceCents: Math.round(remainingBalance * 100),
      startDate: '2026-01-01',
      status: 'active',
      interestType: 'none',
      interestRate: 0,
    } as typeof debts.$inferInsert);
    return id;
  }

  it('a payment reduces the balance exactly, with no float drift', async () => {
    ctx = await setupTestUserWithHousehold();
    const debtId = await makeDebt(100.0);
    const currentDebt = await loadScopedDebt({
      dbClient: db,
      debtId,
      userId: ctx.userId,
      householdId: ctx.householdId,
    });

    // A payment whose principal ($33.33) is the kind of value that produced
    // 11.2199999-style residue under raw float subtraction.
    await persistLegacyDebtPayment({
      dbClient: db,
      debtId,
      userId: ctx.userId,
      householdId: ctx.householdId,
      paymentAmount: 33.33,
      paymentDate: '2026-02-01',
      transactionId: nanoid(),
      notes: 'test',
      currentDebt: currentDebt!,
    });

    const [debt] = await db.select().from(debts).where(eq(debts.id, debtId));
    expect(debt.remainingBalanceCents).toBe(6667); // 10000 - 3333
    // Float column is derived exactly from cents — no drift.
    expect(debt.remainingBalance).toBe(66.67);
    expect(debt.status).toBe('active');
  });

  it('paying the exact balance flips status to paid_off (exact-zero check)', async () => {
    ctx = await setupTestUserWithHousehold();
    const debtId = await makeDebt(50.0);
    const currentDebt = await loadScopedDebt({
      dbClient: db,
      debtId,
      userId: ctx.userId,
      householdId: ctx.householdId,
    });

    await persistLegacyDebtPayment({
      dbClient: db,
      debtId,
      userId: ctx.userId,
      householdId: ctx.householdId,
      paymentAmount: 50.0,
      paymentDate: '2026-02-01',
      transactionId: nanoid(),
      notes: 'payoff',
      currentDebt: currentDebt!,
    });

    const [debt] = await db.select().from(debts).where(eq(debts.id, debtId));
    expect(debt.remainingBalanceCents).toBe(0);
    expect(debt.status).toBe('paid_off');
  });
});
