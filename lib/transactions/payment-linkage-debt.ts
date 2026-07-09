import { and, eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';

import { db } from '@/lib/db';
import { debtPayments, debts } from '@/lib/db/schema';
import { batchUpdateMilestones } from '@/lib/debts/milestone-utils';
import { calculatePaymentBreakdown } from '@/lib/debts/payment-calculator';
import {
  buildDebtBalanceFields,
  buildDebtPaymentAmountFields,
  getDebtRemainingCents,
} from '@/lib/debts/debt-money';
import { fromMoneyCents, toMoneyCents } from '@/lib/utils/money-cents';

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

  // Work in integer cents so the balance can't accumulate float drift and the
  // paid-off check is exact (H-DBG-10). The breakdown is computed in dollars but
  // only its cents value touches the stored balance.
  const currentCents = getDebtRemainingCents(currentDebt);
  const principalCents = toMoneyCents(breakdown.principalAmount) ?? 0;
  const interestCents = toMoneyCents(breakdown.interestAmount) ?? 0;
  const amountCents = toMoneyCents(paymentAmount) ?? 0;
  const newCents = Math.max(0, currentCents - principalCents);
  const nowIso = new Date().toISOString();

  await Promise.all([
    dbClient.insert(debtPayments).values({
      id: nanoid(),
      debtId,
      userId,
      householdId,
      ...buildDebtPaymentAmountFields({ amountCents, principalCents, interestCents }),
      paymentDate,
      transactionId,
      notes,
      createdAt: nowIso,
    }),
    dbClient
      .update(debts)
      .set({
        ...buildDebtBalanceFields(newCents),
        status: newCents === 0 ? 'paid_off' : 'active',
        updatedAt: nowIso,
      })
      .where(
        and(eq(debts.id, debtId), eq(debts.userId, userId), eq(debts.householdId, householdId))
      ),
    batchUpdateMilestones(debtId, fromMoneyCents(newCents) ?? 0),
  ]);
}
