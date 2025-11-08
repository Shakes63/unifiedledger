import { auth } from '@clerk/nextjs/server';
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { importHistory, importStaging, transactions } from '@/lib/db/schema';
import { nanoid } from 'nanoid';
import { eq } from 'drizzle-orm';
import {
  parseCSVFile,
  autoDetectMappings,
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

    // Convert base64 to File
    const binaryString = Buffer.from(fileBase64, 'base64').toString('binary');
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const file = new File([bytes], fileName, { type: 'text/csv' });

    // Parse CSV
    const parsed = await parseCSVFile(file, delimiter, hasHeaderRow, skipRows);

    // Validate column mappings
    const missingRequiredFields = ['date', 'description', 'amount'].filter(
      (field) => !columnMappings.some((m) => m.appField === field)
    );

    if (missingRequiredFields.length > 0) {
      return new Response(
        JSON.stringify({
          error: `Missing required field mappings: ${missingRequiredFields.join(', ')}`,
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
      fileSize: file.size,
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

        // Validate
        const validationErrors = validateMappedTransaction(mappedData);

        // Check for duplicates
        let duplicateOf: string | undefined;
        let duplicateScore: number | undefined;

        if (validationErrors.length === 0) {
          const duplicates = detectDuplicateTransactions(
            {
              description: mappedData.description,
              amount: mappedData.amount instanceof Decimal
                ? mappedData.amount.toNumber()
                : mappedData.amount,
              date: mappedData.date,
            },
            userId
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
