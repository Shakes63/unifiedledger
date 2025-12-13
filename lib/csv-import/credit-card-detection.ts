/**
 * Credit Card Detection Module
 * 
 * Detects whether a CSV file is from a credit card statement vs. a bank statement,
 * identifies the card issuer, and determines the appropriate import settings.
 */

export type SourceType = 'bank' | 'credit_card' | 'auto';
export type CreditCardIssuer = 'chase' | 'amex' | 'capital_one' | 'discover' | 'citi' | 'bank_of_america' | 'wells_fargo' | 'other';
export type AmountSignConvention = 'standard' | 'credit_card';
export type CCTransactionType = 'purchase' | 'payment' | 'refund' | 'interest' | 'fee' | 'cash_advance' | 'balance_transfer' | 'reward';

/**
 * Patterns for detecting credit card specific columns
 */
const CC_COLUMN_PATTERNS = {
  cardNumber: /card\s*(number|no\.?)|last\s*4|card\s*ending/i,
  creditLimit: /credit\s*limit|available\s*credit|spending\s*power|buying\s*power/i,
  statementBalance: /statement\s*balance|new\s*balance|ending\s*balance|closing\s*balance/i,
  minimumDue: /minimum\s*(due|payment)|min\s*payment|min\s*pay/i,
  dueDate: /due\s*date|payment\s*due|pay\s*by/i,
  transactionType: /trans(action)?\s*type|type|category|transaction\s*category/i,
  reference: /reference|ref\s*#|transaction\s*id|trans\s*id/i,
};

/**
 * Patterns for detecting credit card transaction types in descriptions
 */
export const CC_TRANSACTION_TYPE_PATTERNS: Record<CCTransactionType, RegExp> = {
  payment: /payment|thank\s*you|autopay|automatic\s*payment|credit\s*card\s*payment|online\s*payment|mobile\s*payment|check\s*payment|payment\s*-\s*thank\s*you/i,
  refund: /refund|return|credit|reversal|adjustment|chargeback|dispute\s*credit|merchant\s*credit/i,
  interest: /interest\s*charge|finance\s*charge|interest\s*payment|purchase\s*interest|cash\s*advance\s*interest|periodic\s*interest/i,
  fee: /annual\s*fee|late\s*fee|foreign\s*transaction|fee:|fee\s*-|returned\s*payment\s*fee|over\s*limit\s*fee|balance\s*transfer\s*fee|cash\s*advance\s*fee/i,
  cash_advance: /cash\s*advance|atm\s*withdraw|cash\s*back|cash\s*disbursement|casino/i,
  balance_transfer: /balance\s*transfer|bt\s*-|promo\s*transfer|promotional\s*transfer|transferred\s*from/i,
  reward: /reward|cashback|statement\s*credit|bonus|points\s*redemption|rewards\s*credit|membership\s*reward/i,
  purchase: /.*/, // Default catch-all - purchases are the most common
};

/**
 * Patterns for detecting card issuer from column names or content
 */
const ISSUER_PATTERNS: Record<CreditCardIssuer, RegExp> = {
  chase: /chase|jpmorgan/i,
  amex: /amex|american\s*express|americanexpress/i,
  capital_one: /capital\s*one|capitalone/i,
  discover: /discover/i,
  citi: /citi|citibank/i,
  bank_of_america: /bank\s*of\s*america|bofa|boa/i,
  wells_fargo: /wells\s*fargo|wellsfargo/i,
  other: /.*/, // Fallback
};

/**
 * Result of credit card detection
 */
export interface CreditCardDetectionResult {
  sourceType: SourceType;
  confidence: number; // 0-100
  issuer?: CreditCardIssuer;
  issuerConfidence?: number;
  amountSignConvention: AmountSignConvention;
  detectedFeatures: string[];
  hasStatementInfo: boolean;
  suggestedSkipRows?: number;
}

