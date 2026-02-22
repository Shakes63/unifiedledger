import { handleTransactionSearch } from '@/lib/transactions/transaction-search-route-handler';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  return handleTransactionSearch(request);
}
