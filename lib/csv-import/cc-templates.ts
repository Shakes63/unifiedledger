/**
 * Credit Card Import Templates
 * 
 * Pre-built templates for popular credit card issuers to auto-detect
 * column mappings and settings.
 */

import type { ColumnMapping } from '../csv-import';
import type { CreditCardIssuer, AmountSignConvention } from './credit-card-detection';

/**
 * Credit card template configuration
 */
export interface CreditCardTemplate {
  id: string;
  issuer: CreditCardIssuer;
  name: string;
  description: string;
  columnMappings: ColumnMapping[];
  dateFormat: string;
  delimiter: string;
  hasHeaderRow: boolean;
  skipRows: number;
  amountSignConvention: AmountSignConvention;
  knownColumnNames: string[]; // Expected header names for matching
  transactionTypeColumn?: string; // Column containing transaction type if available
  descriptionConcatFields?: string[]; // Fields to combine for description
}

/**
 * Pre-built templates for major credit card issuers
 */
export const CREDIT_CARD_TEMPLATES: CreditCardTemplate[] = [
  // Chase
  {
    id: 'chase-credit',
    issuer: 'chase',
    name: 'Chase Credit Card',
    description: 'Chase Sapphire, Freedom, etc.',
    dateFormat: 'MM/DD/YYYY',
    delimiter: ',',
    hasHeaderRow: true,
    skipRows: 0,
    amountSignConvention: 'credit_card',
    knownColumnNames: ['Transaction Date', 'Post Date', 'Description', 'Category', 'Type', 'Amount', 'Memo'],
    transactionTypeColumn: 'Type',
    columnMappings: [
      { csvColumn: 'Transaction Date', appField: 'date' },
      { csvColumn: 'Description', appField: 'description' },
      { csvColumn: 'Amount', appField: 'amount' },
      { csvColumn: 'Category', appField: 'category' },
      { csvColumn: 'Memo', appField: 'notes' },
    ],
  },
  
  // American Express
  {
    id: 'amex-credit',
    issuer: 'amex',
    name: 'American Express',
    description: 'Platinum, Gold, Blue Cash, etc.',
    dateFormat: 'MM/DD/YYYY',
    delimiter: ',',
    hasHeaderRow: true,
    skipRows: 0,
    amountSignConvention: 'credit_card',
    knownColumnNames: ['Date', 'Description', 'Card Member', 'Account #', 'Amount', 'Extended Details', 'Appears On Your Statement As', 'Address', 'City/State', 'Zip Code', 'Country', 'Reference', 'Category'],
    columnMappings: [
      { csvColumn: 'Date', appField: 'date' },
      { csvColumn: 'Description', appField: 'description' },
      { csvColumn: 'Amount', appField: 'amount' },
      { csvColumn: 'Category', appField: 'category' },
      { csvColumn: 'Extended Details', appField: 'notes' },
    ],
    descriptionConcatFields: ['Description', 'Appears On Your Statement As'],
  },
  
  // Capital One
  {
    id: 'capital-one-credit',
    issuer: 'capital_one',
    name: 'Capital One',
    description: 'Venture, Quicksilver, etc.',
    dateFormat: 'YYYY-MM-DD',
    delimiter: ',',
    hasHeaderRow: true,
    skipRows: 0,
    amountSignConvention: 'credit_card',
    knownColumnNames: ['Transaction Date', 'Posted Date', 'Card No.', 'Description', 'Category', 'Debit', 'Credit'],
    columnMappings: [
      { csvColumn: 'Transaction Date', appField: 'date' },
      { csvColumn: 'Description', appField: 'description' },
      { csvColumn: 'Debit', appField: 'withdrawal' },
      { csvColumn: 'Credit', appField: 'deposit' },
      { csvColumn: 'Category', appField: 'category' },
    ],
  },
  
  // Discover
  {
    id: 'discover-credit',
    issuer: 'discover',
    name: 'Discover Card',
    description: 'Discover it, etc.',
    dateFormat: 'MM/DD/YYYY',
    delimiter: ',',
    hasHeaderRow: true,
    skipRows: 0,
    amountSignConvention: 'credit_card',
    knownColumnNames: ['Trans. Date', 'Post Date', 'Description', 'Amount', 'Category'],
    columnMappings: [
      { csvColumn: 'Trans. Date', appField: 'date' },
      { csvColumn: 'Description', appField: 'description' },
      { csvColumn: 'Amount', appField: 'amount' },
      { csvColumn: 'Category', appField: 'category' },
    ],
  },
  
  // Citi
  {
    id: 'citi-credit',
    issuer: 'citi',
    name: 'Citi Credit Card',
    description: 'Double Cash, Custom Cash, etc.',
    dateFormat: 'MM/DD/YYYY',
    delimiter: ',',
    hasHeaderRow: true,
    skipRows: 0,
    amountSignConvention: 'credit_card',
    knownColumnNames: ['Status', 'Date', 'Description', 'Debit', 'Credit', 'Member Name'],
    columnMappings: [
      { csvColumn: 'Date', appField: 'date' },
      { csvColumn: 'Description', appField: 'description' },
      { csvColumn: 'Debit', appField: 'withdrawal' },
      { csvColumn: 'Credit', appField: 'deposit' },
    ],
  },
  
  // Bank of America
  {
    id: 'boa-credit',
    issuer: 'bank_of_america',
    name: 'Bank of America Credit Card',
    description: 'Cash Rewards, Travel Rewards, etc.',
    dateFormat: 'MM/DD/YYYY',
    delimiter: ',',
    hasHeaderRow: true,
    skipRows: 0,
    amountSignConvention: 'credit_card',
    knownColumnNames: ['Posted Date', 'Reference Number', 'Payee', 'Address', 'Amount'],
    columnMappings: [
      { csvColumn: 'Posted Date', appField: 'date' },
      { csvColumn: 'Payee', appField: 'description' },
      { csvColumn: 'Amount', appField: 'amount' },
      { csvColumn: 'Address', appField: 'notes' },
    ],
  },
  
  // Wells Fargo
  {
    id: 'wells-fargo-credit',
    issuer: 'wells_fargo',
    name: 'Wells Fargo Credit Card',
    description: 'Active Cash, Autograph, etc.',
    dateFormat: 'MM/DD/YYYY',
    delimiter: ',',
    hasHeaderRow: true,
    skipRows: 0,
    amountSignConvention: 'credit_card',
    knownColumnNames: ['Date', 'Description', 'Original Description', 'Amount', 'Balance'],
    columnMappings: [
      { csvColumn: 'Date', appField: 'date' },
      { csvColumn: 'Description', appField: 'description' },
      { csvColumn: 'Amount', appField: 'amount' },
    ],
  },
  
  // Generic Credit Card
  {
    id: 'generic-credit',
    issuer: 'other',
    name: 'Generic Credit Card',
    description: 'Standard credit card format',
    dateFormat: 'MM/DD/YYYY',
    delimiter: ',',
    hasHeaderRow: true,
    skipRows: 0,
    amountSignConvention: 'credit_card',
    knownColumnNames: ['Date', 'Description', 'Amount'],
    columnMappings: [
      { csvColumn: 'Date', appField: 'date' },
      { csvColumn: 'Description', appField: 'description' },
      { csvColumn: 'Amount', appField: 'amount' },
    ],
  },
];

