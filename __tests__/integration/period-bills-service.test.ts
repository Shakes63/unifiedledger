import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { nanoid } from 'nanoid';
import { eq } from 'drizzle-orm';

import { db } from '@/lib/db';
import {
  autopayRules,
  billOccurrenceAllocations,
  billOccurrences,
  billTemplates,
} from '@/lib/db/schema';
import {
  cleanupTestHousehold,
  setupTestUserWithHousehold,
} from './test-utils';
import { getCurrentBudgetPeriod, type BudgetScheduleSettings } from '@/lib/budgets/budget-schedule';
import { getPeriodBillsForBudgetPeriod } from '@/lib/budgets/period-bills-service';

describe('Integration: period bills service', () => {
  let userId: string;
  let householdId: string;

  const weeklySettings: BudgetScheduleSettings = {
    budgetCycleFrequency: 'weekly',
    budgetCycleStartDay: 1, // Monday
    budgetCycleReferenceDate: null,
    budgetCycleSemiMonthlyDays: '[1, 15]',
    budgetPeriodRollover: false,
    budgetPeriodManualAmount: null,
  };

  beforeEach(async () => {
    const setup = await setupTestUserWithHousehold();
    userId = setup.userId;
    householdId = setup.householdId;
  });

  afterEach(async () => {
    await db.delete(billOccurrenceAllocations).where(eq(billOccurrenceAllocations.householdId, householdId));
    await db.delete(billOccurrences).where(eq(billOccurrences.householdId, householdId));
    await db.delete(autopayRules).where(eq(autopayRules.householdId, householdId));
    await db.delete(billTemplates).where(eq(billTemplates.householdId, householdId));
    await cleanupTestHousehold(userId, householdId);
  });

  it('supports assigning a late-month bill to the first weekly paycheck bucket', async () => {
    const templateId = nanoid();
    const occurrenceId = nanoid();

    await db.insert(billTemplates).values({
      id: templateId,
      householdId,
      createdByUserId: userId,
      name: 'Internet',
      billType: 'expense',
      classification: 'utility',
      recurrenceType: 'monthly',
      defaultAmountCents: 12000,
      budgetPeriodAssignment: 1,
      splitAcrossPeriods: false,
    });

    await db.insert(billOccurrences).values({
      id: occurrenceId,
      templateId,
      householdId,
      dueDate: '2025-05-30',
      amountDueCents: 12000,
      amountRemainingCents: 12000,
      status: 'unpaid',
    });

    // Periods are numbered by their START DAY (Monday) within the month it
    // falls in: May 2025 has Mondays on 5, 12, 19, 26 -> periods 1..4. (The
    // Apr 28 - May 4 period belongs to APRIL as its 4th, so it is not May's.)
    const firstWeekPeriod = getCurrentBudgetPeriod(weeklySettings, new Date('2025-05-06T12:00:00'));
    const lastWeekPeriod = getCurrentBudgetPeriod(weeklySettings, new Date('2025-05-29T12:00:00'));

    const firstWeekRows = await getPeriodBillsForBudgetPeriod({
      householdId,
      userId,
      settings: weeklySettings,
      period: firstWeekPeriod,
      statuses: ['pending', 'overdue'],
    });

    const lastWeekRows = await getPeriodBillsForBudgetPeriod({
      householdId,
      userId,
      settings: weeklySettings,
      period: lastWeekPeriod,
      statuses: ['pending', 'overdue'],
    });

    expect(firstWeekPeriod.startStr).toBe('2025-05-05');
    expect(firstWeekPeriod.periodNumber).toBe(1);
    expect(lastWeekPeriod.startStr).toBe('2025-05-26');
    expect(lastWeekPeriod.periodNumber).toBe(4);
    // The bill is due May 30 but assigned to period 1 — pay it from the first
    // paycheck of the month. It belongs to period 1 and NOT the last period.
    expect(firstWeekRows.map((row) => row.instance.id)).toContain(occurrenceId);
    expect(lastWeekRows.map((row) => row.instance.id)).not.toContain(occurrenceId);
  });

  it('returns split bills only in periods that have an allocation', async () => {
    const templateId = nanoid();
    const occurrenceId = nanoid();

    await db.insert(billTemplates).values({
      id: templateId,
      householdId,
      createdByUserId: userId,
      name: 'Rent Split',
      billType: 'expense',
      classification: 'housing',
      recurrenceType: 'monthly',
      defaultAmountCents: 100000,
      splitAcrossPeriods: true,
    });

    await db.insert(billOccurrences).values({
      id: occurrenceId,
      templateId,
      householdId,
      dueDate: '2025-05-30',
      amountDueCents: 100000,
      amountRemainingCents: 100000,
      status: 'unpaid',
    });

    await db.insert(billOccurrenceAllocations).values([
      {
        id: nanoid(),
        occurrenceId,
        templateId,
        householdId,
        periodNumber: 1,
        allocatedAmountCents: 60000,
        paidAmountCents: 0,
        isPaid: false,
      },
      {
        id: nanoid(),
        occurrenceId,
        templateId,
        householdId,
        // May 2025 has 4 Monday periods, so the split's second half goes to
        // period 4 (the last), not a period 5 that no longer exists.
        periodNumber: 4,
        allocatedAmountCents: 40000,
        paidAmountCents: 0,
        isPaid: false,
      },
    ]);

    // Periods are numbered by their Monday start within its month:
    // May 5 = #1, May 12 = #2, May 19 = #3, May 26 = #4.
    const firstWeekPeriod = getCurrentBudgetPeriod(weeklySettings, new Date('2025-05-06T12:00:00'));
    const thirdWeekPeriod = getCurrentBudgetPeriod(weeklySettings, new Date('2025-05-21T12:00:00'));
    const fifthWeekPeriod = getCurrentBudgetPeriod(weeklySettings, new Date('2025-05-29T12:00:00'));

    const firstWeekRows = await getPeriodBillsForBudgetPeriod({
      householdId,
      userId,
      settings: weeklySettings,
      period: firstWeekPeriod,
      statuses: ['pending', 'overdue'],
    });
    const thirdWeekRows = await getPeriodBillsForBudgetPeriod({
      householdId,
      userId,
      settings: weeklySettings,
      period: thirdWeekPeriod,
      statuses: ['pending', 'overdue'],
    });
    const fifthWeekRows = await getPeriodBillsForBudgetPeriod({
      householdId,
      userId,
      settings: weeklySettings,
      period: fifthWeekPeriod,
      statuses: ['pending', 'overdue'],
    });

    const firstWeekSplit = firstWeekRows.find((row) => row.instance.id === occurrenceId);
    const fifthWeekSplit = fifthWeekRows.find((row) => row.instance.id === occurrenceId);

    expect(firstWeekSplit?.allocation?.allocatedAmount).toBe(600);
    expect(firstWeekSplit?.hasAnyAllocations).toBe(true);
    expect(thirdWeekRows.map((row) => row.instance.id)).not.toContain(occurrenceId);
    expect(fifthWeekSplit?.allocation?.allocatedAmount).toBe(400);
  });
});
