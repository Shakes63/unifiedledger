#!/usr/bin/env node

/**
 * Manual Debts API Testing Script
 * 
 * This script tests all Debts API endpoints for household isolation.
 * It requires authentication, so it will attempt to sign in first.
 */

import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3000';
const API_BASE = `${BASE_URL}/api/debts`;

// Test credentials (you may need to adjust these)
const TEST_EMAIL = 'test1@example.com';
const TEST_PASSWORD = 'password'; // You'll need to set this

let authCookies = '';

/**
 * Sign in and get authentication cookies
 */
async function signIn() {
  try {
    const response = await fetch(`${BASE_URL}/api/auth/sign-in`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
      }),
    });

    const cookies = response.headers.get('set-cookie');
    if (cookies) {
      authCookies = cookies;
      console.log('✅ Signed in successfully');
      return true;
    }
    
    console.log('❌ Sign in failed - response:', await response.text());
    return false;
  } catch (error) {
    console.error('❌ Sign in error:', error);
    return false;
  }
}

/**
 * Get household IDs for testing
 */
async function getHouseholdIds() {
  try {
    // Try to get households from the API or database
    // For now, we'll need to get these manually
    return {
      householdA: process.env.TEST_HOUSEHOLD_A_ID || null,
      householdB: process.env.TEST_HOUSEHOLD_B_ID || null,
    };
  } catch (error) {
    console.error('Error getting household IDs:', error);
    return { householdA: null, householdB: null };
  }
}

/**
 * Test Case: GET /api/debts
 */
async function testGetDebts(householdId, status = null) {
  const url = new URL(`${API_BASE}`);
  if (status) {
    url.searchParams.set('status', status);
  }
  
  try {
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'x-household-id': householdId || '',
        'Content-Type': 'application/json',
        'Cookie': authCookies,
      },
    });
    
    const data = await response.json();
    
    console.log(`\n📋 GET /api/debts${status ? `?status=${status}` : ''}`);
    console.log(`   Household ID: ${householdId || 'MISSING'}`);
    console.log(`   Status: ${response.status}`);
    console.log(`   Response:`, JSON.stringify(data, null, 2));
    
    // Verify household filtering
    if (response.ok && Array.isArray(data)) {
      const allMatchHousehold = data.every(debt => debt.householdId === householdId);
      console.log(`   ✅ All debts match household: ${allMatchHousehold}`);
      
      if (status) {
        const allMatchStatus = data.every(debt => debt.status === status);
        console.log(`   ✅ All debts match status: ${allMatchStatus}`);
      }
    }
    
    return { response, data, status: response.status };
  } catch (error) {
    console.error('   ❌ Error:', error.message);
    return { error };
  }
}

/**
 * Run all test cases
 */
async function runTests() {
  console.log('🚀 Starting Debts API Endpoint Tests\n');
  console.log('='.repeat(60));
  
  // Sign in first
  console.log('\n1. Signing in...');
  const signedIn = await signIn();
  if (!signedIn) {
    console.log('❌ Cannot proceed without authentication');
    console.log('   Please sign in manually and update TEST_EMAIL and TEST_PASSWORD in this script');
    return;
  }
  
  // Get household IDs
  console.log('\n2. Getting household IDs...');
  const { householdA, householdB } = await getHouseholdIds();
  
  if (!householdA) {
    console.log('⚠️  Household IDs not set. Please set TEST_HOUSEHOLD_A_ID and TEST_HOUSEHOLD_B_ID environment variables');
    console.log('   Or update the getHouseholdIds() function to fetch them from the database');
    return;
  }
  
  console.log(`   Household A: ${householdA}`);
  console.log(`   Household B: ${householdB}`);
  
  // Test 1: GET /api/debts - Valid Household A
  console.log('\n' + '='.repeat(60));
  await testGetDebts(householdA);
  
  // Test 2: GET /api/debts - Valid Household B
  await testGetDebts(householdB);
  
  // Test 3: GET /api/debts - Status filter
  await testGetDebts(householdA, 'active');
  
  // Test 4: GET /api/debts - Missing household ID
  await testGetDebts(null);
  
  // Test 5: GET /api/debts - Invalid household ID
  await testGetDebts('invalid-id');
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ Tests completed!');
}

// Run tests
runTests().catch(console.error);

