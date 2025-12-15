import { describe, it, expect, vi, beforeEach } from 'vitest';

import { GET as GET_TEST_DATA_ACCESS } from '@/app/api/test-data-access/route';

vi.mock('@/lib/test-mode', () => ({
  isTestMode: vi.fn(),
}));

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

import { isTestMode } from '@/lib/test-mode';
import { requireAuth } from '@/lib/auth-helpers';
import { getAndVerifyHousehold } from '@/lib/api/household-auth';

describe('GET /api/test-data-access guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 404 when TEST_MODE is disabled (regression)', async () => {
    (isTestMode as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue(false);

    const request = {
      url: 'https://example.com/api/test-data-access',
      headers: new Headers(),
    } as unknown as Request;

    const response = await GET_TEST_DATA_ACCESS(request);
    expect(response.status).toBe(404);

    const json = (await response.json()) as { error: string };
    expect(json.error).toBe('Not Found');
  });

  it('returns 400 when TEST_MODE is enabled but household header is missing', async () => {
    (isTestMode as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue(true);

    (requireAuth as unknown as { mockResolvedValue: (v: unknown) => void }).mockResolvedValue({
      userId: 'test-user-001',
    });

    (getAndVerifyHousehold as unknown as { mockImplementation: (fn: () => unknown) => void }).mockImplementation(
      () => {
        throw new Error('Household ID is required');
      }
    );

    const request = {
      url: 'https://example.com/api/test-data-access',
      headers: new Headers(),
    } as unknown as Request;

    const response = await GET_TEST_DATA_ACCESS(request);
    expect(response.status).toBe(400);

    const json = (await response.json()) as { error: string };
    expect(json.error).toContain('Household ID is required');
  });
});


