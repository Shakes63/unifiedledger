import { requireAuth } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { accounts } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { getHouseholdIdFromRequest, requireHouseholdAuth } from '@/lib/api/household-auth';
import { trackCreditLimitChange, determineChangeReason, calculateMinimumPayment } from '@/lib/accounts';
import { createPaymentBill, createAnnualFeeBill, deactivateBill } from '@/lib/bills/auto-bill-creation';
import type { PaymentAmountSource } from '@/lib/types';

export const dynamic = 'force-dynamic';

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

    // Verify account belongs to user AND household
    const existingAccount = await db
      .select()
      .from(accounts)
      .where(
        and(
          eq(accounts.id, id),
          eq(accounts.userId, userId),
          eq(accounts.householdId, householdId)
        )
      )
      .limit(1);

    if (!existingAccount || existingAccount.length === 0) {
      return Response.json(
        { error: 'Account not found' },
        { status: 404 }
      );
    }

    const existing = existingAccount[0];

    // Get update data from body (already parsed above)
    const {
      name,
      type,
      bankName,
      accountNumberLast4,
      currentBalance,
      creditLimit,
      color,
      icon,
      isBusinessAccount,
      enableSalesTax,
      enableTaxDeductions,
      // Credit/Line of Credit fields (Phase 2)
      interestRate,
      minimumPaymentPercent,
      minimumPaymentFloor,
      statementDueDay,
      annualFee,
      annualFeeMonth,
      autoCreatePaymentBill,
      includeInPayoffStrategy,
      paymentAmountSource,
      // Line of Credit specific fields
      isSecured,
      securedAsset,
      drawPeriodEndDate,
      repaymentPeriodEndDate,
      interestType,
      primeRateMargin,
    } = body;

    // Validate required fields
    if (!name || !type) {
      return Response.json(
        { error: 'Name and type are required' },
        { status: 400 }
      );
    }

    // Determine final toggle values
    const finalEnableSalesTax = enableSalesTax !== undefined 
      ? enableSalesTax 
      : existing.enableSalesTax ?? existing.isBusinessAccount ?? false;
    const finalEnableTaxDeductions = enableTaxDeductions !== undefined 
      ? enableTaxDeductions 
      : existing.enableTaxDeductions ?? existing.isBusinessAccount ?? false;
    
    // Compute isBusinessAccount from toggles
    const computedIsBusinessAccount = finalEnableSalesTax || finalEnableTaxDeductions;

    const isCreditType = type === 'credit' || type === 'line_of_credit';
    const isLineOfCredit = type === 'line_of_credit';
    
    // Calculate minimum payment for credit accounts
    // Use new values if provided, otherwise fall back to existing values
    let calculatedMinimumPayment: number | null = null;
    if (isCreditType) {
      const finalBalance = currentBalance !== undefined ? currentBalance : existing.currentBalance ?? 0;
      const finalPercent = minimumPaymentPercent !== undefined ? minimumPaymentPercent : existing.minimumPaymentPercent;
      const finalFloor = minimumPaymentFloor !== undefined ? minimumPaymentFloor : existing.minimumPaymentFloor;
      
      const { minimumPaymentAmount } = calculateMinimumPayment({
        currentBalance: finalBalance,
        minimumPaymentPercent: finalPercent || null,
        minimumPaymentFloor: finalFloor || null,
      });
      calculatedMinimumPayment = minimumPaymentAmount;
    }
    
    // Update the account with all fields inline
    await db
      .update(accounts)
      .set({
        name,
        type,
        bankName: bankName || null,
        accountNumberLast4: accountNumberLast4 || null,
        currentBalance: currentBalance !== undefined ? currentBalance : existing.currentBalance,
        creditLimit: creditLimit !== undefined ? (creditLimit || null) : existing.creditLimit,
        color: color || existing.color,
        icon: icon || existing.icon,
        isBusinessAccount: computedIsBusinessAccount,
        enableSalesTax: finalEnableSalesTax,
        enableTaxDeductions: finalEnableTaxDeductions,
        updatedAt: new Date().toISOString(),
        // Credit/Line of Credit fields
        interestRate: isCreditType 
          ? (interestRate !== undefined ? (interestRate || null) : existing.interestRate)
          : existing.interestRate,
        minimumPaymentPercent: isCreditType 
          ? (minimumPaymentPercent !== undefined ? (minimumPaymentPercent || null) : existing.minimumPaymentPercent)
          : existing.minimumPaymentPercent,
        minimumPaymentFloor: isCreditType 
          ? (minimumPaymentFloor !== undefined ? (minimumPaymentFloor || null) : existing.minimumPaymentFloor)
          : existing.minimumPaymentFloor,
        minimumPaymentAmount: isCreditType ? calculatedMinimumPayment : existing.minimumPaymentAmount,
        statementDueDate: isCreditType 
          ? (statementDueDay !== undefined ? (statementDueDay ? String(statementDueDay) : null) : existing.statementDueDate)
          : existing.statementDueDate,
        annualFee: isCreditType 
          ? (annualFee !== undefined ? (annualFee || null) : existing.annualFee)
          : existing.annualFee,
        annualFeeMonth: isCreditType 
          ? (annualFeeMonth !== undefined ? (annualFeeMonth || null) : existing.annualFeeMonth)
          : existing.annualFeeMonth,
        autoCreatePaymentBill: isCreditType 
          ? (autoCreatePaymentBill !== undefined ? autoCreatePaymentBill : existing.autoCreatePaymentBill)
          : existing.autoCreatePaymentBill,
        includeInPayoffStrategy: isCreditType 
          ? (includeInPayoffStrategy !== undefined ? includeInPayoffStrategy : existing.includeInPayoffStrategy)
          : existing.includeInPayoffStrategy,
        // Line of Credit specific fields
        isSecured: isLineOfCredit 
          ? (isSecured !== undefined ? isSecured : existing.isSecured)
          : existing.isSecured,
        securedAsset: isLineOfCredit 
          ? (securedAsset !== undefined ? (securedAsset || null) : existing.securedAsset)
          : existing.securedAsset,
        drawPeriodEndDate: isLineOfCredit 
          ? (drawPeriodEndDate !== undefined ? (drawPeriodEndDate || null) : existing.drawPeriodEndDate)
          : existing.drawPeriodEndDate,
        repaymentPeriodEndDate: isLineOfCredit 
          ? (repaymentPeriodEndDate !== undefined ? (repaymentPeriodEndDate || null) : existing.repaymentPeriodEndDate)
          : existing.repaymentPeriodEndDate,
        interestType: isLineOfCredit 
          ? (interestType !== undefined ? interestType : existing.interestType)
          : existing.interestType,
        primeRateMargin: isLineOfCredit 
          ? (primeRateMargin !== undefined ? (primeRateMargin || null) : existing.primeRateMargin)
          : existing.primeRateMargin,
      })
      .where(eq(accounts.id, id));

    // Track promises for parallel execution
    const postUpdateTasks: Promise<unknown>[] = [];

    // Handle credit limit changes
    if (isCreditType && creditLimit !== undefined) {
      const previousLimit = existing.creditLimit;
      const newLimit = creditLimit || 0;
      
      // Only track if the limit actually changed
      if (previousLimit !== newLimit && newLimit > 0) {
        const changeReason = determineChangeReason(previousLimit, newLimit);
        const finalBalance = currentBalance !== undefined ? currentBalance : existing.currentBalance;
        
        postUpdateTasks.push(
          trackCreditLimitChange({
            accountId: id,
            userId,
            householdId,
            previousLimit,
            newLimit,
            changeReason,
            currentBalance: finalBalance ?? 0,
          })
        );
      }
    }

    // Handle payment tracking bill changes
    if (isCreditType && autoCreatePaymentBill !== undefined) {
      const wasEnabled = existing.autoCreatePaymentBill;
      const isNowEnabled = autoCreatePaymentBill;
      const dueDay = statementDueDay !== undefined ? statementDueDay : parseInt(existing.statementDueDate || '0');

      // If turning on and wasn't on before, create bill
      if (isNowEnabled && !wasEnabled && dueDay) {
        postUpdateTasks.push(
          createPaymentBill({
            accountId: id,
            accountName: name,
            userId,
            householdId,
            amountSource: (paymentAmountSource || 'statement_balance') as PaymentAmountSource,
            dueDay,
            expectedAmount: calculatedMinimumPayment || 0,
          })
        );
      }
      // Note: We don't automatically delete the bill when turning off
      // as the user might want to keep historical data
    }

    // Handle annual fee bill changes
    if (isCreditType) {
      const previousFee = existing.annualFee;
      const newFee = annualFee !== undefined ? annualFee : previousFee;
      const newFeeMonth = annualFeeMonth !== undefined ? annualFeeMonth : existing.annualFeeMonth;
      const existingFeeBillId = existing.annualFeeBillId;

      // If fee was added and no bill exists, create one
      if (newFee && newFee > 0 && newFeeMonth && !existingFeeBillId) {
        postUpdateTasks.push(
          createAnnualFeeBill({
            accountId: id,
            accountName: name,
            userId,
            householdId,
            annualFee: newFee,
            feeMonth: newFeeMonth,
          }).then((feeBillId) => {
            return db
              .update(accounts)
              .set({ annualFeeBillId: feeBillId })
              .where(eq(accounts.id, id));
          })
        );
      }
      // If fee was removed and bill exists, deactivate it
      else if ((!newFee || newFee <= 0) && existingFeeBillId) {
        postUpdateTasks.push(deactivateBill(existingFeeBillId));
        // Clear the reference
        postUpdateTasks.push(
          db
            .update(accounts)
            .set({ annualFeeBillId: null })
            .where(eq(accounts.id, id))
        );
      }
    }

    // Wait for all post-update tasks
    await Promise.all(postUpdateTasks);

    return Response.json(
      { id, message: 'Account updated successfully' },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes('Household')) {
      return Response.json({ error: error.message }, { status: 403 });
    }
    console.error('Account update error:', error);
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

    // Verify account belongs to user AND household
    const account = await db
      .select()
      .from(accounts)
      .where(
        and(
          eq(accounts.id, id),
          eq(accounts.userId, userId),
          eq(accounts.householdId, householdId)
        )
      )
      .limit(1);

    if (!account || account.length === 0) {
      return Response.json(
        { error: 'Account not found' },
        { status: 404 }
      );
    }

    // Delete the account
    await db.delete(accounts).where(eq(accounts.id, id));

    return Response.json(
      { message: 'Account deleted successfully' },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes('Household')) {
      return Response.json({ error: error.message }, { status: 403 });
    }
    console.error('Account deletion error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
