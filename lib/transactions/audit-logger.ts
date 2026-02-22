import { db } from '@/lib/db';
import { transactionAuditLog } from '@/lib/db/schema';
import { nanoid } from 'nanoid';

// Import type from client-safe utilities
import type { TransactionChange } from './audit-utils';
import { detectChanges } from './audit-logger-change-detection';
import { createTransactionSnapshot } from './audit-logger-snapshot';
import type { DisplayNames } from './audit-logger-types';

// Re-export client-safe utilities for convenience (server-side usage)
export {
  FIELD_LABELS,
  formatTransactionType,
  formatBoolean,
  formatAmount,
  type TransactionChange,
} from './audit-utils';
export { detectChanges, createTransactionSnapshot };
export type { DisplayNames };

/**
 * Parameters for logging a transaction audit entry
 */
interface AuditLogParams {
  transactionId: string;
  userId: string;
  householdId: string;
  userName?: string;
  actionType: 'created' | 'updated' | 'deleted';
  changes?: TransactionChange[];
  snapshot?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Logs a transaction audit entry to the database
 * 
 * This is a fire-and-forget operation - errors are logged but won't
 * break the main transaction operation
 */
export async function logTransactionAudit(params: AuditLogParams): Promise<void> {
  try {
    await db.insert(transactionAuditLog).values({
      id: nanoid(),
      transactionId: params.transactionId,
      userId: params.userId,
      householdId: params.householdId,
      userName: params.userName ?? null,
      actionType: params.actionType,
      changes: params.changes ? JSON.stringify(params.changes) : null,
      snapshot: params.snapshot ? JSON.stringify(params.snapshot) : null,
      ipAddress: params.ipAddress ?? null,
      userAgent: params.userAgent ?? null,
      createdAt: new Date().toISOString(),
    });
  } catch (error) {
    // Non-fatal: don't break main operation
    console.error('Failed to log transaction audit:', error);
  }
}

