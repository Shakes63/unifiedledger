import { handleRouteError } from '@/lib/api/route-helpers';
import { nanoid } from 'nanoid';
import Decimal from 'decimal.js';
import { amountToCents } from '@/lib/transactions/money-movement-service';
import { finalizeRepeatTransactionPostProcessing } from '@/lib/transactions/transaction-repeat-post-processing';
import { executeRepeatRulePipeline } from '@/lib/transactions/transaction-repeat-rule-pipeline';
import {
  deriveRepeatTransactionInput,
} from '@/lib/transactions/transaction-repeat-request';
import {
  executeRepeatTransactionWrite,
} from '@/lib/transactions/transaction-repeat-write-execution';
import { loadRepeatRequestContext } from '@/lib/transactions/transaction-repeat-request-context';

export const dynamic = 'force-dynamic';

export async function handleRepeatTransaction(request: Request) {
  try {
    const repeatContext = await loadRepeatRequestContext(request);
    if (repeatContext instanceof Response) {
      return repeatContext;
    }
    const { userId, householdId, requiredTemplateId, tmpl, account, body } = repeatContext;
    const { date, amount, description } = body;

    const { transactionDate, transactionAmount, transactionDescription } =
      deriveRepeatTransactionInput({
        inputDate: date,
        inputAmount: amount,
        inputDescription: description,
        templateAmount: tmpl.amount,
        templateDescription: tmpl.description,
        templateName: tmpl.name,
      });
    const categoryId = tmpl.categoryId;

    // Create transaction
    const transactionId = nanoid();
    const decimalAmount = new Decimal(transactionAmount);
    const amountCents = amountToCents(decimalAmount);

    const {
      appliedRuleId,
      appliedActions,
      postCreationMutations,
      finalIsTaxDeductible,
      finalIsSalesTaxable,
      appliedCategoryId,
      finalDescription,
      finalMerchantId,
    } = await executeRepeatRulePipeline({
      userId,
      householdId,
      accountName: account.name,
      accountId: tmpl.accountId,
      transactionAmount,
      transactionDate,
      transactionType: tmpl.type,
      transactionNotes: tmpl.notes || null,
      categoryId,
      transactionDescription,
    });

    await executeRepeatTransactionWrite({
      transactionId,
      userId,
      householdId,
      account,
      accountId: tmpl.accountId,
      categoryId: appliedCategoryId || null,
      date: transactionDate,
      amountCents,
      description: finalDescription,
      merchantId: finalMerchantId,
      notes: tmpl.notes || null,
      type: tmpl.type,
      isTaxDeductible: finalIsTaxDeductible,
      isSalesTaxable: finalIsSalesTaxable,
    });

    await finalizeRepeatTransactionPostProcessing({
      userId,
      householdId,
      templateId: requiredTemplateId,
      tmplUsageCount: tmpl.usageCount,
      appliedCategoryId,
      finalMerchantId,
      finalDescription,
      decimalAmount,
      transactionId,
      appliedRuleId,
      appliedActions,
      postCreationMutations,
    });

    return Response.json(
      {
        id: transactionId,
        message: 'Transaction repeated successfully',
        appliedCategoryId,
        appliedRuleId,
      },
      { status: 201 }
    );
  } catch (error) {
    return handleRouteError(error, {
      defaultError: 'Internal server error',
      logLabel: 'Transaction repeat error:',
      householdIdRequiredMessage: 'Household ID is required',
    });
  }
}
