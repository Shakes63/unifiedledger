import { auth } from '@clerk/nextjs/server';
import { getUserPermissions, isMemberOfHousehold } from '@/lib/household/permissions';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ householdId: string }> }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { householdId } = await params;

    // Verify user is a member
    if (!(await isMemberOfHousehold(householdId, userId))) {
      return Response.json(
        { error: 'Not a member of this household' },
        { status: 403 }
      );
    }

    // Get permissions
    const permissions = await getUserPermissions(householdId, userId);

    return Response.json(permissions);
  } catch (error) {
    console.error('Error fetching permissions:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
