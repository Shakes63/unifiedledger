#!/usr/bin/env node

/**
 * Debts API Endpoints Testing Helper Script
 * 
 * This script helps test all Debts API endpoints for household isolation.
 * It provides helper functions and test cases that can be run manually.
 * 
 * Usage:
 * 1. Start the dev server: pnpm dev
 * 2. Open browser console on http://localhost:3000
 * 3. Copy and paste test functions from this script
 * 4. Run tests systematically
 * 
 * Or use this script to generate test cases for Postman/curl
 */

const BASE_URL = 'http://localhost:3000';
const API_BASE = `${BASE_URL}/api/debts`;

/**
 * Helper function to get auth token from browser (reserved for future use)
 * Run this in browser console to get your session token
 */
function _getAuthToken() {
  // In browser console, cookies are accessible via document.cookie
  // Better Auth uses cookies, so we need to include credentials
  return null; // Will use credentials: 'include' in fetch
}

/**
 * Helper function to get household ID from current context (reserved for future use)
 * This should be called from the browser where household context is available
 */
function _getCurrentHouseholdId() {
  // In browser, you can get this from localStorage or React context
  // For testing, you'll need to manually provide household IDs
  return null;
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
        'x-household-id': householdId,
        'Content-Type': 'application/json',
      },
      credentials: 'include', // Important for Better Auth cookies
    });
    
    const data = await response.json();
    
    console.log('GET /api/debts Test Results:');
    console.log('Status:', response.status);
    console.log('Response:', data);
    
    // Verify household filtering
    if (response.ok && Array.isArray(data)) {
      const allMatchHousehold = data.every(debt => debt.householdId === householdId);
      console.log('✅ All debts match household:', allMatchHousehold);
      
      if (status) {
        const allMatchStatus = data.every(debt => debt.status === status);
        console.log('✅ All debts match status:', allMatchStatus);
      }
    }
    
    return { response, data };
  } catch (error) {
    console.error('❌ Error:', error);
    return { error };
  }
}

/**
 * Test Case: POST /api/debts
 */
