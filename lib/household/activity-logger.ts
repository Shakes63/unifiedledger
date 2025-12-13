import { db } from '@/lib/db';
import { householdActivityLog } from '@/lib/db/schema';
import { nanoid } from 'nanoid';

export type ActivityType =
  | 'transaction_created'
  | 'transaction_updated'
  | 'transaction_deleted'
  | 'bill_created'
  | 'bill_updated'
  | 'bill_deleted'
  | 'bill_paid'
  | 'goal_created'
  | 'goal_updated'
  | 'goal_deleted'
  | 'goal_completed'
  | 'debt_created'
  | 'debt_updated'
  | 'debt_deleted'
  | 'debt_paid'
  | 'debt_payoff_milestone'
  | 'member_added'
  | 'member_removed'
  | 'member_left'
  | 'settings_updated'
  | 'transfer_created'
  | 'transfer_deleted';

export type EntityType = 'transaction' | 'bill' | 'goal' | 'debt' | 'household' | 'transfer';

interface LogActivityParams {
  userId: string;
  userName?: string;
  householdId?: string;
  activityType: ActivityType;
  entityType?: EntityType;
  entityId?: string;
  entityName?: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

export async function logActivity({
  userId,
  userName,
  householdId,
  activityType,
  entityType,
  entityId,
  entityName,
  description,
  metadata,
}: LogActivityParams) {
  try {
    await db.insert(householdActivityLog).values({
      id: nanoid(),
      householdId,
      userId,
      userName,
      activityType,
      entityType,
      entityId,
      entityName,
      description,
      metadata: metadata ? JSON.stringify(metadata) : null,
      createdAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error logging activity:', error);
    // Don't throw - activity logging should not break the main operation
  }
}

// Helper functions for common activity types
export async function logTransactionActivity(
  userId: string,
  type: 'transaction_created' | 'transaction_updated' | 'transaction_deleted',
  transactionName: string,
  transactionId: string,
  householdId?: string,
  metadata?: Record<string, unknown>
) {
  const descriptions = {
    transaction_created: `Created transaction: ${transactionName}`,
    transaction_updated: `Updated transaction: ${transactionName}`,
    transaction_deleted: `Deleted transaction: ${transactionName}`,
  };

  return logActivity({
    userId,
    householdId,
    activityType: type,
    entityType: 'transaction',
    entityId: transactionId,
    entityName: transactionName,
    description: descriptions[type],
    metadata,
  });
}

export async function logBillActivity(
  userId: string,
  type: 'bill_created' | 'bill_updated' | 'bill_deleted' | 'bill_paid',
  billName: string,
  billId: string,
  householdId?: string,
  metadata?: Record<string, unknown>
) {
  const descriptions = {
    bill_created: `Created bill: ${billName}`,
    bill_updated: `Updated bill: ${billName}`,
    bill_deleted: `Deleted bill: ${billName}`,
    bill_paid: `Paid bill: ${billName}`,
  };

  return logActivity({
    userId,
    householdId,
    activityType: type,
    entityType: 'bill',
    entityId: billId,
    entityName: billName,
    description: descriptions[type],
    metadata,
  });
}

export async function logGoalActivity(
  userId: string,
  type: 'goal_created' | 'goal_updated' | 'goal_deleted' | 'goal_completed',
  goalName: string,
  goalId: string,
  householdId?: string,
  metadata?: Record<string, unknown>
) {
  const descriptions = {
    goal_created: `Created savings goal: ${goalName}`,
    goal_updated: `Updated savings goal: ${goalName}`,
    goal_deleted: `Deleted savings goal: ${goalName}`,
    goal_completed: `Completed savings goal: ${goalName}`,
  };

  return logActivity({
    userId,
    householdId,
    activityType: type,
    entityType: 'goal',
    entityId: goalId,
    entityName: goalName,
    description: descriptions[type],
    metadata,
  });
}

export async function logDebtActivity(
  userId: string,
  type:
    | 'debt_created'
    | 'debt_updated'
    | 'debt_deleted'
    | 'debt_paid'
    | 'debt_payoff_milestone',
  debtName: string,
  debtId: string,
  householdId?: string,
  metadata?: Record<string, unknown>
) {
  const descriptions = {
    debt_created: `Added debt: ${debtName}`,
    debt_updated: `Updated debt: ${debtName}`,
    debt_deleted: `Deleted debt: ${debtName}`,
    debt_paid: `Made payment toward debt: ${debtName}`,
    debt_payoff_milestone: `Reached debt payoff milestone: ${debtName}`,
  };

  return logActivity({
    userId,
    householdId,
    activityType: type,
    entityType: 'debt',
    entityId: debtId,
    entityName: debtName,
    description: descriptions[type],
    metadata,
  });
}

export async function logTransferActivity(
  userId: string,
  type: 'transfer_created' | 'transfer_deleted',
  transferName: string,
  transferId: string,
  householdId?: string,
  metadata?: Record<string, unknown>
) {
  const descriptions = {
    transfer_created: `Transferred funds: ${transferName}`,
    transfer_deleted: `Deleted transfer: ${transferName}`,
  };

  return logActivity({
    userId,
    householdId,
    activityType: type,
    entityType: 'transfer',
    entityId: transferId,
    entityName: transferName,
    description: descriptions[type],
    metadata,
  });
}

export async function logMemberActivity(
  userId: string,
  type: 'member_added' | 'member_removed' | 'member_left',
  memberName: string,
  householdId: string,
  metadata?: Record<string, unknown>
) {
  const descriptions = {
    member_added: `Added household member: ${memberName}`,
    member_removed: `Removed household member: ${memberName}`,
    member_left: `Left the household`,
  };

  return logActivity({
    userId,
    householdId,
    activityType: type,
    entityType: 'household',
    description: descriptions[type],
    metadata,
  });
}
