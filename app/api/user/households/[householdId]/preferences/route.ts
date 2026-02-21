import {
  handleGetUserHouseholdPreferences,
  handleResetUserHouseholdPreferences,
  handleUpdateUserHouseholdPreferences,
} from '@/lib/household/user-household-preferences-route-handlers';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ householdId: string }> }
) {
  const { householdId } = await params;
  return handleGetUserHouseholdPreferences(request, householdId);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ householdId: string }> }
) {
  const { householdId } = await params;
  return handleUpdateUserHouseholdPreferences(request, householdId);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ householdId: string }> }
) {
  const { householdId } = await params;
  return handleResetUserHouseholdPreferences(request, householdId);
}
