import {
  handleGetHouseholdSettings,
  handleResetHouseholdSettings,
  handleUpdateHouseholdSettings,
} from '@/lib/household/household-settings-route-handlers';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ householdId: string }> }
) {
  const { householdId } = await params;
  return handleGetHouseholdSettings(request, householdId);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ householdId: string }> }
) {
  const { householdId } = await params;
  return handleUpdateHouseholdSettings(request, householdId);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ householdId: string }> }
) {
  const { householdId } = await params;
  return handleResetHouseholdSettings(request, householdId);
}
