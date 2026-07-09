/**
 * C-DB-2: the money-link foreign keys (migration 0018) are enforced at the DB
 * level. Deleting a parent must CASCADE-delete meaningless children and SET NULL
 * dangling references, and creating a child for a non-existent parent must be
 * rejected outright — no longer relying solely on the reversal layer / cleanup.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '@/lib/db';
import { debtPayments, debts, transactions } from '@/lib/db/schema';
import {
  setupTestUserWithHousehold,
  cleanupTestHousehold,
  createTestTransaction,
} from './test-utils';

describe('money-link foreign keys (C-DB-2)', () => {
  let ctx: { userId: string; householdId: string } | null = null;

  afterEach(async () => {
    if (ctx) {
      await db.delete(debtPayments).where(eq(debtPayments.householdId, ctx.householdId));
      await db.delete(debts).where(eq(debts.householdId, ctx.householdId));
      await db.delete(transactions).where(eq(transactions.householdId, ctx.householdId));
      await cleanupTestHousehold(ctx.userId, ctx.householdId);
      ctx = null;
    }
  });

  async function makeDebt(): Promise<string> {
    const id = nanoid();
    await db.insert(debts).values({
      id,
      userId: ctx!.userId,
      householdId: ctx!.householdId,
      name: 'Loan',
      creditorName: 'Creditor',
      debtType: 'personal_loan',
      originalAmount: 500,
      remainingBalance: 300,
      remainingBalanceCents: 30000,
      startDate: '2026-01-01',
      status: 'active',
    } as typeof debts.$inferInsert);
    return id;
  }

  async function makeTransaction(): Promise<string> {
    const tx = createTestTransaction(ctx!.userId, ctx!.householdId, 'acct-x', {
      type: 'expense',
      amount: 1,
    });
    await db.insert(transactions).values(tx as typeof transactions.$inferInsert);
    return tx.id;
  }

  it('rejects a debt payment whose parent debt does not exist', async () => {
    ctx = await setupTestUserWithHousehold();
    await expect(
      db.insert(debtPayments).values({
        id: nanoid(),
        debtId: 'does-not-exist',
        userId: ctx.userId,
        householdId: ctx.householdId,
        amount: 10,
        amountCents: 1000,
        principalCents: 1000,
        interestCents: 0,
        paymentDate: '2026-02-01',
      } as typeof debtPayments.$inferInsert)
    ).rejects.toThrow(/FOREIGN KEY/i);
  });

  it('CASCADE deletes debt payments when the debt is deleted', async () => {
    ctx = await setupTestUserWithHousehold();
    const debtId = await makeDebt();
    const paymentId = nanoid();
    await db.insert(debtPayments).values({
      id: paymentId,
      debtId,
      userId: ctx.userId,
      householdId: ctx.householdId,
      amount: 10,
      amountCents: 1000,
      principalCents: 1000,
      interestCents: 0,
      paymentDate: '2026-02-01',
    } as typeof debtPayments.$inferInsert);

    await db.delete(debts).where(eq(debts.id, debtId));

    const remaining = await db
      .select()
      .from(debtPayments)
      .where(eq(debtPayments.id, paymentId));
    expect(remaining).toHaveLength(0);
  });

  it('SET NULL clears a debt payment transaction link when the transaction is deleted', async () => {
    ctx = await setupTestUserWithHousehold();
    const debtId = await makeDebt();
    const txId = await makeTransaction();
    const paymentId = nanoid();
    await db.insert(debtPayments).values({
      id: paymentId,
      debtId,
      userId: ctx.userId,
      householdId: ctx.householdId,
      amount: 10,
      amountCents: 1000,
      principalCents: 1000,
      interestCents: 0,
      paymentDate: '2026-02-01',
      transactionId: txId,
    } as typeof debtPayments.$inferInsert);

    await db.delete(transactions).where(eq(transactions.id, txId));

    const [payment] = await db
      .select()
      .from(debtPayments)
      .where(eq(debtPayments.id, paymentId));
    // The payment survives (it is still a real payment); only the link is cleared.
    expect(payment).toBeTruthy();
    expect(payment.transactionId).toBeNull();
  });
});
