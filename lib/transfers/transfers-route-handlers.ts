/**
 * Route handlers for /api/transfers: list (GET) and validated create (POST) through the canonical transfer engine.
 *
 * Consolidated from single-use shim files during the post-audit cleanup;
 * behavior is unchanged.
 */
import Decimal from 'decimal.js';
import { and, eq, desc, gte, inArray, isNull, lte, or } from 'drizzle-orm';
import { resolveAndRequireEntity } from '@/lib/api/entity-auth';
import { db } from '@/lib/db';
import { accounts, transfers } from '@/lib/db/schema';
import { requireAccountEntityAccess } from '@/lib/household/entities';
import { amountToCents } from '@/lib/transactions/money-movement-service';
import { validateCanonicalTransferInput } from '@/lib/transactions/transfer-contract';
import { requireAuth } from '@/lib/auth-helpers';
import { getAndVerifyHousehold } from '@/lib/api/household-auth';
import { handleRouteError } from '@/lib/api/route-helpers';
import { createCanonicalTransferPair } from '@/lib/transactions/transfer-service';
import { trackTransferPairUsage } from '@/lib/analytics/usage-analytics-service';

// ---------------------------------------------------------------------------
// from transfer-create-validation-helpers.ts
// ---------------------------------------------------------------------------
export class TransferCreateValidationError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = 'TransferCreateValidationError';
  }
}

function parseTransferMoneyValues({
  amount,
  fees,
}: {
  amount: unknown;
  fees?: unknown;
}): { transferAmount: Decimal; transferFees: Decimal } {
  let transferAmount: Decimal;
  let transferFees: Decimal;
  try {
    transferAmount = new Decimal(amount as Decimal.Value);
    transferFees = new Decimal((fees ?? 0) as Decimal.Value);
  } catch {
    throw new TransferCreateValidationError('Amount and fees must be valid numbers', 400);
  }

  if (!transferAmount.isFinite() || transferAmount.lte(0)) {
    throw new TransferCreateValidationError('Amount must be greater than 0', 400);
  }
  if (!transferFees.isFinite() || transferFees.lt(0)) {
    throw new TransferCreateValidationError('Fees must be 0 or greater', 400);
  }

  return { transferAmount, transferFees };
}

