/**
 * Event Generator Service
 * Converts app data (bills, milestones, goals, debts) into calendar events
 */

import { db } from '@/lib/db';
import {
  autopayRules,
  billOccurrences,
  billTemplates,
  savingsGoals,
  savingsMilestones,
  debts,
  debtPayoffMilestones,
  accounts,
  calendarSyncSettings,
} from '@/lib/db/schema';
import { eq, and, gte, lte, or, inArray } from 'drizzle-orm';
import { format, addMonths, parseISO } from 'date-fns';
import Decimal from 'decimal.js';
import {
  getCurrentBudgetPeriod,
  BudgetScheduleSettings,
} from '@/lib/budgets/budget-schedule';
import { toMoneyCents } from '@/lib/utils/money-cents';
import { CalendarEvent } from './google-calendar';

// Re-export CalendarEvent for convenience
export type { CalendarEvent };

export interface EventSource {
  sourceType: 'bill_instance' | 'savings_milestone' | 'debt_milestone' | 'goal_target' | 'payoff_date' | 'budget_period_bills';
  sourceId: string;
}

export interface GeneratedEvent extends CalendarEvent, EventSource {}

export interface SyncSettings {
  syncMode: 'direct' | 'budget_period';
  syncBills: boolean;
  syncSavingsMilestones: boolean;
  syncDebtMilestones: boolean;
  syncPayoffDates: boolean;
  syncGoalTargetDates: boolean;
  reminderMinutes: number | null;
}

export interface BudgetSettings {
  budgetCycleFrequency: 'weekly' | 'biweekly' | 'semi-monthly' | 'monthly';
  budgetCycleStartDay: number | null;
  budgetCycleReferenceDate: string | null;
  budgetCycleSemiMonthlyDays: string | null;
}

/**
 * Get the app URL for deep links
 */
function getAppUrl(): string {
  return process.env.APP_URL || 'http://localhost:3000';
}

/**
 * Get sync settings for a user/household
 */
export async function getSyncSettings(
  userId: string,
  householdId: string
): Promise<SyncSettings | null> {
  const settings = await db
    .select()
    .from(calendarSyncSettings)
    .where(
      and(
        eq(calendarSyncSettings.userId, userId),
        eq(calendarSyncSettings.householdId, householdId)
      )
    )
    .limit(1);

  if (!settings[0]) return null;

  return {
    syncMode: settings[0].syncMode as 'direct' | 'budget_period',
    syncBills: settings[0].syncBills ?? true,
    syncSavingsMilestones: settings[0].syncSavingsMilestones ?? true,
    syncDebtMilestones: settings[0].syncDebtMilestones ?? true,
    syncPayoffDates: settings[0].syncPayoffDates ?? true,
    syncGoalTargetDates: settings[0].syncGoalTargetDates ?? true,
    reminderMinutes: settings[0].reminderMinutes,
  };
}

/**
 * Generate bill events for a date range
 */
