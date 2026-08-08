import { beforeAll, describe, expect, it } from 'vitest';
import { encryptToken, decryptToken } from '@/lib/encryption/oauth-encryption';

/**
 * Calendar sync tokens are stored encrypted (bug-hunt finding SEC2). The
 * round trip must be lossless, and decrypt must tolerate LEGACY PLAINTEXT rows
 * written before encryption shipped (they re-encrypt on the next refresh).
 */
describe('token encryption (SEC2)', () => {
  beforeAll(() => {
    process.env.OAUTH_ENCRYPTION_KEY =
      process.env.OAUTH_ENCRYPTION_KEY ?? 'a'.repeat(64); // 32 bytes hex
  });

  it('round-trips a token', () => {
    const token = 'ticktick-access-token-abc123';
    const enc = encryptToken(token);
    expect(enc).not.toBe(token);
    expect(decryptToken(enc)).toBe(token);
  });

  it('produces different ciphertext each time (random IV) but decrypts the same', () => {
    const token = 'same-token';
    const a = encryptToken(token);
    const b = encryptToken(token);
    expect(a).not.toBe(b);
    expect(decryptToken(a)).toBe(token);
    expect(decryptToken(b)).toBe(token);
  });

  it('returns a legacy plaintext value unchanged (not our ciphertext)', () => {
    // A short/plain token that was stored before encryption existed.
    expect(decryptToken('legacy-plaintext-token')).toBe('legacy-plaintext-token');
  });

  it('handles empty input', () => {
    expect(decryptToken('')).toBe('');
  });
});
