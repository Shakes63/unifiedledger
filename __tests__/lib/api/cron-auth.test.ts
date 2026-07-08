import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { isAuthorizedCronRequest, requireCronAuth } from '@/lib/api/cron-auth';

function req(headers: Record<string, string> = {}): Request {
  return new Request('http://localhost/api/cron/autopay', { method: 'POST', headers });
}

describe('cron auth (fail-closed) — C-SEC-1 / C-SEC-2 / M-SEC-9', () => {
  const original = process.env.CRON_SECRET;

  beforeEach(() => {
    delete process.env.CRON_SECRET;
  });
  afterEach(() => {
    if (original === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = original;
  });

  it('rejects when CRON_SECRET is unset, even with an Authorization header', () => {
    expect(isAuthorizedCronRequest(req({ authorization: 'Bearer anything' }))).toBe(false);
    expect(isAuthorizedCronRequest(req())).toBe(false);
  });

  it('rejects a missing or wrong secret when configured', () => {
    process.env.CRON_SECRET = 'the-real-secret';
    expect(isAuthorizedCronRequest(req())).toBe(false);
    expect(isAuthorizedCronRequest(req({ authorization: 'Bearer wrong' }))).toBe(false);
  });

  it('accepts the correct secret', () => {
    process.env.CRON_SECRET = 'the-real-secret';
    expect(isAuthorizedCronRequest(req({ authorization: 'Bearer the-real-secret' }))).toBe(true);
  });

  it('requireCronAuth returns a 401 Response when unauthorized and null when authorized', async () => {
    const denied = requireCronAuth(req());
    expect(denied).toBeInstanceOf(Response);
    expect(denied?.status).toBe(401);

    process.env.CRON_SECRET = 's3cret';
    expect(requireCronAuth(req({ authorization: 'Bearer s3cret' }))).toBeNull();
  });
});
