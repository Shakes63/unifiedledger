/**
 * Client-safe utility functions for transaction audit display
 * 
 * This file contains pure JavaScript functions that can be safely imported
 * in client components without pulling in Node.js dependencies.
 * 
 * Server-only functions (database operations) are in audit-logger.ts
 */

/**
 * Represents a single field change in a transaction
 */
export interface TransactionChange {
  field: string;
  oldValue: string | number | boolean | null;
  newValue: string | number | boolean | null;
  oldDisplayValue?: string; // Human-readable name for foreign keys
  newDisplayValue?: string;
}

/**
 * Human-readable labels for field names
 */
export const FIELD_LABELS: Record<string, string> = {
  accountId: 'Account',
  categoryId: 'Category',
  merchantId: 'Merchant',
  date: 'Date',
  amount: 'Amount',
  description: 'Description',
  notes: 'Notes',
  type: 'Type',
  isPending: 'Pending Status',
  isTaxDeductible: 'Tax Deductible',
  isSalesTaxable: 'Sales Taxable',
  billId: 'Linked Bill',
  debtId: 'Linked Debt',
};

/**
 * Formats a transaction type for display
 */
export function formatTransactionType(type: string): string {
  switch (type) {
    case 'income':
      return 'Income';
    case 'expense':
      return 'Expense';
    case 'transfer_in':
      return 'Transfer In';
    case 'transfer_out':
      return 'Transfer Out';
    default:
      return type;
  }
}

/**
 * Formats a boolean value for display
 */
export function formatBoolean(value: boolean | null): string {
  if (value === null) return 'Not set';
  return value ? 'Yes' : 'No';
}

/**
 * Formats an amount for display
 */
export function formatAmount(amount: number | null): string {
  if (amount === null) return 'Not set';
  return `$${Math.abs(amount).toFixed(2)}`;
}

