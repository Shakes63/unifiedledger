import { nanoid } from 'nanoid';

import { db } from '@/lib/db';
import { ruleExecutionLog } from '@/lib/db/schema';

export async function logCreateRuleExecution({
  userId,
  householdId,
  transactionId,
  appliedRuleId,
  appliedCategoryId,
  appliedActions,
}: {
  userId: string;
  householdId: string;
  transactionId: string;
  appliedRuleId?: string | null;
  appliedCategoryId?: string | null;
  appliedActions: unknown[];
}): Promise<void> {
  if (!appliedRuleId) {
    return;
  }

  await db.insert(ruleExecutionLog).values({
    id: nanoid(),
    userId,
    householdId,
    ruleId: appliedRuleId,
    transactionId,
    appliedCategoryId: appliedCategoryId || null,
    appliedActions: appliedActions.length > 0 ? JSON.stringify(appliedActions) : null,
    matched: true,
    executedAt: new Date().toISOString(),
  });
}
