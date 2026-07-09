/**
 * Security response headers (production hardening, tier 2).
 *
 * Extracted from next.config.ts so the policy is unit-testable — a header
 * quietly deleted from config is exactly the kind of regression nothing else
 * would catch.
 */

/**
 * Content-Security-Policy. Everything the app loads is same-origin (the OAuth
 * hosts — Google/GitHub/TickTick — are server-to-server calls and top-level
 * redirects, which CSP does not govern), so 'self' sources are accurate.
 *
 * script-src keeps 'unsafe-inline' because Next.js injects inline
 * bootstrap/hydration scripts and this config does not thread nonces; the
 * policy still blocks the high-value attacks: loading attacker-hosted scripts,
 * exfiltration via fetch/XHR/WebSocket to foreign origins (connect-src),
 * form-action hijack, <base> pivots, plugins, and framing.
 */
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

export interface SecurityHeader {
  key: string;
  value: string;
}

export function buildSecurityHeaders({ production }: { production: boolean }): SecurityHeader[] {
  const headers: SecurityHeader[] = [
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Referrer-Policy', value: 'origin-when-cross-origin' },
    { key: 'X-XSS-Protection', value: '1; mode=block' },
    { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self)' },
  ];

  if (production) {
    // Browsers ignore HSTS on plain-HTTP responses per spec, so this is safe
    // to send unconditionally — it only takes effect behind the HTTPS proxy.
    headers.push({
      key: 'Strict-Transport-Security',
      value: 'max-age=31536000; includeSubDomains',
    });
    // Production-only: dev needs unsafe-eval for React Refresh / HMR, and a
    // dev-mode CSP would just train everyone to ignore violations.
    headers.push({ key: 'Content-Security-Policy', value: CONTENT_SECURITY_POLICY });
  }

  return headers;
}
