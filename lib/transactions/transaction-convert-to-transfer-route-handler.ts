import { requireAuth } from '@/lib/auth-helpers';
import { getHouseholdIdFromRequest, requireHouseholdAuth } from '@/lib/api/household-auth';
import { nanoid } from 'nanoid';
import { handleRouteError } from '@/lib/api/route-helpers';
import { getTransactionAmountCents } from '@/lib/transactions/money-movement-service';
import { executeUnmatchedTransferConversion } from '@/lib/transactions/transaction-convert-pair-execution';
import { executeMatchedTransactionConversion } from '@/lib/transactions/transaction-convert-matched-execution';
import {
  buildConvertSuccessResponse,
  validateSourceTransactionForConversion,
} from '@/lib/transactions/transaction-convert-route-helpers';
import {
  loadConversionAccounts,
  loadScopedTransaction,
  validateConvertRequestInput,
} from '@/lib/transactions/transaction-convert-scoped-load';

export const dynamic = 'force-dynamic';

export async function handleConvertTransactionToTransfer(
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
    const requestValidationError = validateConvertRequestInput({
      householdId,
      targetAccountId,
    });
    if (requestValidationError) {
      return requestValidationError;
    }
    const scopedHouseholdId = householdId as string;
    const requiredTargetAccountId = targetAccountId as string;

    const transaction = await loadScopedTransaction({
      id,
      userId,
      householdId: scopedHouseholdId,
    });
    if (!transaction) {
      return Response.json(
        { error: 'Transaction not found' },
        { status: 404 }
      );
    }
    const sourceValidationError = validateSourceTransactionForConversion({
      transaction,
      targetAccountId: requiredTargetAccountId,
    });
    if (sourceValidationError) {
      return sourceValidationError;
    }

    const { targetAccount, sourceAccount } = await loadConversionAccounts({
      sourceAccountId: transaction.accountId,
      targetAccountId: requiredTargetAccountId,
      userId,
      householdId: scopedHouseholdId,
    });
    if (!targetAccount) {
      return Response.json(
        { error: 'Target account not found in household' },
        { status: 404 }
      );
    }
    if (!sourceAccount) {
      return Response.json(
        { error: 'Source account not found' },
        { status: 404 }
      );
    }

    if (matchingTransactionId) {
      return executeMatchedTransactionConversion({
        id,
        matchingTransactionId,
        userId,
        householdId: scopedHouseholdId,
        targetAccountId: requiredTargetAccountId,
        transaction,
      });
    }

    const amountCents = getTransactionAmountCents(transaction);
    const isExpense = transaction.type === 'expense';
    const transferGroupId = nanoid();
    const pairedTransactionId = nanoid();
    await executeUnmatchedTransferConversion({
      id,
      userId,
      householdId: scopedHouseholdId,
      targetAccountId: requiredTargetAccountId,
      transaction,
      sourceAccount,
      targetAccount,
      amountCents,
      isExpense,
      transferGroupId,
      pairedTransactionId,
    });

    return buildConvertSuccessResponse({
      id,
      pairedTransactionId,
      transferGroupId,
      matched: false,
    });
  } catch (error) {
    return handleRouteError(error, {
      defaultError: 'Internal server error',
      logLabel: 'Convert to transfer error:',
    });
  }
}
