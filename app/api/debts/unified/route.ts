import { requireAuth } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { accounts, billTemplates, debts } from '@/lib/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { getAndVerifyHousehold } from '@/lib/api/household-auth';
import Decimal from 'decimal.js';
import { toMoneyCents } from '@/lib/utils/money-cents';

export const dynamic = 'force-dynamic';

function toAmount(cents: number): number {
  return new Decimal(cents).div(100).toNumber();
}

function getBalanceCents(account: {
  currentBalance: number | null;
  currentBalanceCents: number | null;
}): number {
  return Math.abs(account.currentBalanceCents ?? toMoneyCents(account.currentBalance) ?? 0);
}

function getCreditLimitCents(account: {
  creditLimit: number | null;
  creditLimitCents: number | null;
}): number {
  return account.creditLimitCents ?? toMoneyCents(account.creditLimit) ?? 0;
}

// Types for unified debt response
interface UnifiedDebt {
  id: string;
  name: string;
  source: 'account' | 'bill' | 'debt';
  sourceType: string;
  balance: number;
  originalBalance?: number;
  creditLimit?: number;
  interestRate?: number;
  interestType?: string;
  minimumPayment?: number;
  additionalMonthlyPayment?: number;
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
    const { householdId } = await getAndVerifyHousehold(request, userId);

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

    // Fetch debt-enabled bill schedules
    const debtTemplates = await db
      .select()
      .from(billTemplates)
      .where(
        and(
          eq(billTemplates.householdId, householdId),
          eq(billTemplates.debtEnabled, true),
          eq(billTemplates.isActive, true)
        )
      );

    // Fetch standalone debts from debts table
    const standaloneDebts = await db
      .select()
      .from(debts)
      .where(
        and(
          eq(debts.householdId, householdId),
          eq(debts.status, 'active')
        )
      );

    // Normalize to unified format
    const unifiedDebts: UnifiedDebt[] = [];

    // Add credit accounts
    if (!sourceFilter || sourceFilter === 'account') {
      for (const acc of creditAccounts) {
        const balanceCents = getBalanceCents(acc);
        const creditLimitCents = getCreditLimitCents(acc);
        const balance = toAmount(balanceCents);
        const creditLimit = toAmount(creditLimitCents);
        const utilization = creditLimitCents > 0
          ? new Decimal(balanceCents).div(creditLimitCents).times(100).toNumber()
          : 0;
        const availableCredit = toAmount(creditLimitCents - balanceCents);

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
          additionalMonthlyPayment: acc.additionalMonthlyPayment ?? undefined,
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
      for (const template of debtTemplates) {
        const remainingBalance =
          template.debtRemainingBalanceCents !== null
            ? toAmount(template.debtRemainingBalanceCents)
            : 0;
        if (typeFilter && typeFilter !== 'other') continue;
        if (inStrategyOnly && !template.includeInPayoffStrategy) continue;

        unifiedDebts.push({
          id: template.id,
          name: template.name,
          source: 'bill',
          sourceType: 'other',
          balance: remainingBalance,
          originalBalance:
            template.debtOriginalBalanceCents !== null
              ? toAmount(template.debtOriginalBalanceCents)
              : undefined,
          interestRate:
            template.debtInterestAprBps !== null
              ? new Decimal(template.debtInterestAprBps).div(100).toNumber()
              : undefined,
          interestType: template.debtInterestType ?? undefined,
          includeInPayoffStrategy: template.includeInPayoffStrategy ?? true,
          color: template.debtColor ?? undefined,
          debtType: undefined,
          isInterestTaxDeductible: template.interestTaxDeductible ?? undefined,
          taxDeductionType: template.interestTaxDeductionType ?? undefined,
        });
      }

    }

    // Add standalone debts from debts table
    // These are shown in the "Loans" filter since they're typically loans/debts being tracked
    if (!sourceFilter || sourceFilter === 'debt' || sourceFilter === 'bill') {
      for (const debt of standaloneDebts) {
        // Apply type filter - map to unified filter categories
        // 'credit' filter shows only credit card types
        // 'line_of_credit' filter shows only line of credit types
        // 'loans' (source === 'bill') shows loans and standalone debts
        if (typeFilter === 'credit' && debt.type !== 'credit_card') continue;
        if (typeFilter === 'line_of_credit') continue; // Standalone debts aren't lines of credit
        // Standalone debts are currently always included in strategy.

        // Calculate utilization for credit cards with credit limits
        let utilization: number | undefined;
        let availableCredit: number | undefined;
        if (debt.type === 'credit_card' && debt.creditLimit) {
          utilization = new Decimal(debt.remainingBalance).div(debt.creditLimit).times(100).toNumber();
          availableCredit = new Decimal(debt.creditLimit).minus(debt.remainingBalance).toNumber();
        }

        unifiedDebts.push({
          id: debt.id,
          name: debt.name,
          source: 'debt' as const,
          sourceType: debt.type || 'other',
          balance: debt.remainingBalance,
          originalBalance: debt.originalAmount,
          creditLimit: debt.creditLimit ?? undefined,
          interestRate: debt.interestRate ?? undefined,
          interestType: debt.interestType ?? undefined,
          minimumPayment: debt.minimumPayment ?? undefined,
          additionalMonthlyPayment: debt.additionalMonthlyPayment ?? undefined,
          includeInPayoffStrategy: true, // Standalone debts are always in strategy
          color: debt.color ?? undefined,
          debtType: debt.type ?? undefined,
          utilization,
          availableCredit,
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
        standaloneDebtCount: unifiedDebts.filter(d => d.source === 'debt').length,
        inStrategyCount,
        strategyBalance,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes('Household ID')) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    console.error('Unified debts fetch error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
