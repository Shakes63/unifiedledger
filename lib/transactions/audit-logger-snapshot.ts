export function createTransactionSnapshot(
  transaction: Record<string, unknown>,
  enrichedData?: {
    accountName?: string;
    categoryName?: string;
    merchantName?: string;
    billName?: string;
    debtName?: string;
  }
): Record<string, unknown> {
  return {
    id: transaction.id,
    accountId: transaction.accountId,
    accountName: enrichedData?.accountName,
    categoryId: transaction.categoryId,
    categoryName: enrichedData?.categoryName,
    merchantId: transaction.merchantId,
    merchantName: enrichedData?.merchantName,
    billId: transaction.billId,
    billName: enrichedData?.billName,
    debtId: transaction.debtId,
    debtName: enrichedData?.debtName,
    date: transaction.date,
    amount: transaction.amount,
    description: transaction.description,
    notes: transaction.notes,
    type: transaction.type,
    isPending: transaction.isPending,
    isTaxDeductible: transaction.isTaxDeductible,
    isSalesTaxable: transaction.isSalesTaxable,
    createdAt: transaction.createdAt,
    updatedAt: transaction.updatedAt,
  };
}
