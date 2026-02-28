import { and, eq } from 'drizzle-orm';

import { db } from '@/lib/db';
import {
  accounts,
  billTemplates,
  budgetCategories,
  customFieldValues,
  customFields,
  debts,
  merchants,
  tags,
  transactionTags,
  transactions,
} from '@/lib/db/schema';

export async function buildEnrichedTransactionResponse(
  transactionId: string,
  txData: typeof transactions.$inferSelect
) {
  const [accountData, categoryData, merchantData, billData, debtData] = await Promise.all([
    txData.accountId
      ? db
          .select()
          .from(accounts)
          .where(
            and(
              eq(accounts.id, txData.accountId),
              eq(accounts.userId, txData.userId),
              eq(accounts.householdId, txData.householdId)
            )
          )
          .limit(1)
      : Promise.resolve([]),
    txData.categoryId
      ? db
          .select()
          .from(budgetCategories)
          .where(
            and(
              eq(budgetCategories.id, txData.categoryId),
              eq(budgetCategories.userId, txData.userId),
              eq(budgetCategories.householdId, txData.householdId)
            )
          )
          .limit(1)
      : Promise.resolve([]),
    txData.merchantId
      ? db
          .select()
          .from(merchants)
          .where(
            and(
              eq(merchants.id, txData.merchantId),
              eq(merchants.userId, txData.userId),
              eq(merchants.householdId, txData.householdId)
            )
          )
          .limit(1)
      : Promise.resolve([]),
    txData.billId
      ? db
          .select()
          .from(billTemplates)
          .where(
            and(
              eq(billTemplates.id, txData.billId),
              eq(billTemplates.createdByUserId, txData.userId),
              eq(billTemplates.householdId, txData.householdId)
            )
          )
          .limit(1)
      : Promise.resolve([]),
    txData.debtId
      ? db
          .select()
          .from(debts)
          .where(
            and(
              eq(debts.id, txData.debtId),
              eq(debts.userId, txData.userId),
              eq(debts.householdId, txData.householdId)
            )
          )
          .limit(1)
      : Promise.resolve([]),
  ]);

  const tagLinks = await db
    .select({
      tag: tags,
    })
    .from(transactionTags)
    .innerJoin(tags, eq(transactionTags.tagId, tags.id))
    .where(eq(transactionTags.transactionId, transactionId));

  const fieldValues = await db
    .select({
      field: customFields,
      value: customFieldValues,
    })
    .from(customFieldValues)
    .innerJoin(customFields, eq(customFieldValues.customFieldId, customFields.id))
    .where(eq(customFieldValues.transactionId, transactionId));

  return {
    ...txData,
    account: accountData[0] || null,
    category: categoryData[0] || null,
    merchant: merchantData[0] || null,
    bill: billData[0] || null,
    debt: debtData[0] || null,
    tags: tagLinks.map((t) => t.tag),
    customFields: fieldValues.map((cf) => ({
      field: cf.field,
      value: cf.value,
    })),
  };
}
