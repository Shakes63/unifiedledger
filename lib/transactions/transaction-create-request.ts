export interface GoalContribution {
  goalId: string;
  amount: number;
}

export interface CreateTransactionBody {
  accountId?: string;
  categoryId?: string | null;
  merchantId?: string | null;
  isTaxDeductible?: boolean;
  taxDeductionType?: 'business' | 'personal' | 'none';
  useCategoryTaxDefault?: boolean;
  debtId?: string | null;
  billInstanceId?: string | null;
  date?: string;
  amount?: string | number;
  description?: string;
  notes?: string | null;
  type?: string;
  isPending?: boolean;
  toAccountId?: string;
  isSalesTaxable?: boolean;
  offlineId?: string | null;
  syncStatus?: 'pending' | 'syncing' | 'synced' | 'error' | 'offline';
  savingsGoalId?: string | null;
  goalContributions?: GoalContribution[];
}

export function validateCreateTransactionBody(body: CreateTransactionBody): Response | null {
  if (!body.accountId || !body.date || !body.amount || !body.description) {
    return Response.json({ error: 'Missing required fields' }, { status: 400 });
  }

  if (body.type === 'transfer' && !body.toAccountId) {
    return Response.json(
      { error: 'Transfer requires a destination account (toAccountId)' },
      { status: 400 }
    );
  }

  if (body.type === 'transfer' && body.toAccountId && body.accountId === body.toAccountId) {
    return Response.json({ error: 'Cannot transfer to the same account' }, { status: 400 });
  }

  return null;
}

