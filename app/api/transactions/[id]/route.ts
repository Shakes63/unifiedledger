import { requireAuth } from '@/lib/auth-helpers';
import { getHouseholdIdFromRequest, requireHouseholdAuth } from '@/lib/api/household-auth';
import { db } from '@/lib/db';
import { transactions, accounts, budgetCategories, transactionSplits, bills, billInstances, merchants, debts, tags, transactionTags, customFields, customFieldValues, betterAuthUser } from '@/lib/db/schema';
import { eq, and, inArray, sql } from 'drizzle-orm';
import Decimal from 'decimal.js';
import { deleteSalesTaxRecord } from '@/lib/sales-tax/transaction-sales-tax';
import { findMatchingBillInstance } from '@/lib/bills/bill-matching-helpers';
import { logTransactionAudit, detectChanges, createTransactionSnapshot, DisplayNames } from '@/lib/transactions/audit-logger';

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
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && (
      error.message.includes('Household') ||
      error.message.includes('member')
    )) {
      return Response.json({ error: error.message }, { status: 403 });
    }
    console.error('Transaction fetch error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
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
    } = body;

    // Validate at least one field is provided for update
    if (!accountId && !categoryId && !merchantId && !date && !amount && !description && !notes && isPending === undefined && transferId === undefined) {
      return Response.json(
        { error: 'No fields to update' },
        { status: 400 }
      );
    }

    // Use existing values for fields not provided
    const newAccountId = accountId || transaction.accountId;
    const newAmount = amount ? new Decimal(amount) : new Decimal(transaction.amount);
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

    // Handle balance adjustments if amount or account changed
    if (amount || newAccountId !== transaction.accountId) {
      const oldDecimalAmount = new Decimal(transaction.amount);
      const oldAccount = await db
        .select()
        .from(accounts)
        .where(eq(accounts.id, transaction.accountId))
        .limit(1);

      const newAccount = await db
        .select()
        .from(accounts)
        .where(eq(accounts.id, newAccountId))
        .limit(1);

      if (oldAccount.length > 0 && newAccount.length > 0) {
        // Reverse old transaction effect
        let oldBalance = new Decimal(oldAccount[0].currentBalance || 0);
        if (transaction.type === 'expense' || transaction.type === 'transfer_out') {
          oldBalance = oldBalance.plus(oldDecimalAmount);
        } else {
          oldBalance = oldBalance.minus(oldDecimalAmount);
        }

        await db
          .update(accounts)
          .set({ currentBalance: oldBalance.toNumber() })
          .where(eq(accounts.id, transaction.accountId));

        // Apply new transaction effect
        let newBalance = new Decimal(newAccount[0].currentBalance || 0);
        if (transaction.type === 'expense' || transaction.type === 'transfer_out') {
          newBalance = newBalance.minus(newAmount);
        } else {
          newBalance = newBalance.plus(newAmount);
        }

        await db
          .update(accounts)
          .set({ currentBalance: newBalance.toNumber() })
          .where(eq(accounts.id, newAccountId));
      }
    }

    // Handle transfer destination account update
    let newTransferId = transaction.transferId;
    if (transferId !== undefined && (transaction.type === 'transfer_out' || transaction.type === 'transfer_in')) {
      // Validate the new destination account exists
      if (transferId) {
        const destAccount = await db
          .select()
          .from(accounts)
          .where(
            and(
              eq(accounts.id, transferId),
              eq(accounts.householdId, householdId)
            )
          )
          .limit(1);

        if (destAccount.length === 0) {
          return Response.json(
            { error: 'Destination account not found' },
            { status: 404 }
          );
        }

        // For transfer_out: Find existing or create transfer_in in the destination account
        if (transaction.type === 'transfer_out') {
          const now = new Date().toISOString();
          const txDate = new Date(transaction.date);
          const dateTolerance = 7; // Days to look around the transaction date

          // First, try to find an existing unlinked transfer_in in the destination account
          // Match criteria: same account, similar amount (within 1%), similar date (within 7 days), not already linked
          const existingTransferIn = await db
            .select()
            .from(transactions)
            .where(
              and(
                eq(transactions.accountId, transferId),
                eq(transactions.householdId, householdId),
                eq(transactions.type, 'transfer_in'),
                sql`${transactions.transferId} IS NULL OR ${transactions.transferId} = ''`
              )
            );

          // Find the best match based on amount and date
          let matchedTransaction = null;
          for (const candidate of existingTransferIn) {
            const amountDiff = Math.abs(candidate.amount - transaction.amount);
            const amountTolerance = Math.abs(transaction.amount * 0.01); // 1% tolerance

            const candidateDate = new Date(candidate.date);
            const dateDiff = Math.abs(txDate.getTime() - candidateDate.getTime()) / (1000 * 60 * 60 * 24);

            if (amountDiff <= amountTolerance && dateDiff <= dateTolerance) {
              matchedTransaction = candidate;
              break; // Take first match
            }
          }

          if (matchedTransaction) {
            // Link existing transfer_in to this transfer_out
            await db
              .update(transactions)
              .set({
                transferId: id, // Points back to this transfer_out transaction
                updatedAt: now,
              })
              .where(eq(transactions.id, matchedTransaction.id));

            console.log(`Linked existing transfer_in ${matchedTransaction.id} to transfer_out ${id}`);
          } else {
            // No match found, create a new transfer_in
            const { nanoid } = await import('nanoid');
            const transferInId = nanoid();

            await db.insert(transactions).values({
              id: transferInId,
              userId,
              householdId,
              accountId: transferId, // Destination account
              categoryId: null,
              merchantId: null,
              date: transaction.date,
              amount: transaction.amount,
              description: transaction.description,
              notes: transaction.notes,
              type: 'transfer_in',
              transferId: id, // Points back to this transfer_out transaction
              isPending: transaction.isPending,
              isTaxDeductible: false,
              isSalesTaxable: false,
              createdAt: now,
              updatedAt: now,
            });

            // Update destination account balance (add the amount) - only for new transactions
            const destBalance = new Decimal(destAccount[0].currentBalance || 0);
            const updatedDestBalance = destBalance.plus(new Decimal(transaction.amount));

            await db
              .update(accounts)
              .set({ currentBalance: updatedDestBalance.toNumber() })
              .where(eq(accounts.id, transferId));

            console.log(`Created transfer_in ${transferInId} in account ${transferId} for transfer_out ${id}`);
          }
        }
      }
      newTransferId = transferId;
    }

    // Check if merchant changed and handle tax exemption for income transactions
    let newIsSalesTaxable = transaction.isSalesTaxable;
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
        // Delete any existing sales tax record
        await deleteSalesTaxRecord(id);
      }
    }

    // Update transaction
    await db
      .update(transactions)
      .set({
        accountId: newAccountId,
        categoryId: newCategoryId,
        merchantId: newMerchantId,
        transferId: newTransferId,
        date: newDate,
        amount: newAmount.toNumber(),
        description: newDescription,
        notes: newNotes,
        isPending: newIsPending,
        isSalesTaxable: newIsSalesTaxable,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(transactions.id, id));

    // Log audit trail for transaction update
    try {
      // Build the new transaction state for comparison
      const newTransactionState = {
        accountId: newAccountId,
        categoryId: newCategoryId,
        merchantId: newMerchantId,
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

            // Get the bill to verify it exists
            const [bill] = await db
              .select()
              .from(bills)
              .where(eq(bills.id, linkedBillId))
              .limit(1);

            if (bill) {
              // Batch all bill-related updates (parallel execution)
              await Promise.all([
                // Update transaction with bill link
                db
                  .update(transactions)
                  .set({
                    billId: linkedBillId,
                    updatedAt: new Date().toISOString(),
                  })
                  .where(eq(transactions.id, id)),

                // Update bill instance
                db
                  .update(billInstances)
                  .set({
                    status: 'paid',
                    paidDate: newDate,
                    actualAmount: newAmount.toNumber(),
                    transactionId: id,
                    updatedAt: new Date().toISOString(),
                  })
                  .where(eq(billInstances.id, linkedInstanceId)),
              ]);
            }
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
              // Batch all bill-related updates (parallel execution)
              await Promise.all([
                // Update transaction with bill link
                db
                  .update(transactions)
                  .set({
                    billId: billMatch.billId,
                    updatedAt: new Date().toISOString(),
                  })
                  .where(eq(transactions.id, id)),

                // Update bill instance
                db
                  .update(billInstances)
                  .set({
                    status: 'paid',
                    paidDate: newDate,
                    actualAmount: newAmount.toNumber(),
                    transactionId: id,
                    updatedAt: new Date().toISOString(),
                  })
                  .where(eq(billInstances.id, billMatch.instanceId)),
              ]);
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
                const linkedBillId = match.bill.id;

                // Batch all bill-related updates (parallel execution)
                await Promise.all([
                  // Update transaction with bill link
                  db
                    .update(transactions)
                    .set({
                      billId: linkedBillId,
                      updatedAt: new Date().toISOString(),
                    })
                    .where(eq(transactions.id, id)),

                  // Update bill instance
                  db
                    .update(billInstances)
                    .set({
                      status: 'paid',
                      paidDate: newDate,
                      actualAmount: newAmount.toNumber(),
                      transactionId: id,
                      updatedAt: new Date().toISOString(),
                    })
                    .where(eq(billInstances.id, match.instance.id)),
                ]);
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
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && (
      error.message.includes('Household') ||
      error.message.includes('member')
    )) {
      return Response.json({ error: error.message }, { status: 403 });
    }
    console.error('Transaction update error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
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
    const decimalAmount = new Decimal(transaction.amount);

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

    // Delete all splits if transaction has splits
    if (transaction.isSplit) {
      await db
        .delete(transactionSplits)
        .where(
          and(
            eq(transactionSplits.userId, userId),
            eq(transactionSplits.householdId, householdId),
            eq(transactionSplits.transactionId, id)
          )
        );
    }

    // Handle transfer pairs - need to delete both sides and reverse both balances
    if (transaction.type === 'transfer_out' || transaction.type === 'transfer_in') {
      let pairedTransactionId: string | null = null;

      // Find the paired transaction
      if (transaction.type === 'transfer_out') {
        // This is the source transaction, transferId points to destination account
        // Find transfer_in transaction that has this transaction's ID in its transferId
        const pairedTx = await db
          .select()
          .from(transactions)
          .where(
            and(
              eq(transactions.userId, userId),
              eq(transactions.householdId, householdId),
              eq(transactions.type, 'transfer_in'),
              eq(transactions.transferId, id)
            )
          )
          .limit(1);

        if (pairedTx.length > 0) {
          pairedTransactionId = pairedTx[0].id;

          // Reverse balance on destination account (subtract the amount that was added)
          const destAccountId = pairedTx[0].accountId;
          const destAccount = await db
            .select()
            .from(accounts)
            .where(eq(accounts.id, destAccountId))
            .limit(1);

          if (destAccount.length > 0) {
            const destBalance = new Decimal(destAccount[0].currentBalance || 0);
            const reversedDestBalance = destBalance.minus(decimalAmount);

            await db
              .update(accounts)
              .set({ currentBalance: reversedDestBalance.toNumber() })
              .where(eq(accounts.id, destAccountId));
          }
        }
      } else if (transaction.type === 'transfer_in') {
        // This is the destination transaction, transferId points to transfer_out transaction
        pairedTransactionId = transaction.transferId;

        if (pairedTransactionId) {
          const pairedTx = await db
            .select()
            .from(transactions)
            .where(
              and(
                eq(transactions.id, pairedTransactionId),
                eq(transactions.userId, userId),
                eq(transactions.householdId, householdId)
              )
            )
            .limit(1);

          if (pairedTx.length > 0) {
            // Reverse balance on source account (add back the amount that was subtracted)
            const sourceAccountId = pairedTx[0].accountId;
            const sourceAccount = await db
              .select()
              .from(accounts)
              .where(eq(accounts.id, sourceAccountId))
              .limit(1);

            if (sourceAccount.length > 0) {
              const sourceBalance = new Decimal(sourceAccount[0].currentBalance || 0);
              const reversedSourceBalance = sourceBalance.plus(decimalAmount);

              await db
                .update(accounts)
                .set({ currentBalance: reversedSourceBalance.toNumber() })
                .where(eq(accounts.id, sourceAccountId));
            }
          }
        }
      }

      // Reverse balance on the current transaction's account
      const account = await db
        .select()
        .from(accounts)
        .where(eq(accounts.id, transaction.accountId))
        .limit(1);

      if (account.length > 0) {
        let newBalance = new Decimal(account[0].currentBalance || 0);
        if (transaction.type === 'transfer_out') {
          // Reverse by adding back (it was subtracted)
          newBalance = newBalance.plus(decimalAmount);
        } else {
          // transfer_in: Reverse by subtracting (it was added)
          newBalance = newBalance.minus(decimalAmount);
        }

        await db
          .update(accounts)
          .set({ currentBalance: newBalance.toNumber() })
          .where(eq(accounts.id, transaction.accountId));
      }

      // Delete the paired transaction first
      if (pairedTransactionId) {
        await db
          .delete(transactions)
          .where(
            and(
              eq(transactions.id, pairedTransactionId),
              eq(transactions.userId, userId),
              eq(transactions.householdId, householdId)
            )
          );
      }

      // Delete the current transaction
      await db
        .delete(transactions)
        .where(
          and(
            eq(transactions.id, id),
            eq(transactions.userId, userId),
            eq(transactions.householdId, householdId)
          )
        );
    } else {
      // Non-transfer transaction: reverse balance and delete
      const account = await db
        .select()
        .from(accounts)
        .where(eq(accounts.id, transaction.accountId))
        .limit(1);

      if (account.length > 0) {
        let newBalance = new Decimal(account[0].currentBalance || 0);
        if (transaction.type === 'expense') {
          // Reverse by adding back (it was subtracted)
          newBalance = newBalance.plus(decimalAmount);
        } else {
          // income: Reverse by subtracting (it was added)
          newBalance = newBalance.minus(decimalAmount);
        }

        await db
          .update(accounts)
          .set({ currentBalance: newBalance.toNumber() })
          .where(eq(accounts.id, transaction.accountId));
      }

      // Delete sales tax record if exists
      await deleteSalesTaxRecord(id);

      // Delete transaction
      await db
        .delete(transactions)
        .where(
          and(
            eq(transactions.id, id),
            eq(transactions.userId, userId),
            eq(transactions.householdId, householdId)
          )
        );
    }

    return Response.json(
      { message: 'Transaction deleted successfully' },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && (
      error.message.includes('Household') ||
      error.message.includes('member')
    )) {
      return Response.json({ error: error.message }, { status: 403 });
    }
    console.error('Transaction delete error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
