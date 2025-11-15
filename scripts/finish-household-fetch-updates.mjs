#!/usr/bin/env node

/**
 * Script to complete the remaining useHouseholdFetch updates for 2 files:
 * 1. components/dashboard/recent-transactions.tsx
 * 2. components/transactions/transaction-history.tsx
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const BASE_DIR = '/Users/jacobneudorf/Documents/coding/javascript/nextjs/unifiedledger';

// File 1: components/dashboard/recent-transactions.tsx
const file1Path = join(BASE_DIR, 'components/dashboard/recent-transactions.tsx');
let file1 = readFileSync(file1Path, 'utf8');

// Add hook initialization
file1 = file1.replace(
  /export function RecentTransactions\(\) \{\n  const \[transactions/,
  `export function RecentTransactions() {
  const { fetchWithHousehold, postWithHousehold, selectedHouseholdId } = useHouseholdFetch();
  const [transactions`
);

// Add household check in useEffect
file1 = file1.replace(
  /(const fetchData = async \(\) => \{\n\s+try \{)/,
  `if (!selectedHouseholdId) {
      setLoading(false);
      return;
    }

    $1`
);

// Replace fetch calls
file1 = file1.replace(
  /const txResponse = await fetch\('\/api\/transactions\?limit=50', \{ credentials: 'include' \}\);/,
  `const txResponse = await fetchWithHousehold('/api/transactions?limit=50');`
);

file1 = file1.replace(
  /const merchantsResponse = await fetch\('\/api\/merchants', \{ credentials: 'include' \}\);/,
  `const merchantsResponse = await fetchWithHousehold('/api/merchants');`
);

file1 = file1.replace(
  /const accountsResponse = await fetch\('\/api\/accounts', \{ credentials: 'include' \}\);/,
  `const accountsResponse = await fetchWithHousehold('/api/accounts');`
);

file1 = file1.replace(
  /const categoriesResponse = await fetch\('\/api\/categories', \{ credentials: 'include' \}\);/,
  `const categoriesResponse = await fetchWithHousehold('/api/categories');`
);

// Update useEffect dependencies
file1 = file1.replace(
  /}, \[selectedAccountId\]\);/,
  `}, [selectedAccountId, selectedHouseholdId, fetchWithHousehold]);`
);

// Replace POST call for repeat transaction
file1 = file1.replace(
  /const response = await fetch\('\/api\/transactions', \{\n\s+method: 'POST',\n\s+headers: \{ 'Content-Type': 'application\/json' \},\n\s+body: JSON\.stringify\(\{/,
  `const response = await postWithHousehold('/api/transactions', {`
);

// Remove the extra closing for the old fetch format
file1 = file1.replace(/\}\),\n\s+\}\);/, '});');

writeFileSync(file1Path, file1);
console.log('✓ Updated components/dashboard/recent-transactions.tsx');

// File 2: components/transactions/transaction-history.tsx
const file2Path = join(BASE_DIR, 'components/transactions/transaction-history.tsx');
let file2 = readFileSync(file2Path, 'utf8');

// Add hook initialization
file2 = file2.replace(
  /export function TransactionHistory\(\{[^}]+\}: TransactionHistoryProps\) \{\n  const \[transactions/,
  (match) => match.replace(
    /) {/,
    `) {
  const { fetchWithHousehold, postWithHousehold, selectedHouseholdId } = useHouseholdFetch();`
  )
);

// Add household check
file2 = file2.replace(
  /(const fetchTransactions = async \(\) => \{\n\s+try \{)/,
  `if (!selectedHouseholdId) {
      setLoading(false);
      return;
    }

    $1`
);

// Replace fetch calls
file2 = file2.replace(
  /const response = await fetch\(url\);/,
  `const response = await fetchWithHousehold(url);`
);

file2 = file2.replace(
  /const response = await fetch\('\/api\/transactions\/repeat', \{\n\s+method: 'POST',\n\s+headers: \{ 'Content-Type': 'application\/json' \},\n\s+body: JSON\.stringify\(\{/,
  `const response = await postWithHousehold('/api/transactions/repeat', {`
);

// Remove extra closing
file2 = file2.replace(/transactionId,\n\s+\}\),\n\s+\}\);/, 'transactionId,\n      });');

// Update useEffect dependencies
file2 = file2.replace(
  /}, \[transactionId\]\);/,
  `}, [transactionId, selectedHouseholdId, fetchWithHousehold]);`
);

writeFileSync(file2Path, file2);
console.log('✓ Updated components/transactions/transaction-history.tsx');

console.log('\n========================================');
console.log('All household fetch updates complete!');
console.log('========================================\n');
