import { timingSafeEqual } from 'node:crypto';

/**
 * Shared, fail-closed cron authentication.
 *
 * Audit findings C-SEC-1, C-SEC-2, M-SEC-9: several cron routes used the pattern
 * `if (CRON_SECRET) { ...verify... }`, which SKIPS the check entirely when the
 * secret is unset — allowing an unauthenticated caller to trigger real money
 * movement (autopay) or read cross-household data. This helper is fail-closed:
 * if CRON_SECRET is not configured, every request is rejected.
 */

function safeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) {
    // timingSafeEqual requires equal-length buffers; unequal length is a
    // guaranteed mismatch, so short-circuit (length is not itself a secret).
    return false;
  }
  return timingSafeEqual(aBuf, bBuf);
}

/**
 * Returns true only when a valid cron secret is presented.
 *
 * Fail-closed: returns false when CRON_SECRET is unset, missing, or wrong.
 * Accepts the secret via `Authorization: Bearer <secret>`.
 */
export function isAuthorizedCronRequest(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.warn('[cron-auth] CRON_SECRET is not configured; rejecting request');
    return false;
  }

  const authHeader = request.headers.get('authorization');
  if (!authHeader) {
    return false;
  }

  const token = authHeader.startsWith('Bearer ')
    ? authHeader.slice('Bearer '.length)
    : authHeader;

  return safeEqual(token, cronSecret);
}

/**
 * Guard for cron route handlers. Returns a 401 Response when unauthorized,
 * or null when the request is authorized and the handler may proceed.
 */
export function requireCronAuth(request: Request): Response | null {
  if (!isAuthorizedCronRequest(request)) {
    return Response.json(
      { error: 'Unauthorized - invalid or missing cron secret' },
      { status: 401 }
    );
  }
  return null;
}
