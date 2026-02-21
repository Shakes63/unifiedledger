import { handleRepeatTransaction } from '@/lib/transactions/transaction-repeat-route-handler';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  return handleRepeatTransaction(request);
}
