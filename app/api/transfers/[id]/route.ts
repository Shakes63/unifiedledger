import { requireAuth } from '@/lib/auth-helpers';
import { getAndVerifyHousehold } from '@/lib/api/household-auth';
import { db } from '@/lib/db';
import { transfers, accounts, transactions } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import Decimal from 'decimal.js';

export const dynamic = 'force-dynamic';

/**
 * GET /api/transfers/[id]
 * Get a specific transfer by ID
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const { userId } = await requireAuth();
    const { householdId } = await getAndVerifyHousehold(request, userId);

    const transfer = await db
      .select()
      .from(transfers)
      .where(
        and(
          eq(transfers.id, id),
          eq(transfers.userId, userId)
        )
      )
      .limit(1);

    if (transfer.length === 0) {
      return Response.json(
        { error: 'Transfer not found' },
        { status: 404 }
      );
    }

    // Enrich with account names
    const [fromAccount, toAccount] = await Promise.all([
      db
        .select()
        .from(accounts)
        .where(
          and(
            eq(accounts.id, transfer[0].fromAccountId),
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
            eq(accounts.id, transfer[0].toAccountId),
            eq(accounts.userId, userId),
            eq(accounts.householdId, householdId)
          )
        )
        .limit(1),
    ]);

    if (fromAccount.length === 0 || toAccount.length === 0) {
      return Response.json(
        { error: 'Transfer not found' },
        { status: 404 }
      );
    }

    return Response.json({
      ...transfer[0],
      fromAccountName: fromAccount[0]?.name,
      toAccountName: toAccount[0]?.name,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error fetching transfer:', error);
    return Response.json(
      { error: 'Failed to fetch transfer' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/transfers/[id]
 * Update a transfer (only pending transfers can be updated)
 * Body: { description, notes }
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const { userId } = await requireAuth();
    const { householdId } = await getAndVerifyHousehold(request, userId);

    const transfer = await db
      .select()
      .from(transfers)
      .where(
        and(
          eq(transfers.id, id),
          eq(transfers.userId, userId)
        )
      )
      .limit(1);

    if (transfer.length === 0) {
      return Response.json(
        { error: 'Transfer not found' },
        { status: 404 }
      );
    }

    const [fromAccount, toAccount] = await Promise.all([
      db
        .select()
        .from(accounts)
        .where(
          and(
            eq(accounts.id, transfer[0].fromAccountId),
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
            eq(accounts.id, transfer[0].toAccountId),
            eq(accounts.userId, userId),
            eq(accounts.householdId, householdId)
          )
        )
        .limit(1),
    ]);

    if (fromAccount.length === 0 || toAccount.length === 0) {
      return Response.json(
        { error: 'Transfer not found' },
        { status: 404 }
      );
    }

    // Only allow updating metadata like description and notes
    // Amount, accounts, and date cannot be changed
    const body = await request.json();
    const { description, notes } = body;

    const updateData: Partial<typeof transfers.$inferInsert> = {};
    if (description !== undefined) updateData.description = description;
    if (notes !== undefined) updateData.notes = notes;

    if (Object.keys(updateData).length === 0) {
      return Response.json(
        { error: 'No fields to update' },
        { status: 400 }
      );
    }

    await db
      .update(transfers)
      .set(updateData)
      .where(and(eq(transfers.id, id), eq(transfers.userId, userId)));

    return Response.json({
      message: 'Transfer updated successfully',
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error updating transfer:', error);
    return Response.json(
      { error: 'Failed to update transfer' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/transfers/[id]
 * Delete a transfer and revert account balances
 * Only pending transfers can be deleted
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const { userId } = await requireAuth();
    const { householdId } = await getAndVerifyHousehold(request, userId);

    const transfer = await db
      .select()
      .from(transfers)
      .where(
        and(
          eq(transfers.id, id),
          eq(transfers.userId, userId)
        )
      )
      .limit(1);

    if (transfer.length === 0) {
      return Response.json(
        { error: 'Transfer not found' },
        { status: 404 }
      );
    }

    const transferData = transfer[0];

    // Start transaction to delete transfer and revert balances
    await db.transaction(async (tx) => {
      // Delete the transfer
      await tx
        .delete(transfers)
        .where(and(eq(transfers.id, id), eq(transfers.userId, userId)));

      // Delete associated transactions if they exist
      if (transferData.fromTransactionId) {
        await tx
          .delete(transactions)
          .where(
            and(
              eq(transactions.id, transferData.fromTransactionId),
              eq(transactions.userId, userId),
              eq(transactions.householdId, householdId)
            )
          );
      }

      if (transferData.toTransactionId) {
        await tx
          .delete(transactions)
          .where(
            and(
              eq(transactions.id, transferData.toTransactionId),
              eq(transactions.userId, userId),
              eq(transactions.householdId, householdId)
            )
          );
      }

      // Revert account balances
      const [fromAccount, toAccount] = await Promise.all([
        tx
          .select()
          .from(accounts)
          .where(
            and(
              eq(accounts.id, transferData.fromAccountId),
              eq(accounts.userId, userId),
              eq(accounts.householdId, householdId)
            )
          )
          .limit(1),
        tx
          .select()
          .from(accounts)
          .where(
            and(
              eq(accounts.id, transferData.toAccountId),
              eq(accounts.userId, userId),
              eq(accounts.householdId, householdId)
            )
          )
          .limit(1),
      ]);

      if (fromAccount.length > 0) {
        const transferAmount = new Decimal(
          transferData.amount || 0
        );
        const transferFees = new Decimal(
          transferData.fees || 0
        );
        const totalDebit = transferAmount.plus(transferFees);

        const newFromBalance = new Decimal(
          fromAccount[0].currentBalance || 0
        ).plus(totalDebit);

        await tx
          .update(accounts)
          .set({
            currentBalance: parseFloat(
              newFromBalance.toString()
            ),
          })
          .where(
            and(
              eq(accounts.id, transferData.fromAccountId),
              eq(accounts.userId, userId),
              eq(accounts.householdId, householdId)
            )
          );
      }

      if (toAccount.length > 0) {
        const transferAmount = new Decimal(
          transferData.amount || 0
        );
        const newToBalance = new Decimal(
          toAccount[0].currentBalance || 0
        ).minus(transferAmount);

        await tx
          .update(accounts)
          .set({
            currentBalance: parseFloat(
              newToBalance.toString()
            ),
          })
          .where(
            and(
              eq(accounts.id, transferData.toAccountId),
              eq(accounts.userId, userId),
              eq(accounts.householdId, householdId)
            )
          );
      }
    });

    return Response.json({
      message: 'Transfer deleted successfully',
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error deleting transfer:', error);
    return Response.json(
      { error: 'Failed to delete transfer' },
      { status: 500 }
    );
  }
}
