import { describe, it, expect, vi, beforeEach } from 'vitest';
import { format } from 'date-fns';

import { GET as GET_CALENDAR_MONTH } from '@/app/api/calendar/month/route';

vi.mock('@/lib/auth-helpers', () => ({
  requireAuth: vi.fn(),
}));

vi.mock('@/lib/api/household-auth', () => ({
  getAndVerifyHousehold: vi.fn(),
}));

vi.mock('@/lib/calendar/data-service', () => ({
  getMonthCalendarSummary: vi.fn(),
}));

import { requireAuth } from '@/lib/auth-helpers';
import { getAndVerifyHousehold } from '@/lib/api/household-auth';
import { getMonthCalendarSummary } from '@/lib/calendar/data-service';

describe('GET /api/calendar/month household scoping', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (requireAuth as unknown as { mockResolvedValue: (v: unknown) => void }).mockResolvedValue({
      userId: 'user_1',
    });
    (getAndVerifyHousehold as unknown as { mockResolvedValue: (v: unknown) => void }).mockResolvedValue({
      householdId: 'hh_1',
      membership: { role: 'owner' },
    });
    (getMonthCalendarSummary as unknown as { mockResolvedValue: (v: unknown) => void }).mockResolvedValue({});
  });

  it('passes household-scoped params into calendar month data service', async () => {
    const request = {
      url: 'https://example.com/api/calendar/month?startDate=2025-12-01&endDate=2025-12-31',
      headers: new Headers({ 'x-household-id': 'hh_1' }),
    } as unknown as Request;

    const response = await GET_CALENDAR_MONTH(request);
    expect(response.status).toBe(200);

    expect(getAndVerifyHousehold).toHaveBeenCalledTimes(1);
    const expectedStartDate = format(new Date('2025-12-01'), 'yyyy-MM-dd');
    const expectedEndDate = format(new Date('2025-12-31'), 'yyyy-MM-dd');
    expect(getMonthCalendarSummary).toHaveBeenCalledWith({
      userId: 'user_1',
      householdId: 'hh_1',
      startDate: expectedStartDate,
      endDate: expectedEndDate,
    });
  });
});
