import { getTodayLocalDateString } from '@/lib/utils/local-date';

export function validateRepeatRequest({
  householdId,
  templateId,
}: {
  householdId: string | null;
  templateId?: string;
}): Response | null {
  if (!householdId) {
    return Response.json({ error: 'Household ID is required' }, { status: 400 });
  }
  if (!templateId) {
    return Response.json({ error: 'Template ID is required' }, { status: 400 });
  }
  return null;
}

export function deriveRepeatTransactionInput({
  inputDate,
  inputAmount,
  inputDescription,
  templateAmount,
  templateDescription,
  templateName,
}: {
  inputDate?: string;
  inputAmount?: number;
  inputDescription?: string;
  templateAmount: number;
  templateDescription?: string | null;
  templateName: string;
}): {
  transactionDate: string;
  transactionAmount: number;
  transactionDescription: string;
} {
  return {
    transactionDate: inputDate || getTodayLocalDateString(),
    transactionAmount: inputAmount !== undefined ? inputAmount : templateAmount,
    transactionDescription: inputDescription || templateDescription || templateName,
  };
}
