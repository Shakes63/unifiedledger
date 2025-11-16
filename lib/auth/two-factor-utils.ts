import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import crypto from 'crypto';

/**
 * Generate a TOTP secret for a user
 */
export function generateTwoFactorSecret(userEmail: string, appName: string = 'Unified Ledger'): {
  secret: string;
  otpauthUrl: string;
} {
  const secret = speakeasy.generateSecret({
    name: `${appName} (${userEmail})`,
    length: 32,
  });

  return {
    secret: secret.base32!,
    otpauthUrl: secret.otpauth_url!,
  };
}

/**
 * Generate QR code data URL for TOTP setup
 */
export async function generateQRCode(otpauthUrl: string): Promise<string> {
  try {
    const dataUrl = await QRCode.toDataURL(otpauthUrl, {
      errorCorrectionLevel: 'M',
      type: 'image/png',
      width: 300,
      margin: 1,
    });
    return dataUrl;
  } catch (error) {
    throw new Error('Failed to generate QR code');
  }
}

/**
 * Verify a TOTP token against a secret
 */
export function verifyTwoFactorToken(token: string, secret: string): boolean {
  try {
    const verified = speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token,
      window: 2, // Allow 2 time steps (60 seconds) of tolerance
    });
    return verified === true;
  } catch (error) {
    return false;
  }
}

/**
 * Generate backup codes for 2FA recovery
 * Returns both plaintext codes (for display) and hashed codes (for storage)
 */
export function generateBackupCodes(count: number = 8): {
  plaintextCodes: string[];
  hashedCodes: string[];
} {
  const plaintextCodes: string[] = [];
  const hashedCodes: string[] = [];

  for (let i = 0; i < count; i++) {
    // Generate 8-character alphanumeric code
    const code = crypto.randomBytes(4).toString('hex').toUpperCase();
    plaintextCodes.push(code);

    // Hash the code for storage (using SHA-256)
    const hash = crypto.createHash('sha256').update(code).digest('hex');
    hashedCodes.push(hash);
  }

  return { plaintextCodes, hashedCodes };
}

/**
 * Verify a backup code against stored hashed codes
 */
export function verifyBackupCode(code: string, hashedCodes: string[]): boolean {
  const hash = crypto.createHash('sha256').update(code.toUpperCase()).digest('hex');
  return hashedCodes.includes(hash);
}

/**
 * Remove a used backup code from the array
 */
export function removeBackupCode(code: string, hashedCodes: string[]): string[] {
  const hash = crypto.createHash('sha256').update(code.toUpperCase()).digest('hex');
  return hashedCodes.filter((h) => h !== hash);
}

