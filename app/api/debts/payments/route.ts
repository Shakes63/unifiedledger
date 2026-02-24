import { and, desc, eq, inArray } from 'drizzle-orm';
import { nanoid } from 'nanoid';

import { getAndVerifyHousehold } from '@/lib/api/household-auth';
import { requireAuth } from '@/lib/auth-helpers';
import { centsToDollars } from '@/lib/bills-v2/legacy-compat';
import { db } from '@/lib/db';
import {
  accounts,
  billMilestones,
  billPaymentEvents,
  billOccurrences,
  billTemplates,
  bills,
  debtPayments,
  debtPayoffMilestones,
  debts,
  transactions,
} from '@/lib/db/schema';
import { toMoneyCents } from '@/lib/utils/money-cents';

type PaymentSource = 'account' | 'bill' | 'debt';

interface UnifiedPayment {
  id: string;
  amount: number;
  paymentDate: string;
  principalAmount?: number;
  interestAmount?: number;
  notes?: string;
  transactionId?: string;
}

interface PaymentRequestBody {
  source?: PaymentSource;
  id?: string;
  amount?: number;
  paymentDate?: string;
  transactionId?: string;
  notes?: string;
}

function parseSource(value: string | null): PaymentSource | null {
  if (value === 'account' || value === 'bill' || value === 'debt') {
    return value;
  }
  return null;
}

/**
 * GET /api/debts/payments?source=account|bill|debt&id=<source-id>
 * Unified payment history across account-backed, bill-backed, and standalone debts.
 */
