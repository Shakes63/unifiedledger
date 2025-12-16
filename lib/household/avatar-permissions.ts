import { db } from "@/lib/db";
import { householdMembers } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { isTestMode, TEST_HOUSEHOLD_ID, TEST_USER_ID } from "@/lib/test-mode";

/**
 * Returns true if requester and target share at least one household.
 */
export async function shareAHousehold(requesterUserId: string, targetUserId: string): Promise<boolean> {
  if (requesterUserId === targetUserId) return true;

  // Test mode bypass
  if (isTestMode() && requesterUserId === TEST_USER_ID) return true;
  if (isTestMode() && targetUserId === TEST_USER_ID) return true;

  // If test mode is on, treat all users as sharing the test household.
  // (Keeps component/integration tests stable.)
  if (isTestMode()) {
    const member = await db
      .select({ id: householdMembers.id })
      .from(householdMembers)
      .where(
        and(eq(householdMembers.householdId, TEST_HOUSEHOLD_ID), eq(householdMembers.userId, requesterUserId))
      )
      .limit(1);
    if (member.length > 0) return true;
  }

  const requesterHouseholds = await db
    .select({ householdId: householdMembers.householdId })
    .from(householdMembers)
    .where(eq(householdMembers.userId, requesterUserId));

  if (requesterHouseholds.length === 0) return false;

  // Check membership in any of the requester's households.
  for (const { householdId } of requesterHouseholds) {
    const match = await db
      .select({ id: householdMembers.id })
      .from(householdMembers)
      .where(and(eq(householdMembers.householdId, householdId), eq(householdMembers.userId, targetUserId)))
      .limit(1);
    if (match.length > 0) return true;
  }

  return false;
}


