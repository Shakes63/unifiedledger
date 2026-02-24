import { describe, it, expect, vi, beforeEach } from 'vitest';
import { format } from 'date-fns';

import { GET as GET_CALENDAR_DAY } from '@/app/api/calendar/day/route';

vi.mock('@/lib/auth-helpers', () => ({
  requireAuth: vi.fn(),
}));

vi.mock('@/lib/api/household-auth', () => ({
  getAndVerifyHousehold: vi.fn(),
}));

vi.mock('@/lib/calendar/data-service', () => ({
  getDayCalendarDetails: vi.fn(),
}));

import { requireAuth } from '@/lib/auth-helpers';
import { getAndVerifyHousehold } from '@/lib/api/household-auth';
import { getDayCalendarDetails } from '@/lib/calendar/data-service';

describe('GET /api/calendar/day household scoping', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (requireAuth as unknown as { mockResolvedValue: (v: unknown) => void }).mockResolvedValue({
      userId: 'user_1',
    });
    (getAndVerifyHousehold as unknown as { mockResolvedValue: (v: unknown) => void }).mockResolvedValue({
      householdId: 'hh_1',
      membership: { role: 'owner' },
    });
    (getDayCalendarDetails as unknown as { mockResolvedValue: (v: unknown) => void }).mockResolvedValue({
      transactions: [],
      bills: [],
      goals: [],
      debts: [],
      autopayEvents: [],
      payoffDates: [],
      billMilestones: [],
      summary: {
        incomeCount: 0,
        expenseCount: 0,
        transferCount: 0,
        totalSpent: 0,
        billDueCount: 0,
        billOverdueCount: 0,
        goalCount: 0,
        debtCount: 0,
        autopayCount: 0,
        payoffDateCount: 0,
        billMilestoneCount: 0,
      },
    });
  });

  it('passes household-scoped params into calendar day data service', async () => {
    const request = {
      url: 'https://example.com/api/calendar/day?date=2025-12-01',
      headers: new Headers({ 'x-household-id': 'hh_1' }),
    } as unknown as Request;

    const response = await GET_CALENDAR_DAY(request);
    expect(response.status).toBe(200);

    expect(getAndVerifyHousehold).toHaveBeenCalledTimes(1);
    const expectedDateKey = format(new Date('2025-12-01'), 'yyyy-MM-dd');
    expect(getDayCalendarDetails).toHaveBeenCalledWith({
      userId: 'user_1',
      householdId: 'hh_1',
      dateKey: expectedDateKey,
    });
  });
});