/**
 * Detect if the CSV is from a credit card based on column headers
 */
export function detectCreditCardFromHeaders(headers: string[]): {
  isCreditCard: boolean;
  confidence: number;
  features: string[];
  issuer?: CreditCardIssuer;
} {
  const features: string[] = [];
  let score = 0;
  let issuer: CreditCardIssuer | undefined;
  
  const headerString = headers.join(' ');
  
  // Check for credit card specific columns
  if (CC_COLUMN_PATTERNS.cardNumber.test(headerString)) {
    features.push('card_number_column');
    score += 30;
  }
  
  if (CC_COLUMN_PATTERNS.creditLimit.test(headerString)) {
    features.push('credit_limit_column');
    score += 25;
  }
  
  if (CC_COLUMN_PATTERNS.statementBalance.test(headerString)) {
    features.push('statement_balance_column');
    score += 20;
  }
  
  if (CC_COLUMN_PATTERNS.minimumDue.test(headerString)) {
    features.push('minimum_due_column');
    score += 20;
  }
  
  if (CC_COLUMN_PATTERNS.transactionType.test(headerString)) {
    features.push('transaction_type_column');
    score += 10;
  }
  
  // Detect issuer from headers
  for (const [issuerName, pattern] of Object.entries(ISSUER_PATTERNS)) {
    if (issuerName !== 'other' && pattern.test(headerString)) {
      issuer = issuerName as CreditCardIssuer;
      features.push(`issuer_${issuerName}`);
      score += 15;
      break;
    }
  }
  
  // Common credit card column patterns
  const ccColumnKeywords = /merchant|purchase|transaction|post\s*date|trans\s*date/i;
  if (ccColumnKeywords.test(headerString)) {
    features.push('cc_keywords');
    score += 10;
  }
  
  // Cap score at 100
  const confidence = Math.min(score, 100);
  
  return {
    isCreditCard: confidence >= 40,
    confidence,
    features,
    issuer,
  };
}

/**
 * Detect credit card characteristics from sample data
 */
export function detectCreditCardFromData(
  rows: Record<string, string>[],
  headers: string[]
): {
  isCreditCard: boolean;
  confidence: number;
  features: string[];
  amountConvention: AmountSignConvention;
} {
  const features: string[] = [];
  let score = 0;
  
  // Find amount column
  const amountColIndex = headers.findIndex(h => 
    /^amount$|^value$|^total$|^debit$|^credit$/i.test(h)
  );
  
  const _withdrawalCol = headers.find(h => /withdrawal|debit|paid/i.test(h));
  const _depositCol = headers.find(h => /deposit|credit|received/i.test(h));
  
  // Analyze first 20 rows
  const sampleRows = rows.slice(0, 20);
  let positiveCount = 0;
  let negativeCount = 0;
  let ccTypeMatches = 0;
  
  for (const row of sampleRows) {
    // Check for credit card transaction types in descriptions
    const description = row['Description'] || row['Merchant'] || row['Name'] || 
                       row['Payee'] || row['Transaction'] || Object.values(row).join(' ');
    
    for (const [type, pattern] of Object.entries(CC_TRANSACTION_TYPE_PATTERNS)) {
      if (type !== 'purchase' && pattern.test(description)) {
        ccTypeMatches++;
        break;
      }
    }
    
    // Analyze amounts
    if (amountColIndex >= 0) {
      const amountStr = row[headers[amountColIndex]];
      const amount = parseFloat(amountStr?.replace(/[$,]/g, '') || '0');
      if (amount > 0) positiveCount++;
      if (amount < 0) negativeCount++;
    }
  }
  
  // Credit cards typically have payments (credits/negative) mixed with purchases (debits/positive)
  if (ccTypeMatches >= 2) {
    features.push('cc_transaction_types');
    score += 25;
  }
  
  // Determine amount sign convention
  // Credit card: positive = charge, negative = payment
  // Bank: positive = deposit, negative = withdrawal
  let amountConvention: AmountSignConvention = 'standard';
  
  // If mostly positive with some negatives that look like payments/credits
  if (positiveCount > negativeCount * 2) {
    features.push('positive_dominant');
    score += 15;
    amountConvention = 'credit_card';
  }
  
  // Check for merchant-like descriptions (no payee, just merchant names)
  const merchantLikeDescriptions = sampleRows.filter(row => {
    const desc = row['Description'] || row['Merchant'] || '';
    // Merchant names are usually short, no "Transfer to" or "Deposit from"
    return desc.length > 0 && desc.length < 50 && 
           !/transfer|deposit|withdrawal|check/i.test(desc);
  }).length;
  
  if (merchantLikeDescriptions >= sampleRows.length * 0.7) {
    features.push('merchant_descriptions');
    score += 15;
  }
  
  const confidence = Math.min(score, 100);
  
  return {
    isCreditCard: confidence >= 40,
    confidence,
    features,
    amountConvention,
  };
}

