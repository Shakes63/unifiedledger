#!/usr/bin/env node
/**
 * Add Tax Deduction Test Data
 * 
 * Creates tax-deductible test data for the TEST_MODE user:
 * 1. Creates tax categories (Schedule A, Schedule C, etc.)
 * 2. Creates expense transactions
 * 3. Creates transaction_tax_classifications linking them
 * 
 * Run with: node scripts/add-tax-test-data.mjs
 */

import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';

// Test mode constants
const TEST_USER_ID = 'test-user-001';
const TEST_HOUSEHOLD_ID = 'test-household-001';

// Connect to database
const db = new Database('./sqlite.db');

console.log('🚀 Adding tax deduction test data...\n');

// Helper to get random float
function randomFloat(min, max, decimals = 2) {
  return parseFloat((Math.random() * (max - min) + min).toFixed(decimals));
}

function toLocalDateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Helper to get random date in range
function randomDate(start, end) {
  const date = new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
  return toLocalDateString(date);
}

try {
  // Step 1: Check if user exists
  const user = db.prepare('SELECT id FROM user WHERE id = ?').get(TEST_USER_ID);
  if (!user) {
    console.error('❌ Test user not found. Run the app in TEST_MODE first to initialize test data.');
    process.exit(1);
  }

  // Step 2: Get account ID
  let accountId = db.prepare(`
    SELECT id FROM accounts 
    WHERE user_id = ? AND household_id = ? 
    ORDER BY created_at ASC 
    LIMIT 1
  `).get(TEST_USER_ID, TEST_HOUSEHOLD_ID)?.id;

  if (!accountId) {
    accountId = uuidv4();
    console.log('➕ Creating test account...');
    db.prepare(`
      INSERT INTO accounts (id, user_id, household_id, name, type, current_balance, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      accountId,
      TEST_USER_ID,
      TEST_HOUSEHOLD_ID,
      'Main Checking',
      'checking',
      5000,
      1,
      new Date().toISOString(),
      new Date().toISOString()
    );
  }

  // Step 3: Create tax categories (IRS form-based categories)
  console.log('📝 Creating tax categories...\n');
  
  const taxCategoriesData = [
    // Schedule C - Business expenses
    { name: 'Office Expense', formType: 'schedule_c', lineNumber: '18', category: 'business_expense', deductible: true },
    { name: 'Car and Truck Expenses', formType: 'schedule_c', lineNumber: '9', category: 'business_expense', deductible: true },
    { name: 'Travel Expenses', formType: 'schedule_c', lineNumber: '24a', category: 'business_expense', deductible: true },
    { name: 'Business Supplies', formType: 'schedule_c', lineNumber: '22', category: 'business_expense', deductible: true },
    // Schedule A - Itemized deductions
    { name: 'Medical and Dental Expenses', formType: 'schedule_a', lineNumber: '1', category: 'personal_deduction', deductible: true },
    { name: 'Charitable Contributions', formType: 'schedule_a', lineNumber: '11', category: 'personal_deduction', deductible: true },
    // Form 1040 - Income
    { name: 'Interest Income', formType: 'form_1040', lineNumber: '2b', category: 'investment_income', deductible: false },
  ];

  const taxCategoryIds = {};
  
  for (const cat of taxCategoriesData) {
    // Check if tax category exists
    let existingCat = db.prepare(`
      SELECT id FROM tax_categories WHERE name = ?
    `).get(cat.name);
    
    if (existingCat) {
      taxCategoryIds[cat.name] = existingCat.id;
      console.log(`  ✅ Found existing tax category: ${cat.name}`);
    } else {
      const id = uuidv4();
      db.prepare(`
        INSERT INTO tax_categories (id, name, form_type, line_number, category, deductible, is_active, sort_order, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        cat.name,
        cat.formType,
        cat.lineNumber,
        cat.category,
        cat.deductible ? 1 : 0,
        1,
        0,
        new Date().toISOString()
      );
      taxCategoryIds[cat.name] = id;
      console.log(`  ➕ Created tax category: ${cat.name} (${cat.formType} Line ${cat.lineNumber})`);
    }
  }

  // Step 4: Create budget category for expenses
  let expenseCategoryId = db.prepare(`
    SELECT id FROM budget_categories 
    WHERE user_id = ? AND household_id = ? AND name = 'Tax Deductible Expenses'
  `).get(TEST_USER_ID, TEST_HOUSEHOLD_ID)?.id;
  
  if (!expenseCategoryId) {
    expenseCategoryId = uuidv4();
    db.prepare(`
      INSERT INTO budget_categories (id, user_id, household_id, name, type, monthly_budget, is_active, is_tax_deductible, sort_order, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      expenseCategoryId,
      TEST_USER_ID,
      TEST_HOUSEHOLD_ID,
      'Tax Deductible Expenses',
      'variable_expense',
      1000,
      1,
      1,
      0,
      new Date().toISOString()
    );
    console.log('\n➕ Created budget category: Tax Deductible Expenses');
  }

  // Step 5: Create expense transactions and tax classifications
  console.log('\n📝 Creating tax-classified transactions...\n');

  const now = new Date();
  const currentYear = now.getFullYear();
  const startOfYear = new Date(currentYear, 0, 1);

  const transactionTemplates = {
    'Office Expense': [
      { description: 'Office supplies - Staples', amountRange: [25, 100] },
      { description: 'Printer paper', amountRange: [30, 60] },
      { description: 'Desk organizer', amountRange: [20, 50] },
      { description: 'Computer mouse', amountRange: [30, 80] },
    ],
    'Car and Truck Expenses': [
      { description: 'Gas for business travel', amountRange: [40, 80] },
      { description: 'Parking - client meeting', amountRange: [10, 30] },
      { description: 'Toll fees - business trip', amountRange: [10, 40] },
    ],
    'Travel Expenses': [
      { description: 'Flight - business conference', amountRange: [200, 500] },
      { description: 'Hotel - client visit', amountRange: [120, 250] },
      { description: 'Business meal - client dinner', amountRange: [50, 150] },
    ],
    'Business Supplies': [
      { description: 'Software subscription', amountRange: [15, 50] },
      { description: 'Office equipment', amountRange: [50, 200] },
      { description: 'Professional books', amountRange: [25, 60] },
    ],
    'Medical and Dental Expenses': [
      { description: 'Doctor visit - copay', amountRange: [20, 50] },
      { description: 'Prescription medication', amountRange: [15, 80] },
      { description: 'Dental cleaning', amountRange: [50, 150] },
      { description: 'Vision exam', amountRange: [50, 120] },
    ],
    'Charitable Contributions': [
      { description: 'Red Cross donation', amountRange: [50, 200] },
      { description: 'Food bank donation', amountRange: [25, 100] },
      { description: 'Church donation', amountRange: [50, 150] },
      { description: 'Habitat for Humanity', amountRange: [100, 300] },
    ],
  };

  const insertTransaction = db.prepare(`
    INSERT INTO transactions (id, user_id, household_id, account_id, category_id, date, amount, description, type, is_tax_deductible, is_pending, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertTaxClassification = db.prepare(`
    INSERT INTO transaction_tax_classifications (id, user_id, transaction_id, tax_category_id, tax_year, allocated_amount, percentage, is_deductible, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let totalTransactions = 0;
  let totalDeductions = 0;
  const categoryTotals = {};

  for (const [taxCategoryName, templates] of Object.entries(transactionTemplates)) {
    const taxCategoryId = taxCategoryIds[taxCategoryName];
    if (!taxCategoryId) {
      console.log(`  ⚠️ Skipping ${taxCategoryName} - tax category not found`);
      continue;
    }
    
    categoryTotals[taxCategoryName] = 0;
    
    // Create 3-5 transactions per tax category
    const transactionCount = Math.floor(Math.random() * 3) + 3;
    
    for (let i = 0; i < transactionCount; i++) {
      const template = templates[Math.floor(Math.random() * templates.length)];
      const amount = randomFloat(template.amountRange[0], template.amountRange[1]);
      const date = randomDate(startOfYear, now);
      const transactionId = uuidv4();
      
      // Create the transaction
      insertTransaction.run(
        transactionId,
        TEST_USER_ID,
        TEST_HOUSEHOLD_ID,
        accountId,
        expenseCategoryId,
        date,
        amount, // Positive amount (type determines direction)
        template.description,
        'expense',
        1, // is_tax_deductible = true
        0,
        date + 'T12:00:00.000Z',
        date + 'T12:00:00.000Z'
      );

      // Create the tax classification linking to tax category
      insertTaxClassification.run(
        uuidv4(),
        TEST_USER_ID,
        transactionId,
        taxCategoryId,
        currentYear,
        amount, // Positive amount for the classification
        100.0, // 100% allocated to this category
        1, // is_deductible
        new Date().toISOString(),
        new Date().toISOString()
      );

      totalTransactions++;
      totalDeductions += amount;
      categoryTotals[taxCategoryName] += amount;
    }
    
    console.log(`  ${taxCategoryName}: ${transactionCount} transactions, $${categoryTotals[taxCategoryName].toFixed(2)}`);
  }

  // Step 6: Create some interest income for comparison
  console.log('\n📝 Creating income transactions...');
  
  const interestTaxCatId = taxCategoryIds['Interest Income'];
  if (interestTaxCatId) {
    const incomeTemplates = [
      { description: 'Bank interest income', amount: 45.67 },
      { description: 'Savings account interest', amount: 32.15 },
      { description: 'Money market interest', amount: 28.89 },
    ];

    for (const template of incomeTemplates) {
      const date = randomDate(startOfYear, now);
      const transactionId = uuidv4();
      
      insertTransaction.run(
        transactionId,
        TEST_USER_ID,
        TEST_HOUSEHOLD_ID,
        accountId,
        expenseCategoryId,
        date,
        template.amount, // Positive for income
        template.description,
        'income',
        0, // Not deductible
        0,
        date + 'T12:00:00.000Z',
        date + 'T12:00:00.000Z'
      );

      // Create tax classification for income
      insertTaxClassification.run(
        uuidv4(),
        TEST_USER_ID,
        transactionId,
        interestTaxCatId,
        currentYear,
        template.amount,
        100.0,
        0, // Not deductible (income)
        new Date().toISOString(),
        new Date().toISOString()
      );
    }
    console.log('✅ Created 3 interest income transactions\n');
  }

  console.log(`\n✅ Created ${totalTransactions} tax-classified transactions`);
  console.log(`   Total Deductions: $${totalDeductions.toFixed(2)}`);

  // Summary
  console.log('\n📊 Summary by Tax Category:');
  for (const [category, total] of Object.entries(categoryTotals)) {
    console.log(`   ${category}: $${total.toFixed(2)}`);
  }

  console.log('\n🎉 Tax deduction test data added successfully!');
  console.log('\n📋 Next steps:');
  console.log('   1. Navigate to /dashboard/tax in the browser');
  console.log('   2. You should see deductible transactions grouped by tax category');
  console.log('   3. Schedule C and Schedule A categories should appear');

} catch (error) {
  console.error('❌ Error adding test data:', error);
  process.exit(1);
} finally {
  db.close();
}
