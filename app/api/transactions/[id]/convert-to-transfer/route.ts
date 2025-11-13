import { requireAuth } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { transactions, accounts } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import Decimal from 'decimal.js';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await requireAuth();
    const { id } = await params;

    const body = await request.json();
    const { targetAccountId, matchingTransactionId } = body;

    // Validate required fields
    if (!targetAccountId) {
      return Response.json(
        { error: 'Target account ID is required' },
        { status: 400 }
      );
    }

    // Get the original transaction
    const originalTx = await db
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.id, id),
          eq(transactions.userId, userId)
        )
      )
      .limit(1);

    if (originalTx.length === 0) {
      return Response.json(
        { error: 'Transaction not found' },
        { status: 404 }
      );
    }

    const transaction = originalTx[0];

    // Check if already a transfer
    if (transaction.type === 'transfer_out' || transaction.type === 'transfer_in') {
      return Response.json(
        { error: 'Transaction is already a transfer' },
        { status: 400 }
      );
    }

    // Validate target account exists and belongs to user
    const targetAccountResult = await db
      .select()
      .from(accounts)
      .where(
        and(
          eq(accounts.id, targetAccountId),
          eq(accounts.userId, userId)
        )
      )
      .limit(1);

    if (targetAccountResult.length === 0) {
      return Response.json(
        { error: 'Target account not found' },
        { status: 404 }
      );
    }

    const targetAccount = targetAccountResult[0];

    // Get source account
    const sourceAccountResult = await db
      .select()
      .from(accounts)
      .where(eq(accounts.id, transaction.accountId))
      .limit(1);

    if (sourceAccountResult.length === 0) {
      return Response.json(
        { error: 'Source account not found' },
        { status: 404 }
      );
    }

    const sourceAccount = sourceAccountResult[0];
    const amount = new Decimal(transaction.amount);

    // Determine conversion direction based on original type
    // expense: money left the account → transfer_out
    // income: money entered the account → transfer_in
    const isExpense = transaction.type === 'expense';

    let pairedTransactionId: string;
    let matchedExistingTransaction = false;

    // Case 1: Matching with an existing transaction
    if (matchingTransactionId) {
      const matchingTx = await db
        .select()
        .from(transactions)
        .where(
          and(
            eq(transactions.id, matchingTransactionId),
            eq(transactions.userId, userId)
          )
        )
        .limit(1);

      if (matchingTx.length === 0) {
        return Response.json(
          { error: 'Matching transaction not found' },
          { status: 404 }
        );
      }

      const matched = matchingTx[0];

      // Check if matching transaction is already a transfer
      if (matched.type === 'transfer_out' || matched.type === 'transfer_in') {
        return Response.json(
          { error: 'Matching transaction is already a transfer' },
          { status: 400 }
        );
      }

      // Validate the matching transaction is on the target account
      if (matched.accountId !== targetAccountId) {
        return Response.json(
          { error: 'Matching transaction must be on the target account' },
          { status: 400 }
        );
      }

      // Validate amounts match (allow small tolerance for rounding)
      const matchedAmount = new Decimal(matched.amount);
      if (!matchedAmount.minus(amount).abs().lessThan(0.01)) {
        return Response.json(
          { error: 'Transaction amounts do not match' },
          { status: 400 }
        );
      }

      // Validate opposite types (expense matches with income)
      const isMatchedExpense = matched.type === 'expense';
      if (isExpense === isMatchedExpense) {
        return Response.json(
          { error: 'Transactions must be opposite types (expense/income)' },
          { status: 400 }
        );
      }

      pairedTransactionId = matchingTransactionId;
      matchedExistingTransaction = true;

      // Reverse the balance effect of the matched transaction since it will become a transfer
      // We need to undo its original effect on the target account
      let targetBalance = new Decimal(targetAccount.currentBalance || 0);
      if (matched.type === 'expense') {
        // Was an expense, so balance was decreased. Reverse by adding back.
        targetBalance = targetBalance.plus(matchedAmount);
      } else {
        // Was an income, so balance was increased. Reverse by subtracting.
        targetBalance = targetBalance.minus(matchedAmount);
      }

      await db
        .update(accounts)
        .set({ currentBalance: targetBalance.toNumber() })
        .where(eq(accounts.id, targetAccountId));

      // Convert matched transaction to appropriate transfer type
      if (isExpense) {
        // Original is expense (transfer_out), matched should be income → transfer_in
        await db
          .update(transactions)
          .set({
            type: 'transfer_in',
            transferId: id, // Link to the transfer_out transaction
            merchantId: transaction.accountId, // Store source account ID for display
            categoryId: null, // Transfers don't have categories
            description: `Transfer: ${sourceAccount.name} → ${targetAccount.name}`,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(transactions.id, matchingTransactionId));
      } else {
        // Original is income (transfer_in), matched should be expense → transfer_out
        await db
          .update(transactions)
          .set({
            type: 'transfer_out',
            transferId: transaction.accountId, // Destination account ID
            categoryId: null,
            description: `Transfer: ${targetAccount.name} → ${sourceAccount.name}`,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(transactions.id, matchingTransactionId));
      }
    } else {
      // Case 2: Create new paired transaction
      pairedTransactionId = nanoid();

      await db.insert(transactions).values({
        id: pairedTransactionId,
        userId,
        accountId: targetAccountId,
        categoryId: null, // Transfers don't have categories
        merchantId: isExpense ? transaction.accountId : null, // For transfer_in, store source account ID
        date: transaction.date,
        amount: amount.toNumber(),
        description: isExpense
          ? `Transfer: ${sourceAccount.name} → ${targetAccount.name}`
          : `Transfer: ${targetAccount.name} → ${sourceAccount.name}`,
        notes: transaction.notes,
        type: isExpense ? 'transfer_in' : 'transfer_out',
        transferId: isExpense ? id : transaction.accountId, // transfer_in: paired tx ID, transfer_out: dest account ID
        isPending: transaction.isPending,
        offlineId: null,
        syncStatus: 'synced',
        syncedAt: new Date().toISOString(),
        syncAttempts: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    // Reverse the balance effect of the original transaction
    // We need to undo its effect on the source account since it's changing types
    let sourceBalance = new Decimal(sourceAccount.currentBalance || 0);
    if (isExpense) {
      // Was an expense, balance was decreased. Reverse by adding back.
      sourceBalance = sourceBalance.plus(amount);
    } else {
      // Was an income, balance was increased. Reverse by subtracting.
      sourceBalance = sourceBalance.minus(amount);
    }

    await db
      .update(accounts)
      .set({ currentBalance: sourceBalance.toNumber() })
      .where(eq(accounts.id, transaction.accountId));

    // Convert original transaction to appropriate transfer type
    if (isExpense) {
      // expense → transfer_out (money leaving source account)
      await db
        .update(transactions)
        .set({
          type: 'transfer_out',
          transferId: targetAccountId, // Link metadata (points to destination account)
          categoryId: null, // Transfers don't have categories
          description: `Transfer: ${sourceAccount.name} → ${targetAccount.name}`,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(transactions.id, id));
    } else {
      // income → transfer_in (money entering source account - from targetAccount)
      // Store source account ID in merchantId since merchants aren't used for transfers
      await db
        .update(transactions)
        .set({
          type: 'transfer_in',
          transferId: pairedTransactionId, // Link to transfer_out transaction
          merchantId: targetAccountId, // HACK: Store source account ID here for display
          categoryId: null,
          description: `Transfer: ${targetAccount.name} → ${sourceAccount.name}`,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(transactions.id, id));

    }

    // Apply new transfer balance effects
    // Fetch updated balances
    const updatedSourceAccount = await db
      .select()
      .from(accounts)
      .where(eq(accounts.id, transaction.accountId))
      .limit(1);

    const updatedTargetAccount = await db
      .select()
      .from(accounts)
      .where(eq(accounts.id, targetAccountId))
      .limit(1);

    if (updatedSourceAccount.length > 0 && updatedTargetAccount.length > 0) {
      let newSourceBalance = new Decimal(updatedSourceAccount[0].currentBalance || 0);
      let newTargetBalance = new Decimal(updatedTargetAccount[0].currentBalance || 0);

      if (isExpense) {
        // transfer_out: money leaves source, enters target
        newSourceBalance = newSourceBalance.minus(amount);
        newTargetBalance = newTargetBalance.plus(amount);
      } else {
        // transfer_in: money enters source, leaves target
        newSourceBalance = newSourceBalance.plus(amount);
        newTargetBalance = newTargetBalance.minus(amount);
      }

      await db
        .update(accounts)
        .set({ currentBalance: newSourceBalance.toNumber() })
        .where(eq(accounts.id, transaction.accountId));

      await db
        .update(accounts)
        .set({ currentBalance: newTargetBalance.toNumber() })
        .where(eq(accounts.id, targetAccountId));
    }

    return Response.json(
      {
        id: id,
        pairedTransactionId,
        matched: matchedExistingTransaction,
        message: 'Transaction converted to transfer successfully',
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Convert to transfer error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