/**
 * Calculate match score between CSV headers and template
 */
function calculateTemplateMatchScore(
  csvHeaders: string[],
  template: CreditCardTemplate
): number {
  const csvHeadersLower = csvHeaders.map(h => h.toLowerCase().trim());
  const templateHeadersLower = template.knownColumnNames.map(h => h.toLowerCase().trim());
  
  let matchedCount = 0;
  for (const templateHeader of templateHeadersLower) {
    if (csvHeadersLower.some(csvHeader => 
      csvHeader === templateHeader || 
      csvHeader.includes(templateHeader) || 
      templateHeader.includes(csvHeader)
    )) {
      matchedCount++;
    }
  }
  
  // Calculate percentage match
  const percentage = (matchedCount / templateHeadersLower.length) * 100;
  return Math.round(percentage);
}

/**
 * Find the best matching template for given CSV headers
 */
export function findBestMatchingTemplate(
  csvHeaders: string[],
  issuerHint?: CreditCardIssuer
): { template: CreditCardTemplate; matchScore: number } | null {
  let bestMatch: { template: CreditCardTemplate; matchScore: number } | null = null;
  
  for (const template of CREDIT_CARD_TEMPLATES) {
    // If issuer hint is provided, prioritize matching issuer
    const issuerBonus = issuerHint && template.issuer === issuerHint ? 20 : 0;
    
    const score = calculateTemplateMatchScore(csvHeaders, template) + issuerBonus;
    
    if (!bestMatch || score > bestMatch.matchScore) {
      bestMatch = { template, matchScore: score };
    }
  }
  
  // Only return if match is reasonably good
  if (bestMatch && bestMatch.matchScore >= 50) {
    return bestMatch;
  }
  
  return null;
}

/**
 * Get template by ID
 */
export function getTemplateById(id: string): CreditCardTemplate | undefined {
  return CREDIT_CARD_TEMPLATES.find(t => t.id === id);
}

/**
 * Get template by issuer
 */
export function getTemplateByIssuer(issuer: CreditCardIssuer): CreditCardTemplate | undefined {
  return CREDIT_CARD_TEMPLATES.find(t => t.issuer === issuer);
}

/**
 * Get all templates
 */
export function getAllTemplates(): CreditCardTemplate[] {
  return CREDIT_CARD_TEMPLATES;
}

/**
 * Adapt template mappings to actual CSV headers
 * Maps template column names to actual CSV column names using fuzzy matching
 */
export function adaptTemplateMappings(
  template: CreditCardTemplate,
  actualHeaders: string[]
): ColumnMapping[] {
  const adaptedMappings: ColumnMapping[] = [];
  const actualHeadersLower = actualHeaders.map(h => h.toLowerCase().trim());
  
  for (const mapping of template.columnMappings) {
    const templateColLower = mapping.csvColumn.toLowerCase().trim();
    
    // Find exact match first
    let matchedHeader = actualHeaders.find(
      h => h.toLowerCase().trim() === templateColLower
    );
    
    // Try partial match if no exact match
    if (!matchedHeader) {
      const index = actualHeadersLower.findIndex(h => 
        h.includes(templateColLower) || templateColLower.includes(h)
      );
      if (index >= 0) {
        matchedHeader = actualHeaders[index];
      }
    }
    
    if (matchedHeader) {
      adaptedMappings.push({
        ...mapping,
        csvColumn: matchedHeader,
      });
    }
  }
  
  return adaptedMappings;
}

/**
 * Get templates grouped by issuer for UI display
 */
export function getTemplatesGrouped(): Map<string, CreditCardTemplate[]> {
  const grouped = new Map<string, CreditCardTemplate[]>();
  
  for (const template of CREDIT_CARD_TEMPLATES) {
    const group = template.issuer === 'other' ? 'Other' : getIssuerDisplayName(template.issuer);
    const existing = grouped.get(group) || [];
    existing.push(template);
    grouped.set(group, existing);
  }
  
  return grouped;
}

/**
 * Helper to get display name for issuer
 */
function getIssuerDisplayName(issuer: CreditCardIssuer): string {
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

