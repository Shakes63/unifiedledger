import { requireAuth } from '@/lib/auth-helpers';
import { getHouseholdIdFromRequest, requireHouseholdAuth } from '@/lib/api/household-auth';
import { db } from '@/lib/db';
import { transactions, accounts, budgetCategories, transactionSplits, bills, billInstances, merchants, debts, tags, transactionTags, customFields, customFieldValues, betterAuthUser, salesTaxTransactions } from '@/lib/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import Decimal from 'decimal.js';
import { deleteSalesTaxRecord } from '@/lib/sales-tax/transaction-sales-tax';
import { findMatchingBillInstance } from '@/lib/bills/bill-matching-helpers';
import { logTransactionAudit, detectChanges, createTransactionSnapshot, DisplayNames } from '@/lib/transactions/audit-logger';
import { processAndLinkBillPayment } from '@/lib/transactions/payment-linkage';
import { handleRouteError } from '@/lib/api/route-helpers';
import { runInDatabaseTransaction } from '@/lib/db/transaction-runner';
import {
  amountToCents,
  buildAccountBalanceFields,
  buildTransactionAmountFields,
  getAccountBalanceCents,
  getTransactionAmountCents,
} from '@/lib/transactions/money-movement-service';
import {
  deleteCanonicalTransferPairByTransactionId,
  updateCanonicalTransferPairByTransactionId,
} from '@/lib/transactions/transfer-service';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await requireAuth();
    const { id } = await params;

    // Get and validate household
    const householdId = getHouseholdIdFromRequest(request);
    await requireHouseholdAuth(userId, householdId);

    // TypeScript: householdId is guaranteed to be non-null after requireHouseholdAuth
    if (!householdId) {
      return Response.json(
        { error: 'Household ID is required' },
        { status: 400 }
      );
    }

    const transaction = await db
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.id, id),
          eq(transactions.userId, userId),
          eq(transactions.householdId, householdId)
        )
      )
      .limit(1);

    if (transaction.length === 0) {
      return Response.json(
        { error: 'Transaction not found' },
        { status: 404 }
      );
    }

    const txData = transaction[0];

    // Fetch related data
    const [accountData, categoryData, merchantData, billData, debtData] = await Promise.all([
      // Account
      txData.accountId
        ? db.select().from(accounts).where(eq(accounts.id, txData.accountId)).limit(1)
        : Promise.resolve([]),

      // Category
      txData.categoryId
        ? db.select().from(budgetCategories).where(eq(budgetCategories.id, txData.categoryId)).limit(1)
        : Promise.resolve([]),

      // Merchant
      txData.merchantId
        ? db.select().from(merchants).where(eq(merchants.id, txData.merchantId)).limit(1)
        : Promise.resolve([]),

      // Bill
      txData.billId
        ? db.select().from(bills).where(eq(bills.id, txData.billId)).limit(1)
        : Promise.resolve([]),

      // Debt
      txData.debtId
        ? db.select().from(debts).where(eq(debts.id, txData.debtId)).limit(1)
        : Promise.resolve([]),
    ]);

    // Fetch tags
    const tagLinks = await db
      .select({
        tag: tags,
      })
      .from(transactionTags)
      .innerJoin(tags, eq(transactionTags.tagId, tags.id))
      .where(eq(transactionTags.transactionId, id));

    // Fetch custom field values
    const fieldValues = await db
      .select({
        field: customFields,
        value: customFieldValues,
      })
      .from(customFieldValues)
      .innerJoin(customFields, eq(customFieldValues.customFieldId, customFields.id))
      .where(eq(customFieldValues.transactionId, id));

    // Build enriched response
    const enrichedTransaction = {
      ...txData,
      account: accountData[0] || null,
      category: categoryData[0] || null,
      merchant: merchantData[0] || null,
      bill: billData[0] || null,
      debt: debtData[0] || null,
      tags: tagLinks.map(t => t.tag),
      customFields: fieldValues.map(cf => ({
        field: cf.field,
        value: cf.value,
      })),
    };

    return Response.json(enrichedTransaction);
  } catch (error) {
    return handleRouteError(error, {
      defaultError: 'Internal server error',
      logLabel: 'Transaction fetch error:',
    });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await requireAuth();
    const { id } = await params;
    const body = await request.json();

    // Get and validate household
    const householdId = getHouseholdIdFromRequest(request, body);
    await requireHouseholdAuth(userId, householdId);

    // TypeScript: householdId is guaranteed to be non-null after requireHouseholdAuth
    if (!householdId) {
      return Response.json(
        { error: 'Household ID is required' },
        { status: 400 }
      );
    }

    // Get existing transaction
    const existingTransaction = await db
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.id, id),
          eq(transactions.userId, userId),
          eq(transactions.householdId, householdId)
        )
      )
      .limit(1);

    if (existingTransaction.length === 0) {
      return Response.json(
        { error: 'Transaction not found' },
        { status: 404 }
      );
    }

    const transaction = existingTransaction[0];

    const {
      accountId,
      categoryId,
      merchantId,
      billInstanceId, // For direct bill payment matching
      date,
      amount,
      description,
      notes,
      isPending,
      transferId, // For updating transfer destination account
      transferDestinationAccountId, // Canonical destination account updates
      transferSourceAccountId, // For updating transfer source account on transfer_in
    } = body;

    const hasUpdateField =
      accountId !== undefined ||
      categoryId !== undefined ||
      merchantId !== undefined ||
      date !== undefined ||
      amount !== undefined ||
      description !== undefined ||
      notes !== undefined ||
      isPending !== undefined ||
      transferId !== undefined ||
      transferDestinationAccountId !== undefined ||
      transferSourceAccountId !== undefined;

    // Validate at least one field is provided for update
    if (!hasUpdateField) {
      return Response.json(
        { error: 'No fields to update' },
        { status: 400 }
      );
    }

    const destinationAccountInput = transferDestinationAccountId ?? transferId;

    if (transaction.type === 'transfer_out' || transaction.type === 'transfer_in') {
      try {
        const sourceAccountUpdate =
          transaction.type === 'transfer_out'
            ? (accountId ?? transferSourceAccountId)
            : transferSourceAccountId;
        const destinationAccountUpdate =
          transaction.type === 'transfer_in'
            ? (accountId ?? destinationAccountInput)
            : destinationAccountInput;

        await updateCanonicalTransferPairByTransactionId({
          userId,
          householdId,
          transactionId: id,
          amountCents: amount !== undefined ? amountToCents(new Decimal(amount)) : undefined,
          date,
          description,
          notes,
          isPending,
          sourceAccountId: sourceAccountUpdate,
          destinationAccountId: destinationAccountUpdate,
        });

        return Response.json(
          {
            id,
            message: 'Transaction updated successfully',
          },
          { status: 200 }
        );
      } catch (transferUpdateError) {
        const message = transferUpdateError instanceof Error
          ? transferUpdateError.message
          : 'Failed to update transfer transaction';

        if (message.includes('Cannot transfer to the same account')) {
          return Response.json({ error: message }, { status: 400 });
        }

        if (message.includes('not found')) {
          return Response.json({ error: message }, { status: 404 });
        }

        throw transferUpdateError;
      }
    }

    // Use existing values for fields not provided
    const newAccountId = accountId || transaction.accountId;
    const newAmount = amount ? new Decimal(amount) : new Decimal(transaction.amount);
    const oldAmountCents = getTransactionAmountCents(transaction);
    const newAmountCents = amount ? amountToCents(newAmount) : oldAmountCents;
    const newDate = date || transaction.date;
    const newDescription = description || transaction.description;
    const newNotes = notes !== undefined ? notes : transaction.notes;
    const newIsPending = isPending !== undefined ? isPending : transaction.isPending;
    const newCategoryId = categoryId !== undefined ? categoryId : transaction.categoryId;
    const newMerchantId = merchantId !== undefined ? merchantId : transaction.merchantId;

    // If accountId changed, verify new account exists
    if (newAccountId !== transaction.accountId) {
      const newAccount = await db
        .select()
        .from(accounts)
        .where(
          and(
            eq(accounts.id, newAccountId),
            eq(accounts.userId, userId),
            eq(accounts.householdId, householdId)
          )
        )
        .limit(1);

      if (newAccount.length === 0) {
        return Response.json(
          { error: 'Account not found' },
          { status: 404 }
        );
      }
    }

    // If category provided and not null, verify it exists
    if (newCategoryId) {
      const category = await db
        .select()
        .from(budgetCategories)
        .where(
          and(
            eq(budgetCategories.id, newCategoryId),
            eq(budgetCategories.userId, userId),
            eq(budgetCategories.householdId, householdId)
          )
        )
        .limit(1);

      if (category.length === 0) {
        return Response.json(
          { error: 'Category not found' },
          { status: 404 }
        );
      }
    }

    // Check if merchant changed and handle tax exemption for income transactions
    let newIsSalesTaxable = transaction.isSalesTaxable;
    let shouldDeleteSalesTaxRecord = false;
    if (
      transaction.type === 'income' &&
      newMerchantId !== transaction.merchantId &&
      newMerchantId
    ) {
      // Check if the new merchant is tax-exempt
      const merchantExemptCheck = await db
        .select({ isSalesTaxExempt: merchants.isSalesTaxExempt })
        .from(merchants)
        .where(eq(merchants.id, newMerchantId))
        .limit(1);
      const merchantIsSalesTaxExempt = merchantExemptCheck[0]?.isSalesTaxExempt || false;

      // If new merchant is tax-exempt and transaction was taxable, make it non-taxable
      if (merchantIsSalesTaxExempt && transaction.isSalesTaxable) {
        newIsSalesTaxable = false;
        shouldDeleteSalesTaxRecord = true;
      }
    }

    await runInDatabaseTransaction(async (tx) => {
      // Handle balance adjustments if amount or account changed
      if (amount || newAccountId !== transaction.accountId) {
        const oldAccount = await tx
          .select()
          .from(accounts)
          .where(eq(accounts.id, transaction.accountId))
          .limit(1);

        const newAccount = await tx
          .select()
          .from(accounts)
          .where(eq(accounts.id, newAccountId))
          .limit(1);

        if (oldAccount.length > 0 && newAccount.length > 0) {
          // Reverse old transaction effect
          let oldBalanceCents = getAccountBalanceCents(oldAccount[0]);
          if (transaction.type === 'expense' || transaction.type === 'transfer_out') {
            oldBalanceCents += oldAmountCents;
          } else {
            oldBalanceCents -= oldAmountCents;
          }

          await tx
            .update(accounts)
            .set(buildAccountBalanceFields(oldBalanceCents))
            .where(eq(accounts.id, transaction.accountId));

          // Apply new transaction effect
          let newBalanceCents = getAccountBalanceCents(newAccount[0]);
          if (transaction.type === 'expense' || transaction.type === 'transfer_out') {
            newBalanceCents -= newAmountCents;
          } else {
            newBalanceCents += newAmountCents;
          }

          await tx
            .update(accounts)
            .set(buildAccountBalanceFields(newBalanceCents))
            .where(eq(accounts.id, newAccountId));
        }
      }

      // Update transaction
      await tx
        .update(transactions)
        .set({
          accountId: newAccountId,
          categoryId: newCategoryId,
          merchantId: newMerchantId,
          transferId: transaction.transferId,
          transferGroupId: transaction.transferGroupId,
          transferSourceAccountId: transaction.transferSourceAccountId,
          transferDestinationAccountId: transaction.transferDestinationAccountId,
          date: newDate,
          ...buildTransactionAmountFields(newAmountCents),
          description: newDescription,
          notes: newNotes,
          isPending: newIsPending,
          isSalesTaxable: newIsSalesTaxable,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(transactions.id, id));
    });

    if (shouldDeleteSalesTaxRecord) {
      await deleteSalesTaxRecord(id);
    }

    // Log audit trail for transaction update
    try {
      // Build the new transaction state for comparison
      const newTransactionState = {
        accountId: newAccountId,
        categoryId: newCategoryId,
        merchantId: newMerchantId,
        transferId: transaction.transferId,
        transferGroupId: transaction.transferGroupId,
        transferSourceAccountId: transaction.transferSourceAccountId,
        transferDestinationAccountId: transaction.transferDestinationAccountId,
        date: newDate,
        amount: newAmount.toNumber(),
        description: newDescription,
        notes: newNotes,
        isPending: newIsPending,
        type: transaction.type,
        isTaxDeductible: transaction.isTaxDeductible,
        isSalesTaxable: newIsSalesTaxable,
        billId: transaction.billId,
        debtId: transaction.debtId,
      };

      // Fetch display names for changed foreign keys
      const displayNames: DisplayNames = {};
      
      // Fetch old and new account names if account changed
      if (newAccountId !== transaction.accountId) {
        const [oldAcc, newAcc] = await Promise.all([
          db.select({ name: accounts.name }).from(accounts).where(eq(accounts.id, transaction.accountId)).limit(1),
          db.select({ name: accounts.name }).from(accounts).where(eq(accounts.id, newAccountId)).limit(1),
        ]);
        displayNames.accountId = {
          old: oldAcc[0]?.name || 'Unknown Account',
          new: newAcc[0]?.name || 'Unknown Account',
        };
      }

      // Fetch old and new category names if category changed
      if (newCategoryId !== transaction.categoryId) {
        const [oldCat, newCat] = await Promise.all([
          transaction.categoryId
            ? db.select({ name: budgetCategories.name }).from(budgetCategories).where(eq(budgetCategories.id, transaction.categoryId)).limit(1)
            : Promise.resolve([]),
          newCategoryId
            ? db.select({ name: budgetCategories.name }).from(budgetCategories).where(eq(budgetCategories.id, newCategoryId)).limit(1)
            : Promise.resolve([]),
        ]);
        displayNames.categoryId = {
          old: oldCat[0]?.name || 'None',
          new: newCat[0]?.name || 'None',
        };
      }

      // Fetch old and new merchant names if merchant changed
      if (newMerchantId !== transaction.merchantId) {
        const [oldMerch, newMerch] = await Promise.all([
          transaction.merchantId
            ? db.select({ name: merchants.name }).from(merchants).where(eq(merchants.id, transaction.merchantId)).limit(1)
            : Promise.resolve([]),
          newMerchantId
            ? db.select({ name: merchants.name }).from(merchants).where(eq(merchants.id, newMerchantId)).limit(1)
            : Promise.resolve([]),
        ]);
        displayNames.merchantId = {
          old: oldMerch[0]?.name || 'None',
          new: newMerch[0]?.name || 'None',
        };
      }

      // Detect changes between old and new state
      const changes = detectChanges(transaction, newTransactionState, displayNames);

      // Only log if there are actual changes
      if (changes.length > 0) {
        // Fetch user name for audit log
        const [userRecord] = await db
          .select({ name: betterAuthUser.name })
          .from(betterAuthUser)
          .where(eq(betterAuthUser.id, userId))
          .limit(1);

        await logTransactionAudit({
          transactionId: id,
          userId,
          householdId,
          userName: userRecord?.name || 'Unknown User',
          actionType: 'updated',
          changes,
        });
      }
    } catch (auditError) {
      // Non-fatal: don't fail the update if audit logging fails
      console.error('Failed to log transaction audit:', auditError);
    }

    // Auto-match bills
    // Priority 1: Direct bill instance ID matching (for explicit bill payments)
    // Priority 2: Bill-matcher (description/amount/date matching)
    // Priority 3: Category-only matching (fallback)
    try {
      if (transaction.type === 'expense') {
        // Priority 1: Direct bill instance ID matching (bypasses all matching logic)
        if (billInstanceId) {
          // First, unlink from old bill instance if it exists
          if (transaction.billId) {
            const oldInstance = await db
              .select()
              .from(billInstances)
              .where(eq(billInstances.transactionId, id))
              .limit(1);

            if (oldInstance.length > 0) {
              await db
                .update(billInstances)
                .set({
                  status: 'pending',
                  paidDate: null,
                  actualAmount: null,
                  transactionId: null,
                  updatedAt: new Date().toISOString(),
                })
                .where(eq(billInstances.id, oldInstance[0].id));
            }
          }

          // Validate new bill instance belongs to user/household
          const [instance] = await db
            .select({
              instance: billInstances,
              bill: bills,
            })
            .from(billInstances)
            .innerJoin(bills, eq(bills.id, billInstances.billId))
            .where(
              and(
                eq(billInstances.id, billInstanceId),
                eq(billInstances.userId, userId),
                eq(billInstances.householdId, householdId),
                inArray(billInstances.status, ['pending', 'overdue'])
              )
            )
            .limit(1);

          if (instance) {
            const linkedBillId = instance.bill.id;
            const linkedInstanceId = instance.instance.id;

            await processAndLinkBillPayment({
              billId: linkedBillId,
              billName: instance.bill.name,
              instanceId: linkedInstanceId,
              transactionId: id,
              paymentAmount: newAmount.toNumber(),
              paymentDate: newDate,
              userId,
              householdId,
              paymentMethod: 'manual',
              linkedAccountId: newAccountId,
              notes: `Bill payment update: ${instance.bill.name}`,
              legacyDebtId: instance.bill.debtId,
            });
          }
        } else {
          // Priority 2: Bill-matcher matching (only if no direct billInstanceId provided)
          // Check if any relevant field changed
          const categoryChanged = newCategoryId !== transaction.categoryId;
          const descriptionChanged = newDescription !== transaction.description;
          const amountChanged = amount !== undefined && newAmount.toNumber() !== transaction.amount;
          const dateChanged = newDate !== transaction.date;
          const shouldRematch = categoryChanged || descriptionChanged || amountChanged || dateChanged;

          if (shouldRematch) {
            // First, unlink from old bill instance if it exists
            if (transaction.billId) {
              const oldInstance = await db
                .select()
                .from(billInstances)
                .where(eq(billInstances.transactionId, id))
                .limit(1);

              if (oldInstance.length > 0) {
                await db
                  .update(billInstances)
                  .set({
                    status: 'pending',
                    paidDate: null,
                    actualAmount: null,
                    transactionId: null,
                    updatedAt: new Date().toISOString(),
                  })
                  .where(eq(billInstances.id, oldInstance[0].id));
              }

              // Unlink transaction from old bill
              await db
                .update(transactions)
                .set({
                  billId: null,
                  updatedAt: new Date().toISOString(),
                })
                .where(eq(transactions.id, id));
            }

            // Try bill-matcher matching with updated transaction data
            const billMatch = await findMatchingBillInstance(
            {
              id,
              description: newDescription,
              amount: newAmount.toNumber(),
              date: newDate,
              type: transaction.type,
              categoryId: newCategoryId,
            },
            userId,
            householdId,
            70 // min confidence threshold
          );

          if (billMatch) {
            // Get the bill to verify it exists
            const [bill] = await db
              .select()
              .from(bills)
              .where(eq(bills.id, billMatch.billId))
              .limit(1);

            if (bill) {
              await processAndLinkBillPayment({
                billId: bill.id,
                billName: bill.name,
                instanceId: billMatch.instanceId,
                transactionId: id,
                paymentAmount: newAmount.toNumber(),
                paymentDate: newDate,
                userId,
                householdId,
                paymentMethod: 'manual',
                linkedAccountId: newAccountId,
                notes: `Auto-matched bill update: ${bill.name}`,
                legacyDebtId: bill.debtId,
              });
            }
          } else if (newCategoryId && categoryChanged) {
            // Fallback: Category-only matching (backwards compatibility)
            const matchingBills = await db
              .select()
              .from(bills)
              .where(
                and(
                  eq(bills.userId, userId),
                  eq(bills.householdId, householdId),
                  eq(bills.isActive, true),
                  eq(bills.categoryId, newCategoryId)
                )
              );

            if (matchingBills.length > 0) {
              // Collect all pending and overdue instances from all matching bills
              const allPendingInstances: Array<{
                instance: typeof billInstances.$inferSelect;
                bill: typeof bills.$inferSelect;
              }> = [];

              for (const bill of matchingBills) {
                const instances = await db
                  .select()
                  .from(billInstances)
                  .where(
                    and(
                      eq(billInstances.billId, bill.id),
                      inArray(billInstances.status, ['pending', 'overdue'])
                    )
                  );

                instances.forEach(instance => {
                  allPendingInstances.push({
                    instance,
                    bill,
                  });
                });
              }

              if (allPendingInstances.length > 0) {
                // Sort: prioritize overdue bills first, then by due date (oldest first)
                allPendingInstances.sort((a, b) => {
                  // Prioritize overdue (0) over pending (1)
                  const statusA = a.instance.status === 'overdue' ? 0 : 1;
                  const statusB = b.instance.status === 'overdue' ? 0 : 1;
                  if (statusA !== statusB) {
                    return statusA - statusB;
                  }
                  // If same status, sort by due date (oldest first)
                  const dateA = new Date(a.instance.dueDate).getTime();
                  const dateB = new Date(b.instance.dueDate).getTime();
                  return dateA - dateB;
                });

                // Match to the oldest overdue instance (or oldest pending if no overdue)
                const match = allPendingInstances[0];
                await processAndLinkBillPayment({
                  billId: match.bill.id,
                  billName: match.bill.name,
                  instanceId: match.instance.id,
                  transactionId: id,
                  paymentAmount: newAmount.toNumber(),
                  paymentDate: newDate,
                  userId,
                  householdId,
                  paymentMethod: 'manual',
                  linkedAccountId: newAccountId,
                  notes: `Category-matched bill update: ${match.bill.name}`,
                  legacyDebtId: match.bill.debtId,
                });
              }
            }
          }
        }
        }
      }
    } catch (error) {
      console.error('Error auto-linking bill on update:', error);
      // Don't fail the transaction update
    }

    return Response.json(
      {
        id: id,
        message: 'Transaction updated successfully',
      },
      { status: 200 }
    );
  } catch (error) {
    return handleRouteError(error, {
      defaultError: 'Internal server error',
      logLabel: 'Transaction update error:',
    });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await requireAuth();
    const { id } = await params;

    // Get and validate household
    const householdId = getHouseholdIdFromRequest(request);
    await requireHouseholdAuth(userId, householdId);

    // TypeScript: householdId is guaranteed to be non-null after requireHouseholdAuth
    if (!householdId) {
      return Response.json(
        { error: 'Household ID is required' },
        { status: 400 }
      );
    }

    // Get transaction to verify ownership and get details
    const existingTransaction = await db
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.id, id),
          eq(transactions.userId, userId),
          eq(transactions.householdId, householdId)
        )
      )
      .limit(1);

    if (existingTransaction.length === 0) {
      return Response.json(
        { error: 'Transaction not found' },
        { status: 404 }
      );
    }

    const transaction = existingTransaction[0];
    const transactionAmountCents = getTransactionAmountCents(transaction);

    // Log audit trail before deleting
    try {
      // Fetch related data for snapshot
      const [accountData, categoryData, merchantData, billData, debtData, userRecord] = await Promise.all([
        db.select({ name: accounts.name }).from(accounts).where(eq(accounts.id, transaction.accountId)).limit(1),
        transaction.categoryId
          ? db.select({ name: budgetCategories.name }).from(budgetCategories).where(eq(budgetCategories.id, transaction.categoryId)).limit(1)
          : Promise.resolve([]),
        transaction.merchantId
          ? db.select({ name: merchants.name }).from(merchants).where(eq(merchants.id, transaction.merchantId)).limit(1)
          : Promise.resolve([]),
        transaction.billId
          ? db.select({ name: bills.name }).from(bills).where(eq(bills.id, transaction.billId)).limit(1)
          : Promise.resolve([]),
        transaction.debtId
          ? db.select({ name: debts.name }).from(debts).where(eq(debts.id, transaction.debtId)).limit(1)
          : Promise.resolve([]),
        db.select({ name: betterAuthUser.name }).from(betterAuthUser).where(eq(betterAuthUser.id, userId)).limit(1),
      ]);

      const snapshot = createTransactionSnapshot(transaction, {
        accountName: accountData[0]?.name,
        categoryName: categoryData[0]?.name,
        merchantName: merchantData[0]?.name,
        billName: billData[0]?.name,
        debtName: debtData[0]?.name,
      });

      await logTransactionAudit({
        transactionId: id,
        userId,
        householdId,
        userName: userRecord[0]?.name || 'Unknown User',
        actionType: 'deleted',
        snapshot,
      });
    } catch (auditError) {
      // Non-fatal: don't fail the delete if audit logging fails
      console.error('Failed to log transaction deletion audit:', auditError);
    }

    if (transaction.type === 'transfer_out' || transaction.type === 'transfer_in') {
      await deleteCanonicalTransferPairByTransactionId({
        userId,
        householdId,
        transactionId: id,
      });

      return Response.json(
        { message: 'Transaction deleted successfully' },
        { status: 200 }
      );
    }

    await runInDatabaseTransaction(async (tx) => {
      // Delete all splits if transaction has splits
      if (transaction.isSplit) {
        await tx
          .delete(transactionSplits)
          .where(
            and(
              eq(transactionSplits.userId, userId),
              eq(transactionSplits.householdId, householdId),
              eq(transactionSplits.transactionId, id)
            )
          );
      }

      // Non-transfer transaction: reverse balance and delete
      const account = await tx
        .select()
        .from(accounts)
        .where(eq(accounts.id, transaction.accountId))
        .limit(1);

      if (account.length > 0) {
        let newBalanceCents = getAccountBalanceCents(account[0]);
        if (transaction.type === 'expense') {
          // Reverse by adding back (it was subtracted)
          newBalanceCents += transactionAmountCents;
        } else {
          // income: Reverse by subtracting (it was added)
          newBalanceCents -= transactionAmountCents;
        }

        await tx
          .update(accounts)
          .set(buildAccountBalanceFields(newBalanceCents))
          .where(eq(accounts.id, transaction.accountId));
      }

      // Delete sales tax record if exists
      await tx
        .delete(salesTaxTransactions)
        .where(eq(salesTaxTransactions.transactionId, id));

      // Delete transaction
      await tx
        .delete(transactions)
        .where(
          and(
            eq(transactions.id, id),
            eq(transactions.userId, userId),
            eq(transactions.householdId, householdId)
          )
        );
    });

    return Response.json(
      { message: 'Transaction deleted successfully' },
      { status: 200 }
    );
  } catch (error) {
    return handleRouteError(error, {
      defaultError: 'Internal server error',
      logLabel: 'Transaction delete error:',
    });
  }
}
