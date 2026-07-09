import { and, eq } from 'drizzle-orm';
import type Decimal from 'decimal.js';

import { accounts, transactions, transfers } from '@/lib/db/schema';
import { fromMoneyCents, toMoneyCents } from '@/lib/utils/money-cents';
import { db } from '@/lib/db';
import {
  buildAccountBalanceFields,
  buildTransactionAmountFields,
  buildTransferMoneyFields,
  centsToAmount as convertCentsToAmount,
  computeBalanceDeltaCents,
  isLiabilityAccountType,
  type MovementTransactionType,
} from '@/lib/transactions/money-movement-fields';
export {
  buildAccountBalanceFields,
  buildTransactionAmountFields,
  buildTransferMoneyFields,
  computeBalanceDeltaCents,
  isLiabilityAccountType,
};
export type { MovementTransactionType };

type MoneyTx = typeof db;

// Inlined from the former money-cents-resolver shim (post-audit cleanup).
function requireCents(value: number | null, label: string): number {
  if (value === null) {
    throw new Error(`${label} is required`);
  }
  return value;
}

function resolveRequiredMoneyCents({
  centsValue,
  label,
}: {
  centsValue: number | string | bigint | null;
  label: string;
}): number {
  const parsedCentsValue = fromMoneyCents(centsValue);
  if (parsedCentsValue !== null) {
    return requireCents(toMoneyCents(parsedCentsValue), label);
  }
  throw new Error(`${label} cents is required`);
}

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
}): number {
  return resolveRequiredMoneyCents({
    centsValue: account.currentBalanceCents,
    label: 'Account balance',
  });
}

export function getTransactionAmountCents(transaction: {
  amountCents: number | string | bigint | null;
}): number {
  return resolveRequiredMoneyCents({
    centsValue: transaction.amountCents,
    label: 'Transaction amount',
  });
}

export function getTransferAmountCents(transfer: {
  amountCents: number | string | bigint | null;
}): number {
  return resolveRequiredMoneyCents({
    centsValue: transfer.amountCents,
    label: 'Transfer amount',
  });
}

export function getTransferFeesCents(transfer: {
  feesCents: number | string | bigint | null;
}): number {
  return resolveRequiredMoneyCents({
    centsValue: transfer.feesCents,
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

/**
 * Apply a signed delta (in cents) to an account balance — the single primitive
 * every money-movement flow should use (RC-2).
 *
 * Reads the current balance INSIDE the supplied transaction and writes
 * `current + delta` as an absolute value via buildAccountBalanceFields (which
 * keeps the legacy float column exactly `cents / 100`, so it never drifts and the
 * money-cents guard trigger stays satisfied). Because runInDatabaseTransaction now
 * serializes SQLite transactions, this read-modify-write cannot lose a concurrent
 * update, and — unlike the previous per-call absolute writes — accumulating
 * per-account deltas through this helper makes same-account reversals correct
 * (audit findings C-TXN-1, C-ATOM-2).
 *
 * Returns the new balance in cents, or null when the (scoped) account is not found.
 */
export async function applyAccountBalanceDelta(
  tx: MoneyTx,
  {
    accountId,
    deltaCents,
    userId,
    householdId,
    updatedAt,
  }: {
    accountId: string;
    deltaCents: number;
    userId?: string;
    householdId?: string;
    updatedAt?: string;
  }
): Promise<number | null> {
  const scope = and(
    eq(accounts.id, accountId),
    ...(userId ? [eq(accounts.userId, userId)] : []),
    ...(householdId ? [eq(accounts.householdId, householdId)] : [])
  );

  const rows = await tx
    .select({ currentBalanceCents: accounts.currentBalanceCents })
    .from(accounts)
    .where(scope)
    .limit(1);

  if (rows.length === 0) {
    return null;
  }

  const currentCents = getAccountBalanceCents(rows[0]);
  const newCents = currentCents + deltaCents;

  await tx
    .update(accounts)
    .set({
      ...buildAccountBalanceFields(newCents),
      ...(updatedAt !== undefined ? { updatedAt } : {}),
    })
    .where(scope);

  return newCents;
}

/**
 * Apply several per-account deltas, coalescing repeated account ids so each
 * account is read and written exactly once. Use this whenever a single logical
 * operation touches the same account more than once (e.g. editing a
 * same-account transaction, or a transfer whose legs share an account) — writing
 * each effect as a separate absolute value would clobber the earlier write.
 */
export async function applyAccountBalanceDeltas(
  tx: MoneyTx,
  deltas: Array<{ accountId: string; deltaCents: number }>,
  scope?: { userId?: string; householdId?: string; updatedAt?: string }
): Promise<void> {
  const merged = new Map<string, number>();
  for (const { accountId, deltaCents } of deltas) {
    merged.set(accountId, (merged.get(accountId) ?? 0) + deltaCents);
  }

  for (const [accountId, deltaCents] of merged) {
    await applyAccountBalanceDelta(tx, {
      accountId,
      deltaCents,
      userId: scope?.userId,
      householdId: scope?.householdId,
      updatedAt: scope?.updatedAt,
    });
  }
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
