import { and, eq, gte, lte, sql } from 'drizzle-orm';

import { requireAuth } from '@/lib/auth-helpers';
import { listOccurrences } from '@/lib/bills/service';
import { toBillsV2Error } from '@/lib/bills/route-helpers';
import { getAndVerifyHousehold } from '@/lib/api/household-auth';
import { db } from '@/lib/db';
import { billOccurrences } from '@/lib/db/schema';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const { userId } = await requireAuth();
    const payload = (await request.json()) as { year?: number };
    const { householdId } = await getAndVerifyHousehold(
      request,
      userId,
      payload as unknown as Record<string, unknown>
    );

    const year = payload.year || new Date().getFullYear();
    if (!Number.isFinite(year) || year < 2000 || year > 2100) {
      return Response.json({ error: 'Invalid year parameter' }, { status: 400 });
    }

    const yearStart = `${year}-01-01`;
    const yearEnd = `${year}-12-31`;

    const [beforeCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(billOccurrences)
      .where(
        and(
          eq(billOccurrences.householdId, householdId),
          gte(billOccurrences.dueDate, yearStart),
          lte(billOccurrences.dueDate, yearEnd)
        )
      );

    await listOccurrences({
      userId,
      householdId,
      from: yearStart,
      to: yearEnd,
      limit: 1,
      offset: 0,
    });

    const [afterCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(billOccurrences)
      .where(
        and(
          eq(billOccurrences.householdId, householdId),
          gte(billOccurrences.dueDate, yearStart),
          lte(billOccurrences.dueDate, yearEnd)
        )
      );

    const before = Number(beforeCount?.count || 0);
    const after = Number(afterCount?.count || 0);

    return Response.json({
      success: true,
      year,
      instancesCreated: Math.max(0, after - before),
      billsChecked: null,
    });
  } catch (error) {
    return toBillsV2Error(error, 'ensure-instances POST');
  }
}