export async function GET(request: Request) {
  try {
    const { userId } = await requireAuth();
    const { householdId } = await getAndVerifyHousehold(request, userId);
    const { searchParams } = new URL(request.url);
    const source = parseSource(searchParams.get('source'));
    const sourceId = searchParams.get('id');

    if (!source || !sourceId) {
      return Response.json(
        { error: 'source and id query params are required' },
        { status: 400 }
      );
    }

    if (source === 'debt') {
      const debt = await db
        .select({ id: debts.id })
        .from(debts)
        .where(
          and(
            eq(debts.id, sourceId),
            eq(debts.userId, userId),
            eq(debts.householdId, householdId)
          )
        )
        .limit(1)
        .then((rows) => rows[0]);

      if (!debt) {
        return Response.json({ error: 'Debt not found' }, { status: 404 });
      }

      const payments = await db
        .select({
          id: debtPayments.id,
          amount: debtPayments.amount,
          paymentDate: debtPayments.paymentDate,
          notes: debtPayments.notes,
          transactionId: debtPayments.transactionId,
        })
        .from(debtPayments)
        .where(
          and(
            eq(debtPayments.debtId, sourceId),
            eq(debtPayments.householdId, householdId)
          )
        )
        .orderBy(desc(debtPayments.paymentDate));

      return Response.json(
        payments.map((payment) => ({
          ...payment,
          notes: payment.notes || undefined,
          transactionId: payment.transactionId || undefined,
        })) satisfies UnifiedPayment[]
      );
    }

    if (source === 'bill') {
      // Prefer bills-v2 templates/payment events.
      const template = await db
        .select({ id: billTemplates.id })
        .from(billTemplates)
        .where(
          and(
            eq(billTemplates.id, sourceId),
            eq(billTemplates.householdId, householdId)
          )
        )
        .limit(1)
        .then((rows) => rows[0]);

      if (template) {
        const payments = await db
          .select({
            id: billPaymentEvents.id,
            amountCents: billPaymentEvents.amountCents,
            paymentDate: billPaymentEvents.paymentDate,
            principalCents: billPaymentEvents.principalCents,
            interestCents: billPaymentEvents.interestCents,
            notes: billPaymentEvents.notes,
            transactionId: billPaymentEvents.transactionId,
          })
          .from(billPaymentEvents)
          .where(
            and(
              eq(billPaymentEvents.templateId, sourceId),
              eq(billPaymentEvents.householdId, householdId)
            )
          )
          .orderBy(desc(billPaymentEvents.paymentDate));

        return Response.json(
          payments.map((payment) => ({
            id: payment.id,
            amount: centsToDollars(payment.amountCents),
            paymentDate: payment.paymentDate,
            principalAmount:
              payment.principalCents !== null ? centsToDollars(payment.principalCents) : undefined,
            interestAmount:
              payment.interestCents !== null ? centsToDollars(payment.interestCents) : undefined,
            notes: payment.notes || undefined,
            transactionId: payment.transactionId || undefined,
          })) satisfies UnifiedPayment[]
        );
      }

      // Legacy fallback
      const bill = await db
        .select({ id: bills.id })
        .from(bills)
        .where(
          and(
            eq(bills.id, sourceId),
            eq(bills.userId, userId),
            eq(bills.householdId, householdId)
          )
        )
        .limit(1)
        .then((rows) => rows[0]);

      if (!bill) {
        return Response.json({ error: 'Debt bill not found' }, { status: 404 });
      }

      const payments = await db
        .select({
          id: transactions.id,
          amount: transactions.amount,
          paymentDate: transactions.date,
          notes: transactions.notes,
          transactionId: transactions.id,
        })
        .from(transactions)
        .where(
          and(
            eq(transactions.billId, sourceId),
            eq(transactions.householdId, householdId)
          )
        )
        .orderBy(desc(transactions.date));

      return Response.json(
        payments.map((payment) => ({
          id: payment.id,
          amount: Math.abs(Number(payment.amount || 0)),
          paymentDate: payment.paymentDate,
          notes: payment.notes || undefined,
          transactionId: payment.transactionId || undefined,
        })) satisfies UnifiedPayment[]
      );
    }

    const account = await db
      .select({ id: accounts.id })
      .from(accounts)
      .where(
        and(
          eq(accounts.id, sourceId),
          eq(accounts.userId, userId),
          eq(accounts.householdId, householdId),
          eq(accounts.isActive, true)
        )
      )
      .limit(1)
      .then((rows) => rows[0]);

    if (!account) {
      return Response.json({ error: 'Debt account not found' }, { status: 404 });
    }

    const accountPayments = await db
      .select({
        id: transactions.id,
        amount: transactions.amount,
        paymentDate: transactions.date,
        notes: transactions.notes,
        description: transactions.description,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          eq(transactions.householdId, householdId),
          eq(transactions.accountId, sourceId),
          eq(transactions.type, 'transfer_in')
        )
      )
      .orderBy(desc(transactions.date));

    const mappedPayments: UnifiedPayment[] = accountPayments.map((payment) => ({
      id: payment.id,
      amount: Math.abs(Number(payment.amount || 0)),
      paymentDate: payment.paymentDate,
      notes: payment.notes || payment.description || undefined,
      transactionId: payment.id,
    }));

    return Response.json(mappedPayments);
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes('Household ID')) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    console.error('Error fetching unified debt payments:', error);
    return Response.json(
      { error: 'Failed to fetch payment history' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/debts/payments
 * Body: { source: "account"|"bill"|"debt", id: string, amount: number, paymentDate?: string, notes?: string, transactionId?: string }
 */
export async function POST(request: Request) {
  try {
    const { userId } = await requireAuth();
    const body = (await request.json()) as PaymentRequestBody;
    const { householdId } = await getAndVerifyHousehold(
      request,
      userId,
      body as unknown as Record<string, unknown>
    );

    const source = body.source;
    const sourceId = body.id;
    const amount = Number(body.amount);
    const paymentDate =
      body.paymentDate && body.paymentDate.length > 0
        ? body.paymentDate
        : new Date().toISOString();
    const notes = body.notes || undefined;
    const transactionId = body.transactionId || undefined;
    const now = new Date().toISOString();

    if (!source || !sourceId || Number.isNaN(amount) || amount <= 0) {
      return Response.json(
        { error: 'source, id, and a valid positive amount are required' },
        { status: 400 }
      );
    }

    if (source === 'debt') {
      const debt = await db
        .select()
        .from(debts)
        .where(
          and(
            eq(debts.id, sourceId),
            eq(debts.userId, userId),
            eq(debts.householdId, householdId)
          )
        )
        .limit(1)
        .then((rows) => rows[0]);

      if (!debt) {
        return Response.json({ error: 'Debt not found' }, { status: 404 });
      }

      if (transactionId) {
        const transaction = await db
          .select({ id: transactions.id })
          .from(transactions)
          .where(
            and(
              eq(transactions.id, transactionId),
              eq(transactions.userId, userId),
              eq(transactions.householdId, householdId)
            )
          )
          .limit(1)
          .then((rows) => rows[0]);
        if (!transaction) {
          return Response.json(
            { error: 'Transaction not found or does not belong to this household' },
            { status: 400 }
          );
        }
      }

      const paymentId = nanoid();
      await db.insert(debtPayments).values({
        id: paymentId,
        debtId: sourceId,
        userId,
        householdId,
        amount,
        paymentDate,
        transactionId,
        notes,
        createdAt: now,
      });

      const newBalance = Math.max(0, debt.remainingBalance - amount);
      await db
        .update(debts)
        .set({
          remainingBalance: newBalance,
          updatedAt: now,
          status: newBalance === 0 ? 'paid_off' : debt.status,
        })
        .where(eq(debts.id, sourceId));

      const milestones = await db
        .select()
        .from(debtPayoffMilestones)
        .where(
          and(
            eq(debtPayoffMilestones.debtId, sourceId),
            eq(debtPayoffMilestones.householdId, householdId)
          )
        );

      for (const milestone of milestones) {
        if (!milestone.achievedAt && newBalance <= milestone.milestoneBalance) {
          await db
            .update(debtPayoffMilestones)
            .set({ achievedAt: now })
            .where(eq(debtPayoffMilestones.id, milestone.id));
        }
      }

      return Response.json({
        id: paymentId,
        amount,
        paymentDate,
        notes,
        transactionId,
      });
    }

    if (source === 'bill') {
      const [template] = await db
        .select()
        .from(billTemplates)
        .where(
          and(
            eq(billTemplates.id, sourceId),
            eq(billTemplates.householdId, householdId),
            eq(billTemplates.debtEnabled, true)
          )
        )
        .limit(1);

      if (template) {
        if (!transactionId) {
          return Response.json(
            { error: 'transactionId is required for debt-enabled bills-v2 payments' },
            { status: 400 }
          );
        }

        const transaction = await db
          .select({
            id: transactions.id,
            date: transactions.date,
            accountId: transactions.accountId,
          })
          .from(transactions)
          .where(
            and(
              eq(transactions.id, transactionId),
              eq(transactions.userId, userId),
              eq(transactions.householdId, householdId)
            )
          )
          .limit(1)
          .then((rows) => rows[0]);
        if (!transaction) {
          return Response.json(
            { error: 'Transaction not found or does not belong to this household' },
            { status: 400 }
          );
        }

        const paymentDateYmd = paymentDate.slice(0, 10);
        const [occurrence] = await db
          .select()
          .from(billOccurrences)
          .where(
            and(
              eq(billOccurrences.templateId, template.id),
              eq(billOccurrences.householdId, householdId),
              inArray(billOccurrences.status, ['unpaid', 'partial', 'overdue'])
            )
          )
          .orderBy(desc(billOccurrences.dueDate))
          .limit(1);

        if (!occurrence) {
          return Response.json(
            { error: 'No open bill occurrence found to apply payment' },
            { status: 400 }
          );
        }

        const paymentId = nanoid();
        const amountCents = toMoneyCents(amount) ?? 0;
        const nextOccurrencePaidCents = (occurrence.amountPaidCents || 0) + amountCents;
        const nextOccurrenceRemainingCents = Math.max(
          0,
          (occurrence.amountDueCents || 0) - nextOccurrencePaidCents
        );
        const nextStatus =
          nextOccurrenceRemainingCents <= 0
            ? 'paid'
            : nextOccurrencePaidCents > 0
              ? 'partial'
              : occurrence.status;

        const balanceBeforeCents = template.debtRemainingBalanceCents ?? null;
        const balanceAfterCents =
          balanceBeforeCents !== null ? Math.max(0, balanceBeforeCents - amountCents) : null;

        await db.insert(billPaymentEvents).values({
          id: paymentId,
          householdId,
          templateId: template.id,
          occurrenceId: occurrence.id,
          transactionId,
          amountCents,
          principalCents: null,
          interestCents: null,
          balanceBeforeCents,
          balanceAfterCents,
          paymentDate: paymentDateYmd,
          paymentMethod: 'manual',
          sourceAccountId: transaction.accountId,
          notes: notes || null,
          createdAt: now,
        });

        await db
          .update(billOccurrences)
          .set({
            amountPaidCents: nextOccurrencePaidCents,
            amountRemainingCents: nextOccurrenceRemainingCents,
            actualAmountCents: nextOccurrencePaidCents,
            paidDate: nextOccurrenceRemainingCents === 0 ? paymentDateYmd : null,
            status: nextStatus,
            lastTransactionId: transactionId,
            updatedAt: now,
          })
          .where(eq(billOccurrences.id, occurrence.id));

        if (balanceAfterCents !== null) {
          await db
            .update(billTemplates)
            .set({
              debtRemainingBalanceCents: balanceAfterCents,
              updatedAt: now,
            })
            .where(eq(billTemplates.id, template.id));
        }

        return Response.json({
          id: paymentId,
          amount,
          paymentDate: paymentDateYmd,
          notes,
          transactionId,
        });
      }

      const bill = await db
        .select()
        .from(bills)
        .where(
          and(
            eq(bills.id, sourceId),
            eq(bills.userId, userId),
            eq(bills.householdId, householdId),
            eq(bills.isDebt, true)
          )
        )
        .limit(1)
        .then((rows) => rows[0]);

      if (!bill) {
        return Response.json({ error: 'Debt bill not found' }, { status: 404 });
      }

      if (transactionId) {
        const transaction = await db
          .select({ id: transactions.id })
          .from(transactions)
          .where(
            and(
              eq(transactions.id, transactionId),
              eq(transactions.userId, userId),
              eq(transactions.householdId, householdId)
            )
          )
          .limit(1)
          .then((rows) => rows[0]);
        if (!transaction) {
          return Response.json(
            { error: 'Transaction not found or does not belong to this household' },
            { status: 400 }
          );
        }
      }

      const paymentId = nanoid();

      if (bill.remainingBalance !== null && bill.remainingBalance !== undefined) {
        const newBalance = Math.max(0, bill.remainingBalance - amount);
        await db
          .update(bills)
          .set({ remainingBalance: newBalance })
          .where(eq(bills.id, sourceId));

        const milestones = await db
          .select()
          .from(billMilestones)
          .where(
            and(
              eq(billMilestones.billId, sourceId),
              eq(billMilestones.householdId, householdId)
            )
          );

        for (const milestone of milestones) {
          if (!milestone.achievedAt && newBalance <= milestone.milestoneBalance) {
            await db
              .update(billMilestones)
              .set({ achievedAt: now })
              .where(eq(billMilestones.id, milestone.id));
          }
        }
      }

      if (transactionId) {
        await db
          .update(transactions)
          .set({
            billId: sourceId,
            updatedAt: now,
          })
          .where(
            and(
              eq(transactions.id, transactionId),
              eq(transactions.userId, userId),
              eq(transactions.householdId, householdId)
            )
          );
      }

      return Response.json({
        id: paymentId,
        amount,
        paymentDate,
        notes,
        transactionId,
      });
    }

    const account = await db
      .select()
      .from(accounts)
      .where(
        and(
          eq(accounts.id, sourceId),
          eq(accounts.userId, userId),
          eq(accounts.householdId, householdId),
          eq(accounts.isActive, true)
        )
      )
      .limit(1)
      .then((rows) => rows[0]);

    if (!account) {
      return Response.json({ error: 'Debt account not found' }, { status: 404 });
    }

    const amountCents = toMoneyCents(amount) ?? 0;
    const currentBalanceCents = Math.abs(
      account.currentBalanceCents ?? toMoneyCents(account.currentBalance) ?? 0
    );
    const newBalanceCents = Math.max(0, currentBalanceCents - amountCents);

    await db
      .update(accounts)
      .set({
        currentBalanceCents: newBalanceCents,
        currentBalance: newBalanceCents / 100,
        updatedAt: now,
      })
      .where(eq(accounts.id, sourceId));

    const transactionInsertId = nanoid();
    await db.insert(transactions).values({
      id: transactionInsertId,
      userId,
      householdId,
      accountId: sourceId,
      date: paymentDate.slice(0, 10),
      amount,
      amountCents,
      description: 'Debt payment',
      notes: notes || null,
      type: 'transfer_in',
      createdAt: now,
      updatedAt: now,
    });

    const milestones = await db
      .select()
      .from(billMilestones)
      .where(
        and(
          eq(billMilestones.accountId, sourceId),
          eq(billMilestones.householdId, householdId)
        )
      );

    for (const milestone of milestones) {
      if (!milestone.achievedAt && newBalanceCents / 100 <= milestone.milestoneBalance) {
        await db
          .update(billMilestones)
          .set({ achievedAt: now })
          .where(eq(billMilestones.id, milestone.id));
      }
    }

    return Response.json({
      id: transactionInsertId,
      amount,
      paymentDate,
      notes,
      transactionId: transactionInsertId,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes('Household ID')) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    console.error('Error recording unified debt payment:', error);
    return Response.json({ error: 'Failed to record payment' }, { status: 500 });
  }
}
