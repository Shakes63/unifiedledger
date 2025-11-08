import { auth } from '@clerk/nextjs/server';
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { importHistory, importStaging, transactions } from '@/lib/db/schema';
import { nanoid } from 'nanoid';
import { eq } from 'drizzle-orm';
import {
  applyMappings,
  validateMappedTransaction,
  type ColumnMapping,
  type MappedTransaction,
} from '@/lib/csv-import';
import { detectDuplicateTransactions } from '@/lib/duplicate-detection';
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
}

interface StagingRecord {
  id: string;
  rowNumber: number;
  rawData: Record<string, string>;
  mappedData: MappedTransaction;
  duplicateOf?: string;
  duplicateScore?: number;
  status: 'pending' | 'review' | 'approved' | 'skipped' | 'imported';
  validationErrors: string[];
}

export const dynamic = 'force-dynamic';

/**
 * POST /api/csv-import
 * Parse and validate CSV file for import
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

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
      householdId,
      previewOnly = true,
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
      }) : rows.map((row, idx) => {
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
      }),
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

    for (let i = 0; i < parsed.rows.length; i++) {
      const row = parsed.rows[i];
      const rowNumber = i + 1;
      const stagingId = nanoid();

      try {
        // Apply mappings
        const mappedData = applyMappings(
          row,
          columnMappings,
          dateFormat,
          defaultAccountId
        );

        // Debug: Log first 3 mapped rows
        if (i < 3) {
          console.log(`Row ${rowNumber} mapped data:`, {
            description: mappedData.description,
            amount: mappedData.amount?.toString(),
            type: mappedData.type,
            date: mappedData.date,
            rawRow: row
          });
        }

        // Validate
        const validationErrors = validateMappedTransaction(mappedData);

        // Check for duplicates
        let duplicateOf: string | undefined;
        let duplicateScore: number | undefined;

        if (validationErrors.length === 0) {
          // Get existing transactions for duplicate checking
          const rawExistingTransactions = await db
            .select({
              id: transactions.id,
              description: transactions.description,
              amount: transactions.amount,
              date: transactions.date,
              type: transactions.type,
            })
            .from(transactions)
            .where(eq(transactions.userId, userId))
            .limit(100);

          // Map to ensure type is always a string
          const existingTransactions = rawExistingTransactions.map((t) => ({
            ...t,
            type: t.type || 'expense',
          }));

          const duplicates = detectDuplicateTransactions(
            mappedData.description,
            mappedData.amount instanceof Decimal
              ? mappedData.amount.toNumber()
              : mappedData.amount,
            mappedData.date,
            existingTransactions,
            { dateRangeInDays: 7 }
          );

          if (duplicates && duplicates.length > 0) {
            const topMatch = duplicates[0];
            duplicateOf = topMatch.id;
            duplicateScore = topMatch.similarity;
          }
        }

        stagingRecords.push({
          id: stagingId,
          rowNumber,
          rawData: row,
          mappedData,
          duplicateOf,
          duplicateScore,
          status: validationErrors.length > 0 ? 'review' : duplicateOf ? 'review' : 'approved',
          validationErrors,
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
      errors: errors.length > 0 ? errors : undefined,
      staging: stagingRecords.map((r) => ({
        rowNumber: r.rowNumber,
        status: r.status,
        validationErrors: r.validationErrors,
        duplicateOf: r.duplicateOf,
        duplicateScore: r.duplicateScore,
        data: r.mappedData,
      })),
    };

    return Response.json(summary);
  } catch (error) {
    console.error('Error processing CSV import:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
