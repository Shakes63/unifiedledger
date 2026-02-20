import { requireAuth } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import {
  importHistory,
  importStaging,
  transactions,
  ruleExecutionLog,
  accounts,
} from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { findMatchingRule } from '@/lib/rules/rule-matcher';
import Decimal from 'decimal.js';
import { executeRuleActions } from '@/lib/rules/actions-executor';
import {
  amountToCents,
  insertTransactionMovement,
  insertTransferMovement,
} from '@/lib/transactions/money-movement-service';

export const dynamic = 'force-dynamic';

/**
 * Transfer decision from the frontend
 */
interface TransferDecision {
  rowNumber: number;
  importType: 'transfer' | 'link_existing' | 'regular';
  targetAccountId?: string;
  existingTransactionId?: string; // For link_existing option
}

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
    const { recordIds, transferDecisions = [] } = body; // Array of row numbers (as strings) to import, and transfer decisions

    console.log('Confirm import request:', { importId, recordIds: recordIds?.slice(0, 5), transferDecisions });

    // Build a map of transfer decisions by row number for quick lookup
    const transferDecisionMap = new Map<number, TransferDecision>();
    for (const decision of transferDecisions as TransferDecision[]) {
      transferDecisionMap.set(decision.rowNumber, decision);
    }

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
    
    // Get householdId from import history (required for rule matching)
    if (!importData.householdId) {
      return Response.json(
        { error: 'Import history missing household ID' },
        { status: 400 }
      );
    }
    const householdId = importData.householdId;

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
        let appliedRuleId: string | null = null;
        let appliedActions: unknown[] = [];
        let finalDescription: string = mappedData.description;
        let finalMerchantId: string | null = null;
        let finalIsTaxDeductible = false;
        let finalIsSalesTaxable = false;

        // Try to match categorization rules (filtered by household)
        const ruleMatch = await findMatchingRule(
          userId,
          householdId,
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
          appliedRuleId = ruleMatch.rule.ruleId;

          const executionResult = await executeRuleActions(
            userId,
            ruleMatch.rule.actions,
            {
              categoryId,
              description: finalDescription,
              merchantId: finalMerchantId,
              accountId: mappedData.accountId,
              amount: typeof mappedData.amount === 'number'
                ? mappedData.amount
                : new Decimal(mappedData.amount).toNumber(),
              date: mappedData.date,
              type: mappedData.type,
              isTaxDeductible: false,
            },
            null,
            null,
            householdId
          );

          if (executionResult.mutations.categoryId !== undefined) {
            categoryId = executionResult.mutations.categoryId;
          }
          if (executionResult.mutations.description) {
            finalDescription = executionResult.mutations.description;
          }
          if (executionResult.mutations.merchantId !== undefined) {
            finalMerchantId = executionResult.mutations.merchantId;
          }
          if (executionResult.mutations.isTaxDeductible !== undefined) {
            finalIsTaxDeductible = executionResult.mutations.isTaxDeductible;
          }
          if (executionResult.mutations.isSalesTaxable !== undefined) {
            finalIsSalesTaxable = executionResult.mutations.isSalesTaxable;
          }

          appliedActions = executionResult.appliedActions;

          if (executionResult.errors && executionResult.errors.length > 0) {
            console.warn('Rule action execution errors during import confirm:', executionResult.errors);
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

        // Check if this row should be imported as a transfer
        const transferDecision = transferDecisionMap.get(stagingRecord.rowNumber);
        const importType = transferDecision?.importType || 'regular';

        if (importType === 'link_existing' && transferDecision?.existingTransactionId && transferDecision?.targetAccountId) {
          const transferGroupId = nanoid();
          const newTxId = nanoid();
          const transferAmountCents = amountToCents(amount.abs());

          // Verify the existing transaction exists and belongs to the same user/household/target account.
          const existingTxResult = await db
            .select()
            .from(transactions)
            .where(
              and(
                eq(transactions.id, transferDecision.existingTransactionId),
                eq(transactions.userId, userId),
                eq(transactions.accountId, transferDecision.targetAccountId),
                eq(transactions.householdId, householdId)
              )
            )
            .limit(1);

          if (existingTxResult.length === 0) {
            throw new Error(`Existing transaction not found: ${transferDecision.existingTransactionId}`);
          }

          const existingTx = existingTxResult[0];
          if (
            existingTx.transferGroupId ||
            existingTx.pairedTransactionId ||
            (existingTx.transferId && existingTx.transferId.length > 0)
          ) {
            throw new Error(`Existing transaction is already linked as transfer: ${transferDecision.existingTransactionId}`);
          }

          const existingIsInbound = existingTx.type === 'income' || existingTx.type === 'transfer_in';
          const newTxType = existingIsInbound ? 'transfer_out' : 'transfer_in';
          const existingTxType = existingIsInbound ? 'transfer_in' : 'transfer_out';
          const sourceAccountId = existingIsInbound ? mappedData.accountId : transferDecision.targetAccountId;
          const destinationAccountId = existingIsInbound ? transferDecision.targetAccountId : mappedData.accountId;
          const fromTransactionId = existingIsInbound ? newTxId : existingTx.id;
          const toTransactionId = existingIsInbound ? existingTx.id : newTxId;

          await insertTransactionMovement(db, {
            id: newTxId,
            userId,
            householdId,
            accountId: mappedData.accountId,
            categoryId: null,
            merchantId: null,
            date: mappedData.date,
            amountCents: transferAmountCents,
            description: finalDescription,
            notes: mappedData.notes || null,
            type: newTxType,
            transferId: transferGroupId,
            transferGroupId,
            pairedTransactionId: existingTx.id,
            transferSourceAccountId: sourceAccountId,
            transferDestinationAccountId: destinationAccountId,
            isTaxDeductible: false,
            isSalesTaxable: false,
            importHistoryId: importId,
            importRowNumber: stagingRecord.rowNumber,
            createdAt: now,
            updatedAt: now,
          });

          await db
            .update(transactions)
            .set({
              type: existingTxType,
              transferId: transferGroupId,
              transferGroupId,
              pairedTransactionId: newTxId,
              transferSourceAccountId: sourceAccountId,
              transferDestinationAccountId: destinationAccountId,
              categoryId: null,
              merchantId: null,
              updatedAt: now,
            })
            .where(eq(transactions.id, transferDecision.existingTransactionId));

          await insertTransferMovement(db, {
            id: transferGroupId,
            userId,
            householdId,
            fromAccountId: sourceAccountId,
            toAccountId: destinationAccountId,
            amountCents: transferAmountCents,
            feesCents: 0,
            description: finalDescription,
            date: mappedData.date,
            status: 'completed',
            fromTransactionId,
            toTransactionId,
            notes: mappedData.notes || existingTx.notes || null,
            createdAt: now,
          });

          console.log(`Linked import row ${stagingRecord.rowNumber} (${newTxId}) to existing transaction ${transferDecision.existingTransactionId}`);
        } else if (importType === 'transfer' && transferDecision?.targetAccountId) {
          const transferGroupId = nanoid();
          const transferOutId = nanoid();
          const transferInId = nanoid();
          const transferAmountCents = amountToCents(amount.abs());

          // Validate target account exists in user/household.
          const targetAccountResult = await db
            .select({ id: accounts.id })
            .from(accounts)
            .where(
              and(
                eq(accounts.id, transferDecision.targetAccountId),
                eq(accounts.userId, userId),
                eq(accounts.householdId, householdId)
              )
            )
            .limit(1);

          if (targetAccountResult.length === 0) {
            throw new Error(`Target account not found: ${transferDecision.targetAccountId}`);
          }

          // transfer_in = money arriving at CSV account (positive amount)
          const isIncomingTransfer = mappedData.type === 'transfer_in' ||
            (mappedData.type !== 'transfer_out' && amount.greaterThanOrEqualTo(0));
          const sourceAccountId = isIncomingTransfer ? transferDecision.targetAccountId : mappedData.accountId;
          const destinationAccountId = isIncomingTransfer ? mappedData.accountId : transferDecision.targetAccountId;
          const transferOutAccountId = isIncomingTransfer ? transferDecision.targetAccountId : mappedData.accountId;
          const transferInAccountId = isIncomingTransfer ? mappedData.accountId : transferDecision.targetAccountId;

          await insertTransactionMovement(db, {
            id: transferOutId,
            userId,
            householdId,
            accountId: transferOutAccountId,
            categoryId: null,
            merchantId: null,
            date: mappedData.date,
            amountCents: transferAmountCents,
            description: finalDescription,
            notes: mappedData.notes || null,
            type: 'transfer_out',
            transferId: transferGroupId,
            transferGroupId,
            pairedTransactionId: transferInId,
            transferSourceAccountId: sourceAccountId,
            transferDestinationAccountId: destinationAccountId,
            isTaxDeductible: false,
            isSalesTaxable: false,
            importHistoryId: importId,
            importRowNumber: stagingRecord.rowNumber,
            createdAt: now,
            updatedAt: now,
          });

          await insertTransactionMovement(db, {
            id: transferInId,
            userId,
            householdId,
            accountId: transferInAccountId,
            categoryId: null,
            merchantId: null,
            date: mappedData.date,
            amountCents: transferAmountCents,
            description: finalDescription,
            notes: mappedData.notes || null,
            type: 'transfer_in',
            transferId: transferGroupId,
            transferGroupId,
            pairedTransactionId: transferOutId,
            transferSourceAccountId: sourceAccountId,
            transferDestinationAccountId: destinationAccountId,
            isTaxDeductible: false,
            isSalesTaxable: false,
            importHistoryId: importId,
            importRowNumber: stagingRecord.rowNumber,
            createdAt: now,
            updatedAt: now,
          });

          await insertTransferMovement(db, {
            id: transferGroupId,
            userId,
            householdId,
            fromAccountId: sourceAccountId,
            toAccountId: destinationAccountId,
            amountCents: transferAmountCents,
            feesCents: 0,
            description: finalDescription,
            date: mappedData.date,
            status: 'completed',
            fromTransactionId: transferOutId,
            toTransactionId: transferInId,
            notes: mappedData.notes || null,
            createdAt: now,
          });

          console.log(`Created transfer pair for row ${stagingRecord.rowNumber}: ${transferOutId} -> ${transferInId}`);
        } else {
          // Import as regular transaction
          await insertTransactionMovement(db, {
            id: txId,
            userId,
            householdId,
            accountId: mappedData.accountId,
            categoryId,
            date: mappedData.date,
            amountCents: amountToCents(amount),
            description: finalDescription,
            merchantId: finalMerchantId,
            notes: mappedData.notes || null,
            type: mappedData.type,
            isTaxDeductible: finalIsTaxDeductible,
            isSalesTaxable: finalIsSalesTaxable,
            importHistoryId: importId,
            importRowNumber: stagingRecord.rowNumber,
            createdAt: now,
            updatedAt: now,
          });

          // Log rule execution if a rule was applied
          if (appliedRuleId) {
            try {
              await db.insert(ruleExecutionLog).values({
                id: nanoid(),
                userId,
                householdId,
                ruleId: appliedRuleId,
                transactionId: txId,
                appliedCategoryId: categoryId,
                appliedActions: appliedActions.length > 0 ? JSON.stringify(appliedActions) : null,
                matched: true,
                executedAt: now,
              });
            } catch (error) {
              console.error('Error logging rule execution for imported transaction:', error);
            }
          }
        }

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
