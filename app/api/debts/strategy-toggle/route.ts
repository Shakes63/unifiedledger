import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-helpers';
import { getAndVerifyHousehold } from '@/lib/api/household-auth';
import { db } from '@/lib/db';
import { accounts, bills } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import Decimal from 'decimal.js';
import { toMoneyCents } from '@/lib/utils/money-cents';

export const dynamic = 'force-dynamic';

function toAmount(cents: number): number {
  return new Decimal(cents).div(100).toNumber();
}

interface ToggleRequest {
  source: 'account' | 'bill';
  id: string;
  include: boolean;
}

interface UnifiedDebtResponse {
  id: string;
  name: string;
  source: 'account' | 'bill';
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

    if (source !== 'account' && source !== 'bill') {
      return NextResponse.json(
        { error: 'Source must be "account" or "bill"' },
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
    } else {
      // source === 'bill'
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
