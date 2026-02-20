import { requireAuth } from '@/lib/auth-helpers';
import { getAndVerifyHousehold } from '@/lib/api/household-auth';
import { db } from '@/lib/db';
import { bills, billInstances, budgetCategories, accounts, merchants } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { isNonMonthlyPeriodic } from '@/lib/bills/bill-utils';

export const dynamic = 'force-dynamic';

// GET - Fetch a single bill with all instances
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await requireAuth();
    const { householdId } = await getAndVerifyHousehold(request, userId);

    const { id } = await params;

    const bill = await db
      .select()
      .from(bills)
      .where(
        and(
          eq(bills.id, id),
          eq(bills.userId, userId),
          eq(bills.householdId, householdId)
        )
      )
      .limit(1);

    if (bill.length === 0) {
      return Response.json(
        { error: 'Bill not found' },
        { status: 404 }
      );
    }

    const instances = await db
      .select()
      .from(billInstances)
      .where(
        and(
          eq(billInstances.billId, id),
          eq(billInstances.householdId, householdId)
        )
      )
      .orderBy(billInstances.dueDate);

    const category = bill[0].categoryId
      ? await db
          .select()
          .from(budgetCategories)
          .where(
            and(
              eq(budgetCategories.id, bill[0].categoryId),
              eq(budgetCategories.householdId, householdId)
            )
          )
          .limit(1)
      : null;

    const account = bill[0].accountId
      ? await db
          .select()
          .from(accounts)
          .where(
            and(
              eq(accounts.id, bill[0].accountId),
              eq(accounts.householdId, householdId)
            )
          )
          .limit(1)
      : null;

    const merchant = bill[0].merchantId
      ? await db
          .select()
          .from(merchants)
          .where(
            and(
              eq(merchants.id, bill[0].merchantId),
              eq(merchants.householdId, householdId)
            )
          )
          .limit(1)
      : null;

    return Response.json({
      bill: bill[0],
      instances,
      category: category?.[0] || null,
      merchant: merchant?.[0] || null,
      account: account?.[0] || null,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes('Household')) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    console.error('Error fetching bill:', error);
    return Response.json(
      { error: 'Failed to fetch bill' },
      { status: 500 }
    );
  }
}

