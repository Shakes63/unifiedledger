import { requireAuth } from '@/lib/auth-helpers';
import { getAndVerifyHousehold } from '@/lib/api/household-auth';
import { db } from '@/lib/db';
import { debts, debtPayments, debtPayoffMilestones } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { syncDebtPayoffDate } from '@/lib/debts/payoff-date-utils';
import { queueSync } from '@/lib/calendar/sync-service';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await requireAuth();
    let householdId: string;
    try {
      const result = await getAndVerifyHousehold(request, userId);
      householdId = result.householdId;
    } catch (error) {
      // If household verification fails, return 404 to prevent enumeration
      if (error instanceof Error && (error.message.includes('Household ID') || error.message.includes('Not a member'))) {
        return new Response(JSON.stringify({ error: 'Debt not found' }), { status: 404 });
      }
      throw error;
    }
    const { id } = await params;
    const debt = await db
      .select()
      .from(debts)
      .where(
        and(
          eq(debts.id, id),
          eq(debts.userId, userId),
          eq(debts.householdId, householdId)
        )
      )
      .then((res) => res[0]);

    if (!debt) {
      return new Response(JSON.stringify({ error: 'Debt not found' }), { status: 404 });
    }

    const payments = await db
      .select()
      .from(debtPayments)
      .where(
        and(
          eq(debtPayments.debtId, id),
          eq(debtPayments.householdId, householdId)
        )
      )
      .orderBy(debtPayments.paymentDate);

    const milestones = await db
      .select()
      .from(debtPayoffMilestones)
      .where(
        and(
          eq(debtPayoffMilestones.debtId, id),
          eq(debtPayoffMilestones.householdId, householdId)
        )
      )
      .orderBy(debtPayoffMilestones.percentage);

    return new Response(JSON.stringify({ ...debt, payments, milestones }), { status: 200 });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes('Household ID')) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    console.error('Error fetching debt:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch debt' }), { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await requireAuth();
    const body = await request.json();
    let householdId: string;
    try {
      const result = await getAndVerifyHousehold(request, userId, body);
      householdId = result.householdId;
    } catch (error) {
      // If household verification fails, return 404 to prevent enumeration
      if (error instanceof Error && (error.message.includes('Household ID') || error.message.includes('Not a member'))) {
        return new Response(JSON.stringify({ error: 'Debt not found' }), { status: 404 });
      }
      throw error;
    }
    const { id } = await params;

    // Verify user owns this debt and it belongs to household
    const debt = await db
      .select()
      .from(debts)
      .where(
        and(
          eq(debts.id, id),
          eq(debts.userId, userId),
          eq(debts.householdId, householdId)
        )
      )
      .then((res) => res[0]);

    if (!debt) {
      return new Response(JSON.stringify({ error: 'Debt not found' }), { status: 404 });
    }

    const allowedUpdateFields = [
      'name',
      'description',
      'creditorName',
      'originalAmount',
      'remainingBalance',
      'minimumPayment',
      'additionalMonthlyPayment',
      'interestRate',
      'interestType',
      'accountId',
      'categoryId',
      'type',
      'color',
      'icon',
      'startDate',
      'targetPayoffDate',
      'status',
      'priority',
      'loanType',
      'loanTermMonths',
      'originationDate',
      'compoundingFrequency',
      'billingCycleDays',
      'lastStatementDate',
      'lastStatementBalance',
      'creditLimit',
      'notes',
    ] as const;

    const updates: Partial<typeof debts.$inferInsert> = {};
    for (const field of allowedUpdateFields) {
      const value = (body as Record<string, unknown>)[field];
      if (value !== undefined) {
        (updates as Record<string, unknown>)[field] = value;
      }
    }
    updates.updatedAt = new Date().toISOString();

    // Track if we need to recalculate payoff date
    const payoffAffectingFields = ['remainingBalance', 'minimumPayment', 'additionalMonthlyPayment', 'interestRate'];
    const needsPayoffRecalc = payoffAffectingFields.some(field => body[field] !== undefined);
    const remainingBalanceInput = typeof body.remainingBalance === 'number'
      ? body.remainingBalance
      : undefined;

    // If remaining balance changed, recalculate milestone amounts
    if (remainingBalanceInput !== undefined && remainingBalanceInput !== debt.remainingBalance) {
      const newBalance = remainingBalanceInput;

      const milestonesToUpdate = [
        { percentage: 25, milestoneBalance: newBalance * 0.75 },
        { percentage: 50, milestoneBalance: newBalance * 0.5 },
        { percentage: 75, milestoneBalance: newBalance * 0.25 },
        { percentage: 100, milestoneBalance: 0 },
      ];

      for (const milestone of milestonesToUpdate) {
        const existing = await db
          .select()
          .from(debtPayoffMilestones)
          .where(
            and(
              eq(debtPayoffMilestones.debtId, id),
              eq(debtPayoffMilestones.percentage, milestone.percentage),
              eq(debtPayoffMilestones.householdId, householdId)
            )
          )
          .then((res) => res[0]);

        if (existing && !existing.achievedAt) {
          await db
            .update(debtPayoffMilestones)
            .set({ milestoneBalance: milestone.milestoneBalance })
            .where(eq(debtPayoffMilestones.id, existing.id));
        }
      }

      // Check for newly achieved milestones based on the new balance
      // A milestone is achieved when remaining balance drops to or below the threshold
      const allMilestones = await db
        .select()
        .from(debtPayoffMilestones)
        .where(
          and(
            eq(debtPayoffMilestones.debtId, id),
            eq(debtPayoffMilestones.householdId, householdId)
          )
        );

      const now = new Date().toISOString();
      for (const milestone of allMilestones) {
        // Check if milestone is newly achieved (not already marked, and balance is at or below threshold)
        if (!milestone.achievedAt && newBalance <= milestone.milestoneBalance) {
          await db
            .update(debtPayoffMilestones)
            .set({ achievedAt: now })
            .where(eq(debtPayoffMilestones.id, milestone.id));
        }
      }
    }

    await db
      .update(debts)
      .set(updates)
      .where(eq(debts.id, id));

    // Recalculate payoff date if relevant fields changed
    // This updates targetPayoffDate so debt appears on calendar
    if (needsPayoffRecalc) {
      await syncDebtPayoffDate(id, userId, householdId);
    }

    const updatedDebt = await db
      .select()
      .from(debts)
      .where(eq(debts.id, id))
      .then((res) => res[0]);

    // Queue calendar sync for payoff date (non-blocking)
    queueSync(userId, householdId, 'payoff_date', `debt-${id}`, 'update');

    return new Response(JSON.stringify(updatedDebt), { status: 200 });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes('Household ID')) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    console.error('Error updating debt:', error);
    return new Response(JSON.stringify({ error: 'Failed to update debt' }), { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await requireAuth();
    const { householdId } = await getAndVerifyHousehold(request, userId);
    const { id } = await params;

    // Verify user owns this debt and it belongs to household
    const debt = await db
      .select()
      .from(debts)
      .where(
        and(
          eq(debts.id, id),
          eq(debts.userId, userId),
          eq(debts.householdId, householdId)
        )
      )
      .then((res) => res[0]);

    if (!debt) {
      return new Response(JSON.stringify({ error: 'Debt not found' }), { status: 404 });
    }

    // Delete milestones first (with household filter for safety)
    await db
      .delete(debtPayoffMilestones)
      .where(
        and(
          eq(debtPayoffMilestones.debtId, id),
          eq(debtPayoffMilestones.householdId, householdId)
        )
      );

    // Delete payments (with household filter for safety)
    await db
      .delete(debtPayments)
      .where(
        and(
          eq(debtPayments.debtId, id),
          eq(debtPayments.householdId, householdId)
        )
      );

    // Delete debt
    await db.delete(debts).where(eq(debts.id, id));

    // Queue calendar sync for debt deletion (non-blocking)
    queueSync(userId, householdId, 'payoff_date', `debt-${id}`, 'delete');

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes('Household ID')) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    console.error('Error deleting debt:', error);
    return new Response(JSON.stringify({ error: 'Failed to delete debt' }), { status: 500 });
  }
}
