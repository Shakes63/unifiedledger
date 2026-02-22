import { accounts } from '@/lib/db/schema';
import { runInDatabaseTransaction } from '@/lib/db/transaction-runner';
import {
  getAccountBalanceCents,
  insertTransactionMovement,
  updateScopedAccountBalance,
} from '@/lib/transactions/money-movement-service';

export async function executeRepeatTransactionWrite({
  transactionId,
  userId,
  householdId,
  account,
  accountId,
  categoryId,
  date,
  amountCents,
  description,
  merchantId,
  notes,
  type,
  isTaxDeductible,
  isSalesTaxable,
}: {
  transactionId: string;
  userId: string;
  householdId: string;
  account: typeof accounts.$inferSelect;
  accountId: string;
  categoryId: string | null;
  date: string;
  amountCents: number;
  description: string;
  merchantId: string | null;
  notes: string | null;
  type: string;
  isTaxDeductible: boolean;
  isSalesTaxable: boolean;
}): Promise<void> {
  await runInDatabaseTransaction(async (tx) => {
    const nowIso = new Date().toISOString();
    await insertTransactionMovement(tx, {
      id: transactionId,
      userId,
      householdId,
      accountId,
      categoryId,
      date,
      amountCents,
      description,
      merchantId,
      notes,
      type,
      isPending: false,
      isTaxDeductible,
      isSalesTaxable,
      createdAt: nowIso,
      updatedAt: nowIso,
    });

    const currentBalanceCents = getAccountBalanceCents(account);
    const updatedBalanceCents =
      type === 'expense' || type === 'transfer_out'
        ? currentBalanceCents - amountCents
        : currentBalanceCents + amountCents;

    await updateScopedAccountBalance(tx, {
      accountId,
      userId,
      householdId,
      balanceCents: updatedBalanceCents,
      lastUsedAt: nowIso,
      usageCount: (account.usageCount || 0) + 1,
    });
  });
}
