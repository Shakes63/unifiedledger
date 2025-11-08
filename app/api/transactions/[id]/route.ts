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
      date,
      amount,
      description,
      notes,
      isPending,
    } = body;

    // Validate at least one field is provided for update
    if (!accountId && !categoryId && !date && !amount && !description && !notes && isPending === undefined) {
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
        if (transaction.type === 'expense' || transaction.type === 'transfer_out') {
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
        if (transaction.type === 'expense' || transaction.type === 'transfer_out') {
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

    // Reverse balance effect on account
    const account = await db
      .select()
      .from(accounts)
      .where(eq(accounts.id, transaction.accountId))
      .limit(1);

    if (account.length > 0) {
      let newBalance = new Decimal(account[0].currentBalance || 0);
      if (transaction.type === 'expense' || transaction.type === 'transfer_out') {
        newBalance = newBalance.plus(decimalAmount);
      } else {
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