export async function generateBillEvents(
  userId: string,
  householdId: string,
  startDate: string,
  endDate: string,
  settings: SyncSettings,
  budgetSettings?: BudgetScheduleSettings
): Promise<GeneratedEvent[]> {
  if (!settings.syncBills) return [];

  const appUrl = getAppUrl();

  const occurrenceRows = await db
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
        lte(billOccurrences.dueDate, endDate),
        or(
          eq(billOccurrences.status, 'unpaid'),
          eq(billOccurrences.status, 'partial'),
          eq(billOccurrences.status, 'overdue')
        )
      )
    );
  const templateIds = [...new Set(occurrenceRows.map((row) => row.template.id))];
  const rules =
    templateIds.length > 0
      ? await db
          .select()
          .from(autopayRules)
          .where(and(eq(autopayRules.householdId, householdId), eq(autopayRules.isEnabled, true), inArray(autopayRules.templateId, templateIds)))
      : [];
  const ruleMap = new Map(rules.map((rule) => [rule.templateId, rule]));

  if (settings.syncMode === 'direct') {
    // Direct mode: one event per bill instance
    return occurrenceRows.map(({ occurrence, template }) => {
      const maybeRule = ruleMap.get(template.id);
      const amountDue = new Decimal(occurrence.amountDueCents || 0).div(100);
      const amountRemaining = new Decimal(
        (occurrence.amountRemainingCents || occurrence.amountDueCents || 0)
      ).div(100);
      const titlePrefix =
        template.billType === 'income'
          ? 'Income Due'
          : template.billType === 'savings_transfer'
            ? 'Transfer Due'
            : 'Bill Due';
      const actionPath =
        template.billType === 'income'
          ? '/dashboard/income'
          : '/dashboard/bills';

      return {
        sourceType: 'bill_instance' as const,
        sourceId: occurrence.id,
        title: `${titlePrefix}: ${template.name}`,
        description: `Amount Due: $${amountDue.toFixed(2)}\nRemaining: $${amountRemaining.toFixed(2)}\nType: ${template.billType}\nAutopay: ${maybeRule ? 'Enabled' : 'Disabled'}`,
        date: occurrence.dueDate,
        allDay: true,
        reminderMinutes: settings.reminderMinutes,
        link: `${appUrl}${actionPath}`,
      };
    });
  } else {
    // Budget period mode: group bills by period
    if (!budgetSettings) return [];

    // Group instances by period
    const periodMap = new Map<string, typeof occurrenceRows>();

    for (const item of occurrenceRows) {
      const dueDate = parseISO(item.occurrence.dueDate);
      const period = getCurrentBudgetPeriod(budgetSettings, dueDate);
      const periodKey = period.startStr;

      if (!periodMap.has(periodKey)) {
        periodMap.set(periodKey, []);
      }
      periodMap.get(periodKey)!.push(item);
    }

    // Generate one event per period
    const events: GeneratedEvent[] = [];

    for (const [periodStart, periodBills] of periodMap) {
      const totalAmount = periodBills.reduce(
        (sum, { occurrence }) =>
          sum.plus(new Decimal(occurrence.amountDueCents || 0).div(100)),
        new Decimal(0)
      );

      const billNames = periodBills.map(({ template }) => template.name);
      const truncatedNames = billNames.length > 5
        ? [...billNames.slice(0, 5), `+${billNames.length - 5} more`]
        : billNames;

      // Calculate period offset for the link
      const today = new Date();
      const periodDate = parseISO(periodStart);
      const currentPeriod = getCurrentBudgetPeriod(budgetSettings, today);
      const targetPeriod = getCurrentBudgetPeriod(budgetSettings, periodDate);

      // Simple offset calculation (positive = future, negative = past)
      let periodOffset = 0;
      if (targetPeriod.startStr !== currentPeriod.startStr) {
        periodOffset = periodDate > today ? 1 : -1;
        // More accurate calculation would need iteration
      }

      events.push({
        sourceType: 'budget_period_bills',
        sourceId: periodStart,
        title: `Bills Due: ${truncatedNames.join(', ')} ($${totalAmount.toFixed(2)})`,
        description: `Bills for this period:\n${billNames.map((name, i) =>
          `- ${name}: $${new Decimal(periodBills[i].occurrence.amountDueCents || 0).div(100).toFixed(2)}`
        ).join('\n')}\n\nTotal: $${totalAmount.toFixed(2)}`,
        date: periodStart,
        allDay: true,
        reminderMinutes: settings.reminderMinutes,
        link: `${appUrl}/dashboard/bills?billPay=1&period=${periodOffset}`,
      });
    }

    return events;
  }
}

/**
 * Generate savings goal milestone events
 */
