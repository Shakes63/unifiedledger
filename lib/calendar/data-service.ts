import { addDays, addMonths, format, subDays } from 'date-fns';
import { and, eq, gte, inArray, isNotNull, lte } from 'drizzle-orm';

import { db } from '@/lib/db';
import {
  accounts,
  autopayRules,
  billMilestones,
  billOccurrences,
  billTemplates,
  budgetCategories,
  debtPayoffMilestones,
  debts,
  merchants,
  savingsGoals,
  transactions,
} from '@/lib/db/schema';
import { parseLocalDateString, toLocalDateString } from '@/lib/utils/local-date';
import { toMoneyCents } from '@/lib/utils/money-cents';

export interface GoalSummary {
  id: string;
  name: string;
  color: string;
  targetAmount: number;
  currentAmount: number;
  progress: number;
  status: string;
}

export interface DebtSummary {
  id: string;
  name: string;
  color: string;
  remainingBalance: number;
  originalAmount: number;
  progress: number;
  type: 'target' | 'milestone';
  milestonePercentage?: number;
  status: string;
}

export interface AutopayEventSummary {
  id: string;
  billId: string;
  billName: string;
  amount: number;
  autopayAmountType: 'fixed' | 'minimum_payment' | 'statement_balance' | 'full_balance';
  sourceAccountId: string;
  sourceAccountName: string;
  linkedAccountName?: string;
}

export interface UnifiedPayoffDateSummary {
  id: string;
  name: string;
  source: 'account' | 'bill';
  sourceType: string;
  remainingBalance: number;
  monthlyPayment: number;
  color?: string;
}

export interface BillMilestoneSummary {
  id: string;
  billId?: string;
  accountId?: string;
  name: string;
  percentage: number;
  achievedAt?: string;
  color?: string;
}

export interface BillSummary {
  name: string;
  status: string;
  amount: number;
  isDebt?: boolean;
  isAutopayEnabled?: boolean;
  linkedAccountName?: string;
  billType?: 'expense' | 'income' | 'savings_transfer';
}

export interface DayTransactionSummary {
  incomeCount: number;
  expenseCount: number;
  transferCount: number;
  totalSpent: number;
  billDueCount: number;
  billOverdueCount: number;
  bills?: BillSummary[];
  goalCount: number;
  goals?: GoalSummary[];
  debtCount: number;
  debts?: DebtSummary[];
  autopayCount: number;
  autopayEvents?: AutopayEventSummary[];
  payoffDateCount: number;
  payoffDates?: UnifiedPayoffDateSummary[];
  billMilestoneCount: number;
  billMilestones?: BillMilestoneSummary[];
}

export interface CalendarTransactionDetail {
  id: string;
  description: string;
  amount: number;
  type: 'income' | 'expense' | 'transfer_in' | 'transfer_out';
  category?: string;
  merchant?: string | null;
  accountName?: string;
}

export interface CalendarBillDetail {
  id: string;
  billId?: string;
  description: string;
  amount: number;
  dueDate: string;
  status: 'pending' | 'paid' | 'overdue';
  isDebt?: boolean;
  isAutopayEnabled?: boolean;
  linkedAccountName?: string;
  billType?: 'expense' | 'income' | 'savings_transfer';
}

export interface CalendarGoalDetail {
  id: string;
  name: string;
  description?: string | null;
  targetAmount: number;
  currentAmount: number;
  progress: number;
  color: string;
  icon: string;
  status: string;
  category?: string | null;
}

export interface CalendarDebtDetail {
  id: string;
  name: string;
  description?: string | null;
  creditorName: string;
  remainingBalance: number;
  originalAmount: number;
  progress: number;
  color: string;
  icon: string;
  type: string;
  status: string;
  debtType: 'target' | 'milestone';
  milestonePercentage?: number;
  source?: 'debt' | 'account' | 'bill';
}

export interface CalendarAutopayEventDetail {
  id: string;
  billId: string;
  billInstanceId: string;
  billName: string;
  amount: number;
  autopayAmountType: string;
  sourceAccountId: string;
  sourceAccountName: string;
  linkedAccountId?: string;
  linkedAccountName?: string;
  dueDate: string;
}

export interface CalendarPayoffDateDetail {
  id: string;
  name: string;
  source: 'account' | 'bill';
  sourceType: string;
  remainingBalance: number;
  monthlyPayment: number;
  projectedPayoffDate: string;
  color?: string;
  interestRate?: number;
}

