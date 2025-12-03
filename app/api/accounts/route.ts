import { requireAuth } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { accounts } from '@/lib/db/schema';
import { eq, desc, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { getHouseholdIdFromRequest, requireHouseholdAuth } from '@/lib/api/household-auth';
import { createPaymentBill, createAnnualFeeBill } from '@/lib/bills/auto-bill-creation';
import { trackInitialCreditLimit } from '@/lib/accounts/credit-limit-history';
import type { PaymentAmountSource } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { userId } = await requireAuth();

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

    const userAccounts = await db
      .select()
      .from(accounts)
      .where(
        and(
          eq(accounts.userId, userId),
          eq(accounts.householdId, householdId)
        )
      )
      .orderBy(desc(accounts.usageCount), accounts.sortOrder);

    return Response.json(userAccounts);
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes('Household')) {
      return Response.json({ error: error.message }, { status: 403 });
    }
    console.error('Account fetch error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { userId } = await requireAuth();

    const body = await request.json();
    const {
      name,
      type,
      bankName,
      accountNumberLast4,
      currentBalance = 0,
      creditLimit,
      color = '#3b82f6',
      icon = 'wallet',
      isBusinessAccount = false,
      enableSalesTax = false,
      enableTaxDeductions = false,
      // Credit/Line of Credit fields (Phase 2)
      interestRate,
      minimumPaymentPercent,
      minimumPaymentFloor,
      statementDueDay,
      annualFee,
      annualFeeMonth,
      autoCreatePaymentBill = true,
      includeInPayoffStrategy = true,
      paymentAmountSource = 'statement_balance',
      // Line of Credit specific fields
      isSecured,
      securedAsset,
      drawPeriodEndDate,
      repaymentPeriodEndDate,
      interestType = 'fixed',
      primeRateMargin,
    } = body;

    if (!name || !type) {
      return Response.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

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

    const accountId = nanoid();
    const now = new Date().toISOString();
    const isCreditType = type === 'credit' || type === 'line_of_credit';

    try {
      // Compute isBusinessAccount from toggles if not explicitly set
      const computedIsBusinessAccount = isBusinessAccount || enableSalesTax || enableTaxDeductions;
      
      // Insert the account with all fields
      await db.insert(accounts).values({
        id: accountId,
        userId,
        householdId,
        name,
        type,
        bankName: bankName || null,
        accountNumberLast4: accountNumberLast4 || null,
        currentBalance,
        creditLimit: creditLimit || null,
        color,
        icon,
        isBusinessAccount: computedIsBusinessAccount,
        enableSalesTax,
        enableTaxDeductions,
        createdAt: now,
        updatedAt: now,
        // Credit/Line of Credit fields (only set for credit types)
        interestRate: isCreditType ? (interestRate || null) : null,
        minimumPaymentPercent: isCreditType ? (minimumPaymentPercent || null) : null,
        minimumPaymentFloor: isCreditType ? (minimumPaymentFloor || null) : null,
        statementDueDate: isCreditType && statementDueDay ? String(statementDueDay) : null,
        annualFee: isCreditType ? (annualFee || null) : null,
        annualFeeMonth: isCreditType ? (annualFeeMonth || null) : null,
        autoCreatePaymentBill: isCreditType ? autoCreatePaymentBill : true,
        includeInPayoffStrategy: isCreditType ? includeInPayoffStrategy : true,
        // Line of Credit specific fields
        isSecured: type === 'line_of_credit' ? (isSecured || false) : false,
        securedAsset: type === 'line_of_credit' ? (securedAsset || null) : null,
        drawPeriodEndDate: type === 'line_of_credit' ? (drawPeriodEndDate || null) : null,
        repaymentPeriodEndDate: type === 'line_of_credit' ? (repaymentPeriodEndDate || null) : null,
        interestType: type === 'line_of_credit' ? interestType : 'fixed',
        primeRateMargin: type === 'line_of_credit' ? (primeRateMargin || null) : null,
      });

      // Track promises for parallel execution
      const postCreationTasks: Promise<unknown>[] = [];

      // Auto-create linked bills for credit accounts
      if (isCreditType) {
        // Create payment tracking bill if enabled
        if (autoCreatePaymentBill && statementDueDay) {
          postCreationTasks.push(
            createPaymentBill({
              accountId,
              accountName: name,
              userId,
              householdId,
              amountSource: paymentAmountSource as PaymentAmountSource,
              dueDay: statementDueDay,
              expectedAmount: 0, // Variable based on balance
            })
          );
        }

        // Create annual fee bill if fee is set
        if (annualFee && annualFee > 0 && annualFeeMonth) {
          postCreationTasks.push(
            createAnnualFeeBill({
              accountId,
              accountName: name,
              userId,
              householdId,
              annualFee,
              feeMonth: annualFeeMonth,
            }).then((feeBillId) => {
              // Update account with annual fee bill ID
              return db
                .update(accounts)
                .set({ annualFeeBillId: feeBillId })
                .where(eq(accounts.id, accountId));
            })
          );
        }

        // Track initial credit limit if set
        if (creditLimit && creditLimit > 0) {
          postCreationTasks.push(
            trackInitialCreditLimit({
              accountId,
              userId,
              householdId,
              creditLimit,
              currentBalance,
            })
          );
        }
      }

      // Wait for all post-creation tasks
      await Promise.all(postCreationTasks);

      return Response.json(
        { id: accountId, message: 'Account created successfully' },
        { status: 201 }
      );
    } catch (dbError) {
      console.error('Database insertion error:', dbError);
      throw dbError;
    }
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes('Household')) {
      return Response.json({ error: error.message }, { status: 403 });
    }
    console.error('Account creation error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    console.error('Error details:', errorMessage);
    return Response.json(
      { error: errorMessage || 'Internal server error' },
      { status: 500 }
    );
  }
}
