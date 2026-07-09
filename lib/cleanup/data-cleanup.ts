/**
 * Data Cleanup Utilities
 *
 * Provides functions for cleaning up old and unused data in the application.
 * Supports data retention policies, batch operations, and detailed logging.
 */

import { db } from "@/lib/db";
import { eq, lt, sql } from "drizzle-orm";
import {
  savedSearchFilters,
  householdActivityLog,
  importStaging,
  importHistory,
  transactionSplits,
  // Note: 'transactions' referenced in raw SQL subqueries, not as Drizzle object
  transactionTags,
  customFieldValues,
  tags,
  debtPayments,
  savingsGoalContributions,
  billPaymentEvents,
  // Note: 'transfers' / 'transactions' referenced in raw SQL, not as Drizzle objects
} from "@/lib/db/schema";

export interface CleanupStats {
  name: string;
  deletedRecords: number;
  duration: number; // milliseconds
  status: "success" | "error";
  error?: string;
  timestamp: number;
}

export interface CleanupResult {
  totalDeleted: number;
  totalDuration: number;
  stats: CleanupStats[];
  timestamp: number;
}

/**
 * Retention policies (in days)
 */
export const RETENTION_POLICIES = {
  SEARCH_HISTORY: 90, // Keep 3 months of search history
  IMPORT_HISTORY: 180, // Keep 6 months of import history
  ACTIVITY_LOG: 365, // Keep 1 year of activity logs
  METRICS: 30, // Keep 1 month of performance metrics (rough estimate)
  PENDING_TRANSACTIONS: 7, // Keep pending txns for 7 days before cleanup
  SESSIONS: 30, // Keep session data for 30 days
  DELETED_RECORDS_AUDIT: 365, // Keep deleted record audit trail for 1 year
};

/**
 * Clean old search history records
 * Keeps only recent searches for each user
 */
export async function cleanOldSearchHistory(): Promise<CleanupStats> {
  const startTime = performance.now();
  const name = "searchHistory";

  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(
      cutoffDate.getDate() - RETENTION_POLICIES.SEARCH_HISTORY
    );

    // Delete old search records
    const result = await db
      .delete(savedSearchFilters)
      .where(
        lt(
          sql`${savedSearchFilters.createdAt}`,
          cutoffDate.toISOString()
        )
      );

    const duration = performance.now() - startTime;

    return {
      name,
      deletedRecords: result.changes || 0,
      duration,
      status: "success",
      timestamp: Date.now(),
    };
  } catch (error) {
    const duration = performance.now() - startTime;
    return {
      name,
      deletedRecords: 0,
      duration,
      status: "error",
      error: error instanceof Error ? error.message : "Unknown error",
      timestamp: Date.now(),
    };
  }
}

/**
 * Clean old activity logs
 * Keeps activity logs for configured retention period
 */
export async function cleanOldActivityLogs(): Promise<CleanupStats> {
  const startTime = performance.now();
  const name = "activityLog";

  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(
      cutoffDate.getDate() - RETENTION_POLICIES.ACTIVITY_LOG
    );

    // Delete old activity records
    const result = await db
      .delete(householdActivityLog)
      .where(
        lt(
          sql`${householdActivityLog.createdAt}`,
          cutoffDate.toISOString()
        )
      );

    const duration = performance.now() - startTime;

    return {
      name,
      deletedRecords: result.changes || 0,
      duration,
      status: "success",
      timestamp: Date.now(),
    };
  } catch (error) {
    const duration = performance.now() - startTime;
    return {
      name,
      deletedRecords: 0,
      duration,
      status: "error",
      error: error instanceof Error ? error.message : "Unknown error",
      timestamp: Date.now(),
    };
  }
}

/**
 * Clean old import history
 * Keeps import records for configured retention period
 */
export async function cleanOldImportHistory(): Promise<CleanupStats> {
  const startTime = performance.now();
  const name = "importHistory";

  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(
      cutoffDate.getDate() - RETENTION_POLICIES.IMPORT_HISTORY
    );

    // First delete associated import staging records
    const stagingResult = await db
      .delete(importStaging)
      .where(
        lt(
          sql`${importStaging.createdAt}`,
          cutoffDate.toISOString()
        )
      );

    // Then delete the import history records
    const historyResult = await db
      .delete(importHistory)
      .where(
        lt(
          sql`${importHistory.startedAt}`,
          cutoffDate.toISOString()
        )
      );

    const duration = performance.now() - startTime;
    const totalDeleted = (stagingResult.changes || 0) + (historyResult.changes || 0);

    return {
      name,
      deletedRecords: totalDeleted,
      duration,
      status: "success",
      timestamp: Date.now(),
    };
  } catch (error) {
    const duration = performance.now() - startTime;
    return {
      name,
      deletedRecords: 0,
      duration,
      status: "error",
      error: error instanceof Error ? error.message : "Unknown error",
      timestamp: Date.now(),
    };
  }
}

/**
 * Clean orphaned transaction splits
 * Deletes splits for deleted transactions
 */
