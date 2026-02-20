import { and, eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';

import { processBillPayment } from '@/lib/bills/bill-payment-utils';
import { db } from '@/lib/db';
import { debts, debtPayments, transactions } from '@/lib/db/schema';
import { batchUpdateMilestones } from '@/lib/debts/milestone-utils';
import { calculatePaymentBreakdown } from '@/lib/debts/payment-calculator';

type DbClient = Pick<typeof db, 'select' | 'insert' | 'update'>;

interface ApplyLegacyDebtPaymentParams {
  debtId: string;
  userId: string;
  householdId: string;
  paymentAmount: number;
  paymentDate: string;
  transactionId: string;
  notes: string;
  dbClient?: DbClient;
}

export async function applyLegacyDebtPayment({
  debtId,
  userId,
  householdId,
  paymentAmount,
  paymentDate,
  transactionId,
  notes,
  dbClient = db,
}: ApplyLegacyDebtPaymentParams): Promise<boolean> {
  const [currentDebt] = await dbClient
    .select()
    .from(debts)
    .where(
      and(
        eq(debts.id, debtId),
        eq(debts.userId, userId),
        eq(debts.householdId, householdId)
      )
    )
    .limit(1);

  if (!currentDebt) {
    return false;
  }

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
        and(
          eq(debts.id, debtId),
          eq(debts.userId, userId),
          eq(debts.householdId, householdId)
        )
      ),
    batchUpdateMilestones(debtId, newBalance),
  ]);

  return true;
}

interface ProcessAndLinkBillPaymentParams {
  billId: string;
  billName: string;
  instanceId: string;
  transactionId: string;
  paymentAmount: number;
  paymentDate: string;
  userId: string;
  householdId: string;
  linkedAccountId: string;
  paymentMethod: 'manual' | 'transfer' | 'autopay';
  notes: string;
  legacyDebtId?: string | null;
  dbClient?: DbClient;
}

export async function processAndLinkBillPayment({
  billId,
  billName,
  instanceId,
  transactionId,
  paymentAmount,
  paymentDate,
  userId,
  householdId,
  linkedAccountId,
  paymentMethod,
  notes,
  legacyDebtId,
  dbClient = db,
}: ProcessAndLinkBillPaymentParams) {
  const paymentResult = await processBillPayment({
    billId,
    instanceId,
    transactionId,
    paymentAmount,
    paymentDate,
    userId,
    householdId,
    paymentMethod,
    linkedAccountId,
    notes,
  });

  if (!paymentResult.success) {
    return {
      success: false,
      paymentResult,
    };
  }

  await dbClient
    .update(transactions)
    .set({
      billId,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(transactions.id, transactionId));

  if (legacyDebtId) {
    await applyLegacyDebtPayment({
      debtId: legacyDebtId,
      userId,
      householdId,
      paymentAmount,
      paymentDate,
      transactionId,
      notes: `Automatic payment from bill: ${billName}`,
      dbClient,
    });
  }

  return {
    success: true,
    paymentResult,
  };
}
