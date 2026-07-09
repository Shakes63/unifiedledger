import { describe, expect, it } from 'vitest';
import { buildSecurityHeaders } from '@/lib/security/headers';

/**
 * Tier-2 hardening: the security-header policy. Pinned here because a header
 * quietly deleted from next.config is invisible until a pentest finds it.
 */
describe('buildSecurityHeaders', () => {
  const asMap = (headers: Array<{ key: string; value: string }>) =>
    Object.fromEntries(headers.map((h) => [h.key, h.value]));

  it('always sends the baseline headers', () => {
    for (const production of [false, true]) {
      const headers = asMap(buildSecurityHeaders({ production }));
      expect(headers['X-Frame-Options']).toBe('DENY');
      expect(headers['X-Content-Type-Options']).toBe('nosniff');
      expect(headers['Referrer-Policy']).toBe('origin-when-cross-origin');
      expect(headers['Permissions-Policy']).toContain('camera=()');
    }
  });

  it('adds HSTS and CSP in production only (dev HMR needs eval)', () => {
    const dev = asMap(buildSecurityHeaders({ production: false }));
    expect(dev['Strict-Transport-Security']).toBeUndefined();
    expect(dev['Content-Security-Policy']).toBeUndefined();

    const prod = asMap(buildSecurityHeaders({ production: true }));
    expect(prod['Strict-Transport-Security']).toMatch(/max-age=\d{6,}/);
    expect(prod['Content-Security-Policy']).toBeTruthy();
  });

  it('CSP blocks the high-value vectors', () => {
    const csp = asMap(buildSecurityHeaders({ production: true }))['Content-Security-Policy'];
    // No attacker-hosted scripts, no foreign fetch/XHR exfiltration,
    // no form hijack, no base pivots, no plugins, no framing.
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("connect-src 'self'");
    expect(csp).toContain("form-action 'self'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    // Never allow wildcard sources or unsafe-eval in production.
    expect(csp).not.toContain('unsafe-eval');
    expect(csp).not.toMatch(/src [^;]*\*(?![^;]*blob)/);
  });
});
