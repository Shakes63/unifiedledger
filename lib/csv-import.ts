// Note: CSV parsing done by PapaParse in the component, not this module
// nanoid available for future ID generation needs
import Decimal from 'decimal.js';

/**
 * Column mapping configuration for CSV import
 */
export interface ColumnMapping {
  csvColumn: string; // Name or index of CSV column
  appField:
    | 'date'
    | 'description'
    | 'amount'
    | 'withdrawal'
    | 'deposit'
    | 'category'
    | 'merchant'
    | 'notes'
    | 'account'
    | 'type';
  transform?: 'none' | 'negate' | 'absolute' | 'trim' | 'uppercase' | 'lowercase';
  defaultValue?: any;
}

/**
 * Import template configuration
 */
export interface ImportTemplate {
  name: string;
  description?: string;
  columnMappings: ColumnMapping[];
  dateFormat: string;
  delimiter: string;
  hasHeaderRow: boolean;
  skipRows: number;
  defaultAccountId?: string;
}

/**
 * Parsed CSV result
 */
export interface ParsedCSVResult {
  headers: string[];
  rows: Record<string, string>[];
  totalRows: number;
}

/**
 * Mapped transaction data
 */
export interface MappedTransaction {
  date: string;
  description: string;
  amount: number | Decimal;
  category?: string;
  merchant?: string;
  notes?: string;
  accountId?: string;
  type: 'income' | 'expense' | 'transfer_in' | 'transfer_out';
}

/**
 * Parse a CSV file using PapaParse
 */
export const parseCSVFile = async (
  file: File,
  delimiter: string = ',',
  hasHeaderRow: boolean = true,
  skipRows: number = 0
): Promise<ParsedCSVResult> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n').filter((line) => line.trim());

      // Skip specified rows
      const dataLines = lines.slice(skipRows);

      if (dataLines.length === 0) {
        reject(new Error('No data found in CSV file'));
        return;
      }

      // Extract headers
      const headers = hasHeaderRow
        ? dataLines[0]
            .split(delimiter)
            .map((h) => h.trim().replace(/^"|"$/g, ''))
        : dataLines[0]
            .split(delimiter)
            .map((_, i) => `Column ${i + 1}`);

      // Parse data rows
      const rows = (hasHeaderRow ? dataLines.slice(1) : dataLines).map(
        (line, index) => {
          const values = line
            .split(delimiter)
            .map((v) => v.trim().replace(/^"|"$/g, ''));
          const row: Record<string, string> = { _rowNumber: (index + 1).toString() };
          headers.forEach((header, i) => {
            row[header] = values[i] || '';
          });
          return row;
        }
      );

      resolve({ headers, rows, totalRows: rows.length });
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };

    reader.readAsText(file);
  });
};

/**
 * Auto-detect column mappings based on header names
 */
export const autoDetectMappings = (headers: string[]): ColumnMapping[] => {
  const mappings: ColumnMapping[] = [];

  const patterns: Record<string, RegExp> = {
    date: /date|posted|transaction.*date|trans.*date|trans_date/i,
    description: /description|memo|detail|merchant|payee|name|transaction|trans|ref/i,
    withdrawal: /withdrawal|withdraw|debit|paid.*out|spent|expense/i,
    deposit: /deposit|credit|received|income/i,
    amount: /^amount$|^value$|^total$|^balance$/i, // More specific to avoid matching withdrawal/deposit
    category: /category|type|class|cat/i,
    merchant: /merchant|vendor|payee|store|retailer|supplier/i,
    notes: /note|comment|memo|description|reference/i,
  };

  headers.forEach((header) => {
    for (const [field, pattern] of Object.entries(patterns)) {
      if (pattern.test(header)) {
        // Avoid duplicate categories
        if (field === 'category' && mappings.some((m) => m.appField === 'category')) {
          continue;
        }
        if (field === 'merchant' && mappings.some((m) => m.appField === 'merchant')) {
          continue;
        }
        // Avoid duplicate amounts (prefer withdrawal/deposit over generic amount)
        if (field === 'amount' && mappings.some((m) => m.appField === 'withdrawal' || m.appField === 'deposit')) {
          continue;
        }

        mappings.push({
          csvColumn: header,
          appField: field as any,
        });
        break;
      }
    }
  });

  return mappings;
};

