import { requireAuth } from '@/lib/auth-helpers';
import { getAndVerifyHousehold } from '@/lib/api/household-auth';
import { db } from '@/lib/db';
import {
  transfers,
  accounts,
  usageAnalytics,
} from '@/lib/db/schema';
import { eq, and, desc, lte, gte } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import Decimal from 'decimal.js';
import { handleRouteError } from '@/lib/api/route-helpers';
import {
  amountToCents,
} from '@/lib/transactions/money-movement-service';
import { createCanonicalTransferPair } from '@/lib/transactions/transfer-service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/transfers
 * List all transfers for the authenticated user with pagination
 * Query params: limit, offset, fromDate, toDate
 */
export async function handleListTransfers(request: Request) {
  try {
    const { userId } = await requireAuth();
    const { householdId } = await getAndVerifyHousehold(request, userId);

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const fromDate = searchParams.get('fromDate');
    const toDate = searchParams.get('toDate');

    // Build filters
    const filters = [
      eq(transfers.userId, userId),
      eq(transfers.householdId, householdId),
    ];

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
            .where(
              and(
                eq(accounts.id, transfer.fromAccountId),
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
                eq(accounts.id, transfer.toAccountId),
                eq(accounts.userId, userId),
                eq(accounts.householdId, householdId)
              )
            )
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
    return handleRouteError(error, {
      defaultError: 'Failed to fetch transfers',
      logLabel: 'Error fetching transfers:',
    });
  }
}

/**
 * POST /api/transfers
 * Create a new transfer between accounts
 * Body: { fromAccountId, toAccountId, amount, date, description, fees, notes }
 */
export async function handleCreateTransfer(request: Request) {
  try {
    const { userId } = await requireAuth();
    const body = await request.json();
    const { householdId } = await getAndVerifyHousehold(request, userId, body);
    const {
      fromAccountId,
      toAccountId,
      amount,
      date,
      description = 'Transfer',
      fees = 0,
      notes,
    } = body;

    // Validate required fields
    if (!fromAccountId || !toAccountId || amount === undefined || amount === null || !date) {
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

    let transferAmount: Decimal;
    let transferFees: Decimal;
    try {
      transferAmount = new Decimal(amount);
      transferFees = new Decimal(fees ?? 0);
    } catch {
      return Response.json(
        { error: 'Amount and fees must be valid numbers' },
        { status: 400 }
      );
    }

    if (!transferAmount.isFinite() || transferAmount.lte(0)) {
      return Response.json(
        { error: 'Amount must be greater than 0' },
        { status: 400 }
      );
    }

    if (!transferFees.isFinite() || transferFees.lt(0)) {
      return Response.json(
        { error: 'Fees must be 0 or greater' },
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
            eq(accounts.id, toAccountId),
            eq(accounts.userId, userId),
            eq(accounts.householdId, householdId)
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

    const transferAmountCents = amountToCents(transferAmount);
    const transferFeesCents = amountToCents(transferFees);

    const result = await createCanonicalTransferPair({
      userId,
      householdId,
      fromAccountId,
      toAccountId,
      amountCents: transferAmountCents,
      feesCents: transferFeesCents,
      date,
      description: description || `Transfer ${fromAccount[0].name} -> ${toAccount[0].name}`,
      notes: notes || null,
    });

    // Track transfer pair usage
    const existingAnalytics = await db
      .select()
      .from(usageAnalytics)
      .where(
        and(
          eq(usageAnalytics.userId, userId),
          eq(usageAnalytics.householdId, householdId),
          eq(usageAnalytics.itemType, 'transfer_pair'),
          eq(usageAnalytics.itemId, fromAccountId),
          eq(usageAnalytics.itemSecondaryId, toAccountId)
        )
      )
      .limit(1);

    if (existingAnalytics.length > 0) {
      await db
        .update(usageAnalytics)
        .set({
          usageCount: (existingAnalytics[0].usageCount || 0) + 1,
          lastUsedAt: new Date().toISOString(),
        })
        .where(eq(usageAnalytics.id, existingAnalytics[0].id));
    } else {
      await db.insert(usageAnalytics).values({
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

    return Response.json(
      {
        message: 'Transfer created successfully',
        transferId: result.transferGroupId,
        fromTransactionId: result.fromTransactionId,
        toTransactionId: result.toTransactionId,
      },
      { status: 201 }
    );
  } catch (error) {
    return handleRouteError(error, {
      defaultError: 'Failed to create transfer',
      logLabel: 'Error creating transfer:',
    });
  }
}
