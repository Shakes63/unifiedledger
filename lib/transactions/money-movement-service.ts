import { and, eq } from 'drizzle-orm';

import { accounts, transactions, transfers } from '@/lib/db/schema';
import { toMoneyCents } from '@/lib/utils/money-cents';
import { db } from '@/lib/db';
import { resolveRequiredMoneyCents } from '@/lib/transactions/money-cents-resolver';
import {
  buildAccountBalanceFields,
  buildTransactionAmountFields,
  buildTransferMoneyFields,
  centsToAmount as convertCentsToAmount,
} from '@/lib/transactions/money-movement-fields';
export { buildAccountBalanceFields, buildTransactionAmountFields, buildTransferMoneyFields };

type MoneyTx = typeof db;

export function centsToAmount(cents: number): number {
  return convertCentsToAmount(cents);
}

export function amountToCents(amount: number | string | Decimal): number {
  const cents = toMoneyCents(amount);
  if (cents === null) {
    throw new Error('Amount is required');
  }
  return cents;
}

export function getAccountBalanceCents(account: {
  currentBalanceCents: number | string | bigint | null;
  currentBalance?: number | string | Decimal | null;
}): number {
  return resolveRequiredMoneyCents({
    centsValue: account.currentBalanceCents,
    fallbackValue: account.currentBalance,
    label: 'Account balance',
  });
}

export function getTransactionAmountCents(transaction: {
  amountCents: number | string | bigint | null;
  amount?: number | string | Decimal | null;
}): number {
  return resolveRequiredMoneyCents({
    centsValue: transaction.amountCents,
    fallbackValue: transaction.amount,
    label: 'Transaction amount',
  });
}

export function getTransferAmountCents(transfer: {
  amountCents: number | string | bigint | null;
  amount?: number | string | Decimal | null;
}): number {
  return resolveRequiredMoneyCents({
    centsValue: transfer.amountCents,
    fallbackValue: transfer.amount,
    label: 'Transfer amount',
  });
}

export function getTransferFeesCents(transfer: {
  feesCents: number | string | bigint | null;
  fees?: number | string | Decimal | null;
}): number {
  return resolveRequiredMoneyCents({
    centsValue: transfer.feesCents,
    fallbackValue: transfer.fees,
    label: 'Transfer fees',
  });
}

export async function updateScopedAccountBalance(
  tx: MoneyTx,
  {
    accountId,
    userId,
    householdId,
    balanceCents,
    usageCount,
    lastUsedAt,
    updatedAt,
  }: {
    accountId: string;
    userId: string;
    householdId: string;
    balanceCents: number;
    usageCount?: number;
    lastUsedAt?: string;
    updatedAt?: string;
  }
) {
  await tx
    .update(accounts)
    .set({
      ...buildAccountBalanceFields(balanceCents),
      ...(usageCount !== undefined ? { usageCount } : {}),
      ...(lastUsedAt !== undefined ? { lastUsedAt } : {}),
      ...(updatedAt !== undefined ? { updatedAt } : {}),
    })
    .where(
      and(
        eq(accounts.id, accountId),
        eq(accounts.userId, userId),
        eq(accounts.householdId, householdId)
      )
    );
}

export async function insertTransactionMovement(
  tx: MoneyTx,
  values: Omit<typeof transactions.$inferInsert, 'amount' | 'amountCents'> & {
    amountCents: number;
  }
) {
  await tx.insert(transactions).values({
    ...values,
    ...buildTransactionAmountFields(values.amountCents),
  });
}

export async function insertTransferMovement(
  tx: MoneyTx,
  values: Omit<typeof transfers.$inferInsert, 'amount' | 'amountCents' | 'fees' | 'feesCents'> & {
    amountCents: number;
    feesCents?: number;
  }
) {
  const feesCents = values.feesCents ?? 0;
  await tx.insert(transfers).values({
    ...values,
    ...buildTransferMoneyFields(values.amountCents, feesCents),
  });
}