/**
 * Parse a date string in various formats
 */
export const parseDate = (dateStr: string, dateFormat: string): string => {
  if (!dateStr) throw new Error('Date is required');

  // Try to parse based on format
  const dateObj = new Date(dateStr);

  // If date is invalid, try parsing with format
  if (isNaN(dateObj.getTime())) {
    // Common date formats
    const formats: Record<string, (str: string) => Date | null> = {
      'MM/DD/YYYY': (str) => {
        const [month, day, year] = str.split('/');
        if (month && day && year) {
          return new Date(`${year}-${month}-${day}`);
        }
        return null;
      },
      'DD/MM/YYYY': (str) => {
        const [day, month, year] = str.split('/');
        if (month && day && year) {
          return new Date(`${year}-${month}-${day}`);
        }
        return null;
      },
      'YYYY-MM-DD': (str) => new Date(str),
      'MM-DD-YYYY': (str) => {
        const [month, day, year] = str.split('-');
        if (month && day && year) {
          return new Date(`${year}-${month}-${day}`);
        }
        return null;
      },
    };

    const parser = formats[dateFormat];
    if (parser) {
      const parsed = parser(dateStr);
      if (parsed && !isNaN(parsed.getTime())) {
        return parsed.toISOString().split('T')[0];
      }
    }
  }

  // Return ISO format
  return dateObj.toISOString().split('T')[0];
};

/**
 * Parse amount string to number, handling various formats
 */
export const parseAmount = (amountStr: string): Decimal => {
  if (!amountStr) throw new Error('Amount is required');

  // Remove common currency symbols and whitespace
  let cleaned = amountStr.trim().replace(/[$€£¥₹₽]/g, '').trim();

  // Handle parentheses for negative amounts
  if (cleaned.startsWith('(') && cleaned.endsWith(')')) {
    cleaned = '-' + cleaned.slice(1, -1);
  }

  // Remove commas (thousand separators) but keep periods for decimals
  cleaned = cleaned.replace(/,/g, '');

  const amount = new Decimal(cleaned);

  if (amount.isNaN()) {
    throw new Error(`Invalid amount: ${amountStr}`);
  }

  return amount;
};

/**
 * Apply column mappings to transform CSV row to transaction
 */
