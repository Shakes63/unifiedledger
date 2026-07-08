import type { transactions } from '@/lib/db/schema';
import { computeBalanceDeltaCents } from '@/lib/transactions/money-movement-service';

export function buildTransferUpdateContext({
  transferOut,
  transferIn,
  sourceAccountId,
  destinationAccountId,
  amountCents,
  currentTransferAmountCents,
  currentFeesCents,
}: {
  transferOut: typeof transactions.$inferSelect;
  transferIn: typeof transactions.$inferSelect;
  sourceAccountId?: string;
  destinationAccountId?: string;
  amountCents?: number;
  currentTransferAmountCents: number;
  currentFeesCents: number;
}) {
  const nextTransferAmountCents = amountCents ?? currentTransferAmountCents;
  const nextFeesCents = currentFeesCents;
  const currentTransferOutAmountCents = currentTransferAmountCents + currentFeesCents;
  const nextTransferOutAmountCents = nextTransferAmountCents + nextFeesCents;

  const currentSourceAccountId =
    transferOut.transferSourceAccountId ||
    transferOut.accountId ||
    transferIn.transferSourceAccountId ||
    transferOut.accountId;
  const currentDestinationAccountId =
    transferOut.transferDestinationAccountId ||
    transferIn.accountId ||
    transferIn.transferDestinationAccountId ||
    transferIn.accountId;

  const nextSourceAccountId = sourceAccountId ?? currentSourceAccountId;
  const nextDestinationAccountId = destinationAccountId ?? currentDestinationAccountId;

  return {
    nextTransferAmountCents,
    nextFeesCents,
    currentTransferOutAmountCents,
    nextTransferOutAmountCents,
    currentSourceAccountId,
    currentDestinationAccountId,
    nextSourceAccountId,
    nextDestinationAccountId,
  };
}

export function buildAccountBalanceDeltaById({
  currentSourceAccountId,
  currentDestinationAccountId,
  nextSourceAccountId,
  nextDestinationAccountId,
  currentTransferOutAmountCents,
  currentTransferAmountCents,
  nextTransferOutAmountCents,
  nextTransferAmountCents,
  typeByAccountId,
}: {
  currentSourceAccountId: string;
  currentDestinationAccountId: string;
  nextSourceAccountId: string;
  nextDestinationAccountId: string;
  currentTransferOutAmountCents: number;
  currentTransferAmountCents: number;
  nextTransferOutAmountCents: number;
  nextTransferAmountCents: number;
  /** Account id -> account type, so deltas are liability-aware (C-MATH-1). */
  typeByAccountId?: Map<string, string | null | undefined>;
}): Map<string, number> {
  const deltaByAccountId = new Map<string, number>();
  const addDelta = (accountId: string, delta: number) => {
    const currentDelta = deltaByAccountId.get(accountId) ?? 0;
    deltaByAccountId.set(accountId, currentDelta + delta);
  };
  const accountType = (accountId: string) => typeByAccountId?.get(accountId);

  // Reverse the OLD legs, then apply the NEW legs — each liability-aware. For an
  // asset account these reduce to +out / -in (reverse) and -out / +in (apply),
  // matching the previous behavior; for a credit account the signs flip so a
  // credit-card payment transfer reverses/applies correctly.
  addDelta(
    currentSourceAccountId,
    -computeBalanceDeltaCents({
      accountType: accountType(currentSourceAccountId),
      transactionType: 'transfer_out',
      amountCents: currentTransferOutAmountCents,
    })
  );
  addDelta(
    currentDestinationAccountId,
    -computeBalanceDeltaCents({
      accountType: accountType(currentDestinationAccountId),
      transactionType: 'transfer_in',
      amountCents: currentTransferAmountCents,
    })
  );
  addDelta(
    nextSourceAccountId,
    computeBalanceDeltaCents({
      accountType: accountType(nextSourceAccountId),
      transactionType: 'transfer_out',
      amountCents: nextTransferOutAmountCents,
    })
  );
  addDelta(
    nextDestinationAccountId,
    computeBalanceDeltaCents({
      accountType: accountType(nextDestinationAccountId),
      transactionType: 'transfer_in',
      amountCents: nextTransferAmountCents,
    })
  );

  return deltaByAccountId;
}