async function testCreateDebt(householdId, debtData) {
  const payload = {
    householdId,
    ...debtData,
  };
  
  try {
    const response = await fetch(`${API_BASE}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    
    const data = await response.json();
    
    console.log('POST /api/debts Test Results:');
    console.log('Status:', response.status);
    console.log('Response:', data);
    
    // Verify household assignment
    if (response.ok && data.householdId) {
      const householdMatches = data.householdId === householdId;
      console.log('✅ Debt created with correct household:', householdMatches);
    }
    
    return { response, data };
  } catch (error) {
    console.error('❌ Error:', error);
    return { error };
  }
}

/**
 * Test Case: GET /api/debts/[id]
 */
async function testGetDebtById(debtId, householdId) {
  try {
    const response = await fetch(`${API_BASE}/${debtId}`, {
      method: 'GET',
      headers: {
        'x-household-id': householdId,
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });
    
    const data = await response.json();
    
    console.log('GET /api/debts/[id] Test Results:');
    console.log('Status:', response.status);
    console.log('Response:', data);
    
    // Verify household filtering
    if (response.ok && data.householdId) {
      const householdMatches = data.householdId === householdId;
      console.log('✅ Debt household matches:', householdMatches);
      
      // Verify payments filtered by household
      if (data.payments && Array.isArray(data.payments)) {
        const paymentsMatchHousehold = data.payments.every(
          payment => payment.householdId === householdId
        );
        console.log('✅ All payments match household:', paymentsMatchHousehold);
      }
    }
    
    return { response, data };
  } catch (error) {
    console.error('❌ Error:', error);
    return { error };
  }
}

/**
 * Test Case: PUT /api/debts/[id]
 */
async function testUpdateDebt(debtId, householdId, updateData) {
  const payload = {
    householdId,
    ...updateData,
  };
  
  try {
    const response = await fetch(`${API_BASE}/${debtId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    
    const data = await response.json();
    
    console.log('PUT /api/debts/[id] Test Results:');
    console.log('Status:', response.status);
    console.log('Response:', data);
    
    return { response, data };
  } catch (error) {
    console.error('❌ Error:', error);
    return { error };
  }
}

/**
 * Test Case: DELETE /api/debts/[id]
 */
async function testDeleteDebt(debtId, householdId) {
  try {
    const response = await fetch(`${API_BASE}/${debtId}`, {
      method: 'DELETE',
      headers: {
        'x-household-id': householdId,
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });
    
    const data = await response.json();
    
    console.log('DELETE /api/debts/[id] Test Results:');
    console.log('Status:', response.status);
    console.log('Response:', data);
    
    return { response, data };
  } catch (error) {
    console.error('❌ Error:', error);
    return { error };
  }
}

/**
 * Test Case: GET /api/debts/[id]/payments
 */
async function testGetDebtPayments(debtId, householdId) {
  try {
    const response = await fetch(`${API_BASE}/${debtId}/payments`, {
      method: 'GET',
      headers: {
        'x-household-id': householdId,
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });
    
    const data = await response.json();
    
    console.log('GET /api/debts/[id]/payments Test Results:');
    console.log('Status:', response.status);
    console.log('Response:', data);
    
    // Verify household filtering
    if (response.ok && Array.isArray(data)) {
      const allMatchHousehold = data.every(
        payment => payment.householdId === householdId
      );
      console.log('✅ All payments match household:', allMatchHousehold);
    }
    
    return { response, data };
  } catch (error) {
    console.error('❌ Error:', error);
    return { error };
  }
}

/**
 * Test Case: POST /api/debts/[id]/payments
 */
async function testCreateDebtPayment(debtId, householdId, paymentData) {
  const payload = {
    householdId,
    ...paymentData,
  };
  
  try {
    const response = await fetch(`${API_BASE}/${debtId}/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    
    const data = await response.json();
    
    console.log('POST /api/debts/[id]/payments Test Results:');
    console.log('Status:', response.status);
    console.log('Response:', data);
    
    return { response, data };
  } catch (error) {
    console.error('❌ Error:', error);
    return { error };
  }
}

/**
 * Test Case: GET /api/debts/stats
 */
async function testGetDebtStats(householdId) {
  try {
    const response = await fetch(`${API_BASE}/stats?householdId=${householdId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });
    
    const data = await response.json();
    
    console.log('GET /api/debts/stats Test Results:');
    console.log('Status:', response.status);
    console.log('Response:', data);
    
    return { response, data };
  } catch (error) {
    console.error('❌ Error:', error);
    return { error };
  }
}

/**
 * Test Case: GET /api/debts/settings
 */
async function testGetDebtSettings(householdId) {
  try {
    const response = await fetch(`${API_BASE}/settings?householdId=${householdId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });
    
    const data = await response.json();
    
    console.log('GET /api/debts/settings Test Results:');
    console.log('Status:', response.status);
    console.log('Response:', data);
    
    return { response, data };
  } catch (error) {
    console.error('❌ Error:', error);
    return { error };
  }
}

/**
 * Test Case: PUT /api/debts/settings
 */
async function testUpdateDebtSettings(householdId, settings) {
  const payload = {
    householdId,
    ...settings,
  };
  
  try {
    const response = await fetch(`${API_BASE}/settings`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    
    const data = await response.json();
    
    console.log('PUT /api/debts/settings Test Results:');
    console.log('Status:', response.status);
    console.log('Response:', data);
    
    return { response, data };
  } catch (error) {
    console.error('❌ Error:', error);
    return { error };
  }
}

/**
 * Test Case: GET /api/debts/payoff-strategy
 */
async function testGetPayoffStrategy(householdId) {
  try {
    const response = await fetch(`${API_BASE}/payoff-strategy?householdId=${householdId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });
    
    const data = await response.json();
    
    console.log('GET /api/debts/payoff-strategy Test Results:');
    console.log('Status:', response.status);
    console.log('Response:', data);
    
    return { response, data };
  } catch (error) {
    console.error('❌ Error:', error);
    return { error };
  }
}

/**
 * Test Case: GET /api/debts/adherence
 */
async function testGetDebtAdherence(householdId) {
  try {
    const response = await fetch(`${API_BASE}/adherence?householdId=${householdId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });
    
    const data = await response.json();
    
    console.log('GET /api/debts/adherence Test Results:');
    console.log('Status:', response.status);
    console.log('Response:', data);
    
    return { response, data };
  } catch (error) {
    console.error('❌ Error:', error);
    return { error };
  }
}

/**
 * Test Case: GET /api/debts/countdown
 */
async function testGetDebtCountdown(householdId) {
  try {
    const response = await fetch(`${API_BASE}/countdown?householdId=${householdId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });
    
    const data = await response.json();
    
    console.log('GET /api/debts/countdown Test Results:');
    console.log('Status:', response.status);
    console.log('Response:', data);
    
    return { response, data };
  } catch (error) {
    console.error('❌ Error:', error);
    return { error };
  }
}

/**
 * Test Case: GET /api/debts/credit-utilization
 */
async function testGetCreditUtilization(householdId) {
  try {
    const response = await fetch(`${API_BASE}/credit-utilization?householdId=${householdId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });
    
    const data = await response.json();
    
    console.log('GET /api/debts/credit-utilization Test Results:');
    console.log('Status:', response.status);
    console.log('Response:', data);
    
    return { response, data };
  } catch (error) {
    console.error('❌ Error:', error);
    return { error };
  }
}

/**
 * Test Case: GET /api/debts/minimum-warning
 */
async function testGetMinimumWarning(householdId) {
  try {
    const response = await fetch(`${API_BASE}/minimum-warning?householdId=${householdId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });
    
    const data = await response.json();
    
    console.log('GET /api/debts/minimum-warning Test Results:');
    console.log('Status:', response.status);
    console.log('Response:', data);
    
    return { response, data };
  } catch (error) {
    console.error('❌ Error:', error);
    return { error };
  }
}

/**
 * Test Case: GET /api/debts/reduction-chart
 */
async function testGetReductionChart(householdId) {
  try {
    const response = await fetch(`${API_BASE}/reduction-chart?householdId=${householdId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });
    
    const data = await response.json();
    
    console.log('GET /api/debts/reduction-chart Test Results:');
    console.log('Status:', response.status);
    console.log('Response:', data);
    
    return { response, data };
  } catch (error) {
    console.error('❌ Error:', error);
    return { error };
  }
}

/**
 * Test Case: GET /api/debts/streak
 */
async function testGetDebtStreak(householdId) {
  try {
    const response = await fetch(`${API_BASE}/streak?householdId=${householdId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });
    
    const data = await response.json();
    
    console.log('GET /api/debts/streak Test Results:');
    console.log('Status:', response.status);
    console.log('Response:', data);
    
    return { response, data };
  } catch (error) {
    console.error('❌ Error:', error);
    return { error };
  }
}

/**
 * Test Case: POST /api/debts/scenarios
 */
async function testGetDebtScenarios(householdId, scenarioData) {
  const payload = {
    householdId,
    ...scenarioData,
  };
  
  try {
    const response = await fetch(`${API_BASE}/scenarios`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    
    const data = await response.json();
    
    console.log('POST /api/debts/scenarios Test Results:');
    console.log('Status:', response.status);
    console.log('Response:', data);
    
    return { response, data };
  } catch (error) {
    console.error('❌ Error:', error);
    return { error };
  }
}

/**
 * Example test suite for GET /api/debts
 * Run this in browser console after setting up test data
 */
async function runGetDebtsTestSuite() {
  console.log('=== Testing GET /api/debts ===\n');
  
  // You'll need to replace these with actual IDs from your test environment
  const householdAId = 'YOUR_HOUSEHOLD_A_ID';
  const householdBId = 'YOUR_HOUSEHOLD_B_ID';
  
  // Test 1: Valid request - Household A
  console.log('Test 1: Valid request - Household A');
  await testGetDebts(householdAId);
  console.log('\n');
  
  // Test 2: Valid request - Household B
  console.log('Test 2: Valid request - Household B');
  await testGetDebts(householdBId);
  console.log('\n');
  
  // Test 3: Status filter
  console.log('Test 3: Status filter - Active debts');
  await testGetDebts(householdAId, 'active');
  console.log('\n');
  
  // Test 4: Missing household ID
  console.log('Test 4: Missing household ID');
  await testGetDebts(null);
  console.log('\n');
  
  // Test 5: Invalid household ID
  console.log('Test 5: Invalid household ID');
  await testGetDebts('invalid-id');
  console.log('\n');
}

// Export functions for use in browser console
if (typeof window !== 'undefined') {
  window.testDebtsAPI = {
    testGetDebts,
    testCreateDebt,
    testGetDebtById,
    testUpdateDebt,
    testDeleteDebt,
    testGetDebtPayments,
    testCreateDebtPayment,
    testGetDebtStats,
    testGetDebtSettings,
    testUpdateDebtSettings,
    testGetPayoffStrategy,
    testGetDebtAdherence,
    testGetDebtCountdown,
    testGetCreditUtilization,
    testGetMinimumWarning,
    testGetReductionChart,
    testGetDebtStreak,
    testGetDebtScenarios,
    runGetDebtsTestSuite,
  };
}

// For Node.js usage (documentation only)
export {
  testGetDebts,
  testCreateDebt,
  testGetDebtById,
  testUpdateDebt,
  testDeleteDebt,
  testGetDebtPayments,
  testCreateDebtPayment,
  testGetDebtStats,
  testGetDebtSettings,
  testUpdateDebtSettings,
  testGetPayoffStrategy,
  testGetDebtAdherence,
  testGetDebtCountdown,
  testGetCreditUtilization,
  testGetMinimumWarning,
  testGetReductionChart,
  testGetDebtStreak,
  testGetDebtScenarios,
};

