#!/usr/bin/env node
/**
 * Add Sales Tax Test Data
 * 
 * Creates sales tax test data for the TEST_MODE user:
 * 1. Updates sales tax settings with a tax rate and jurisdiction
 * 2. Creates income transactions with isSalesTaxable = true
 * 
 * Run with: node scripts/add-sales-tax-test-data.mjs
 */

import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';

// Test mode constants
const TEST_USER_ID = 'test-user-001';
const TEST_HOUSEHOLD_ID = 'test-household-001';

// Connect to database
const db = new Database('./sqlite.db');

console.log('🚀 Adding sales tax test data...\n');

// Helper to get random float
function randomFloat(min, max, decimals = 2) {
  return parseFloat((Math.random() * (max - min) + min).toFixed(decimals));
}

// Helper to get random date in range
function randomDate(start, end) {
  const date = new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
  return date.toISOString().split('T')[0];
}

try {
  // Step 1: Check if user exists
  const user = db.prepare('SELECT id FROM user WHERE id = ?').get(TEST_USER_ID);
  if (!user) {
    console.error('❌ Test user not found. Run the app in TEST_MODE first to initialize test data.');
    process.exit(1);
  }

  // Step 2: Check for existing sales tax settings
  const existingSettings = db.prepare('SELECT id FROM sales_tax_settings WHERE user_id = ?').get(TEST_USER_ID);
  
  if (existingSettings) {
    // Update existing settings
    console.log('📝 Updating existing sales tax settings...');
    db.prepare(`
      UPDATE sales_tax_settings 
      SET default_rate = ?, jurisdiction = ?, filing_frequency = ?, updated_at = ?
      WHERE user_id = ?
    `).run(8.5, 'California', 'quarterly', new Date().toISOString(), TEST_USER_ID);
  } else {
    // Create new settings
    console.log('➕ Creating sales tax settings...');
    db.prepare(`
      INSERT INTO sales_tax_settings (id, user_id, default_rate, jurisdiction, filing_frequency, enable_tracking, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      uuidv4(),
      TEST_USER_ID,
      8.5,
      'California',
      'quarterly',
      1,
      new Date().toISOString(),
      new Date().toISOString()
    );
  }
  console.log('✅ Sales tax settings: 8.5% California (quarterly filing)\n');

  // Step 3: Get test account ID
  let accountId = db.prepare(`
    SELECT id FROM accounts 
    WHERE user_id = ? AND household_id = ? 
    ORDER BY created_at ASC 
    LIMIT 1
  `).get(TEST_USER_ID, TEST_HOUSEHOLD_ID)?.id;

  if (!accountId) {
    // Create a default account if none exists
    accountId = uuidv4();
    console.log('➕ Creating test account...');
    db.prepare(`
      INSERT INTO accounts (id, user_id, household_id, name, type, current_balance, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      accountId,
      TEST_USER_ID,
      TEST_HOUSEHOLD_ID,
      'Business Account',
      'checking',
      5000,
      1,
      new Date().toISOString(),
      new Date().toISOString()
    );
  }

  // Step 4: Get or create a sales category
  let salesCategoryId = db.prepare(`
    SELECT id FROM budget_categories 
    WHERE user_id = ? AND household_id = ? AND name LIKE '%Sales%'
    LIMIT 1
  `).get(TEST_USER_ID, TEST_HOUSEHOLD_ID)?.id;

  if (!salesCategoryId) {
    salesCategoryId = uuidv4();
    console.log('➕ Creating Sales Revenue category...');
    db.prepare(`
      INSERT INTO budget_categories (id, user_id, household_id, name, type, monthly_budget, is_active, sort_order, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      salesCategoryId,
      TEST_USER_ID,
      TEST_HOUSEHOLD_ID,
      'Sales Revenue',
      'income',
      10000,
      1,
      0,
      new Date().toISOString()
    );
  }

  // Step 5: Create taxable sales transactions across multiple quarters
  console.log('📝 Creating taxable sales transactions...\n');

  // Generate dates for Q1-Q4 2025
  const now = new Date();
  const currentYear = now.getFullYear();
  
  const quarterDates = [
    { q: 1, start: new Date(currentYear, 0, 1), end: new Date(currentYear, 2, 31) },
    { q: 2, start: new Date(currentYear, 3, 1), end: new Date(currentYear, 5, 30) },
    { q: 3, start: new Date(currentYear, 6, 1), end: new Date(currentYear, 8, 30) },
    { q: 4, start: new Date(currentYear, 9, 1), end: new Date(currentYear, 11, 31) },
  ];

  // Sales transaction templates
  const salesTemplates = [
    { description: 'Product Sale - Widget A', amountRange: [150, 500] },
    { description: 'Product Sale - Widget B', amountRange: [75, 250] },
    { description: 'Service Fee - Consultation', amountRange: [200, 800] },
    { description: 'Online Sale - E-commerce', amountRange: [50, 350] },
    { description: 'Wholesale Order', amountRange: [500, 2000] },
  ];

  let totalTransactions = 0;
  let totalSales = 0;

  const insertTransaction = db.prepare(`
    INSERT INTO transactions (id, user_id, household_id, account_id, category_id, date, amount, description, type, is_sales_taxable, is_pending, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const quarter of quarterDates) {
    // Only create transactions for quarters up to current date
    if (quarter.start > now) continue;
    
    // Adjust end date if in current quarter
    const endDate = quarter.end > now ? now : quarter.end;
    
    // Create 5-10 transactions per quarter
    const transactionCount = Math.floor(Math.random() * 6) + 5;
    
    console.log(`  Q${quarter.q} ${currentYear}:`);
    
    let quarterTotal = 0;
    for (let i = 0; i < transactionCount; i++) {
      const template = salesTemplates[Math.floor(Math.random() * salesTemplates.length)];
      const amount = randomFloat(template.amountRange[0], template.amountRange[1]);
      const date = randomDate(quarter.start, endDate);
      
      insertTransaction.run(
        uuidv4(),
        TEST_USER_ID,
        TEST_HOUSEHOLD_ID,
        accountId,
        salesCategoryId,
        date,
        amount,
        template.description,
        'income',
        1, // is_sales_taxable = true
        0, // not pending
        date + 'T12:00:00.000Z',
        date + 'T12:00:00.000Z'
      );

      totalTransactions++;
      quarterTotal += amount;
      totalSales += amount;
    }
    
    const quarterTax = quarterTotal * 0.085;
    console.log(`    - ${transactionCount} transactions, $${quarterTotal.toFixed(2)} sales, $${quarterTax.toFixed(2)} tax due`);
  }

  console.log(`\n✅ Created ${totalTransactions} taxable sales transactions`);
  console.log(`   Total Sales: $${totalSales.toFixed(2)}`);
  console.log(`   Estimated Tax (8.5%): $${(totalSales * 0.085).toFixed(2)}`);

  // Step 6: Create a few non-taxable income transactions for comparison
  console.log('\n📝 Creating non-taxable income transactions for comparison...');
  
  const nonTaxableTemplates = [
    { description: 'Interest Income', amountRange: [10, 50] },
    { description: 'Refund Received', amountRange: [25, 100] },
    { description: 'Gift Received', amountRange: [50, 200] },
  ];

  for (let i = 0; i < 5; i++) {
    const template = nonTaxableTemplates[Math.floor(Math.random() * nonTaxableTemplates.length)];
    const amount = randomFloat(template.amountRange[0], template.amountRange[1]);
    const date = randomDate(new Date(currentYear, 0, 1), now);
    
    insertTransaction.run(
      uuidv4(),
      TEST_USER_ID,
      TEST_HOUSEHOLD_ID,
      accountId,
      salesCategoryId,
      date,
      amount,
      template.description,
      'income',
      0, // is_sales_taxable = false (not taxable)
      0,
      date + 'T12:00:00.000Z',
      date + 'T12:00:00.000Z'
    );
  }
  console.log('✅ Created 5 non-taxable income transactions\n');

  console.log('🎉 Sales tax test data added successfully!');
  console.log('\n📋 Next steps:');
  console.log('   1. Navigate to /dashboard/sales-tax in the browser');
  console.log('   2. You should see the 8.5% California tax rate configured');
  console.log('   3. Quarterly reports should show sales totals and tax due');

} catch (error) {
  console.error('❌ Error adding test data:', error);
  process.exit(1);
} finally {
  db.close();
}



















