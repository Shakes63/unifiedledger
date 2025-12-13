import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'crypto';
import speakeasy from 'speakeasy';

import {
  generateTwoFactorSecret,
  verifyTwoFactorToken,
  generateBackupCodes,
  verifyBackupCode,
  removeBackupCode,
  generateQRCode,
} from '@/lib/auth/two-factor-utils';

vi.mock('qrcode', () => ({
  __esModule: true,
  default: {
    toDataURL: vi.fn(),
  },
}));

describe('lib/auth/two-factor-utils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateTwoFactorSecret', () => {
    it('returns a base32 secret and otpauth url', () => {
      const { secret, otpauthUrl } = generateTwoFactorSecret('test@example.com', 'Unified Ledger');
      expect(typeof secret).toBe('string');
      expect(secret.length).toBeGreaterThan(0);
      expect(typeof otpauthUrl).toBe('string');
      expect(otpauthUrl).toContain('otpauth://');
      expect(otpauthUrl).toContain('Unified%20Ledger');
      expect(otpauthUrl).toContain('test%40example.com');
    });
  });

  describe('verifyTwoFactorToken', () => {
    it('returns false for invalid token/secret combination', () => {
      expect(verifyTwoFactorToken('000000', 'INVALIDSECRET')).toBe(false);
    });

    it('returns true for a valid token generated from the same secret', () => {
      const { secret } = generateTwoFactorSecret('test@example.com', 'Unified Ledger');
      const token = speakeasy.totp({ secret, encoding: 'base32' });
      expect(verifyTwoFactorToken(token, secret)).toBe(true);
    });

    it('returns false if speakeasy throws', async () => {
      const mod = await import('speakeasy');
      const spy = vi.spyOn(mod.default.totp, 'verify').mockImplementation(() => {
        throw new Error('boom');
      });

      expect(verifyTwoFactorToken('123456', 'SOMESECRET')).toBe(false);
      spy.mockRestore();
    });
  });

  describe('backup codes', () => {
    it('generateBackupCodes returns deterministic codes and matching hashes', () => {
      const rb = vi.spyOn(crypto, 'randomBytes').mockImplementation((size: number) => {
        expect(size).toBe(4);
        return Buffer.from([0, 0, 0, 1]);
      });

      const { plaintextCodes, hashedCodes } = generateBackupCodes(2);

      expect(plaintextCodes).toEqual(['00000001', '00000001']);
      expect(hashedCodes.length).toBe(2);
      expect(hashedCodes[0]).toBe(
        crypto.createHash('sha256').update('00000001').digest('hex')
      );

      rb.mockRestore();
    });

    it('verifyBackupCode is case-insensitive and matches stored hashes', () => {
      const code = 'AbCd1234';
      const hash = crypto.createHash('sha256').update(code.toUpperCase()).digest('hex');
      expect(verifyBackupCode('abcd1234', [hash])).toBe(true);
      expect(verifyBackupCode('ABCD1234', [hash])).toBe(true);
      expect(verifyBackupCode('ZZZZZZZZ', [hash])).toBe(false);
    });

    it('removeBackupCode removes exactly the matching code hash', () => {
      const keep = crypto.createHash('sha256').update('KEEP0000').digest('hex');
      const remove = crypto.createHash('sha256').update('REMOVE00').digest('hex');
      const updated = removeBackupCode('remove00', [keep, remove]);
      expect(updated).toEqual([keep]);
    });
  });

  describe('generateQRCode', () => {
    it('returns data url when QR generation succeeds', async () => {
      const qrcode = await import('qrcode');
      const toDataURL = vi.mocked(
        (qrcode.default as { toDataURL: (url: string, opts?: unknown) => Promise<string> })
          .toDataURL
      );
      toDataURL.mockResolvedValueOnce('data:image/png;base64,AAA');

      const dataUrl = await generateQRCode('otpauth://totp/test');
      expect(dataUrl).toBe('data:image/png;base64,AAA');
    });

    it('throws a friendly error when QR generation fails', async () => {
      const qrcode = await import('qrcode');
      const toDataURL = vi.mocked(
        (qrcode.default as { toDataURL: (url: string, opts?: unknown) => Promise<string> })
          .toDataURL
      );
      toDataURL.mockRejectedValueOnce(new Error('bad'));

      await expect(generateQRCode('otpauth://totp/test')).rejects.toThrow(
        'Failed to generate QR code'
      );
    });
  });
});


