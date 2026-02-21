import {
  handleCreateTransfer,
  handleListTransfers,
} from '@/lib/transfers/transfers-route-handlers';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  return handleListTransfers(request);
}

export async function POST(request: Request) {
  return handleCreateTransfer(request);
}
