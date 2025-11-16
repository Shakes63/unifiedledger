import { requireAuth } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { accounts } from '@/lib/db/schema';
import { eq, desc, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { getHouseholdIdFromRequest, requireHouseholdAuth } from '@/lib/api/household-auth';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { userId } = await requireAuth();

    // Get and validate household
    const householdId = getHouseholdIdFromRequest(request);
    await requireHouseholdAuth(userId, householdId);

    // TypeScript: householdId is guaranteed to be non-null after requireHouseholdAuth
    if (!householdId) {
      return Response.json(
        { error: 'Household ID is required' },
        { status: 400 }
      );
    }

    const userAccounts = await db
      .select()
      .from(accounts)
      .where(
        and(
          eq(accounts.userId, userId),
          eq(accounts.householdId, householdId)
        )
      )
      .orderBy(desc(accounts.usageCount), accounts.sortOrder);

    return Response.json(userAccounts);
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes('Household')) {
      return Response.json({ error: error.message }, { status: 403 });
    }
    console.error('Account fetch error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { userId } = await requireAuth();

    const body = await request.json();
    const {
      name,
      type,
      bankName,
      accountNumberLast4,
      currentBalance = 0,
      creditLimit,
      color = '#3b82f6',
      icon = 'wallet',
      isBusinessAccount = false,
    } = body;

    if (!name || !type) {
      return Response.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Get and validate household
    const householdId = getHouseholdIdFromRequest(request, body);
    await requireHouseholdAuth(userId, householdId);

    // TypeScript: householdId is guaranteed to be non-null after requireHouseholdAuth
    if (!householdId) {
      return Response.json(
        { error: 'Household ID is required' },
        { status: 400 }
      );
    }

    const accountId = nanoid();
    const now = new Date().toISOString();

    try {
      const result = await db.insert(accounts).values({
        id: accountId,
        userId,
        householdId,
        name,
        type,
        bankName: bankName || null,
        accountNumberLast4: accountNumberLast4 || null,
        currentBalance,
        creditLimit: creditLimit || null,
        color,
        icon,
        isBusinessAccount,
        createdAt: now,
        updatedAt: now,
      });

      return Response.json(
        { id: accountId, message: 'Account created successfully' },
        { status: 201 }
      );
    } catch (dbError) {
      console.error('Database insertion error:', dbError);
      throw dbError;
    }
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes('Household')) {
      return Response.json({ error: error.message }, { status: 403 });
    }
    console.error('Account creation error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    console.error('Error details:', errorMessage);
    return Response.json(
      { error: errorMessage || 'Internal server error' },
      { status: 500 }
    );
  }
}
