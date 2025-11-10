/**
 * Transfer Action Handler
 *
 * Handles transfer conversion AFTER transaction creation.
 * This is necessary because transfer conversion requires the transaction ID
 * and may need to create/link with another transaction.
 */

import { db } from '@/lib/db';
import { transactions, accounts } from '@/lib/db/schema';
import { eq, and, between, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import Decimal from 'decimal.js';
import type { TransferConversionConfig } from './types';

/**
 * Handle transfer conversion for a transaction
 * Called AFTER transaction is created
 */
export async function handleTransferConversion(
  userId: string,
  transactionId: string,
  config: TransferConversionConfig
): Promise<{
  success: boolean;
  matchedTransactionId?: string;
  createdTransactionId?: string;
  error?: string;
}> {
  try {
    // 1. Fetch the source transaction
    const sourceTx = await db
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.id, transactionId),
          eq(transactions.userId, userId)
        )
      )
      .limit(1);

    if (sourceTx.length === 0) {
      return { success: false, error: 'Transaction not found' };
    }

    const transaction = sourceTx[0];

    // 2. If autoMatch enabled, search for matching transaction
    let matchedTx = null;
    if (config.autoMatch) {
      matchedTx = await findMatchingTransaction(
        userId,
        transaction,
        config.targetAccountId,
        config.matchTolerance,
        config.matchDayRange
      );
    }

    // 3. Generate transfer ID
    const transferId = nanoid();

    // 4. Determine new transaction type based on original type
    const newType = transaction.type === 'income' ? 'transfer_in' : 'transfer_out';

    // 5. Convert source transaction to transfer
    await db
      .update(transactions)
      .set({
        type: newType,
        transferId: transferId,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(transactions.id, transactionId));

    // 6. Handle matched or create new transfer pair
    if (matchedTx) {
      // Link with matched transaction
      const matchedType = matchedTx.type === 'income' ? 'transfer_in' : 'transfer_out';

      await db
        .update(transactions)
        .set({
          type: matchedType,
          transferId: transferId,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(transactions.id, matchedTx.id));

      return {
        success: true,
        matchedTransactionId: matchedTx.id,
      };
    } else if (config.createIfNoMatch && config.targetAccountId) {
      // Create new transfer pair
      const newTxId = nanoid();
      const pairType = newType === 'transfer_out' ? 'transfer_in' : 'transfer_out';

      await db.insert(transactions).values({
        id: newTxId,
        userId: userId,
        accountId: config.targetAccountId,
        date: transaction.date,
        amount: transaction.amount,
        description: transaction.description,
        notes: transaction.notes ? `${transaction.notes}\n\nAuto-created transfer pair from rule action` : 'Auto-created transfer pair from rule action',
        type: pairType,
        transferId: transferId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      // Update account balances
      await updateAccountBalances(
        userId,
        transaction.accountId,
        config.targetAccountId,
        transaction.amount,
        newType
      );

      return {
        success: true,
        createdTransactionId: newTxId,
      };
    }

    return { success: true };
  } catch (error) {
    console.error('Transfer conversion failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Find a matching transaction for transfer conversion
 * Uses intelligent matching based on amount, date, and opposite type
 */
async function findMatchingTransaction(
  userId: string,
  sourceTx: any,
  targetAccountId: string | undefined,
  tolerance: number,
  dayRange: number
): Promise<any | null> {
  try {
    // Calculate date range
    const txDate = new Date(sourceTx.date);
    const startDate = new Date(txDate);
    startDate.setDate(startDate.getDate() - dayRange);
    const endDate = new Date(txDate);
    endDate.setDate(endDate.getDate() + dayRange);

    // Determine opposite type
    const oppositeType = sourceTx.type === 'expense' ? 'income' : 'expense';

    // Calculate amount tolerance
    const txAmount = new Decimal(sourceTx.amount);
    const toleranceAmount = txAmount.times(tolerance / 100);
    const minAmount = txAmount.minus(toleranceAmount).toNumber();
    const maxAmount = txAmount.plus(toleranceAmount).toNumber();

    // Build query conditions
    const conditions = [
      eq(transactions.userId, userId),
      eq(transactions.type, oppositeType),
      // Only match transactions that aren't already transfers
      sql`${transactions.transferId} IS NULL`,
      // Date range
      between(
        transactions.date,
        startDate.toISOString().split('T')[0],
        endDate.toISOString().split('T')[0]
      ),
    ];

    // Add target account filter if specified
    if (targetAccountId) {
      conditions.push(eq(transactions.accountId, targetAccountId));
    }

    const candidates = await db
      .select()
      .from(transactions)
      .where(and(...conditions))
      .limit(50);

    // Filter by amount tolerance
    const matches = candidates.filter((tx) => {
      return tx.amount >= minAmount && tx.amount <= maxAmount;
    });

    if (matches.length === 0) {
      return null;
    }

    // Sort by best match (closest date, then closest amount)
    const sorted = matches.sort((a, b) => {
      const aDiff = Math.abs(new Date(a.date).getTime() - txDate.getTime());
      const bDiff = Math.abs(new Date(b.date).getTime() - txDate.getTime());

      if (aDiff !== bDiff) {
        return aDiff - bDiff;
      }

      // If dates are equal, sort by amount difference
      const aAmountDiff = new Decimal(a.amount).minus(txAmount).abs().toNumber();
      const bAmountDiff = new Decimal(b.amount).minus(txAmount).abs().toNumber();
      return aAmountDiff - bAmountDiff;
    });

    return sorted[0];
  } catch (error) {
    console.error('Error finding matching transaction:', error);
    return null;
  }
}

/**
 * Update account balances after transfer conversion
 * Handles balance adjustments for both source and target accounts
 */
async function updateAccountBalances(
  userId: string,
  sourceAccountId: string,
  targetAccountId: string,
  amount: number,
  sourceType: string
): Promise<void> {
  try {
    const amountDecimal = new Decimal(amount);

    if (sourceType === 'transfer_out') {
      // Transfer Out: source loses money, target gains money
      await db
        .update(accounts)
        .set({
          currentBalance: sql`current_balance - ${amountDecimal.toFixed(2)}`,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(accounts.id, sourceAccountId));

      await db
        .update(accounts)
        .set({
          currentBalance: sql`current_balance + ${amountDecimal.toFixed(2)}`,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(accounts.id, targetAccountId));
    } else {
      // Transfer In: source gains money, target loses money
      await db
        .update(accounts)
        .set({
          currentBalance: sql`current_balance + ${amountDecimal.toFixed(2)}`,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(accounts.id, sourceAccountId));

      await db
        .update(accounts)
        .set({
          currentBalance: sql`current_balance - ${amountDecimal.toFixed(2)}`,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(accounts.id, targetAccountId));
    }
  } catch (error) {
    console.error('Error updating account balances:', error);
    throw error;
  }
}
