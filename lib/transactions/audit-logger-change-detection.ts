import type { TransactionChange } from '@/lib/transactions/audit-utils';
import type { DisplayNames } from '@/lib/transactions/audit-logger-types';

const TRACKED_FIELDS = [
  'accountId',
  'categoryId',
  'merchantId',
  'date',
  'amount',
  'description',
  'notes',
  'type',
  'isPending',
  'isTaxDeductible',
  'isSalesTaxable',
  'billId',
  'debtId',
] as const;

export function detectChanges(
  oldTransaction: Record<string, unknown>,
  newTransaction: Record<string, unknown>,
  displayNames?: DisplayNames
): TransactionChange[] {
  const changes: TransactionChange[] = [];

  for (const field of TRACKED_FIELDS) {
    const oldValue = oldTransaction[field] ?? null;
    const newValue = newTransaction[field] ?? null;

    const oldNormalized = normalizeValue(oldValue);
    const newNormalized = normalizeValue(newValue);

    if (oldNormalized !== newNormalized) {
      const change: TransactionChange = {
        field,
        oldValue: oldValue as string | number | boolean | null,
        newValue: newValue as string | number | boolean | null,
      };

      if (displayNames && field in displayNames) {
        const fieldDisplayNames = displayNames[field as keyof DisplayNames];
        if (fieldDisplayNames) {
          change.oldDisplayValue = fieldDisplayNames.old;
          change.newDisplayValue = fieldDisplayNames.new;
        }
      }

      changes.push(change);
    }
  }

  return changes;
}

function normalizeValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return value.toString();
  if (typeof value === 'boolean') return value.toString();
  return String(value);
}