// PUT - Update a bill
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await requireAuth();
    const body = await request.json();
    const { householdId } = await getAndVerifyHousehold(request, userId, body);

    const { id } = await params;
    const {
      name,
      categoryId,
      merchantId,
      expectedAmount,
      dueDate,
      startMonth, // 0-11 for quarterly/semi-annual/annual bills
      isVariableAmount,
      amountTolerance,
      payeePatterns,
      accountId,
      autoMarkPaid,
      notes,
      isActive,
      // Bill classification
      billType,
      billClassification,
      classificationSubcategory,
      // Account linking
      linkedAccountId,
      amountSource,
      chargedToAccountId,
      // Autopay configuration
      isAutopayEnabled,
      autopayAccountId,
      autopayAmountType,
      autopayFixedAmount,
      autopayDaysBefore,
      // Debt extension fields
      isDebt,
      originalBalance,
      remainingBalance,
      billInterestRate,
      interestType,
      debtStartDate,
      billColor,
      // Payoff strategy
      includeInPayoffStrategy,
      // Tax deduction settings
      isInterestTaxDeductible,
      taxDeductionType,
      taxDeductionLimit,
      // Budget period assignment (for bill pay feature)
      budgetPeriodAssignment,
      splitAcrossPeriods,
      splitAllocations,
    } = body;

    // Verify bill exists and belongs to user and household
    const existingBill = await db
      .select()
      .from(bills)
      .where(
        and(
          eq(bills.id, id),
          eq(bills.userId, userId),
          eq(bills.householdId, householdId)
        )
      )
      .limit(1);

    if (existingBill.length === 0) {
      return Response.json(
        { error: 'Bill not found' },
        { status: 404 }
      );
    }

    // Validate category if provided and changed
    if (categoryId && categoryId !== existingBill[0].categoryId) {
      const category = await db
        .select()
        .from(budgetCategories)
        .where(
          and(
            eq(budgetCategories.id, categoryId),
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

    // Validate merchant if provided and changed
    if (merchantId !== undefined && merchantId !== existingBill[0].merchantId) {
      if (merchantId) {
        const merchant = await db
          .select()
          .from(merchants)
          .where(
            and(
              eq(merchants.id, merchantId),
              eq(merchants.userId, userId),
              eq(merchants.householdId, householdId)
            )
          )
          .limit(1);

        if (merchant.length === 0) {
          return Response.json(
            { error: 'Merchant not found' },
            { status: 404 }
          );
        }
      }
    }

    // Validate account if provided and changed
    if (accountId && accountId !== existingBill[0].accountId) {
      const account = await db
        .select()
        .from(accounts)
        .where(
          and(
            eq(accounts.id, accountId),
            eq(accounts.userId, userId),
            eq(accounts.householdId, householdId)
          )
        )
        .limit(1);

      if (account.length === 0) {
        return Response.json(
          { error: 'Account not found' },
          { status: 404 }
        );
      }
    }

    // Validate linkedAccountId if provided
    if (linkedAccountId && linkedAccountId !== existingBill[0].linkedAccountId) {
      const linkedAccount = await db
        .select()
        .from(accounts)
        .where(
          and(
            eq(accounts.id, linkedAccountId),
            eq(accounts.userId, userId),
            eq(accounts.householdId, householdId)
          )
        )
        .limit(1);

      if (linkedAccount.length === 0) {
        return Response.json(
          { error: 'Linked account not found' },
          { status: 404 }
        );
      }
    }

    // Validate chargedToAccountId if provided
    if (chargedToAccountId && chargedToAccountId !== existingBill[0].chargedToAccountId) {
      const chargedAccount = await db
        .select()
        .from(accounts)
        .where(
          and(
            eq(accounts.id, chargedToAccountId),
            eq(accounts.userId, userId),
            eq(accounts.householdId, householdId)
          )
        )
        .limit(1);

      if (chargedAccount.length === 0) {
        return Response.json(
          { error: 'Charged to account not found' },
          { status: 404 }
        );
      }
    }

    // Validate autopayAccountId if provided
    if (autopayAccountId && autopayAccountId !== existingBill[0].autopayAccountId) {
      const autopayAccount = await db
        .select()
        .from(accounts)
        .where(
          and(
            eq(accounts.id, autopayAccountId),
            eq(accounts.userId, userId),
            eq(accounts.householdId, householdId)
          )
        )
        .limit(1);

      if (autopayAccount.length === 0) {
        return Response.json(
          { error: 'Autopay account not found' },
          { status: 404 }
        );
      }
    }

    // Validate mutually exclusive account links
    const effectiveLinkedAccountId = linkedAccountId !== undefined ? linkedAccountId : existingBill[0].linkedAccountId;
    const effectiveChargedToAccountId = chargedToAccountId !== undefined ? chargedToAccountId : existingBill[0].chargedToAccountId;
    if (effectiveLinkedAccountId && effectiveChargedToAccountId) {
      return Response.json(
        { error: 'A bill cannot be both a payment to a card and charged to a card' },
        { status: 400 }
      );
    }

    // Validate debt fields
    const effectiveIsDebt = isDebt !== undefined ? isDebt : existingBill[0].isDebt;
    const effectiveOriginalBalance = originalBalance !== undefined ? originalBalance : existingBill[0].originalBalance;
    if (effectiveIsDebt && !effectiveOriginalBalance) {
      return Response.json(
        { error: 'Original balance is required for debt bills' },
        { status: 400 }
      );
    }

    // Validate autopay fields
    const effectiveIsAutopayEnabled = isAutopayEnabled !== undefined ? isAutopayEnabled : existingBill[0].isAutopayEnabled;
    const effectiveAutopayAccountId = autopayAccountId !== undefined ? autopayAccountId : existingBill[0].autopayAccountId;
    if (effectiveIsAutopayEnabled && !effectiveAutopayAccountId) {
      return Response.json(
        { error: 'Autopay source account is required when autopay is enabled' },
        { status: 400 }
      );
    }

    // Validate income bills don't have expense-specific fields
    const effectiveBillType = billType !== undefined ? billType : existingBill[0].billType;
    if (effectiveBillType === 'income') {
      if (effectiveIsDebt) {
        return Response.json(
          { error: 'Income bills cannot be marked as debt' },
          { status: 400 }
        );
      }
      if (effectiveLinkedAccountId) {
        return Response.json(
          { error: 'Income bills cannot be linked to a credit card' },
          { status: 400 }
        );
      }
      if (effectiveChargedToAccountId) {
        return Response.json(
          { error: 'Income bills cannot be charged to a credit card' },
          { status: 400 }
        );
      }
    }

    // Validate startMonth if provided
    if (startMonth !== undefined) {
      // Get the bill's frequency to validate startMonth
      const billFrequency = existingBill[0].frequency;
      
      if (startMonth !== null) {
        if (!isNonMonthlyPeriodic(billFrequency || 'monthly')) {
          return Response.json(
            { error: 'startMonth is only valid for quarterly, semi-annual, or annual bills' },
            { status: 400 }
          );
        }
        if (typeof startMonth !== 'number' || startMonth < 0 || startMonth > 11) {
          return Response.json(
            { error: 'startMonth must be between 0 (January) and 11 (December)' },
            { status: 400 }
          );
        }
      }
    }

    // Build update object with only provided fields
    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (categoryId !== undefined) updateData.categoryId = categoryId;
    if (merchantId !== undefined) updateData.merchantId = merchantId || null;
    if (expectedAmount !== undefined) updateData.expectedAmount = parseFloat(expectedAmount);
    if (dueDate !== undefined) {
      if (dueDate < 1 || dueDate > 31) {
        return Response.json(
          { error: 'Due date must be between 1 and 31' },
          { status: 400 }
        );
      }
      updateData.dueDate = dueDate;
    }
    if (startMonth !== undefined) updateData.startMonth = startMonth;
    if (isVariableAmount !== undefined) updateData.isVariableAmount = isVariableAmount;
    if (amountTolerance !== undefined) updateData.amountTolerance = amountTolerance;
    if (payeePatterns !== undefined) updateData.payeePatterns = payeePatterns ? JSON.stringify(payeePatterns) : null;
    if (accountId !== undefined) updateData.accountId = accountId;
    if (autoMarkPaid !== undefined) updateData.autoMarkPaid = autoMarkPaid;
    if (notes !== undefined) updateData.notes = notes;
    if (isActive !== undefined) updateData.isActive = isActive;
    
    // Bill classification
    if (billType !== undefined) updateData.billType = billType;
    if (billClassification !== undefined) updateData.billClassification = billClassification;
    if (classificationSubcategory !== undefined) updateData.classificationSubcategory = classificationSubcategory || null;
    
    // Account linking
    if (linkedAccountId !== undefined) updateData.linkedAccountId = linkedAccountId || null;
    if (amountSource !== undefined) updateData.amountSource = amountSource;
    if (chargedToAccountId !== undefined) updateData.chargedToAccountId = chargedToAccountId || null;
    
    // Autopay configuration
    if (isAutopayEnabled !== undefined) updateData.isAutopayEnabled = isAutopayEnabled;
    if (autopayAccountId !== undefined) updateData.autopayAccountId = autopayAccountId || null;
    if (autopayAmountType !== undefined) updateData.autopayAmountType = autopayAmountType;
    if (autopayFixedAmount !== undefined) updateData.autopayFixedAmount = autopayFixedAmount ? parseFloat(autopayFixedAmount) : null;
    if (autopayDaysBefore !== undefined) updateData.autopayDaysBefore = autopayDaysBefore;
    
    // Debt extension fields
    if (isDebt !== undefined) updateData.isDebt = isDebt;
    if (originalBalance !== undefined) updateData.originalBalance = originalBalance ? parseFloat(originalBalance) : null;
    if (remainingBalance !== undefined) updateData.remainingBalance = remainingBalance ? parseFloat(remainingBalance) : null;
    if (billInterestRate !== undefined) updateData.billInterestRate = billInterestRate ? parseFloat(billInterestRate) : null;
    if (interestType !== undefined) updateData.interestType = interestType;
    if (debtStartDate !== undefined) updateData.debtStartDate = debtStartDate || null;
    if (billColor !== undefined) updateData.billColor = billColor || null;
    
    // Payoff strategy
    if (includeInPayoffStrategy !== undefined) updateData.includeInPayoffStrategy = includeInPayoffStrategy;
    
    // Tax deduction settings
    if (isInterestTaxDeductible !== undefined) updateData.isInterestTaxDeductible = isInterestTaxDeductible;
    if (taxDeductionType !== undefined) updateData.taxDeductionType = taxDeductionType;
    if (taxDeductionLimit !== undefined) updateData.taxDeductionLimit = taxDeductionLimit ? parseFloat(taxDeductionLimit) : null;
    
    // Budget period assignment
    if (budgetPeriodAssignment !== undefined) updateData.budgetPeriodAssignment = budgetPeriodAssignment;
    if (splitAcrossPeriods !== undefined) updateData.splitAcrossPeriods = splitAcrossPeriods;
    if (splitAllocations !== undefined) {
      updateData.splitAllocations = splitAllocations === null
        ? null
        : (typeof splitAllocations === 'string'
            ? splitAllocations
            : JSON.stringify(splitAllocations));
    } else if (splitAcrossPeriods === false) {
      updateData.splitAllocations = null;
    }

    await db
      .update(bills)
      .set(updateData)
      .where(
        and(
          eq(bills.id, id),
          eq(bills.householdId, householdId)
        )
      );

    const updatedBill = await db
      .select()
      .from(bills)
      .where(
        and(
          eq(bills.id, id),
          eq(bills.householdId, householdId)
        )
      )
      .limit(1);

    return Response.json(updatedBill[0]);
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes('Household')) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    console.error('Error updating bill:', error);
    return Response.json(
      { error: 'Failed to update bill' },
      { status: 500 }
    );
  }
}

// DELETE - Delete a bill and associated instances
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await requireAuth();
    const { householdId } = await getAndVerifyHousehold(request, userId);

    const { id } = await params;

    // Verify bill exists and belongs to user and household
    const bill = await db
      .select()
      .from(bills)
      .where(
        and(
          eq(bills.id, id),
          eq(bills.userId, userId),
          eq(bills.householdId, householdId)
        )
      )
      .limit(1);

    if (bill.length === 0) {
      return Response.json(
        { error: 'Bill not found' },
        { status: 404 }
      );
    }

    // Delete all bill instances for this household
    await db
      .delete(billInstances)
      .where(
        and(
          eq(billInstances.billId, id),
          eq(billInstances.householdId, householdId)
        )
      );

    // Delete the bill
    await db
      .delete(bills)
      .where(
        and(
          eq(bills.id, id),
          eq(bills.householdId, householdId)
        )
      );

    return Response.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes('Household')) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    console.error('Error deleting bill:', error);
    return Response.json(
      { error: 'Failed to delete bill' },
      { status: 500 }
    );
  }
}
