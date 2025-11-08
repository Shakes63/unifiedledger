import { auth, clerkClient } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { householdMembers } from '@/lib/db/schema';
import { sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

/**
 * POST /api/households/backfill-names
 *
 * Backfills userName for all household members that don't have it set.
 * This is useful for fixing existing data created before the userName field was properly populated.
 */
export async function POST(request: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all household members without userName
    const membersWithoutName = await db
      .select()
      .from(householdMembers)
      .where(sql`${householdMembers.userName} IS NULL OR ${householdMembers.userName} = ''`);

    console.log(`Found ${membersWithoutName.length} household members without userName`);

    let updatedCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    // Update each member
    const clerk = await clerkClient();
    for (const member of membersWithoutName) {
      try {
        // Fetch user info from Clerk
        const user = await clerk.users.getUser(member.userId);

        const userName = user.firstName && user.lastName
          ? `${user.firstName} ${user.lastName}`
          : user.firstName || user.username || '';

        if (userName) {
          // Update the member
          await db
            .update(householdMembers)
            .set({ userName })
            .where(sql`${householdMembers.id} = ${member.id}`);

          updatedCount++;
          console.log(`Updated ${member.userId} with userName: ${userName}`);
        } else {
          errors.push(`No name found for user ${member.userId}`);
          errorCount++;
        }
      } catch (error) {
        console.error(`Error updating member ${member.userId}:`, error);
        errors.push(`Failed to update ${member.userId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        errorCount++;
      }
    }

    return Response.json({
      success: true,
      message: 'Backfill complete',
      stats: {
        total: membersWithoutName.length,
        updated: updatedCount,
        errors: errorCount,
      },
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('Error in backfill-names:', error);
    return Response.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
