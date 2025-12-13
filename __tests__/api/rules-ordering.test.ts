import { describe, it, expect, vi, beforeEach } from 'vitest';

import { GET as GET_RULES } from '@/app/api/rules/route';

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

type StringChunkLike = { value?: unknown };

describe('GET /api/rules ordering', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    (requireAuth as unknown as { mockResolvedValue: (v: unknown) => void }).mockResolvedValue({
      userId: TEST_USER_ID,
    });

    (getAndVerifyHousehold as unknown as { mockResolvedValue: (v: unknown) => void }).mockResolvedValue({
      householdId: TEST_HOUSEHOLD_ID,
    });
  });

  it('orders rules by ascending priority (lower number first)', async () => {
    const orderByMock = vi.fn();

    const rows = [
      {
        id: 'r2',
        name: 'Rule 2',
        priority: 2,
        isActive: true,
        matchCount: 0,
        actions: [],
        categoryId: null,
        householdId: TEST_HOUSEHOLD_ID,
        userId: TEST_USER_ID,
      },
      {
        id: 'r1',
        name: 'Rule 1',
        priority: 1,
        isActive: true,
        matchCount: 0,
        actions: [],
        categoryId: null,
        householdId: TEST_HOUSEHOLD_ID,
        userId: TEST_USER_ID,
      },
    ];

    orderByMock.mockReturnValue({
      limit: vi.fn().mockResolvedValue(rows),
    });

    (db.select as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue({
      from: () => ({
        where: () => ({
          orderBy: orderByMock,
        }),
      }),
    });

    const request = {
      url: 'https://example.com/api/rules',
      headers: new Headers({ 'x-household-id': TEST_HOUSEHOLD_ID }),
    } as unknown as Request;

    const response = await GET_RULES(request);
    expect(response.status).toBe(200);

    // Verify we call drizzle's asc() expression (it appends a StringChunk with " asc")
    expect(orderByMock).toHaveBeenCalledTimes(1);

    const orderExpr = orderByMock.mock.calls[0]?.[0] as unknown as { queryChunks?: StringChunkLike[] };
    const chunks = orderExpr.queryChunks ?? [];

    const hasAscChunk = chunks.some(chunk => {
      const value = chunk.value;
      return Array.isArray(value) && value.includes(' asc');
    });

    const hasDescChunk = chunks.some(chunk => {
      const value = chunk.value;
      return Array.isArray(value) && value.includes(' desc');
    });

    expect(hasAscChunk).toBe(true);
    expect(hasDescChunk).toBe(false);
  });
});
