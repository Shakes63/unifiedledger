import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { transactions, accounts, budgetCategories, merchants } from '@/lib/db/schema';
import { eq, and, gte, lte, desc } from 'drizzle-orm';
import { headers } from 'next/headers';

export async function GET(request: Request) {
  try {
    const authResult = await auth.api.getSession({
      headers: await headers(),
    });

    if (!authResult?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const accountId = searchParams.get('accountId');

    // Build query conditions
    const conditions = [eq(transactions.userId, authResult.user.id)];

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
      .leftJoin(accounts, eq(transactions.accountId, accounts.id))
      .leftJoin(budgetCategories, eq(transactions.categoryId, budgetCategories.id))
      .leftJoin(merchants, eq(transactions.merchantId, merchants.id))
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
          `"${t.description?.replace(/"/g, '""') || ''}"`,
          `"${row.account?.name?.replace(/"/g, '""') || ''}"`,
          `"${row.category?.name?.replace(/"/g, '""') || ''}"`,
          `"${row.merchant?.name?.replace(/"/g, '""') || ''}"`,
          t.amount,
          `"${t.notes?.replace(/"/g, '""') || ''}"`,
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
    console.error('Error exporting CSV:', error);
    return NextResponse.json(
      { error: 'Failed to export CSV' },
      { status: 500 }
    );
  }
}
