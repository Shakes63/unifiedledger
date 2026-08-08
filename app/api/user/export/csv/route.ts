import { NextResponse } from 'next/server';
import { csvSafeQuoted } from '@/lib/utils/csv-safe';
import { requireAuth } from '@/lib/auth-helpers';
import { getAndVerifyHousehold } from '@/lib/api/household-auth';
import { db } from '@/lib/db';
import { transactions, accounts, budgetCategories, merchants } from '@/lib/db/schema';
import { eq, and, gte, lte, desc } from 'drizzle-orm';

export async function GET(request: Request) {
  try {
    const { userId } = await requireAuth();
    const { householdId } = await getAndVerifyHousehold(request, userId);

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const accountId = searchParams.get('accountId');

    // Build query conditions
    const conditions = [eq(transactions.userId, userId), eq(transactions.householdId, householdId)];

    if (startDate) {
      conditions.push(gte(transactions.date, startDate));
    }
    if (endDate) {
      conditions.push(lte(transactions.date, endDate));
    }
    if (accountId) {
      conditions.push(eq(transactions.accountId, accountId));
    }

    // Fetch transactions with joins
    const txns = await db
      .select({
        transaction: transactions,
        account: accounts,
        category: budgetCategories,
        merchant: merchants,
      })
      .from(transactions)
      .leftJoin(
        accounts,
        and(
          eq(transactions.accountId, accounts.id),
          eq(accounts.userId, userId),
          eq(accounts.householdId, householdId)
        )
      )
      .leftJoin(
        budgetCategories,
        and(
          eq(transactions.categoryId, budgetCategories.id),
          eq(budgetCategories.userId, userId),
          eq(budgetCategories.householdId, householdId)
        )
      )
      .leftJoin(
        merchants,
        and(
          eq(transactions.merchantId, merchants.id),
          eq(merchants.userId, userId),
          eq(merchants.householdId, householdId)
        )
      )
      .where(and(...conditions))
      .orderBy(desc(transactions.date));

    // Generate CSV
    const csvRows = [
      // Header
      'Date,Type,Description,Account,Category,Merchant,Amount,Notes',
      // Data rows
      ...txns.map((row) => {
        const t = row.transaction;
        return [
          t.date,
          t.type,
          // csvSafeQuoted, not bare quote-doubling (SEC1): spreadsheets strip
          // CSV quoting before evaluating a cell, so a description beginning
          // with = + - or @ still executes on open. These strings come from the
          // BANK's statement, not from the person exporting the file.
          csvSafeQuoted(t.description),
          csvSafeQuoted(row.account?.name),
          csvSafeQuoted(row.category?.name),
          csvSafeQuoted(row.merchant?.name),
          t.amount,
          csvSafeQuoted(t.notes),
        ].join(',');
      }),
    ];

    const csv = csvRows.join('\n');

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="transactions-${startDate || 'all'}-${endDate || 'all'}.csv"`,
      },
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      if (error.message === 'Household ID is required') {
        return NextResponse.json({ error: 'Household ID is required' }, { status: 400 });
      }
      if (error.message.startsWith('Unauthorized:')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
    }
    console.error('Error exporting CSV:', error);
    return NextResponse.json(
      { error: 'Failed to export CSV' },
      { status: 500 }
    );
  }
}
