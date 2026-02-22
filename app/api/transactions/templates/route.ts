import {
  handleCreateTransactionTemplate,
  handleListTransactionTemplates,
} from '@/lib/transactions/transaction-template-collection-route-handler';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  return handleListTransactionTemplates(request);
}

export async function POST(request: Request) {
  return handleCreateTransactionTemplate(request);
}