export async function cleanOrphanedSplits(): Promise<CleanupStats> {
  const startTime = performance.now();
  const name = "orphanedSplits";

  try {
    // Delete splits where transaction doesn't exist
    const result = await db
      .delete(transactionSplits)
      .where(
        sql`${transactionSplits.transactionId} NOT IN (
          SELECT id FROM transactions
        )`
      );

    const duration = performance.now() - startTime;

    return {
      name,
      deletedRecords: result.changes || 0,
      duration,
      status: "success",
      timestamp: Date.now(),
    };
  } catch (error) {
    const duration = performance.now() - startTime;
    return {
      name,
      deletedRecords: 0,
      duration,
      status: "error",
      error: error instanceof Error ? error.message : "Unknown error",
      timestamp: Date.now(),
    };
  }
}

/**
 * Clean orphaned transaction tags
 * Deletes tag associations where transaction or tag doesn't exist
 */
export async function cleanOrphanedTags(): Promise<CleanupStats> {
  const startTime = performance.now();
  const name = "orphanedTags";

  try {
    // Delete tag associations where transaction doesn't exist
    const result = await db
      .delete(transactionTags)
      .where(
        sql`${transactionTags.transactionId} NOT IN (
          SELECT id FROM transactions
        )`
      );

    const duration = performance.now() - startTime;

    return {
      name,
      deletedRecords: result.changes || 0,
      duration,
      status: "success",
      timestamp: Date.now(),
    };
  } catch (error) {
    const duration = performance.now() - startTime;
    return {
      name,
      deletedRecords: 0,
      duration,
      status: "error",
      error: error instanceof Error ? error.message : "Unknown error",
      timestamp: Date.now(),
    };
  }
}

/**
 * Clean orphaned custom field values
 * Deletes field values where transaction doesn't exist
 */
export async function cleanOrphanedCustomFieldValues(): Promise<CleanupStats> {
  const startTime = performance.now();
  const name = "orphanedCustomFieldValues";

  try {
    // Delete custom field values where transaction doesn't exist
    const result = await db
      .delete(customFieldValues)
      .where(
        sql`${customFieldValues.transactionId} NOT IN (
          SELECT id FROM transactions
        )`
      );

    const duration = performance.now() - startTime;

    return {
      name,
      deletedRecords: result.changes || 0,
      duration,
      status: "success",
      timestamp: Date.now(),
    };
  } catch (error) {
    const duration = performance.now() - startTime;
    return {
      name,
      deletedRecords: 0,
      duration,
      status: "error",
      error: error instanceof Error ? error.message : "Unknown error",
      timestamp: Date.now(),
    };
  }
}

/**
 * Clean orphaned MONEY links (audit finding C-DB-2: no foreign keys enforce
 * these relationships, so a deleted parent can leave dangling children/refs).
 * The reversal layer already unwinds these on a normal transaction delete; this
 * is the safety net for legacy data and any path that bypasses it.
 *
 *  - debt_payments / goal_contributions / bill_payment_events whose parent debt /
 *    goal / occurrence is gone are DELETED (cascade semantics — the payment
 *    record is meaningless without its parent).
 *  - debt_payments.transaction_id and transfers.from/to_transaction_id that point
 *    at a deleted transaction are SET NULL (the record is still valid; only the
 *    dangling reference is cleared — this is what verify-money-integrity flags).
 */
export async function cleanOrphanedMoneyLinks(): Promise<CleanupStats> {
  const startTime = performance.now();
  const name = "orphanedMoneyLinks";

  try {
    let deleted = 0;

    const delDebtPayments = await db
      .delete(debtPayments)
      .where(sql`${debtPayments.debtId} NOT IN (SELECT id FROM debts)`);
    deleted += delDebtPayments.changes || 0;

    const delContribs = await db
      .delete(savingsGoalContributions)
      .where(sql`${savingsGoalContributions.goalId} NOT IN (SELECT id FROM savings_goals)`);
    deleted += delContribs.changes || 0;

    const delBillEvents = await db
      .delete(billPaymentEvents)
      .where(sql`${billPaymentEvents.occurrenceId} NOT IN (SELECT id FROM bill_occurrences)`);
    deleted += delBillEvents.changes || 0;

    // Clear dangling transaction references (SET NULL, not delete).
    await db.run(sql`
      UPDATE debt_payments SET transaction_id = NULL
      WHERE transaction_id IS NOT NULL
        AND transaction_id NOT IN (SELECT id FROM transactions)
    `);
    await db.run(sql`
      UPDATE transfers SET from_transaction_id = NULL
      WHERE from_transaction_id IS NOT NULL
        AND from_transaction_id NOT IN (SELECT id FROM transactions)
    `);
    await db.run(sql`
      UPDATE transfers SET to_transaction_id = NULL
      WHERE to_transaction_id IS NOT NULL
        AND to_transaction_id NOT IN (SELECT id FROM transactions)
    `);

    const duration = performance.now() - startTime;
    return {
      name,
      deletedRecords: deleted,
      duration,
      status: "success",
      timestamp: Date.now(),
    };
  } catch (error) {
    const duration = performance.now() - startTime;
    return {
      name,
      deletedRecords: 0,
      duration,
      status: "error",
      error: error instanceof Error ? error.message : "Unknown error",
      timestamp: Date.now(),
    };
  }
}

