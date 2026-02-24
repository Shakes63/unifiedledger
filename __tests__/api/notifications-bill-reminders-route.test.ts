/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth-helpers', () => ({
  requireAuth: vi.fn(),
}));

vi.mock('@/lib/notifications/bill-reminders', () => ({
  checkAndCreateBillReminders: vi.fn(),
}));

import { requireAuth } from '@/lib/auth-helpers';
import { checkAndCreateBillReminders } from '@/lib/notifications/bill-reminders';
import { GET, POST } from '@/app/api/notifications/bill-reminders/route';

describe('GET/POST /api/notifications/bill-reminders', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (requireAuth as any).mockResolvedValue({ userId: 'user-1' });
    (checkAndCreateBillReminders as any).mockResolvedValue({
      success: true,
      notificationsCreated: 2,
      checkedInstances: 5,
      skippedAutopay: 1,
    });
  });

  it('GET returns 401 when unauthorized', async () => {
    (requireAuth as any).mockRejectedValue(new Error('Unauthorized'));
    const response = await GET(new Request('http://localhost/api/notifications/bill-reminders'));
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json).toEqual({ error: 'Unauthorized' });
    expect(checkAndCreateBillReminders).not.toHaveBeenCalled();
  });

  it('GET scopes reminder processing to the authenticated user', async () => {
    const response = await GET(new Request('http://localhost/api/notifications/bill-reminders'));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.message).toBe('Bill reminders checked');
    expect(checkAndCreateBillReminders).toHaveBeenCalledWith({ userId: 'user-1' });
  });

  it('POST triggers global reminder processing (no user scope)', async () => {
    const response = await POST(new Request('http://localhost/api/notifications/bill-reminders', { method: 'POST' }));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.message).toBe('Bill reminders checked and notifications created');
    expect(checkAndCreateBillReminders).toHaveBeenCalledWith();
  });
});
