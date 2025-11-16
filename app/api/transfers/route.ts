import { requireAuth } from '@/lib/auth-helpers';
import { getHouseholdIdFromRequest, requireHouseholdAuth } from '@/lib/api/household-auth';
import { db } from '@/lib/db';
import {
  transfers,
  accounts,
  usageAnalytics,
  transactions,
} from '@/lib/db/schema';
import { eq, and, desc, lte, gte } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import Decimal from 'decimal.js';

export const dynamic = 'force-dynamic';

/**
 * GET /api/transfers
 * List all transfers for the authenticated user with pagination
 * Query params: limit, offset, fromDate, toDate
 */
export async function GET(request: Request) {
  try {
    const { userId } = await requireAuth();

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const fromDate = searchParams.get('fromDate');
    const toDate = searchParams.get('toDate');

    // Build filters
    const filters = [eq(transfers.userId, userId)];

    if (fromDate) {
      filters.push(gte(transfers.date, fromDate));
    }

    if (toDate) {
      filters.push(lte(transfers.date, toDate));
    }

    // Get total count
    const countResult = await db
      .select()
      .from(transfers)
      .where(and(...filters));

    // Get paginated results
    const transferList = await db
      .select()
      .from(transfers)
      .where(and(...filters))
      .orderBy(desc(transfers.date))
      .limit(limit)
      .offset(offset);

    // Enrich with account names
    const enrichedTransfers = await Promise.all(
      transferList.map(async (transfer) => {
        const [fromAccount, toAccount] = await Promise.all([
          db
            .select()
            .from(accounts)
            .where(eq(accounts.id, transfer.fromAccountId))
            .limit(1),
          db
            .select()
            .from(accounts)
            .where(eq(accounts.id, transfer.toAccountId))
            .limit(1),
        ]);

        return {
          ...transfer,
          fromAccountName: fromAccount[0]?.name || 'Unknown',
          toAccountName: toAccount[0]?.name || 'Unknown',
        };
      })
    );

    return Response.json({
      transfers: enrichedTransfers,
      total: countResult.length,
      limit,
      offset,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error fetching transfers:', error);
    return Response.json(
      { error: 'Failed to fetch transfers' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/transfers
 * Create a new transfer between accounts
 * Body: { fromAccountId, toAccountId, amount, date, description, fees, notes }
 */
export async function POST(request: Request) {
  try {
    const { userId } = await requireAuth();

    const body = await request.json();
    const {
      fromAccountId,
      toAccountId,
      amount,
      date,
      description = 'Transfer',
      fees = 0,
      notes,
    } = body;

    // Get and validate household
    const householdId = getHouseholdIdFromRequest(request, body);
    await requireHouseholdAuth(userId, householdId);

    // TypeScript: householdId is guaranteed to be non-null after requireHouseholdAuth
    if (!householdId) {
      return Response.json(
        { error: 'Household ID is required' },
        { status: 400 }
      );
    }

    // Validate required fields
    if (!fromAccountId || !toAccountId || !amount || !date) {
      return Response.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Cannot transfer to the same account
    if (fromAccountId === toAccountId) {
      return Response.json(
        { error: 'Cannot transfer to the same account' },
        { status: 400 }
      );
    }

    // Validate both accounts exist and belong to user
    const [fromAccount, toAccount] = await Promise.all([
      db
        .select()
        .from(accounts)
        .where(
          and(
            eq(accounts.id, fromAccountId),
            eq(accounts.userId, userId)
          )
        )
        .limit(1),
      db
        .select()
        .from(accounts)
        .where(
          and(
            eq(accounts.id, toAccountId),
            eq(accounts.userId, userId)
          )
        )
        .limit(1),
    ]);

    if (fromAccount.length === 0 || toAccount.length === 0) {
      return Response.json(
        { error: 'One or both accounts not found' },
        { status: 404 }
      );
    }

    const transferAmount = new Decimal(amount);
    const transferFees = new Decimal(fees || 0);
    const totalDebit = transferAmount.plus(transferFees);

    // Create transfer record
    const transferId = nanoid();

    // Create two transactions: one for withdrawal, one for deposit
    const fromTransactionId = nanoid();
    const toTransactionId = nanoid();

    // Start transaction
    const result = await db.transaction(async (tx) => {
      // Create withdrawal transaction (from account)
      await tx.insert(transactions).values({
        id: fromTransactionId,
        userId,
        householdId,
        accountId: fromAccountId,
        amount: parseFloat(totalDebit.negated().toString()), // Negative for withdrawal
        description: `Transfer to ${toAccount[0].name}`,
        date,
        type: 'transfer_out',
        notes: notes,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      // Create deposit transaction (to account)
      await tx.insert(transactions).values({
        id: toTransactionId,
        userId,
        householdId,
        accountId: toAccountId,
        amount: parseFloat(transferAmount.toString()), // Positive for deposit
        description: `Transfer from ${fromAccount[0].name}`,
        date,
        type: 'transfer_in',
        notes: notes,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      // Create transfer record
      await tx.insert(transfers).values({
        id: transferId,
        userId,
        fromAccountId,
        toAccountId,
        amount: parseFloat(transferAmount.toString()),
        description,
        date,
        status: 'completed',
        fromTransactionId,
        toTransactionId,
        fees: parseFloat(transferFees.toString()),
        notes,
        createdAt: new Date().toISOString(),
      });

      // Update account balances
      const newFromBalance = new Decimal(
        fromAccount[0].currentBalance || 0
      ).minus(totalDebit);
      const newToBalance = new Decimal(
        toAccount[0].currentBalance || 0
      ).plus(transferAmount);

      await tx
        .update(accounts)
        .set({
          currentBalance: parseFloat(newFromBalance.toString()),
          lastUsedAt: new Date().toISOString(),
        })
        .where(eq(accounts.id, fromAccountId));

      await tx
        .update(accounts)
        .set({
          currentBalance: parseFloat(newToBalance.toString()),
          lastUsedAt: new Date().toISOString(),
        })
        .where(eq(accounts.id, toAccountId));

      // Track transfer pair usage
      const transferPairKey = `${fromAccountId}→${toAccountId}`;
      const existingAnalytics = await tx
        .select()
        .from(usageAnalytics)
        .where(
          and(
            eq(usageAnalytics.userId, userId),
            eq(usageAnalytics.itemType, 'transfer_pair'),
            eq(usageAnalytics.itemId, fromAccountId),
            eq(usageAnalytics.itemSecondaryId, toAccountId)
          )
        )
        .limit(1);

      if (existingAnalytics.length > 0) {
        await tx
          .update(usageAnalytics)
          .set({
            usageCount:
              (existingAnalytics[0].usageCount || 0) + 1,
            lastUsedAt: new Date().toISOString(),
          })
          .where(eq(usageAnalytics.id, existingAnalytics[0].id));
      } else {
          await tx.insert(usageAnalytics).values({
            id: nanoid(),
            userId,
            householdId,
            itemType: 'transfer_pair',
          itemId: fromAccountId,
          itemSecondaryId: toAccountId,
          usageCount: 1,
          lastUsedAt: new Date().toISOString(),
        });
      }

      return { transferId, fromTransactionId, toTransactionId };
    });

    return Response.json(
      {
        message: 'Transfer created successfully',
        transferId: result.transferId,
        fromTransactionId: result.fromTransactionId,
        toTransactionId: result.toTransactionId,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error creating transfer:', error);
    return Response.json(
      { error: 'Failed to create transfer' },
      { status: 500 }
    );
  }
}
