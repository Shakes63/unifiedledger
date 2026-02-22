import { eq } from 'drizzle-orm';

import { db } from '@/lib/db';
import {
  accounts,
  bills,
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
      ? db.select().from(accounts).where(eq(accounts.id, txData.accountId)).limit(1)
      : Promise.resolve([]),
    txData.categoryId
      ? db.select().from(budgetCategories).where(eq(budgetCategories.id, txData.categoryId)).limit(1)
      : Promise.resolve([]),
    txData.merchantId
      ? db.select().from(merchants).where(eq(merchants.id, txData.merchantId)).limit(1)
      : Promise.resolve([]),
    txData.billId
      ? db.select().from(bills).where(eq(bills.id, txData.billId)).limit(1)
      : Promise.resolve([]),
    txData.debtId
      ? db.select().from(debts).where(eq(debts.id, txData.debtId)).limit(1)
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
