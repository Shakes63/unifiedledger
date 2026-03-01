/**
 * Seeds calendar-visible test data into the existing "Neudorf Houshold".
 * Adds transactions, bills (with occurrences spread across this month), and debts.
 *
 * Run with: pnpm tsx scripts/seed-calendar-test-data.ts
 */

import { nanoid } from 'nanoid';
import { db } from '../lib/db';
import {
  amountToCents,
  buildTransactionAmountFields,
} from '../lib/transactions/money-movement-service';
import {
  transactions,
  billTemplates,
  billOccurrences,
  debts,
  debtPayments,
  debtPayoffMilestones,
  savingsGoals,
  savingsMilestones,
} from '../lib/db/schema';

// ============================================================================
// CONSTANTS — existing household data
// ============================================================================

const HOUSEHOLD_ID = 'vPGi_zhrQYlvVzZR2WHhj';
const USER_ID = 'PcNM5aGGqhAYp6KdUbxlw0CRKMQmZy08';
const CHECKING_ID = 'dQV_C1V2BTOT8F61kESpq';
const SAVINGS_ID = 'kOx3btmdShItqN45f76AW';

const CAT = {
  salary: 'ti00DBiuEKZs1JbjTqTVt',
  bonus: 'wEPWXRs7COxc1-O6xY61-',
  investment: 've9f1xDriOVdqtAlHqRs-',
  otherIncome: 'W7q7TuKaYGAG92weF7UqE',
  groceries: '7xZDYqp8yE9pnmmB-VcyW',
  gas: 'hxRQaAnSqiWVUlDFEKCcR',
  diningOut: 'v342s5jm7CkjsteiXOh0L',
  entertainment: '22J0Z2wZYmY5rvDUKGZK_',
  shopping: 'xJVudVyl0Y_ksCd-Quilt',
  healthcare: 'Vo1O5QnLMyFGKCdg2jslr',
  rentMortgage: 'j7JjtfUiPS6eAVo6qPadz',
  utilities: '33irLqTkrJboZ7ZexPk-z',
  insurance: 'xMwx1ohzcgwfKhRDcJPSb',
  transportation: 'nUJxboKARBJbAf9CwMQP6',
  other: 'ots5m7rNP7Xzl8QExb1xW',
  emergencyFund: 'N5b-Z77toS6SEP9CHKjrl',
  vacation: 'QRjy5PQldDY9tHFXldQez',
  retirement: 'HXHscF7Nsr4wFsU96EebK',
};

// ============================================================================
// HELPERS
// ============================================================================

function ymd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function dayOfMonth(day: number, offsetMonths = 0): string {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() + offsetMonths, day);
  return ymd(d);
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return ymd(d);
}

function daysFromNow(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return ymd(d);
}

// ============================================================================
// SEED
// ============================================================================