export interface CalendarBillMilestoneDetail {
  id: string;
  billId?: string;
  accountId?: string;
  name: string;
  percentage: number;
  achievedAt: string;
  color?: string;
  milestoneBalance: number;
  source: 'account' | 'bill';
}

function createEmptyDaySummary(): DayTransactionSummary {
  return {
    incomeCount: 0,
    expenseCount: 0,
    transferCount: 0,
    totalSpent: 0,
    billDueCount: 0,
    billOverdueCount: 0,
    bills: [],
    goalCount: 0,
    goals: [],
    debtCount: 0,
    debts: [],
    autopayCount: 0,
    autopayEvents: [],
    payoffDateCount: 0,
    payoffDates: [],
    billMilestoneCount: 0,
    billMilestones: [],
  };
}

function mapOccurrenceStatusToLegacy(
  status: 'unpaid' | 'partial' | 'paid' | 'overpaid' | 'overdue' | 'skipped'
): 'pending' | 'paid' | 'overdue' {
  if (status === 'paid' || status === 'overpaid') return 'paid';
  if (status === 'overdue') return 'overdue';
  return 'pending';
}

function upsertSummary(
  daySummaries: Record<string, DayTransactionSummary>,
  dateKey: string
): DayTransactionSummary {
  if (!daySummaries[dateKey]) {
    daySummaries[dateKey] = createEmptyDaySummary();
  }
  return daySummaries[dateKey];
}

function centsToDollars(cents: number | null | undefined): number {
  return (cents ?? 0) / 100;
}

