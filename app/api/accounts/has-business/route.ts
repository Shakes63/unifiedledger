/**
 * API Endpoint: Check if household has business accounts with specific features
 *
 * GET /api/accounts/has-business
 * Header: x-household-id (required)
 *
 * Response: { 
 *   hasBusinessAccounts: boolean,      // Backward compat: true if any business feature is enabled
 *   hasSalesTaxAccounts: boolean,      // True if any account has sales tax tracking enabled
 *   hasTaxDeductionAccounts: boolean   // True if any account has tax deduction tracking enabled
 * }
 *
 * Used by the navigation to conditionally show/hide business features:
 * - Tax Dashboard: shown when hasTaxDeductionAccounts is true
 * - Sales Tax: shown when hasSalesTaxAccounts is true
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { accounts } from '@/lib/db/schema';
import { and, eq, or } from 'drizzle-orm';
import { requireAuth } from '@/lib/auth-helpers';
import {
  getHouseholdIdFromRequest,
  requireHouseholdAuth,
} from '@/lib/api/household-auth';
import { isTestMode, TEST_USER_ID, TEST_HOUSEHOLD_ID, logTestModeWarning } from '@/lib/test-mode';
import { computeBusinessFeatureFlags } from '@/lib/accounts/business-feature-utils';

export async function GET(request: Request) {
  try {
    // Authenticate user
    const { userId } = await requireAuth();

    // Get and verify household access
    const householdId = getHouseholdIdFromRequest(request);

    // Test mode bypass - return no business accounts for test user
    if (isTestMode() && userId === TEST_USER_ID && householdId === TEST_HOUSEHOLD_ID) {
      logTestModeWarning('accounts/has-business');
      return NextResponse.json({
        hasBusinessAccounts: false,
        hasSalesTaxAccounts: false,
        hasTaxDeductionAccounts: false,
      });
    }

    if (!householdId) {
      return NextResponse.json(
        { error: 'Household ID is required' },
        { status: 400 }
      );
    }

    await requireHouseholdAuth(userId, householdId);

    // Query for active accounts with business features enabled
    const activeAccounts = await db
      .select({ 
        id: accounts.id,
        isBusinessAccount: accounts.isBusinessAccount,
        enableSalesTax: accounts.enableSalesTax,
        enableTaxDeductions: accounts.enableTaxDeductions,
      })
      .from(accounts)
      .where(
        and(
          eq(accounts.householdId, householdId),
          eq(accounts.isActive, true),
          // Account has at least one business feature enabled
          or(
            eq(accounts.isBusinessAccount, true),
            eq(accounts.enableSalesTax, true),
            eq(accounts.enableTaxDeductions, true)
          )
        )
      );

    return NextResponse.json(computeBusinessFeatureFlags(activeAccounts));
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
