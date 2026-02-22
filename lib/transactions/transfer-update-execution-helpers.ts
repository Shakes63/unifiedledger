import { transactions } from '@/lib/db/schema';

export function collectAffectedTransferAccountIds({
  currentSourceAccountId,
  currentDestinationAccountId,
  nextSourceAccountId,
  nextDestinationAccountId,
}: {
  currentSourceAccountId: string;
  currentDestinationAccountId: string;
  nextSourceAccountId: string;
  nextDestinationAccountId: string;
}): string[] {
  return Array.from(
    new Set([
      currentSourceAccountId,
      currentDestinationAccountId,
      nextSourceAccountId,
      nextDestinationAccountId,
    ])
  );
}

export function buildTransferUpdateResult({
  transferGroupId,
  transferOut,
  transferIn,
  nextSourceAccountId,
  nextDestinationAccountId,
}: {
  transferGroupId: string;
  transferOut: typeof transactions.$inferSelect;
  transferIn: typeof transactions.$inferSelect;
  nextSourceAccountId: string;
  nextDestinationAccountId: string;
}) {
  return {
    transferGroupId,
    transferOutId: transferOut.id,
    transferInId: transferIn.id,
    sourceAccountId: nextSourceAccountId,
    destinationAccountId: nextDestinationAccountId,
  };
}
