/**
 * API Endpoint: Check if household has business accounts
 *
 * GET /api/accounts/has-business
 * Header: x-household-id (required)
 *
 * Response: { hasBusinessAccounts: boolean }
 *
 * Used by the navigation to conditionally show/hide business features
 * (Tax Dashboard, Sales Tax) based on whether the household has
 * at least one active business account.
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { accounts } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';
import { requireAuth } from '@/lib/auth-helpers';
import {
  getHouseholdIdFromRequest,
  requireHouseholdAuth,
} from '@/lib/api/household-auth';

export async function GET(request: Request) {
  try {
    // Authenticate user
    const { userId } = await requireAuth();

    // Get and verify household access
    const householdId = getHouseholdIdFromRequest(request);
    if (!householdId) {
      return NextResponse.json(
        { error: 'Household ID is required' },
        { status: 400 }
      );
    }

    await requireHouseholdAuth(userId, householdId);

    // Check if any active business account exists in the household
    const businessAccount = await db
      .select({ id: accounts.id })
      .from(accounts)
      .where(
        and(
          eq(accounts.householdId, householdId),
          eq(accounts.isBusinessAccount, true),
          eq(accounts.isActive, true)
        )
      )
      .limit(1);

    return NextResponse.json({
      hasBusinessAccounts: businessAccount.length > 0,
    });
  } catch (error) {
    console.error('[API] Error checking business accounts:', error);

    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      if (error.message.includes('Not a member')) {
        return NextResponse.json(
          { error: 'Unauthorized: Not a member of this household' },
          { status: 403 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

