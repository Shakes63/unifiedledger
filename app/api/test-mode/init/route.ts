/**
 * Test Mode Initialization API
 *
 * POST /api/test-mode/init
 *
 * Creates the test user, household, and related records in the database
 * if they don't exist. Only works when TEST_MODE=true.
 *
 * This endpoint should be called on first page load to ensure
 * test data exists before any authenticated API calls are made.
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { households, householdMembers, userSettings } from '@/lib/db/schema';
import * as authSchema from '@/auth-schema';
import { eq } from 'drizzle-orm';
import {
  isTestMode,
  TEST_USER_ID,
  TEST_USER_EMAIL,
  TEST_USER_NAME,
  TEST_HOUSEHOLD_ID,
  TEST_HOUSEHOLD_NAME,
  TEST_SESSION_TOKEN,
  TEST_SESSION_ID,
  logTestModeWarning,
} from '@/lib/test-mode';

export const dynamic = 'force-dynamic';

export async function POST() {
  // Check if test mode is enabled
  if (!isTestMode()) {
    return NextResponse.json(
      { error: 'Test mode is not enabled' },
      { status: 403 }
    );
  }

  logTestModeWarning('test-mode/init endpoint');

  try {
    const now = new Date();
    let alreadyExists = false;

    // Check and create test user if needed
    const existingUser = await db
      .select()
      .from(authSchema.user)
      .where(eq(authSchema.user.id, TEST_USER_ID))
      .get();

    if (existingUser) {
      alreadyExists = true;
    } else {
      try {
        await db.insert(authSchema.user).values({
          id: TEST_USER_ID,
          name: TEST_USER_NAME,
          email: TEST_USER_EMAIL,
          emailVerified: true,
          isApplicationOwner: true,
          createdAt: now,
          updatedAt: now,
        });
      } catch (err) {
        // Ignore duplicate key errors - another request may have created it
        console.log('[Test Mode] User insert error (may be duplicate):', err);
      }
    }

    // Check and create account record if needed
    const existingAccount = await db
      .select()
      .from(authSchema.account)
      .where(eq(authSchema.account.id, 'test-account-001'))
      .get();

    if (!existingAccount) {
      try {
        await db.insert(authSchema.account).values({
          id: 'test-account-001',
          accountId: TEST_USER_ID,
          providerId: 'credential',
          userId: TEST_USER_ID,
          password: null,
          createdAt: now,
          updatedAt: now,
        });
      } catch (err) {
        console.log('[Test Mode] Account insert error (may be duplicate):', err);
      }
    }

    // Ensure test session exists and is valid
    await ensureTestSession();

    // Check and create test household if needed
    const existingHousehold = await db
      .select()
      .from(households)
      .where(eq(households.id, TEST_HOUSEHOLD_ID))
      .get();

    if (!existingHousehold) {
      try {
        await db.insert(households).values({
          id: TEST_HOUSEHOLD_ID,
          name: TEST_HOUSEHOLD_NAME,
          createdBy: TEST_USER_ID,
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
        });
      } catch (err) {
        console.log('[Test Mode] Household insert error (may be duplicate):', err);
      }
    }

    // Check and create household membership if needed
    const existingMembership = await db
      .select()
      .from(householdMembers)
      .where(eq(householdMembers.id, 'test-membership-001'))
      .get();

    if (!existingMembership) {
      try {
        await db.insert(householdMembers).values({
          id: 'test-membership-001',
          householdId: TEST_HOUSEHOLD_ID,
          userId: TEST_USER_ID,
          userEmail: TEST_USER_EMAIL,
          userName: TEST_USER_NAME,
          role: 'owner',
          joinedAt: now.toISOString(),
          isActive: true,
          isFavorite: true,
        });
      } catch (err) {
        console.log('[Test Mode] Membership insert error (may be duplicate):', err);
      }
    }

    // Check and create user settings if needed
    const existingSettings = await db
      .select()
      .from(userSettings)
      .where(eq(userSettings.id, 'test-settings-001'))
      .get();

    if (!existingSettings) {
      try {
        await db.insert(userSettings).values({
          id: 'test-settings-001',
          userId: TEST_USER_ID,
          displayName: TEST_USER_NAME,
          defaultHouseholdId: TEST_HOUSEHOLD_ID,
          onboardingCompleted: true,
          developerMode: true,
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
        });
      } catch (err) {
        console.log('[Test Mode] Settings insert error (may be duplicate):', err);
      }
    }

    return NextResponse.json({
      message: alreadyExists ? 'Test mode already initialized' : 'Test mode initialized successfully',
      userId: TEST_USER_ID,
      householdId: TEST_HOUSEHOLD_ID,
      alreadyExists,
    });
  } catch (error) {
    console.error('[Test Mode] Failed to initialize:', error);
    return NextResponse.json(
      { error: 'Failed to initialize test mode' },
      { status: 500 }
    );
  }
}

/**
 * Ensure a valid test session exists in the database
 * Creates or updates the session with a far-future expiration
 */
async function ensureTestSession() {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000); // 1 year from now

  // Check if session exists
  const existingSession = await db
    .select()
    .from(authSchema.session)
    .where(eq(authSchema.session.id, TEST_SESSION_ID))
    .get();

  if (existingSession) {
    // Update existing session
    await db
      .update(authSchema.session)
      .set({
        expiresAt,
        updatedAt: now,
        lastActivityAt: now,
      })
      .where(eq(authSchema.session.id, TEST_SESSION_ID));
  } else {
    // Create new session
    await db.insert(authSchema.session).values({
      id: TEST_SESSION_ID,
      token: TEST_SESSION_TOKEN,
      userId: TEST_USER_ID,
      expiresAt,
      createdAt: now,
      updatedAt: now,
      lastActivityAt: now,
      rememberMe: true,
    });
  }
}

/**
 * GET endpoint to check test mode status
 *
 * Returns whether test mode is enabled (safe for client-side checks)
 */
export async function GET() {
  return NextResponse.json({
    testMode: isTestMode(),
  });
}

