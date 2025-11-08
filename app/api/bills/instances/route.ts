import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { billInstances, bills } from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

// GET - List bill instances with filtering
export async function GET(request: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return Response.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');
    const status = url.searchParams.get('status'); // pending, paid, overdue, skipped
    const billId = url.searchParams.get('billId');
    const dueDateStart = url.searchParams.get('dueDateStart');
    const dueDateEnd = url.searchParams.get('dueDateEnd');

    const conditions = [eq(billInstances.userId, userId)];

    if (status) {
      conditions.push(eq(billInstances.status, status as any));
    }

    if (billId) {
      conditions.push(eq(billInstances.billId, billId));
    }

    const result = await db
      .select()
      .from(billInstances)
      .where(conditions.length === 1 ? conditions[0] : and(...(conditions as any)))
      .orderBy(desc(billInstances.dueDate))
      .limit(limit)
      .offset(offset);

    const countResult = await db
      .select()
      .from(billInstances)
      .where(eq(billInstances.userId, userId));

    return Response.json({
      data: result,
      total: countResult.length,
      limit,
      offset,
    });
  } catch (error) {
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
    const { userId } = await auth();

    if (!userId) {
      return Response.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
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

    // Verify bill exists and belongs to user
    const bill = await db
      .select()
      .from(bills)
      .where(
        and(
          eq(bills.id, billId),
          eq(bills.userId, userId)
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

    const newInstance = await db
      .insert(billInstances)
      .values({
        id: instanceId,
        userId,
        billId,
        dueDate,
        expectedAmount: parseFloat(expectedAmount),
        status,
        notes,
      });

    const createdInstance = await db
      .select()
      .from(billInstances)
      .where(eq(billInstances.id, instanceId))
      .limit(1);

    return Response.json(createdInstance[0]);
  } catch (error) {
    console.error('Error creating bill instance:', error);
    return Response.json(
      { error: 'Failed to create bill instance' },
      { status: 500 }
    );
  }
}
