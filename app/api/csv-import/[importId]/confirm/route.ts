import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import {
  importHistory,
  importStaging,
  transactions,
} from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { findMatchingRule } from '@/lib/rules/rule-matcher';
import Decimal from 'decimal.js';

export const dynamic = 'force-dynamic';

/**
 * POST /api/csv-import/[importId]/confirm
 * Confirm and import staging records into transactions
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ importId: string }> }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { importId } = await params;
    const body = await request.json();
    const { recordIds } = body; // Array of staging record IDs to import

    // Verify import belongs to user
    const importRecord = await db
      .select()
      .from(importHistory)
      .where(
        and(eq(importHistory.id, importId), eq(importHistory.userId, userId))
      )
      .limit(1);

    if (!importRecord.length) {
      return Response.json(
        { error: 'Import not found' },
        { status: 404 }
      );
    }

    const importData = importRecord[0];

    // Get staging records to import
    const stagingRecords = await db
      .select()
      .from(importStaging)
      .where(eq(importStaging.importHistoryId, importId));

    const recordsToImport = stagingRecords.filter((r) =>
      recordIds ? recordIds.includes(r.id) : r.status === 'approved'
    );

    if (recordsToImport.length === 0) {
      return Response.json(
        { error: 'No records to import' },
        { status: 400 }
      );
    }

    // Import records
    let importedCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    for (const stagingRecord of recordsToImport) {
      try {
        const mappedData = JSON.parse(stagingRecord.mappedData);

        // Create transaction
        const txId = nanoid();
        const now = new Date().toISOString();

        let categoryId: string | null = null;

        // Try to match categorization rules
        const ruleMatch = await findMatchingRule(
          userId,
          {
            description: mappedData.description,
            amount: typeof mappedData.amount === 'number'
              ? mappedData.amount
              : new Decimal(mappedData.amount).toNumber(),
            accountName: mappedData.accountName || 'Unknown',
            date: mappedData.date,
            notes: mappedData.notes,
          }
        );

        if (ruleMatch.matched && ruleMatch.rule) {
          categoryId = ruleMatch.rule.categoryId;
        } else if (mappedData.category) {
          // Use provided category if available
          categoryId = mappedData.category;
        }

        const amount = new Decimal(
          typeof mappedData.amount === 'number'
            ? mappedData.amount
            : mappedData.amount.toString()
        );

        await db.insert(transactions).values({
          id: txId,
          userId,
          accountId: mappedData.accountId,
          categoryId,
          date: mappedData.date,
          amount: amount.toNumber(),
          description: mappedData.description,
          notes: mappedData.notes || null,
          type: mappedData.type,
          importHistoryId: importId,
          importRowNumber: stagingRecord.rowNumber,
          createdAt: now,
          updatedAt: now,
        });

        // Update staging record status
        await db
          .update(importStaging)
          .set({ status: 'imported' })
          .where(eq(importStaging.id, stagingRecord.id));

        importedCount++;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        errors.push(
          `Row ${stagingRecord.rowNumber}: ${errorMessage}`
        );
        errorCount++;
      }
    }

    // Update import history
    const now = new Date().toISOString();
    const skippedCount = stagingRecords.length - recordsToImport.length;
    const duplicateCount = recordsToImport.filter(
      (r) => r.duplicateOf
    ).length;

    await db
      .update(importHistory)
      .set({
        status: 'completed',
        rowsImported: importedCount,
        rowsSkipped: skippedCount,
        rowsDuplicates: duplicateCount,
        completedAt: now,
      })
      .where(eq(importHistory.id, importId));

    return Response.json({
      success: true,
      importId,
      imported: importedCount,
      failed: errorCount,
      skipped: skippedCount,
      duplicates: duplicateCount,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('Error confirming CSV import:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
