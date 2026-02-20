import { requireAuth } from '@/lib/auth-helpers';
import { getHouseholdIdFromRequest, requireHouseholdAuth } from '@/lib/api/household-auth';
import { db } from '@/lib/db';
import { transactions, accounts } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { handleRouteError } from '@/lib/api/route-helpers';
import { runInDatabaseTransaction } from '@/lib/db/transaction-runner';
import {
  getAccountBalanceCents,
  getTransactionAmountCents,
  insertTransactionMovement,
  insertTransferMovement,
  updateScopedAccountBalance,
} from '@/lib/transactions/money-movement-service';
import { linkExistingTransactionsAsCanonicalTransfer } from '@/lib/transactions/transfer-service';

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

    const householdId = getHouseholdIdFromRequest(request, body);
    await requireHouseholdAuth(userId, householdId);
    if (!householdId) {
      return Response.json(
        { error: 'Household ID is required' },
        { status: 400 }
      );
    }

    if (!targetAccountId) {
      return Response.json(
        { error: 'Target account ID is required' },
        { status: 400 }
      );
    }

    const originalTx = await db
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.id, id),
          eq(transactions.userId, userId),
          eq(transactions.householdId, householdId)
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
    if (transaction.type === 'transfer_out' || transaction.type === 'transfer_in') {
      return Response.json(
        { error: 'Transaction is already a transfer' },
        { status: 400 }
      );
    }

    if (transaction.accountId === targetAccountId) {
      return Response.json(
        { error: 'Cannot transfer to the same account' },
        { status: 400 }
      );
    }

    const [targetAccountResult, sourceAccountResult] = await Promise.all([
      db
        .select()
        .from(accounts)
        .where(
          and(
            eq(accounts.id, targetAccountId),
            eq(accounts.userId, userId),
            eq(accounts.householdId, householdId)
          )
        )
        .limit(1),
      db
        .select()
        .from(accounts)
        .where(
          and(
            eq(accounts.id, transaction.accountId),
            eq(accounts.userId, userId),
            eq(accounts.householdId, householdId)
          )
        )
        .limit(1),
    ]);

    if (targetAccountResult.length === 0) {
      return Response.json(
        { error: 'Target account not found in household' },
        { status: 404 }
      );
    }
    if (sourceAccountResult.length === 0) {
      return Response.json(
        { error: 'Source account not found' },
        { status: 404 }
      );
    }

    const targetAccount = targetAccountResult[0];
    const sourceAccount = sourceAccountResult[0];
    const amountCents = getTransactionAmountCents(transaction);
    const isExpense = transaction.type === 'expense';

    if (matchingTransactionId) {
      const matchingTx = await db
        .select()
        .from(transactions)
        .where(
          and(
            eq(transactions.id, matchingTransactionId),
            eq(transactions.userId, userId),
            eq(transactions.householdId, householdId)
          )
        )
        .limit(1);

      if (matchingTx.length === 0) {
        return Response.json(
          { error: 'Matching transaction not found in household' },
          { status: 404 }
        );
      }

      const matched = matchingTx[0];

      if (matched.type === 'transfer_out' || matched.type === 'transfer_in') {
        return Response.json(
          { error: 'Matching transaction is already a transfer' },
          { status: 400 }
        );
      }

      if (matched.accountId !== targetAccountId) {
        return Response.json(
          { error: 'Matching transaction must be on the target account' },
          { status: 400 }
        );
      }

      const matchedAmountCents = getTransactionAmountCents(matched);
      if (matchedAmountCents !== amountCents) {
        return Response.json(
          { error: 'Transaction amounts do not match' },
          { status: 400 }
        );
      }

      const isMatchedExpense = matched.type === 'expense';
      if (isExpense === isMatchedExpense) {
        return Response.json(
          { error: 'Transactions must be opposite types (expense/income)' },
          { status: 400 }
        );
      }

      const result = await linkExistingTransactionsAsCanonicalTransfer({
        userId,
        householdId,
        firstTransactionId: id,
        secondTransactionId: matchingTransactionId,
      });

      return Response.json(
        {
          id,
          pairedTransactionId: matchingTransactionId,
          transferGroupId: result.transferGroupId,
          matched: true,
          message: 'Transaction converted to transfer successfully',
        },
        { status: 200 }
      );
    }

    const transferGroupId = nanoid();
    const pairedTransactionId = nanoid();
    const nowIso = new Date().toISOString();

    await runInDatabaseTransaction(async (tx) => {
      if (isExpense) {
        await tx
          .update(transactions)
          .set({
            type: 'transfer_out',
            categoryId: null,
            merchantId: null,
            transferId: transferGroupId,
            transferGroupId,
            pairedTransactionId,
            transferSourceAccountId: transaction.accountId,
            transferDestinationAccountId: targetAccountId,
            description: `Transfer: ${sourceAccount.name} -> ${targetAccount.name}`,
            updatedAt: nowIso,
          })
          .where(eq(transactions.id, id));

        await insertTransactionMovement(tx, {
          id: pairedTransactionId,
          userId,
          householdId,
          accountId: targetAccountId,
          categoryId: null,
          merchantId: null,
          date: transaction.date,
          amountCents,
          description: `Transfer: ${sourceAccount.name} -> ${targetAccount.name}`,
          notes: transaction.notes,
          type: 'transfer_in',
          transferId: transferGroupId,
          transferGroupId,
          pairedTransactionId: id,
          transferSourceAccountId: transaction.accountId,
          transferDestinationAccountId: targetAccountId,
          isPending: transaction.isPending,
          createdAt: nowIso,
          updatedAt: nowIso,
        });

        const refreshedTarget = await tx
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

        if (refreshedTarget.length > 0) {
          await updateScopedAccountBalance(tx, {
            accountId: targetAccountId,
            userId,
            householdId,
            balanceCents: getAccountBalanceCents(refreshedTarget[0]) + amountCents,
          });
        }

        await insertTransferMovement(tx, {
          id: transferGroupId,
          userId,
          householdId,
          fromAccountId: transaction.accountId,
          toAccountId: targetAccountId,
          amountCents,
          feesCents: 0,
          description: transaction.description,
          date: transaction.date,
          status: 'completed',
          fromTransactionId: id,
          toTransactionId: pairedTransactionId,
          notes: transaction.notes,
          createdAt: nowIso,
        });
      } else {
        await tx
          .update(transactions)
          .set({
            type: 'transfer_in',
            categoryId: null,
            merchantId: null,
            transferId: transferGroupId,
            transferGroupId,
            pairedTransactionId,
            transferSourceAccountId: targetAccountId,
            transferDestinationAccountId: transaction.accountId,
            description: `Transfer: ${targetAccount.name} -> ${sourceAccount.name}`,
            updatedAt: nowIso,
          })
          .where(eq(transactions.id, id));

        await insertTransactionMovement(tx, {
          id: pairedTransactionId,
          userId,
          householdId,
          accountId: targetAccountId,
          categoryId: null,
          merchantId: null,
          date: transaction.date,
          amountCents,
          description: `Transfer: ${targetAccount.name} -> ${sourceAccount.name}`,
          notes: transaction.notes,
          type: 'transfer_out',
          transferId: transferGroupId,
          transferGroupId,
          pairedTransactionId: id,
          transferSourceAccountId: targetAccountId,
          transferDestinationAccountId: transaction.accountId,
          isPending: transaction.isPending,
          createdAt: nowIso,
          updatedAt: nowIso,
        });

        const refreshedTarget = await tx
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

        if (refreshedTarget.length > 0) {
          await updateScopedAccountBalance(tx, {
            accountId: targetAccountId,
            userId,
            householdId,
            balanceCents: getAccountBalanceCents(refreshedTarget[0]) - amountCents,
          });
        }

        await insertTransferMovement(tx, {
          id: transferGroupId,
          userId,
          householdId,
          fromAccountId: targetAccountId,
          toAccountId: transaction.accountId,
          amountCents,
          feesCents: 0,
          description: transaction.description,
          date: transaction.date,
          status: 'completed',
          fromTransactionId: pairedTransactionId,
          toTransactionId: id,
          notes: transaction.notes,
          createdAt: nowIso,
        });
      }
    });

    return Response.json(
      {
        id,
        pairedTransactionId,
        transferGroupId,
        matched: false,
        message: 'Transaction converted to transfer successfully',
      },
      { status: 200 }
    );
  } catch (error) {
    return handleRouteError(error, {
      defaultError: 'Internal server error',
      logLabel: 'Convert to transfer error:',
    });
  }
}
