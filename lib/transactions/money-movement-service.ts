import Decimal from 'decimal.js';
import { and, eq } from 'drizzle-orm';

import { accounts, transactions, transfers } from '@/lib/db/schema';
import { toMoneyCents, fromMoneyCents } from '@/lib/utils/money-cents';
import { db } from '@/lib/db';

type MoneyTx = typeof db;

function requireCents(value: number | null, label: string): number {
  if (value === null) {
    throw new Error(`${label} is required`);
  }
  return value;
}

export function centsToAmount(cents: number): number {
  return new Decimal(cents).dividedBy(100).toNumber();
}

export function amountToCents(amount: number | string | Decimal): number {
  return requireCents(toMoneyCents(amount), 'Amount');
}

export function getAccountBalanceCents(account: {
  currentBalanceCents: number | string | bigint | null;
  currentBalance?: number | string | Decimal | null;
}): number {
  const centsValue = fromMoneyCents(account.currentBalanceCents);
  if (centsValue !== null) {
    return requireCents(toMoneyCents(centsValue), 'Account balance');
  }
  const fallback = toMoneyCents(account.currentBalance);
  if (fallback === null) {
    throw new Error('Account balance cents is required');
  }
  return fallback;
}

export function getTransactionAmountCents(transaction: {
  amountCents: number | string | bigint | null;
  amount?: number | string | Decimal | null;
}): number {
  const centsValue = fromMoneyCents(transaction.amountCents);
  if (centsValue !== null) {
    return requireCents(toMoneyCents(centsValue), 'Transaction amount');
  }
  const fallback = toMoneyCents(transaction.amount);
  if (fallback === null) {
    throw new Error('Transaction amount cents is required');
  }
  return fallback;
}

export function getTransferAmountCents(transfer: {
  amountCents: number | string | bigint | null;
  amount?: number | string | Decimal | null;
}): number {
  const centsValue = fromMoneyCents(transfer.amountCents);
  if (centsValue !== null) {
    return requireCents(toMoneyCents(centsValue), 'Transfer amount');
  }
  const fallback = toMoneyCents(transfer.amount);
  if (fallback === null) {
    throw new Error('Transfer amount cents is required');
  }
  return fallback;
}

export function getTransferFeesCents(transfer: {
  feesCents: number | string | bigint | null;
  fees?: number | string | Decimal | null;
}): number {
  const centsValue = fromMoneyCents(transfer.feesCents);
  if (centsValue !== null) {
    return requireCents(toMoneyCents(centsValue), 'Transfer fees');
  }
  const fallback = toMoneyCents(transfer.fees);
  if (fallback === null) {
    throw new Error('Transfer fees cents is required');
  }
  return fallback;
}

export function buildAccountBalanceFields(balanceCents: number) {
  return {
    currentBalance: centsToAmount(balanceCents),
    currentBalanceCents: balanceCents,
  };
}

export function buildTransactionAmountFields(amountCents: number) {
  return {
    amount: centsToAmount(amountCents),
    amountCents,
  };
}

export function buildTransferMoneyFields(amountCents: number, feesCents: number) {
  return {
    amount: centsToAmount(amountCents),
    amountCents,
    fees: centsToAmount(feesCents),
    feesCents,
  };
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
