import { requireAuth } from '@/lib/auth-helpers';
import { getAndVerifyHousehold } from '@/lib/api/household-auth';
import { testRule, testRuleOnMultiple } from '@/lib/rules/rule-matcher';
import { TransactionData } from '@/lib/rules/condition-evaluator';
export const dynamic = 'force-dynamic';

/**
 * POST /api/rules/test - Test a rule against sample transactions
 */
export async function POST(request: Request) {
  try {
    const { userId } = await requireAuth();
    const body = await request.json();
    await getAndVerifyHousehold(request, userId, body);

    const { rule, transactions } = body;

    if (!rule || !transactions) {
      return Response.json(
        { error: 'Missing required fields: rule, transactions' },
        { status: 400 }
      );
    }

    // Ensure transactions is an array
    const txArray = Array.isArray(transactions) ? transactions : [transactions];

    if (txArray.length === 0) {
      return Response.json(
        { error: 'At least one transaction is required for testing' },
        { status: 400 }
      );
    }

    const asRecord = (value: unknown): Record<string, unknown> =>
      value && typeof value === 'object' ? (value as Record<string, unknown>) : {};

    // Convert transactions to proper format
    const formattedTransactions: TransactionData[] = txArray.map((tx: unknown) => {
      const record = asRecord(tx);
      const description = typeof record.description === 'string' ? record.description : '';
      const accountName = typeof record.accountName === 'string' ? record.accountName : '';
      const date = typeof record.date === 'string' ? record.date : new Date().toISOString().split('T')[0];
      const notes = typeof record.notes === 'string' ? record.notes : undefined;

      const rawAmount = record.amount;
      const amount =
        typeof rawAmount === 'string'
          ? parseFloat(rawAmount)
          : typeof rawAmount === 'number'
            ? rawAmount
            : 0;

      return {
        description,
        amount,
        accountName,
        date,
        notes,
      };
    });

    // Test the rule
    if (txArray.length === 1) {
      const result = testRule(rule, formattedTransactions[0]);
      return Response.json({
        transaction: formattedTransactions[0],
        ...result,
      });
    }

    // Test against multiple transactions
    const results = testRuleOnMultiple(rule, formattedTransactions);

    return Response.json({
      count: results.length,
      matchCount: results.filter(r => r.matched).length,
      results,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Rule test error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
