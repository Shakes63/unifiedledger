import { requireAuth } from '@/lib/auth-helpers';
import { getAndVerifyHousehold } from '@/lib/api/household-auth';
import { db } from '@/lib/db';
import {
  accounts,
  bills,
  transactions,
  householdSettings,
} from '@/lib/db/schema';
import { eq, and, inArray, gte, lte, or } from 'drizzle-orm';
import Decimal from 'decimal.js';

// Types for the unified debt budget response
interface UnifiedDebtItem {
  id: string;
  name: string;
  source: 'account' | 'bill';
  sourceType: string;
  balance: number;
  minimumPayment: number;
  recommendedPayment: number;
  budgetedPayment: number | null;
  actualPaid: number;
  isFocusDebt: boolean;
  includeInPayoffStrategy: boolean;
  interestRate?: number;
  color?: string;
}

interface UnifiedDebtBudgetResponse {
  strategyEnabled: boolean;
  payoffMethod: 'snowball' | 'avalanche';
  extraMonthlyPayment: number;
  paymentFrequency: 'weekly' | 'biweekly' | 'monthly';

  // Strategy-managed debts (includeInPayoffStrategy = true)
  strategyDebts: {
    items: UnifiedDebtItem[];
    totalMinimum: number;
    totalRecommended: number;
    totalPaid: number;
  };

  // Manual debts (includeInPayoffStrategy = false)
  manualDebts: UnifiedDebtItem[];

  // Summary
  totalMinimumPayments: number;
  totalBudgetedPayments: number;
  totalActualPaid: number;
  debtCount: number;
}

