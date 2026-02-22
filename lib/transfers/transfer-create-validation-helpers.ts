import Decimal from 'decimal.js';
import { and, eq } from 'drizzle-orm';

import { resolveAndRequireEntity } from '@/lib/api/entity-auth';
import { db } from '@/lib/db';
import { accounts } from '@/lib/db/schema';
import { requireAccountEntityAccess } from '@/lib/household/entities';

export class TransferCreateValidationError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = 'TransferCreateValidationError';
  }
}

export function parseTransferMoneyValues({
  amount,
  fees,
}: {
  amount: unknown;
  fees?: unknown;
}): { transferAmount: Decimal; transferFees: Decimal } {
  let transferAmount: Decimal;
  let transferFees: Decimal;
  try {
    transferAmount = new Decimal(amount as Decimal.Value);
    transferFees = new Decimal((fees ?? 0) as Decimal.Value);
  } catch {
    throw new TransferCreateValidationError('Amount and fees must be valid numbers', 400);
  }

  if (!transferAmount.isFinite() || transferAmount.lte(0)) {
    throw new TransferCreateValidationError('Amount must be greater than 0', 400);
  }
  if (!transferFees.isFinite() || transferFees.lt(0)) {
    throw new TransferCreateValidationError('Fees must be 0 or greater', 400);
  }

  return { transferAmount, transferFees };
}

export async function loadAndValidateTransferAccounts({
  userId,
  householdId,
  fromAccountId,
  toAccountId,
  request,
  body,
}: {
  userId: string;
  householdId: string;
  fromAccountId: string;
  toAccountId: string;
  request: Request;
  body: Record<string, unknown>;
}): Promise<{
  fromAccount: typeof accounts.$inferSelect;
  toAccount: typeof accounts.$inferSelect;
}> {
  const [fromAccountRows, toAccountRows] = await Promise.all([
    db
      .select()
      .from(accounts)
      .where(
        and(
          eq(accounts.id, fromAccountId),
          eq(accounts.userId, userId),
          eq(accounts.householdId, householdId)
        )
      )
      .limit(1),
    db
      .select()
      .from(accounts)
      .where(
        and(
          eq(accounts.id, toAccountId),
          eq(accounts.userId, userId),
          eq(accounts.householdId, householdId)
        )
      )
      .limit(1),
  ]);

  const fromAccount = fromAccountRows[0];
  const toAccount = toAccountRows[0];
  if (!fromAccount || !toAccount) {
    throw new TransferCreateValidationError('One or both accounts not found', 404);
  }

  const selectedEntity = await resolveAndRequireEntity(userId, householdId, request, body);
  const fromAccountEntity = await requireAccountEntityAccess(userId, householdId, fromAccount.entityId);
  if (fromAccountEntity.id !== selectedEntity.id) {
    throw new TransferCreateValidationError('Source account must belong to the selected entity', 403);
  }
  await requireAccountEntityAccess(userId, householdId, toAccount.entityId);

  return { fromAccount, toAccount };
}