/**
 * Detect credit card transaction type from description
 */
export function detectCCTransactionType(
  description: string,
  amount: number,
  customPatterns?: Record<string, RegExp>
): CCTransactionType {
  const patterns = customPatterns 
    ? { ...CC_TRANSACTION_TYPE_PATTERNS, ...customPatterns }
    : CC_TRANSACTION_TYPE_PATTERNS;
  
  // Check patterns in order of specificity (non-purchase patterns first)
  const orderedTypes: CCTransactionType[] = [
    'payment',
    'interest',
    'fee',
    'cash_advance',
    'balance_transfer',
    'reward',
    'refund',
    'purchase', // Last resort
  ];
  
  for (const type of orderedTypes) {
    if (type === 'purchase') continue; // Skip catch-all until end
    if (patterns[type].test(description)) {
      return type;
    }
  }
  
  // Negative amounts on credit cards are typically payments or credits
  if (amount < 0) {
    // If it looks like a refund from a merchant
    if (/return|refund|credit/i.test(description)) {
      return 'refund';
    }
    // Otherwise assume it's a payment
    return 'payment';
  }
  
  // Default to purchase for positive amounts
  return 'purchase';
}

/**
 * Full credit card detection combining header and data analysis
 */
export function detectCreditCard(
  headers: string[],
  rows: Record<string, string>[]
): CreditCardDetectionResult {
  const headerResult = detectCreditCardFromHeaders(headers);
  const dataResult = detectCreditCardFromData(rows, headers);
  
  // Combine results
  const combinedFeatures = [...headerResult.features, ...dataResult.features];
  const combinedConfidence = Math.round(
    (headerResult.confidence * 0.6 + dataResult.confidence * 0.4)
  );
  
  const isCreditCard = combinedConfidence >= 50;
  
  return {
    sourceType: isCreditCard ? 'credit_card' : 'bank',
    confidence: combinedConfidence,
    issuer: headerResult.issuer,
    issuerConfidence: headerResult.issuer ? headerResult.confidence : undefined,
    amountSignConvention: isCreditCard ? dataResult.amountConvention : 'standard',
    detectedFeatures: combinedFeatures,
    hasStatementInfo: headerResult.features.includes('statement_balance_column') ||
                      headerResult.features.includes('minimum_due_column'),
  };
}

/**
 * Statement info extraction types
 */
export interface StatementInfo {
  statementBalance?: number;
  statementDate?: string;
  dueDate?: string;
  minimumPayment?: number;
  creditLimit?: number;
  availableCredit?: number;
  accountNumber?: string;
}

/**
 * Extract statement info from header rows (rows before transaction data)
 */
