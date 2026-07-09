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

  if (type !== 'expense') {
    return { linkedDebtId };
  }

  // Apply the payment to AT MOST ONE debt (H-TXN-5). An explicit directDebtId
  // wins; otherwise fall back to category auto-matching. The two used to be
  // independent `if`s, so an expense that both named a debt and matched a debt
  // category applied the payment twice.
  try {
    if (directDebtId) {
      linkedDebtId = directDebtId;
      await applyLegacyDebtPayment({
        debtId: directDebtId,
        userId,
        householdId,
        paymentAmount: amount,
        paymentDate: date,
        transactionId,
        notes: `Direct payment: ${description}`,
      });
      return { linkedDebtId };
    }

    if (appliedCategoryId && !linkedBillId) {
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
    console.error('Error auto-linking debt payment:', error);
  }

  return { linkedDebtId };
}
