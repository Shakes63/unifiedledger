import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { accounts } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return Response.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = await params;

    // Verify account belongs to user
    const existingAccount = await db
      .select()
      .from(accounts)
      .where(and(eq(accounts.id, id), eq(accounts.userId, userId)))
      .limit(1);

    if (!existingAccount || existingAccount.length === 0) {
      return Response.json(
        { error: 'Account not found' },
        { status: 404 }
      );
    }

    // Get update data from request
    const body = await request.json();
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
    const { userId } = await auth();

    if (!userId) {
      return Response.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = await params;

    // Verify account belongs to user
    const account = await db
      .select()
      .from(accounts)
      .where(and(eq(accounts.id, id), eq(accounts.userId, userId)))
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
    console.error('Account deletion error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