/**
 * Clean unused tags with zero usage
 * Deletes tags that haven't been used in a long time
 */
export async function cleanUnusedTags(): Promise<CleanupStats> {
  const startTime = performance.now();
  const name = "unusedTags";

  try {
    // Delete tags with zero usage
    const result = await db
      .delete(tags)
      .where(eq(tags.usageCount, 0));

    const duration = performance.now() - startTime;

    return {
      name,
      deletedRecords: result.changes || 0,
      duration,
      status: "success",
      timestamp: Date.now(),
    };
  } catch (error) {
    const duration = performance.now() - startTime;
    return {
      name,
      deletedRecords: 0,
      duration,
      status: "error",
      error: error instanceof Error ? error.message : "Unknown error",
      timestamp: Date.now(),
    };
  }
}

/**
 * Vacuum the database
 * Optimizes database file by removing unused space
 */
export async function vacuumDatabase(): Promise<CleanupStats> {
  const startTime = performance.now();
  const name = "databaseVacuum";

  try {
    // Execute VACUUM command
    await db.run(sql`VACUUM`);

    const duration = performance.now() - startTime;

    return {
      name,
      deletedRecords: 0,
      duration,
      status: "success",
      timestamp: Date.now(),
    };
  } catch (error) {
    const duration = performance.now() - startTime;
    return {
      name,
      deletedRecords: 0,
      duration,
      status: "error",
      error: error instanceof Error ? error.message : "Unknown error",
      timestamp: Date.now(),
    };
  }
}

/**
 * Analyze database tables for optimization
 * Runs ANALYZE to update query optimizer statistics
 */
export async function analyzeDatabase(): Promise<CleanupStats> {
  const startTime = performance.now();
  const name = "databaseAnalyze";

  try {
    // Execute ANALYZE command
    await db.run(sql`ANALYZE`);

    const duration = performance.now() - startTime;

    return {
      name,
      deletedRecords: 0,
      duration,
      status: "success",
      timestamp: Date.now(),
    };
  } catch (error) {
    const duration = performance.now() - startTime;
    return {
      name,
      deletedRecords: 0,
      duration,
      status: "error",
      error: error instanceof Error ? error.message : "Unknown error",
      timestamp: Date.now(),
    };
  }
}

/**
 * Run all cleanup operations
 */
export async function runAllCleanups(): Promise<CleanupResult> {
  const startTime = performance.now();
  const stats: CleanupStats[] = [];

  // Run cleanups in order
  stats.push(await cleanOldSearchHistory());
  stats.push(await cleanOldActivityLogs());
  stats.push(await cleanOldImportHistory());
  stats.push(await cleanOrphanedSplits());
  stats.push(await cleanOrphanedTags());
  stats.push(await cleanOrphanedCustomFieldValues());
  stats.push(await cleanOrphanedMoneyLinks());
  stats.push(await cleanUnusedTags());

  // Optimize database
  stats.push(await analyzeDatabase());
  stats.push(await vacuumDatabase());

  const totalDuration = performance.now() - startTime;
  const totalDeleted = stats.reduce((sum, s) => sum + s.deletedRecords, 0);

  return {
    totalDeleted,
    totalDuration,
    stats,
    timestamp: Date.now(),
  };
}

/**
 * Get cleanup configuration for display
 */
export function getCleanupConfig() {
  return {
    policies: RETENTION_POLICIES,
    operations: [
      {
        name: "oldSearchHistory",
        description: "Remove search history older than 90 days",
        frequency: "daily",
      },
      {
        name: "oldActivityLogs",
        description: "Remove activity logs older than 365 days",
        frequency: "weekly",
      },
      {
        name: "oldImportHistory",
        description: "Remove import records older than 180 days",
        frequency: "monthly",
      },
      {
        name: "orphanedSplits",
        description: "Remove splits for deleted transactions",
        frequency: "daily",
      },
      {
        name: "orphanedTags",
        description: "Remove tag associations for deleted items",
        frequency: "daily",
      },
      {
        name: "orphanedCustomFieldValues",
        description: "Remove custom field values for deleted transactions",
        frequency: "daily",
      },
      {
        name: "orphanedMoneyLinks",
        description:
          "Remove debt/goal/bill payment records for deleted parents and clear dangling transaction references",
        frequency: "daily",
      },
      {
        name: "unusedTags",
        description: "Remove tags with zero usage",
        frequency: "monthly",
      },
      {
        name: "databaseAnalyze",
        description: "Update database optimizer statistics",
        frequency: "weekly",
      },
      {
        name: "databaseVacuum",
        description: "Reclaim unused database space",
        frequency: "monthly",
      },
    ],
  };
}
