/**
 * Balance Snapshots Cron Job Endpoint
 * 
 * Captures daily balance snapshots for all active credit accounts.
 * Creates historical records for utilization trends and balance tracking.
 * Should be called daily at 11:59 PM UTC (end of day snapshot).
 * 
 * POST - Create snapshots (for cron jobs)
 * GET - Preview what would be captured (for debugging)
 */

import { db } from '@/lib/db';
import { accounts, accountBalanceHistory } from '@/lib/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import Decimal from 'decimal.js';

export const dynamic = 'force-dynamic';

// Cron secret for production security (optional)
const CRON_SECRET = process.env.CRON_SECRET;

interface SnapshotResult {
  accountId: string;
  accountName: string;
  balance: number;
  creditLimit: number;
  utilizationPercent: number;
}

/**
 * Get all active credit accounts with their current balances
 */
async function getActiveCreditAccounts() {
  return db
    .select({
      id: accounts.id,
      name: accounts.name,
      userId: accounts.userId,
      householdId: accounts.householdId,
      currentBalance: accounts.currentBalance,
      creditLimit: accounts.creditLimit,
    })
    .from(accounts)
    .where(
      and(
        inArray(accounts.type, ['credit', 'line_of_credit']),
        eq(accounts.isActive, true)
      )
    );
}

/**
 * Check if snapshot already exists for an account today
 */
async function snapshotExistsToday(accountId: string, snapshotDate: string): Promise<boolean> {
  const existing = await db
    .select({ id: accountBalanceHistory.id })
    .from(accountBalanceHistory)
    .where(
      and(
        eq(accountBalanceHistory.accountId, accountId),
        eq(accountBalanceHistory.snapshotDate, snapshotDate)
      )
    )
    .limit(1);

  return existing.length > 0;
}

/**
 * Create balance snapshot for an account
 */
async function createSnapshot(
  account: {
    id: string;
    name: string;
    userId: string | null;
    householdId: string | null;
    currentBalance: number | null;
    creditLimit: number | null;
  },
  snapshotDate: string
): Promise<SnapshotResult | null> {
  // Skip if userId or householdId is null
  if (!account.userId || !account.householdId) {
    console.log(`[Balance Snapshots] Skipping account ${account.id} - missing userId or householdId`);
    return null;
  }

  // Check for existing snapshot
  const exists = await snapshotExistsToday(account.id, snapshotDate);
  if (exists) {
    return null; // Already has snapshot for today
  }

  const balance = Math.abs(account.currentBalance || 0);
  const creditLimit = account.creditLimit || 0;
  const availableCredit = creditLimit > 0 ? new Decimal(creditLimit).minus(balance).toNumber() : 0;
  const utilizationPercent = creditLimit > 0 
    ? new Decimal(balance).div(creditLimit).times(100).toNumber() 
    : 0;

  await db.insert(accountBalanceHistory).values({
    id: uuidv4(),
    accountId: account.id,
    userId: account.userId,
    householdId: account.householdId,
    snapshotDate,
    balance,
    creditLimit,
    availableCredit,
    utilizationPercent,
    createdAt: new Date().toISOString(),
  });

  return {
    accountId: account.id,
    accountName: account.name,
    balance,
    creditLimit,
    utilizationPercent,
  };
}

/**
 * POST - Create balance snapshots for all credit accounts
 * 
 * In production, verify the cron secret to prevent unauthorized access.
 * Called by: External cron service (e.g., Vercel Cron, GitHub Actions, etc.)
 * Schedule: Daily at 11:59 PM UTC
 */
export async function POST(request: Request) {
  try {
    // Verify cron secret in production
    if (CRON_SECRET) {
      const authHeader = request.headers.get('authorization');
      const providedSecret = authHeader?.replace('Bearer ', '');
      
      if (providedSecret !== CRON_SECRET) {
        return Response.json(
          { error: 'Unauthorized - Invalid cron secret' },
          { status: 401 }
        );
      }
    }

    const today = new Date().toISOString().split('T')[0];
    console.log(`[Balance Snapshots] Starting snapshot capture for ${today}`);

    // Get all active credit accounts
    const creditAccounts = await getActiveCreditAccounts();
    
    if (creditAccounts.length === 0) {
      console.log('[Balance Snapshots] No active credit accounts found');
      return Response.json({
        success: true,
        message: 'No active credit accounts to snapshot',
        timestamp: new Date().toISOString(),
        snapshotDate: today,
        stats: { total: 0, created: 0, skipped: 0 },
      });
    }

    // Create snapshots for each account
    const results: SnapshotResult[] = [];
    let skipped = 0;

    for (const account of creditAccounts) {
      const result = await createSnapshot(account, today);
      if (result) {
        results.push(result);
      } else {
        skipped++;
      }
    }

    const summary = results.length > 0 
      ? `Created ${results.length} snapshot(s), skipped ${skipped}` 
      : `All ${skipped} account(s) already have today's snapshot`;

    console.log(`[Balance Snapshots] Completed: ${summary}`);

    return Response.json({
      success: true,
      message: 'Balance snapshot capture completed',
      summary,
      timestamp: new Date().toISOString(),
      snapshotDate: today,
      stats: {
        total: creditAccounts.length,
        created: results.length,
        skipped,
      },
      snapshots: results.length > 0 ? results : undefined,
    });
  } catch (error) {
    console.error('[Balance Snapshots] Error:', error);
    return Response.json(
      { 
        success: false,
        error: 'Failed to capture balance snapshots',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

/**
 * GET - Preview credit accounts that would be snapshotted
 * 
 * Useful for debugging and monitoring.
 * Does NOT require cron secret - shows only non-sensitive metadata.
 */
export async function GET(_request: Request) {
  try {
    const today = new Date().toISOString().split('T')[0];
    const creditAccounts = await getActiveCreditAccounts();

    // Check which already have snapshots
    const accountsWithStatus = await Promise.all(
      creditAccounts.map(async (account) => {
        const hasSnapshot = await snapshotExistsToday(account.id, today);
        const balance = Math.abs(account.currentBalance || 0);
        const creditLimit = account.creditLimit || 0;
        const utilizationPercent = creditLimit > 0 
          ? new Decimal(balance).div(creditLimit).times(100).toNumber() 
          : 0;

        return {
          accountId: account.id,
          accountName: account.name,
          currentBalance: balance,
          creditLimit,
          utilizationPercent: Math.round(utilizationPercent * 10) / 10,
          hasSnapshotToday: hasSnapshot,
        };
      })
    );

    const needsSnapshot = accountsWithStatus.filter(a => !a.hasSnapshotToday).length;
    const alreadyDone = accountsWithStatus.filter(a => a.hasSnapshotToday).length;

    return Response.json({
      success: true,
      message: needsSnapshot > 0 
        ? `${needsSnapshot} account(s) need snapshot, ${alreadyDone} already done`
        : alreadyDone > 0 
          ? `All ${alreadyDone} account(s) already have today's snapshot`
          : 'No active credit accounts found',
      timestamp: new Date().toISOString(),
      snapshotDate: today,
      stats: {
        total: creditAccounts.length,
        needsSnapshot,
        alreadyDone,
      },
      accounts: accountsWithStatus,
    });
  } catch (error) {
    console.error('[Balance Snapshots Preview] Error:', error);
    return Response.json(
      { 
        success: false,
        error: 'Failed to get snapshot preview',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

