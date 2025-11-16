import { requireAuth } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { accounts } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { getHouseholdIdFromRequest, requireHouseholdAuth } from '@/lib/api/household-auth';

export const dynamic = 'force-dynamic';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await requireAuth();

    const { id } = await params;
    const body = await request.json();

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

    // Verify account belongs to user AND household
    const existingAccount = await db
      .select()
      .from(accounts)
      .where(
        and(
          eq(accounts.id, id),
          eq(accounts.userId, userId),
          eq(accounts.householdId, householdId)
        )
      )
      .limit(1);

    if (!existingAccount || existingAccount.length === 0) {
      return Response.json(
        { error: 'Account not found' },
        { status: 404 }
      );
    }

    // Get update data from body (already parsed above)
    const {
      name,
      type,
      bankName,
      accountNumberLast4,
      currentBalance,
      creditLimit,
      color,
      icon,
      isBusinessAccount,
    } = body;

    // Validate required fields
    if (!name || !type) {
      return Response.json(
        { error: 'Name and type are required' },
        { status: 400 }
      );
    }

    // Update the account
    await db
      .update(accounts)
      .set({
        name,
        type,
        bankName: bankName || null,
        accountNumberLast4: accountNumberLast4 || null,
        currentBalance: currentBalance !== undefined ? currentBalance : existingAccount[0].currentBalance,
        creditLimit: creditLimit || null,
        color: color || existingAccount[0].color,
        icon: icon || existingAccount[0].icon,
        isBusinessAccount: isBusinessAccount !== undefined ? isBusinessAccount : existingAccount[0].isBusinessAccount,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(accounts.id, id));

    return Response.json(
      { id, message: 'Account updated successfully' },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes('Household')) {
      return Response.json({ error: error.message }, { status: 403 });
    }
    console.error('Account update error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await requireAuth();

    const { id } = await params;

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

    // Verify account belongs to user AND household
    const account = await db
      .select()
      .from(accounts)
      .where(
        and(
          eq(accounts.id, id),
          eq(accounts.userId, userId),
          eq(accounts.householdId, householdId)
        )
      )
      .limit(1);

    if (!account || account.length === 0) {
      return Response.json(
        { error: 'Account not found' },
        { status: 404 }
      );
    }

    // Delete the account
    await db.delete(accounts).where(eq(accounts.id, id));

    return Response.json(
      { message: 'Account deleted successfully' },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes('Household')) {
      return Response.json({ error: error.message }, { status: 403 });
    }
    console.error('Account deletion error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
