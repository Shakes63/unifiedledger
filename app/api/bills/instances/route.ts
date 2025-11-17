import { requireAuth } from '@/lib/auth-helpers';
import { getAndVerifyHousehold } from '@/lib/api/household-auth';
import { db } from '@/lib/db';
import { billInstances, bills } from '@/lib/db/schema';
import { eq, and, desc, inArray, lt, gte } from 'drizzle-orm';
import { format } from 'date-fns';

export const dynamic = 'force-dynamic';

// GET - List bill instances with filtering
export async function GET(request: Request) {
  try {
    const { userId } = await requireAuth();
    const { householdId } = await getAndVerifyHousehold(request, userId);

    // First, update bill instance statuses based on due dates (filtered by household)
    // FIX: Update pending bills with past due dates to overdue
    // Also fix overdue bills with future due dates back to pending
    const today = format(new Date(), 'yyyy-MM-dd');
    
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
    
    // Update overdue bills with future due dates back to pending (data consistency fix)
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

    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');
    const status = url.searchParams.get('status'); // pending, paid, overdue, skipped
    const billId = url.searchParams.get('billId');
    const dueDateStart = url.searchParams.get('dueDateStart');
    const dueDateEnd = url.searchParams.get('dueDateEnd');

    const conditions = [
      eq(billInstances.userId, userId),
      eq(billInstances.householdId, householdId)
    ];

    if (status) {
      // Handle comma-separated status values (e.g., "pending,paid")
      const statusValues = status.split(',').map(s => s.trim());
      if (statusValues.length > 1) {
        conditions.push(inArray(billInstances.status, statusValues as any));
      } else {
        conditions.push(eq(billInstances.status, status as any));
      }
    }

    if (billId) {
      conditions.push(eq(billInstances.billId, billId));
    }

    const result = await db
      .select({
        instance: billInstances,
        bill: bills,
      })
      .from(billInstances)
      .leftJoin(bills, eq(billInstances.billId, bills.id))
      .where(conditions.length === 1 ? conditions[0] : and(...(conditions as any)))
      .orderBy(desc(billInstances.dueDate))
      .limit(limit)
      .offset(offset);

    const countResult = await db
      .select()
      .from(billInstances)
      .where(
        and(
          eq(billInstances.userId, userId),
          eq(billInstances.householdId, householdId)
        )
      );

    return Response.json({
      data: result,
      total: countResult.length,
      limit,
      offset,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes('Household')) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    console.error('Error fetching bill instances:', error);
    return Response.json(
      { error: 'Failed to fetch bill instances' },
      { status: 500 }
    );
  }
}

// POST - Create a bill instance (for manual creation)
export async function POST(request: Request) {
  try {
    const { userId } = await requireAuth();
    const body = await request.json();
    const { householdId } = await getAndVerifyHousehold(request, userId, body);

    const {
      billId,
      dueDate,
      expectedAmount,
      status = 'pending',
      notes,
    } = body;

    // Validate required fields
    if (!billId || !dueDate || expectedAmount === undefined) {
      return Response.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Verify bill exists and belongs to user and household
    const bill = await db
      .select()
      .from(bills)
      .where(
        and(
          eq(bills.id, billId),
          eq(bills.userId, userId),
          eq(bills.householdId, householdId)
        )
      )
      .limit(1);

    if (bill.length === 0) {
      return Response.json(
        { error: 'Bill not found' },
        { status: 404 }
      );
    }

    // Check if instance already exists for this bill and date
    const existing = await db
      .select()
      .from(billInstances)
      .where(
        and(
          eq(billInstances.billId, billId),
          eq(billInstances.householdId, householdId),
          eq(billInstances.dueDate, dueDate)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      return Response.json(
        { error: 'Bill instance already exists for this date' },
        { status: 409 }
      );
    }

    const { nanoid } = await import('nanoid');
    const instanceId = nanoid();

    // FIX: Automatically set status to 'overdue' if due date is in the past
    // This prevents creating pending instances with past due dates
    const today = format(new Date(), 'yyyy-MM-dd');
    const finalStatus = (status === 'pending' && dueDate < today) ? 'overdue' : status;

    const newInstance = await db
      .insert(billInstances)
      .values({
        id: instanceId,
        userId,
        householdId,
        billId,
        dueDate,
        expectedAmount: parseFloat(expectedAmount),
        status: finalStatus,
        notes,
      });

    const createdInstance = await db
      .select()
      .from(billInstances)
      .where(eq(billInstances.id, instanceId))
      .limit(1);

    return Response.json(createdInstance[0]);
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes('Household')) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    console.error('Error creating bill instance:', error);
    return Response.json(
      { error: 'Failed to create bill instance' },
      { status: 500 }
    );
  }
}