export async function GET(request: Request): Promise<Response> {
  try {
    const { userId } = await requireAuth();
    const { householdId } = await getAndVerifyHousehold(request, userId);

    // Get month parameter from query string (default to current month)
    const url = new URL(request.url);
    const monthParam = url.searchParams.get('month');

    let year: number;
    let month: number;

    if (monthParam) {
      const [yearStr, monthStr] = monthParam.split('-');
      year = parseInt(yearStr);
      month = parseInt(monthStr);
    } else {
      const now = new Date();
      year = now.getFullYear();
      month = now.getMonth() + 1;
    }

    // Calculate month start and end dates
    const monthStart = new Date(year, month - 1, 1).toISOString().split('T')[0];
    const monthEnd = new Date(year, month, 0).toISOString().split('T')[0];

    // Fetch household settings
    const settings = await db
      .select()
      .from(householdSettings)
      .where(eq(householdSettings.householdId, householdId))
      .limit(1);

    const strategyEnabled = settings[0]?.debtStrategyEnabled ?? false;
    const payoffMethod = (settings[0]?.debtPayoffMethod ?? 'avalanche') as
      | 'snowball'
      | 'avalanche';
    const extraMonthlyPayment = settings[0]?.extraMonthlyPayment ?? 0;
    const paymentFrequency = (settings[0]?.paymentFrequency ?? 'monthly') as
      | 'weekly'
      | 'biweekly'
      | 'monthly';

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

    // Calculate actual payments for the month
    // For credit accounts: look for transfer_in transactions
    // For debt bills: look for expense transactions linked to the bill
    const paymentMap = new Map<string, number>();

    // Get payments to credit accounts (transfer_in to credit accounts)
    if (creditAccounts.length > 0) {
      const accountIds = creditAccounts.map((a) => a.id);
      const creditPayments = await db
        .select()
        .from(transactions)
        .where(
          and(
            eq(transactions.householdId, householdId),
            eq(transactions.type, 'transfer_in'),
            inArray(transactions.accountId, accountIds),
            gte(transactions.date, monthStart),
            lte(transactions.date, monthEnd)
          )
        );

      for (const payment of creditPayments) {
        const current = paymentMap.get(payment.accountId) ?? 0;
        paymentMap.set(
          payment.accountId,
          new Decimal(current).plus(payment.amount).toNumber()
        );
      }
    }

    // Get payments to debt bills (expense transactions with billInstanceId linking to debt bills)
    if (debtBills.length > 0) {
      const billIds = debtBills.map((b) => b.id);
      // Look for transactions that match by description/merchant and date range
      // OR have a billInstanceId from a debt bill
      const billPayments = await db
        .select()
        .from(transactions)
        .where(
          and(
            eq(transactions.householdId, householdId),
            eq(transactions.type, 'expense'),
            gte(transactions.date, monthStart),
            lte(transactions.date, monthEnd)
          )
        );

      // Match payments to bills by description similarity or explicit link
      for (const payment of billPayments) {
        // Check if transaction is linked to any of our debt bills
        for (const bill of debtBills) {
          // Simple matching: check if description contains bill name
          const descLower = (payment.description ?? '').toLowerCase();
          const billNameLower = bill.name.toLowerCase();

          if (
            descLower.includes(billNameLower) ||
            billNameLower.includes(descLower)
          ) {
            const current = paymentMap.get(bill.id) ?? 0;
            paymentMap.set(
              bill.id,
              new Decimal(current).plus(payment.amount).toNumber()
            );
            break;
          }
        }
      }
    }

    // Build unified debt items
    const allDebts: UnifiedDebtItem[] = [];

    // Process credit accounts
    for (const account of creditAccounts) {
      const balance = Math.abs(account.currentBalance ?? 0);
      const minimumPayment = account.minimumPaymentAmount ?? 0;
      const budgetedPayment = account.budgetedMonthlyPayment;
      const actualPaid = paymentMap.get(account.id) ?? 0;

      allDebts.push({
        id: account.id,
        name: account.name,
        source: 'account',
        sourceType: account.type,
        balance,
        minimumPayment,
        recommendedPayment: minimumPayment, // Will be calculated below for strategy debts
        budgetedPayment,
        actualPaid,
        isFocusDebt: false,
        includeInPayoffStrategy: account.includeInPayoffStrategy ?? true,
        interestRate: account.interestRate ?? undefined,
        color: account.color ?? undefined,
      });
    }

    // Process debt bills
    for (const bill of debtBills) {
      const balance = bill.remainingBalance ?? 0;
      const minimumPayment = bill.minimumPayment ?? 0;
      const budgetedPayment = bill.budgetedMonthlyPayment;
      const actualPaid = paymentMap.get(bill.id) ?? 0;

      allDebts.push({
        id: bill.id,
        name: bill.name,
        source: 'bill',
        sourceType: bill.debtType ?? 'other',
        balance,
        minimumPayment,
        recommendedPayment: minimumPayment,
        budgetedPayment,
        actualPaid,
        isFocusDebt: false,
        includeInPayoffStrategy: bill.includeInPayoffStrategy ?? true,
        interestRate: bill.billInterestRate ?? undefined,
        color: bill.billColor ?? undefined,
      });
    }

    // Separate into strategy and manual debts
    const strategyDebts = allDebts.filter((d) => d.includeInPayoffStrategy);
    const manualDebts = allDebts.filter((d) => !d.includeInPayoffStrategy);

    // Calculate recommended payments for strategy debts using snowball/avalanche
    if (strategyEnabled && strategyDebts.length > 0) {
      // Sort by payoff method
      if (payoffMethod === 'avalanche') {
        // Highest interest first
        strategyDebts.sort((a, b) => (b.interestRate ?? 0) - (a.interestRate ?? 0));
      } else {
        // Snowball: lowest balance first
        strategyDebts.sort((a, b) => a.balance - b.balance);
      }

      // Mark focus debt and calculate recommended payments
      const totalMinimum = strategyDebts.reduce(
        (sum, d) => new Decimal(sum).plus(d.minimumPayment).toNumber(),
        0
      );

      // Focus debt gets all minimum payments + extra payment
      if (strategyDebts.length > 0) {
        strategyDebts[0].isFocusDebt = true;
        strategyDebts[0].recommendedPayment = new Decimal(
          strategyDebts[0].minimumPayment
        )
          .plus(extraMonthlyPayment)
          .toNumber();
      }
    }

    // Calculate totals
    const strategyTotalMinimum = strategyDebts.reduce(
      (sum, d) => new Decimal(sum).plus(d.minimumPayment).toNumber(),
      0
    );
    const strategyTotalRecommended = strategyDebts.reduce(
      (sum, d) => new Decimal(sum).plus(d.recommendedPayment).toNumber(),
      0
    );
    const strategyTotalPaid = strategyDebts.reduce(
      (sum, d) => new Decimal(sum).plus(d.actualPaid).toNumber(),
      0
    );

    const manualTotalBudgeted = manualDebts.reduce(
      (sum, d) =>
        new Decimal(sum).plus(d.budgetedPayment ?? d.minimumPayment).toNumber(),
      0
    );
    const manualTotalPaid = manualDebts.reduce(
      (sum, d) => new Decimal(sum).plus(d.actualPaid).toNumber(),
      0
    );

    const response: UnifiedDebtBudgetResponse = {
      strategyEnabled,
      payoffMethod,
      extraMonthlyPayment,
      paymentFrequency,
      strategyDebts: {
        items: strategyDebts,
        totalMinimum: strategyTotalMinimum,
        totalRecommended: strategyTotalRecommended,
        totalPaid: strategyTotalPaid,
      },
      manualDebts,
      totalMinimumPayments: new Decimal(strategyTotalMinimum)
        .plus(
          manualDebts.reduce(
            (sum, d) => new Decimal(sum).plus(d.minimumPayment).toNumber(),
            0
          )
        )
        .toNumber(),
      totalBudgetedPayments: new Decimal(strategyTotalRecommended)
        .plus(manualTotalBudgeted)
        .toNumber(),
      totalActualPaid: new Decimal(strategyTotalPaid)
        .plus(manualTotalPaid)
        .toNumber(),
      debtCount: allDebts.length,
    };

    return Response.json(response);
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes('Household ID')) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    console.error('Error fetching unified debt budget:', error);
    return Response.json(
      { error: 'Failed to fetch unified debt budget' },
      { status: 500 }
    );
  }
}