export function extractStatementInfoFromHeaders(
  preDataRows: string[],
  delimiter: string = ','
): StatementInfo | null {
  const info: StatementInfo = {};
  let found = false;
  
  for (const row of preDataRows) {
    const lowerRow = row.toLowerCase();
    const _parts = row.split(delimiter).map(p => p.trim().replace(/^"|"$/g, ''));
    
    // Look for key-value pairs
    if (/statement\s*balance|new\s*balance/i.test(lowerRow)) {
      const amount = extractAmount(row);
      if (amount !== null) {
        info.statementBalance = amount;
        found = true;
      }
    }
    
    if (/minimum\s*(due|payment)|min\s*pay/i.test(lowerRow)) {
      const amount = extractAmount(row);
      if (amount !== null) {
        info.minimumPayment = amount;
        found = true;
      }
    }
    
    if (/due\s*date|payment\s*due/i.test(lowerRow)) {
      const date = extractDate(row);
      if (date) {
        info.dueDate = date;
        found = true;
      }
    }
    
    if (/statement\s*date|closing\s*date/i.test(lowerRow)) {
      const date = extractDate(row);
      if (date) {
        info.statementDate = date;
        found = true;
      }
    }
    
    if (/credit\s*limit/i.test(lowerRow)) {
      const amount = extractAmount(row);
      if (amount !== null) {
        info.creditLimit = amount;
        found = true;
      }
    }
    
    if (/available\s*(credit|to\s*spend)/i.test(lowerRow)) {
      const amount = extractAmount(row);
      if (amount !== null) {
        info.availableCredit = amount;
        found = true;
      }
    }
    
    // Look for account number ending
    if (/card\s*ending|last\s*4|xxxx/i.test(lowerRow)) {
      const match = row.match(/\d{4}$/);
      if (match) {
        info.accountNumber = match[0];
        found = true;
      }
    }
  }
  
  return found ? info : null;
}

/**
 * Extract amount from a string
 */
function extractAmount(text: string): number | null {
  // Match common currency formats
  const match = text.match(/\$?\s*([\d,]+\.?\d*)/);
  if (match) {
    const cleaned = match[1].replace(/,/g, '');
    const amount = parseFloat(cleaned);
    if (!isNaN(amount)) return amount;
  }
  return null;
}

/**
 * Extract date from a string
 */
function extractDate(text: string): string | null {
  // Try common date formats
  const patterns = [
    /(\d{1,2}\/\d{1,2}\/\d{2,4})/, // MM/DD/YYYY or M/D/YY
    /(\d{4}-\d{2}-\d{2})/, // YYYY-MM-DD
    /(\d{1,2}-\d{1,2}-\d{2,4})/, // MM-DD-YYYY
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1];
  }
  
  return null;
}

/**
 * Detect issuer from filename
 */
export function detectIssuerFromFilename(filename: string): CreditCardIssuer | undefined {
  const lowerFilename = filename.toLowerCase();
  
  for (const [issuerName, pattern] of Object.entries(ISSUER_PATTERNS)) {
    if (issuerName !== 'other' && pattern.test(lowerFilename)) {
      return issuerName as CreditCardIssuer;
    }
  }
  
  return undefined;
}

/**
 * Get human-readable name for issuer
 */
export function getIssuerDisplayName(issuer: CreditCardIssuer): string {
  const names: Record<CreditCardIssuer, string> = {
    chase: 'Chase',
    amex: 'American Express',
    capital_one: 'Capital One',
    discover: 'Discover',
    citi: 'Citi',
    bank_of_america: 'Bank of America',
    wells_fargo: 'Wells Fargo',
    other: 'Other',
  };
  return names[issuer];
}

/**
 * Get display name for transaction type
 */
export function getCCTransactionTypeDisplayName(type: CCTransactionType): string {
  const names: Record<CCTransactionType, string> = {
    purchase: 'Purchase',
    payment: 'Payment',
    refund: 'Refund',
    interest: 'Interest',
    fee: 'Fee',
    cash_advance: 'Cash Advance',
    balance_transfer: 'Balance Transfer',
    reward: 'Reward/Credit',
  };
  return names[type];
}

