import { differenceInDays, parseISO, startOfDay } from 'date-fns';
import { and, eq, inArray } from 'drizzle-orm';

import { requireAuth } from '@/lib/auth-helpers';
import { toBillsV2Error } from '@/lib/bills/route-helpers';
import { listOccurrences } from '@/lib/bills/service';
import { getAndVerifyHousehold } from '@/lib/api/household-auth';
import { db } from '@/lib/db';
import { accounts, autopayRules } from '@/lib/db/schema';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { userId } = await requireAuth();
    const { householdId } = await getAndVerifyHousehold(request, userId);

    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '5', 10);

    const today = startOfDay(new Date());

    const result = await listOccurrences({
      userId,
      householdId,
      status: ['unpaid', 'partial', 'overdue'],
      limit: 5000,
      offset: 0,
    });

    const overdueRows = result.data
      .filter((row) => row.occurrence.status === 'overdue')
      .sort((a, b) => a.occurrence.dueDate.localeCompare(b.occurrence.dueDate));

    const pendingRows = result.data
      .filter((row) => row.occurrence.status === 'unpaid' || row.occurrence.status === 'partial')
      .sort((a, b) => a.occurrence.dueDate.localeCompare(b.occurrence.dueDate));

    const combined = [...overdueRows, ...pendingRows].slice(0, limit);

    const linkedAccountIds = [
      ...new Set(
        combined
          .map((row) => row.template.linkedLiabilityAccountId)
          .filter((id): id is string => !!id)
      ),
    ];

    const templateIds = [...new Set(combined.map((row) => row.template.id))];

    const [linkedAccounts, autopayRows] = await Promise.all([
      linkedAccountIds.length > 0
        ? db
            .select({
              id: accounts.id,
              name: accounts.name,
              type: accounts.type,
              currentBalance: accounts.currentBalance,
              currentBalanceCents: accounts.currentBalanceCents,
              creditLimit: accounts.creditLimit,
              creditLimitCents: accounts.creditLimitCents,
            })
            .from(accounts)
            .where(and(eq(accounts.householdId, householdId), inArray(accounts.id, linkedAccountIds)))
        : Promise.resolve([]),
      templateIds.length > 0
        ? db
            .select()
            .from(autopayRules)
            .where(and(eq(autopayRules.householdId, householdId), inArray(autopayRules.templateId, templateIds)))
        : Promise.resolve([]),
    ]);

    const accountMap = new Map(linkedAccounts.map((row) => [row.id, row]));
    const autopayMap = new Map(autopayRows.map((row) => [row.templateId, row]));

    const items = combined.map((row) => {
      const dueDate = parseISO(row.occurrence.dueDate);
      const daysUntilDue = differenceInDays(dueDate, today);
      const isOverdue = row.occurrence.status === 'overdue';
      const linkedAccount = row.template.linkedLiabilityAccountId
        ? accountMap.get(row.template.linkedLiabilityAccountId)
        : null;
      const autopay = autopayMap.get(row.template.id);

      return {
        occurrence: row.occurrence,
        template: row.template,
        daysUntilDue,
        isOverdue,
        linkedAccount: linkedAccount
          ? {
              id: linkedAccount.id,
              name: linkedAccount.name,
              type: linkedAccount.type as 'credit' | 'line_of_credit',
              currentBalanceCents: Math.abs(
                linkedAccount.currentBalanceCents ??
                  Math.round((linkedAccount.currentBalance || 0) * 100)
              ),
              creditLimitCents:
                linkedAccount.creditLimitCents ??
                Math.round((linkedAccount.creditLimit || 0) * 100),
            }
          : null,
        autopay: autopay
          ? {
              isEnabled: autopay.isEnabled,
              amountType: autopay.amountType,
              fixedAmountCents: autopay.fixedAmountCents,
              daysBeforeDue: autopay.daysBeforeDue,
            }
          : null,
      };
    });

    const overdueTotalCents = overdueRows.reduce((sum, row) => sum + row.occurrence.amountDueCents, 0);
    const nextPending = pendingRows[0] || null;

    const next7DaysRows = pendingRows.filter((row) => {
      const dueDate = parseISO(row.occurrence.dueDate);
      const days = differenceInDays(dueDate, today);
      return days >= 0 && days <= 7;
    });

    return Response.json({
      data: {
        items,
        summary: {
          overdueCount: overdueRows.length,
          overdueTotalCents,
          nextDueDate: nextPending?.occurrence.dueDate || null,
          next7DaysTotalCents: next7DaysRows.reduce(
            (sum, row) => sum + row.occurrence.amountDueCents,
            0
          ),
          next7DaysCount: next7DaysRows.length,
          totalPendingCount: pendingRows.length,
        },
      },
    });
  } catch (error) {
    return toBillsV2Error(error, 'next-due GET');
  }
}