export const applyMappings = (
  row: Record<string, string>,
  mappings: ColumnMapping[],
  dateFormat: string,
  defaultAccountId?: string
): MappedTransaction => {
  const transaction: Partial<MappedTransaction> & {
    accountId?: string;
  } = {
    accountId: defaultAccountId,
    type: 'expense' as const, // Default type
  };

  let hasWithdrawal = false;
  let hasDeposit = false;

  mappings.forEach((mapping) => {
    let value = row[mapping.csvColumn];

    if (!value || value.trim() === '') {
      // Use default value if provided
      if (mapping.defaultValue !== undefined) {
        value = String(mapping.defaultValue);
      } else {
        return; // Skip empty values
      }
    }

    try {
      // Apply field-specific parsing
      switch (mapping.appField) {
        case 'date':
          transaction.date = parseDate(value, dateFormat);
          break;

        case 'amount':
          const amount = parseAmount(value);
          if (mapping.transform === 'negate') {
            transaction.amount = amount.negated();
          } else if (mapping.transform === 'absolute') {
            transaction.amount = amount.abs();
          } else {
            transaction.amount = amount;
          }
          break;

        case 'withdrawal':
          // Withdrawal column creates expense transactions
          // Only process if value is non-zero (dual-column CSVs have 0.00 in the other column)
          const withdrawalAmount = parseAmount(value);
          if (!withdrawalAmount.isZero()) {
            if (mapping.transform === 'negate') {
              transaction.amount = withdrawalAmount.negated().abs(); // Ensure positive for expense
            } else if (mapping.transform === 'absolute') {
              transaction.amount = withdrawalAmount.abs();
            } else {
              transaction.amount = withdrawalAmount.abs(); // Always positive for expenses
            }
            transaction.type = 'expense';
            hasWithdrawal = true;
          }
          break;

        case 'deposit':
          // Deposit column creates income transactions
          // Only process if value is non-zero (dual-column CSVs have 0.00 in the other column)
          const depositAmount = parseAmount(value);
          if (!depositAmount.isZero()) {
            if (mapping.transform === 'negate') {
              transaction.amount = depositAmount.negated().abs(); // Ensure positive for income
            } else if (mapping.transform === 'absolute') {
              transaction.amount = depositAmount.abs();
            } else {
              transaction.amount = depositAmount.abs(); // Always positive for income
            }
            transaction.type = 'income';
            hasDeposit = true;
          }
          break;

        case 'description':
          transaction.description = applyStringTransform(value, mapping.transform);
          break;

        case 'merchant':
          transaction.merchant = applyStringTransform(value, mapping.transform);
          break;

        case 'notes':
          transaction.notes = applyStringTransform(value, mapping.transform);
          break;

        case 'category':
          transaction.category = applyStringTransform(value, mapping.transform);
          break;

        case 'type':
          // Only use explicit type field if withdrawal/deposit not used
          if (!hasWithdrawal && !hasDeposit) {
            const typeValue = value.toLowerCase();
            if (
              typeValue.includes('income') ||
              typeValue.includes('deposit') ||
              typeValue.includes('credit')
            ) {
              transaction.type = 'income';
            } else if (
              typeValue.includes('transfer') ||
              typeValue.includes('trf')
            ) {
              transaction.type = 'transfer_out';
            } else {
              transaction.type = 'expense';
            }
          }
          break;

        case 'account':
          transaction.accountId = value;
          break;
      }
    } catch (error) {
      console.error(
        `Error parsing field ${mapping.appField} with value "${value}":`,
        error
      );
      throw error;
    }
  });

  // Ensure required fields
  if (!transaction.date) {
    throw new Error('Date field is required');
  }
  if (!transaction.description) {
    throw new Error('Description field is required');
  }
  if (transaction.amount === undefined) {
    throw new Error('Amount field is required');
  }

  return transaction as MappedTransaction;
};

/**
 * Helper function to apply string transforms
 */
const applyStringTransform = (value: string, transform?: string): string => {
  if (!value) return value;

  switch (transform) {
    case 'none':
      return value; // No transformation
    case 'trim':
      return value.trim();
    case 'uppercase':
      return value.toUpperCase();
    case 'lowercase':
      return value.toLowerCase();
    default:
      return value.trim(); // Default to trim for backward compatibility
  }
};

/**
 * Validate a mapped transaction
 */
export const validateMappedTransaction = (
  transaction: MappedTransaction
): string[] => {
  const errors: string[] = [];

  if (!transaction.date) {
    errors.push('Date is required');
  } else if (!/^\d{4}-\d{2}-\d{2}$/.test(transaction.date)) {
    errors.push('Date must be in YYYY-MM-DD format');
  }

  if (!transaction.description || transaction.description.trim() === '') {
    errors.push('Description is required');
  }

  if (transaction.amount === undefined || transaction.amount === null) {
    errors.push('Amount is required');
  } else if (
    transaction.amount instanceof Decimal
      ? transaction.amount.isZero()
      : transaction.amount === 0
  ) {
    errors.push('Amount cannot be zero');
  }

  if (!transaction.accountId) {
    errors.push('Account is required');
  }

  return errors;
};

/**
 * Get file information
 */
export const getFileInfo = (file: File): { size: number; name: string } => {
  return {
    size: file.size,
    name: file.name,
  };
};
