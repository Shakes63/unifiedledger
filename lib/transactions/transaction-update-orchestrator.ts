/**
 * Orchestration for the transaction UPDATE flow: parse the request, derive the
 * updated values, and route to the transfer branch (paired legs stay
 * conserved) or the standard branch (single movement + side-effect re-scaling).
 *
 * Consolidated from 5 shim files (request / transfer / transfer-branch /
 * standard-branch / orchestrator) during the post-audit cleanup; behavior is
 * unchanged. standard-prepare and standard-post stay separate — their tests
 * import those module paths directly.
 */
import type { TransactionUpdateInput } from '@/lib/transactions/transaction-update-validation';
import Decimal from 'decimal.js';
import { amountToCents } from '@/lib/transactions/money-movement-service';
import { updateCanonicalTransferPairByTransactionId } from '@/lib/transactions/transfer-service';
import { eq } from 'drizzle-orm';
import { runInDatabaseTransaction } from '@/lib/db/transaction-runner';
import { transactions } from '@/lib/db/schema';
import { buildTransactionAmountFields } from '@/lib/transactions/money-movement-service';
import {
  adjustUpdatedTransactionAccountBalances,
  resolveUpdatedTransactionEntityId,
  shouldAdjustAccountBalances,
} from '@/lib/transactions/transaction-update-nontransfer';
import { adjustTransactionSideEffectsForAmountChange } from '@/lib/transactions/transaction-side-effect-reversal';
import { hasAnyTransactionUpdateField } from '@/lib/transactions/transaction-update-validation';
import { prepareStandardTransactionUpdate } from '@/lib/transactions/transaction-update-standard-prepare';
import {
  buildStandardUpdateSuccessResponse,
  runStandardUpdatePostActions,
} from '@/lib/transactions/transaction-update-standard-post';

// ---------------------------------------------------------------------------
// from transaction-update-request.ts
// ---------------------------------------------------------------------------
function parseTransactionUpdateRequestBody(body: Record<string, unknown>): {
  updateInput: TransactionUpdateInput;
  billInstanceId?: string;
} {
  return {
    updateInput: {
      accountId: body.accountId as string | undefined,
      categoryId: body.categoryId as string | null | undefined,
      merchantId: body.merchantId as string | null | undefined,
      isTaxDeductible: body.isTaxDeductible as boolean | undefined,
      taxDeductionType: body.taxDeductionType as 'business' | 'personal' | 'none' | undefined,
      useCategoryTaxDefault: body.useCategoryTaxDefault as boolean | undefined,
      date: body.date as string | undefined,
      amount: body.amount as string | number | undefined,
      description: body.description as string | undefined,
      notes: body.notes as string | null | undefined,
      isPending: body.isPending as boolean | undefined,
      transferId: body.transferId as string | undefined,
      transferDestinationAccountId: body.transferDestinationAccountId as string | undefined,
      transferSourceAccountId: body.transferSourceAccountId as string | undefined,
    },
    billInstanceId: body.billInstanceId as string | undefined,
  };
}

// ---------------------------------------------------------------------------
// from transaction-update-transfer.ts
// ---------------------------------------------------------------------------
interface RunTransferTransactionUpdateParams {
  userId: string;
  householdId: string;
  transactionId: string;
  transactionType: string;
  accountId?: string;
  transferId?: string;
  transferDestinationAccountId?: string;
  transferSourceAccountId?: string;
  amount?: unknown;
  date?: string;
  description?: string;
  notes?: string | null;
  isPending?: boolean;
}

function isTransferTransactionType(type: string | null | undefined): boolean {
  return type === 'transfer_out' || type === 'transfer_in';
}

async function runTransferTransactionUpdate({
  userId,
  householdId,
  transactionId,
  transactionType,
  accountId,
  transferId,
  transferDestinationAccountId,
  transferSourceAccountId,
  amount,
  date,
  description,
  notes,
  isPending,
}: RunTransferTransactionUpdateParams) {
  const destinationAccountInput = transferDestinationAccountId ?? transferId;
  const sourceAccountUpdate =
    transactionType === 'transfer_out' ? (accountId ?? transferSourceAccountId) : transferSourceAccountId;
  const destinationAccountUpdate =
    transactionType === 'transfer_in' ? (accountId ?? destinationAccountInput) : destinationAccountInput;
  const amountCentsUpdate =
    typeof amount === 'number' || typeof amount === 'string'
      ? amountToCents(new Decimal(amount))
      : undefined;

  await updateCanonicalTransferPairByTransactionId({
    userId,
    householdId,
    transactionId,
    amountCents: amountCentsUpdate,
    date,
    description,
    notes,
    isPending,
    sourceAccountId: sourceAccountUpdate,
    destinationAccountId: destinationAccountUpdate,
  });
}

function mapTransferUpdateError(error: unknown): Response | null {
  const message = error instanceof Error ? error.message : 'Failed to update transfer transaction';

  if (message.includes('Cannot transfer to the same account')) {
    return Response.json({ error: message }, { status: 400 });
  }

  if (message.includes('not found')) {
    return Response.json({ error: message }, { status: 404 });
  }

  return null;
}