export async function getMonthCalendarSummary(params: {
  userId: string;
  householdId: string;
  startDate: string;
  endDate: string;
}): Promise<Record<string, DayTransactionSummary>> {
  const { userId, householdId, startDate, endDate } = params;
  const daySummaries: Record<string, DayTransactionSummary> = {};

  const [monthTransactions, occurrencesWithTemplates, monthGoals, monthDebts, monthMilestones, unifiedMilestones] =
    await Promise.all([
      db
        .select()
        .from(transactions)
        .where(
          and(
            eq(transactions.userId, userId),
            eq(transactions.householdId, householdId),
            gte(transactions.date, startDate),
            lte(transactions.date, endDate)
          )
        ),
      db
        .select({
          occurrence: billOccurrences,
          template: billTemplates,
        })
        .from(billOccurrences)
        .innerJoin(billTemplates, eq(billOccurrences.templateId, billTemplates.id))
        .where(
          and(
            eq(billOccurrences.householdId, householdId),
            eq(billTemplates.householdId, householdId),
            gte(billOccurrences.dueDate, startDate),
            lte(billOccurrences.dueDate, endDate)
          )
        ),
      db
        .select()
        .from(savingsGoals)
        .where(
          and(
            eq(savingsGoals.userId, userId),
            eq(savingsGoals.householdId, householdId),
            isNotNull(savingsGoals.targetDate),
            gte(savingsGoals.targetDate, startDate),
            lte(savingsGoals.targetDate, endDate)
          )
        ),
      db
        .select()
        .from(debts)
        .where(
          and(
            eq(debts.userId, userId),
            eq(debts.householdId, householdId),
            isNotNull(debts.targetPayoffDate),
            gte(debts.targetPayoffDate, startDate),
            lte(debts.targetPayoffDate, endDate)
          )
        ),
      db
        .select({
          milestone: debtPayoffMilestones,
          debt: debts,
        })
        .from(debtPayoffMilestones)
        .innerJoin(debts, eq(debtPayoffMilestones.debtId, debts.id))
        .where(
          and(
            eq(debtPayoffMilestones.userId, userId),
            eq(debtPayoffMilestones.householdId, householdId),
            eq(debts.userId, userId),
            eq(debts.householdId, householdId),
            isNotNull(debtPayoffMilestones.achievedAt),
            gte(debtPayoffMilestones.achievedAt, `${startDate}T00:00:00`),
            lte(debtPayoffMilestones.achievedAt, `${endDate}T23:59:59`)
          )
        ),
      db
        .select()
        .from(billMilestones)
        .where(
          and(
            eq(billMilestones.userId, userId),
            eq(billMilestones.householdId, householdId),
            isNotNull(billMilestones.achievedAt),
            gte(billMilestones.achievedAt, `${startDate}T00:00:00`),
            lte(billMilestones.achievedAt, `${endDate}T23:59:59`)
          )
        ),
    ]);

  for (const txn of monthTransactions) {
    const summary = upsertSummary(daySummaries, txn.date);
    if (txn.type === 'income') {
      summary.incomeCount++;
    } else if (txn.type === 'expense') {
      summary.expenseCount++;
      summary.totalSpent += Math.abs(parseFloat(txn.amount?.toString() || '0'));
    } else if (txn.type === 'transfer_in' || txn.type === 'transfer_out') {
      summary.transferCount++;
    }
  }

  const templateIds = [...new Set(occurrencesWithTemplates.map((row) => row.template.id))];
  const linkedAccountIds = [
    ...new Set(
      occurrencesWithTemplates
        .map((row) => row.template.linkedLiabilityAccountId)
        .filter((id): id is string => Boolean(id))
    ),
  ];
  const autopayRulesRows =
    templateIds.length > 0
      ? await db
          .select()
          .from(autopayRules)
          .where(
            and(
              eq(autopayRules.householdId, householdId),
              eq(autopayRules.isEnabled, true),
              inArray(autopayRules.templateId, templateIds)
            )
          )
      : [];
  const autopayAccountIds = [
    ...new Set(autopayRulesRows.map((row) => row.payFromAccountId).filter((id): id is string => Boolean(id))),
  ];
  const allAccountIds = [...new Set([...linkedAccountIds, ...autopayAccountIds])];

  const accountRows =
    allAccountIds.length > 0
      ? await db
          .select()
          .from(accounts)
          .where(
            and(
              eq(accounts.userId, userId),
              eq(accounts.householdId, householdId),
              inArray(accounts.id, allAccountIds)
            )
          )
      : [];

  const accountMap = new Map(accountRows.map((row) => [row.id, row]));
  const autopayRuleMap = new Map(autopayRulesRows.map((row) => [row.templateId, row]));

  for (const row of occurrencesWithTemplates) {
    const { occurrence, template } = row;
    const summary = upsertSummary(daySummaries, occurrence.dueDate);
    const linkedAccountName = template.linkedLiabilityAccountId
      ? accountMap.get(template.linkedLiabilityAccountId)?.name
      : undefined;

    summary.bills = summary.bills || [];
    summary.bills.push({
      name: template.name,
      status: mapOccurrenceStatusToLegacy(occurrence.status),
      amount: centsToDollars(occurrence.amountDueCents),
      isDebt: template.debtEnabled || false,
      isAutopayEnabled: autopayRuleMap.has(template.id),
      linkedAccountName,
      billType: template.billType,
    });

    if (occurrence.status === 'overdue') {
      summary.billOverdueCount++;
    } else if (occurrence.status === 'unpaid' || occurrence.status === 'partial') {
      summary.billDueCount++;
    }

    const autopayRule = autopayRuleMap.get(template.id);
    if (!autopayRule) continue;
    const autopayDate = format(subDays(new Date(occurrence.dueDate), autopayRule.daysBeforeDue || 0), 'yyyy-MM-dd');
    if (autopayDate < startDate || autopayDate > endDate) continue;

    const autopaySummary = upsertSummary(daySummaries, autopayDate);
    const sourceAccount = accountMap.get(autopayRule.payFromAccountId);
    const autopayAmount =
      autopayRule.amountType === 'fixed'
        ? centsToDollars(autopayRule.fixedAmountCents)
        : centsToDollars(occurrence.amountRemainingCents || occurrence.amountDueCents);

    autopaySummary.autopayEvents = autopaySummary.autopayEvents || [];
    autopaySummary.autopayEvents.push({
      id: `autopay-${occurrence.id}`,
      billId: template.id,
      billName: template.name,
      amount: autopayAmount,
      autopayAmountType: autopayRule.amountType,
      sourceAccountId: autopayRule.payFromAccountId,
      sourceAccountName: sourceAccount?.name || 'Unknown Account',
      linkedAccountName,
    });
    autopaySummary.autopayCount++;
  }

  for (const goal of monthGoals) {
    if (!goal.targetDate) continue;
    const summary = upsertSummary(daySummaries, goal.targetDate);
    const targetAmount = goal.targetAmount || 0;
    const currentAmount = goal.currentAmount || 0;
    const progress = targetAmount > 0 ? Math.round((currentAmount / targetAmount) * 100) : 0;
    summary.goals = summary.goals || [];
    summary.goals.push({
      id: goal.id,
      name: goal.name,
      color: goal.color || '#10b981',
      targetAmount,
      currentAmount,
      progress,
      status: goal.status || 'active',
    });
    summary.goalCount++;
  }

  for (const debt of monthDebts) {
    if (!debt.targetPayoffDate) continue;
    const summary = upsertSummary(daySummaries, debt.targetPayoffDate);
    const originalAmount = debt.originalAmount || 0;
    const remainingBalance = debt.remainingBalance || 0;
    const progress = originalAmount > 0 ? Math.round(((originalAmount - remainingBalance) / originalAmount) * 100) : 0;
    summary.debts = summary.debts || [];
    summary.debts.push({
      id: debt.id,
      name: debt.name,
      color: debt.color || '#ef4444',
      remainingBalance,
      originalAmount,
      progress,
      type: 'target',
      status: debt.status || 'active',
    });
    summary.debtCount++;
  }

  for (const { milestone, debt } of monthMilestones) {
    if (!milestone.achievedAt) continue;
    const summary = upsertSummary(daySummaries, toLocalDateString(new Date(milestone.achievedAt)));
    summary.debts = summary.debts || [];
    summary.debts.push({
      id: `${debt.id}-milestone-${milestone.percentage}`,
      name: `${debt.name} - ${milestone.percentage}% Paid Off!`,
      color: debt.color || '#ef4444',
      remainingBalance: debt.remainingBalance || 0,
      originalAmount: debt.originalAmount || 0,
      progress: milestone.percentage,
      type: 'milestone',
      milestonePercentage: milestone.percentage,
      status: debt.status || 'active',
    });
    summary.debtCount++;
  }

  const [creditAccounts, debtBillTemplates] = await Promise.all([
    db
      .select()
      .from(accounts)
      .where(
        and(
          eq(accounts.userId, userId),
          eq(accounts.householdId, householdId),
          inArray(accounts.type, ['credit', 'line_of_credit']),
          eq(accounts.isActive, true)
        )
      ),
    db
      .select()
      .from(billTemplates)
      .where(
        and(eq(billTemplates.householdId, householdId), eq(billTemplates.isActive, true), eq(billTemplates.debtEnabled, true))
      ),
  ]);

  const unifiedDebts: Array<{
    id: string;
    name: string;
    source: 'account' | 'bill';
    sourceType: string;
    remainingBalance: number;
    monthlyPayment: number;
    color?: string;
  }> = [];

  for (const account of creditAccounts) {
    const balance = Math.abs(account.currentBalanceCents ?? toMoneyCents(account.currentBalance) ?? 0) / 100;
    const monthlyPayment = account.budgetedMonthlyPayment || account.minimumPaymentAmount || 0;
    if (balance <= 0 || monthlyPayment <= 0) continue;
    unifiedDebts.push({
      id: account.id,
      name: account.name,
      source: 'account',
      sourceType: account.type,
      remainingBalance: balance,
      monthlyPayment,
      color: account.color || undefined,
    });
  }

  for (const template of debtBillTemplates) {
    const balance = centsToDollars(template.debtRemainingBalanceCents);
    const monthlyPayment = centsToDollars(template.defaultAmountCents);
    if (balance <= 0 || monthlyPayment <= 0) continue;
    unifiedDebts.push({
      id: template.id,
      name: template.name,
      source: 'bill',
      sourceType: template.classification,
      remainingBalance: balance,
      monthlyPayment,
      color: template.debtColor || undefined,
    });
  }

  for (const debt of unifiedDebts) {
    const monthsToPayoff = Math.ceil(debt.remainingBalance / debt.monthlyPayment);
    const payoffDate = format(addMonths(new Date(), monthsToPayoff), 'yyyy-MM-dd');
    if (payoffDate < startDate || payoffDate > endDate) continue;
    const summary = upsertSummary(daySummaries, payoffDate);
    summary.payoffDates = summary.payoffDates || [];
    summary.payoffDates.push({
      id: debt.id,
      name: debt.name,
      source: debt.source,
      sourceType: debt.sourceType,
      remainingBalance: debt.remainingBalance,
      monthlyPayment: debt.monthlyPayment,
      color: debt.color,
    });
    summary.payoffDateCount++;
  }

  const milestoneBillIds = [
    ...new Set(unifiedMilestones.map((m) => m.billId).filter((id): id is string => Boolean(id))),
  ];
  const milestoneAccountIds = [
    ...new Set(unifiedMilestones.map((m) => m.accountId).filter((id): id is string => Boolean(id))),
  ];
  const [milestoneBills, milestoneAccounts] = await Promise.all([
    milestoneBillIds.length > 0
      ? db
          .select()
          .from(billTemplates)
          .where(and(eq(billTemplates.householdId, householdId), inArray(billTemplates.id, milestoneBillIds)))
      : Promise.resolve([]),
    milestoneAccountIds.length > 0
      ? db
          .select()
          .from(accounts)
          .where(
            and(eq(accounts.userId, userId), eq(accounts.householdId, householdId), inArray(accounts.id, milestoneAccountIds))
          )
      : Promise.resolve([]),
  ]);
  const milestoneBillMap = new Map(milestoneBills.map((b) => [b.id, b]));
  const milestoneAccountMap = new Map(milestoneAccounts.map((a) => [a.id, a]));

  for (const milestone of unifiedMilestones) {
    if (!milestone.achievedAt) continue;
    const summary = upsertSummary(daySummaries, toLocalDateString(new Date(milestone.achievedAt)));
    let name = 'Unknown';
    let color: string | undefined;
    if (milestone.billId) {
      const bill = milestoneBillMap.get(milestone.billId);
      if (bill) {
        name = bill.name;
        color = bill.debtColor || undefined;
      }
    } else if (milestone.accountId) {
      const account = milestoneAccountMap.get(milestone.accountId);
      if (account) {
        name = account.name;
        color = account.color || undefined;
      }
    }
    summary.billMilestones = summary.billMilestones || [];
    summary.billMilestones.push({
      id: milestone.id,
      billId: milestone.billId || undefined,
      accountId: milestone.accountId || undefined,
      name: `${name} - ${milestone.percentage}% Paid Off!`,
      percentage: milestone.percentage,
      achievedAt: milestone.achievedAt,
      color,
    });
    summary.billMilestoneCount++;
  }

  return daySummaries;
}

