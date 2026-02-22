export function isCreatedTransactionSalesTaxable({
  type,
  isSalesTaxable,
  postCreationSalesTaxable,
}: {
  type: string;
  isSalesTaxable: boolean;
  postCreationSalesTaxable: boolean;
}): boolean {
  return (type === 'income' && (isSalesTaxable || postCreationSalesTaxable)) || false;
}

export function buildCreateTransactionSuccessResponse({
  transactionId,
  transferInId,
  appliedCategoryId,
  appliedRuleId,
  linkedBillId,
  linkedDebtId,
}: {
  transactionId: string;
  transferInId: string | null;
  appliedCategoryId: string | null;
  appliedRuleId: string | null;
  linkedBillId: string | null;
  linkedDebtId: string | null;
}): Response {
  return Response.json(
    {
      id: transactionId,
      transferInId: transferInId || undefined,
      message: 'Transaction created successfully',
      appliedCategoryId: appliedCategoryId || undefined,
      appliedRuleId: appliedRuleId || undefined,
      linkedBillId: linkedBillId || undefined,
      linkedDebtId: linkedDebtId || undefined,
    },
    { status: 201 }
  );
}
