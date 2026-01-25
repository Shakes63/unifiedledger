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
    | 'type'
    // Phase 12: Credit card specific fields
    | 'cc_transaction_type'
    | 'statement_balance'
    | 'statement_date'
    | 'statement_due_date'
    | 'minimum_payment'
    | 'credit_limit'
    | 'available_credit'
    | 'reference_number';
  transform?: 'none' | 'negate' | 'absolute' | 'trim' | 'uppercase' | 'lowercase';
  defaultValue?: string | number;
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
  // Phase 12: Credit card specific settings
  sourceType?: 'bank' | 'credit_card' | 'auto';
  issuer?: string;
  amountSignConvention?: 'standard' | 'credit_card';
  transactionTypePatterns?: Record<string, string>;
  statementInfoConfig?: StatementInfoConfig;
}

/**
 * Configuration for extracting statement info from header rows
 */
export interface StatementInfoConfig {
  statementBalanceRow?: number; // Row number containing statement balance
  statementDateRow?: number;
  dueDateRow?: number;
  minimumPaymentRow?: number;
  creditLimitRow?: number;
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
 * Credit card transaction type
 */
export type CCTransactionType = 
  | 'purchase' 
  | 'payment' 
  | 'refund' 
  | 'interest' 
  | 'fee' 
  | 'cash_advance' 
  | 'balance_transfer' 
  | 'reward';

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
  // Phase 12: Credit card specific fields
  ccTransactionType?: CCTransactionType;
  referenceNumber?: string;
  isRefund?: boolean;
  isBalanceTransfer?: boolean;
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
export const autoDetectMappings = (headers: string[], isCreditCard: boolean = false): ColumnMapping[] => {
  const mappings: ColumnMapping[] = [];

  const patterns: Record<string, RegExp> = {
    date: /date|posted|transaction.*date|trans.*date|trans_date/i,
    description: /description|memo|detail|merchant|payee|name|transaction|trans(?!_)|ref/i,
    withdrawal: /withdrawal|withdraw|debit|paid.*out|spent|expense/i,
    deposit: /deposit|credit|received|income/i,
    amount: /^amount$|^value$|^total$|^balance$/i, // More specific to avoid matching withdrawal/deposit
    category: /category|type|class|cat/i,
    merchant: /merchant|vendor|payee|store|retailer|supplier/i,
    notes: /note|comment|memo|description|reference/i,
    // Phase 12: Credit card specific patterns
    cc_transaction_type: /trans(action)?\s*type|payment\s*type|card\s*type/i,
    reference_number: /reference\s*(number|#|no\.?)|ref\s*#|trans(action)?\s*id/i,
    statement_balance: /statement\s*balance|new\s*balance|ending\s*balance/i,
    minimum_payment: /minimum\s*(due|payment)|min\s*pay/i,
    credit_limit: /credit\s*limit|available\s*credit/i,
  };

  // Track which patterns have been matched to avoid duplicates
  const matchedPatterns = new Set<string>();

  headers.forEach((header) => {
    for (const [field, pattern] of Object.entries(patterns)) {
      if (pattern.test(header) && !matchedPatterns.has(field)) {
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
        // Skip credit card specific fields for bank accounts
        if (!isCreditCard && ['cc_transaction_type', 'statement_balance', 'minimum_payment', 'credit_limit'].includes(field)) {
          continue;
        }

        mappings.push({
          csvColumn: header,
          appField: field as ColumnMapping['appField'],
        });
        matchedPatterns.add(field);
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

        // Phase 12: Credit card specific fields
        case 'cc_transaction_type':
          const ccType = value.toLowerCase().trim();
          if (ccType.includes('payment') || ccType.includes('credit')) {
            transaction.ccTransactionType = 'payment';
          } else if (ccType.includes('refund') || ccType.includes('return')) {
            transaction.ccTransactionType = 'refund';
            transaction.isRefund = true;
          } else if (ccType.includes('interest') || ccType.includes('finance')) {
            transaction.ccTransactionType = 'interest';
          } else if (ccType.includes('fee')) {
            transaction.ccTransactionType = 'fee';
          } else if (ccType.includes('cash') && ccType.includes('advance')) {
            transaction.ccTransactionType = 'cash_advance';
          } else if (ccType.includes('balance') && ccType.includes('transfer')) {
            transaction.ccTransactionType = 'balance_transfer';
            transaction.isBalanceTransfer = true;
          } else if (ccType.includes('reward') || ccType.includes('cashback')) {
            transaction.ccTransactionType = 'reward';
          } else {
            transaction.ccTransactionType = 'purchase';
          }
          break;

        case 'reference_number':
          transaction.referenceNumber = applyStringTransform(value, mapping.transform);
          break;

        // Statement info fields are captured but not stored on transaction
        case 'statement_balance':
        case 'statement_date':
        case 'statement_due_date':
        case 'minimum_payment':
        case 'credit_limit':
        case 'available_credit':
          // These are captured at the import level, not per-transaction
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

// ============================================================================
// Account Number Transfer Detection
// ============================================================================

/**
 * Account info for transfer detection
 */
export interface AccountInfo {
  id: string;
  name: string;
  accountNumberLast4: string | null;
}

/**
 * Result of account number-based transfer detection
 */
export interface AccountNumberTransferMatch {
  accountId: string;
  accountName: string;
  last4: string;
  matchReason: string;
}

/**
 * Common patterns for account numbers in transaction descriptions
 * Matches: *1234, x1234, ...1234, ending 1234, ENDING1234, TO 1234, FROM 1234, XXXXXX1234
 */
const ACCOUNT_NUMBER_PATTERNS = [
  /(?:\*|x|\.{3})(\d{4})\b/gi,           // *1234, x1234, ...1234
  /ending\s*(\d{4})\b/gi,                 // ending 1234, ENDING1234
  /(?:to|from)\s+(\d{4})\b/gi,            // TO 1234, FROM 1234
  /acct?\s*#?\s*(\d{4})\b/gi,             // acct 1234, act#1234
  /X{3,}(\d{4})\b/gi,                     // XXXXXX1234, XXX1234 (X-masked accounts)
  /X{3,}\d*\s*(\d{4})\b/gi,               // XXXXXX848 1 -> captures last 4 digits after masked portion
];

/**
 * Detect potential transfers by checking if the description contains
 * another account's last 4 digits
 *
 * @param description - Transaction description to search
 * @param accounts - List of household accounts (should exclude the source account)
 * @returns Matched account info or null if no match
 */
export function detectTransferByAccountNumber(
  description: string,
  accounts: AccountInfo[]
): AccountNumberTransferMatch | null {
  if (!description || accounts.length === 0) {
    return null;
  }

  // Extract all 4-digit patterns from the description
  const foundDigits = new Set<string>();

  for (const pattern of ACCOUNT_NUMBER_PATTERNS) {
    // Reset regex lastIndex for global patterns
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(description)) !== null) {
      foundDigits.add(match[1]);
    }
  }

  // Also handle cases where last 4 digits might be split by spaces after X-masking
  // e.g., "XXXXXX848 1" should match account ending in "8481"
  // Look for pattern: X's followed by 3 digits, space, 1 digit
  const splitDigitsPattern = /X{3,}(\d{3})\s+(\d)\b/gi;
  splitDigitsPattern.lastIndex = 0;
  let splitMatch;
  while ((splitMatch = splitDigitsPattern.exec(description)) !== null) {
    foundDigits.add(splitMatch[1] + splitMatch[2]); // Combine "848" + "1" = "8481"
  }

  // Also try: X's followed by 2 digits, space, 2 digits (e.g., "XXXXXX84 81")
  const splitDigitsPattern2 = /X{3,}(\d{2})\s+(\d{2})\b/gi;
  splitDigitsPattern2.lastIndex = 0;
  while ((splitMatch = splitDigitsPattern2.exec(description)) !== null) {
    foundDigits.add(splitMatch[1] + splitMatch[2]);
  }

  if (foundDigits.size === 0) {
    return null;
  }

  // Check if any found digits match an account's last 4
  for (const account of accounts) {
    if (account.accountNumberLast4 && foundDigits.has(account.accountNumberLast4)) {
      return {
        accountId: account.id,
        accountName: account.name,
        last4: account.accountNumberLast4,
        matchReason: `Account ending in ${account.accountNumberLast4} found in description`,
      };
    }
  }

  return null;
}

// ============================================================================
// Phase 12: Transfer Detection
// ============================================================================

/**
 * Result of transfer match detection
 */
export interface TransferMatch {
  transactionId: string;
  matchType: 'exact_opposite' | 'likely_transfer';
  confidence: number; // 0-100
  matchedFields: string[];
  existingTransaction: {
    date: string;
    description: string;
    amount: number;
    type: string;
    accountId: string;
  };
}

/**
 * Detect potential transfer matches for a mapped transaction
 * This helps prevent duplicate entries when importing both sides of a transfer
 */
export function detectPotentialTransfers(
  mappedTransaction: MappedTransaction,
  existingTransactions: Array<{
    id: string;
    date: string;
    description: string;
    amount: number;
    type: string;
    accountId: string;
    transferId?: string | null;
  }>,
  options: {
    dateRangeInDays?: number;
    minConfidence?: number;
  } = {}
): TransferMatch[] {
  const { dateRangeInDays = 3, minConfidence = 70 } = options;
  const matches: TransferMatch[] = [];
  
  const transactionAmount = mappedTransaction.amount instanceof Decimal
    ? mappedTransaction.amount.toNumber()
    : mappedTransaction.amount;
  const absAmount = Math.abs(transactionAmount);
  
  const transactionDate = new Date(mappedTransaction.date);
  
  for (const existing of existingTransactions) {
    // Skip if same account (transfers go between different accounts)
    if (existing.accountId === mappedTransaction.accountId) {
      continue;
    }
    
    // Skip if already part of a transfer
    if (existing.transferId) {
      continue;
    }
    
    const matchedFields: string[] = [];
    let confidence = 0;
    
    // Check amount match (same absolute value)
    const existingAbsAmount = Math.abs(existing.amount);
    const amountDiff = Math.abs(existingAbsAmount - absAmount);
    const amountTolerance = absAmount * 0.01; // 1% tolerance
    
    if (amountDiff <= amountTolerance) {
      matchedFields.push('amount');
      confidence += 40;
    } else {
      // Amount must match for transfer detection
      continue;
    }
    
    // Check date proximity
    const existingDate = new Date(existing.date);
    const daysDiff = Math.abs(
      (transactionDate.getTime() - existingDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    
    if (daysDiff <= dateRangeInDays) {
      matchedFields.push('date');
      confidence += 30 - (daysDiff * 5); // Closer dates get higher score
    } else {
      // Date must be within range
      continue;
    }
    
    // Check for opposite transaction types or transfer indicators
    const isOppositeType = 
      (mappedTransaction.type === 'expense' && existing.type === 'income') ||
      (mappedTransaction.type === 'income' && existing.type === 'expense') ||
      (mappedTransaction.type === 'transfer_out' && existing.type === 'transfer_in') ||
      (mappedTransaction.type === 'transfer_in' && existing.type === 'transfer_out');
    
    if (isOppositeType) {
      matchedFields.push('opposite_type');
      confidence += 15;
    }
    
    // Check for transfer-related keywords in descriptions
    const transferKeywords = /transfer|trf|xfer|from|to|payment/i;
    const hasTransferKeyword = 
      transferKeywords.test(mappedTransaction.description) ||
      transferKeywords.test(existing.description);
    
    if (hasTransferKeyword) {
      matchedFields.push('transfer_keywords');
      confidence += 10;
    }
    
    // Check for similar descriptions (might indicate same transfer)
    const descSimilarity = calculateSimpleSimilarity(
      mappedTransaction.description.toLowerCase(),
      existing.description.toLowerCase()
    );
    
    if (descSimilarity > 0.5) {
      matchedFields.push('similar_description');
      confidence += 5;
    }
    
    // Only include if confidence meets threshold
    if (confidence >= minConfidence) {
      matches.push({
        transactionId: existing.id,
        matchType: confidence >= 85 ? 'exact_opposite' : 'likely_transfer',
        confidence: Math.min(confidence, 100),
        matchedFields,
        existingTransaction: {
          date: existing.date,
          description: existing.description,
          amount: existing.amount,
          type: existing.type,
          accountId: existing.accountId,
        },
      });
    }
  }
  
  // Sort by confidence descending
  matches.sort((a, b) => b.confidence - a.confidence);
  
  return matches;
}

/**
 * Simple string similarity calculation (0-1)
 * Uses character overlap as a basic metric
 */
function calculateSimpleSimilarity(str1: string, str2: string): number {
  if (str1 === str2) return 1;
  if (!str1 || !str2) return 0;
  
  const set1 = new Set(str1.split(''));
  const set2 = new Set(str2.split(''));
  
  let intersection = 0;
  for (const char of set1) {
    if (set2.has(char)) intersection++;
  }
  
  const union = set1.size + set2.size - intersection;
  return intersection / union;
}

// ============================================================================
// Phase 12: Credit Card Transaction Type Detection
// ============================================================================

/**
 * Patterns for detecting credit card transaction types from description
 */
export const CC_TYPE_DETECTION_PATTERNS: Record<CCTransactionType, RegExp> = {
  payment: /payment|thank\s*you|autopay|automatic\s*payment|credit\s*card\s*payment|online\s*payment/i,
  refund: /refund|return|credit|reversal|adjustment|chargeback|merchant\s*credit/i,
  interest: /interest\s*charge|finance\s*charge|interest\s*payment|purchase\s*interest|periodic\s*interest/i,
  fee: /annual\s*fee|late\s*fee|foreign\s*transaction|fee:|returned\s*payment\s*fee|over\s*limit\s*fee|cash\s*advance\s*fee/i,
  cash_advance: /cash\s*advance|atm\s*withdraw|cash\s*disbursement|casino/i,
  balance_transfer: /balance\s*transfer|bt\s*-|promo\s*transfer|promotional\s*transfer/i,
  reward: /reward|cashback|statement\s*credit|bonus|points\s*redemption|rewards\s*credit/i,
  purchase: /.*/, // Catch-all
};

/**
 * Detect credit card transaction type from description and amount
 */
export function detectCCTransactionType(
  description: string,
  amount: number,
  customPatterns?: Partial<Record<CCTransactionType, string>>
): CCTransactionType {
  // Build patterns with custom overrides
  const patterns: Record<CCTransactionType, RegExp> = { ...CC_TYPE_DETECTION_PATTERNS };
  
  if (customPatterns) {
    for (const [type, pattern] of Object.entries(customPatterns)) {
      if (pattern) {
        patterns[type as CCTransactionType] = new RegExp(pattern, 'i');
      }
    }
  }
  
  // Check patterns in priority order (non-purchase first)
  const orderedTypes: CCTransactionType[] = [
    'payment',
    'interest',
    'fee',
    'cash_advance',
    'balance_transfer',
    'reward',
    'refund',
  ];
  
  for (const type of orderedTypes) {
    if (patterns[type].test(description)) {
      return type;
    }
  }
  
  // For negative amounts on credit cards, likely a payment or credit
  if (amount < 0) {
    if (/refund|return|credit/i.test(description)) {
      return 'refund';
    }
    return 'payment';
  }
  
  // Default to purchase
  return 'purchase';
}

/**
 * Apply credit card specific processing to a mapped transaction
 */
export function applyCreditCardProcessing(
  transaction: MappedTransaction,
  amountSignConvention: 'standard' | 'credit_card',
  customPatterns?: Partial<Record<CCTransactionType, string>>
): MappedTransaction {
  const amount = transaction.amount instanceof Decimal
    ? transaction.amount.toNumber()
    : transaction.amount;
  
  // Detect transaction type if not already set
  if (!transaction.ccTransactionType) {
    transaction.ccTransactionType = detectCCTransactionType(
      transaction.description,
      amount,
      customPatterns
    );
  }
  
  // Set transaction type based on credit card transaction type
  switch (transaction.ccTransactionType) {
    case 'payment':
      // Payments to credit cards are transfer_in to the card
      transaction.type = 'transfer_in';
      break;
    case 'refund':
      transaction.type = 'income';
      transaction.isRefund = true;
      break;
    case 'balance_transfer':
      transaction.type = 'transfer_in';
      transaction.isBalanceTransfer = true;
      break;
    case 'reward':
      transaction.type = 'income';
      break;
    default:
      // Purchases, fees, interest, cash advances are expenses
      transaction.type = 'expense';
      break;
  }
  
  // Handle amount sign convention
  if (amountSignConvention === 'credit_card') {
    // Credit card convention: positive = charge (expense), negative = credit/payment
    // Ensure amount is positive for expenses, handle the type appropriately
    if (amount < 0 && ['purchase', 'fee', 'interest', 'cash_advance'].includes(transaction.ccTransactionType || '')) {
      // Negative amount but should be expense - this is actually a credit/refund
      transaction.type = 'income';
      transaction.amount = new Decimal(Math.abs(amount));
    } else if (amount > 0 && ['payment', 'refund', 'reward'].includes(transaction.ccTransactionType || '')) {
      // Positive amount but should be credit - this is a payment in wrong sign
      transaction.amount = new Decimal(Math.abs(amount));
    }
  }
  
  return transaction;
}
