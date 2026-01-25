import { requireAuth } from '@/lib/auth-helpers';
import { getAndVerifyHousehold } from '@/lib/api/household-auth';
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { importHistory, importStaging, transactions, accounts, merchants } from '@/lib/db/schema';
import { nanoid } from 'nanoid';
import { eq } from 'drizzle-orm';
import {
  applyMappings,
  validateMappedTransaction,
  applyCreditCardProcessing,
  detectPotentialTransfers,
  detectTransferByAccountNumber,
  type ColumnMapping,
  type MappedTransaction,
  type CCTransactionType,
  type AccountInfo,
} from '@/lib/csv-import';
import { detectDuplicatesEnhanced, type MerchantInfo, type ExistingTransactionForDuplicates } from '@/lib/duplicate-detection';
import { extractStatementInfoFromHeaders } from '@/lib/csv-import/credit-card-detection';
import Decimal from 'decimal.js';

interface CSVImportRequest {
  file: string; // base64 encoded file
  fileName: string;
  columnMappings: ColumnMapping[];
  dateFormat: string;
  delimiter?: string;
  hasHeaderRow?: boolean;
  skipRows?: number;
  defaultAccountId?: string;
  templateId?: string;
  householdId?: string;
  previewOnly?: boolean;
  // Phase 12: Credit card specific fields
  sourceType?: 'bank' | 'credit_card' | 'auto';
  issuer?: string;
  amountSignConvention?: 'standard' | 'credit_card';
}

interface StagingRecord {
  id: string;
  rowNumber: number;
  rawData: Record<string, string>;
  mappedData: MappedTransaction;
  duplicateOf?: string;
  duplicateScore?: number;
  duplicateMatchReason?: 'levenshtein' | 'merchant_name';
  duplicateMerchantName?: string;
  // Matched transaction info for UI display
  matchedTransaction?: {
    id: string;
    date: string;
    description: string;
    amount: number;
    accountName?: string;
  };
  status: 'pending' | 'review' | 'approved' | 'skipped' | 'imported';
  validationErrors: string[];
  // Phase 12: Credit card specific fields
  ccTransactionType?: CCTransactionType;
  potentialTransferId?: string;
  transferMatchConfidence?: number;
  // Account number transfer detection
  accountNumberTransfer?: {
    accountId: string;
    accountName: string;
    last4: string;
    matchReason: string;
    // If a matching transaction already exists in the target account
    existingMatch?: {
      id: string;
      date: string;
      description: string;
      amount: number;
      type: string;
      hasTransferLink: boolean; // true if already linked to another transaction
    };
  };
}

export const dynamic = 'force-dynamic';

