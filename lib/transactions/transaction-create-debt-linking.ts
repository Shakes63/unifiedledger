import { and, eq } from 'drizzle-orm';

import { db } from '@/lib/db';
import { debts, transactions } from '@/lib/db/schema';
import { applyLegacyDebtPayment } from '@/lib/transactions/payment-linkage';

interface LinkTransactionDebtParams {
  transactionId: string;
  userId: string;
  householdId: string;
  type: string;
  linkedBillId: string | null;
  appliedCategoryId: string | null;
  directDebtId?: string | null;
  amount: number;
  date: string;
  description: string;
}

export async function linkTransactionDebt({
  transactionId,
  userId,
  householdId,
  type,
  linkedBillId,
  appliedCategoryId,
  directDebtId,
  amount,
  date,
  description,
}: LinkTransactionDebtParams): Promise<{ linkedDebtId: string | null }> {
  let linkedDebtId: string | null = null;

  try {
    if (type === 'expense' && appliedCategoryId && !linkedBillId) {
      const matchingDebts = await db
        .select()
        .from(debts)
        .where(
          and(
            eq(debts.userId, userId),
            eq(debts.householdId, householdId),
            eq(debts.status, 'active'),
            eq(debts.categoryId, appliedCategoryId)
          )
        )
        .limit(1);

      if (matchingDebts.length > 0) {
        const debt = matchingDebts[0];
        linkedDebtId = debt.id;

        await db
          .update(transactions)
          .set({
            debtId: linkedDebtId,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(transactions.id, transactionId));

        await applyLegacyDebtPayment({
          debtId: linkedDebtId,
          userId,
          householdId,
          paymentAmount: amount,
          paymentDate: date,
          transactionId,
          notes: `Automatic payment via category: ${debt.name}`,
        });
      }
    }
  } catch (error) {
    console.error('Error auto-linking debt by category:', error);
  }

  if (type === 'expense' && directDebtId) {
    try {
      await applyLegacyDebtPayment({
        debtId: directDebtId,
        userId,
        householdId,
        paymentAmount: amount,
        paymentDate: date,
        transactionId,
        notes: `Direct payment: ${description}`,
      });
    } catch (error) {
      console.error('Error updating direct debt payment:', error);
    }
  }

  return { linkedDebtId };
}
