import { db } from '@/lib/db';
import { transactions, accounts, activityLog, householdMembers } from '@/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import Decimal from 'decimal.js';

/**
 * Result of account change operation
 */
export interface AccountChangeResult {
  success: boolean;
  error?: string;
  oldAccountId?: string;
  newAccountId?: string;
}

/**
 * Handle account change AFTER transaction is created
 * This is called from the transaction creation API after a rule with set_account action matches
 *
 * Updates account balances for both old and new accounts
 * Logs activity for audit trail
 *
 * @param userId - User ID for validation
 * @param transactionId - Transaction ID to change account for
 * @param targetAccountId - Target account ID to move transaction to
 * @returns Result with success status or error message
 */
export async function handleAccountChange(
  userId: string,
  transactionId: string,
  targetAccountId: string
): Promise<AccountChangeResult> {
  try {
    // 1. Fetch transaction
    const txResult = await db
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.id, transactionId),
          eq(transactions.userId, userId)
        )
      )
      .limit(1);

    const transaction = txResult[0];

    if (!transaction) {
      return { success: false, error: 'Transaction not found' };
    }

    const householdId = transaction.householdId;
    if (!householdId) {
      return { success: false, error: 'Transaction missing household ID' };
    }

    // 2. Validate not a transfer
    if (transaction.type === 'transfer_out' || transaction.type === 'transfer_in') {
      return {
        success: false,
        error: 'Cannot change account for transfer transactions'
      };
    }

    // 3. Validate target account exists and belongs to user + household
    const targetAccountResult = await db
      .select()
      .from(accounts)
      .where(
        and(
          eq(accounts.id, targetAccountId),
          eq(accounts.userId, userId),
          eq(accounts.householdId, householdId)
        )
      )
      .limit(1);

    const targetAccount = targetAccountResult[0];

    if (!targetAccount) {
      return { success: false, error: 'Target account not found' };
    }

    // 4. If same account, do nothing (already correct)
    if (transaction.accountId === targetAccountId) {
      return { success: true, oldAccountId: transaction.accountId, newAccountId: targetAccountId };
    }

    // 5. Calculate balance adjustments using Decimal.js for precision
    const amount = new Decimal(transaction.amount);
    const oldAccountId = transaction.accountId;
    const transactionType = transaction.type;

    if (!transactionType) {
      return { success: false, error: 'Transaction type is missing' };
    }

    // 6. Update account balances
    await updateAccountBalances(userId, householdId, oldAccountId, targetAccountId, transactionType, amount);

    // 7. Update transaction account
    await db
      .update(transactions)
      .set({ accountId: targetAccountId })
      .where(
        and(
          eq(transactions.id, transactionId),
          eq(transactions.userId, userId),
          eq(transactions.householdId, householdId)
        )
      );

    // 8. Log activity
    await logAccountChange(
      userId,
      householdId,
      transactionId,
      oldAccountId,
      targetAccountId,
      amount,
      transactionType
    );

    return {
      success: true,
      oldAccountId,
      newAccountId: targetAccountId
    };
  } catch (error) {
    console.error('Account change failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to change account'
    };
  }
}

/**
 * Update account balances for old and new accounts
 * Reverses impact on old account and applies impact to new account
 *
 * @param oldAccountId - Original account ID
 * @param newAccountId - Target account ID
 * @param transactionType - Type of transaction (income/expense)
 * @param amount - Transaction amount (Decimal)
 */
async function updateAccountBalances(
  userId: string,
  householdId: string,
  oldAccountId: string,
  newAccountId: string,
  transactionType: string,
  amount: Decimal
): Promise<void> {
  const amountStr = amount.toString();

  // Reverse impact on old account
  if (transactionType === 'income') {
    // Remove income from old account (subtract)
    await db
      .update(accounts)
      .set({ currentBalance: sql`current_balance - ${amountStr}` })
      .where(
        and(
          eq(accounts.id, oldAccountId),
          eq(accounts.userId, userId),
          eq(accounts.householdId, householdId)
        )
      );
  } else if (transactionType === 'expense') {
    // Add back expense to old account (add)
    await db
      .update(accounts)
      .set({ currentBalance: sql`current_balance + ${amountStr}` })
      .where(
        and(
          eq(accounts.id, oldAccountId),
          eq(accounts.userId, userId),
          eq(accounts.householdId, householdId)
        )
      );
  }

  // Apply impact to new account
  if (transactionType === 'income') {
    // Add income to new account (add)
    await db
      .update(accounts)
      .set({ currentBalance: sql`current_balance + ${amountStr}` })
      .where(
        and(
          eq(accounts.id, newAccountId),
          eq(accounts.userId, userId),
          eq(accounts.householdId, householdId)
        )
      );
  } else if (transactionType === 'expense') {
    // Subtract expense from new account (subtract)
    await db
      .update(accounts)
      .set({ currentBalance: sql`current_balance - ${amountStr}` })
      .where(
        and(
          eq(accounts.id, newAccountId),
          eq(accounts.userId, userId),
          eq(accounts.householdId, householdId)
        )
      );
  }
}

/**
 * Log account change to household activity log
 *
 * @param userId - User ID who performed the change
 * @param transactionId - Transaction ID that was changed
 * @param oldAccountId - Original account ID
 * @param newAccountId - New account ID
 * @param amount - Transaction amount
 * @param transactionType - Type of transaction
 */
async function logAccountChange(
  userId: string,
  householdId: string,
  transactionId: string,
  oldAccountId: string,
  newAccountId: string,
  amount: Decimal,
  transactionType: string
): Promise<void> {
  try {
    // Fetch membership for the correct household
    const memberResult = await db
      .select({ householdId: householdMembers.householdId })
      .from(householdMembers)
      .where(
        and(
          eq(householdMembers.userId, userId),
          eq(householdMembers.householdId, householdId)
        )
      )
      .limit(1);

    const member = memberResult[0];

    if (!member || !member.householdId) {
      console.warn('Household not found for activity log');
      return;
    }

    // Fetch account names
    const [oldAccountResult, newAccountResult] = await Promise.all([
      db.select({ name: accounts.name }).from(accounts).where(
        and(
          eq(accounts.id, oldAccountId),
          eq(accounts.userId, userId),
          eq(accounts.householdId, householdId)
        )
      ).limit(1),
      db.select({ name: accounts.name }).from(accounts).where(
        and(
          eq(accounts.id, newAccountId),
          eq(accounts.userId, userId),
          eq(accounts.householdId, householdId)
        )
      ).limit(1)
    ]);

    const oldAccountName = oldAccountResult[0]?.name || 'Unknown Account';
    const newAccountName = newAccountResult[0]?.name || 'Unknown Account';

    // Log to household activity
    await db.insert(activityLog).values({
      id: nanoid(),
      householdId,
      userId,
      actionType: 'transaction_updated',
      entityType: 'transaction',
      entityId: transactionId,
      details: JSON.stringify({
        action: 'account_changed',
        oldAccountId,
        newAccountId,
        oldAccountName,
        newAccountName,
        amount: amount.toFixed(2),
        transactionType,
        description: `Moved ${transactionType} transaction ($${amount.toFixed(2)}) from ${oldAccountName} to ${newAccountName}`
      }),
      createdAt: new Date().toISOString()
    });
  } catch (error) {
    // Non-fatal error, just log it
    console.error('Failed to log account change:', error);
  }
}
