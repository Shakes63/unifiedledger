import { describe, expect, it } from 'vitest';

/**
 * Production hardening item 4: brute-force rate limiting on the auth surface.
 * Smoke-tests the wiring — better-auth enforces the rules at runtime; what can
 * regress silently is the CONFIG (rule deleted, window loosened, enable flag
 * dropped), so pin it here.
 */
describe('better-auth rate limiting config', () => {
  it('declares strict limits for credential and 2FA endpoints', async () => {
    process.env.BETTER_AUTH_SECRET = process.env.BETTER_AUTH_SECRET || 'test-secret-for-config-smoke';
    const { auth } = await import('@/lib/better-auth');
    const rateLimit = auth.options.rateLimit as {
      enabled?: boolean;
      window?: number;
      max?: number;
      customRules?: Record<string, { window: number; max: number }>;
    };

    expect(rateLimit).toBeTruthy();
    // Enabled in production (NODE_ENV is 'test' here, so the flag is false —
    // assert the EXPRESSION result rather than hardcoding true).
    expect(rateLimit.enabled).toBe(process.env.NODE_ENV === 'production');

    const rules = rateLimit.customRules!;
    expect(rules['/sign-in/email'].max).toBeLessThanOrEqual(5);
    expect(rules['/sign-in/email'].window).toBeGreaterThanOrEqual(60);
    expect(rules['/two-factor/*'].max).toBeLessThanOrEqual(5);
    expect(rules['/forget-password'].max).toBeLessThanOrEqual(3);
    expect(rules['/sign-up/email'].max).toBeLessThanOrEqual(5);
  });
});
