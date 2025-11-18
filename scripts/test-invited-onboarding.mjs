#!/usr/bin/env node

/**
 * Test script for Invited User Onboarding feature
 * Tests the complete flow from invitation creation to demo data generation
 */

const BASE_URL = process.env.TEST_URL || 'http://localhost:3000';

// Test helper functions
async function fetchWithCredentials(url, options = {}) {
  return fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
}

async function testInvitationCreation(householdId, email, authCookie) {
  console.log('\n📧 Test: Creating invitation...');
  try {
    const response = await fetchWithCredentials(
      `${BASE_URL}/api/households/${householdId}/invitations`,
      {
        method: 'POST',
        headers: {
          Cookie: authCookie,
        },
        body: JSON.stringify({
          invitedEmail: email,
          role: 'member',
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create invitation');
    }

    const data = await response.json();
    console.log('✅ Invitation created successfully');
    console.log(`   Token: ${data.invitationToken}`);
    console.log(`   ID: ${data.id}`);
    return data;
  } catch (error) {
    console.error('❌ Failed to create invitation:', error.message);
    throw error;
  }
}

async function testGetInvitation(token) {
  console.log('\n🔍 Test: Getting invitation details...');
  try {
    const response = await fetch(`${BASE_URL}/api/invitations/${token}`, {
      credentials: 'include',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to get invitation');
    }

    const data = await response.json();
    console.log('✅ Invitation retrieved successfully');
    console.log(`   Household: ${data.householdName || 'N/A'}`);
    console.log(`   Invited By: ${data.invitedByName || 'N/A'}`);
    console.log(`   Status: ${data.status}`);
    console.log(`   Expires: ${data.expiresAt}`);
    return data;
  } catch (error) {
    console.error('❌ Failed to get invitation:', error.message);
    throw error;
  }
}

async function testDemoDataGeneration(householdId, authCookie) {
  console.log('\n🎲 Test: Generating demo data...');
  try {
    const response = await fetchWithCredentials(
      `${BASE_URL}/api/onboarding/generate-demo-data`,
      {
        method: 'POST',
        headers: {
          Cookie: authCookie,
        },
        body: JSON.stringify({ householdId }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to generate demo data');
    }

    const data = await response.json();
    console.log('✅ Demo data generated successfully');
    console.log(`   Accounts: ${data.accountsCreated}`);
    console.log(`   Categories: ${data.categoriesCreated}`);
    console.log(`   Merchants: ${data.merchantsCreated}`);
    console.log(`   Bills: ${data.billsCreated}`);
    console.log(`   Goals: ${data.goalsCreated}`);
    console.log(`   Debts: ${data.debtsCreated}`);
    console.log(`   Transactions: ${data.transactionsCreated}`);
    return data;
  } catch (error) {
    console.error('❌ Failed to generate demo data:', error.message);
    throw error;
  }
}

async function testOnboardingStatus(authCookie) {
  console.log('\n📊 Test: Checking onboarding status...');
  try {
    const response = await fetchWithCredentials(
      `${BASE_URL}/api/user/onboarding/status`,
      {
        headers: {
          Cookie: authCookie,
        },
      }
    );

    if (!response.ok) {
      throw new Error('Failed to get onboarding status');
    }

    const data = await response.json();
    console.log('✅ Onboarding status retrieved');
    console.log(`   Completed: ${data.onboardingCompleted}`);
    return data;
  } catch (error) {
    console.error('❌ Failed to get onboarding status:', error.message);
    throw error;
  }
}

// Main test function
async function runTests() {
  console.log('🧪 Starting Invited User Onboarding Tests\n');
  console.log('=' .repeat(60));

  // Note: These tests require manual setup:
  // 1. A valid household ID
  // 2. An authenticated user session cookie
  // 3. A test email address

  console.log('\n⚠️  Manual Testing Required');
  console.log('This script tests API endpoints only.');
  console.log('For full end-to-end testing, please:');
  console.log('1. Start the dev server: pnpm dev');
  console.log('2. Sign in to the application');
  console.log('3. Create a household');
  console.log('4. Create an invitation for a test email');
  console.log('5. Use the invitation token to test the sign-up flow');
  console.log('6. Verify onboarding flow with demo mode');
  console.log('\nSee docs/invited-user-onboarding-test-plan.md for detailed test cases.');

  console.log('\n' + '='.repeat(60));
  console.log('✅ Test script ready');
  console.log('📝 See test plan: docs/invited-user-onboarding-test-plan.md');
}

// Run tests
runTests().catch(console.error);