async function loadAndValidateTransferAccounts({
  userId,
  householdId,
  fromAccountId,
  toAccountId,
  request,
  body,
}: {
  userId: string;
  householdId: string;
  fromAccountId: string;
  toAccountId: string;
  request: Request;
  body: Record<string, unknown>;
}): Promise<{
  fromAccount: typeof accounts.$inferSelect;
  toAccount: typeof accounts.$inferSelect;
}> {
  const [fromAccountRows, toAccountRows] = await Promise.all([
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

  const fromAccount = fromAccountRows[0];
  const toAccount = toAccountRows[0];
  if (!fromAccount || !toAccount) {
    throw new TransferCreateValidationError('One or both accounts not found', 404);
  }

  const selectedEntity = await resolveAndRequireEntity(userId, householdId, request, body);
  const fromAccountEntity = await requireAccountEntityAccess(userId, householdId, fromAccount.entityId);
  if (fromAccountEntity.id !== selectedEntity.id) {
    throw new TransferCreateValidationError('Source account must belong to the selected entity', 403);
  }
  await requireAccountEntityAccess(userId, householdId, toAccount.entityId);

  return { fromAccount, toAccount };
}

// ---------------------------------------------------------------------------
// from transfer-create-validation.ts
// ---------------------------------------------------------------------------
interface ValidateTransferCreateInputParams {
  userId: string;
  householdId: string;
  request: Request;
  body: Record<string, unknown>;
  fromAccountId: string;
  toAccountId: string;
  amount: unknown;
  date: string;
  description?: string;
  fees?: unknown;
  notes?: string;
}

async function validateTransferCreateInput({
  userId,
  householdId,
  request,
  body,
  fromAccountId,
  toAccountId,
  amount,
  date,
  description,
  fees = 0,
  notes,
}: ValidateTransferCreateInputParams) {
  if (!fromAccountId || !toAccountId || amount === undefined || amount === null || !date) {
    throw new TransferCreateValidationError('Missing required fields', 400);
  }

  if (fromAccountId === toAccountId) {
    throw new TransferCreateValidationError('Cannot transfer to the same account', 400);
  }

  const { transferAmount, transferFees } = parseTransferMoneyValues({ amount, fees });
  const { fromAccount, toAccount } = await loadAndValidateTransferAccounts({
    userId,
    householdId,
    fromAccountId,
    toAccountId,
    request,
    body,
  });

  try {
    const transferPayload = validateCanonicalTransferInput({
      userId,
      householdId,
      fromAccountId,
      toAccountId,
      amountCents: amountToCents(transferAmount),
      feesCents: amountToCents(transferFees),
      date,
      description: description || `Transfer ${fromAccount.name} -> ${toAccount.name}`,
      notes: notes || null,
    });

    return {
      transferPayload,
      fromAccountId,
      toAccountId,
    };
  } catch (error) {
    throw new TransferCreateValidationError(
      error instanceof Error ? error.message : 'Invalid transfer payload',
      400
    );
  }
}

function mapTransferCreateValidationError(error: unknown): Response | null {
  if (error instanceof TransferCreateValidationError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  return null;
}

// ---------------------------------------------------------------------------
// from transfers-list-query.ts
// ---------------------------------------------------------------------------
function parseTransferListParams(request: Request): {
  limit: number;
  offset: number;
  fromDate: string | null;
  toDate: string | null;
} {
  const { searchParams } = new URL(request.url);
  return {
    limit: parseInt(searchParams.get('limit') || '50'),
    offset: parseInt(searchParams.get('offset') || '0'),
    fromDate: searchParams.get('fromDate'),
    toDate: searchParams.get('toDate'),
  };
}

async function listEntityScopedTransfers({
  userId,
  householdId,
  selectedEntityId,
  selectedEntityIsDefault,
  limit,
  offset,
  fromDate,
  toDate,
}: {
  userId: string;
  householdId: string;
  selectedEntityId: string;
  selectedEntityIsDefault: boolean;
  limit: number;
  offset: number;
  fromDate: string | null;
  toDate: string | null;
}): Promise<Array<typeof transfers.$inferSelect>> {
  const filters = [eq(transfers.userId, userId), eq(transfers.householdId, householdId)];
  if (fromDate) {
    filters.push(gte(transfers.date, fromDate));
  }
  if (toDate) {
    filters.push(lte(transfers.date, toDate));
  }

  const transferList = await db
    .select()
    .from(transfers)
    .where(and(...filters))
    .orderBy(desc(transfers.date))
    .limit(limit)
    .offset(offset);

  const scopedAccountRows = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(
      and(
        eq(accounts.userId, userId),
        eq(accounts.householdId, householdId),
        selectedEntityIsDefault
          ? or(eq(accounts.entityId, selectedEntityId), isNull(accounts.entityId))
          : eq(accounts.entityId, selectedEntityId)
      )
    );
  const scopedAccountIds = new Set(scopedAccountRows.map((row) => row.id));

  return transferList.filter(
    (transfer) =>
      scopedAccountIds.has(transfer.fromAccountId) || scopedAccountIds.has(transfer.toAccountId)
  );
}

async function enrichTransfersWithAccountNames({
  userId,
  householdId,
  transferList,
}: {
  userId: string;
  householdId: string;
  transferList: Array<typeof transfers.$inferSelect>;
}): Promise<
  Array<
    (typeof transfers.$inferSelect) & {
      fromAccountName: string;
      toAccountName: string;
    }
  >
> {
  const transferAccountIds = Array.from(
    new Set(transferList.flatMap((transfer) => [transfer.fromAccountId, transfer.toAccountId]))
  );
  const transferAccounts = transferAccountIds.length
    ? await db
        .select({ id: accounts.id, name: accounts.name })
        .from(accounts)
        .where(
          and(
            inArray(accounts.id, transferAccountIds),
            eq(accounts.userId, userId),
            eq(accounts.householdId, householdId)
          )
        )
    : [];
  const accountNameById = new Map(transferAccounts.map((account) => [account.id, account.name]));

  return transferList.map((transfer) => ({
    ...transfer,
    fromAccountName: accountNameById.get(transfer.fromAccountId) || 'Unknown',
    toAccountName: accountNameById.get(transfer.toAccountId) || 'Unknown',
  }));
}

// ---------------------------------------------------------------------------
// from transfers-route-handlers.ts
// ---------------------------------------------------------------------------
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
    const selectedEntity = await resolveAndRequireEntity(userId, householdId, request);

    const { limit, offset, fromDate, toDate } = parseTransferListParams(request);
    const entityScopedTransfers = await listEntityScopedTransfers({
      userId,
      householdId,
      selectedEntityId: selectedEntity.id,
      selectedEntityIsDefault: selectedEntity.isDefault,
      limit,
      offset,
      fromDate,
      toDate,
    });
    const enrichedTransfers = await enrichTransfersWithAccountNames({
      userId,
      householdId,
      transferList: entityScopedTransfers,
    });

    return Response.json({
      transfers: enrichedTransfers,
      total: entityScopedTransfers.length,
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

    let transferPayload;
    try {
      const validated = await validateTransferCreateInput({
        userId,
        householdId,
        request,
        body,
        fromAccountId,
        toAccountId,
        amount,
        date,
        description,
        fees,
        notes,
      });
      transferPayload = validated.transferPayload;
    } catch (error) {
      const mappedValidationError = mapTransferCreateValidationError(error);
      if (mappedValidationError) {
        return mappedValidationError;
      }
      throw error;
    }

    const result = await createCanonicalTransferPair(transferPayload);

    await trackTransferPairUsage({
      userId,
      householdId,
      fromAccountId,
      toAccountId,
    });

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
