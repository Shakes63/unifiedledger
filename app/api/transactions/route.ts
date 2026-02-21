import {
  handleCreateTransaction,
  handleListTransactions,
} from '@/lib/transactions/transaction-route-handlers';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  return handleCreateTransaction(request);
}

export async function GET(request: Request) {
  return handleListTransactions(request);
}
