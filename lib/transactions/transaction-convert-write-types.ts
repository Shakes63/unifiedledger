import { db } from '@/lib/db';
import { accounts, transactions } from '@/lib/db/schema';

export type MoneyTx = typeof db;

export interface ConvertWriteBaseParams {
  tx: MoneyTx;
  id: string;
  userId: string;
  householdId: string;
  targetAccountId: string;
  transaction: typeof transactions.$inferSelect;
  sourceAccount: typeof accounts.$inferSelect;
  targetAccount: typeof accounts.$inferSelect;
  amountCents: number;
  transferGroupId: string;
  pairedTransactionId: string;
  nowIso: string;
}
