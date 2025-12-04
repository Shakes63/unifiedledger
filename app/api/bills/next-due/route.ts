import { requireAuth } from '@/lib/auth-helpers';
import { getAndVerifyHousehold } from '@/lib/api/household-auth';
import { db } from '@/lib/db';
import { billInstances, bills, accounts } from '@/lib/db/schema';
import { eq, and, asc, inArray, lt, gte, or } from 'drizzle-orm';
import { format, differenceInDays } from 'date-fns';
import Decimal from 'decimal.js';

export const dynamic = 'force-dynamic';

/**
 * GET /api/bills/next-due
 * Returns the next upcoming bill payments for the dashboard widget
 */
export async function GET(request: Request) {
  try {
    const { userId } = await requireAuth();
    const { householdId } = await getAndVerifyHousehold(request, userId);

    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '5');
    
    const today = format(new Date(), 'yyyy-MM-dd');
    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);
    
    // Calculate date 7 days from now for summary
    const sevenDaysFromNow = new Date(todayDate);
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
    const sevenDaysDate = format(sevenDaysFromNow, 'yyyy-MM-dd');

    // Update bill instance statuses based on due dates
    // Update pending bills with past due dates to overdue
    await db
      .update(billInstances)
      .set({ status: 'overdue' })
      .where(
        and(
          eq(billInstances.userId, userId),
          eq(billInstances.householdId, householdId),
          eq(billInstances.status, 'pending'),
          lt(billInstances.dueDate, today)
        )
      );
    
    // Update overdue bills with future due dates back to pending (data consistency)
    await db
      .update(billInstances)
      .set({ status: 'pending' })
      .where(
        and(
          eq(billInstances.userId, userId),
          eq(billInstances.householdId, householdId),
          eq(billInstances.status, 'overdue'),
          gte(billInstances.dueDate, today)
        )
      );

    // Fetch overdue and pending bill instances, ordered by due date
    const result = await db
      .select({
        instance: billInstances,
        bill: bills,
      })
      .from(billInstances)
      .leftJoin(bills, eq(billInstances.billId, bills.id))
      .where(
        and(
          eq(billInstances.userId, userId),
          eq(billInstances.householdId, householdId),
          or(
            eq(billInstances.status, 'pending'),
            eq(billInstances.status, 'overdue')
          )
        )
      )
      .orderBy(asc(billInstances.dueDate))
      .limit(limit + 10); // Fetch extra for overdue prioritization

    // Separate overdue and pending bills
    const overdueBills = result.filter(r => r.instance.status === 'overdue');
    const pendingBills = result.filter(r => r.instance.status === 'pending');
    
    // Combine: overdue first (sorted by oldest), then pending (sorted by soonest)
    const combinedBills = [
      ...overdueBills.sort((a, b) => 
        new Date(a.instance.dueDate).getTime() - new Date(b.instance.dueDate).getTime()
      ),
      ...pendingBills.sort((a, b) => 
        new Date(a.instance.dueDate).getTime() - new Date(b.instance.dueDate).getTime()
      ),
    ].slice(0, limit);

    // Get linked account IDs for credit card payment bills
    const linkedAccountIds = combinedBills
      .filter(r => r.bill?.linkedAccountId)
      .map(r => r.bill!.linkedAccountId as string);

    // Fetch linked accounts if any
    let linkedAccountsMap: Map<string, {
      id: string;
      name: string;
      type: string;
      currentBalance: number | null;
      creditLimit: number | null;
    }> = new Map();

    if (linkedAccountIds.length > 0) {
      const linkedAccounts = await db
        .select({
          id: accounts.id,
          name: accounts.name,
          type: accounts.type,
          currentBalance: accounts.currentBalance,
          creditLimit: accounts.creditLimit,
        })
        .from(accounts)
        .where(inArray(accounts.id, linkedAccountIds));
      
      linkedAccounts.forEach(acc => {
        linkedAccountsMap.set(acc.id, acc);
      });
    }

    // Transform results for the widget
    const billsList = combinedBills.map(r => {
      const dueDate = new Date(r.instance.dueDate);
      dueDate.setHours(0, 0, 0, 0);
      const daysUntilDue = differenceInDays(dueDate, todayDate);
      const isOverdue = r.instance.status === 'overdue';
      
      // Get linked account info if this is a credit card payment bill
      const linkedAccount = r.bill?.linkedAccountId 
        ? linkedAccountsMap.get(r.bill.linkedAccountId) 
        : undefined;

      return {
        id: r.instance.id,
        billId: r.instance.billId,
        billName: r.bill?.name || 'Unknown Bill',
        dueDate: r.instance.dueDate,
        expectedAmount: r.instance.expectedAmount,
        actualAmount: r.instance.actualAmount,
        status: r.instance.status,
        daysUntilDue: isOverdue ? daysUntilDue : daysUntilDue, // negative if overdue
        isOverdue,
        // Credit card payment bill info
        linkedAccount: linkedAccount ? {
          id: linkedAccount.id,
          name: linkedAccount.name,
          type: linkedAccount.type as 'credit' | 'line_of_credit',
          currentBalance: Math.abs(linkedAccount.currentBalance || 0),
          creditLimit: linkedAccount.creditLimit || 0,
        } : undefined,
        // Autopay info
        isAutopay: r.bill?.isAutopayEnabled || false,
        autopayAmount: r.bill?.autopayFixedAmount || undefined,
        autopayDays: r.bill?.autopayDaysBefore || undefined,
        autopayAmountType: r.bill?.autopayAmountType || undefined,
        // Bill metadata
        billColor: r.bill?.billColor || undefined,
        isDebt: r.bill?.isDebt || false,
      };
    });

    // Calculate summary statistics
    const allOverdueAndPending = await db
      .select({
        instance: billInstances,
      })
      .from(billInstances)
      .where(
        and(
          eq(billInstances.userId, userId),
          eq(billInstances.householdId, householdId),
          or(
            eq(billInstances.status, 'pending'),
            eq(billInstances.status, 'overdue')
          )
        )
      );

    const overdueInstances = allOverdueAndPending.filter(r => r.instance.status === 'overdue');
    const overdueTotal = overdueInstances.reduce(
      (sum, r) => new Decimal(sum).plus(r.instance.expectedAmount || 0).toNumber(),
      0
    );
    const overdueCount = overdueInstances.length;

    // Find next due date (first pending bill)
    const nextPending = allOverdueAndPending
      .filter(r => r.instance.status === 'pending')
      .sort((a, b) => 
        new Date(a.instance.dueDate).getTime() - new Date(b.instance.dueDate).getTime()
      )[0];
    const nextDueDate = nextPending?.instance.dueDate || null;

    // Calculate next 7 days totals
    const next7DaysInstances = allOverdueAndPending.filter(r => {
      const dueDate = r.instance.dueDate;
      return dueDate >= today && dueDate <= sevenDaysDate;
    });
    const next7DaysTotal = next7DaysInstances.reduce(
      (sum, r) => new Decimal(sum).plus(r.instance.expectedAmount || 0).toNumber(),
      0
    );
    const next7DaysCount = next7DaysInstances.length;

    return Response.json({
      bills: billsList,
      summary: {
        overdueCount,
        overdueTotal,
        nextDueDate,
        next7DaysTotal,
        next7DaysCount,
        totalPendingCount: allOverdueAndPending.length - overdueCount,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes('Household')) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    console.error('Error fetching next due bills:', error);
    return Response.json(
      { error: 'Failed to fetch next due bills' },
      { status: 500 }
    );
  }
}

