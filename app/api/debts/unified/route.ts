import { requireAuth } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { accounts, bills } from '@/lib/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { getHouseholdIdFromRequest, requireHouseholdAuth } from '@/lib/api/household-auth';
import Decimal from 'decimal.js';

export const dynamic = 'force-dynamic';

// Types for unified debt response
interface UnifiedDebt {
  id: string;
  name: string;
  source: 'account' | 'bill';
  sourceType: string;
  balance: number;
  originalBalance?: number;
  creditLimit?: number;
  interestRate?: number;
  interestType?: string;
  minimumPayment?: number;
  includeInPayoffStrategy: boolean;
  color?: string;
  // Credit card specific
  statementBalance?: number;
  statementDueDate?: string;
  // Line of credit specific
  drawPeriodEndDate?: string;
  repaymentPeriodEndDate?: string;
  // Debt bill specific
  debtType?: string;
  isInterestTaxDeductible?: boolean;
  taxDeductionType?: string;
  // Calculated
  utilization?: number;
  availableCredit?: number;
}

export async function GET(request: Request) {
  try {
    const { userId } = await requireAuth();

    // Get and validate household
    const householdId = getHouseholdIdFromRequest(request);
    await requireHouseholdAuth(userId, householdId);

    if (!householdId) {
      return Response.json(
        { error: 'Household ID is required' },
        { status: 400 }
      );
    }

    // Parse query params for filtering
    const { searchParams } = new URL(request.url);
    const sourceFilter = searchParams.get('source'); // 'account', 'bill', or null for all
    const typeFilter = searchParams.get('type'); // 'credit', 'line_of_credit', 'personal_loan', etc.
    const inStrategyOnly = searchParams.get('inStrategy') === 'true';

    // Fetch credit accounts (credit cards + lines of credit)
    const creditAccounts = await db
      .select()
      .from(accounts)
      .where(
        and(
          eq(accounts.householdId, householdId),
          inArray(accounts.type, ['credit', 'line_of_credit']),
          eq(accounts.isActive, true)
        )
      );

    // Fetch debt bills
    const debtBills = await db
      .select()
      .from(bills)
      .where(
        and(
          eq(bills.householdId, householdId),
          eq(bills.isDebt, true),
          eq(bills.isActive, true)
        )
      );

    // Normalize to unified format
    const unifiedDebts: UnifiedDebt[] = [];

    // Add credit accounts
    if (!sourceFilter || sourceFilter === 'account') {
      for (const acc of creditAccounts) {
        const balance = Math.abs(acc.currentBalance || 0);
        const creditLimit = acc.creditLimit || 0;
        const utilization = creditLimit > 0 
          ? new Decimal(balance).div(creditLimit).times(100).toNumber() 
          : 0;
        const availableCredit = new Decimal(creditLimit).minus(balance).toNumber();

        // Apply type filter if specified
        if (typeFilter && acc.type !== typeFilter) continue;
        // Apply strategy filter if specified
        if (inStrategyOnly && !acc.includeInPayoffStrategy) continue;

        unifiedDebts.push({
          id: acc.id,
          name: acc.name,
          source: 'account',
          sourceType: acc.type,
          balance,
          creditLimit,
          interestRate: acc.interestRate ?? undefined,
          interestType: acc.interestType ?? undefined,
          minimumPayment: acc.minimumPaymentAmount ?? undefined,
          includeInPayoffStrategy: acc.includeInPayoffStrategy ?? true,
          color: acc.color ?? undefined,
          // Credit card specific
          statementBalance: acc.statementBalance ?? undefined,
          statementDueDate: acc.statementDueDate ?? undefined,
          // Line of credit specific
          drawPeriodEndDate: acc.drawPeriodEndDate ?? undefined,
          repaymentPeriodEndDate: acc.repaymentPeriodEndDate ?? undefined,
          // Calculated
          utilization,
          availableCredit,
        });
      }
    }

    // Add debt bills
    if (!sourceFilter || sourceFilter === 'bill') {
      for (const bill of debtBills) {
        // Apply type filter if specified
        if (typeFilter && bill.debtType !== typeFilter) continue;
        // Apply strategy filter if specified
        if (inStrategyOnly && !bill.includeInPayoffStrategy) continue;

        unifiedDebts.push({
          id: bill.id,
          name: bill.name,
          source: 'bill',
          sourceType: bill.debtType || 'other',
          balance: bill.remainingBalance || 0,
          originalBalance: bill.originalBalance ?? undefined,
          interestRate: bill.billInterestRate ?? undefined,
          interestType: bill.interestType ?? undefined,
          minimumPayment: bill.minimumPayment ?? undefined,
          includeInPayoffStrategy: bill.includeInPayoffStrategy ?? true,
          color: bill.billColor ?? undefined,
          debtType: bill.debtType ?? undefined,
          isInterestTaxDeductible: bill.isInterestTaxDeductible ?? undefined,
          taxDeductionType: bill.taxDeductionType ?? undefined,
        });
      }
    }

    // Calculate summary stats
    const totalBalance = unifiedDebts.reduce(
      (sum, debt) => new Decimal(sum).plus(new Decimal(debt.balance)).toNumber(),
      0
    );
    const totalMinimumPayment = unifiedDebts.reduce(
      (sum, debt) => new Decimal(sum).plus(new Decimal(debt.minimumPayment || 0)).toNumber(),
      0
    );
    const inStrategyCount = unifiedDebts.filter(d => d.includeInPayoffStrategy).length;
    const strategyBalance = unifiedDebts
      .filter(d => d.includeInPayoffStrategy)
      .reduce((sum, debt) => new Decimal(sum).plus(new Decimal(debt.balance)).toNumber(), 0);

    return Response.json({
      debts: unifiedDebts,
      summary: {
        totalBalance,
        totalMinimumPayment,
        totalCount: unifiedDebts.length,
        creditAccountCount: unifiedDebts.filter(d => d.source === 'account').length,
        debtBillCount: unifiedDebts.filter(d => d.source === 'bill').length,
        inStrategyCount,
        strategyBalance,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes('Household')) {
      return Response.json({ error: error.message }, { status: 403 });
    }
    console.error('Unified debts fetch error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

