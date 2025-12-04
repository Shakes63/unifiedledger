import { db } from '@/lib/db';
import {
  accounts,
  budgetCategories,
  bills,
  savingsGoals,
  debts,
  transactions,
  merchants,
} from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import Decimal from 'decimal.js';
import { subDays, format } from 'date-fns';

interface DemoDataResult {
  accountsCreated: number;
  categoriesCreated: number;
  billsCreated: number;
  goalsCreated: number;
  debtsCreated: number;
  transactionsCreated: number;
  merchantsCreated: number;
}

/**
 * Generate demo data for invited users to practice with
 * All data is prefixed with "Demo" to clearly identify it
 */
export async function generateDemoData(
  householdId: string,
  userId: string
): Promise<DemoDataResult> {
  const now = new Date();
  const createdAt = now.toISOString();
  
  // Track created IDs for relationships
  const accountIds: Record<string, string> = {};
  const categoryIds: Record<string, string> = {};
  const merchantIds: Record<string, string> = {};
  const billIds: Record<string, string> = {};
  const goalIds: Record<string, string> = {};
  const debtIds: Record<string, string> = {};

  // ============================================================================
  // 1. CREATE DEMO ACCOUNTS (2-3 accounts)
  // ============================================================================
  const demoAccounts = [
    {
      name: 'Demo Checking',
      type: 'checking' as const,
      balance: new Decimal(5000),
      color: '#3b82f6',
      icon: 'wallet',
    },
    {
      name: 'Demo Savings',
      type: 'savings' as const,
      balance: new Decimal(10000),
      color: '#10b981',
      icon: 'piggy-bank',
    },
    {
      name: 'Demo Credit Card',
      type: 'credit' as const,
      balance: new Decimal(500), // Owed amount
      creditLimit: new Decimal(5000),
      color: '#ef4444',
      icon: 'credit-card',
    },
  ];

  for (let i = 0; i < demoAccounts.length; i++) {
    const acc = demoAccounts[i];
    const id = nanoid();
    accountIds[acc.name] = id;
    
    await db.insert(accounts).values({
      id,
      userId,
      householdId,
      name: acc.name,
      type: acc.type,
      currentBalance: acc.balance.toNumber(),
      creditLimit: acc.type === 'credit' ? (acc as any).creditLimit.toNumber() : null,
      color: acc.color,
      icon: acc.icon,
      sortOrder: i,
      isActive: true,
      createdAt,
      updatedAt: createdAt,
    });
  }

  // ============================================================================
  // 2. CREATE DEMO CATEGORIES (5 categories)
  // ============================================================================
  const demoCategories = [
    {
      name: 'Demo Groceries',
      type: 'expense' as const,
      monthlyBudget: new Decimal(800),
    },
    {
      name: 'Demo Utilities',
      type: 'expense' as const,
      monthlyBudget: new Decimal(200),
    },
    {
      name: 'Demo Entertainment',
      type: 'expense' as const,
      monthlyBudget: new Decimal(300),
    },
    {
      name: 'Demo Rent',
      type: 'expense' as const,
      monthlyBudget: new Decimal(1200),
    },
    {
      name: 'Demo Income',
      type: 'income' as const,
      monthlyBudget: new Decimal(3500),
      incomeFrequency: 'biweekly' as const,
    },
  ];

  for (let i = 0; i < demoCategories.length; i++) {
    const cat = demoCategories[i];
    const id = nanoid();
    categoryIds[cat.name] = id;
    
    await db.insert(budgetCategories).values({
      id,
      userId,
      householdId,
      name: cat.name,
      type: cat.type,
      monthlyBudget: cat.monthlyBudget.toNumber(),
      dueDate: null,
      incomeFrequency: cat.type === 'income' ? (cat as any).incomeFrequency : 'variable',
      isActive: true,
      sortOrder: i,
      createdAt,
    });
  }

  // ============================================================================
  // 3. CREATE DEMO MERCHANTS (for transactions)
  // ============================================================================
  const demoMerchants = [
    { name: 'Demo Grocery Store', categoryId: categoryIds['Demo Groceries'] },
    { name: 'Demo Utility Company', categoryId: categoryIds['Demo Utilities'] },
    { name: 'Demo Coffee Shop', categoryId: categoryIds['Demo Entertainment'] },
    { name: 'Demo Gas Station', categoryId: categoryIds['Demo Groceries'] },
    { name: 'Demo Restaurant', categoryId: categoryIds['Demo Entertainment'] },
    { name: 'Demo Employer', categoryId: categoryIds['Demo Income'] },
  ];

  for (const merchant of demoMerchants) {
    const id = nanoid();
    merchantIds[merchant.name] = id;
    
    await db.insert(merchants).values({
      id,
      userId,
      householdId,
      name: merchant.name,
      normalizedName: merchant.name.toLowerCase().trim(),
      categoryId: merchant.categoryId,
      usageCount: 1,
      lastUsedAt: createdAt,
      totalSpent: 0,
      averageTransaction: 0,
      createdAt,
      updatedAt: createdAt,
    });
  }

  // ============================================================================
  // 4. CREATE DEMO BILLS (2-3 bills)
  // ============================================================================
  const demoBills = [
    {
      name: 'Demo Rent',
      expectedAmount: new Decimal(1200),
      dueDate: 1, // Day of month
      frequency: 'monthly' as const,
      categoryId: categoryIds['Demo Rent'],
      accountId: accountIds['Demo Checking'],
    },
    {
      name: 'Demo Internet',
      expectedAmount: new Decimal(79.99),
      dueDate: 15,
      frequency: 'monthly' as const,
      categoryId: categoryIds['Demo Utilities'],
      accountId: accountIds['Demo Checking'],
    },
    {
      name: 'Demo Phone',
      expectedAmount: new Decimal(89.99),
      dueDate: 20,
      frequency: 'monthly' as const,
      categoryId: categoryIds['Demo Utilities'],
      accountId: accountIds['Demo Checking'],
    },
  ];

  for (const bill of demoBills) {
    const id = nanoid();
    billIds[bill.name] = id;
    
    await db.insert(bills).values({
      id,
      userId,
      householdId,
      name: bill.name,
      expectedAmount: bill.expectedAmount.toNumber(),
      dueDate: bill.dueDate,
      frequency: bill.frequency,
      categoryId: bill.categoryId,
      accountId: bill.accountId,
      isActive: true,
      autoMarkPaid: true,
      createdAt,
    });
  }

  // ============================================================================
  // 5. CREATE DEMO GOALS (1-2 goals)
  // ============================================================================
  const demoGoals = [
    {
      name: 'Demo Vacation Fund',
      targetAmount: new Decimal(5000),
      currentAmount: new Decimal(1200),
      category: 'vacation' as const,
      accountId: accountIds['Demo Savings'],
      color: '#10b981',
      icon: 'plane',
    },
    {
      name: 'Demo Emergency Fund',
      targetAmount: new Decimal(10000),
      currentAmount: new Decimal(3500),
      category: 'emergency_fund' as const,
      accountId: accountIds['Demo Savings'],
      color: '#3b82f6',
      icon: 'shield',
    },
  ];

  for (const goal of demoGoals) {
    const id = nanoid();
    goalIds[goal.name] = id;
    
    await db.insert(savingsGoals).values({
      id,
      userId,
      householdId,
      name: goal.name,
      targetAmount: goal.targetAmount.toNumber(),
      currentAmount: goal.currentAmount.toNumber(),
      category: goal.category,
      accountId: goal.accountId,
      color: goal.color,
      icon: goal.icon,
      status: 'active',
      createdAt,
      updatedAt: createdAt,
    });
  }

  // ============================================================================
  // 6. CREATE DEMO DEBT (1 debt)
  // ============================================================================
  const demoDebt = {
    name: 'Demo Credit Card',
    creditorName: 'Demo Credit Card Company',
    originalAmount: new Decimal(2000),
    remainingBalance: new Decimal(500),
    minimumPayment: new Decimal(25),
    interestRate: new Decimal(18),
    interestType: 'fixed' as const,
    type: 'credit_card' as const,
    accountId: accountIds['Demo Credit Card'],
    categoryId: categoryIds['Demo Groceries'], // For tracking payments
    startDate: subDays(now, 180).toISOString().split('T')[0], // 6 months ago
    color: '#ef4444',
    icon: 'credit-card',
  };

  const debtId = nanoid();
  debtIds[demoDebt.name] = debtId;
  
  await db.insert(debts).values({
    id: debtId,
    userId,
    householdId,
    name: demoDebt.name,
    creditorName: demoDebt.creditorName,
    originalAmount: demoDebt.originalAmount.toNumber(),
    remainingBalance: demoDebt.remainingBalance.toNumber(),
    minimumPayment: demoDebt.minimumPayment.toNumber(),
    interestRate: demoDebt.interestRate.toNumber(),
    interestType: demoDebt.interestType,
    type: demoDebt.type,
    accountId: demoDebt.accountId,
    categoryId: demoDebt.categoryId,
    startDate: demoDebt.startDate,
    status: 'active',
    color: demoDebt.color,
    icon: demoDebt.icon,
    createdAt,
    updatedAt: createdAt,
  });

  // ============================================================================
  // 7. CREATE DEMO TRANSACTIONS (10-15 transactions)
  // ============================================================================
  const checkingAccountId = accountIds['Demo Checking'];
  const savingsAccountId = accountIds['Demo Savings'];
  const creditCardAccountId = accountIds['Demo Credit Card'];
  const incomeCategoryId = categoryIds['Demo Income'];
  const groceriesCategoryId = categoryIds['Demo Groceries'];
  const utilitiesCategoryId = categoryIds['Demo Utilities'];
  const entertainmentCategoryId = categoryIds['Demo Entertainment'];

  // Track account balances for transactions
  let checkingBalance = new Decimal(5000);
  let savingsBalance = new Decimal(10000);
  let creditCardBalance = new Decimal(500);

  const demoTransactions = [
    // Income transactions
    {
      description: 'Demo Salary',
      amount: new Decimal(3500),
      type: 'income' as const,
      accountId: checkingAccountId,
      categoryId: incomeCategoryId,
      merchantId: merchantIds['Demo Employer'],
      daysAgo: 5,
    },
    {
      description: 'Demo Salary',
      amount: new Decimal(3500),
      type: 'income' as const,
      accountId: checkingAccountId,
      categoryId: incomeCategoryId,
      merchantId: merchantIds['Demo Employer'],
      daysAgo: 19,
    },
    {
      description: 'Demo Salary',
      amount: new Decimal(3500),
      type: 'income' as const,
      accountId: checkingAccountId,
      categoryId: incomeCategoryId,
      merchantId: merchantIds['Demo Employer'],
      daysAgo: 33,
    },
    // Expense transactions
    {
      description: 'Demo Grocery Store',
      amount: new Decimal(125.50),
      type: 'expense' as const,
      accountId: checkingAccountId,
      categoryId: groceriesCategoryId,
      merchantId: merchantIds['Demo Grocery Store'],
      daysAgo: 2,
    },
    {
      description: 'Demo Utility Company',
      amount: new Decimal(89.99),
      type: 'expense' as const,
      accountId: checkingAccountId,
      categoryId: utilitiesCategoryId,
      merchantId: merchantIds['Demo Utility Company'],
      daysAgo: 10,
    },
    {
      description: 'Demo Coffee Shop',
      amount: new Decimal(4.50),
      type: 'expense' as const,
      accountId: checkingAccountId,
      categoryId: entertainmentCategoryId,
      merchantId: merchantIds['Demo Coffee Shop'],
      daysAgo: 1,
    },
    {
      description: 'Demo Gas Station',
      amount: new Decimal(45.00),
      type: 'expense' as const,
      accountId: checkingAccountId,
      categoryId: groceriesCategoryId,
      merchantId: merchantIds['Demo Gas Station'],
      daysAgo: 7,
    },
    {
      description: 'Demo Restaurant',
      amount: new Decimal(67.25),
      type: 'expense' as const,
      accountId: checkingAccountId,
      categoryId: entertainmentCategoryId,
      merchantId: merchantIds['Demo Restaurant'],
      daysAgo: 12,
    },
    {
      description: 'Demo Grocery Store',
      amount: new Decimal(98.75),
      type: 'expense' as const,
      accountId: checkingAccountId,
      categoryId: groceriesCategoryId,
      merchantId: merchantIds['Demo Grocery Store'],
      daysAgo: 15,
    },
    {
      description: 'Demo Utility Company',
      amount: new Decimal(75.50),
      type: 'expense' as const,
      accountId: checkingAccountId,
      categoryId: utilitiesCategoryId,
      merchantId: merchantIds['Demo Utility Company'],
      daysAgo: 25,
    },
    {
      description: 'Demo Coffee Shop',
      amount: new Decimal(5.25),
      type: 'expense' as const,
      accountId: checkingAccountId,
      categoryId: entertainmentCategoryId,
      merchantId: merchantIds['Demo Coffee Shop'],
      daysAgo: 3,
    },
    {
      description: 'Demo Gas Station',
      amount: new Decimal(52.00),
      type: 'expense' as const,
      accountId: checkingAccountId,
      categoryId: groceriesCategoryId,
      merchantId: merchantIds['Demo Gas Station'],
      daysAgo: 20,
    },
    {
      description: 'Demo Restaurant',
      amount: new Decimal(43.50),
      type: 'expense' as const,
      accountId: checkingAccountId,
      categoryId: entertainmentCategoryId,
      merchantId: merchantIds['Demo Restaurant'],
      daysAgo: 18,
    },
    // Credit card transaction
    {
      description: 'Demo Grocery Store',
      amount: new Decimal(87.30),
      type: 'expense' as const,
      accountId: creditCardAccountId,
      categoryId: groceriesCategoryId,
      merchantId: merchantIds['Demo Grocery Store'],
      daysAgo: 8,
    },
  ];

  // Create transactions and update balances
  for (const txn of demoTransactions) {
    const transactionId = nanoid();
    const transactionDate = subDays(now, txn.daysAgo);
    const dateStr = format(transactionDate, 'yyyy-MM-dd');

    // Update account balance
    if (txn.type === 'income') {
      if (txn.accountId === checkingAccountId) {
        checkingBalance = checkingBalance.plus(txn.amount);
      } else if (txn.accountId === savingsAccountId) {
        savingsBalance = savingsBalance.plus(txn.amount);
      }
    } else if (txn.type === 'expense') {
      if (txn.accountId === checkingAccountId) {
        checkingBalance = checkingBalance.minus(txn.amount);
      } else if (txn.accountId === creditCardAccountId) {
        creditCardBalance = creditCardBalance.plus(txn.amount);
      }
    }

    await db.insert(transactions).values({
      id: transactionId,
      userId,
      householdId,
      accountId: txn.accountId,
      categoryId: txn.categoryId,
      merchantId: txn.merchantId,
      date: dateStr,
      amount: txn.amount.toNumber(),
      description: txn.description,
      type: txn.type,
      isPending: false,
      syncStatus: 'synced',
      syncedAt: createdAt,
      createdAt,
      updatedAt: createdAt,
    });

    // Update merchant usage (we'll do this after all transactions are created)
  }

  // Update merchant usage counts and totals
  const merchantUsage: Record<string, { count: number; total: Decimal }> = {};
  for (const txn of demoTransactions) {
    if (txn.merchantId) {
      if (!merchantUsage[txn.merchantId]) {
        merchantUsage[txn.merchantId] = { count: 0, total: new Decimal(0) };
      }
      merchantUsage[txn.merchantId].count += 1;
      merchantUsage[txn.merchantId].total = merchantUsage[txn.merchantId].total.plus(txn.amount);
    }
  }

  // Update merchants with usage data
  for (const [merchantId, usage] of Object.entries(merchantUsage)) {
    const avgTransaction = usage.total.dividedBy(usage.count);
    await db
      .update(merchants)
      .set({
        usageCount: usage.count,
        totalSpent: usage.total.toNumber(),
        averageTransaction: avgTransaction.toNumber(),
        lastUsedAt: createdAt,
        updatedAt: createdAt,
      })
      .where(eq(merchants.id, merchantId));
  }

  // Update final account balances
  const checkingTxnCount = demoTransactions.filter((t) => t.accountId === checkingAccountId).length;
  const creditCardTxnCount = demoTransactions.filter((t) => t.accountId === creditCardAccountId).length;

  await db
    .update(accounts)
    .set({
      currentBalance: checkingBalance.toNumber(),
      lastUsedAt: createdAt,
      usageCount: checkingTxnCount,
      updatedAt: createdAt,
    })
    .where(eq(accounts.id, checkingAccountId));

  await db
    .update(accounts)
    .set({
      currentBalance: creditCardBalance.toNumber(),
      lastUsedAt: createdAt,
      usageCount: creditCardTxnCount,
      updatedAt: createdAt,
    })
    .where(eq(accounts.id, creditCardAccountId));

  return {
    accountsCreated: demoAccounts.length,
    categoriesCreated: demoCategories.length,
    billsCreated: demoBills.length,
    goalsCreated: demoGoals.length,
    debtsCreated: 1,
    transactionsCreated: demoTransactions.length,
    merchantsCreated: demoMerchants.length,
  };
}

