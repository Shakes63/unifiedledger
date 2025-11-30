import { db } from '@/lib/db';
import { transactionAuditLog } from '@/lib/db/schema';
import { nanoid } from 'nanoid';

// Import type from client-safe utilities
import type { TransactionChange } from './audit-utils';

// Re-export client-safe utilities for convenience (server-side usage)
export {
  FIELD_LABELS,
  formatTransactionType,
  formatBoolean,
  formatAmount,
  type TransactionChange,
} from './audit-utils';

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

/**
 * Fields that are tracked for changes in transactions
 */
const TRACKED_FIELDS = [
  'accountId',
  'categoryId',
  'merchantId',
  'date',
  'amount',
  'description',
  'notes',
  'type',
  'isPending',
  'isTaxDeductible',
  'isSalesTaxable',
  'billId',
  'debtId',
] as const;

/**
 * Display names for foreign key references (account, category, merchant, bill, debt)
 */
export interface DisplayNames {
  accountId?: { old?: string; new?: string };
  categoryId?: { old?: string; new?: string };
  merchantId?: { old?: string; new?: string };
  billId?: { old?: string; new?: string };
  debtId?: { old?: string; new?: string };
}

/**
 * Detects changes between old and new transaction states
 * 
 * @param oldTransaction - The transaction state before changes
 * @param newTransaction - The transaction state after changes
 * @param displayNames - Optional human-readable names for foreign key fields
 * @returns Array of changes detected between the two states
 */
export function detectChanges(
  oldTransaction: Record<string, unknown>,
  newTransaction: Record<string, unknown>,
  displayNames?: DisplayNames
): TransactionChange[] {
  const changes: TransactionChange[] = [];

  for (const field of TRACKED_FIELDS) {
    const oldValue = oldTransaction[field] ?? null;
    const newValue = newTransaction[field] ?? null;

    // Normalize for comparison
    const oldNormalized = normalizeValue(oldValue);
    const newNormalized = normalizeValue(newValue);

    if (oldNormalized !== newNormalized) {
      const change: TransactionChange = {
        field,
        oldValue: oldValue as string | number | boolean | null,
        newValue: newValue as string | number | boolean | null,
      };

      // Add display values for foreign keys
      if (displayNames && field in displayNames) {
        const fieldDisplayNames = displayNames[field as keyof DisplayNames];
        if (fieldDisplayNames) {
          change.oldDisplayValue = fieldDisplayNames.old;
          change.newDisplayValue = fieldDisplayNames.new;
        }
      }

      changes.push(change);
    }
  }

  return changes;
}

/**
 * Normalizes a value for comparison
 */
function normalizeValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return value.toString();
  if (typeof value === 'boolean') return value.toString();
  return String(value);
}

/**
 * Creates a snapshot object from a transaction for audit logging
 */
export function createTransactionSnapshot(
  transaction: Record<string, unknown>,
  enrichedData?: {
    accountName?: string;
    categoryName?: string;
    merchantName?: string;
    billName?: string;
    debtName?: string;
  }
): Record<string, unknown> {
  return {
    id: transaction.id,
    accountId: transaction.accountId,
    accountName: enrichedData?.accountName,
    categoryId: transaction.categoryId,
    categoryName: enrichedData?.categoryName,
    merchantId: transaction.merchantId,
    merchantName: enrichedData?.merchantName,
    billId: transaction.billId,
    billName: enrichedData?.billName,
    debtId: transaction.debtId,
    debtName: enrichedData?.debtName,
    date: transaction.date,
    amount: transaction.amount,
    description: transaction.description,
    notes: transaction.notes,
    type: transaction.type,
    isPending: transaction.isPending,
    isTaxDeductible: transaction.isTaxDeductible,
    isSalesTaxable: transaction.isSalesTaxable,
    createdAt: transaction.createdAt,
    updatedAt: transaction.updatedAt,
  };
}

