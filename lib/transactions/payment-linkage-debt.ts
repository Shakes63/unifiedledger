import { and, eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';

import { db } from '@/lib/db';
import { debtPayments, debts } from '@/lib/db/schema';
import { batchUpdateMilestones } from '@/lib/debts/milestone-utils';
import { calculatePaymentBreakdown } from '@/lib/debts/payment-calculator';

export type PaymentLinkageDbClient = Pick<typeof db, 'select' | 'insert' | 'update'>;

export async function loadScopedDebt({
  dbClient,
  debtId,
  userId,
  householdId,
}: {
  dbClient: PaymentLinkageDbClient;
  debtId: string;
  userId: string;
  householdId: string;
}): Promise<typeof debts.$inferSelect | null> {
  const [currentDebt] = await dbClient
    .select()
    .from(debts)
    .where(
      and(eq(debts.id, debtId), eq(debts.userId, userId), eq(debts.householdId, householdId))
    )
    .limit(1);

  return currentDebt ?? null;
}

export async function persistLegacyDebtPayment({
  dbClient,
  debtId,
  userId,
  householdId,
  paymentAmount,
  paymentDate,
  transactionId,
  notes,
  currentDebt,
}: {
  dbClient: PaymentLinkageDbClient;
  debtId: string;
  userId: string;
  householdId: string;
  paymentAmount: number;
  paymentDate: string;
  transactionId: string;
  notes: string;
  currentDebt: typeof debts.$inferSelect;
}): Promise<void> {
  const breakdown = calculatePaymentBreakdown(
    paymentAmount,
    currentDebt.remainingBalance,
    currentDebt.interestRate || 0,
    currentDebt.interestType || 'none',
    currentDebt.loanType || 'revolving',
    currentDebt.compoundingFrequency || 'monthly',
    currentDebt.billingCycleDays || 30
  );

  const newBalance = Math.max(0, currentDebt.remainingBalance - breakdown.principalAmount);
  const nowIso = new Date().toISOString();

  await Promise.all([
    dbClient.insert(debtPayments).values({
      id: nanoid(),
      debtId,
      userId,
      householdId,
      amount: paymentAmount,
      principalAmount: breakdown.principalAmount,
      interestAmount: breakdown.interestAmount,
      paymentDate,
      transactionId,
      notes,
      createdAt: nowIso,
    }),
    dbClient
      .update(debts)
      .set({
        remainingBalance: newBalance,
        status: newBalance === 0 ? 'paid_off' : 'active',
        updatedAt: nowIso,
      })
      .where(
        and(eq(debts.id, debtId), eq(debts.userId, userId), eq(debts.householdId, householdId))
      ),
    batchUpdateMilestones(debtId, newBalance),
  ]);
}
