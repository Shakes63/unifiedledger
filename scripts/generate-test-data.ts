/**
 * Comprehensive Test Data Generator
 * 
 * Generates realistic test data for 2 households covering all data types:
 * - Accounts (all types)
 * - Categories (all types)
 * - Merchants
 * - Transactions (income, expense, transfers, splits)
 * - Bills (all frequencies)
 * - Savings Goals with milestones
 * - Debts with payments and milestones
 * - Tags and custom fields
 * - Rules
 * - Tax data
 * - Sales tax data
 * - Notifications
 * - Activity logs
 * 
 * All financial calculations use Decimal.js for precision.
 */

import { nanoid } from 'nanoid';
import Decimal from 'decimal.js';
import { eq } from 'drizzle-orm';
import { db } from '../lib/db';
import { auth } from '../lib/better-auth';
import {
  amountToCents,
  buildAccountBalanceFields,
  buildTransactionAmountFields,
} from '../lib/transactions/money-movement-service';
import {
  households,
  householdMembers,
  accounts,
  budgetCategories,
  merchants,
  transactions,
  transactionSplits,
  billTemplates,
  billOccurrences,
  savingsGoals,
  savingsMilestones,
  debts,
  debtPayments,
  debtPayoffMilestones,
  tags,
  transactionTags,
  customFields,
  customFieldValues,
  categorizationRules,
  transactionTemplates,
  taxCategories,
  salesTaxSettings,
  notifications,
  userSettings,
  userHouseholdPreferences,
  householdSettings,
} from '../lib/db/schema';

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function randomDate(start: Date, end: Date): string {
  const date = new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
  return toLocalDateString(date);
}

function toLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min: number, max: number, decimals: number = 2): number {
  return parseFloat((Math.random() * (max - min) + min).toFixed(decimals));
}

function addDays(date: string, days: number): string {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return toLocalDateString(d);
}

function addMonths(date: string, months: number): string {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return toLocalDateString(d);
}

function _getDayOfWeek(date: string): number {
  return new Date(date).getDay();
}

function _getDayOfMonth(date: string): number {
  return new Date(date).getDate();
}

// ============================================================================
// DATA GENERATION
// ============================================================================

