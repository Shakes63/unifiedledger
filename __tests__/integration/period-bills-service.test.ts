import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { nanoid } from 'nanoid';
import { eq } from 'drizzle-orm';

import { db } from '@/lib/db';
import {
  bills,
  billInstances,
  billInstanceAllocations,
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
    await db.delete(billInstanceAllocations).where(eq(billInstanceAllocations.userId, userId));
    await db.delete(billInstances).where(eq(billInstances.userId, userId));
    await db.delete(bills).where(eq(bills.userId, userId));
    await cleanupTestHousehold(userId, householdId);
  });

  it('supports assigning a late-month bill to the first weekly paycheck bucket', async () => {
    const billId = nanoid();
    const instanceId = nanoid();

    await db.insert(bills).values({
      id: billId,
      userId,
      householdId,
      name: 'Internet',
      expectedAmount: 120,
      dueDate: 30,
      frequency: 'monthly',
      budgetPeriodAssignment: 1,
      splitAcrossPeriods: false,
    });

    await db.insert(billInstances).values({
      id: instanceId,
      userId,
      householdId,
      billId,
      dueDate: '2025-05-30',
      expectedAmount: 120,
      status: 'pending',
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
    expect(firstWeekRows.map((row) => row.instance.id)).toContain(instanceId);
    expect(fifthWeekRows.map((row) => row.instance.id)).not.toContain(instanceId);
  });

  it('returns split bills only in periods that have an allocation', async () => {
    const billId = nanoid();
    const instanceId = nanoid();

    await db.insert(bills).values({
      id: billId,
      userId,
      householdId,
      name: 'Rent Split',
      expectedAmount: 1000,
      dueDate: 30,
      frequency: 'monthly',
      splitAcrossPeriods: true,
      splitAllocations: JSON.stringify([
        { periodNumber: 1, percentage: 60 },
        { periodNumber: 5, percentage: 40 },
      ]),
    });

    await db.insert(billInstances).values({
      id: instanceId,
      userId,
      householdId,
      billId,
      dueDate: '2025-05-30',
      expectedAmount: 1000,
      status: 'pending',
    });

    await db.insert(billInstanceAllocations).values([
      {
        id: nanoid(),
        billInstanceId: instanceId,
        billId,
        userId,
        householdId,
        periodNumber: 1,
        allocatedAmount: 600,
        paidAmount: 0,
        isPaid: false,
      },
      {
        id: nanoid(),
        billInstanceId: instanceId,
        billId,
        userId,
        householdId,
        periodNumber: 5,
        allocatedAmount: 400,
        paidAmount: 0,
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

    const firstWeekSplit = firstWeekRows.find((row) => row.instance.id === instanceId);
    const fifthWeekSplit = fifthWeekRows.find((row) => row.instance.id === instanceId);

    expect(firstWeekSplit?.allocation?.allocatedAmount).toBe(600);
    expect(firstWeekSplit?.hasAnyAllocations).toBe(true);
    expect(thirdWeekRows.map((row) => row.instance.id)).not.toContain(instanceId);
    expect(fifthWeekSplit?.allocation?.allocatedAmount).toBe(400);
  });
});