export async function getDayCalendarDetails(params: {
  userId: string;
  householdId: string;
  dateKey: string;
}) {
  const { userId, householdId, dateKey } = params;
  // Milestones are stored as UTC timestamps, but calendar day selection is local-date based.
  // Query a small surrounding window and then filter by local date to avoid day-boundary mismatches.
  const selectedLocalDate = parseLocalDateString(dateKey);
  const milestoneWindowStart = format(subDays(selectedLocalDate, 1), 'yyyy-MM-dd');
  const milestoneWindowEnd = format(addDays(selectedLocalDate, 1), 'yyyy-MM-dd');

  const [dayTransactions, dayOccurrencesRows, dayGoals, dayDebts, dayMilestones, dayBillMilestones] = await Promise.all([
    db
      .select()
      .from(transactions)
      .where(and(eq(transactions.userId, userId), eq(transactions.householdId, householdId), eq(transactions.date, dateKey))),
    db
      .select({
        occurrence: billOccurrences,
        template: billTemplates,
      })
      .from(billOccurrences)
      .innerJoin(billTemplates, eq(billOccurrences.templateId, billTemplates.id))
      .where(
        and(
          eq(billOccurrences.householdId, householdId),
          eq(billTemplates.householdId, householdId),
          eq(billOccurrences.dueDate, dateKey)
        )
      ),
    db
      .select()
      .from(savingsGoals)
      .where(and(eq(savingsGoals.userId, userId), eq(savingsGoals.householdId, householdId), eq(savingsGoals.targetDate, dateKey))),
    db
      .select()
      .from(debts)
      .where(and(eq(debts.userId, userId), eq(debts.householdId, householdId), eq(debts.targetPayoffDate, dateKey))),
    db
      .select({
        milestone: debtPayoffMilestones,
        debt: debts,
      })
      .from(debtPayoffMilestones)
      .innerJoin(debts, eq(debtPayoffMilestones.debtId, debts.id))
      .where(
        and(
          eq(debtPayoffMilestones.userId, userId),
          eq(debtPayoffMilestones.householdId, householdId),
          eq(debts.userId, userId),
          eq(debts.householdId, householdId),
          isNotNull(debtPayoffMilestones.achievedAt),
          gte(debtPayoffMilestones.achievedAt, `${milestoneWindowStart}T00:00:00`),
          lte(debtPayoffMilestones.achievedAt, `${milestoneWindowEnd}T23:59:59`)
        )
      ),
    db
      .select()
      .from(billMilestones)
      .where(
        and(
          eq(billMilestones.userId, userId),
          eq(billMilestones.householdId, householdId),
          isNotNull(billMilestones.achievedAt),
          gte(billMilestones.achievedAt, `${milestoneWindowStart}T00:00:00`),
          lte(billMilestones.achievedAt, `${milestoneWindowEnd}T23:59:59`)
        )
      ),
  ]);

  const categoryIds = [...new Set(dayTransactions.map((txn) => txn.categoryId).filter((id): id is string => Boolean(id)))];
  const merchantIds = [...new Set(dayTransactions.map((txn) => txn.merchantId).filter((id): id is string => Boolean(id)))];
  const accountIdsFromTx = [...new Set(dayTransactions.map((txn) => txn.accountId).filter((id): id is string => Boolean(id)))];

  const templateIds = [...new Set(dayOccurrencesRows.map((row) => row.template.id))];
  const linkedAccountIds = [
    ...new Set(
      dayOccurrencesRows.map((row) => row.template.linkedLiabilityAccountId).filter((id): id is string => Boolean(id))
    ),
  ];
  const autopayRulesRows =
    templateIds.length > 0
      ? await db
          .select()
          .from(autopayRules)
          .where(
            and(
              eq(autopayRules.householdId, householdId),
              eq(autopayRules.isEnabled, true),
              inArray(autopayRules.templateId, templateIds)
            )
          )
      : [];
  const autopayAccountIds = [
    ...new Set(autopayRulesRows.map((row) => row.payFromAccountId).filter((id): id is string => Boolean(id))),
  ];
  const allAccountIds = [...new Set([...accountIdsFromTx, ...linkedAccountIds, ...autopayAccountIds])];

  const [categoriesRows, merchantsRows, accountsRows] = await Promise.all([
    categoryIds.length > 0
      ? db
          .select()
          .from(budgetCategories)
          .where(
            and(eq(budgetCategories.householdId, householdId), eq(budgetCategories.userId, userId), inArray(budgetCategories.id, categoryIds))
          )
      : Promise.resolve([]),
    merchantIds.length > 0
      ? db
          .select()
          .from(merchants)
          .where(and(eq(merchants.householdId, householdId), inArray(merchants.id, merchantIds)))
      : Promise.resolve([]),
    allAccountIds.length > 0
      ? db
          .select()
          .from(accounts)
          .where(and(eq(accounts.userId, userId), eq(accounts.householdId, householdId), inArray(accounts.id, allAccountIds)))
      : Promise.resolve([]),
  ]);

  const categoryMap = new Map(categoriesRows.map((row) => [row.id, row]));
  const merchantMap = new Map(merchantsRows.map((row) => [row.id, row]));
  const accountMap = new Map(accountsRows.map((row) => [row.id, row]));
  const autopayRuleMap = new Map(autopayRulesRows.map((row) => [row.templateId, row]));

  const enrichedTransactions: CalendarTransactionDetail[] = dayTransactions.map((txn) => ({
    id: txn.id,
    description: txn.description,
    amount: parseFloat(txn.amount?.toString() || '0'),
    type: txn.type as 'income' | 'expense' | 'transfer_in' | 'transfer_out',
    category:
      txn.categoryId && txn.categoryId !== 'transfer_in' && txn.categoryId !== 'transfer_out'
        ? categoryMap.get(txn.categoryId)?.name
        : undefined,
    merchant: txn.merchantId ? merchantMap.get(txn.merchantId)?.name || null : null,
    accountName: txn.accountId ? accountMap.get(txn.accountId)?.name : undefined,
  }));

  const enrichedBills: CalendarBillDetail[] = dayOccurrencesRows.map((row) => {
    const linkedAccountName = row.template.linkedLiabilityAccountId
      ? accountMap.get(row.template.linkedLiabilityAccountId)?.name
      : undefined;
    return {
      id: row.occurrence.id,
      billId: row.template.id,
      description: row.template.name,
      amount: centsToDollars(row.occurrence.amountDueCents),
      dueDate: row.occurrence.dueDate,
      status: mapOccurrenceStatusToLegacy(row.occurrence.status),
      isDebt: row.template.debtEnabled || false,
      isAutopayEnabled: autopayRuleMap.has(row.template.id),
      linkedAccountName,
      billType: row.template.billType,
    };
  });

  const autopayEvents = dayOccurrencesRows
    .map<CalendarAutopayEventDetail | null>((row) => {
      const rule = autopayRuleMap.get(row.template.id);
      if (!rule) return null;
      const autopayDate = format(subDays(new Date(row.occurrence.dueDate), rule.daysBeforeDue || 0), 'yyyy-MM-dd');
      if (autopayDate !== dateKey) return null;
      return {
        id: `autopay-${row.occurrence.id}`,
        billId: row.template.id,
        billInstanceId: row.occurrence.id,
        billName: row.template.name,
        amount:
          rule.amountType === 'fixed'
            ? centsToDollars(rule.fixedAmountCents)
            : centsToDollars(row.occurrence.amountRemainingCents || row.occurrence.amountDueCents),
        autopayAmountType: rule.amountType,
        sourceAccountId: rule.payFromAccountId,
        sourceAccountName: accountMap.get(rule.payFromAccountId)?.name || 'Unknown Account',
        linkedAccountId: row.template.linkedLiabilityAccountId || undefined,
        linkedAccountName: row.template.linkedLiabilityAccountId
          ? accountMap.get(row.template.linkedLiabilityAccountId)?.name
          : undefined,
        dueDate: row.occurrence.dueDate,
      };
    })
    .filter((event): event is CalendarAutopayEventDetail => Boolean(event));

  const enrichedGoals: CalendarGoalDetail[] = dayGoals.map((goal) => {
    const targetAmount = goal.targetAmount || 0;
    const currentAmount = goal.currentAmount || 0;
    const progress = targetAmount > 0 ? Math.round((currentAmount / targetAmount) * 100) : 0;
    return {
      id: goal.id,
      name: goal.name,
      description: goal.description,
      targetAmount,
      currentAmount,
      progress,
      color: goal.color || '#10b981',
      icon: goal.icon || 'target',
      status: goal.status || 'active',
      category: goal.category,
    };
  });

  const enrichedDebts: CalendarDebtDetail[] = dayDebts.map((debt) => {
    const originalAmount = debt.originalAmount || 0;
    const remainingBalance = debt.remainingBalance || 0;
    const progress = originalAmount > 0 ? Math.round(((originalAmount - remainingBalance) / originalAmount) * 100) : 0;
    return {
      id: debt.id,
      name: debt.name,
      description: debt.description,
      creditorName: debt.creditorName,
      remainingBalance,
      originalAmount,
      progress,
      color: debt.color || '#ef4444',
      icon: debt.icon || 'credit-card',
      type: debt.type || 'other',
      status: debt.status || 'active',
      debtType: 'target',
      source: 'debt',
    };
  });

  for (const { milestone, debt } of dayMilestones) {
    if (!milestone.achievedAt || toLocalDateString(new Date(milestone.achievedAt)) !== dateKey) {
      continue;
    }
    enrichedDebts.push({
      id: `${debt.id}-milestone-${milestone.percentage}`,
      name: debt.name,
      description: `${milestone.percentage}% of debt paid off!`,
      creditorName: debt.creditorName || '',
      remainingBalance: debt.remainingBalance || 0,
      originalAmount: debt.originalAmount || 0,
      progress: milestone.percentage,
      color: debt.color || '#ef4444',
      icon: debt.icon || 'credit-card',
      type: debt.type || 'other',
      status: debt.status || 'active',
      debtType: 'milestone',
      milestonePercentage: milestone.percentage,
      source: 'debt',
    });
  }

  const [creditAccounts, debtBillTemplates] = await Promise.all([
    db
      .select()
      .from(accounts)
      .where(
        and(
          eq(accounts.userId, userId),
          eq(accounts.householdId, householdId),
          inArray(accounts.type, ['credit', 'line_of_credit']),
          eq(accounts.isActive, true)
        )
      ),
    db
      .select()
      .from(billTemplates)
      .where(and(eq(billTemplates.householdId, householdId), eq(billTemplates.isActive, true), eq(billTemplates.debtEnabled, true))),
  ]);

  const payoffDates: CalendarPayoffDateDetail[] = [];
  for (const account of creditAccounts) {
    const balance = Math.abs(account.currentBalanceCents ?? toMoneyCents(account.currentBalance) ?? 0) / 100;
    const monthlyPayment = account.budgetedMonthlyPayment || account.minimumPaymentAmount || 0;
    if (balance <= 0 || monthlyPayment <= 0) continue;
    const projectedPayoffDate = format(addMonths(new Date(), Math.ceil(balance / monthlyPayment)), 'yyyy-MM-dd');
    if (projectedPayoffDate !== dateKey) continue;
    payoffDates.push({
      id: account.id,
      name: account.name,
      source: 'account',
      sourceType: account.type,
      remainingBalance: balance,
      monthlyPayment,
      projectedPayoffDate,
      color: account.color || undefined,
      interestRate: account.interestRate || undefined,
    });
  }
  for (const template of debtBillTemplates) {
    const balance = centsToDollars(template.debtRemainingBalanceCents);
    const monthlyPayment = centsToDollars(template.defaultAmountCents);
    if (balance <= 0 || monthlyPayment <= 0) continue;
    const projectedPayoffDate = format(addMonths(new Date(), Math.ceil(balance / monthlyPayment)), 'yyyy-MM-dd');
    if (projectedPayoffDate !== dateKey) continue;
    payoffDates.push({
      id: template.id,
      name: template.name,
      source: 'bill',
      sourceType: template.classification,
      remainingBalance: balance,
      monthlyPayment,
      projectedPayoffDate,
      color: template.debtColor || undefined,
      interestRate: template.debtInterestAprBps ? template.debtInterestAprBps / 100 : undefined,
    });
  }

  const billMilestoneBillIds = [
    ...new Set(dayBillMilestones.map((milestone) => milestone.billId).filter((id): id is string => Boolean(id))),
  ];
  const billMilestoneAccountIds = [
    ...new Set(dayBillMilestones.map((milestone) => milestone.accountId).filter((id): id is string => Boolean(id))),
  ];
  const [milestoneBills, milestoneAccounts] = await Promise.all([
    billMilestoneBillIds.length > 0
      ? db
          .select()
          .from(billTemplates)
          .where(and(eq(billTemplates.householdId, householdId), inArray(billTemplates.id, billMilestoneBillIds)))
      : Promise.resolve([]),
    billMilestoneAccountIds.length > 0
      ? db
          .select()
          .from(accounts)
          .where(
            and(
              eq(accounts.userId, userId),
              eq(accounts.householdId, householdId),
              inArray(accounts.id, billMilestoneAccountIds)
            )
          )
      : Promise.resolve([]),
  ]);
  const milestoneBillMap = new Map(milestoneBills.map((bill) => [bill.id, bill]));
  const milestoneAccountMap = new Map(milestoneAccounts.map((account) => [account.id, account]));

  const billMilestoneEvents: CalendarBillMilestoneDetail[] = dayBillMilestones
    .filter(
      (milestone) =>
        Boolean(milestone.achievedAt) &&
        toLocalDateString(new Date(milestone.achievedAt!)) === dateKey
    )
    .map((milestone) => {
      const source: 'account' | 'bill' = milestone.accountId ? 'account' : 'bill';
      let name = 'Unknown';
      let color: string | undefined;
      if (milestone.billId) {
        const bill = milestoneBillMap.get(milestone.billId);
        if (bill) {
          name = bill.name;
          color = bill.debtColor || undefined;
        }
      } else if (milestone.accountId) {
        const account = milestoneAccountMap.get(milestone.accountId);
        if (account) {
          name = account.name;
          color = account.color || undefined;
        }
      }
      return {
        id: milestone.id,
        billId: milestone.billId || undefined,
        accountId: milestone.accountId || undefined,
        name,
        percentage: milestone.percentage,
        achievedAt: milestone.achievedAt!,
        color,
        milestoneBalance: milestone.milestoneBalance,
        source,
      };
    });

  const summary: DayTransactionSummary = {
    incomeCount: enrichedTransactions.filter((txn) => txn.type === 'income').length,
    expenseCount: enrichedTransactions.filter((txn) => txn.type === 'expense').length,
    transferCount: enrichedTransactions.filter((txn) => txn.type === 'transfer_in' || txn.type === 'transfer_out').length,
    totalSpent: enrichedTransactions.filter((txn) => txn.type === 'expense').reduce((sum, txn) => sum + Math.abs(txn.amount), 0),
    billDueCount: dayOccurrencesRows.filter((row) => row.occurrence.status === 'unpaid' || row.occurrence.status === 'partial').length,
    billOverdueCount: dayOccurrencesRows.filter((row) => row.occurrence.status === 'overdue').length,
    goalCount: enrichedGoals.length,
    debtCount: enrichedDebts.length,
    autopayCount: autopayEvents.length,
    payoffDateCount: payoffDates.length,
    billMilestoneCount: billMilestoneEvents.length,
  };

  return {
    transactions: enrichedTransactions,
    bills: enrichedBills,
    goals: enrichedGoals,
    debts: enrichedDebts,
    autopayEvents,
    payoffDates,
    billMilestones: billMilestoneEvents,
    summary,
  };
}