/**
 * POST /api/csv-import
 * Parse and validate CSV file for import
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await requireAuth();
    const { householdId } = await getAndVerifyHousehold(request, userId);

    const body = (await request.json()) as CSVImportRequest;

    const {
      file: fileBase64,
      fileName,
      columnMappings,
      dateFormat,
      delimiter = ',',
      hasHeaderRow = true,
      skipRows = 0,
      defaultAccountId,
      templateId,
      previewOnly = true,
      // Phase 12: Credit card fields
      sourceType = 'auto',
      issuer,
      amountSignConvention = 'standard',
    } = body;

    // Validate required fields
    if (!fileBase64 || !columnMappings || !dateFormat) {
      return new Response('Missing required fields', { status: 400 });
    }

    // Convert base64 to text (server-side compatible)
    console.log('Converting base64 to text, base64 length:', fileBase64.length);
    const text = Buffer.from(fileBase64, 'base64').toString('utf-8');
    console.log('Text decoded, length:', text.length, 'First 100 chars:', text.substring(0, 100));

    // Parse CSV directly from text (server-side compatible)
    const lines = text.split('\n').filter((line) => line.trim());
    const dataLines = lines.slice(skipRows);

    console.log('Total lines:', lines.length, 'Data lines after skip:', dataLines.length);

    if (dataLines.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No data found in CSV file' }),
        { status: 400 }
      );
    }

    // Parse with PapaParse
    const Papa = (await import('papaparse')).default;
    const parseResult = Papa.parse(dataLines.join('\n'), {
      delimiter,
      header: false,
      skipEmptyLines: true,
    });

    const rows = parseResult.data as string[][];

    console.log('Parsed CSV rows:', rows.length);

    // Only fail if there are errors AND no data was parsed
    if (parseResult.errors && parseResult.errors.length > 0) {
      console.warn('CSV parsing had errors (may be non-critical):', parseResult.errors);

      // If we got no rows, it's a real error
      if (!rows || rows.length === 0) {
        return new Response(
          JSON.stringify({
            error: 'Failed to parse CSV file',
            details: parseResult.errors.map(e => e.message).join(', ')
          }),
          { status: 400 }
        );
      }
      // Otherwise, just log the warnings and continue
    }

    if (!rows || rows.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No rows found in CSV file' }),
        { status: 400 }
      );
    }
    const parsed = {
      headers: hasHeaderRow ? rows[0] : [],
      rows: hasHeaderRow ? rows.slice(1).map(row => {
        const obj: Record<string, string> = {};
        rows[0].forEach((header, i) => {
          obj[header] = row[i] || '';
        });
        return obj;
      }) : rows.map((row, _idx) => {
        const obj: Record<string, string> = {};
        row.forEach((val, i) => {
          obj[`Column ${i + 1}`] = val || '';
        });
        return obj;
      }),
      totalRows: hasHeaderRow ? rows.length - 1 : rows.length,
    };

    // Validate column mappings
    // Required: date and description
    // For amount: either 'amount' OR both 'withdrawal' and 'deposit'
    const hasDate = columnMappings.some((m) => m.appField === 'date');
    const hasDescription = columnMappings.some((m) => m.appField === 'description');
    const hasAmount = columnMappings.some((m) => m.appField === 'amount');
    const hasWithdrawal = columnMappings.some((m) => m.appField === 'withdrawal');
    const hasDeposit = columnMappings.some((m) => m.appField === 'deposit');

    const missingFields: string[] = [];
    if (!hasDate) missingFields.push('date');
    if (!hasDescription) missingFields.push('description');
    if (!hasAmount && !(hasWithdrawal || hasDeposit)) {
      missingFields.push('amount (or withdrawal/deposit)');
    }

    if (missingFields.length > 0) {
      return new Response(
        JSON.stringify({
          error: `Missing required field mappings: ${missingFields.join(', ')}`,
        }),
        { status: 400 }
      );
    }

    // Phase 12: Extract statement info from skipped rows (for credit cards)
    let statementInfo = null;
    if (sourceType === 'credit_card' && skipRows > 0) {
      const preDataRows = lines.slice(0, skipRows);
      statementInfo = extractStatementInfoFromHeaders(preDataRows, delimiter);
    }

    // Create import history record
    const importHistoryId = nanoid();
    const now = new Date().toISOString();

    const importRecord = {
      id: importHistoryId,
      userId,
      householdId: householdId || null,
      templateId: templateId || null,
      filename: fileName,
      fileSize: text.length,
      rowsTotal: parsed.totalRows,
      rowsImported: 0,
      rowsSkipped: 0,
      rowsDuplicates: 0,
      status: previewOnly ? ('pending' as const) : ('processing' as const),
      errorMessage: null,
      importSettings: JSON.stringify({
        columnMappings,
        dateFormat,
        delimiter,
        hasHeaderRow,
        skipRows,
        defaultAccountId,
        sourceType,
        issuer,
        amountSignConvention,
      }),
      // Phase 12: Credit card fields
      sourceType: sourceType || null,
      statementInfo: statementInfo ? JSON.stringify(statementInfo) : null,
      startedAt: now,
      completedAt: null,
      rolledBackAt: null,
    };

    if (!previewOnly) {
      await db.insert(importHistory).values(importRecord);
    }

    // Process rows and create staging records
    const stagingRecords: StagingRecord[] = [];
    const errors: string[] = [];

    // Fetch household accounts for account-number-based transfer detection
    const householdAccounts = await db
      .select({
        id: accounts.id,
        name: accounts.name,
        accountNumberLast4: accounts.accountNumberLast4,
      })
      .from(accounts)
      .where(eq(accounts.householdId, householdId));

    // Fetch household merchants for enhanced duplicate detection
    const householdMerchants: MerchantInfo[] = await db
      .select({
        id: merchants.id,
        name: merchants.name,
      })
      .from(merchants)
      .where(eq(merchants.householdId, householdId));

    // Phase 12: Fetch existing transactions for transfer detection
    // Filter by householdId to check against all household transactions
    const existingTransactionsForTransfer = await db
      .select({
        id: transactions.id,
        description: transactions.description,
        amount: transactions.amount,
        date: transactions.date,
        type: transactions.type,
        accountId: transactions.accountId,
        transferId: transactions.transferId,
      })
      .from(transactions)
      .where(eq(transactions.householdId, householdId))
      .limit(500);

    for (let i = 0; i < parsed.rows.length; i++) {
      const row = parsed.rows[i];
      const rowNumber = i + 1;
      const stagingId = nanoid();

      try {
        // Apply mappings
        let mappedData = applyMappings(
          row,
          columnMappings,
          dateFormat,
          defaultAccountId
        );

        // Phase 12: Apply credit card processing if this is a credit card import
        if (sourceType === 'credit_card') {
          mappedData = applyCreditCardProcessing(mappedData, amountSignConvention);
        }

        // Validate
        const validationErrors = validateMappedTransaction(mappedData);

        // Check for duplicates
        let duplicateOf: string | undefined;
        let duplicateScore: number | undefined;
        let duplicateMatchReason: 'levenshtein' | 'merchant_name' | undefined;
        let duplicateMerchantName: string | undefined;
        let matchedTransaction: StagingRecord['matchedTransaction'];
        let potentialTransferId: string | undefined;
        let transferMatchConfidence: number | undefined;
        let accountNumberTransfer: StagingRecord['accountNumberTransfer'];

        if (validationErrors.length === 0) {
          const transactionAccountId = mappedData.accountId || defaultAccountId || '';

          // Build account name map for display
          const accountNameMap = new Map(householdAccounts.map(a => [a.id, a.name]));

          // FIRST: Check for account number-based transfer detection
          // If a transfer is detected, skip duplicate detection entirely
          const otherAccounts: AccountInfo[] = householdAccounts
            .filter(a => a.id !== transactionAccountId)
            .map(a => ({
              id: a.id,
              name: a.name,
              accountNumberLast4: a.accountNumberLast4,
            }));

          const accountTransferMatch = detectTransferByAccountNumber(
            mappedData.description,
            otherAccounts
          );

          if (accountTransferMatch) {
            // This is a transfer - check if matching transaction exists in target account
            // Look for transactions in the target account with:
            // - Same amount (opposite sign or same amount for income)
            // - Similar date (within 3 days)
            const mappedAmount = mappedData.amount instanceof Decimal
              ? mappedData.amount.toNumber()
              : mappedData.amount;
            const mappedDate = new Date(mappedData.date);

            // Get transactions from the target account
            const targetAccountTransactions = existingTransactionsForTransfer.filter(
              (tx) => tx.accountId === accountTransferMatch.accountId
            );

            // Find matching transaction in target account
            let existingMatch: {
              id: string;
              date: string;
              description: string;
              amount: number;
              type: string;
              hasTransferLink: boolean;
            } | undefined;

            for (const tx of targetAccountTransactions) {
              const txDate = new Date(tx.date);
              const daysDiff = Math.abs((mappedDate.getTime() - txDate.getTime()) / (1000 * 60 * 60 * 24));

              // Check date proximity (within 3 days)
              if (daysDiff > 3) continue;

              // Check amount match:
              // - For transfers, the target side should have the same absolute amount
              // - Could be income (positive) matching the expense (negative) amount
              const amountDiff = Math.abs(Math.abs(tx.amount) - Math.abs(mappedAmount));
              const amountPercentDiff = amountDiff / Math.max(Math.abs(tx.amount), Math.abs(mappedAmount));

              if (amountPercentDiff <= 0.01) { // Within 1% tolerance
                existingMatch = {
                  id: tx.id,
                  date: tx.date,
                  description: tx.description,
                  amount: tx.amount,
                  type: tx.type || 'expense',
                  hasTransferLink: !!tx.transferId,
                };
                break; // Take the first match
              }
            }

            accountNumberTransfer = {
              ...accountTransferMatch,
              existingMatch,
            };
          } else {
            // Not a transfer by account number - check for duplicates

            // Get existing transactions for duplicate checking with account info
            const rawExistingTransactions = await db
              .select({
                id: transactions.id,
                description: transactions.description,
                amount: transactions.amount,
                date: transactions.date,
                type: transactions.type,
                accountId: transactions.accountId,
                merchantId: transactions.merchantId,
              })
              .from(transactions)
              .where(eq(transactions.householdId, householdId))
              .limit(500);

            // Build merchant name map
            const merchantNameMap = new Map(householdMerchants.map(m => [m.id, m.name]));

            // Map to enhanced format with account and merchant names
            const existingTransactionsEnhanced: ExistingTransactionForDuplicates[] = rawExistingTransactions.map((t) => ({
              ...t,
              type: t.type || 'expense',
              accountName: accountNameMap.get(t.accountId),
              merchantName: t.merchantId ? merchantNameMap.get(t.merchantId) : null,
            }));

            // Use enhanced duplicate detection with merchant name matching
            const duplicates = detectDuplicatesEnhanced(
              mappedData.description,
              mappedData.amount instanceof Decimal
                ? mappedData.amount.toNumber()
                : mappedData.amount,
              mappedData.date,
              transactionAccountId,
              existingTransactionsEnhanced,
              householdMerchants,
              { dateRangeInDays: 1 } // Stricter for merchant matching
            );

            if (duplicates && duplicates.length > 0) {
              const topMatch = duplicates[0];
              duplicateOf = topMatch.id;
              duplicateScore = topMatch.similarity;
              duplicateMatchReason = topMatch.matchReason;
              duplicateMerchantName = topMatch.merchantName;
              matchedTransaction = {
                id: topMatch.id,
                date: topMatch.date,
                description: topMatch.description,
                amount: topMatch.amount,
                accountName: topMatch.accountName,
              };
            }

            // Phase 12: Check for potential transfer matches (existing behavior)
            // This helps prevent duplicates when importing both sides of a transfer
            if (!duplicateOf) {
              const transferMatches = detectPotentialTransfers(
                mappedData,
                existingTransactionsForTransfer.map(t => ({
                  ...t,
                  type: t.type || 'expense',
                })),
                { dateRangeInDays: 3, minConfidence: 70 }
              );

              if (transferMatches.length > 0) {
                potentialTransferId = transferMatches[0].transactionId;
                transferMatchConfidence = transferMatches[0].confidence;
              }
            }
          }
        }

        stagingRecords.push({
          id: stagingId,
          rowNumber,
          rawData: row,
          mappedData,
          duplicateOf,
          duplicateScore,
          duplicateMatchReason,
          duplicateMerchantName,
          matchedTransaction,
          status: validationErrors.length > 0 ? 'review' :
                  duplicateOf ? 'review' :
                  accountNumberTransfer ? 'review' :
                  (potentialTransferId && transferMatchConfidence && transferMatchConfidence >= 85) ? 'review' :
                  'approved',
          validationErrors,
          // Phase 12: Credit card fields
          ccTransactionType: mappedData.ccTransactionType,
          potentialTransferId,
          transferMatchConfidence,
          accountNumberTransfer,
        });
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        stagingRecords.push({
          id: nanoid(),
          rowNumber,
          rawData: row,
          mappedData: {} as MappedTransaction,
          status: 'review',
          validationErrors: [errorMessage],
        });
        errors.push(`Row ${rowNumber}: ${errorMessage}`);
      }
    }

    // Save staging records if not preview
    if (!previewOnly) {
      for (const record of stagingRecords) {
        await db.insert(importStaging).values({
          id: record.id,
          importHistoryId,
          rowNumber: record.rowNumber,
          rawData: JSON.stringify(record.rawData),
          mappedData: JSON.stringify(record.mappedData),
          duplicateOf: record.duplicateOf || null,
          duplicateScore: record.duplicateScore || null,
          status: record.status,
          validationErrors:
            record.validationErrors.length > 0
              ? JSON.stringify(record.validationErrors)
              : null,
          // Phase 12: Credit card fields
          ccTransactionType: record.ccTransactionType || null,
          potentialTransferId: record.potentialTransferId || null,
          transferMatchConfidence: record.transferMatchConfidence || null,
          createdAt: now,
        });
      }
    }

    const summary = {
      importHistoryId: previewOnly ? null : importHistoryId,
      fileName,
      totalRows: parsed.totalRows,
      validRows: stagingRecords.filter((r) => r.status === 'approved').length,
      reviewRows: stagingRecords.filter((r) => r.status === 'review').length,
      duplicateRows: stagingRecords.filter((r) => r.duplicateOf).length,
      transferMatches: stagingRecords.filter((r) => r.potentialTransferId || r.accountNumberTransfer).length,
      errors: errors.length > 0 ? errors : undefined,
      // Phase 12: Include credit card info in response
      sourceType,
      detectedIssuer: issuer,
      statementInfo,
      staging: stagingRecords.map((r) => ({
        rowNumber: r.rowNumber,
        status: r.status,
        validationErrors: r.validationErrors,
        duplicateOf: r.duplicateOf,
        duplicateScore: r.duplicateScore,
        duplicateMatchReason: r.duplicateMatchReason,
        duplicateMerchantName: r.duplicateMerchantName,
        matchedTransaction: r.matchedTransaction,
        data: r.mappedData,
        // Phase 12: Credit card fields
        ccTransactionType: r.ccTransactionType,
        potentialTransferId: r.potentialTransferId,
        transferMatchConfidence: r.transferMatchConfidence,
        // Account number transfer detection
        accountNumberTransfer: r.accountNumberTransfer,
      })),
    };

    return Response.json(summary);
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error processing CSV import:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
