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

    const firstWeekPeriod = getCurrentBudgetPeriod(weeklySettings, new Date('2025-05-02T12:00:00'));
    const fifthWeekPeriod = getCurrentBudgetPeriod(weeklySettings, new Date('2025-05-29T12:00:00'));

    const firstWeekRows = await getPeriodBillsForBudgetPeriod({
      householdId,
      userId,
      settings: weeklySettings,
      period: firstWeekPeriod,
      statuses: ['pending', 'overdue'],
    });

    const fifthWeekRows = await getPeriodBillsForBudgetPeriod({
      householdId,
      userId,
      settings: weeklySettings,
      period: fifthWeekPeriod,
      statuses: ['pending', 'overdue'],
    });

    expect(firstWeekPeriod.periodNumber).toBe(1);
    expect(fifthWeekPeriod.periodNumber).toBe(5);
    expect(firstWeekRows.map((row) => row.instance.id)).toContain(occurrenceId);
    expect(fifthWeekRows.map((row) => row.instance.id)).not.toContain(occurrenceId);
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
        periodNumber: 5,
        allocatedAmountCents: 40000,
        paidAmountCents: 0,
        isPaid: false,
      },
    ]);

    const firstWeekPeriod = getCurrentBudgetPeriod(weeklySettings, new Date('2025-05-02T12:00:00'));
    const thirdWeekPeriod = getCurrentBudgetPeriod(weeklySettings, new Date('2025-05-15T12:00:00'));
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
