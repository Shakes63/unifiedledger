import { requireAuth } from '@/lib/auth-helpers';
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
    const { userId } = await requireAuth();

    const { importId } = await params;
    const body = await request.json();
    const { recordIds } = body; // Array of row numbers (as strings) to import

    console.log('Confirm import request:', { importId, recordIds: recordIds?.slice(0, 5) });

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

    // Convert row numbers to integers for comparison
    const rowNumbersToImport = recordIds
      ? new Set(recordIds.map((id: string) => parseInt(id, 10)))
      : null;

    const recordsToImport = stagingRecords.filter((r) =>
      rowNumbersToImport
        ? rowNumbersToImport.has(r.rowNumber)
        : r.status === 'approved'
    );

    console.log('Staging records found:', stagingRecords.length);
    console.log('Records to import:', recordsToImport.length);

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
          // Extract categoryId from actions (find first set_category action)
          const setCategoryAction = ruleMatch.rule.actions.find(a => a.type === 'set_category');
          if (setCategoryAction && setCategoryAction.value) {
            categoryId = setCategoryAction.value;
          }
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
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error confirming CSV import:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
