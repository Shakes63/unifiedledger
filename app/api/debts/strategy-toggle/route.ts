import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-helpers';
import { getAndVerifyHousehold } from '@/lib/api/household-auth';
import { db } from '@/lib/db';
import { accounts, billTemplates, bills, debts } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import Decimal from 'decimal.js';
import { toMoneyCents } from '@/lib/utils/money-cents';

export const dynamic = 'force-dynamic';

function toAmount(cents: number): number {
  return new Decimal(cents).div(100).toNumber();
}

interface ToggleRequest {
  source: 'account' | 'bill' | 'debt';
  id: string;
  include: boolean;
}

interface UnifiedDebtResponse {
  id: string;
  name: string;
  source: 'account' | 'bill' | 'debt';
  sourceType: string;
  balance: number;
  interestRate?: number;
  minimumPayment?: number;
  includeInPayoffStrategy: boolean;
  color?: string;
  creditLimit?: number;
  utilization?: number;
  availableCredit?: number;
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await requireAuth();
    const { householdId } = await getAndVerifyHousehold(request, userId);

    const body: ToggleRequest = await request.json();
    const { source, id, include } = body;

    // Validate request
    if (!source || !id || typeof include !== 'boolean') {
      return NextResponse.json(
        { error: 'Invalid request. Required: source (account|bill), id, include (boolean)' },
        { status: 400 }
      );
    }

    if (source !== 'account' && source !== 'bill' && source !== 'debt') {
      return NextResponse.json(
        { error: 'Source must be "account", "bill", or "debt"' },
        { status: 400 }
      );
    }

    let updatedDebt: UnifiedDebtResponse;

    if (source === 'account') {
      // Verify account belongs to this household
      const [account] = await db
        .select()
        .from(accounts)
        .where(
          and(
            eq(accounts.id, id),
            eq(accounts.householdId, householdId)
          )
        )
        .limit(1);

      if (!account) {
        return NextResponse.json(
          { error: 'Account not found or access denied' },
          { status: 404 }
        );
      }

      // Verify it's a credit account
      if (account.type !== 'credit' && account.type !== 'line_of_credit') {
        return NextResponse.json(
          { error: 'Only credit accounts can be included in payoff strategy' },
          { status: 400 }
        );
      }

      // Update the account
      await db
        .update(accounts)
        .set({ 
          includeInPayoffStrategy: include,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(accounts.id, id));

      // Return updated account in unified format
      const balanceCents = Math.abs(account.currentBalanceCents ?? toMoneyCents(account.currentBalance) ?? 0);
      const creditLimitCents = account.creditLimitCents ?? toMoneyCents(account.creditLimit) ?? 0;
      const balance = toAmount(balanceCents);
      const creditLimit = toAmount(creditLimitCents);
      const utilization = creditLimitCents > 0
        ? new Decimal(balanceCents).div(creditLimitCents).times(100).toNumber()
        : 0;
      const availableCredit = toAmount(creditLimitCents - balanceCents);

      updatedDebt = {
        id: account.id,
        name: account.name,
        source: 'account',
        sourceType: account.type,
        balance,
        interestRate: account.interestRate ?? undefined,
        minimumPayment: account.minimumPaymentAmount ?? undefined,
        includeInPayoffStrategy: include,
        color: account.color ?? undefined,
        creditLimit,
        utilization,
        availableCredit,
      };
    } else if (source === 'bill') {
      // Prefer bills-v2 template toggle.
      const [template] = await db
        .select()
        .from(billTemplates)
        .where(
          and(
            eq(billTemplates.id, id),
            eq(billTemplates.householdId, householdId)
          )
        )
        .limit(1);

      if (template) {
        if (!template.debtEnabled) {
          return NextResponse.json(
            { error: 'Only debt-enabled bills can be included in payoff strategy' },
            { status: 400 }
          );
        }

        await db
          .update(billTemplates)
          .set({
            includeInPayoffStrategy: include,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(billTemplates.id, id));

        updatedDebt = {
          id: template.id,
          name: template.name,
          source: 'bill',
          sourceType: 'other',
          balance:
            template.debtRemainingBalanceCents !== null
              ? toAmount(template.debtRemainingBalanceCents)
              : 0,
          interestRate:
            template.debtInterestAprBps !== null
              ? new Decimal(template.debtInterestAprBps).div(100).toNumber()
              : undefined,
          minimumPayment: 0,
          includeInPayoffStrategy: include,
          color: template.debtColor ?? undefined,
        };
      } else {
        // Legacy fallback
        // Verify bill belongs to this household
      const [bill] = await db
        .select()
        .from(bills)
        .where(
          and(
            eq(bills.id, id),
            eq(bills.householdId, householdId)
          )
        )
        .limit(1);

      if (!bill) {
        return NextResponse.json(
          { error: 'Bill not found or access denied' },
          { status: 404 }
        );
      }

      // Verify it's a debt bill
      if (!bill.isDebt) {
        return NextResponse.json(
          { error: 'Only debt bills can be included in payoff strategy' },
          { status: 400 }
        );
      }

      // Update the bill
      await db
        .update(bills)
        .set({ 
          includeInPayoffStrategy: include,
        })
        .where(eq(bills.id, id));

      // Return updated bill in unified format
      updatedDebt = {
        id: bill.id,
        name: bill.name,
        source: 'bill',
        sourceType: bill.debtType || 'other',
        balance: bill.remainingBalance || 0,
        interestRate: bill.billInterestRate ?? undefined,
        minimumPayment: bill.minimumPayment ?? undefined,
        includeInPayoffStrategy: include,
        color: bill.billColor ?? undefined,
      };
      }
    } else {
      // source === 'debt'
      const [debt] = await db
        .select()
        .from(debts)
        .where(
          and(
            eq(debts.id, id),
            eq(debts.householdId, householdId),
            eq(debts.status, 'active')
          )
        )
        .limit(1);

      if (!debt) {
        return NextResponse.json(
          { error: 'Debt not found or access denied' },
          { status: 404 }
        );
      }

      if (!include) {
        return NextResponse.json(
          { error: 'Standalone debts are currently always included in payoff strategy' },
          { status: 400 }
        );
      }

      updatedDebt = {
        id: debt.id,
        name: debt.name,
        source: 'debt',
        sourceType: debt.type || 'other',
        balance: debt.remainingBalance || 0,
        interestRate: debt.interestRate ?? undefined,
        minimumPayment: debt.minimumPayment ?? undefined,
        includeInPayoffStrategy: true,
        color: debt.color ?? undefined,
      };
    }

    return NextResponse.json({
      success: true,
      debt: updatedDebt,
    });

  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes('Household ID')) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('Error toggling strategy inclusion:', error);
    return NextResponse.json(
      { error: 'Failed to update strategy inclusion' },
      { status: 500 }
    );
  }
}
