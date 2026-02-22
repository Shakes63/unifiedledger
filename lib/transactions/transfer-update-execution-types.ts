import { db } from '@/lib/db';
import { transactions, transfers } from '@/lib/db/schema';

export type TransferUpdateDbClient = typeof db;

export interface ExecuteTransferPairUpdateParams {
  userId: string;
  householdId: string;
  transferOut: typeof transactions.$inferSelect;
  transferIn: typeof transactions.$inferSelect;
  transferGroupId: string;
  transferRecord: Array<typeof transfers.$inferSelect>;
  currentTransferAmountCents: number;
  currentFeesCents: number;
  amountCents?: number;
  date?: string;
  description?: string;
  notes?: string | null;
  isPending?: boolean;
  sourceAccountId?: string;
  destinationAccountId?: string;
}
