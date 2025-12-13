import { describe, it, expect, vi, beforeEach } from 'vitest';

import { POST as POST_APPLY_BULK } from '@/app/api/rules/apply-bulk/route';

vi.mock('@/lib/auth-helpers', () => ({
  requireAuth: vi.fn(),
}));

vi.mock('@/lib/api/household-auth', () => ({
  getAndVerifyHousehold: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(),
  },
}));

import { requireAuth } from '@/lib/auth-helpers';
import { getAndVerifyHousehold } from '@/lib/api/household-auth';
import { db } from '@/lib/db';

const TEST_USER_ID = 'user_1';
const TEST_HOUSEHOLD_ID = 'hh_1';

describe('POST /api/rules/apply-bulk query params', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    (requireAuth as unknown as { mockResolvedValue: (v: unknown) => void }).mockResolvedValue({
      userId: TEST_USER_ID,
    });

    (getAndVerifyHousehold as unknown as { mockResolvedValue: (v: unknown) => void }).mockResolvedValue({
      householdId: TEST_HOUSEHOLD_ID,
    });

    // Force early exit by returning no target transactions
    (db.select as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue({
      from: () => ({
        where: () => ({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    });
  });

  it('ignores unknown query params (categoryId) without crashing', async () => {
    const request = {
      url: 'https://example.com/api/rules/apply-bulk?categoryId=cat_123&limit=10',
      json: async () => ({}),
      headers: new Headers({ 'x-household-id': TEST_HOUSEHOLD_ID }),
    } as unknown as Request;

    const response = await POST_APPLY_BULK(request);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.totalProcessed).toBe(0);
    expect(data.totalUpdated).toBe(0);
  });
});
