import { handleCreateAccount, handleListAccounts } from '@/lib/accounts/account-route-handlers';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  return handleListAccounts(request);
}

export async function POST(request: Request) {
  return handleCreateAccount(request);
}
