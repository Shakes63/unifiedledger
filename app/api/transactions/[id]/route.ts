import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { transactions, accounts, budgetCategories, transactionSplits } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import Decimal from 'decimal.js';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    const { id } = await params;

    if (!userId) {
      return Response.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const transaction = await db
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.id, id),
          eq(transactions.userId, userId)
        )
      )
      .limit(1);

    if (transaction.length === 0) {
      return Response.json(
        { error: 'Transaction not found' },
        { status: 404 }
      );
    }

    return Response.json(transaction[0]);
  } catch (error) {
    console.error('Transaction fetch error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    const { id } = await params;

    if (!userId) {
      return Response.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get existing transaction
    const existingTransaction = await db
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.id, id),
          eq(transactions.userId, userId)
        )
      )
      .limit(1);

    if (existingTransaction.length === 0) {
      return Response.json(
        { error: 'Transaction not found' },
        { status: 404 }
      );
    }

    const transaction = existingTransaction[0];
    const body = await request.json();

    const {
      accountId,
      categoryId,
      merchantId,
      date,
      amount,
      description,
      notes,
      isPending,
    } = body;

    // Validate at least one field is provided for update
    if (!accountId && !categoryId && !merchantId && !date && !amount && !description && !notes && isPending === undefined) {
      return Response.json(
        { error: 'No fields to update' },
        { status: 400 }
      );
    }

    // Use existing values for fields not provided
    const newAccountId = accountId || transaction.accountId;
    const newAmount = amount ? new Decimal(amount) : new Decimal(transaction.amount);
    const newDate = date || transaction.date;
    const newDescription = description || transaction.description;
    const newNotes = notes !== undefined ? notes : transaction.notes;
    const newIsPending = isPending !== undefined ? isPending : transaction.isPending;
    const newCategoryId = categoryId !== undefined ? categoryId : transaction.categoryId;
    const newMerchantId = merchantId !== undefined ? merchantId : transaction.merchantId;

    // If accountId changed, verify new account exists
    if (newAccountId !== transaction.accountId) {
      const newAccount = await db
        .select()
        .from(accounts)
        .where(
          and(
            eq(accounts.id, newAccountId),
            eq(accounts.userId, userId)
          )
        )
        .limit(1);

      if (newAccount.length === 0) {
        return Response.json(
          { error: 'Account not found' },
          { status: 404 }
        );
      }
    }

    // If category provided and not null, verify it exists
    if (newCategoryId) {
      const category = await db
        .select()
        .from(budgetCategories)
        .where(
          and(
            eq(budgetCategories.id, newCategoryId),
            eq(budgetCategories.userId, userId)
          )
        )
        .limit(1);

      if (category.length === 0) {
        return Response.json(
          { error: 'Category not found' },
          { status: 404 }
        );
      }
    }

    // Handle balance adjustments if amount or account changed
    if (amount || newAccountId !== transaction.accountId) {
      const oldDecimalAmount = new Decimal(transaction.amount);
      const oldAccount = await db
        .select()
        .from(accounts)
        .where(eq(accounts.id, transaction.accountId))
        .limit(1);

      const newAccount = await db
        .select()
        .from(accounts)
        .where(eq(accounts.id, newAccountId))
        .limit(1);

      if (oldAccount.length > 0 && newAccount.length > 0) {
        // Reverse old transaction effect
        let oldBalance = new Decimal(oldAccount[0].currentBalance || 0);
        if (transaction.type === 'expense' || transaction.type === 'transfer_out' || transaction.type === 'transfer') {
          oldBalance = oldBalance.plus(oldDecimalAmount);
        } else {
          oldBalance = oldBalance.minus(oldDecimalAmount);
        }

        await db
          .update(accounts)
          .set({ currentBalance: oldBalance.toNumber() })
          .where(eq(accounts.id, transaction.accountId));

        // Apply new transaction effect
        let newBalance = new Decimal(newAccount[0].currentBalance || 0);
        if (transaction.type === 'expense' || transaction.type === 'transfer_out' || transaction.type === 'transfer') {
          newBalance = newBalance.minus(newAmount);
        } else {
          newBalance = newBalance.plus(newAmount);
        }

        await db
          .update(accounts)
          .set({ currentBalance: newBalance.toNumber() })
          .where(eq(accounts.id, newAccountId));
      }
    }

    // Update transaction
    await db
      .update(transactions)
      .set({
        accountId: newAccountId,
        categoryId: newCategoryId,
        merchantId: newMerchantId,
        date: newDate,
        amount: newAmount.toNumber(),
        description: newDescription,
        notes: newNotes,
        isPending: newIsPending,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(transactions.id, id));

    return Response.json(
      {
        id: id,
        message: 'Transaction updated successfully',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Transaction update error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    const { id } = await params;

    if (!userId) {
      return Response.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get transaction to verify ownership and get details
    const existingTransaction = await db
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.id, id),
          eq(transactions.userId, userId)
        )
      )
      .limit(1);

    if (existingTransaction.length === 0) {
      return Response.json(
        { error: 'Transaction not found' },
        { status: 404 }
      );
    }

    const transaction = existingTransaction[0];
    const decimalAmount = new Decimal(transaction.amount);

    // Delete all splits if transaction has splits
    if (transaction.isSplit) {
      await db
        .delete(transactionSplits)
        .where(
          and(
            eq(transactionSplits.userId, userId),
            eq(transactionSplits.transactionId, id)
          )
        );
    }

    // Handle transfer pairs - need to delete both sides and reverse both balances
    if (transaction.type === 'transfer_out' || transaction.type === 'transfer_in') {
      let pairedTransactionId: string | null = null;

      // Find the paired transaction
      if (transaction.type === 'transfer_out') {
        // This is the source transaction, transferId points to destination account
        // Find transfer_in transaction that has this transaction's ID in its transferId
        const pairedTx = await db
          .select()
          .from(transactions)
          .where(
            and(
              eq(transactions.userId, userId),
              eq(transactions.type, 'transfer_in'),
              eq(transactions.transferId, id)
            )
          )
          .limit(1);

        if (pairedTx.length > 0) {
          pairedTransactionId = pairedTx[0].id;

          // Reverse balance on destination account (subtract the amount that was added)
          const destAccountId = pairedTx[0].accountId;
          const destAccount = await db
            .select()
            .from(accounts)
            .where(eq(accounts.id, destAccountId))
            .limit(1);

          if (destAccount.length > 0) {
            const destBalance = new Decimal(destAccount[0].currentBalance || 0);
            const reversedDestBalance = destBalance.minus(decimalAmount);

            await db
              .update(accounts)
              .set({ currentBalance: reversedDestBalance.toNumber() })
              .where(eq(accounts.id, destAccountId));
          }
        }
      } else if (transaction.type === 'transfer_in') {
        // This is the destination transaction, transferId points to transfer_out transaction
        pairedTransactionId = transaction.transferId;

        if (pairedTransactionId) {
          const pairedTx = await db
            .select()
            .from(transactions)
            .where(
              and(
                eq(transactions.id, pairedTransactionId),
                eq(transactions.userId, userId)
              )
            )
            .limit(1);

          if (pairedTx.length > 0) {
            // Reverse balance on source account (add back the amount that was subtracted)
            const sourceAccountId = pairedTx[0].accountId;
            const sourceAccount = await db
              .select()
              .from(accounts)
              .where(eq(accounts.id, sourceAccountId))
              .limit(1);

            if (sourceAccount.length > 0) {
              const sourceBalance = new Decimal(sourceAccount[0].currentBalance || 0);
              const reversedSourceBalance = sourceBalance.plus(decimalAmount);

              await db
                .update(accounts)
                .set({ currentBalance: reversedSourceBalance.toNumber() })
                .where(eq(accounts.id, sourceAccountId));
            }
          }
        }
      }

      // Reverse balance on the current transaction's account
      const account = await db
        .select()
        .from(accounts)
        .where(eq(accounts.id, transaction.accountId))
        .limit(1);

      if (account.length > 0) {
        let newBalance = new Decimal(account[0].currentBalance || 0);
        if (transaction.type === 'transfer_out') {
          // Reverse by adding back (it was subtracted)
          newBalance = newBalance.plus(decimalAmount);
        } else {
          // transfer_in: Reverse by subtracting (it was added)
          newBalance = newBalance.minus(decimalAmount);
        }

        await db
          .update(accounts)
          .set({ currentBalance: newBalance.toNumber() })
          .where(eq(accounts.id, transaction.accountId));
      }

      // Delete the paired transaction first
      if (pairedTransactionId) {
        await db
          .delete(transactions)
          .where(
            and(
              eq(transactions.id, pairedTransactionId),
              eq(transactions.userId, userId)
            )
          );
      }

      // Delete the current transaction
      await db
        .delete(transactions)
        .where(
          and(
            eq(transactions.id, id),
            eq(transactions.userId, userId)
          )
        );
    } else {
      // Non-transfer transaction: reverse balance and delete
      const account = await db
        .select()
        .from(accounts)
        .where(eq(accounts.id, transaction.accountId))
        .limit(1);

      if (account.length > 0) {
        let newBalance = new Decimal(account[0].currentBalance || 0);
        if (transaction.type === 'expense') {
          // Reverse by adding back (it was subtracted)
          newBalance = newBalance.plus(decimalAmount);
        } else {
          // income: Reverse by subtracting (it was added)
          newBalance = newBalance.minus(decimalAmount);
        }

        await db
          .update(accounts)
          .set({ currentBalance: newBalance.toNumber() })
          .where(eq(accounts.id, transaction.accountId));
      }

      // Delete transaction
      await db
        .delete(transactions)
        .where(
          and(
            eq(transactions.id, id),
            eq(transactions.userId, userId)
          )
        );
    }

    return Response.json(
      { message: 'Transaction deleted successfully' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Transaction delete error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
