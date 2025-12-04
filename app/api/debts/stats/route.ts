import { requireAuth } from '@/lib/auth-helpers';
import { getAndVerifyHousehold } from '@/lib/api/household-auth';
import { db } from '@/lib/db';
import { debts, debtPayments, accounts, bills, billPayments } from '@/lib/db/schema';
import { eq, and, inArray, gte, lte } from 'drizzle-orm';
import Decimal from 'decimal.js';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { userId } = await requireAuth();
    const { householdId } = await getAndVerifyHousehold(request, userId);

    // Parse query params
    const { searchParams } = new URL(request.url);
    const useUnified = searchParams.get('unified') !== 'false'; // Default to unified

    // Get date range for this month's payments
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();

    if (useUnified) {
      // UNIFIED MODE: Combine credit accounts + debt bills
      
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

      // Calculate totals from unified sources
      let totalBalance = new Decimal(0);
      let totalOriginalBalance = new Decimal(0);
      let inStrategyCount = 0;
      let inStrategyBalance = new Decimal(0);
      
      // Process credit accounts
      for (const acc of creditAccounts) {
        const balance = new Decimal(Math.abs(acc.currentBalance || 0));
        const creditLimit = new Decimal(acc.creditLimit || 0);
        
        totalBalance = totalBalance.plus(balance);
        totalOriginalBalance = totalOriginalBalance.plus(creditLimit); // Use credit limit as "original" for revolving
        
        if (acc.includeInPayoffStrategy) {
          inStrategyCount++;
          inStrategyBalance = inStrategyBalance.plus(balance);
        }
      }

      // Process debt bills
      for (const bill of debtBills) {
        const balance = new Decimal(bill.remainingBalance || 0);
        const original = new Decimal(bill.originalBalance || bill.remainingBalance || 0);
        
        totalBalance = totalBalance.plus(balance);
        totalOriginalBalance = totalOriginalBalance.plus(original);
        
        if (bill.includeInPayoffStrategy) {
          inStrategyCount++;
          inStrategyBalance = inStrategyBalance.plus(balance);
        }
      }

      // Get this month's payments from bill_payments table
      const monthPayments = await db
        .select()
        .from(billPayments)
        .where(
          and(
            eq(billPayments.householdId, householdId),
            gte(billPayments.paymentDate, monthStart),
            lte(billPayments.paymentDate, monthEnd)
          )
        );

      const thisMonthTotal = monthPayments.reduce(
        (sum, p) => sum.plus(new Decimal(p.amount || 0)),
        new Decimal(0)
      );

      // Calculate unified debt details
      const debtDetails = [
        // Credit accounts
        ...creditAccounts.map(acc => ({
          id: acc.id,
          name: acc.name,
          source: 'account' as const,
          sourceType: acc.type,
          remainingBalance: Math.abs(acc.currentBalance || 0),
          minimumPayment: acc.minimumPaymentAmount || 0,
          interestRate: acc.interestRate || 0,
          includeInPayoffStrategy: acc.includeInPayoffStrategy ?? true,
          color: acc.color || undefined,
        })),
        // Debt bills
        ...debtBills.map(bill => ({
          id: bill.id,
          name: bill.name,
          source: 'bill' as const,
          sourceType: bill.debtType || 'other',
          remainingBalance: bill.remainingBalance || 0,
          minimumPayment: bill.minimumPayment || 0,
          interestRate: bill.billInterestRate || 0,
          includeInPayoffStrategy: bill.includeInPayoffStrategy ?? true,
          color: bill.billColor || undefined,
        })),
      ];

      // Sort by balance (highest first)
      debtDetails.sort((a, b) => b.remainingBalance - a.remainingBalance);

      const totalPaidOff = totalOriginalBalance.minus(totalBalance).toNumber();
      const percentagePaidOff = totalOriginalBalance.greaterThan(0)
        ? totalOriginalBalance.minus(totalBalance).div(totalOriginalBalance).times(100).toNumber()
        : 0;

      return Response.json({
        // Unified stats
        totalRemainingBalance: totalBalance.toNumber(),
        totalOriginalAmount: totalOriginalBalance.toNumber(),
        totalPaidOff: Math.max(0, totalPaidOff),
        percentagePaidOff: Math.max(0, Math.min(100, percentagePaidOff)),
        activeDebtCount: creditAccounts.length + debtBills.length,
        creditAccountCount: creditAccounts.length,
        debtBillCount: debtBills.length,
        inStrategyCount,
        inStrategyBalance: inStrategyBalance.toNumber(),
        thisMonthPayments: thisMonthTotal.toNumber(),
        debtDetails,
        // Legacy compatibility
        paidOffDebtCount: 0, // Would need to track closed accounts/bills separately
        priorityDebt: debtDetails.length > 0 ? debtDetails[0] : null,
      });
    } else {
      // LEGACY MODE: Use old debts table
      const allDebts = await db
        .select()
        .from(debts)
        .where(
          and(
            eq(debts.userId, userId),
            eq(debts.householdId, householdId)
          )
        );

      // Calculate totals
      const totalOriginalAmount = allDebts.reduce((sum, d) => sum + (d.originalAmount || 0), 0);
      const totalRemainingBalance = allDebts.reduce((sum, d) => sum + (d.remainingBalance || 0), 0);
      const totalPaidOff = totalOriginalAmount - totalRemainingBalance;

      // Get active debts
      const activeDebts = allDebts.filter((d) => d.status === 'active');
      const paidOffDebts = allDebts.filter((d) => d.status === 'paid_off');

      // Get this month's payments
      const thisMonthPayments = await db
        .select()
        .from(debtPayments)
        .where(
          and(
            eq(debtPayments.userId, userId),
            eq(debtPayments.householdId, householdId)
          )
        );

      const thisMonthTotal = thisMonthPayments
        .filter(
          (p) =>
            new Date(p.paymentDate).getTime() >= new Date(monthStart).getTime() &&
            new Date(p.paymentDate).getTime() <= new Date(monthEnd).getTime()
        )
        .reduce((sum, p) => sum + (p.amount || 0), 0);

      // Find the debt with highest priority
      const sortedDebts = activeDebts.sort((a, b) => (a.priority || 999) - (b.priority || 999));
      const priorityDebt = sortedDebts.length > 0 ? sortedDebts[0] : null;

      // Calculate estimated payoff dates
      const debtDetails = activeDebts.map((debt) => {
        const monthlyPayment = debt.minimumPayment || 0;
        const remainingBalance = debt.remainingBalance || 0;
        let monthsToPayoff = Infinity;

        if (monthlyPayment > 0 && remainingBalance > 0) {
          monthsToPayoff = Math.ceil(remainingBalance / monthlyPayment);
        }

        const estimatedPayoffDate = new Date();
        estimatedPayoffDate.setMonth(estimatedPayoffDate.getMonth() + monthsToPayoff);

        return {
          id: debt.id,
          name: debt.name || 'Unknown Debt',
          remainingBalance: remainingBalance,
          minimumPayment: monthlyPayment,
          estimatedMonthsToPayoff: monthsToPayoff === Infinity ? null : monthsToPayoff,
          estimatedPayoffDate: monthsToPayoff === Infinity ? null : estimatedPayoffDate.toISOString(),
          interestRate: debt.interestRate || 0,
          priority: debt.priority || 0,
        };
      });

      return Response.json({
        totalOriginalAmount,
        totalRemainingBalance,
        totalPaidOff,
        percentagePaidOff:
          totalOriginalAmount > 0 ? (totalPaidOff / totalOriginalAmount) * 100 : 0,
        activeDebtCount: activeDebts.length,
        paidOffDebtCount: paidOffDebts.length,
        thisMonthPayments: thisMonthTotal,
        priorityDebt: priorityDebt || null,
        debtDetails,
      });
    }
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes('Household ID')) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    console.error('Error fetching debt stats:', error);
    return Response.json({ error: 'Failed to fetch debt statistics' }, { status: 500 });
  }
}