// ---------------------------------------------------------------------------
// from transaction-update-transfer-branch.ts
// ---------------------------------------------------------------------------
async function executeTransferTransactionUpdateBranch({
  id,
  userId,
  householdId,
  transactionType,
  updateInput,
}: {
  id: string;
  userId: string;
  householdId: string;
  transactionType: string;
  updateInput: TransactionUpdateInput;
}): Promise<Response> {
  try {
    await runTransferTransactionUpdate({
      userId,
      householdId,
      transactionType,
      transactionId: id,
      accountId: updateInput.accountId,
      transferId: updateInput.transferId,
      transferDestinationAccountId: updateInput.transferDestinationAccountId,
      transferSourceAccountId: updateInput.transferSourceAccountId,
      amount: updateInput.amount,
      date: updateInput.date,
      description: updateInput.description,
      notes: updateInput.notes,
      isPending: updateInput.isPending,
    });

    return Response.json(
      {
        id,
        message: 'Transaction updated successfully',
      },
      { status: 200 }
    );
  } catch (error) {
    const mappedResponse = mapTransferUpdateError(error);
    if (mappedResponse) {
      return mappedResponse;
    }

    throw error;
  }
}

// ---------------------------------------------------------------------------
// from transaction-update-standard-branch.ts
// ---------------------------------------------------------------------------
async function executeStandardTransactionUpdateBranch({
  id,
  userId,
  householdId,
  selectedEntityId,
  transaction,
  updateInput,
  billInstanceId,
}: {
  id: string;
  userId: string;
  householdId: string;
  selectedEntityId: string;
  transaction: typeof transactions.$inferSelect;
  updateInput: TransactionUpdateInput;
  billInstanceId?: string;
}): Promise<Response> {
  const {
    newAccountId,
    newAmount,
    oldAmountCents,
    newAmountCents,
    newDate,
    newDescription,
    newNotes,
    newIsPending,
    newCategoryId,
    newMerchantId,
    newIsTaxDeductible,
    newTaxDeductionType,
    errorResponse,
    newIsSalesTaxable,
    shouldDeleteSalesTaxRecord,
  } = await prepareStandardTransactionUpdate({
    userId,
    householdId,
    selectedEntityId,
    transaction,
    updateInput,
  });

  if (errorResponse) {
    return errorResponse;
  }

  await runInDatabaseTransaction(async (tx) => {
    if (shouldAdjustAccountBalances(updateInput.amount, newAccountId, transaction.accountId)) {
      await adjustUpdatedTransactionAccountBalances(tx, {
        transaction,
        newAccountId,
        oldAmountCents,
        newAmountCents,
      });
    }

    // Keep linked debt payments / goal contributions / bill payments in step
    // with an amount edit (C-LIFE-3): reverse the old side effects and re-apply
    // them scaled to the new amount, atomically with the update.
    if (updateInput.amount !== undefined && oldAmountCents !== newAmountCents) {
      await adjustTransactionSideEffectsForAmountChange(tx, {
        transactionId: id,
        userId,
        householdId,
        oldAmountCents,
        newAmountCents,
      });
    }

    const transactionEntityId = await resolveUpdatedTransactionEntityId(tx, {
      householdId,
      userId,
      newAccountId,
      transaction,
    });

    await tx
      .update(transactions)
      .set({
        entityId: transactionEntityId,
        accountId: newAccountId,
        categoryId: newCategoryId,
        merchantId: newMerchantId,
        isTaxDeductible: newIsTaxDeductible,
        taxDeductionType: newTaxDeductionType,
        transferId: transaction.transferId,
        transferGroupId: transaction.transferGroupId,
        transferSourceAccountId: transaction.transferSourceAccountId,
        transferDestinationAccountId: transaction.transferDestinationAccountId,
        date: newDate,
        ...buildTransactionAmountFields(newAmountCents),
        description: newDescription,
        notes: newNotes,
        isPending: Boolean(newIsPending),
        isSalesTaxable: newIsSalesTaxable,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(transactions.id, id));
  });

  await runStandardUpdatePostActions({
    id,
    userId,
    householdId,
    transaction,
    billInstanceId,
    updateInput,
    shouldDeleteSalesTaxRecord,
    newAccountId,
    newCategoryId,
    newMerchantId,
    newIsTaxDeductible,
    newTaxDeductionType,
    newDate,
    newAmount: newAmount.toNumber(),
    newDescription,
    newNotes,
    newIsPending: Boolean(newIsPending),
    newIsSalesTaxable,
  });

  return buildStandardUpdateSuccessResponse(id);
}

// ---------------------------------------------------------------------------
// from transaction-update-orchestrator.ts
// ---------------------------------------------------------------------------
export async function executeTransactionUpdateOrchestration({
  id,
  userId,
  householdId,
  selectedEntityId,
  transaction,
  body,
}: {
  id: string;
  userId: string;
  householdId: string;
  selectedEntityId: string;
  transaction: typeof transactions.$inferSelect;
  body: Record<string, unknown>;
}): Promise<Response> {
  const { updateInput, billInstanceId } = parseTransactionUpdateRequestBody(body);

  if (!hasAnyTransactionUpdateField(updateInput)) {
    return Response.json({ error: 'No fields to update' }, { status: 400 });
  }

  if (isTransferTransactionType(transaction.type)) {
    return executeTransferTransactionUpdateBranch({
      id,
      userId,
      householdId,
      transactionType: transaction.type as 'transfer_in' | 'transfer_out',
      updateInput,
    });
  }

  return executeStandardTransactionUpdateBranch({
    id,
    userId,
    householdId,
    selectedEntityId,
    transaction,
    updateInput,
    billInstanceId,
  });
}