async function seed() {
  const now = new Date();
  console.log('🌱 Seeding calendar test data into Neudorf Houshold...\n');

  // --------------------------------------------------------------------------
  // 1. TRANSACTIONS — spread across this month + some from last month
  // --------------------------------------------------------------------------
  console.log('💸 Creating transactions...');

  const txRows: Parameters<typeof db.insert<typeof transactions>>[0] extends (table: typeof transactions) => { values: (rows: infer R) => unknown } ? R : never[] = [];

  const txData: Array<{
    date: string;
    amount: number;
    type: 'income' | 'expense';
    description: string;
    categoryId: string;
  }> = [
    // ---- This month ----
    // Salary on the 1st
    { date: dayOfMonth(1), amount: 3200, type: 'income', description: 'Bi-weekly Paycheck', categoryId: CAT.salary },
    // Mid-month paycheck
    { date: dayOfMonth(15), amount: 3200, type: 'income', description: 'Bi-weekly Paycheck', categoryId: CAT.salary },
    // Freelance
    { date: dayOfMonth(8), amount: 750, type: 'income', description: 'Freelance - Design Project', categoryId: CAT.otherIncome },
    // Investment dividend
    { date: dayOfMonth(20), amount: 180, type: 'income', description: 'Dividend Income', categoryId: CAT.investment },

    // Expenses
    { date: dayOfMonth(2), amount: 127.34, type: 'expense', description: 'Whole Foods Market', categoryId: CAT.groceries },
    { date: dayOfMonth(5), amount: 52.10, type: 'expense', description: 'Shell Gas Station', categoryId: CAT.gas },
    { date: dayOfMonth(6), amount: 38.50, type: 'expense', description: 'Chipotle', categoryId: CAT.diningOut },
    { date: dayOfMonth(9), amount: 89.99, type: 'expense', description: 'Amazon - Household supplies', categoryId: CAT.shopping },
    { date: dayOfMonth(11), amount: 64.20, type: 'expense', description: 'Trader Joe\'s', categoryId: CAT.groceries },
    { date: dayOfMonth(13), amount: 15.99, type: 'expense', description: 'Netflix', categoryId: CAT.entertainment },
    { date: dayOfMonth(14), amount: 9.99, type: 'expense', description: 'Spotify', categoryId: CAT.entertainment },
    { date: dayOfMonth(16), amount: 48.70, type: 'expense', description: 'Shell Gas Station', categoryId: CAT.gas },
    { date: dayOfMonth(18), amount: 145.00, type: 'expense', description: 'Costco', categoryId: CAT.groceries },
    { date: dayOfMonth(19), amount: 22.50, type: 'expense', description: 'Starbucks - Team lunch', categoryId: CAT.diningOut },
    { date: dayOfMonth(21), amount: 95.00, type: 'expense', description: 'Dr. Smith Office Visit', categoryId: CAT.healthcare },
    { date: dayOfMonth(22), amount: 320.00, type: 'expense', description: 'Target - Clothing', categoryId: CAT.shopping },
    { date: dayOfMonth(24), amount: 72.30, type: 'expense', description: 'Whole Foods Market', categoryId: CAT.groceries },
    { date: dayOfMonth(26), amount: 44.80, type: 'expense', description: 'Shell Gas Station', categoryId: CAT.gas },
    // Today-ish
    { date: daysAgo(1), amount: 67.40, type: 'expense', description: 'Trader Joe\'s', categoryId: CAT.groceries },
    { date: daysAgo(2), amount: 180.50, type: 'expense', description: 'Gym Equipment - Amazon', categoryId: CAT.shopping },

    // ---- Last month ----
    { date: dayOfMonth(1, -1), amount: 3200, type: 'income', description: 'Bi-weekly Paycheck', categoryId: CAT.salary },
    { date: dayOfMonth(15, -1), amount: 3200, type: 'income', description: 'Bi-weekly Paycheck', categoryId: CAT.salary },
    { date: dayOfMonth(3, -1), amount: 109.20, type: 'expense', description: 'Whole Foods Market', categoryId: CAT.groceries },
    { date: dayOfMonth(7, -1), amount: 55.60, type: 'expense', description: 'Shell Gas Station', categoryId: CAT.gas },
    { date: dayOfMonth(10, -1), amount: 41.00, type: 'expense', description: 'Chili\'s Grill & Bar', categoryId: CAT.diningOut },
    { date: dayOfMonth(12, -1), amount: 199.99, type: 'expense', description: 'Best Buy - Headphones', categoryId: CAT.shopping },
    { date: dayOfMonth(16, -1), amount: 87.50, type: 'expense', description: 'Costco', categoryId: CAT.groceries },
    { date: dayOfMonth(20, -1), amount: 62.15, type: 'expense', description: 'Shell Gas Station', categoryId: CAT.gas },
    { date: dayOfMonth(23, -1), amount: 29.99, type: 'expense', description: 'Adobe Creative Cloud', categoryId: CAT.other },
    { date: dayOfMonth(28, -1), amount: 550, type: 'income', description: 'Tax Refund', categoryId: CAT.otherIncome },
  ];

  for (const tx of txData) {
    const cents = amountToCents(tx.type === 'income' ? tx.amount : -tx.amount);
    await db.insert(transactions).values({
      id: nanoid(),
      userId: USER_ID,
      householdId: HOUSEHOLD_ID,
      accountId: CHECKING_ID,
      categoryId: tx.categoryId,
      date: tx.date,
      ...buildTransactionAmountFields(cents),
      description: tx.description,
      type: tx.type,
      createdAt: `${tx.date}T12:00:00.000Z`,
      updatedAt: `${tx.date}T12:00:00.000Z`,
    });
  }
  console.log(`   ✓ ${txData.length} transactions\n`);

  // --------------------------------------------------------------------------
  // 2. BILLS — templates + occurrences across this month
  // --------------------------------------------------------------------------
  console.log('📄 Creating bills...');

  const billData = [
    { name: 'Rent',          amount: 2100,  dueDay: 1,  billType: 'expense' as const, catId: CAT.rentMortgage },
    { name: 'Electric Bill', amount: 138,   dueDay: 8,  billType: 'expense' as const, catId: CAT.utilities },
    { name: 'Water & Sewer', amount: 74,    dueDay: 12, billType: 'expense' as const, catId: CAT.utilities },
    { name: 'Internet',      amount: 79.99, dueDay: 5,  billType: 'expense' as const, catId: CAT.utilities },
    { name: 'Phone Bill',    amount: 110,   dueDay: 10, billType: 'expense' as const, catId: CAT.utilities },
    { name: 'Car Insurance', amount: 175,   dueDay: 18, billType: 'expense' as const, catId: CAT.insurance },
    { name: 'Netflix',       amount: 15.99, dueDay: 13, billType: 'expense' as const, catId: CAT.entertainment },
    { name: 'Spotify',       amount: 9.99,  dueDay: 13, billType: 'expense' as const, catId: CAT.entertainment },
    { name: 'Gym Membership',amount: 50,    dueDay: 1,  billType: 'expense' as const, catId: CAT.healthcare },
    { name: 'HOA Dues',      amount: 250,   dueDay: 25, billType: 'expense' as const, catId: CAT.other },
    { name: 'Renter\'s Insurance', amount: 22, dueDay: 3, billType: 'expense' as const, catId: CAT.insurance },
  ];

  const today = now.getDate();

  for (const bill of billData) {
    const templateId = nanoid();

    await db.insert(billTemplates).values({
      id: templateId,
      createdByUserId: USER_ID,
      householdId: HOUSEHOLD_ID,
      name: bill.name,
      categoryId: bill.catId,
      defaultAmountCents: amountToCents(bill.amount),
      recurrenceType: 'monthly',
      recurrenceDueDay: bill.dueDay,
      billType: bill.billType,
      classification: 'utility',
      paymentAccountId: CHECKING_ID,
      isActive: true,
      autoMarkPaid: false,
      createdAt: dayOfMonth(1, -3),
      updatedAt: dayOfMonth(1, -3),
    });

    // Generate 3 months of occurrences: last month (some overdue/paid), this month, next month
    for (let offset = -1; offset <= 1; offset++) {
      const d = new Date(now.getFullYear(), now.getMonth() + offset, Math.min(bill.dueDay, 28));
      const dueDateStr = ymd(d);
      const isInPast = d < now;
      const isThisMonth = d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();

      let status: 'unpaid' | 'paid' | 'overdue';
      let paidDate: string | null = null;
      let txId: string | null = null;

      if (offset < 0) {
        // Last month — randomly paid or overdue
        const paid = Math.random() > 0.3;
        if (paid) {
          status = 'paid';
          paidDate = ymd(new Date(d.getFullYear(), d.getMonth(), d.getDate() + Math.floor(Math.random() * 4)));
          txId = nanoid();
          await db.insert(transactions).values({
            id: txId,
            userId: USER_ID,
            householdId: HOUSEHOLD_ID,
            accountId: CHECKING_ID,
            categoryId: bill.catId,
            date: paidDate,
            ...buildTransactionAmountFields(amountToCents(-bill.amount)),
            description: `${bill.name} Payment`,
            type: 'expense',
            createdAt: `${paidDate}T10:00:00.000Z`,
            updatedAt: `${paidDate}T10:00:00.000Z`,
          });
        } else {
          status = 'overdue';
        }
      } else if (isThisMonth && bill.dueDay < today) {
        // Due this month, due date already passed — overdue (unpaid) or pending
        const paid = Math.random() > 0.5;
        if (paid) {
          status = 'paid';
          paidDate = ymd(d);
          txId = nanoid();
          await db.insert(transactions).values({
            id: txId,
            userId: USER_ID,
            householdId: HOUSEHOLD_ID,
            accountId: CHECKING_ID,
            categoryId: bill.catId,
            date: paidDate,
            ...buildTransactionAmountFields(amountToCents(-bill.amount)),
            description: `${bill.name} Payment`,
            type: 'expense',
            createdAt: `${paidDate}T10:00:00.000Z`,
            updatedAt: `${paidDate}T10:00:00.000Z`,
          });
        } else {
          status = 'overdue';
        }
      } else if (isThisMonth || (!isInPast)) {
        status = 'unpaid';
      } else {
        status = 'unpaid';
      }

      const dueCents = amountToCents(bill.amount);
      const paidCents = status === 'paid' ? dueCents : 0;
      await db.insert(billOccurrences).values({
        id: nanoid(),
        householdId: HOUSEHOLD_ID,
        templateId,
        dueDate: dueDateStr,
        amountDueCents: dueCents,
        amountPaidCents: paidCents,
        amountRemainingCents: status === 'paid' ? 0 : dueCents,
        actualAmountCents: status === 'paid' ? dueCents : null,
        paidDate,
        status,
        lastTransactionId: txId,
        createdAt: dueDateStr,
        updatedAt: dueDateStr,
      });
    }
  }
  console.log(`   ✓ ${billData.length} bill templates with occurrences\n`);

  // --------------------------------------------------------------------------
  // 3. DEBTS
  // --------------------------------------------------------------------------
  console.log('💳 Creating debts...');

  const debtData = [
    {
      name: 'Visa Credit Card',
      creditorName: 'Chase Bank',
      originalAmount: 8500,
      remainingBalance: 4320.75,
      minimumPayment: 125,
      interestRate: 19.99,
      interestType: 'variable' as const,
      type: 'credit_card' as const,
      startDate: dayOfMonth(1, -18),
      color: '#ef4444',
    },
    {
      name: 'Car Loan',
      creditorName: 'Bank of America Auto',
      originalAmount: 22000,
      remainingBalance: 14800,
      minimumPayment: 385,
      interestRate: 4.9,
      interestType: 'fixed' as const,
      type: 'auto_loan' as const,
      startDate: dayOfMonth(1, -24),
      color: '#f97316',
    },
    {
      name: 'Student Loan',
      creditorName: 'Navient',
      originalAmount: 35000,
      remainingBalance: 22450,
      minimumPayment: 320,
      interestRate: 5.5,
      interestType: 'fixed' as const,
      type: 'student_loan' as const,
      startDate: dayOfMonth(1, -48),
      color: '#8b5cf6',
    },
  ];

  for (const debt of debtData) {
    const debtId = nanoid();

    await db.insert(debts).values({
      id: debtId,
      userId: USER_ID,
      householdId: HOUSEHOLD_ID,
      name: debt.name,
      creditorName: debt.creditorName,
      originalAmount: debt.originalAmount,
      remainingBalance: debt.remainingBalance,
      minimumPayment: debt.minimumPayment,
      interestRate: debt.interestRate,
      interestType: debt.interestType,
      type: debt.type,
      accountId: null,
      categoryId: CAT.other,
      startDate: debt.startDate,
      color: debt.color,
      status: 'active',
      createdAt: debt.startDate,
      updatedAt: debt.startDate,
    });

    // Last 6 months of payments
    for (let i = 5; i >= 0; i--) {
      const payDate = dayOfMonth(15, -i);
      const extra = Math.random() < 0.25 ? Math.round(Math.random() * 200 + 50) : 0;
      const total = debt.minimumPayment + extra;
      await db.insert(debtPayments).values({
        id: nanoid(),
        debtId,
        userId: USER_ID,
        householdId: HOUSEHOLD_ID,
        amount: total,
        principalAmount: total * 0.65,
        interestAmount: total * 0.35,
        paymentDate: payDate,
        createdAt: payDate,
      });
    }

    // Payoff milestones — 25/50/75/100%
    const paidOff = debt.originalAmount - debt.remainingBalance;
    for (const pct of [25, 50, 75, 100]) {
      const threshold = debt.originalAmount * (pct / 100);
      const achieved = paidOff >= threshold;
      await db.insert(debtPayoffMilestones).values({
        id: nanoid(),
        debtId,
        userId: USER_ID,
        householdId: HOUSEHOLD_ID,
        percentage: pct,
        milestoneBalance: debt.originalAmount - threshold,
        achievedAt: achieved ? daysAgo(Math.floor(Math.random() * 90 + 10)) : null,
        createdAt: debt.startDate,
      });
    }
  }
  console.log(`   ✓ ${debtData.length} debts with payment history\n`);

  // --------------------------------------------------------------------------
  // 4. SAVINGS GOALS
  // --------------------------------------------------------------------------
  console.log('🎯 Creating savings goals...');

  const goalData = [
    { name: 'Emergency Fund', target: 15000, current: 8200, cat: 'emergency_fund' as const, targetDate: dayOfMonth(1, 8) },
    { name: 'Europe Vacation', target: 6000, current: 2400, cat: 'vacation' as const, targetDate: dayOfMonth(1, 10) },
    { name: 'New Car Down Payment', target: 10000, current: 3800, cat: 'vehicle' as const, targetDate: dayOfMonth(1, 14) },
  ];

  for (const goal of goalData) {
    const goalId = nanoid();
    await db.insert(savingsGoals).values({
      id: goalId,
      userId: USER_ID,
      householdId: HOUSEHOLD_ID,
      name: goal.name,
      targetAmount: goal.target,
      currentAmount: goal.current,
      accountId: SAVINGS_ID,
      category: goal.cat,
      status: 'active',
      targetDate: goal.targetDate,
      monthlyContribution: Math.round((goal.target - goal.current) / 12),
      createdAt: dayOfMonth(1, -6),
      updatedAt: now.toISOString(),
    });

    for (const pct of [25, 50, 75, 100]) {
      const milestone = goal.target * (pct / 100);
      const achieved = goal.current >= milestone;
      await db.insert(savingsMilestones).values({
        id: nanoid(),
        goalId,
        userId: USER_ID,
        householdId: HOUSEHOLD_ID,
        percentage: pct,
        milestoneAmount: milestone,
        achievedAt: achieved ? daysAgo(Math.floor(Math.random() * 60 + 5)) : null,
        createdAt: dayOfMonth(1, -6),
      });
    }
  }
  console.log(`   ✓ ${goalData.length} savings goals\n`);

  console.log('✅ Done! Reload the calendar to see the new data.');
}

seed()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
