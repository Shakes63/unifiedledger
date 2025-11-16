import { db } from '@/lib/db';
import { userHouseholdPreferences } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

/**
 * Get the combined transfer view preference for a user in a household
 * 
 * @param userId - The user's ID
 * @param householdId - The household's ID
 * @returns Promise<boolean> - true if combined view (default), false if separate view
 */
export async function getCombinedTransferViewPreference(
  userId: string,
  householdId: string
): Promise<boolean> {
  try {
    const preferences = await db
      .select({ combinedTransferView: userHouseholdPreferences.combinedTransferView })
      .from(userHouseholdPreferences)
      .where(
        and(
          eq(userHouseholdPreferences.userId, userId),
          eq(userHouseholdPreferences.householdId, householdId)
        )
      )
      .limit(1);

    // If no preferences found, return default (true = combined view)
    if (!preferences || preferences.length === 0) {
      console.log('[Transfer View Preference] No preferences found, defaulting to TRUE (combined view)');
      return true;
    }

    // Get the preference value
    const value = preferences[0].combinedTransferView;
    
    // Debug logging to help diagnose issues
    console.log('[Transfer View Preference] Raw value from DB:', value, 'Type:', typeof value, 'userId:', userId, 'householdId:', householdId);
    
    // Drizzle with { mode: 'boolean' } should convert 0/1 to false/true
    // But handle edge cases explicitly to ensure robust conversion
    if (value === null || value === undefined) {
      console.log('[Transfer View Preference] Value is null/undefined, defaulting to TRUE (combined)');
      return true; // Default to combined view
    }
    
    // Explicitly check for false/0 to ensure separate view works
    // This handles both boolean (false) and integer (0) cases
    // Note: In SQLite, false is stored as 0, true as 1
    // Drizzle with { mode: 'boolean' } converts these automatically, but we'll be explicit
    if (value === false || value === 0 || value === '0') {
      console.log('[Transfer View Preference] Value is false/0/"0", returning FALSE (separate view - show both transfer_out and transfer_in)');
      return false; // Separate view - show both transfer_out and transfer_in
    }
    
    // Any truthy value (true, 1, "1") means combined view - show only transfer_out
    console.log('[Transfer View Preference] Value is truthy (true/1/"1"), returning TRUE (combined view - filter out transfer_in)');
    return true;
  } catch (error) {
    console.error('[Transfer View Preference] Error fetching preference:', error);
    // Return default on error
    return true;
  }
}

