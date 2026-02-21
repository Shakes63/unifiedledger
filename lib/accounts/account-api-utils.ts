import { requireAuth } from '@/lib/auth-helpers';
import { getHouseholdIdFromRequest, requireHouseholdAuth } from '@/lib/api/household-auth';

export async function requireAccountsHousehold(request: Request) {
  const { userId } = await requireAuth();
  const householdId = getHouseholdIdFromRequest(request);
  await requireHouseholdAuth(userId, householdId);

  if (!householdId) {
    throw new Error('Household ID is required');
  }

  return { userId, householdId };
}

export function accountApiErrorResponse(error: unknown, logLabel: string) {
  if (error instanceof Error && error.message === 'Unauthorized') {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (error instanceof Error && (error.message.includes('Household') || error.message.includes('member'))) {
    return Response.json({ error: error.message }, { status: 403 });
  }
  if (error instanceof Error && error.message === 'Household ID is required') {
    return Response.json({ error: error.message }, { status: 400 });
  }
  console.error(logLabel, error);
  return Response.json({ error: 'Internal server error' }, { status: 500 });
}

export function buildDisambiguatedAccountNameMap(accounts: Array<{ id: string; name: string }>) {
  const nameCounts = new Map<string, number>();
  for (const acc of accounts) {
    nameCounts.set(acc.name, (nameCounts.get(acc.name) || 0) + 1);
  }

  const displayName = new Map<string, string>();
  for (const acc of accounts) {
    const count = nameCounts.get(acc.name) || 0;
    displayName.set(acc.id, count > 1 ? `${acc.name} (${acc.id.slice(0, 4)})` : acc.name);
  }
  return displayName;
}
