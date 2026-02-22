import type { transactions } from '@/lib/db/schema';

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
}: {
  currentSourceAccountId: string;
  currentDestinationAccountId: string;
  nextSourceAccountId: string;
  nextDestinationAccountId: string;
  currentTransferOutAmountCents: number;
  currentTransferAmountCents: number;
  nextTransferOutAmountCents: number;
  nextTransferAmountCents: number;
}): Map<string, number> {
  const deltaByAccountId = new Map<string, number>();
  const addDelta = (accountId: string, delta: number) => {
    const currentDelta = deltaByAccountId.get(accountId) ?? 0;
    deltaByAccountId.set(accountId, currentDelta + delta);
  };

  addDelta(currentSourceAccountId, currentTransferOutAmountCents);
  addDelta(currentDestinationAccountId, -currentTransferAmountCents);
  addDelta(nextSourceAccountId, -nextTransferOutAmountCents);
  addDelta(nextDestinationAccountId, nextTransferAmountCents);

  return deltaByAccountId;
}
