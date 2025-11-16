import { requireAuth } from '@/lib/auth-helpers';
import { getHouseholdIdFromRequest, requireHouseholdAuth } from '@/lib/api/household-auth';
import { db } from '@/lib/db';
import { transactions, budgetCategories, accounts } from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { getCombinedTransferViewPreference } from '@/lib/preferences/transfer-view-preference';

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

    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');
    const accountId = url.searchParams.get('accountId');

    // Build where conditions
    const conditions: any[] = [
      eq(transactions.userId, userId),
      eq(transactions.householdId, householdId)
    ];

    // If accountId filter provided, verify account belongs to household
    if (accountId) {
      const account = await db.select({ id: accounts.id })
        .from(accounts)
        .where(and(
          eq(accounts.id, accountId),
          eq(accounts.householdId, householdId)
        ))
        .limit(1);

      if (!account || account.length === 0) {
        return Response.json({ error: 'Account not found' }, { status: 404 });
      }

      conditions.push(eq(transactions.accountId, accountId));
    }

    const userTransactions = await db
      .select({
        id: transactions.id,
        userId: transactions.userId,
        accountId: transactions.accountId,
        categoryId: transactions.categoryId,
        date: transactions.date,
        amount: transactions.amount,
        description: transactions.description,
        notes: transactions.notes,
        type: transactions.type,
        isPending: transactions.isPending,
        createdAt: transactions.createdAt,
      })
      .from(transactions)
      .where(and(...conditions))
      .orderBy(desc(transactions.date))
      .limit(limit)
      .offset(offset);

    // Respect user's transfer view preference when no account filter is applied
    if (!accountId) {
      const combinedTransferView = await getCombinedTransferViewPreference(userId, householdId);
      
      // Debug logging
      const transferOutCount = userTransactions.filter(tx => tx.type === 'transfer_out').length;
      const transferInCount = userTransactions.filter(tx => tx.type === 'transfer_in').length;
      console.log('[Transfer View History] Preference:', combinedTransferView, 'Total transactions:', userTransactions.length, 'transfer_out:', transferOutCount, 'transfer_in:', transferInCount);
      
      if (combinedTransferView) {
        // Filter out transfer_in transactions for combined view
        const filteredTransactions = userTransactions.filter(
          (tx) => tx.type !== 'transfer_in'
        );
        console.log('[Transfer View History] Combined: Filtered to', filteredTransactions.length, 'transactions');
        return Response.json(filteredTransactions);
      }
      
      console.log('[Transfer View History] Separate: Returning all', userTransactions.length, 'transactions (both transfer_out and transfer_in)');
    }

    return Response.json(userTransactions);
    } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && (
      error.message.includes('Household') ||
      error.message.includes('member')
    )) {
      return Response.json({ error: error.message }, { status: 403 });
    }
    console.error('Transaction history fetch error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
    }
}