async function generateTestData() {
  console.log('🚀 Starting comprehensive test data generation...\n');

  const now = new Date();
  const sixMonthsAgo = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
  const threeMonthsAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // ============================================================================
  // CREATE SINGLE USER FOR BOTH HOUSEHOLDS
  // ============================================================================
  console.log('👤 Creating user account...');
  
  // Generate test credentials
  const testEmail = `test-user-${nanoid(8)}@example.com`;
  const testPassword = `TestPassword${nanoid(8)}!`;
  const testName = 'John Smith';
  
  // Create Better Auth user account
  let userId: string;
  try {
    const signUpResult = await auth.api.signUpEmail({
      body: {
        email: testEmail,
        password: testPassword,
        name: testName,
      },
    });
    
    if (!signUpResult || !signUpResult.user) {
      throw new Error('Failed to create user account');
    }
    
    userId = signUpResult.user.id;
    console.log(`✅ User account created: ${testEmail}`);
  } catch (error: unknown) {
    // If user already exists, try to sign in to get the user ID
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes('already exists') || errorMessage.includes('UNIQUE constraint')) {
      console.log('⚠️  User already exists, using existing account...');
      const signInResult = await auth.api.signInEmail({
        body: {
          email: testEmail,
          password: testPassword,
        },
      });
      
      if (!signInResult || !signInResult.user) {
        throw new Error('Failed to sign in to existing account');
      }
      
      userId = signInResult.user.id;
    } else {
      throw error;
    }
  }
  
  // Create user settings
  await db.insert(userSettings).values({
    id: nanoid(),
    userId,
    displayName: testName,
    currency: 'USD',
    currencySymbol: '$',
    theme: 'dark-mode',
    createdAt: sixMonthsAgo.toISOString(),
    updatedAt: sixMonthsAgo.toISOString(),
  });

  // ============================================================================
  // HOUSEHOLD 1: "Smith Family"
  // ============================================================================
  console.log('📦 Generating Household 1: Smith Family...');

  const household1Id = nanoid();

  // Create household
  await db.insert(households).values({
    id: household1Id,
    name: 'Smith Family',
    createdBy: userId,
    createdAt: sixMonthsAgo.toISOString(),
    updatedAt: sixMonthsAgo.toISOString(),
  });

  // Create household member
  await db.insert(householdMembers).values({
    id: nanoid(),
    householdId: household1Id,
    userId,
    userEmail: testEmail,
    userName: testName,
    role: 'owner',
    joinedAt: sixMonthsAgo.toISOString(),
    isActive: true,
    isFavorite: true,
  });

  // Create household settings
  await db.insert(householdSettings).values({
    id: nanoid(),
    householdId: household1Id,
    currency: 'USD',
    currencySymbol: '$',
    createdAt: sixMonthsAgo.toISOString(),
    updatedAt: sixMonthsAgo.toISOString(),
  });

  // Create user household preferences
  await db.insert(userHouseholdPreferences).values({
    id: nanoid(),
    userId,
    householdId: household1Id,
    theme: 'dark-mode',
    createdAt: sixMonthsAgo.toISOString(),
    updatedAt: sixMonthsAgo.toISOString(),
  });

  // Accounts for Household 1
  const accounts1 = [
    { name: 'Primary Checking', type: 'checking' as const, bankName: 'Wells Fargo', startingBalance: 5000, color: '#3b82f6', icon: 'wallet' },
    { name: 'Emergency Savings', type: 'savings' as const, bankName: 'Wells Fargo', startingBalance: 10000, color: '#10b981', icon: 'piggy-bank' },
    { name: 'Chase Credit Card', type: 'credit' as const, bankName: 'Chase', startingBalance: 0, creditLimit: 10000, color: '#ef4444', icon: 'credit-card' },
    { name: 'Investment Account', type: 'investment' as const, bankName: 'Fidelity', startingBalance: 40000, color: '#8b5cf6', icon: 'trending-up' },
    { name: 'Cash', type: 'cash' as const, bankName: 'Cash', startingBalance: 200, color: '#f59e0b', icon: 'dollar-sign' },
  ];

  const accountIds1: Record<string, string> = {};
  const accountBalances1: Record<string, Decimal> = {};
  for (const acc of accounts1) {
    const id = nanoid();
    accountIds1[acc.name] = id;
    accountBalances1[id] = new Decimal(acc.startingBalance);
    await db.insert(accounts).values({
      id,
      userId,
      householdId: household1Id,
      name: acc.name,
      type: acc.type,
      bankName: acc.bankName,
      currentBalance: acc.startingBalance,
      currentBalanceCents: amountToCents(acc.startingBalance),
      creditLimit: acc.type === 'credit' ? acc.creditLimit : null,
      creditLimitCents: acc.type === 'credit' ? amountToCents(acc.creditLimit ?? 0) : null,
      color: acc.color,
      icon: acc.icon,
      isActive: true,
      createdAt: sixMonthsAgo.toISOString(),
      updatedAt: sixMonthsAgo.toISOString(),
    });
  }

  // Categories for Household 1
  const categories1 = [
    // Income
    { name: 'Salary', type: 'income' as const, monthlyBudget: 6000, incomeFrequency: 'biweekly' as const },
    { name: 'Freelance', type: 'income' as const, monthlyBudget: 2000, incomeFrequency: 'variable' as const },
    { name: 'Investment Returns', type: 'income' as const, monthlyBudget: 500, incomeFrequency: 'variable' as const },
    
    // Expenses
    { name: 'Groceries', type: 'expense' as const, monthlyBudget: 800 },
    { name: 'Gas & Fuel', type: 'expense' as const, monthlyBudget: 300 },
    { name: 'Dining Out', type: 'expense' as const, monthlyBudget: 400 },
    { name: 'Entertainment', type: 'expense' as const, monthlyBudget: 200 },
    { name: 'Shopping', type: 'expense' as const, monthlyBudget: 500 },
    { name: 'Healthcare', type: 'expense' as const, monthlyBudget: 300 },
    { name: 'Mortgage', type: 'expense' as const, monthlyBudget: 2200 },
    { name: 'Electric Bill', type: 'expense' as const, monthlyBudget: 150 },
    { name: 'Water Bill', type: 'expense' as const, monthlyBudget: 80 },
    { name: 'Internet', type: 'expense' as const, monthlyBudget: 75 },
    { name: 'Phone Bill', type: 'expense' as const, monthlyBudget: 120 },
    { name: 'Car Insurance', type: 'expense' as const, monthlyBudget: 150 },
    { name: 'Credit Card Payment', type: 'expense' as const, monthlyBudget: 500 },
    { name: 'Car Loan', type: 'expense' as const, monthlyBudget: 350 },
    
    // Savings
    { name: 'Emergency Fund', type: 'savings' as const, monthlyBudget: 500 },
    { name: 'Vacation Fund', type: 'savings' as const, monthlyBudget: 300 },
    { name: 'Retirement', type: 'savings' as const, monthlyBudget: 1000 },
  ];

  const categoryIds1: Record<string, string> = {};
  for (let i = 0; i < categories1.length; i++) {
    const cat = categories1[i];
    const id = nanoid();
    categoryIds1[cat.name] = id;
    await db.insert(budgetCategories).values({
      id,
      userId,
      householdId: household1Id,
      name: cat.name,
      type: cat.type,
      monthlyBudget: cat.monthlyBudget || 0,
      dueDate: null,
      incomeFrequency: (cat as { incomeFrequency?: 'weekly' | 'biweekly' | 'monthly' | 'variable' }).incomeFrequency || 'variable',
      isActive: true,
      sortOrder: i,
      createdAt: sixMonthsAgo.toISOString(),
    });
  }

  // Merchants for Household 1
  const merchants1 = [
    'Whole Foods Market',
    'Shell Gas Station',
    'Starbucks',
    'Amazon',
    'Target',
    'CVS Pharmacy',
    'Netflix',
    'Spotify',
    'Apple Store',
    'Home Depot',
  ];

  const merchantIds1: Record<string, string> = {};
  for (const merchantName of merchants1) {
    const id = nanoid();
    merchantIds1[merchantName] = id;
    const categoryId = Object.keys(categoryIds1).find(cat => 
      merchantName.toLowerCase().includes('food') ? cat === 'Groceries' :
      merchantName.toLowerCase().includes('gas') ? cat === 'Gas & Fuel' :
      merchantName.toLowerCase().includes('pharmacy') ? cat === 'Healthcare' :
      null
    );
    await db.insert(merchants).values({
      id,
      userId,
      householdId: household1Id,
      name: merchantName,
      normalizedName: merchantName.toLowerCase(),
      categoryId: categoryId ? categoryIds1[categoryId] : null,
      usageCount: randomInt(1, 20),
      lastUsedAt: randomDate(oneMonthAgo, now).split('T')[0],
      totalSpent: randomFloat(100, 2000),
      averageTransaction: randomFloat(20, 150),
      createdAt: sixMonthsAgo.toISOString(),
      updatedAt: sixMonthsAgo.toISOString(),
    });
  }

  // Transactions for Household 1 (last 6 months)
  const transactionTypes1: Array<{ type: 'income' | 'expense', category: string, amount: [number, number], merchant?: string }> = [
    { type: 'income', category: 'Salary', amount: [2800, 3000] },
    { type: 'income', category: 'Freelance', amount: [500, 2000] },
    { type: 'expense', category: 'Groceries', amount: [50, 200], merchant: 'Whole Foods Market' },
    { type: 'expense', category: 'Gas & Fuel', amount: [30, 80], merchant: 'Shell Gas Station' },
    { type: 'expense', category: 'Dining Out', amount: [15, 75] },
    { type: 'expense', category: 'Entertainment', amount: [10, 50] },
    { type: 'expense', category: 'Shopping', amount: [25, 300] },
    { type: 'expense', category: 'Healthcare', amount: [20, 150] },
  ];

  const transactionIds1: string[] = [];
  for (let i = 0; i < 120; i++) {
    const txType = transactionTypes1[randomInt(0, transactionTypes1.length - 1)];
    const amount = randomFloat(txType.amount[0], txType.amount[1]);
    const date = randomDate(sixMonthsAgo, now);
    const accountId = txType.type === 'income' 
      ? accountIds1['Primary Checking']
      : accountIds1['Primary Checking'];
    const merchantId = txType.merchant ? merchantIds1[txType.merchant] : null;
    
    const txAmount = txType.type === 'income' ? amount : -amount;
    accountBalances1[accountId] = accountBalances1[accountId].plus(txAmount);
    
    const id = nanoid();
    transactionIds1.push(id);
    await db.insert(transactions).values({
      id,
      userId,
      householdId: household1Id,
      accountId,
      categoryId: categoryIds1[txType.category],
      merchantId,
      date,
      ...buildTransactionAmountFields(amountToCents(txAmount)),
      description: `${txType.category}${txType.merchant ? ` - ${txType.merchant}` : ''}`,
      type: txType.type,
      isPending: Math.random() < 0.05,
      createdAt: date,
      updatedAt: date,
    });
  }

  // Add monthly bill transactions
  const monthlyBills1 = [
    { name: 'Mortgage', amount: 2200, dueDate: 1 },
    { name: 'Electric Bill', amount: 150, dueDate: 15 },
    { name: 'Water Bill', amount: 80, dueDate: 15 },
    { name: 'Internet', amount: 75, dueDate: 1 },
    { name: 'Phone Bill', amount: 120, dueDate: 1 },
    { name: 'Car Insurance', amount: 150, dueDate: 5 },
  ];

  for (let month = 0; month < 6; month++) {
    const baseDate = new Date(sixMonthsAgo);
    baseDate.setMonth(baseDate.getMonth() + month);
    
    for (const bill of monthlyBills1) {
      const dueDate = new Date(baseDate.getFullYear(), baseDate.getMonth(), bill.dueDate);
      const accountId = accountIds1['Primary Checking'];
      accountBalances1[accountId] = accountBalances1[accountId].minus(bill.amount);
      
      const id = nanoid();
      transactionIds1.push(id);
      await db.insert(transactions).values({
        id,
        userId,
        householdId: household1Id,
        accountId,
        categoryId: categoryIds1[bill.name],
        date: toLocalDateString(dueDate),
        ...buildTransactionAmountFields(amountToCents(-bill.amount)),
        description: bill.name,
        type: 'expense',
        createdAt: dueDate.toISOString(),
        updatedAt: dueDate.toISOString(),
      });
    }
  }

  // Create a split transaction
  const splitTxId = nanoid();
  transactionIds1.push(splitTxId);
  const splitAccountId = accountIds1['Primary Checking'];
  accountBalances1[splitAccountId] = accountBalances1[splitAccountId].minus(150.00);
  
  await db.insert(transactions).values({
    id: splitTxId,
    userId,
    householdId: household1Id,
    accountId: splitAccountId,
    date: randomDate(oneMonthAgo, now),
    ...buildTransactionAmountFields(amountToCents(-150.00)),
    description: 'Split Transaction - Groceries & Gas',
    type: 'expense',
    isSplit: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  await db.insert(transactionSplits).values([
    {
      id: nanoid(),
      userId,
      householdId: household1Id,
      transactionId: splitTxId,
      categoryId: categoryIds1['Groceries'],
      amount: -100.00,
      amountCents: amountToCents(-100.00),
      percentage: 66.67,
      isPercentage: true,
      description: 'Groceries portion',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: nanoid(),
      userId,
      householdId: household1Id,
      transactionId: splitTxId,
      categoryId: categoryIds1['Gas & Fuel'],
      amount: -50.00,
      amountCents: amountToCents(-50.00),
      percentage: 33.33,
      isPercentage: true,
      description: 'Gas portion',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ]);

  // Create transfer
  const transferId = nanoid();
  const transferOutId = nanoid();
  const transferInId = nanoid();
  transactionIds1.push(transferOutId, transferInId);
  
  const transferAmount = 1000.00;
  const transferFromAccountId = accountIds1['Primary Checking'];
  const transferToAccountId = accountIds1['Emergency Savings'];
  accountBalances1[transferFromAccountId] = accountBalances1[transferFromAccountId].minus(transferAmount);
  accountBalances1[transferToAccountId] = accountBalances1[transferToAccountId].plus(transferAmount);
  
  await db.insert(transactions).values([
    {
      id: transferOutId,
      userId,
      householdId: household1Id,
      accountId: transferFromAccountId,
      date: randomDate(oneMonthAgo, now),
      ...buildTransactionAmountFields(amountToCents(-transferAmount)),
      description: 'Transfer to Emergency Savings',
      type: 'transfer_out',
      transferId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: transferInId,
      userId,
      householdId: household1Id,
      accountId: transferToAccountId,
      date: randomDate(oneMonthAgo, now),
      ...buildTransactionAmountFields(amountToCents(transferAmount)),
      description: 'Transfer from Primary Checking',
      type: 'transfer_in',
      transferId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ]);

  // Bills for Household 1 - Mixed frequencies with overdue, due this month, and pending
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  
  const bills1 = [
    // Monthly bills
    { name: 'Mortgage', amount: 2200, frequency: 'monthly' as const, dueDate: 1 },
    { name: 'Electric Bill', amount: 150, frequency: 'monthly' as const, dueDate: 15 },
    { name: 'Water Bill', amount: 80, frequency: 'monthly' as const, dueDate: 20 },
    { name: 'Internet', amount: 75, frequency: 'monthly' as const, dueDate: 5 },
    { name: 'Phone Bill', amount: 120, frequency: 'monthly' as const, dueDate: 10 },
    { name: 'Car Insurance', amount: 150, frequency: 'monthly' as const, dueDate: 25 },
    { name: 'Netflix', amount: 15.99, frequency: 'monthly' as const, dueDate: 1 },
    { name: 'Spotify', amount: 9.99, frequency: 'monthly' as const, dueDate: 1 },
    { name: 'Gym Membership', amount: 50, frequency: 'monthly' as const, dueDate: 1 },
    // Weekly bills
    { name: 'Grocery Delivery', amount: 45, frequency: 'weekly' as const, dueDate: 1 }, // Monday
    { name: 'Cleaning Service', amount: 80, frequency: 'weekly' as const, dueDate: 5 }, // Friday
    // Biweekly bills
    { name: 'Paycheck', amount: 2900, frequency: 'biweekly' as const, dueDate: 5 }, // Friday
    // Quarterly bills
    { name: 'Property Tax', amount: 2400, frequency: 'quarterly' as const, dueDate: 1 },
    { name: 'HOA Dues', amount: 300, frequency: 'quarterly' as const, dueDate: 15 },
    // Annual bills
    { name: 'Car Registration', amount: 150, frequency: 'annual' as const, dueDate: 1 },
    { name: 'Annual Insurance', amount: 1200, frequency: 'annual' as const, dueDate: 1 },
  ];

  const billIds1: Record<string, string> = {};
  for (const bill of bills1) {
    const id = nanoid();
    billIds1[bill.name] = id;
    await db.insert(billTemplates).values({
      id,
      createdByUserId: userId,
      householdId: household1Id,
      name: bill.name,
      categoryId: categoryIds1[bill.name] || categoryIds1['Mortgage'],
      defaultAmountCents: amountToCents(bill.amount),
      recurrenceType: bill.frequency,
      recurrenceDueDay: bill.frequency === 'weekly' || bill.frequency === 'biweekly' ? null : bill.dueDate,
      recurrenceDueWeekday: bill.frequency === 'weekly' || bill.frequency === 'biweekly' ? bill.dueDate : null,
      billType: bill.name === 'Paycheck' ? 'income' : 'expense',
      classification: bill.name === 'Mortgage' ? 'housing' : bill.name === 'Paycheck' ? 'other' : 'utility',
      paymentAccountId: accountIds1['Primary Checking'],
      isActive: true,
      autoMarkPaid: true,
      createdAt: sixMonthsAgo.toISOString(),
      updatedAt: sixMonthsAgo.toISOString(),
    });
  }

  // Generate bill instances with mixed statuses: overdue, due this month (unpaid), and pending
  for (const bill of bills1) {
    const billId = billIds1[bill.name];
    const instances: Array<{ dueDate: string, amount: number, status: 'overdue' | 'due_this_month' | 'pending' }> = [];

    if (bill.frequency === 'monthly') {
      // Create instances: 2 overdue (last 2 months), 1 due this month (unpaid), 2 pending (next 2 months)
      for (let i = -2; i <= 2; i++) {
        const instanceMonth = currentMonth + i;
        const instanceYear = currentYear + Math.floor(instanceMonth / 12);
        const adjustedMonth = ((instanceMonth % 12) + 12) % 12;
        const dueDate = new Date(instanceYear, adjustedMonth, Math.min(bill.dueDate, new Date(instanceYear, adjustedMonth + 1, 0).getDate()));
        const dueDateStr = toLocalDateString(dueDate);
        
        let status: 'overdue' | 'due_this_month' | 'pending';
        if (i < 0) {
          status = 'overdue'; // Past months = overdue
        } else if (i === 0) {
          status = 'due_this_month'; // Current month = due this month
        } else {
          status = 'pending'; // Future months = pending
        }
        
        instances.push({ dueDate: dueDateStr, amount: bill.amount, status });
      }
    } else if (bill.frequency === 'weekly') {
      // Create instances: 2 overdue (past weeks), 1 due this month, 2 pending (future weeks)
      const currentDayOfWeek = now.getDay();
      const daysUntilDue = (bill.dueDate - currentDayOfWeek + 7) % 7;
      const nextDueDate = new Date(now);
      nextDueDate.setDate(now.getDate() + (daysUntilDue === 0 ? 7 : daysUntilDue));
      
      for (let i = -2; i <= 2; i++) {
        const dueDate = new Date(nextDueDate);
        dueDate.setDate(nextDueDate.getDate() + (i * 7));
        const dueDateStr = toLocalDateString(dueDate);
        
        let status: 'overdue' | 'due_this_month' | 'pending';
        if (dueDate < now) {
          status = 'overdue';
        } else if (dueDate.getMonth() === currentMonth && dueDate.getFullYear() === currentYear) {
          status = 'due_this_month';
        } else {
          status = 'pending';
        }
        
        instances.push({ dueDate: dueDateStr, amount: bill.amount, status });
      }
    } else if (bill.frequency === 'biweekly') {
      // Create instances: 1 overdue, 1 due this month, 2 pending
      const currentDayOfWeek = now.getDay();
      const daysUntilDue = (bill.dueDate - currentDayOfWeek + 7) % 7;
      const nextDueDate = new Date(now);
      nextDueDate.setDate(now.getDate() + (daysUntilDue === 0 ? 14 : daysUntilDue));
      
      for (let i = -1; i <= 2; i++) {
        const dueDate = new Date(nextDueDate);
        dueDate.setDate(nextDueDate.getDate() + (i * 14));
        const dueDateStr = toLocalDateString(dueDate);
        
        let status: 'overdue' | 'due_this_month' | 'pending';
        if (dueDate < now) {
          status = 'overdue';
        } else if (dueDate.getMonth() === currentMonth && dueDate.getFullYear() === currentYear) {
          status = 'due_this_month';
        } else {
          status = 'pending';
        }
        
        instances.push({ dueDate: dueDateStr, amount: bill.amount, status });
      }
    } else if (bill.frequency === 'quarterly') {
      // Create instances: 1 overdue (last quarter), 1 due this month, 1 pending (next quarter)
      const currentQuarter = Math.floor(currentMonth / 3);
      for (let i = -1; i <= 1; i++) {
        const quarter = currentQuarter + i;
        const quarterMonth = quarter * 3;
        const quarterYear = currentYear + Math.floor(quarterMonth / 12);
        const adjustedMonth = ((quarterMonth % 12) + 12) % 12;
        const dueDate = new Date(quarterYear, adjustedMonth, Math.min(bill.dueDate, new Date(quarterYear, adjustedMonth + 1, 0).getDate()));
        const dueDateStr = toLocalDateString(dueDate);
        
        let status: 'overdue' | 'due_this_month' | 'pending';
        if (i < 0) {
          status = 'overdue';
        } else if (i === 0 && dueDate.getMonth() === currentMonth) {
          status = 'due_this_month';
        } else {
          status = 'pending';
        }
        
        instances.push({ dueDate: dueDateStr, amount: bill.amount, status });
      }
    } else if (bill.frequency === 'annual') {
      // Create instances: 1 overdue (last year), 1 due this month (if applicable), 1 pending (next year)
      for (let i = -1; i <= 1; i++) {
        const year = currentYear + i;
        const dueDate = new Date(year, 0, Math.min(bill.dueDate, new Date(year, 1, 0).getDate()));
        const dueDateStr = toLocalDateString(dueDate);
        
        let status: 'overdue' | 'due_this_month' | 'pending';
        if (i < 0) {
          status = 'overdue';
        } else if (i === 0 && dueDate.getMonth() === currentMonth) {
          status = 'due_this_month';
        } else {
          status = 'pending';
        }
        
        instances.push({ dueDate: dueDateStr, amount: bill.amount, status });
      }
    }

    for (const instance of instances) {
      // Determine final status based on instance status and payment
      let finalStatus: 'unpaid' | 'paid' | 'overdue';
      const isOverdue = instance.status === 'overdue';
      const isPaid = isOverdue && Math.random() < 0.5; // 50% chance paid if overdue
      
      if (isPaid) {
        finalStatus = 'paid';
      } else if (isOverdue) {
        finalStatus = 'overdue';
      } else {
        finalStatus = 'unpaid';
      }
      
      let transactionId: string | null = null;
      if (isPaid) {
        // Create transaction for paid overdue bills
        const accountId = accountIds1['Primary Checking'];
        accountBalances1[accountId] = accountBalances1[accountId].minus(instance.amount);
        
        const txId = nanoid();
        transactionIds1.push(txId);
        await db.insert(transactions).values({
          id: txId,
          userId,
          householdId: household1Id,
          accountId,
          categoryId: categoryIds1[bill.name] || categoryIds1['Mortgage'],
          date: addDays(instance.dueDate, randomInt(0, 5)), // Paid 0-5 days after due date
          ...buildTransactionAmountFields(amountToCents(-instance.amount)),
          description: bill.name,
          type: 'expense',
          createdAt: instance.dueDate,
          updatedAt: instance.dueDate,
        });
        transactionId = txId;
      }
      
      const dueAmountCents = amountToCents(instance.amount);
      const paidAmountCents = isPaid ? dueAmountCents : 0;
      await db.insert(billOccurrences).values({
        id: nanoid(),
        householdId: household1Id,
        templateId: billId,
        dueDate: instance.dueDate,
        amountDueCents: dueAmountCents,
        amountPaidCents: paidAmountCents,
        amountRemainingCents: isPaid ? 0 : dueAmountCents,
        actualAmountCents: isPaid ? dueAmountCents : null,
        paidDate: isPaid ? addDays(instance.dueDate, randomInt(0, 5)) : null,
        status: finalStatus,
        lastTransactionId: transactionId,
        createdAt: instance.dueDate,
        updatedAt: instance.dueDate,
      });
    }
  }

  // Savings Goals for Household 1
  const savingsGoals1 = [
    { name: 'Emergency Fund', targetAmount: 20000, currentAmount: 15000, category: 'emergency_fund' as const },
    { name: 'Vacation to Europe', targetAmount: 5000, currentAmount: 2500, category: 'vacation' as const },
    { name: 'New Car Down Payment', targetAmount: 10000, currentAmount: 3500, category: 'vehicle' as const },
  ];

  const goalIds1: Record<string, string> = {};
  for (const goal of savingsGoals1) {
    const id = nanoid();
    goalIds1[goal.name] = id;
    await db.insert(savingsGoals).values({
      id,
      userId,
      householdId: household1Id,
      name: goal.name,
      targetAmount: goal.targetAmount,
      currentAmount: goal.currentAmount,
      accountId: accountIds1['Emergency Savings'],
      category: goal.category,
      status: goal.currentAmount >= goal.targetAmount ? 'completed' : 'active',
      monthlyContribution: (goal.targetAmount - goal.currentAmount) / 12,
      createdAt: sixMonthsAgo.toISOString(),
      updatedAt: sixMonthsAgo.toISOString(),
    });

    // Create milestones
    const milestones = [25, 50, 75, 100];
    for (const percentage of milestones) {
      const milestoneAmount = new Decimal(goal.targetAmount).times(percentage / 100).toNumber();
      const achieved = goal.currentAmount >= milestoneAmount;
      await db.insert(savingsMilestones).values({
        id: nanoid(),
        goalId: id,
        userId,
        householdId: household1Id,
        percentage,
        milestoneAmount,
        achievedAt: achieved ? randomDate(sixMonthsAgo, now) : null,
        createdAt: sixMonthsAgo.toISOString(),
      });
    }
  }

  // Debts for Household 1
  const debts1 = [
    {
      name: 'Chase Credit Card',
      creditorName: 'Chase Bank',
      originalAmount: 5000,
      remainingBalance: 2845.75,
      minimumPayment: 100,
      interestRate: 18.99,
      interestType: 'variable' as const,
      type: 'credit_card' as const,
      startDate: toLocalDateString(sixMonthsAgo),
    },
    {
      name: 'Car Loan',
      creditorName: 'Bank of America',
      originalAmount: 25000,
      remainingBalance: 18500,
      minimumPayment: 350,
      interestRate: 4.5,
      interestType: 'fixed' as const,
      type: 'auto_loan' as const,
      startDate: addMonths(toLocalDateString(sixMonthsAgo), -12),
    },
  ];

  const debtIds1: Record<string, string> = {};
  for (const debt of debts1) {
    const id = nanoid();
    debtIds1[debt.name] = id;
    await db.insert(debts).values({
      id,
      userId,
      householdId: household1Id,
      name: debt.name,
      creditorName: debt.creditorName,
      originalAmount: debt.originalAmount,
      remainingBalance: debt.remainingBalance,
      minimumPayment: debt.minimumPayment,
      interestRate: debt.interestRate,
      interestType: debt.interestType,
      type: debt.type,
      accountId: debt.type === 'credit_card' ? accountIds1['Chase Credit Card'] : null,
      categoryId: categoryIds1[debt.name === 'Chase Credit Card' ? 'Credit Card Payment' : 'Car Loan'],
      startDate: debt.startDate,
      status: 'active',
      createdAt: debt.startDate,
      updatedAt: debt.startDate,
    });

    // Create debt payments
    for (let i = 0; i < 6; i++) {
      const paymentDate = addMonths(debt.startDate, i);
      const paymentAmount = debt.minimumPayment + (Math.random() < 0.3 ? randomFloat(50, 200) : 0);
      const principalAmount = paymentAmount * 0.7;
      const interestAmount = paymentAmount * 0.3;

      await db.insert(debtPayments).values({
        id: nanoid(),
        debtId: id,
        userId,
        householdId: household1Id,
        amount: paymentAmount,
        principalAmount,
        interestAmount,
        paymentDate,
        createdAt: paymentDate,
      });
    }

    // Create debt milestones
    const milestones = [25, 50, 75, 100];
    for (const percentage of milestones) {
      const milestoneBalance = new Decimal(debt.originalAmount).times(percentage / 100).toNumber();
      const achieved = debt.remainingBalance <= milestoneBalance;
      await db.insert(debtPayoffMilestones).values({
        id: nanoid(),
        debtId: id,
        userId,
        householdId: household1Id,
        percentage: 100 - percentage, // Inverted for payoff
        milestoneBalance,
        achievedAt: achieved ? randomDate(sixMonthsAgo, now) : null,
        createdAt: debt.startDate,
      });
    }
  }

  // Tags
  const tags1 = ['Business', 'Tax Deductible', 'Reimbursable', 'Personal', 'Recurring'];
  const tagIds1: Record<string, string> = {};
  for (const tagName of tags1) {
    const id = nanoid();
    tagIds1[tagName] = id;
    await db.insert(tags).values({
      id,
      userId,
      name: tagName,
      color: `#${Math.floor(Math.random()*16777215).toString(16)}`,
      createdAt: sixMonthsAgo.toISOString(),
      updatedAt: sixMonthsAgo.toISOString(),
    });
  }

  // Add tags to some transactions (ensure no duplicates)
  const usedTxTagPairs = new Set<string>();
  for (let i = 0; i < 20; i++) {
    const txId = transactionIds1[randomInt(0, transactionIds1.length - 1)];
    const tagId = tagIds1[tags1[randomInt(0, tags1.length - 1)]];
    const pairKey = `${txId}-${tagId}`;
    
    // Skip if this transaction already has this tag
    if (usedTxTagPairs.has(pairKey)) {
      continue;
    }
    usedTxTagPairs.add(pairKey);
    
    await db.insert(transactionTags).values({
      id: nanoid(),
      userId,
      transactionId: txId,
      tagId,
      createdAt: new Date().toISOString(),
    });
  }

  // Custom Fields
  const customFields1 = [
    { name: 'Receipt Number', type: 'text' as const },
    { name: 'Mileage', type: 'number' as const },
    { name: 'Project Code', type: 'text' as const },
  ];

  const customFieldIds1: Record<string, string> = {};
  for (const field of customFields1) {
    const id = nanoid();
    customFieldIds1[field.name] = id;
    await db.insert(customFields).values({
      id,
      userId,
      name: field.name,
      type: field.type,
      isActive: true,
      createdAt: sixMonthsAgo.toISOString(),
      updatedAt: sixMonthsAgo.toISOString(),
    });
  }

  // Add custom field values to some transactions (ensure no duplicates)
  const usedTxFieldPairs = new Set<string>();
  for (let i = 0; i < 15; i++) {
    const txId = transactionIds1[randomInt(0, transactionIds1.length - 1)];
    const fieldId = customFieldIds1['Receipt Number'];
    const pairKey = `${txId}-${fieldId}`;
    
    // Skip if this transaction already has this field
    if (usedTxFieldPairs.has(pairKey)) {
      continue;
    }
    usedTxFieldPairs.add(pairKey);
    
    await db.insert(customFieldValues).values({
      id: nanoid(),
      userId,
      customFieldId: fieldId,
      transactionId: txId,
      value: `RCP-${randomInt(1000, 9999)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  // Categorization Rules
  const rules1 = [
    {
      name: 'Auto-categorize Whole Foods as Groceries',
      priority: 10,
      conditions: JSON.stringify({
        logic: 'AND',
        conditions: [{ field: 'description', operator: 'contains', value: 'Whole Foods', caseSensitive: false }],
      }),
      actions: JSON.stringify([{ type: 'set_category', value: categoryIds1['Groceries'] }]),
    },
    {
      name: 'Auto-categorize Starbucks as Dining Out',
      priority: 20,
      conditions: JSON.stringify({
        logic: 'AND',
        conditions: [{ field: 'description', operator: 'contains', value: 'Starbucks', caseSensitive: false }],
      }),
      actions: JSON.stringify([{ type: 'set_category', value: categoryIds1['Dining Out'] }]),
    },
  ];

  for (const rule of rules1) {
    await db.insert(categorizationRules).values({
      id: nanoid(),
      userId,
      householdId: household1Id,
      name: rule.name,
      priority: rule.priority,
      conditions: rule.conditions,
      actions: rule.actions,
      isActive: true,
      createdAt: sixMonthsAgo.toISOString(),
      updatedAt: sixMonthsAgo.toISOString(),
    });
  }

  // Transaction Templates
  const templates1 = [
    { name: 'Weekly Grocery Shopping', accountId: accountIds1['Primary Checking'], categoryId: categoryIds1['Groceries'], amount: 150, type: 'expense' as const },
    { name: 'Monthly Salary', accountId: accountIds1['Primary Checking'], categoryId: categoryIds1['Salary'], amount: 2900, type: 'income' as const },
  ];

  for (const template of templates1) {
    await db.insert(transactionTemplates).values({
      id: nanoid(),
      userId,
      name: template.name,
      accountId: template.accountId,
      categoryId: template.categoryId,
      amount: template.amount,
      type: template.type,
      createdAt: sixMonthsAgo.toISOString(),
      updatedAt: sixMonthsAgo.toISOString(),
    });
  }

  // Tax Categories
  const taxCategories1 = [
    { name: 'Business Expenses', formType: 'schedule_c' as const, category: 'business_expense' as const },
    { name: 'Medical Expenses', formType: 'schedule_a' as const, category: 'personal_deduction' as const },
  ];

  const taxCategoryIds1: Record<string, string> = {};
  for (const taxCat of taxCategories1) {
    const id = nanoid();
    taxCategoryIds1[taxCat.name] = id;
    await db.insert(taxCategories).values({
      id,
      name: taxCat.name,
      formType: taxCat.formType,
      category: taxCat.category,
      isActive: true,
      createdAt: sixMonthsAgo.toISOString(),
    });
  }

  // Sales Tax Settings
  await db.insert(salesTaxSettings).values({
    id: nanoid(),
    userId,
    householdId: household1Id,
    defaultRate: 8.5,
    jurisdiction: 'California',
    filingFrequency: 'quarterly',
    enableTracking: true,
    createdAt: sixMonthsAgo.toISOString(),
    updatedAt: sixMonthsAgo.toISOString(),
  });

  // Notifications
  const notifications1 = [
    { type: 'bill_due' as const, title: 'Mortgage Payment Due', message: 'Your mortgage payment of $2,200 is due in 3 days' },
    { type: 'budget_warning' as const, title: 'Budget Warning', message: 'You have spent 85% of your Groceries budget' },
    { type: 'low_balance' as const, title: 'Low Balance Alert', message: 'Your Primary Checking account balance is below $100' },
  ];

  for (const notif of notifications1) {
    await db.insert(notifications).values({
      id: nanoid(),
      userId,
      householdId: household1Id,
      type: notif.type,
      title: notif.title,
      message: notif.message,
      priority: 'normal',
      isRead: Math.random() < 0.5,
      createdAt: randomDate(oneMonthAgo, now),
    });
  }

  // Update account balances based on transactions
  for (const [_accountName, accountId] of Object.entries(accountIds1)) {
    const finalBalance = accountBalances1[accountId].toNumber();
    await db.update(accounts)
      .set({ ...buildAccountBalanceFields(amountToCents(finalBalance)), updatedAt: new Date().toISOString() })
      .where(eq(accounts.id, accountId));
  }

  console.log('✅ Household 1 complete!\n');

  // ============================================================================
  // HOUSEHOLD 2: "Johnson Family"
  // ============================================================================
  console.log('📦 Generating Household 2: Johnson Family...');

  const household2Id = nanoid();

  // Create household
  await db.insert(households).values({
    id: household2Id,
    name: 'Johnson Family',
    createdBy: userId,
    createdAt: threeMonthsAgo.toISOString(),
    updatedAt: threeMonthsAgo.toISOString(),
  });

  // Add same user as member of second household
  await db.insert(householdMembers).values({
    id: nanoid(),
    householdId: household2Id,
    userId,
    userEmail: testEmail,
    userName: testName,
    role: 'owner',
    joinedAt: threeMonthsAgo.toISOString(),
    isActive: true,
    isFavorite: false,
  });

  // Create household settings
  await db.insert(householdSettings).values({
    id: nanoid(),
    householdId: household2Id,
    currency: 'USD',
    currencySymbol: '$',
    createdAt: threeMonthsAgo.toISOString(),
    updatedAt: threeMonthsAgo.toISOString(),
  });

  // Create user household preferences for second household
  await db.insert(userHouseholdPreferences).values({
    id: nanoid(),
    userId,
    householdId: household2Id,
    theme: 'light-mode',
    createdAt: threeMonthsAgo.toISOString(),
    updatedAt: threeMonthsAgo.toISOString(),
  });

  // Accounts for Household 2
  const accounts2 = [
    { name: 'Main Checking', type: 'checking' as const, bankName: 'Bank of America', startingBalance: 3000, color: '#3b82f6', icon: 'wallet' },
    { name: 'Savings Account', type: 'savings' as const, bankName: 'Bank of America', startingBalance: 8000, color: '#10b981', icon: 'piggy-bank' },
    { name: 'Discover Credit Card', type: 'credit' as const, bankName: 'Discover', startingBalance: 0, creditLimit: 5000, color: '#ef4444', icon: 'credit-card' },
  ];

  const accountIds2: Record<string, string> = {};
  const accountBalances2: Record<string, Decimal> = {};
  for (const acc of accounts2) {
    const id = nanoid();
    accountIds2[acc.name] = id;
    accountBalances2[id] = new Decimal(acc.startingBalance);
    await db.insert(accounts).values({
      id,
      userId,
      householdId: household2Id,
      name: acc.name,
      type: acc.type,
      bankName: acc.bankName,
      currentBalance: acc.startingBalance,
      currentBalanceCents: amountToCents(acc.startingBalance),
      creditLimit: acc.type === 'credit' ? acc.creditLimit : null,
      creditLimitCents: acc.type === 'credit' ? amountToCents(acc.creditLimit ?? 0) : null,
      color: acc.color,
      icon: acc.icon,
      isActive: true,
      createdAt: threeMonthsAgo.toISOString(),
      updatedAt: threeMonthsAgo.toISOString(),
    });
  }

  // Categories for Household 2
  const categories2 = [
    { name: 'Salary', type: 'income' as const, monthlyBudget: 4500, incomeFrequency: 'monthly' as const },
    { name: 'Groceries', type: 'expense' as const, monthlyBudget: 600 },
    { name: 'Rent', type: 'expense' as const, monthlyBudget: 1800 },
    { name: 'Utilities', type: 'expense' as const, monthlyBudget: 200 },
    { name: 'Credit Card Payment', type: 'expense' as const, monthlyBudget: 300 },
    { name: 'Emergency Fund', type: 'savings' as const, monthlyBudget: 400 },
  ];

  const categoryIds2: Record<string, string> = {};
  for (let i = 0; i < categories2.length; i++) {
    const cat = categories2[i];
    const id = nanoid();
    categoryIds2[cat.name] = id;
    await db.insert(budgetCategories).values({
      id,
      userId,
      householdId: household2Id,
      name: cat.name,
      type: cat.type,
      monthlyBudget: cat.monthlyBudget || 0,
      dueDate: null,
      incomeFrequency: (cat as { incomeFrequency?: 'weekly' | 'biweekly' | 'monthly' | 'variable' }).incomeFrequency || 'variable',
      isActive: true,
      sortOrder: i,
      createdAt: threeMonthsAgo.toISOString(),
    });
  }

  // Merchants for Household 2
  const merchants2 = ['Trader Joe\'s', 'Exxon', 'Chipotle', 'Walmart'];

  const merchantIds2: Record<string, string> = {};
  for (const merchantName of merchants2) {
    const id = nanoid();
    merchantIds2[merchantName] = id;
    await db.insert(merchants).values({
      id,
      userId,
      householdId: household2Id,
      name: merchantName,
      normalizedName: merchantName.toLowerCase(),
      categoryId: null,
      usageCount: randomInt(1, 15),
      lastUsedAt: randomDate(oneMonthAgo, now).split('T')[0],
      totalSpent: randomFloat(50, 1000),
      averageTransaction: randomFloat(15, 100),
      createdAt: threeMonthsAgo.toISOString(),
      updatedAt: threeMonthsAgo.toISOString(),
    });
  }

  // Transactions for Household 2
  const transactionTypes2: Array<{ type: 'income' | 'expense', category: string, amount: [number, number] }> = [
    { type: 'income', category: 'Salary', amount: [4400, 4600] },
    { type: 'expense', category: 'Groceries', amount: [40, 150] },
    { type: 'expense', category: 'Rent', amount: [1800, 1800] },
    { type: 'expense', category: 'Utilities', amount: [180, 220] },
  ];

  const transactionIds2: string[] = [];
  for (let i = 0; i < 60; i++) {
    const txType = transactionTypes2[randomInt(0, transactionTypes2.length - 1)];
    const amount = randomFloat(txType.amount[0], txType.amount[1]);
    const date = randomDate(threeMonthsAgo, now);
    const accountId = accountIds2['Main Checking'];
    
    const txAmount = txType.type === 'income' ? amount : -amount;
    accountBalances2[accountId] = accountBalances2[accountId].plus(txAmount);
    
    const id = nanoid();
    transactionIds2.push(id);
    await db.insert(transactions).values({
      id,
      userId,
      householdId: household2Id,
      accountId,
      categoryId: categoryIds2[txType.category],
      date,
      ...buildTransactionAmountFields(amountToCents(txAmount)),
      description: `${txType.category}`,
      type: txType.type,
      createdAt: date,
      updatedAt: date,
    });
  }

  // Bills for Household 2 - Mixed frequencies with overdue, due this month, and pending
  const bills2 = [
    // Monthly bills
    { name: 'Rent', amount: 1800, frequency: 'monthly' as const, dueDate: 1 },
    { name: 'Utilities', amount: 200, frequency: 'monthly' as const, dueDate: 10 },
    { name: 'Internet', amount: 60, frequency: 'monthly' as const, dueDate: 15 },
    { name: 'Phone Bill', amount: 100, frequency: 'monthly' as const, dueDate: 5 },
    // Weekly bills
    { name: 'Grocery Shopping', amount: 75, frequency: 'weekly' as const, dueDate: 0 }, // Sunday
    // Biweekly bills
    { name: 'Paycheck', amount: 2250, frequency: 'biweekly' as const, dueDate: 5 }, // Friday
    // Quarterly bills
    { name: 'Car Insurance', amount: 450, frequency: 'quarterly' as const, dueDate: 1 },
  ];

  const billIds2: Record<string, string> = {};
  for (const bill of bills2) {
    const id = nanoid();
    billIds2[bill.name] = id;
    await db.insert(billTemplates).values({
      id,
      createdByUserId: userId,
      householdId: household2Id,
      name: bill.name,
      categoryId: categoryIds2[bill.name] || categoryIds2['Rent'],
      defaultAmountCents: amountToCents(bill.amount),
      recurrenceType: bill.frequency,
      recurrenceDueDay: bill.frequency === 'weekly' || bill.frequency === 'biweekly' ? null : bill.dueDate,
      recurrenceDueWeekday: bill.frequency === 'weekly' || bill.frequency === 'biweekly' ? bill.dueDate : null,
      billType: bill.name === 'Paycheck' ? 'income' : 'expense',
      classification: bill.name === 'Rent' ? 'housing' : bill.name === 'Paycheck' ? 'other' : 'utility',
      paymentAccountId: accountIds2['Main Checking'],
      isActive: true,
      autoMarkPaid: true,
      createdAt: threeMonthsAgo.toISOString(),
      updatedAt: threeMonthsAgo.toISOString(),
    });
  }

  // Generate bill instances with mixed statuses: overdue, due this month (unpaid), and pending
  for (const bill of bills2) {
    const billId = billIds2[bill.name];
    const instances: Array<{ dueDate: string, amount: number, status: 'overdue' | 'due_this_month' | 'pending' }> = [];

    if (bill.frequency === 'monthly') {
      // Create instances: 2 overdue (last 2 months), 1 due this month (unpaid), 2 pending (next 2 months)
      for (let i = -2; i <= 2; i++) {
        const instanceMonth = currentMonth + i;
        const instanceYear = currentYear + Math.floor(instanceMonth / 12);
        const adjustedMonth = ((instanceMonth % 12) + 12) % 12;
        const dueDate = new Date(instanceYear, adjustedMonth, Math.min(bill.dueDate, new Date(instanceYear, adjustedMonth + 1, 0).getDate()));
        const dueDateStr = toLocalDateString(dueDate);
        
        let status: 'overdue' | 'due_this_month' | 'pending';
        if (i < 0) {
          status = 'overdue';
        } else if (i === 0) {
          status = 'due_this_month';
        } else {
          status = 'pending';
        }
        
        instances.push({ dueDate: dueDateStr, amount: bill.amount, status });
      }
    } else if (bill.frequency === 'weekly') {
      // Create instances: 2 overdue (past weeks), 1 due this month, 2 pending (future weeks)
      const currentDayOfWeek = now.getDay();
      const daysUntilDue = (bill.dueDate - currentDayOfWeek + 7) % 7;
      const nextDueDate = new Date(now);
      nextDueDate.setDate(now.getDate() + (daysUntilDue === 0 ? 7 : daysUntilDue));
      
      for (let i = -2; i <= 2; i++) {
        const dueDate = new Date(nextDueDate);
        dueDate.setDate(nextDueDate.getDate() + (i * 7));
        const dueDateStr = toLocalDateString(dueDate);
        
        let status: 'overdue' | 'due_this_month' | 'pending';
        if (dueDate < now) {
          status = 'overdue';
        } else if (dueDate.getMonth() === currentMonth && dueDate.getFullYear() === currentYear) {
          status = 'due_this_month';
        } else {
          status = 'pending';
        }
        
        instances.push({ dueDate: dueDateStr, amount: bill.amount, status });
      }
    } else if (bill.frequency === 'biweekly') {
      // Create instances: 1 overdue, 1 due this month, 2 pending
      const currentDayOfWeek = now.getDay();
      const daysUntilDue = (bill.dueDate - currentDayOfWeek + 7) % 7;
      const nextDueDate = new Date(now);
      nextDueDate.setDate(now.getDate() + (daysUntilDue === 0 ? 14 : daysUntilDue));
      
      for (let i = -1; i <= 2; i++) {
        const dueDate = new Date(nextDueDate);
        dueDate.setDate(nextDueDate.getDate() + (i * 14));
        const dueDateStr = toLocalDateString(dueDate);
        
        let status: 'overdue' | 'due_this_month' | 'pending';
        if (dueDate < now) {
          status = 'overdue';
        } else if (dueDate.getMonth() === currentMonth && dueDate.getFullYear() === currentYear) {
          status = 'due_this_month';
        } else {
          status = 'pending';
        }
        
        instances.push({ dueDate: dueDateStr, amount: bill.amount, status });
      }
    } else if (bill.frequency === 'quarterly') {
      // Create instances: 1 overdue (last quarter), 1 due this month, 1 pending (next quarter)
      const currentQuarter = Math.floor(currentMonth / 3);
      for (let i = -1; i <= 1; i++) {
        const quarter = currentQuarter + i;
        const quarterMonth = quarter * 3;
        const quarterYear = currentYear + Math.floor(quarterMonth / 12);
        const adjustedMonth = ((quarterMonth % 12) + 12) % 12;
        const dueDate = new Date(quarterYear, adjustedMonth, Math.min(bill.dueDate, new Date(quarterYear, adjustedMonth + 1, 0).getDate()));
        const dueDateStr = toLocalDateString(dueDate);
        
        let status: 'overdue' | 'due_this_month' | 'pending';
        if (i < 0) {
          status = 'overdue';
        } else if (i === 0 && dueDate.getMonth() === currentMonth) {
          status = 'due_this_month';
        } else {
          status = 'pending';
        }
        
        instances.push({ dueDate: dueDateStr, amount: bill.amount, status });
      }
    }

    for (const instance of instances) {
      // Determine final status based on instance status and payment
      let finalStatus: 'unpaid' | 'paid' | 'overdue';
      const isOverdue = instance.status === 'overdue';
      const isPaid = isOverdue && Math.random() < 0.5; // 50% chance paid if overdue
      
      if (isPaid) {
        finalStatus = 'paid';
      } else if (isOverdue) {
        finalStatus = 'overdue';
      } else {
        finalStatus = 'unpaid';
      }
      
      let transactionId: string | null = null;
      if (isPaid) {
        // Create transaction for paid overdue bills
        const accountId = accountIds2['Main Checking'];
        accountBalances2[accountId] = accountBalances2[accountId].minus(instance.amount);
        
        const txId = nanoid();
        transactionIds2.push(txId);
        await db.insert(transactions).values({
          id: txId,
          userId,
          householdId: household2Id,
          accountId,
          categoryId: categoryIds2[bill.name] || categoryIds2['Rent'],
          date: addDays(instance.dueDate, randomInt(0, 5)), // Paid 0-5 days after due date
          ...buildTransactionAmountFields(amountToCents(-instance.amount)),
          description: bill.name,
          type: 'expense',
          createdAt: instance.dueDate,
          updatedAt: instance.dueDate,
        });
        transactionId = txId;
      }
      
      const dueAmountCents = amountToCents(instance.amount);
      const paidAmountCents = isPaid ? dueAmountCents : 0;
      await db.insert(billOccurrences).values({
        id: nanoid(),
        householdId: household2Id,
        templateId: billId,
        dueDate: instance.dueDate,
        amountDueCents: dueAmountCents,
        amountPaidCents: paidAmountCents,
        amountRemainingCents: isPaid ? 0 : dueAmountCents,
        actualAmountCents: isPaid ? dueAmountCents : null,
        paidDate: isPaid ? addDays(instance.dueDate, randomInt(0, 5)) : null,
        status: finalStatus,
        lastTransactionId: transactionId,
        createdAt: instance.dueDate,
        updatedAt: instance.dueDate,
      });
    }
  }

  // Savings Goals for Household 2
  const savingsGoals2 = [
    { name: 'Emergency Fund', targetAmount: 10000, currentAmount: 8500, category: 'emergency_fund' as const },
  ];

  const goalIds2: Record<string, string> = {};
  for (const goal of savingsGoals2) {
    const id = nanoid();
    goalIds2[goal.name] = id;
    await db.insert(savingsGoals).values({
      id,
      userId,
      householdId: household2Id,
      name: goal.name,
      targetAmount: goal.targetAmount,
      currentAmount: goal.currentAmount,
      accountId: accountIds2['Savings Account'],
      category: goal.category,
      status: goal.currentAmount >= goal.targetAmount ? 'completed' : 'active',
      monthlyContribution: (goal.targetAmount - goal.currentAmount) / 12,
      createdAt: threeMonthsAgo.toISOString(),
      updatedAt: threeMonthsAgo.toISOString(),
    });
  }

  // Debts for Household 2
  const debts2 = [
    {
      name: 'Discover Credit Card',
      creditorName: 'Discover',
      originalAmount: 3000,
      remainingBalance: 1200.50,
      minimumPayment: 50,
      interestRate: 22.99,
      interestType: 'variable' as const,
      type: 'credit_card' as const,
      startDate: toLocalDateString(threeMonthsAgo),
    },
  ];

  const debtIds2: Record<string, string> = {};
  for (const debt of debts2) {
    const id = nanoid();
    debtIds2[debt.name] = id;
    await db.insert(debts).values({
      id,
      userId,
      householdId: household2Id,
      name: debt.name,
      creditorName: debt.creditorName,
      originalAmount: debt.originalAmount,
      remainingBalance: debt.remainingBalance,
      minimumPayment: debt.minimumPayment,
      interestRate: debt.interestRate,
      interestType: debt.interestType,
      type: debt.type,
      accountId: accountIds2['Discover Credit Card'],
      categoryId: categoryIds2['Credit Card Payment'],
      startDate: debt.startDate,
      status: 'active',
      createdAt: debt.startDate,
      updatedAt: debt.startDate,
    });
  }

  // Update account balances based on transactions
  for (const [_accountName, accountId] of Object.entries(accountIds2)) {
    const finalBalance = accountBalances2[accountId].toNumber();
    await db.update(accounts)
      .set({ ...buildAccountBalanceFields(amountToCents(finalBalance)), updatedAt: new Date().toISOString() })
      .where(eq(accounts.id, accountId));
  }

  console.log('✅ Household 2 complete!\n');

  console.log('✅ Test data generation complete!');
  console.log(`\n📊 Summary:`);
  console.log(`   - 1 User (belongs to both households)`);
  console.log(`   - 2 Households`);
  console.log(`   - ${accounts1.length + accounts2.length} Accounts`);
  console.log(`   - ${categories1.length + categories2.length} Categories`);
  console.log(`   - ${merchants1.length + merchants2.length} Merchants`);
  console.log(`   - ${transactionIds1.length + transactionIds2.length} Transactions`);
  console.log(`   - ${bills1.length + bills2.length} Bills`);
  console.log(`   - ${savingsGoals1.length + savingsGoals2.length} Savings Goals`);
  console.log(`   - ${debts1.length + debts2.length} Debts`);
  console.log(`\n🔐 Login Credentials:`);
  console.log(`   Email: ${testEmail}`);
  console.log(`   Password: ${testPassword}`);
  console.log(`\n💡 You can now sign in with these credentials to test the application!`);
}

// Run the generator
generateTestData()
  .then(() => {
    console.log('\n✨ All done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error generating test data:', error);
    process.exit(1);
  });