export async function generateSavingsMilestoneEvents(
  userId: string,
  householdId: string,
  startDate: string,
  endDate: string,
  settings: SyncSettings
): Promise<GeneratedEvent[]> {
  if (!settings.syncSavingsMilestones) return [];

  const appUrl = getAppUrl();

  // Get upcoming milestones that haven't been achieved yet
  // For milestones, we estimate when they'll be achieved based on current progress
  const goals = await db
    .select()
    .from(savingsGoals)
    .where(
      and(
        eq(savingsGoals.userId, userId),
        eq(savingsGoals.householdId, householdId),
        eq(savingsGoals.status, 'active')
      )
    );

  const events: GeneratedEvent[] = [];

  for (const goal of goals) {
    const milestones = await db
      .select()
      .from(savingsMilestones)
      .where(
        and(
          eq(savingsMilestones.goalId, goal.id),
          eq(savingsMilestones.userId, userId)
        )
      );

    // Find unachieved milestones
    const unachievedMilestones = milestones.filter((m) => !m.achievedAt);

    if (unachievedMilestones.length === 0 || !goal.targetDate) continue;

    // Estimate milestone dates based on linear progress
    const currentAmount = goal.currentAmount || 0;
    const targetAmount = goal.targetAmount || 0;
    const targetDate = parseISO(goal.targetDate);
    const today = new Date();
    const daysUntilTarget = Math.max(1, Math.ceil((targetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
    const remainingAmount = targetAmount - currentAmount;
    const dailyRate = remainingAmount / daysUntilTarget;

    for (const milestone of unachievedMilestones) {
      const milestoneAmount = (milestone.percentage / 100) * targetAmount;
      const amountNeeded = milestoneAmount - currentAmount;

      if (amountNeeded <= 0) continue; // Milestone should already be achieved

      const daysToMilestone = Math.ceil(amountNeeded / dailyRate);
      const estimatedDate = new Date(today.getTime() + daysToMilestone * 24 * 60 * 60 * 1000);
      const dateStr = format(estimatedDate, 'yyyy-MM-dd');

      if (dateStr >= startDate && dateStr <= endDate) {
        events.push({
          sourceType: 'savings_milestone',
          sourceId: milestone.id,
          title: `Savings Milestone: ${goal.name} - ${milestone.percentage}%`,
          description: `Estimated date to reach ${milestone.percentage}% ($${new Decimal(milestoneAmount).toFixed(2)}) of your ${goal.name} goal.`,
          date: dateStr,
          allDay: true,
          reminderMinutes: settings.reminderMinutes,
          link: `${appUrl}/dashboard/goals?goal=${goal.id}`,
        });
      }
    }
  }

  return events;
}

/**
 * Generate debt payoff milestone events
 */
export async function generateDebtMilestoneEvents(
  userId: string,
  householdId: string,
  startDate: string,
  endDate: string,
  settings: SyncSettings
): Promise<GeneratedEvent[]> {
  if (!settings.syncDebtMilestones) return [];

  const appUrl = getAppUrl();

  // Get active debts
  const activeDebts = await db
    .select()
    .from(debts)
    .where(
      and(
        eq(debts.userId, userId),
        eq(debts.householdId, householdId),
        eq(debts.status, 'active')
      )
    );

  const events: GeneratedEvent[] = [];

  for (const debt of activeDebts) {
    const milestones = await db
      .select()
      .from(debtPayoffMilestones)
      .where(
        and(
          eq(debtPayoffMilestones.debtId, debt.id),
          eq(debtPayoffMilestones.userId, userId)
        )
      );

    // Find unachieved milestones
    const unachievedMilestones = milestones.filter((m) => !m.achievedAt);

    if (unachievedMilestones.length === 0) continue;

    // Estimate milestone dates based on payment rate
    const originalAmount = debt.originalAmount || 0;
    const remainingBalance = debt.remainingBalance || 0;
    const paidOff = originalAmount - remainingBalance;
    const monthlyPayment = (debt.minimumPayment || 0) + (debt.additionalMonthlyPayment || 0);

    if (monthlyPayment <= 0) continue;

    const today = new Date();

    for (const milestone of unachievedMilestones) {
      // For debt milestones, percentage represents amount paid OFF (not remaining)
      const targetPaidOff = (milestone.percentage / 100) * originalAmount;
      const additionalPaymentNeeded = targetPaidOff - paidOff;

      if (additionalPaymentNeeded <= 0) continue; // Milestone should already be achieved

      const monthsToMilestone = Math.ceil(additionalPaymentNeeded / monthlyPayment);
      const estimatedDate = addMonths(today, monthsToMilestone);
      const dateStr = format(estimatedDate, 'yyyy-MM-dd');

      if (dateStr >= startDate && dateStr <= endDate) {
        events.push({
          sourceType: 'debt_milestone',
          sourceId: milestone.id,
          title: `Debt Milestone: ${debt.name} - ${milestone.percentage}% paid off`,
          description: `Estimated date to pay off ${milestone.percentage}% of your ${debt.name} debt (${debt.creditorName}).`,
          date: dateStr,
          allDay: true,
          reminderMinutes: settings.reminderMinutes,
          link: `${appUrl}/dashboard/debts?debt=${debt.id}`,
        });
      }
    }
  }

  return events;
}

/**
 * Generate savings goal target date events
 */
export async function generateGoalTargetEvents(
  userId: string,
  householdId: string,
  startDate: string,
  endDate: string,
  settings: SyncSettings
): Promise<GeneratedEvent[]> {
  if (!settings.syncGoalTargetDates) return [];

  const appUrl = getAppUrl();

  // Get goals with target dates in the range
  const goals = await db
    .select()
    .from(savingsGoals)
    .where(
      and(
        eq(savingsGoals.userId, userId),
        eq(savingsGoals.householdId, householdId),
        eq(savingsGoals.status, 'active')
      )
    );

  const events: GeneratedEvent[] = [];

  for (const goal of goals) {
    if (!goal.targetDate) continue;
    
    if (goal.targetDate >= startDate && goal.targetDate <= endDate) {
      const progress = goal.targetAmount > 0
        ? Math.round(((goal.currentAmount || 0) / goal.targetAmount) * 100)
        : 0;

      events.push({
        sourceType: 'goal_target',
        sourceId: goal.id,
        title: `Goal Target: ${goal.name}`,
        description: `Target date to reach your ${goal.name} goal.\nTarget: $${new Decimal(goal.targetAmount).toFixed(2)}\nCurrent: $${new Decimal(goal.currentAmount || 0).toFixed(2)} (${progress}%)`,
        date: goal.targetDate,
        allDay: true,
        reminderMinutes: settings.reminderMinutes,
        link: `${appUrl}/dashboard/goals?goal=${goal.id}`,
      });
    }
  }

  return events;
}

/**
 * Generate projected payoff date events
 */
export async function generatePayoffDateEvents(
  userId: string,
  householdId: string,
  startDate: string,
  endDate: string,
  settings: SyncSettings
): Promise<GeneratedEvent[]> {
  if (!settings.syncPayoffDates) return [];

  const appUrl = getAppUrl();
  const events: GeneratedEvent[] = [];
  const today = new Date();

  // Get active debts with their target payoff dates
  const activeDebts = await db
    .select()
    .from(debts)
    .where(
      and(
        eq(debts.userId, userId),
        eq(debts.householdId, householdId),
        eq(debts.status, 'active')
      )
    );

  for (const debt of activeDebts) {
    // Calculate projected payoff date
    const balance = debt.remainingBalance || 0;
    if (balance <= 0) continue;

    const monthlyPayment = (debt.minimumPayment || 0) + (debt.additionalMonthlyPayment || 0);
    if (monthlyPayment <= 0) continue;

    // Simple payoff calculation (ignoring interest for estimation)
    const monthsToPayoff = new Decimal(balance).dividedBy(monthlyPayment).ceil().toNumber();
    const projectedDate = addMonths(today, monthsToPayoff);
    const dateStr = format(projectedDate, 'yyyy-MM-dd');

    if (dateStr >= startDate && dateStr <= endDate) {
      events.push({
        sourceType: 'payoff_date',
        sourceId: `debt-${debt.id}`,
        title: `Projected Payoff: ${debt.name}`,
        description: `Projected date to pay off ${debt.name} (${debt.creditorName}).\nRemaining: $${new Decimal(balance).toFixed(2)}\nMonthly Payment: $${new Decimal(monthlyPayment).toFixed(2)}`,
        date: dateStr,
        allDay: true,
        reminderMinutes: settings.reminderMinutes,
        link: `${appUrl}/dashboard/debts?debt=${debt.id}`,
      });
    }
  }

  // Add debt-enabled bill templates from bills-v2.
  const debtTemplates = await db
    .select()
    .from(billTemplates)
    .where(
      and(
        eq(billTemplates.householdId, householdId),
        eq(billTemplates.isActive, true),
        eq(billTemplates.debtEnabled, true)
      )
    );

  for (const template of debtTemplates) {
    const remainingBalance = new Decimal(template.debtRemainingBalanceCents || 0).div(100);
    const monthlyPayment = new Decimal(template.defaultAmountCents || 0).div(100);
    if (remainingBalance.lte(0) || monthlyPayment.lte(0)) continue;

    const monthsToPayoff = remainingBalance.dividedBy(monthlyPayment).ceil().toNumber();
    const projectedDate = addMonths(today, monthsToPayoff);
    const dateStr = format(projectedDate, 'yyyy-MM-dd');
    if (dateStr < startDate || dateStr > endDate) continue;

    events.push({
      sourceType: 'payoff_date',
      sourceId: `template-${template.id}`,
      title: `Projected Payoff: ${template.name}`,
      description: `Projected date to pay off ${template.name}.\nRemaining: $${remainingBalance.toFixed(2)}\nMonthly Payment: $${monthlyPayment.toFixed(2)}`,
      date: dateStr,
      allDay: true,
      reminderMinutes: settings.reminderMinutes,
      link: `${appUrl}/dashboard/bills`,
    });
  }

  // Get credit accounts with projected payoff
  const creditAccounts = await db
    .select()
    .from(accounts)
    .where(
      and(
        eq(accounts.userId, userId),
        eq(accounts.householdId, householdId),
        eq(accounts.isActive, true),
        inArray(accounts.type, ['credit', 'line_of_credit'])
      )
    );

  for (const account of creditAccounts) {
    const balance =
      Math.abs(account.currentBalanceCents ?? toMoneyCents(account.currentBalance) ?? 0) / 100;
    if (balance <= 0) continue;

    const monthlyPayment = account.minimumPaymentAmount || 0;
    if (monthlyPayment <= 0) continue;

    const monthsToPayoff = new Decimal(balance).dividedBy(monthlyPayment).ceil().toNumber();
    const projectedDate = addMonths(today, monthsToPayoff);
    const dateStr = format(projectedDate, 'yyyy-MM-dd');

    if (dateStr >= startDate && dateStr <= endDate) {
      events.push({
        sourceType: 'payoff_date',
        sourceId: `account-${account.id}`,
        title: `Projected Payoff: ${account.name}`,
        description: `Projected date to pay off ${account.name}.\nBalance: $${new Decimal(balance).toFixed(2)}\nMonthly Payment: $${new Decimal(monthlyPayment).toFixed(2)}`,
        date: dateStr,
        allDay: true,
        reminderMinutes: settings.reminderMinutes,
        link: `${appUrl}/dashboard/accounts`,
      });
    }
  }

  return events;
}

/**
 * Generate all events for a date range
 */
export async function generateAllEvents(
  userId: string,
  householdId: string,
  startDate: string,
  endDate: string,
  settings: SyncSettings,
  budgetSettings?: BudgetScheduleSettings
): Promise<GeneratedEvent[]> {
  const [
    billEvents,
    savingsMilestoneEvents,
    debtMilestoneEvents,
    goalTargetEvents,
    payoffDateEvents,
  ] = await Promise.all([
    generateBillEvents(userId, householdId, startDate, endDate, settings, budgetSettings),
    generateSavingsMilestoneEvents(userId, householdId, startDate, endDate, settings),
    generateDebtMilestoneEvents(userId, householdId, startDate, endDate, settings),
    generateGoalTargetEvents(userId, householdId, startDate, endDate, settings),
    generatePayoffDateEvents(userId, householdId, startDate, endDate, settings),
  ]);

  return [
    ...billEvents,
    ...savingsMilestoneEvents,
    ...debtMilestoneEvents,
    ...goalTargetEvents,
    ...payoffDateEvents,
  ];
}
